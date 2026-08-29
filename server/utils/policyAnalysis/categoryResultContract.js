const EVIDENCE_PRESENCE = Object.freeze({
  FOUND: "FOUND",
  NOT_FOUND: "NOT_FOUND",
});

const EVIDENCE_COMPLETENESS = Object.freeze({
  COMPLETE: "COMPLETE",
  PARTIAL: "PARTIAL",
  NONE: "NONE",
});

const COVERAGE_EFFECT = Object.freeze({
  INCLUDED: "INCLUDED",
  EXCLUDED: "EXCLUDED",
  DEFINED: "DEFINED",
  CONDITIONAL: "CONDITIONAL",
  OPTION_ONLY: "OPTION_ONLY",
  UNKNOWN: "UNKNOWN",
});

const COVERAGE_PICTURE = Object.freeze({
  INCLUDED: "INCLUDED",
  EXCLUDED: "EXCLUDED",
  MIXED: "MIXED",
  NOT_DETERMINABLE: "NOT_DETERMINABLE",
});

const CONFLICT_STATE = Object.freeze({
  NONE: "NONE",
  ACTIVE_SAME_SCOPE: "ACTIVE_SAME_SCOPE",
  UNRESOLVED_PRECEDENCE: "UNRESOLVED_PRECEDENCE",
});

const REVIEW_STATUS = Object.freeze({
  BELEGT: "BELEGT",
  TEILBELEGT: "TEILBELEGT",
  WIDERSPRUCHLICH: "WIDERSPRÜCHLICH",
  UNGEKLAERT: "UNGEKLÄRT",
});

const VALUES = Object.freeze({
  evidencePresence: new Set(Object.values(EVIDENCE_PRESENCE)),
  coverageEffect: new Set(Object.values(COVERAGE_EFFECT)),
  conflictState: new Set(Object.values(CONFLICT_STATE)),
});
const COMPONENT_SATISFACTION_POLICY = Object.freeze({
  ALL: "ALL",
  ANY: "ANY",
});

function contractError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function requireNonEmptyString(value, code, label) {
  if (typeof value !== "string" || value.trim().length === 0)
    throw contractError(code, label);
  return value.trim();
}

function requireEnum(value, allowedValues, code, componentId) {
  if (!allowedValues.has(value))
    throw contractError(code, `${componentId}: ${String(value)}`);
  return value;
}

function validateRequiredComponentIds(requiredComponentIds) {
  if (!Array.isArray(requiredComponentIds) || requiredComponentIds.length === 0)
    throw contractError("REQUIRED_COMPONENT_IDS_REQUIRED");

  const ids = requiredComponentIds.map((id, index) =>
    requireNonEmptyString(id, "REQUIRED_COMPONENT_ID_INVALID", `index ${index}`)
  );
  if (new Set(ids).size !== ids.length)
    throw contractError("DUPLICATE_REQUIRED_COMPONENT_ID");
  return ids;
}

function validateCoverageComponentIds(coverageComponentIds, requiredIds) {
  if (coverageComponentIds === undefined) return requiredIds;
  if (!Array.isArray(coverageComponentIds))
    throw contractError("COVERAGE_COMPONENT_IDS_INVALID");
  const ids = coverageComponentIds.map((id, index) =>
    requireNonEmptyString(id, "COVERAGE_COMPONENT_ID_INVALID", `index ${index}`)
  );
  if (new Set(ids).size !== ids.length)
    throw contractError("DUPLICATE_COVERAGE_COMPONENT_ID");
  const unknown = ids.filter((id) => !requiredIds.includes(id));
  if (unknown.length)
    throw contractError("UNKNOWN_COVERAGE_COMPONENT_ID", unknown.join(", "));
  return ids;
}

