const crypto = require("crypto");
const { jsonrepair } = require("jsonrepair");

const AUDIT_CASE_SCHEMA_VERSION = 1;
const AUDIT_CASE_CONTRACT_ID = "LF_REFERENCE_REVIEW_AUDIT_CASE_V1";
const AUDIT_RESULT_SCHEMA_VERSION = 1;
const AUDIT_RESULT_CONTRACT_ID = "LF_REFERENCE_REVIEW_AUDIT_RESULT_V1";

const COMPONENT_FINDINGS = Object.freeze([
  "DIRECT_SUPPORT",
  "NARROWER_SUPPORT",
  "CONTRADICTION",
  "RELATED_ONLY",
  "MENTION_ONLY",
  "NO_MATCH_IN_CANDIDATES",
  "UNCLEAR",
]);
const ROW_DISPOSITIONS = Object.freeze([
  "COMPLETE_COUNTERPART_CANDIDATE",
  "PARTIAL_REMAINS_WITH_EVIDENCE",
  "PRESENT_BUT_NO_DECISION_READY_COMPONENT",
  "CONTRADICTION_REVIEW_REQUIRED",
  "AUDIT_UNCLEAR",
  "NO_ADDITIONAL_MATCH_IN_CANDIDATES",
]);
const ROOT_CAUSES = Object.freeze([
  "TRUE_PARTIAL",
  "FALSE_POSITIVE_CURRENT_SOURCE",
  "MISSED_COUNTERPART_CANDIDATE",
  "COMPONENT_MODELING_GAP",
  "SCOPE_ROLE_CONDITION_OR_VALUE_MISMATCH",
  "PACKAGE_PRECEDENCE_UNCLEAR",
  "INSUFFICIENT_EVIDENCE",
]);
const RECOMMENDED_ACTIONS = Object.freeze([
  "KEEP_PARTIAL",
  "PROMOTE_TO_FOUND_AFTER_RULE_FIX",
  "DEMOTE_TO_UNCLEAR_AFTER_RULE_FIX",
  "MARK_CONTRADICTED_AFTER_RULE_FIX",
  "REVIEW_COMPONENT_MODEL",
  "MANUAL_REVIEW_REQUIRED",
]);
const CURRENT_SOURCE_ASSESSMENTS = Object.freeze([
  "VALID_COMPLETE_EVIDENCE",
  "VALID_PARTIAL_EVIDENCE",
  "RELATED_ONLY",
  "WRONG_SCOPE_OR_ROLE",
  "CONTRADICTORY",
  "UNCLEAR",
]);
const COVERAGE_EFFECTS = Object.freeze([
  "INCLUDED",
  "LIMITED",
  "EXCLUDED",
  "DEFINED",
  "UNKNOWN",
]);
const VALUE_COMPARISONS = Object.freeze([
  "SAME",
  "DIFFERENT",
  "NOT_APPLICABLE",
  "UNCLEAR",
]);
const CONFIDENCE_LEVELS = Object.freeze(["HIGH", "MEDIUM", "LOW"]);
const SCOPE_RELATIONS = Object.freeze([
  "SAME_OR_BROADER",
  "NARROWER",
  "DIFFERENT",
  "NOT_APPLICABLE",
  "UNCLEAR",
]);

const STOPWORDS = new Set(
  "aber alle allen als also am an auch auf aus bei beim bis da das dass dem den der des die dies diese diesem diesen dieser dieses doch durch ein eine einem einen einer eines er es für gegen hat im in ins ist je kann kein keine mit nach nicht noch nur oder ohne pro sein sind so sowie über um und unter vom von vor war werden wie wird zu zum zur".split(
    " "
  )
);
const SUPPORT_ANCHOR_FACT_ROLES = new Set([
  "INSURED_OBJECT",
  "PERIL",
  "COST",
  "BENEFIT",
  "CONDITION",
  "EXCLUSION",
  "DEFINITION",
]);
const GENERIC_SUPPORT_TOKENS = new Set([
  "bedingung",
  "deckung",
  "enthalten",
  "erstes",
  "gefahr",
  "gebaude",
  "grundstuck",
  "kosten",
  "leistung",
  "objekt",
  "risiko",
  "sache",
  "sachen",
  "schaden",
  "summe",
  "versichert",
  "versicherung",
  "versicherungssumme",
]);
const GERMAN_PERCENTAGE_WORDS = Object.freeze({
  1: "ein",
  2: "zwei",
  3: "drei",
  4: "vier",
  5: "funf",
  10: "zehn",
  15: "funfzehn",
  20: "zwanzig",
  25: "funfundzwanzig",
  30: "dreissig",
  50: "funfzig",
  100: "hundert",
});
const SUPPORT_ANCHOR_NORMALIZATION_REASONS = Object.freeze([
  "SEMANTIC_ANCHOR_MISSING",
  "COMPARABLE_LIMIT_VALUE_MISSING",
  "UNBOUND_QUOTE_DROPPED",
  "ROW_LOCAL_COMPARABLE_LIMIT_REBOUND",
  "ORPHAN_LIMIT_WITHOUT_SUBJECT",
]);

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key])])
  );
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(Buffer.isBuffer(value) ? value : String(value))
    .digest("hex");
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/ß/gu, "ss")
    .replace(/[^a-z0-9€%]+/gu, " ")
    .trim();
}

