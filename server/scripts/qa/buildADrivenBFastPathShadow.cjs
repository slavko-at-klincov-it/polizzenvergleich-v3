#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  buildADrivenBFactIndex,
  buildADrivenFastFallbackPlan,
  buildADrivenFastFallbackReplay,
} = require("../../utils/policyAnalysis/aDrivenBFactIndex");

function fail(message) {
  console.error(`[lf-b-fast-path-shadow] ${message}`);
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
    "lexicalTopKPerDocument",
    "maximumBatchCharacters",
    "retrievalScope",
    "neighborRadius",
    "neighborAnchorLimit",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of ["runRoot", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const lexicalTopKPerDocument = Number(
    values.lexicalTopKPerDocument || 12
  );
  const maximumBatchCharacters = Number(values.maximumBatchCharacters || 70_000);
  const retrievalScope = values.retrievalScope || "PER_DOCUMENT";
  const neighborRadius = Number(values.neighborRadius || 0);
  const neighborAnchorLimit = Number(values.neighborAnchorLimit || 0);
  if (
    !Number.isInteger(lexicalTopKPerDocument) ||
    lexicalTopKPerDocument < 1 ||
    !Number.isInteger(maximumBatchCharacters) ||
    maximumBatchCharacters < 10_000 ||
    !["PER_DOCUMENT", "GLOBAL"].includes(retrievalScope) ||
    !Number.isInteger(neighborRadius) ||
    neighborRadius < 0 ||
    neighborRadius > 10 ||
    !Number.isInteger(neighborAnchorLimit) ||
    neighborAnchorLimit < 0 ||
    neighborAnchorLimit > lexicalTopKPerDocument
  )
    fail("Numerische Laufparameter sind ungültig");
  return {
    runRoot: path.resolve(values.runRoot),
    output: path.resolve(values.output),
    lexicalTopKPerDocument,
    maximumBatchCharacters,
    retrievalScope,
    neighborRadius,
    neighborAnchorLimit,
  };
}

function readJson(file, code) {
  if (!fs.existsSync(file)) throw new Error(`${code}_MISSING`);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`${code}_INVALID`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error(`${code}_INVALID`);
  }
}

function writePrivateJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  if (fs.existsSync(file))
    throw new Error(`LF_B_FAST_PATH_SHADOW_OUTPUT_EXISTS:${file}`);
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function artifact(runRoot, relative, code) {
  return readJson(path.join(runRoot, relative), code);
}

function run() {
  const args = argumentsFrom(process.argv.slice(2));
  if (fs.existsSync(args.output)) {
    const stat = fs.lstatSync(args.output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("LF_B_FAST_PATH_SHADOW_OUTPUT_INVALID");
    if (fs.readdirSync(args.output).length)
      throw new Error("LF_B_FAST_PATH_SHADOW_OUTPUT_NOT_EMPTY");
  }
  const completeCorpus = artifact(
    args.runRoot,
    "a-driven-v2/b-complete/complete-b-corpus.private.json",
    "LF_B_FAST_PATH_COMPLETE_CORPUS"
  );
  const decisionPlan = artifact(
    args.runRoot,
    "a-driven-v2/b-requirement-decisions/decision-plan.private.json",
    "LF_B_FAST_PATH_DECISION_PLAN"
  );
  const preliminaryDecisions = artifact(
    args.runRoot,
    "a-driven-v2/b-requirement-decisions/requirement-decisions.private.json",
    "LF_B_FAST_PATH_PRELIMINARY_DECISIONS"
  );
  const absencePlan = artifact(
    args.runRoot,
    "a-driven-v2/b-absence/absence-plan.private.json",
    "LF_B_FAST_PATH_ABSENCE_PLAN"
  );
  const absenceDecisions = artifact(
    args.runRoot,
    "a-driven-v2/b-absence/absence-decisions.private.json",
    "LF_B_FAST_PATH_ABSENCE_DECISIONS"
  );
  const factIndex = buildADrivenBFactIndex({ completeCorpus });
  const fastPlan = buildADrivenFastFallbackPlan({
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
  const replay = buildADrivenFastFallbackReplay({
    fastPlan,
    factIndex,
    absencePlan,
    absenceDecisions,
  });
  fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
  writePrivateJson(path.join(args.output, "b-fact-index.private.json"), factIndex);
  writePrivateJson(
    path.join(args.output, "fast-fallback-plan.private.json"),
    fastPlan
  );
  writePrivateJson(path.join(args.output, "replay.private.json"), replay);
  const summary = {
    contractId: "LF_A_DRIVEN_B_FAST_PATH_SHADOW_V1",
    factIndexSha256: factIndex.indexSha256,
    fastPlanSha256: fastPlan.planSha256,
    replaySha256: replay.replaySha256,
    ...replay.summary,
    unassessedFactPairs: fastPlan.summary.unassessedFactPairs,
    lexicalTopKPerDocument: fastPlan.lexicalTopKPerDocument,
    retrievalScope: fastPlan.retrievalScope,
    neighborRadius: fastPlan.neighborRadius,
    neighborAnchorLimit: fastPlan.neighborAnchorLimit,
    acceptanceReady: false,
    proofLimit: replay.proofLimit,
  };
  writePrivateJson(path.join(args.output, "summary.private.json"), summary);
  console.log(
    `[lf-b-fast-path-shadow] ${summary.recoveredPositiveFacts}/${summary.knownPositiveFacts} bekannte Rescue-Fakten; ${summary.shadowFactReviews}/${summary.baselineClauseReviews} Paarprüfungen; ${summary.shadowReviewBatches}/${summary.baselineRequests} Review-Batches; NICHT GEFUNDEN gesperrt`
  );
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    fail(error.stack || error.message);
  }
}

module.exports = { argumentsFrom, readJson, writePrivateJson };
