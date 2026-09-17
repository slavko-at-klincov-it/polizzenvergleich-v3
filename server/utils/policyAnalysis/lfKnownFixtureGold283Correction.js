const crypto = require("crypto");

const BASE_GOLD_CONTRACT_ID = "LF_1PLUS9_GOLD_283_V1";
const BASE_GOLD_STATUS =
  "FROZEN_SOURCE_BOUND_GOLD_FOR_KNOWN_LF_1PLUS9_283_ROWS";
const CORRECTION_DECISIONS_CONTRACT_ID =
  "LF_1PLUS9_GOLD_283_CORRECTION_DECISIONS_V1";
const CORRECTION_SET_CONTRACT_ID = "LF_1PLUS9_GOLD_283_CORRECTION_SET_V1";
const CORRECTION_SET_STATUS =
  "FROZEN_SOURCE_BOUND_CORRECTION_SET_FOR_KNOWN_LF_1PLUS9";
const OUTPUT_GOLD_CONTRACT_ID = "LF_1PLUS9_GOLD_283_V2";
const OUTPUT_GOLD_STATUS =
  "FROZEN_SOURCE_BOUND_GOLD_FOR_KNOWN_LF_1PLUS9_283_ROWS_V2";
const NO_COUNTERPART = "NO_COUNTERPART_ESTABLISHED";
const OUTCOMES = new Set([
  "FULL_COUNTERPART",
  "PARTIAL_COUNTERPART",
  "CONTRADICTED",
  NO_COUNTERPART,
]);

function correctionError(code, detail = "") {
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

function validSha(value) {
  return /^[a-f0-9]{64}$/u.test(String(value || ""));
}

function sameMembers(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.every((value) => right.includes(value))
  );
}

function withoutDigest(value, digestField) {
  const payload = { ...value };
  delete payload[digestField];
  return payload;
}

function validateBaseGold(baseGold, baseGoldFileSha256) {
  if (
    baseGold?.contractId !== BASE_GOLD_CONTRACT_ID ||
    baseGold.status !== BASE_GOLD_STATUS ||
    baseGold.goldAuthority !== true ||
    baseGold.qaOnly !== true ||
    baseGold.productionRule !== false ||
    baseGold.releaseApproval !== false ||
    baseGold.generalizationProof !== false ||
    !validSha(baseGoldFileSha256) ||
    !validSha(baseGold.goldSha256) ||
    sha256(stableStringify(withoutDigest(baseGold, "goldSha256"))) !==
      baseGold.goldSha256 ||
    !Array.isArray(baseGold.rows) ||
    baseGold.rows.length !== 283 ||
    baseGold.summary?.rows !== 283 ||
    baseGold.summary?.customerFound !== 273 ||
    baseGold.summary?.customerNotFound !== 10 ||
    baseGold.summary?.explicitAdjudications !== 76 ||
    baseGold.summary?.validatedAutomaticAcceptances !== 207 ||
    !Array.isArray(baseGold.sourceDocuments) ||
    baseGold.sourceDocuments.length !== 9 ||
    new Set(baseGold.rows.map(({ requirementId }) => requirementId)).size !==
      283
  )
    throw correctionError("LF_GOLD_283_V2_BASE_INVALID");
}

