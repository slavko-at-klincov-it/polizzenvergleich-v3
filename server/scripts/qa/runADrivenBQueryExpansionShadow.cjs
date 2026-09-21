#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { OpenAI } = require("openai");
const {
  buildADrivenBFactIndex,
  buildADrivenFastFallbackPlan,
  buildADrivenFastFallbackReplay,
} = require("../../utils/policyAnalysis/aDrivenBFactIndex");
const {
  createLmStudioRecovery,
  parseJsonArray,
  requestCompletionWithTimeout,
} = require("./runADrivenReferenceClassification.cjs");
const {
  readJson,
  writePrivateJson,
} = require("./buildADrivenBFastPathShadow.cjs");

const RUN_CONTRACT_ID = "LF_A_DRIVEN_B_QUERY_EXPANSION_SHADOW_RUN_V1";
const PROMPT_CONTRACT_ID = "LF_A_DRIVEN_B_QUERY_EXPANSION_PROMPT_V1";
const DEFAULT_MODEL = "qwen/qwen3.6-35b-a3b";
const DEFAULT_CONTEXT = 42_496;

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function fail(message) {
  console.error(`[lf-b-query-expansion-shadow] ${message}`);
  process.exit(1);
}

function integer(values, name, fallback, minimum = 1) {
  const parsed = Number(values[name] ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < minimum)
    fail(`--${name} ist ungültig`);
  return parsed;
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
    "runRoot",
    "output",
    "lmStudioSdk",
    "qwenModelKey",
    "model",
    "modelContext",
    "maximumAttempts",
    "requestTimeoutMs",
    "abortSettlementTimeoutMs",
    "modelRecoveryTimeoutMs",
    "lexicalTopKPerDocument",
    "maximumBatchCharacters",
    "retrievalScope",
    "neighborRadius",
    "neighborAnchorLimit",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of [
    "runRoot",
    "output",
    "lmStudioSdk",
    "qwenModelKey",
  ])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const retrievalScope = values.retrievalScope || "PER_DOCUMENT";
  if (!new Set(["PER_DOCUMENT", "GLOBAL"]).has(retrievalScope))
    fail("--retrievalScope ist ungültig");
  return {
    runRoot: path.resolve(values.runRoot),
    output: path.resolve(values.output),
    lmStudioSdk: path.resolve(values.lmStudioSdk),
    qwenModelKey: values.qwenModelKey,
    model: values.model || DEFAULT_MODEL,
    modelContext: integer(values, "modelContext", DEFAULT_CONTEXT, 1_000),
    maximumAttempts: integer(values, "maximumAttempts", 3),
    requestTimeoutMs: integer(values, "requestTimeoutMs", 300_000),
    abortSettlementTimeoutMs: integer(
      values,
      "abortSettlementTimeoutMs",
      15_000
    ),
    modelRecoveryTimeoutMs: integer(
      values,
      "modelRecoveryTimeoutMs",
      180_000
    ),
    lexicalTopKPerDocument: integer(
      values,
      "lexicalTopKPerDocument",
      4
    ),
    maximumBatchCharacters: integer(
      values,
      "maximumBatchCharacters",
      70_000,
      10_000
    ),
    retrievalScope,
    neighborRadius: integer(values, "neighborRadius", 0, 0),
    neighborAnchorLimit: integer(values, "neighborAnchorLimit", 0, 0),
  };
}

function artifact(runRoot, relative, code) {
  return readJson(path.join(runRoot, relative), code);
}

function prompt(plan, repair = null) {
  const requirements = plan.rows.map(({ requirementId, query }) => ({
    requirementId,
    sourceQuery: query.text,
    componentPhrases: query.phrases,
    desiredRoles: query.desiredRoles,
  }));
  const messages = [
    {
      role: "system",
      content:
        "Du erweiterst ausschließlich die Suche nach möglichen Gegenstücken in deutschsprachigen österreichischen Versicherungsverträgen. Du triffst keine Deckungs-, Gleichheits- oder Abwesenheitsentscheidung. Erzeuge für jede vorgelegte requirementId 3 bis 8 kurze alternative Suchphrasen, die dieselbe konkrete Sache, Gefahr, Vertragswirkung, Bedingung oder Leistung in B-Dokumenten benennen könnten. Verwende fachliche Synonyme, übliche Vertragsformulierungen und funktional gleichbedeutende Wendungen. Verallgemeinere nicht zu bloßen Wörtern wie Versicherung, Schaden, Kosten oder Vertrag. Erfinde keine Beträge, Fristen, Deckungen oder Tatsachen. Gib ausschließlich genau ein JSON-Array in der vorgegebenen Reihenfolge aus: [{requirementId,searchPhrases:[...] }]. Jede requirementId genau einmal; keine zusätzlichen Felder, Kommentare oder Markdown-Markierungen.",
    },
    {
      role: "user",
      content: JSON.stringify({
        contractId: RUN_CONTRACT_ID,
        promptContractId: PROMPT_CONTRACT_ID,
        requirements,
      }),
    },
  ];
  if (repair) messages.push({ role: "user", content: repair });
  return messages;
}

