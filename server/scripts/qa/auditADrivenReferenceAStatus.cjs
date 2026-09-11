#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  buildADrivenAStatusAudit,
} = require("../../utils/policyAnalysis/aDrivenAStatusAudit");

function fail(message) {
  console.error(`[lf-a-status-audit] ${message}`);
  process.exit(1);
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      fail(`Ungültiges Argument: ${key || "-"}`);
    values[key.slice(2)] = path.resolve(value);
  }
  const allowed = new Set([
    "shadowRoot",
    "classificationRoot",
    "legacyManifest",
    "output",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return values;
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
  if (fs.existsSync(file)) throw new Error(`LF_A_STATUS_OUTPUT_EXISTS:${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

try {
  const args = argumentsFrom(process.argv.slice(2));
  const plan = readJson(
    path.join(args.shadowRoot, "source-unit-plan.private.json"),
    "LF_A_STATUS_SOURCE_PLAN"
  );
  const classificationBatches = readJson(
    path.join(args.shadowRoot, "classification-batches.private.json"),
    "LF_A_STATUS_CLASSIFICATION_BATCHES"
  );
  const manifest = readJson(
    path.join(
      args.classificationRoot,
      "dynamic-semantic-manifest.private.json"
    ),
    "LF_A_STATUS_DYNAMIC_MANIFEST"
  );
  const responses = readJson(
    path.join(args.classificationRoot, "responses.private.json"),
    "LF_A_STATUS_RESPONSES"
  );
  const batchResults = classificationBatches.batches.map((batch) =>
    readJson(
      path.join(
        args.classificationRoot,
        "batches",
        `${String(batch.batchIndex).padStart(4, "0")}-${batch.batchId}.private.json`
      ),
      "LF_A_STATUS_BATCH_RESULT"
    )
  );
  const audit = buildADrivenAStatusAudit({
    plan,
    manifest,
    responses,
    classificationBatches,
    batchResults,
    legacyManifest: readJson(args.legacyManifest, "LF_A_STATUS_LEGACY_MANIFEST"),
  });
  writePrivateJson(args.output, audit);
  console.log(JSON.stringify(audit.summary, null, 2));
} catch (error) {
  fail(error.stack || error.message);
}
