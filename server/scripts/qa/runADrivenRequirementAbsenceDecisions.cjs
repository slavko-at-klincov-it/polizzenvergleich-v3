#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { OpenAI } = require("openai");
const {
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
  validateADrivenRequirementDecisionResponses,
} = require("../../utils/policyAnalysis/aDrivenRequirementCounterpartDecision");
const {
  A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_CONTRACT_ID,
  A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_CONTRACT_ID,
  buildADrivenRequirementAbsencePlan,
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
const PROMPT_CONTRACT_ID = "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PROMPT_V1";
const TRANSPORT_CONTRACT_ID = "LF_A_DRIVEN_REQUIREMENT_ABSENCE_TRANSPORT_V1";
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
    "completeCorpus",
    "output",
    "model",
    "modelContext",
    "maximumAttempts",
    "maximumPartitionCharacters",
    "requestTimeoutMs",
    "abortSettlementTimeoutMs",
    "modelRecoveryTimeoutMs",
    "maximumNewPartitions",
    "lmStudioSdk",
    "qwenModelKey",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of [
    "decisionPlan",
    "preliminaryBatch",
    "completeCorpus",
    "output",
    "lmStudioSdk",
    "qwenModelKey",
  ])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const integer = (name, fallback, minimum = 1) => {
    const parsed = Number(values[name] ?? fallback);
    if (!Number.isSafeInteger(parsed) || parsed < minimum)
      fail(`--${name} ist ungültig`);
    return parsed;
  };
  const result = {
    decisionPlan: path.resolve(values.decisionPlan),
    preliminaryBatch: path.resolve(values.preliminaryBatch),
    completeCorpus: path.resolve(values.completeCorpus),
    output: path.resolve(values.output),
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
  const subset = subsetDecisionPlan(
    plan,
    batch.responses.map(({ requirementId }) => requirementId)
  );
  const decisions = validateADrivenRequirementDecisionResponses({
    plan: subset,
    responses: batch.responses,
  });
  if (
    decisions.summary.unresolvedRequirements !== 0 ||
    decisions.summary.fallbackRequiredRequirements !== decisions.results.length
  )
    throw new Error(
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PRELIMINARY_NOT_FALLBACK"
    );
  return { subset, decisions };
}

function parseJsonArray(value) {
  const normalized = String(value || "")
    .replace(/<think>[\s\S]*?<\/think>/giu, "")
    .trim();
  const start = normalized.indexOf("[");
  const end = normalized.lastIndexOf("]");
  if (start < 0 || end < start)
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_JSON_ARRAY_MISSING");
  const parsed = JSON.parse(normalized.slice(start, end + 1));
  if (!Array.isArray(parsed))
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_RESPONSE_NOT_ARRAY");
  return parsed;
}

