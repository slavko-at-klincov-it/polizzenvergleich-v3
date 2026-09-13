const crypto = require("crypto");

const SOURCE_REVIEW_PACKET_CONTRACT_ID = "LF_1PLUS9_SOURCE_REVIEW_PACKET_V1";
const SOURCE_REVIEW_RESPONSE_CONTRACT_ID =
  "LF_1PLUS9_SOURCE_REVIEW_RESPONSE_V1";
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

function compactCandidate(candidate, document) {
  return {
    candidateId: candidate.candidateId,
    componentId: candidate.componentId,
    documentUuid: candidate.range.documentUuid,
    documentFingerprint: candidate.range.documentFingerprint,
    documentName: document.originalName,
    documentRole: document.role,
    documentStatus: document.documentStatus,
    physicalPageNumber: candidate.range.physicalPageNumber,
    documentStart: candidate.range.documentStart,
    documentEnd: candidate.range.documentEnd,
    exactQuote: candidate.range.exactQuote,
    exactQuoteSha256: candidate.range.exactQuoteSha256,
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
}) {
  const seenQuotes = new Set();
  const scored = candidates
    .filter(
      (candidate) =>
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
    return compactCandidate(candidate, document);
  });
}

function buildLfKnownFixtureSourceReviewPacket({
  goldCandidate,
  oracle,
  maximumPerComponent = 6,
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
    maximumPerComponent < 1
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
        }),
      }));
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
        claude: row.claude,
        system: row.system,
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
          selectedCandidateCount: components.reduce(
            (sum, component) => sum + component.candidates.length,
            0
          ),
          absenceCertified: false,
          negativeMeaning:
            "NO_COUNTERPART_ESTABLISHED means no counterpart in the reviewed exact candidates, not certified global absence.",
        },
        components,
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
      candidatePolicy:
        "LEXICAL_COMPONENT_RANK_WITH_DOCUMENT_DIVERSITY; NAVIGATION_ONLY",
    },
    rows,
    summary: {
      rows: rows.length,
      components: rows.reduce((sum, row) => sum + row.components.length, 0),
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