function normalizeQuote(value) {
  return (
    String(value ?? "")
      .normalize("NFKC")
      .replace(/\u00ad/gu, "")
      // Structured-output models sometimes serialize a copied line break twice,
      // leaving the literal characters "\\n" in the parsed JSON string. Treat
      // only escaped whitespace markers like physical-page whitespace; all other
      // characters must still match the source text.
      .replace(/\\(?:r\\n|n|r|t)/gu, " ")
      // OCR and structured-output models can use different Unicode quotation
      // marks around otherwise verbatim source text. Treat only the glyph
      // variants as equivalent; wording and punctuation still have to match.
      .replace(/[\u2018\u2019\u201a\u201b\u2032']/gu, "'")
      .replace(/[\u201c\u201d\u201e\u201f\u2033"]/gu, '"')
      .replace(/([\p{L}\p{N}])-\s+(?=[\p{L}\p{N}])/gu, "$1")
      .replace(/\s+/gu, " ")
      .trim()
      .toLowerCase()
  );
}

function quoteMatchesText(text, quote) {
  const normalizedQuote = normalizeQuote(quote);
  if (normalizedQuote.length < 12) return false;
  const normalizedText = normalizeQuote(text);
  return (
    normalizedText.includes(normalizedQuote) ||
    normalizedText
      .replace(/\s+/gu, "")
      .includes(normalizedQuote.replace(/\s+/gu, ""))
  );
}

function tokens(value) {
  return normalize(value)
    .split(/\s+/u)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function componentSupportAnchors(component) {
  return [
    ...new Set(
      tokens([component.label, ...(component.aliases ?? [])].join(" ")).filter(
        (token) => !GENERIC_SUPPORT_TOKENS.has(token)
      )
    ),
  ];
}

function requiredPercentageAnchors(requirement, component) {
  const relatedValues = (requirement.values ?? []).filter(
    (value) => value.componentId === component.id
  );
  const sourceStrings = [
    component.valueBinding?.formula,
    ...relatedValues.flatMap((value) => [
      value.rawValue,
      value.normalizedValue,
      value.formula,
    ]),
  ].filter(Boolean);
  const percentages = new Set();
  for (const source of sourceStrings) {
    const normalizedOcr = String(source).replace(/\b[lI](?=\d+\s*%)/gu, "1");
    for (const match of normalizedOcr.matchAll(/\b(\d+(?:[.,]\d+)?)\s*%/gu))
      percentages.add(Number(match[1].replace(",", ".")));
    for (const match of normalizedOcr.matchAll(/\*\s*(0[.,]\d+)\b/gu))
      percentages.add(Number(match[1].replace(",", ".")) * 100);
  }
  return [...percentages]
    .filter((value) => Number.isFinite(value) && value > 0)
    .flatMap((value) => {
      const display = String(value);
      return [
        `${display}%`,
        `${display} %`,
        `${display} prozent`,
        ...(GERMAN_PERCENTAGE_WORDS[display]
          ? [`${GERMAN_PERCENTAGE_WORDS[display]} prozent`]
          : []),
      ];
    });
}

function hasConcreteComparableLimitValue(value) {
  const source = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase();
  if (/\b\d+(?:[.,]\d+)?\s*%/u.test(source)) return true;
  const percentageWords = Object.values(GERMAN_PERCENTAGE_WORDS).join("|");
  if (new RegExp(`\\b(?:${percentageWords})\\s+prozent\\b`, "u").test(source))
    return true;
  return (
    /(?:eur|€)\s*\d/u.test(source) ||
    /\b\d[\d.\s]*(?:,\d+)?\s*(?:\beur\b|\beuro\b|€)/u.test(source)
  );
}

function extractConcreteComparableValues(value) {
  const source = String(value ?? "");
  const matches = [
    ...source.matchAll(/\b\d+(?:[.,]\d+)?\s*%/gu),
    ...source.matchAll(
      new RegExp(
        `\\b(?:${Object.values(GERMAN_PERCENTAGE_WORDS).join("|")})\\s+prozent\\b`,
        "giu"
      )
    ),
    ...source.matchAll(/(?:EUR|€)\s*\d[\d.\s]*(?:,\d+)?(?:\.-)?/giu),
    ...source.matchAll(/\b\d[\d.\s]*(?:,\d+)?\s*(?:\bEUR\b|\bEuro\b|€)/giu),
  ].map(([match]) => match.replace(/\s+/gu, " ").trim());
  return [...new Set(matches.filter(Boolean))];
}

function applyRowLocalComparableLimitPolicy(auditCase, result) {
  const normalizedResult = structuredClone(result);
  const normalizations = [...(normalizedResult.serverNormalizations ?? [])];
  for (const assessment of normalizedResult.componentAssessments ?? []) {
    const component = auditCase.semanticRequirement.components.find(
      ({ id }) => id === assessment.componentId
    );
    if (
      !component ||
      normalizations.some(
        (normalization) =>
          normalization.componentId === assessment.componentId &&
          normalization.reasons?.includes("UNBOUND_QUOTE_DROPPED")
      ) ||
      requiredPercentageAnchors(auditCase.semanticRequirement, component)
        .length === 0 ||
      ![
        "RELATED_ONLY",
        "MENTION_ONLY",
        "NO_MATCH_IN_CANDIDATES",
        "UNCLEAR",
      ].includes(assessment.finding)
    )
      continue;
    const donors = (normalizedResult.componentAssessments ?? []).flatMap(
      (candidateAssessment) => {
        if (
          candidateAssessment.componentId === assessment.componentId ||
          !["DIRECT_SUPPORT", "NARROWER_SUPPORT"].includes(
            candidateAssessment.finding
          )
        )
          return [];
        const supportingIds = new Set(
          candidateAssessment.supportingCandidateIds ?? []
        );
        return (candidateAssessment.exactQuotes ?? [])
          .filter(
            ({ candidateId, quote }) =>
              supportingIds.has(candidateId) &&
              hasConcreteComparableLimitValue(quote)
          )
          .map((quote) => ({
            quote,
            donorFinding: candidateAssessment.finding,
            donorScopeRelation: candidateAssessment.scopeRelation,
            values: extractConcreteComparableValues(quote.quote),
          }))
          .filter(({ values }) => values.length > 0);
      }
    );
    if (donors.length === 0) continue;
    const originalFinding = assessment.finding;
    const supportingCandidateIds = [
      ...new Set(donors.map(({ quote }) => quote.candidateId)),
    ];
    assessment.finding = donors.some(
      ({ donorFinding, donorScopeRelation }) =>
        donorFinding === "NARROWER_SUPPORT" || donorScopeRelation === "NARROWER"
    )
      ? "NARROWER_SUPPORT"
      : "DIRECT_SUPPORT";
    assessment.supportingCandidateIds = supportingCandidateIds;
    assessment.contradictingCandidateIds = [];
    assessment.reviewedCandidateIds = (assessment.reviewedCandidateIds ?? [])
      .filter((candidateId) => !supportingCandidateIds.includes(candidateId))
      .slice(0, 5);
    assessment.exactQuotes = donors.map(({ quote }) => quote);
    assessment.coverageEffect = "DEFINED";
    assessment.scopeRelation =
      assessment.finding === "NARROWER_SUPPORT"
        ? "NARROWER"
        : "SAME_OR_BROADER";
    assessment.observedBValues = donors.flatMap(({ quote, values }) =>
      values.map((value) => ({
        candidateId: quote.candidateId,
        value,
        relationToA: "DIFFERENT",
      }))
    );
    assessment.note = `Server-Rebind (ROW_LOCAL_COMPARABLE_LIMIT_REBOUND): Eine bereits quellengebundene Fundstelle derselben LF-Zeile belegt den Gegenstand und enthält den konkreten Vergleichswert ${assessment.observedBValues
      .map(({ value }) => value)
      .join(", ")}.`;
    normalizations.push({
      componentId: assessment.componentId,
      originalFinding,
      normalizedFinding: assessment.finding,
      reasons: ["ROW_LOCAL_COMPARABLE_LIMIT_REBOUND"],
    });
  }
  if (normalizations.length > 0)
    normalizedResult.serverNormalizations = normalizations;
  return normalizedResult;
}

function applyOrphanLimitPolicy(auditCase, result) {
  const normalizedResult = structuredClone(result);
  const normalizations = [...(normalizedResult.serverNormalizations ?? [])];
  const subjectComponentIds = new Set(
    auditCase.semanticRequirement.components
      .filter(({ factRole }) =>
        ["INSURED_OBJECT", "PERIL", "COST", "BENEFIT"].includes(factRole)
      )
      .map(({ id }) => id)
  );
  if (subjectComponentIds.size === 0) return normalizedResult;
  const subjectSupported = (normalizedResult.componentAssessments ?? []).some(
    ({ componentId, finding }) =>
      subjectComponentIds.has(componentId) &&
      ["DIRECT_SUPPORT", "NARROWER_SUPPORT"].includes(finding)
  );
  if (subjectSupported) return normalizedResult;
  for (const assessment of normalizedResult.componentAssessments ?? []) {
    const component = auditCase.semanticRequirement.components.find(
      ({ id }) => id === assessment.componentId
    );
    if (
      component?.factRole !== "LIMIT" ||
      !["DIRECT_SUPPORT", "NARROWER_SUPPORT"].includes(assessment.finding)
    )
      continue;
    const originalFinding = assessment.finding;
    assessment.finding = "RELATED_ONLY";
    assessment.reviewedCandidateIds = [
      ...new Set([
        ...(assessment.supportingCandidateIds ?? []),
        ...(assessment.reviewedCandidateIds ?? []),
      ]),
    ].slice(0, 5);
    assessment.supportingCandidateIds = [];
    assessment.observedBValues = [];
    assessment.coverageEffect = "UNKNOWN";
    assessment.scopeRelation = "DIFFERENT";
    assessment.note = `Server-Fail-Closed (ORPHAN_LIMIT_WITHOUT_SUBJECT): ${assessment.note}`;
    normalizations.push({
      componentId: assessment.componentId,
      originalFinding,
      normalizedFinding: assessment.finding,
      reasons: ["ORPHAN_LIMIT_WITHOUT_SUBJECT"],
    });
  }
  if (normalizations.length > 0)
    normalizedResult.serverNormalizations = normalizations;
  return normalizedResult;
}

function supportAnchorViolations(requirement, component, assessment, quotes) {
  if (!["DIRECT_SUPPORT", "NARROWER_SUPPORT"].includes(assessment.finding))
    return [];
  const violations = [];
  const quotedText = normalize(quotes.map(({ quote }) => quote).join(" "));
  if (SUPPORT_ANCHOR_FACT_ROLES.has(component.factRole)) {
    const semanticAnchors = componentSupportAnchors(component);
    if (
      semanticAnchors.length > 0 &&
      !semanticAnchors.some((anchor) => quotedText.includes(anchor))
    )
      violations.push("SEMANTIC_ANCHOR_MISSING");
  }
  const percentageAnchors = requiredPercentageAnchors(requirement, component);
  if (
    percentageAnchors.length > 0 &&
    !hasConcreteComparableLimitValue(quotes.map(({ quote }) => quote).join(" "))
  )
    violations.push("COMPARABLE_LIMIT_VALUE_MISSING");
  return violations;
}

function applySupportAnchorPolicy(auditCase, result) {
  const normalizedResult = structuredClone(result);
  const normalizations = [...(normalizedResult.serverNormalizations ?? [])];
  for (const assessment of normalizedResult.componentAssessments ?? []) {
    const component = auditCase.semanticRequirement.components.find(
      ({ id }) => id === assessment.componentId
    );
    if (!component) continue;
    const supportingIds = assessment.supportingCandidateIds ?? [];
    const supportingQuotes = (assessment.exactQuotes ?? []).filter(
      ({ candidateId }) => supportingIds.includes(candidateId)
    );
    const violations = supportAnchorViolations(
      auditCase.semanticRequirement,
      component,
      assessment,
      supportingQuotes
    );
    if (violations.length === 0) continue;
    const originalFinding = assessment.finding;
    const quoteCandidateIds = supportingQuotes.map(
      ({ candidateId }) => candidateId
    );
    assessment.finding =
      quoteCandidateIds.length > 0 ? "RELATED_ONLY" : "NO_MATCH_IN_CANDIDATES";
    assessment.reviewedCandidateIds = [
      ...new Set([
        ...quoteCandidateIds,
        ...(assessment.reviewedCandidateIds ?? []),
        ...supportingIds,
      ]),
    ].slice(0, 5);
    assessment.supportingCandidateIds = [];
    assessment.observedBValues = [];
    assessment.coverageEffect = "UNKNOWN";
    assessment.scopeRelation = violations.includes("SEMANTIC_ANCHOR_MISSING")
      ? "DIFFERENT"
      : "UNCLEAR";
    assessment.note = `Server-Fail-Closed (${violations.join(", ")}): ${assessment.note}`;
    normalizations.push({
      componentId: assessment.componentId,
      originalFinding,
      normalizedFinding: assessment.finding,
      reasons: violations,
    });
  }
  if (normalizations.length > 0)
    normalizedResult.serverNormalizations = normalizations;
  return normalizedResult;
}

function validateSupportAnchors(requirement, component, assessment, quotes) {
  const violations = supportAnchorViolations(
    requirement,
    component,
    assessment,
    quotes
  );
  if (violations.includes("SEMANTIC_ANCHOR_MISSING"))
    throw new Error("LF_REFERENCE_AUDIT_SUPPORT_ANCHOR_INVALID");
  if (violations.includes("REQUIRED_PERCENTAGE_MISSING"))
    throw new Error("LF_REFERENCE_AUDIT_PERCENTAGE_ANCHOR_INVALID");
}

function parseDocumentPages(pageContent, pageMap) {
  const markers = [
    ...String(pageContent ?? "").matchAll(/\[DOCUMENT_PAGE (\d+)\]\r?\n/gu),
  ];
  const pages = markers.map((marker, index) => ({
    pageNumber: Number(marker[1]),
    text: String(pageContent)
      .slice(
        marker.index + marker[0].length,
        markers[index + 1]?.index ?? String(pageContent).length
      )
      .trim(),
  }));
  if (
    !Array.isArray(pageMap) ||
    pages.length !== pageMap.length ||
    pages.some((page, index) => page.pageNumber !== pageMap[index]?.pageNumber)
  )
    throw new Error("LF_REFERENCE_AUDIT_PAGE_MAP_MISMATCH");
  return pages;
}

function buildSourceChunks(
  documents,
  { windowSize = 1800, overlap = 350 } = {}
) {
  if (windowSize < 900 || overlap < 0 || overlap >= windowSize)
    throw new Error("LF_REFERENCE_AUDIT_CHUNK_CONFIGURATION_INVALID");
  const chunks = [];
  for (const document of [...documents].sort(
    (left, right) => left.position - right.position
  )) {
    for (const page of document.pages) {
      const text = page.text.replace(/\r/gu, "");
      let start = 0;
      while (start < text.length) {
        let end = Math.min(text.length, start + windowSize);
        if (end < text.length) {
          const boundary = text.lastIndexOf("\n", end);
          if (boundary > start + Math.floor(windowSize / 2)) end = boundary;
        }
        const chunkText = text.slice(start, end).trim();
        if (!chunkText) break;
        const chunkIdentity = {
          documentSha256: document.sha256,
          pageNumber: page.pageNumber,
          pageOffsetStart: start,
          pageOffsetEnd: end,
          textSha256: sha256(chunkText),
        };
        const chunk = {
          id: `candidate:${sha256(canonicalJson(chunkIdentity))}`,
          documentUuid: document.uuid,
          documentSha256: document.sha256,
          documentName: document.name,
          documentRole: document.role,
          documentStatus: document.documentStatus,
          documentPosition: document.position,
          pageNumber: page.pageNumber,
          pageOffsetStart: start,
          pageOffsetEnd: end,
          text: chunkText,
          textSha256: chunkIdentity.textSha256,
        };
        chunks.push({
          ...chunk,
          normalizedText: normalize(chunkText),
          tokenSet: new Set(tokens(chunkText)),
        });
        if (end >= text.length) break;
        start = Math.max(start + 1, end - overlap);
      }
    }
  }
  return chunks;
}

function contributorPages(contributor) {
  return [
    ...String(contributor?.source ?? "").matchAll(/PDF-Seite\s+(\d+)/gu),
  ].map((match) => Number(match[1]));
}

function contributorQuotes(contributor) {
  return [...String(contributor?.source ?? "").matchAll(/„([^“]{12,})“/gu)].map(
    (match) => normalize(match[1])
  );
}

function rankCandidates({ row, requirement, chunks, topK = 14 }) {
  const documentFrequency = new Map();
  for (const chunk of chunks)
    for (const token of chunk.tokenSet)
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);

  const componentText = (requirement.components ?? [])
    .flatMap((component) => [component.label, ...(component.aliases ?? [])])
    .join(" ");
  const valueText = (requirement.values ?? [])
    .map((value) => canonicalJson(value))
    .join(" ");
  const queryText = [
    row.categoryName,
    row.subcategoryName,
    row.packageA?.documentedContent,
    componentText,
    valueText,
  ].join(" ");
  const queryTokens = [...new Set(tokens(queryText))];
  const primaryTokens = new Set(
    tokens([row.categoryName, componentText, valueText].join(" "))
  );
  const phrases = [
    row.categoryName,
    ...(requirement.components ?? []).flatMap((component) => [
      component.label,
      ...(component.aliases ?? []),
    ]),
  ]
    .map(normalize)
    .filter((phrase) => phrase.split(" ").length >= 2 && phrase.length >= 8);
  const scored = chunks.map((chunk) => {
    let score = 0;
    const matchedTokens = [];
    for (const token of queryTokens) {
      if (!chunk.tokenSet.has(token)) continue;
      const frequency = documentFrequency.get(token) ?? 1;
      const inverseFrequency = Math.log(
        1 + (chunks.length + 0.5) / (frequency + 0.5)
      );
      score += inverseFrequency * (primaryTokens.has(token) ? 4 : 1);
      matchedTokens.push(token);
    }
    const phraseHits = phrases.filter((phrase) =>
      chunk.normalizedText.includes(phrase)
    );
    score += phraseHits.length * 8;
    return { chunk, score, matchedTokens, phraseHits };
  });
  scored.sort(
    (left, right) =>
      right.score - left.score || left.chunk.id.localeCompare(right.chunk.id)
  );

  const selected = new Map();
  for (const item of scored.slice(0, topK)) selected.set(item.chunk.id, item);
  const documentUuids = [
    ...new Set(chunks.map(({ documentUuid }) => documentUuid)),
  ];
  for (const documentUuid of documentUuids) {
    const best = scored.find(
      (item) => item.chunk.documentUuid === documentUuid
    );
    if (best) selected.set(best.chunk.id, best);
  }
  const currentContributorGroups = (row.packageB?.contributors ?? []).map(
    (contributor) => {
      const pages = contributorPages(contributor);
      const quotes = contributorQuotes(contributor);
      const matchingCandidateIds = [];
      const currentSourceItems = scored
        .filter(
          ({ chunk }) =>
            chunk.documentUuid === contributor.documentUuid &&
            pages.includes(chunk.pageNumber)
        )
        .sort((left, right) => {
          const leftQuoteHits = quotes.filter((quote) =>
            left.chunk.normalizedText.includes(quote)
          ).length;
          const rightQuoteHits = quotes.filter((quote) =>
            right.chunk.normalizedText.includes(quote)
          ).length;
          return (
            rightQuoteHits - leftQuoteHits ||
            right.score - left.score ||
            left.chunk.id.localeCompare(right.chunk.id)
          );
        })
        .slice(0, 2);
      for (const item of currentSourceItems) {
        selected.set(item.chunk.id, item);
        matchingCandidateIds.push(item.chunk.id);
      }
      return {
        documentUuid: contributor.documentUuid,
        documentName: contributor.documentName,
        documentStatus: contributor.documentStatus,
        currentReviewStatus: contributor.reviewStatus,
        currentSource: contributor.source,
        pageNumbers: pages,
        matchingCandidateIds: [...new Set(matchingCandidateIds)].sort(),
      };
    }
  );
  const orderedSelected = [...selected.values()].sort(
    (left, right) =>
      right.score - left.score || left.chunk.id.localeCompare(right.chunk.id)
  );
  const prioritized = new Map();
  const addCandidate = (item) => {
    if (item) prioritized.set(item.chunk.id, item);
  };
  for (const candidateId of currentContributorGroups.flatMap(
    ({ matchingCandidateIds }) => matchingCandidateIds
  ))
    addCandidate(selected.get(candidateId));
  for (const documentUuid of documentUuids)
    addCandidate(
      orderedSelected.find(({ chunk }) => chunk.documentUuid === documentUuid)
    );
  for (const item of orderedSelected) addCandidate(item);
  const retained = [...prioritized.values()].slice(0, 28);
  const retainedIds = new Set(retained.map(({ chunk }) => chunk.id));
  return {
    queryTokens,
    currentContributorGroups: currentContributorGroups.map((group) => ({
      ...group,
      matchingCandidateIds: group.matchingCandidateIds.filter((candidateId) =>
        retainedIds.has(candidateId)
      ),
    })),
    candidates: retained.map(({ chunk, score, matchedTokens, phraseHits }) => ({
      id: chunk.id,
      documentUuid: chunk.documentUuid,
      documentName: chunk.documentName,
      documentRole: chunk.documentRole,
      documentStatus: chunk.documentStatus,
      documentPosition: chunk.documentPosition,
      pageNumber: chunk.pageNumber,
      pageOffsetStart: chunk.pageOffsetStart,
      pageOffsetEnd: chunk.pageOffsetEnd,
      retrievalScore: Number(score.toFixed(4)),
      matchedTokens,
      phraseHits,
      text: chunk.text,
      textSha256: chunk.textSha256,
    })),
  };
}

function buildAuditCase({
  row,
  requirement,
  retrieval,
  sourceInventory,
  productionEvidence,
  bindings,
}) {
  if (row.outcome !== "TEILWEISES_GEGENSTUECK")
    throw new Error("LF_REFERENCE_AUDIT_TARGET_IS_NOT_PARTIAL");
  if (row.categoryId !== requirement.requirementId)
    throw new Error("LF_REFERENCE_AUDIT_REQUIREMENT_MISMATCH");
  const auditCase = {
    schemaVersion: AUDIT_CASE_SCHEMA_VERSION,
    contractId: AUDIT_CASE_CONTRACT_ID,
    caseId: row.analysisRowId,
    sourceOrder: row.sourceOrder,
    requirementId: row.categoryId,
    categoryName: row.categoryName,
    subcategoryId: row.subcategoryId,
    subcategoryName: row.subcategoryName,
    originalDecision: {
      outcome: row.outcome,
      packageBReviewStatus: row.packageB?.reviewStatus,
      pointDecision: row.pointDecision,
      packageB: row.packageB,
      rowSha256: sha256(canonicalJson(row)),
    },
    packageA: row.packageA,
    semanticRequirement: requirement,
    productionEvidence,
    retrieval: {
      method: "DETERMINISTIC_NORMALIZED_LEXICAL_IDF_WITH_CURRENT_SOURCES_V2",
      searchedDocumentCount: sourceInventory.length,
      searchedPageCount: sourceInventory.reduce(
        (sum, document) => sum + document.pageCount,
        0
      ),
      queryTokens: retrieval.queryTokens,
      selectedCandidateCount: retrieval.candidates.length,
      currentContributorGroups: retrieval.currentContributorGroups,
    },
    candidates: retrieval.candidates,
    sourceInventory,
    bindings,
    advisoryOnly: true,
    primaryResultMutationAllowed: false,
  };
  auditCase.inputSha256 = sha256(canonicalJson(auditCase));
  return auditCase;
}

const SYSTEM_PROMPT = `Du auditierst genau EINEN bestehenden Teiltreffer eines gerichteten Versicherungsvergleichs. Prüfe jede ausdrücklich gelieferte semantische Komponente einzeln und streng quellengebunden. Prüfe außerdem, ob die bisher vom Produktionslauf verwendeten Fundstellen fachlich passen.

Regeln:
1. Erfinde keine Quelle, Seite, Klausel, Zahl, Komponente oder Rechtsfolge.
2. Verwende ausschließlich gelieferte kurze Kandidaten-Referenzen (C01, C02, ...) und Komponenten-IDs. Kopiere Kandidaten-Referenzen exakt. Zitate müssen wörtlich und zusammenhängend auf der physischen Seite des Kandidaten vorkommen. Bei überlappenden Textfenstern ordne das Zitat möglichst dem Fenster zu, das es vollständig enthält.
3. Der A-Text liefert Kontext. Bewertet werden nur die gelieferten Komponenten und Werte; verlange keine unmodellierten Details. Werte gelten ausschließlich für die ausdrücklich zugeordnete Komponente. Ein Prozent- oder Betragswert aus demselben A-Absatz darf insbesondere nicht zusätzlich der Objekt-, Gefahren- oder Bedingungskomponente zugerechnet werden.
4. DIRECT_SUPPORT: Kandidat trägt dieselbe fachliche Funktion und einen gleichen oder breiteren wesentlichen Scope. Wenn eine Komponente mehrere Gegenstände ausdrücklich aufzählt, müssen alle wesentlichen Gegenstände gedeckt sein.
5. NARROWER_SUPPORT: echtes Gegenstück derselben Faktrolle und desselben Gegenstands bzw. derselben Gefahr, aber engerer Scope, nur ein echter Teil einer aufgezählten Gegenstandsgruppe oder eine zusätzliche Bedingung. Ein belegtes Mitglied einer ausdrücklich aufgezählten Gruppe ist NARROWER_SUPPORT und nicht RELATED_ONLY. Ein benachbartes Objekt derselben Oberkategorie ist dagegen RELATED_ONLY; NARROWER_SUPPORT verlangt dieselbe benannte Sache oder eine ausdrückliche Klasse, die sie umfasst. Andere Werte allein machen ein Gegenstück nicht enger; erfasse sie getrennt.
6. CONTRADICTION: dieselbe Komponente ist in einer maßgeblichen B-Quelle ausdrücklich ausgeschlossen oder gegenteilig geregelt.
7. RELATED_ONLY oder MENTION_ONLY: thematische Nähe, anderer Gegenstand, andere Faktrolle, anderer Scope oder bloße Erwähnung sind kein tragfähiger Komponentenbeleg. Leite aus einem ähnlichen wirtschaftlichen Zweck keine Gleichheit der Kostenart ab: Ersatzunterkunft ist beispielsweise kein Beleg für Zwischenlagerung. Insbesondere ist eine Versicherungssumme, ein Sublimit oder ein Geldbetrag für einen anderen Gegenstand bzw. eine andere Kostenart niemals NARROWER_SUPPORT für die verlangte Summe. Ein abweichender konkreter Prozent- oder Geldwert für denselben Gegenstand ist dagegen zwingend ein echtes Gegenstück und wird über valueComparison als DIFFERENT ausgewiesen; er darf nicht als NO_MATCH_IN_CANDIDATES bewertet werden. Wenn dieselbe exakte Kandidatenpassage bereits eine Objektkomponente belegt und zugleich den konkreten Wert enthält, verwende diese Passage zusätzlich als Beleg der zugehörigen Limitkomponente. Ein fester EUR-Betrag in B ist auch dann ein vergleichbarer Limitbeleg, wenn A stattdessen einen Prozentsatz oder eine Formel nennt; ein Wertunterschied allein macht den Scope nicht enger. Verlangt die Komponente einen konkreten Prozentsatz, ist nur die bloße Formulierung „auf Erstes Risiko“ ganz ohne konkreten vergleichbaren Prozent- oder Geldwert kein tragfähiger Limitbeleg.
8. NO_MATCH_IN_CANDIDATES bedeutet nur, dass die gelieferten Kandidaten keinen Beleg enthalten. Es ist niemals ein vollständiger Paket-Nullfund.
9. UNCLEAR: die gelieferten Kandidaten reichen für diese Komponente nicht aus.
10. Kandidaten, die du geprüft, aber nicht als Gegenstück anerkannt hast und ausdrücklich in Begründung oder Negativzitat verwendest, gehören ausschließlich in reviewedCandidateIds. Nenne dort höchstens fünf relevante Referenzen und kopiere sie exakt; liste nicht den gesamten Kandidatenbestand auf. Nutze supportingCandidateIds nur für DIRECT_SUPPORT/NARROWER_SUPPORT und contradictingCandidateIds nur für CONTRADICTION. Jede tragende oder widersprechende Kandidaten-Referenz braucht mindestens ein exaktes Zitat; bei reviewedCandidateIds sind Zitate optional.
11. Liefere für jede Komponente genau ein assessment. Setze keinen finalen Zeilenstatus; der Server rollt die Komponenten deterministisch auf.
12. Beurteile die bisher verwendeten Fundstellen separat. Produktionsdiagnosen sind Kontext und dürfen nicht ungeprüft übernommen werden.
13. Das Ergebnis ist nur ein KI-Prüfvorschlag. Empfehle keine automatische Ergebnisänderung ohne Regeländerung, Replay und Regressionstests.
14. Zitiere ausschließlich aus sources[].text. Die Angaben zum bisherigen Teiltreffer enthalten keine zitierfähigen Quellentexte.
15. Antworte ausschließlich mit validem JSON ohne Markdown.`;

function candidateReferenceMaps(auditCase) {
  const idToReference = new Map();
  const referenceToId = new Map();
  auditCase.candidates.forEach(({ id }, index) => {
    const reference = `C${String(index + 1).padStart(2, "0")}`;
    idToReference.set(id, reference);
    referenceToId.set(reference, id);
  });
  return { idToReference, referenceToId };
}

function modelResponseFormat(auditCase) {
  const candidateReferences = [
    ...candidateReferenceMaps(auditCase).referenceToId.keys(),
  ];
  const candidateReferenceSchema = {
    type: "string",
    enum: candidateReferences,
  };
  const candidateReferenceArraySchema = {
    type: "array",
    items: candidateReferenceSchema,
    uniqueItems: true,
  };
  return {
    type: "json_schema",
    json_schema: {
      name: "lf_reference_partial_audit",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          componentAssessments: {
            type: "array",
            minItems: auditCase.semanticRequirement.components.length,
            maxItems: auditCase.semanticRequirement.components.length,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                componentId: {
                  type: "string",
                  enum: auditCase.semanticRequirement.components.map(
                    ({ id }) => id
                  ),
                },
                finding: { type: "string", enum: COMPONENT_FINDINGS },
                supportingCandidateIds: candidateReferenceArraySchema,
                contradictingCandidateIds: candidateReferenceArraySchema,
                reviewedCandidateIds: {
                  ...candidateReferenceArraySchema,
                  maxItems: 5,
                },
                exactQuotes: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      candidateId: candidateReferenceSchema,
                      quote: { type: "string", minLength: 12 },
                    },
                    required: ["candidateId", "quote"],
                  },
                },
                coverageEffect: { type: "string", enum: COVERAGE_EFFECTS },
                scopeRelation: { type: "string", enum: SCOPE_RELATIONS },
                observedBValues: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      candidateId: candidateReferenceSchema,
                      value: { type: "string" },
                      relationToA: {
                        type: "string",
                        enum: ["SAME", "DIFFERENT", "ADDITIONAL", "UNCLEAR"],
                      },
                    },
                    required: ["candidateId", "value", "relationToA"],
                  },
                },
                note: { type: "string", minLength: 8 },
              },
              required: [
                "componentId",
                "finding",
                "supportingCandidateIds",
                "contradictingCandidateIds",
                "reviewedCandidateIds",
                "exactQuotes",
                "coverageEffect",
                "scopeRelation",
                "observedBValues",
                "note",
              ],
            },
          },
          currentSourceAssessment: {
            type: "string",
            enum: CURRENT_SOURCE_ASSESSMENTS,
          },
          rootCause: { type: "string", enum: ROOT_CAUSES },
          recommendedAction: { type: "string", enum: RECOMMENDED_ACTIONS },
          valueComparison: { type: "string", enum: VALUE_COMPARISONS },
          reasoning: { type: "string", minLength: 12 },
          confidence: { type: "string", enum: CONFIDENCE_LEVELS },
        },
        required: [
          "componentAssessments",
          "currentSourceAssessment",
          "rootCause",
          "recommendedAction",
          "valueComparison",
          "reasoning",
          "confidence",
        ],
      },
    },
  };
}

