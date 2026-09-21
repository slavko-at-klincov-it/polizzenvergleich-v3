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
  buildADrivenBRetrievalWindows,
  buildADrivenFastFallbackPlan,
  buildADrivenTerminalEvidenceReplay,
} = require("../../utils/policyAnalysis/aDrivenBFactIndex");
const {
  validateADrivenRequirementDecisionArtifact,
  validateADrivenRequirementDecisionPlan,
} = require("../../utils/policyAnalysis/aDrivenRequirementCounterpartDecision");
const {
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  createLmStudioRecovery,
  parseJsonArray,
  requestCompletionWithTimeout,
} = require("./runADrivenReferenceClassification.cjs");
const {
  readJson,
  writePrivateJson,
} = require("./buildADrivenBFastPathShadow.cjs");

const RUN_CONTRACT_ID = "LF_A_DRIVEN_B_CORPUS_LOCATOR_SHADOW_RUN_V7";
const PLAN_CONTRACT_ID = "LF_A_DRIVEN_B_CORPUS_LOCATOR_PLAN_V7";
const PROMPT_CONTRACT_ID = "LF_A_DRIVEN_B_CORPUS_LOCATOR_PROMPT_V7";
const DEFAULT_MODEL = "qwen/qwen3.6-35b-a3b";
const DEFAULT_CONTEXT = 42_496;

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function fail(message) {
  console.error(`[lf-b-corpus-locator-shadow] ${message}`);
  process.exit(1);
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      fail(`Ungültiges Argument: ${key || "-"}`);
    values[key.slice(2)] = value;
  }
  for (const required of ["runRoot", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const number = (name, fallback, minimum = 1) => {
    const parsed = Number(values[name] ?? fallback);
    if (!Number.isSafeInteger(parsed) || parsed < minimum)
      fail(`--${name} ist ungültig`);
    return parsed;
  };
  const args = {
    runRoot: path.resolve(values.runRoot),
    output: path.resolve(values.output),
    seedOutput: values.seedOutput ? path.resolve(values.seedOutput) : null,
    queryExpansionArtifact: values.queryExpansionArtifact
      ? path.resolve(values.queryExpansionArtifact)
      : null,
    lmStudioSdk: values.lmStudioSdk ? path.resolve(values.lmStudioSdk) : null,
    qwenModelKey: values.qwenModelKey || null,
    model: values.model || DEFAULT_MODEL,
    modelContext: number("modelContext", DEFAULT_CONTEXT, 1_000),
    partitionMode: values.partitionMode || "CHARACTER",
    maximumAttempts: number("maximumAttempts", 2),
    routeLexicalTopK: number("routeLexicalTopK", 20),
    routeNeighborRadius: number("routeNeighborRadius", 0, 0),
    routeNeighborAnchorLimit: number("routeNeighborAnchorLimit", 0, 0),
    routeRetrievalUnitStrategy:
      values.routeRetrievalUnitStrategy || "SOURCE_WINDOWS",
    routeWindowMaximumTokens: number("routeWindowMaximumTokens", 32, 8),
    routeWindowOverlapTokens: number("routeWindowOverlapTokens", 8, 0),
    maximumPartitionCharacters: number(
      "maximumPartitionCharacters",
      115_000,
      20_000
    ),
    maximumNewPartitions:
      values.maximumNewPartitions === undefined
        ? null
        : number("maximumNewPartitions", 0, 0),
    requestTimeoutMs: number("requestTimeoutMs", 300_000),
    abortSettlementTimeoutMs: number("abortSettlementTimeoutMs", 15_000),
    modelRecoveryTimeoutMs: number("modelRecoveryTimeoutMs", 180_000),
  };
  if (
    !["PARENT_FACTS", "SOURCE_WINDOWS"].includes(
      args.routeRetrievalUnitStrategy
    ) ||
    args.routeWindowOverlapTokens >= args.routeWindowMaximumTokens
  )
    fail("Routing-Fensterparameter sind ungültig");
  return args;
}

function compactRequirement(row) {
  return {
    requirementId: row.requirementId,
    displayLabel: row.displayLabel,
    structurePath: row.structurePath,
    identityCores: [
      ...new Set(
        row.components.map(({ identityCore }) => identityCore).filter(Boolean)
      ),
    ],
  };
}

function compactFact(fact) {
  return {
    factId: fact.factId,
    ...(fact.parentFactId ? { parentFactId: fact.parentFactId } : {}),
    documentUuid: fact.documentUuid,
    documentRole: fact.documentRole,
    physicalPageNumber: fact.physicalPageNumber,
    exactText: fact.exactText,
  };
}

function partitionFacts(facts, maximumPartitionCharacters) {
  if (
    !Array.isArray(facts) ||
    facts.length === 0 ||
    !Number.isSafeInteger(maximumPartitionCharacters) ||
    maximumPartitionCharacters < 20_000
  )
    throw new Error("LF_A_DRIVEN_B_CORPUS_LOCATOR_PARTITION_INPUT_INVALID");
  const partitions = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const partitionIndex = partitions.length;
    const factIds = current.map(({ factId }) => factId);
    partitions.push({
      partitionId: `BCL-${sha256(
        stableStringify({ partitionIndex, factIds })
      ).slice(0, 24)}`,
      partitionIndex,
      factIds,
      candidates: current,
    });
    current = [];
  };
  for (const fact of facts.map(compactFact)) {
    const proposed = [...current, fact];
    if (
      current.length &&
      JSON.stringify({ candidates: proposed }).length >
        maximumPartitionCharacters
    )
      flush();
    if (
      JSON.stringify({ candidates: [fact] }).length > maximumPartitionCharacters
    )
      throw new Error(
        `LF_A_DRIVEN_B_CORPUS_LOCATOR_FACT_TOO_LARGE:${fact.factId}`
      );
    current.push(fact);
  }
  flush();
  return partitions;
}

