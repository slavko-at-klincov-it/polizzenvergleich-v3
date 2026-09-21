#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { OpenAI } = require("openai");
const {
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
  validateADrivenRequirementDecisionArtifact,
  validateADrivenRequirementDecisionResponses,
} = require("../../utils/policyAnalysis/aDrivenRequirementCounterpartDecision");
const {
  A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_CONTRACT_ID,
  buildADrivenRequirementAbsencePlan,
  validateADrivenRequirementAbsenceDecisionArtifact,
  validateADrivenRequirementAbsencePlan,
  validateADrivenRequirementAbsencePartitionResponse,
  validateADrivenRequirementAbsenceResponses,
} = require("../../utils/policyAnalysis/aDrivenRequirementAbsenceCertification");
const {
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  createLmStudioRecovery,
  requestCompletionWithTimeout,
} = require("./runADrivenReferenceClassification.cjs");

const RUN_CONTRACT_ID = "LF_A_DRIVEN_REQUIREMENT_ABSENCE_RUN_V1";
const PROMPT_CONTRACT_ID = "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PROMPT_V5";
const TRANSPORT_CONTRACT_ID = "LF_A_DRIVEN_REQUIREMENT_ABSENCE_TRANSPORT_V2";
const DEFAULT_MODEL = "qwen/qwen3.6-35b-a3b";
const DEFAULT_CONTEXT = 42_496;
const DEFAULT_REQUEST_TIMEOUT_MS = 180_000;
const DEFAULT_ABORT_SETTLEMENT_TIMEOUT_MS = 15_000;
const DEFAULT_MODEL_RECOVERY_TIMEOUT_MS = 180_000;
const MAXIMUM_ATTEMPTS = 8;

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function fail(message) {
  console.error(`[lf-a-driven-requirement-absence] ${message}`);
  process.exit(1);
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      fail(`Ungültiges Argument: ${key || "-"}`);
    const name = key.slice(2);
    if (Object.hasOwn(values, name)) fail(`Doppeltes Argument: ${name}`);
    values[name] = value;
  }
  const allowed = new Set([
    "decisionPlan",
    "preliminaryBatch",
    "preliminaryDecisions",
    "completeCorpus",
    "output",
    "model",
    "modelContext",
    "maximumAttempts",
    "maximumPartitionCharacters",
    "maximumRequirementsPerRequest",
    "requestTimeoutMs",
    "abortSettlementTimeoutMs",
    "modelRecoveryTimeoutMs",
    "maximumNewPartitions",
    "seedOutput",
    "lmStudioSdk",
    "qwenModelKey",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of [
    "decisionPlan",
    "completeCorpus",
    "output",
    "lmStudioSdk",
    "qwenModelKey",
  ])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  if (Boolean(values.preliminaryBatch) === Boolean(values.preliminaryDecisions))
    fail(
      "Exakt eines von --preliminaryBatch oder --preliminaryDecisions ist erforderlich"
    );
  const integer = (name, fallback, minimum = 1) => {
    const parsed = Number(values[name] ?? fallback);
    if (!Number.isSafeInteger(parsed) || parsed < minimum)
      fail(`--${name} ist ungültig`);
    return parsed;
  };
  const result = {
    decisionPlan: path.resolve(values.decisionPlan),
    preliminaryBatch: values.preliminaryBatch
      ? path.resolve(values.preliminaryBatch)
      : null,
    preliminaryDecisions: values.preliminaryDecisions
      ? path.resolve(values.preliminaryDecisions)
      : null,
    completeCorpus: path.resolve(values.completeCorpus),
    output: path.resolve(values.output),
    seedOutput: values.seedOutput ? path.resolve(values.seedOutput) : null,
    lmStudioSdk: path.resolve(values.lmStudioSdk),
    qwenModelKey: values.qwenModelKey,
    model: values.model || DEFAULT_MODEL,
    modelContext: integer("modelContext", DEFAULT_CONTEXT, 1_000),
    maximumAttempts: integer("maximumAttempts", 3),
    maximumPartitionCharacters: integer(
      "maximumPartitionCharacters",
      80_000,
      10_000
    ),
    maximumRequirementsPerRequest: integer("maximumRequirementsPerRequest", 8),
    requestTimeoutMs: integer("requestTimeoutMs", DEFAULT_REQUEST_TIMEOUT_MS),
    abortSettlementTimeoutMs: integer(
      "abortSettlementTimeoutMs",
      DEFAULT_ABORT_SETTLEMENT_TIMEOUT_MS
    ),
    modelRecoveryTimeoutMs: integer(
      "modelRecoveryTimeoutMs",
      DEFAULT_MODEL_RECOVERY_TIMEOUT_MS
    ),
    maximumNewPartitions:
      values.maximumNewPartitions === undefined
        ? null
        : integer("maximumNewPartitions", null),
  };
  if (result.maximumAttempts > MAXIMUM_ATTEMPTS)
    fail(`--maximumAttempts darf höchstens ${MAXIMUM_ATTEMPTS} sein`);
  return result;
}

function compatibleSeedPartitionResponses({
  seedPlan,
  seedDecisions,
  seedSummary,
  plan,
  model,
  modelContext,
  requestTimeoutMs,
  abortSettlementTimeoutMs,
  promptContractId = PROMPT_CONTRACT_ID,
} = {}) {
  validateADrivenRequirementAbsencePlan(seedPlan);
  validateADrivenRequirementAbsenceDecisionArtifact(seedDecisions, seedPlan, {
    requireComplete: true,
  });
  validateADrivenRequirementAbsencePlan(plan);
  if (
    seedSummary?.contractId !== RUN_CONTRACT_ID ||
    seedSummary.absencePlanSha256 !== seedPlan.planSha256 ||
    seedSummary.absenceDecisionSha256 !== seedDecisions.decisionSha256 ||
    seedSummary.model?.id !== model ||
    seedSummary.model?.loadedContextLength !== modelContext ||
    seedSummary.promptContractId !== promptContractId ||
    seedSummary.unresolved !== 0 ||
    seedSummary.terminalPartitions !== seedPlan.partitions.length ||
    seedSummary.plannedPartitions !== seedPlan.partitions.length ||
    seedPlan.completeBCorpusSha256 !== plan.completeBCorpusSha256
  )
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_SEED_INVALID");

  const seedRequirements = new Map(
    seedPlan.requirements.map((requirement) => [
      requirement.requirementId,
      requirement,
    ])
  );
  const seedCandidates = new Map(
    seedPlan.candidates.map((candidate) => [candidate.candidateId, candidate])
  );
  const seedPartitions = new Map(
    seedPlan.partitions.map((partition) => [partition.partitionId, partition])
  );
  const seedResults = new Map(
    seedDecisions.partitionResults.map((result) => [result.partitionId, result])
  );
  const responses = new Map();
  for (const partition of plan.partitions) {
    const seedPartition = seedPartitions.get(partition.partitionId);
    const currentRequirement = plan.requirements.find(
      ({ requirementId }) => requirementId === partition.requirementId
    );
    const seedRequirement = seedRequirements.get(partition.requirementId);
    if (
      !seedPartition ||
      stableStringify(seedPartition) !== stableStringify(partition) ||
      stableStringify(seedRequirement) !==
        stableStringify(currentRequirement) ||
      partition.candidateIds.some((candidateId) => {
        const currentCandidate = plan.candidates.find(
          ({ candidateId: currentId }) => currentId === candidateId
        );
        return (
          stableStringify(seedCandidates.get(candidateId)) !==
          stableStringify(currentCandidate)
        );
      })
    )
      continue;
    const seedResult = seedResults.get(partition.partitionId);
    if (seedResult?.status !== "TERMINAL")
      throw new Error(
        "LF_A_DRIVEN_REQUIREMENT_ABSENCE_SEED_PARTITION_NOT_TERMINAL"
      );
    const response = {
      partitionId: seedResult.partitionId,
      decision: seedResult.decision,
      candidateIds: seedResult.selectedCandidateIds,
      rationale: seedResult.rationale,
    };
    const initialValidation =
      validateADrivenRequirementAbsencePartitionResponse({
        plan,
        partitionId: partition.partitionId,
        response,
      });
    if (initialValidation.result.status !== "TERMINAL")
      throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_SEED_PARTITION_INVALID");
    const semanticContractConflicts = negativeDecisionSemanticConflicts({
      plan,
      partition,
      response,
    });
    const semanticReviewNormalization =
      normalizeSemanticContractConflictForReview({
        partition,
        response,
        semanticContractConflicts,
      });
    if (semanticContractConflicts.length > 0 && !semanticReviewNormalization)
      continue;
    const normalizedResponse =
      semanticReviewNormalization?.response || response;
    const validation = semanticReviewNormalization
      ? validateADrivenRequirementAbsencePartitionResponse({
          plan,
          partitionId: partition.partitionId,
          response: normalizedResponse,
        })
      : initialValidation;
    if (validation.result.status !== "TERMINAL")
      throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_SEED_PARTITION_INVALID");
    const rawResponse = JSON.stringify(response);
    responses.set(partition.partitionId, {
      schemaVersion: 1,
      contractId: RUN_CONTRACT_ID,
      absencePlanSha256: plan.planSha256,
      promptContractId: PROMPT_CONTRACT_ID,
      transportContractId: TRANSPORT_CONTRACT_ID,
      requestedModel: model,
      modelContext,
      requestTimeoutMs,
      abortSettlementTimeoutMs,
      partitionId: partition.partitionId,
      response: normalizedResponse,
      validation,
      rawResponse,
      rawResponseSha256: sha256(rawResponse),
      attempts: [],
      semanticContractReviewNormalization:
        semanticReviewNormalization?.audit || null,
      reuse: {
        contractId: "LF_A_DRIVEN_REQUIREMENT_ABSENCE_VALIDATED_SEED_V1",
        sourceAbsencePlanSha256: seedPlan.planSha256,
        sourceAbsenceDecisionSha256: seedDecisions.decisionSha256,
        sourceRunContractId: seedSummary.contractId,
        sourcePromptContractId: seedSummary.promptContractId,
      },
    });
  }
  return responses;
}

