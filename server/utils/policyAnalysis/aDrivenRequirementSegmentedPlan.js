const crypto = require("crypto");
const {
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
  validateADrivenRequirementDecisionPlan,
} = require("./aDrivenRequirementCounterpartDecision");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

const A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID_V2 =
  "LF_A_DRIVEN_REQUIREMENT_DECISION_PLAN_V2";
const ALLOWED_SOURCE_PLAN_CONTRACT_IDS = new Set([
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID_V2,
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
]);

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function segmentedPlanError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function validateSourcePlan(plan) {
  if (
    !ALLOWED_SOURCE_PLAN_CONTRACT_IDS.has(plan?.contractId) ||
    !Array.isArray(plan?.rows) ||
    !Array.isArray(plan?.batches) ||
    !/^[a-f0-9]{64}$/u.test(String(plan?.planSha256 || ""))
  )
    throw segmentedPlanError("LF_A_DRIVEN_SEGMENT_SOURCE_PLAN_INVALID");
  const { planSha256, ...payload } = plan;
  if (
    planSha256 !==
    sha256(`${plan.contractId}\u0000${stableStringify(payload)}`)
  )
    throw segmentedPlanError("LF_A_DRIVEN_SEGMENT_SOURCE_PLAN_DIGEST_INVALID");
  if (
    plan.batches.length === 0 ||
    plan.rows.length === 0 ||
    plan.selection?.characterClippingAllowed !== false ||
    plan.selection?.goldInputsAllowed !== false ||
    new Set(plan.rows.map(({ requirementId }) => requirementId)).size !==
      plan.rows.length ||
    plan.rows.some(
      (row) =>
        !Array.isArray(row?.components) ||
        row.components.length === 0 ||
        !Array.isArray(row?.candidates) ||
        new Set(row.candidates.map(({ candidateId }) => candidateId)).size !==
          row.candidates.length
    ) ||
    plan.batches.some(
      (batch, batchIndex) =>
        batch?.batchIndex !== batchIndex ||
        !Array.isArray(batch.expectedRequirementIds) ||
        !Array.isArray(batch.rows) ||
        batch.expectedRequirementIds.length !== batch.rows.length ||
        batch.rows.some(
          (row, rowIndex) =>
            row?.requirementId !== batch.expectedRequirementIds[rowIndex]
        )
    ) ||
    stableStringify(
      plan.batches.flatMap(({ expectedRequirementIds }) =>
        expectedRequirementIds
      )
    ) !== stableStringify(plan.rows.map(({ requirementId }) => requirementId))
  )
    throw segmentedPlanError("LF_A_DRIVEN_SEGMENT_SOURCE_BATCHES_INVALID");
  const rowsByRequirementId = new Map(
    plan.rows.map((row) => [row.requirementId, row])
  );
  if (
    plan.batches.some(({ rows }) =>
      rows.some(
        (row) =>
          stableStringify(row) !==
          stableStringify(rowsByRequirementId.get(row.requirementId))
      )
    )
  )
    throw segmentedPlanError("LF_A_DRIVEN_SEGMENT_SOURCE_ROWS_MISMATCH");
  return plan;
}

function semanticRowIdentity(row) {
  const {
    candidates: _candidates,
    reviewId: _reviewId,
    searchCoverage: _searchCoverage,
    ...identity
  } = row;
  return stableStringify({
    ...identity,
    components: identity.components.map(
      ({ navigationCandidateIds: _navigationCandidateIds, ...component }) =>
        component
    ),
  });
}

