const crypto = require("crypto");
const {
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
  buildADrivenSemanticManifest,
  validateADrivenSemanticManifest,
} = require("./aDrivenSemanticManifest");
const { stableStringify } = require("./aDrivenSourceUnitPlan");
const {
  classificationBatch,
  deriveClassificationEvidencePlan,
  prompt,
  validateBatchResponses,
} = require("../../scripts/qa/runADrivenReferenceClassification.cjs");

// QA-only. This module cannot mutate production results or authorize B routing.
const REVIEW_BASIS_CONTRACT_ID = "LF_A_V12_283_631_REVIEW_BASIS_V1";
const REVIEW_CAMPAIGN_PROFILE_CONTRACT_ID =
  "LF_A_283_631_REVIEW_CAMPAIGN_PROFILE_V1";
const CLASSIFICATION_EVIDENCE_CONTRACT_ID =
  "LF_A_V12_CLASSIFICATION_EVIDENCE_PACKET_V1";
const CLASSIFICATION_CHAIN_CONTRACT_ID =
  "LF_A_V12_CLASSIFICATION_CHAIN_VALIDATION_V1";
const RUN_PROVENANCE_CONTRACT_ID = "LF_A_V12_REVIEW_RUN_PROVENANCE_V1";
const REVIEWER_REGISTRY_CONTRACT_ID =
  "LF_A_V12_283_631_HUMAN_REVIEWER_REGISTRY_V1";
