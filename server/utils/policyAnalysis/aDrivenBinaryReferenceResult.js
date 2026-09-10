const crypto = require("crypto");
const {
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
  validateADrivenSemanticManifest,
} = require("./aDrivenSemanticManifest");
const {
  A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID,
  A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID,
  A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID,
  validateADrivenCounterpartSearchExecution,
  validateADrivenCounterpartSearchPlan,
  validateCounterpartRetrievalArtifact,
} = require("./aDrivenCounterpartSearchPlan");
const {
  COUNTERPART_DECISION_CONTRACT_ID,
  validateCounterpartDecisionArtifact,
} = require("./referenceCounterpartDecisionContract");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

// Projects only fully terminal component decisions into the customer-visible
// binary result. CONTRADICTED is still a found counterpart; its differing
// content remains visible instead of being collapsed into "not found".
const A_DRIVEN_BINARY_RESULT_CONTRACT_ID =
  "LF_A_DRIVEN_BINARY_REFERENCE_RESULT_V2";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function resultError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function selectedEvidence(item, selectedCandidateIds) {
  const candidates = new Map(
    item.candidates.map((candidate) => [
      candidate.compactCandidateId,
      candidate,
    ])
  );
  return selectedCandidateIds.map((candidateId) => {
    const candidate = candidates.get(candidateId);
    if (!candidate)
      throw resultError("LF_A_DRIVEN_SELECTED_CANDIDATE_MISSING", candidateId);
    return {
      compactCandidateId: candidateId,
      documentUuid: candidate.documentUuid,
      documentSha256: candidate.documentSha256,
      clauseBoundaryId: candidate.clauseBoundaryId,
      sourceSpans: candidate.sourceSpans,
    };
  });
}

