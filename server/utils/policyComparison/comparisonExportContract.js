const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  POLICY_COMPARISON_ARTIFACT_FILES,
  POLICY_COMPARISON_ARTIFACT_SET_CONTRACT_ID,
  POLICY_COMPARISON_ARTIFACT_SET_MANIFEST,
  POLICY_COMPARISON_ARTIFACT_SET_SCHEMA_VERSION,
  buildArtifactSetManifest,
} = require("./artifactSetPublisher");
const {
  CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT,
} = require("./customerResultRuleOutcomeContract");
const {
  POLICY_COMPARISON_MODE,
  normalizePolicyComparisonMode,
} = require("./modes");

const POLICY_COMPARISON_EXPORT_SCHEMA_VERSION = 2;
const POLICY_COMPARISON_EXPORT_CONTRACT_ID = "POLICY_COMPARISON_EXPORT_V2";
const POLICY_COMPARISON_EXPORT_POLICY = Object.freeze({
  CURRENT_SCHEMA_2: "CURRENT_SCHEMA_2",
  HISTORICAL_SCHEMA_1_READ_ONLY: "HISTORICAL_SCHEMA_1_READ_ONLY",
  UNSUPPORTED: "UNSUPPORTED",
});
const CUSTOMER_COMPARISON_RESULT_SCHEMA_VERSION = 15;
const LF_REFERENCE_RESULT_SCHEMA_VERSION = 2;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function exportContractError(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function comparisonExportContractPolicy(value) {
  if (
    value?.schemaVersion === POLICY_COMPARISON_EXPORT_SCHEMA_VERSION &&
    value?.contractId === POLICY_COMPARISON_EXPORT_CONTRACT_ID
  )
    return POLICY_COMPARISON_EXPORT_POLICY.CURRENT_SCHEMA_2;
  if (
    value?.schemaVersion === 1 &&
    (value?.contractId === undefined || value?.contractId === null)
  )
    return POLICY_COMPARISON_EXPORT_POLICY.HISTORICAL_SCHEMA_1_READ_ONLY;
  return POLICY_COMPARISON_EXPORT_POLICY.UNSUPPORTED;
}

function assertRegularFile(file, label, fsImpl) {
  const resolved = path.resolve(String(file || ""));
  if (!path.isAbsolute(String(file || "")) || !fsImpl.existsSync(resolved))
    throw exportContractError("COMPARISON_EXPORT_FILE_MISSING", label);
  const stat = fsImpl.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isFile())
    throw exportContractError("COMPARISON_EXPORT_FILE_INVALID", label);
  return resolved;
}

function readJson(file, errorCode, fsImpl) {
  try {
    return JSON.parse(fsImpl.readFileSync(file, "utf8"));
  } catch (error) {
    throw exportContractError(errorCode, error.message);
  }
}

function artifactByFilename(manifest, filename) {
  return (manifest?.artifacts || []).find(
    (artifact) => artifact?.filename === filename
  );
}

function readValidatedArtifactSet(artifactSetManifestFile, fsImpl) {
  const manifestFile = assertRegularFile(
    artifactSetManifestFile,
    POLICY_COMPARISON_ARTIFACT_SET_MANIFEST,
    fsImpl
  );
  if (path.basename(manifestFile) !== POLICY_COMPARISON_ARTIFACT_SET_MANIFEST)
    throw exportContractError(
      "COMPARISON_EXPORT_ARTIFACT_MANIFEST_NAME_INVALID"
    );

  const directory = path.dirname(manifestFile);
  const files = Object.fromEntries(
    POLICY_COMPARISON_ARTIFACT_FILES.map((filename) => [
      filename,
      assertRegularFile(path.join(directory, filename), filename, fsImpl),
    ])
  );
  const persistedManifest = readJson(
    manifestFile,
    "COMPARISON_EXPORT_ARTIFACT_MANIFEST_JSON_INVALID",
    fsImpl
  );
  const recomputedManifest = buildArtifactSetManifest(files, fsImpl);
  if (
    persistedManifest?.contractId !==
      POLICY_COMPARISON_ARTIFACT_SET_CONTRACT_ID ||
    !SHA256_PATTERN.test(
      String(persistedManifest?.manifestDigestSha256 || "")
    ) ||
    !sameJson(persistedManifest, recomputedManifest)
  )
    throw exportContractError("COMPARISON_EXPORT_ARTIFACT_SET_INVALID");

  return {
    files,
    manifest: persistedManifest,
    manifestFile,
    comparisonSha256: artifactByFilename(
      persistedManifest,
      "comparison.private.json"
    ).sha256,
    workbookSha256: artifactByFilename(
      persistedManifest,
      "polizzenvergleich.xlsx"
    ).sha256,
  };
}