function validateComponentResult(result, index) {
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw contractError("COMPONENT_RESULT_INVALID", `index ${index}`);

  const componentId = requireNonEmptyString(
    result.componentId,
    "COMPONENT_RESULT_ID_INVALID",
    `index ${index}`
  );
  const evidencePresence = requireEnum(
    result.evidencePresence,
    VALUES.evidencePresence,
    "INVALID_EVIDENCE_PRESENCE",
    componentId
  );
  const coverageEffect = requireEnum(
    result.coverageEffect,
    VALUES.coverageEffect,
    "INVALID_COVERAGE_EFFECT",
    componentId
  );
  const conflictState = requireEnum(
    result.conflictState,
    VALUES.conflictState,
    "INVALID_CONFLICT_STATE",
    componentId
  );

  if (
    evidencePresence === EVIDENCE_PRESENCE.NOT_FOUND &&
    coverageEffect !== COVERAGE_EFFECT.UNKNOWN
  )
    throw contractError("MISSING_EVIDENCE_MUST_BE_UNKNOWN", componentId);
  if (
    evidencePresence === EVIDENCE_PRESENCE.NOT_FOUND &&
    conflictState !== CONFLICT_STATE.NONE
  )
    throw contractError("MISSING_EVIDENCE_CANNOT_CONFLICT", componentId);
  if (
    conflictState !== CONFLICT_STATE.NONE &&
    coverageEffect !== COVERAGE_EFFECT.UNKNOWN
  )
    throw contractError("CONFLICT_EFFECT_MUST_BE_UNKNOWN", componentId);

  return Object.freeze({
    componentId,
    evidencePresence,
    coverageEffect,
    conflictState,
  });
}

function deriveEvidenceCompleteness(componentResults) {
  const foundCount = componentResults.filter(
    ({ evidencePresence }) => evidencePresence === EVIDENCE_PRESENCE.FOUND
  ).length;
  if (foundCount === componentResults.length)
    return EVIDENCE_COMPLETENESS.COMPLETE;
  if (foundCount === 0) return EVIDENCE_COMPLETENESS.NONE;
  return EVIDENCE_COMPLETENESS.PARTIAL;
}

function deriveConflictState(componentResults) {
  if (
    componentResults.some(
      ({ conflictState }) => conflictState === CONFLICT_STATE.ACTIVE_SAME_SCOPE
    )
  )
    return CONFLICT_STATE.ACTIVE_SAME_SCOPE;
  if (
    componentResults.some(
      ({ conflictState }) =>
        conflictState === CONFLICT_STATE.UNRESOLVED_PRECEDENCE
    )
  )
    return CONFLICT_STATE.UNRESOLVED_PRECEDENCE;
  return CONFLICT_STATE.NONE;
}

function deriveCoveragePicture({
  componentResults,
  evidenceCompleteness,
  conflictState,
}) {
  if (
    evidenceCompleteness !== EVIDENCE_COMPLETENESS.COMPLETE ||
    conflictState !== CONFLICT_STATE.NONE
  )
    return COVERAGE_PICTURE.NOT_DETERMINABLE;

  const effects = new Set(
    componentResults.map(({ coverageEffect }) => coverageEffect)
  );
  if (
    effects.has(COVERAGE_EFFECT.UNKNOWN) ||
    effects.has(COVERAGE_EFFECT.CONDITIONAL) ||
    effects.has(COVERAGE_EFFECT.OPTION_ONLY)
  )
    return COVERAGE_PICTURE.NOT_DETERMINABLE;
  if (
    effects.has(COVERAGE_EFFECT.INCLUDED) &&
    effects.has(COVERAGE_EFFECT.EXCLUDED)
  )
    return COVERAGE_PICTURE.MIXED;
  if (effects.has(COVERAGE_EFFECT.INCLUDED)) return COVERAGE_PICTURE.INCLUDED;
  if (effects.has(COVERAGE_EFFECT.EXCLUDED)) return COVERAGE_PICTURE.EXCLUDED;
  return COVERAGE_PICTURE.NOT_DETERMINABLE;
}

function deriveReviewStatus({
  componentResults,
  evidenceCompleteness,
  conflictState,
}) {
  if (conflictState === CONFLICT_STATE.ACTIVE_SAME_SCOPE)
    return REVIEW_STATUS.WIDERSPRUCHLICH;
  if (conflictState === CONFLICT_STATE.UNRESOLVED_PRECEDENCE)
    return REVIEW_STATUS.UNGEKLAERT;
  if (evidenceCompleteness === EVIDENCE_COMPLETENESS.PARTIAL)
    return REVIEW_STATUS.TEILBELEGT;
  if (evidenceCompleteness === EVIDENCE_COMPLETENESS.NONE)
    return REVIEW_STATUS.UNGEKLAERT;
  if (
    componentResults.some(
      ({ coverageEffect }) => coverageEffect === COVERAGE_EFFECT.UNKNOWN
    )
  )
    return REVIEW_STATUS.UNGEKLAERT;
  return REVIEW_STATUS.BELEGT;
}

