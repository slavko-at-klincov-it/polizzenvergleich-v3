const crypto = require("crypto");

const INPUT_CONTRACT_ID = "LF_1PLUS9_SOURCE_ADJUDICATION_INPUT_V1";
const OUTPUT_CONTRACT_ID = "LF_1PLUS9_SOURCE_ADJUDICATION_DRAFT_V1";
const OUTCOMES = new Set([
  "FULL_COUNTERPART",
  "PARTIAL_COUNTERPART",
  "CONTRADICTED",
  "NO_COUNTERPART_ESTABLISHED",
]);
const CONFIDENCE = new Set(["HIGH", "MEDIUM", "LOW"]);

function adjudicationError(code, detail = "") {
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

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function sourceIdentity(candidate) {
  return {
    candidateId: candidate.candidateId,
    documentName: candidate.documentName,
    documentRole: candidate.documentRole,
    documentStatus: candidate.documentStatus,
    physicalPageNumber: candidate.physicalPageNumber,
    exactQuote: candidate.exactQuote,
    oracleExactQuoteSha256: candidate.oracleExactQuoteSha256,
  };
}

function rowCandidates(row) {
  const candidates = [
    ...(row.globalClaudeRebind || []),
    ...(row.globalReferenceARebind || []),
    ...(row.components || []).flatMap(({ candidates }) => candidates || []),
  ];
  const byId = new Map();
  for (const candidate of candidates) {
    if (!candidate?.candidateId) continue;
    const existing = byId.get(candidate.candidateId);
    if (
      existing &&
      canonicalJson(sourceIdentity(existing)) !==
        canonicalJson(sourceIdentity(candidate))
    )
      throw adjudicationError(
        "LF_SOURCE_ADJUDICATION_CANDIDATE_CONFLICT",
        candidate.candidateId
      );
    byId.set(candidate.candidateId, candidate);
  }
  return byId;
}

function qwenUsedCandidateIds(response) {
  return [
    ...new Set([
      ...(response.componentFindings || []).flatMap(
        ({ candidateIds }) => candidateIds || []
      ),
      ...(response.unmodeledDifferences || []).flatMap(
        ({ candidateIds }) => candidateIds || []
      ),
    ]),
  ];
}

function evidence(candidate) {
  return {
    candidateId: candidate.candidateId,
    documentName: candidate.documentName,
    documentRole: candidate.documentRole,
    documentStatus: candidate.documentStatus,
    physicalPageNumber: candidate.physicalPageNumber,
    exactQuote: candidate.exactQuote,
    oracleExactQuoteSha256: candidate.oracleExactQuoteSha256,
    evidenceOrigin: candidate.evidenceOrigin || "ROW_RETRIEVAL",
  };
}

function buildLfKnownFixtureSourceAdjudication({
  packet,
  qwenSummary,
  qwenResponses,
  input,
  inputSha256,
  qwenSummarySha256,
  createdAt = new Date().toISOString(),
}) {
  if (
    packet?.contractId !== "LF_1PLUS9_SOURCE_REVIEW_PACKET_V6" ||
    packet?.status !== "READY_FOR_SOURCE_REVIEW" ||
    !Array.isArray(packet.rows) ||
    packet.rows.length < 1 ||
    qwenSummary?.status !== "MODEL_SOURCE_REVIEW_COMPLETE_NOT_GOLD" ||
    qwenSummary.packetSha256 !== packet.packetSha256 ||
    !Array.isArray(qwenResponses) ||
    qwenResponses.length !== packet.rows.length ||
    input?.contractId !== INPUT_CONTRACT_ID ||
    input.packetSha256 !== packet.packetSha256 ||
    !Array.isArray(input.decisions) ||
    input.decisions.length !== packet.rows.length ||
    !/^[a-f0-9]{64}$/u.test(inputSha256 || "") ||
    !/^[a-f0-9]{64}$/u.test(qwenSummarySha256 || "")
  )
    throw adjudicationError("LF_SOURCE_ADJUDICATION_INPUT_INVALID");

  const decisionsByRequirement = new Map();
  for (const decision of input.decisions) {
    if (
      typeof decision?.requirementId !== "string" ||
      decisionsByRequirement.has(decision.requirementId)
    )
      throw adjudicationError("LF_SOURCE_ADJUDICATION_DECISION_DUPLICATE");
    decisionsByRequirement.set(decision.requirementId, decision);
  }

  const rows = packet.rows.map((row, index) => {
    const decision = decisionsByRequirement.get(row.requirementId);
    const qwen = qwenResponses[index];
    const candidates = rowCandidates(row);
    if (
      !decision ||
      qwen?.requirementId !== row.requirementId ||
      !OUTCOMES.has(decision.outcome) ||
      !CONFIDENCE.has(decision.confidence) ||
      typeof decision.expertReviewRequired !== "boolean" ||
      typeof decision.rationale !== "string" ||
      !decision.rationale.trim() ||
      !Array.isArray(decision.selectedCandidateIds) ||
      new Set(decision.selectedCandidateIds).size !==
        decision.selectedCandidateIds.length ||
      decision.selectedCandidateIds.some(
        (candidateId) => !candidates.has(candidateId)
      )
    )
      throw adjudicationError(
        "LF_SOURCE_ADJUDICATION_DECISION_INVALID",
        row.requirementId
      );
    const customerFound = decision.outcome !== "NO_COUNTERPART_ESTABLISHED";
    if (
      (customerFound && decision.selectedCandidateIds.length === 0) ||
      (!customerFound && decision.selectedCandidateIds.length !== 0)
    )
      throw adjudicationError(
        "LF_SOURCE_ADJUDICATION_EVIDENCE_CARDINALITY_INVALID",
        row.requirementId
      );
    return {
      reviewIndex: row.reviewIndex,
      analysisRowId: row.analysisRowId,
      requirementId: row.requirementId,
      category: row.category,
      subcategory: row.subcategory,
      point: row.point,
      claudeFoundStatus: row.claudeClaim.foundStatus,
      systemSearchStatus: row.systemClaim.customerSearchStatus,
      qwenOutcome: qwen.outcome,
      qwenCustomerFound: qwen.customerFound,
      qwenUsedCandidateIds: qwenUsedCandidateIds(qwen),
      codexDecision: {
        status: customerFound
          ? "SOURCE_ADJUDICATED_POSITIVE"
          : "NEGATIVE_FULL_CORPUS_SEARCH_PENDING",
        outcome: decision.outcome,
        customerFound,
        confidence: decision.confidence,
        expertReviewRequired: decision.expertReviewRequired,
        absenceCertified: false,
        rationale: decision.rationale.trim(),
        selectedSources: decision.selectedCandidateIds.map((candidateId) =>
          evidence(candidates.get(candidateId))
        ),
      },
    };
  });

  if (decisionsByRequirement.size !== rows.length)
    throw adjudicationError("LF_SOURCE_ADJUDICATION_DECISION_SET_INVALID");
  const outcomeCounts = Object.fromEntries(
    [...OUTCOMES]
      .map((outcome) => [
        outcome,
        rows.filter(({ codexDecision }) => codexDecision.outcome === outcome)
          .length,
      ])
      .filter(([, count]) => count > 0)
  );
  const payload = {
    schemaVersion: 1,
    contractId: OUTPUT_CONTRACT_ID,
    status: "POSITIVE_SOURCE_DECISIONS_READY_NEGATIVE_SEARCH_PENDING",
    goldAuthority: false,
    qaOnly: true,
    productionRule: false,
    createdAt,
    reviewer: "CODEX_SOURCE_BOUND_REVIEW",
    bindings: {
      packetSha256: packet.packetSha256,
      qwenSummarySha256,
      inputSha256,
      qwenRunContractId: qwenSummary.contractId,
      qwenPromptContractId: qwenSummary.promptContractId,
      qwenModel: qwenSummary.model,
    },
    summary: {
      rows: rows.length,
      customerFound: rows.filter(
        ({ codexDecision }) => codexDecision.customerFound
      ).length,
      customerNotFoundPending: rows.filter(
        ({ codexDecision }) => !codexDecision.customerFound
      ).length,
      outcomeCounts,
      qwenAgreement: rows.filter(
        ({ qwenCustomerFound, codexDecision }) =>
          qwenCustomerFound === codexDecision.customerFound
      ).length,
      qwenDisagreement: rows.filter(
        ({ qwenCustomerFound, codexDecision }) =>
          qwenCustomerFound !== codexDecision.customerFound
      ).length,
      expertReviewRequired: rows.filter(
        ({ codexDecision }) => codexDecision.expertReviewRequired
      ).length,
      absenceCertifiedRows: 0,
    },
    rows,
    nextGate:
      "FULL_CORPUS_NEGATIVE_SEARCH_THEN_EXPERT_REVIEW_THEN_IMMUTABLE_GOLD",
    proofLimit:
      "Source-bound draft for the known 1+9 fixture. Positive decisions carry exact evidence. Negative decisions are not absence-certified and the artifact is not Gold, not production routing, and not a generalization or 99-percent proof.",
  };
  return {
    ...payload,
    adjudicationSha256: sha256(
      `${OUTPUT_CONTRACT_ID}\u0000${canonicalJson(payload)}`
    ),
  };
}

module.exports = {
  INPUT_CONTRACT_ID,
  OUTPUT_CONTRACT_ID,
  buildLfKnownFixtureSourceAdjudication,
  canonicalJson,
  sha256,
};
