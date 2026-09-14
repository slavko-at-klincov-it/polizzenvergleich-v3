#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { OpenAI } = require("openai");
const {
  A_DRIVEN_REQUIREMENT_DECISION_CONTRACT_ID,
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
  buildADrivenRequirementDecisionPlan,
  validateADrivenRequirementDecisionResponses,
} = require("../../utils/policyAnalysis/aDrivenRequirementCounterpartDecision");
const {
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  createLmStudioRecovery,
  requestCompletionWithTimeout,
} = require("./runADrivenReferenceClassification.cjs");

const RUN_CONTRACT_ID = "LF_A_DRIVEN_REQUIREMENT_DECISION_RUN_V1";
const PROMPT_CONTRACT_ID = "LF_A_DRIVEN_REQUIREMENT_DECISION_PROMPT_V1";
const TRANSPORT_CONTRACT_ID = "LF_A_DRIVEN_REQUIREMENT_DECISION_TRANSPORT_V1";
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
  console.error(`[lf-a-driven-requirement-decisions] ${message}`);
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
    "manifest",
    "searchPlan",
    "searchExecution",
    "completeCorpus",
    "output",
    "model",
    "modelContext",
    "maximumAttempts",
    "maximumCandidatesPerComponent",
    "maximumCompleteCorpusCandidatesPerDocument",
    "maximumRequirementsPerBatch",
    "maximumBatchCharacters",
    "requestTimeoutMs",
    "abortSettlementTimeoutMs",
    "modelRecoveryTimeoutMs",
    "maximumNewBatches",
    "startBatchIndex",
    "lmStudioSdk",
    "qwenModelKey",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of [
    "manifest",
    "searchPlan",
    "searchExecution",
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
    manifest: path.resolve(values.manifest),
    searchPlan: path.resolve(values.searchPlan),
    searchExecution: path.resolve(values.searchExecution),
    completeCorpus: path.resolve(values.completeCorpus),
    output: path.resolve(values.output),
    lmStudioSdk: path.resolve(values.lmStudioSdk),
    qwenModelKey: values.qwenModelKey,
    model: values.model || DEFAULT_MODEL,
    modelContext: integer("modelContext", DEFAULT_CONTEXT, 1_000),
    maximumAttempts: integer("maximumAttempts", 3),
    maximumCandidatesPerComponent: integer("maximumCandidatesPerComponent", 4),
    maximumCompleteCorpusCandidatesPerDocument: integer(
      "maximumCompleteCorpusCandidatesPerDocument",
      2
    ),
    maximumRequirementsPerBatch: integer("maximumRequirementsPerBatch", 4),
    maximumBatchCharacters: integer("maximumBatchCharacters", 120_000, 10_000),
    requestTimeoutMs: integer("requestTimeoutMs", DEFAULT_REQUEST_TIMEOUT_MS),
    abortSettlementTimeoutMs: integer(
      "abortSettlementTimeoutMs",
      DEFAULT_ABORT_SETTLEMENT_TIMEOUT_MS
    ),
    modelRecoveryTimeoutMs: integer(
      "modelRecoveryTimeoutMs",
      DEFAULT_MODEL_RECOVERY_TIMEOUT_MS
    ),
    maximumNewBatches:
      values.maximumNewBatches === undefined
        ? null
        : integer("maximumNewBatches", null),
    startBatchIndex: integer("startBatchIndex", 0, 0),
  };
  if (result.maximumAttempts > MAXIMUM_ATTEMPTS)
    fail(`--maximumAttempts darf höchstens ${MAXIMUM_ATTEMPTS} sein`);
  if (result.startBatchIndex > 0 && result.maximumNewBatches === null)
    fail("--startBatchIndex erfordert --maximumNewBatches");
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
    throw new Error(`LF_A_DRIVEN_REQUIREMENT_OUTPUT_EXISTS:${file}`);
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

function parseJsonArray(modelText) {
  const normalized = String(modelText || "")
    .replace(/<think>[\s\S]*?<\/think>/giu, "")
    .trim();
  const start = normalized.indexOf("[");
  const end = normalized.lastIndexOf("]");
  if (start < 0 || end < start)
    throw new Error("LF_A_DRIVEN_REQUIREMENT_RESPONSE_JSON_ARRAY_MISSING");
  const parsed = JSON.parse(normalized.slice(start, end + 1));
  if (!Array.isArray(parsed))
    throw new Error("LF_A_DRIVEN_REQUIREMENT_RESPONSE_NOT_ARRAY");
  return parsed;
}

