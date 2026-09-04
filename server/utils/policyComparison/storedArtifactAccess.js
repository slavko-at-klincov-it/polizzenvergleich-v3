const fs = require("fs");
const path = require("path");
const {
  LF_REFERENCE_PROFILE,
} = require("./lfReferenceProfile");
const {
  POLICY_COMPARISON_MODE,
  normalizePolicyComparisonMode,
} = require("./modes");
const {
  POLICY_COMPARISON_EXPORT_POLICY,
  comparisonExportContractPolicy,
  validateComparisonExportContract,
} = require("./comparisonExportContract");
const {
  POLICY_COMPARISON_ARTIFACT_SET_MANIFEST,
} = require("./artifactSetPublisher");
const {
  readValidatedComparisonResult,
} = require("./comparisonResultReader");

function accessError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isPathWithin(root, target) {
  const relative = path.relative(root, target);
  return (
    relative.length > 0 &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function regularFile(file, root, fsImpl, missingCode) {
  if (!isPathWithin(root, file) || !fsImpl.existsSync(file))
    throw accessError(missingCode);
  const stat = fsImpl.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile())
    throw accessError("COMPARISON_STORED_ARTIFACT_FILE_INVALID");
  return file;
}

function sameReferenceProfile(profile) {
  return (
    profile?.id === LF_REFERENCE_PROFILE.id &&
    profile?.catalogId === LF_REFERENCE_PROFILE.catalogId &&
    profile?.componentContractId === LF_REFERENCE_PROFILE.componentContractId
  );
}

function strictArtifactAccessRequired(result, comparisonMode, manifestExists) {
  if (manifestExists) return true;
  if (comparisonMode === POLICY_COMPARISON_MODE.SYMMETRIC_A_B)
    return Number(result?.schemaVersion) >= 15;
  return sameReferenceProfile(result?.productProfile);
}

function readValidatedStoredComparisonArtifacts(
  {
    policyComparisonsRoot,
    resultPath,
    expectedComparisonMode,
    expectedSessionUuid,
  },
  { fsImpl = fs, readResult = readValidatedComparisonResult } = {}
) {
  const root = path.resolve(String(policyComparisonsRoot || ""));
  const resultDirectory = path.resolve(root, String(resultPath || ""));
  if (!isPathWithin(root, resultDirectory))
    throw accessError("COMPARISON_STORED_ARTIFACT_PATH_INVALID");
  const mode = normalizePolicyComparisonMode(expectedComparisonMode, {
    allowDefault: false,
  });
  const resultFile = regularFile(
    path.join(resultDirectory, "comparison.private.json"),
    root,
    fsImpl,
    "COMPARISON_RESULT_MISSING"
  );
  const workbookFile = regularFile(
    path.join(resultDirectory, "polizzenvergleich.xlsx"),
    root,
    fsImpl,
    "COMPARISON_WORKBOOK_MISSING"
  );
  const result = readResult(resultFile, mode);
  const manifestFile = path.join(
    resultDirectory,
    POLICY_COMPARISON_ARTIFACT_SET_MANIFEST
  );
  const exportFile = path.join(resultDirectory, "export.private.json");
  const manifestExists = fsImpl.existsSync(manifestFile);
  const strict = strictArtifactAccessRequired(result, mode, manifestExists);

  if (strict) {
    regularFile(
      manifestFile,
      root,
      fsImpl,
      "COMPARISON_EXPORT_CONTRACT_MISSING"
    );
    regularFile(
      exportFile,
      root,
      fsImpl,
      "COMPARISON_EXPORT_CONTRACT_MISSING"
    );
    let exportContract;
    try {
      exportContract = JSON.parse(fsImpl.readFileSync(exportFile, "utf8"));
    } catch {
      throw accessError("COMPARISON_EXPORT_CONTRACT_INVALID");
    }
    const validatedExport = validateComparisonExportContract(
      exportContract,
      {
        expectedComparisonMode: mode,
        expectedSessionUuid,
        expectedRunSignature: result.runSignature,
        artifactSetManifestFile: manifestFile,
      },
      { fsImpl, verifyArchivedWorkbookFile: false }
    );
    return {
      result,
      workbookFile,
      workbookBytes: validatedExport.workbookBytes,
      exportContract: validatedExport,
      legacy: false,
    };
  }

  if (result?.sessionUuid && result.sessionUuid !== expectedSessionUuid)
    throw accessError("COMPARISON_RESULT_SESSION_MISMATCH");
  if (fsImpl.existsSync(exportFile)) {
    regularFile(
      exportFile,
      root,
      fsImpl,
      "COMPARISON_EXPORT_CONTRACT_INVALID"
    );
    let historicalExport;
    try {
      historicalExport = JSON.parse(fsImpl.readFileSync(exportFile, "utf8"));
    } catch {
      throw accessError("COMPARISON_EXPORT_CONTRACT_INVALID");
    }
    if (
      comparisonExportContractPolicy(historicalExport) !==
      POLICY_COMPARISON_EXPORT_POLICY.HISTORICAL_SCHEMA_1_READ_ONLY
    )
      throw accessError("COMPARISON_EXPORT_CONTRACT_UNSUPPORTED");
  }
  return {
    result,
    workbookFile,
    workbookBytes: fsImpl.readFileSync(workbookFile),
    exportContract: null,
    legacy: true,
  };
}

module.exports = {
  readValidatedStoredComparisonArtifacts,
  strictArtifactAccessRequired,
};
