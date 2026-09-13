const crypto = require("crypto");

const DECISIONS_CONTRACT_ID = "LF_1PLUS9_GOLD_30_DECISIONS_V1";
const OUTPUT_CONTRACT_ID = "LF_1PLUS9_GOLD_30_V1";
const OUTCOMES = new Set([
  "FULL_COUNTERPART",
  "PARTIAL_COUNTERPART",
  "CONTRADICTED",
  "NO_COUNTERPART_ESTABLISHED",
]);

function goldError(code, detail = "") {
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

function packetCandidates(row) {
  const candidates = [
    ...(row.globalClaudeRebind || []),
    ...(row.globalReferenceARebind || []),
    ...(row.components || []).flatMap(({ candidates }) => candidates || []),
  ];
  const byId = new Map();
  for (const candidate of candidates) {
    if (!candidate?.candidateId) continue;
    const existing = byId.get(candidate.candidateId) || [];
    if (
      !existing.some(
        (item) =>
          item.documentFingerprint === candidate.documentFingerprint &&
          item.physicalPageNumber === candidate.physicalPageNumber &&
          item.documentStart === candidate.documentStart &&
          item.documentEnd === candidate.documentEnd &&
          item.exactQuoteSha256 === candidate.exactQuoteSha256
      )
    )
      existing.push(candidate);
    byId.set(candidate.candidateId, existing);
  }
  return byId;
}

function packetEvidence(candidate) {
  return {
    origin: candidate.evidenceOrigin || "ROW_RETRIEVAL",
    candidateId: candidate.candidateId,
    documentFingerprint: candidate.documentFingerprint,
    documentName: candidate.documentName,
    documentRole: candidate.documentRole,
    documentStatus: candidate.documentStatus,
    physicalPageNumber: candidate.physicalPageNumber,
    documentStart: candidate.documentStart,
    documentEnd: candidate.documentEnd,
    exactQuote: candidate.exactQuote,
    exactQuoteSha256: candidate.exactQuoteSha256,
    oracleExactQuoteSha256: candidate.oracleExactQuoteSha256,
  };
}

function fullCorpusEvidence(match) {
  return {
    origin: "FULL_PDF_TEXT_CORPUS",
    routeId: match.routeId,
    documentFingerprint: match.documentFingerprint,
    documentName: match.documentName,
    documentRole: match.documentRole,
    documentStatus: match.documentStatus,
    physicalPageNumber: match.physicalPageNumber,
    pageTextStart: match.pageTextStart,
    pageTextEnd: match.pageTextEnd,
    exactQuote: match.exactQuote,
    exactQuoteSha256: match.exactQuoteSha256,
  };
}

function selectedFullCorpusMatches(row, selectors) {
  return selectors.map((selector) => {
    const matches = row.matches.filter(
      (match) =>
        match.routeId === selector.routeId &&
        match.documentFingerprint === selector.documentFingerprint &&
        match.physicalPageNumber === selector.physicalPageNumber
    );
    if (matches.length !== 1)
      throw goldError(
        "LF_GOLD_30_FULL_CORPUS_SELECTOR_INVALID",
        `${row.requirementId}:${selector.routeId}`
      );
    return matches[0];
  });
}

function validateBindings({
  packet,
  adjudication,
  fullCorpusAudit,
  decisions,
}) {
  if (
    packet?.contractId !== "LF_1PLUS9_SOURCE_REVIEW_PACKET_V6" ||
    packet?.status !== "READY_FOR_SOURCE_REVIEW" ||
    packet?.rows?.length !== 30 ||
    adjudication?.contractId !== "LF_1PLUS9_SOURCE_ADJUDICATION_DRAFT_V1" ||
    adjudication?.rows?.length !== 30 ||
    fullCorpusAudit?.contractId !== "LF_1PLUS9_FULL_CORPUS_AUDIT_V1" ||
    fullCorpusAudit?.status !==
      "FULL_PDF_TEXT_CORPUS_SEARCH_COMPLETE_SEMANTIC_REVIEW_REQUIRED" ||
    fullCorpusAudit?.summary?.documents !== 9 ||
    fullCorpusAudit?.summary?.pages !== 77 ||
    decisions?.contractId !== DECISIONS_CONTRACT_ID ||
    !Array.isArray(decisions.rows) ||
    !decisions.positiveRationaleOverrides ||
    Array.isArray(decisions.positiveRationaleOverrides) ||
    typeof decisions.positiveRationaleOverrides !== "object"
  )
    throw goldError("LF_GOLD_30_INPUT_INVALID");
  const packetRequirements = packet.rows.map(
    ({ requirementId }) => requirementId
  );
  if (
    stableStringify(packetRequirements) !==
    stableStringify(adjudication.rows.map(({ requirementId }) => requirementId))
  )
    throw goldError("LF_GOLD_30_ROW_BINDING_INVALID");
  const pending = adjudication.rows
    .filter(({ codexDecision }) => !codexDecision.customerFound)
    .map(({ requirementId }) => requirementId)
    .sort();
  const positive = new Set(
    adjudication.rows
      .filter(({ codexDecision }) => codexDecision.customerFound)
      .map(({ requirementId }) => requirementId)
  );
  if (
    Object.entries(decisions.positiveRationaleOverrides).some(
      ([requirementId, rationale]) =>
        !positive.has(requirementId) ||
        typeof rationale !== "string" ||
        !rationale.trim()
    )
  )
    throw goldError("LF_GOLD_30_POSITIVE_OVERRIDE_INVALID");
  const decisionIds = decisions.rows.map(({ requirementId }) => requirementId);
  if (
    new Set(decisionIds).size !== decisionIds.length ||
    stableStringify([...decisionIds].sort()) !== stableStringify(pending)
  )
    throw goldError("LF_GOLD_30_DECISION_SET_INVALID");
  const auditIds = fullCorpusAudit.rows
    .map(({ requirementId }) => requirementId)
    .sort();
  if (stableStringify(auditIds) !== stableStringify(pending))
    throw goldError("LF_GOLD_30_AUDIT_SET_INVALID");
}

function buildLfKnownFixtureGold30({
  packet,
  packetFileSha256,
  adjudication,
  adjudicationFileSha256,
  fullCorpusAudit,
  fullCorpusAuditFileSha256,
  decisions,
  decisionsFileSha256,
  createdAt = new Date().toISOString(),
}) {
  validateBindings({ packet, adjudication, fullCorpusAudit, decisions });
  for (const digest of [
    packetFileSha256,
    adjudicationFileSha256,
    fullCorpusAuditFileSha256,
    decisionsFileSha256,
  ])
    if (!/^[a-f0-9]{64}$/u.test(digest || ""))
      throw goldError("LF_GOLD_30_SHA_BINDING_INVALID");

  const packetByRequirement = new Map(
    packet.rows.map((row) => [row.requirementId, row])
  );
  const auditByRequirement = new Map(
    fullCorpusAudit.rows.map((row) => [row.requirementId, row])
  );
  const decisionsByRequirement = new Map(
    decisions.rows.map((row) => [row.requirementId, row])
  );
  const rows = adjudication.rows.map((base) => {
    const { codexDecision: priorCodexDraft, ...baseEvidence } = base;
    const packetRow = packetByRequirement.get(base.requirementId);
    const auditRow = auditByRequirement.get(base.requirementId);
    const override = decisionsByRequirement.get(base.requirementId);
    if (!override) {
      const confirmedRationale =
        decisions.positiveRationaleOverrides[base.requirementId] ||
        priorCodexDraft.rationale;
      return {
        ...baseEvidence,
        priorCodexDraft,
        goldDecision: {
          reviewStatus: "SOURCE_BOUND_FINAL_FOR_KNOWN_FIXTURE",
          outcome: priorCodexDraft.outcome,
          customerFound: true,
          rationale: confirmedRationale,
          sources: priorCodexDraft.selectedSources,
          absenceSearch: null,
        },
      };
    }
    if (
      !OUTCOMES.has(override.outcome) ||
      typeof override.rationale !== "string" ||
      !override.rationale.trim() ||
      !Array.isArray(override.selectedPacketCandidateIds) ||
      !Array.isArray(override.selectedFullCorpusMatches) ||
      override.rejectAllOtherFullCorpusMatches !== true ||
      auditRow?.sourceSearchComplete !== true ||
      auditRow?.documentsSearched !== 9 ||
      auditRow?.pagesSearched !== 77
    )
      throw goldError("LF_GOLD_30_DECISION_INVALID", base.requirementId);
    const candidates = packetCandidates(packetRow);
    const selectedPacket = override.selectedPacketCandidateIds.flatMap(
      (candidateId) => {
        const matches = candidates.get(candidateId);
        if (!matches)
          throw goldError(
            "LF_GOLD_30_PACKET_CANDIDATE_INVALID",
            `${base.requirementId}:${candidateId}`
          );
        return matches;
      }
    );
    const selectedCorpus = selectedFullCorpusMatches(
      auditRow,
      override.selectedFullCorpusMatches
    );
    const customerFound = override.outcome !== "NO_COUNTERPART_ESTABLISHED";
    if (
      customerFound !== selectedPacket.length + selectedCorpus.length > 0 ||
      (!customerFound &&
        (override.selectedPacketCandidateIds.length > 0 ||
          override.selectedFullCorpusMatches.length > 0))
    )
      throw goldError("LF_GOLD_30_EVIDENCE_INVALID", base.requirementId);
    const selectedCorpusHashes = new Set(
      selectedCorpus.map(({ exactQuoteSha256 }) => exactQuoteSha256)
    );
    return {
      ...baseEvidence,
      priorCodexDraft,
      goldDecision: {
        reviewStatus: "SOURCE_BOUND_FINAL_FOR_KNOWN_FIXTURE",
        outcome: override.outcome,
        customerFound,
        rationale: override.rationale.trim(),
        sources: [
          ...selectedPacket.map(packetEvidence),
          ...selectedCorpus.map(fullCorpusEvidence),
        ],
        absenceSearch: customerFound
          ? null
          : {
              certifiedForKnownFixture: true,
              documentsSearched: auditRow.documentsSearched,
              pagesSearched: auditRow.pagesSearched,
              routesExecuted: auditRow.routesExecuted,
              reviewedAndRejectedMatches: auditRow.matches
                .filter(
                  ({ exactQuoteSha256 }) =>
                    !selectedCorpusHashes.has(exactQuoteSha256)
                )
                .map(fullCorpusEvidence),
            },
      },
    };
  });
  const payload = {
    schemaVersion: 1,
    contractId: OUTPUT_CONTRACT_ID,
    status: "FROZEN_SOURCE_BOUND_GOLD_FOR_KNOWN_30_ROWS",
    goldAuthority: true,
    scope: "KNOWN_LF_1PLUS9_REPRESENTATIVE_30_ONLY",
    productionRule: false,
    generalizationProof: false,
    createdAt,
    bindings: {
      packetFileSha256,
      packetSha256: packet.packetSha256,
      adjudicationFileSha256,
      adjudicationSha256: adjudication.adjudicationSha256,
      fullCorpusAuditFileSha256,
      fullCorpusAuditSha256: fullCorpusAudit.auditSha256,
      decisionsFileSha256,
      qwenSummarySha256: adjudication.bindings.qwenSummarySha256,
      qwenModel: adjudication.bindings.qwenModel,
    },
    sourceDocuments: fullCorpusAudit.documents,
    summary: {
      rows: rows.length,
      customerFound: rows.filter(
        ({ goldDecision }) => goldDecision.customerFound
      ).length,
      customerNotFound: rows.filter(
        ({ goldDecision }) => !goldDecision.customerFound
      ).length,
      outcomeCounts: Object.fromEntries(
        [...OUTCOMES]
          .map((outcome) => [
            outcome,
            rows.filter(({ goldDecision }) => goldDecision.outcome === outcome)
              .length,
          ])
          .filter(([, count]) => count > 0)
      ),
      knownFixtureAbsenceCertified: rows.filter(
        ({ goldDecision }) =>
          goldDecision.absenceSearch?.certifiedForKnownFixture === true
      ).length,
    },
    rows,
    limitation:
      "This Gold freezes only the thirty reviewed rows for the exact SHA-bound LF 1+9 fixture. It is a regression oracle, not a production template, deployment approval, arbitrary-policy proof or 99-percent claim.",
  };
  return { ...payload, goldSha256: sha256(stableStringify(payload)) };
}

module.exports = {
  DECISIONS_CONTRACT_ID,
  OUTPUT_CONTRACT_ID,
  buildLfKnownFixtureGold30,
  sha256,
};