function replaceCandidateReferences(value, references) {
  if (typeof value === "string") return references.get(value) ?? value;
  if (Array.isArray(value))
    return value.map((item) => replaceCandidateReferences(item, references));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      replaceCandidateReferences(item, references),
    ])
  );
}

function expandModelCandidateReferences(auditCase, result) {
  return replaceCandidateReferences(
    result,
    candidateReferenceMaps(auditCase).referenceToId
  );
}

function rebindModelEvidenceCandidates(
  auditCase,
  result,
  { failClosedUnboundQuotes = false } = {}
) {
  if (!result || typeof result !== "object" || Array.isArray(result))
    return result;
  const rebound = structuredClone(result);
  const normalizations = [...(rebound.serverNormalizations ?? [])];
  const candidateById = new Map(
    auditCase.candidates.map((candidate) => [candidate.id, candidate])
  );
  for (const assessment of rebound.componentAssessments ?? []) {
    const replacements = new Map();
    const unboundQuotes = new Set();
    for (const quote of assessment.exactQuotes ?? []) {
      const rawQuote = String(quote?.quote ?? "").trim();
      const quoteWithoutBoundaryEllipsis = rawQuote
        .replace(/^(?:\.{3}|…)+\s*/u, "")
        .replace(/\s*(?:\.{3}|…)+$/u, "")
        .trim();
      if (
        quoteWithoutBoundaryEllipsis !== rawQuote &&
        auditCase.candidates.some((candidate) =>
          quoteMatchesText(candidate.text, quoteWithoutBoundaryEllipsis)
        )
      )
        quote.quote = quoteWithoutBoundaryEllipsis;
      const normalized = normalizeQuote(quote?.quote);
      const supplied = candidateById.get(quote?.candidateId);
      if (
        normalized.length < 12 ||
        (supplied && quoteMatchesText(supplied.text, quote.quote))
      )
        continue;
      const matchingCandidates = auditCase.candidates.filter((candidate) =>
        quoteMatchesText(candidate.text, quote.quote)
      );
      if (matchingCandidates.length === 0) {
        unboundQuotes.add(quote);
        continue;
      }
      const replacement =
        matchingCandidates.find(
          (candidate) =>
            supplied &&
            candidate.documentUuid === supplied.documentUuid &&
            candidate.pageNumber === supplied.pageNumber
        ) ?? matchingCandidates[0];
      if (!replacements.has(quote.candidateId))
        replacements.set(quote.candidateId, new Set());
      replacements.get(quote.candidateId).add(replacement.id);
      quote.candidateId = replacement.id;
    }
    for (const key of [
      "supportingCandidateIds",
      "contradictingCandidateIds",
      "reviewedCandidateIds",
    ])
      if (Array.isArray(assessment[key]))
        assessment[key] = [
          ...new Set(
            assessment[key].flatMap((candidateId) => [
              ...(replacements.get(candidateId) ?? [candidateId]),
            ])
          ),
        ];
    if (unboundQuotes.size > 0 && failClosedUnboundQuotes) {
      const originalFinding = assessment.finding;
      assessment.exactQuotes = (assessment.exactQuotes ?? []).filter(
        (quote) => !unboundQuotes.has(quote)
      );
      const validQuoteCandidateIds = [
        ...new Set(
          assessment.exactQuotes
            .map(({ candidateId }) => candidateId)
            .filter((candidateId) => candidateById.has(candidateId))
        ),
      ].slice(0, 5);
      assessment.exactQuotes = assessment.exactQuotes.filter(
        ({ candidateId }) => validQuoteCandidateIds.includes(candidateId)
      );
      assessment.finding = "UNCLEAR";
      assessment.reviewedCandidateIds = validQuoteCandidateIds;
      assessment.supportingCandidateIds = [];
      assessment.contradictingCandidateIds = [];
      assessment.observedBValues = [];
      assessment.coverageEffect = "UNKNOWN";
      assessment.scopeRelation = "UNCLEAR";
      assessment.note = `Server-Fail-Closed (UNBOUND_QUOTE_DROPPED): ${assessment.note}`;
      normalizations.push({
        componentId: assessment.componentId,
        originalFinding,
        normalizedFinding: assessment.finding,
        reasons: ["UNBOUND_QUOTE_DROPPED"],
      });
    }
    for (const observedValue of assessment.observedBValues ?? []) {
      const candidates = replacements.get(observedValue.candidateId);
      if (candidates?.size) observedValue.candidateId = [...candidates][0];
    }
    const reboundQuoteCandidateIds = [
      ...new Set(
        (assessment.exactQuotes ?? [])
          .map(({ candidateId }) => candidateId)
          .filter(Boolean)
      ),
    ];
    if (["DIRECT_SUPPORT", "NARROWER_SUPPORT"].includes(assessment.finding))
      assessment.supportingCandidateIds = [
        ...new Set([
          ...(assessment.supportingCandidateIds ?? []),
          ...reboundQuoteCandidateIds,
        ]),
      ];
    if (assessment.finding === "CONTRADICTION")
      assessment.contradictingCandidateIds = [
        ...new Set([
          ...(assessment.contradictingCandidateIds ?? []),
          ...reboundQuoteCandidateIds,
        ]),
      ];
    if (
      [
        "RELATED_ONLY",
        "MENTION_ONLY",
        "NO_MATCH_IN_CANDIDATES",
        "UNCLEAR",
      ].includes(assessment.finding)
    )
      assessment.reviewedCandidateIds = [
        ...new Set([
          ...reboundQuoteCandidateIds,
          ...(assessment.reviewedCandidateIds ?? []),
        ]),
      ].slice(0, 5);
    const usedEvidence = new Set([
      ...(assessment.supportingCandidateIds ?? []),
      ...(assessment.contradictingCandidateIds ?? []),
    ]);
    if (Array.isArray(assessment.reviewedCandidateIds))
      assessment.reviewedCandidateIds = assessment.reviewedCandidateIds.filter(
        (candidateId) => !usedEvidence.has(candidateId)
      );
  }
  if (normalizations.length > 0) rebound.serverNormalizations = normalizations;
  return rebound;
}

