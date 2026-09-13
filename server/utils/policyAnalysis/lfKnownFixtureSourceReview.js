const crypto = require("crypto");

const SOURCE_REVIEW_PACKET_CONTRACT_ID = "LF_1PLUS9_SOURCE_REVIEW_PACKET_V2";
const SOURCE_REVIEW_RESPONSE_CONTRACT_ID =
  "LF_1PLUS9_SOURCE_REVIEW_RESPONSE_V2";
const REVIEW_OUTCOMES = new Set([
  "FULL_COUNTERPART",
  "PARTIAL_COUNTERPART",
  "NO_COUNTERPART_ESTABLISHED",
  "CONTRADICTED",
]);
const COMPONENT_OUTCOMES = new Set(["MATCH", "MISMATCH", "NOT_ESTABLISHED"]);
const STOP_WORDS = new Set([
  "aber",
  "alle",
  "als",
  "am",
  "an",
  "auf",
  "aus",
  "bei",
  "bis",
  "das",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "durch",
  "ein",
  "eine",
  "einer",
  "eines",
  "für",
  "gegen",
  "im",
  "in",
  "ist",
  "mit",
  "nach",
  "nicht",
  "oder",
  "sind",
  "und",
  "von",
  "vor",
  "wenn",
  "werden",
  "wird",
  "zu",
  "zum",
  "zur",
]);

