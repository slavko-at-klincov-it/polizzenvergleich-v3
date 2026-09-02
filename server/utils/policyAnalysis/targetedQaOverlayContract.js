const { materializePreparedEvidence } = require("./preparedEvidenceContract");

const TARGETED_QA_OVERLAY_SCHEMA_VERSION = 1;
const TARGETED_QA_OVERLAY_CONTRACT_ID = "TARGETED_QA_CATEGORY_OVERLAY_V1";

function overlayError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function assertObject(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw overlayError(code);
  return value;
}

function assertUniqueObjects(values, keyOf, code) {
  if (!Array.isArray(values)) throw overlayError(code);
  const keyed = new Map();
  for (const value of values) {
    const key = keyOf(value);
    if (!key || keyed.has(key)) throw overlayError(code, String(key || "key"));
    keyed.set(key, value);
  }
  return keyed;
}

function assertExactRequirementSet(values, requirementIds, keyOf, code) {
  const observed = [...new Set(values.map(keyOf))].sort();
  const expected = [...requirementIds].sort();
  if (observed.join("\n") !== expected.join("\n"))
    throw overlayError(code, observed.join(","));
}

function mergeRequirementOwnedArray({
  baselineValues,
  targetedValues,
  baselineRequirementOrder,
  targetRequirementIds,
  keyOf,
  requirementIdOf,
  code,
  requireExactTargetSet = true,
}) {
  const baselineByKey = assertUniqueObjects(baselineValues, keyOf, code);
  const targetedByKey = assertUniqueObjects(targetedValues, keyOf, code);
  const targetSet = new Set(targetRequirementIds);
  if (requireExactTargetSet) {
    assertExactRequirementSet(
      targetedValues,
      targetRequirementIds,
      requirementIdOf,
      `${code}_TARGET_SET_MISMATCH`
    );
  } else if (
    targetedValues.some((value) => !targetSet.has(requirementIdOf(value)))
  ) {
    throw overlayError(`${code}_TARGET_SET_MISMATCH`);
  }
  const valuesByRequirement = new Map();
  for (const value of baselineByKey.values()) {
    const requirementId = requirementIdOf(value);
    if (targetSet.has(requirementId)) continue;
    if (!valuesByRequirement.has(requirementId))
      valuesByRequirement.set(requirementId, []);
    valuesByRequirement.get(requirementId).push(value);
  }
  for (const value of targetedByKey.values()) {
    const requirementId = requirementIdOf(value);
    if (!valuesByRequirement.has(requirementId))
      valuesByRequirement.set(requirementId, []);
    valuesByRequirement.get(requirementId).push(value);
  }
  return baselineRequirementOrder.flatMap(
    (requirementId) => valuesByRequirement.get(requirementId) || []
  );
}

function worksheetSummary(requirements) {
  const components = requirements.flatMap(
    (requirement) => requirement.components || []
  );
  return {
    requirementCount: requirements.length,
    componentCount: components.length,
    componentsWithCandidates: components.filter(
      ({ occurrenceCount }) => occurrenceCount > 0
    ).length,
    componentsWithoutCandidates: components.filter(
      ({ occurrenceCount }) => occurrenceCount === 0
    ).length,
    occurrenceCount: components.reduce(
      (sum, component) => sum + Number(component.occurrenceCount || 0),
      0
    ),
  };
}

function targetKey(value) {
  return `${value?.requirementId || ""}\u0000${value?.componentId || ""}`;
}

/**
 * Composes one complete category analysis from an immutable full baseline and
 * one validated targeted-QA projection. Only manifest-owned requirements may
 * be replaced. It never reads or writes files and never creates customer
 * output. Role: QA transform. Side effects: none.
 */
