const crypto = require("crypto");
const {
  validateADrivenCounterpartSearchExecution,
} = require("./aDrivenCounterpartSearchPlan");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

const A_DRIVEN_COUNTERPART_DECISION_PLAN_CONTRACT_ID =
  "LF_A_DRIVEN_COUNTERPART_DECISION_PLAN_V1";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function decisionPlanError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function packagePayload(item) {
  return {
    packageId: item.packageId,
    componentId: item.componentId,
    componentType: item.componentType,
    documentUuid: item.documentUuid,
    semanticChecks: item.semanticChecks,
    candidates: item.candidates.map(
      ({ compactCandidateId, channels, sourceSpans }) => ({
        compactCandidateId,
        channels,
        sourceSpans: sourceSpans.map(
          ({
            spanId,
            physicalPageNumber,
            documentStart,
            documentEnd,
            exactText,
            exactTextSha256,
          }) => ({
            spanId,
            physicalPageNumber,
            documentStart,
            documentEnd,
            exactText,
            exactTextSha256,
          })
        ),
      })
    ),
  };
}

function deterministicNotSupported(item) {
  return {
    packageId: item.packageId,
    decision: "NOT_SUPPORTED",
    selectedCandidateIds: [],
    dimensionChecks: item.semanticChecks.map(({ checkId, dimension }) => ({
      checkId,
      dimension,
      outcome: "NOT_ESTABLISHED",
      candidateIds: [],
    })),
  };
}

function buildADrivenCounterpartDecisionPlan(
  searchExecution,
  { maximumPackages = 4, maximumCharacters = 14_000 } = {}
) {
  validateADrivenCounterpartSearchExecution(searchExecution);
  if (
    !Number.isInteger(maximumPackages) ||
    maximumPackages < 1 ||
    !Number.isInteger(maximumCharacters) ||
    maximumCharacters < 1_000
  )
    throw decisionPlanError("LF_A_DRIVEN_DECISION_PLAN_LIMITS_INVALID");
  const modelPackages = searchExecution.packages
    .filter(({ candidates }) => candidates.length > 0)
    .map(packagePayload);
  const deterministicResponses = searchExecution.packages
    .filter(({ candidates }) => candidates.length === 0)
    .map(deterministicNotSupported);
  const batches = [];
  let current = [];
  let currentCharacters = 0;
  const flush = () => {
    if (!current.length) return;
    const batchIndex = batches.length;
    const expectedPackageIds = current.map(({ packageId }) => packageId);
    batches.push({
      batchId: `ADB-${sha256(
        `${A_DRIVEN_COUNTERPART_DECISION_PLAN_CONTRACT_ID}:${searchExecution.executionSha256}:${batchIndex}:${expectedPackageIds.join(",")}`
      ).slice(0, 24)}`,
      batchIndex,
      expectedPackageIds,
      packages: current,
    });
    current = [];
    currentCharacters = 0;
  };
  for (const item of modelPackages) {
    const characters = JSON.stringify(item).length;
    if (characters > maximumCharacters)
      throw decisionPlanError("LF_A_DRIVEN_DECISION_PACKAGE_TOO_LARGE");
    if (
      current.length >= maximumPackages ||
      currentCharacters + characters > maximumCharacters
    )
      flush();
    current.push(item);
    currentCharacters += characters;
  }
  flush();
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_COUNTERPART_DECISION_PLAN_CONTRACT_ID,
    searchExecutionSha256: searchExecution.executionSha256,
    maximumPackages,
    maximumCharacters,
    batches,
    deterministicResponses,
    summary: {
      plannedPackages: searchExecution.packages.length,
      modelPackages: modelPackages.length,
      deterministicEmptyCandidatePackages: deterministicResponses.length,
      batches: batches.length,
    },
  };
  return {
    ...payload,
    planSha256: sha256(
      `${A_DRIVEN_COUNTERPART_DECISION_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

module.exports = {
  A_DRIVEN_COUNTERPART_DECISION_PLAN_CONTRACT_ID,
  buildADrivenCounterpartDecisionPlan,
};