function normalizeModelAuditMetadata(result) {
  if (!result || typeof result !== "object" || Array.isArray(result))
    return result;
  const normalized = structuredClone(result);
  const observedRelations = [];
  for (const assessment of normalized.componentAssessments ?? []) {
    for (const key of [
      "supportingCandidateIds",
      "contradictingCandidateIds",
      "reviewedCandidateIds",
      "exactQuotes",
      "observedBValues",
    ])
      if (!Array.isArray(assessment[key])) assessment[key] = [];
    if (!SCOPE_RELATIONS.includes(assessment.scopeRelation))
      assessment.scopeRelation = "UNCLEAR";
    if (!COMPONENT_FINDINGS.includes(assessment.finding)) {
      if (assessment.contradictingCandidateIds.length > 0)
        assessment.finding = "CONTRADICTION";
      else if (assessment.supportingCandidateIds.length > 0)
        assessment.finding = ["DIFFERENT", "NOT_APPLICABLE"].includes(
          assessment.scopeRelation
        )
          ? "RELATED_ONLY"
          : assessment.scopeRelation === "NARROWER"
            ? "NARROWER_SUPPORT"
            : "DIRECT_SUPPORT";
      else assessment.finding = "UNCLEAR";
    }
    if (
      assessment.finding === "DIRECT_SUPPORT" &&
      assessment.scopeRelation === "NARROWER"
    )
      assessment.finding = "NARROWER_SUPPORT";
    if (
      ["DIRECT_SUPPORT", "NARROWER_SUPPORT"].includes(assessment.finding) &&
      ["DIFFERENT", "NOT_APPLICABLE"].includes(assessment.scopeRelation)
    )
      assessment.finding = "RELATED_ONLY";
    if (!COVERAGE_EFFECTS.includes(assessment.coverageEffect))
      assessment.coverageEffect = "UNKNOWN";
    const quoteCandidateIds = assessment.exactQuotes
      .map(({ candidateId }) => candidateId)
      .filter(Boolean);
    if (["DIRECT_SUPPORT", "NARROWER_SUPPORT"].includes(assessment.finding))
      assessment.supportingCandidateIds = [
        ...new Set([
          ...assessment.supportingCandidateIds,
          ...quoteCandidateIds,
        ]),
      ];
    if (assessment.finding === "CONTRADICTION")
      assessment.contradictingCandidateIds = [
        ...new Set([
          ...assessment.contradictingCandidateIds,
          ...quoteCandidateIds,
        ]),
      ];
    if (["RELATED_ONLY", "MENTION_ONLY"].includes(assessment.finding)) {
      assessment.reviewedCandidateIds = [
        ...new Set([
          ...quoteCandidateIds,
          ...assessment.reviewedCandidateIds,
          ...assessment.supportingCandidateIds,
        ]),
      ].slice(0, 5);
      assessment.supportingCandidateIds = [];
      assessment.contradictingCandidateIds = [];
      assessment.observedBValues = [];
    }
    if (["NO_MATCH_IN_CANDIDATES", "UNCLEAR"].includes(assessment.finding)) {
      assessment.reviewedCandidateIds = [
        ...new Set([...quoteCandidateIds, ...assessment.reviewedCandidateIds]),
      ].slice(0, 5);
    }
    if (["NO_MATCH_IN_CANDIDATES", "UNCLEAR"].includes(assessment.finding)) {
      assessment.coverageEffect = "UNKNOWN";
      assessment.reviewedCandidateIds = [
        ...new Set([...quoteCandidateIds, ...assessment.reviewedCandidateIds]),
      ].slice(0, 5);
      assessment.supportingCandidateIds = [];
      assessment.contradictingCandidateIds = [];
      assessment.observedBValues = [];
    }
    for (const observedValue of assessment.observedBValues ?? []) {
      if (["NARROWER", "BROADER"].includes(observedValue.relationToA))
        observedValue.relationToA = "DIFFERENT";
      observedRelations.push(observedValue.relationToA);
    }
  }
  if (!CURRENT_SOURCE_ASSESSMENTS.includes(normalized.currentSourceAssessment))
    normalized.currentSourceAssessment = "UNCLEAR";
  if (!ROOT_CAUSES.includes(normalized.rootCause))
    normalized.rootCause = "INSUFFICIENT_EVIDENCE";
  if (!RECOMMENDED_ACTIONS.includes(normalized.recommendedAction))
    normalized.recommendedAction = "MANUAL_REVIEW_REQUIRED";
  if (!CONFIDENCE_LEVELS.includes(normalized.confidence))
    normalized.confidence = "LOW";
  if (!VALUE_COMPARISONS.includes(normalized.valueComparison)) {
    normalized.valueComparison = observedRelations.includes("DIFFERENT")
      ? "DIFFERENT"
      : observedRelations.includes("SAME")
        ? "SAME"
        : observedRelations.includes("ADDITIONAL")
          ? "DIFFERENT"
          : "UNCLEAR";
  }
  return normalized;
}