function materializeTargetedQaCategoryOverlay({
  categoryView,
  targetRequirementIds,
  baseline,
  targeted,
}) {
  if (!/^(?:VS|FE|LW|ST|EL)$/u.test(categoryView || ""))
    throw overlayError("TARGETED_OVERLAY_CATEGORY_INVALID");
  if (
    !Array.isArray(targetRequirementIds) ||
    targetRequirementIds.length === 0 ||
    new Set(targetRequirementIds).size !== targetRequirementIds.length ||
    targetRequirementIds.some(
      (requirementId) => !requirementId.startsWith(`${categoryView}-`)
    )
  )
    throw overlayError("TARGETED_OVERLAY_REQUIREMENT_IDS_INVALID");
  assertObject(baseline, "TARGETED_OVERLAY_BASELINE_INVALID");
  assertObject(targeted, "TARGETED_OVERLAY_TARGET_INVALID");
  const baselineWorksheet = assertObject(
    baseline.worksheet,
    "TARGETED_OVERLAY_BASELINE_WORKSHEET_INVALID"
  );
  const targetedWorksheet = assertObject(
    targeted.worksheet,
    "TARGETED_OVERLAY_TARGET_WORKSHEET_INVALID"
  );
  if (
    baselineWorksheet.catalog?.categoryView !== categoryView ||
    targetedWorksheet.catalog?.categoryView !== categoryView
  )
    throw overlayError("TARGETED_OVERLAY_WORKSHEET_CATEGORY_MISMATCH");
  if (Object.hasOwn(baselineWorksheet, "targetRequirementSelection"))
    throw overlayError("TARGETED_OVERLAY_BASELINE_TARGET_MARKER_FORBIDDEN");
  if (
    targetedWorksheet.targetRequirementSelection?.requirementIds?.join("\n") !==
    targetRequirementIds.join("\n")
  )
    throw overlayError("TARGETED_OVERLAY_TARGET_SELECTION_MISMATCH");

  const baselineRequirements = assertUniqueObjects(
    baselineWorksheet.requirements,
    ({ id }) => id,
    "TARGETED_OVERLAY_BASELINE_REQUIREMENTS_INVALID"
  );
  const targetedRequirements = assertUniqueObjects(
    targetedWorksheet.requirements,
    ({ id }) => id,
    "TARGETED_OVERLAY_TARGET_REQUIREMENTS_INVALID"
  );
  if (
    [...targetedRequirements.keys()].join("\n") !==
    targetRequirementIds.join("\n")
  )
    throw overlayError("TARGETED_OVERLAY_TARGET_REQUIREMENT_ORDER_MISMATCH");
  for (const requirementId of targetRequirementIds) {
    if (!baselineRequirements.has(requirementId))
      throw overlayError(
        "TARGETED_OVERLAY_REQUIREMENT_NOT_IN_BASELINE",
        requirementId
      );
  }
  const baselineRequirementOrder = [...baselineRequirements.keys()];
  const targetSet = new Set(targetRequirementIds);
  const requirements = baselineRequirementOrder.map((requirementId) =>
    targetSet.has(requirementId)
      ? targetedRequirements.get(requirementId)
      : baselineRequirements.get(requirementId)
  );
  const bindingGroups = mergeRequirementOwnedArray({
    baselineValues: baselineWorksheet.bindingGroups || [],
    targetedValues: targetedWorksheet.bindingGroups || [],
    baselineRequirementOrder,
    targetRequirementIds,
    keyOf: ({ id }) => id,
    requirementIdOf: ({ requirementId }) => requirementId,
    code: "TARGETED_OVERLAY_BINDING_GROUPS_INVALID",
    requireExactTargetSet: false,
  });
  const worksheet = {
    ...baselineWorksheet,
    summary: worksheetSummary(requirements),
    bindingGroups,
    requirements,
  };
  delete worksheet.targetRequirementSelection;

  const rows = mergeRequirementOwnedArray({
    baselineValues: baseline.rows,
    targetedValues: targeted.rows,
    baselineRequirementOrder,
    targetRequirementIds,
    keyOf: ({ categoryId }) => categoryId,
    requirementIdOf: ({ categoryId }) => categoryId,
    code: "TARGETED_OVERLAY_ROWS_INVALID",
  });
  const targets = mergeRequirementOwnedArray({
    baselineValues: baseline.targets,
    targetedValues: targeted.targets,
    baselineRequirementOrder,
    targetRequirementIds,
    keyOf: targetKey,
    requirementIdOf: ({ requirementId }) => requirementId,
    code: "TARGETED_OVERLAY_TARGETS_INVALID",
  });
  const judgements = mergeRequirementOwnedArray({
    baselineValues: baseline.materializedEvidence?.judgements,
    targetedValues: targeted.materializedEvidence?.judgements,
    baselineRequirementOrder,
    targetRequirementIds,
    keyOf: targetKey,
    requirementIdOf: ({ requirementId }) => requirementId,
    code: "TARGETED_OVERLAY_JUDGEMENTS_INVALID",
  });
  const materializedEvidence = materializePreparedEvidence({
    worksheet,
    targets,
    judgements,
  });
  const requestedFields = {
    ...assertObject(
      baseline.requestedFields,
      "TARGETED_OVERLAY_BASELINE_REQUESTED_FIELDS_INVALID"
    ),
    requirements: mergeRequirementOwnedArray({
      baselineValues: baseline.requestedFields.requirements,
      targetedValues: targeted.requestedFields?.requirements,
      baselineRequirementOrder,
      targetRequirementIds,
      keyOf: ({ requirementId }) => requirementId,
      requirementIdOf: ({ requirementId }) => requirementId,
      code: "TARGETED_OVERLAY_REQUESTED_FIELDS_INVALID",
    }),
  };

  return Object.freeze({
    schemaVersion: TARGETED_QA_OVERLAY_SCHEMA_VERSION,
    contractId: TARGETED_QA_OVERLAY_CONTRACT_ID,
    runKind: "TARGETED_QA_ONLY",
    categoryView,
    targetRequirementIds: Object.freeze([...targetRequirementIds]),
    rows,
    worksheet,
    materializedEvidence,
    targets,
    requestedFields,
  });
}

module.exports = {
  TARGETED_QA_OVERLAY_CONTRACT_ID,
  TARGETED_QA_OVERLAY_SCHEMA_VERSION,
  materializeTargetedQaCategoryOverlay,
};
