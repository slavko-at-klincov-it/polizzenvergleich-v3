const fs = require("fs");
const path = require("path");
const { sha256 } = require("../policyAnalysis/runIdentity");
const {
  buildSourceBlockLedger,
  canonicalSourceBlockLedgerBytes,
  validateSourceBlockLedger,
} = require("../policyAnalysis/sourceBlockLedger");
const {
  buildLfSemanticRequirementManifest,
  validateLfSemanticRequirementManifest,
} = require("./lfSemanticRequirementManifest");
const {
  categoryCatalogsFromManifest,
  dynamicAnalysisPrompt,
  oracle,
} = require("./lfDynamicReferenceProfile");
const {
  extractReferenceDocument,
  prepareReferenceContracts,
} = require("./referenceRunner");

function privateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function writeOrVerify(file, bytes, mismatchCode) {
  privateDirectory(path.dirname(file));
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, "utf8") !== bytes) throw new Error(mismatchCode);
    return;
  }
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, bytes, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

async function prepareDynamicReferenceTemplate({
  runRoot,
  sourceFile,
  documentRun,
  logFile,
}) {
  const documentArtifactFile = await extractReferenceDocument({
    file: sourceFile,
    outputDirectory: documentRun.outputDirectory,
    logFile,
  });
  const documentArtifact = JSON.parse(
    fs.readFileSync(documentArtifactFile, "utf8")
  );
  const ledger = buildSourceBlockLedger(documentArtifact);
  const manifest = buildLfSemanticRequirementManifest({
    documentArtifact,
    ledger,
    oracle,
  });
  validateSourceBlockLedger(ledger, documentArtifact);
  validateLfSemanticRequirementManifest(manifest, {
    documentArtifact,
    oracle,
  });

  const templateRoot = path.join(runRoot, "reference-template");
  const ledgerFile = path.join(
    templateRoot,
    "source-block-ledger.private.json"
  );
  const manifestFile = path.join(
    templateRoot,
    "semantic-requirement-manifest.private.json"
  );
  const ledgerBytes = canonicalSourceBlockLedgerBytes(ledger);
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  writeOrVerify(
    ledgerFile,
    ledgerBytes,
    "LF_DYNAMIC_TEMPLATE_LEDGER_RESUME_MISMATCH"
  );
  writeOrVerify(
    manifestFile,
    manifestBytes,
    "LF_DYNAMIC_TEMPLATE_MANIFEST_RESUME_MISMATCH"
  );
  const templateIdentity = {
    schemaVersion: 1,
    contractId: "LF_DYNAMIC_REFERENCE_TEMPLATE_ARTIFACT_SET_V1",
    sourceDocumentUuid: documentRun.document.uuid,
    sourceDocumentSha256: documentRun.document.sha256,
    sourceBlockLedgerSha256: ledger.ledgerSha256,
    semanticRequirementManifestSha256: manifest.manifestSha256,
    files: {
      "source-block-ledger.private.json": sha256(ledgerBytes),
      "semantic-requirement-manifest.private.json": sha256(manifestBytes),
    },
  };
  const identityBytes = `${JSON.stringify(templateIdentity, null, 2)}\n`;
  const identityFile = path.join(
    templateRoot,
    "artifact-set-manifest.private.json"
  );
  writeOrVerify(
    identityFile,
    identityBytes,
    "LF_DYNAMIC_TEMPLATE_ARTIFACT_SET_RESUME_MISMATCH"
  );
  const templateDigest = sha256(identityBytes);
  const contracts = prepareReferenceContracts(runRoot, {
    definitions: categoryCatalogsFromManifest(manifest),
    promptBuilder: dynamicAnalysisPrompt,
    directoryName: "dynamic-reference-contracts",
  });
  return {
    documentArtifact,
    documentArtifactFile,
    ledger,
    ledgerFile,
    manifest,
    manifestFile,
    templateIdentity,
    templateDigest,
    templateRoot,
    contracts,
  };
}

module.exports = { prepareDynamicReferenceTemplate };
