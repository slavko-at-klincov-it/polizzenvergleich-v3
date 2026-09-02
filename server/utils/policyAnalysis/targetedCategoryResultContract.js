const {
  extractCategoryDefinitions,
  extractRequiredNotice,
  validateCategoryOutput,
} = require("../../scripts/qa/categoryOutputContract.cjs");
const { materializeCandidateTriage } = require("./candidateTriageContract");
const {
  buildCategoryTableRows,
  renderCategoryTableMarkdown,
} = require("./categoryTableRenderer");
const {
  buildDeterministicPreparedEvidenceJudgement,
  buildPreparedEvidenceTargets,
  materializePreparedEvidence,
  parseAndValidatePreparedEvidenceResponse,
} = require("./preparedEvidenceContract");
const {
  materializeRequestedFieldEvidence,
} = require("./requestedFieldEvidenceContract");
const { sha256 } = require("./runIdentity");
const { selectionDigest } = require("./targetRequirementSelection");
const {
  assertTargetedCategoryMaterializationInputs,
} = require("./targetedCategoryMaterializationContract");
const {
  rebuildTargetedSelectedSources,
} = require("./targetedSelectedSourcesContract");

const TARGETED_CATEGORY_RESULT_SCHEMA_VERSION = 1;
const TARGETED_CATEGORY_RESULT_CONTRACT_ID = "TARGETED_QA_CATEGORY_RESULT_V1";
const MODEL_DECISION_OWNERS = new Set([
  "MODEL",
  "MODEL_EFFECT_SERVER_POSITIVE_SCOPE_UNION",
  "MODEL_SELECTION_SERVER_EFFECT_RULE",
]);

function resultError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function parseJsonBytes(value, code) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array))
    throw resultError(code);
  try {
    return JSON.parse(Buffer.from(value).toString("utf8"));
  } catch {
    throw resultError(code);
  }
}

function assertParity(left, right, code) {
  if (selectionDigest(left) !== selectionDigest(right)) throw resultError(code);
}

function sourceDocumentsFromArtifact(artifact) {
  const content = String(artifact?.document?.pageContent || "");
  return (artifact?.document?.pageMap || []).map((page) => ({
    pageNumber: page.pageNumber,
    text: content.slice(page.start, page.end),
  }));
}

function rebuildMaterializedTriage({ worksheet, materializedTriage }) {
  if (!Array.isArray(materializedTriage))
    throw resultError("TARGETED_RESULT_TRIAGE_INVALID");
  const rebuilt = materializeCandidateTriage({
    worksheet,
    validatedTriage: {
      judgements: materializedTriage.map(({ candidateId, binding }) => ({
        candidateId,
        binding,
      })),
    },
  });
  assertParity(
    materializedTriage,
    rebuilt,
    "TARGETED_RESULT_TRIAGE_REBUILD_MISMATCH"
  );
  return rebuilt;
}

function semanticJudgement(judgement) {
  return {
    targetId: judgement.targetId,
    requirementId: judgement.requirementId,
    componentId: judgement.componentId,
    selectedCandidateIds: judgement.selectedCandidateIds,
    unresolvedCandidateIds: judgement.unresolvedCandidateIds,
    evidencePresence: judgement.evidencePresence,
    coverageEffect: judgement.coverageEffect,
    conflictState: judgement.conflictState,
    selectedScopePicture: judgement.selectedScopePicture,
    documentApplicability: judgement.documentApplicability,
  };
}

