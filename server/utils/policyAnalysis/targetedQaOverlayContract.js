const { materializePreparedEvidence } = require("./preparedEvidenceContract");
const {
  assertTargetRequirementSelection,
  selectionDigest,
} = require("./targetRequirementSelection");

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
  requireExactBaselineSet = true,
}) {
  const baselineByKey = assertUniqueObjects(baselineValues, keyOf, code);
  const targetedByKey = assertUniqueObjects(targetedValues, keyOf, code);
  const targetSet = new Set(targetRequirementIds);
  const baselineSet = new Set(baselineRequirementOrder);
  if (requireExactBaselineSet) {
    assertExactRequirementSet(
      baselineValues,
      baselineRequirementOrder,
      requirementIdOf,
      `${code}_BASELINE_SET_MISMATCH`
    );
  } else if (
    baselineValues.some((value) => !baselineSet.has(requirementIdOf(value)))
  ) {
    throw overlayError(`${code}_BASELINE_SET_MISMATCH`);
  }
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

function assertExactIdentity(left, right, code) {
  if (selectionDigest(left) !== selectionDigest(right))
    throw overlayError(code);
}

function worksheetCandidateIndex(worksheet, code) {
  const index = new Map();
  for (const requirement of worksheet.requirements || []) {
    for (const component of requirement.components || []) {
      for (const occurrence of component.occurrences || []) {
        const candidateId = String(occurrence?.candidateId || "");
        if (!candidateId || index.has(candidateId))
          throw overlayError(code, candidateId || "candidate");
        index.set(candidateId, {
          requirementId: requirement.id,
          componentId: component.id,
          occurrence,
        });
      }
    }
  }
  return index;
}

function assertTargetChain({
  categoryView,
  documentStatus,
  worksheet,
  targets,
  judgements,
  code,
}) {
  const candidateIndex = worksheetCandidateIndex(
    worksheet,
    `${code}_CANDIDATE`
  );
  const targetByKey = assertUniqueObjects(targets, targetKey, `${code}_TARGET`);
  const judgementByKey = assertUniqueObjects(
    judgements,
    targetKey,
    `${code}_JUDGEMENT`
  );
  const expectedKeys = [];
  for (const requirement of worksheet.requirements) {
    for (const component of requirement.components || []) {
      const key = targetKey({
        requirementId: requirement.id,
        componentId: component.id,
      });
      expectedKeys.push(key);
      const target = targetByKey.get(key);
      const judgement = judgementByKey.get(key);
      const expectedTargetId = `prepared-target:${requirement.id}:${component.id}`;
      if (
        !target ||
        !judgement ||
        target.targetId !== expectedTargetId ||
        judgement.targetId !== expectedTargetId ||
        target.categoryView !== categoryView ||
        target.documentStatus !== documentStatus ||
        target.requirementLabel !== requirement.label ||
        target.componentLabel !== component.label ||
        target.factRole !== component.factRole
      )
        throw overlayError(`${code}_IDENTITY`, key);

      const acceptedIds = (target.candidates || []).map(
        ({ candidateId }) => candidateId
      );
      const rejectedIds = (target.serverRejectedCandidates || []).map(
        ({ candidateId }) => candidateId
      );
      const unresolvedIds = target.unresolvedCandidateIds || [];
      const ownedOccurrences = (component.occurrences || []).map(
        ({ candidateId }) => candidateId
      );
      if (
        !Array.isArray(target.candidates) ||
        !Array.isArray(target.serverRejectedCandidates) ||
        !Array.isArray(target.unresolvedCandidateIds) ||
        new Set([...acceptedIds, ...rejectedIds]).size !==
          acceptedIds.length + rejectedIds.length ||
        new Set(unresolvedIds).size !== unresolvedIds.length ||
        unresolvedIds.some(
          (candidateId) => !rejectedIds.includes(candidateId)
        ) ||
        [...acceptedIds, ...rejectedIds].sort().join("\n") !==
          [...ownedOccurrences].sort().join("\n")
      )
        throw overlayError(`${code}_CANDIDATE_PARTITION`, key);
      for (const candidateId of [...acceptedIds, ...rejectedIds]) {
        const owner = candidateIndex.get(candidateId);
        if (
          owner?.requirementId !== requirement.id ||
          owner?.componentId !== component.id
        )
          throw overlayError(`${code}_CANDIDATE_OWNERSHIP`, candidateId);
      }
      for (const candidate of target.candidates) {
        const occurrence = candidateIndex.get(
          candidate.candidateId
        )?.occurrence;
        if (
          candidate.exactText !== occurrence?.exactText ||
          candidate.physicalPageNumber !==
            (occurrence?.physicalPageNumber || occurrence?.pageNumber)
        )
          throw overlayError(
            `${code}_CANDIDATE_SOURCE_MISMATCH`,
            candidate.candidateId
          );
      }
      if (
        !Array.isArray(judgement.selectedCandidateIds) ||
        !Array.isArray(judgement.unresolvedCandidateIds) ||
        judgement.selectedCandidateIds.some(
          (candidateId) => !acceptedIds.includes(candidateId)
        ) ||
        judgement.unresolvedCandidateIds.join("\n") !== unresolvedIds.join("\n")
      )
        throw overlayError(`${code}_JUDGEMENT_BINDING`, key);
    }
  }
  if (
    [...targetByKey.keys()].sort().join("\n") !==
      [...expectedKeys].sort().join("\n") ||
    [...judgementByKey.keys()].sort().join("\n") !==
      [...expectedKeys].sort().join("\n")
  )
    throw overlayError(`${code}_COMPONENT_SET_MISMATCH`);
}

function assertTargetResultReport({
  report,
  document,
  categoryView,
  targetRequirementIds,
  targeted,
}) {
  if (
    report?.contractId !== "TARGETED_QA_CATEGORY_RESULT_V1" ||
    report?.runKind !== "TARGETED_QA_ONLY" ||
    report?.status !== "TECHNICAL_PASS_REVIEW_REQUIRED" ||
    report?.categoryView !== categoryView ||
    report?.document?.uuid !== document.uuid ||
    report?.document?.sha256 !== document.sha256 ||
    report?.document?.documentStatus !== document.documentStatus ||
    report?.requirementIds?.join("\n") !== targetRequirementIds.join("\n") ||
    report?.rowCount !== targetRequirementIds.length ||
    report?.tableContract?.pass !== true ||
    report?.outputSemanticDigests?.rowsSha256 !==
      selectionDigest(targeted.rows) ||
    report?.outputSemanticDigests?.requestedFieldsSha256 !==
      selectionDigest(targeted.requestedFields)
  )
    throw overlayError("TARGETED_OVERLAY_RESULT_REPORT_MISMATCH");
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
  document,
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
  if (
    !document?.uuid ||
    !/^[a-f0-9]{64}$/u.test(document?.sha256 || "") ||
    !document?.documentStatus
  )
    throw overlayError("TARGETED_OVERLAY_DOCUMENT_INVALID");
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
  assertExactIdentity(
    baselineWorksheet.catalog,
    targetedWorksheet.catalog,
    "TARGETED_OVERLAY_WORKSHEET_CATALOG_MISMATCH"
  );
  assertExactIdentity(
    baselineWorksheet.document,
    targetedWorksheet.document,
    "TARGETED_OVERLAY_WORKSHEET_DOCUMENT_MISMATCH"
  );
  if (
    baselineWorksheet.document?.fingerprint !== document.sha256 ||
    baselineWorksheet.document?.sourceDocumentId !== document.sha256
  )
    throw overlayError("TARGETED_OVERLAY_WORKSHEET_DOCUMENT_IDENTITY_INVALID");
  if (Object.hasOwn(baselineWorksheet, "targetRequirementSelection"))
    throw overlayError("TARGETED_OVERLAY_BASELINE_TARGET_MARKER_FORBIDDEN");
  const selection = assertTargetRequirementSelection(targetedWorksheet);
  if (selection?.requirementIds?.join("\n") !== targetRequirementIds.join("\n"))
    throw overlayError("TARGETED_OVERLAY_TARGET_SELECTION_MISMATCH");

  assertTargetResultReport({
    report: targeted.report,
    document,
    categoryView,
    targetRequirementIds,
    targeted,
  });

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
    requireExactBaselineSet: false,
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
  assertTargetChain({
    categoryView,
    documentStatus: document.documentStatus,
    worksheet: baselineWorksheet,
    targets: baseline.targets,
    judgements: baseline.materializedEvidence?.judgements,
    code: "TARGETED_OVERLAY_BASELINE_CHAIN",
  });
  assertTargetChain({
    categoryView,
    documentStatus: document.documentStatus,
    worksheet: targetedWorksheet,
    targets: targeted.targets,
    judgements: targeted.materializedEvidence?.judgements,
    code: "TARGETED_OVERLAY_TARGET_CHAIN",
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
