#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  buildLfKnownFixtureGold283V2,
  sha256,
} = require("../../utils/policyAnalysis/lfKnownFixtureGold283Correction");

function fail(message) {
  console.error(`[lf-gold-283-v2] ${message}`);
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
    "baseGold",
    "gold30",
    "completeBCorpus",
    "finalDecisions",
    "baseRegression",
    "correctionDecisions",
    "outputDir",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, path.resolve(value)])
  );
}

function readJson(file, code) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(code);
  const bytes = fs.readFileSync(file);
  return {
    value: JSON.parse(bytes.toString("utf8")),
    fileSha256: sha256(bytes),
  };
}

function writePrivateFile(directory, name, value) {
  const file = path.join(directory, name);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(file, 0o600);
  return file;
}

function publishImmutableDirectory(outputDir, values) {
  if (!path.isAbsolute(outputDir))
    throw new Error("LF_GOLD_283_V2_OUTPUT_MUST_BE_ABSOLUTE");
  if (fs.existsSync(outputDir))
    throw new Error(`LF_GOLD_283_V2_OUTPUT_EXISTS:${outputDir}`);
  fs.mkdirSync(path.dirname(outputDir), { recursive: true, mode: 0o700 });
  const temporary = `${outputDir}.tmp-${process.pid}`;
  if (fs.existsSync(temporary))
    throw new Error(`LF_GOLD_283_V2_TEMPORARY_EXISTS:${temporary}`);
  fs.mkdirSync(temporary, { mode: 0o700 });
  try {
    const correctionSet = writePrivateFile(
      temporary,
      "gold-283-correction-set-v1.private.json",
      values.correctionSet
    );
    const gold = writePrivateFile(
      temporary,
      "gold-283-v2.private.json",
      values.gold
    );
    fs.renameSync(temporary, outputDir);
    return {
      correctionSet: path.join(outputDir, path.basename(correctionSet)),
      gold: path.join(outputDir, path.basename(gold)),
    };
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

function run() {
  const args = argumentsFrom(process.argv.slice(2));
  const inputs = Object.fromEntries(
    [
      ["baseGold", "LF_GOLD_283_V2_BASE_GOLD_INVALID"],
      ["gold30", "LF_GOLD_283_V2_GOLD30_INVALID"],
      ["completeBCorpus", "LF_GOLD_283_V2_COMPLETE_CORPUS_INVALID"],
      ["finalDecisions", "LF_GOLD_283_V2_FINAL_DECISIONS_INVALID"],
      ["baseRegression", "LF_GOLD_283_V2_BASE_REGRESSION_INVALID"],
      ["correctionDecisions", "LF_GOLD_283_V2_CORRECTIONS_INVALID"],
    ].map(([name, code]) => [name, readJson(args[name], code)])
  );
  const values = buildLfKnownFixtureGold283V2({
    baseGold: inputs.baseGold.value,
    baseGoldFileSha256: inputs.baseGold.fileSha256,
    gold30: inputs.gold30.value,
    gold30FileSha256: inputs.gold30.fileSha256,
    completeBCorpus: inputs.completeBCorpus.value,
    completeBCorpusFileSha256: inputs.completeBCorpus.fileSha256,
    finalDecisions: inputs.finalDecisions.value,
    finalDecisionsFileSha256: inputs.finalDecisions.fileSha256,
    baseRegression: inputs.baseRegression.value,
    baseRegressionFileSha256: inputs.baseRegression.fileSha256,
    correctionDecisions: inputs.correctionDecisions.value,
    correctionDecisionsFileSha256:
      inputs.correctionDecisions.fileSha256,
  });
  const published = publishImmutableDirectory(args.outputDir, values);
  console.log(
    JSON.stringify({
      outputDir: args.outputDir,
      correctionSet: {
        path: published.correctionSet,
        fileSha256: sha256(fs.readFileSync(published.correctionSet)),
        correctionSetSha256: values.correctionSet.correctionSetSha256,
      },
      gold: {
        path: published.gold,
        fileSha256: sha256(fs.readFileSync(published.gold)),
        goldSha256: values.gold.goldSha256,
        summary: values.gold.summary,
      },
    })
  );
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    fail(error.stack || error.message);
  }
}

module.exports = {
  argumentsFrom,
  publishImmutableDirectory,
  readJson,
  run,
};
