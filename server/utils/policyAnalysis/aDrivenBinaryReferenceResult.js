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
const {
  A_DRIVEN_REQUIREMENT_FINAL_DECISION_CONTRACT_ID,
  validateADrivenRequirementFinalDecisionArtifact,
} = require("./aDrivenRequirementAbsenceCertification");
const {
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
  validateADrivenRequirementDecisionPlan,
} = require("./aDrivenRequirementCounterpartDecision");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

// Projects requirement-level decisions into the customer-visible binary
// result. The semantic identity core determines whether a counterpart exists;
// differing or absent modifier details remain visible without changing a
// source-bound FOUND into NOT_FOUND.
const A_DRIVEN_BINARY_RESULT_CONTRACT_ID =
  "LF_A_DRIVEN_BINARY_REFERENCE_RESULT_V5";
const A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID =
  "LF_A_DRIVEN_BINARY_REFERENCE_RESULT_V6";
const IDENTITY_CORE_COMPONENT_TYPES = new Set([
  "OBJECT",
  "PERIL_OR_CAUSE",
  "DAMAGE_OR_EFFECT",
  "FACT_ROLE",
  "DOCUMENT_ROLE",
  "PRECEDENCE_OR_REPLACEMENT",
]);

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

function aValues(requirement) {
  return requirement.components
    .filter(({ type }) =>
      ["VALUE_AND_UNIT", "LIMIT_BASIS", "DEDUCTIBLE"].includes(type)
    )
    .map(({ componentId, type, label, rawValue, unit, qualifier }) => ({
      componentId,
      type,
      label,
      ...(rawValue ? { rawValue } : {}),
      ...(unit ? { unit } : {}),
      ...(qualifier ? { qualifier } : {}),
    }));
}

function bDimensionFindings(componentFindings, dimensions) {
  return componentFindings.flatMap(({ componentId, documentFindings }) =>
    documentFindings.flatMap(
      ({ documentUuid, decision, dimensionChecks, evidence }) =>
        dimensionChecks
          .filter(({ dimension }) => dimensions.includes(dimension))
          .map(({ checkId, dimension, outcome, candidateIds }) => ({
            componentId,
            documentUuid,
            decision,
            checkId,
            dimension,
            outcome,
            evidence: evidence.filter(({ compactCandidateId }) =>
              candidateIds.includes(compactCandidateId)
            ),
          }))
    )
  );
}

