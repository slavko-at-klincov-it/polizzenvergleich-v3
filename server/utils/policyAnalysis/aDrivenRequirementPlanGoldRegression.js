const crypto = require("crypto");
const {
  buildADrivenGoldRegression,
} = require("./aDrivenGoldRegression");
const {
  buildADrivenRequirementDecisionPlan,
} = require("./aDrivenRequirementCounterpartDecision");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

// QA-only measurement of whether the dynamic retrieval and its bounded model
// navigation set contain the frozen sources for the known LF 1+9 fixture.
// Gold never creates a production row or changes candidate ranking here.
const A_DRIVEN_REQUIREMENT_PLAN_GOLD_REGRESSION_CONTRACT_ID =
  "LF_A_DRIVEN_REQUIREMENT_PLAN_GOLD_REGRESSION_V1";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function regressionError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("de-AT")
    .replace(/[^\p{L}\p{N}%€]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function sourceTextMatches(source, candidate) {
  if (
    typeof source?.exactText !== "string" ||
    !source.exactText ||
    sha256(source.exactText) !== source.exactTextSha256 ||
    typeof candidate?.exactText !== "string" ||
    !candidate.exactText ||
    sha256(candidate.exactText) !== candidate.exactTextSha256
  )
    return false;
  if (source.exactTextSha256 === candidate.exactTextSha256) return true;
  const expected = normalizedText(source.exactText);
  const observed = normalizedText(candidate.exactText);
  return (
    expected.length >= 24 &&
    (observed.includes(expected) || expected.includes(observed))
  );
}

function goldDocumentBindings(gold, searchPlan) {
  if (
    !Array.isArray(gold?.sourceDocuments) ||
    gold.sourceDocuments.length !== searchPlan.documents.length
  )
    throw regressionError("LF_A_DRIVEN_REQUIREMENT_GOLD_DOCUMENTS_INVALID");
  const planByFingerprint = new Map();
  for (const document of searchPlan.documents) {
    if (
      typeof document.documentSha256 !== "string" ||
      planByFingerprint.has(document.documentSha256)
    )
      throw regressionError("LF_A_DRIVEN_REQUIREMENT_PLAN_DOCUMENTS_INVALID");
    planByFingerprint.set(document.documentSha256, document);
  }
  const byGoldName = new Map();
  const records = gold.sourceDocuments.map((document) => {
    if (
      typeof document.originalName !== "string" ||
      !document.originalName ||
      typeof document.fingerprint !== "string" ||
      byGoldName.has(document.originalName)
    )
      throw regressionError("LF_A_DRIVEN_REQUIREMENT_GOLD_DOCUMENTS_INVALID");
    const target = planByFingerprint.get(document.fingerprint);
    if (!target)
      throw regressionError(
        "LF_A_DRIVEN_REQUIREMENT_GOLD_DOCUMENT_NOT_IN_SEARCH_PLAN"
      );
    const binding = {
      goldFingerprint: document.fingerprint,
      documentUuid: target.documentUuid,
      documentSha256: target.documentSha256,
      documentPosition: target.documentPosition,
    };
    byGoldName.set(document.originalName, binding);
    return binding;
  });
  if (new Set(records.map(({ documentUuid }) => documentUuid)).size !== records.length)
    throw regressionError("LF_A_DRIVEN_REQUIREMENT_GOLD_DOCUMENTS_AMBIGUOUS");
  return byGoldName;
}

function fullCandidatesByRequirement(searchExecution) {
  const result = new Map();
  for (const item of searchExecution.packages) {
    const candidates = result.get(item.requirementId) || [];
    for (const candidate of item.candidates)
      for (const span of candidate.sourceSpans)
        candidates.push({
          candidateId: candidate.compactCandidateId,
          documentUuid: item.documentUuid,
          documentSha256: item.documentSha256,
          physicalPageNumber: span.physicalPageNumber,
          exactText: span.exactText,
          exactTextSha256: span.exactTextSha256,
        });
    result.set(item.requirementId, candidates);
  }
  return result;
}

function matchingCandidates(source, binding, candidates) {
  return candidates.filter(
    (candidate) =>
      candidate.documentSha256 === binding.documentSha256 &&
      sourceTextMatches(source, candidate)
  );
}

function bindingRecord(source, binding, fullCandidates, selectedCandidates) {
  if (!binding)
    return {
      referenceId: source.referenceId,
      exactTextSha256: source.exactTextSha256,
      status: "GOLD_DOCUMENT_UNMAPPED",
      fullRetrievalMatches: [],
      selectedCandidateMatches: [],
    };
  const fullMatches = matchingCandidates(source, binding, fullCandidates);
  const selectedMatches = matchingCandidates(
    source,
    binding,
    selectedCandidates
  );
  const project = (candidate) => ({
    candidateId: candidate.candidateId,
    documentUuid: candidate.documentUuid,
    physicalPageNumber: candidate.physicalPageNumber,
    exactTextSha256: candidate.exactTextSha256,
  });
  return {
    referenceId: source.referenceId,
    exactTextSha256: source.exactTextSha256,
    documentUuid: binding.documentUuid,
    documentPosition: binding.documentPosition,
    status: selectedMatches.length
      ? "SELECTED_BOUND"
      : fullMatches.length
        ? "FULL_RETRIEVAL_ONLY"
        : "NOT_RETRIEVED",
    fullRetrievalMatches: fullMatches.map(project),
    selectedCandidateMatches: selectedMatches.map(project),
  };
}

function scopeName(requirementId, gold) {
  if (gold.adjudicationScope?.explicitlyAdjudicatedRows?.includes(requirementId))
    return "EXPLICIT_76";
  if (gold.adjudicationScope?.automaticallyAcceptedRows?.includes(requirementId))
    return "AUTOMATIC_207";
  return "UNCLASSIFIED";
}

function summarize(records) {
  const positive = records.filter(({ goldCustomerFound }) => goldCustomerFound);
  const sources = records.flatMap(({ sourceBindings }) => sourceBindings);
  const scopes = Object.fromEntries(
    ["EXPLICIT_76", "AUTOMATIC_207", "UNCLASSIFIED"].map((scope) => {
      const rows = records.filter((record) => record.scope === scope);
      const found = rows.filter(({ goldCustomerFound }) => goldCustomerFound);
      return [
        scope,
        {
          rows: rows.length,
          positiveRows: found.length,
          positiveRowsFullyRetrieved: found.filter(
            ({ allGoldSourcesInFullRetrieval }) => allGoldSourcesInFullRetrieval
          ).length,
          positiveRowsFullySelected: found.filter(
            ({ allGoldSourcesSelected }) => allGoldSourcesSelected
          ).length,
        },
      ];
    })
  );
  return {
    rows: records.length,
    positiveRows: positive.length,
    negativeRows: records.length - positive.length,
    goldSources: sources.length,
    fullRetrievalBoundGoldSources: sources.filter(
      ({ status }) => status !== "NOT_RETRIEVED" && status !== "GOLD_DOCUMENT_UNMAPPED"
    ).length,
    selectedBoundGoldSources: sources.filter(
      ({ status }) => status === "SELECTED_BOUND"
    ).length,
    positiveRowsWithAnySourceRetrieved: positive.filter(
      ({ anyGoldSourceInFullRetrieval }) => anyGoldSourceInFullRetrieval
    ).length,
    positiveRowsWithAllSourcesRetrieved: positive.filter(
      ({ allGoldSourcesInFullRetrieval }) => allGoldSourcesInFullRetrieval
    ).length,
    positiveRowsWithAnySourceSelected: positive.filter(
      ({ anyGoldSourceSelected }) => anyGoldSourceSelected
    ).length,
    positiveRowsWithAllSourcesSelected: positive.filter(
      ({ allGoldSourcesSelected }) => allGoldSourcesSelected
    ).length,
    scopes,
  };
}

function buildADrivenRequirementPlanGoldRegression({
  manifest,
  gold,
  expectedGoldSha256,
  searchPlan,
  searchExecution,
  maximumCandidatesPerComponent = 4,
  maximumRequirementsPerBatch = 4,
  maximumBatchCharacters = 120_000,
} = {}) {
  const crosswalk = buildADrivenGoldRegression({
    manifest,
    gold,
    expectedGoldSha256,
  }).crosswalk;
  const decisionPlan = buildADrivenRequirementDecisionPlan({
    manifest,
    searchPlan,
    searchExecution,
    maximumCandidatesPerComponent,
    maximumRequirementsPerBatch,
    maximumBatchCharacters,
  });
  const documentsByGoldName = goldDocumentBindings(gold, searchPlan);
  const fullByRequirement = fullCandidatesByRequirement(searchExecution);
  const selectedByRequirement = new Map(
    decisionPlan.rows.map((row) => [row.requirementId, row.candidates])
  );
  const crosswalkById = new Map(
    crosswalk.records.map((record) => [record.legacyRequirementId, record])
  );
  const records = gold.rows.map((row) => {
    const mapping = crosswalkById.get(row.requirementId);
    const dynamicRequirementIds = mapping.dynamicRequirementIds;
    const fullCandidates = dynamicRequirementIds.flatMap(
      (requirementId) => fullByRequirement.get(requirementId) || []
    );
    const selectedCandidates = dynamicRequirementIds.flatMap(
      (requirementId) => selectedByRequirement.get(requirementId) || []
    );
    const sourceBindings = (row.goldDecision.sources || []).map((source) =>
      bindingRecord(
        source,
        documentsByGoldName.get(source.file),
        fullCandidates,
        selectedCandidates
      )
    );
    const sourceStatuses = sourceBindings.map(({ status }) => status);
    return {
      legacyRequirementId: row.requirementId,
      dynamicRequirementIds,
      scope: scopeName(row.requirementId, gold),
      goldCustomerFound: row.goldDecision.customerFound === true,
      goldOutcome: row.goldDecision.outcome,
      sourceBindings,
      anyGoldSourceInFullRetrieval: sourceStatuses.some(
        (status) => status === "SELECTED_BOUND" || status === "FULL_RETRIEVAL_ONLY"
      ),
      allGoldSourcesInFullRetrieval:
        sourceStatuses.length > 0 &&
        sourceStatuses.every(
          (status) => status === "SELECTED_BOUND" || status === "FULL_RETRIEVAL_ONLY"
        ),
      anyGoldSourceSelected: sourceStatuses.includes("SELECTED_BOUND"),
      allGoldSourcesSelected:
        sourceStatuses.length > 0 &&
        sourceStatuses.every((status) => status === "SELECTED_BOUND"),
    };
  });
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_REQUIREMENT_PLAN_GOLD_REGRESSION_CONTRACT_ID,
    qaOnly: true,
    productionRule: false,
    releaseApproval: false,
    generalizationProof: false,
    goldSha256: gold.goldSha256,
    dynamicManifestSha256: manifest.manifestSha256,
    searchPlanSha256: searchPlan.planSha256,
    searchExecutionSha256: searchExecution.executionSha256,
    decisionPlanSha256: decisionPlan.planSha256,
    selection: decisionPlan.selection,
    records,
    summary: summarize(records),
    proofLimit:
      "QA-Regression gegen das bekannte LF-1+9-Gold. Gold misst nur, ob dynamisch ermittelte Retrieval- und Navigationskandidaten die eingefrorenen Quellen enthalten; Gold erzeugt oder priorisiert keine Produktionszeilen.",
  };
  return {
    ...payload,
    regressionSha256: sha256(
      `${A_DRIVEN_REQUIREMENT_PLAN_GOLD_REGRESSION_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

module.exports = {
  A_DRIVEN_REQUIREMENT_PLAN_GOLD_REGRESSION_CONTRACT_ID,
  buildADrivenRequirementPlanGoldRegression,
  sourceTextMatches,
};
