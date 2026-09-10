const crypto = require("crypto");
const {
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
  validateADrivenSemanticManifest,
} = require("./aDrivenSemanticManifest");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

// Builds the complete component x B-document retrieval matrix for the
// A-driven reference mode. This layer only plans searches; it cannot create
// candidates or make semantic decisions.
const A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID =
  "LF_A_DRIVEN_COUNTERPART_SEARCH_PLAN_V2";
const A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID =
  "LF_A_DRIVEN_COUNTERPART_RETRIEVAL_V2";
const A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID =
  "LF_A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_V2";
const BOUNDED_RETRIEVAL_POLICY_CONTRACT_ID =
  "LF_BOUNDED_COUNTERPART_RETRIEVAL_V1";
const DEFAULT_PER_CHANNEL_TOP_K = 8;
const REQUIRED_SEARCH_CHANNELS = Object.freeze([
  "CURRENT",
  "LEXICAL_BM25",
  "STRUCTURAL",
  "DINGHY",
  "VALUE_ROLE",
]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function planError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function queryTerms(values) {
  return unique(
    values
      .flatMap((value) =>
        normalizedText(value)
          .toLocaleLowerCase("de-AT")
          .split(/[^\p{L}\p{N}%€]+/u)
      )
      .filter((value) => value.length >= 2)
  ).sort();
}

function validateDocument(document, seenUuids, seenPositions) {
  if (
    typeof document?.uuid !== "string" ||
    !document.uuid ||
    seenUuids.has(document.uuid) ||
    !Number.isInteger(document.position) ||
    document.position < 0 ||
    seenPositions.has(document.position) ||
    !/^[a-f0-9]{64}$/u.test(String(document.sha256 || ""))
  )
    throw planError("LF_A_DRIVEN_B_DOCUMENT_INVALID");
  seenUuids.add(document.uuid);
  seenPositions.add(document.position);
  return {
    documentUuid: document.uuid,
    documentSha256: document.sha256,
    documentPosition: document.position,
    documentRole: document.role || "OTHER",
    documentStatus: document.documentStatus || "ACTIVE",
    originalName: document.originalName || null,
  };
}

function buildADrivenCounterpartSearchPlan({
  manifest,
  documents,
  perChannelTopK = DEFAULT_PER_CHANNEL_TOP_K,
} = {}) {
  validateADrivenSemanticManifest(manifest);
  if (
    manifest?.contractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
    manifest.summary?.unresolvedUnits !== 0 ||
    manifest.summary?.responseIntegrityStatus !== "VALID" ||
    manifest.requirements.some(
      ({ decisionEligibility }) => decisionEligibility !== "ELIGIBLE"
    ) ||
    !Number.isInteger(perChannelTopK) ||
    perChannelTopK < 1
  )
    throw planError("LF_A_DRIVEN_MANIFEST_NOT_SEARCH_ELIGIBLE");
  if (!Array.isArray(documents) || documents.length === 0)
    throw planError("LF_A_DRIVEN_B_DOCUMENTS_REQUIRED");

  const seenUuids = new Set();
  const seenPositions = new Set();
  const plannedDocuments = documents
    .map((document) => validateDocument(document, seenUuids, seenPositions))
    .sort(
      (left, right) =>
        left.documentPosition - right.documentPosition ||
        left.documentUuid.localeCompare(right.documentUuid)
    );
  const orderedRequirements = [...manifest.requirements].sort(
    (left, right) =>
      left.sourceOrder[0] - right.sourceOrder[0] ||
      left.sourceOrder[1] - right.sourceOrder[1] ||
      left.sourceOrder[2] - right.sourceOrder[2] ||
      left.requirementId.localeCompare(right.requirementId)
  );
  const packages = [];
  for (const requirement of orderedRequirements) {
    if (
      typeof requirement.requirementId !== "string" ||
      !Array.isArray(requirement.components) ||
      requirement.components.length === 0
    )
      throw planError("LF_A_DRIVEN_REQUIREMENT_INVALID");
    const contextLabels = unique(
      requirement.components.flatMap(({ label, rawValue, qualifier }) => [
        label,
        rawValue,
        qualifier,
      ])
    );
    const requiredDimensions = unique(
      requirement.components.map(({ type }) => type)
    ).sort();
    for (const component of requirement.components) {
      if (
        typeof component?.componentId !== "string" ||
        !component.componentId ||
        typeof component.type !== "string" ||
        !normalizedText(component.label)
      )
        throw planError("LF_A_DRIVEN_COMPONENT_INVALID");
      const componentQueryValues = unique([
        component.label,
        component.rawValue,
        component.unit,
        component.qualifier,
        component.coverageEffect,
      ]);
      const semanticChecks = requirement.components.map((checkedComponent) => ({
        checkId: `ASC-${sha256(
          `${requirement.requirementId}:${component.componentId}:${checkedComponent.componentId}`
        ).slice(0, 24)}`,
        role:
          checkedComponent.componentId === component.componentId
            ? "TARGET"
            : "CONTEXT",
        componentId: checkedComponent.componentId,
        dimension: checkedComponent.type,
        label: checkedComponent.label,
        ...(checkedComponent.rawValue
          ? { rawValue: checkedComponent.rawValue }
          : {}),
        ...(checkedComponent.unit ? { unit: checkedComponent.unit } : {}),
        ...(checkedComponent.qualifier
          ? { qualifier: checkedComponent.qualifier }
          : {}),
        ...(checkedComponent.coverageEffect
          ? { coverageEffect: checkedComponent.coverageEffect }
          : {}),
      }));
      for (const document of plannedDocuments) {
        const identity = {
          contractId: A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID,
          manifestSha256: manifest.manifestSha256,
          requirementId: requirement.requirementId,
          componentId: component.componentId,
          documentUuid: document.documentUuid,
          documentSha256: document.documentSha256,
        };
        packages.push({
          packageId: `ASP-${sha256(stableStringify(identity)).slice(0, 24)}`,
          requirementId: requirement.requirementId,
          componentId: component.componentId,
          componentType: component.type,
          sourceOrder: [...requirement.sourceOrder],
          structurePath: [...requirement.structurePath],
          documentUuid: document.documentUuid,
          documentSha256: document.documentSha256,
          documentPosition: document.documentPosition,
          documentRole: document.documentRole,
          documentStatus: document.documentStatus,
          requiredDimensions,
          semanticChecks,
          query: {
            focalText: normalizedText(component.label),
            focalValues: componentQueryValues,
            contextText: normalizedText(contextLabels.join(" | ")),
            lexicalTerms: queryTerms([
              ...componentQueryValues,
              ...contextLabels,
            ]),
            structurePath: [...requirement.structurePath],
            semanticComponent: {
              type: component.type,
              label: component.label,
              ...(component.rawValue ? { rawValue: component.rawValue } : {}),
              ...(component.unit ? { unit: component.unit } : {}),
              ...(component.qualifier
                ? { qualifier: component.qualifier }
                : {}),
              ...(component.coverageEffect
                ? { coverageEffect: component.coverageEffect }
                : {}),
            },
          },
          searchCoverage: {
            scope: "ONE_COMPONENT_ONE_B_DOCUMENT",
            requiredChannels: [...REQUIRED_SEARCH_CHANNELS],
            completedChannels: [],
            channelExecutionStatus: "PENDING",
            absenceStatus: "NOT_CERTIFIED_BOUNDED_TOP_K",
            negativeConclusionEligible: false,
            globalTopNAllowed: false,
          },
          candidates: [],
          semanticAuthority: false,
        });
      }
    }
  }
  const expectedPackages =
    manifest.summary.semanticComponents * documents.length;
  if (
    packages.length !== expectedPackages ||
    new Set(packages.map(({ packageId }) => packageId)).size !== packages.length
  )
    throw planError("LF_A_DRIVEN_SEARCH_MATRIX_INCOMPLETE");
  const payload = {
    schemaVersion: 2,
    contractId: A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID,
    runContractId: manifest.runContractId,
    dynamicManifestSha256: manifest.manifestSha256,
    retrievalPolicy: {
      contractId: BOUNDED_RETRIEVAL_POLICY_CONTRACT_ID,
      selectionMode: "PER_CHANNEL_TOP_K",
      perChannelTopK,
      candidateSemantics: "NAVIGATION_ONLY",
      absenceCertification: "NOT_AVAILABLE",
    },
    documents: plannedDocuments,
    packages,
    summary: {
      requirements: manifest.requirements.length,
      components: manifest.summary.semanticComponents,
      documents: plannedDocuments.length,
      plannedPackages: packages.length,
      expectedPackages,
      completeMatrix: packages.length === expectedPackages,
      requiredChannels: [...REQUIRED_SEARCH_CHANNELS],
      customerRowsFromSideB: 0,
    },
  };
  return {
    ...payload,
    planSha256: sha256(
      `${A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

function validateADrivenCounterpartSearchPlan(plan, manifest) {
  if (
    plan?.contractId !== A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID ||
    !Array.isArray(plan.packages) ||
    !Array.isArray(plan.documents) ||
    plan.retrievalPolicy?.contractId !== BOUNDED_RETRIEVAL_POLICY_CONTRACT_ID ||
    plan.retrievalPolicy?.selectionMode !== "PER_CHANNEL_TOP_K" ||
    !Number.isInteger(plan.retrievalPolicy?.perChannelTopK) ||
    plan.retrievalPolicy.perChannelTopK < 1 ||
    plan.retrievalPolicy?.absenceCertification !== "NOT_AVAILABLE" ||
    !/^[a-f0-9]{64}$/u.test(String(plan.planSha256 || ""))
  )
    throw planError("LF_A_DRIVEN_SEARCH_PLAN_INVALID");
  const { planSha256, ...payload } = plan;
  if (
    planSha256 !==
    sha256(
      `${A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    )
  )
    throw planError("LF_A_DRIVEN_SEARCH_PLAN_DIGEST_INVALID");
  if (manifest) {
    validateADrivenSemanticManifest(manifest);
    if (plan.dynamicManifestSha256 !== manifest.manifestSha256)
      throw planError("LF_A_DRIVEN_SEARCH_PLAN_MANIFEST_MISMATCH");
  }
  return plan;
}

function validateCounterpartRetrievalArtifact(retrieval, plan) {
  if (
    retrieval?.contractId !== A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID ||
    retrieval.searchPlanSha256 !== plan.planSha256 ||
    stableStringify(retrieval.retrievalPolicy) !==
      stableStringify(plan.retrievalPolicy) ||
    !Array.isArray(retrieval.packageResults) ||
    !/^[a-f0-9]{64}$/u.test(String(retrieval.retrievalSha256 || ""))
  )
    throw planError("LF_A_DRIVEN_RETRIEVAL_ARTIFACT_INVALID");
  const { retrievalSha256, ...payload } = retrieval;
  if (
    retrievalSha256 !==
    sha256(
      `${A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    )
  )
    throw planError("LF_A_DRIVEN_RETRIEVAL_DIGEST_INVALID");
  return retrieval;
}

function materializeADrivenCounterpartSearchExecution({
  plan,
  retrieval,
} = {}) {
  validateADrivenCounterpartSearchPlan(plan);
  validateCounterpartRetrievalArtifact(retrieval, plan);
  const packageResults = retrieval.packageResults;
  if (
    plan?.contractId !== A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID ||
    !Array.isArray(plan.packages) ||
    !Array.isArray(packageResults)
  )
    throw planError("LF_A_DRIVEN_SEARCH_EXECUTION_INPUT_INVALID");
  const plannedIds = new Set(plan.packages.map(({ packageId }) => packageId));
  const indexed = new Map();
  for (const result of packageResults) {
    if (
      !plannedIds.has(result?.packageId) ||
      indexed.has(result.packageId) ||
      !Array.isArray(result.completedChannels) ||
      new Set(result.completedChannels).size !==
        result.completedChannels.length ||
      !Array.isArray(result.candidates)
    )
      throw planError("LF_A_DRIVEN_SEARCH_EXECUTION_IDS_INVALID");
    indexed.set(result.packageId, result);
  }
  if (
    indexed.size !== plan.packages.length ||
    plan.packages.some(({ packageId }) => !indexed.has(packageId))
  )
    throw planError("LF_A_DRIVEN_SEARCH_EXECUTION_MATRIX_INCOMPLETE");
  const packages = plan.packages.map((item) => {
    const result = indexed.get(item.packageId);
    if (
      result.completedChannels.some(
        (channel) => !item.searchCoverage.requiredChannels.includes(channel)
      )
    )
      throw planError("LF_A_DRIVEN_SEARCH_EXECUTION_CHANNEL_INVALID");
    const complete = item.searchCoverage.requiredChannels.every((channel) =>
      result.completedChannels.includes(channel)
    );
    return {
      ...item,
      candidates: result.candidates,
      searchCoverage: {
        ...item.searchCoverage,
        completedChannels: [...result.completedChannels].sort(),
        channelExecutionStatus: complete
          ? "CHANNELS_COMPLETE"
          : "CHANNELS_PARTIAL",
        absenceStatus: "NOT_CERTIFIED_BOUNDED_TOP_K",
        negativeConclusionEligible: false,
      },
    };
  });
  const payload = {
    schemaVersion: 2,
    contractId: A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID,
    searchPlanSha256: plan.planSha256,
    counterpartRetrievalSha256: retrieval.retrievalSha256,
    packages,
    summary: {
      plannedPackages: packages.length,
      channelsCompletePackages: packages.filter(
        ({ searchCoverage }) =>
          searchCoverage.channelExecutionStatus === "CHANNELS_COMPLETE"
      ).length,
      channelsPartialPackages: packages.filter(
        ({ searchCoverage }) =>
          searchCoverage.channelExecutionStatus === "CHANNELS_PARTIAL"
      ).length,
      absenceCertifiedPackages: 0,
      completeMatrix: packages.length === plan.summary.expectedPackages,
    },
  };
  return {
    ...payload,
    executionSha256: sha256(
      `${A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

function validateADrivenCounterpartSearchExecution(
  execution,
  { plan, retrieval } = {}
) {
  if (
    execution?.contractId !==
      A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID ||
    !Array.isArray(execution.packages) ||
    !/^[a-f0-9]{64}$/u.test(String(execution.executionSha256 || ""))
  )
    throw planError("LF_A_DRIVEN_SEARCH_EXECUTION_INVALID");
  const { executionSha256, ...payload } = execution;
  if (
    executionSha256 !==
    sha256(
      `${A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    )
  )
    throw planError("LF_A_DRIVEN_SEARCH_EXECUTION_DIGEST_INVALID");
  if (plan) {
    validateADrivenCounterpartSearchPlan(plan);
    if (execution.searchPlanSha256 !== plan.planSha256)
      throw planError("LF_A_DRIVEN_SEARCH_EXECUTION_PLAN_MISMATCH");
  }
  if (retrieval) {
    if (!plan) throw planError("LF_A_DRIVEN_SEARCH_EXECUTION_PLAN_REQUIRED");
    validateCounterpartRetrievalArtifact(retrieval, plan);
    if (execution.counterpartRetrievalSha256 !== retrieval.retrievalSha256)
      throw planError("LF_A_DRIVEN_SEARCH_EXECUTION_RETRIEVAL_MISMATCH");
  }
  return execution;
}

module.exports = {
  A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID,
  A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID,
  A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID,
  BOUNDED_RETRIEVAL_POLICY_CONTRACT_ID,
  DEFAULT_PER_CHANNEL_TOP_K,
  REQUIRED_SEARCH_CHANNELS,
  buildADrivenCounterpartSearchPlan,
  materializeADrivenCounterpartSearchExecution,
  validateADrivenCounterpartSearchExecution,
  validateADrivenCounterpartSearchPlan,
  validateCounterpartRetrievalArtifact,
};
