const crypto = require("crypto");
const { A_SOURCE_UNIT_PLAN_CONTRACT_ID } = require("./aDrivenSourceUnitPlan");

// Builds bounded, ID-complete classification/atomization requests for Qwen.
// The prompt contains only server-planned source units. Model output remains
// untrusted until aDrivenSemanticManifest validates every ID and source block.
const A_CLASSIFICATION_CONTRACT_ID = "LF_A_BOUNDED_CLASSIFICATION_V2";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function contractError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function buildADrivenClassificationBatches(
  plan,
  { maximumUnits = 6, maximumCharacters = 12_000 } = {}
) {
  if (
    plan?.contractId !== A_SOURCE_UNIT_PLAN_CONTRACT_ID ||
    !Number.isInteger(maximumUnits) ||
    maximumUnits < 1 ||
    !Number.isInteger(maximumCharacters) ||
    maximumCharacters < 1_000
  )
    throw contractError("LF_A_CLASSIFICATION_PLAN_INVALID");
  const units = plan.units.filter(
    ({ initialDisposition }) => initialDisposition === "PENDING_CLASSIFICATION"
  );
  const batches = [];
  let current = [];
  let currentCharacters = 0;
  const flush = () => {
    if (!current.length) return;
    const payload = current.map((unit) => {
      const contextBlocks = unit.governingContext?.blocks || [];
      const evidenceBlocks = [...contextBlocks, ...unit.source.blocks];
      return {
        unitId: unit.unitId,
        unitKind: unit.unitKind,
        structurePath: unit.structurePath,
        ownedSourceBlockIds: unit.source.blockIds,
        evidenceSourceBlockIds: evidenceBlocks.map(({ blockId }) => blockId),
        sourceBlocks: unit.source.blocks.map(
          ({ blockId, physicalPageNumber, exactText, exactTextSha256 }) => ({
            blockId,
            physicalPageNumber,
            exactText,
            exactTextSha256,
          })
        ),
        governingContext: unit.governingContext
          ? {
              relationType: unit.governingContext.relationType,
              unitIds: unit.governingContext.unitIds,
              sourceBlocks: contextBlocks.map(
                ({
                  blockId,
                  physicalPageNumber,
                  exactText,
                  exactTextSha256,
                }) => ({
                  blockId,
                  physicalPageNumber,
                  exactText,
                  exactTextSha256,
                })
              ),
            }
          : null,
        physicalPages: unit.source.physicalPages,
        originalText: unit.source.combinedText,
      };
    });
    const batchIndex = batches.length;
    batches.push({
      batchId: `AUB-${sha256(
        `${A_CLASSIFICATION_CONTRACT_ID}:${plan.planSha256}:${batchIndex}:${payload
          .map(({ unitId }) => unitId)
          .join(",")}`
      ).slice(0, 24)}`,
      batchIndex,
      expectedUnitIds: payload.map(({ unitId }) => unitId),
      units: payload,
      responseContract: {
        exactTopLevel: "JSON_ARRAY",
        exactlyOneRecordPerExpectedUnitId: true,
        unknownIdsAllowed: false,
        modelMayCreateSourceIds: false,
        allowedTerminalClasses: [
          "OPERATIVE_COVERAGE_STATEMENT",
          "EXCLUSION",
          "INSURED_OBJECT",
          "PERIL_OR_DAMAGE",
          "DEFINITION",
          "CONDITION",
          "COST",
          "LIMIT",
          "DEDUCTIBLE",
          "OBLIGATION",
          "DURATION",
          "VARIANT",
          "DOCUMENT_PRECEDENCE_OR_REPLACEMENT",
          "STRUCTURE",
          "METADATA",
          "DUPLICATE",
          "UNRESOLVED",
        ],
      },
    });
    current = [];
    currentCharacters = 0;
  };
  for (const unit of units) {
    const characters =
      unit.source.combinedText.length +
      (unit.governingContext?.combinedText.length || 0);
    if (characters > maximumCharacters)
      throw contractError("LF_A_CLASSIFICATION_UNIT_TOO_LARGE");
    if (
      current.length >= maximumUnits ||
      currentCharacters + characters > maximumCharacters
    )
      flush();
    current.push(unit);
    currentCharacters += characters;
  }
  flush();
  return {
    schemaVersion: 1,
    contractId: A_CLASSIFICATION_CONTRACT_ID,
    sourceUnitPlanSha256: plan.planSha256,
    batches,
    summary: {
      expectedUnits: units.length,
      batches: batches.length,
      maximumUnits,
      maximumCharacters,
    },
  };
}

module.exports = {
  A_CLASSIFICATION_CONTRACT_ID,
  buildADrivenClassificationBatches,
};
