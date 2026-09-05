const fs = require("fs");
const path = require("path");
const { customerSafeComparisonReadView } = require("./customerMetricContract");
const {
  normalizePolicyComparisonMode,
  POLICY_COMPARISON_MODE,
} = require("./modes");
const { customerSafeReferenceReadView } = require("./referenceResultBuilder");
const {
  LF_REFERENCE_MANIFEST_FILE,
  validateLfReferenceLineManifest,
} = require("./lfReferenceManifest");

function readReferenceManifestForResult(resultFile, result) {
  if (result?.productProfile?.id !== "LF_IMMO_REFERENCE_SOURCE_MANIFEST_V1")
    return null;
  const runRoot = path.dirname(path.dirname(resultFile));
  const manifestFile = path.join(runRoot, LF_REFERENCE_MANIFEST_FILE);
  if (!fs.existsSync(manifestFile))
    throw new Error("REFERENCE_RESULT_MANIFEST_MISSING");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const sideA = (result.documents || []).find(({ side }) => side === "A");
  const documentsRoot = path.join(runRoot, "documents");
  const documentDirectory = fs
    .readdirSync(documentsRoot)
    .map((name) => path.join(documentsRoot, name))
    .find((directory) => directory.endsWith(`-${sideA?.uuid}`));
  const documentArtifact = documentDirectory
    ? path.join(documentDirectory, "document.private.json")
    : null;
  if (!documentArtifact || !fs.existsSync(documentArtifact))
    throw new Error("REFERENCE_RESULT_SOURCE_ARTIFACT_MISSING");
  return validateLfReferenceLineManifest(manifest, {
    documentArtifact: JSON.parse(fs.readFileSync(documentArtifact, "utf8")),
  });
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
  if (expectedMode === POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B)
    return customerSafeReferenceReadView(result, {
      referenceManifest: readReferenceManifestForResult(resultFile, result),
    });
  return customerSafeComparisonReadView(result);
}

module.exports = { readValidatedComparisonResult };