function normalizeRepeatedCandidateIds(responses) {
  let duplicateCandidateIdsRemoved = 0;
  const unique = (values) => {
    if (!Array.isArray(values)) return values;
    const normalized = [...new Set(values)];
    duplicateCandidateIdsRemoved += values.length - normalized.length;
    return normalized;
  };
  const normalizedResponses = responses.map((response) => ({
    ...response,
    ...(response?.contextFinding
      ? {
          contextFinding: {
            ...response.contextFinding,
            candidateIds: unique(response.contextFinding.candidateIds),
          },
        }
      : {}),
    ...(Array.isArray(response?.componentFindings)
      ? {
          componentFindings: response.componentFindings.map((finding) => ({
            ...finding,
            candidateIds: unique(finding.candidateIds),
          })),
        }
      : {}),
    ...(Array.isArray(response?.unmodeledDifferences)
      ? {
          unmodeledDifferences: response.unmodeledDifferences.map(
            (difference) => ({
              ...difference,
              candidateIds: unique(difference.candidateIds),
            })
          ),
        }
      : {}),
  }));
  return { responses: normalizedResponses, duplicateCandidateIdsRemoved };
}

function repairInstruction(batch, diagnostics = []) {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) return null;
  const componentsById = new Map(
    batch.rows.flatMap((row) =>
      row.components.map((component) => [component.componentId, component])
    )
  );
  const invalidComponents = diagnostics
    .flatMap(({ issues = [] }) => issues)
    .filter(({ code, componentId }) =>
      Boolean(code === "COMPONENT_FINDING_INVALID" && componentId)
    )
    .map(({ componentId }) => componentsById.get(componentId))
    .filter(Boolean);
  const componentHint = invalidComponents.length
    ? ` Beanstandete Komponenten: ${invalidComponents
        .map(({ componentId, dimension }) => `${componentId}:${dimension}`)
        .join(", ")}.`
    : "";
  const candidateIdInvalid = diagnostics
    .flatMap(({ issues = [] }) => issues)
    .some(({ code }) =>
      ["COMPONENT_FINDING_INVALID", "CONTEXT_FINDING_INVALID"].includes(code)
    );
  const allowedCandidateHint = candidateIdInvalid
    ? ` Erlaubte candidateIds je Requirement: ${batch.rows
        .map(
          ({ requirementId, candidates }) =>
            `${requirementId}=[${candidates
              .map(({ candidateId }) => candidateId)
              .join(",")}]`
        )
        .join("; ")}. Verwende in contextFinding, componentFindings und unmodeledDifferences ausschließlich eine Teilmenge dieser IDs und kopiere jede verwendete ID exakt; entferne jede andere oder erfundene ID.`
    : "";
  return `Die vorige Antwort war serverseitig ungültig (${[
    ...new Set(diagnostics.map(({ code }) => code)),
  ].join(
    ", "
  )}). Korrigiere nur die angeforderten Requirements und halte alle IDs unverändert.${componentHint}${allowedCandidateHint} COUNTERPART_WITH_DIFFERENCE ist ausschließlich für SCOPE, CONDITION, VALUE_AND_UNIT, LIMIT_BASIS, DEDUCTIBLE oder TEMPORAL_VALIDITY erlaubt. Für OBJECT, PERIL_OR_CAUSE, DAMAGE_OR_EFFECT, FACT_ROLE, DOCUMENT_ROLE oder PRECEDENCE_OR_REPLACEMENT verwende MATCH bei demselben fachlichen Kern, OPPOSITE bei einem ausdrücklichen Gegenteil, RELATED_ONLY bei einem bloß verwandten anderen Kern oder NOT_ESTABLISHED ohne Beleg. Gib erneut ausschließlich das vollständige JSON-Array aus.`;
}