const CROSSWALK_DRAFT_CONTRACT_ID = "LF_A_V12_283_631_CROSSWALK_DRAFT_V1";
const REVIEW_INPUT_CONTRACT_ID = "LF_A_V12_283_631_REVIEW_INPUT_V1";
const REVIEW_ARTIFACT_CONTRACT_ID = "LF_A_V12_283_631_REVIEW_V1";
const APPROVED_CROSSWALK_CONTRACT_ID = "LF_A_V12_283_631_APPROVED_CROSSWALK_V1";
const EXPECTED_LEGACY_REQUIREMENTS = 283;
const EXPECTED_LEGACY_COMPONENTS = 631;
const REVIEW_SLOTS = new Set(["A", "B"]);
const COVERED_RELATIONS = new Set([
  "EQUIVALENT",
  "REPHRASED_EQUIVALENT",
  "MOVED_EQUIVALENT",
  "SPLIT_INTO_DYNAMIC",
  "MERGED_INTO_DYNAMIC",
]);
const REVIEW_RELATIONS = new Set([
  ...COVERED_RELATIONS,
  "MISSING",
  "AMBIGUOUS",
]);
const ROOT_CAUSE_DISPOSITIONS = new Set([
  "NO_UPSTREAM_DEFECT",
  "DYNAMIC_CLASSIFICATION_ERROR",
  "ROLE_MAPPING_TOO_NARROW",
  "SPLIT_OR_MERGE_RELATION",
  "DYNAMIC_COMPONENT_MISSING",
  "UNDETERMINED",
]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function domainDigest(contractId, payload) {
  return sha256(`${contractId}\u0000${stableStringify(payload)}`);
}

const CURRENT_V12_REVIEW_PROFILE_PAYLOAD = {
  schemaVersion: 1,
  contractId: REVIEW_CAMPAIGN_PROFILE_CONTRACT_ID,
  profileId: "LF_A_V12_FINAL_364_755_WITH_V374_LEGACY_283_631",
  dynamicManifestSha256:
    "5fcb889c0352f3808afeffda9f6801d987b61e0cccb18899c97ba90d0eacab6a",
  dynamicManifestFileSha256:
    "d39ff07f4cfa1137a62c1fd340cc31bfbc4f807a1e550375a24fc6f9adcc5d33",
  dynamicRequirements: 364,
  dynamicComponents: 755,
  legacyManifestSha256:
    "3697afe4a18760bd893d50e0c3f8dadf48ff0106447829d32f1cb7845011efb0",
  legacyManifestFileSha256:
    "c8e4c7cb303879d0efb35eb8215be6b6b75a75332e8a1b892c5f1bc85d6be4c7",
  legacyRequirements: EXPECTED_LEGACY_REQUIREMENTS,
  legacyComponents: EXPECTED_LEGACY_COMPONENTS,
  implementationCommitSha: "9836216b9db6fc0b83bc65177f69f9fa6a938acc",
  manifestCompletionCommitSha: "bd051b23f1facb15943ca0de5312e387aa2dd10a",
  releaseId: "e8e9e94862acf1e48a7f8110382af084e5d37439",
  runSignature:
    "df7d7179-1c49-412b-b2ff-0ec6b1fdc52f/resume-eb1202f45007d9995ddd60a9",
  productRunContractId: "LF_REFERENCE_A_DRIVEN_V2",
  classificationRunContractId: "LF_A_BOUNDED_CLASSIFICATION_RUN_V12",
  promptContractId: "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V14",
  modelId: "qwen/qwen3.6-35b-a3b",
  modelContext: 42496,
  maximumAttempts: 8,
  requestTimeoutMs: 180000,
  abortSettlementTimeoutMs: 15000,
  modelRecoveryTimeoutMs: 180000,
  qwenModelKey: "qwen3.6-35b-a3b-mlx-text",
  transportContractId: "LF_A_CLASSIFICATION_TRANSPORT_V1",
  classificationBatches: 59,
  classificationResponses: 349,
};
const CURRENT_V12_REVIEW_PROFILE = Object.freeze({
  ...CURRENT_V12_REVIEW_PROFILE_PAYLOAD,
  profileSha256: domainDigest(
    REVIEW_CAMPAIGN_PROFILE_CONTRACT_ID,
    CURRENT_V12_REVIEW_PROFILE_PAYLOAD
  ),
});

function reviewError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validSha(value) {
  return /^[a-f0-9]{64}$/u.test(String(value || ""));
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return null;
  const result = values.map(text);
  return result.some((value) => !value) ||
    new Set(result).size !== result.length
    ? null
    : result;
}

function withoutField(value, field) {
  const { [field]: _ignored, ...payload } = value;
  return payload;
}

function validateDigest(value, contractId, field, code) {
  if (
    value?.contractId !== contractId ||
    !validSha(value?.[field]) ||
    value[field] !== domainDigest(contractId, withoutField(value, field))
  )
    throw reviewError(code);
  return value;
}

function validateReviewCampaignProfile(profile) {
  validateDigest(
    profile,
    REVIEW_CAMPAIGN_PROFILE_CONTRACT_ID,
    "profileSha256",
    "LF_A_DOUBLE_REVIEW_PROFILE_DIGEST_INVALID"
  );
  if (
    stableStringify(profile) !== stableStringify(CURRENT_V12_REVIEW_PROFILE) ||
    !text(profile.profileId) ||
    !validSha(profile.dynamicManifestSha256) ||
    !validSha(profile.dynamicManifestFileSha256) ||
    !validSha(profile.legacyManifestSha256) ||
    !validSha(profile.legacyManifestFileSha256) ||
    !Number.isInteger(profile.dynamicRequirements) ||
    !Number.isInteger(profile.dynamicComponents) ||
    profile.legacyRequirements !== EXPECTED_LEGACY_REQUIREMENTS ||
    profile.legacyComponents !== EXPECTED_LEGACY_COMPONENTS
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_PROFILE_INVALID");
  return profile;
}

function validateClassificationChain({
  sourcePlan,
  batchPlan,
  batchResults,
  responses,
  summary,
  dynamicManifest,
} = {}) {
  if (
    !sourcePlan ||
    !validSha(sourcePlan.planSha256) ||
    batchPlan?.sourceUnitPlanSha256 !== sourcePlan.planSha256 ||
    !Array.isArray(batchPlan?.batches) ||
    batchPlan.batches.length !==
      CURRENT_V12_REVIEW_PROFILE.classificationBatches ||
    !Array.isArray(batchResults) ||
    batchResults.length !== batchPlan.batches.length ||
    !Array.isArray(responses) ||
    responses.length !== CURRENT_V12_REVIEW_PROFILE.classificationResponses
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_CLASSIFICATION_CHAIN_INVALID");
  const plan = deriveClassificationEvidencePlan(sourcePlan);
  const unitById = new Map(plan.units.map((unit) => [unit.unitId, unit]));
  const pendingUnitIds = plan.units
    .filter(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    )
    .map(({ unitId }) => unitId);
  const seenUnits = new Set();
  const resultsById = new Map();
  for (const result of batchResults) {
    if (!text(result?.batchId) || resultsById.has(result.batchId))
      throw reviewError("LF_A_DOUBLE_REVIEW_BATCH_RESULT_DUPLICATE");
    resultsById.set(result.batchId, result);
  }
  const orderedResults = batchPlan.batches.map((batch, batchIndex) => {
    const result = resultsById.get(batch.batchId);
    const expectedUnitIds = uniqueStrings(batch.expectedUnitIds);
    if (
      !result ||
      batch.batchIndex !== batchIndex ||
      !expectedUnitIds?.length ||
      expectedUnitIds.some(
        (unitId) => !unitById.has(unitId) || seenUnits.has(unitId)
      ) ||
      result.contractId !==
        CURRENT_V12_REVIEW_PROFILE.classificationRunContractId ||
      result.sourceUnitPlanSha256 !== sourcePlan.planSha256 ||
      result.promptContractId !== CURRENT_V12_REVIEW_PROFILE.promptContractId ||
      result.promptSha256 !==
        sha256(JSON.stringify(prompt(classificationBatch(plan, batch)))) ||
      result.validatorContractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
      result.requestedModel !== CURRENT_V12_REVIEW_PROFILE.modelId ||
      result.modelContext !== CURRENT_V12_REVIEW_PROFILE.modelContext ||
      result.batchId !== batch.batchId ||
      result.batchIndex !== batch.batchIndex ||
      stableStringify(result.expectedUnitIds) !==
        stableStringify(expectedUnitIds) ||
      !Array.isArray(result.responses) ||
      result.validation?.passed !== true ||
      typeof result.rawResponse !== "string" ||
      result.rawResponseSha256 !== sha256(result.rawResponse)
    )
      throw reviewError(
        "LF_A_DOUBLE_REVIEW_BATCH_RESULT_BINDING_INVALID",
        batch.batchId
      );
    expectedUnitIds.forEach((unitId) => seenUnits.add(unitId));
    const contextualBatch = classificationBatch(plan, batch);
    const validation = validateBatchResponses(
      plan,
      contextualBatch,
      result.responses
    );
    if (
      validation.passed !== true ||
      stableStringify(validation) !== stableStringify(result.validation)
    )
      throw reviewError(
        "LF_A_DOUBLE_REVIEW_BATCH_REVALIDATION_FAILED",
        batch.batchId
      );
    return result;
  });
  if (
    seenUnits.size !== pendingUnitIds.length ||
    pendingUnitIds.some((unitId) => !seenUnits.has(unitId)) ||
    [...seenUnits].some((unitId) => !pendingUnitIds.includes(unitId))
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_BATCH_UNIT_COVERAGE_INVALID");
  const reconstructedResponses = orderedResults.flatMap(
    (result) => result.responses
  );
  if (stableStringify(reconstructedResponses) !== stableStringify(responses))
    throw reviewError("LF_A_DOUBLE_REVIEW_RESPONSES_BINDING_INVALID");
  const reconstructedManifest = buildADrivenSemanticManifest({
    plan,
    responses,
  });
  if (
    stableStringify(reconstructedManifest) !== stableStringify(dynamicManifest)
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_MANIFEST_REBUILD_INVALID");
  const expectedSummary = {
    sourceUnitPlanSha256: sourcePlan.planSha256,
    promptContractId: CURRENT_V12_REVIEW_PROFILE.promptContractId,
    validatorContractId: A_DYNAMIC_MANIFEST_CONTRACT_ID,
    classificationBatchesSha256: sha256(JSON.stringify(batchPlan)),
    batches: orderedResults.length,
    validBatches: orderedResults.length,
    unresolvedBatches: 0,
    semanticRequirements: dynamicManifest.summary.semanticRequirements,
    semanticComponents: dynamicManifest.summary.semanticComponents,
    unresolvedUnits: dynamicManifest.summary.unresolvedUnits,
    reviewRequiredBlocks: dynamicManifest.summary.reviewRequiredBlocks,
    allBlocksTerminal: dynamicManifest.summary.allBlocksTerminal,
    responseIntegrityStatus: dynamicManifest.summary.responseIntegrityStatus,
  };
  for (const [key, value] of Object.entries(expectedSummary))
    if (summary?.[key] !== value)
      throw reviewError("LF_A_DOUBLE_REVIEW_SUMMARY_BINDING_INVALID", key);
  if (
    summary.model?.id !== CURRENT_V12_REVIEW_PROFILE.modelId ||
    summary.model?.loadedContextLength !==
      CURRENT_V12_REVIEW_PROFILE.modelContext ||
    summary.transport?.contractId !==
      CURRENT_V12_REVIEW_PROFILE.transportContractId ||
    summary.transport?.requestTimeoutMs !==
      CURRENT_V12_REVIEW_PROFILE.requestTimeoutMs ||
    summary.transport?.abortSettlementTimeoutMs !==
      CURRENT_V12_REVIEW_PROFILE.abortSettlementTimeoutMs ||
    summary.transport?.modelRecoveryTimeoutMs !==
      CURRENT_V12_REVIEW_PROFILE.modelRecoveryTimeoutMs
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_SUMMARY_RUNTIME_INVALID");
  const payload = {
    schemaVersion: 1,
    contractId: CLASSIFICATION_CHAIN_CONTRACT_ID,
    status: "DETERMINISTICALLY_REVALIDATED",
    sourceUnitPlanSha256: sourcePlan.planSha256,
    batchPlanCanonicalSha256: sha256(stableStringify(batchPlan)),
    batchResultCanonicalSha256: orderedResults.map((result) =>
      sha256(stableStringify(result))
    ),
    responsesCanonicalSha256: sha256(stableStringify(responses)),
    summaryCanonicalSha256: sha256(stableStringify(summary)),
    dynamicManifestSha256: dynamicManifest.manifestSha256,
    summary: {
      batches: orderedResults.length,
      responses: responses.length,
      semanticRequirements: dynamicManifest.summary.semanticRequirements,
      semanticComponents: dynamicManifest.summary.semanticComponents,
    },
  };
  return {
    ...payload,
    chainSha256: domainDigest(CLASSIFICATION_CHAIN_CONTRACT_ID, payload),
  };
}

function validateClassificationChainReceipt(receipt) {
  validateDigest(
    receipt,
    CLASSIFICATION_CHAIN_CONTRACT_ID,
    "chainSha256",
    "LF_A_DOUBLE_REVIEW_CHAIN_RECEIPT_INVALID"
  );
  if (
    receipt.status !== "DETERMINISTICALLY_REVALIDATED" ||
    receipt.summary?.batches !==
      CURRENT_V12_REVIEW_PROFILE.classificationBatches ||
    receipt.summary?.responses !==
      CURRENT_V12_REVIEW_PROFILE.classificationResponses ||
    receipt.dynamicManifestSha256 !==
      CURRENT_V12_REVIEW_PROFILE.dynamicManifestSha256
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_CHAIN_RECEIPT_BINDING_INVALID");
  return receipt;
}

function createClassificationEvidence({
  artifacts,
  batchResults,
  chainValidation,
} = {}) {
  validateClassificationChainReceipt(chainValidation);
  const normalizedArtifacts = {};
  for (const name of [
    "sourceUnitPlan",
    "classificationBatchPlan",
    "responses",
    "summary",
  ]) {
    const entry = artifacts?.[name];
    if (
      !entry ||
      !text(entry.relativePath) ||
      !validSha(entry.fileSha256) ||
      !text(entry.contractId)
    )
      throw reviewError("LF_A_DOUBLE_REVIEW_EVIDENCE_ARTIFACT_INVALID", name);
    normalizedArtifacts[name] = {
      relativePath: entry.relativePath,
      fileSha256: entry.fileSha256,
      contractId: entry.contractId,
      intrinsicSha256: validSha(entry.intrinsicSha256)
        ? entry.intrinsicSha256
        : null,
    };
  }
  if (!Array.isArray(batchResults) || batchResults.length !== 59)
    throw reviewError("LF_A_DOUBLE_REVIEW_BATCH_EVIDENCE_COUNT_INVALID");
  const batches = batchResults
    .map((entry) => {
      if (
        !text(entry.batchId) ||
        !text(entry.relativePath) ||
        !validSha(entry.fileSha256) ||
        entry.status !== "PASS" ||
        !Number.isInteger(entry.expectedUnits) ||
        entry.expectedUnits < 1
      )
        throw reviewError("LF_A_DOUBLE_REVIEW_BATCH_EVIDENCE_INVALID");
      return {
        batchId: entry.batchId,
        relativePath: entry.relativePath,
        fileSha256: entry.fileSha256,
        status: "PASS",
        expectedUnits: entry.expectedUnits,
      };
    })
    .sort((left, right) => left.batchId.localeCompare(right.batchId));
  if (new Set(batches.map(({ batchId }) => batchId)).size !== batches.length)
    throw reviewError("LF_A_DOUBLE_REVIEW_BATCH_EVIDENCE_DUPLICATE");
  const payload = {
    schemaVersion: 1,
    contractId: CLASSIFICATION_EVIDENCE_CONTRACT_ID,
    status: "COMPLETE_PASS_SET_FROZEN",
    artifacts: normalizedArtifacts,
    batchResults: batches,
    chainValidation,
    summary: {
      batchResults: batches.length,
      passResults: batches.length,
      failedResults: 0,
    },
  };
  return {
    ...payload,
    evidenceSha256: domainDigest(CLASSIFICATION_EVIDENCE_CONTRACT_ID, payload),
  };
}

function validateClassificationEvidence(evidence) {
  validateDigest(
    evidence,
    CLASSIFICATION_EVIDENCE_CONTRACT_ID,
    "evidenceSha256",
    "LF_A_DOUBLE_REVIEW_EVIDENCE_DIGEST_INVALID"
  );
  const regenerated = createClassificationEvidence(evidence);
  if (stableStringify(regenerated) !== stableStringify(evidence))
    throw reviewError("LF_A_DOUBLE_REVIEW_EVIDENCE_CANONICAL_INVALID");
  return evidence;
}

const REQUIRED_SOURCE_ARTIFACTS = [
  "sourcePdf",
  "documentArtifact",
  "sourceLedger",
  "runContract",
  "inputManifest",
  "correctedAStatusAudit",
  "integrityLog",
];

function createRunProvenance({
  implementationCommitSha,
  sourceRun,
  sourceArtifacts,
} = {}) {
  const normalizedSourceArtifacts = {};
  for (const name of REQUIRED_SOURCE_ARTIFACTS) {
    const artifact = sourceArtifacts?.[name];
    if (
      !text(artifact?.relativePath) ||
      !validSha(artifact?.fileSha256) ||
      !text(artifact?.contractId)
    )
      throw reviewError("LF_A_DOUBLE_REVIEW_SOURCE_ARTIFACT_INVALID", name);
    normalizedSourceArtifacts[name] = {
      relativePath: artifact.relativePath,
      fileSha256: artifact.fileSha256,
      contractId: artifact.contractId,
      intrinsicSha256: validSha(artifact.intrinsicSha256)
        ? artifact.intrinsicSha256
        : null,
    };
  }
  const payload = {
    schemaVersion: 1,
    contractId: RUN_PROVENANCE_CONTRACT_ID,
    implementationCommitSha: text(implementationCommitSha),
    sourceRun: {
      runContractId: text(sourceRun?.runContractId),
      classificationRunContractId:
        text(sourceRun?.classificationRunContractId) ||
        CURRENT_V12_REVIEW_PROFILE.classificationRunContractId,
      manifestCompletionCommitSha: text(sourceRun?.manifestCompletionCommitSha),
      releaseId: text(sourceRun?.releaseId),
      runSignature: text(sourceRun?.runSignature),
      modelId: text(sourceRun?.modelId),
      qwenModelKey: text(sourceRun?.qwenModelKey),
      promptContractId: text(sourceRun?.promptContractId),
      transportContractId: text(sourceRun?.transportContractId),
      contextLength: sourceRun?.contextLength,
      maximumAttempts: sourceRun?.maximumAttempts,
      requestTimeoutMs: sourceRun?.requestTimeoutMs,
      abortSettlementTimeoutMs: sourceRun?.abortSettlementTimeoutMs,
      modelRecoveryTimeoutMs: sourceRun?.modelRecoveryTimeoutMs,
    },
    sourceArtifacts: normalizedSourceArtifacts,
    fieldAssurance: {
      implementationCommitSha: "PROFILE_PINNED",
      manifestCompletionCommitSha: "PROFILE_PINNED",
      runContractId: "MANIFEST_CROSSCHECKED",
      classificationRunContractId: "BATCH_AND_SUMMARY_CROSSCHECKED",
      modelId: "BATCH_AND_SUMMARY_CROSSCHECKED",
      promptContractId: "BATCH_AND_SUMMARY_CROSSCHECKED",
      contextLength: "BATCH_AND_SUMMARY_CROSSCHECKED",
      releaseId: "PROFILE_PINNED_AND_RUN_CONTRACT_CROSSCHECKED",
      runSignature: "PROFILE_PINNED_EXTERNAL_RUN_PATH",
      qwenModelKey: "ATTESTED_EXTERNAL_NOT_DERIVED_FROM_CLASSIFICATION_FILES",
      timeoutsAndAttempts:
        "ATTESTED_EXTERNAL_NOT_DERIVED_FROM_CLASSIFICATION_FILES",
      sourceArtifacts: "HASH_BOUND_AND_CROSSCHECKED_BY_FREEZE_MATERIALIZER",
    },
  };
  if (
    !/^[a-f0-9]{40,64}$/u.test(payload.implementationCommitSha || "") ||
    payload.implementationCommitSha !==
      CURRENT_V12_REVIEW_PROFILE.implementationCommitSha ||
    payload.sourceRun.runContractId !==
      CURRENT_V12_REVIEW_PROFILE.productRunContractId ||
    payload.sourceRun.classificationRunContractId !==
      CURRENT_V12_REVIEW_PROFILE.classificationRunContractId ||
    payload.sourceRun.manifestCompletionCommitSha !==
      CURRENT_V12_REVIEW_PROFILE.manifestCompletionCommitSha ||
    payload.sourceRun.releaseId !== CURRENT_V12_REVIEW_PROFILE.releaseId ||
    payload.sourceRun.runSignature !==
      CURRENT_V12_REVIEW_PROFILE.runSignature ||
    payload.sourceRun.modelId !== CURRENT_V12_REVIEW_PROFILE.modelId ||
    payload.sourceRun.promptContractId !==
      CURRENT_V12_REVIEW_PROFILE.promptContractId ||
    payload.sourceRun.contextLength !==
      CURRENT_V12_REVIEW_PROFILE.modelContext ||
    payload.sourceRun.maximumAttempts !==
      CURRENT_V12_REVIEW_PROFILE.maximumAttempts ||
    payload.sourceRun.requestTimeoutMs !==
      CURRENT_V12_REVIEW_PROFILE.requestTimeoutMs ||
    payload.sourceRun.abortSettlementTimeoutMs !==
      CURRENT_V12_REVIEW_PROFILE.abortSettlementTimeoutMs ||
    payload.sourceRun.modelRecoveryTimeoutMs !==
      CURRENT_V12_REVIEW_PROFILE.modelRecoveryTimeoutMs ||
    payload.sourceRun.qwenModelKey !==
      CURRENT_V12_REVIEW_PROFILE.qwenModelKey ||
    payload.sourceRun.transportContractId !==
      CURRENT_V12_REVIEW_PROFILE.transportContractId ||
    Object.values(payload.sourceRun).some((value) => value === null) ||
    [
      "contextLength",
      "maximumAttempts",
      "requestTimeoutMs",
      "abortSettlementTimeoutMs",
      "modelRecoveryTimeoutMs",
    ].some(
      (field) =>
        !Number.isInteger(payload.sourceRun[field]) ||
        payload.sourceRun[field] < 1
    )
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_RUN_PROVENANCE_INVALID");
  return {
    ...payload,
    provenanceSha256: domainDigest(RUN_PROVENANCE_CONTRACT_ID, payload),
  };
}

function validateRunProvenance(provenance) {
  validateDigest(
    provenance,
    RUN_PROVENANCE_CONTRACT_ID,
    "provenanceSha256",
    "LF_A_DOUBLE_REVIEW_RUN_PROVENANCE_DIGEST_INVALID"
  );
  if (
    stableStringify(createRunProvenance(provenance)) !==
    stableStringify(provenance)
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_RUN_PROVENANCE_CANONICAL_INVALID");
  return provenance;
}

function normalizeSpan(span) {
  const rawBlockIds = Array.isArray(span?.blockIds)
    ? span.blockIds
    : span?.blockId
      ? [span.blockId]
      : [];
  const blockIds = uniqueStrings(rawBlockIds) || [];
  return {
    spanId: text(span?.spanId),
    documentUuid: text(span?.documentUuid),
    documentFingerprint:
      text(span?.documentFingerprint) || text(span?.documentSha256),
    physicalPageNumber: Number.isInteger(span?.physicalPageNumber)
      ? span.physicalPageNumber
      : null,
    pageStart: Number.isInteger(span?.pageStart)
      ? span.pageStart
      : Number.isInteger(span?.documentStart)
        ? span.documentStart
        : null,
    pageEnd: Number.isInteger(span?.pageEnd)
      ? span.pageEnd
      : Number.isInteger(span?.documentEnd)
        ? span.documentEnd
        : null,
    exactText: text(span?.exactText),
    exactTextSha256: validSha(span?.exactTextSha256)
      ? span.exactTextSha256
      : text(span?.exactText)
        ? sha256(span.exactText)
        : null,
    blockIds: [...blockIds].sort(),
  };
}

function legacyInventory(manifest) {
  if (
    !manifest ||
    !validSha(manifest.manifestSha256) ||
    !Array.isArray(manifest.categories) ||
    !Array.isArray(manifest.requirements)
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_LEGACY_MANIFEST_INVALID");
  const requirements = new Map();
  for (const requirement of manifest.requirements) {
    if (
      !text(requirement?.requirementId) ||
      requirements.has(requirement.requirementId) ||
      !Array.isArray(requirement.components) ||
      !requirement.components.length ||
      !Array.isArray(requirement.sourceSpans)
    )
      throw reviewError("LF_A_DOUBLE_REVIEW_LEGACY_REQUIREMENT_INVALID");
    requirements.set(requirement.requirementId, requirement);
  }
  const rows = new Map();
  for (const [categoryIndex, category] of manifest.categories.entries()) {
    if (!Array.isArray(category?.subcategories))
      throw reviewError("LF_A_DOUBLE_REVIEW_LEGACY_TOPOLOGY_INVALID");
    const ids = category.subcategories.flatMap(
      (value) => value.requirementIds || []
    );
    for (const [rowIndex, id] of ids.entries()) {
      if (!requirements.has(id) || rows.has(id))
        throw reviewError("LF_A_DOUBLE_REVIEW_LEGACY_TOPOLOGY_INVALID");
      rows.set(
        id,
        `LR${String(categoryIndex + 1).padStart(2, "0")}-${String(rowIndex + 1).padStart(3, "0")}`
      );
    }
  }
  if (
    rows.size !== EXPECTED_LEGACY_REQUIREMENTS ||
    rows.size !== requirements.size
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_LEGACY_REQUIREMENT_COUNT_INVALID");
  const seen = new Set();
  const components = [];
  for (const requirement of manifest.requirements) {
    const spans = requirement.sourceSpans.map(normalizeSpan);
    const spansById = new Map(spans.map((span) => [span.spanId, span]));
    for (const component of requirement.components) {
      const id = text(component?.id);
      const spanIds = uniqueStrings(component?.sourceSpanIds);
      const key = `${requirement.requirementId}:${id}`;
      if (
        !id ||
        !text(component?.factRole) ||
        !spanIds?.length ||
        spanIds.some((spanId) => !spansById.has(spanId)) ||
        seen.has(key)
      )
        throw reviewError("LF_A_DOUBLE_REVIEW_LEGACY_COMPONENT_INVALID");
      seen.add(key);
      const sourceEvidence = spanIds.map((spanId) => spansById.get(spanId));
      const sourceBlockIds = [
        ...new Set(sourceEvidence.flatMap((span) => span.blockIds)),
      ].sort();
      if (!sourceBlockIds.length)
        throw reviewError("LF_A_DOUBLE_REVIEW_LEGACY_COMPONENT_SOURCE_MISSING");
      components.push({
        legacyAnalysisRowId: rows.get(requirement.requirementId),
        legacyRequirementId: requirement.requirementId,
        legacyRequirementLabel:
          text(requirement.displayLabel) || requirement.requirementId,
        legacyComponentId: id,
        legacyComponentLabel: text(component.label) || id,
        legacyFactRole: component.factRole,
        sourceBlockIds,
        sourceEvidence,
      });
    }
  }
  if (components.length !== EXPECTED_LEGACY_COMPONENTS)
    throw reviewError("LF_A_DOUBLE_REVIEW_LEGACY_COMPONENT_COUNT_INVALID");
  return { requirements: requirements.size, components };
}

function dynamicInventory(manifest) {
  validateADrivenSemanticManifest(manifest);
  if (
    manifest.runContractId !== "LF_REFERENCE_A_DRIVEN_V2" ||
    manifest.summary?.unresolvedUnits !== 0 ||
    manifest.summary?.responseIntegrityStatus !== "VALID" ||
    manifest.summary?.allBlocksTerminal !== true ||
    manifest.summary?.acceptanceReady !== true
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_DYNAMIC_MANIFEST_NOT_READY");
  const requirementIds = new Set();
  const componentIds = new Set();
  const requirements = [];
  const components = [];
  for (const requirement of manifest.requirements) {
    if (
      !text(requirement?.requirementId) ||
      requirementIds.has(requirement.requirementId)
    )
      throw reviewError("LF_A_DOUBLE_REVIEW_DYNAMIC_REQUIREMENT_INVALID");
    requirementIds.add(requirement.requirementId);
    const members = [];
    for (const component of requirement.components || []) {
      const id = text(component?.componentId);
      const blocks = uniqueStrings(component?.sourceBlockIds);
      if (
        !id ||
        componentIds.has(id) ||
        !text(component.type) ||
        !blocks?.length
      )
        throw reviewError("LF_A_DOUBLE_REVIEW_DYNAMIC_COMPONENT_INVALID");
      componentIds.add(id);
      const item = {
        dynamicRequirementId: requirement.requirementId,
        dynamicRequirementLabel:
          text(requirement.displayLabel) || requirement.requirementId,
        dynamicComponentId: id,
        dynamicComponentType: component.type,
        dynamicComponentLabel: text(component.label) || id,
        sourceBlockIds: [...blocks].sort(),
        sourceEvidence: (requirement.sourceSpans || [])
          .map(normalizeSpan)
          .filter((span) =>
            span.blockIds.some((blockId) => blocks.includes(blockId))
          ),
      };
      components.push(item);
      members.push(item);
    }
    requirements.push({
      dynamicRequirementId: requirement.requirementId,
      dynamicRequirementLabel:
        text(requirement.displayLabel) || requirement.requirementId,
      sourceBlockIds: [
        ...new Set(members.flatMap((item) => item.sourceBlockIds)),
      ].sort(),
      components: members,
    });
  }
  if (
    requirements.length !== manifest.summary.semanticRequirements ||
    components.length !== manifest.summary.semanticComponents
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_DYNAMIC_SUMMARY_INVALID");
  return { requirements, components };
}

function createReviewBasis({
  campaignProfile = CURRENT_V12_REVIEW_PROFILE,
  dynamicManifest,
  dynamicManifestFileSha256,
  legacyManifest,
  legacyManifestFileSha256,
  classificationEvidence,
  runProvenance,
} = {}) {
  validateReviewCampaignProfile(campaignProfile);
  const dynamic = dynamicInventory(dynamicManifest);
  const legacy = legacyInventory(legacyManifest);
  const evidence = validateClassificationEvidence(classificationEvidence);
  const provenance = validateRunProvenance(runProvenance);
  if (
    dynamicManifest.manifestSha256 !== campaignProfile.dynamicManifestSha256 ||
    dynamicManifestFileSha256 !== campaignProfile.dynamicManifestFileSha256 ||
    dynamic.requirements.length !== campaignProfile.dynamicRequirements ||
    dynamic.components.length !== campaignProfile.dynamicComponents ||
    legacyManifest.manifestSha256 !== campaignProfile.legacyManifestSha256 ||
    legacyManifestFileSha256 !== campaignProfile.legacyManifestFileSha256 ||
    legacy.requirements !== campaignProfile.legacyRequirements ||
    legacy.components.length !== campaignProfile.legacyComponents ||
    evidence.artifacts.sourceUnitPlan.intrinsicSha256 !==
      dynamicManifest.sourceUnitPlanSha256 ||
    provenance.sourceRun.runContractId !== dynamicManifest.runContractId
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_CAMPAIGN_SOURCE_MISMATCH");
  const payload = {
    schemaVersion: 1,
    contractId: REVIEW_BASIS_CONTRACT_ID,
    scope: "QA_ONLY_NO_B_ROUTING_NO_RESULT_MUTATION",
    campaignProfile,
    sourceBindings: {
      dynamicManifestContractId: A_DYNAMIC_MANIFEST_CONTRACT_ID,
      dynamicManifestSha256: dynamicManifest.manifestSha256,
      dynamicManifestFileSha256,
      dynamicManifestCanonicalSha256: sha256(stableStringify(dynamicManifest)),
      legacyManifestSha256: legacyManifest.manifestSha256,
      legacyManifestFileSha256,
      legacyManifestCanonicalSha256: sha256(stableStringify(legacyManifest)),
      classificationEvidenceSha256: evidence.evidenceSha256,
      runProvenanceSha256: provenance.provenanceSha256,
    },
    frozenDynamicManifest: dynamicManifest,
    frozenLegacyManifest: legacyManifest,
    classificationEvidence: evidence,
    runProvenance: provenance,
    summary: {
      dynamicRequirements: dynamic.requirements.length,
      dynamicComponents: dynamic.components.length,
      legacyRequirements: legacy.requirements,
      legacyComponents: legacy.components.length,
      independentReviewsRequired: 2,
      semanticAuthority: false,
      bRoutingAllowed: false,
      resultMutationAllowed: false,
    },
  };
  return {
    ...payload,
    basisSha256: domainDigest(REVIEW_BASIS_CONTRACT_ID, payload),
  };
}

function validateReviewBasis(basis) {
  validateDigest(
    basis,
    REVIEW_BASIS_CONTRACT_ID,
    "basisSha256",
    "LF_A_DOUBLE_REVIEW_BASIS_DIGEST_INVALID"
  );
  const rebuilt = createReviewBasis({
    campaignProfile: basis.campaignProfile,
    dynamicManifest: basis.frozenDynamicManifest,
    dynamicManifestFileSha256: basis.sourceBindings?.dynamicManifestFileSha256,
    legacyManifest: basis.frozenLegacyManifest,
    legacyManifestFileSha256: basis.sourceBindings?.legacyManifestFileSha256,
    classificationEvidence: basis.classificationEvidence,
    runProvenance: basis.runProvenance,
  });
  if (stableStringify(rebuilt) !== stableStringify(basis))
    throw reviewError("LF_A_DOUBLE_REVIEW_BASIS_CANONICAL_INVALID");
  return basis;
}

function candidateProjection(component, overlap, contextKind) {
  return {
    dynamicRequirementId: component.dynamicRequirementId,
    dynamicRequirementLabel: component.dynamicRequirementLabel,
    dynamicComponentId: component.dynamicComponentId,
    dynamicComponentType: component.dynamicComponentType,
    dynamicComponentLabel: component.dynamicComponentLabel,
    sourceBlockIds: component.sourceBlockIds,
    sourceEvidence: component.sourceEvidence,
    overlappingSourceBlockIds: [...new Set(overlap)].sort(),
    contextKind,
  };
}

function createCrosswalkDraft({ basis } = {}) {
  validateReviewBasis(basis);
  const legacy = legacyInventory(basis.frozenLegacyManifest);
  const dynamic = dynamicInventory(basis.frozenDynamicManifest);
  const byBlock = new Map();
  for (const requirement of dynamic.requirements)
    for (const blockId of requirement.sourceBlockIds) {
      const values = byBlock.get(blockId) || [];
      values.push(requirement);
      byBlock.set(blockId, values);
    }
  const reachedDynamic = new Set();
  const records = legacy.components.map((legacyComponent) => {
    const contexts = new Map();
    for (const blockId of legacyComponent.sourceBlockIds)
      for (const requirement of byBlock.get(blockId) || []) {
        const context = contexts.get(requirement.dynamicRequirementId) || {
          requirement,
          blocks: [],
        };
        context.blocks.push(blockId);
        contexts.set(requirement.dynamicRequirementId, context);
      }
    const candidates = [];
    for (const { requirement, blocks } of contexts.values())
      for (const component of requirement.components) {
        const exact = component.sourceBlockIds.filter((blockId) =>
          legacyComponent.sourceBlockIds.includes(blockId)
        );
        reachedDynamic.add(component.dynamicComponentId);
        candidates.push(
          candidateProjection(
            component,
            exact.length ? exact : blocks,
            exact.length
              ? "EXACT_COMPONENT_SOURCE_OVERLAP"
              : "SIBLING_IN_OVERLAPPING_REQUIREMENT"
          )
        );
      }
    candidates.sort((left, right) =>
      left.dynamicComponentId.localeCompare(right.dynamicComponentId)
    );
    return {
      recordId: `DR-${sha256(
        `${basis.basisSha256}:${legacyComponent.legacyRequirementId}:${legacyComponent.legacyComponentId}`
      ).slice(0, 24)}`,
      ...legacyComponent,
      candidates,
      reviewState: "UNREVIEWED",
    };
  });
  const dynamicOnlyComponents = dynamic.components
    .filter(({ dynamicComponentId }) => !reachedDynamic.has(dynamicComponentId))
    .map((component) =>
      candidateProjection(component, [], "NO_LEGACY_SOURCE_OVERLAP")
    )
    .sort((left, right) =>
      left.dynamicComponentId.localeCompare(right.dynamicComponentId)
    );
  const payload = {
    schemaVersion: 1,
    contractId: CROSSWALK_DRAFT_CONTRACT_ID,
    basisSha256: basis.basisSha256,
    dynamicManifestSha256: basis.sourceBindings.dynamicManifestSha256,
    legacyManifestSha256: basis.sourceBindings.legacyManifestSha256,
    records,
    reverseAudit: {
      scope: "DIAGNOSTIC_NOT_SEMANTIC_APPROVAL",
      dynamicOnlyComponents,
      dynamicManifestSemanticCompletenessApproved: false,
    },
    summary: {
      records: records.length,
      legacyRequirements: legacy.requirements,
      legacyComponents: legacy.components.length,
      dynamicRequirements: dynamic.requirements.length,
      dynamicComponents: dynamic.components.length,
      recordsWithoutCandidates: records.filter(
        ({ candidates }) => !candidates.length
      ).length,
      dynamicOnlyComponents: dynamicOnlyComponents.length,
      reviewedRecords: 0,
      approvalStatus: "UNREVIEWED",
    },
  };
  return {
    ...payload,
    draftSha256: domainDigest(CROSSWALK_DRAFT_CONTRACT_ID, payload),
  };
}

function validateCrosswalkDraft({ basis, draft } = {}) {
  validateDigest(
    draft,
    CROSSWALK_DRAFT_CONTRACT_ID,
    "draftSha256",
    "LF_A_DOUBLE_REVIEW_DRAFT_DIGEST_INVALID"
  );
  const rebuilt = createCrosswalkDraft({ basis });
  if (stableStringify(rebuilt) !== stableStringify(draft))
    throw reviewError("LF_A_DOUBLE_REVIEW_DRAFT_NOT_DETERMINISTIC");
  return draft;
}

function publicKeyFingerprint(publicKeyPem) {
  try {
    const key = crypto.createPublicKey(publicKeyPem);
    if (key.asymmetricKeyType !== "ed25519") return null;
    return sha256(key.export({ type: "spki", format: "der" }));
  } catch {
    return null;
  }
}

function createReviewerRegistry({
  basis,
  draft,
  authorityId,
  authorityPublicKeyPem,
  authorityPrivateKeyPem,
  reviewers,
} = {}) {
  validateCrosswalkDraft({ basis, draft });
  const payload = {
    schemaVersion: 1,
    contractId: REVIEWER_REGISTRY_CONTRACT_ID,
    basisSha256: basis.basisSha256,
    draftSha256: draft.draftSha256,
    authorityId: text(authorityId),
    authorityPublicKeyPem,
    authorityPublicKeyFingerprintSha256: publicKeyFingerprint(
      authorityPublicKeyPem
    ),
    proofLimit: "HUMAN_EXPERT_STATUS_ATTESTED_BY_EXTERNAL_ACCEPTANCE_AUTHORITY",
    reviewers: (reviewers || []).map((reviewer) => ({
      reviewerId: text(reviewer.reviewerId),
      reviewerSlot: reviewer.reviewerSlot,
      reviewerKind: "HUMAN_DOMAIN_EXPERT",
      credentialId: text(reviewer.credentialId),
      modelOrAutomationIdentity: null,
      publicKeyPem: reviewer.publicKeyPem,
      publicKeyFingerprintSha256: publicKeyFingerprint(reviewer.publicKeyPem),
    })),
  };
  const signature = signPayload(
    REVIEWER_REGISTRY_CONTRACT_ID,
    payload,
    authorityPrivateKeyPem
  );
  if (
    signature.publicKeyFingerprintSha256 !==
    payload.authorityPublicKeyFingerprintSha256
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_AUTHORITY_PRIVATE_KEY_INVALID");
  const registry = {
    ...payload,
    authoritySignature: signature,
  };
  registry.registrySha256 = domainDigest(
    REVIEWER_REGISTRY_CONTRACT_ID,
    registry
  );
  return validateReviewerRegistry({
    basis,
    draft,
    registry,
    authorityPublicKeyFingerprintSha256:
      payload.authorityPublicKeyFingerprintSha256,
  });
}

function validateReviewerRegistry({
  basis,
  draft,
  registry,
  authorityPublicKeyFingerprintSha256,
} = {}) {
  validateCrosswalkDraft({ basis, draft });
  validateDigest(
    registry,
    REVIEWER_REGISTRY_CONTRACT_ID,
    "registrySha256",
    "LF_A_DOUBLE_REVIEW_REGISTRY_DIGEST_INVALID"
  );
  const {
    registrySha256: _registrySha256,
    authoritySignature,
    ...unsignedRegistry
  } = registry;
  if (
    registry.basisSha256 !== basis.basisSha256 ||
    registry.draftSha256 !== draft.draftSha256 ||
    !text(registry.authorityId) ||
    !validSha(authorityPublicKeyFingerprintSha256) ||
    registry.authorityPublicKeyFingerprintSha256 !==
      authorityPublicKeyFingerprintSha256 ||
    publicKeyFingerprint(registry.authorityPublicKeyPem) !==
      authorityPublicKeyFingerprintSha256 ||
    !verifySignature(
      REVIEWER_REGISTRY_CONTRACT_ID,
      unsignedRegistry,
      authoritySignature,
      registry.authorityPublicKeyPem
    ) ||
    !Array.isArray(registry.reviewers)
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_REGISTRY_INVALID");
  const slots = new Set();
  const principals = new Set();
  const credentials = new Set();
  const keys = new Set();
  for (const reviewer of registry.reviewers) {
    const fingerprint = publicKeyFingerprint(reviewer.publicKeyPem);
    if (
      !["A", "B", "ADJUDICATOR"].includes(reviewer.reviewerSlot) ||
      !text(reviewer.reviewerId) ||
      !text(reviewer.credentialId) ||
      reviewer.reviewerKind !== "HUMAN_DOMAIN_EXPERT" ||
      reviewer.modelOrAutomationIdentity !== null ||
      !fingerprint ||
      reviewer.publicKeyFingerprintSha256 !== fingerprint ||
      slots.has(reviewer.reviewerSlot) ||
      principals.has(reviewer.reviewerId) ||
      credentials.has(reviewer.credentialId) ||
      keys.has(fingerprint)
    )
      throw reviewError("LF_A_DOUBLE_REVIEW_REGISTRY_REVIEWER_INVALID");
    slots.add(reviewer.reviewerSlot);
    principals.add(reviewer.reviewerId);
    credentials.add(reviewer.credentialId);
    keys.add(fingerprint);
  }
  if (!slots.has("A") || !slots.has("B"))
    throw reviewError("LF_A_DOUBLE_REVIEW_REGISTRY_SLOTS_MISSING");
  return registry;
}

function reviewerFromRegistry(registry, reviewerId, reviewerSlot) {
  const reviewer = registry.reviewers.find(
    (entry) =>
      entry.reviewerId === reviewerId && entry.reviewerSlot === reviewerSlot
  );
  if (!reviewer)
    throw reviewError("LF_A_DOUBLE_REVIEW_REVIEWER_NOT_AUTHORIZED");
  return reviewer;
}

function createReviewerTemplate({
  basis,
  draft,
  registry,
  authorityPublicKeyFingerprintSha256,
  reviewerSlot,
} = {}) {
  validateReviewerRegistry({
    basis,
    draft,
    registry,
    authorityPublicKeyFingerprintSha256,
  });
  if (!REVIEW_SLOTS.has(reviewerSlot))
    throw reviewError("LF_A_DOUBLE_REVIEW_SLOT_INVALID");
  const reviewer = registry.reviewers.find(
    (entry) => entry.reviewerSlot === reviewerSlot
  );
  return {
    schemaVersion: 1,
    contractId: REVIEW_INPUT_CONTRACT_ID,
    basisSha256: basis.basisSha256,
    draftSha256: draft.draftSha256,
    registrySha256: registry.registrySha256,
    reviewerSlot,
    reviewerId: reviewer.reviewerId,
    reviewerKind: "HUMAN_DOMAIN_EXPERT",
    reviewOrigin: "HUMAN_REVIEW",
    modelOrAutomationIdentity: null,
    independenceAttestation: {
      otherReviewerDecisionArtifactSeenBeforeSubmission: false,
      reviewPerformedIndependently: false,
    },
    decisions: draft.records.map(({ recordId }) => ({
      recordId,
      relation: "UNREVIEWED",
      dynamicTargets: [],
      mergeGroupId: null,
      rootCauseDisposition: "UNREVIEWED",
      rationale: "",
    })),
  };
}

function signatureBytes(contractId, payload) {
  return Buffer.from(`${contractId}\u0000${stableStringify(payload)}`, "utf8");
}

function signPayload(contractId, payload, privateKeyPem) {
  let key;
  try {
    key = crypto.createPrivateKey(privateKeyPem);
  } catch {
    throw reviewError("LF_A_DOUBLE_REVIEW_PRIVATE_KEY_INVALID");
  }
  if (key.asymmetricKeyType !== "ed25519")
    throw reviewError("LF_A_DOUBLE_REVIEW_PRIVATE_KEY_INVALID");
  return {
    algorithm: "Ed25519",
    publicKeyFingerprintSha256: publicKeyFingerprint(
      crypto.createPublicKey(key).export({ type: "spki", format: "pem" })
    ),
    value: crypto
      .sign(null, signatureBytes(contractId, payload), key)
      .toString("base64"),
  };
}

function verifySignature(contractId, payload, signature, publicKeyPem) {
  if (
    signature?.algorithm !== "Ed25519" ||
    signature.publicKeyFingerprintSha256 !== publicKeyFingerprint(publicKeyPem)
  )
    return false;
  try {
    return crypto.verify(
      null,
      signatureBytes(contractId, payload),
      crypto.createPublicKey(publicKeyPem),
      Buffer.from(signature.value || "", "base64")
    );
  } catch {
    return false;
  }
}

function normalizeDecisions(decisions, draft) {
  if (
    !Array.isArray(decisions) ||
    decisions.length !== draft.records.length ||
    new Set(decisions.map(({ recordId }) => recordId)).size !== decisions.length
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_DECISION_COVERAGE_INVALID");
  const byId = new Map(decisions.map((value) => [value.recordId, value]));
  const normalized = draft.records.map((record) => {
    const decision = byId.get(record.recordId);
    const relation = text(decision?.relation);
    const targets = uniqueStrings(decision?.dynamicTargets);
    const mergeGroupId = text(decision?.mergeGroupId);
    const rootCauseDisposition = text(decision?.rootCauseDisposition);
    const rationale = text(decision?.rationale);
    const allowed = new Set(
      record.candidates.map(({ dynamicComponentId }) => dynamicComponentId)
    );
    const cardinalityValid =
      (["EQUIVALENT", "REPHRASED_EQUIVALENT", "MOVED_EQUIVALENT"].includes(
        relation
      ) &&
        targets?.length === 1) ||
      (relation === "SPLIT_INTO_DYNAMIC" && targets?.length >= 2) ||
      (relation === "MERGED_INTO_DYNAMIC" &&
        targets?.length === 1 &&
        mergeGroupId) ||
      (relation === "MISSING" && targets?.length === 0) ||
      (relation === "AMBIGUOUS" && Array.isArray(targets));
    if (
      !decision ||
      !REVIEW_RELATIONS.has(relation) ||
      !targets ||
      targets.some((target) => !allowed.has(target)) ||
      !ROOT_CAUSE_DISPOSITIONS.has(rootCauseDisposition) ||
      (relation !== "MERGED_INTO_DYNAMIC" && mergeGroupId) ||
      !cardinalityValid ||
      !rationale
    )
      throw reviewError("LF_A_DOUBLE_REVIEW_DECISION_INVALID", record.recordId);
    return {
      recordId: record.recordId,
      relation,
      dynamicTargets: [...targets].sort(),
      mergeGroupId,
      rootCauseDisposition,
      rationale,
    };
  });
  const mergeGroups = new Map();
  for (const decision of normalized) {
    if (decision.relation !== "MERGED_INTO_DYNAMIC") continue;
    const group = mergeGroups.get(decision.mergeGroupId) || [];
    group.push(decision);
    mergeGroups.set(decision.mergeGroupId, group);
  }
  for (const [mergeGroupId, group] of mergeGroups) {
    if (
      group.length < 2 ||
      new Set(group.map(({ dynamicTargets }) => dynamicTargets[0])).size !== 1
    )
      throw reviewError("LF_A_DOUBLE_REVIEW_MERGE_GROUP_INVALID", mergeGroupId);
  }
  return normalized;
}

function reviewerPayload({
  basis,
  draft,
  registry,
  authorityPublicKeyFingerprintSha256,
  input,
}) {
  validateReviewerRegistry({
    basis,
    draft,
    registry,
    authorityPublicKeyFingerprintSha256,
  });
  const reviewer = reviewerFromRegistry(
    registry,
    input?.reviewerId,
    input?.reviewerSlot
  );
  if (
    input.contractId !== REVIEW_INPUT_CONTRACT_ID ||
    input.basisSha256 !== basis.basisSha256 ||
    input.draftSha256 !== draft.draftSha256 ||
    input.registrySha256 !== registry.registrySha256 ||
    input.reviewerKind !== "HUMAN_DOMAIN_EXPERT" ||
    input.reviewOrigin !== "HUMAN_REVIEW" ||
    input.modelOrAutomationIdentity !== null ||
    input.independenceAttestation
      ?.otherReviewerDecisionArtifactSeenBeforeSubmission !== false ||
    input.independenceAttestation?.reviewPerformedIndependently !== true
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_SUBMISSION_INVALID");
  return {
    schemaVersion: 1,
    contractId: REVIEW_ARTIFACT_CONTRACT_ID,
    basisSha256: basis.basisSha256,
    draftSha256: draft.draftSha256,
    registrySha256: registry.registrySha256,
    reviewerSlot: reviewer.reviewerSlot,
    reviewerId: reviewer.reviewerId,
    reviewerKind: reviewer.reviewerKind,
    credentialId: reviewer.credentialId,
    publicKeyFingerprintSha256: reviewer.publicKeyFingerprintSha256,
    reviewOrigin: "HUMAN_REVIEW",
    modelOrAutomationIdentity: null,
    independenceAttestation: input.independenceAttestation,
    status: "SUBMITTED",
    decisions: normalizeDecisions(input.decisions, draft),
  };
}

function sealReviewerArtifact({
  basis,
  draft,
  registry,
  authorityPublicKeyFingerprintSha256,
  input,
  privateKeyPem,
} = {}) {
  const unsigned = reviewerPayload({
    basis,
    draft,
    registry,
    authorityPublicKeyFingerprintSha256,
    input,
  });
  const signature = signPayload(
    REVIEW_ARTIFACT_CONTRACT_ID,
    unsigned,
    privateKeyPem
  );
  if (
    signature.publicKeyFingerprintSha256 !== unsigned.publicKeyFingerprintSha256
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_PRIVATE_KEY_NOT_AUTHORIZED");
  const payload = { ...unsigned, signature };
  return {
    ...payload,
    reviewSha256: domainDigest(REVIEW_ARTIFACT_CONTRACT_ID, payload),
  };
}

function validateReviewerArtifact({
  basis,
  draft,
  registry,
  authorityPublicKeyFingerprintSha256,
  review,
} = {}) {
  validateDigest(
    review,
    REVIEW_ARTIFACT_CONTRACT_ID,
    "reviewSha256",
    "LF_A_DOUBLE_REVIEW_ARTIFACT_DIGEST_INVALID"
  );
  const { reviewSha256: _digest, signature, ...unsigned } = review;
  const normalized = reviewerPayload({
    basis,
    draft,
    registry,
    authorityPublicKeyFingerprintSha256,
    input: { ...review, contractId: REVIEW_INPUT_CONTRACT_ID },
  });
  const reviewer = reviewerFromRegistry(
    registry,
    review.reviewerId,
    review.reviewerSlot
  );
  if (
    stableStringify(normalized) !== stableStringify(unsigned) ||
    !verifySignature(
      REVIEW_ARTIFACT_CONTRACT_ID,
      unsigned,
      signature,
      reviewer.publicKeyPem
    )
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_ARTIFACT_CANONICAL_INVALID");
  return review;
}

function decisionIdentity(decision) {
  return stableStringify({
    relation: decision.relation,
    dynamicTargets: decision.dynamicTargets,
    mergeGroupId: decision.mergeGroupId,
    rootCauseDisposition: decision.rootCauseDisposition,
  });
}

function reconcileApprovedCrosswalk({
  basis,
  draft,
  registry,
  authorityPublicKeyFingerprintSha256,
  reviewA,
  reviewB,
} = {}) {
  validateReviewerArtifact({
    basis,
    draft,
    registry,
    authorityPublicKeyFingerprintSha256,
    review: reviewA,
  });
  validateReviewerArtifact({
    basis,
    draft,
    registry,
    authorityPublicKeyFingerprintSha256,
    review: reviewB,
  });
  const bySlot = new Map([
    [reviewA.reviewerSlot, reviewA],
    [reviewB.reviewerSlot, reviewB],
  ]);
  if (
    bySlot.size !== 2 ||
    !bySlot.has("A") ||
    !bySlot.has("B") ||
    reviewA.reviewerId === reviewB.reviewerId
  )
    throw reviewError("LF_A_DOUBLE_REVIEW_INDEPENDENCE_INVALID");
  const first = bySlot.get("A");
  const second = bySlot.get("B");
  const right = new Map(
    second.decisions.map((decision) => [decision.recordId, decision])
  );
  const records = first.decisions.map((left) => {
    const other = right.get(left.recordId);
    if (decisionIdentity(left) !== decisionIdentity(other))
      throw reviewError(
        "LF_A_DOUBLE_REVIEW_DISAGREEMENT_UNRESOLVED",
        left.recordId
      );
    if (!COVERED_RELATIONS.has(left.relation))
      throw reviewError(
        "LF_A_DOUBLE_REVIEW_SEMANTIC_COVERAGE_NOT_APPROVED",
        left.recordId
      );
    const source = draft.records.find(
      ({ recordId }) => recordId === left.recordId
    );
    return {
      recordId: left.recordId,
      legacyAnalysisRowId: source.legacyAnalysisRowId,
      legacyRequirementId: source.legacyRequirementId,
      legacyComponentId: source.legacyComponentId,
      relation: left.relation,
      dynamicTargets: left.dynamicTargets,
      mergeGroupId: left.mergeGroupId,
      rootCauseDisposition: left.rootCauseDisposition,
      resolution: "INDEPENDENT_AGREEMENT",
    };
  });
  const payload = {
    schemaVersion: 1,
    contractId: APPROVED_CROSSWALK_CONTRACT_ID,
    basisSha256: basis.basisSha256,
    draftSha256: draft.draftSha256,
    registrySha256: registry.registrySha256,
    reviewASha256: first.reviewSha256,
    reviewBSha256: second.reviewSha256,
    status: "APPROVED",
    approvalScope: "LEGACY_283_REQUIREMENTS_631_COMPONENTS_ONLY",
    dynamicManifestSemanticCompletenessApproved: false,
    records,
    summary: {
      records: records.length,
      independentlyAgreed: records.length,
      unresolved: 0,
      semanticCrosswalkApproved: true,
      reverseDynamicAdditionsApproved: false,
      bRoutingAllowed: false,
      resultMutationAllowed: false,
    },
  };
  return {
    ...payload,
    approvedCrosswalkSha256: domainDigest(
      APPROVED_CROSSWALK_CONTRACT_ID,
      payload
    ),
  };
}

module.exports = {
  APPROVED_CROSSWALK_CONTRACT_ID,
  CLASSIFICATION_EVIDENCE_CONTRACT_ID,
  CLASSIFICATION_CHAIN_CONTRACT_ID,
  CROSSWALK_DRAFT_CONTRACT_ID,
  CURRENT_V12_REVIEW_PROFILE,
  REVIEW_ARTIFACT_CONTRACT_ID,
  REVIEW_BASIS_CONTRACT_ID,
  REVIEW_CAMPAIGN_PROFILE_CONTRACT_ID,
  REVIEW_INPUT_CONTRACT_ID,
  REVIEWER_REGISTRY_CONTRACT_ID,
  RUN_PROVENANCE_CONTRACT_ID,
  createClassificationEvidence,
  createCrosswalkDraft,
  createReviewBasis,
  createReviewerRegistry,
  createReviewerTemplate,
  createRunProvenance,
  reconcileApprovedCrosswalk,
  sealReviewerArtifact,
  validateClassificationEvidence,
  validateClassificationChain,
  validateClassificationChainReceipt,
  validateCrosswalkDraft,
  validateReviewBasis,
  validateReviewerArtifact,
  validateReviewerRegistry,
  validateRunProvenance,
};
