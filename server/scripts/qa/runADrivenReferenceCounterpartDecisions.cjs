#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { OpenAI } = require("openai");
const {
  A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID,
  validateADrivenCounterpartSearchExecution,
} = require("../../utils/policyAnalysis/aDrivenCounterpartSearchPlan");
const {
  buildADrivenCounterpartDecisionPlan,
} = require("../../utils/policyAnalysis/aDrivenCounterpartDecisionPlan");
const {
  COUNTERPART_DECISION_CONTRACT_ID,
  validateCounterpartDecisions,
} = require("../../utils/policyAnalysis/referenceCounterpartDecisionContract");
const {
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  createLmStudioRecovery,
  requestCompletionWithTimeout,
} = require("./runADrivenReferenceClassification.cjs");

const RUN_CONTRACT_ID = "LF_A_DRIVEN_COUNTERPART_DECISION_RUN_V2";
const PREDECESSOR_RUN_CONTRACT_IDS = new Set([
  "LF_A_DRIVEN_COUNTERPART_DECISION_RUN_V1",
]);
const PROMPT_CONTRACT_ID = "LF_A_DRIVEN_COUNTERPART_DECISION_PROMPT_V1";
const TRANSPORT_CONTRACT_ID = "LF_A_DRIVEN_COUNTERPART_DECISION_TRANSPORT_V1";
const DEFAULT_MODEL = "qwen/qwen3.6-35b-a3b";
const DEFAULT_CONTEXT = 42_496;
const DEFAULT_MAXIMUM_PACKAGES = 4;
const DEFAULT_MAXIMUM_CHARACTERS = 30_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 180_000;
const DEFAULT_ABORT_SETTLEMENT_TIMEOUT_MS = 15_000;
const DEFAULT_MODEL_RECOVERY_TIMEOUT_MS = 180_000;
const MAXIMUM_ATTEMPTS = 8;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fail(message) {
  console.error(`[lf-a-driven-decisions] ${message}`);
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
    "searchExecution",
    "output",
    "model",
    "modelContext",
    "maximumAttempts",
    "maximumPackages",
    "maximumCharacters",
    "requestTimeoutMs",
    "abortSettlementTimeoutMs",
    "modelRecoveryTimeoutMs",
    "lmStudioSdk",
    "qwenModelKey",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of ["searchExecution", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const numbers = {
    modelContext: Number(values.modelContext || DEFAULT_CONTEXT),
    maximumAttempts: Number(values.maximumAttempts || 3),
    maximumPackages: Number(
      values.maximumPackages || DEFAULT_MAXIMUM_PACKAGES
    ),
    maximumCharacters: Number(
      values.maximumCharacters || DEFAULT_MAXIMUM_CHARACTERS
    ),
    requestTimeoutMs: Number(
      values.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS
    ),
    abortSettlementTimeoutMs: Number(
      values.abortSettlementTimeoutMs || DEFAULT_ABORT_SETTLEMENT_TIMEOUT_MS
    ),
    modelRecoveryTimeoutMs: Number(
      values.modelRecoveryTimeoutMs || DEFAULT_MODEL_RECOVERY_TIMEOUT_MS
    ),
  };
  if (
    !Number.isInteger(numbers.modelContext) ||
    numbers.modelContext < 1_000 ||
    !Number.isInteger(numbers.maximumAttempts) ||
    numbers.maximumAttempts < 1 ||
    numbers.maximumAttempts > MAXIMUM_ATTEMPTS ||
    !Number.isInteger(numbers.maximumPackages) ||
    numbers.maximumPackages < 1 ||
    !Number.isInteger(numbers.maximumCharacters) ||
    numbers.maximumCharacters < 1_000 ||
    !Number.isInteger(numbers.requestTimeoutMs) ||
    numbers.requestTimeoutMs < 1 ||
    !Number.isInteger(numbers.abortSettlementTimeoutMs) ||
    numbers.abortSettlementTimeoutMs < 1 ||
    !Number.isInteger(numbers.modelRecoveryTimeoutMs) ||
    numbers.modelRecoveryTimeoutMs < 1
  )
    fail("Numerische Laufparameter sind ungültig");
  if (!values.lmStudioSdk || !values.qwenModelKey)
    fail(
      "--lmStudioSdk und --qwenModelKey sind für sichere Timeouts erforderlich"
    );
  return {
    searchExecution: path.resolve(values.searchExecution),
    output: path.resolve(values.output),
    model: values.model || DEFAULT_MODEL,
    lmStudioSdk: path.resolve(values.lmStudioSdk),
    qwenModelKey: values.qwenModelKey,
    ...numbers,
  };
}

function errorClass(error) {
  if (typeof error?.errorClass === "string") return error.errorClass;
  if (error?.name === "AbortError") return "MODEL_REQUEST_ABORTED";
  return "MODEL_RESPONSE_INVALID";
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
    throw new Error(`LF_A_DRIVEN_DECISION_OUTPUT_EXISTS:${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function parseJsonArray(modelText) {
  const normalized = String(modelText || "")
    .replace(/<think>[\s\S]*?<\/think>/giu, "")
    .trim();
  const start = normalized.indexOf("[");
  const end = normalized.lastIndexOf("]");
  if (start < 0 || end < start)
    throw new Error("LF_A_DRIVEN_DECISION_RESPONSE_JSON_ARRAY_MISSING");
  const parsed = JSON.parse(normalized.slice(start, end + 1));
  if (!Array.isArray(parsed))
    throw new Error("LF_A_DRIVEN_DECISION_RESPONSE_NOT_ARRAY");
  return parsed;
}

function prompt(batch) {
  return [
    {
      role: "system",
      content:
        "Du prüfst kleine, servergebundene Kandidatenpakete aus Versicherungsdokumenten B gegen atomare Anforderungen aus Referenzpaket A. Antworte ausschließlich als JSON-Array mit exakt einem Objekt je expectedPackageId und keiner anderen ID. Erfinde keine Zitate, Seiten, IDs oder Tatsachen. Nutze ausschließlich compactCandidateId und die darin enthaltenen sourceSpans. Für jeden semanticCheck ist exakt ein dimensionCheck auszugeben: {checkId,dimension,outcome,candidateIds}. outcome ist MATCH, MISMATCH oder NOT_ESTABLISHED. MATCH verlangt einen ausdrücklichen, bedeutungsgleichen Beleg; ähnliche Wörter reichen nicht. Prüfe insbesondere Gegenstand, Gefahr, Wirkung/Negation, Scope, Rolle, Bedingung und Werte. MISMATCH verlangt einen ausdrücklichen Widerspruch im fachlich passenden Kontext. NOT_ESTABLISHED gilt, wenn die vorgelegten Kandidaten die Dimension nicht sicher belegen. decision ist ausschließlich SUPPORTED, CONTRADICTED oder NOT_SUPPORTED. SUPPORTED ist nur zulässig, wenn alle Checks MATCH sind. CONTRADICTED ist nur zulässig, wenn mindestens ein Check MISMATCH und kein Check NOT_ESTABLISHED ist. NOT_SUPPORTED ist zu verwenden, wenn mindestens ein Check NOT_ESTABLISHED und kein Check MISMATCH ist; vorhandene Teilbelege bleiben dabei als MATCH samt candidateIds erhalten. selectedCandidateIds ist exakt die sortierte Vereinigungsmenge aller candidateIds aus den dimensionChecks. Bei vollständig fehlendem Beleg sind alle Checks NOT_ESTABLISHED und selectedCandidateIds leer. Ausgabeform je Paket exakt: {packageId,decision,selectedCandidateIds,dimensionChecks}.",
    },
    {
      role: "user",
      content: JSON.stringify({
        contractId: COUNTERPART_DECISION_CONTRACT_ID,
        promptContractId: PROMPT_CONTRACT_ID,
        batchId: batch.batchId,
        expectedPackageIds: batch.expectedPackageIds,
        packages: batch.packages,
      }),
    },
  ];
}

function subsetExecution(searchExecution, packages) {
  const payload = {
    schemaVersion: searchExecution.schemaVersion,
    contractId: A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID,
    searchPlanSha256: searchExecution.searchPlanSha256,
    counterpartRetrievalSha256: searchExecution.counterpartRetrievalSha256,
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
      completeMatrix: true,
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

function validateBatchResponses(searchExecution, batch, responses) {
  const expected = new Set(batch.expectedPackageIds);
  const packages = searchExecution.packages.filter(({ packageId }) =>
    expected.has(packageId)
  );
  if (packages.length !== expected.size)
    throw new Error("LF_A_DRIVEN_DECISION_BATCH_PACKAGES_MISSING");
  const artifact = validateCounterpartDecisions({
    searchExecution: subsetExecution(searchExecution, packages),
    responses,
  });
  return {
    passed:
      artifact.summary.terminalPackages === expected.size &&
      artifact.summary.unresolvedPackages === 0 &&
      artifact.diagnostics.length === 0,
    diagnostics: artifact.diagnostics,
    terminalPackageIds: artifact.results
      .filter(({ status }) => status === "TERMINAL")
      .map(({ packageId }) => packageId),
  };
}

async function verifyModel({ baseUrl, model, modelContext }) {
  const apiRoot = baseUrl.replace(/\/v1\/?$/u, "");
  const response = await fetch(`${apiRoot}/api/v0/models`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(
      `LF_A_DRIVEN_DECISION_MODEL_LIST_FAILED:${response.status}`
    );
  const body = await response.json();
  const loaded = body?.data?.find(
    ({ id, type, state }) =>
      id === model && type === "llm" && state === "loaded"
  );
  if (!loaded || Number(loaded.loaded_context_length) !== Number(modelContext))
    throw new Error(
      `LF_A_DRIVEN_DECISION_MODEL_NOT_EXACTLY_LOADED:${model}:${modelContext}`
    );
  return {
    id: loaded.id,
    state: loaded.state,
    loadedContextLength: Number(loaded.loaded_context_length),
  };
}

async function runBatch({
  client,
  model,
  modelContext,
  searchExecution,
  batch,
  maximumAttempts,
  decisionPlanSha256 = null,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  abortSettlementTimeoutMs = DEFAULT_ABORT_SETTLEMENT_TIMEOUT_MS,
  recoverModelAfterAbort = async () => ({ status: "SAFE_TEST_DOUBLE" }),
  onAttempt = async () => {},
  initialAcceptedResponses = [],
}) {
  const acceptedResponses = new Map(
    initialAcceptedResponses.map((response) => [response.packageId, response])
  );
  const attempts = [];
  const initiallyPendingPackageIds = batch.expectedPackageIds.filter(
    (packageId) => !acceptedResponses.has(packageId)
  );
  let workingBatch = {
    ...batch,
    batchId:
      acceptedResponses.size > 0
        ? `${batch.batchId}-resume-pending`
        : batch.batchId,
    expectedPackageIds: initiallyPendingPackageIds,
    packages: batch.packages.filter(({ packageId }) =>
      initiallyPendingPackageIds.includes(packageId)
    ),
  };
  let messages = prompt(workingBatch);
  let last = {
    rawText: "",
    validation: {
      passed: false,
      diagnostics: [{ code: "NO_MODEL_ATTEMPT" }],
      terminalPackageIds: [...acceptedResponses.keys()],
    },
    error: null,
  };
  if (initiallyPendingPackageIds.length === 0) {
    const responses = batch.expectedPackageIds.map((packageId) =>
      acceptedResponses.get(packageId)
    );
    return {
      schemaVersion: 1,
      contractId: RUN_CONTRACT_ID,
      searchExecutionSha256: searchExecution.executionSha256,
      decisionPlanSha256,
      promptContractId: PROMPT_CONTRACT_ID,
      promptSha256: sha256(JSON.stringify(prompt(batch))),
      validatorContractId: COUNTERPART_DECISION_CONTRACT_ID,
      requestedModel: model,
      modelContext,
      transportContractId: TRANSPORT_CONTRACT_ID,
      requestTimeoutMs,
      abortSettlementTimeoutMs,
      batchId: batch.batchId,
      batchIndex: batch.batchIndex,
      expectedPackageIds: batch.expectedPackageIds,
      responses,
      validation: validateBatchResponses(searchExecution, batch, responses),
      rawResponseSha256: sha256(""),
      rawResponse: "",
      error: null,
      attempts,
      resumedAcceptedPackages: acceptedResponses.size,
    };
  }
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const started = performance.now();
    const messagesSha256 = sha256(JSON.stringify(messages));
    try {
      const completion = await requestCompletionWithTimeout({
        client,
        payload: {
          model,
          messages,
          temperature: 0,
          max_tokens: Math.min(12_000, Math.max(2_000, modelContext / 3)),
        },
        requestTimeoutMs,
        abortSettlementTimeoutMs,
        recoverModelAfterAbort,
      });
      const rawText = completion.choices?.[0]?.message?.content || "";
      const parsed = parseJsonArray(rawText);
      const trialResponses = [
        ...acceptedResponses.values(),
        ...parsed.filter(({ packageId }) => !acceptedResponses.has(packageId)),
      ];
      const validation = validateBatchResponses(
        searchExecution,
        batch,
        trialResponses
      );
      for (const packageId of validation.terminalPackageIds) {
        const response = trialResponses.find(
          (candidate) => candidate.packageId === packageId
        );
        if (response) acceptedResponses.set(packageId, response);
      }
      const pendingPackageIds = batch.expectedPackageIds.filter(
        (packageId) => !acceptedResponses.has(packageId)
      );
      const attemptRecord = {
        attempt,
        requestedPackageIds: workingBatch.expectedPackageIds,
        messagesSha256,
        durationMs: Math.round(performance.now() - started),
        errorClass: null,
        timedOut: false,
        abortTriggered: false,
        responseModel: completion.model || null,
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        parsedResponses: parsed.length,
        responses: parsed,
        acceptedPackages: acceptedResponses.size,
        pendingPackages: pendingPackageIds.length,
        validationPassed: validation.passed,
        diagnostics: validation.diagnostics,
      };
      attempts.push(attemptRecord);
      await onAttempt(attemptRecord);
      last = { rawText, validation, error: null };
      if (validation.passed) break;
      workingBatch = {
        ...batch,
        batchId: `${batch.batchId}-retry-${attempt + 1}`,
        expectedPackageIds: pendingPackageIds,
        packages: batch.packages.filter(({ packageId }) =>
          pendingPackageIds.includes(packageId)
        ),
      };
      messages = [
        ...prompt(workingBatch),
        {
          role: "user",
          content: `Die Antwort verletzt den Vertrag: ${JSON.stringify(
            validation.diagnostics
          )}. Korrigiere ausschließlich die noch erwarteten Pakete. Verwende nur vorhandene compactCandidateIds. SUPPORTED verlangt ausschließlich MATCH; CONTRADICTED verlangt mindestens ein MISMATCH und kein NOT_ESTABLISHED; NOT_SUPPORTED verlangt mindestens ein NOT_ESTABLISHED und kein MISMATCH. Teilbelege bleiben MATCH mit candidateIds. selectedCandidateIds ist exakt die Vereinigungsmenge aller dimensionChecks.candidateIds.`,
        },
      ];
    } catch (error) {
      const attemptRecord = {
        attempt,
        requestedPackageIds: workingBatch.expectedPackageIds,
        messagesSha256,
        durationMs: Math.round(performance.now() - started),
        errorClass: errorClass(error),
        timedOut: error?.telemetry?.timedOut === true,
        timeoutMs: error?.telemetry?.timeoutMs || requestTimeoutMs,
        abortTriggered: error?.telemetry?.abortTriggered === true,
        requestSettledAfterAbort:
          error?.telemetry?.requestSettledAfterAbort ?? null,
        settlementDurationMs: error?.telemetry?.settlementDurationMs ?? null,
        recovery: error?.telemetry?.recovery || null,
        responses: [],
        validationPassed: false,
        error: error.message,
      };
      attempts.push(attemptRecord);
      await onAttempt(attemptRecord);
      last = {
        rawText: "",
        validation: {
          passed: false,
          diagnostics: [
            { code: "MODEL_RESPONSE_INVALID", detail: error.message },
          ],
          terminalPackageIds: [...acceptedResponses.keys()],
        },
        error: error.message,
      };
      if (error.retrySafe === false) break;
    }
  }
  const responses = batch.expectedPackageIds
    .filter((packageId) => acceptedResponses.has(packageId))
    .map((packageId) => acceptedResponses.get(packageId));
  const validation = validateBatchResponses(searchExecution, batch, responses);
  return {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    searchExecutionSha256: searchExecution.executionSha256,
    decisionPlanSha256,
    promptContractId: PROMPT_CONTRACT_ID,
    promptSha256: sha256(JSON.stringify(prompt(batch))),
    validatorContractId: COUNTERPART_DECISION_CONTRACT_ID,
    requestedModel: model,
    modelContext,
    transportContractId: TRANSPORT_CONTRACT_ID,
    requestTimeoutMs,
    abortSettlementTimeoutMs,
    batchId: batch.batchId,
    batchIndex: batch.batchIndex,
    expectedPackageIds: batch.expectedPackageIds,
    responses,
    validation,
    rawResponseSha256: sha256(last?.rawText || ""),
    rawResponse: last?.rawText || "",
    error: last?.error || null,
    attempts,
    resumedAcceptedPackages: initialAcceptedResponses.length,
  };
}

function existingBatchResult(file, searchExecution, decisionPlan, batch, args) {
  const result = readJson(file, "LF_A_DRIVEN_DECISION_BATCH_RESULT");
  if (
    result?.contractId !== RUN_CONTRACT_ID ||
    result.searchExecutionSha256 !== searchExecution.executionSha256 ||
    result.decisionPlanSha256 !== decisionPlan.planSha256 ||
    result.promptContractId !== PROMPT_CONTRACT_ID ||
    result.promptSha256 !== sha256(JSON.stringify(prompt(batch))) ||
    result.validatorContractId !== COUNTERPART_DECISION_CONTRACT_ID ||
    result.requestedModel !== args.model ||
    result.modelContext !== args.modelContext ||
    result.transportContractId !== TRANSPORT_CONTRACT_ID ||
    result.requestTimeoutMs !== args.requestTimeoutMs ||
    result.abortSettlementTimeoutMs !== args.abortSettlementTimeoutMs ||
    result.batchId !== batch.batchId ||
    result.batchIndex !== batch.batchIndex ||
    stableStringify(result.expectedPackageIds) !==
      stableStringify(batch.expectedPackageIds) ||
    !Array.isArray(result.responses) ||
    typeof result.rawResponse !== "string" ||
    result.rawResponseSha256 !== sha256(result.rawResponse)
  )
    throw new Error("LF_A_DRIVEN_DECISION_BATCH_BINDING_INVALID");
  const validation = validateBatchResponses(
    searchExecution,
    batch,
    result.responses
  );
  if (stableStringify(validation) !== stableStringify(result.validation))
    throw new Error("LF_A_DRIVEN_DECISION_BATCH_VALIDATION_INVALID");
  if (!validation.passed)
    throw new Error("LF_A_DRIVEN_DECISION_BATCH_RESULT_NOT_PASS");
  return result;
}

function currentlyValidResponses(searchExecution, batch, responses) {
  const accepted = new Map();
  for (const response of Array.isArray(responses) ? responses : []) {
    if (accepted.has(response?.packageId)) continue;
    const packageItem = batch.packages.find(
      ({ packageId }) => packageId === response?.packageId
    );
    if (!packageItem) continue;
    const single = {
      ...batch,
      expectedPackageIds: [packageItem.packageId],
      packages: [packageItem],
    };
    if (validateBatchResponses(searchExecution, single, [response]).passed)
      accepted.set(packageItem.packageId, response);
  }
  return batch.expectedPackageIds
    .filter((packageId) => accepted.has(packageId))
    .map((packageId) => accepted.get(packageId));
}

function recoverableBatchResponses(
  file,
  searchExecution,
  decisionPlan,
  batch,
  args
) {
  const result = readJson(file, "LF_A_DRIVEN_DECISION_RECOVERABLE_BATCH");
  if (
    ![RUN_CONTRACT_ID, ...PREDECESSOR_RUN_CONTRACT_IDS].includes(
      result?.contractId
    ) ||
    result.searchExecutionSha256 !== searchExecution.executionSha256 ||
    ![null, decisionPlan.planSha256].includes(result.decisionPlanSha256) ||
    result.promptContractId !== PROMPT_CONTRACT_ID ||
    result.promptSha256 !== sha256(JSON.stringify(prompt(batch))) ||
    result.validatorContractId !== COUNTERPART_DECISION_CONTRACT_ID ||
    result.requestedModel !== args.model ||
    result.modelContext !== args.modelContext ||
    result.batchId !== batch.batchId ||
    result.batchIndex !== batch.batchIndex ||
    stableStringify(result.expectedPackageIds) !==
      stableStringify(batch.expectedPackageIds) ||
    !Array.isArray(result.responses)
  )
    return null;
  return currentlyValidResponses(searchExecution, batch, result.responses);
}

function archiveSupersededBatch(file, output, batch, reason) {
  const raw = fs.readFileSync(file, "utf8");
  const directory = path.join(output, "superseded-batches");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const target = path.join(
    directory,
    `${String(batch.batchIndex).padStart(5, "0")}-${batch.batchId}.${reason.toLowerCase()}.${sha256(raw).slice(0, 16)}.private.json`
  );
  if (fs.existsSync(target))
    throw new Error(`LF_A_DRIVEN_DECISION_SUPERSEDED_EXISTS:${target}`);
  fs.renameSync(file, target);
  fs.chmodSync(target, 0o600);
}

function createAttemptRecorder({
  output,
  searchExecution,
  decisionPlan,
  batch,
  args,
}) {
  const directory = path.join(
    output,
    "attempts",
    `${String(batch.batchIndex).padStart(5, "0")}-${batch.batchId}`
  );
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const cycles = fs
    .readdirSync(directory)
    .map((name) => Number(/^cycle-(\d+)-attempt-/u.exec(name)?.[1] || 0));
  const cycle = Math.max(0, ...cycles) + 1;
  return async (attempt) => {
    const payload = {
      schemaVersion: 1,
      contractId: TRANSPORT_CONTRACT_ID,
      searchExecutionSha256: searchExecution.executionSha256,
      decisionPlanSha256: decisionPlan.planSha256,
      promptContractId: PROMPT_CONTRACT_ID,
      promptSha256: sha256(JSON.stringify(prompt(batch))),
      requestedModel: args.model,
      modelContext: args.modelContext,
      requestTimeoutMs: args.requestTimeoutMs,
      abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
      modelRecoveryTimeoutMs: args.modelRecoveryTimeoutMs,
      batchId: batch.batchId,
      batchIndex: batch.batchIndex,
      expectedPackageIds: batch.expectedPackageIds,
      attempt,
    };
    writePrivateJson(
      path.join(
        directory,
        `cycle-${String(cycle).padStart(3, "0")}-attempt-${String(attempt.attempt).padStart(3, "0")}.private.json`
      ),
      payload
    );
  };
}

function acceptedResponsesFromAttemptJournal({
  output,
  searchExecution,
  decisionPlan,
  batch,
  args,
}) {
  const directory = path.join(
    output,
    "attempts",
    `${String(batch.batchIndex).padStart(5, "0")}-${batch.batchId}`
  );
  if (!fs.existsSync(directory)) return [];
  const responses = [];
  for (const name of fs.readdirSync(directory).sort()) {
    if (!/^cycle-\d+-attempt-\d+\.private\.json$/u.test(name)) continue;
    const artifact = readJson(
      path.join(directory, name),
      "LF_A_DRIVEN_DECISION_ATTEMPT"
    );
    if (
      artifact?.contractId !== TRANSPORT_CONTRACT_ID ||
      artifact.searchExecutionSha256 !== searchExecution.executionSha256 ||
      artifact.decisionPlanSha256 !== decisionPlan.planSha256 ||
      artifact.promptContractId !== PROMPT_CONTRACT_ID ||
      artifact.promptSha256 !== sha256(JSON.stringify(prompt(batch))) ||
      artifact.requestedModel !== args.model ||
      artifact.modelContext !== args.modelContext ||
      artifact.requestTimeoutMs !== args.requestTimeoutMs ||
      artifact.abortSettlementTimeoutMs !== args.abortSettlementTimeoutMs ||
      artifact.modelRecoveryTimeoutMs !== args.modelRecoveryTimeoutMs ||
      artifact.batchId !== batch.batchId ||
      artifact.batchIndex !== batch.batchIndex ||
      stableStringify(artifact.expectedPackageIds) !==
        stableStringify(batch.expectedPackageIds) ||
      !Array.isArray(artifact.attempt?.responses)
    )
      continue;
    responses.push(...artifact.attempt.responses);
  }
  return currentlyValidResponses(searchExecution, batch, responses);
}

async function processCounterpartDecisionBatches({
  args,
  searchExecution,
  decisionPlan,
  client,
  recoverModelAfterAbort,
}) {
  const batchResults = [];
  for (const batch of decisionPlan.batches) {
    const file = path.join(
      args.output,
      "batches",
      `${String(batch.batchIndex).padStart(5, "0")}-${batch.batchId}.private.json`
    );
    let result;
    let reused = false;
    let recoveredResponses = [];
    if (fs.existsSync(file)) {
      try {
        result = existingBatchResult(
          file,
          searchExecution,
          decisionPlan,
          batch,
          args
        );
        reused = true;
      } catch (error) {
        recoveredResponses = recoverableBatchResponses(
          file,
          searchExecution,
          decisionPlan,
          batch,
          args
        );
        if (!recoveredResponses) throw error;
        archiveSupersededBatch(file, args.output, batch, error.message);
      }
    }
    if (!reused) {
      const journalResponses = acceptedResponsesFromAttemptJournal({
        output: args.output,
        searchExecution,
        decisionPlan,
        batch,
        args,
      });
      const initialAcceptedResponses = currentlyValidResponses(
        searchExecution,
        batch,
        [...recoveredResponses, ...journalResponses]
      );
      result = await runBatch({
        client,
        model: args.model,
        modelContext: args.modelContext,
        searchExecution,
        batch,
        maximumAttempts: args.maximumAttempts,
        decisionPlanSha256: decisionPlan.planSha256,
        requestTimeoutMs: args.requestTimeoutMs,
        abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
        recoverModelAfterAbort,
        initialAcceptedResponses,
        onAttempt: createAttemptRecorder({
          output: args.output,
          searchExecution,
          decisionPlan,
          batch,
          args,
        }),
      });
      if (!result.validation.passed) {
        const failure = new Error(
          `LF_A_DRIVEN_DECISION_BATCH_FAILED_CLOSED:${batch.batchIndex}:${batch.batchId}`
        );
        failure.batchResult = result;
        throw failure;
      }
      writePrivateJson(file, result);
    }
    batchResults.push(result);
    console.log(
      `[lf-a-driven-decisions] Batch ${batch.batchIndex + 1}/${decisionPlan.batches.length}: PASS${reused ? " (wiederverwendet)" : ""}`
    );
  }
  return batchResults;
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  const searchExecution = readJson(
    args.searchExecution,
    "LF_A_DRIVEN_DECISION_SEARCH_EXECUTION"
  );
  validateADrivenCounterpartSearchExecution(searchExecution);
  const decisionPlan = buildADrivenCounterpartDecisionPlan(searchExecution, {
    maximumPackages: args.maximumPackages,
    maximumCharacters: args.maximumCharacters,
  });
  if (fs.existsSync(args.output)) {
    const stat = fs.lstatSync(args.output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("LF_A_DRIVEN_DECISION_OUTPUT_INVALID");
  } else fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
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
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const batchResults = await processCounterpartDecisionBatches({
    args,
    searchExecution,
    decisionPlan,
    client,
    recoverModelAfterAbort,
  });
  const modelResponses = batchResults.flatMap(({ responses }) => responses);
  const responseByPackage = new Map(
    [...decisionPlan.deterministicResponses, ...modelResponses].map(
      (response) => [response.packageId, response]
    )
  );
  const responses = searchExecution.packages
    .filter(({ packageId }) => responseByPackage.has(packageId))
    .map(({ packageId }) => responseByPackage.get(packageId));
  const decisions = validateCounterpartDecisions({
    searchExecution,
    responses,
  });
  const summary = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    searchExecutionSha256: searchExecution.executionSha256,
    decisionPlanSha256: decisionPlan.planSha256,
    promptContractId: PROMPT_CONTRACT_ID,
    validatorContractId: COUNTERPART_DECISION_CONTRACT_ID,
    model: loadedModel,
    transport: {
      contractId: TRANSPORT_CONTRACT_ID,
      requestTimeoutMs: args.requestTimeoutMs,
      abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
      modelRecoveryTimeoutMs: args.modelRecoveryTimeoutMs,
      recoveryMethod: "TARGETED_UNLOAD_RELOAD_AND_EXACT_MODEL_VERIFY",
    },
    startedAt,
    completedAt: new Date().toISOString(),
    wallDurationMs: Math.round(performance.now() - started),
    batches: batchResults.length,
    validBatches: batchResults.filter(({ validation }) => validation.passed)
      .length,
    unresolvedBatches: batchResults.filter(
      ({ validation }) => !validation.passed
    ).length,
    modelAttempts: batchResults.reduce(
      (sum, { attempts }) => sum + attempts.length,
      0
    ),
    deterministicEmptyCandidatePackages:
      decisionPlan.summary.deterministicEmptyCandidatePackages,
    terminalPackages: decisions.summary.terminalPackages,
    unresolvedPackages: decisions.summary.unresolvedPackages,
    decisionSha256: decisions.decisionSha256,
  };
  writePrivateJson(
    path.join(args.output, "decision-plan.private.json"),
    decisionPlan
  );
  writePrivateJson(path.join(args.output, "responses.private.json"), responses);
  writePrivateJson(
    path.join(args.output, "counterpart-decisions.private.json"),
    decisions
  );
  writePrivateJson(path.join(args.output, "summary.private.json"), summary);
}

if (require.main === module)
  run().catch((error) => fail(error.stack || error.message));

module.exports = {
  acceptedResponsesFromAttemptJournal,
  createAttemptRecorder,
  currentlyValidResponses,
  processCounterpartDecisionBatches,
  prompt,
  runBatch,
  subsetExecution,
  validateBatchResponses,
};
