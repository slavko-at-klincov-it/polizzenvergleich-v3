const crypto = require("crypto");
const {
  validateADrivenCounterpartSearchExecution,
} = require("./aDrivenCounterpartSearchPlan");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

// Validates untrusted counterpart decisions against server-owned packages.
// Missing, duplicate and unknown IDs are retained as diagnostics; affected
// planned packages become UNRESOLVED instead of being guessed or repaired.
const COUNTERPART_DECISION_CONTRACT_ID = "LF_COUNTERPART_SEMANTIC_REVIEW_V2";
const DECISIONS = new Set(["SUPPORTED", "CONTRADICTED", "NOT_SUPPORTED"]);
const DIMENSIONS = new Set([
  "OBJECT",
  "PERIL_OR_CAUSE",
  "DAMAGE_OR_EFFECT",
  "COVERAGE_EFFECT",
  "SCOPE",
  "FACT_ROLE",
  "CONDITION",
  "VALUE_AND_UNIT",
  "LIMIT_BASIS",
  "DEDUCTIBLE",
  "TEMPORAL_VALIDITY",
  "DOCUMENT_ROLE",
  "PRECEDENCE_OR_REPLACEMENT",
]);
const DIMENSION_OUTCOMES = new Set(["MATCH", "MISMATCH", "NOT_ESTABLISHED"]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function contractError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function validCompactCandidate(candidate) {
  return (
    typeof candidate?.compactCandidateId === "string" &&
    candidate.compactCandidateId &&
    typeof candidate.documentUuid === "string" &&
    /^[a-f0-9]{64}$/u.test(String(candidate.documentSha256 || "")) &&
    typeof candidate.clauseBoundaryId === "string" &&
    candidate.clauseBoundaryId &&
    Array.isArray(candidate.sourceSpans) &&
    candidate.sourceSpans.length > 0 &&
    candidate.sourceSpans.every(
      ({ exactText, exactTextSha256, documentStart, documentEnd }) =>
        typeof exactText === "string" &&
        exactText &&
        sha256(exactText) === exactTextSha256 &&
        Number.isInteger(documentStart) &&
        Number.isInteger(documentEnd) &&
        documentEnd > documentStart
    )
  );
}

function normalizedUnique(values) {
  if (!Array.isArray(values)) return null;
  const normalized = values.filter(
    (value) => typeof value === "string" && value
  );
  return normalized.length === values.length &&
    new Set(normalized).size === values.length
    ? normalized
    : null;
}

function validateCounterpartDecisions({
  searchExecution,
  responses = [],
} = {}) {
  validateADrivenCounterpartSearchExecution(searchExecution);
  const packages = searchExecution.packages;
  if (!Array.isArray(packages) || packages.length === 0)
    throw contractError("LF_COUNTERPART_PACKAGES_REQUIRED");
  const packageIds = new Set();
  const candidateIdsByPackage = new Map();
  const packageContracts = new Map();
  for (const item of packages) {
    const requiredDimensions = normalizedUnique(item?.requiredDimensions);
    const requiredChannels = normalizedUnique(
      item?.searchCoverage?.requiredChannels
    );
    const completedChannels = normalizedUnique(
      item?.searchCoverage?.completedChannels
    );
    if (
      typeof item?.packageId !== "string" ||
      !item.packageId ||
      typeof item?.componentId !== "string" ||
      !item.componentId ||
      typeof item?.documentUuid !== "string" ||
      !item.documentUuid ||
      !Array.isArray(item.candidates) ||
      item.candidates.some((candidate) => !validCompactCandidate(candidate)) ||
      !requiredDimensions?.length ||
      requiredDimensions.some((dimension) => !DIMENSIONS.has(dimension)) ||
      !requiredChannels?.length ||
      !completedChannels ||
      completedChannels.some((channel) => !requiredChannels.includes(channel))
    )
      throw contractError("LF_COUNTERPART_PACKAGE_INVALID");
    if (packageIds.has(item.packageId))
      throw contractError("LF_COUNTERPART_PACKAGE_ID_DUPLICATE");
    packageIds.add(item.packageId);
    const candidateIds = item.candidates.map(
      ({ compactCandidateId }) => compactCandidateId
    );
    if (
      candidateIds.some((id) => typeof id !== "string" || !id) ||
      new Set(candidateIds).size !== candidateIds.length
    )
      throw contractError("LF_COUNTERPART_PACKAGE_CANDIDATES_INVALID");
    candidateIdsByPackage.set(item.packageId, new Set(candidateIds));
    packageContracts.set(item.packageId, {
      requiredDimensions,
      negativeConclusionEligible:
        item.searchCoverage.absenceStatus === "CERTIFIED_COMPLETE_ABSENCE" &&
        item.searchCoverage.negativeConclusionEligible === true,
    });
  }

  const responsesByPackage = new Map();
  const diagnostics = [];
  for (const [responseIndex, response] of responses.entries()) {
    if (!packageIds.has(response?.packageId)) {
      diagnostics.push({
        code: "UNKNOWN_PACKAGE_ID",
        packageId: response?.packageId || null,
        responseIndex,
      });
      continue;
    }
    const list = responsesByPackage.get(response.packageId) || [];
    list.push(response);
    responsesByPackage.set(response.packageId, list);
  }

  const results = packages.map((item) => {
    const records = responsesByPackage.get(item.packageId) || [];
    if (records.length !== 1) {
      const code = records.length
        ? "DUPLICATE_PACKAGE_RESPONSE"
        : "MISSING_PACKAGE_RESPONSE";
      diagnostics.push({ code, packageId: item.packageId });
      return {
        packageId: item.packageId,
        componentId: item.componentId,
        documentUuid: item.documentUuid,
        status: "UNRESOLVED",
        decision: null,
        selectedCandidateIds: [],
        reasonCode: code,
        decisionScope: null,
        absenceConclusion: false,
      };
    }
    const response = records[0];
    const decision = response.decision;
    const selected = Array.isArray(response.selectedCandidateIds)
      ? response.selectedCandidateIds
      : [];
    const allowed = candidateIdsByPackage.get(item.packageId);
    const packageContract = packageContracts.get(item.packageId);
    const checks = Array.isArray(response.dimensionChecks)
      ? response.dimensionChecks
      : [];
    const checkDimensions = checks.map(({ dimension }) => dimension);
    const dimensionChecksValid =
      checks.length === packageContract.requiredDimensions.length &&
      new Set(checkDimensions).size === checks.length &&
      packageContract.requiredDimensions.every((dimension) =>
        checkDimensions.includes(dimension)
      ) &&
      checks.every(
        ({ dimension, outcome }) =>
          DIMENSIONS.has(dimension) && DIMENSION_OUTCOMES.has(outcome)
      );
    const outcomes = checks.map(({ outcome }) => outcome);
    const invalid =
      !DECISIONS.has(decision) ||
      !dimensionChecksValid ||
      new Set(selected).size !== selected.length ||
      selected.some((candidateId) => !allowed.has(candidateId)) ||
      (decision === "SUPPORTED" &&
        (selected.length === 0 ||
          outcomes.some((outcome) => outcome !== "MATCH"))) ||
      (decision === "CONTRADICTED" &&
        (selected.length === 0 ||
          !outcomes.includes("MISMATCH") ||
          outcomes.includes("NOT_ESTABLISHED"))) ||
      (decision === "NOT_SUPPORTED" && selected.length !== 0);
    if (invalid) {
      diagnostics.push({
        code: "INVALID_PACKAGE_DECISION",
        packageId: item.packageId,
      });
      return {
        packageId: item.packageId,
        componentId: item.componentId,
        documentUuid: item.documentUuid,
        status: "UNRESOLVED",
        decision: null,
        selectedCandidateIds: [],
        reasonCode: "INVALID_PACKAGE_DECISION",
        decisionScope: null,
        absenceConclusion: false,
      };
    }
    return {
      packageId: item.packageId,
      componentId: item.componentId,
      documentUuid: item.documentUuid,
      status: "TERMINAL",
      decision,
      selectedCandidateIds: selected,
      dimensionChecks: checks,
      reasonCode: null,
      decisionScope:
        decision === "NOT_SUPPORTED"
          ? "RETRIEVED_CANDIDATES_ONLY"
          : "SELECTED_SERVER_CANDIDATES",
      absenceConclusion:
        decision === "NOT_SUPPORTED" &&
        packageContract.negativeConclusionEligible,
    };
  });
  const payload = {
    schemaVersion: 3,
    contractId: COUNTERPART_DECISION_CONTRACT_ID,
    searchExecutionSha256: searchExecution.executionSha256,
    results,
    diagnostics,
    summary: {
      plannedPackages: packages.length,
      terminalPackages: results.filter(({ status }) => status === "TERMINAL")
        .length,
      unresolvedPackages: results.filter(
        ({ status }) => status === "UNRESOLVED"
      ).length,
    },
  };
  return {
    ...payload,
    decisionSha256: sha256(
      `${COUNTERPART_DECISION_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

function validateCounterpartDecisionArtifact(decisions, searchExecution) {
  if (
    decisions?.contractId !== COUNTERPART_DECISION_CONTRACT_ID ||
    decisions.searchExecutionSha256 !== searchExecution?.executionSha256 ||
    !Array.isArray(decisions.results) ||
    !/^[a-f0-9]{64}$/u.test(String(decisions.decisionSha256 || ""))
  )
    throw contractError("LF_COUNTERPART_DECISION_ARTIFACT_INVALID");
  validateADrivenCounterpartSearchExecution(searchExecution);
  const { decisionSha256, ...payload } = decisions;
  if (
    decisionSha256 !==
    sha256(
      `${COUNTERPART_DECISION_CONTRACT_ID}\u0000${stableStringify(payload)}`
    )
  )
    throw contractError("LF_COUNTERPART_DECISION_DIGEST_INVALID");
  return decisions;
}

module.exports = {
  COUNTERPART_DECISION_CONTRACT_ID,
  validateCounterpartDecisionArtifact,
  validateCounterpartDecisions,
};