function prompt(batch, diagnostics = []) {
  const messages = [
    {
      role: "system",
      content:
        "Du prüfst dynamisch aus Referenzpaket A ermittelte fachliche Anforderungen gegen servergebundene Originalklauseln aus allen Dokumenten B. Antworte ausschließlich als JSON-Array mit exakt einem Objekt je expectedRequirementId und keiner anderen ID. Erfinde keine Texte, Seiten, IDs oder Tatsachen und nutze ausschließlich die vorgelegten candidateIds. GEFUNDEN bedeutet: In B existiert im passenden Kontext ein quellengebundenes Gegenstück zum selben fachlichen Element. Abweichende Werte, Limits, Bedingungen, Umfänge oder ein ausdrücklicher Ausschluss bleiben ein Gegenstück und werden als Abweichung beziehungsweise OPPOSITE ausgewiesen. Eine bloße Keyword-Nennung, Überschrift oder nur verwandte Deckung ist RELATED_ONLY und kein Gegenstück. Prüfe jede Komponente einzeln. outcome ist MATCH, COUNTERPART_WITH_DIFFERENCE, OPPOSITE, RELATED_ONLY oder NOT_ESTABLISHED. COUNTERPART_WITH_DIFFERENCE ist nur für SCOPE, CONDITION, VALUE_AND_UNIT, LIMIT_BASIS, DEDUCTIBLE oder TEMPORAL_VALIDITY zulässig. NOT_ESTABLISHED hat candidateIds exakt []; alle anderen Outcomes benötigen mindestens eine candidateId. contextFinding beschreibt, ob die Quellen dasselbe fachliche Element im passenden Objekt-/Gefahr-/Schaden-/Rollen-Kontext behandeln. unmodeledDifferences enthält nur zusätzliche belegte Unterschiede als {dimension,description,candidateIds}. Ausgabe je Anforderung exakt: {requirementId,contextFinding:{outcome,candidateIds},componentFindings:[{componentId,dimension,outcome,candidateIds}],unmodeledDifferences:[...],rationale}. Jede vorgelegte Komponente muss exakt einmal vorkommen.",
    },
    {
      role: "user",
      content: JSON.stringify({
        contractId: A_DRIVEN_REQUIREMENT_DECISION_CONTRACT_ID,
        promptContractId: PROMPT_CONTRACT_ID,
        batchId: batch.batchId,
        expectedRequirementIds: batch.expectedRequirementIds,
        requirements: batch.rows,
      }),
    },
  ];
  const correction = repairInstruction(batch, diagnostics);
  if (correction) messages.push({ role: "user", content: correction });
  return messages;
}

