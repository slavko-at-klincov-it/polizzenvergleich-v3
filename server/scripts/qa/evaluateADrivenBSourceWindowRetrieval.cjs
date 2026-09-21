#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  buildADrivenBFactIndex,
  buildADrivenFastFallbackPlan,
  buildADrivenFastFallbackReplay,
} = require("../../utils/policyAnalysis/aDrivenBFactIndex");
const {
  readJson,
  writePrivateJson,
} = require("./buildADrivenBFastPathShadow.cjs");

const CONTRACT_ID = "LF_A_DRIVEN_B_SOURCE_WINDOW_RETRIEVAL_EVALUATION_V1";

function fail(message) {
  console.error(`[lf-b-source-window-evaluation] ${message}`);
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
  const allowed = new Set(["runRoot", "output", "queryExpansionFile"]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of ["runRoot", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return {
    runRoot: path.resolve(values.runRoot),
    output: path.resolve(values.output),
    queryExpansionFile: values.queryExpansionFile
      ? path.resolve(values.queryExpansionFile)
      : null,
  };
}

function artifact(runRoot, relative, code) {
  return readJson(path.join(runRoot, relative), code);
}

function queryExpansions(file) {
  if (!file) return {};
  const artifact = readJson(file, "LF_B_SOURCE_WINDOW_QUERY_EXPANSIONS");
  if (!Array.isArray(artifact.expansions))
    throw new Error("LF_B_SOURCE_WINDOW_QUERY_EXPANSIONS_INVALID");
  return Object.fromEntries(
    artifact.expansions.map(({ requirementId, searchPhrases }) => [
      requirementId,
      searchPhrases,
    ])
  );
}

function evaluateProfile({
  profile,
  decisionPlan,
  preliminaryDecisions,
  completeCorpus,
  factIndex,
  absencePlan,
  absenceDecisions,
  queryExpansionsByRequirement,
}) {
  const fastPlan = buildADrivenFastFallbackPlan({
    decisionPlan,
    preliminaryDecisions,
    completeCorpus,
    factIndex,
    lexicalTopKPerDocument: profile.topK,
    maximumBatchCharacters: 70_000,
    retrievalScope: "GLOBAL",
    neighborRadius: profile.neighborRadius,
    neighborAnchorLimit: profile.neighborAnchorLimit,
    queryExpansionsByRequirement,
    retrievalUnitStrategy: profile.strategy,
    retrievalWindowMaximumTokens: profile.maximumTokens,
    retrievalWindowOverlapTokens: profile.overlapTokens,
  });
  const replay = buildADrivenFastFallbackReplay({
    fastPlan,
    factIndex,
    absencePlan,
    absenceDecisions,
  });
  return {
    ...profile,
    retrievalUnits: fastPlan.summary.retrievalUnits,
    selectedParentFactReviews: fastPlan.summary.selectedFactReviews,
    reviewBatches: fastPlan.summary.reviewBatches,
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
    missedRequirementIds: replay.cases
      .filter(({ recoveredAnyPositive }) => !recoveredAnyPositive)
      .map(({ requirementId }) => requirementId),
    customerNotFoundEligible: false,
  };
}

function run() {
  const args = argumentsFrom(process.argv.slice(2));
  if (fs.existsSync(args.output)) {
    const stat = fs.lstatSync(args.output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("LF_B_SOURCE_WINDOW_OUTPUT_INVALID");
    if (fs.readdirSync(args.output).length)
      throw new Error("LF_B_SOURCE_WINDOW_OUTPUT_NOT_EMPTY");
  }
  const completeCorpus = artifact(
    args.runRoot,
    "a-driven-v2/b-complete/complete-b-corpus.private.json",
    "LF_B_SOURCE_WINDOW_COMPLETE_CORPUS"
  );
  const decisionPlan = artifact(
    args.runRoot,
    "a-driven-v2/b-requirement-decisions/decision-plan.private.json",
    "LF_B_SOURCE_WINDOW_DECISION_PLAN"
  );
  const preliminaryDecisions = artifact(
    args.runRoot,
    "a-driven-v2/b-requirement-decisions/requirement-decisions.private.json",
    "LF_B_SOURCE_WINDOW_PRELIMINARY_DECISIONS"
  );
  const absencePlan = artifact(
    args.runRoot,
    "a-driven-v2/b-absence/absence-plan.private.json",
    "LF_B_SOURCE_WINDOW_ABSENCE_PLAN"
  );
  const absenceDecisions = artifact(
    args.runRoot,
    "a-driven-v2/b-absence/absence-decisions.private.json",
    "LF_B_SOURCE_WINDOW_ABSENCE_DECISIONS"
  );
  const factIndex = buildADrivenBFactIndex({ completeCorpus });
  const expansions = queryExpansions(args.queryExpansionFile);
  const topKs = [4, 8, 12, 16, 20, 24, 32, 48, 64, 96, 128];
  const windowShapes = [
    [24, 8],
    [32, 8],
    [48, 12],
    [64, 16],
  ];
  const profiles = [
    ...topKs.map((topK) => ({
      profileId: `parent-k${topK}`,
      strategy: "PARENT_FACTS",
      topK,
      maximumTokens: 48,
      overlapTokens: 12,
      neighborRadius: 0,
      neighborAnchorLimit: 0,
    })),
    ...windowShapes.flatMap(([maximumTokens, overlapTokens]) =>
      topKs.map((topK) => ({
        profileId: `window-t${maximumTokens}-o${overlapTokens}-k${topK}`,
        strategy: "SOURCE_WINDOWS",
        topK,
        maximumTokens,
        overlapTokens,
        neighborRadius: 0,
        neighborAnchorLimit: 0,
      }))
    ),
    ...windowShapes.flatMap(([maximumTokens, overlapTokens]) =>
      [8, 12, 20].flatMap((topK) =>
        [1, 2, 4, 8].flatMap((neighborRadius) =>
          [1, 2, 4].map((neighborAnchorLimit) => ({
            profileId: `window-t${maximumTokens}-o${overlapTokens}-k${topK}-r${neighborRadius}-a${neighborAnchorLimit}`,
            strategy: "SOURCE_WINDOWS",
            topK,
            maximumTokens,
            overlapTokens,
            neighborRadius,
            neighborAnchorLimit,
          }))
        )
      )
    ),
  ];
  const results = profiles.map((profile) =>
    evaluateProfile({
      profile,
      decisionPlan,
      preliminaryDecisions,
      completeCorpus,
      factIndex,
      absencePlan,
      absenceDecisions,
      queryExpansionsByRequirement: expansions,
    })
  );
  const passing = results
    .filter(
      ({ recoveredPositiveFacts, knownPositiveFacts }) =>
        knownPositiveFacts > 0 && recoveredPositiveFacts === knownPositiveFacts
    )
    .sort(
      (left, right) =>
        left.selectedParentFactReviews - right.selectedParentFactReviews ||
        left.reviewBatches - right.reviewBatches ||
        left.retrievalUnits - right.retrievalUnits
    );
  const output = {
    schemaVersion: 1,
    contractId: CONTRACT_ID,
    runRoot: args.runRoot,
    factIndexSha256: factIndex.indexSha256,
    queryExpansionFile: args.queryExpansionFile,
    queryExpansionRequirements: Object.keys(expansions).length,
    baselineClauseReviews: absencePlan.summary.plannedClauseReviews,
    baselineRequests: absencePlan.summary.partitions,
    results,
    bestKnownPositiveRecallProfile: passing[0] || null,
    acceptanceReady: false,
    proofLimit:
      "Modellfreier Replay gegen elf bekannte V3.9.15-Rescue-Fakten. Source-Windows sind nur Navigation, keine semantischen Fakten und kein Nullfundbeweis. Unbekannter Recall, echte Nullfunde, Gold und Holdout bleiben offen.",
  };
  fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
  writePrivateJson(
    path.join(args.output, "source-window-evaluation.private.json"),
    output
  );
  const best = output.bestKnownPositiveRecallProfile;
  console.log(
    best
      ? `[lf-b-source-window-evaluation] PASS ${best.profileId}: ${best.recoveredPositiveFacts}/${best.knownPositiveFacts} bekannte Fakten, ${best.selectedParentFactReviews}/${output.baselineClauseReviews} Elternprüfungen, ${best.reviewBatches}/${output.baselineRequests} Batches; NICHT GEFUNDEN gesperrt`
      : `[lf-b-source-window-evaluation] FAIL: kein Profil erreicht vollständigen bekannten Positiv-Recall; NICHT GEFUNDEN gesperrt`
  );
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    fail(error.stack || error.message);
  }
}

module.exports = { argumentsFrom, evaluateProfile, queryExpansions };
