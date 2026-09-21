#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const {
  A_DRIVEN_FAST_FALLBACK_PLAN_CONTRACT_ID,
  buildADrivenBFactIndex,
  buildADrivenBRetrievalWindows,
  buildADrivenFastFallbackPlan,
  buildADrivenFastFallbackReplay,
} = require("../../utils/policyAnalysis/aDrivenBFactIndex");
const {
  createEmbeddingClient,
  embedBatches,
  normalizeEmbeddingInput,
  verifyHybridShadowRuntimeArtifacts,
  verifyLoadedEmbeddingModel,
} = require("../../utils/policyAnalysis/hybridShadowEmbeddingClient");
const {
  loadHybridShadowContract,
} = require("../../utils/policyAnalysis/hybridShadowSearch");
const {
  cosineSimilarity,
} = require("../../utils/policyAnalysis/hybridCandidateFallback");
const {
  readJson,
  writePrivateJson,
} = require("./buildADrivenBFastPathShadow.cjs");

const CONTRACT_ID = "LF_A_DRIVEN_B_SOURCE_WINDOW_EMBEDDING_SHADOW_V1";

function fail(message) {
  console.error(`[lf-b-source-window-embedding] ${message}`);
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
    "contractFile",
    "queryExpansionFile",
    "maximumTokens",
    "overlapTokens",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of ["runRoot", "output", "contractFile"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const maximumTokens = Number(values.maximumTokens || 32);
  const overlapTokens = Number(values.overlapTokens || 8);
  if (
    !Number.isInteger(maximumTokens) ||
    maximumTokens < 8 ||
    !Number.isInteger(overlapTokens) ||
    overlapTokens < 0 ||
    overlapTokens >= maximumTokens
  )
    fail("Fensterparameter sind ungültig");
  return {
    runRoot: path.resolve(values.runRoot),
    output: path.resolve(values.output),
    contractFile: path.resolve(values.contractFile),
    queryExpansionFile: values.queryExpansionFile
      ? path.resolve(values.queryExpansionFile)
      : null,
    maximumTokens,
    overlapTokens,
  };
}

function artifact(runRoot, relative, code) {
  return readJson(path.join(runRoot, relative), code);
}

function queryExpansions(file) {
  if (!file) return {};
  const artifact = readJson(file, "LF_B_WINDOW_EMBEDDING_QUERY_EXPANSIONS");
  if (!Array.isArray(artifact.expansions))
    throw new Error("LF_B_WINDOW_EMBEDDING_QUERY_EXPANSIONS_INVALID");
  return Object.fromEntries(
    artifact.expansions.map(({ requirementId, searchPhrases }) => [
      requirementId,
      searchPhrases,
    ])
  );
}

function rankEmbeddedWindows({ windows, windowVectors, queryVector, topK }) {
  if (
    windows.length !== windowVectors.length ||
    !Array.isArray(queryVector) ||
    !Number.isInteger(topK) ||
    topK < 1
  )
    throw new Error("LF_B_WINDOW_EMBEDDING_RANK_INPUT_INVALID");
  return windows
    .map((window, index) => ({
      windowId: window.windowId,
      parentFactId: window.parentFactId,
      documentStart: window.documentStart,
      score: cosineSimilarity(queryVector, windowVectors[index]),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.documentStart - right.documentStart ||
        left.windowId.localeCompare(right.windowId)
    )
    .slice(0, topK);
}

function candidateProfile({
  profileId,
  queryRows,
  semanticParentsByRequirement,
  lexicalParentsByRequirement = null,
  factIndex,
  absencePlan,
  absenceDecisions,
}) {
  const rows = queryRows.map(({ requirementId }) => {
    const ids = new Set(lexicalParentsByRequirement?.get(requirementId) || []);
    for (const factId of semanticParentsByRequirement.get(requirementId) || [])
      ids.add(factId);
    return {
      requirementId,
      candidateFactIds: [...ids].sort(),
    };
  });
  const selectedFactReviews = rows.reduce(
    (sum, row) => sum + row.candidateFactIds.length,
    0
  );
  const replay = buildADrivenFastFallbackReplay({
    fastPlan: {
      contractId: A_DRIVEN_FAST_FALLBACK_PLAN_CONTRACT_ID,
      rows,
      summary: { selectedFactReviews, reviewBatches: 0 },
    },
    factIndex,
    absencePlan,
    absenceDecisions,
  });
  return {
    profileId,
    selectedParentFactReviews: selectedFactReviews,
    knownPositiveRequirements: replay.summary.knownPositiveRequirements,
    recoveredAnyPositiveRequirements:
      replay.summary.recoveredAnyPositiveRequirements,
    knownPositiveFacts: replay.summary.knownPositiveFacts,
    recoveredPositiveFacts: replay.summary.recoveredPositiveFacts,
    positiveFactRecall: replay.summary.positiveFactRecall,
    missedPositiveFactIds: replay.cases.flatMap(
      ({ expectedPositiveFactIds, recoveredPositiveFactIds }) => {
        const recovered = new Set(recoveredPositiveFactIds);
        return expectedPositiveFactIds.filter(
          (factId) => !recovered.has(factId)
        );
      }
    ),
    customerNotFoundEligible: false,
  };
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  if (fs.existsSync(args.output))
    throw new Error("LF_B_WINDOW_EMBEDDING_OUTPUT_EXISTS");
  const completeCorpus = artifact(
    args.runRoot,
    "a-driven-v2/b-complete/complete-b-corpus.private.json",
    "LF_B_WINDOW_EMBEDDING_COMPLETE_CORPUS"
  );
  const decisionPlan = artifact(
    args.runRoot,
    "a-driven-v2/b-requirement-decisions/decision-plan.private.json",
    "LF_B_WINDOW_EMBEDDING_DECISION_PLAN"
  );
  const preliminaryDecisions = artifact(
    args.runRoot,
    "a-driven-v2/b-requirement-decisions/requirement-decisions.private.json",
    "LF_B_WINDOW_EMBEDDING_PRELIMINARY_DECISIONS"
  );
  const absencePlan = artifact(
    args.runRoot,
    "a-driven-v2/b-absence/absence-plan.private.json",
    "LF_B_WINDOW_EMBEDDING_ABSENCE_PLAN"
  );
  const absenceDecisions = artifact(
    args.runRoot,
    "a-driven-v2/b-absence/absence-decisions.private.json",
    "LF_B_WINDOW_EMBEDDING_ABSENCE_DECISIONS"
  );
  const expansions = queryExpansions(args.queryExpansionFile);
  const factIndex = buildADrivenBFactIndex({ completeCorpus });
  const windows = buildADrivenBRetrievalWindows(factIndex.facts, {
    maximumTokens: args.maximumTokens,
    overlapTokens: args.overlapTokens,
  });
  const queryPlan = buildADrivenFastFallbackPlan({
    decisionPlan,
    preliminaryDecisions,
    completeCorpus,
    factIndex,
    lexicalTopKPerDocument: 1,
    retrievalScope: "GLOBAL",
    queryExpansionsByRequirement: expansions,
  });
  const lexicalPlan = buildADrivenFastFallbackPlan({
    decisionPlan,
    preliminaryDecisions,
    completeCorpus,
    factIndex,
    lexicalTopKPerDocument: 20,
    retrievalScope: "GLOBAL",
    neighborRadius: 4,
    neighborAnchorLimit: 1,
    queryExpansionsByRequirement: expansions,
    retrievalUnitStrategy: "SOURCE_WINDOWS",
    retrievalWindowMaximumTokens: args.maximumTokens,
    retrievalWindowOverlapTokens: args.overlapTokens,
  });
  const queryRows = queryPlan.rows.map((row) => ({
    requirementId: row.requirementId,
    text: [row.query.text, ...row.query.expansionPhrases].join("\n"),
  }));
  const { contract, identity } = loadHybridShadowContract(args.contractFile);
  if (!contract?.enabled || !identity?.contractSha256)
    throw new Error("LF_B_WINDOW_EMBEDDING_CONTRACT_NOT_ENABLED");
  await verifyHybridShadowRuntimeArtifacts(contract);
  const loadedModel = await verifyLoadedEmbeddingModel(contract);
  const client = createEmbeddingClient(contract);
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const queryEmbedding = await embedBatches({
    client,
    contract,
    inputs: queryRows.map(({ text }) =>
      normalizeEmbeddingInput(text, contract.provider.inputNormalization)
    ),
    label: "FALLBACK_REQUIREMENT_QUERIES",
  });
  const windowEmbedding = await embedBatches({
    client,
    contract,
    inputs: windows.map(({ exactText }) =>
      normalizeEmbeddingInput(exactText, contract.provider.inputNormalization)
    ),
    label: "B_SOURCE_WINDOWS",
  });
  const lexicalParentsByRequirement = new Map(
    lexicalPlan.rows.map(({ requirementId, candidateFactIds }) => [
      requirementId,
      candidateFactIds,
    ])
  );
  const results = [];
  for (const topK of [1, 2, 4, 8, 12, 16, 20, 32, 48, 64, 96, 128]) {
    const semanticParentsByRequirement = new Map(
      queryRows.map((row, queryIndex) => [
        row.requirementId,
        [
          ...new Set(
            rankEmbeddedWindows({
              windows,
              windowVectors: windowEmbedding.vectors,
              queryVector: queryEmbedding.vectors[queryIndex],
              topK,
            }).map(({ parentFactId }) => parentFactId)
          ),
        ],
      ])
    );
    results.push(
      candidateProfile({
        profileId: `embedding-only-k${topK}`,
        queryRows,
        semanticParentsByRequirement,
        factIndex,
        absencePlan,
        absenceDecisions,
      })
    );
    results.push(
      candidateProfile({
        profileId: `lexical-window-plus-embedding-k${topK}`,
        queryRows,
        semanticParentsByRequirement,
        lexicalParentsByRequirement,
        factIndex,
        absencePlan,
        absenceDecisions,
      })
    );
  }
  const passing = results
    .filter(
      ({ recoveredPositiveFacts, knownPositiveFacts }) =>
        knownPositiveFacts > 0 && recoveredPositiveFacts === knownPositiveFacts
    )
    .sort(
      (left, right) =>
        left.selectedParentFactReviews - right.selectedParentFactReviews
    );
  const completedAt = new Date().toISOString();
  const output = {
    schemaVersion: 1,
    contractId: CONTRACT_ID,
    factIndexSha256: factIndex.indexSha256,
    embeddingContractSha256: identity.contractSha256,
    embeddingModel: loadedModel,
    startedAt,
    completedAt,
    wallDurationMs: Math.round(performance.now() - started),
    requirements: queryRows.length,
    sourceFacts: factIndex.facts.length,
    sourceWindows: windows.length,
    maximumTokens: args.maximumTokens,
    overlapTokens: args.overlapTokens,
    queryEmbedding: {
      requestCount: queryEmbedding.requestCount,
      durationMs: queryEmbedding.durationMs,
    },
    windowEmbedding: {
      requestCount: windowEmbedding.requestCount,
      durationMs: windowEmbedding.durationMs,
    },
    lexicalWindowBaselineParentFactReviews:
      lexicalPlan.summary.selectedFactReviews,
    results,
    bestKnownPositiveRecallProfile: passing[0] || null,
    acceptanceReady: false,
    customerNotFoundEligible: false,
    proofLimit:
      "Dinghy-Shadow-Replay gegen elf bekannte V3.9.15-Rescue-Fakten. Embeddingrankings sind nur Navigation. Sie entscheiden keine semantische Gleichheit und zertifizieren keinen Nullfund; Gold, echte Negative und Holdout bleiben offen.",
  };
  fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
  writePrivateJson(
    path.join(args.output, "source-window-embedding.private.json"),
    output
  );
  const best = output.bestKnownPositiveRecallProfile;
  console.log(
    best
      ? `[lf-b-source-window-embedding] PASS ${best.profileId}: ${best.recoveredPositiveFacts}/${best.knownPositiveFacts} bekannte Fakten, ${best.selectedParentFactReviews}/${absencePlan.summary.plannedClauseReviews} Elternprüfungen, ${output.wallDurationMs} ms; NICHT GEFUNDEN gesperrt`
      : `[lf-b-source-window-embedding] FAIL: kein Profil erreicht 11/11; ${output.wallDurationMs} ms; NICHT GEFUNDEN gesperrt`
  );
}

if (require.main === module)
  run().catch((error) => fail(error.stack || error.message));

module.exports = { argumentsFrom, candidateProfile, rankEmbeddedWindows };
