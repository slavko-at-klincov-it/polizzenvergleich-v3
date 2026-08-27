function controlError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function requireArray(value, code, controlId) {
  if (!Array.isArray(value) || value.length === 0)
    throw controlError(code, controlId);
  return value;
}

function assertCompleteControlCoverage({ controlSet, materialized }) {
  if (!Array.isArray(controlSet.controls) || controlSet.controls.length === 0)
    throw controlError("PREPARED_CONTROL_SET_EMPTY");
  if (!Array.isArray(materialized?.judgements))
    throw controlError("PREPARED_CONTROL_MATERIALIZED_INVALID");

  const judgementKeys = new Set(
    materialized.judgements.map(
      ({ requirementId, componentId }) => `${requirementId}:${componentId}`
    )
  );
  const controlledKeys = new Set();
  const controlIds = new Set();
  for (const control of controlSet.controls) {
    const controlId = String(control.id || "");
    if (!controlId) throw controlError("PREPARED_CONTROL_ID_REQUIRED");
    if (controlIds.has(controlId))
      throw controlError("PREPARED_CONTROL_ID_DUPLICATE", controlId);
    controlIds.add(controlId);

    const key = `${control.requirementId}:${control.componentId}`;
    if (!judgementKeys.has(key))
      throw controlError("PREPARED_CONTROL_TARGET_UNKNOWN", key);
    controlledKeys.add(key);
  }

  const missing = [...judgementKeys].filter((key) => !controlledKeys.has(key));
  if (missing.length)
    throw controlError(
      "PREPARED_CONTROL_COVERAGE_INCOMPLETE",
      missing.sort().join(",")
    );
}

/**
 * Evaluates reviewer-authored controls against already validated judgements
 * and server-materialized sources. Inputs/outputs are plain data.
 * Side effects: none. Role: validate.
 */
function evaluatePreparedEvidenceControls({
  controlSet,
  materialized,
  sources,
}) {
  if (controlSet?.schemaVersion !== 1 || !Array.isArray(controlSet.controls))
    throw controlError("PREPARED_CONTROL_SET_INVALID");
  assertCompleteControlCoverage({ controlSet, materialized });
  const judgementByComponent = new Map(
    materialized.judgements.map((judgement) => [
      `${judgement.requirementId}:${judgement.componentId}`,
      judgement,
    ])
  );
  const pagesByComponent = new Map();
  for (const source of sources) {
    const key = `${source.requirementId}:${source.componentId}`;
    if (!pagesByComponent.has(key)) pagesByComponent.set(key, new Set());
    pagesByComponent.get(key).add(source.physicalPageNumber);
  }
  return controlSet.controls.map((control) => {
    const controlId = String(control.id || "");
    const key = `${control.requirementId}:${control.componentId}`;
    const judgement = judgementByComponent.get(key);
    const observedPages = [...(pagesByComponent.get(key) || new Set())].sort(
      (left, right) => left - right
    );
    const allowedEvidencePresence = requireArray(
      control.allowedEvidencePresence,
      "PREPARED_CONTROL_EVIDENCE_REQUIRED",
      controlId
    );
    const allowedCoverageEffects = requireArray(
      control.allowedCoverageEffects,
      "PREPARED_CONTROL_EFFECT_REQUIRED",
      controlId
    );
    const allowedApplicabilities = requireArray(
      control.allowedApplicabilities,
      "PREPARED_CONTROL_APPLICABILITY_REQUIRED",
      controlId
    );
    const pass = Boolean(
      judgement &&
        allowedEvidencePresence.includes(judgement.evidencePresence) &&
        allowedCoverageEffects.includes(judgement.coverageEffect) &&
        allowedApplicabilities.includes(judgement.documentApplicability) &&
        (control.requiredPhysicalPages || []).every((page) =>
          observedPages.includes(page)
        ) &&
        (!control.requiredAnyPhysicalPages ||
          control.requiredAnyPhysicalPages.some((page) =>
            observedPages.includes(page)
          )) &&
        (control.forbiddenPhysicalPages || []).every(
          (page) => !observedPages.includes(page)
        )
    );
    return {
      id: controlId,
      pass,
      requirementId: control.requirementId,
      componentId: control.componentId,
      observed: judgement || null,
      observedPhysicalPages: observedPages,
    };
  });
}

module.exports = { evaluatePreparedEvidenceControls };
