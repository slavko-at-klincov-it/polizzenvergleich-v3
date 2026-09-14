#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  buildADrivenGoldRegression,
} = require("../../utils/policyAnalysis/aDrivenGoldRegression");

function fail(message) {
  console.error(`[lf-a-driven-gold-regression] ${message}`);
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
    "result",
    "output",
    "expectedGoldSha256",
    "expectedGoldFileSha256",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of [
    "manifest",
    "gold",
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
  return {
    ...values,
    manifest: path.resolve(values.manifest),
    gold: path.resolve(values.gold),
    result: values.result ? path.resolve(values.result) : null,
    output: path.resolve(values.output),
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
    throw new Error(`LF_A_DRIVEN_GOLD_REGRESSION_OUTPUT_EXISTS:${file}`);
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
  const regression = buildADrivenGoldRegression({
    manifest: readJson(args.manifest, "LF_A_DRIVEN_GOLD_MANIFEST"),
    gold: JSON.parse(goldBytes.toString("utf8")),
    expectedGoldSha256: args.expectedGoldSha256,
    result: args.result
      ? readJson(args.result, "LF_A_DRIVEN_GOLD_RESULT")
      : null,
  });
  writePrivateJson(args.output, {
    ...regression,
    goldFileSha256: observedGoldFileSha256,
  });
  console.log(
    `[lf-a-driven-gold-regression] A ${regression.crosswalk.summary.legacyRequirementsSourceCovered}/${regression.crosswalk.summary.legacyRequirements}; Rollen ${regression.crosswalk.summary.legacyComponentsRoleCovered}/${regression.crosswalk.summary.legacyComponents}`
  );
} catch (error) {
  fail(error.stack || error.message);
}