/**
 * Rolls already classified terminal component results into independent row
 * axes. Inputs must contain exactly one result per required component.
 *
 * Role: decide. Side effects: none. Scope and precedence classification are
 * intentionally owned by later validation modules, not by this rollup.
 */
function rollupCategoryResult({
  categoryId,
  requiredComponentIds,
  componentResults,
  componentSatisfactionPolicy = COMPONENT_SATISFACTION_POLICY.ALL,
  coverageComponentIds,
}) {
  const normalizedCategoryId = requireNonEmptyString(
    categoryId,
    "CATEGORY_ID_REQUIRED",
    "categoryId"
  );
  const requiredIds = validateRequiredComponentIds(requiredComponentIds);
  const coverageIds = validateCoverageComponentIds(
    coverageComponentIds,
    requiredIds
  );
  if (!Array.isArray(componentResults))
    throw contractError("COMPONENT_RESULTS_REQUIRED");

  const results = componentResults.map(validateComponentResult);
  if (
    !Object.values(COMPONENT_SATISFACTION_POLICY).includes(
      componentSatisfactionPolicy
    )
  )
    throw contractError(
      "INVALID_COMPONENT_SATISFACTION_POLICY",
      String(componentSatisfactionPolicy)
    );
  const resultById = new Map();
  for (const result of results) {
    if (resultById.has(result.componentId))
      throw contractError("DUPLICATE_COMPONENT_RESULT", result.componentId);
    if (!requiredIds.includes(result.componentId))
      throw contractError("UNKNOWN_COMPONENT_RESULT", result.componentId);
    resultById.set(result.componentId, result);
  }

  const missingIds = requiredIds.filter((id) => !resultById.has(id));
  if (missingIds.length > 0)
    throw contractError("MISSING_COMPONENT_RESULT", missingIds.join(", "));

  const orderedResults = Object.freeze(
    requiredIds.map((id) => resultById.get(id))
  );
  const foundResults = orderedResults.filter(
    ({ evidencePresence }) => evidencePresence === EVIDENCE_PRESENCE.FOUND
  );
  const evaluatedResults =
    componentSatisfactionPolicy === COMPONENT_SATISFACTION_POLICY.ANY &&
    foundResults.length > 0
      ? foundResults
      : orderedResults;
  const evidenceCompleteness =
    componentSatisfactionPolicy === COMPONENT_SATISFACTION_POLICY.ANY
      ? foundResults.length > 0
        ? EVIDENCE_COMPLETENESS.COMPLETE
        : EVIDENCE_COMPLETENESS.NONE
      : deriveEvidenceCompleteness(orderedResults);
  const conflictState = deriveConflictState(orderedResults);
  const coverageResults = evaluatedResults.filter(({ componentId }) =>
    coverageIds.includes(componentId)
  );
  const coveragePicture = deriveCoveragePicture({
    componentResults: coverageResults,
    evidenceCompleteness,
    conflictState,
  });
  let reviewStatus = deriveReviewStatus({
    componentResults: evaluatedResults,
    evidenceCompleteness,
    conflictState,
  });
  if (
    coverageComponentIds !== undefined &&
    reviewStatus === REVIEW_STATUS.BELEGT &&
    evaluatedResults.some(
      ({ componentId, coverageEffect }) =>
        !coverageIds.includes(componentId) &&
        coverageEffect === COVERAGE_EFFECT.OPTION_ONLY
    )
  )
    reviewStatus = REVIEW_STATUS.TEILBELEGT;

  return Object.freeze({
    categoryId: normalizedCategoryId,
    componentResults: orderedResults,
    componentSatisfactionPolicy,
    ...(coverageComponentIds === undefined
      ? {}
      : { coverageComponentIds: Object.freeze([...coverageIds]) }),
    evidenceCompleteness,
    coveragePicture,
    conflictState,
    reviewStatus,
  });
}

module.exports = {
  COMPONENT_SATISFACTION_POLICY,
  CONFLICT_STATE,
  COVERAGE_EFFECT,
  COVERAGE_PICTURE,
  EVIDENCE_COMPLETENESS,
  EVIDENCE_PRESENCE,
  REVIEW_STATUS,
  rollupCategoryResult,
};