function partitionFactsByDocument(facts, maximumPartitionCharacters) {
  if (
    !Array.isArray(facts) ||
    facts.length === 0 ||
    !Number.isSafeInteger(maximumPartitionCharacters) ||
    maximumPartitionCharacters < 20_000
  )
    throw new Error("LF_A_DRIVEN_B_CORPUS_LOCATOR_PARTITION_INPUT_INVALID");
  const groups = new Map();
  for (const fact of facts.map(compactFact)) {
    if (!groups.has(fact.documentUuid)) groups.set(fact.documentUuid, []);
    groups.get(fact.documentUuid).push(fact);
  }
  return [...groups.entries()].map(([documentUuid, candidates], index) => {
    if (JSON.stringify({ candidates }).length > maximumPartitionCharacters)
      throw new Error(
        `LF_A_DRIVEN_B_CORPUS_LOCATOR_DOCUMENT_TOO_LARGE:${documentUuid}`
      );
    const factIds = candidates.map(({ factId }) => factId);
    return {
      partitionId: `BCLD-${sha256(
        stableStringify({ documentUuid, factIds })
      ).slice(0, 24)}`,
      partitionIndex: index,
      documentUuid,
      factIds,
      candidates,
    };
  });
}

function buildPlan({
  decisionPlan,
  preliminaryDecisions,
  factIndex,
  candidateCorpus = factIndex.facts,
  candidateUnitType = "PARENT_FACT",
  maximumPartitionCharacters,
  partitionMode = "CHARACTER",
  candidateFactIdsByRequirement = null,
}) {
  validateADrivenRequirementDecisionPlan(decisionPlan);
  validateADrivenRequirementDecisionArtifact(
    preliminaryDecisions,
    decisionPlan
  );
  const fallbackIds = new Set(
    preliminaryDecisions.results
      .filter(({ customerStatus }) => customerStatus === "FALLBACK_REQUIRED")
      .map(({ requirementId }) => requirementId)
  );
  const requirements = decisionPlan.rows
    .filter(({ requirementId }) => fallbackIds.has(requirementId))
    .map((row) => ({
      ...compactRequirement(row),
      ...(candidateFactIdsByRequirement
        ? {
            candidateFactIds:
              candidateFactIdsByRequirement[row.requirementId] || [],
          }
        : {}),
    }));
  if (!["CHARACTER", "DOCUMENT"].includes(partitionMode))
    throw new Error("LF_A_DRIVEN_B_CORPUS_LOCATOR_PARTITION_MODE_INVALID");
  const routedFactIds = candidateFactIdsByRequirement
    ? new Set(Object.values(candidateFactIdsByRequirement).flat())
    : null;
  const routedFacts = routedFactIds
    ? candidateCorpus.filter(({ factId }) => routedFactIds.has(factId))
    : candidateCorpus;
  if (routedFactIds && routedFacts.length !== routedFactIds.size)
    throw new Error("LF_A_DRIVEN_B_CORPUS_LOCATOR_ROUTED_FACT_UNKNOWN");
  const partitions =
    partitionMode === "DOCUMENT"
      ? partitionFactsByDocument(routedFacts, maximumPartitionCharacters)
      : partitionFacts(routedFacts, maximumPartitionCharacters);
  const payload = {
    schemaVersion: 1,
    contractId: PLAN_CONTRACT_ID,
    decisionPlanSha256: decisionPlan.planSha256,
    preliminaryDecisionSha256: preliminaryDecisions.decisionSha256,
    factIndexSha256: factIndex.indexSha256,
    candidateUnitType,
    partitionMode,
    maximumPartitionCharacters,
    requirements,
    partitions,
    summary: {
      requirements: requirements.length,
      sourceFacts: factIndex.facts.length,
      sourceCandidates: candidateCorpus.length,
      routedFacts: routedFacts.length,
      partitions: partitions.length,
      modelRequests: partitions.length,
      routedPairReviews: candidateFactIdsByRequirement
        ? requirements.reduce(
            (sum, requirement) => sum + requirement.candidateFactIds.length,
            0
          )
        : null,
      promptedPairReviews: partitions.reduce(
        (sum, partition) =>
          sum +
          requirementsForPartition({ requirements }, partition).length *
            partition.factIds.length,
        0
      ),
      customerNotFoundEligible: false,
    },
    proofLimit:
      candidateUnitType === "SOURCE_WINDOW"
        ? "Der Locator nominiert nur kurze, quellgebundene Navigationsfenster und bindet Treffer anschließend an vollständige B-Fakten zurück. Leere Nominierungen sind kein Abwesenheitsbeweis."
        : "Der Locator nominiert nur Kandidaten aus vollständigen B-Korpuspartitionen. Leere Nominierungen sind kein Abwesenheitsbeweis.",
  };
  return {
    ...payload,
    planSha256: sha256(`${PLAN_CONTRACT_ID}\u0000${stableStringify(payload)}`),
  };
}

