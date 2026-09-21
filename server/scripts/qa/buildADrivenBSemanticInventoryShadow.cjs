#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  buildADrivenSourceUnitPlan,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  buildSourceBlockLedger,
} = require("../../utils/policyAnalysis/sourceBlockLedger");
const {
  buildADrivenClassificationBatches,
} = require("../../utils/policyAnalysis/aDrivenClassificationContract");

const B_SEMANTIC_INVENTORY_SHADOW_CONTRACT_ID =
  "LF_A_DRIVEN_B_SEMANTIC_INVENTORY_SHADOW_V1";

function fail(message) {
  console.error(`[lf-b-semantic-inventory] ${message}`);
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
    "maximumUnits",
    "maximumCharacters",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of ["runRoot", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const maximumUnits = Number(values.maximumUnits || 6);
  const maximumCharacters = Number(values.maximumCharacters || 12_000);
  if (
    !Number.isInteger(maximumUnits) ||
    maximumUnits < 1 ||
    !Number.isInteger(maximumCharacters) ||
    maximumCharacters < 1_000
  )
    fail("Batchgrenzen sind ungültig");
  return {
    runRoot: path.resolve(values.runRoot),
    output: path.resolve(values.output),
    maximumUnits,
    maximumCharacters,
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

function writePrivateJson(file, value) {
  if (fs.existsSync(file))
    throw new Error(`LF_B_SEMANTIC_INVENTORY_OUTPUT_EXISTS:${file}`);
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

function loadBDocuments(runRoot) {
  const manifest = readJson(
    path.join(runRoot, "input-manifest.private.json"),
    "LF_B_SEMANTIC_INVENTORY_INPUT_MANIFEST"
  );
  const documents = manifest.documents
    .filter(({ side }) => side === "B")
    .sort((left, right) => left.position - right.position)
    .map((document, sidePosition) => {
      const artifact = readJson(
        path.join(
          documentDirectory(runRoot, document),
          "document.private.json"
        ),
        "LF_B_SEMANTIC_INVENTORY_DOCUMENT_ARTIFACT"
      );
      return {
        document: {
          ...document,
          sourcePackageSide: "B",
          sourcePackagePosition: document.position,
          position: sidePosition,
        },
        artifact,
        ledger: buildSourceBlockLedger(artifact),
      };
    });
  if (!documents.length)
    throw new Error("LF_B_SEMANTIC_INVENTORY_DOCUMENTS_MISSING");
  return documents;
}

function buildBSemanticInventoryShadow({
  runRoot,
  maximumUnits = 6,
  maximumCharacters = 12_000,
}) {
  const sourceDocuments = loadBDocuments(runRoot);
  const plan = buildADrivenSourceUnitPlan({ documents: sourceDocuments });
  const classificationBatches = buildADrivenClassificationBatches(plan, {
    maximumUnits,
    maximumCharacters,
  });
  const pendingUnits = plan.units.filter(
    ({ initialDisposition }) => initialDisposition === "PENDING_CLASSIFICATION"
  );
  const sourceCharacters = pendingUnits.reduce(
    (sum, unit) => sum + unit.source.combinedText.length,
    0
  );
  const largestUnitCharacters = pendingUnits.reduce(
    (maximum, unit) =>
      Math.max(
        maximum,
        unit.source.combinedText.length +
          (unit.governingContext?.combinedText.length || 0)
      ),
    0
  );
  const summary = {
    schemaVersion: 1,
    contractId: B_SEMANTIC_INVENTORY_SHADOW_CONTRACT_ID,
    sourceUnitPlanSha256: plan.planSha256,
    documents: plan.summary.documents,
    sourceBlocks: plan.summary.sourceBlocks,
    plannedUnits: plan.summary.plannedUnits,
    pendingUnits: plan.summary.pendingUnits,
    terminalNonOperativeUnits: plan.summary.terminalNonOperativeUnits,
    sourceCharacters,
    largestUnitCharacters,
    classificationBatches: classificationBatches.summary.batches,
    maximumUnits,
    maximumCharacters,
    sourcePackageSide: "B",
    customerNotFoundEligible: false,
    proofLimit:
      "Unveröffentlichter B-Inventar-Shadow. Der Plan erzeugt keine Kundenentscheidung und keine Abwesenheitsbehauptung. Erst validierte source-bound Klassifikation, vollständiges A/B-Matching, Ambiguitätsprüfung, Outcome-/Gold-Differential, kalter Lauf und Holdout können eine Aktivierung begründen.",
  };
  return { sourceDocuments, plan, classificationBatches, summary };
}

function run() {
  const args = argumentsFrom(process.argv.slice(2));
  if (fs.existsSync(args.output))
    throw new Error(`LF_B_SEMANTIC_INVENTORY_OUTPUT_EXISTS:${args.output}`);
  const built = buildBSemanticInventoryShadow(args);
  fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
  for (const { document, ledger } of built.sourceDocuments)
    writePrivateJson(
      path.join(
        args.output,
        "source-ledgers",
        `B-${String(document.position + 1).padStart(2, "0")}-${document.uuid}.private.json`
      ),
      ledger
    );
  writePrivateJson(
    path.join(args.output, "source-unit-plan.private.json"),
    built.plan
  );
  writePrivateJson(
    path.join(args.output, "classification-batches.private.json"),
    built.classificationBatches
  );
  writePrivateJson(
    path.join(args.output, "summary.private.json"),
    built.summary
  );
  console.log(
    `[lf-b-semantic-inventory] ${built.summary.documents} Dokumente, ${built.summary.sourceBlocks} Blöcke, ${built.summary.pendingUnits} offene Units, ${built.summary.classificationBatches} Batches`
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
  B_SEMANTIC_INVENTORY_SHADOW_CONTRACT_ID,
  buildBSemanticInventoryShadow,
  loadBDocuments,
};