function promptPayload(auditCase) {
  const payload = {
    caseId: auditCase.caseId,
    requirement: {
      id: auditCase.requirementId,
      label: auditCase.categoryName,
      subcategory: auditCase.subcategoryName,
      sourceTextA: auditCase.packageA?.documentedContent,
      sourceA: auditCase.packageA?.source,
      components: auditCase.semanticRequirement.components,
      values: auditCase.semanticRequirement.values,
    },
    currentPartialResult: {
      outcome: auditCase.originalDecision.outcome,
      reviewStatus: auditCase.originalDecision.packageBReviewStatus,
      pointDecision: auditCase.originalDecision.pointDecision,
      coverage: auditCase.originalDecision.packageB?.coverage,
      coverageAmount: auditCase.originalDecision.packageB?.coverageAmount,
      contributorGroups: auditCase.retrieval.currentContributorGroups.map(
        ({ currentSource: _currentSource, ...group }) => group
      ),
    },
    sources: auditCase.candidates.map((candidate) => ({
      candidateId: candidate.id,
      documentName: candidate.documentName,
      documentRole: candidate.documentRole,
      documentStatus: candidate.documentStatus,
      physicalPdfPage: candidate.pageNumber,
      isCurrentSource: auditCase.retrieval.currentContributorGroups.some(
        ({ matchingCandidateIds }) =>
          matchingCandidateIds.includes(candidate.id)
      ),
      text: candidate.text,
    })),
    requiredOutput: {
      componentAssessments: [
        {
          componentId: "component_id",
          finding: COMPONENT_FINDINGS.join(" | "),
          supportingCandidateIds: ["C01"],
          contradictingCandidateIds: ["C02"],
          reviewedCandidateIds: ["C03"],
          exactQuotes: [{ candidateId: "C01", quote: "kurzes exaktes Zitat" }],
          coverageEffect: COVERAGE_EFFECTS.join(" | "),
          scopeRelation: SCOPE_RELATIONS.join(" | "),
          observedBValues: [
            {
              candidateId: "C01",
              value: "exakter B-Wert oder Bedingung",
              relationToA: "SAME | DIFFERENT | ADDITIONAL | UNCLEAR",
            },
          ],
          note: "knappe komponentenbezogene Begründung",
        },
      ],
      currentSourceAssessment: CURRENT_SOURCE_ASSESSMENTS.join(" | "),
      rootCause: ROOT_CAUSES.join(" | "),
      recommendedAction: RECOMMENDED_ACTIONS.join(" | "),
      valueComparison: VALUE_COMPARISONS.join(" | "),
      reasoning: "knappe, fachlich nachvollziehbare Begründung auf Deutsch",
      confidence: CONFIDENCE_LEVELS.join(" | "),
    },
  };
  return replaceCandidateReferences(
    payload,
    candidateReferenceMaps(auditCase).idToReference
  );
}

