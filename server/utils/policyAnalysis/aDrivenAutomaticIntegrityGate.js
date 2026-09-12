const crypto = require("crypto");
const {
  A_CLASSIFICATION_CONTRACT_ID,
  buildADrivenClassificationBatches,
} = require("./aDrivenClassificationContract");
const {
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
  buildADrivenSemanticManifest,
  validateADrivenSemanticManifest,
} = require("./aDrivenSemanticManifest");
const {
  A_DRIVEN_RUN_CONTRACT_ID,
  A_SOURCE_UNIT_PLAN_CONTRACT_ID,
  stableStringify,
} = require("./aDrivenSourceUnitPlan");

// This is the runtime gate for a private A-driven B shadow pilot. It proves
// only automatic provenance and execution integrity for the concrete A input.
// Legacy LF row counts, human reviewers and signatures are intentionally not
// part of this contract.
const AUTOMATED_A_INTEGRITY_CONTRACT_ID =
  "LF_A_AUTOMATED_B_SHADOW_READINESS_V1";
const AUTOMATED_B_SHADOW_SCOPE =
  "LF_REFERENCE_A_DRIVEN_AUTOMATED_B_RETRIEVAL_SHADOW_PILOT";
const STRONG_OPERATIVE_TEXT =
  /\b(?:versichert\s+sind|mitversichert|nicht\s+versichert|ausgeschlossen|versicherungsschutz\s+(?:besteht|gilt)|gilt\s+(?:als|für|bei)|beträgt|bis\s+zu|unter\s+der\s+voraussetzung|hat\s+zu|muss|ist\s+verpflichtet|ersetzt|innerhalb\s+von)\b|\b\d+(?:[.,]\d+)?\s*(?:%|EUR|Euro|Tage?|Monate?|Jahre?)\b/iu;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function gateError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function validSha(value) {
  return /^[a-f0-9]{64}$/u.test(String(value || ""));
}

function validateInputManifestBinding({ inputManifest, dynamicManifest }) {
  if (!Array.isArray(inputManifest?.documents))
    throw gateError("LF_A_AUTOMATED_GATE_INPUT_MANIFEST_INVALID");
  const aDocuments = inputManifest.documents
    .filter(({ side }) => side === "A")
    .sort((left, right) => left.position - right.position);
  const bDocuments = inputManifest.documents
    .filter(({ side }) => side === "B")
    .sort((left, right) => left.position - right.position);
  const manifestDocuments = [...(dynamicManifest?.documents || [])].sort(
    (left, right) => left.documentPosition - right.documentPosition
  );
  if (
    aDocuments.length < 1 ||
    bDocuments.length < 1 ||
    aDocuments.length !== manifestDocuments.length ||
    inputManifest.documents.length !== aDocuments.length + bDocuments.length
  )
    throw gateError("LF_A_AUTOMATED_GATE_DOCUMENT_SCOPE_INVALID");
  for (let index = 0; index < aDocuments.length; index += 1) {
    const input = aDocuments[index];
    const manifest = manifestDocuments[index];
    if (
      input.position !== index ||
      input.uuid !== manifest.documentUuid ||
      input.sha256 !== manifest.documentSha256 ||
      input.position !== manifest.documentPosition
    )
      throw gateError("LF_A_AUTOMATED_GATE_A_DOCUMENT_MISMATCH");
  }
  const uuids = new Set(aDocuments.map(({ uuid }) => uuid));
  for (const [index, document] of bDocuments.entries()) {
    if (
      typeof document.uuid !== "string" ||
      !document.uuid ||
      !validSha(document.sha256) ||
      document.position !== index ||
      uuids.has(document.uuid)
    )
      throw gateError("LF_A_AUTOMATED_GATE_B_DOCUMENT_INVALID");
    uuids.add(document.uuid);
  }
  return {
    aDocuments: aDocuments.map(
      ({ uuid, sha256: documentSha256, position }) => ({
        uuid,
        documentSha256,
        position,
      })
    ),
    bDocuments: bDocuments.map(
      ({ uuid, sha256: documentSha256, position }) => ({
        uuid,
        documentSha256,
        position,
      })
    ),
  };
}