function subsetPlan(plan, batch) {
  const payload = {
    schemaVersion: plan.schemaVersion,
    contractId: A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
    dynamicManifestSha256: plan.dynamicManifestSha256,
    searchPlanSha256: plan.searchPlanSha256,
    searchExecutionSha256: plan.searchExecutionSha256,
    completeBCorpusSha256: plan.completeBCorpusSha256,
    selection: plan.selection,
    rows: batch.rows,
    batches: [batch],
    summary: {
      requirements: batch.rows.length,
      components: batch.rows.reduce(
        (sum, row) => sum + row.components.length,
        0
      ),
      selectedCandidates: batch.rows.reduce(
        (sum, row) => sum + row.candidates.length,
        0
      ),
      batches: 1,
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

function validateBatchResponses(plan, batch, responses) {
  const artifact = validateADrivenRequirementDecisionResponses({
    plan: subsetPlan(plan, batch),
    responses,
  });
  return {
    passed:
      artifact.summary.terminalRequirements === batch.rows.length &&
      artifact.summary.unresolvedRequirements === 0 &&
      artifact.diagnostics.length === 0,
    diagnostics: artifact.diagnostics,
    terminalRequirementIds: artifact.results
      .filter(({ status }) => status === "TERMINAL")
      .map(({ requirementId }) => requirementId),
  };
}

function repairBatch(batch, pendingRequirementIds, attempt) {
  const requestedRequirementIds = pendingRequirementIds.slice(0, 1);
  return {
    ...batch,
    batchId: `${batch.batchId}-retry-${attempt}`,
    expectedRequirementIds: requestedRequirementIds,
    rows: batch.rows.filter(({ requirementId }) =>
      requestedRequirementIds.includes(requirementId)
    ),
  };
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
      `LF_A_DRIVEN_REQUIREMENT_MODEL_LIST_FAILED:${response.status}`
    );
  const body = await response.json();
  const loaded = body?.data?.find(
    ({ id, type, state }) =>
      id === model && type === "llm" && state === "loaded"
  );
  if (!loaded || Number(loaded.loaded_context_length) !== Number(modelContext))
    throw new Error(
      `LF_A_DRIVEN_REQUIREMENT_MODEL_NOT_EXACTLY_LOADED:${model}:${modelContext}`
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
  plan,
  batch,
  maximumAttempts,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  abortSettlementTimeoutMs = DEFAULT_ABORT_SETTLEMENT_TIMEOUT_MS,
  recoverModelAfterAbort = async () => ({ status: "SAFE_TEST_DOUBLE" }),
  onAttempt = async () => {},
  initialAcceptedResponses = [],
}) {
  const accepted = new Map(
    initialAcceptedResponses.map((response) => [
      response.requirementId,
      response,
    ])
  );
  const attempts = [];
  let workingBatch = repairBatch(
    batch,
    batch.expectedRequirementIds.filter((id) => !accepted.has(id)),
    0
  );
  if (accepted.size === 0) workingBatch = batch;
  let repairDiagnostics = [];
  let lastRawText = "";
  let lastError = null;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    if (accepted.size === batch.expectedRequirementIds.length) break;
    const messages = prompt(workingBatch, repairDiagnostics);
    const started = performance.now();
    let observedRawText = "";
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
      observedRawText = completion.choices?.[0]?.message?.content || "";
      const parsedResponse = normalizeRepeatedCandidateIds(
        parseJsonArray(observedRawText)
      );
      const parsed = parsedResponse.responses;
      const currentValidation = validateBatchResponses(
        plan,
        workingBatch,
        parsed
      );
      for (const requirementId of currentValidation.terminalRequirementIds) {
        const response = parsed.find(
          (candidate) => candidate.requirementId === requirementId
        );
        if (response) accepted.set(requirementId, response);
      }
      const pending = batch.expectedRequirementIds.filter(
        (requirementId) => !accepted.has(requirementId)
      );
      const attemptRecord = {
        attempt,
        requestedRequirementIds: workingBatch.expectedRequirementIds,
        messagesSha256: sha256(JSON.stringify(messages)),
        durationMs: Math.round(performance.now() - started),
        errorClass: null,
        timedOut: false,
        abortTriggered: false,
        responseModel: completion.model || null,
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        rawResponseSha256: sha256(observedRawText),
        rawResponse: observedRawText,
        responses: parsed,
        duplicateCandidateIdsRemoved:
          parsedResponse.duplicateCandidateIdsRemoved,
        acceptedRequirements: accepted.size,
        pendingRequirements: pending.length,
        requestValidationPassed: currentValidation.passed,
        diagnostics: currentValidation.diagnostics,
      };
      attempts.push(attemptRecord);
      await onAttempt(attemptRecord);
      lastRawText = observedRawText;
      lastError = null;
      if (!pending.length) break;
      repairDiagnostics = currentValidation.diagnostics;
      workingBatch = repairBatch(batch, pending, attempt + 1);
    } catch (error) {
      const attemptRecord = {
        attempt,
        requestedRequirementIds: workingBatch.expectedRequirementIds,
        messagesSha256: sha256(JSON.stringify(messages)),
        durationMs: Math.round(performance.now() - started),
        errorClass: errorClass(error),
        timedOut: error?.telemetry?.timedOut === true,
        timeoutMs: error?.telemetry?.timeoutMs || requestTimeoutMs,
        abortTriggered: error?.telemetry?.abortTriggered === true,
        requestSettledAfterAbort:
          error?.telemetry?.requestSettledAfterAbort ?? null,
        settlementDurationMs: error?.telemetry?.settlementDurationMs ?? null,
        recovery: error?.telemetry?.recovery || null,
        rawResponseSha256: sha256(observedRawText),
        rawResponse: observedRawText,
        responses: [],
        acceptedRequirements: accepted.size,
        pendingRequirements:
          batch.expectedRequirementIds.length - accepted.size,
        error: error.message,
      };
      attempts.push(attemptRecord);
      await onAttempt(attemptRecord);
      lastRawText = observedRawText;
      lastError = error.message;
      if (error.retrySafe === false) break;
      repairDiagnostics = [{ code: "MODEL_RESPONSE_INVALID", issues: [] }];
    }
  }
  const responses = batch.expectedRequirementIds
    .filter((requirementId) => accepted.has(requirementId))
    .map((requirementId) => accepted.get(requirementId));
  const validation = validateBatchResponses(plan, batch, responses);
  return {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    decisionPlanSha256: plan.planSha256,
    promptContractId: PROMPT_CONTRACT_ID,
    promptSha256: sha256(JSON.stringify(prompt(batch))),
    validatorContractId: A_DRIVEN_REQUIREMENT_DECISION_CONTRACT_ID,
    requestedModel: model,
    modelContext,
    transportContractId: TRANSPORT_CONTRACT_ID,
    requestTimeoutMs,
    abortSettlementTimeoutMs,
    batchId: batch.batchId,
    batchIndex: batch.batchIndex,
    expectedRequirementIds: batch.expectedRequirementIds,
    responses,
    validation,
    rawResponseSha256: sha256(lastRawText),
    rawResponse: lastRawText,
    error: lastError,
    attempts,
    resumedAcceptedRequirements: initialAcceptedResponses.length,
  };
}