function validateArtifactBindings({
  baseGold,
  baseGoldFileSha256,
  gold30,
  gold30FileSha256,
  completeBCorpus,
  completeBCorpusFileSha256,
  finalDecisions,
  finalDecisionsFileSha256,
  baseRegression,
  baseRegressionFileSha256,
  correctionDecisions,
  correctionDecisionsFileSha256,
}) {
  const bindings = correctionDecisions?.bindings;
  if (
    correctionDecisions?.contractId !== CORRECTION_DECISIONS_CONTRACT_ID ||
    correctionDecisions.status !==
      "APPROVED_SOURCE_BOUND_CORRECTIONS_FOR_KNOWN_LF_1PLUS9" ||
    correctionDecisions.qaOnly !== true ||
    correctionDecisions.productionRule !== false ||
    correctionDecisions.generalizationProof !== false ||
    !Array.isArray(correctionDecisions.rows) ||
    correctionDecisions.rows.length !== 3 ||
    new Set(correctionDecisions.rows.map(({ requirementId }) => requirementId))
      .size !== 3 ||
    !validSha(correctionDecisionsFileSha256) ||
    bindings?.baseGoldSha256 !== baseGold.goldSha256 ||
    bindings?.baseGoldFileSha256 !== baseGoldFileSha256 ||
    bindings?.gold30FileSha256 !== gold30FileSha256 ||
    bindings?.completeBCorpusFileSha256 !== completeBCorpusFileSha256 ||
    bindings?.finalDecisionsFileSha256 !== finalDecisionsFileSha256 ||
    bindings?.baseRegressionFileSha256 !== baseRegressionFileSha256
  )
    throw correctionError("LF_GOLD_283_V2_CORRECTION_BINDING_INVALID");

  if (
    gold30?.contractId !== "LF_1PLUS9_GOLD_30_V1" ||
    !Array.isArray(gold30.rows) ||
    gold30.rows.length !== 30 ||
    !validSha(gold30.goldSha256) ||
    !validSha(gold30FileSha256)
  )
    throw correctionError("LF_GOLD_283_V2_GOLD30_INVALID");

  if (
    completeBCorpus?.contractId !== "LF_A_DRIVEN_COMPLETE_B_CORPUS_V1" ||
    completeBCorpus.summary?.documents !== 9 ||
    completeBCorpus.summary?.clauses !== 322 ||
    completeBCorpus.summary?.pages !== 77 ||
    completeBCorpus.summary?.sourceCoverage !==
      "ALL_EXTRACTED_B_CLAUSE_BOUNDARIES" ||
    !validSha(completeBCorpus.corpusSha256) ||
    !validSha(completeBCorpusFileSha256)
  )
    throw correctionError("LF_GOLD_283_V2_COMPLETE_CORPUS_INVALID");

  if (
    finalDecisions?.contractId !==
      "LF_A_DRIVEN_REQUIREMENT_FINAL_DECISION_V1" ||
    finalDecisions.summary?.terminalRequirements !== 363 ||
    finalDecisions.summary?.unresolvedRequirements !== 0 ||
    !Array.isArray(finalDecisions.results) ||
    finalDecisions.results.length !== 363 ||
    !validSha(finalDecisions.finalDecisionSha256) ||
    !validSha(finalDecisionsFileSha256)
  )
    throw correctionError("LF_GOLD_283_V2_FINAL_DECISIONS_INVALID");

  if (
    baseRegression?.contractId !== "LF_A_DRIVEN_GOLD_283_REGRESSION_V2" ||
    baseRegression.goldContractId !== BASE_GOLD_CONTRACT_ID ||
    baseRegression.goldSha256 !== baseGold.goldSha256 ||
    baseRegression.goldFileSha256 !== baseGoldFileSha256 ||
    !Array.isArray(baseRegression.resultRegression?.records) ||
    !validSha(baseRegression.regressionSha256) ||
    !validSha(baseRegressionFileSha256)
  )
    throw correctionError("LF_GOLD_283_V2_BASE_REGRESSION_INVALID");
}

function validateCorrectedRow({
  correction,
  baseRow,
  regressionRecord,
  finalDecision,
}) {
  const baseSourceRefs = (baseRow?.goldDecision?.sources || []).map(
    ({ referenceId }) => referenceId
  );
  if (
    !baseRow ||
    baseRow.goldDecision?.customerFound !== true ||
    baseRow.goldDecision?.outcome !== correction.expectedBaseOutcome ||
    correction.correctedOutcome !== NO_COUNTERPART ||
    !sameMembers(baseSourceRefs, correction.expectedBaseSourceRefs) ||
    !sameMembers(
      correction.reviewedAndRejectedBaseSourceRefs,
      correction.expectedBaseSourceRefs
    ) ||
    typeof correction.rationale !== "string" ||
    !correction.rationale.trim()
  )
    throw correctionError(
      "LF_GOLD_283_V2_BASE_ROW_MISMATCH",
      correction.requirementId
    );

  if (
    regressionRecord?.measurementEligibility !== "UNIQUE_SOURCE_MAPPING" ||
    regressionRecord.predictionResolved !== true ||
    regressionRecord.predictedCustomerFound !== false ||
    regressionRecord.goldCustomerFound !== true ||
    regressionRecord.binaryMatch !== false ||
    !sameMembers(regressionRecord.dynamicRequirementIds, [
      correction.dynamicRequirementId,
    ])
  )
    throw correctionError(
      "LF_GOLD_283_V2_REGRESSION_ROW_MISMATCH",
      correction.requirementId
    );

  const assessment = finalDecision?.assessment;
  if (
    finalDecision?.status !== "TERMINAL" ||
    finalDecision.requirementId !== correction.dynamicRequirementId ||
    finalDecision.customerStatus !== "NOT_FOUND" ||
    finalDecision.customerFound !== false ||
    finalDecision.absenceCertified !== true ||
    finalDecision.resolutionPath !== "COMPLETE_CORPUS_ABSENCE" ||
    assessment?.contextFinding?.outcome !== "NOT_ESTABLISHED" ||
    !Array.isArray(assessment.componentFindings) ||
    assessment.componentFindings.length === 0 ||
    assessment.componentFindings.some(
      ({ outcome }) => outcome !== "NOT_ESTABLISHED"
    ) ||
    !Array.isArray(assessment.selectedCandidateIds) ||
    assessment.selectedCandidateIds.length !== 0 ||
    !Array.isArray(assessment.bEvidence) ||
    assessment.bEvidence.length !== 0 ||
    !validSha(finalDecision.decisionProvenance?.absenceDecisionSha256)
  )
    throw correctionError(
      "LF_GOLD_283_V2_ABSENCE_NOT_CERTIFIED",
      correction.requirementId
    );
}