function validateSourceUnitPlan(plan) {
  if (
    plan?.contractId !== A_SOURCE_UNIT_PLAN_CONTRACT_ID ||
    plan.runContractId !== A_DRIVEN_RUN_CONTRACT_ID ||
    !Array.isArray(plan.documents) ||
    !Array.isArray(plan.units) ||
    !Array.isArray(plan.relations) ||
    !validSha(plan.planSha256)
  )
    throw gateError("LF_A_AUTOMATED_GATE_SOURCE_PLAN_INVALID");
  const { planSha256, ...payload } = plan;
  if (
    planSha256 !==
    sha256(`${A_SOURCE_UNIT_PLAN_CONTRACT_ID}\u0000${stableStringify(payload)}`)
  )
    throw gateError("LF_A_AUTOMATED_GATE_SOURCE_PLAN_DIGEST_INVALID");
  const documentIds = new Set();
  const unitIds = new Set();
  const blockKeys = new Set();
  for (const [index, document] of plan.documents.entries()) {
    if (
      document.documentPosition !== index ||
      !document.documentUuid ||
      documentIds.has(document.documentUuid) ||
      !validSha(document.documentSha256) ||
      !Array.isArray(document.unitIds)
    )
      throw gateError("LF_A_AUTOMATED_GATE_SOURCE_PLAN_DOCUMENT_INVALID");
    documentIds.add(document.documentUuid);
  }
  for (const unit of plan.units) {
    if (
      !unit?.unitId ||
      unitIds.has(unit.unitId) ||
      !documentIds.has(unit.source?.documentUuid) ||
      !Array.isArray(unit.source?.blocks) ||
      !Array.isArray(unit.source?.blockIds) ||
      unit.source.blocks.length !== unit.source.blockIds.length
    )
      throw gateError("LF_A_AUTOMATED_GATE_SOURCE_PLAN_UNIT_INVALID");
    unitIds.add(unit.unitId);
    for (const blockId of unit.source.blockIds) {
      const key = `${unit.source.documentUuid}:${blockId}`;
      if (blockKeys.has(key))
        throw gateError("LF_A_AUTOMATED_GATE_SOURCE_BLOCK_DUPLICATE");
      blockKeys.add(key);
    }
  }
  for (const document of plan.documents) {
    const actual = plan.units
      .filter(({ source }) => source.documentUuid === document.documentUuid)
      .map(({ unitId }) => unitId);
    if (stableStringify(actual) !== stableStringify(document.unitIds))
      throw gateError("LF_A_AUTOMATED_GATE_SOURCE_PLAN_DOCUMENT_UNITS_INVALID");
  }
  if (
    plan.summary?.documents !== plan.documents.length ||
    plan.summary?.plannedUnits !== plan.units.length ||
    plan.summary?.sourceBlocks !== blockKeys.size ||
    plan.summary?.pendingUnits !==
      plan.units.filter(
        ({ initialDisposition }) =>
          initialDisposition === "PENDING_CLASSIFICATION"
      ).length ||
    plan.summary?.terminalNonOperativeUnits !==
      plan.units.filter(
        ({ initialDisposition }) =>
          initialDisposition === "NON_OPERATIVE_TERMINAL"
      ).length
  )
    throw gateError("LF_A_AUTOMATED_GATE_SOURCE_PLAN_SUMMARY_INVALID");
  return plan;
}

function validateClassificationBatches(classificationBatches, plan) {
  if (
    classificationBatches?.contractId !== A_CLASSIFICATION_CONTRACT_ID ||
    classificationBatches.sourceUnitPlanSha256 !== plan.planSha256 ||
    !Array.isArray(classificationBatches.batches) ||
    !Number.isInteger(classificationBatches.summary?.maximumUnits) ||
    !Number.isInteger(classificationBatches.summary?.maximumCharacters)
  )
    throw gateError("LF_A_AUTOMATED_GATE_CLASSIFICATION_PLAN_INVALID");
  const expected = buildADrivenClassificationBatches(plan, {
    maximumUnits: classificationBatches.summary.maximumUnits,
    maximumCharacters: classificationBatches.summary.maximumCharacters,
  });
  if (stableStringify(expected) !== stableStringify(classificationBatches))
    throw gateError("LF_A_AUTOMATED_GATE_CLASSIFICATION_PLAN_MISMATCH");
  return classificationBatches;
}