function identityCoreComponentIds(requirement) {
  const explicitCore = requirement.components
    .filter(({ type }) => IDENTITY_CORE_COMPONENT_TYPES.has(type))
    .map(({ componentId }) => componentId);
  return new Set(
    explicitCore.length
      ? explicitCore
      : requirement.components.map(({ componentId }) => componentId)
  );
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
          dimensionChecks: decision.dimensionChecks,
          evidence: selectedEvidence(item, decision.selectedCandidateIds),
        }));
      const componentFound = documentFindings.some(({ decision }) =>
        ["SUPPORTED", "CONTRADICTED"].includes(decision)
      );
      const componentExact = documentFindings.some(
        ({ decision }) => decision === "SUPPORTED"
      );
      const componentContradicted = documentFindings.some(
        ({ decision }) => decision === "CONTRADICTED"
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
        componentExact,
        componentContradicted,
        componentAbsenceCertified,
        documentFindings,
      };
    });
    const identityCoreIds = identityCoreComponentIds(requirement);
    const identityCoreFindings = componentFindings.filter(({ componentId }) =>
      identityCoreIds.has(componentId)
    );
    const found = identityCoreFindings.some(
      ({ componentFound }) => componentFound
    );
    const notFoundCertified = identityCoreFindings.every(
      ({ componentAbsenceCertified }) => componentAbsenceCertified
    );
    if (!found && !notFoundCertified)
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
    const counterpartOutcome = !found
      ? "NO_COUNTERPART_ESTABLISHED"
      : componentFindings.some(
            ({ componentType, componentContradicted }) =>
              componentType === "COVERAGE_EFFECT" && componentContradicted
          )
        ? "CONTRADICTED"
        : componentFindings.every(({ componentExact }) => componentExact)
          ? "FULL_COUNTERPART"
          : "PARTIAL_COUNTERPART";
    rows.push({
      rowId: `ABR-${sha256(
        `${manifest.runContractId}:${requirement.requirementId}`
      ).slice(0, 24)}`,
      sourceOrder: [...requirement.sourceOrder],
      structurePath: [...requirement.structurePath],
      requirementId: requirement.requirementId,
      requirementLabel: requirement.displayLabel,
      aCategoryPath: [...requirement.structurePath],
      aCheckPoint: requirement.displayLabel,
      aOriginalContent: requirement.sourceSpans
        .map(({ exactText }) => exactText)
        .join("\n"),
      aValues: aValues(requirement),
      aSourceSpans: requirement.sourceSpans,
      customerStatus: found ? "FOUND" : "NOT_FOUND",
      customerStatusLabel: found ? "Gefunden" : "Nicht gefunden",
      counterpartOutcome,
      identityCoreComponentIds: [...identityCoreIds],
      bEvidence,
      bCounterparts: bEvidence,
      bEffects: bDimensionFindings(componentFindings, ["COVERAGE_EFFECT"]),
      bValues: bDimensionFindings(componentFindings, [
        "VALUE_AND_UNIT",
        "LIMIT_BASIS",
        "DEDUCTIBLE",
      ]),
      reviewHint: found
        ? counterpartOutcome === "FULL_COUNTERPART"
          ? "Fachlicher Identitätskern und alle Detailkomponenten sind belegt."
          : "Fachlicher Identitätskern ist belegt; Abweichungen oder fehlende Details werden separat dargestellt."
        : "Mindestens eine Pflichtkomponente ist vollständig als nicht vorhanden zertifiziert; Teilbelege bleiben dargestellt.",
      manualAssessment: "",
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
      outcomeCounts: Object.fromEntries(
        [
          "FULL_COUNTERPART",
          "PARTIAL_COUNTERPART",
          "CONTRADICTED",
          "NO_COUNTERPART_ESTABLISHED",
        ].map((outcome) => [
          outcome,
          rows.filter(
            ({ counterpartOutcome }) => counterpartOutcome === outcome
          ).length,
        ])
      ),
    },
  };
  return {
    ...payload,
    resultSha256: sha256(
      `${A_DRIVEN_BINARY_RESULT_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

function requirementEvidenceById(finalDecision) {
  return new Map(
    finalDecision.assessment.bEvidence.map((evidence) => [
      evidence.candidateId,
      evidence,
    ])
  );
}

function requirementComponentFindings(requirement, decisionRow, finalDecision) {
  if (decisionRow.components.length !== requirement.components.length)
    throw resultError(
      "LF_A_DRIVEN_REQUIREMENT_BINARY_COMPONENT_COVERAGE_INVALID",
      requirement.requirementId
    );
  const findingsById = new Map(
    finalDecision.assessment.componentFindings.map((finding) => [
      finding.componentId,
      finding,
    ])
  );
  const plannedComponentsById = new Map(
    decisionRow.components.map((component) => [component.componentId, component])
  );
  const evidenceById = requirementEvidenceById(finalDecision);
  return requirement.components.map((component) => {
    const finding = findingsById.get(component.componentId);
    const plannedComponent = plannedComponentsById.get(component.componentId);
    if (
      !finding ||
      !plannedComponent ||
      finding.dimension !== component.type ||
      plannedComponent.dimension !== component.type
    )
      throw resultError(
        "LF_A_DRIVEN_REQUIREMENT_BINARY_COMPONENT_FINDING_MISSING",
        component.componentId
      );
    const evidence = finding.candidateIds.map((candidateId) => {
      const candidate = evidenceById.get(candidateId);
      if (!candidate)
        throw resultError(
          "LF_A_DRIVEN_REQUIREMENT_BINARY_EVIDENCE_MISSING",
          candidateId
        );
      return candidate;
    });
    return {
      componentId: component.componentId,
      componentType: component.type,
      componentLabel: component.label,
      identityCore: plannedComponent.identityCore,
      outcome: finding.outcome,
      componentFound: [
        "MATCH",
        "COUNTERPART_WITH_DIFFERENCE",
        "OPPOSITE",
      ].includes(finding.outcome),
      componentExact: finding.outcome === "MATCH",
      componentContradicted: finding.outcome === "OPPOSITE",
      componentAbsenceCertified: finalDecision.absenceCertified,
      evidence,
    };
  });
}

function requirementDimensionFindings(componentFindings, dimensions) {
  return componentFindings
    .filter(({ componentType }) => dimensions.includes(componentType))
    .map(
      ({
        componentId,
        componentType,
        componentLabel,
        outcome,
        evidence,
      }) => ({
        componentId,
        dimension: componentType,
        componentLabel,
        outcome,
        evidence,
      })
    );
}

function buildADrivenRequirementBinaryReferenceResult({
  manifest,
  decisionPlan,
  preliminaryDecisions,
  absencePlan,
  absenceDecisions,
  rescuePlan = null,
  rescueDecisions = null,
  finalDecisions,
} = {}) {
  validateADrivenSemanticManifest(manifest);
  validateADrivenRequirementDecisionPlan(decisionPlan);
  const finalInputs = {
    decisionPlan,
    preliminaryDecisions,
    absencePlan,
    absenceDecisions,
    rescuePlan,
    rescueDecisions,
  };
  validateADrivenRequirementFinalDecisionArtifact(
    finalDecisions,
    finalInputs
  );
  if (
    manifest.contractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
    decisionPlan.contractId !==
      A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID ||
    finalDecisions.contractId !==
      A_DRIVEN_REQUIREMENT_FINAL_DECISION_CONTRACT_ID ||
    decisionPlan.dynamicManifestSha256 !== manifest.manifestSha256 ||
    finalDecisions.dynamicManifestSha256 !== manifest.manifestSha256 ||
    finalDecisions.decisionPlanSha256 !== decisionPlan.planSha256 ||
    finalDecisions.summary?.unresolvedRequirements !== 0 ||
    finalDecisions.summary?.binaryCustomerStatus !== true ||
    finalDecisions.summary?.sideBOnlyRows !== 0
  )
    throw resultError("LF_A_DRIVEN_REQUIREMENT_BINARY_RESULT_INPUT_INVALID");

  const finalById = new Map(
    finalDecisions.results.map((result) => [result.requirementId, result])
  );
  const decisionRowsById = new Map(
    decisionPlan.rows.map((row) => [row.requirementId, row])
  );
  if (
    finalById.size !== finalDecisions.results.length ||
    finalById.size !== manifest.requirements.length
  )
    throw resultError("LF_A_DRIVEN_REQUIREMENT_BINARY_RESULT_MATRIX_INVALID");

  const rows = [...manifest.requirements]
    .sort(
      (left, right) =>
        left.sourceOrder[0] - right.sourceOrder[0] ||
        left.sourceOrder[1] - right.sourceOrder[1] ||
        left.sourceOrder[2] - right.sourceOrder[2] ||
        left.requirementId.localeCompare(right.requirementId)
    )
    .map((requirement) => {
      const finalDecision = finalById.get(requirement.requirementId);
      const decisionRow = decisionRowsById.get(requirement.requirementId);
      if (
        !finalDecision ||
        !decisionRow ||
        finalDecision.status !== "TERMINAL" ||
        !["FOUND", "NOT_FOUND"].includes(finalDecision.customerStatus) ||
        (finalDecision.customerStatus === "FOUND" &&
          finalDecision.counterpartEvidence.length === 0) ||
        (finalDecision.customerStatus === "NOT_FOUND" &&
          (finalDecision.absenceCertified !== true ||
            finalDecision.counterpartEvidence.length !== 0))
      )
        throw resultError(
          "LF_A_DRIVEN_REQUIREMENT_BINARY_DECISION_INVALID",
          requirement.requirementId
        );
      if (
        !Array.isArray(requirement.sourceSpans) ||
        requirement.sourceSpans.length === 0
      )
        throw resultError("LF_A_DRIVEN_BINARY_RESULT_A_SOURCE_MISSING");
      const componentFindings = requirementComponentFindings(
        requirement,
        decisionRow,
        finalDecision
      );
      const found = finalDecision.customerStatus === "FOUND";
      const counterpartOutcome = found
        ? finalDecision.counterpartOutcome
        : "NO_COUNTERPART_ESTABLISHED";
      return {
        rowId: `ABR-${sha256(
          `${manifest.runContractId}:${requirement.requirementId}`
        ).slice(0, 24)}`,
        sourceOrder: [...requirement.sourceOrder],
        structurePath: [...requirement.structurePath],
        requirementId: requirement.requirementId,
        requirementLabel: requirement.displayLabel,
        aCategoryPath: [...requirement.structurePath],
        aCheckPoint: requirement.displayLabel,
        aOriginalContent: requirement.sourceSpans
          .map(({ exactText }) => exactText)
          .join("\n"),
        aValues: aValues(requirement),
        aSourceSpans: requirement.sourceSpans,
        customerStatus: finalDecision.customerStatus,
        customerStatusLabel: found ? "Gefunden" : "Nicht gefunden",
        counterpartOutcome,
        identityCoreComponentIds: decisionRow.components
          .filter(({ identityCore }) => identityCore)
          .map(({ componentId }) => componentId),
        bEvidence: finalDecision.counterpartEvidence,
        bCounterparts: finalDecision.counterpartEvidence,
        bEffects: requirementDimensionFindings(componentFindings, [
          "COVERAGE_EFFECT",
        ]),
        bValues: requirementDimensionFindings(componentFindings, [
          "VALUE_AND_UNIT",
          "LIMIT_BASIS",
          "DEDUCTIBLE",
        ]),
        reviewHint: found
          ? counterpartOutcome === "FULL_COUNTERPART"
            ? "Fachlicher Identitätskern und alle Detailkomponenten sind belegt."
            : "Fachlicher Identitätskern ist belegt; Abweichungen oder fehlende Details werden separat dargestellt."
          : "Der vollständige extrahierte B-Korpus wurde geprüft; kein Gegenstück desselben fachlichen Kerns wurde bestätigt.",
        manualAssessment: "",
        componentFindings,
        unmodeledDifferences:
          finalDecision.assessment.unmodeledDifferences,
        decisionRationale: finalDecision.assessment.rationale,
        resolutionPath: finalDecision.resolutionPath,
        decisionProvenance: finalDecision.decisionProvenance,
        absenceReview: finalDecision.absenceReview,
      };
    });
  if (
    rows.length !== manifest.summary.semanticRequirements ||
    new Set(rows.map(({ requirementId }) => requirementId)).size !== rows.length
  )
    throw resultError(
      "LF_A_DRIVEN_REQUIREMENT_BINARY_RESULT_ROW_COVERAGE_INVALID"
    );
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID,
    runContractId: manifest.runContractId,
    dynamicManifestSha256: manifest.manifestSha256,
    requirementDecisionPlanSha256: decisionPlan.planSha256,
    finalRequirementDecisionSha256: finalDecisions.finalDecisionSha256,
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
      outcomeCounts: Object.fromEntries(
        [
          "FULL_COUNTERPART",
          "PARTIAL_COUNTERPART",
          "CONTRADICTED",
          "NO_COUNTERPART_ESTABLISHED",
        ].map((outcome) => [
          outcome,
          rows.filter(
            ({ counterpartOutcome }) => counterpartOutcome === outcome
          ).length,
        ])
      ),
    },
    proofLimit:
      "Das Ergebnis gilt für den hashgebundenen extrahierten A/B-Korpus dieses Laufs. Gold-283 beeinflusst weder Zeilen noch Entscheidungen und bleibt eine getrennte QA-Regression.",
  };
  return {
    ...payload,
    resultSha256: sha256(
      `${A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

function validateADrivenRequirementBinaryReferenceResult(result, inputs) {
  const rebuilt = buildADrivenRequirementBinaryReferenceResult(inputs);
  if (
    result?.contractId !== A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID ||
    !/^[a-f0-9]{64}$/u.test(String(result.resultSha256 || "")) ||
    stableStringify(result) !== stableStringify(rebuilt)
  )
    throw resultError("LF_A_DRIVEN_REQUIREMENT_BINARY_RESULT_INVALID");
  return result;
}

module.exports = {
  A_DRIVEN_BINARY_RESULT_CONTRACT_ID,
  A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID,
  buildADrivenBinaryReferenceResult,
  buildADrivenRequirementBinaryReferenceResult,
  validateADrivenRequirementBinaryReferenceResult,
};