function validateExpansionResponse(response, plan) {
  if (!Array.isArray(response) || response.length !== plan.rows.length)
    throw new Error("LF_A_DRIVEN_B_QUERY_EXPANSION_RESPONSE_LENGTH_INVALID");
  const expectedIds = plan.rows.map(({ requirementId }) => requirementId);
  const observedIds = response.map(({ requirementId }) => requirementId);
  if (JSON.stringify(observedIds) !== JSON.stringify(expectedIds))
    throw new Error("LF_A_DRIVEN_B_QUERY_EXPANSION_RESPONSE_IDS_INVALID");
  const expansions = {};
  for (const item of response) {
    if (
      !item ||
      Object.keys(item).sort().join(",") !==
        "requirementId,searchPhrases" ||
      !Array.isArray(item.searchPhrases) ||
      item.searchPhrases.length < 3 ||
      item.searchPhrases.length > 8 ||
      item.searchPhrases.some(
        (phrase) =>
          typeof phrase !== "string" ||
          phrase.trim().length < 3 ||
          phrase.trim().length > 120
      )
    )
      throw new Error(
        `LF_A_DRIVEN_B_QUERY_EXPANSION_ITEM_INVALID:${item?.requirementId || "-"}`
      );
    const phrases = [...new Set(item.searchPhrases.map((phrase) => phrase.trim()))];
    if (phrases.length < 3)
      throw new Error(
        `LF_A_DRIVEN_B_QUERY_EXPANSION_ITEM_DUPLICATE:${item.requirementId}`
      );
    expansions[item.requirementId] = phrases;
  }
  return expansions;
}

async function verifyModel({ baseUrl, model, modelContext }) {
  const apiRoot = baseUrl.replace(/\/v1\/?$/u, "");
  const response = await fetch(`${apiRoot}/api/v0/models`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`LF_A_DRIVEN_B_QUERY_EXPANSION_MODEL_LIST_FAILED:${response.status}`);
  const body = await response.json();
  const loaded = body?.data?.find(
    ({ id, type, state }) =>
      id === model && type === "llm" && state === "loaded"
  );
  if (!loaded || Number(loaded.loaded_context_length) !== Number(modelContext))
    throw new Error(
      `LF_A_DRIVEN_B_QUERY_EXPANSION_MODEL_NOT_EXACTLY_LOADED:${model}:${modelContext}`
    );
  return {
    id: loaded.id,
    state: loaded.state,
    loadedContextLength: Number(loaded.loaded_context_length),
  };
}

