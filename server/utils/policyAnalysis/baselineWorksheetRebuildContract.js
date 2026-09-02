const {
  buildControlledOccurrenceWorksheet,
} = require("./controlledOccurrenceWorksheet");
const { sha256 } = require("./runIdentity");
const { selectionDigest } = require("./targetRequirementSelection");
const {
  TARGETED_QA_MANIFEST_CONTRACT_ID,
  TARGETED_QA_MANIFEST_SCHEMA_VERSION,
  assertTargetedQaManifest,
} = require("./targetedQaManifestContract");

const BASELINE_WORKSHEET_REBUILD_SCHEMA_VERSION = 1;
const BASELINE_WORKSHEET_REBUILD_CONTRACT_ID =
  "TARGETED_QA_BASELINE_WORKSHEET_REBUILD_V1";

function rebuildError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function rawBytes(value, code) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array))
    throw rebuildError(code);
  return Buffer.from(value);
}

function parseJsonBytes(value, code) {
  try {
    return JSON.parse(rawBytes(value, code).toString("utf8"));
  } catch (error) {
    if (error?.code) throw error;
    throw rebuildError(code);
  }
}

function uniqueMatch(values, predicate, code, detail) {
  const matches = values.filter(predicate);
  if (matches.length !== 1) throw rebuildError(code, detail);
  return matches[0];
}

/**
 * Proves that an existing full baseline worksheet is the deterministic output
 * of the Manifest-V3-bound document artifact and complete canonical catalog.
 * It never selects requirements, mutates a worksheet or writes files.
 * Role: QA boundary. Side effects: none.
 */
function assertBaselineWorksheetRebuild({
  manifest,
  expectedManifestDigestSha256,
  expectedExecution,
  categoryView,
  documentUuid,
  catalogBytes,
  documentArtifactBytes,
  fullWorksheetBytes,
}) {
  if (
    manifest?.schemaVersion !== TARGETED_QA_MANIFEST_SCHEMA_VERSION ||
    manifest?.contractId !== TARGETED_QA_MANIFEST_CONTRACT_ID
  )
    throw rebuildError("BASELINE_WORKSHEET_MANIFEST_V3_REQUIRED");
  if (!/^[a-f0-9]{64}$/u.test(expectedManifestDigestSha256 || ""))
    throw rebuildError("BASELINE_WORKSHEET_EXPECTED_MANIFEST_DIGEST_REQUIRED");
  if (!expectedExecution)
    throw rebuildError("BASELINE_WORKSHEET_EXPECTED_EXECUTION_REQUIRED");
  assertTargetedQaManifest(manifest, {
    expectedManifestDigestSha256,
    expectedExecution,
  });

  const document = uniqueMatch(
    manifest.documentMatrix.documents,
    (candidate) => candidate.uuid === documentUuid,
    "BASELINE_WORKSHEET_DOCUMENT_UUID_INVALID",
    documentUuid
  );
  const artifactRaw = rawBytes(
    documentArtifactBytes,
    "BASELINE_WORKSHEET_DOCUMENT_ARTIFACT_BYTES_REQUIRED"
  );
  if (sha256(artifactRaw) !== document.documentArtifactSha256)
    throw rebuildError("BASELINE_WORKSHEET_DOCUMENT_ARTIFACT_SHA_MISMATCH");
  const artifact = parseJsonBytes(
    artifactRaw,
    "BASELINE_WORKSHEET_DOCUMENT_ARTIFACT_JSON_INVALID"
  );
  if (
    artifact?.schemaVersion !== 1 ||
    artifact.fingerprint !== document.sha256 ||
    artifact.document?.sourceDocumentId !== document.sha256 ||
    artifact.document?.pdfExtraction?.complete !== true ||
    typeof artifact.document?.pageContent !== "string" ||
    !Array.isArray(artifact.document?.pageMap)
  )
    throw rebuildError("BASELINE_WORKSHEET_DOCUMENT_ARTIFACT_IDENTITY_INVALID");

  const target = uniqueMatch(
    manifest.categoryTargets,
    (candidate) => candidate.categoryView === categoryView,
    "BASELINE_WORKSHEET_CATEGORY_INVALID",
    categoryView
  );
  const catalogRaw = rawBytes(
    catalogBytes,
    "BASELINE_WORKSHEET_CATALOG_BYTES_REQUIRED"
  );
  if (sha256(catalogRaw) !== target.catalogSha256)
    throw rebuildError("BASELINE_WORKSHEET_CATALOG_SHA_MISMATCH");
  const catalog = parseJsonBytes(
    catalogRaw,
    "BASELINE_WORKSHEET_CATALOG_JSON_INVALID"
  );
  if (
    catalog.catalogId !== target.catalogId ||
    catalog.categoryView !== categoryView ||
    !Array.isArray(catalog.requirements)
  )
    throw rebuildError("BASELINE_WORKSHEET_CATALOG_IDENTITY_INVALID");

  const worksheetRaw = rawBytes(
    fullWorksheetBytes,
    "BASELINE_WORKSHEET_BYTES_REQUIRED"
  );
  const worksheet = parseJsonBytes(
    worksheetRaw,
    "BASELINE_WORKSHEET_JSON_INVALID"
  );
  if (Object.hasOwn(worksheet || {}, "targetRequirementSelection"))
    throw rebuildError("BASELINE_WORKSHEET_TARGET_MARKER_FORBIDDEN");
  const rebuilt = buildControlledOccurrenceWorksheet({
    document: artifact.document,
    documentFingerprint: artifact.fingerprint,
    catalog,
  });
  if (selectionDigest(worksheet) !== selectionDigest(rebuilt))
    throw rebuildError("BASELINE_WORKSHEET_REBUILD_MISMATCH");

  return Object.freeze({
    schemaVersion: BASELINE_WORKSHEET_REBUILD_SCHEMA_VERSION,
    contractId: BASELINE_WORKSHEET_REBUILD_CONTRACT_ID,
    runKind: "TARGETED_QA_ONLY",
    manifestDigestSha256: manifest.manifestDigestSha256,
    categoryView,
    catalogId: target.catalogId,
    document: Object.freeze({
      uuid: document.uuid,
      side: document.side,
      position: document.position,
      sha256: document.sha256,
      documentArtifactSha256: document.documentArtifactSha256,
    }),
    fullWorksheetSha256: sha256(worksheetRaw),
    semanticWorksheetDigestSha256: selectionDigest(rebuilt),
    requirementCount: rebuilt.requirements.length,
  });
}

module.exports = {
  BASELINE_WORKSHEET_REBUILD_CONTRACT_ID,
  BASELINE_WORKSHEET_REBUILD_SCHEMA_VERSION,
  assertBaselineWorksheetRebuild,
};
