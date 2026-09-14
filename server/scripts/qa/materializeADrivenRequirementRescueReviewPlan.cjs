#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  buildADrivenRequirementRescueReviewPlan,
} = require("../../utils/policyAnalysis/aDrivenRequirementAbsenceCertification");

function fail(message) {
  console.error(`[lf-a-driven-rescue-review-plan] ${message}`);
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
    "decisionPlan",
    "preliminaryDecisions",
    "absencePlan",
    "absenceDecisions",
    "completeCorpus",
    "output",
  ];
  const unknown = Object.keys(values).filter(
    (name) =>
      ![
        ...required,
        "maximumRequirementsPerBatch",
        "maximumBatchCharacters",
      ].includes(name)
  );
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const name of required)
    if (!values[name]) fail(`--${name} ist erforderlich`);
  const integer = (name, fallback, minimum) => {
    const parsed = Number(values[name] ?? fallback);
    if (!Number.isSafeInteger(parsed) || parsed < minimum)
      fail(`--${name} ist ungültig`);
    return parsed;
  };
  return {
    decisionPlan: path.resolve(values.decisionPlan),
    preliminaryDecisions: path.resolve(values.preliminaryDecisions),
    absencePlan: path.resolve(values.absencePlan),
    absenceDecisions: path.resolve(values.absenceDecisions),
    completeCorpus: path.resolve(values.completeCorpus),
    output: path.resolve(values.output),
    maximumRequirementsPerBatch: integer("maximumRequirementsPerBatch", 1, 1),
    maximumBatchCharacters: integer("maximumBatchCharacters", 160_000, 10_000),
  };
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
      throw new Error("LF_A_DRIVEN_REQUIREMENT_RESCUE_OUTPUT_INVALID");
    if (fs.readFileSync(file, "utf8") !== bytes)
      throw new Error("LF_A_DRIVEN_REQUIREMENT_RESCUE_OUTPUT_MISMATCH");
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
  const plan = buildADrivenRequirementRescueReviewPlan({
    decisionPlan: readJson(
      args.decisionPlan,
      "LF_A_DRIVEN_REQUIREMENT_RESCUE_DECISION_PLAN"
    ),
    preliminaryDecisions: readJson(
      args.preliminaryDecisions,
      "LF_A_DRIVEN_REQUIREMENT_RESCUE_PRELIMINARY_DECISIONS"
    ),
    absencePlan: readJson(
      args.absencePlan,
      "LF_A_DRIVEN_REQUIREMENT_RESCUE_ABSENCE_PLAN"
    ),
    absenceDecisions: readJson(
      args.absenceDecisions,
      "LF_A_DRIVEN_REQUIREMENT_RESCUE_ABSENCE_DECISIONS"
    ),
    completeCorpus: readJson(
      args.completeCorpus,
      "LF_A_DRIVEN_REQUIREMENT_RESCUE_COMPLETE_CORPUS"
    ),
    maximumRequirementsPerBatch: args.maximumRequirementsPerBatch,
    maximumBatchCharacters: args.maximumBatchCharacters,
  });
  writeOrVerifyPrivateJson(args.output, plan);
  console.log(
    JSON.stringify({
      planSha256: plan.planSha256,
      requirements: plan.summary.requirements,
      components: plan.summary.components,
      selectedCandidates: plan.summary.selectedCandidates,
      fullCorpusReviewCandidates: plan.summary.fullCorpusReviewCandidates,
      batches: plan.summary.batches,
    })
  );
}

try {
  run();
} catch (error) {
  fail(error.stack || error.message);
}