function normalizedResultMode(result) {
  if (result?.comparisonMode)
    return normalizePolicyComparisonMode(result.comparisonMode, {
      allowDefault: false,
    });
  return POLICY_COMPARISON_MODE.SYMMETRIC_A_B;
}

function expectedCustomerContract() {
  return {
    schemaVersion: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.schemaVersion,
    contractId: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.contractId,
  };
}

function validateResultIdentity({
  result,
  comparisonMode,
  sessionUuid,
  runSignature,
}) {
  if (normalizedResultMode(result) !== comparisonMode)
    throw exportContractError("COMPARISON_EXPORT_RESULT_MODE_MISMATCH");
  if (String(result?.sessionUuid || "") !== sessionUuid)
    throw exportContractError("COMPARISON_EXPORT_RESULT_SESSION_MISMATCH");
  if (String(result?.runSignature || "") !== runSignature)
    throw exportContractError("COMPARISON_EXPORT_RESULT_RUN_MISMATCH");

  if (comparisonMode === POLICY_COMPARISON_MODE.SYMMETRIC_A_B) {
    if (result?.schemaVersion !== CUSTOMER_COMPARISON_RESULT_SCHEMA_VERSION)
      throw exportContractError(
        "COMPARISON_EXPORT_CUSTOMER_RESULT_SCHEMA_INVALID"
      );
    if (
      !sameJson(
        result.customerResultRuleOutcomeContract,
        expectedCustomerContract()
      )
    )
      throw exportContractError(
        "COMPARISON_EXPORT_CUSTOMER_RULE_OUTCOME_CONTRACT_INVALID"
      );
    return expectedCustomerContract();
  }

  if (result?.schemaVersion !== LF_REFERENCE_RESULT_SCHEMA_VERSION)
    throw exportContractError(
      "COMPARISON_EXPORT_REFERENCE_RESULT_SCHEMA_INVALID"
    );
  if (
    Object.prototype.hasOwnProperty.call(
      result,
      "customerResultRuleOutcomeContract"
    )
  )
    throw exportContractError(
      "COMPARISON_EXPORT_REFERENCE_CUSTOMER_CONTRACT_FORBIDDEN"
    );
  return null;
}

function validateInputs({
  comparisonMode,
  sessionUuid,
  runSignature,
  artifactSetManifestFile,
  fsImpl,
}) {
  let normalizedMode;
  try {
    normalizedMode = normalizePolicyComparisonMode(comparisonMode, {
      allowDefault: false,
    });
  } catch (error) {
    throw exportContractError("COMPARISON_EXPORT_MODE_INVALID", error.message);
  }
  const normalizedSessionUuid = String(sessionUuid || "").trim();
  if (
    normalizedSessionUuid !== sessionUuid ||
    !SESSION_UUID_PATTERN.test(normalizedSessionUuid)
  )
    throw exportContractError("COMPARISON_EXPORT_SESSION_UUID_INVALID");
  const normalizedRunSignature = String(runSignature || "").trim();
  if (!SHA256_PATTERN.test(normalizedRunSignature))
    throw exportContractError("COMPARISON_EXPORT_RUN_SIGNATURE_INVALID");

  const artifactSet = readValidatedArtifactSet(artifactSetManifestFile, fsImpl);
  const result = readJson(
    artifactSet.files["comparison.private.json"],
    "COMPARISON_EXPORT_RESULT_JSON_INVALID",
    fsImpl
  );
  const customerResultRuleOutcomeContract = validateResultIdentity({
    result,
    comparisonMode: normalizedMode,
    sessionUuid: normalizedSessionUuid,
    runSignature: normalizedRunSignature,
  });
  return {
    artifactSet,
    comparisonMode: normalizedMode,
    customerResultRuleOutcomeContract,
    result,
    runSignature: normalizedRunSignature,
    sessionUuid: normalizedSessionUuid,
  };
}