function compatibleSeedFromOutput({ seedOutput, plan, args }) {
  if (!seedOutput) return new Map();
  const stat = fs.lstatSync(seedOutput);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_SEED_OUTPUT_INVALID");
  return compatibleSeedPartitionResponses({
    seedPlan: readJson(
      path.join(seedOutput, "absence-plan.private.json"),
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_SEED_PLAN"
    ),
    seedDecisions: readJson(
      path.join(seedOutput, "absence-decisions.private.json"),
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_SEED_DECISIONS"
    ),
    seedSummary: readJson(
      path.join(seedOutput, "summary.private.json"),
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_SEED_SUMMARY"
    ),
    plan,
    model: args.model,
    modelContext: args.modelContext,
    requestTimeoutMs: args.requestTimeoutMs,
    abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
  });
}

function readJson(file, code) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    throw new Error(`${code}_MISSING`);
  }
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`${code}_INVALID`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error(`${code}_INVALID`);
  }
}

function writePrivateJson(file, value) {
  if (fs.existsSync(file))
    throw new Error(`LF_A_DRIVEN_REQUIREMENT_ABSENCE_OUTPUT_EXISTS:${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function writeOrVerifyPrivateJson(file, value, mismatchCode) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, "utf8") !== bytes) throw new Error(mismatchCode);
    return;
  }
  writePrivateJson(file, value);
}

function writeCheckpoint(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function subsetDecisionPlan(plan, requirementIds) {
  const selected = new Set(requirementIds);
  const rows = plan.rows.filter(({ requirementId }) =>
    selected.has(requirementId)
  );
  if (rows.length !== selected.size)
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_PRELIMINARY_IDS_INVALID");
  const payload = {
    schemaVersion: plan.schemaVersion,
    contractId: A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
    dynamicManifestSha256: plan.dynamicManifestSha256,
    searchPlanSha256: plan.searchPlanSha256,
    searchExecutionSha256: plan.searchExecutionSha256,
    completeBCorpusSha256: plan.completeBCorpusSha256,
    selection: plan.selection,
    rows,
    batches: [],
    summary: {
      requirements: rows.length,
      components: rows.reduce((sum, row) => sum + row.components.length, 0),
      selectedCandidates: rows.reduce(
        (sum, row) => sum + row.candidates.length,
        0
      ),
      batches: 0,
      absenceCertifiedRequirements: 0,
    },
  };
  return {
    ...payload,
    planSha256: sha256(
      `${A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

function preliminaryDecision(plan, batch) {
  if (
    batch?.decisionPlanSha256 !== plan.planSha256 ||
    batch.validation?.passed !== true ||
    !Array.isArray(batch.responses) ||
    batch.responses.length === 0 ||
    typeof batch.rawResponse !== "string" ||
    batch.rawResponseSha256 !== sha256(batch.rawResponse)
  )
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_PRELIMINARY_INVALID");
  const batchSubset = subsetDecisionPlan(
    plan,
    batch.responses.map(({ requirementId }) => requirementId)
  );
  const batchDecisions = validateADrivenRequirementDecisionResponses({
    plan: batchSubset,
    responses: batch.responses,
  });
  if (batchDecisions.summary.unresolvedRequirements !== 0)
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_PRELIMINARY_NOT_FALLBACK");
  const fallbackRequirementIds = batchDecisions.results
    .filter(({ customerStatus }) => customerStatus === "FALLBACK_REQUIRED")
    .map(({ requirementId }) => requirementId);
  if (fallbackRequirementIds.length === 0)
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_PRELIMINARY_NOT_FALLBACK");
  const fallbackIds = new Set(fallbackRequirementIds);
  const subset = subsetDecisionPlan(plan, fallbackRequirementIds);
  const decisions = validateADrivenRequirementDecisionResponses({
    plan: subset,
    responses: batch.responses.filter(({ requirementId }) =>
      fallbackIds.has(requirementId)
    ),
  });
  if (
    decisions.summary.unresolvedRequirements !== 0 ||
    decisions.summary.fallbackRequiredRequirements !== decisions.results.length
  )
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_PRELIMINARY_NOT_FALLBACK");
  return { subset, decisions };
}

function preliminaryDecisionArtifact(plan, decisions) {
  validateADrivenRequirementDecisionArtifact(decisions, plan);
  if (
    decisions.summary.unresolvedRequirements !== 0 ||
    decisions.summary.terminalRequirements !== plan.rows.length ||
    decisions.summary.fallbackRequiredRequirements < 1
  )
    throw new Error(
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PRELIMINARY_DECISIONS_INVALID"
    );
  return { subset: plan, decisions };
}

function parseSingleDecision(value) {
  const normalized = String(value || "")
    .replace(/<think>[\s\S]*?<\/think>/giu, "")
    .trim();
  let parsed;
  if (normalized.startsWith("{") && normalized.endsWith("}"))
    parsed = [JSON.parse(normalized)];
  else if (normalized.startsWith("[") && normalized.endsWith("]"))
    parsed = JSON.parse(normalized);
  else throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_JSON_VALUE_MISSING");
  if (!Array.isArray(parsed) || parsed.length !== 1)
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_RESPONSE_COUNT_INVALID");
  return parsed[0];
}

function parseDecisionBatch(value, expectedPartitionIds) {
  const normalized = String(value || "")
    .replace(/<think>[\s\S]*?<\/think>/giu, "")
    .trim();
  let parsed;
  if (normalized.startsWith("[") && normalized.endsWith("]"))
    parsed = JSON.parse(normalized);
  else if (
    expectedPartitionIds.length === 1 &&
    normalized.startsWith("{") &&
    normalized.endsWith("}")
  )
    parsed = [JSON.parse(normalized)];
  else
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_BATCH_JSON_VALUE_MISSING");
  if (!Array.isArray(parsed) || parsed.length !== expectedPartitionIds.length)
    throw new Error(
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_BATCH_RESPONSE_COUNT_INVALID"
    );
  const expected = new Set(expectedPartitionIds);
  const observed = parsed.map(({ partitionId }) => partitionId);
  if (
    new Set(observed).size !== observed.length ||
    observed.some((partitionId) => !expected.has(partitionId)) ||
    expectedPartitionIds.some((partitionId) => !observed.includes(partitionId))
  )
    throw new Error(
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_BATCH_PARTITION_IDS_INVALID"
    );
  const byPartitionId = new Map(
    parsed.map((response) => [response.partitionId, response])
  );
  return expectedPartitionIds.map((partitionId) =>
    byPartitionId.get(partitionId)
  );
}

function sharedPartitionKey(partition) {
  return stableStringify({
    documentUuid: partition.documentUuid,
    documentSha256: partition.documentSha256,
    documentPosition: partition.documentPosition,
    partitionIndex: partition.partitionIndex,
    candidateIds: partition.candidateIds,
  });
}

function buildPartitionRequestBatches({
  plan,
  partitions = plan?.partitions,
  maximumRequirementsPerRequest = 8,
} = {}) {
  validateADrivenRequirementAbsencePlan(plan);
  if (
    !Array.isArray(partitions) ||
    partitions.length === 0 ||
    !Number.isInteger(maximumRequirementsPerRequest) ||
    maximumRequirementsPerRequest < 1
  )
    throw new Error(
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_REQUEST_BATCH_INPUT_INVALID"
    );
  const planIndexes = new Map(
    plan.partitions.map((partition, partitionIndex) => [
      partition.partitionId,
      partitionIndex,
    ])
  );
  const groups = new Map();
  for (const partition of partitions) {
    const partitionIndex = planIndexes.get(partition?.partitionId);
    if (
      partitionIndex === undefined ||
      stableStringify(plan.partitions[partitionIndex]) !==
        stableStringify(partition)
    )
      throw new Error(
        "LF_A_DRIVEN_REQUIREMENT_ABSENCE_REQUEST_BATCH_PARTITION_INVALID"
      );
    const key = sharedPartitionKey(partition);
    const group = groups.get(key) || [];
    group.push({ partition, partitionIndex });
    groups.set(key, group);
  }
  const batches = [];
  for (const entries of groups.values())
    for (
      let offset = 0;
      offset < entries.length;
      offset += maximumRequirementsPerRequest
    ) {
      const batchEntries = entries.slice(
        offset,
        offset + maximumRequirementsPerRequest
      );
      const identity = {
        promptContractId: PROMPT_CONTRACT_ID,
        absencePlanSha256: plan.planSha256,
        partitionIds: batchEntries.map(
          ({ partition }) => partition.partitionId
        ),
      };
      batches.push({
        batchId: `ABX-${sha256(stableStringify(identity)).slice(0, 24)}`,
        entries: batchEntries,
      });
    }
  return batches;
}

function jsonObjectsFromText(value) {
  const source = String(value || "");
  const objects = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (character !== "}" || depth === 0) continue;
    depth -= 1;
    if (depth !== 0 || start < 0) continue;
    try {
      objects.push(JSON.parse(source.slice(start, index + 1)));
    } catch {
      // The strict parser still owns acceptance; this scanner only preserves
      // validated positive conflict signals from otherwise malformed output.
    }
    start = -1;
  }
  return objects;
}

function positiveCandidateSignals({ rawResponse, plan, partition }) {
  const candidateIds = [];
  for (const response of jsonObjectsFromText(rawResponse)) {
    try {
      const validation = validateADrivenRequirementAbsencePartitionResponse({
        plan,
        partitionId: partition.partitionId,
        response,
      });
      if (
        validation.result.status === "TERMINAL" &&
        response.decision === "COUNTERPART_PRESENT"
      )
        candidateIds.push(...response.candidateIds);
    } catch {
      // Unknown IDs, wrong partitions and malformed objects are not signals.
    }
  }
  return [...new Set(candidateIds)].sort();
}

function normalizedSemanticText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("de-AT")
    .replace(/ß/gu, "ss")
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function hasMeaningfulIdentityOverlap(identityLabel, rationale) {
  const ignored = new Set([
    "aber",
    "alle",
    "auch",
    "dass",
    "diese",
    "einem",
    "einer",
    "eines",
    "eine",
    "einen",
    "entstehen",
    "gilt",
    "jedenfalls",
    "oder",
    "sind",
    "unter",
    "versichert",
    "welche",
    "werden",
  ]);
  const tokens = normalizedSemanticText(identityLabel)
    .split(" ")
    .filter((token) => token.length >= 4 && !ignored.has(token));
  const rationaleTokens = new Set(normalizedSemanticText(rationale).split(" "));
  return (
    new Set(tokens.filter((token) => rationaleTokens.has(token))).size >= 2
  );
}

function negativeDecisionSemanticConflicts({ plan, partition, response }) {
  if (
    response?.decision !== "NO_COUNTERPART_IN_PARTITION" ||
    typeof response?.rationale !== "string"
  )
    return [];
  const rationale = normalizedSemanticText(response.rationale);
  const conflicts = [];
  if (
    /\bliegt\b\s+(?:(?:somit|daher|damit)\s+)?\bein\b\s+\bgegenstuck\b\s+\bvor\b/u.test(
      rationale
    ) ||
    /\bbesteht\b\s+(?:(?:somit|daher|damit)\s+)?\bein\b\s+\bgegenstuck\b/u.test(
      rationale
    ) ||
    /\bzahlt\b.{0,80}\bals\b.{0,30}\bgegenstuck\b/u.test(rationale) ||
    /\bstellt\b\s+(?:(?:somit|daher|damit)\s+)?\bein\b\s+\bgegenstuck\b\s+\bdar\b/u.test(
      rationale
    )
  )
    conflicts.push("RATIONALE_CONFIRMS_COUNTERPART");
  if (
    /\bein\b\s+\bausschluss\b\s+\bist\b\s+(?:aber\s+)?\bkein\b\s+\bgegenstuck\b/u.test(
      rationale
    ) ||
    /\b(?:ausschluss|ausschlussklausel)\b\s+\bzahlt\b\s+\bnicht\b\s+\bals\b\s+\bgegenstuck\b/u.test(
      rationale
    )
  )
    conflicts.push("EXCLUSION_WRONGLY_REJECTED_AS_COUNTERPART");

  const requirement = plan.requirements.find(
    ({ requirementId }) => requirementId === partition.requirementId
  );
  const mentionsAllowedCandidate = partition.candidateIds.some((candidateId) =>
    rationale.includes(normalizedSemanticText(candidateId))
  );
  const acknowledgedCandidateText =
    /\b(?:enthalt|regelt|behandelt|betrifft)\b\s+\bzwar\b.{0,300}/u.exec(
      rationale
    )?.[0] || "";
  const meaningfullyOverlapsIdentity = (requirement?.components || [])
    .filter(({ identityCore, label }) => identityCore && label)
    .some(({ label }) =>
      hasMeaningfulIdentityOverlap(label, acknowledgedCandidateText)
    );
  const namesModifierDifference =
    /\b(?:bedingung|dauer|geltung|umfang|wert|limit|zeitraum|befristung)\b/u.test(
      rationale
    );
  const deniesOnlyBecauseModifier =
    /\b(?:jedoch|aber)\b.{0,420}\b(?:keine regelung|fehlt|nicht geregelt|kein gegenstuck)\b/u.test(
      rationale
    ) ||
    /\b(?:keine regelung|fehlt)\b.{0,240}\b(?:bedingung|dauer|geltung|umfang|wert|limit|zeitraum|befristung)\b/u.test(
      rationale
    );
  if (
    mentionsAllowedCandidate &&
    acknowledgedCandidateText &&
    meaningfullyOverlapsIdentity &&
    namesModifierDifference &&
    deniesOnlyBecauseModifier
  )
    conflicts.push("SAME_ELEMENT_REJECTED_ONLY_FOR_MODIFIER_DIFFERENCE");
  const describesExplicitExclusion =
    /\b(?:schliesst|schliessen|ausgeschlossen|ausschluss)\b.{0,240}\b(?:explizit|ausgeschlossen|aus)\b/u.test(
      rationale
    );
  const rejectsForMissingPositiveEffect =
    /\b(?:keine|kein|fehlt|nicht)\b.{0,120}\bpositive\b.{0,80}\b(?:deckung|versicherungsschutz|wirkung)\b/u.test(
      rationale
    ) || /\bnicht\b.{0,80}\bals\b.{0,40}\bversichert\b/u.test(rationale);
  if (
    mentionsAllowedCandidate &&
    describesExplicitExclusion &&
    rejectsForMissingPositiveEffect
  )
    conflicts.push("EXPLICIT_EXCLUSION_REJECTED_FOR_POSITIVE_EFFECT");
  return [...new Set(conflicts)].sort();
}

function normalizeSemanticContractConflictForReview({
  partition,
  response,
  semanticContractConflicts,
}) {
  if (
    response?.decision !== "NO_COUNTERPART_IN_PARTITION" ||
    typeof response?.rationale !== "string" ||
    !Array.isArray(semanticContractConflicts) ||
    semanticContractConflicts.length === 0
  )
    return null;
  const reviewableConflicts = new Set([
    "RATIONALE_CONFIRMS_COUNTERPART",
    "EXCLUSION_WRONGLY_REJECTED_AS_COUNTERPART",
    "SAME_ELEMENT_REJECTED_ONLY_FOR_MODIFIER_DIFFERENCE",
    "EXPLICIT_EXCLUSION_REJECTED_FOR_POSITIVE_EFFECT",
  ]);
  if (
    semanticContractConflicts.some(
      (conflict) => !reviewableConflicts.has(conflict)
    )
  )
    return null;
  const rationale = normalizedSemanticText(response.rationale);
  const candidateIds = partition.candidateIds.filter((candidateId) =>
    rationale.includes(normalizedSemanticText(candidateId))
  );
  if (candidateIds.length === 0) return null;
  return {
    response: {
      ...response,
      decision: "COUNTERPART_PRESENT",
      candidateIds,
    },
    audit: {
      fromDecision: response.decision,
      toDecision: "COUNTERPART_PRESENT",
      candidateIds,
      semanticContractConflicts: [...semanticContractConflicts].sort(),
      effect: "ROUTE_TO_COMPONENT_RESCUE_REVIEW",
    },
  };
}

function retryInstruction(attempts) {
  const previous = attempts.at(-1);
  if (!previous) return null;
  const observedPositiveCandidateIds = [
    ...new Set(
      attempts.flatMap(({ positiveCandidateSignals: signals }) => signals || [])
    ),
  ].sort();
  const positiveConflictInstruction = observedPositiveCandidateIds.length
    ? `Ein früherer ungültiger Versuch enthielt einen vertragsgültigen Positivhinweis für diese vorgelegten candidateIds: ${observedPositiveCandidateIds.join(
        ", "
      )}. Prüfe diese IDs ausdrücklich; sie dürfen durch eine spätere Negativantwort nicht still verschwinden.`
    : null;
  if (previous.errorClass === "MODEL_RESPONSE_INVALID") {
    const messages = [
      "KORREKTUR FÜR DIESEN RETRY:",
      "Die vorige Antwort war kein einzelner gültiger JSON-Wert.",
      "Entscheide zuerst endgültig und gib danach genau ein einziges JSON-Objekt aus.",
      "Keine Analyse, Selbstkorrektur, Markdown-Markierung oder weitere JSON-Variante vor oder nach diesem Objekt.",
      "Das Objekt muss ausschließlich partitionId, decision, candidateIds und rationale enthalten.",
    ];
    if (positiveConflictInstruction) messages.push(positiveConflictInstruction);
    return messages.join(" ");
  }
  if (previous.errorClass === "POSITIVE_SIGNAL_CONFLICT")
    return [
      "KORREKTUR FÜR DIESEN RETRY:",
      positiveConflictInstruction,
      "Die vorige saubere Negativantwort genügt wegen dieses Konflikts noch nicht zur Abwesenheitszertifizierung. Entscheide erneut source-bound und gib genau ein einziges finales JSON-Objekt ohne Begleittext aus.",
    ]
      .filter(Boolean)
      .join(" ");
  if (previous.errorClass === "SEMANTIC_CONTRACT_CONFLICT")
    return [
      "KORREKTUR FÜR DIESEN RETRY:",
      `Die vorige Negativantwort widersprach dem Gegenstückvertrag (${(
        previous.semanticContractConflicts || []
      ).join(", ")}).`,
      "Entscheide zuerst ausschließlich die Identität des fachlichen Elements: Nennt oder regelt eine Klausel denselben Gegenstand, dieselbe Gefahr oder dieselbe Faktrolle?",
      "Erst danach bewerte Wirkung und Modifier. Ein ausdrücklicher Ausschluss sowie abweichende Werte, Limits, Bedingungen, Umfänge oder zeitliche Geltung bleiben ein Gegenstück.",
      "Eine bloße Keyword-Nennung oder ein nur verwandter anderer Kern bleibt dagegen NO_COUNTERPART_IN_PARTITION.",
      "Gib genau ein einziges finales JSON-Objekt ohne Begleittext aus.",
    ].join(" ");
  if (previous.validation?.result?.status !== "TERMINAL")
    return [
      "KORREKTUR FÜR DIESEN RETRY:",
      "Die vorige Antwort war nicht terminal vertragsgültig.",
      "Prüfe partitionId, decision und candidateIds erneut und gib genau ein einziges finales JSON-Objekt ohne Begleittext aus.",
    ].join(" ");
  return null;
}

function prompt(plan, partition, repair = null) {
  const requirement = plan.requirements.find(
    ({ requirementId }) => requirementId === partition.requirementId
  );
  const allowed = new Set(partition.candidateIds);
  const candidates = plan.candidates.filter(({ candidateId }) =>
    allowed.has(candidateId)
  );
  const messages = [
    {
      role: "system",
      content:
        "Du prüfst eine vollständige, servergebundene Partition originaler B-Klauseln gegen genau eine dynamisch aus A ermittelte Anforderung. Entscheide nur, ob mindestens eine vorgelegte Klausel ein Gegenstück zum selben fachlichen Kern enthält. Abweichende Werte, Limits, Bedingungen, Umfänge oder ein ausdrücklicher Ausschluss zählen als Gegenstück. Ein ausdrücklich umfassender Oberbegriff kann den enger benannten Unterfall aus A abdecken, wenn Kontext und fachliche Rolle übereinstimmen; verlange dann nicht den identischen Spezialwortlaut. Eine funktional gleiche Vertragswirkung zählt ebenfalls, auch wenn Maßnahme oder Formulierung abweichen: Eine allgemein versicherte sinnvolle Maßnahme zur Abwendung eines unmittelbar drohenden Schadens kann beispielsweise Gegenstück zu einer enger benannten Präventionsmaßnahme sein. Dagegen genügt eine gleiche allgemeine Rechtsfolge nicht, wenn sie an einen anderen Gegenstand, Vorgang oder Auslöser gebunden ist. Konstruiere keine ungeschriebene Ausnahme, Deckung oder Rechtsfolge aus Branchenwissen oder nur benachbarten Klauseln. Keyword-Nennung, Überschrift, ähnlicher wirtschaftlicher Zweck oder nur verwandte Deckung zählen nicht. Antworte ausschließlich als genau ein JSON-Objekt: {partitionId,decision,candidateIds,rationale}. Eine fehlende Antwort, ein leeres Array oder mehrere Objekte sind immer ungültig. Auch wenn kein Gegenstück vorhanden ist, musst du genau ein Objekt mit der vorgegebenen partitionId, decision NO_COUNTERPART_IN_PARTITION und candidateIds [] ausgeben. Bei COUNTERPART_PRESENT nenne die kleinste notwendige Menge eindeutiger vorgelegter candidateIds. Erfinde keine IDs, Quellen oder Tatsachen.",
    },
    {
      role: "user",
      content: JSON.stringify({
        contractId: A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_CONTRACT_ID,
        promptContractId: PROMPT_CONTRACT_ID,
        partitionId: partition.partitionId,
        requirement,
        candidates,
      }),
    },
  ];
  if (repair) messages.push({ role: "user", content: repair });
  return messages;
}

function promptBatch(plan, entries, repair = null) {
  if (!Array.isArray(entries) || entries.length === 0)
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_PROMPT_BATCH_INVALID");
  const [first] = entries;
  const sharedKey = sharedPartitionKey(first.partition);
  if (entries.some(({ partition }) => sharedPartitionKey(partition) !== sharedKey))
    throw new Error(
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PROMPT_BATCH_CONTEXT_MISMATCH"
    );
  const allowed = new Set(first.partition.candidateIds);
  const candidates = plan.candidates.filter(({ candidateId }) =>
    allowed.has(candidateId)
  );
  const reviews = entries.map(({ partition }) => ({
    partitionId: partition.partitionId,
    requirement: plan.requirements.find(
      ({ requirementId }) => requirementId === partition.requirementId
    ),
  }));
  const messages = [
    {
      role: "system",
      content:
        "Du prüfst eine vollständige, servergebundene Partition originaler B-Klauseln unabhängig gegen mehrere dynamisch aus A ermittelte Anforderungen. Entscheide für jede review.partitionId separat, ob mindestens eine vorgelegte Klausel ein Gegenstück zum selben fachlichen Kern enthält. Abweichende Werte, Limits, Bedingungen, Umfänge oder ein ausdrücklicher Ausschluss zählen als Gegenstück. Ein ausdrücklich umfassender Oberbegriff kann den enger benannten Unterfall aus A abdecken, wenn Kontext und fachliche Rolle übereinstimmen; verlange dann nicht den identischen Spezialwortlaut. Eine funktional gleiche Vertragswirkung zählt ebenfalls, auch wenn Maßnahme oder Formulierung abweichen. Dagegen genügt eine gleiche allgemeine Rechtsfolge nicht, wenn sie an einen anderen Gegenstand, Vorgang oder Auslöser gebunden ist. Konstruiere keine ungeschriebene Ausnahme, Deckung oder Rechtsfolge. Keyword-Nennung, Überschrift, ähnlicher wirtschaftlicher Zweck oder nur verwandte Deckung zählen nicht. Antworte ausschließlich als genau ein JSON-Array mit genau einem Objekt je vorgegebener review.partitionId: [{partitionId,decision,candidateIds,rationale}]. Keine partitionId darf fehlen, doppelt vorkommen oder erfunden werden. Die Reihenfolge muss der Reihenfolge von reviews entsprechen. Auch bei NO_COUNTERPART_IN_PARTITION ist das Objekt zwingend und candidateIds muss [] sein. Bei COUNTERPART_PRESENT nenne die kleinste notwendige Menge eindeutiger vorgelegter candidateIds. Erfinde keine IDs, Quellen oder Tatsachen.",
    },
    {
      role: "user",
      content: JSON.stringify({
        contractId: A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_CONTRACT_ID,
        promptContractId: PROMPT_CONTRACT_ID,
        reviews,
        candidates,
      }),
    },
  ];
  if (repair) messages.push({ role: "user", content: repair });
  return messages;
}

function batchRetryInstruction(attempts) {
  const previous = attempts.at(-1);
  if (!previous) return null;
  const positiveSignals = new Map();
  for (const attempt of attempts)
    for (const outcome of attempt.partitionOutcomes || []) {
      const signals = positiveSignals.get(outcome.partitionId) || new Set();
      for (const candidateId of outcome.positiveCandidateSignals || [])
        signals.add(candidateId);
      positiveSignals.set(outcome.partitionId, signals);
    }
  const signalText = [...positiveSignals.entries()]
    .filter(([, signals]) => signals.size > 0)
    .map(
      ([partitionId, signals]) =>
        `${partitionId}: ${[...signals].sort().join(", ")}`
    )
    .join("; ");
  return [
    "KORREKTUR FÜR DIESEN RETRY:",
    "Die vorige Batch-Antwort war nicht für alle review.partitionIds terminal vertragsgültig.",
    "Gib genau ein JSON-Array mit genau einem Objekt je vorgegebener partitionId in der vorgegebenen Reihenfolge aus; keine ID darf fehlen, doppelt sein oder hinzukommen.",
    "Entscheide jeden fachlichen Kern unabhängig. Ein ausdrücklicher Ausschluss sowie abweichende Werte, Limits, Bedingungen, Umfänge oder zeitliche Geltung bleiben ein Gegenstück.",
    signalText
      ? `Frühere ungültige Versuche enthielten vertragsgültige Positivhinweise, die nicht still verschwinden dürfen: ${signalText}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function errorClass(error) {
  if (typeof error?.errorClass === "string") return error.errorClass;
  if (error?.name === "AbortError") return "MODEL_REQUEST_ABORTED";
  return "MODEL_RESPONSE_INVALID";
}

async function verifyModel({ baseUrl, model, modelContext }) {
  const apiRoot = baseUrl.replace(/\/v1\/?$/u, "");
  const response = await fetch(`${apiRoot}/api/v0/models`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(
      `LF_A_DRIVEN_REQUIREMENT_ABSENCE_MODEL_LIST_FAILED:${response.status}`
    );
  const body = await response.json();
  const loaded = body?.data?.find(
    ({ id, type, state }) =>
      id === model && type === "llm" && state === "loaded"
  );
  if (!loaded || Number(loaded.loaded_context_length) !== Number(modelContext))
    throw new Error(
      `LF_A_DRIVEN_REQUIREMENT_ABSENCE_MODEL_NOT_EXACTLY_LOADED:${model}:${modelContext}`
    );
  return {
    id: loaded.id,
    state: loaded.state,
    loadedContextLength: Number(loaded.loaded_context_length),
  };
}

async function runPartition({
  client,
  model,
  modelContext,
  plan,
  partition,
  maximumAttempts,
  requestTimeoutMs,
  abortSettlementTimeoutMs,
  recoverModelAfterAbort,
  onAttempt = async () => {},
}) {
  const attempts = [];
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const messages = prompt(plan, partition, retryInstruction(attempts));
    const started = performance.now();
    let rawResponse = "";
    try {
      const completion = await requestCompletionWithTimeout({
        client,
        payload: {
          model,
          messages,
          temperature: 0,
          max_tokens: Math.min(4_000, Math.max(1_000, modelContext / 6)),
        },
        requestTimeoutMs,
        abortSettlementTimeoutMs,
        recoverModelAfterAbort,
      });
      rawResponse = completion.choices?.[0]?.message?.content || "";
      const parsed = parseSingleDecision(rawResponse);
      const observedResponse = {
        ...parsed,
        candidateIds: Array.isArray(parsed?.candidateIds)
          ? [...new Set(parsed.candidateIds)]
          : parsed?.candidateIds,
      };
      const initialValidation =
        validateADrivenRequirementAbsencePartitionResponse({
          plan,
          partitionId: partition.partitionId,
          response: observedResponse,
        });
      const semanticContractConflicts =
        initialValidation.result.status === "TERMINAL"
          ? negativeDecisionSemanticConflicts({
              plan,
              partition,
              response: observedResponse,
            })
          : [];
      const semanticReviewNormalization =
        normalizeSemanticContractConflictForReview({
          partition,
          response: observedResponse,
          semanticContractConflicts,
        });
      const response =
        semanticReviewNormalization?.response || observedResponse;
      const validation = semanticReviewNormalization
        ? validateADrivenRequirementAbsencePartitionResponse({
            plan,
            partitionId: partition.partitionId,
            response,
          })
        : initialValidation;
      const observedPositiveCandidateIds = [
        ...new Set(
          attempts.flatMap(
            ({ positiveCandidateSignals: signals }) => signals || []
          )
        ),
      ].sort();
      const positiveSignalConflict =
        response.decision === "NO_COUNTERPART_IN_PARTITION" &&
        observedPositiveCandidateIds.length > 0 &&
        !attempts.some(
          ({ errorClass: priorErrorClass }) =>
            priorErrorClass === "POSITIVE_SIGNAL_CONFLICT"
        );
      const semanticContractConflict =
        semanticContractConflicts.length > 0 && !semanticReviewNormalization;
      const attemptRecord = {
        attempt,
        durationMs: Math.round(performance.now() - started),
        errorClass: semanticContractConflict
          ? "SEMANTIC_CONTRACT_CONFLICT"
          : positiveSignalConflict
            ? "POSITIVE_SIGNAL_CONFLICT"
            : null,
        timedOut: false,
        abortTriggered: false,
        responseModel: completion.model || null,
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        rawResponse,
        rawResponseSha256: sha256(rawResponse),
        observedResponse,
        response,
        validation,
        semanticContractConflicts,
        semanticContractReviewNormalization:
          semanticReviewNormalization?.audit || null,
        positiveCandidateSignals: observedPositiveCandidateIds,
      };
      attempts.push(attemptRecord);
      await onAttempt(attemptRecord);
      if (semanticContractConflict || positiveSignalConflict) continue;
      if (validation.result.status === "TERMINAL")
        return {
          schemaVersion: 1,
          contractId: RUN_CONTRACT_ID,
          absencePlanSha256: plan.planSha256,
          promptContractId: PROMPT_CONTRACT_ID,
          transportContractId: TRANSPORT_CONTRACT_ID,
          requestedModel: model,
          modelContext,
          requestTimeoutMs,
          abortSettlementTimeoutMs,
          partitionId: partition.partitionId,
          response,
          validation,
          rawResponse,
          rawResponseSha256: sha256(rawResponse),
          attempts,
        };
    } catch (error) {
      const attemptRecord = {
        attempt,
        durationMs: Math.round(performance.now() - started),
        errorClass: errorClass(error),
        timedOut: error?.telemetry?.timedOut === true,
        timeoutMs: error?.telemetry?.timeoutMs || requestTimeoutMs,
        abortTriggered: error?.telemetry?.abortTriggered === true,
        requestSettledAfterAbort:
          error?.telemetry?.requestSettledAfterAbort ?? null,
        settlementDurationMs: error?.telemetry?.settlementDurationMs ?? null,
        recovery: error?.telemetry?.recovery || null,
        rawResponse,
        rawResponseSha256: sha256(rawResponse),
        response: null,
        validation: null,
        positiveCandidateSignals: positiveCandidateSignals({
          rawResponse,
          plan,
          partition,
        }),
        error: error.message,
      };
      attempts.push(attemptRecord);
      await onAttempt(attemptRecord);
      if (error.retrySafe === false) break;
    }
  }
  const error = new Error(
    `LF_A_DRIVEN_REQUIREMENT_ABSENCE_PARTITION_FAILED_CLOSED:${partition.partitionId}`
  );
  error.attempts = attempts;
  throw error;
}

async function runPartitionBatch({
  client,
  model,
  modelContext,
  plan,
  batch,
  maximumAttempts,
  requestTimeoutMs,
  abortSettlementTimeoutMs,
  recoverModelAfterAbort,
  onAttempt = async () => {},
}) {
  if (!batch?.batchId || !Array.isArray(batch.entries) || !batch.entries.length)
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_REQUEST_BATCH_INVALID");
  const expectedPartitionIds = batch.entries.map(
    ({ partition }) => partition.partitionId
  );
  const attempts = [];
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const messages = promptBatch(
      plan,
      batch.entries,
      batchRetryInstruction(attempts)
    );
    const started = performance.now();
    let rawResponse = "";
    try {
      const completion = await requestCompletionWithTimeout({
        client,
        payload: {
          model,
          messages,
          temperature: 0,
          max_tokens: Math.min(8_000, Math.max(2_000, modelContext / 4)),
        },
        requestTimeoutMs,
        abortSettlementTimeoutMs,
        recoverModelAfterAbort,
      });
      rawResponse = completion.choices?.[0]?.message?.content || "";
      const parsedResponses = parseDecisionBatch(
        rawResponse,
        expectedPartitionIds
      );
      const partitionOutcomes = batch.entries.map(
        ({ partition }, partitionOffset) => {
          const parsed = parsedResponses[partitionOffset];
          const observedResponse = {
            ...parsed,
            candidateIds: Array.isArray(parsed?.candidateIds)
              ? [...new Set(parsed.candidateIds)]
              : parsed?.candidateIds,
          };
          const initialValidation =
            validateADrivenRequirementAbsencePartitionResponse({
              plan,
              partitionId: partition.partitionId,
              response: observedResponse,
            });
          const semanticContractConflicts =
            initialValidation.result.status === "TERMINAL"
              ? negativeDecisionSemanticConflicts({
                  plan,
                  partition,
                  response: observedResponse,
                })
              : [];
          const semanticReviewNormalization =
            normalizeSemanticContractConflictForReview({
              partition,
              response: observedResponse,
              semanticContractConflicts,
            });
          const response =
            semanticReviewNormalization?.response || observedResponse;
          const validation = semanticReviewNormalization
            ? validateADrivenRequirementAbsencePartitionResponse({
                plan,
                partitionId: partition.partitionId,
                response,
              })
            : initialValidation;
          const observedPositiveCandidateIds = [
            ...new Set(
              attempts.flatMap(
                ({ partitionOutcomes: priorOutcomes }) =>
                  priorOutcomes?.find(
                    ({ partitionId }) => partitionId === partition.partitionId
                  )?.positiveCandidateSignals || []
              )
            ),
          ].sort();
          const currentPositiveCandidateIds =
            response.decision === "COUNTERPART_PRESENT" &&
            Array.isArray(response.candidateIds)
              ? response.candidateIds
              : [];
          const positiveSignalConflict =
            response.decision === "NO_COUNTERPART_IN_PARTITION" &&
            observedPositiveCandidateIds.length > 0 &&
            !attempts.some(({ partitionOutcomes: priorOutcomes }) =>
              priorOutcomes?.some(
                (outcome) =>
                  outcome.partitionId === partition.partitionId &&
                  outcome.errorClass === "POSITIVE_SIGNAL_CONFLICT"
              )
            );
          const semanticContractConflict =
            semanticContractConflicts.length > 0 &&
            !semanticReviewNormalization;
          return {
            partitionId: partition.partitionId,
            errorClass: semanticContractConflict
              ? "SEMANTIC_CONTRACT_CONFLICT"
              : positiveSignalConflict
                ? "POSITIVE_SIGNAL_CONFLICT"
                : validation.result.status === "TERMINAL"
                  ? null
                  : "PARTITION_RESPONSE_INVALID",
            observedResponse,
            response,
            validation,
            semanticContractConflicts,
            semanticContractReviewNormalization:
              semanticReviewNormalization?.audit || null,
            positiveCandidateSignals: [
              ...new Set([
                ...observedPositiveCandidateIds,
                ...currentPositiveCandidateIds,
              ]),
            ].sort(),
          };
        }
      );
      const attemptRecord = {
        batchId: batch.batchId,
        attempt,
        durationMs: Math.round(performance.now() - started),
        errorClass: partitionOutcomes.some(({ errorClass: value }) => value)
          ? "BATCH_PARTITION_INVALID"
          : null,
        timedOut: false,
        abortTriggered: false,
        responseModel: completion.model || null,
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        rawResponse,
        rawResponseSha256: sha256(rawResponse),
        partitionOutcomes,
      };
      attempts.push(attemptRecord);
      await onAttempt(attemptRecord);
      if (partitionOutcomes.every(({ errorClass: value }) => !value))
        return {
          batchId: batch.batchId,
          attempts,
          results: batch.entries.map(({ partition }, partitionOffset) => {
            const outcome = partitionOutcomes[partitionOffset];
            return {
              schemaVersion: 1,
              contractId: RUN_CONTRACT_ID,
              absencePlanSha256: plan.planSha256,
              promptContractId: PROMPT_CONTRACT_ID,
              transportContractId: TRANSPORT_CONTRACT_ID,
              requestedModel: model,
              modelContext,
              requestTimeoutMs,
              abortSettlementTimeoutMs,
              batchId: batch.batchId,
              partitionId: partition.partitionId,
              response: outcome.response,
              validation: outcome.validation,
              rawResponse,
              rawResponseSha256: sha256(rawResponse),
              attempts: attempts.map((batchAttempt) => ({
                batchId: batch.batchId,
                attempt: batchAttempt.attempt,
                durationMs: batchAttempt.durationMs,
                errorClass:
                  batchAttempt.partitionOutcomes.find(
                    ({ partitionId }) => partitionId === partition.partitionId
                  )?.errorClass || batchAttempt.errorClass,
                promptTokens: batchAttempt.promptTokens || 0,
                completionTokens: batchAttempt.completionTokens || 0,
                totalTokens: batchAttempt.totalTokens || 0,
              })),
              semanticContractReviewNormalization:
                outcome.semanticContractReviewNormalization,
            };
          }),
        };
    } catch (error) {
      const partitionOutcomes = batch.entries.map(({ partition }) => ({
        partitionId: partition.partitionId,
        errorClass: errorClass(error),
        response: null,
        validation: null,
        positiveCandidateSignals: positiveCandidateSignals({
          rawResponse,
          plan,
          partition,
        }),
      }));
      const attemptRecord = {
        batchId: batch.batchId,
        attempt,
        durationMs: Math.round(performance.now() - started),
        errorClass: errorClass(error),
        timedOut: error?.telemetry?.timedOut === true,
        timeoutMs: error?.telemetry?.timeoutMs || requestTimeoutMs,
        abortTriggered: error?.telemetry?.abortTriggered === true,
        requestSettledAfterAbort:
          error?.telemetry?.requestSettledAfterAbort ?? null,
        settlementDurationMs: error?.telemetry?.settlementDurationMs ?? null,
        recovery: error?.telemetry?.recovery || null,
        rawResponse,
        rawResponseSha256: sha256(rawResponse),
        partitionOutcomes,
        error: error.message,
      };
      attempts.push(attemptRecord);
      await onAttempt(attemptRecord);
      if (error.retrySafe === false) break;
    }
  }
  const error = new Error(
    `LF_A_DRIVEN_REQUIREMENT_ABSENCE_BATCH_FAILED_CLOSED:${batch.batchId}`
  );
  error.attempts = attempts;
  throw error;
}

function resultFile(output, partition, partitionIndex) {
  return path.join(
    output,
    "partitions",
    `${String(partitionIndex).padStart(5, "0")}-${partition.partitionId}.private.json`
  );
}

function existingResult(file, plan, partition, args) {
  const result = readJson(file, "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PARTITION");
  if (
    result?.contractId !== RUN_CONTRACT_ID ||
    result.absencePlanSha256 !== plan.planSha256 ||
    result.promptContractId !== PROMPT_CONTRACT_ID ||
    result.transportContractId !== TRANSPORT_CONTRACT_ID ||
    result.requestedModel !== args.model ||
    result.modelContext !== args.modelContext ||
    result.requestTimeoutMs !== args.requestTimeoutMs ||
    result.abortSettlementTimeoutMs !== args.abortSettlementTimeoutMs ||
    result.partitionId !== partition.partitionId ||
    typeof result.rawResponse !== "string" ||
    result.rawResponseSha256 !== sha256(result.rawResponse)
  )
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_RESULT_INVALID");
  const validation = validateADrivenRequirementAbsencePartitionResponse({
    plan,
    partitionId: partition.partitionId,
    response: result.response,
  });
  const semanticContractConflicts = negativeDecisionSemanticConflicts({
    plan,
    partition,
    response: result.response,
  });
  if (
    validation.result.status !== "TERMINAL" ||
    stableStringify(validation) !== stableStringify(result.validation) ||
    semanticContractConflicts.length > 0
  )
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_RESULT_NOT_PASS");
  return result;
}

function batchAttemptRecorder({ output, plan, batch, args }) {
  const directory = path.join(output, "attempts", "batches", batch.batchId);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const cycle = fs.readdirSync(directory).length + 1;
  return async (attempt) =>
    writePrivateJson(
      path.join(
        directory,
        `cycle-${String(cycle).padStart(3, "0")}-attempt-${String(
          attempt.attempt
        ).padStart(3, "0")}.private.json`
      ),
      {
        schemaVersion: 1,
        contractId: TRANSPORT_CONTRACT_ID,
        absencePlanSha256: plan.planSha256,
        promptContractId: PROMPT_CONTRACT_ID,
        requestedModel: args.model,
        modelContext: args.modelContext,
        requestTimeoutMs: args.requestTimeoutMs,
        abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
        modelRecoveryTimeoutMs: args.modelRecoveryTimeoutMs,
        batchId: batch.batchId,
        partitionIds: batch.entries.map(
          ({ partition }) => partition.partitionId
        ),
        attempt,
      }
    );
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  const sourcePlan = readJson(
    args.decisionPlan,
    "LF_A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_PLAN"
  );
  const sourceBatch = args.preliminaryBatch
    ? readJson(
        args.preliminaryBatch,
        "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PRELIMINARY_BATCH"
      )
    : null;
  const sourceDecisions = args.preliminaryDecisions
    ? readJson(
        args.preliminaryDecisions,
        "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PRELIMINARY_DECISIONS"
      )
    : null;
  const completeCorpus = readJson(
    args.completeCorpus,
    "LF_A_DRIVEN_REQUIREMENT_ABSENCE_COMPLETE_CORPUS"
  );
  const preliminary = sourceDecisions
    ? preliminaryDecisionArtifact(sourcePlan, sourceDecisions)
    : preliminaryDecision(sourcePlan, sourceBatch);
  const plan = buildADrivenRequirementAbsencePlan({
    decisionPlan: preliminary.subset,
    preliminaryDecisions: preliminary.decisions,
    completeCorpus,
    maximumPartitionCharacters: args.maximumPartitionCharacters,
  });
  if (fs.existsSync(args.output)) {
    const stat = fs.lstatSync(args.output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_OUTPUT_INVALID");
  } else fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
  writeOrVerifyPrivateJson(
    path.join(args.output, "absence-plan.private.json"),
    plan,
    "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_RESUME_MISMATCH"
  );
  const seedResponses = compatibleSeedFromOutput({
    seedOutput: args.seedOutput,
    plan,
    args,
  });
  const baseUrl = process.env.LMSTUDIO_BASE_PATH || "http://127.0.0.1:1234/v1";
  const loadedModel = await verifyModel({
    baseUrl,
    model: args.model,
    modelContext: args.modelContext,
  });
  const client = new OpenAI({
    baseURL: baseUrl,
    apiKey: "lm-studio",
    maxRetries: 0,
  });
  const recoverModelAfterAbort = createLmStudioRecovery({
    baseUrl,
    model: args.model,
    modelContext: args.modelContext,
    lmStudioSdk: args.lmStudioSdk,
    qwenModelKey: args.qwenModelKey,
    modelRecoveryTimeoutMs: args.modelRecoveryTimeoutMs,
  });
  const results = new Array(plan.partitions.length).fill(null);
  let newPartitions = 0;
  let seededPartitions = 0;
  let newRequests = 0;
  const startedAt = new Date().toISOString();
  const started = performance.now();
  for (const [partitionIndex, partition] of plan.partitions.entries()) {
    const file = resultFile(args.output, partition, partitionIndex);
    if (fs.existsSync(file)) {
      results[partitionIndex] = existingResult(file, plan, partition, args);
    } else if (seedResponses.has(partition.partitionId)) {
      results[partitionIndex] = seedResponses.get(partition.partitionId);
      writePrivateJson(file, results[partitionIndex]);
      seededPartitions += 1;
    }
  }
  const pending = plan.partitions.filter(
    (_partition, partitionIndex) => !results[partitionIndex]
  );
  const allowedPending =
    args.maximumNewPartitions === null
      ? pending
      : pending.slice(0, args.maximumNewPartitions);
  const batches = allowedPending.length
    ? buildPartitionRequestBatches({
        plan,
        partitions: allowedPending,
        maximumRequirementsPerRequest: args.maximumRequirementsPerRequest,
      })
    : [];
  for (const [batchIndex, batch] of batches.entries()) {
    const batchResult = await runPartitionBatch({
      client,
      model: args.model,
      modelContext: args.modelContext,
      plan,
      batch,
      maximumAttempts: args.maximumAttempts,
      requestTimeoutMs: args.requestTimeoutMs,
      abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
      recoverModelAfterAbort,
      onAttempt: batchAttemptRecorder({
        output: args.output,
        plan,
        batch,
        args,
      }),
    });
    for (const [resultOffset, result] of batchResult.results.entries()) {
      const { partition, partitionIndex } = batch.entries[resultOffset];
      results[partitionIndex] = result;
      writePrivateJson(
        resultFile(args.output, partition, partitionIndex),
        result
      );
      newPartitions += 1;
    }
    newRequests += 1;
    console.log(
      `[lf-a-driven-requirement-absence] Anfrage ${batchIndex + 1}/${batches.length}: PASS (${batch.entries.length} Partitionen)`
    );
  }
  const completedPartitions = results.filter(Boolean).length;
  const complete = completedPartitions === plan.partitions.length;
  const nextPartitionIndex = results.findIndex((result) => !result);
  const checkpointBase = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    absencePlanSha256: plan.planSha256,
    promptContractId: PROMPT_CONTRACT_ID,
    requestedModel: args.model,
    modelContext: args.modelContext,
    completedPartitions,
    totalPartitions: plan.partitions.length,
    newPartitions,
    newRequests,
    seededPartitions,
    completedAt: new Date().toISOString(),
  };
  if (!complete) {
    writeCheckpoint(path.join(args.output, "checkpoint.private.json"), {
      ...checkpointBase,
      status: "CONTROLLED_PARTIAL",
      nextPartitionIndex,
      resumable: true,
    });
    console.log(
      `[lf-a-driven-requirement-absence] KONTROLLIERTER STOP: ${completedPartitions}/${plan.partitions.length}, Resume ab ${nextPartitionIndex + 1}`
    );
    return;
  }
  const decisions = validateADrivenRequirementAbsenceResponses({
    plan,
    responses: results.map(({ response }) => response),
  });
  if (decisions.summary.unresolved > 0)
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_FINAL_UNRESOLVED");
  const summary = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    absencePlanSha256: plan.planSha256,
    absenceDecisionSha256: decisions.decisionSha256,
    promptContractId: PROMPT_CONTRACT_ID,
    model: loadedModel,
    startedAt,
    completedAt: new Date().toISOString(),
    wallDurationMs: Math.round(performance.now() - started),
    modelAttempts: new Set(
      results.flatMap(({ attempts }) =>
        attempts.map(
          ({ batchId, attempt }) => `${batchId || "single"}:${attempt}`
        )
      )
    ).size,
    modelRequests: new Set(
      results.map(({ batchId }) => batchId).filter(Boolean)
    ).size,
    maximumRequirementsPerRequest: args.maximumRequirementsPerRequest,
    seededPartitions: results.filter(
      ({ reuse }) =>
        reuse?.contractId ===
        "LF_A_DRIVEN_REQUIREMENT_ABSENCE_VALIDATED_SEED_V1"
    ).length,
    ...decisions.summary,
  };
  writeOrVerifyPrivateJson(
    path.join(args.output, "absence-decisions.private.json"),
    decisions,
    "LF_A_DRIVEN_REQUIREMENT_ABSENCE_DECISIONS_RESUME_MISMATCH"
  );
  writeOrVerifyPrivateJson(
    path.join(args.output, "summary.private.json"),
    summary,
    "LF_A_DRIVEN_REQUIREMENT_ABSENCE_SUMMARY_RESUME_MISMATCH"
  );
  writeCheckpoint(path.join(args.output, "checkpoint.private.json"), {
    ...checkpointBase,
    status: "COMPLETE",
    nextPartitionIndex: null,
    resumable: false,
    absenceDecisionSha256: decisions.decisionSha256,
  });
}

if (require.main === module)
  run().catch((error) => fail(error.stack || error.message));

module.exports = {
  batchRetryInstruction,
  buildPartitionRequestBatches,
  compatibleSeedPartitionResponses,
  jsonObjectsFromText,
  negativeDecisionSemanticConflicts,
  normalizeSemanticContractConflictForReview,
  parseDecisionBatch,
  parseSingleDecision,
  positiveCandidateSignals,
  preliminaryDecision,
  preliminaryDecisionArtifact,
  prompt,
  promptBatch,
  retryInstruction,
  runPartition,
  runPartitionBatch,
  sharedPartitionKey,
  subsetDecisionPlan,
};
