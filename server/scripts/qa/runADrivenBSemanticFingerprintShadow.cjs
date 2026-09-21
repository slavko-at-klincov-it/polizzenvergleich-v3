#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { OpenAI } = require("openai");
const {
  A_DRIVEN_FAST_FALLBACK_PLAN_CONTRACT_ID,
  buildADrivenBFactIndex,
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
const {
  compactRequirement,
  validateLocatorResponse,
} = require("./runADrivenBCorpusLocatorShadow.cjs");

const RUN_CONTRACT_ID = "LF_A_DRIVEN_B_SEMANTIC_FINGERPRINT_SHADOW_RUN_V1";
const PLAN_CONTRACT_ID = "LF_A_DRIVEN_B_SEMANTIC_FINGERPRINT_PLAN_V1";
const INDEX_PROMPT_CONTRACT_ID =
  "LF_A_DRIVEN_B_SEMANTIC_FINGERPRINT_INDEX_PROMPT_V1";
const MATCH_PROMPT_CONTRACT_ID =
  "LF_A_DRIVEN_B_SEMANTIC_FINGERPRINT_MATCH_PROMPT_V1";
const DEFAULT_MODEL = "qwen/qwen3.6-35b-a3b";
const DEFAULT_CONTEXT = 42_496;

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function fail(message) {
  console.error(`[lf-b-semantic-fingerprint-shadow] ${message}`);
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
    "runRoot",
    "output",
    "seedOutput",
    "lmStudioSdk",
    "qwenModelKey",
    "model",
    "modelContext",
    "maximumAttempts",
    "maximumPartitionCharacters",
    "maximumFactsPerPartition",
    "maximumNewPartitions",
    "requestTimeoutMs",
    "abortSettlementTimeoutMs",
    "modelRecoveryTimeoutMs",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of ["runRoot", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const number = (name, fallback, minimum = 1) => {
    const parsed = Number(values[name] ?? fallback);
    if (!Number.isSafeInteger(parsed) || parsed < minimum)
      fail(`--${name} ist ungültig`);
    return parsed;
  };
  return {
    runRoot: path.resolve(values.runRoot),
    output: path.resolve(values.output),
    seedOutput: values.seedOutput ? path.resolve(values.seedOutput) : null,
    lmStudioSdk: values.lmStudioSdk ? path.resolve(values.lmStudioSdk) : null,
    qwenModelKey: values.qwenModelKey || null,
    model: values.model || DEFAULT_MODEL,
    modelContext: number("modelContext", DEFAULT_CONTEXT, 1_000),
    maximumAttempts: number("maximumAttempts", 1),
    maximumPartitionCharacters: number(
      "maximumPartitionCharacters",
      55_000,
      10_000
    ),
    maximumFactsPerPartition: number("maximumFactsPerPartition", 45),
    maximumNewPartitions:
      values.maximumNewPartitions === undefined
        ? null
        : number("maximumNewPartitions", 0, 0),
    requestTimeoutMs: number("requestTimeoutMs", 300_000),
    abortSettlementTimeoutMs: number("abortSettlementTimeoutMs", 15_000),
    modelRecoveryTimeoutMs: number("modelRecoveryTimeoutMs", 180_000),
  };
}

function compactFact(fact) {
  return {
    factId: fact.factId,
    documentRole: fact.documentRole,
    physicalPageNumber: fact.physicalPageNumber,
    exactText: fact.exactText,
  };
}

function partitionFacts({
  facts,
  maximumPartitionCharacters,
  maximumFactsPerPartition,
}) {
  if (!Array.isArray(facts) || facts.length === 0)
    throw new Error("LF_B_SEMANTIC_FINGERPRINT_FACTS_INVALID");
  const partitions = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const partitionIndex = partitions.length;
    const factIds = current.map(({ factId }) => factId);
    partitions.push({
      partitionId: `BSF-${sha256(
        JSON.stringify({ partitionIndex, factIds })
      ).slice(0, 24)}`,
      partitionIndex,
      factIds,
      facts: current,
    });
    current = [];
  };
  for (const fact of facts.map(compactFact)) {
    const proposed = [...current, fact];
    const tooMany = proposed.length > maximumFactsPerPartition;
    const tooLarge =
      JSON.stringify({ facts: proposed }).length > maximumPartitionCharacters;
    if (current.length && (tooMany || tooLarge)) flush();
    if (
      JSON.stringify({ facts: [fact] }).length > maximumPartitionCharacters
    )
      throw new Error(
        `LF_B_SEMANTIC_FINGERPRINT_FACT_TOO_LARGE:${fact.factId}`
      );
    current.push(fact);
  }
  flush();
  return partitions;
}

function buildPlan({
  factIndex,
  decisionPlan,
  preliminaryDecisions,
  maximumPartitionCharacters,
  maximumFactsPerPartition,
}) {
  const fallbackIds = new Set(
    preliminaryDecisions.results
      .filter(({ customerStatus }) => customerStatus === "FALLBACK_REQUIRED")
      .map(({ requirementId }) => requirementId)
  );
  const requirements = decisionPlan.rows
    .filter(({ requirementId }) => fallbackIds.has(requirementId))
    .map(compactRequirement);
  const partitions = partitionFacts({
    facts: factIndex.facts,
    maximumPartitionCharacters,
    maximumFactsPerPartition,
  });
  const payload = {
    schemaVersion: 1,
    contractId: PLAN_CONTRACT_ID,
    decisionPlanSha256: decisionPlan.planSha256,
    preliminaryDecisionSha256: preliminaryDecisions.decisionSha256,
    factIndexSha256: factIndex.indexSha256,
    requirements,
    partitions,
    summary: {
      requirements: requirements.length,
      facts: factIndex.facts.length,
      indexRequests: partitions.length,
      matchRequests: 1,
      totalModelRequests: partitions.length + 1,
      customerNotFoundEligible: false,
    },
    proofLimit:
      "Semantische Fingerabdrücke und Matching sind ein Shadow-Kandidatenpfad. Leere Treffer zertifizieren keine Abwesenheit.",
  };
  return {
    ...payload,
    planSha256: sha256(`${PLAN_CONTRACT_ID}\u0000${JSON.stringify(payload)}`),
  };
}

function indexPrompt(plan, partition, repair = null) {
  const messages = [
    {
      role: "system",
      content:
        "Verdichte jede vorgelegte Vertragsklausel unabhängig und verlustarm. Antworte ausschließlich als JSON-Array: [{factId,synopsis,semanticKeys:[...]}]. Jede factId muss mindestens einmal vorkommen. Eine factId darf bei mehreren eigenständigen Regelungen ausnahmsweise mehrere Einträge erhalten; jeder Eintrag beschreibt genau eine Facette. synopsis ist ein fachlich präziser deutscher Ein-Satz-Fingerabdruck mit höchstens 180 Zeichen und muss Objekt, Wirkung, Gefahr/Ursache, Bedingung, Limit oder Ausschluss enthalten, soweit im Text vorhanden. semanticKeys enthält 3 bis 10 kurze normalisierte deutsche Suchbegriffe oder Synonyme mit jeweils höchstens 60 Zeichen. Erfinde keine Vertragswirkung, Zahl, Partei oder Deckung. Keine weiteren Felder und keine Erläuterung.",
    },
    {
      role: "user",
      content: JSON.stringify({
        contractId: RUN_CONTRACT_ID,
        promptContractId: INDEX_PROMPT_CONTRACT_ID,
        partitionId: partition.partitionId,
        facts: partition.facts,
      }),
    },
  ];
  if (repair) messages.push({ role: "user", content: repair });
  return messages;
}

function validateFingerprintResponse(response, partition) {
  if (!Array.isArray(response) || response.length === 0)
    throw new Error("LF_B_SEMANTIC_FINGERPRINT_RESPONSE_INVALID");
  const factsById = new Map(
    partition.facts.map((fact) => [fact.factId, fact])
  );
  const normalized = response.map((item) => {
    const keys = Object.keys(item).sort().join(",");
    const semanticKeys = item.semanticKeys;
    if (
      !factsById.has(item.factId) ||
      keys !== "factId,semanticKeys,synopsis" ||
      typeof item.synopsis !== "string" ||
      !item.synopsis.trim() ||
      item.synopsis.length > 180 ||
      !Array.isArray(semanticKeys) ||
      semanticKeys.length < 3 ||
      semanticKeys.length > 10 ||
      semanticKeys.some(
        (value) =>
          typeof value !== "string" ||
          !value.trim() ||
          value.length > 60
      ) ||
      new Set(semanticKeys).size !== semanticKeys.length
    )
      throw new Error(
        `LF_B_SEMANTIC_FINGERPRINT_RESPONSE_ITEM_INVALID:${item?.factId || "-"}`
      );
    return {
      factId: item.factId,
      synopsis: item.synopsis.trim(),
      semanticKeys: semanticKeys.map((value) => value.trim()),
    };
  });
  const represented = new Set(normalized.map(({ factId }) => factId));
  const missingFacts = partition.facts.filter(
    ({ factId }) => !represented.has(factId)
  );
  if (missingFacts.length > 1)
    throw new Error(
      `LF_B_SEMANTIC_FINGERPRINT_RESPONSE_MISSING:${missingFacts
        .map(({ factId }) => factId)
        .join(",")}`
    );
  const fallback = missingFacts.map((fact) => ({
    factId: fact.factId,
    synopsis: fact.exactText.slice(0, 180),
    semanticKeys: [
      ...new Set(
        fact.exactText
          .toLocaleLowerCase("de-AT")
          .match(/[\p{L}\p{N}]{4,}/gu) || []
      ),
    ].slice(0, 10),
  }));
  if (fallback.some(({ semanticKeys }) => semanticKeys.length < 3))
    throw new Error("LF_B_SEMANTIC_FINGERPRINT_FALLBACK_INVALID");
  return [...normalized, ...fallback];
}

function matchPrompt(plan, fingerprints, repair = null) {
  const messages = [
    {
      role: "system",
      content:
        "Du bist ein verlustarmer semantischer Kandidaten-Locator. Vergleiche jede requirementId unabhängig mit allen kompakten B-Fingerabdrücken. Nenne eine factId, wenn möglicherweise derselbe fachliche Kern, ein Ober-/Unterfall, eine funktional gleiche Vertragswirkung, ein ausdrücklicher Ausschluss oder derselbe Kern mit abweichendem Wert, Limit, Umfang, Bedingung oder Zeitraum vorliegt. Im Zweifel aufnehmen; bloße Themenähnlichkeit nicht aufnehmen. Triff keine Endentscheidung und zertifiziere keine Abwesenheit. Antworte ausschließlich als JSON-Array in exakt der vorgegebenen requirementId-Reihenfolge: [{requirementId,candidateFactIds:[...]}]. Maximal 12 eindeutige factIds pro requirementId, keine weiteren Felder und keine Erläuterung.",
    },
    {
      role: "user",
      content: JSON.stringify({
        contractId: RUN_CONTRACT_ID,
        promptContractId: MATCH_PROMPT_CONTRACT_ID,
        requirements: plan.requirements,
        fingerprints,
      }),
    },
  ];
  if (repair) messages.push({ role: "user", content: repair });
  return messages;
}

async function verifyModel({ baseUrl, model, modelContext }) {
  const response = await fetch(
    `${baseUrl.replace(/\/v1\/?$/u, "")}/api/v0/models`,
    { signal: AbortSignal.timeout(15_000) }
  );
  if (!response.ok)
    throw new Error(
      `LF_B_SEMANTIC_FINGERPRINT_MODEL_LIST_FAILED:${response.status}`
    );
  const body = await response.json();
  const loaded = body?.data?.find(
    ({ id, type, state }) =>
      id === model && type === "llm" && state === "loaded"
  );
  if (!loaded || Number(loaded.loaded_context_length) !== Number(modelContext))
    throw new Error(
      `LF_B_SEMANTIC_FINGERPRINT_MODEL_NOT_EXACTLY_LOADED:${model}:${modelContext}`
    );
  return {
    id: loaded.id,
    state: loaded.state,
    loadedContextLength: Number(loaded.loaded_context_length),
  };
}

async function completeJsonArray({
  args,
  client,
  recoverModelAfterAbort,
  messagesFrom,
  validate,
  maxTokens,
}) {
  const attempts = [];
  for (let attempt = 1; attempt <= args.maximumAttempts; attempt += 1) {
    const repair = attempts.length
      ? "Die vorige Antwort war nicht vertragsgültig. Wiederhole exakt alle IDs in der vorgegebenen Reihenfolge und halte das verlangte JSON-Schema ein."
      : null;
    const started = performance.now();
    let rawResponse = "";
    try {
      const completion = await requestCompletionWithTimeout({
        client,
        payload: {
          model: args.model,
          messages: messagesFrom(repair),
          temperature: 0,
          max_tokens: maxTokens,
        },
        requestTimeoutMs: args.requestTimeoutMs,
        abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
        recoverModelAfterAbort,
      });
      rawResponse = completion.choices?.[0]?.message?.content || "";
      const parsed = parseJsonArray(rawResponse);
      const value = validate(parsed.responses);
      attempts.push({
        attempt,
        status: "PASS",
        durationMs: Math.round(performance.now() - started),
        rawResponse,
        rawResponseSha256: sha256(rawResponse),
        syntaxRepair: parsed.syntaxRepair,
        usage: completion.usage || null,
      });
      return { value, attempts };
    } catch (error) {
      attempts.push({
        attempt,
        status: "RETRY",
        durationMs: Math.round(performance.now() - started),
        rawResponse,
        rawResponseSha256: sha256(rawResponse),
        errorClass: error.errorClass || error.name || "MODEL_RESPONSE_INVALID",
        errorMessage: error.message,
      });
    }
  }
  const error = new Error("LF_B_SEMANTIC_FINGERPRINT_ATTEMPTS_EXHAUSTED");
  error.attempts = attempts;
  throw error;
}

function reusablePartition({ seedOutput, plan, partition }) {
  if (!seedOutput) return null;
  const resultPath = path.join(
    seedOutput,
    `fingerprint-${String(partition.partitionIndex).padStart(3, "0")}.private.json`
  );
  if (!fs.existsSync(resultPath)) return null;
  const result = readJson(resultPath, "LF_B_SEMANTIC_FINGERPRINT_SEED");
  if (
    result.contractId !== RUN_CONTRACT_ID ||
    result.planSha256 !== plan.planSha256 ||
    result.partitionId !== partition.partitionId ||
    !Array.isArray(result.attempts) ||
    !result.attempts.some(({ status }) => status === "PASS")
  )
    throw new Error(
      `LF_B_SEMANTIC_FINGERPRINT_SEED_INVALID:${partition.partitionId}`
    );
  return {
    ...result,
    fingerprints: validateFingerprintResponse(result.fingerprints, partition),
    reusedFrom: resultPath,
  };
}

function fastPlanFromMatches(plan, factIndex, matches) {
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_FAST_FALLBACK_PLAN_CONTRACT_ID,
    factIndexSha256: factIndex.indexSha256,
    rows: matches.map(({ requirementId, candidateFactIds }) => ({
      requirementId,
      candidateFactIds: [...candidateFactIds].sort(),
    })),
    summary: {
      selectedFactReviews: matches.reduce(
        (sum, row) => sum + row.candidateFactIds.length,
        0
      ),
      reviewBatches: 1,
      customerNotFoundEligible: false,
    },
  };
  return {
    ...payload,
    planSha256: sha256(JSON.stringify(payload)),
  };
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  if (fs.existsSync(args.output))
    throw new Error("LF_B_SEMANTIC_FINGERPRINT_OUTPUT_EXISTS");
  const artifact = (relative, code) =>
    readJson(path.join(args.runRoot, relative), code);
  const completeCorpus = artifact(
    "a-driven-v2/b-complete/complete-b-corpus.private.json",
    "LF_B_SEMANTIC_FINGERPRINT_COMPLETE_CORPUS"
  );
  const decisionPlan = artifact(
    "a-driven-v2/b-requirement-decisions/decision-plan.private.json",
    "LF_B_SEMANTIC_FINGERPRINT_DECISION_PLAN"
  );
  const preliminaryDecisions = artifact(
    "a-driven-v2/b-requirement-decisions/requirement-decisions.private.json",
    "LF_B_SEMANTIC_FINGERPRINT_PRELIMINARY_DECISIONS"
  );
  const absencePlan = artifact(
    "a-driven-v2/b-absence/absence-plan.private.json",
    "LF_B_SEMANTIC_FINGERPRINT_ABSENCE_PLAN"
  );
  const absenceDecisions = artifact(
    "a-driven-v2/b-absence/absence-decisions.private.json",
    "LF_B_SEMANTIC_FINGERPRINT_ABSENCE_DECISIONS"
  );
  const factIndex = buildADrivenBFactIndex({ completeCorpus });
  const plan = buildPlan({
    factIndex,
    decisionPlan,
    preliminaryDecisions,
    maximumPartitionCharacters: args.maximumPartitionCharacters,
    maximumFactsPerPartition: args.maximumFactsPerPartition,
  });
  fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
  writePrivateJson(path.join(args.output, "fingerprint-plan.private.json"), plan);
  if (args.maximumNewPartitions === 0) {
    console.log(
      `[lf-b-semantic-fingerprint-shadow] PLAN: ${plan.summary.facts} Fakten in ${plan.summary.indexRequests} Index-Requests plus ${plan.summary.matchRequests} Match-Request; NICHT GEFUNDEN gesperrt`
    );
    return;
  }
  if (!args.lmStudioSdk || !args.qwenModelKey)
    throw new Error("LF_B_SEMANTIC_FINGERPRINT_MODEL_ARGUMENTS_MISSING");
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
  const results = [];
  let newPartitions = 0;
  for (const partition of plan.partitions) {
    const reusable = reusablePartition({
      seedOutput: args.seedOutput,
      plan,
      partition,
    });
    if (reusable) {
      writePrivateJson(
        path.join(
          args.output,
          `fingerprint-${String(partition.partitionIndex).padStart(3, "0")}.private.json`
        ),
        reusable
      );
      results.push(reusable);
      console.log(
        `[lf-b-semantic-fingerprint-shadow] Index ${partition.partitionIndex + 1}/${plan.partitions.length}: PASS (wiederverwendet)`
      );
      continue;
    }
    if (
      args.maximumNewPartitions !== null &&
      newPartitions >= args.maximumNewPartitions
    )
      break;
    let completion;
    try {
      completion = await completeJsonArray({
        args,
        client,
        recoverModelAfterAbort,
        messagesFrom: (repair) => indexPrompt(plan, partition, repair),
        validate: (response) =>
          validateFingerprintResponse(response, partition),
        maxTokens: 6_000,
      });
    } catch (error) {
      writePrivateJson(
        path.join(
          args.output,
          `fingerprint-${String(partition.partitionIndex).padStart(3, "0")}-failure.private.json`
        ),
        {
          schemaVersion: 1,
          contractId: RUN_CONTRACT_ID,
          planSha256: plan.planSha256,
          partitionId: partition.partitionId,
          attempts: error.attempts || [],
        }
      );
      throw error;
    }
    const result = {
      schemaVersion: 1,
      contractId: RUN_CONTRACT_ID,
      planSha256: plan.planSha256,
      partitionId: partition.partitionId,
      fingerprints: completion.value,
      attempts: completion.attempts,
    };
    writePrivateJson(
      path.join(
        args.output,
        `fingerprint-${String(partition.partitionIndex).padStart(3, "0")}.private.json`
      ),
      result
    );
    results.push(result);
    newPartitions += 1;
    console.log(
      `[lf-b-semantic-fingerprint-shadow] Index ${partition.partitionIndex + 1}/${plan.partitions.length}: PASS`
    );
  }
  if (results.length !== plan.partitions.length) {
    console.log(
      `[lf-b-semantic-fingerprint-shadow] KONTROLLIERTER STOP: ${results.length}/${plan.partitions.length} Index-Partitionen`
    );
    return;
  }
  const fingerprints = results.flatMap((result) => result.fingerprints);
  let matchCompletion;
  try {
    matchCompletion = await completeJsonArray({
      args,
      client,
      recoverModelAfterAbort,
      messagesFrom: (repair) => matchPrompt(plan, fingerprints, repair),
      validate: (response) =>
        validateLocatorResponse(
          response,
          plan,
          { factIds: factIndex.facts.map(({ factId }) => factId) }
        ),
      maxTokens: 6_000,
    });
  } catch (error) {
    writePrivateJson(path.join(args.output, "match-failure.private.json"), {
      schemaVersion: 1,
      contractId: RUN_CONTRACT_ID,
      planSha256: plan.planSha256,
      attempts: error.attempts || [],
    });
    throw error;
  }
  const matches = matchCompletion.value;
  writePrivateJson(path.join(args.output, "matches.private.json"), {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    planSha256: plan.planSha256,
    responses: matches,
    attempts: matchCompletion.attempts,
  });
  const fastPlan = fastPlanFromMatches(plan, factIndex, matches);
  const replay = buildADrivenFastFallbackReplay({
    fastPlan,
    factIndex,
    absencePlan,
    absenceDecisions,
  });
  const newIndexAttempts = results.reduce(
    (sum, result) =>
      sum + (result.reusedFrom ? 0 : result.attempts.length),
    0
  );
  const summary = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    planSha256: plan.planSha256,
    model: loadedModel,
    startedAt,
    completedAt: new Date().toISOString(),
    wallDurationMs: Math.round(performance.now() - started),
    indexRequests: newPartitions,
    reusedIndexPartitions: results.length - newPartitions,
    matchRequests: 1,
    modelAttempts: newIndexAttempts + matchCompletion.attempts.length,
    ...replay.summary,
    acceptanceReady: false,
    proofLimit: plan.proofLimit,
  };
  writePrivateJson(path.join(args.output, "fast-plan.private.json"), fastPlan);
  writePrivateJson(path.join(args.output, "replay.private.json"), replay);
  writePrivateJson(path.join(args.output, "summary.private.json"), summary);
  console.log(
    `[lf-b-semantic-fingerprint-shadow] ${summary.recoveredPositiveFacts}/${summary.knownPositiveFacts} bekannte Rescue-Fakten; ${summary.shadowFactReviews} nominierte Paare; ${summary.indexRequests + summary.matchRequests} neue Requests; ${summary.wallDurationMs} ms; NICHT GEFUNDEN gesperrt`
  );
}

if (require.main === module)
  run().catch((error) => fail(error.stack || error.message));

module.exports = {
  buildPlan,
  fastPlanFromMatches,
  indexPrompt,
  matchPrompt,
  partitionFacts,
  validateFingerprintResponse,
};
