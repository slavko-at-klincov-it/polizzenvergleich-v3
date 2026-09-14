#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  validateADrivenRequirementBinaryReferenceResult,
} = require("../../utils/policyAnalysis/aDrivenBinaryReferenceResult");
const {
  writeADrivenRequirementReviewWorkbook,
} = require("../../utils/policyAnalysis/aDrivenRequirementReviewWorkbook");

function fail(message) {
  console.error(`[lf-a-driven-review-workbook] ${message}`);
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
  const required = [
    "manifest",
    "decisionPlan",
    "preliminaryDecisions",
    "absencePlan",
    "absenceDecisions",
    "finalDecisions",
    "binaryResult",
    "output",
  ];
  const optional = ["rescuePlan", "rescueDecisions"];
  const unknown = Object.keys(values).filter(
    (name) => !required.includes(name) && !optional.includes(name)
  );
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const name of required)
    if (!values[name]) fail(`--${name} ist erforderlich`);
  if (Boolean(values.rescuePlan) !== Boolean(values.rescueDecisions))
    fail("--rescuePlan und --rescueDecisions müssen gemeinsam gesetzt werden");
  return Object.fromEntries(
    [...required, ...optional]
      .filter((name) => values[name])
      .map((name) => [name, path.resolve(values[name])])
  );
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

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  const inputs = {
    manifest: readJson(args.manifest, "LF_A_DRIVEN_WORKBOOK_MANIFEST"),
    decisionPlan: readJson(
      args.decisionPlan,
      "LF_A_DRIVEN_WORKBOOK_DECISION_PLAN"
    ),
    preliminaryDecisions: readJson(
      args.preliminaryDecisions,
      "LF_A_DRIVEN_WORKBOOK_PRELIMINARY_DECISIONS"
    ),
    absencePlan: readJson(
      args.absencePlan,
      "LF_A_DRIVEN_WORKBOOK_ABSENCE_PLAN"
    ),
    absenceDecisions: readJson(
      args.absenceDecisions,
      "LF_A_DRIVEN_WORKBOOK_ABSENCE_DECISIONS"
    ),
    rescuePlan: args.rescuePlan
      ? readJson(args.rescuePlan, "LF_A_DRIVEN_WORKBOOK_RESCUE_PLAN")
      : null,
    rescueDecisions: args.rescueDecisions
      ? readJson(
          args.rescueDecisions,
          "LF_A_DRIVEN_WORKBOOK_RESCUE_DECISIONS"
        )
      : null,
    finalDecisions: readJson(
      args.finalDecisions,
      "LF_A_DRIVEN_WORKBOOK_FINAL_DECISIONS"
    ),
  };
  const binaryResult = readJson(
    args.binaryResult,
    "LF_A_DRIVEN_WORKBOOK_BINARY_RESULT"
  );
  validateADrivenRequirementBinaryReferenceResult(binaryResult, inputs);
  const summary = await writeADrivenRequirementReviewWorkbook(
    binaryResult,
    args.output
  );
  console.log(
    JSON.stringify({ ...summary, fileSha256: sha256File(args.output) })
  );
}

run().catch((error) => fail(error.stack || error.message));