function batchFile(output, batch) {
  return path.join(
    output,
    "batches",
    `${String(batch.batchIndex).padStart(5, "0")}-${batch.batchId}.private.json`
  );
}

function existingBatchResult(file, plan, batch, args) {
  const result = readJson(file, "LF_A_DRIVEN_REQUIREMENT_BATCH_RESULT");
  if (
    result?.contractId !== RUN_CONTRACT_ID ||
    result.decisionPlanSha256 !== plan.planSha256 ||
    result.promptContractId !== PROMPT_CONTRACT_ID ||
    result.promptSha256 !== sha256(JSON.stringify(prompt(batch))) ||
    result.validatorContractId !== A_DRIVEN_REQUIREMENT_DECISION_CONTRACT_ID ||
    result.requestedModel !== args.model ||
    result.modelContext !== args.modelContext ||
    result.transportContractId !== TRANSPORT_CONTRACT_ID ||
    result.requestTimeoutMs !== args.requestTimeoutMs ||
    result.abortSettlementTimeoutMs !== args.abortSettlementTimeoutMs ||
    result.batchId !== batch.batchId ||
    result.batchIndex !== batch.batchIndex ||
    stableStringify(result.expectedRequirementIds) !==
      stableStringify(batch.expectedRequirementIds) ||
    !Array.isArray(result.responses) ||
    typeof result.rawResponse !== "string" ||
    result.rawResponseSha256 !== sha256(result.rawResponse)
  )
    throw new Error("LF_A_DRIVEN_REQUIREMENT_BATCH_BINDING_INVALID");
  const validation = validateBatchResponses(plan, batch, result.responses);
  if (
    !validation.passed ||
    stableStringify(validation) !== stableStringify(result.validation)
  )
    throw new Error("LF_A_DRIVEN_REQUIREMENT_BATCH_RESULT_NOT_PASS");
  return result;
}

function validResponses(plan, batch, responses) {
  const accepted = new Map();
  for (const response of Array.isArray(responses) ? responses : []) {
    if (accepted.has(response?.requirementId)) continue;
    const row = batch.rows.find(
      ({ requirementId }) => requirementId === response?.requirementId
    );
    if (!row) continue;
    const single = {
      ...batch,
      expectedRequirementIds: [row.requirementId],
      rows: [row],
    };
    if (validateBatchResponses(plan, single, [response]).passed)
      accepted.set(row.requirementId, response);
  }
  return batch.expectedRequirementIds
    .filter((requirementId) => accepted.has(requirementId))
    .map((requirementId) => accepted.get(requirementId));
}

function attemptRecorder({ output, plan, batch, args }) {
  const directory = path.join(
    output,
    "attempts",
    `${String(batch.batchIndex).padStart(5, "0")}-${batch.batchId}`
  );
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const cycle =
    Math.max(
      0,
      ...fs
        .readdirSync(directory)
        .map((name) => Number(/^cycle-(\d+)-attempt-/u.exec(name)?.[1] || 0))
    ) + 1;
  return async (attempt) => {
    writePrivateJson(
      path.join(
        directory,
        `cycle-${String(cycle).padStart(3, "0")}-attempt-${String(attempt.attempt).padStart(3, "0")}.private.json`
      ),
      {
        schemaVersion: 1,
        contractId: TRANSPORT_CONTRACT_ID,
        decisionPlanSha256: plan.planSha256,
        promptContractId: PROMPT_CONTRACT_ID,
        promptSha256: sha256(JSON.stringify(prompt(batch))),
        requestedModel: args.model,
        modelContext: args.modelContext,
        requestTimeoutMs: args.requestTimeoutMs,
        abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
        modelRecoveryTimeoutMs: args.modelRecoveryTimeoutMs,
        batchId: batch.batchId,
        batchIndex: batch.batchIndex,
        expectedRequirementIds: batch.expectedRequirementIds,
        attempt,
      }
    );
  };
}