function reviewError(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
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

function tokens(value) {
  return new Set(
    normalizedText(value)
      .split(" ")
      .filter(
        (token) =>
          token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/u.test(token)
      )
  );
}

function overlapRatio(query, candidate) {
  if (!query.size) return 0;
  let common = 0;
  for (const token of query) if (candidate.has(token)) common += 1;
  return common / query.size;
}

function factRoleDimension(factRole) {
  const dimensions = {
    CONDITION: "CONDITION",
    PERIL: "PERIL_OR_CAUSE",
    BENEFIT: "DAMAGE_OR_EFFECT",
    LIMIT: "LIMIT_BASIS",
    INSURED_OBJECT: "OBJECT",
    DEFINITION: "SCOPE",
    EXCLUSION: "COVERAGE_EFFECT",
    COST: "VALUE_AND_UNIT",
    DEDUCTIBLE: "DEDUCTIBLE",
    DOCUMENT_STATUS: "DOCUMENT_ROLE",
  };
  const dimension = dimensions[factRole];
  if (!dimension)
    throw reviewError("LF_SOURCE_REVIEW_FACT_ROLE_UNKNOWN", factRole);
  return dimension;
}

function candidateScore(candidate, component, row) {
  const query = tokens(
    [
      row.point,
      row.system?.aContent,
      row.claude?.sourceQuote,
      component.label,
    ].join(" ")
  );
  const quote = tokens(candidate.range.exactQuote);
  const lexical = overlapRatio(query, quote);
  const componentBonus =
    candidate.componentId === component.componentId ? 0.25 : 0;
  const rankBonus = 1 / Math.max(1, Number(candidate.rank) || 1);
  const lengthPenalty =
    Math.min(candidate.range.exactQuote.length, 5000) / 50000;
  return lexical * 3 + componentBonus + rankBonus - lengthPenalty;
}

function excerptRange(candidate, queryText, maximumQuoteCharacters) {
  const source = candidate.range.exactQuote;
  if (source.length <= maximumQuoteCharacters)
    return {
      exactQuote: source,
      exactQuoteSha256: candidate.range.exactQuoteSha256,
      documentStart: candidate.range.documentStart,
      documentEnd: candidate.range.documentEnd,
      excerpted: false,
    };
  const lowered = source.toLocaleLowerCase("de-AT");
  const anchors = [...tokens(queryText)].sort(
    (left, right) => right.length - left.length || left.localeCompare(right)
  );
  const anchorIndex = anchors.reduce((found, anchor) => {
    if (found >= 0) return found;
    return lowered.indexOf(anchor.toLocaleLowerCase("de-AT"));
  }, -1);
  const center = anchorIndex >= 0 ? anchorIndex : 0;
  let start = Math.max(0, center - Math.floor(maximumQuoteCharacters / 3));
  let end = Math.min(source.length, start + maximumQuoteCharacters);
  if (end === source.length) start = Math.max(0, end - maximumQuoteCharacters);
  if (start > 0) {
    const boundary = source.indexOf(" ", start);
    if (boundary >= 0 && boundary < start + 80) start = boundary + 1;
  }
  if (end < source.length) {
    const boundary = source.lastIndexOf(" ", end);
    if (boundary > end - 80) end = boundary;
  }
  const exactQuote = source.slice(start, end);
  return {
    exactQuote,
    exactQuoteSha256: sha256(exactQuote),
    documentStart: candidate.range.documentStart + start,
    documentEnd: candidate.range.documentStart + end,
    excerpted: true,
  };
}

function compactCandidate(
  candidate,
  document,
  component,
  row,
  maximumQuoteCharacters
) {
  const excerpt = excerptRange(
    candidate,
    [
      row.point,
      row.system?.aContent,
      row.claude?.sourceQuote,
      component.label,
    ].join(" "),
    maximumQuoteCharacters
  );
  return {
    candidateId: candidate.candidateId,
    componentId: candidate.componentId,
    documentUuid: candidate.range.documentUuid,
    documentFingerprint: candidate.range.documentFingerprint,
    documentName: document.originalName,
    documentRole: document.role,
    documentStatus: document.documentStatus,
    physicalPageNumber: candidate.range.physicalPageNumber,
    documentStart: excerpt.documentStart,
    documentEnd: excerpt.documentEnd,
    exactQuote: excerpt.exactQuote,
    exactQuoteSha256: excerpt.exactQuoteSha256,
    excerpted: excerpt.excerpted,
    oracleExactQuoteSha256: candidate.range.exactQuoteSha256,
    rank: candidate.rank,
    score: candidate.score,
  };
}

function selectComponentCandidates({
  candidates,
  component,
  row,
  documentsByUuid,
  maximumPerComponent,
  maximumQuoteCharacters,
  allowAllComponents = false,
}) {
  const seenQuotes = new Set();
  const scored = candidates
    .filter(
      (candidate) =>
        allowAllComponents ||
        candidate.componentId === null ||
        candidate.componentId === component.componentId
    )
    .filter((candidate) => {
      const key = `${candidate.range.documentFingerprint}:${candidate.range.exactQuoteSha256}`;
      if (seenQuotes.has(key)) return false;
      seenQuotes.add(key);
      return true;
    })
    .map((candidate) => ({
      candidate,
      reviewScore: candidateScore(candidate, component, row),
    }))
    .sort(
      (left, right) =>
        right.reviewScore - left.reviewScore ||
        left.candidate.range.exactQuote.length -
          right.candidate.range.exactQuote.length ||
        left.candidate.rank - right.candidate.rank ||
        left.candidate.candidateId.localeCompare(right.candidate.candidateId)
    );
  const selected = [];
  const selectedIds = new Set();
  const selectedDocuments = new Set();
  for (const item of scored) {
    if (selected.length >= maximumPerComponent) break;
    const documentUuid = item.candidate.range.documentUuid;
    if (selectedDocuments.has(documentUuid)) continue;
    selected.push(item);
    selectedIds.add(item.candidate.candidateId);
    selectedDocuments.add(documentUuid);
  }
  for (const item of scored) {
    if (selected.length >= maximumPerComponent) break;
    if (selectedIds.has(item.candidate.candidateId)) continue;
    selected.push(item);
    selectedIds.add(item.candidate.candidateId);
  }
  return selected.map(({ candidate }) => {
    const document = documentsByUuid.get(candidate.range.documentUuid);
    if (!document)
      throw reviewError(
        "LF_SOURCE_REVIEW_CANDIDATE_DOCUMENT_MISSING",
        candidate.candidateId
      );
    return compactCandidate(
      candidate,
      document,
      component,
      row,
      maximumQuoteCharacters
    );
  });
}

function clippedText(value, maximumCharacters) {
  const text = String(value || "").trim();
  if (text.length <= maximumCharacters) return text || null;
  return `${text.slice(0, maximumCharacters).trim()} […]`;
}

function buildLfKnownFixtureSourceReviewPacket({
  goldCandidate,
  oracle,
  maximumPerComponent = 4,
  maximumQuoteCharacters = 1_200,
  createdAt = new Date().toISOString(),
} = {}) {
  if (
    goldCandidate?.contractId !== "LF_1PLUS9_GOLD_CANDIDATE_V1" ||
    goldCandidate?.status !== "SOURCE_REVIEW_REQUIRED" ||
    !Array.isArray(goldCandidate.representativeReview) ||
    goldCandidate.representativeReview.length !== 30 ||
    oracle?.contractId !== "LF_COUNTERPART_GOLD_ORACLE_V1" ||
    !Array.isArray(oracle.benchmarkCandidates) ||
    !Array.isArray(oracle.documents) ||
    !Number.isInteger(maximumPerComponent) ||
    maximumPerComponent < 1 ||
    !Number.isInteger(maximumQuoteCharacters) ||
    maximumQuoteCharacters < 200
  )
    throw reviewError("LF_SOURCE_REVIEW_INPUT_INVALID");
  const rowsByRequirement = new Map(
    goldCandidate.rows.map((row) => [row.requirementId, row])
  );
  const oracleRows = new Map(
    oracle.rows.map((row) => [row.requirementId, row])
  );
  const candidatesById = new Map(
    oracle.benchmarkCandidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ])
  );
  const bDocuments = oracle.documents.filter(({ side }) => side === "B");
  if (bDocuments.length !== 9)
    throw reviewError("LF_SOURCE_REVIEW_B_DOCUMENT_COUNT_INVALID");
  const documentsByUuid = new Map(
    bDocuments.map((document) => [document.uuid, document])
  );
  const rows = goldCandidate.representativeReview.map(
    ({ requirementId, relation }, reviewIndex) => {
      const row = rowsByRequirement.get(requirementId);
      const oracleRow = oracleRows.get(requirementId);
      if (!row || !oracleRow || row.analysisRowId !== oracleRow.analysisRowId)
        throw reviewError(
          "LF_SOURCE_REVIEW_ROW_BINDING_INVALID",
          requirementId
        );
      const rowCandidates = oracleRow.benchmarkCandidateIds.map(
        (candidateId) => {
          const candidate = candidatesById.get(candidateId);
          if (!candidate)
            throw reviewError(
              "LF_SOURCE_REVIEW_CANDIDATE_MISSING",
              candidateId
            );
          return candidate;
        }
      );
      const components = row.components.map((component) => ({
        componentId: component.componentId,
        label: component.label,
        factRole: component.factRole,
        dimension: factRoleDimension(component.factRole),
        candidates: selectComponentCandidates({
          candidates: rowCandidates,
          component,
          row,
          documentsByUuid,
          maximumPerComponent,
          maximumQuoteCharacters,
        }),
      }));
      const rowContext = {
        componentId: `__row_context__:${requirementId}`,
        label: [row.category, row.subcategory, row.point].join(" > "),
        factRole: "ROW_CONTEXT",
        dimension: "SCOPE",
        contextOnly: true,
        candidates: selectComponentCandidates({
          candidates: rowCandidates,
          component: {
            componentId: `__row_context__:${requirementId}`,
            label: [row.category, row.subcategory, row.point].join(" "),
          },
          row,
          documentsByUuid,
          maximumPerComponent,
          maximumQuoteCharacters,
          allowAllComponents: true,
        }),
      };
      const semanticChecks = [rowContext, ...components];
      return {
        reviewIndex,
        analysisRowId: row.analysisRowId,
        requirementId,
        relation,
        category: row.category,
        subcategory: row.subcategory,
        point: row.point,
        referenceA: {
          content: row.system.aContent,
          values: row.system.aValues,
          source: row.system.aSource,
        },
        claudeClaim: {
          foundStatus: row.claude.foundStatus,
          coverageStatus: row.claude.coverageStatus,
          values: row.claude.values,
          sourceQuote: clippedText(row.claude.sourceQuote, 3_000),
          sourceFiles: row.claude.sourceFiles,
          note: clippedText(row.claude.note, 2_000),
        },
        systemClaim: {
          customerSearchStatus: row.system.customerSearchStatus,
          bCounterpart: clippedText(row.system.bCounterpart, 3_000),
          bCoverage: row.system.bCoverage,
          bValues: row.system.bValues,
          note: clippedText(row.system.note, 1_000),
        },
        searchedDocuments: bDocuments.map(
          ({ uuid, fingerprint, originalName, role, documentStatus }) => ({
            uuid,
            fingerprint,
            originalName,
            role,
            documentStatus,
          })
        ),
        retrieval: {
          exactCandidateCount: rowCandidates.length,
          selectedCandidateCount: semanticChecks.reduce(
            (sum, component) => sum + component.candidates.length,
            0
          ),
          absenceCertified: false,
          negativeMeaning:
            "NO_COUNTERPART_ESTABLISHED means no counterpart in the reviewed exact candidates, not certified global absence.",
        },
        actualComponents: components.length,
        components: semanticChecks,
      };
    }
  );
  const payload = {
    schemaVersion: 1,
    contractId: SOURCE_REVIEW_PACKET_CONTRACT_ID,
    status: "READY_FOR_SOURCE_REVIEW",
    qaOnly: true,
    productionRule: false,
    createdAt,
    authority:
      "EXACT_SOURCE_RANGES_ARE_EVIDENCE; MODEL_OUTPUT_REQUIRES_CODEX_ADJUDICATION",
    bindings: {
      goldCandidateSha256: goldCandidate.candidateSha256,
      oracleSha256: goldCandidate.bindings.oracleSha256,
      oracleId: oracle.oracleId,
    },
    selection: {
      sample: "REPRESENTATIVE_30_V1",
      maximumPerComponent,
      maximumQuoteCharacters,
      candidatePolicy:
        "LEXICAL_COMPONENT_RANK_WITH_DOCUMENT_DIVERSITY; NAVIGATION_ONLY",
    },
    rows,
    summary: {
      rows: rows.length,
      actualComponents: rows.reduce(
        (sum, row) => sum + row.actualComponents,
        0
      ),
      semanticChecks: rows.reduce((sum, row) => sum + row.components.length, 0),
      exactCandidatesAvailable: rows.reduce(
        (sum, row) => sum + row.retrieval.exactCandidateCount,
        0
      ),
      exactCandidatesSelected: rows.reduce(
        (sum, row) => sum + row.retrieval.selectedCandidateCount,
        0
      ),
      searchedDocumentsPerRow: bDocuments.length,
      absenceCertifiedRows: 0,
    },
  };
  return {
    ...payload,
    packetSha256: sha256(
      `${SOURCE_REVIEW_PACKET_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

function validateSourceReviewResponse(row, response) {
  if (
    response?.contractId !== SOURCE_REVIEW_RESPONSE_CONTRACT_ID ||
    response.requirementId !== row?.requirementId ||
    !REVIEW_OUTCOMES.has(response.outcome) ||
    !Array.isArray(response.componentFindings) ||
    response.componentFindings.length !== row.components.length ||
    typeof response.rationale !== "string" ||
    !response.rationale.trim()
  )
    throw reviewError("LF_SOURCE_REVIEW_RESPONSE_INVALID");
  const componentById = new Map(
    row.components.map((component) => [component.componentId, component])
  );
  const seen = new Set();
  for (const finding of response.componentFindings) {
    const component = componentById.get(finding?.componentId);
    if (
      !component ||
      seen.has(finding.componentId) ||
      finding.dimension !== component.dimension ||
      !COMPONENT_OUTCOMES.has(finding.outcome) ||
      !Array.isArray(finding.candidateIds)
    )
      throw reviewError("LF_SOURCE_REVIEW_COMPONENT_FINDING_INVALID");
    seen.add(finding.componentId);
    const allowed = new Set(
      component.candidates.map(({ candidateId }) => candidateId)
    );
    if (
      new Set(finding.candidateIds).size !== finding.candidateIds.length ||
      finding.candidateIds.some((candidateId) => !allowed.has(candidateId)) ||
      (finding.outcome === "NOT_ESTABLISHED"
        ? finding.candidateIds.length !== 0
        : finding.candidateIds.length === 0)
    )
      throw reviewError("LF_SOURCE_REVIEW_COMPONENT_EVIDENCE_INVALID");
  }
  const outcomes = response.componentFindings.map(({ outcome }) => outcome);
  const expectedOutcome = outcomes.every((outcome) => outcome === "MATCH")
    ? "FULL_COUNTERPART"
    : outcomes.includes("MISMATCH") && !outcomes.includes("NOT_ESTABLISHED")
      ? "CONTRADICTED"
      : outcomes.includes("MATCH")
        ? "PARTIAL_COUNTERPART"
        : "NO_COUNTERPART_ESTABLISHED";
  if (response.outcome !== expectedOutcome)
    throw reviewError("LF_SOURCE_REVIEW_ROW_OUTCOME_INVALID");
  return response;
}

module.exports = {
  SOURCE_REVIEW_PACKET_CONTRACT_ID,
  SOURCE_REVIEW_RESPONSE_CONTRACT_ID,
  buildLfKnownFixtureSourceReviewPacket,
  factRoleDimension,
  normalizedText,
  sha256,
  stableStringify,
  validateSourceReviewResponse,
};