function parseModelJson(content) {
  const source = String(content ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  try {
    return { value: JSON.parse(source), repaired: false };
  } catch (originalError) {
    return {
      value: JSON.parse(jsonrepair(source)),
      repaired: true,
      originalError: String(originalError?.message || originalError),
    };
  }
}

function jsonFromModelText(content) {
  return parseModelJson(content).value;
}

function exactArray(value, label) {
  if (!Array.isArray(value) || new Set(value).size !== value.length)
    throw new Error(`LF_REFERENCE_AUDIT_${label}_INVALID`);
  return value;
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(value ?? {}).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  )
    throw new Error(`LF_REFERENCE_AUDIT_${label}_KEYS_INVALID`);
}

function deriveRowDisposition(componentAssessments) {
  const findings = new Set(componentAssessments.map(({ finding }) => finding));
  if (findings.has("CONTRADICTION")) return "CONTRADICTION_REVIEW_REQUIRED";
  if (findings.has("UNCLEAR")) return "AUDIT_UNCLEAR";
  if (componentAssessments.every(({ finding }) => finding === "DIRECT_SUPPORT"))
    return "COMPLETE_COUNTERPART_CANDIDATE";
  const supported = componentAssessments.filter(({ finding }) =>
    ["DIRECT_SUPPORT", "NARROWER_SUPPORT"].includes(finding)
  ).length;
  if (supported > 0) return "PARTIAL_REMAINS_WITH_EVIDENCE";
  if (findings.has("RELATED_ONLY") || findings.has("MENTION_ONLY"))
    return "PRESENT_BUT_NO_DECISION_READY_COMPONENT";
  return "NO_ADDITIONAL_MATCH_IN_CANDIDATES";
}

