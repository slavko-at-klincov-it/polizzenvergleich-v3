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
const {
  buildADrivenSemanticManifest,
} = require("../../utils/policyAnalysis/aDrivenSemanticManifest");
const {
  buildLegacyOracleCrosswalkDraft,
} = require("../../utils/policyAnalysis/aDrivenLegacyOracleCrosswalk");

function fail(message) {
  console.error(`[lf-a-driven-shadow] ${message}`);
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
  const allowed = new Set(["runRoot", "responses", "output"]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of ["runRoot", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, path.resolve(value)])
  );
}

function readJson(file, code) {
  if (!fs.existsSync(file)) throw new Error(`${code}_MISSING`);
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${code}_INVALID`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error(`${code}_INVALID`);
  }
}

function writePrivateJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  if (fs.existsSync(file)) throw new Error(`LF_A_SHADOW_OUTPUT_EXISTS:${file}`);
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

function loadADocuments(runRoot) {
  const manifest = readJson(
    path.join(runRoot, "input-manifest.private.json"),
    "LF_A_SHADOW_INPUT_MANIFEST"
  );
  const documents = manifest.documents
    .filter(({ side }) => side === "A")
    .sort((left, right) => left.position - right.position)
    .map((document) => {
      const artifact = readJson(
        path.join(documentDirectory(runRoot, document), "document.private.json"),
        "LF_A_SHADOW_DOCUMENT_ARTIFACT"
      );
      return {
        document,
        artifact,
        ledger: buildSourceBlockLedger(artifact),
      };
    });
  if (!documents.length) throw new Error("LF_A_SHADOW_DOCUMENTS_MISSING");
  return documents;
}

try {
  const args = argumentsFrom(process.argv.slice(2));
  if (fs.existsSync(args.output)) fail(`Ausgabe existiert bereits: ${args.output}`);
  const sourceDocuments = loadADocuments(args.runRoot);
  const plan = buildADrivenSourceUnitPlan({ documents: sourceDocuments });
  const classificationBatches = buildADrivenClassificationBatches(plan);
  const responses = args.responses
    ? readJson(args.responses, "LF_A_SHADOW_RESPONSES")
    : [];
  if (!Array.isArray(responses))
    throw new Error("LF_A_SHADOW_RESPONSES_INVALID");
  const dynamicManifest = buildADrivenSemanticManifest({ plan, responses });
  const legacyManifestFile = path.join(
    args.runRoot,
    "reference-template",
    "semantic-requirement-manifest.private.json"
  );
  const legacyCrosswalkDraft = fs.existsSync(legacyManifestFile)
    ? buildLegacyOracleCrosswalkDraft({
        dynamicManifest,
        legacyManifest: readJson(
          legacyManifestFile,
          "LF_A_SHADOW_LEGACY_MANIFEST"
        ),
      })
    : null;
  fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
  for (const { document, ledger } of sourceDocuments)
    writePrivateJson(
      path.join(
        args.output,
        "source-ledgers",
        `A-${String(document.position + 1).padStart(2, "0")}-${document.uuid}.private.json`
      ),
      ledger
    );
  writePrivateJson(path.join(args.output, "source-unit-plan.private.json"), plan);
  writePrivateJson(
    path.join(args.output, "classification-batches.private.json"),
    classificationBatches
  );
  writePrivateJson(
    path.join(args.output, "dynamic-semantic-manifest.private.json"),
    dynamicManifest
  );
  if (legacyCrosswalkDraft)
    writePrivateJson(
      path.join(args.output, "legacy-283-crosswalk-draft.private.json"),
      legacyCrosswalkDraft
    );
  const summary = {
    contractId: "LF_REFERENCE_A_DRIVEN_SHADOW_V1",
    runContractId: plan.runContractId,
    sourceUnitPlanSha256: plan.planSha256,
    dynamicManifestSha256: dynamicManifest.manifestSha256,
    documents: plan.summary.documents,
    sourceBlocks: plan.summary.sourceBlocks,
    plannedUnits: plan.summary.plannedUnits,
    classificationBatches: classificationBatches.summary.batches,
    semanticRequirements: dynamicManifest.summary.semanticRequirements,
    semanticComponents: dynamicManifest.summary.semanticComponents,
    unresolvedUnits: dynamicManifest.summary.unresolvedUnits,
    reviewRequiredBlocks: dynamicManifest.summary.reviewRequiredBlocks,
    responseIntegrityStatus: dynamicManifest.summary.responseIntegrityStatus,
    legacyRequirements: legacyCrosswalkDraft?.summary.legacyRequirements ?? null,
    legacyComponents: legacyCrosswalkDraft?.summary.legacyComponents ?? null,
    legacyCoveredComponents:
      legacyCrosswalkDraft?.summary.coveredComponents ?? null,
    acceptanceReady: false,
    proofLimit:
      "Shadow-Artefakt. Ohne validierte bounded Modellantworten, doppelt geprüften 283/631-Crosswalk, Mutations- und Holdout-Gates keine Produkt- oder Vollständigkeitsfreigabe.",
  };
  writePrivateJson(path.join(args.output, "summary.private.json"), summary);
  console.log(
    `[lf-a-driven-shadow] ${summary.sourceBlocks} Blöcke, ${summary.plannedUnits} Units, ${summary.semanticRequirements} Requirements, ${summary.unresolvedUnits} Units ungeklärt`
  );
} catch (error) {
  fail(error.stack || error.message);
}
