#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  buildSourceBlockLedger,
} = require("../../utils/policyAnalysis/sourceBlockLedger");
const {
  buildADrivenSourceUnitPlan,
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  buildADrivenClassificationBatches,
} = require("../../utils/policyAnalysis/aDrivenClassificationContract");
const {
  buildAutomatedADrivenIntegrityReceipt,
} = require("../../utils/policyAnalysis/aDrivenAutomaticIntegrityGate");
const {
  validateCompletedRun,
} = require("./runADrivenReferenceClassification.cjs");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fail(message) {
  console.error(`[lf-a-automated-b-shadow-gate] ${message}`);
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
    values[name] = path.resolve(value);
  }
  const allowed = new Set(["runRoot", "classificationRoot", "output"]);
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
  const bytes = fs.readFileSync(file);
  try {
    return { value: JSON.parse(bytes.toString("utf8")), bytes };
  } catch {
    throw new Error(`${code}_INVALID`);
  }
}

function writePrivateJson(file, value) {
  if (fs.existsSync(file))
    throw new Error(`LF_A_AUTOMATED_GATE_OUTPUT_EXISTS:${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function documentDirectory(runRoot, document) {
  return path.join(
    runRoot,
    "documents",
    `${document.side}-${String(document.position + 1).padStart(2, "0")}-${document.uuid}`
  );
}

function reconstructSourcePlan(runRoot, inputManifest) {
  const aDocuments = inputManifest.documents
    .filter(({ side }) => side === "A")
    .sort((left, right) => left.position - right.position)
    .map((document) => {
      const artifact = readJson(
        path.join(documentDirectory(runRoot, document), "document.private.json"),
        "LF_A_AUTOMATED_GATE_A_DOCUMENT_ARTIFACT"
      ).value;
      return {
        document,
        artifact,
        ledger: buildSourceBlockLedger(artifact),
      };
    });
  return buildADrivenSourceUnitPlan({ documents: aDocuments });
}

function batchFile(classificationRoot, batch) {
  return path.join(
    classificationRoot,
    "batches",
    `${String(batch.batchIndex).padStart(4, "0")}-${batch.batchId}.private.json`
  );
}

function main(argv = process.argv.slice(2)) {
  const args = argumentsFrom(argv);
  const input = readJson(
    path.join(args.runRoot, "input-manifest.private.json"),
    "LF_A_AUTOMATED_GATE_INPUT_MANIFEST"
  );
  if (!Array.isArray(input.value?.documents))
    throw new Error("LF_A_AUTOMATED_GATE_INPUT_MANIFEST_INVALID");
  const reconstructedPlan = reconstructSourcePlan(args.runRoot, input.value);
  const planFile = path.join(args.classificationRoot, "source-unit-plan.private.json");
  const plan = readJson(planFile, "LF_A_AUTOMATED_GATE_SOURCE_PLAN");
  if (stableStringify(reconstructedPlan) !== stableStringify(plan.value))
    throw new Error("LF_A_AUTOMATED_GATE_SOURCE_PLAN_RECONSTRUCTION_MISMATCH");
  const batchesFile = path.join(
    args.classificationRoot,
    "classification-batches.private.json"
  );
  const batches = readJson(
    batchesFile,
    "LF_A_AUTOMATED_GATE_CLASSIFICATION_PLAN"
  );
  const rebuiltBatches = buildADrivenClassificationBatches(plan.value, {
    maximumUnits: batches.value.summary?.maximumUnits,
    maximumCharacters: batches.value.summary?.maximumCharacters,
  });
  if (stableStringify(rebuiltBatches) !== stableStringify(batches.value))
    throw new Error("LF_A_AUTOMATED_GATE_CLASSIFICATION_PLAN_MISMATCH");
  const summaryFile = path.join(args.classificationRoot, "summary.private.json");
  const summary = readJson(summaryFile, "LF_A_AUTOMATED_GATE_SUMMARY");
  validateCompletedRun({
    args: {
      output: args.classificationRoot,
      model: summary.value.model?.id,
      modelContext: summary.value.model?.loadedContextLength,
    },
    plan: plan.value,
    batches: batches.value,
    summaryFile,
  });
  const responsesFile = path.join(
    args.classificationRoot,
    "responses.private.json"
  );
  const manifestFile = path.join(
    args.classificationRoot,
    "dynamic-semantic-manifest.private.json"
  );
  const responses = readJson(responsesFile, "LF_A_AUTOMATED_GATE_RESPONSES");
  const manifest = readJson(manifestFile, "LF_A_AUTOMATED_GATE_MANIFEST");
  const batchResults = batches.value.batches.map((batch) =>
    readJson(
      batchFile(args.classificationRoot, batch),
      "LF_A_AUTOMATED_GATE_BATCH_RESULT"
    ).value
  );
  const receipt = buildAutomatedADrivenIntegrityReceipt({
    plan: plan.value,
    classificationBatches: batches.value,
    batchResults,
    responses: responses.value,
    classificationSummary: summary.value,
    manifest: manifest.value,
    inputManifest: input.value,
    inputManifestBytes: input.bytes,
    artifactFileSha256s: {
      sourceUnitPlan: sha256(plan.bytes),
      classificationBatches: sha256(batches.bytes),
      responses: sha256(responses.bytes),
      classificationSummary: sha256(summary.bytes),
      dynamicManifest: sha256(manifest.bytes),
    },
  });
  writePrivateJson(args.output, receipt);
  process.stdout.write(`${receipt.readinessSha256}\n`);
  return receipt;
}

if (require.main === module)
  try {
    main();
  } catch (error) {
    fail(error.stack || error.message);
  }

module.exports = {
  argumentsFrom,
  main,
  reconstructSourcePlan,
};
