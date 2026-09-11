const crypto = require("crypto");
const { A_DYNAMIC_MANIFEST_CONTRACT_ID } = require("./aDrivenSemanticManifest");
const {
  A_SOURCE_UNIT_PLAN_CONTRACT_ID,
  stableStringify,
} = require("./aDrivenSourceUnitPlan");

const A_STATUS_AUDIT_CONTRACT_ID = "LF_A_DYNAMIC_STATUS_AUDIT_V1";
const EXPECTED_LEGACY_REQUIREMENTS = 283;
const EXPECTED_LEGACY_COMPONENTS = 631;
const LEGACY_ROLE_TO_DYNAMIC_TYPES = Object.freeze({
  INSURED_OBJECT: ["OBJECT"],
  PERIL: ["PERIL_OR_CAUSE"],
  DAMAGE: ["DAMAGE_OR_EFFECT"],
  BENEFIT: ["COVERAGE_EFFECT", "FACT_ROLE"],
  EXCLUSION: ["COVERAGE_EFFECT"],
  COST: ["FACT_ROLE", "VALUE_AND_UNIT"],
  LIMIT: ["VALUE_AND_UNIT", "LIMIT_BASIS"],
  DEDUCTIBLE: ["DEDUCTIBLE", "VALUE_AND_UNIT"],
  CONDITION: ["CONDITION", "TEMPORAL_VALIDITY"],
  DEFINITION: ["FACT_ROLE"],
  DOCUMENT_STATUS: ["DOCUMENT_ROLE", "PRECEDENCE_OR_REPLACEMENT"],
});
const STRONG_OPERATIVE_TEXT =
  /\b(?:versichert\s+sind|mitversichert|nicht\s+versichert|ausgeschlossen|versicherungsschutz\s+(?:besteht|gilt)|gilt\s+(?:als|für|bei)|beträgt|bis\s+zu|unter\s+der\s+voraussetzung|hat\s+zu|muss|ist\s+verpflichtet|ersetzt|innerhalb\s+von)\b|\b\d+(?:[.,]\d+)?\s*(?:%|EUR|Euro|Tage?|Monate?|Jahre?)\b/iu;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function intersection(left, right) {
  const rightSet = right instanceof Set ? right : new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function legacyRequirements(legacyManifest) {
  if (!Array.isArray(legacyManifest?.requirements))
    throw new Error("LF_A_STATUS_LEGACY_MANIFEST_INVALID");
  return legacyManifest.requirements.map((requirement) => {
    const spans = new Map(
      requirement.sourceSpans.map((span) => [span.spanId, span])
    );
    const components = requirement.components.map((component) => ({
      legacyRequirementId: requirement.requirementId,
      legacyComponentId: component.id,
      legacyFactRole: component.factRole,
      label: component.label,
      sourceBlockIds: Array.from(
        new Set(
          (component.sourceSpanIds || []).flatMap(
            (spanId) => spans.get(spanId)?.blockIds || []
          )
        )
      ),
    }));
    return {
      legacyRequirementId: requirement.requirementId,
      displayLabel: requirement.displayLabel,
      sourceBlockIds: Array.from(
        new Set(
          (requirement.sourceSpans || []).flatMap(
            ({ blockIds = [] }) => blockIds
          )
        )
      ),
      components,
    };
  });
}

function dynamicRequirements(manifest) {
  return manifest.requirements.map((requirement) => ({
    dynamicRequirementId: requirement.requirementId,
    displayLabel: requirement.displayLabel,
    sourceUnitIds: requirement.sourceUnitIds,
    sourceBlockIds: requirement.sourceBlockIds,
    components: requirement.components.map((component) => ({
      dynamicRequirementId: requirement.requirementId,
      dynamicComponentId: component.componentId,
      dynamicComponentType: component.type,
      label: component.label,
      sourceBlockIds: component.sourceBlockIds,
    })),
  }));
}

function buildADrivenAStatusAudit({
  plan,
  manifest,
  responses,
  classificationBatches,
  batchResults,
  legacyManifest,
} = {}) {
  if (
    plan?.contractId !== A_SOURCE_UNIT_PLAN_CONTRACT_ID ||
    manifest?.contractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
    manifest.sourceUnitPlanSha256 !== plan.planSha256 ||
    !Array.isArray(responses) ||
    !Array.isArray(classificationBatches?.batches) ||
    !Array.isArray(batchResults)
  )
    throw new Error("LF_A_STATUS_AUDIT_INPUT_INVALID");

  const unitById = new Map(plan.units.map((unit) => [unit.unitId, unit]));
  const ownedBlocks = plan.units.flatMap((unit) =>
    unit.source.blockIds.map((blockId) => ({
      key: `${unit.source.documentUuid}:${blockId}`,
      blockId,
      documentUuid: unit.source.documentUuid,
      unitId: unit.unitId,
    }))
  );
  const duplicateOwnedBlockKeys = ownedBlocks
    .map(({ key }) => key)
    .filter((key, index, keys) => keys.indexOf(key) !== index);
  const plannedBlockIds = new Set(ownedBlocks.map(({ blockId }) => blockId));
  const terminalBlockKeys = manifest.blockTerminals.map(
    ({ documentUuid, blockId }) => `${documentUuid}:${blockId}`
  );

  const expectedUnitIds = classificationBatches.batches.flatMap(
    ({ expectedUnitIds: ids }) => ids
  );
  const responseUnitIds = responses.map(({ unitId }) => unitId);
  const duplicateResponseUnitIds = responseUnitIds.filter(
    (unitId, index) => responseUnitIds.indexOf(unitId) !== index
  );
  const expectedUnitIdSet = new Set(expectedUnitIds);
  const responseUnitIdSet = new Set(responseUnitIds);
  const missingResponseUnitIds = expectedUnitIds.filter(
    (unitId) => !responseUnitIdSet.has(unitId)
  );
  const unknownResponseUnitIds = responseUnitIds.filter(
    (unitId) => !expectedUnitIdSet.has(unitId)
  );

  const invalidSourceReferences = [];
  for (const requirement of manifest.requirements) {
    const allowed = new Set(
      requirement.sourceUnitIds.flatMap((unitId) => {
        const unit = unitById.get(unitId);
        return [
          ...(unit?.source.blockIds || []),
          ...(unit?.governingContext?.blockIds || []),
        ];
      })
    );
    for (const component of requirement.components)
      for (const blockId of component.sourceBlockIds)
        if (!plannedBlockIds.has(blockId) || !allowed.has(blockId))
          invalidSourceReferences.push({
            dynamicRequirementId: requirement.requirementId,
            dynamicComponentId: component.componentId,
            blockId,
            reason: !plannedBlockIds.has(blockId)
              ? "UNKNOWN_SOURCE_BLOCK_ID"
              : "SOURCE_BLOCK_OUTSIDE_UNIT_EVIDENCE",
          });
  }

  const legacy = legacyRequirements(legacyManifest);
  const dynamic = dynamicRequirements(manifest);
  const legacyComponents = legacy.flatMap(({ components }) => components);
  const dynamicComponents = dynamic.flatMap(({ components }) => components);
  const componentCrosswalk = legacyComponents.map((component) => {
    const compatibleDynamicTargets = dynamicComponents
      .filter(
        (candidate) =>
          (
            LEGACY_ROLE_TO_DYNAMIC_TYPES[component.legacyFactRole] || []
          ).includes(candidate.dynamicComponentType) &&
          intersection(candidate.sourceBlockIds, component.sourceBlockIds)
            .length > 0
      )
      .map((candidate) => ({
        dynamicRequirementId: candidate.dynamicRequirementId,
        dynamicComponentId: candidate.dynamicComponentId,
        dynamicComponentType: candidate.dynamicComponentType,
        label: candidate.label,
        overlappingSourceBlockIds: intersection(
          candidate.sourceBlockIds,
          component.sourceBlockIds
        ),
      }));
    return {
      ...component,
      relationCandidate:
        compatibleDynamicTargets.length === 0
          ? "MISSING"
          : compatibleDynamicTargets.length === 1
            ? "ONE_TO_ONE_CANDIDATE"
            : "SPLIT_CANDIDATE",
      compatibleDynamicTargets,
    };
  });
  const dynamicComponentCrosswalk = dynamicComponents.map((component) => {
    const compatibleLegacySources = componentCrosswalk
      .filter(({ compatibleDynamicTargets }) =>
        compatibleDynamicTargets.some(
          ({ dynamicComponentId }) =>
            dynamicComponentId === component.dynamicComponentId
        )
      )
      .map(
        ({
          legacyRequirementId,
          legacyComponentId,
          legacyFactRole,
          label,
        }) => ({
          legacyRequirementId,
          legacyComponentId,
          legacyFactRole,
          label,
        })
      );
    return {
      ...component,
      relationCandidate:
        compatibleLegacySources.length === 0
          ? "ADDITIONAL"
          : compatibleLegacySources.length === 1
            ? "ONE_TO_ONE_CANDIDATE"
            : "MERGED_CANDIDATE",
      compatibleLegacySources,
    };
  });

  const requirementCrosswalk = legacy.map((requirement) => {
    const dynamicTargets = dynamic
      .filter(
        (candidate) =>
          intersection(candidate.sourceBlockIds, requirement.sourceBlockIds)
            .length > 0
      )
      .map(({ dynamicRequirementId, displayLabel, sourceBlockIds }) => ({
        dynamicRequirementId,
        displayLabel,
        overlappingSourceBlockIds: intersection(
          sourceBlockIds,
          requirement.sourceBlockIds
        ),
      }));
    return {
      legacyRequirementId: requirement.legacyRequirementId,
      displayLabel: requirement.displayLabel,
      relationCandidate:
        dynamicTargets.length === 0
          ? "MISSING"
          : dynamicTargets.length === 1
            ? "ONE_TO_ONE_CANDIDATE"
            : "SPLIT_CANDIDATE",
      dynamicTargets,
    };
  });
  const dynamicRequirementCrosswalk = dynamic.map((requirement) => {
    const legacySources = requirementCrosswalk
      .filter(({ dynamicTargets }) =>
        dynamicTargets.some(
          ({ dynamicRequirementId }) =>
            dynamicRequirementId === requirement.dynamicRequirementId
        )
      )
      .map(({ legacyRequirementId, displayLabel }) => ({
        legacyRequirementId,
        displayLabel,
      }));
    return {
      dynamicRequirementId: requirement.dynamicRequirementId,
      displayLabel: requirement.displayLabel,
      relationCandidate:
        legacySources.length === 0
          ? "ADDITIONAL"
          : legacySources.length === 1
            ? "ONE_TO_ONE_CANDIDATE"
            : "MERGED_CANDIDATE",
      legacySources,
    };
  });

  const legacySourceBlockIds = new Set(
    legacyComponents.flatMap(({ sourceBlockIds }) => sourceBlockIds)
  );
  const unresolvedUnits = manifest.unitTerminals
    .filter(
      ({ terminalDisposition }) =>
        terminalDisposition === "UNRESOLVED_REVIEW_REQUIRED"
    )
    .map((terminal) => ({
      ...terminal,
      source: unitById.get(terminal.unitId)?.source || null,
    }));
  const suspiciousNonOperativeUnits = manifest.unitTerminals
    .filter(
      ({ terminalDisposition }) =>
        terminalDisposition !== "OPERATIVE_MAPPED" &&
        terminalDisposition !== "UNRESOLVED_REVIEW_REQUIRED"
    )
    .map((terminal) => {
      const unit = unitById.get(terminal.unitId);
      const overlappingLegacySourceBlockIds = intersection(
        unit.source.blockIds,
        legacySourceBlockIds
      );
      const reasons = [];
      if (
        unit.initialDisposition === "PENDING_CLASSIFICATION" &&
        !["HEADING", "METADATA"].includes(unit.unitKind)
      )
        reasons.push("PENDING_NON_HEADING_CLASSIFIED_NON_OPERATIVE");
      if (STRONG_OPERATIVE_TEXT.test(unit.source.combinedText))
        reasons.push("STRONG_OPERATIVE_TEXT_SIGNAL");
      if (overlappingLegacySourceBlockIds.length)
        reasons.push("OVERLAPS_LEGACY_OPERATIVE_COMPONENT");
      return {
        ...terminal,
        unitKind: unit.unitKind,
        initialDisposition: unit.initialDisposition,
        source: unit.source,
        overlappingLegacySourceBlockIds,
        reasons,
      };
    })
    .filter(({ reasons }) => reasons.length > 0);

  const summary = {
    sourceBlocks: plan.summary.sourceBlocks,
    ownedBlockOccurrences: ownedBlocks.length,
    uniqueOwnedBlocks: new Set(ownedBlocks.map(({ key }) => key)).size,
    terminalBlockOccurrences: terminalBlockKeys.length,
    uniqueTerminalBlocks: new Set(terminalBlockKeys).size,
    duplicateOwnedBlocks: duplicateOwnedBlockKeys.length,
    classificationBatches: classificationBatches.batches.length,
    validBatchResults: batchResults.filter(
      ({ validation }) => validation?.passed === true
    ).length,
    expectedResponseUnits: expectedUnitIds.length,
    responseUnits: responseUnitIds.length,
    missingResponseUnits: missingResponseUnitIds.length,
    unknownResponseUnits: unknownResponseUnitIds.length,
    duplicateResponseUnits: duplicateResponseUnitIds.length,
    invalidSourceReferences: invalidSourceReferences.length,
    semanticRequirements: manifest.summary.semanticRequirements,
    semanticComponents: manifest.summary.semanticComponents,
    unresolvedUnits: unresolvedUnits.length,
    suspiciousNonOperativeUnits: suspiciousNonOperativeUnits.length,
    legacyRequirements: legacy.length,
    legacyComponents: legacyComponents.length,
    missingLegacyRequirements: requirementCrosswalk.filter(
      ({ relationCandidate }) => relationCandidate === "MISSING"
    ).length,
    splitLegacyRequirements: requirementCrosswalk.filter(
      ({ relationCandidate }) => relationCandidate === "SPLIT_CANDIDATE"
    ).length,
    additionalDynamicRequirements: dynamicRequirementCrosswalk.filter(
      ({ relationCandidate }) => relationCandidate === "ADDITIONAL"
    ).length,
    mergedDynamicRequirements: dynamicRequirementCrosswalk.filter(
      ({ relationCandidate }) => relationCandidate === "MERGED_CANDIDATE"
    ).length,
    missingLegacyComponents: componentCrosswalk.filter(
      ({ relationCandidate }) => relationCandidate === "MISSING"
    ).length,
    splitLegacyComponents: componentCrosswalk.filter(
      ({ relationCandidate }) => relationCandidate === "SPLIT_CANDIDATE"
    ).length,
    additionalDynamicComponents: dynamicComponentCrosswalk.filter(
      ({ relationCandidate }) => relationCandidate === "ADDITIONAL"
    ).length,
    mergedDynamicComponents: dynamicComponentCrosswalk.filter(
      ({ relationCandidate }) => relationCandidate === "MERGED_CANDIDATE"
    ).length,
  };
  summary.sourceOwnershipPassed =
    summary.sourceBlocks === ownedBlocks.length &&
    summary.sourceBlocks === summary.uniqueOwnedBlocks &&
    summary.sourceBlocks === terminalBlockKeys.length &&
    summary.sourceBlocks === summary.uniqueTerminalBlocks &&
    summary.duplicateOwnedBlocks === 0;
  summary.responseEnvelopePassed =
    summary.classificationBatches === summary.validBatchResults &&
    summary.expectedResponseUnits === summary.responseUnits &&
    summary.missingResponseUnits === 0 &&
    summary.unknownResponseUnits === 0 &&
    summary.duplicateResponseUnits === 0;
  summary.sourceReferenceIntegrityPassed =
    summary.invalidSourceReferences === 0;
  summary.mechanicalLegacyCoveragePassed =
    summary.legacyRequirements === EXPECTED_LEGACY_REQUIREMENTS &&
    summary.legacyComponents === EXPECTED_LEGACY_COMPONENTS &&
    summary.missingLegacyRequirements === 0 &&
    summary.missingLegacyComponents === 0;
  summary.nonOperativeReviewPassed = summary.suspiciousNonOperativeUnits === 0;
  summary.semanticCrosswalkApproved = false;
  summary.acceptanceReady = false;

  const payload = {
    schemaVersion: 1,
    contractId: A_STATUS_AUDIT_CONTRACT_ID,
    sourceUnitPlanSha256: plan.planSha256,
    dynamicManifestSha256: manifest.manifestSha256,
    legacyManifestSha256: legacyManifest.manifestSha256,
    summary,
    unresolvedUnits,
    suspiciousNonOperativeUnits,
    invalidSourceReferences,
    responseEnvelope: {
      missingResponseUnitIds,
      unknownResponseUnitIds,
      duplicateResponseUnitIds,
    },
    requirementCrosswalk,
    dynamicRequirementCrosswalk,
    componentCrosswalk,
    dynamicComponentCrosswalk,
    proofLimit:
      "Mechanischer Source-/Rollen-Crosswalk und Nonoperative-Risikofilter. Source-Overlap ersetzt keine zweifache semantische Review und 1005/1005-Blockbesitz allein ist kein fachlicher Vollständigkeitsbeweis.",
  };
  return {
    ...payload,
    auditSha256: sha256(
      `${A_STATUS_AUDIT_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

module.exports = {
  A_STATUS_AUDIT_CONTRACT_ID,
  buildADrivenAStatusAudit,
};