function deriveRecommendedAction(rowDisposition) {
  return {
    COMPLETE_COUNTERPART_CANDIDATE: "PROMOTE_TO_FOUND_AFTER_RULE_FIX",
    PARTIAL_REMAINS_WITH_EVIDENCE: "KEEP_PARTIAL",
    PRESENT_BUT_NO_DECISION_READY_COMPONENT: "DEMOTE_TO_UNCLEAR_AFTER_RULE_FIX",
    CONTRADICTION_REVIEW_REQUIRED: "MARK_CONTRADICTED_AFTER_RULE_FIX",
    AUDIT_UNCLEAR: "MANUAL_REVIEW_REQUIRED",
    NO_ADDITIONAL_MATCH_IN_CANDIDATES: "DEMOTE_TO_UNCLEAR_AFTER_RULE_FIX",
  }[rowDisposition];
}

function validateAuditResult(auditCase, result) {
  exactKeys(
    result,
    [
      "componentAssessments",
      "currentSourceAssessment",
      "rootCause",
      "recommendedAction",
      "valueComparison",
      "reasoning",
      "confidence",
      ...(Object.hasOwn(result ?? {}, "rowDisposition")
        ? ["rowDisposition"]
        : []),
      ...(Object.hasOwn(result ?? {}, "modelRecommendedAction")
        ? ["modelRecommendedAction"]
        : []),
      ...(Object.hasOwn(result ?? {}, "serverNormalizations")
        ? ["serverNormalizations"]
        : []),
    ],
    "RESULT"
  );
  if (
    !result ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    !CURRENT_SOURCE_ASSESSMENTS.includes(result.currentSourceAssessment) ||
    !ROOT_CAUSES.includes(result.rootCause) ||
    !RECOMMENDED_ACTIONS.includes(result.recommendedAction) ||
    (Object.hasOwn(result, "modelRecommendedAction") &&
      !RECOMMENDED_ACTIONS.includes(result.modelRecommendedAction)) ||
    !VALUE_COMPARISONS.includes(result.valueComparison) ||
    !CONFIDENCE_LEVELS.includes(result.confidence) ||
    typeof result.reasoning !== "string" ||
    result.reasoning.trim().length < 12
  )
    throw new Error("LF_REFERENCE_AUDIT_RESULT_ENUM_OR_REASON_INVALID");

  result = applyRowLocalComparableLimitPolicy(auditCase, result);
  result = applyOrphanLimitPolicy(auditCase, result);
  result = applySupportAnchorPolicy(auditCase, result);
  if (Object.hasOwn(result, "serverNormalizations")) {
    const normalizations = exactArray(
      result.serverNormalizations,
      "SERVER_NORMALIZATIONS"
    );
    if (
      new Set(normalizations.map(({ componentId }) => componentId)).size !==
      normalizations.length
    )
      throw new Error("LF_REFERENCE_AUDIT_SERVER_NORMALIZATION_INVALID");
    for (const normalization of normalizations) {
      exactKeys(
        normalization,
        ["componentId", "originalFinding", "normalizedFinding", "reasons"],
        "SERVER_NORMALIZATION"
      );
      const hasUnboundQuoteDrop = normalization.reasons.includes(
        "UNBOUND_QUOTE_DROPPED"
      );
      const hasSupportAnchorReason = normalization.reasons.some((reason) =>
        [
          "SEMANTIC_ANCHOR_MISSING",
          "COMPARABLE_LIMIT_VALUE_MISSING",
          "ORPHAN_LIMIT_WITHOUT_SUBJECT",
        ].includes(reason)
      );
      if (
        typeof normalization.componentId !== "string" ||
        !COMPONENT_FINDINGS.includes(normalization.originalFinding) ||
        !COMPONENT_FINDINGS.includes(normalization.normalizedFinding) ||
        !Array.isArray(normalization.reasons) ||
        normalization.reasons.length === 0 ||
        normalization.reasons.some(
          (reason) => !SUPPORT_ANCHOR_NORMALIZATION_REASONS.includes(reason)
        ) ||
        !result.componentAssessments.some(
          (assessment) =>
            assessment.componentId === normalization.componentId &&
            assessment.finding === normalization.normalizedFinding &&
            (assessment.note.startsWith("Server-Fail-Closed (") ||
              assessment.note.startsWith("Server-Rebind ("))
        ) ||
        (hasUnboundQuoteDrop &&
          normalization.normalizedFinding !== "UNCLEAR") ||
        (hasSupportAnchorReason &&
          (!["DIRECT_SUPPORT", "NARROWER_SUPPORT"].includes(
            normalization.originalFinding
          ) ||
            !["RELATED_ONLY", "NO_MATCH_IN_CANDIDATES"].includes(
              normalization.normalizedFinding
            ))) ||
        (normalization.reasons.includes("ROW_LOCAL_COMPARABLE_LIMIT_REBOUND") &&
          (![
            "RELATED_ONLY",
            "MENTION_ONLY",
            "NO_MATCH_IN_CANDIDATES",
            "UNCLEAR",
          ].includes(normalization.originalFinding) ||
            !["DIRECT_SUPPORT", "NARROWER_SUPPORT"].includes(
              normalization.normalizedFinding
            )))
      )
        throw new Error("LF_REFERENCE_AUDIT_SERVER_NORMALIZATION_INVALID");
    }
  }

  const candidateById = new Map(
    auditCase.candidates.map((candidate) => [candidate.id, candidate])
  );
  const componentIds = new Set(
    auditCase.semanticRequirement.components.map((component) => component.id)
  );
  const componentAssessments = exactArray(
    result.componentAssessments,
    "COMPONENT_ASSESSMENTS"
  );
  if (
    componentAssessments.length !== componentIds.size ||
    new Set(componentAssessments.map(({ componentId }) => componentId)).size !==
      componentIds.size ||
    componentAssessments.some(
      ({ componentId }) => !componentIds.has(componentId)
    )
  )
    throw new Error("LF_REFERENCE_AUDIT_COMPONENT_PARTITION_INVALID");
  for (const assessment of componentAssessments) {
    const component = auditCase.semanticRequirement.components.find(
      ({ id }) => id === assessment.componentId
    );
    exactKeys(
      assessment,
      [
        "componentId",
        "finding",
        "supportingCandidateIds",
        "contradictingCandidateIds",
        "reviewedCandidateIds",
        "exactQuotes",
        "coverageEffect",
        "scopeRelation",
        "observedBValues",
        "note",
      ],
      "COMPONENT_ASSESSMENT"
    );
    if (
      !COMPONENT_FINDINGS.includes(assessment.finding) ||
      !COVERAGE_EFFECTS.includes(assessment.coverageEffect) ||
      !SCOPE_RELATIONS.includes(assessment.scopeRelation) ||
      typeof assessment.note !== "string" ||
      assessment.note.trim().length < 8
    )
      throw new Error("LF_REFERENCE_AUDIT_COMPONENT_ASSESSMENT_INVALID");
    const supportingCandidateIds = exactArray(
      assessment.supportingCandidateIds,
      "SUPPORTING_CANDIDATES"
    );
    const contradictingCandidateIds = exactArray(
      assessment.contradictingCandidateIds,
      "CONTRADICTING_CANDIDATES"
    );
    const reviewedCandidateIds = exactArray(
      assessment.reviewedCandidateIds,
      "REVIEWED_CANDIDATES"
    );
    if (reviewedCandidateIds.length > 5)
      throw new Error("LF_REFERENCE_AUDIT_REVIEWED_CANDIDATE_LIMIT_INVALID");
    const evidenceCandidateIds = new Set([
      ...supportingCandidateIds,
      ...contradictingCandidateIds,
      ...reviewedCandidateIds,
    ]);
    if (
      [...evidenceCandidateIds].some(
        (candidateId) => !candidateById.has(candidateId)
      ) ||
      supportingCandidateIds.some((candidateId) =>
        contradictingCandidateIds.includes(candidateId)
      ) ||
      reviewedCandidateIds.some(
        (candidateId) =>
          supportingCandidateIds.includes(candidateId) ||
          contradictingCandidateIds.includes(candidateId)
      )
    )
      throw new Error("LF_REFERENCE_AUDIT_CANDIDATE_INVALID");
    const quotes = exactArray(assessment.exactQuotes, "EXACT_QUOTES");
    for (const quote of quotes) {
      const candidate = candidateById.get(quote?.candidateId);
      const normalized = normalizeQuote(quote?.quote);
      const appearsOnBoundPage =
        candidate &&
        Number.isInteger(candidate.pageNumber) &&
        auditCase.candidates.some(
          (pageCandidate) =>
            pageCandidate.documentUuid === candidate.documentUuid &&
            pageCandidate.pageNumber === candidate.pageNumber &&
            quoteMatchesText(pageCandidate.text, quote.quote)
        );
      if (
        !candidate ||
        !evidenceCandidateIds.has(quote.candidateId) ||
        normalized.length < 12 ||
        (!quoteMatchesText(candidate.text, quote.quote) && !appearsOnBoundPage)
      )
        throw new Error("LF_REFERENCE_AUDIT_QUOTE_INVALID");
    }
    for (const candidateId of [
      ...supportingCandidateIds,
      ...contradictingCandidateIds,
    ])
      if (!quotes.some((quote) => quote.candidateId === candidateId))
        throw new Error("LF_REFERENCE_AUDIT_EVIDENCE_WITHOUT_QUOTE");
    const needsSupport = ["DIRECT_SUPPORT", "NARROWER_SUPPORT"].includes(
      assessment.finding
    );
    const needsReviewed = ["RELATED_ONLY", "MENTION_ONLY"].includes(
      assessment.finding
    );
    validateSupportAnchors(
      auditCase.semanticRequirement,
      component,
      assessment,
      quotes.filter(({ candidateId }) =>
        supportingCandidateIds.includes(candidateId)
      )
    );
    if (
      (needsSupport && supportingCandidateIds.length === 0) ||
      (needsReviewed &&
        (reviewedCandidateIds.length === 0 ||
          !quotes.some((quote) =>
            reviewedCandidateIds.includes(quote.candidateId)
          ))) ||
      (assessment.finding === "CONTRADICTION" &&
        contradictingCandidateIds.length === 0) ||
      (["NO_MATCH_IN_CANDIDATES", "UNCLEAR"].includes(assessment.finding) &&
        (supportingCandidateIds.length > 0 ||
          contradictingCandidateIds.length > 0))
    )
      throw new Error("LF_REFERENCE_AUDIT_COMPONENT_EVIDENCE_INVALID");
    const observedValues = exactArray(
      assessment.observedBValues,
      "OBSERVED_VALUES"
    );
    for (const observedValue of observedValues)
      if (
        ![...supportingCandidateIds, ...contradictingCandidateIds].includes(
          observedValue?.candidateId
        ) ||
        typeof observedValue.value !== "string" ||
        !["SAME", "DIFFERENT", "ADDITIONAL", "UNCLEAR"].includes(
          observedValue.relationToA
        )
      )
        throw new Error("LF_REFERENCE_AUDIT_OBSERVED_VALUE_INVALID");
  }

  const rowDisposition = deriveRowDisposition(componentAssessments);
  if (
    Object.hasOwn(result, "rowDisposition") &&
    result.rowDisposition !== rowDisposition
  )
    throw new Error("LF_REFERENCE_AUDIT_ROW_DISPOSITION_INVALID");
  const modelRecommendedAction =
    result.modelRecommendedAction ?? result.recommendedAction;
  return {
    ...result,
    modelRecommendedAction,
    recommendedAction: deriveRecommendedAction(rowDisposition),
    rowDisposition,
  };
}

