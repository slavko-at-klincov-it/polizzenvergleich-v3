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

const DYNAMIC_REFERENCE_TEMPLATE_CONTRACT_ID =
  "LF_DYNAMIC_REFERENCE_TEMPLATE_ARTIFACT_SET_V1";
const DYNAMIC_REFERENCE_TEMPLATE_FILES = Object.freeze({
  ledger: "source-block-ledger.private.json",
  manifest: "semantic-requirement-manifest.private.json",
  identity: "artifact-set-manifest.private.json",
});

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

function readRegularFile(file, fsImpl, missingCode) {
  if (!fsImpl.existsSync(file)) throw new Error(missingCode);
  const stat = fsImpl.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile())
    throw new Error("LF_DYNAMIC_TEMPLATE_FILE_INVALID");
  return fsImpl.readFileSync(file);
}

function requireRegularDirectory(directory, fsImpl, missingCode) {
  if (!fsImpl.existsSync(directory)) throw new Error(missingCode);
  const stat = fsImpl.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory())
    throw new Error("LF_DYNAMIC_TEMPLATE_DIRECTORY_INVALID");
  return directory;
}

function readJsonFile(file, fsImpl, missingCode, invalidCode) {
  const bytes = readRegularFile(file, fsImpl, missingCode);
  try {
    return { bytes, value: JSON.parse(bytes.toString("utf8")) };
  } catch {
    throw new Error(invalidCode);
  }
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/u.test(String(value || ""));
}

