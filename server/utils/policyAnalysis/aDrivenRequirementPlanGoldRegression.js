const crypto = require("crypto");
const { buildADrivenGoldRegression } = require("./aDrivenGoldRegression");
const {
  buildADrivenRequirementDecisionPlan,
} = require("./aDrivenRequirementCounterpartDecision");
const { validateADrivenCompleteBCorpus } = require("./aDrivenCompleteBCorpus");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

// QA-only measurement of whether the dynamic retrieval and its bounded model
// navigation set contain the frozen sources for the known LF 1+9 fixture.
// Gold never creates a production row or changes candidate ranking here.
const A_DRIVEN_REQUIREMENT_PLAN_GOLD_REGRESSION_CONTRACT_ID =
  "LF_A_DRIVEN_REQUIREMENT_PLAN_GOLD_REGRESSION_V3";

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

function sourceTextMatches(source, candidate, expectedNormalized) {
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
  const expected = expectedNormalized || normalizedText(source.exactText);
  const observed =
    candidate.normalizedExactText || normalizedText(candidate.exactText);
  return (
    expected.length >= 24 &&
    (observed.includes(expected) || expected.includes(observed))
  );
}

function normalizedFileIdentity(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\.[^.]+$/u, "")
    .toLocaleLowerCase("de-AT")
    .replace(/[^\p{L}\p{N}]+/gu, "");
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
  const records = gold.sourceDocuments.map((document) => {
    if (
      typeof document.originalName !== "string" ||
      !document.originalName ||
      typeof document.fingerprint !== "string"
    )
      throw regressionError("LF_A_DRIVEN_REQUIREMENT_GOLD_DOCUMENTS_INVALID");
    const target = planByFingerprint.get(document.fingerprint);
    if (!target)
      throw regressionError(
        "LF_A_DRIVEN_REQUIREMENT_GOLD_DOCUMENT_NOT_IN_SEARCH_PLAN"
      );
    return {
      goldOriginalName: document.originalName,
      normalizedGoldName: normalizedFileIdentity(document.originalName),
      goldFingerprint: document.fingerprint,
      documentUuid: target.documentUuid,
      documentSha256: target.documentSha256,
      documentPosition: target.documentPosition,
    };
  });
  if (
    new Set(records.map(({ documentUuid }) => documentUuid)).size !==
    records.length
  )
    throw regressionError("LF_A_DRIVEN_REQUIREMENT_GOLD_DOCUMENTS_AMBIGUOUS");
  const sourceFiles = [
    ...new Set(
      gold.rows.flatMap((row) =>
        (row.goldDecision?.sources || []).map(({ file }) => file)
      )
    ),
  ];
  if (
    sourceFiles.some((file) => typeof file !== "string" || !file) ||
    sourceFiles.length !== records.length
  )
    throw regressionError("LF_A_DRIVEN_REQUIREMENT_GOLD_SOURCE_FILES_INVALID");
  const bySourceFile = new Map();
  const usedDocuments = new Set();
  const unresolvedFiles = [];
  for (const file of sourceFiles) {
    const normalizedFile = normalizedFileIdentity(file);
    const matches = records.filter(
      ({ goldOriginalName, normalizedGoldName }) =>
        goldOriginalName === file ||
        normalizedGoldName === normalizedFile ||
        (normalizedGoldName.length >= 8 &&
          normalizedFile.length >= 8 &&
          (normalizedGoldName.includes(normalizedFile) ||
            normalizedFile.includes(normalizedGoldName)))
    );
    if (matches.length > 1)
      throw regressionError(
        "LF_A_DRIVEN_REQUIREMENT_GOLD_SOURCE_FILE_AMBIGUOUS"
      );
    if (matches.length === 0) {
      unresolvedFiles.push(file);
      continue;
    }
    const [binding] = matches;
    if (usedDocuments.has(binding.documentUuid))
      throw regressionError(
        "LF_A_DRIVEN_REQUIREMENT_GOLD_SOURCE_FILE_AMBIGUOUS"
      );
    usedDocuments.add(binding.documentUuid);
    bySourceFile.set(file, binding);
  }
  const unusedDocuments = records.filter(
    ({ documentUuid }) => !usedDocuments.has(documentUuid)
  );
  if (
    unresolvedFiles.length !== unusedDocuments.length ||
    unresolvedFiles.length > 1
  )
    throw regressionError("LF_A_DRIVEN_REQUIREMENT_GOLD_SOURCE_FILE_UNMAPPED");
  if (unresolvedFiles.length === 1)
    bySourceFile.set(unresolvedFiles[0], unusedDocuments[0]);
  return bySourceFile;
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
          normalizedExactText: normalizedText(span.exactText),
        });
    result.set(item.requirementId, candidates);
  }
  return result;
}