function terminalRiskAssessment({ plan, manifest }) {
  const unitById = new Map(plan.units.map((unit) => [unit.unitId, unit]));
  const dynamicEvidenceBlockKeys = new Set(
    manifest.requirements.flatMap((requirement) =>
      requirement.components.flatMap((component) =>
        component.sourceBlockIds.map((blockId) => {
          const span = requirement.sourceSpans?.find(
            ({ blockId: sourceBlockId }) => sourceBlockId === blockId
          );
          return `${span?.documentUuid}:${blockId}`;
        })
      )
    )
  );
  const suspiciousNonOperativeUnits = [];
  const suspiciousOperativeUnits = [];
  for (const terminal of manifest.unitTerminals) {
    const unit = unitById.get(terminal.unitId);
    if (!unit) throw gateError("LF_A_AUTOMATED_GATE_TERMINAL_UNIT_UNKNOWN");
    const sourceText = String(unit.source?.combinedText || "").trim();
    if (terminal.terminalDisposition === "OPERATIVE_MAPPED") {
      const numberedHeadingWithoutPredicate =
        unit.unitKind === "LIST" &&
        unit.source.blocks.length > 0 &&
        unit.source.blocks.every(
          ({ structuralKind }) => structuralKind === "HEADING_CANDIDATE"
        ) &&
        /^\s*\d+[.)]\s/u.test(sourceText) &&
        !/\b(?:ist|sind|wird|werden|gilt|gelten|besteht|bestehen|hat|haben|muss|müssen|kann|können|darf|dürfen|umfasst|umfassen|versichert|mitversichert|ausgeschlossen|ersetzt|leistet|verzichtet)\b/iu.test(
          sourceText
        );
      if (!terminal.requirementIds.length || numberedHeadingWithoutPredicate)
        suspiciousOperativeUnits.push({
          unitId: terminal.unitId,
          reason: !terminal.requirementIds.length
            ? "OPERATIVE_WITHOUT_REQUIREMENT_IDS"
            : "NUMBERED_HEADING_WITHOUT_PREDICATE",
        });
      continue;
    }
    if (terminal.terminalDisposition === "UNRESOLVED_REVIEW_REQUIRED") continue;
    const pendingNonHeading =
      unit.initialDisposition === "PENDING_CLASSIFICATION" &&
      !["HEADING", "METADATA"].includes(unit.unitKind);
    const strongOperativeSignal = STRONG_OPERATIVE_TEXT.test(sourceText);
    if (!pendingNonHeading && !strongOperativeSignal) continue;
    const allBlocksReusedAsEvidence = unit.source.blockIds.every((blockId) =>
      dynamicEvidenceBlockKeys.has(`${unit.source.documentUuid}:${blockId}`)
    );
    const pageMarker =
      unit.unitKind === "METADATA" && /^Seite\s+\d+$/iu.test(sourceText);
    const structuralHeading =
      unit.source.blocks.length > 0 &&
      unit.source.blocks.every(
        ({ structuralKind }) => structuralKind === "HEADING_CANDIDATE"
      ) &&
      (unit.unitKind === "HEADING" ||
        /^\s*(?:\d+(?:\.\d+)*[.)]?|[A-Z][.)])\s+/u.test(sourceText));
    const structuralLabel = /^(?:Versicherer|Präambel)$/iu.test(sourceText);
    if (
      !(
        (allBlocksReusedAsEvidence && strongOperativeSignal) ||
        pageMarker ||
        structuralHeading ||
        structuralLabel
      )
    )
      suspiciousNonOperativeUnits.push({
        unitId: terminal.unitId,
        reason: pendingNonHeading
          ? "PENDING_NON_HEADING_CLASSIFIED_NON_OPERATIVE"
          : "STRONG_OPERATIVE_TEXT_SIGNAL",
      });
  }
  return { suspiciousNonOperativeUnits, suspiciousOperativeUnits };
}

