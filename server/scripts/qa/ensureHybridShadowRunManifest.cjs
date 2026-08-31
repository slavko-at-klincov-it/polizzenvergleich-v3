#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  loadHybridShadowContract,
} = require("../../utils/policyAnalysis/hybridShadowSearch");
const {
  CATEGORY_ORDER,
} = require("../../utils/policyComparison/productContract");
const {
  releaseIdentity,
} = require("../../utils/policyAnalysis/runIdentity");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");

function fail(message) {
  console.error(`[hybrid-shadow-manifest] ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) fail(`Ungültiges Argument: ${key}`);
    values[key.slice(2)] = value;
  }
  return values;
}

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function readJson(file, label) {
  if (!fs.existsSync(file)) fail(`${label} fehlt: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${label} ist kein gültiges JSON: ${error.message}`);
  }
}

function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set([
    "primaryOutput",
    "contractFile",
    "output",
    "documentStatus",
    "model",
    "modelTokenLimit",
  ]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!args[required]) fail(`--${required} ist erforderlich`);

  const primaryOutput = path.resolve(args.primaryOutput);
  const output = path.resolve(args.output);
  if (
    output === primaryOutput ||
    output.startsWith(`${primaryOutput}${path.sep}`) ||
    output === REPOSITORY_ROOT ||
    output.startsWith(`${REPOSITORY_ROOT}${path.sep}`)
  )
    fail("Shadow-Ausgabe muss außerhalb von Primärlauf und Repository liegen");
  if (fs.existsSync(output))
    fail(
      `Shadow-Ausgabe existiert bereits; unsicherer Resume abgelehnt: ${output}`
    );

  const primaryManifestFile = path.join(primaryOutput, "manifest.private.json");
  const documentArtifactFile = path.join(primaryOutput, "document.private.json");
  const primaryManifest = readJson(primaryManifestFile, "Primärmanifest");
  const documentArtifact = readJson(documentArtifactFile, "Dokument-Artefakt");
  const { identity: contract } = loadHybridShadowContract(args.contractFile);
  if (!contract.enabled) fail("Der explizite Shadow-Vertrag ist deaktiviert");
  if (
    primaryManifest?.runKind !== "ALL_CATEGORIES_QUALITY" ||
    primaryManifest.configuration?.documentStatus !== args.documentStatus
  )
    fail("Dokumentstatus stimmt nicht mit dem Primärlauf überein");

  const categories = CATEGORY_ORDER.map((categoryView) => {
    const worksheetFile = path.join(
      primaryOutput,
      categoryView,
      "worksheet.private.json"
    );
    const resultReportFile = path.join(
      primaryOutput,
      categoryView,
      "result",
      "report.json"
    );
    const worksheet = readJson(worksheetFile, `${categoryView}-Worksheet`);
    readJson(resultReportFile, `${categoryView}-Ergebnisreport`);
    if (
      worksheet?.catalog?.categoryView !== categoryView ||
      worksheet?.document?.fingerprint !== documentArtifact?.fingerprint
    )
      fail(`${categoryView}-Worksheet gehört nicht zum Primärdokument`);
    return {
      categoryView,
      worksheetPath: worksheetFile,
      worksheetSha256: sha256File(worksheetFile),
      resultReportPath: resultReportFile,
      resultReportSha256: sha256File(resultReportFile),
    };
  });

  const manifest = {
    schemaVersion: 1,
    runKind: "HYBRID_SHADOW_RECALL_QA",
    shadowOnly: true,
    primaryMutationAllowed: false,
    resumeAllowed: false,
    createdAt: new Date().toISOString(),
    shadowImplementation: {
      repository: REPOSITORY_ROOT,
      releaseId: releaseIdentity(REPOSITORY_ROOT),
    },
    primaryRun: {
      root: primaryOutput,
      manifestPath: primaryManifestFile,
      manifestSha256: sha256File(primaryManifestFile),
      releaseId: primaryManifest.releaseId,
      productProfile: primaryManifest.productProfile,
      documentArtifactPath: documentArtifactFile,
      documentArtifactSha256: sha256File(documentArtifactFile),
    },
    contract,
    analysis: {
      documentStatus: args.documentStatus,
      model: args.model,
      modelTokenLimit: Number(args.modelTokenLimit),
    },
    categories,
  };
  if (
    !Number.isInteger(manifest.analysis.modelTokenLimit) ||
    manifest.analysis.modelTokenLimit < 1
  )
    fail("modelTokenLimit ist ungültig");
  fs.mkdirSync(output, { recursive: false, mode: 0o700 });
  const manifestFile = path.join(output, "manifest.private.json");
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(`[hybrid-shadow-manifest] Neu angelegt: ${manifestFile}`);
}

run();
