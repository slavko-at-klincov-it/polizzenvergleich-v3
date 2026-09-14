#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  buildADrivenRequirementPlanGoldRegression,
} = require("../../utils/policyAnalysis/aDrivenRequirementPlanGoldRegression");

function fail(message) {
  console.error(`[lf-a-driven-requirement-gold-regression] ${message}`);
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
    "gold",
    "searchPlan",
    "searchExecution",
    "output",
    "expectedGoldSha256",
    "expectedGoldFileSha256",
    "maximumCandidatesPerComponent",
    "maximumRequirementsPerBatch",
    "maximumBatchCharacters",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of [
    "manifest",
    "gold",
    "searchPlan",
    "searchExecution",
    "output",
    "expectedGoldSha256",
    "expectedGoldFileSha256",
  ])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  if (
    !/^[a-f0-9]{64}$/u.test(values.expectedGoldSha256) ||
    !/^[a-f0-9]{64}$/u.test(values.expectedGoldFileSha256)
  )
    fail("Gold-Hashes sind ungültig");
  const numberArgument = (name, fallback) => {
    if (values[name] === undefined) return fallback;
    const parsed = Number(values[name]);
    if (!Number.isSafeInteger(parsed) || parsed < 1)
      fail(`--${name} ist ungültig`);
    return parsed;
  };
  return {
    ...values,
    manifest: path.resolve(values.manifest),
    gold: path.resolve(values.gold),
    searchPlan: path.resolve(values.searchPlan),
    searchExecution: path.resolve(values.searchExecution),
    output: path.resolve(values.output),
    maximumCandidatesPerComponent: numberArgument(
      "maximumCandidatesPerComponent",
      4
    ),
    maximumRequirementsPerBatch: numberArgument(
      "maximumRequirementsPerBatch",
      4
    ),
    maximumBatchCharacters: numberArgument("maximumBatchCharacters", 120_000),
  };
}

function readRegularFile(file, code) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    throw new Error(`${code}_MISSING`);
  }
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`${code}_INVALID`);
  return fs.readFileSync(file);
}

function readJson(file, code) {
  try {
    return JSON.parse(readRegularFile(file, code).toString("utf8"));
  } catch (error) {
    if (error.message.startsWith(code)) throw error;
    throw new Error(`${code}_INVALID`);
  }
}

function fileSha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function writePrivateJson(file, value) {
  if (fs.existsSync(file))
    throw new Error(
      `LF_A_DRIVEN_REQUIREMENT_GOLD_REGRESSION_OUTPUT_EXISTS:${file}`
    );
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

try {
  const args = argumentsFrom(process.argv.slice(2));
  const goldBytes = readRegularFile(args.gold, "LF_A_DRIVEN_GOLD_FILE");
  const observedGoldFileSha256 = fileSha256(goldBytes);
  if (observedGoldFileSha256 !== args.expectedGoldFileSha256)
    throw new Error("LF_A_DRIVEN_GOLD_FILE_DIGEST_MISMATCH");
  const regression = buildADrivenRequirementPlanGoldRegression({
    manifest: readJson(args.manifest, "LF_A_DRIVEN_REQUIREMENT_MANIFEST"),
    gold: JSON.parse(goldBytes.toString("utf8")),
    expectedGoldSha256: args.expectedGoldSha256,
    searchPlan: readJson(args.searchPlan, "LF_A_DRIVEN_REQUIREMENT_SEARCH_PLAN"),
    searchExecution: readJson(
      args.searchExecution,
      "LF_A_DRIVEN_REQUIREMENT_SEARCH_EXECUTION"
    ),
    maximumCandidatesPerComponent: args.maximumCandidatesPerComponent,
    maximumRequirementsPerBatch: args.maximumRequirementsPerBatch,
    maximumBatchCharacters: args.maximumBatchCharacters,
  });
  writePrivateJson(args.output, {
    ...regression,
    goldFileSha256: observedGoldFileSha256,
  });
  const summary = regression.summary;
  console.log(
    `[lf-a-driven-requirement-gold-regression] Full ${summary.fullRetrievalBoundGoldSources}/${summary.goldSources}; Auswahl ${summary.selectedBoundGoldSources}/${summary.goldSources}; positive Zeilen vollständig ${summary.positiveRowsWithAllSourcesSelected}/${summary.positiveRows}`
  );
} catch (error) {
  fail(error.stack || error.message);
}