function assertJudgements({ targets, materializedEvidence }) {
  if (!Array.isArray(materializedEvidence?.judgements))
    throw resultError("TARGETED_RESULT_JUDGEMENTS_INVALID");
  const targetById = new Map(
    targets.map((target) => [target.targetId, target])
  );
  if (targetById.size !== targets.length)
    throw resultError("TARGETED_RESULT_TARGET_ID_DUPLICATE");
  const observedTargetIds = new Set();
  for (const judgement of materializedEvidence.judgements) {
    const target = targetById.get(judgement?.targetId);
    if (!target)
      throw resultError(
        "TARGETED_RESULT_JUDGEMENT_TARGET_UNKNOWN",
        String(judgement?.targetId || "target")
      );
    if (observedTargetIds.has(target.targetId))
      throw resultError(
        "TARGETED_RESULT_JUDGEMENT_TARGET_DUPLICATE",
        target.targetId
      );
    observedTargetIds.add(target.targetId);
    if (
      judgement.requirementId !== target.requirementId ||
      judgement.componentId !== target.componentId
    )
      throw resultError(
        "TARGETED_RESULT_JUDGEMENT_OWNERSHIP_MISMATCH",
        target.targetId
      );

    if (target.candidates.length === 0) continue;
    const deterministic = buildDeterministicPreparedEvidenceJudgement(target);
    if (deterministic) {
      assertParity(
        judgement,
        deterministic,
        "TARGETED_RESULT_DETERMINISTIC_JUDGEMENT_MISMATCH"
      );
      continue;
    }
    if (
      !Array.isArray(judgement.selectedCandidateIds) ||
      !Array.isArray(judgement.candidateIdCorrections) ||
      !MODEL_DECISION_OWNERS.has(judgement.decisionOwner)
    )
      throw resultError(
        "TARGETED_RESULT_MODEL_JUDGEMENT_INVALID",
        target.targetId
      );
    const validated = parseAndValidatePreparedEvidenceResponse({
      responseText: JSON.stringify({
        schemaVersion: 1,
        componentId: judgement.componentId,
        selectedCandidateIds: judgement.selectedCandidateIds,
        coverageEffect: judgement.coverageEffect,
        conflictState: judgement.conflictState,
      }),
      target,
      allowUniqueCandidateIdRepair: false,
    });
    assertParity(
      semanticJudgement(judgement),
      semanticJudgement(validated),
      "TARGETED_RESULT_MODEL_JUDGEMENT_MISMATCH"
    );
  }
  const missing = targets
    .map(({ targetId }) => targetId)
    .filter((targetId) => !observedTargetIds.has(targetId));
  if (missing.length)
    throw resultError(
      "TARGETED_RESULT_JUDGEMENT_TARGET_MISSING",
      missing.join(",")
    );
}

function rebuildEvidence({ worksheet, targets, materializedEvidence }) {
  assertJudgements({ targets, materializedEvidence });
  const rebuilt = materializePreparedEvidence({
    worksheet,
    targets,
    judgements: materializedEvidence.judgements,
  });
  assertParity(
    materializedEvidence,
    rebuilt,
    "TARGETED_RESULT_EVIDENCE_REBUILD_MISMATCH"
  );
  return rebuilt;
}

function projectDefinitions({ prompt, requirementIds, categoryView }) {
  const definitions = extractCategoryDefinitions(prompt);
  const definitionsById = new Map();
  for (const definition of definitions) {
    if (definitionsById.has(definition.id))
      throw resultError(
        "TARGETED_RESULT_PROMPT_DEFINITION_DUPLICATE",
        definition.id
      );
    definitionsById.set(definition.id, definition);
  }
  const projected = requirementIds.map((requirementId) => {
    const definition = definitionsById.get(requirementId);
    if (!definition || !requirementId.startsWith(`${categoryView}-`))
      throw resultError(
        "TARGETED_RESULT_PROMPT_DEFINITION_MISSING",
        requirementId
      );
    return definition;
  });
  if (new Set(projected.map(({ id }) => id)).size !== requirementIds.length)
    throw resultError("TARGETED_RESULT_PROMPT_PROJECTION_INVALID");
  return projected;
}

function selectedEffectTriage({ materializedTriage, materializedEvidence }) {
  const selectedIds = new Set(
    materializedEvidence.judgements.flatMap(
      ({ selectedCandidateIds }) => selectedCandidateIds || []
    )
  );
  return materializedTriage.filter(({ candidateId }) =>
    selectedIds.has(candidateId)
  );
}

/**
 * Produces one private targeted-QA category result from an already bound input
 * chain. It never writes files and cannot create or replace customer output.
 * Role: QA materialization boundary. Side effects: none.
 */
