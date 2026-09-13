const crypto = require("crypto");

const QUERY_CONTRACT_ID = "LF_1PLUS9_FULL_CORPUS_QUERY_V1";
const OUTPUT_CONTRACT_ID = "LF_1PLUS9_FULL_CORPUS_AUDIT_V1";

function auditError(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(Buffer.isBuffer(value) ? value : String(value))
    .digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value))
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("de-AT")
    .replace(/[^\p{L}\p{N}%€]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function termOccurrences(text, alternatives) {
  const found = [];
  for (const rawAlternative of alternatives) {
    const alternative = normalizedText(rawAlternative);
    if (alternative.length < 3)
      throw auditError("LF_FULL_CORPUS_QUERY_TERM_TOO_SHORT", rawAlternative);
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(alternative, from);
      if (index < 0) break;
      found.push({ alternative, start: index, end: index + alternative.length });
      from = index + Math.max(1, alternative.length);
    }
  }
  return found.sort(
    (left, right) =>
      left.start - right.start ||
      right.alternative.length - left.alternative.length ||
      left.alternative.localeCompare(right.alternative)
  );
}

function minimumGroupSpan(groupOccurrences) {
  let best = null;
  function visit(groupIndex, selected) {
    if (groupIndex === groupOccurrences.length) {
      const start = Math.min(...selected.map((item) => item.start));
      const end = Math.max(...selected.map((item) => item.end));
      const candidate = { start, end, selected };
      if (
        !best ||
        end - start < best.end - best.start ||
        (end - start === best.end - best.start && start < best.start)
      )
        best = candidate;
      return;
    }
    for (const occurrence of groupOccurrences[groupIndex])
      visit(groupIndex + 1, [...selected, occurrence]);
  }
  visit(0, []);
  return best;
}

function pageRouteMatch(pageText, route) {
  const normalized = normalizedText(pageText);
  const groupOccurrences = route.groups.map(({ alternatives }) =>
    termOccurrences(normalized, alternatives)
  );
  if (groupOccurrences.some((occurrences) => occurrences.length === 0))
    return null;
  const span = minimumGroupSpan(groupOccurrences);
  if (span.end - span.start > route.maximumNormalizedSpan) return null;
  return {
    normalizedStart: span.start,
    normalizedEnd: span.end,
    normalizedSpan: span.end - span.start,
    matchedTerms: span.selected.map(({ alternative }) => alternative),
  };
}

function exactPageExcerpt(pageText, matchedTerms, maximumCharacters = 1_200) {
  const lowered = pageText
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("de-AT");
  const anchors = [...matchedTerms].sort(
    (left, right) => right.length - left.length || left.localeCompare(right)
  );
  const anchorIndex = anchors.reduce((found, anchor) => {
    if (found >= 0) return found;
    return lowered.indexOf(anchor);
  }, -1);
  const center = anchorIndex >= 0 ? anchorIndex : 0;
  let start = Math.max(0, center - Math.floor(maximumCharacters / 3));
  let end = Math.min(pageText.length, start + maximumCharacters);
  if (end === pageText.length) start = Math.max(0, end - maximumCharacters);
  const exactQuote = pageText.slice(start, end);
  return {
    pageTextStart: start,
    pageTextEnd: end,
    exactQuote,
    exactQuoteSha256: sha256(exactQuote),
  };
}

function validateQuerySpec(querySpec) {
  if (
    querySpec?.contractId !== QUERY_CONTRACT_ID ||
    !Array.isArray(querySpec.rows) ||
    querySpec.rows.length < 1
  )
    throw auditError("LF_FULL_CORPUS_QUERY_INVALID");
  const requirementIds = new Set();
  for (const row of querySpec.rows) {
    if (
      typeof row?.requirementId !== "string" ||
      requirementIds.has(row.requirementId) ||
      !Array.isArray(row.routes) ||
      row.routes.length < 1
    )
      throw auditError("LF_FULL_CORPUS_QUERY_ROW_INVALID");
    requirementIds.add(row.requirementId);
    const routeIds = new Set();
    for (const route of row.routes) {
      if (
        typeof route?.routeId !== "string" ||
        routeIds.has(route.routeId) ||
        !Number.isInteger(route.maximumNormalizedSpan) ||
        route.maximumNormalizedSpan < 3 ||
        !Array.isArray(route.groups) ||
        route.groups.length < 1 ||
        route.groups.some(
          (group) =>
            !Array.isArray(group?.alternatives) ||
            group.alternatives.length < 1 ||
            group.alternatives.some((term) => typeof term !== "string")
        )
      )
        throw auditError(
          "LF_FULL_CORPUS_QUERY_ROUTE_INVALID",
          row.requirementId
        );
      routeIds.add(route.routeId);
    }
  }
}