async function requestExpansions({ args, plan, client, recoverModelAfterAbort }) {
  const attempts = [];
  for (let attempt = 1; attempt <= args.maximumAttempts; attempt += 1) {
    const repair = attempts.length
      ? "Die vorige Antwort war nicht vertragsgültig. Gib genau ein JSON-Array mit allen requirementIds in unveränderter Reihenfolge und je 3 bis 8 eindeutigen kurzen searchPhrases aus."
      : null;
    const messages = prompt(plan, repair);
    const started = performance.now();
    let rawResponse = "";
    try {
      const completion = await requestCompletionWithTimeout({
        client,
        payload: {
          model: args.model,
          messages,
          temperature: 0,
          max_tokens: 8_000,
        },
        requestTimeoutMs: args.requestTimeoutMs,
        abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
        recoverModelAfterAbort,
      });
      rawResponse = completion.choices?.[0]?.message?.content || "";
      const response = parseJsonArray(rawResponse);
      const expansions = validateExpansionResponse(response, plan);
      attempts.push({
        attempt,
        status: "PASS",
        durationMs: Math.round(performance.now() - started),
        promptSha256: sha256(JSON.stringify(messages)),
        rawResponse,
        rawResponseSha256: sha256(rawResponse),
        usage: completion.usage || null,
      });
      return { attempts, expansions };
    } catch (error) {
      attempts.push({
        attempt,
        status: "RETRY",
        durationMs: Math.round(performance.now() - started),
        promptSha256: sha256(JSON.stringify(messages)),
        rawResponse,
        rawResponseSha256: sha256(rawResponse),
        errorClass: error.errorClass || error.name || "MODEL_RESPONSE_INVALID",
        errorMessage: error.message,
      });
    }
  }
  const error = new Error("LF_A_DRIVEN_B_QUERY_EXPANSION_ATTEMPTS_EXHAUSTED");
  error.attempts = attempts;
  throw error;
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  if (fs.existsSync(args.output)) {
    const stat = fs.lstatSync(args.output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("LF_A_DRIVEN_B_QUERY_EXPANSION_OUTPUT_INVALID");
    if (fs.readdirSync(args.output).length)
      throw new Error("LF_A_DRIVEN_B_QUERY_EXPANSION_OUTPUT_NOT_EMPTY");
  }
  const completeCorpus = artifact(
    args.runRoot,
    "a-driven-v2/b-complete/complete-b-corpus.private.json",
    "LF_B_QUERY_EXPANSION_COMPLETE_CORPUS"
  );
  const decisionPlan = artifact(
    args.runRoot,
    "a-driven-v2/b-requirement-decisions/decision-plan.private.json",
    "LF_B_QUERY_EXPANSION_DECISION_PLAN"
  );
  const preliminaryDecisions = artifact(
    args.runRoot,
    "a-driven-v2/b-requirement-decisions/requirement-decisions.private.json",
    "LF_B_QUERY_EXPANSION_PRELIMINARY_DECISIONS"
  );
  const absencePlan = artifact(
    args.runRoot,
    "a-driven-v2/b-absence/absence-plan.private.json",
    "LF_B_QUERY_EXPANSION_ABSENCE_PLAN"
  );
  const absenceDecisions = artifact(
    args.runRoot,
    "a-driven-v2/b-absence/absence-decisions.private.json",
    "LF_B_QUERY_EXPANSION_ABSENCE_DECISIONS"
  );
  const factIndex = buildADrivenBFactIndex({ completeCorpus });
  const baselinePlan = buildADrivenFastFallbackPlan({
    decisionPlan,
    preliminaryDecisions,
    completeCorpus,
    factIndex,
    lexicalTopKPerDocument: args.lexicalTopKPerDocument,
    maximumBatchCharacters: args.maximumBatchCharacters,
    retrievalScope: args.retrievalScope,
    neighborRadius: args.neighborRadius,
    neighborAnchorLimit: args.neighborAnchorLimit,
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
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const { attempts, expansions } = await requestExpansions({
    args,
    plan: baselinePlan,
    client,
    recoverModelAfterAbort,
  });
  const expandedPlan = buildADrivenFastFallbackPlan({
    decisionPlan,
    preliminaryDecisions,
    completeCorpus,
    factIndex,
    lexicalTopKPerDocument: args.lexicalTopKPerDocument,
    maximumBatchCharacters: args.maximumBatchCharacters,
    retrievalScope: args.retrievalScope,
    neighborRadius: args.neighborRadius,
    neighborAnchorLimit: args.neighborAnchorLimit,
    queryExpansionsByRequirement: expansions,
  });
  const replay = buildADrivenFastFallbackReplay({
    fastPlan: expandedPlan,
    factIndex,
    absencePlan,
    absenceDecisions,
  });
  const completedAt = new Date().toISOString();
  const expansionArtifact = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    promptContractId: PROMPT_CONTRACT_ID,
    baselinePlanSha256: baselinePlan.planSha256,
    model: loadedModel,
    startedAt,
    completedAt,
    wallDurationMs: Math.round(performance.now() - started),
    attempts,
    expansions: baselinePlan.rows.map(({ requirementId }) => ({
      requirementId,
      searchPhrases: expansions[requirementId],
    })),
  };
  expansionArtifact.expansionSha256 = sha256(
    JSON.stringify(expansionArtifact)
  );
  const summary = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    promptContractId: PROMPT_CONTRACT_ID,
    model: loadedModel,
    expansionSha256: expansionArtifact.expansionSha256,
    fastPlanSha256: expandedPlan.planSha256,
    replaySha256: replay.replaySha256,
    startedAt,
    completedAt,
    wallDurationMs: expansionArtifact.wallDurationMs,
    modelAttempts: attempts.length,
    successfulModelAttempts: attempts.filter(({ status }) => status === "PASS")
      .length,
    ...replay.summary,
    unassessedFactPairs: expandedPlan.summary.unassessedFactPairs,
    lexicalTopKPerDocument: expandedPlan.lexicalTopKPerDocument,
    retrievalScope: expandedPlan.retrievalScope,
    acceptanceReady: false,
    proofLimit:
      "Ein-Prompt-Query-Expansion-Shadow gegen bekannte Rescue-Fakten. Suchphrasen sind nur Navigation; sie entscheiden keine semantische Gleichheit und zertifizieren keine Abwesenheit.",
  };
  fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
  writePrivateJson(
    path.join(args.output, "query-expansions.private.json"),
    expansionArtifact
  );
  writePrivateJson(path.join(args.output, "b-fact-index.private.json"), factIndex);
  writePrivateJson(
    path.join(args.output, "expanded-fast-fallback-plan.private.json"),
    expandedPlan
  );
  writePrivateJson(path.join(args.output, "replay.private.json"), replay);
  writePrivateJson(path.join(args.output, "summary.private.json"), summary);
  console.log(
    `[lf-b-query-expansion-shadow] ${summary.recoveredPositiveFacts}/${summary.knownPositiveFacts} bekannte Rescue-Fakten; ${summary.shadowFactReviews}/${summary.baselineClauseReviews} Paarprüfungen; ${summary.shadowReviewBatches}/${summary.baselineRequests} Review-Batches; ${summary.wallDurationMs} ms; NICHT GEFUNDEN gesperrt`
  );
}

if (require.main === module)
  run().catch((error) => {
    if (Array.isArray(error.attempts) && error.attempts.length) {
      try {
        const args = argumentsFrom(process.argv.slice(2));
        fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
        writePrivateJson(
          path.join(args.output, "failed-attempts.private.json"),
          error.attempts
        );
      } catch {}
    }
    fail(error.stack || error.message);
  });

module.exports = {
  argumentsFrom,
  prompt,
  validateExpansionResponse,
};