function matchingCandidates(source, binding, candidates) {
  const expectedNormalized = normalizedText(source.exactText);
  return candidates.filter(
    (candidate) =>
      candidate.documentSha256 === binding.documentSha256 &&
      sourceTextMatches(source, candidate, expectedNormalized)
  );
}

function uniqueCorpusCandidates(fullByRequirement) {
  const unique = new Map();
  for (const candidates of fullByRequirement.values())
    for (const candidate of candidates) {
      const key = `${candidate.documentSha256}:${candidate.exactTextSha256}`;
      if (!unique.has(key)) unique.set(key, candidate);
    }
  return [...unique.values()];
}

function projectedMatches(candidates) {
  const unique = new Map();
  for (const candidate of candidates) {
    const key = [
      candidate.documentUuid,
      candidate.physicalPageNumber,
      candidate.exactTextSha256,
    ].join(":");
    if (!unique.has(key))
      unique.set(key, {
        candidateId: candidate.candidateId,
        documentUuid: candidate.documentUuid,
        physicalPageNumber: candidate.physicalPageNumber,
        exactTextSha256: candidate.exactTextSha256,
      });
  }
  return [...unique.values()].sort((left, right) =>
    `${left.documentUuid}:${left.physicalPageNumber}:${left.exactTextSha256}`.localeCompare(
      `${right.documentUuid}:${right.physicalPageNumber}:${right.exactTextSha256}`
    )
  );
}

function bindingRecord(
  source,
  binding,
  retrievalCorpusCandidates,
  completeCorpusCandidates,
  fullCandidates,
  selectedCandidates
) {
  if (!binding)
    return {
      referenceId: source.referenceId,
      exactTextSha256: source.exactTextSha256,
      status: "GOLD_DOCUMENT_UNMAPPED",
      retrievalCorpusMatches: [],
      completeCorpusMatches: [],
      fullRetrievalMatches: [],
      selectedCandidateMatches: [],
    };
  const retrievalCorpusMatches = matchingCandidates(
    source,
    binding,
    retrievalCorpusCandidates
  );
  const completeCorpusMatches = matchingCandidates(
    source,
    binding,
    completeCorpusCandidates
  );
  const fullMatches = matchingCandidates(source, binding, fullCandidates);
  const selectedMatches = matchingCandidates(
    source,
    binding,
    selectedCandidates
  );
  return {
    referenceId: source.referenceId,
    exactTextSha256: source.exactTextSha256,
    documentUuid: binding.documentUuid,
    documentPosition: binding.documentPosition,
    status: selectedMatches.length
      ? "SELECTED_BOUND"
      : fullMatches.length
        ? "FULL_RETRIEVAL_ONLY"
        : retrievalCorpusMatches.length
          ? "RETRIEVAL_CORPUS_ONLY"
          : completeCorpusMatches.length
            ? "COMPLETE_B_CORPUS_ONLY"
            : "NOT_IN_COMPLETE_B_CORPUS",
    retrievalCorpusMatches: projectedMatches(retrievalCorpusMatches),
    completeCorpusMatches: projectedMatches(completeCorpusMatches),
    fullRetrievalMatches: projectedMatches(fullMatches),
    selectedCandidateMatches: projectedMatches(selectedMatches),
  };
}