function outcomeCounts(rows) {
  return Object.fromEntries(
    [...OUTCOMES].map((outcome) => [
      outcome,
      rows.filter((row) => row.goldDecision.outcome === outcome).length,
    ])
  );
}

function buildGold30Comparison(rows, gold30, gold30FileSha256) {
  const byId = new Map(rows.map((row) => [row.requirementId, row]));
  const differences = gold30.rows
    .map((row) => {
      const current = byId.get(row.requirementId)?.goldDecision;
      const previous = row.goldDecision;
      if (
        current?.customerFound === previous?.customerFound &&
        current?.outcome === previous?.outcome
      )
        return null;
      return {
        requirementId: row.requirementId,
        gold30Outcome: previous?.outcome,
        gold283Outcome: current?.outcome,
        gold30CustomerFound: previous?.customerFound,
        gold283CustomerFound: current?.customerFound,
      };
    })
    .filter(Boolean);
  return {
    frozenGold30FileSha256: gold30FileSha256,
    frozenGold30Sha256: gold30.goldSha256,
    unchangedGold30Artifact: true,
    differences,
  };
}

function buildLfKnownFixtureGold283V2({
  baseGold,
  baseGoldFileSha256,
  gold30,
  gold30FileSha256,
  completeBCorpus,
  completeBCorpusFileSha256,
  finalDecisions,
  finalDecisionsFileSha256,
  baseRegression,
  baseRegressionFileSha256,
  correctionDecisions,
  correctionDecisionsFileSha256,
  createdAt = new Date().toISOString(),
}) {
  validateBaseGold(baseGold, baseGoldFileSha256);
  validateArtifactBindings({
    baseGold,
    baseGoldFileSha256,
    gold30,
    gold30FileSha256,
    completeBCorpus,
    completeBCorpusFileSha256,
    finalDecisions,
    finalDecisionsFileSha256,
    baseRegression,
    baseRegressionFileSha256,
    correctionDecisions,
    correctionDecisionsFileSha256,
  });

  const baseRows = new Map(
    baseGold.rows.map((row) => [row.requirementId, row])
  );
  const regressionRecords = new Map(
    baseRegression.resultRegression.records.map((row) => [
      row.legacyRequirementId,
      row,
    ])
  );
  const finalResults = new Map(
    finalDecisions.results.map((row) => [row.requirementId, row])
  );

  for (const correction of correctionDecisions.rows)
    validateCorrectedRow({
      correction,
      baseRow: baseRows.get(correction.requirementId),
      regressionRecord: regressionRecords.get(correction.requirementId),
      finalDecision: finalResults.get(correction.dynamicRequirementId),
    });

  const correctionRows = correctionDecisions.rows.map((correction) => {
    const baseRow = baseRows.get(correction.requirementId);
    const finalDecision = finalResults.get(correction.dynamicRequirementId);
    return {
      requirementId: correction.requirementId,
      dynamicRequirementId: correction.dynamicRequirementId,
      baseRowSha256: sha256(stableStringify(baseRow)),
      from: {
        outcome: baseRow.goldDecision.outcome,
        customerFound: true,
        sourceRefs: correction.expectedBaseSourceRefs,
      },
      to: {
        outcome: NO_COUNTERPART,
        customerFound: false,
      },
      reviewedAndRejectedBaseSources: baseRow.goldDecision.sources.map(
        ({ referenceId, exactTextSha256, sourceRecordSha256 }) => ({
          referenceId,
          exactTextSha256,
          sourceRecordSha256,
        })
      ),
      absenceEvidence: {
        resolutionPath: finalDecision.resolutionPath,
        absenceDecisionSha256:
          finalDecision.decisionProvenance.absenceDecisionSha256,
        completeBCorpusSha256: completeBCorpus.corpusSha256,
        documentsSearched: completeBCorpus.summary.documents,
        clausesSearched: completeBCorpus.summary.clauses,
        pagesSearched: completeBCorpus.summary.pages,
      },
      rationale: correction.rationale.trim(),
    };
  });

  const correctionSetPayload = {
    schemaVersion: 1,
    contractId: CORRECTION_SET_CONTRACT_ID,
    status: CORRECTION_SET_STATUS,
    scope: "KNOWN_LF_1PLUS9_THREE_GOLD_CORRECTIONS_ONLY",
    qaOnly: true,
    productionRule: false,
    releaseApproval: false,
    generalizationProof: false,
    createdAt,
    predecessor: {
      contractId: baseGold.contractId,
      status: baseGold.status,
      fileSha256: baseGoldFileSha256,
      goldSha256: baseGold.goldSha256,
    },
    bindings: {
      correctionDecisionsFileSha256,
      gold30FileSha256,
      completeBCorpusFileSha256,
      completeBCorpusSha256: completeBCorpus.corpusSha256,
      finalDecisionsFileSha256,
      finalDecisionSha256: finalDecisions.finalDecisionSha256,
      baseRegressionFileSha256,
      baseRegressionSha256: baseRegression.regressionSha256,
    },
    summary: {
      correctedRows: correctionRows.length,
      foundToNotFound: correctionRows.length,
      unchangedRows: baseGold.rows.length - correctionRows.length,
    },
    rows: correctionRows,
    limitation:
      "This immutable correction set applies only to three source-bound rows in the exact known LF 1+9 regression fixture. It is QA evidence, not a production rule, deployment approval, holdout proof, arbitrary-policy generalization proof or 99-percent claim.",
  };
  const correctionSet = {
    ...correctionSetPayload,
    correctionSetSha256: sha256(stableStringify(correctionSetPayload)),
  };

  const correctionsById = new Map(
    correctionRows.map((row) => [row.requirementId, row])
  );
  const rows = baseGold.rows.map((baseRow) => {
    const correction = correctionsById.get(baseRow.requirementId);
    if (!correction) return JSON.parse(JSON.stringify(baseRow));
    return {
      ...JSON.parse(JSON.stringify(baseRow)),
      goldDecision: {
        ...JSON.parse(JSON.stringify(baseRow.goldDecision)),
        reviewStatus: "SOURCE_BOUND_CORRECTED_FOR_KNOWN_FIXTURE",
        reviewMethod: CORRECTION_SET_CONTRACT_ID,
        outcome: NO_COUNTERPART,
        customerFound: false,
        rationale: correction.rationale,
        sources: [],
        reviewedSources: JSON.parse(
          JSON.stringify(
            baseRow.goldDecision.reviewedSources ||
              baseRow.goldDecision.sources ||
              []
          )
        ),
        absenceSearch: {
          certifiedForKnownFixture: true,
          documentsSearched: baseGold.sourceDocuments,
          documentsSearchedCount: correction.absenceEvidence.documentsSearched,
          clausesSearched: correction.absenceEvidence.clausesSearched,
          pagesSearched: correction.absenceEvidence.pagesSearched,
          completeBCorpusSha256:
            correction.absenceEvidence.completeBCorpusSha256,
          absenceDecisionSha256:
            correction.absenceEvidence.absenceDecisionSha256,
          reviewedAndRejectedSourceRefs:
            correction.reviewedAndRejectedBaseSources.map(
              ({ referenceId }) => referenceId
            ),
        },
      },
      evidenceHistory: {
        ...JSON.parse(JSON.stringify(baseRow.evidenceHistory || {})),
        gold283V2Correction: {
          correctionSetSha256: correctionSet.correctionSetSha256,
          predecessorRowSha256: correction.baseRowSha256,
        },
      },
    };
  });

  const correctionIds = new Set(
    correctionRows.map(({ requirementId }) => requirementId)
  );
  const unchangedRowsStable = baseGold.rows
    .filter(({ requirementId }) => !correctionIds.has(requirementId))
    .every((baseRow) =>
      rows.some(
        (row) =>
          row.requirementId === baseRow.requirementId &&
          stableStringify(row) === stableStringify(baseRow)
      )
    );
  if (!unchangedRowsStable)
    throw correctionError("LF_GOLD_283_V2_UNCHANGED_ROW_MUTATED");

  const summary = {
    ...baseGold.summary,
    rows: rows.length,
    customerFound: rows.filter(({ goldDecision }) => goldDecision.customerFound)
      .length,
    customerNotFound: rows.filter(
      ({ goldDecision }) => !goldDecision.customerFound
    ).length,
    outcomeCounts: outcomeCounts(rows),
    sourceBoundFoundRows: rows.filter(
      ({ goldDecision }) =>
        goldDecision.customerFound && goldDecision.sources.length > 0
    ).length,
    knownFixtureAbsenceCertified: rows.filter(
      ({ goldDecision }) =>
        goldDecision.absenceSearch?.certifiedForKnownFixture === true
    ).length,
    validatedAutomaticAcceptances:
      baseGold.summary.validatedAutomaticAcceptances - correctionRows.length,
    sourceBoundCorrections: correctionRows.length,
    correctionsApplied: correctionRows.length,
  };
  if (
    summary.customerFound !== 270 ||
    summary.customerNotFound !== 13 ||
    summary.outcomeCounts.FULL_COUNTERPART !== 149 ||
    summary.outcomeCounts.PARTIAL_COUNTERPART !== 113 ||
    summary.outcomeCounts.CONTRADICTED !== 8 ||
    summary.outcomeCounts[NO_COUNTERPART] !== 13
  )
    throw correctionError("LF_GOLD_283_V2_SUMMARY_INVALID");

  const basePayload = { ...baseGold };
  delete basePayload.goldSha256;
  delete basePayload.gold30Comparison;
  const goldPayload = {
    ...basePayload,
    schemaVersion: 2,
    contractId: OUTPUT_GOLD_CONTRACT_ID,
    status: OUTPUT_GOLD_STATUS,
    createdAt,
    bindings: {
      ...baseGold.bindings,
      predecessorGold: {
        fileSha256: baseGoldFileSha256,
        goldSha256: baseGold.goldSha256,
      },
      correctionDecisionsFileSha256,
      correctionSetSha256: correctionSet.correctionSetSha256,
      completeBCorpusFileSha256,
      completeBCorpusSha256: completeBCorpus.corpusSha256,
      finalDecisionsFileSha256,
      finalDecisionSha256: finalDecisions.finalDecisionSha256,
      baseRegressionFileSha256,
      baseRegressionSha256: baseRegression.regressionSha256,
    },
    supersedes: {
      contractId: baseGold.contractId,
      status: baseGold.status,
      fileSha256: baseGoldFileSha256,
      goldSha256: baseGold.goldSha256,
      predecessorPreservedUnchanged: true,
    },
    adjudicationScope: {
      ...baseGold.adjudicationScope,
      automaticallyAcceptedRows: (
        baseGold.adjudicationScope.automaticallyAcceptedRows || []
      ).filter((requirementId) => !correctionIds.has(requirementId)),
      correctionRows: [...correctionIds].sort(),
      v2SourceReviewedRows: [
        ...(baseGold.adjudicationScope.explicitlyAdjudicatedRows || []),
        ...correctionIds,
      ].sort(),
      correctionScopeExpandedBeyondOriginal76: true,
    },
    summary,
    gold30Comparison: buildGold30Comparison(rows, gold30, gold30FileSha256),
    rows,
    limitation:
      "This V2 Gold is a source-bound regression oracle only for the exact SHA-bound LF 1+9 fixture. It preserves Gold-283-V1 unchanged and applies the separately hashed three-row correction set. It is not a production template, deployment approval, holdout proof, arbitrary-policy generalization proof or 99-percent claim.",
  };
  const gold = {
    ...goldPayload,
    goldSha256: sha256(stableStringify(goldPayload)),
  };
  return { correctionSet, gold };
}

module.exports = {
  BASE_GOLD_CONTRACT_ID,
  BASE_GOLD_STATUS,
  CORRECTION_DECISIONS_CONTRACT_ID,
  CORRECTION_SET_CONTRACT_ID,
  CORRECTION_SET_STATUS,
  OUTPUT_GOLD_CONTRACT_ID,
  OUTPUT_GOLD_STATUS,
  buildLfKnownFixtureGold283V2,
  sha256,
  stableStringify,
};