function prompt(plan, partition, repair = null) {
  const view = locatorPromptView(plan, partition);
  const messages = [
    {
      role: "system",
      content:
        'Du bist ausschließlich ein verlustarmer Kandidaten-Locator. Prüfe jede Anforderung r unabhängig gegen alle vorgelegten B-Quelltexte. Nenne alle lokalen Kandidatennummern c, die möglicherweise denselben fachlichen Kern, einen Ober-/Unterfall, eine funktional gleiche Vertragswirkung, einen ausdrücklichen Ausschluss oder denselben Kern mit abweichendem Wert, Limit, Umfang, Bedingung oder Zeitraum enthalten. Kurze Quellfenster sind reine Navigation und werden serverseitig an vollständige Elternklauseln zurückgebunden. Im Zweifel aufnehmen; bloße Themenähnlichkeit nicht aufnehmen. Triff keine Endentscheidung und zertifiziere keine Abwesenheit. Antworte ausschließlich als genau ein kompaktes JSON-Array in der vorgegebenen Reihenfolge: [{"r":1,"c":[2,5]}]. Jedes r genau einmal, nur eindeutige vorgelegte c, keine Erläuterung und keine weiteren Felder. Kopiere nicht dieselbe Kandidatenliste pauschal auf fachlich verschiedene Anforderungen.',
    },
    {
      role: "user",
      content: JSON.stringify({
        contractId: RUN_CONTRACT_ID,
        promptContractId: PROMPT_CONTRACT_ID,
        partitionId: partition.partitionId,
        requirements: view.requirements,
        candidates: view.candidates,
      }),
    },
  ];
  if (repair) messages.push({ role: "user", content: repair });
  return messages;
}