function buildAutomatedADrivenIntegrityReceipt({
  plan,
  classificationPlan = plan,
  classificationBatches,
  batchResults,
  responses,
  classificationSummary,
  manifest,
  inputManifest,
  inputManifestBytes,
  artifactFileSha256s = {},
} = {}) {
  validateSourceUnitPlan(plan);
  validateClassificationBatches(classificationBatches, plan);
  if (
    classificationPlan?.planSha256 !== plan.planSha256 ||
    stableStringify(classificationPlan.documents) !==
      stableStringify(plan.documents) ||
    stableStringify(classificationPlan.summary) !==
      stableStringify(plan.summary)
  )
    throw gateError("LF_A_AUTOMATED_GATE_CLASSIFICATION_CONTEXT_INVALID");
  validateADrivenSemanticManifest(manifest);
  if (
    !Array.isArray(batchResults) ||
    batchResults.length !== classificationBatches.batches.length ||
    batchResults.some(
      (result, index) =>
        result?.batchId !== classificationBatches.batches[index].batchId ||
        result.batchIndex !== index ||
        result.sourceUnitPlanSha256 !== plan.planSha256 ||
        result.validation?.passed !== true
    )
  )
    throw gateError("LF_A_AUTOMATED_GATE_BATCH_RESULTS_INVALID");
  const resultResponses = batchResults.flatMap(
    ({ responses: items }) => items || []
  );
  if (
    !Array.isArray(responses) ||
    stableStringify(resultResponses) !== stableStringify(responses)
  )
    throw gateError("LF_A_AUTOMATED_GATE_RESPONSES_MISMATCH");
  const rebuiltManifest = buildADrivenSemanticManifest({
    plan: classificationPlan,
    responses,
    semanticSignalContractId: manifest.semanticSignalContractId,
  });
  if (stableStringify(rebuiltManifest) !== stableStringify(manifest))
    throw gateError("LF_A_AUTOMATED_GATE_MANIFEST_RECONSTRUCTION_MISMATCH");
  const expectedResponseUnits = classificationBatches.batches.flatMap(
    ({ expectedUnitIds }) => expectedUnitIds
  );
  const responseUnitIds = responses.map(({ unitId }) => unitId);
  const expectedCounts = {
    batches: classificationBatches.batches.length,
    validBatches: classificationBatches.batches.length,
    unresolvedBatches: 0,
    semanticRequirements: manifest.summary.semanticRequirements,
    semanticComponents: manifest.summary.semanticComponents,
    unresolvedUnits: 0,
    reviewRequiredBlocks: 0,
    allBlocksTerminal: true,
    responseIntegrityStatus: "VALID",
  };
  if (
    classificationSummary?.sourceUnitPlanSha256 !== plan.planSha256 ||
    classificationSummary.classificationBatchesSha256 !==
      sha256(JSON.stringify(classificationBatches)) ||
    classificationSummary.validatorContractId !==
      A_DYNAMIC_MANIFEST_CONTRACT_ID ||
    classificationSummary.semanticSignalContractId !==
      manifest.semanticSignalContractId ||
    Object.entries(expectedCounts).some(
      ([key, value]) => classificationSummary[key] !== value
    )
  )
    throw gateError("LF_A_AUTOMATED_GATE_CLASSIFICATION_SUMMARY_INVALID");
  if (
    expectedResponseUnits.length !== responses.length ||
    new Set(expectedResponseUnits).size !== expectedResponseUnits.length ||
    new Set(responseUnitIds).size !== responseUnitIds.length ||
    stableStringify([...responseUnitIds].sort()) !==
      stableStringify([...expectedResponseUnits].sort())
  )
    throw gateError("LF_A_AUTOMATED_GATE_RESPONSE_ENVELOPE_INVALID");
  if (
    manifest.runContractId !== A_DRIVEN_RUN_CONTRACT_ID ||
    manifest.sourceUnitPlanSha256 !== plan.planSha256 ||
    manifest.summary.documents !== plan.documents.length ||
    manifest.summary.sourceBlocks !== plan.summary.sourceBlocks ||
    manifest.summary.plannedUnits !== plan.summary.plannedUnits ||
    manifest.summary.terminalUnits !== plan.summary.plannedUnits ||
    manifest.summary.unresolvedUnits !== 0 ||
    manifest.summary.reviewRequiredBlocks !== 0 ||
    manifest.summary.allBlocksTerminal !== true ||
    manifest.summary.responseIntegrityStatus !== "VALID" ||
    manifest.summary.acceptanceReady !== true ||
    manifest.requirements.length < 1 ||
    manifest.summary.semanticComponents < manifest.requirements.length ||
    manifest.requirements.some(
      (requirement) =>
        requirement.decisionEligibility !== "ELIGIBLE" ||
        !Array.isArray(requirement.components) ||
        requirement.components.length < 1
    )
  )
    throw gateError("LF_A_AUTOMATED_GATE_MANIFEST_NOT_READY");
  const blockTerminalKeys = manifest.blockTerminals.map(
    ({ documentUuid, blockId }) => `${documentUuid}:${blockId}`
  );
  const plannedBlockKeys = plan.units.flatMap(({ source }) =>
    source.blockIds.map((blockId) => `${source.documentUuid}:${blockId}`)
  );
  if (
    blockTerminalKeys.length !== plannedBlockKeys.length ||
    new Set(blockTerminalKeys).size !== blockTerminalKeys.length ||
    stableStringify([...blockTerminalKeys].sort()) !==
      stableStringify([...plannedBlockKeys].sort())
  )
    throw gateError("LF_A_AUTOMATED_GATE_BLOCK_TERMINALS_INVALID");
  const terminalRisk = terminalRiskAssessment({
    plan: classificationPlan,
    manifest,
  });
  if (
    terminalRisk.suspiciousNonOperativeUnits.length ||
    terminalRisk.suspiciousOperativeUnits.length
  )
    throw gateError("LF_A_AUTOMATED_GATE_TERMINAL_RISK_UNRESOLVED");
  const documentBinding = validateInputManifestBinding({
    inputManifest,
    dynamicManifest: manifest,
  });
  if (
    !Buffer.isBuffer(inputManifestBytes) ||
    Object.values(artifactFileSha256s).some((value) => !validSha(value))
  )
    throw gateError("LF_A_AUTOMATED_GATE_FILE_BINDING_INVALID");
  const payload = {
    schemaVersion: 1,
    contractId: AUTOMATED_A_INTEGRITY_CONTRACT_ID,
    runContractId: A_DRIVEN_RUN_CONTRACT_ID,
    scope: AUTOMATED_B_SHADOW_SCOPE,
    sourceUnitPlanSha256: plan.planSha256,
    dynamicManifestSha256: manifest.manifestSha256,
    inputManifestFileSha256: sha256(inputManifestBytes),
    artifactFileSha256s,
    model: classificationSummary.model,
    transport: classificationSummary.transport,
    aDocuments: documentBinding.aDocuments,
    bDocuments: documentBinding.bDocuments,
    summary: {
      aDocuments: documentBinding.aDocuments.length,
      bDocuments: documentBinding.bDocuments.length,
      sourceBlocks: plan.summary.sourceBlocks,
      plannedUnits: plan.summary.plannedUnits,
      classificationBatches: classificationBatches.batches.length,
      responseUnits: responses.length,
      semanticRequirements: manifest.summary.semanticRequirements,
      semanticComponents: manifest.summary.semanticComponents,
      unresolvedUnits: 0,
      suspiciousNonOperativeUnits: 0,
      suspiciousOperativeUnits: 0,
    },
    checks: {
      sourcePlanReconstructedFromCurrentADocuments: true,
      sourceBlocksOwnedExactlyOnce: true,
      classificationBatchesCompleteAndPass: true,
      responseEnvelopeComplete: true,
      manifestReconstructedFromBoundResponses: true,
      allBlocksTerminal: true,
      noUnresolvedUnitsOrBlocks: true,
      noSuspiciousTerminalRoleClassification: true,
      everyRequirementSearchEligible: true,
      inputDocumentsBound: true,
    },
    status: "AUTOMATED_A_INTEGRITY_PASS",
    bShadowPilotAllowed: true,
    legacyCrosswalkRequiredForLaunch: false,
    humanReviewRequiredForLaunch: false,
    cryptographicSignatureRequiredForLaunch: false,
    fullProductRunAllowed: false,
    productRoutingAllowed: false,
    resultMutationAllowed: false,
    customerWorkbookAllowed: false,
    deploymentAllowed: false,
    semanticCompletenessClaimed: false,
    generalizationClaimed: false,
    proofLimit:
      "Automatische Integrität des konkreten dynamischen A-Laufs und Freigabe ausschließlich für privaten B-Shadow. Kein fachliches Vollständigkeits-, Holdout-, 99-Prozent-, Produkt-, Kundenexport- oder Deployment-Gate.",
  };
  return {
    ...payload,
    readinessSha256: sha256(
      `${AUTOMATED_A_INTEGRITY_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

module.exports = {
  AUTOMATED_A_INTEGRITY_CONTRACT_ID,
  AUTOMATED_B_SHADOW_SCOPE,
  buildAutomatedADrivenIntegrityReceipt,
  terminalRiskAssessment,
  validateClassificationBatches,
  validateInputManifestBinding,
  validateSourceUnitPlan,
};
