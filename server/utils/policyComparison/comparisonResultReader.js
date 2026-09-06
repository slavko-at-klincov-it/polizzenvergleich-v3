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
  validateLfSemanticRequirementManifest,
} = require("./lfSemanticRequirementManifest");
const { oracle } = require("./lfDynamicReferenceProfile");

function regularFile(file, errorCode) {
  if (!fs.existsSync(file)) throw new Error(errorCode);
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(errorCode);
  return file;
}

function readValidatedComparisonResult(resultFile, expectedComparisonMode) {
  const expectedMode = normalizePolicyComparisonMode(expectedComparisonMode, {
    allowDefault: false,
  });
  const result = JSON.parse(fs.readFileSync(resultFile, "utf8"));
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
    const manifestFile = path.resolve(
      path.dirname(resultFile),
      "..",
      "reference-template",
      "semantic-requirement-manifest.private.json"
    );
    regularFile(manifestFile, "LF_DYNAMIC_REFERENCE_TEMPLATE_MANIFEST_MISSING");
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    const runRoot = path.resolve(path.dirname(resultFile), "..");
    const sourceDocument = (result.documents || []).find(
      ({ side }) => side === "A"
    );
    const documentsRoot = path.join(runRoot, "documents");
    const sourceDirectories = fs
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
      "LF_DYNAMIC_REFERENCE_SOURCE_ARTIFACT_MISSING"
    );
    const documentArtifact = JSON.parse(
      fs.readFileSync(documentArtifactFile, "utf8")
    );
    validateLfSemanticRequirementManifest(manifest, {
      documentArtifact,
      oracle,
    });
    return customerSafeDynamicReferenceReadView(result, manifest);
  }
  if (expectedMode === POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B)
    return customerSafeReferenceReadView(result);
  return customerSafeComparisonReadView(result);
}

module.exports = { readValidatedComparisonResult };