function requirementsForPartition(plan, partition) {
  const partitionFactIds = new Set(partition.factIds);
  return plan.requirements
    .map((requirement) => ({
      ...requirement,
      ...(requirement.candidateFactIds
        ? {
            candidateFactIds: requirement.candidateFactIds.filter((factId) =>
              partitionFactIds.has(factId)
            ),
          }
        : {}),
    }))
    .filter(
      (requirement) =>
        !requirement.candidateFactIds || requirement.candidateFactIds.length > 0
    );
}

function locatorPromptView(plan, partition) {
  const requirements = requirementsForPartition(plan, partition);
  return {
    requirements: requirements.map((requirement, index) => ({
      r: index + 1,
      label: requirement.displayLabel,
      path: requirement.structurePath,
      cores: requirement.identityCores,
    })),
    candidates: partition.candidates.map((candidate, index) => ({
      c: index + 1,
      role: candidate.documentRole,
      page: candidate.physicalPageNumber,
      text: candidate.exactText,
    })),
  };
}

function validateLocatorAliasResponse(response, plan, partition) {
  const requirements = requirementsForPartition(plan, partition);
  if (!Array.isArray(response) || response.length !== requirements.length)
    throw new Error("LF_A_DRIVEN_B_CORPUS_LOCATOR_RESPONSE_LENGTH_INVALID");
  const factIdByCandidateNumber = new Map(
    partition.factIds.map((factId, index) => [index + 1, factId])
  );
  const validCandidateNumbers = new Set(factIdByCandidateNumber.keys());
  const signatures = response.map((item) =>
    Array.isArray(item?.c)
      ? [...item.c].sort((left, right) => left - right).join(",")
      : ""
  );
  if (requirements.length >= 8) {
    const counts = new Map();
    for (const signature of signatures)
      if (signature) counts.set(signature, (counts.get(signature) || 0) + 1);
    if (
      Math.max(0, ...counts.values()) >= Math.ceil(requirements.length * 0.75)
    )
      throw new Error("LF_A_DRIVEN_B_CORPUS_LOCATOR_RESPONSE_DEGENERATE");
  }
  return response.map((item, index) => {
    const expectedRequirementNumber = index + 1;
    if (
      !item ||
      Object.keys(item).sort().join(",") !== "c,r" ||
      item.r !== expectedRequirementNumber ||
      !Array.isArray(item.c) ||
      new Set(item.c).size !== item.c.length ||
      item.c.some(
        (candidateNumber) =>
          !Number.isSafeInteger(candidateNumber) ||
          !validCandidateNumbers.has(candidateNumber)
      )
    )
      throw new Error(
        `LF_A_DRIVEN_B_CORPUS_LOCATOR_RESPONSE_ITEM_INVALID:${item?.r || "-"}`
      );
    return {
      requirementId: requirements[index].requirementId,
      candidateFactIds: [...new Set(item.c)].map((candidateNumber) =>
        factIdByCandidateNumber.get(candidateNumber)
      ),
    };
  });
}