function journalResponses({ output, plan, batch, args }) {
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
      "LF_A_DRIVEN_REQUIREMENT_ATTEMPT"
    );
    if (
      artifact?.contractId !== TRANSPORT_CONTRACT_ID ||
      artifact.decisionPlanSha256 !== plan.planSha256 ||
      artifact.promptContractId !== PROMPT_CONTRACT_ID ||
      artifact.promptSha256 !== sha256(JSON.stringify(prompt(batch))) ||
      artifact.requestedModel !== args.model ||
      artifact.modelContext !== args.modelContext ||
      artifact.requestTimeoutMs !== args.requestTimeoutMs ||
      artifact.abortSettlementTimeoutMs !== args.abortSettlementTimeoutMs ||
      artifact.modelRecoveryTimeoutMs !== args.modelRecoveryTimeoutMs ||
      artifact.batchId !== batch.batchId ||
      artifact.batchIndex !== batch.batchIndex ||
      stableStringify(artifact.expectedRequirementIds) !==
        stableStringify(batch.expectedRequirementIds) ||
      !Array.isArray(artifact.attempt?.responses)
    )
      continue;
    responses.push(...artifact.attempt.responses);
  }
  return validResponses(plan, batch, responses);
}

async function processBatches({ args, plan, client, recoverModelAfterAbort }) {
  const results = [];
  let newBatches = 0;
  let nextBatchIndex = null;
  for (const batch of plan.batches) {
    if (batch.batchIndex < args.startBatchIndex) continue;
    const file = batchFile(args.output, batch);
    let result;
    let reused = false;
    if (fs.existsSync(file)) {
      result = existingBatchResult(file, plan, batch, args);
      reused = true;
    } else {
      if (
        args.maximumNewBatches !== null &&
        newBatches >= args.maximumNewBatches
      ) {
        nextBatchIndex = batch.batchIndex;
        break;
      }
      result = await runBatch({
        client,
        model: args.model,
        modelContext: args.modelContext,
        plan,
        batch,
        maximumAttempts: args.maximumAttempts,
        requestTimeoutMs: args.requestTimeoutMs,
        abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
        recoverModelAfterAbort,
        initialAcceptedResponses: journalResponses({
          output: args.output,
          plan,
          batch,
          args,
        }),
        onAttempt: attemptRecorder({ output: args.output, plan, batch, args }),
      });
      if (!result.validation.passed) {
        const error = new Error(
          `LF_A_DRIVEN_REQUIREMENT_BATCH_FAILED_CLOSED:${batch.batchIndex}:${batch.batchId}`
        );
        error.batchResult = result;
        throw error;
      }
      writePrivateJson(file, result);
      newBatches += 1;
    }
    results.push(result);
    console.log(
      `[lf-a-driven-requirement-decisions] Batch ${batch.batchIndex + 1}/${plan.batches.length}: PASS${reused ? " (wiederverwendet)" : ""}`
    );
  }
  return {
    results,
    complete:
      args.startBatchIndex === 0 && results.length === plan.batches.length,
    newBatches,
    nextBatchIndex,
  };
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  const manifest = readJson(args.manifest, "LF_A_DRIVEN_REQUIREMENT_MANIFEST");
  const searchPlan = readJson(
    args.searchPlan,
    "LF_A_DRIVEN_REQUIREMENT_SEARCH_PLAN"
  );
  const searchExecution = readJson(
    args.searchExecution,
    "LF_A_DRIVEN_REQUIREMENT_SEARCH_EXECUTION"
  );
  const completeCorpus = readJson(
    args.completeCorpus,
    "LF_A_DRIVEN_REQUIREMENT_COMPLETE_B_CORPUS"
  );
  const plan = buildADrivenRequirementDecisionPlan({
    manifest,
    searchPlan,
    searchExecution,
    completeCorpus,
    maximumCandidatesPerComponent: args.maximumCandidatesPerComponent,
    maximumCompleteCorpusCandidatesPerDocument:
      args.maximumCompleteCorpusCandidatesPerDocument,
    maximumRequirementsPerBatch: args.maximumRequirementsPerBatch,
    maximumBatchCharacters: args.maximumBatchCharacters,
  });
  if (fs.existsSync(args.output)) {
    const stat = fs.lstatSync(args.output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("LF_A_DRIVEN_REQUIREMENT_OUTPUT_INVALID");
  } else fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
  writeOrVerifyPrivateJson(
    path.join(args.output, "decision-plan.private.json"),
    plan,
    "LF_A_DRIVEN_REQUIREMENT_PLAN_RESUME_MISMATCH"
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
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const processed = await processBatches({
    args,
    plan,
    client,
    recoverModelAfterAbort,
  });
  const checkpointBase = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    decisionPlanSha256: plan.planSha256,
    promptContractId: PROMPT_CONTRACT_ID,
    requestedModel: args.model,
    modelContext: args.modelContext,
    completedBatches: processed.results.length,
    completedBatchesInSegment: processed.results.length,
    startBatchIndex: args.startBatchIndex,
    totalBatches: plan.batches.length,
    newBatches: processed.newBatches,
    completedAt: new Date().toISOString(),
  };
  if (!processed.complete) {
    writeCheckpoint(path.join(args.output, "checkpoint.private.json"), {
      ...checkpointBase,
      status: "CONTROLLED_PARTIAL",
      nextBatchIndex: processed.nextBatchIndex,
      resumable: true,
    });
    console.log(
      `[lf-a-driven-requirement-decisions] KONTROLLIERTER STOP: ${processed.results.length}/${plan.batches.length} Batches, Resume ab ${processed.nextBatchIndex + 1}`
    );
    return;
  }
  const responses = processed.results.flatMap((result) => result.responses);
  const decisions = validateADrivenRequirementDecisionResponses({
    plan,
    responses,
  });
  if (decisions.summary.unresolvedRequirements > 0)
    throw new Error("LF_A_DRIVEN_REQUIREMENT_FINAL_DECISIONS_UNRESOLVED");
  const completedAt = new Date().toISOString();
  const summary = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    decisionPlanSha256: plan.planSha256,
    decisionSha256: decisions.decisionSha256,
    promptContractId: PROMPT_CONTRACT_ID,
    validatorContractId: A_DRIVEN_REQUIREMENT_DECISION_CONTRACT_ID,
    model: loadedModel,
    transport: {
      contractId: TRANSPORT_CONTRACT_ID,
      requestTimeoutMs: args.requestTimeoutMs,
      abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
      modelRecoveryTimeoutMs: args.modelRecoveryTimeoutMs,
    },
    startedAt,
    completedAt,
    wallDurationMs: Math.round(performance.now() - started),
    batches: processed.results.length,
    modelAttempts: processed.results.reduce(
      (sum, result) => sum + result.attempts.length,
      0
    ),
    ...decisions.summary,
  };
  writeOrVerifyPrivateJson(
    path.join(args.output, "responses.private.json"),
    responses,
    "LF_A_DRIVEN_REQUIREMENT_RESPONSES_RESUME_MISMATCH"
  );
  writeOrVerifyPrivateJson(
    path.join(args.output, "requirement-decisions.private.json"),
    decisions,
    "LF_A_DRIVEN_REQUIREMENT_DECISIONS_RESUME_MISMATCH"
  );
  writeOrVerifyPrivateJson(
    path.join(args.output, "summary.private.json"),
    summary,
    "LF_A_DRIVEN_REQUIREMENT_SUMMARY_RESUME_MISMATCH"
  );
  writeCheckpoint(path.join(args.output, "checkpoint.private.json"), {
    ...checkpointBase,
    status: "COMPLETE",
    nextBatchIndex: null,
    resumable: false,
    decisionSha256: decisions.decisionSha256,
  });
}

if (require.main === module)
  run().catch((error) => fail(error.stack || error.message));

module.exports = {
  normalizeRepeatedCandidateIds,
  parseJsonArray,
  processBatches,
  prompt,
  repairInstruction,
  runBatch,
  subsetPlan,
  validateBatchResponses,
};