function scopeName(requirementId, gold) {
  if (
    gold.adjudicationScope?.explicitlyAdjudicatedRows?.includes(requirementId)
  )
    return "EXPLICIT_76";
  if (
    gold.adjudicationScope?.automaticallyAcceptedRows?.includes(requirementId)
  )
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
          positiveRowsFullyInCompleteCorpus: found.filter(
            ({ allGoldSourcesInCompleteCorpus }) =>
              allGoldSourcesInCompleteCorpus
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
    retrievalCorpusBoundGoldSources: sources.filter(({ status }) =>
      [
        "SELECTED_BOUND",
        "FULL_RETRIEVAL_ONLY",
        "RETRIEVAL_CORPUS_ONLY",
      ].includes(status)
    ).length,
    completeBCorpusBoundGoldSources: sources.filter(
      ({ status }) =>
        status !== "NOT_IN_COMPLETE_B_CORPUS" &&
        status !== "GOLD_DOCUMENT_UNMAPPED"
    ).length,
    fullRetrievalBoundGoldSources: sources.filter(
      ({ status }) =>
        status === "SELECTED_BOUND" || status === "FULL_RETRIEVAL_ONLY"
    ).length,
    selectedBoundGoldSources: sources.filter(
      ({ status }) => status === "SELECTED_BOUND"
    ).length,
    positiveRowsWithAnySourceRetrieved: positive.filter(
      ({ anyGoldSourceInFullRetrieval }) => anyGoldSourceInFullRetrieval
    ).length,
    positiveRowsWithAnySourceInRetrievalCorpus: positive.filter(
      ({ anyGoldSourceInRetrievalCorpus }) => anyGoldSourceInRetrievalCorpus
    ).length,
    positiveRowsWithAllSourcesInRetrievalCorpus: positive.filter(
      ({ allGoldSourcesInRetrievalCorpus }) => allGoldSourcesInRetrievalCorpus
    ).length,
    positiveRowsWithAnySourceInCompleteCorpus: positive.filter(
      ({ anyGoldSourceInCompleteCorpus }) => anyGoldSourceInCompleteCorpus
    ).length,
    positiveRowsWithAllSourcesInCompleteCorpus: positive.filter(
      ({ allGoldSourcesInCompleteCorpus }) => allGoldSourcesInCompleteCorpus
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
  completeCorpus = null,
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
  const retrievalCorpusCandidates = uniqueCorpusCandidates(fullByRequirement);
  if (completeCorpus)
    validateADrivenCompleteBCorpus(completeCorpus, { searchPlan });
  const completeCorpusCandidates = completeCorpus
    ? completeCorpus.clauses.map((clause) => ({
        candidateId: clause.clauseBoundaryId,
        documentUuid: clause.documentUuid,
        documentSha256: clause.documentSha256,
        physicalPageNumber: clause.physicalPageNumber,
        exactText: clause.exactText,
        exactTextSha256: clause.exactTextSha256,
        normalizedExactText: normalizedText(clause.exactText),
      }))
    : retrievalCorpusCandidates;
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
        retrievalCorpusCandidates,
        completeCorpusCandidates,
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
      anyGoldSourceInRetrievalCorpus: sourceStatuses.some((status) =>
        [
          "SELECTED_BOUND",
          "FULL_RETRIEVAL_ONLY",
          "RETRIEVAL_CORPUS_ONLY",
        ].includes(status)
      ),
      allGoldSourcesInRetrievalCorpus:
        sourceStatuses.length > 0 &&
        sourceStatuses.every((status) =>
          [
            "SELECTED_BOUND",
            "FULL_RETRIEVAL_ONLY",
            "RETRIEVAL_CORPUS_ONLY",
          ].includes(status)
        ),
      anyGoldSourceInCompleteCorpus: sourceStatuses.some(
        (status) =>
          status !== "NOT_IN_COMPLETE_B_CORPUS" &&
          status !== "GOLD_DOCUMENT_UNMAPPED"
      ),
      allGoldSourcesInCompleteCorpus:
        sourceStatuses.length > 0 &&
        sourceStatuses.every(
          (status) =>
            status !== "NOT_IN_COMPLETE_B_CORPUS" &&
            status !== "GOLD_DOCUMENT_UNMAPPED"
        ),
      anyGoldSourceInFullRetrieval: sourceStatuses.some(
        (status) =>
          status === "SELECTED_BOUND" || status === "FULL_RETRIEVAL_ONLY"
      ),
      allGoldSourcesInFullRetrieval:
        sourceStatuses.length > 0 &&
        sourceStatuses.every(
          (status) =>
            status === "SELECTED_BOUND" || status === "FULL_RETRIEVAL_ONLY"
        ),
      anyGoldSourceSelected: sourceStatuses.includes("SELECTED_BOUND"),
      allGoldSourcesSelected:
        sourceStatuses.length > 0 &&
        sourceStatuses.every((status) => status === "SELECTED_BOUND"),
    };
  });
  const payload = {
    schemaVersion: 3,
    contractId: A_DRIVEN_REQUIREMENT_PLAN_GOLD_REGRESSION_CONTRACT_ID,
    qaOnly: true,
    productionRule: false,
    releaseApproval: false,
    generalizationProof: false,
    goldSha256: gold.goldSha256,
    dynamicManifestSha256: manifest.manifestSha256,
    searchPlanSha256: searchPlan.planSha256,
    searchExecutionSha256: searchExecution.executionSha256,
    completeBCorpusSha256: completeCorpus?.corpusSha256 || null,
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
