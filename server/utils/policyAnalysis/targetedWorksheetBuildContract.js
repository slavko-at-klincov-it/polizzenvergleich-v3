const {
  assertBaselineWorksheetRebuild,
} = require("./baselineWorksheetRebuildContract");
const {
  buildControlledOccurrenceWorksheet,
} = require("./controlledOccurrenceWorksheet");
const { sha256 } = require("./runIdentity");
const {
  assertTargetRequirementSelection,
  selectTargetRequirements,
  selectionDigest,
} = require("./targetRequirementSelection");

const TARGETED_WORKSHEET_BUILD_SCHEMA_VERSION = 1;
const TARGETED_WORKSHEET_BUILD_CONTRACT_ID = "TARGETED_QA_WORKSHEET_BUILD_V1";

function buildError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function rawBytes(value, code) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array))
    throw buildError(code);
  return Buffer.from(value);
}

function parseJsonBytes(value, code) {
  try {
    return JSON.parse(rawBytes(value, code).toString("utf8"));
  } catch (error) {
    if (error?.code) throw error;
    throw buildError(code);
  }
}

function categoryTarget(manifest, categoryView) {
  const matches = manifest.categoryTargets.filter(
    (target) => target.categoryView === categoryView
  );
  if (matches.length !== 1)
    throw buildError(
      "TARGETED_WORKSHEET_CATEGORY_TARGET_INVALID",
      categoryView
    );
  return matches[0];
}

function assertComponentParity(worksheet, selectedCatalog) {
  if (
    worksheet.requirements.length !== selectedCatalog.requirements.length ||
    selectedCatalog.requirements.some((requirement, requirementIndex) => {
      const observed = worksheet.requirements[requirementIndex];
      return (
        observed?.id !== requirement.id ||
        !Array.isArray(observed.components) ||
        observed.components.length !== requirement.components.length ||
        requirement.components.some(
          (component, componentIndex) =>
            observed.components[componentIndex]?.id !== component.id
        )
      );
    })
  )
    throw buildError("TARGETED_WORKSHEET_COMPONENT_PARITY_INVALID");
}

/**
 * Builds a manifest-selected worksheet only after the full baseline worksheet
 * has been deterministically reproduced. No LLM input or filesystem state is
 * read or written here. Role: QA transform. Side effects: none.
 */
function buildTargetedWorksheet(input) {
  const baselineProvenance = assertBaselineWorksheetRebuild(input);
  const {
    manifest,
    categoryView,
    documentUuid,
    catalogBytes,
    documentArtifactBytes,
  } = input;
  const target = categoryTarget(manifest, categoryView);
  const catalogRaw = rawBytes(
    catalogBytes,
    "TARGETED_WORKSHEET_CATALOG_BYTES_REQUIRED"
  );
  if (sha256(catalogRaw) !== target.catalogSha256)
    throw buildError("TARGETED_WORKSHEET_CATALOG_SHA_MISMATCH");
  const catalog = parseJsonBytes(
    catalogRaw,
    "TARGETED_WORKSHEET_CATALOG_JSON_INVALID"
  );
  const selected = selectTargetRequirements({
    catalog,
    requirementIds: target.requirementIds,
  });
  if (
    selectionDigest(selected.selection) !==
      selectionDigest(target.targetRequirementSelection) ||
    JSON.stringify(selected.selection.requirementIds) !==
      JSON.stringify(target.requirementIds) ||
    selected.selection.selectionDigestSha256 !==
      target.expectedTargetSelectionDigestSha256
  )
    throw buildError("TARGETED_WORKSHEET_SELECTION_MISMATCH");

  const artifact = parseJsonBytes(
    documentArtifactBytes,
    "TARGETED_WORKSHEET_DOCUMENT_ARTIFACT_JSON_INVALID"
  );
  const worksheet = {
    ...buildControlledOccurrenceWorksheet({
      document: artifact.document,
      documentFingerprint: artifact.fingerprint,
      catalog: selected.catalog,
    }),
    targetRequirementSelection: selected.selection,
  };
  assertTargetRequirementSelection(worksheet, {
    expectedSelectionDigestSha256: target.expectedTargetSelectionDigestSha256,
  });
  if (
    worksheet.requirements.some(
      (requirement, index) => requirement.id !== target.requirementIds[index]
    )
  )
    throw buildError("TARGETED_WORKSHEET_REQUIREMENT_ORDER_INVALID");
  assertComponentParity(worksheet, selected.catalog);

  const componentCount = worksheet.requirements.reduce(
    (sum, requirement) => sum + requirement.components.length,
    0
  );
  const provenance = Object.freeze({
    schemaVersion: TARGETED_WORKSHEET_BUILD_SCHEMA_VERSION,
    contractId: TARGETED_WORKSHEET_BUILD_CONTRACT_ID,
    runKind: "TARGETED_QA_ONLY",
    manifestDigestSha256: manifest.manifestDigestSha256,
    baselineSemanticWorksheetDigestSha256:
      baselineProvenance.semanticWorksheetDigestSha256,
    categoryView,
    documentUuid,
    targetSelectionDigestSha256: selected.selection.selectionDigestSha256,
    requirementCount: worksheet.requirements.length,
    componentCount,
  });
  return { worksheet, provenance };
}

module.exports = {
  TARGETED_WORKSHEET_BUILD_CONTRACT_ID,
  TARGETED_WORKSHEET_BUILD_SCHEMA_VERSION,
  buildTargetedWorksheet,
};