function validateLocatorResponse(response, plan, partition) {
  const requirements = requirementsForPartition(plan, partition);
  if (!Array.isArray(response) || response.length !== requirements.length)
    throw new Error("LF_A_DRIVEN_B_CORPUS_LOCATOR_RESPONSE_LENGTH_INVALID");
  const expectedIds = requirements.map(({ requirementId }) => requirementId);
  if (
    JSON.stringify(response.map(({ requirementId }) => requirementId)) !==
    JSON.stringify(expectedIds)
  )
    throw new Error("LF_A_DRIVEN_B_CORPUS_LOCATOR_RESPONSE_IDS_INVALID");
  const partitionFactIds = new Set(partition.factIds);
  const allowedByRequirement = new Map(
    requirements.map((requirement) => [
      requirement.requirementId,
      new Set(
        (requirement.candidateFactIds || partition.factIds).filter((factId) =>
          partitionFactIds.has(factId)
        )
      ),
    ])
  );
  return response.map((item) => {
    const allowed = allowedByRequirement.get(item.requirementId);
    if (
      Object.keys(item).sort().join(",") !== "candidateFactIds,requirementId" ||
      !Array.isArray(item.candidateFactIds) ||
      new Set(item.candidateFactIds).size !== item.candidateFactIds.length ||
      item.candidateFactIds.some((factId) => !allowed.has(factId))
    )
      throw new Error(
        `LF_A_DRIVEN_B_CORPUS_LOCATOR_RESPONSE_ITEM_INVALID:${item?.requirementId || "-"}`
      );
    return {
      requirementId: item.requirementId,
      candidateFactIds: [...new Set(item.candidateFactIds)],
    };
  });
}

async function verifyModel({ baseUrl, model, modelContext }) {
  const response = await fetch(
    `${baseUrl.replace(/\/v1\/?$/u, "")}/api/v0/models`,
    { signal: AbortSignal.timeout(15_000) }
  );
  if (!response.ok)
    throw new Error(
      `LF_A_DRIVEN_B_CORPUS_LOCATOR_MODEL_LIST_FAILED:${response.status}`
    );
  const body = await response.json();
  const loaded = body?.data?.find(
    ({ id, type, state }) =>
      id === model && type === "llm" && state === "loaded"
  );
  if (!loaded || Number(loaded.loaded_context_length) !== Number(modelContext))
    throw new Error(
      `LF_A_DRIVEN_B_CORPUS_LOCATOR_MODEL_NOT_EXACTLY_LOADED:${model}:${modelContext}`
    );
  return {
    id: loaded.id,
    state: loaded.state,
    loadedContextLength: Number(loaded.loaded_context_length),
  };
}