function prompt(plan, partition) {
  const requirement = plan.requirements.find(
    ({ requirementId }) => requirementId === partition.requirementId
  );
  const allowed = new Set(partition.candidateIds);
  const candidates = plan.candidates.filter(({ candidateId }) =>
    allowed.has(candidateId)
  );
  return [
    {
      role: "system",
      content:
        "Du prüfst eine vollständige, servergebundene Partition originaler B-Klauseln gegen genau eine dynamisch aus A ermittelte Anforderung. Entscheide nur, ob mindestens eine vorgelegte Klausel ein Gegenstück zum selben fachlichen Kern enthält. Abweichende Werte, Limits, Bedingungen, Umfänge oder ein ausdrücklicher Ausschluss zählen als Gegenstück. Keyword-Nennung, Überschrift oder nur verwandte Deckung zählen nicht. Antworte ausschließlich als JSON-Array mit genau einem Objekt: {partitionId,decision,candidateIds,rationale}. decision ist COUNTERPART_PRESENT oder NO_COUNTERPART_IN_PARTITION. Bei COUNTERPART_PRESENT nenne die kleinste notwendige Menge eindeutiger vorgelegter candidateIds; bei NO_COUNTERPART_IN_PARTITION ist candidateIds exakt []. Erfinde keine IDs, Quellen oder Tatsachen.",
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
    const messages = prompt(plan, partition);
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
      const parsed = parseJsonArray(rawResponse);
      if (parsed.length !== 1)
        throw new Error(
          "LF_A_DRIVEN_REQUIREMENT_ABSENCE_RESPONSE_COUNT_INVALID"
        );
      const response = {
        ...parsed[0],
        candidateIds: Array.isArray(parsed[0]?.candidateIds)
          ? [...new Set(parsed[0].candidateIds)]
          : parsed[0]?.candidateIds,
      };
      const validation = validateADrivenRequirementAbsencePartitionResponse({
        plan,
        partitionId: partition.partitionId,
        response,
      });
      const attemptRecord = {
        attempt,
        durationMs: Math.round(performance.now() - started),
        errorClass: null,
        timedOut: false,
        abortTriggered: false,
        responseModel: completion.model || null,
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        rawResponse,
        rawResponseSha256: sha256(rawResponse),
        response,
        validation,
      };
      attempts.push(attemptRecord);
      await onAttempt(attemptRecord);
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
  if (
    validation.result.status !== "TERMINAL" ||
    stableStringify(validation) !== stableStringify(result.validation)
  )
    throw new Error("LF_A_DRIVEN_REQUIREMENT_ABSENCE_RESULT_NOT_PASS");
  return result;
}

function attemptRecorder({ output, plan, partition, partitionIndex, args }) {
  const directory = path.join(
    output,
    "attempts",
    `${String(partitionIndex).padStart(5, "0")}-${partition.partitionId}`
  );
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
        partitionId: partition.partitionId,
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
  const sourceBatch = readJson(
    args.preliminaryBatch,
    "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PRELIMINARY_BATCH"
  );
  const completeCorpus = readJson(
    args.completeCorpus,
    "LF_A_DRIVEN_REQUIREMENT_ABSENCE_COMPLETE_CORPUS"
  );
  const preliminary = preliminaryDecision(sourcePlan, sourceBatch);
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
  const results = [];
  let newPartitions = 0;
  let nextPartitionIndex = null;
  const startedAt = new Date().toISOString();
  const started = performance.now();
  for (const [partitionIndex, partition] of plan.partitions.entries()) {
    const file = resultFile(args.output, partition, partitionIndex);
    let result;
    let reused = false;
    if (fs.existsSync(file)) {
      result = existingResult(file, plan, partition, args);
      reused = true;
    } else {
      if (
        args.maximumNewPartitions !== null &&
        newPartitions >= args.maximumNewPartitions
      ) {
        nextPartitionIndex = partitionIndex;
        break;
      }
      result = await runPartition({
        client,
        model: args.model,
        modelContext: args.modelContext,
        plan,
        partition,
        maximumAttempts: args.maximumAttempts,
        requestTimeoutMs: args.requestTimeoutMs,
        abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
        recoverModelAfterAbort,
        onAttempt: attemptRecorder({
          output: args.output,
          plan,
          partition,
          partitionIndex,
          args,
        }),
      });
      writePrivateJson(file, result);
      newPartitions += 1;
    }
    results.push(result);
    console.log(
      `[lf-a-driven-requirement-absence] Partition ${partitionIndex + 1}/${plan.partitions.length}: PASS${reused ? " (wiederverwendet)" : ""}`
    );
  }
  const complete = results.length === plan.partitions.length;
  const checkpointBase = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    absencePlanSha256: plan.planSha256,
    promptContractId: PROMPT_CONTRACT_ID,
    requestedModel: args.model,
    modelContext: args.modelContext,
    completedPartitions: results.length,
    totalPartitions: plan.partitions.length,
    newPartitions,
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
      `[lf-a-driven-requirement-absence] KONTROLLIERTER STOP: ${results.length}/${plan.partitions.length}, Resume ab ${nextPartitionIndex + 1}`
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
    model: loadedModel,
    startedAt,
    completedAt: new Date().toISOString(),
    wallDurationMs: Math.round(performance.now() - started),
    modelAttempts: results.reduce(
      (sum, result) => sum + result.attempts.length,
      0
    ),
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
  parseJsonArray,
  preliminaryDecision,
  prompt,
  runPartition,
  subsetDecisionPlan,
};