function buildADrivenBinaryReferenceResult({
  manifest,
  searchPlan,
  retrieval,
  searchExecution,
  decisions,
} = {}) {
  validateADrivenSemanticManifest(manifest);
  validateADrivenCounterpartSearchPlan(searchPlan, manifest);
  validateCounterpartRetrievalArtifact(retrieval, searchPlan);
  validateADrivenCounterpartSearchExecution(searchExecution, {
    plan: searchPlan,
    retrieval,
  });
  validateCounterpartDecisionArtifact(decisions, searchExecution);
  if (
    manifest?.contractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
    searchPlan?.contractId !== A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID ||
    searchExecution?.contractId !==
      A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID ||
    retrieval?.contractId !== A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID ||
    decisions?.contractId !== COUNTERPART_DECISION_CONTRACT_ID ||
    searchPlan.dynamicManifestSha256 !== manifest.manifestSha256 ||
    searchExecution.searchPlanSha256 !== searchPlan.planSha256 ||
    searchExecution.counterpartRetrievalSha256 !== retrieval.retrievalSha256 ||
    decisions.searchExecutionSha256 !== searchExecution.executionSha256 ||
    !Array.isArray(searchExecution.packages) ||
    !Array.isArray(decisions.results) ||
    decisions.summary?.unresolvedPackages !== 0
  )
    throw resultError("LF_A_DRIVEN_BINARY_RESULT_INPUT_INVALID");

  const decisionsByPackage = new Map(
    decisions.results.map((decision) => [decision.packageId, decision])
  );
  if (
    decisionsByPackage.size !== decisions.results.length ||
    searchExecution.packages.length !== decisions.results.length
  )
    throw resultError("LF_A_DRIVEN_BINARY_RESULT_MATRIX_INVALID");
  const packagesByComponent = new Map();
  for (const item of searchExecution.packages) {
    const decision = decisionsByPackage.get(item.packageId);
    if (
      !decision ||
      decision.status !== "TERMINAL" ||
      decision.componentId !== item.componentId ||
      decision.documentUuid !== item.documentUuid
    )
      throw resultError("LF_A_DRIVEN_BINARY_RESULT_DECISION_MISSING");
    const list = packagesByComponent.get(item.componentId) || [];
    list.push({ item, decision });
    packagesByComponent.set(item.componentId, list);
  }

  const rows = [];
  for (const requirement of [...manifest.requirements].sort(
    (left, right) =>
      left.sourceOrder[0] - right.sourceOrder[0] ||
      left.sourceOrder[1] - right.sourceOrder[1] ||
      left.sourceOrder[2] - right.sourceOrder[2] ||
      left.requirementId.localeCompare(right.requirementId)
  )) {
    const componentFindings = requirement.components.map((component) => {
      const cells = packagesByComponent.get(component.componentId) || [];
      if (cells.length !== searchPlan.summary.documents)
        throw resultError(
          "LF_A_DRIVEN_BINARY_RESULT_COMPONENT_MATRIX_INCOMPLETE"
        );
      const documentFindings = cells
        .sort(
          (left, right) =>
            left.item.documentPosition - right.item.documentPosition
        )
        .map(({ item, decision }) => ({
          documentUuid: item.documentUuid,
          documentSha256: item.documentSha256,
          documentRole: item.documentRole,
          documentStatus: item.documentStatus,
          decision: decision.decision,
          decisionScope: decision.decisionScope,
          absenceConclusion: decision.absenceConclusion,
          evidence: selectedEvidence(item, decision.selectedCandidateIds),
        }));
      const componentFound = documentFindings.some(({ decision }) =>
        ["SUPPORTED", "CONTRADICTED"].includes(decision)
      );
      const componentAbsenceCertified = cells.every(
        ({ item, decision }) =>
          item.searchCoverage.absenceStatus === "CERTIFIED_COMPLETE_ABSENCE" &&
          item.searchCoverage.negativeConclusionEligible === true &&
          decision.absenceConclusion === true
      );
      return {
        componentId: component.componentId,
        componentType: component.type,
        componentLabel: component.label,
        componentFound,
        componentAbsenceCertified,
        documentFindings,
      };
    });
    const found = componentFindings.some(
      ({ componentFound }) => componentFound
    );
    const absenceCertified = componentFindings.every(
      ({ componentAbsenceCertified }) => componentAbsenceCertified
    );
    if (!found && !absenceCertified)
      throw resultError(
        "LF_A_DRIVEN_BINARY_NOT_FOUND_REQUIRES_CERTIFIED_ABSENCE"
      );
    if (
      !Array.isArray(requirement.sourceSpans) ||
      !requirement.sourceSpans.length
    )
      throw resultError("LF_A_DRIVEN_BINARY_RESULT_A_SOURCE_MISSING");
    const bEvidence = componentFindings.flatMap(({ documentFindings }) =>
      documentFindings
        .filter(({ evidence }) => evidence.length > 0)
        .flatMap(({ evidence }) => evidence)
    );
    rows.push({
      rowId: `ABR-${sha256(
        `${manifest.runContractId}:${requirement.requirementId}`
      ).slice(0, 24)}`,
      sourceOrder: [...requirement.sourceOrder],
      structurePath: [...requirement.structurePath],
      requirementId: requirement.requirementId,
      requirementLabel: requirement.displayLabel,
      aSourceSpans: requirement.sourceSpans,
      customerStatus: found ? "FOUND" : "NOT_FOUND",
      customerStatusLabel: found ? "Gefunden" : "Nicht gefunden",
      bEvidence,
      componentFindings,
    });
  }
  if (
    rows.length !== manifest.summary.semanticRequirements ||
    new Set(rows.map(({ requirementId }) => requirementId)).size !== rows.length
  )
    throw resultError("LF_A_DRIVEN_BINARY_RESULT_ROW_COVERAGE_INVALID");
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_BINARY_RESULT_CONTRACT_ID,
    runContractId: manifest.runContractId,
    dynamicManifestSha256: manifest.manifestSha256,
    counterpartSearchPlanSha256: searchPlan.planSha256,
    counterpartRetrievalSha256: retrieval.retrievalSha256,
    counterpartSearchExecutionSha256: searchExecution.executionSha256,
    counterpartDecisionSha256: decisions.decisionSha256,
    rows,
    summary: {
      rows: rows.length,
      found: rows.filter(({ customerStatus }) => customerStatus === "FOUND")
        .length,
      notFound: rows.filter(
        ({ customerStatus }) => customerStatus === "NOT_FOUND"
      ).length,
      unresolved: 0,
      sideBOnlyRows: 0,
      binaryCustomerStatus: true,
    },
  };
  return {
    ...payload,
    resultSha256: sha256(
      `${A_DRIVEN_BINARY_RESULT_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

module.exports = {
  A_DRIVEN_BINARY_RESULT_CONTRACT_ID,
  buildADrivenBinaryReferenceResult,
};
