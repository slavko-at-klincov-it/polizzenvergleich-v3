const crypto = require("crypto");
const {
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
} = require("./aDrivenSemanticManifest");

// Compares a dynamic A manifest with the historical 283/631 oracle output.
// The legacy manifest is an evaluation denominator only: it can propose
// overlap candidates but can never create or amend production requirements.
const LEGACY_CROSSWALK_CONTRACT_ID =
  "LF_A_DYNAMIC_TO_LEGACY_283_CROSSWALK_V1";
const EXPECTED_LEGACY_REQUIREMENTS = 283;
const EXPECTED_LEGACY_COMPONENTS = 631;
const COVERED_RELATIONS = new Set([
  "EQUIVALENT",
  "REPHRASED_EQUIVALENT",
  "MOVED_EQUIVALENT",
  "SPLIT_INTO_DYNAMIC",
  "MERGED_INTO_DYNAMIC",
]);
const RELATIONS = new Set([
  ...COVERED_RELATIONS,
  "MISSING",
  "AMBIGUOUS",
]);
const LEGACY_ROLE_TO_DYNAMIC_TYPES = Object.freeze({
  INSURED_OBJECT: ["OBJECT"],
  PERIL: ["PERIL_OR_CAUSE"],
  DAMAGE: ["DAMAGE_OR_EFFECT"],
  BENEFIT: ["COVERAGE_EFFECT", "FACT_ROLE"],
  EXCLUSION: ["COVERAGE_EFFECT"],
  COST: ["FACT_ROLE", "VALUE_AND_UNIT"],
  LIMIT: ["VALUE_AND_UNIT", "LIMIT_BASIS"],
  DEDUCTIBLE: ["DEDUCTIBLE", "VALUE_AND_UNIT"],
  CONDITION: ["CONDITION", "TEMPORAL_VALIDITY"],
  DEFINITION: ["FACT_ROLE"],
  DOCUMENT_STATUS: ["DOCUMENT_ROLE", "PRECEDENCE_OR_REPLACEMENT"],
});

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function crosswalkError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function legacyComponents(legacyManifest) {
  if (
    !Array.isArray(legacyManifest?.requirements) ||
    !Array.isArray(legacyManifest?.categories)
  )
    throw crosswalkError("LF_LEGACY_MANIFEST_INVALID");
  const analysisRows = new Map();
  for (const [categoryIndex, category] of legacyManifest.categories.entries()) {
    const requirementIds = category.subcategories.flatMap(
      (subcategory) => subcategory.requirementIds
    );
    for (const [rowIndex, requirementId] of requirementIds.entries())
      analysisRows.set(
        requirementId,
        `LR${String(categoryIndex + 1).padStart(2, "0")}-${String(
          rowIndex + 1
        ).padStart(3, "0")}`
      );
  }
  return legacyManifest.requirements.flatMap((requirement) =>
    requirement.components.map((component) => ({
      legacyAnalysisRowId: analysisRows.get(requirement.requirementId),
      legacyRequirementId: requirement.requirementId,
      legacyComponentId: component.id,
      legacyFactRole: component.factRole,
      sourceBlockIds: [
        ...new Set(
          (component.sourceSpanIds || []).flatMap((spanId) =>
            requirement.sourceSpans
              .filter(({ spanId: id }) => id === spanId)
              .flatMap(({ blockIds = [] }) => blockIds
          )
        )
      ],
    }))
  );
}

function dynamicComponents(dynamicManifest) {
  if (
    dynamicManifest?.contractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
    !Array.isArray(dynamicManifest.requirements)
  )
    throw crosswalkError("LF_DYNAMIC_MANIFEST_INVALID");
  return dynamicManifest.requirements.flatMap((requirement) =>
    requirement.components.map((component) => ({
      dynamicRequirementId: requirement.requirementId,
      dynamicComponentId: component.componentId,
      dynamicComponentType: component.type,
      sourceBlockIds: component.sourceBlockIds,
    }))
  );
}

function buildLegacyOracleCrosswalkDraft({ dynamicManifest, legacyManifest } = {}) {
  const legacy = legacyComponents(legacyManifest);
  if (legacy.some(({ legacyAnalysisRowId }) => !legacyAnalysisRowId))
    throw crosswalkError("LF_LEGACY_ANALYSIS_ROW_ID_MISSING");
  const dynamic = dynamicComponents(dynamicManifest);
  const records = legacy.map((component) => ({
    ...component,
    sourceOverlapCandidates: dynamic
      .filter((candidate) =>
        candidate.sourceBlockIds.some((blockId) =>
          component.sourceBlockIds.includes(blockId)
        )
      )
      .map(({ dynamicRequirementId, dynamicComponentId }) => ({
        dynamicRequirementId,
        dynamicComponentId,
      })),
    relation: "UNREVIEWED",
    semanticDecision: "UNREVIEWED",
    dynamicTargets: [],
  }));
  return {
    schemaVersion: 1,
    contractId: LEGACY_CROSSWALK_CONTRACT_ID,
    dynamicManifestSha256: dynamicManifest.manifestSha256,
    legacyManifestSha256: legacyManifest.manifestSha256,
    records,
    summary: {
      legacyRequirements: new Set(
        legacy.map(({ legacyRequirementId }) => legacyRequirementId)
      ).size,
      legacyComponents: legacy.length,
      reviewedComponents: 0,
      coveredComponents: 0,
      missingComponents: 0,
      ambiguousComponents: 0,
      expectedLegacyRequirements: EXPECTED_LEGACY_REQUIREMENTS,
      expectedLegacyComponents: EXPECTED_LEGACY_COMPONENTS,
      acceptanceReady: false,
    },
  };
}

function validateLegacyOracleCrosswalk({ draft, dynamicManifest, decisions } = {}) {
  if (
    draft?.contractId !== LEGACY_CROSSWALK_CONTRACT_ID ||
    draft.dynamicManifestSha256 !== dynamicManifest?.manifestSha256 ||
    !Array.isArray(draft.records) ||
    !Array.isArray(decisions)
  )
    throw crosswalkError("LF_LEGACY_CROSSWALK_INPUT_INVALID");
  const dynamic = dynamicComponents(dynamicManifest);
  const dynamicById = new Map(
    dynamic.map((component) => [component.dynamicComponentId, component])
  );
  const dynamicIds = new Set(dynamicById.keys());
  const keys = new Set(
    draft.records.map(
      ({ legacyRequirementId, legacyComponentId }) =>
        `${legacyRequirementId}:${legacyComponentId}`
    )
  );
  const indexed = new Map();
  for (const decision of decisions) {
    const key = `${decision?.legacyRequirementId}:${decision?.legacyComponentId}`;
    if (!keys.has(key) || indexed.has(key))
      throw crosswalkError("LF_LEGACY_CROSSWALK_DECISION_IDS_INVALID");
    indexed.set(key, decision);
  }
  const records = draft.records.map((record) => {
    const key = `${record.legacyRequirementId}:${record.legacyComponentId}`;
    const decision = indexed.get(key);
    if (!decision)
      return {
        ...record,
        relation: "AMBIGUOUS",
        semanticDecision: "MISSING_REVIEW",
      };
    const targets = Array.isArray(decision.dynamicTargets)
      ? [...new Set(decision.dynamicTargets)]
      : [];
    const overlapTargetIds = new Set(
      record.sourceOverlapCandidates.map(
        ({ dynamicComponentId }) => dynamicComponentId
      )
    );
    const reviewerIds = Array.isArray(decision.reviewerIds)
      ? [...new Set(decision.reviewerIds.filter((value) => typeof value === "string" && value))]
      : [];
    const allowedDynamicTypes =
      LEGACY_ROLE_TO_DYNAMIC_TYPES[record.legacyFactRole] || [];
    const targetTypesCompatible = targets.every((target) =>
      allowedDynamicTypes.includes(
        dynamicById.get(target)?.dynamicComponentType
      )
    );
    const cardinalityValid =
      (["EQUIVALENT", "REPHRASED_EQUIVALENT", "MOVED_EQUIVALENT"].includes(
        decision.relation
      ) && targets.length === 1) ||
      (decision.relation === "SPLIT_INTO_DYNAMIC" && targets.length >= 2) ||
      (decision.relation === "MERGED_INTO_DYNAMIC" && targets.length === 1) ||
      (["MISSING", "AMBIGUOUS"].includes(decision.relation) &&
        targets.length === 0);
    if (
      !RELATIONS.has(decision.relation) ||
      targets.some((target) => !dynamicIds.has(target)) ||
      targets.some((target) => !overlapTargetIds.has(target)) ||
      !targetTypesCompatible ||
      !cardinalityValid ||
      (COVERED_RELATIONS.has(decision.relation) && targets.length === 0) ||
      (decision.relation === "MISSING" && targets.length !== 0) ||
      decision.reviewStatus !== "APPROVED" ||
      reviewerIds.length < 2
    )
      return {
        ...record,
        relation: "AMBIGUOUS",
        semanticDecision: "INVALID_REVIEW",
        dynamicTargets: [],
      };
    return {
      ...record,
      relation: decision.relation,
      semanticDecision: "REVIEWED",
      dynamicTargets: targets,
      reviewStatus: decision.reviewStatus,
      reviewerIds,
    };
  });
  const covered = records.filter(({ relation, semanticDecision }) =>
    COVERED_RELATIONS.has(relation) && semanticDecision === "REVIEWED"
  );
  const payload = {
    ...draft,
    records,
    summary: {
      ...draft.summary,
      reviewedComponents: records.filter(
        ({ semanticDecision }) => semanticDecision === "REVIEWED"
      ).length,
      coveredComponents: covered.length,
      coveredRequirements: new Set(
        covered.map(({ legacyRequirementId }) => legacyRequirementId)
      ).size,
      missingComponents: records.filter(({ relation }) => relation === "MISSING")
        .length,
      ambiguousComponents: records.filter(({ relation }) => relation === "AMBIGUOUS")
        .length,
      acceptanceReady:
        draft.summary.legacyRequirements === EXPECTED_LEGACY_REQUIREMENTS &&
        records.length === EXPECTED_LEGACY_COMPONENTS &&
        covered.length === records.length &&
        new Set(covered.map(({ legacyRequirementId }) => legacyRequirementId)).size ===
          draft.summary.legacyRequirements,
    },
  };
  return {
    ...payload,
    crosswalkSha256: sha256(JSON.stringify(payload)),
  };
}

module.exports = {
  LEGACY_CROSSWALK_CONTRACT_ID,
  buildLegacyOracleCrosswalkDraft,
  validateLegacyOracleCrosswalk,
};