function validateDynamicReferenceTemplateArtifacts(
  {
    templateRoot,
    documentArtifactFile,
    sourceDocument,
    templateDigest,
  },
  { fsImpl = fs, semanticOracle = oracle, familyContract } = {}
) {
  requireRegularDirectory(
    templateRoot,
    fsImpl,
    "LF_DYNAMIC_REFERENCE_TEMPLATE_ARTIFACT_SET_MISSING"
  );
  const ledgerFile = path.join(
    templateRoot,
    DYNAMIC_REFERENCE_TEMPLATE_FILES.ledger
  );
  const manifestFile = path.join(
    templateRoot,
    DYNAMIC_REFERENCE_TEMPLATE_FILES.manifest
  );
  const identityFile = path.join(
    templateRoot,
    DYNAMIC_REFERENCE_TEMPLATE_FILES.identity
  );
  const ledgerRead = readJsonFile(
    ledgerFile,
    fsImpl,
    "LF_DYNAMIC_REFERENCE_TEMPLATE_LEDGER_MISSING",
    "LF_DYNAMIC_REFERENCE_TEMPLATE_LEDGER_INVALID"
  );
  const manifestRead = readJsonFile(
    manifestFile,
    fsImpl,
    "LF_DYNAMIC_REFERENCE_TEMPLATE_MANIFEST_MISSING",
    "LF_DYNAMIC_REFERENCE_TEMPLATE_MANIFEST_INVALID"
  );
  const identityRead = readJsonFile(
    identityFile,
    fsImpl,
    "LF_DYNAMIC_REFERENCE_TEMPLATE_ARTIFACT_SET_MISSING",
    "LF_DYNAMIC_REFERENCE_TEMPLATE_ARTIFACT_SET_INVALID"
  );
  const documentArtifactRead = readJsonFile(
    documentArtifactFile,
    fsImpl,
    "LF_DYNAMIC_REFERENCE_SOURCE_ARTIFACT_MISSING",
    "LF_DYNAMIC_REFERENCE_SOURCE_ARTIFACT_INVALID"
  );
  const ledger = ledgerRead.value;
  const manifest = manifestRead.value;
  const templateIdentity = identityRead.value;
  const documentArtifact = documentArtifactRead.value;
  const expectedFileNames = [
    DYNAMIC_REFERENCE_TEMPLATE_FILES.ledger,
    DYNAMIC_REFERENCE_TEMPLATE_FILES.manifest,
  ].sort();
  const observedFileNames = Object.keys(templateIdentity?.files || {}).sort();

  if (
    templateIdentity?.schemaVersion !== 1 ||
    templateIdentity?.contractId !== DYNAMIC_REFERENCE_TEMPLATE_CONTRACT_ID ||
    !validSha256(templateIdentity?.sourceDocumentSha256) ||
    !validSha256(templateIdentity?.sourceBlockLedgerSha256) ||
    !validSha256(templateIdentity?.semanticRequirementManifestSha256) ||
    observedFileNames.length !== expectedFileNames.length ||
    observedFileNames.some(
      (filename, index) => filename !== expectedFileNames[index]
    )
  )
    throw new Error("LF_DYNAMIC_REFERENCE_TEMPLATE_ARTIFACT_SET_INVALID");

  if (
    typeof sourceDocument?.uuid !== "string" ||
    sourceDocument.uuid.length === 0 ||
    !validSha256(sourceDocument?.sha256) ||
    templateIdentity.sourceDocumentUuid !== sourceDocument.uuid ||
    templateIdentity.sourceDocumentSha256 !== sourceDocument.sha256 ||
    documentArtifact?.fingerprint !== sourceDocument.sha256 ||
    documentArtifact?.document?.sourceDocumentId !== sourceDocument.sha256
  )
    throw new Error("LF_DYNAMIC_REFERENCE_SOURCE_IDENTITY_MISMATCH");

  if (
    templateIdentity.files[DYNAMIC_REFERENCE_TEMPLATE_FILES.ledger] !==
      sha256(ledgerRead.bytes) ||
    templateIdentity.files[DYNAMIC_REFERENCE_TEMPLATE_FILES.manifest] !==
      sha256(manifestRead.bytes)
  )
    throw new Error("LF_DYNAMIC_REFERENCE_TEMPLATE_FILE_HASH_MISMATCH");

  if (
    !validSha256(templateDigest) ||
    sha256(identityRead.bytes) !== templateDigest
  )
    throw new Error("LF_DYNAMIC_REFERENCE_TEMPLATE_DIGEST_MISMATCH");

  if (
    templateIdentity.sourceBlockLedgerSha256 !== ledger?.ledgerSha256 ||
    templateIdentity.semanticRequirementManifestSha256 !==
      manifest?.manifestSha256
  )
    throw new Error("LF_DYNAMIC_REFERENCE_TEMPLATE_CONTENT_IDENTITY_MISMATCH");

  validateSourceBlockLedger(ledger, documentArtifact);
  validateLfSemanticRequirementManifest(manifest, {
    documentArtifact,
    oracle: semanticOracle,
    ...(familyContract ? { familyContract } : {}),
  });

  return {
    documentArtifact,
    ledger,
    ledgerFile,
    manifest,
    manifestFile,
    templateDigest,
    templateIdentity,
    identityFile,
  };
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
    DYNAMIC_REFERENCE_TEMPLATE_FILES.ledger
  );
  const manifestFile = path.join(
    templateRoot,
    DYNAMIC_REFERENCE_TEMPLATE_FILES.manifest
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
    contractId: DYNAMIC_REFERENCE_TEMPLATE_CONTRACT_ID,
    sourceDocumentUuid: documentRun.document.uuid,
    sourceDocumentSha256: documentRun.document.sha256,
    sourceBlockLedgerSha256: ledger.ledgerSha256,
    semanticRequirementManifestSha256: manifest.manifestSha256,
    files: {
      [DYNAMIC_REFERENCE_TEMPLATE_FILES.ledger]: sha256(ledgerBytes),
      [DYNAMIC_REFERENCE_TEMPLATE_FILES.manifest]: sha256(manifestBytes),
    },
  };
  const identityBytes = `${JSON.stringify(templateIdentity, null, 2)}\n`;
  const identityFile = path.join(
    templateRoot,
    DYNAMIC_REFERENCE_TEMPLATE_FILES.identity
  );
  writeOrVerify(
    identityFile,
    identityBytes,
    "LF_DYNAMIC_TEMPLATE_ARTIFACT_SET_RESUME_MISMATCH"
  );
  const templateDigest = sha256(identityBytes);
  validateDynamicReferenceTemplateArtifacts({
    templateRoot,
    documentArtifactFile,
    sourceDocument: documentRun.document,
    templateDigest,
  });
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

module.exports = {
  DYNAMIC_REFERENCE_TEMPLATE_CONTRACT_ID,
  DYNAMIC_REFERENCE_TEMPLATE_FILES,
  prepareDynamicReferenceTemplate,
  validateDynamicReferenceTemplateArtifacts,
};