function buildLfKnownFixtureFullCorpusAudit({
  oracle,
  oracleSha256,
  querySpec,
  querySpecSha256,
  extractedDocuments,
  createdAt = new Date().toISOString(),
}) {
  validateQuerySpec(querySpec);
  if (
    oracle?.contractId !== "LF_COUNTERPART_GOLD_ORACLE_V1" ||
    !/^[a-f0-9]{64}$/u.test(oracleSha256 || "") ||
    !/^[a-f0-9]{64}$/u.test(querySpecSha256 || "") ||
    !Array.isArray(extractedDocuments)
  )
    throw auditError("LF_FULL_CORPUS_INPUT_INVALID");
  const expectedDocuments = oracle.documents.filter(({ side }) => side === "B");
  const extractedByFingerprint = new Map(
    extractedDocuments.map((document) => [document.fingerprint, document])
  );
  if (
    expectedDocuments.length !== 9 ||
    extractedByFingerprint.size !== expectedDocuments.length
  )
    throw auditError("LF_FULL_CORPUS_DOCUMENT_SET_INVALID");

  const documents = expectedDocuments.map((expected) => {
    const extracted = extractedByFingerprint.get(expected.fingerprint);
    if (
      !extracted ||
      extracted.originalName !== expected.originalName ||
      extracted.pdfSha256 !== expected.fingerprint ||
      !Array.isArray(extracted.pages) ||
      extracted.pages.length < 1 ||
      extracted.pages.some((page) => typeof page !== "string")
    )
      throw auditError(
        "LF_FULL_CORPUS_DOCUMENT_BINDING_INVALID",
        expected.originalName
      );
    return {
      originalName: expected.originalName,
      fingerprint: expected.fingerprint,
      role: expected.role,
      documentStatus: expected.documentStatus,
      pageCount: extracted.pages.length,
      extractedTextSha256: sha256(extracted.pages.join("\f")),
    };
  });

  const rows = querySpec.rows.map((row) => {
    const matches = [];
    for (const expected of expectedDocuments) {
      const extracted = extractedByFingerprint.get(expected.fingerprint);
      extracted.pages.forEach((pageText, pageIndex) => {
        for (const route of row.routes) {
          const routeMatch = pageRouteMatch(pageText, route);
          if (!routeMatch) continue;
          matches.push({
            routeId: route.routeId,
            documentName: expected.originalName,
            documentFingerprint: expected.fingerprint,
            documentRole: expected.role,
            documentStatus: expected.documentStatus,
            physicalPageNumber: pageIndex + 1,
            ...routeMatch,
            ...exactPageExcerpt(pageText, routeMatch.matchedTerms),
          });
        }
      });
    }
    return {
      requirementId: row.requirementId,
      routesExecuted: row.routes.length,
      documentsSearched: documents.length,
      pagesSearched: documents.reduce((sum, document) => sum + document.pageCount, 0),
      matches,
      sourceSearchComplete: true,
      absenceCertified: false,
      semanticDecision: null,
    };
  });

  const payload = {
    schemaVersion: 1,
    contractId: OUTPUT_CONTRACT_ID,
    status: "FULL_PDF_TEXT_CORPUS_SEARCH_COMPLETE_SEMANTIC_REVIEW_REQUIRED",
    goldAuthority: false,
    qaOnly: true,
    createdAt,
    bindings: { oracleSha256, querySpecSha256 },
    summary: {
      rows: rows.length,
      documents: documents.length,
      pages: documents.reduce((sum, document) => sum + document.pageCount, 0),
      routes: rows.reduce((sum, row) => sum + row.routesExecuted, 0),
      matches: rows.reduce((sum, row) => sum + row.matches.length, 0),
      absenceCertifiedRows: 0,
    },
    documents,
    rows,
    limitation:
      "Every configured lexical/synonym route was executed against every PDFKit-extracted page of all nine SHA-bound B PDFs. Route completion is not by itself semantic absence certification or Gold.",
  };
  return {
    ...payload,
    auditSha256: sha256(stableStringify(payload)),
  };
}

module.exports = {
  OUTPUT_CONTRACT_ID,
  QUERY_CONTRACT_ID,
  buildLfKnownFixtureFullCorpusAudit,
  normalizedText,
  pageRouteMatch,
  sha256,
  stableStringify,
};
