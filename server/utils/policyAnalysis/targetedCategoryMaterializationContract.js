const {
  buildControlledOccurrenceWorksheet,
} = require("./controlledOccurrenceWorksheet");
const { sha256 } = require("./runIdentity");
const {
  selectTargetRequirements,
  selectionDigest,
} = require("./targetRequirementSelection");
const {
  TARGETED_QA_MANIFEST_CONTRACT_ID,
  TARGETED_QA_MANIFEST_SCHEMA_VERSION,
  assertTargetedQaManifest,
} = require("./targetedQaManifestContract");

const TARGETED_CATEGORY_INPUT_SCHEMA_VERSION = 1;
const TARGETED_CATEGORY_INPUT_CONTRACT_ID = "TARGETED_QA_CATEGORY_INPUT_V1";
const ACCEPTED_REPORT_STATUSES = new Set([
  "PASS",
  "TECHNICAL_PASS_REVIEW_REQUIRED",
]);

function contractError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function rawBytes(value, code) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array))
    throw contractError(code);
  return Buffer.from(value);
}

function parseJsonBytes(value, code) {
  try {
    return JSON.parse(rawBytes(value, code).toString("utf8"));
  } catch (error) {
    if (error?.code) throw error;
    throw contractError(code);
  }
}

function assertSemanticEquality(left, right, code) {
  if (selectionDigest(left) !== selectionDigest(right))
    throw contractError(code);
}

function selectedTarget(manifest, categoryView) {
  const matches = manifest.categoryTargets.filter(
    (target) => target.categoryView === categoryView
  );
  if (matches.length !== 1)
    throw contractError("TARGETED_CATEGORY_TARGET_INVALID", categoryView);
  return matches[0];
}

function selectedDocument(manifest, artifact) {
  if (
    artifact?.schemaVersion !== 1 ||
    typeof artifact.fingerprint !== "string" ||
    artifact.document?.sourceDocumentId !== artifact.fingerprint ||
    artifact.document?.pdfExtraction?.complete !== true ||
    !Array.isArray(artifact.document?.pageMap) ||
    typeof artifact.document?.pageContent !== "string"
  )
    throw contractError("TARGETED_CATEGORY_DOCUMENT_ARTIFACT_INVALID");
  const matches = manifest.documentMatrix.documents.filter(
    (document) => document.sha256 === artifact.fingerprint
  );
  if (matches.length !== 1)
    throw contractError(
      "TARGETED_CATEGORY_DOCUMENT_NOT_IN_MANIFEST",
      artifact.fingerprint
    );
  return matches[0];
}

function assertCommonReport({
  report,
  kind,
  execution,
  expectedPromptSha256,
  worksheetSha256,
  selectionDigestSha256,
}) {
  if (!ACCEPTED_REPORT_STATUSES.has(report?.status))
    throw contractError(`TARGETED_CATEGORY_${kind}_STATUS_INVALID`);
  if (
    report.implementation?.releaseId !== execution.releaseId ||
    report.implementation?.nodeVersion !== execution.nodeVersion ||
    report.model?.id !== execution.model ||
    report.model?.declaredTokenLimit !== execution.modelTokenLimit
  )
    throw contractError(`TARGETED_CATEGORY_${kind}_EXECUTION_MISMATCH`);
  if (
    report.contracts?.worksheetSha256 !== worksheetSha256 ||
    report.contracts?.systemPromptSha256 !== expectedPromptSha256 ||
    report.contracts?.expectedTargetSelectionDigestSha256 !==
      selectionDigestSha256 ||
    report.contracts?.targetSelectionDigestSha256 !== selectionDigestSha256
  )
    throw contractError(`TARGETED_CATEGORY_${kind}_CONTRACT_MISMATCH`);
}

/**
 * Verifies the immutable input boundary for a later targeted materializer.
 * It writes nothing and deliberately does not build rows or customer output.
 * Role: QA boundary. Side effects: none.
 */