function buildAuditResultRecord({
  auditCase,
  result,
  model,
  endpoint,
  startedAt,
  finishedAt,
  rawResponse,
}) {
  const validatedResult = validateAuditResult(auditCase, result);
  const record = {
    schemaVersion: AUDIT_RESULT_SCHEMA_VERSION,
    contractId: AUDIT_RESULT_CONTRACT_ID,
    status: "COMPLETED",
    advisoryOnly: true,
    primaryResultMutationAllowed: false,
    caseId: auditCase.caseId,
    caseInputSha256: auditCase.inputSha256,
    endpoint,
    model,
    temperature: 0,
    systemPromptSha256: sha256(SYSTEM_PROMPT),
    userPromptSha256: sha256(canonicalJson(promptPayload(auditCase))),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    result: validatedResult,
    rawResponse,
  };
  record.recordSha256 = sha256(canonicalJson(record));
  return record;
}

function validateAuditResultRecord(auditCase, record, { model } = {}) {
  if (
    record?.schemaVersion !== AUDIT_RESULT_SCHEMA_VERSION ||
    record?.contractId !== AUDIT_RESULT_CONTRACT_ID ||
    record?.status !== "COMPLETED" ||
    record?.advisoryOnly !== true ||
    record?.primaryResultMutationAllowed !== false ||
    record?.caseId !== auditCase.caseId ||
    record?.caseInputSha256 !== auditCase.inputSha256 ||
    record?.systemPromptSha256 !== sha256(SYSTEM_PROMPT) ||
    record?.userPromptSha256 !==
      sha256(canonicalJson(promptPayload(auditCase))) ||
    (model && record.model !== model)
  )
    throw new Error("LF_REFERENCE_AUDIT_RECORD_BINDING_INVALID");
  const expectedDigest = record.recordSha256;
  const withoutDigest = { ...record };
  delete withoutDigest.recordSha256;
  if (expectedDigest !== sha256(canonicalJson(withoutDigest)))
    throw new Error("LF_REFERENCE_AUDIT_RECORD_DIGEST_INVALID");
  validateAuditResult(auditCase, record.result);
  return record;
}

module.exports = {
  AUDIT_CASE_CONTRACT_ID,
  AUDIT_CASE_SCHEMA_VERSION,
  AUDIT_RESULT_CONTRACT_ID,
  AUDIT_RESULT_SCHEMA_VERSION,
  CONFIDENCE_LEVELS,
  COVERAGE_EFFECTS,
  CURRENT_SOURCE_ASSESSMENTS,
  COMPONENT_FINDINGS,
  RECOMMENDED_ACTIONS,
  ROOT_CAUSES,
  ROW_DISPOSITIONS,
  SCOPE_RELATIONS,
  SYSTEM_PROMPT,
  VALUE_COMPARISONS,
  buildAuditCase,
  buildAuditResultRecord,
  buildSourceChunks,
  canonicalJson,
  deriveRowDisposition,
  deriveRecommendedAction,
  expandModelCandidateReferences,
  jsonFromModelText,
  normalize,
  normalizeModelAuditMetadata,
  modelResponseFormat,
  parseDocumentPages,
  parseModelJson,
  promptPayload,
  rankCandidates,
  rebindModelEvidenceCandidates,
  sha256,
  validateAuditResult,
  validateAuditResultRecord,
};