function validateArchivedWorkbook(
  archivedWorkbook,
  expected,
  fsImpl,
  { verifyFile = true } = {}
) {
  if (
    !archivedWorkbook ||
    typeof archivedWorkbook !== "object" ||
    Array.isArray(archivedWorkbook) ||
    !path.isAbsolute(String(archivedWorkbook.file || "")) ||
    archivedWorkbook.sha256 !== expected.workbookSha256 ||
    !SHA256_PATTERN.test(String(archivedWorkbook.sha256 || ""))
  )
    throw exportContractError("COMPARISON_EXPORT_ARCHIVED_WORKBOOK_INVALID");

  let archivedMode;
  try {
    archivedMode = normalizePolicyComparisonMode(
      archivedWorkbook.comparisonMode,
      { allowDefault: false }
    );
  } catch (error) {
    throw exportContractError(
      "COMPARISON_EXPORT_ARCHIVED_WORKBOOK_MODE_INVALID",
      error.message
    );
  }
  if (archivedMode !== expected.comparisonMode)
    throw exportContractError(
      "COMPARISON_EXPORT_ARCHIVED_WORKBOOK_MODE_MISMATCH"
    );

  if (!verifyFile) return;

  const archivedFile = assertRegularFile(
    archivedWorkbook.file,
    "archivedWorkbook",
    fsImpl
  );
  if (sha256(fsImpl.readFileSync(archivedFile)) !== expected.workbookSha256)
    throw exportContractError(
      "COMPARISON_EXPORT_ARCHIVED_WORKBOOK_HASH_MISMATCH"
    );
}

function buildComparisonExportContract(
  {
    comparisonMode,
    sessionUuid,
    runSignature,
    artifactSetManifestFile,
    archivedWorkbook,
  },
  { fsImpl = fs } = {}
) {
  const validated = validateInputs({
    comparisonMode,
    sessionUuid,
    runSignature,
    artifactSetManifestFile,
    fsImpl,
  });
  validateArchivedWorkbook(
    archivedWorkbook,
    {
      comparisonMode: validated.comparisonMode,
      workbookSha256: validated.artifactSet.workbookSha256,
    },
    fsImpl
  );

  return {
    schemaVersion: POLICY_COMPARISON_EXPORT_SCHEMA_VERSION,
    contractId: POLICY_COMPARISON_EXPORT_CONTRACT_ID,
    comparisonMode: validated.comparisonMode,
    sessionUuid: validated.sessionUuid,
    runSignature: validated.runSignature,
    artifactSet: {
      schemaVersion: POLICY_COMPARISON_ARTIFACT_SET_SCHEMA_VERSION,
      contractId: POLICY_COMPARISON_ARTIFACT_SET_CONTRACT_ID,
      manifestDigestSha256: validated.artifactSet.manifest.manifestDigestSha256,
      comparisonSha256: validated.artifactSet.comparisonSha256,
      workbookSha256: validated.artifactSet.workbookSha256,
    },
    ...(validated.customerResultRuleOutcomeContract
      ? {
          customerResultRuleOutcomeContract:
            validated.customerResultRuleOutcomeContract,
        }
      : {}),
    archivedWorkbook: { ...archivedWorkbook },
  };
}

