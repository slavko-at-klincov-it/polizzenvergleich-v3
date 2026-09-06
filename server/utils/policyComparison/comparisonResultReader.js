const fs = require("fs");
const path = require("path");
const { customerSafeComparisonReadView } = require("./customerMetricContract");
const {
  normalizePolicyComparisonMode,
  POLICY_COMPARISON_MODE,
} = require("./modes");
const { customerSafeReferenceReadView } = require("./referenceResultBuilder");
const {
  DYNAMIC_REFERENCE_RESULT_CONTRACT_ID,
  customerSafeDynamicReferenceReadView,
} = require("./dynamicReferenceResultBuilder");
const {
  validateDynamicReferenceTemplateArtifacts,
} = require("./dynamicReferenceRunner");

function regularFile(file, fsImpl, errorCode) {
  if (!fsImpl.existsSync(file)) throw new Error(errorCode);
  const stat = fsImpl.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(errorCode);
  return file;
}

function regularDirectory(directory, fsImpl, errorCode) {
  if (!fsImpl.existsSync(directory)) throw new Error(errorCode);
  const stat = fsImpl.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(errorCode);
  return directory;
}

function readValidatedComparisonResult(
  resultFile,
  expectedComparisonMode,
  {
    fsImpl = fs,
    validateDynamicTemplate = validateDynamicReferenceTemplateArtifacts,
  } = {}
) {
  const expectedMode = normalizePolicyComparisonMode(expectedComparisonMode, {
    allowDefault: false,
  });
  const result = JSON.parse(fsImpl.readFileSync(resultFile, "utf8"));
  const resultMode = result?.comparisonMode
    ? normalizePolicyComparisonMode(result.comparisonMode, {
        allowDefault: false,
      })
    : POLICY_COMPARISON_MODE.SYMMETRIC_A_B;
  if (resultMode !== expectedMode)
    throw new Error(
      `COMPARISON_RESULT_MODE_MISMATCH:${expectedMode}:${resultMode}`
    );
  if (
    expectedMode === POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B &&
    result.contractId === DYNAMIC_REFERENCE_RESULT_CONTRACT_ID
  ) {
    const runRoot = path.resolve(path.dirname(resultFile), "..");
    const sourceDocuments = (result.documents || []).filter(
      ({ side }) => side === "A"
    );
    if (sourceDocuments.length !== 1)
      throw new Error("LF_DYNAMIC_REFERENCE_SOURCE_IDENTITY_MISMATCH");
    const sourceDocument = sourceDocuments[0];
    const documentsRoot = regularDirectory(
      path.join(runRoot, "documents"),
      fsImpl,
      "LF_DYNAMIC_REFERENCE_SOURCE_ARTIFACT_MISSING"
    );
    const sourceDirectories = fsImpl
      .readdirSync(documentsRoot, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.isSymbolicLink() &&
          entry.name.startsWith("A-") &&
          entry.name.endsWith(`-${sourceDocument?.uuid || "missing"}`)
      );
    if (sourceDirectories.length !== 1)
      throw new Error("LF_DYNAMIC_REFERENCE_SOURCE_ARTIFACT_MISSING");
    const documentArtifactFile = regularFile(
      path.join(
        documentsRoot,
        sourceDirectories[0].name,
        "document.private.json"
      ),
      fsImpl,
      "LF_DYNAMIC_REFERENCE_SOURCE_ARTIFACT_MISSING"
    );
    const { manifest } = validateDynamicTemplate(
      {
        templateRoot: path.join(runRoot, "reference-template"),
        documentArtifactFile,
        sourceDocument,
        templateDigest: result.templateDigest,
      },
      { fsImpl }
    );
    return customerSafeDynamicReferenceReadView(result, manifest);
  }
  if (expectedMode === POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B)
    return customerSafeReferenceReadView(result);
  return customerSafeComparisonReadView(result);
}

module.exports = { readValidatedComparisonResult };