function buildADrivenRequirementSegmentedPlan({ segments = [] } = {}) {
  if (!Array.isArray(segments) || segments.length === 0)
    throw segmentedPlanError("LF_A_DRIVEN_SEGMENT_ASSIGNMENTS_INVALID");
  for (const segment of segments) validateSourcePlan(segment?.plan);
  const canonical = segments[0].plan;
  const sharedKeys = [
    "dynamicManifestSha256",
    "searchPlanSha256",
    "searchExecutionSha256",
    "completeBCorpusSha256",
  ];
  for (const { plan } of segments)
    if (
      plan.rows.length !== canonical.rows.length ||
      plan.batches.length !== canonical.batches.length ||
      sharedKeys.some((key) => plan[key] !== canonical[key]) ||
      plan.rows.some(
        (row, index) =>
          row.requirementId !== canonical.rows[index].requirementId ||
          semanticRowIdentity(row) !==
            semanticRowIdentity(canonical.rows[index])
      ) ||
      plan.batches.some(
        (batch, index) =>
          stableStringify(batch.expectedRequirementIds) !==
          stableStringify(canonical.batches[index].expectedRequirementIds)
      )
    )
      throw segmentedPlanError(
        "LF_A_DRIVEN_SEGMENT_PLAN_SEMANTIC_IDENTITY_MISMATCH",
        plan.planSha256
      );

  const assignments = Array(canonical.batches.length).fill(null);
  for (const [segmentIndex, segment] of segments.entries()) {
    if (
      !Number.isInteger(segment.startBatchIndex) ||
      !Number.isInteger(segment.endBatchIndexExclusive) ||
      segment.startBatchIndex < 0 ||
      segment.endBatchIndexExclusive <= segment.startBatchIndex ||
      segment.endBatchIndexExclusive > canonical.batches.length
    )
      throw segmentedPlanError("LF_A_DRIVEN_SEGMENT_RANGE_INVALID");
    for (
      let batchIndex = segment.startBatchIndex;
      batchIndex < segment.endBatchIndexExclusive;
      batchIndex += 1
    ) {
      if (assignments[batchIndex] !== null)
        throw segmentedPlanError("LF_A_DRIVEN_SEGMENT_RANGE_OVERLAP");
      assignments[batchIndex] = segmentIndex;
    }
  }
  if (assignments.some((assignment) => assignment === null))
    throw segmentedPlanError("LF_A_DRIVEN_SEGMENT_RANGE_GAP");

  const rowsByRequirementId = new Map();
  const batches = canonical.batches.map((canonicalBatch, batchIndex) => {
    const sourcePlan = segments[assignments[batchIndex]].plan;
    const sourceBatch = sourcePlan.batches[batchIndex];
    const rows = sourceBatch.rows.map((row) => {
      rowsByRequirementId.set(row.requirementId, row);
      return row;
    });
    return { ...sourceBatch, rows };
  });
  const rows = canonical.rows.map((row) => {
    const selected = rowsByRequirementId.get(row.requirementId);
    if (!selected)
      throw segmentedPlanError("LF_A_DRIVEN_SEGMENT_REQUIREMENT_MISSING");
    return selected;
  });
  const payload = {
    schemaVersion: 3,
    contractId: A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
    dynamicManifestSha256: canonical.dynamicManifestSha256,
    searchPlanSha256: canonical.searchPlanSha256,
    searchExecutionSha256: canonical.searchExecutionSha256,
    completeBCorpusSha256: canonical.completeBCorpusSha256,
    selection: {
      strategy: "HASH_BOUND_DISJOINT_SOURCE_PLAN_SEGMENTS",
      characterClippingAllowed: false,
      candidateAuthority: "SERVER_BOUND_NAVIGATION_ONLY",
      goldInputsAllowed: false,
      segments: segments.map(
        ({ plan, startBatchIndex, endBatchIndexExclusive }) => ({
          sourcePlanContractId: plan.contractId,
          sourcePlanSha256: plan.planSha256,
          startBatchIndex,
          endBatchIndexExclusive,
        })
      ),
    },
    rows,
    batches,
    summary: {
      requirements: rows.length,
      components: rows.reduce(
        (sum, row) => sum + row.components.length,
        0
      ),
      selectedCandidates: rows.reduce(
        (sum, row) => sum + row.candidates.length,
        0
      ),
      batches: batches.length,
      absenceCertifiedRequirements: 0,
    },
  };
  const merged = {
    ...payload,
    planSha256: sha256(
      `${A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
  validateADrivenRequirementDecisionPlan(merged);
  return merged;
}

module.exports = {
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID_V2,
  buildADrivenRequirementSegmentedPlan,
  semanticRowIdentity,
  validateSourcePlan,
};