function assertTargetedCategoryMaterializationInputs({
  manifest,
  expectedManifestDigestSha256,
  expectedExecution,
  categoryView,
  catalogBytes,
  categoryPromptBytes,
  triagePromptBytes,
  effectsPromptBytes,
  documentArtifactBytes,
  worksheetBytes,
  triageReportBytes,
  materializedTriageBytes,
  effectsReportBytes,
  materializedEvidenceBytes,
  selectedSourcesBytes,
}) {
  if (
    manifest?.schemaVersion !== TARGETED_QA_MANIFEST_SCHEMA_VERSION ||
    manifest?.contractId !== TARGETED_QA_MANIFEST_CONTRACT_ID
  )
    throw contractError("TARGETED_CATEGORY_MANIFEST_V2_REQUIRED");
  if (!expectedExecution)
    throw contractError("TARGETED_CATEGORY_EXPECTED_EXECUTION_REQUIRED");
  assertTargetedQaManifest(manifest, {
    expectedManifestDigestSha256,
    expectedExecution,
  });

  const target = selectedTarget(manifest, categoryView);
  const catalogRaw = rawBytes(
    catalogBytes,
    "TARGETED_CATEGORY_CATALOG_BYTES_REQUIRED"
  );
  if (sha256(catalogRaw) !== target.catalogSha256)
    throw contractError("TARGETED_CATEGORY_CATALOG_SHA_MISMATCH");
  const catalog = parseJsonBytes(
    catalogRaw,
    "TARGETED_CATEGORY_CATALOG_JSON_INVALID"
  );
  const selected = selectTargetRequirements({
    catalog,
    requirementIds: target.requirementIds,
  });
  assertSemanticEquality(
    selected.selection,
    target.targetRequirementSelection,
    "TARGETED_CATEGORY_SELECTION_MISMATCH"
  );

  const categoryPromptRaw = rawBytes(
    categoryPromptBytes,
    "TARGETED_CATEGORY_PROMPT_BYTES_REQUIRED"
  );
  if (
    sha256(categoryPromptRaw) !==
    manifest.execution.promptSha256ByCategory[categoryView].category
  )
    throw contractError("TARGETED_CATEGORY_PROMPT_SHA_MISMATCH");
  const triagePromptRaw = rawBytes(
    triagePromptBytes,
    "TARGETED_CATEGORY_TRIAGE_PROMPT_BYTES_REQUIRED"
  );
  if (
    sha256(triagePromptRaw) !==
    manifest.execution.promptSha256ByCategory[categoryView].triage
  )
    throw contractError("TARGETED_CATEGORY_TRIAGE_PROMPT_SHA_MISMATCH");
  const effectsPromptRaw = rawBytes(
    effectsPromptBytes,
    "TARGETED_CATEGORY_EFFECTS_PROMPT_BYTES_REQUIRED"
  );
  if (
    sha256(effectsPromptRaw) !==
    manifest.execution.promptSha256ByCategory[categoryView].effects
  )
    throw contractError("TARGETED_CATEGORY_EFFECTS_PROMPT_SHA_MISMATCH");

  const documentArtifact = parseJsonBytes(
    documentArtifactBytes,
    "TARGETED_CATEGORY_DOCUMENT_ARTIFACT_JSON_INVALID"
  );
  const document = selectedDocument(manifest, documentArtifact);
  const rebuiltWorksheet = {
    ...buildControlledOccurrenceWorksheet({
      document: documentArtifact.document,
      documentFingerprint: documentArtifact.fingerprint,
      catalog: selected.catalog,
    }),
    targetRequirementSelection: selected.selection,
  };
  const worksheetRaw = rawBytes(
    worksheetBytes,
    "TARGETED_CATEGORY_WORKSHEET_BYTES_REQUIRED"
  );
  const worksheet = parseJsonBytes(
    worksheetRaw,
    "TARGETED_CATEGORY_WORKSHEET_JSON_INVALID"
  );
  assertSemanticEquality(
    worksheet,
    rebuiltWorksheet,
    "TARGETED_CATEGORY_WORKSHEET_REBUILD_MISMATCH"
  );

  const triageRaw = rawBytes(
    materializedTriageBytes,
    "TARGETED_CATEGORY_TRIAGE_BYTES_REQUIRED"
  );
  const effectsRaw = rawBytes(
    materializedEvidenceBytes,
    "TARGETED_CATEGORY_EFFECTS_BYTES_REQUIRED"
  );
  const sourcesRaw = rawBytes(
    selectedSourcesBytes,
    "TARGETED_CATEGORY_SOURCES_BYTES_REQUIRED"
  );
  const worksheetSha256 = sha256(worksheetRaw);
  const materializedTriageSha256 = sha256(triageRaw);
  const materializedEvidenceSha256 = sha256(effectsRaw);
  const selectedSourcesSha256 = sha256(sourcesRaw);
  const selectionDigestSha256 = target.expectedTargetSelectionDigestSha256;

  const triageReport = parseJsonBytes(
    triageReportBytes,
    "TARGETED_CATEGORY_TRIAGE_REPORT_JSON_INVALID"
  );
  assertCommonReport({
    report: triageReport,
    kind: "TRIAGE",
    execution: manifest.execution,
    expectedPromptSha256:
      manifest.execution.promptSha256ByCategory[categoryView].triage,
    worksheetSha256,
    selectionDigestSha256,
  });
  if (
    triageReport.validation?.formalPass !== true ||
    triageReport.controls?.pass !== true ||
    triageReport.completion?.responseModelComplete !== true ||
    triageReport.contracts?.hybridSystemPromptSha256 !== null ||
    triageReport.contracts?.materializedTriageSha256 !==
      materializedTriageSha256
  )
    throw contractError("TARGETED_CATEGORY_TRIAGE_CONTRACT_MISMATCH");

  const effectsReport = parseJsonBytes(
    effectsReportBytes,
    "TARGETED_CATEGORY_EFFECTS_REPORT_JSON_INVALID"
  );
  assertCommonReport({
    report: effectsReport,
    kind: "EFFECTS",
    execution: manifest.execution,
    expectedPromptSha256:
      manifest.execution.promptSha256ByCategory[categoryView].effects,
    worksheetSha256,
    selectionDigestSha256,
  });
  if (
    effectsReport.validation?.pass !== true ||
    effectsReport.controls?.pass !== true ||
    effectsReport.completion?.responseModelComplete !== true ||
    effectsReport.contracts?.triageSha256 !== materializedTriageSha256 ||
    effectsReport.contracts?.materializedEvidenceSha256 !==
      materializedEvidenceSha256 ||
    effectsReport.contracts?.selectedSourcesSha256 !== selectedSourcesSha256 ||
    effectsReport.contracts?.documentStatus !== document.documentStatus
  )
    throw contractError("TARGETED_CATEGORY_EFFECTS_CONTRACT_MISMATCH");

  return Object.freeze({
    schemaVersion: TARGETED_CATEGORY_INPUT_SCHEMA_VERSION,
    contractId: TARGETED_CATEGORY_INPUT_CONTRACT_ID,
    runKind: "TARGETED_QA_ONLY",
    manifestDigestSha256: manifest.manifestDigestSha256,
    categoryView,
    document: Object.freeze({
      uuid: document.uuid,
      sha256: document.sha256,
      documentStatus: document.documentStatus,
    }),
    requirementIds: Object.freeze([...target.requirementIds]),
    targetSelectionDigestSha256: selectionDigestSha256,
    artifactHashes: Object.freeze({
      worksheetSha256,
      materializedTriageSha256,
      materializedEvidenceSha256,
      selectedSourcesSha256,
    }),
  });
}

module.exports = {
  TARGETED_CATEGORY_INPUT_CONTRACT_ID,
  TARGETED_CATEGORY_INPUT_SCHEMA_VERSION,
  assertTargetedCategoryMaterializationInputs,
};