async function locatePartition({
  args,
  plan,
  partition,
  client,
  recoverModelAfterAbort,
}) {
  const attempts = [];
  for (let attempt = 1; attempt <= args.maximumAttempts; attempt += 1) {
    const repair = attempts.length
      ? 'Die vorige Antwort war nicht vertragsgültig. Wiederhole exakt alle r in der vorgegebenen Reihenfolge als [{"r":1,"c":[...]}], verwende ausschließlich vorgelegte lokale c und bewerte jede Anforderung unabhängig.'
      : null;
    const messages = prompt(plan, partition, repair);
    const started = performance.now();
    let rawResponse = "";
    try {
      const completion = await requestCompletionWithTimeout({
        client,
        payload: {
          model: args.model,
          messages,
          temperature: 0,
          max_tokens: 6_000,
        },
        requestTimeoutMs: args.requestTimeoutMs,
        abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
        recoverModelAfterAbort,
      });
      rawResponse = completion.choices?.[0]?.message?.content || "";
      const parsed = parseJsonArray(rawResponse);
      const responses = validateLocatorAliasResponse(
        parsed.responses,
        plan,
        partition
      );
      attempts.push({
        attempt,
        status: "PASS",
        durationMs: Math.round(performance.now() - started),
        rawResponse,
        rawResponseSha256: sha256(rawResponse),
        syntaxRepair: parsed.syntaxRepair,
        usage: completion.usage || null,
      });
      return { responses, attempts };
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
  const error = new Error(
    `LF_A_DRIVEN_B_CORPUS_LOCATOR_ATTEMPTS_EXHAUSTED:${partition.partitionId}`
  );
  error.attempts = attempts;
  throw error;
}

function replayPlan(plan, factIndex, results) {
  const parentFactIdByCandidateId = new Map(
    plan.partitions.flatMap(({ candidates }) =>
      candidates.map(({ factId, parentFactId }) => [
        factId,
        parentFactId || factId,
      ])
    )
  );
  const selectedByRequirement = new Map(
    plan.requirements.map(({ requirementId }) => [requirementId, new Set()])
  );
  for (const result of results)
    for (const response of result.responses)
      for (const factId of response.candidateFactIds) {
        const parentFactId = parentFactIdByCandidateId.get(factId);
        if (!parentFactId)
          throw new Error(
            `LF_A_DRIVEN_B_CORPUS_LOCATOR_REPLAY_CANDIDATE_UNKNOWN:${factId}`
          );
        selectedByRequirement.get(response.requirementId).add(parentFactId);
      }
  const rows = plan.requirements.map(({ requirementId }) => ({
    requirementId,
    candidateFactIds: [...selectedByRequirement.get(requirementId)].sort(),
  }));
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_FAST_FALLBACK_PLAN_CONTRACT_ID,
    factIndexSha256: factIndex.indexSha256,
    rows,
    summary: {
      selectedFactReviews: rows.reduce(
        (sum, row) => sum + row.candidateFactIds.length,
        0
      ),
      reviewBatches: plan.partitions.length,
      customerNotFoundEligible: false,
    },
  };
  return {
    ...payload,
    planSha256: sha256(stableStringify(payload)),
  };
}

function reusablePartitionResult({ seedOutput, plan, partition }) {
  if (!seedOutput) return null;
  const resultPath = path.join(
    seedOutput,
    `partition-${String(partition.partitionIndex).padStart(3, "0")}.private.json`
  );
  if (!fs.existsSync(resultPath)) return null;
  const result = readJson(resultPath, "LF_B_CORPUS_LOCATOR_SEED_PARTITION");
  if (
    result.contractId !== RUN_CONTRACT_ID ||
    result.planSha256 !== plan.planSha256 ||
    result.partitionId !== partition.partitionId ||
    !Array.isArray(result.attempts) ||
    !result.attempts.some(({ status }) => status === "PASS")
  )
    throw new Error(
      `LF_A_DRIVEN_B_CORPUS_LOCATOR_SEED_INVALID:${partition.partitionId}`
    );
  return {
    ...result,
    responses: validateLocatorResponse(result.responses, plan, partition),
    reusedFrom: resultPath,
  };
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  if (fs.existsSync(args.output))
    throw new Error("LF_A_DRIVEN_B_CORPUS_LOCATOR_OUTPUT_EXISTS");
  const artifact = (relative, code) =>
    readJson(path.join(args.runRoot, relative), code);
  const completeCorpus = artifact(
    "a-driven-v2/b-complete/complete-b-corpus.private.json",
    "LF_B_CORPUS_LOCATOR_COMPLETE_CORPUS"
  );
  const decisionPlan = artifact(
    "a-driven-v2/b-requirement-decisions/decision-plan.private.json",
    "LF_B_CORPUS_LOCATOR_DECISION_PLAN"
  );
  const preliminaryDecisions = artifact(
    "a-driven-v2/b-requirement-decisions/requirement-decisions.private.json",
    "LF_B_CORPUS_LOCATOR_PRELIMINARY_DECISIONS"
  );
  const rescuePlan = artifact(
    "a-driven-v2/b-rescue/decision-plan.private.json",
    "LF_B_CORPUS_LOCATOR_RESCUE_PLAN"
  );
  const rescueDecisions = artifact(
    "a-driven-v2/b-rescue/decisions/requirement-decisions.private.json",
    "LF_B_CORPUS_LOCATOR_RESCUE_DECISIONS"
  );
  const factIndex = buildADrivenBFactIndex({ completeCorpus });
  let candidateFactIdsByRequirement = null;
  let candidateCorpus = factIndex.facts;
  let candidateUnitType = "PARENT_FACT";
  if (args.queryExpansionArtifact) {
    const expansionArtifact = readJson(
      args.queryExpansionArtifact,
      "LF_B_CORPUS_LOCATOR_QUERY_EXPANSIONS"
    );
    const fallbackRequirementIds = preliminaryDecisions.results
      .filter(({ customerStatus }) => customerStatus === "FALLBACK_REQUIRED")
      .map(({ requirementId }) => requirementId);
    if (
      !Array.isArray(expansionArtifact.expansions) ||
      JSON.stringify(
        expansionArtifact.expansions.map(({ requirementId }) => requirementId)
      ) !== JSON.stringify(fallbackRequirementIds)
    )
      throw new Error("LF_A_DRIVEN_B_CORPUS_LOCATOR_QUERY_EXPANSIONS_INVALID");
    const queryExpansionsByRequirement = Object.fromEntries(
      expansionArtifact.expansions.map(({ requirementId, searchPhrases }) => [
        requirementId,
        searchPhrases,
      ])
    );
    const routePlan = buildADrivenFastFallbackPlan({
      decisionPlan,
      preliminaryDecisions,
      completeCorpus,
      factIndex,
      lexicalTopKPerDocument: args.routeLexicalTopK,
      maximumBatchCharacters: 100_000,
      retrievalScope: "GLOBAL",
      neighborRadius: args.routeNeighborRadius,
      neighborAnchorLimit: args.routeNeighborAnchorLimit,
      queryExpansionsByRequirement,
      retrievalUnitStrategy: args.routeRetrievalUnitStrategy,
      retrievalWindowMaximumTokens: args.routeWindowMaximumTokens,
      retrievalWindowOverlapTokens: args.routeWindowOverlapTokens,
    });
    candidateFactIdsByRequirement = Object.fromEntries(
      routePlan.rows.map((row) => [
        row.requirementId,
        args.routeRetrievalUnitStrategy === "SOURCE_WINDOWS"
          ? row.candidateRetrievalUnitIds
          : row.candidateFactIds,
      ])
    );
    if (args.routeRetrievalUnitStrategy === "SOURCE_WINDOWS") {
      candidateCorpus = buildADrivenBRetrievalWindows(factIndex.facts, {
        maximumTokens: args.routeWindowMaximumTokens,
        overlapTokens: args.routeWindowOverlapTokens,
      }).map((window) => ({ ...window, factId: window.windowId }));
      candidateUnitType = "SOURCE_WINDOW";
    }
  }
  const plan = buildPlan({
    decisionPlan,
    preliminaryDecisions,
    factIndex,
    candidateCorpus,
    candidateUnitType,
    maximumPartitionCharacters: args.maximumPartitionCharacters,
    partitionMode: args.partitionMode,
    candidateFactIdsByRequirement,
  });
  fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
  writePrivateJson(path.join(args.output, "locator-plan.private.json"), plan);
  if (args.maximumNewPartitions === 0) {
    console.log(
      `[lf-b-corpus-locator-shadow] PLAN: ${plan.summary.requirements} Anforderungen, ${plan.summary.routedFacts}/${plan.summary.sourceCandidates} geroutete ${plan.candidateUnitType}, ${plan.summary.partitions} Modellrequests; NICHT GEFUNDEN gesperrt`
    );
    return;
  }
  if (!args.lmStudioSdk || !args.qwenModelKey)
    throw new Error("LF_A_DRIVEN_B_CORPUS_LOCATOR_MODEL_ARGUMENTS_MISSING");
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
    const reusable = reusablePartitionResult({
      seedOutput: args.seedOutput,
      plan,
      partition,
    });
    if (reusable) {
      writePrivateJson(
        path.join(
          args.output,
          `partition-${String(partition.partitionIndex).padStart(3, "0")}.private.json`
        ),
        reusable
      );
      results.push(reusable);
      console.log(
        `[lf-b-corpus-locator-shadow] Partition ${partition.partitionIndex + 1}/${plan.partitions.length}: PASS (wiederverwendet)`
      );
      continue;
    }
    if (
      args.maximumNewPartitions !== null &&
      newPartitions >= args.maximumNewPartitions
    )
      break;
    let result;
    try {
      result = await locatePartition({
        args,
        plan,
        partition,
        client,
        recoverModelAfterAbort,
      });
    } catch (error) {
      writePrivateJson(
        path.join(
          args.output,
          `partition-${String(partition.partitionIndex).padStart(3, "0")}-failed.private.json`
        ),
        {
          schemaVersion: 1,
          contractId: RUN_CONTRACT_ID,
          planSha256: plan.planSha256,
          partitionId: partition.partitionId,
          attempts: error.attempts || [],
          errorMessage: error.message,
        }
      );
      throw error;
    }
    const artifactResult = {
      schemaVersion: 1,
      contractId: RUN_CONTRACT_ID,
      planSha256: plan.planSha256,
      partitionId: partition.partitionId,
      responses: result.responses,
      attempts: result.attempts,
    };
    writePrivateJson(
      path.join(
        args.output,
        `partition-${String(partition.partitionIndex).padStart(3, "0")}.private.json`
      ),
      artifactResult
    );
    results.push(artifactResult);
    newPartitions += 1;
    console.log(
      `[lf-b-corpus-locator-shadow] Partition ${partition.partitionIndex + 1}/${plan.partitions.length}: PASS`
    );
  }
  if (results.length !== plan.partitions.length) {
    console.log(
      `[lf-b-corpus-locator-shadow] KONTROLLIERTER STOP: ${results.length}/${plan.partitions.length} Partitionen`
    );
    return;
  }
  const locatorFastPlan = replayPlan(plan, factIndex, results);
  const replay = buildADrivenTerminalEvidenceReplay({
    fastPlan: locatorFastPlan,
    factIndex,
    rescuePlan,
    rescueDecisions,
  });
  const summary = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    planSha256: plan.planSha256,
    model: loadedModel,
    startedAt,
    completedAt: new Date().toISOString(),
    wallDurationMs: Math.round(performance.now() - started),
    modelRequests: newPartitions,
    reusedPartitions: results.length - newPartitions,
    modelAttempts: results.reduce(
      (sum, result) => sum + (result.reusedFrom ? 0 : result.attempts.length),
      0
    ),
    ...replay.summary,
    acceptanceReady: false,
    proofLimit:
      "Vollkorpus-Locator-Shadow gegen bekannte Rescue-Fakten. Kandidatennominierung ist kein semantisches Urteil und kein Abwesenheitsnachweis.",
  };
  writePrivateJson(
    path.join(args.output, "locator-fast-plan.private.json"),
    locatorFastPlan
  );
  writePrivateJson(path.join(args.output, "replay.private.json"), replay);
  writePrivateJson(path.join(args.output, "summary.private.json"), summary);
  console.log(
    `[lf-b-corpus-locator-shadow] ${summary.recoveredTerminalEvidenceFacts}/${summary.expectedTerminalEvidenceFacts} finale Rescue-Evidenzfakten; ${summary.shadowFactReviews} nominierte Paare; ${summary.modelRequests} Requests; ${summary.wallDurationMs} ms; NICHT GEFUNDEN gesperrt`
  );
}

if (require.main === module)
  run().catch((error) => fail(error.stack || error.message));

module.exports = {
  buildPlan,
  compactRequirement,
  partitionFacts,
  partitionFactsByDocument,
  prompt,
  locatorPromptView,
  replayPlan,
  requirementsForPartition,
  reusablePartitionResult,
  validateLocatorAliasResponse,
  validateLocatorResponse,
};