function materializeTargetedCategoryResult(input) {
  const inputContract = assertTargetedCategoryMaterializationInputs(input);

  const worksheet = parseJsonBytes(
    input.worksheetBytes,
    "TARGETED_RESULT_WORKSHEET_JSON_INVALID"
  );
  const materializedTriage = parseJsonBytes(
    input.materializedTriageBytes,
    "TARGETED_RESULT_TRIAGE_JSON_INVALID"
  );
  const materializedEvidence = parseJsonBytes(
    input.materializedEvidenceBytes,
    "TARGETED_RESULT_EVIDENCE_JSON_INVALID"
  );
  const persistedSources = parseJsonBytes(
    input.selectedSourcesBytes,
    "TARGETED_RESULT_SOURCES_JSON_INVALID"
  );
  const documentArtifact = parseJsonBytes(
    input.documentArtifactBytes,
    "TARGETED_RESULT_DOCUMENT_ARTIFACT_JSON_INVALID"
  );
  const prompt = Buffer.from(input.categoryPromptBytes).toString("utf8");

  if (
    worksheet.requirements.map(({ id }) => id).join("\n") !==
    inputContract.requirementIds.join("\n")
  )
    throw resultError("TARGETED_RESULT_WORKSHEET_REQUIREMENT_ORDER_MISMATCH");
  const rebuiltTriage = rebuildMaterializedTriage({
    worksheet,
    materializedTriage,
  });
  const targets = buildPreparedEvidenceTargets({
    worksheet,
    documentStatus: inputContract.document.documentStatus,
    candidateTriage: rebuiltTriage,
    expectedTargetSelectionDigestSha256:
      inputContract.targetSelectionDigestSha256,
  });
  const rebuiltEvidence = rebuildEvidence({
    worksheet,
    targets,
    materializedEvidence,
  });
  const rebuiltSources = rebuildTargetedSelectedSources({
    targets,
    materializedEvidence: rebuiltEvidence,
    documentArtifact,
  });
  assertParity(
    persistedSources,
    rebuiltSources,
    "TARGETED_RESULT_SELECTED_SOURCES_MISMATCH"
  );

  const definitions = projectDefinitions({
    prompt,
    requirementIds: inputContract.requirementIds,
    categoryView: inputContract.categoryView,
  });
  const requiredNotice = extractRequiredNotice(prompt);
  const requestedFields = materializeRequestedFieldEvidence({
    worksheet,
    materializedCandidates: selectedEffectTriage({
      materializedTriage: rebuiltTriage,
      materializedEvidence: rebuiltEvidence,
    }),
  });
  const renderOptions = {
    definitions,
    worksheet,
    materializedEvidence: rebuiltEvidence,
    requestedFieldMaterialization: requestedFields,
    documentStatus: inputContract.document.documentStatus,
  };
  const rows = buildCategoryTableRows(renderOptions);
  const answer = `${renderCategoryTableMarkdown(renderOptions)}\n\n${requiredNotice}`;
  if (
    rows.length !== inputContract.requirementIds.length ||
    rows.some(
      (row, index) => row.categoryId !== inputContract.requirementIds[index]
    )
  )
    throw resultError("TARGETED_RESULT_ROW_ORDER_OR_COUNT_MISMATCH");
  const tableContract = validateCategoryOutput({
    answer,
    categoryDefinitions: definitions,
    requiredNotice,
    sourceDocuments: sourceDocumentsFromArtifact(documentArtifact),
  });
  if (!tableContract.pass)
    throw resultError(
      "TARGETED_RESULT_TABLE_CONTRACT_FAILED",
      tableContract.reasons.join(",")
    );

  const report = Object.freeze({
    schemaVersion: TARGETED_CATEGORY_RESULT_SCHEMA_VERSION,
    contractId: TARGETED_CATEGORY_RESULT_CONTRACT_ID,
    runKind: "TARGETED_QA_ONLY",
    status: "TECHNICAL_PASS_REVIEW_REQUIRED",
    customerMaterializationAllowed: false,
    publishable: false,
    deployable: false,
    manifestDigestSha256: inputContract.manifestDigestSha256,
    categoryView: inputContract.categoryView,
    document: inputContract.document,
    requirementIds: Object.freeze([...inputContract.requirementIds]),
    rowCount: rows.length,
    selectedSourceCount: rebuiltSources.length,
    tableContract,
    inputArtifactHashes: inputContract.artifactHashes,
    outputSemanticDigests: Object.freeze({
      rowsSha256: selectionDigest(rows),
      requestedFieldsSha256: selectionDigest(requestedFields),
      answerSha256: sha256(Buffer.from(answer)),
    }),
    qualityGate: Object.freeze({
      pass: false,
      status: "REVIEW_REQUIRED",
      reason: "TARGETED_QA_ONLY",
    }),
  });
  return Object.freeze({
    rows,
    requestedFields,
    answer,
    report,
  });
}

module.exports = {
  TARGETED_CATEGORY_RESULT_CONTRACT_ID,
  TARGETED_CATEGORY_RESULT_SCHEMA_VERSION,
  materializeTargetedCategoryResult,
};