function validateComparisonExportContract(
  value,
  {
    expectedComparisonMode,
    expectedSessionUuid,
    expectedRunSignature,
    artifactSetManifestFile,
  },
  { fsImpl = fs, verifyArchivedWorkbookFile = true } = {}
) {
  if (
    comparisonExportContractPolicy(value) !==
    POLICY_COMPARISON_EXPORT_POLICY.CURRENT_SCHEMA_2
  )
    throw exportContractError("COMPARISON_EXPORT_CONTRACT_UNSUPPORTED");

  const validated = validateInputs({
    comparisonMode: expectedComparisonMode,
    sessionUuid: expectedSessionUuid,
    runSignature: expectedRunSignature,
    artifactSetManifestFile,
    fsImpl,
  });
  if (
    value.comparisonMode !== validated.comparisonMode ||
    value.sessionUuid !== validated.sessionUuid ||
    value.runSignature !== validated.runSignature
  )
    throw exportContractError("COMPARISON_EXPORT_RUN_IDENTITY_MISMATCH");

  const expectedArtifactSet = {
    schemaVersion: POLICY_COMPARISON_ARTIFACT_SET_SCHEMA_VERSION,
    contractId: POLICY_COMPARISON_ARTIFACT_SET_CONTRACT_ID,
    manifestDigestSha256: validated.artifactSet.manifest.manifestDigestSha256,
    comparisonSha256: validated.artifactSet.comparisonSha256,
    workbookSha256: validated.artifactSet.workbookSha256,
  };
  if (!sameJson(value.artifactSet, expectedArtifactSet))
    throw exportContractError("COMPARISON_EXPORT_ARTIFACT_BINDING_MISMATCH");

  if (validated.customerResultRuleOutcomeContract) {
    if (
      !sameJson(
        value.customerResultRuleOutcomeContract,
        validated.customerResultRuleOutcomeContract
      )
    )
      throw exportContractError(
        "COMPARISON_EXPORT_CUSTOMER_RULE_OUTCOME_CONTRACT_MISMATCH"
      );
  } else if (
    Object.prototype.hasOwnProperty.call(
      value,
      "customerResultRuleOutcomeContract"
    )
  )
    throw exportContractError(
      "COMPARISON_EXPORT_REFERENCE_CUSTOMER_CONTRACT_FORBIDDEN"
    );

  validateArchivedWorkbook(
    value.archivedWorkbook,
    {
      comparisonMode: validated.comparisonMode,
      workbookSha256: validated.artifactSet.workbookSha256,
    },
    fsImpl,
    { verifyFile: verifyArchivedWorkbookFile }
  );
  const workbookBytes = fsImpl.readFileSync(
    validated.artifactSet.files["polizzenvergleich.xlsx"]
  );
  if (sha256(workbookBytes) !== validated.artifactSet.workbookSha256)
    throw exportContractError("COMPARISON_EXPORT_WORKBOOK_HASH_MISMATCH");
  return {
    schemaVersion: POLICY_COMPARISON_EXPORT_SCHEMA_VERSION,
    contractId: POLICY_COMPARISON_EXPORT_CONTRACT_ID,
    comparisonMode: validated.comparisonMode,
    sessionUuid: validated.sessionUuid,
    runSignature: validated.runSignature,
    artifactSet: expectedArtifactSet,
    customerResultRuleOutcomeContract:
      validated.customerResultRuleOutcomeContract,
    workbookBytes,
  };
}

module.exports = {
  POLICY_COMPARISON_EXPORT_CONTRACT_ID,
  POLICY_COMPARISON_EXPORT_POLICY,
  POLICY_COMPARISON_EXPORT_SCHEMA_VERSION,
  buildComparisonExportContract,
  comparisonExportContractPolicy,
  validateComparisonExportContract,
};
