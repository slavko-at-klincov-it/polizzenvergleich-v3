#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  buildADrivenRequirementBinaryReferenceResult,
  validateADrivenRequirementBinaryReferenceResult,
} = require("../../utils/policyAnalysis/aDrivenBinaryReferenceResult");

function fail(message) {
  console.error(`[lf-a-driven-requirement-result] ${message}`);
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

function writeOrVerifyPrivateJson(file, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(file)) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("LF_A_DRIVEN_REQUIREMENT_BINARY_OUTPUT_INVALID");
    if (fs.readFileSync(file, "utf8") !== bytes)
      throw new Error("LF_A_DRIVEN_REQUIREMENT_BINARY_OUTPUT_MISMATCH");
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, bytes, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function run() {
  const args = argumentsFrom(process.argv.slice(2));
  const inputs = {
    manifest: readJson(
      args.manifest,
      "LF_A_DRIVEN_REQUIREMENT_BINARY_MANIFEST"
    ),
    decisionPlan: readJson(
      args.decisionPlan,
      "LF_A_DRIVEN_REQUIREMENT_BINARY_DECISION_PLAN"
    ),
    preliminaryDecisions: readJson(
      args.preliminaryDecisions,
      "LF_A_DRIVEN_REQUIREMENT_BINARY_PRELIMINARY_DECISIONS"
    ),
    absencePlan: readJson(
      args.absencePlan,
      "LF_A_DRIVEN_REQUIREMENT_BINARY_ABSENCE_PLAN"
    ),
    absenceDecisions: readJson(
      args.absenceDecisions,
      "LF_A_DRIVEN_REQUIREMENT_BINARY_ABSENCE_DECISIONS"
    ),
    rescuePlan: args.rescuePlan
      ? readJson(args.rescuePlan, "LF_A_DRIVEN_REQUIREMENT_BINARY_RESCUE_PLAN")
      : null,
    rescueDecisions: args.rescueDecisions
      ? readJson(
          args.rescueDecisions,
          "LF_A_DRIVEN_REQUIREMENT_BINARY_RESCUE_DECISIONS"
        )
      : null,
    finalDecisions: readJson(
      args.finalDecisions,
      "LF_A_DRIVEN_REQUIREMENT_BINARY_FINAL_DECISIONS"
    ),
  };
  const result = buildADrivenRequirementBinaryReferenceResult(inputs);
  validateADrivenRequirementBinaryReferenceResult(result, inputs);
  writeOrVerifyPrivateJson(args.output, result);
  console.log(
    JSON.stringify({ resultSha256: result.resultSha256, ...result.summary })
  );
}

try {
  run();
} catch (error) {
  fail(error.stack || error.message);
}
