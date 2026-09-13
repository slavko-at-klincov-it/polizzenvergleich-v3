const crypto = require("crypto");
const { A_DYNAMIC_MANIFEST_CONTRACT_ID } = require("./aDrivenSemanticManifest");
const {
  A_SOURCE_UNIT_PLAN_CONTRACT_ID,
  stableStringify,
} = require("./aDrivenSourceUnitPlan");

const A_STATUS_AUDIT_CONTRACT_ID = "LF_A_DYNAMIC_STATUS_AUDIT_V2";
const A_ATOMICITY_RISK_AUDIT_CONTRACT_ID =
  "LF_A_DYNAMIC_ATOMICITY_RISK_AUDIT_V2";
const A_ATOMICITY_COMPARISON_CONTRACT_ID =
  "LF_A_DYNAMIC_ATOMICITY_COMPARISON_V1";
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
  /\b(?:versichert\s+sind|sind\s+(?:mit)?versichert|mitversichert|nicht\s+versichert|ausgeschlossen|versicherungsschutz\s+(?:besteht|gilt)|gilt\s+(?:als|für|bei)|beträgt|bis\s+zu|unter\s+der\s+voraussetzung|hat\s+zu|muss|ist\s+verpflichtet|ersetzt|innerhalb\s+von)\b|\b\d+(?:[.,]\d+)?\s*(?:%|EUR|Euro|Tage?|Monate?|Jahre?)\b/iu;
const ATOMIC_LABEL_COMPONENT_TYPES = new Set([
  "OBJECT",
  "PERIL_OR_CAUSE",
  "DAMAGE_OR_EFFECT",
  "COVERAGE_EFFECT",
  "FACT_ROLE",
  "VALUE_AND_UNIT",
  "LIMIT_BASIS",
  "DEDUCTIBLE",
  "TEMPORAL_VALIDITY",
  "DOCUMENT_ROLE",
  "PRECEDENCE_OR_REPLACEMENT",
]);
const PARTY_ROLE_PATTERN =
  /\b(?:Versicherungsnehmer(?:in)?|Versicherer|Verwalter|Treuhänder|Makler|Vermittler|Gebäudeeigentümer|Eigentümer|Mieter|Pächter)\b/giu;
const PARTY_ROLE_COORDINATION_PATTERN =
  /\b(?:bzw\.|beziehungsweise|und|oder|sowie|und\/oder)\b|[/,&]/iu;
const PREDICATE_PATTERN =
  /\b(?:ist|sind|wird|werden|gilt|gelten|besteht|bestehen|hat|haben|muss|müssen|kann|können|darf|dürfen|umfasst|umfassen|versichert|mitversichert|ausgeschlossen|ersetzt|leistet|verzichtet)\b/iu;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function intersection(left, right) {
  const rightSet = right instanceof Set ? right : new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function assessADrivenTerminalRoleRisks({
  plan,
  manifest,
  legacySourceBlockIds = new Set(),
} = {}) {
  if (!Array.isArray(plan?.units) || !Array.isArray(manifest?.unitTerminals))
    throw new Error("LF_A_TERMINAL_ROLE_RISK_AUDIT_INPUT_INVALID");
  const unitById = new Map(plan.units.map((unit) => [unit.unitId, unit]));
  const legacyBlocks =
    legacySourceBlockIds instanceof Set
      ? legacySourceBlockIds
      : new Set(legacySourceBlockIds || []);
  const dynamicEvidenceBlockKeys = new Set(
    (manifest.requirements || []).flatMap((requirement) =>
      (requirement.components || []).flatMap((component) =>
        (component.sourceBlockIds || []).flatMap((blockId) => {
          const span = (requirement.sourceSpans || []).find(
            ({ blockId: sourceBlockId }) => sourceBlockId === blockId
          );
          return span?.documentUuid ? [`${span.documentUuid}:${blockId}`] : [];
        })
      )
    )
  );
  const reviewedNonOperativeUnits = manifest.unitTerminals
    .filter(
      ({ terminalDisposition }) =>
        terminalDisposition !== "OPERATIVE_MAPPED" &&
        terminalDisposition !== "UNRESOLVED_REVIEW_REQUIRED"
    )
    .map((terminal) => {
      const unit = unitById.get(terminal.unitId);
      if (!unit) throw new Error("LF_A_TERMINAL_ROLE_RISK_UNIT_UNKNOWN");
      const overlappingLegacySourceBlockIds = intersection(
        unit.source.blockIds,
        legacyBlocks
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
      const citedAsDynamicEvidence = unit.source.blockIds.filter((blockId) =>
        dynamicEvidenceBlockKeys.has(`${unit.source.documentUuid}:${blockId}`)
      );
      const text = String(unit.source.combinedText || "").trim();
      const headingCandidateOnly =
        unit.source.blocks.length > 0 &&
        unit.source.blocks.every(
          ({ structuralKind }) => structuralKind === "HEADING_CANDIDATE"
        );
      let reviewDisposition = "SUSPICIOUS_REVIEW_REQUIRED";
      if (
        citedAsDynamicEvidence.length === unit.source.blockIds.length &&
        STRONG_OPERATIVE_TEXT.test(text)
      )
        reviewDisposition = "OPERATIVE_GOVERNOR_EVIDENCE_REUSED";
      else if (unit.unitKind === "METADATA" && /^Seite\s+\d+$/iu.test(text))
        reviewDisposition = "PAGE_MARKER_CONFIRMED";
      else if (
        headingCandidateOnly &&
        (unit.unitKind === "HEADING" ||
          /^\s*(?:\d+(?:\.\d+)*[.)]?|[A-Z][.)])\s+/u.test(text))
      )
        reviewDisposition = "STRUCTURAL_HEADING_CONFIRMED";
      else if (
        /^\s*[\p{L}][\p{L}\s-]{1,120}versicherung\s*$/iu.test(text) &&
        !PREDICATE_PATTERN.test(text)
      )
        reviewDisposition = "INSURANCE_BRANCH_HEADING_CONFIRMED";
      else if (/^(?:Versicherer|Präambel)$/iu.test(text))
        reviewDisposition = "STRUCTURAL_LABEL_CONFIRMED";
      return {
        ...terminal,
        unitKind: unit.unitKind,
        initialDisposition: unit.initialDisposition,
        source: unit.source,
        overlappingLegacySourceBlockIds,
        citedAsDynamicEvidence,
        reasons,
        reviewDisposition,
      };
    })
    .filter(({ reasons }) => reasons.length > 0);
  const suspiciousNonOperativeUnits = reviewedNonOperativeUnits.filter(
    ({ reviewDisposition }) =>
      reviewDisposition === "SUSPICIOUS_REVIEW_REQUIRED"
  );
  const reviewedOperativeUnits = manifest.unitTerminals
    .filter(
      ({ terminalDisposition }) => terminalDisposition === "OPERATIVE_MAPPED"
    )
    .map((terminal) => {
      const unit = unitById.get(terminal.unitId);
      if (!unit) throw new Error("LF_A_TERMINAL_ROLE_RISK_UNIT_UNKNOWN");
      const text = String(unit.source?.combinedText || "").trim();
      const numberedHeadingWithoutPredicate =
        unit.unitKind === "LIST" &&
        unit.source.blocks.length > 0 &&
        unit.source.blocks.every(
          ({ structuralKind }) => structuralKind === "HEADING_CANDIDATE"
        ) &&
        /^\s*\d+[.)]\s/u.test(text) &&
        !PREDICATE_PATTERN.test(text);
      const reasons = [];
      if (!terminal.requirementIds.length)
        reasons.push("OPERATIVE_WITHOUT_REQUIREMENT_IDS");
      if (numberedHeadingWithoutPredicate)
        reasons.push("NUMBERED_HEADING_WITHOUT_PREDICATE");
      return { ...terminal, source: unit.source, reasons };
    })
    .filter(({ reasons }) => reasons.length > 0);
  return {
    reviewedNonOperativeUnits,
    suspiciousNonOperativeUnits,
    reviewedOperativeUnits,
    suspiciousOperativeUnits: reviewedOperativeUnits,
  };
}

function comparable(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function partyRoles(value) {
  return [
    ...new Set(
      [...String(value || "").matchAll(PARTY_ROLE_PATTERN)].map(([match]) =>
        comparable(match)
      )
    ),
  ];
}

function assessADrivenManifestAtomicityRisks({ plan, manifest } = {}) {
  if (
    plan?.contractId !== A_SOURCE_UNIT_PLAN_CONTRACT_ID ||
    manifest?.contractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
    manifest.sourceUnitPlanSha256 !== plan.planSha256 ||
    !Array.isArray(plan.units) ||
    !Array.isArray(manifest.requirements)
  )
    throw new Error("LF_A_ATOMICITY_RISK_AUDIT_INPUT_INVALID");
  const unitById = new Map(plan.units.map((unit) => [unit.unitId, unit]));
  const riskByIdentity = new Map();
  const addRisk = (requirement, component, code, details = {}) => {
    const identity = `${requirement.requirementId}:${component.componentId}:${code}`;
    if (riskByIdentity.has(identity)) return;
    const owningUnitId = requirement.sourceUnitIds.at(-1);
    if (!unitById.has(owningUnitId))
      throw new Error("LF_A_ATOMICITY_RISK_OWNING_UNIT_INVALID");
    riskByIdentity.set(identity, {
      code,
      dynamicRequirementId: requirement.requirementId,
      dynamicComponentId: component.componentId,
      owningUnitId,
      componentType: component.type,
      label: component.label,
      sourceUnitIds: requirement.sourceUnitIds,
      sourceBlockIds: component.sourceBlockIds,
      ...details,
    });
  };
  for (const requirement of manifest.requirements) {
    for (const component of requirement.components) {
      const label = comparable(component.label);
      if (!ATOMIC_LABEL_COMPONENT_TYPES.has(component.type)) continue;
      const containedTypedSiblings = requirement.components
        .filter(
          (candidate) =>
            candidate.componentId !== component.componentId &&
            candidate.type !== component.type
        )
        .filter((candidate) => {
          const candidateLabel = comparable(candidate.label);
          return (
            candidateLabel.length >= 4 &&
            label !== candidateLabel &&
            label.includes(candidateLabel)
          );
        })
        .map(({ componentId, type, label: siblingLabel }) => ({
          componentId,
          type,
          label: siblingLabel,
        }));
      if (containedTypedSiblings.length)
        addRisk(
          requirement,
          component,
          "COMPONENT_LABEL_CONTAINS_TYPED_SIBLING",
          { containedTypedSiblings }
        );
      if (label.length > 240)
        addRisk(requirement, component, "OVERBROAD_COMPONENT_LABEL", {
          normalizedCharacters: label.length,
        });
      const roles = partyRoles(component.label);
      if (
        component.type === "FACT_ROLE" &&
        roles.length > 1 &&
        PARTY_ROLE_COORDINATION_PATTERN.test(component.label)
      )
        addRisk(requirement, component, "COMPOUND_PARTY_ROLE_COMPONENT", {
          partyRoles: roles,
        });
      if (
        component.type === "FACT_ROLE" &&
        requirement.components.length === 1 &&
        roles.length > 0 &&
        label.length <= 140 &&
        !PREDICATE_PATTERN.test(component.label)
      ) {
        const unit = requirement.sourceUnitIds
          .map((unitId) => unitById.get(unitId))
          .find(Boolean);
        const nextUnit = unit
          ? plan.units.find(
              ({ packageOrder }) =>
                packageOrder[0] === unit.packageOrder[0] &&
                packageOrder[1] === unit.packageOrder[1] + 1
            )
          : null;
        addRisk(requirement, component, "ISOLATED_PARTY_ROLE_LABEL", {
          partyRoles: roles,
          nextUnit: nextUnit
            ? {
                unitId: nextUnit.unitId,
                unitKind: nextUnit.unitKind,
                exactText: nextUnit.source.combinedText,
              }
            : null,
        });
      }
    }
  }
  const risks = [...riskByIdentity.values()];
  const riskComponentIds = new Set(
    risks.map(({ dynamicComponentId }) => dynamicComponentId)
  );
  const riskUnitIds = new Set(risks.map(({ owningUnitId }) => owningUnitId));
  const byCode = Object.fromEntries(
    [...new Set(risks.map(({ code }) => code))]
      .sort()
      .map((code) => [code, risks.filter((risk) => risk.code === code).length])
  );
  const payload = {
    schemaVersion: 1,
    contractId: A_ATOMICITY_RISK_AUDIT_CONTRACT_ID,
    sourceUnitPlanSha256: plan.planSha256,
    dynamicManifestSha256: manifest.manifestSha256,
    summary: {
      semanticRequirements: manifest.requirements.length,
      semanticComponents: manifest.requirements.reduce(
        (sum, requirement) => sum + requirement.components.length,
        0
      ),
      reviewRequiredUnits: riskUnitIds.size,
      reviewRequiredComponents: riskComponentIds.size,
      risks: risks.length,
      byCode,
      atomicityReviewPassed: risks.length === 0,
    },
    risks,
    proofLimit:
      "Deterministischer Hochrisikofilter für eine nachfolgende source-bound Re-Atomisierung. Ein Treffer beweist noch keinen Fachfehler und darf keine automatische Regex-Splittung auslösen; null Treffer beweisen keine vollständige Atomizität.",
  };
  return {
    ...payload,
    auditSha256: sha256(
      `${A_ATOMICITY_RISK_AUDIT_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

function compareADrivenManifestAtomicity({
  baselineManifest,
  baselineAudit,
  currentManifest,
  currentAudit,
} = {}) {
  const acceptedAuditContracts = new Set([
    "LF_A_DYNAMIC_ATOMICITY_RISK_AUDIT_V1",
    A_ATOMICITY_RISK_AUDIT_CONTRACT_ID,
  ]);
  for (const [manifest, audit] of [
    [baselineManifest, baselineAudit],
    [currentManifest, currentAudit],
  ])
    if (
      manifest?.contractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
      !acceptedAuditContracts.has(audit?.contractId) ||
      audit.sourceUnitPlanSha256 !== manifest.sourceUnitPlanSha256 ||
      audit.dynamicManifestSha256 !== manifest.manifestSha256 ||
      !Array.isArray(manifest.requirements) ||
      !Array.isArray(audit.risks)
    )
      throw new Error("LF_A_ATOMICITY_COMPARISON_INPUT_INVALID");
  if (
    baselineManifest.sourceUnitPlanSha256 !==
    currentManifest.sourceUnitPlanSha256
  )
    throw new Error("LF_A_ATOMICITY_COMPARISON_SOURCE_PLAN_MISMATCH");

  const riskProfile = (audit) => {
    const counts = new Map();
    for (const risk of audit.risks) {
      const owningUnitId =
        risk.owningUnitId || risk.sourceUnitIds?.at(-1) || null;
      if (
        !owningUnitId ||
        typeof risk.code !== "string" ||
        typeof risk.componentType !== "string"
      )
        throw new Error("LF_A_ATOMICITY_COMPARISON_RISK_INVALID");
      const key = `${owningUnitId}:${risk.code}:${risk.componentType}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  };
  const baselineProfile = riskProfile(baselineAudit);
  const currentProfile = riskProfile(currentAudit);
  const riskGroupDelta = [
    ...new Set([...baselineProfile.keys(), ...currentProfile.keys()]),
  ]
    .sort()
    .map((key) => {
      const [owningUnitId, code, componentType] = key.split(":");
      const baseline = baselineProfile.get(key) || 0;
      const current = currentProfile.get(key) || 0;
      return {
        owningUnitId,
        code,
        componentType,
        baseline,
        current,
        delta: current - baseline,
      };
    });
  const manifestCounts = (manifest) => ({
    semanticRequirements: manifest.requirements.length,
    semanticComponents: manifest.requirements.reduce(
      (sum, requirement) => sum + requirement.components.length,
      0
    ),
    sourceBlocks:
      manifest.summary?.sourceBlocks ??
      manifest.summary?.totalSourceBlocks ??
      null,
    unresolvedUnits: manifest.summary?.unresolvedUnits ?? null,
    reviewRequiredBlocks: manifest.summary?.reviewRequiredBlocks ?? null,
    allBlocksTerminal: manifest.summary?.allBlocksTerminal === true,
  });
  const auditCounts = (audit) => ({
    reviewRequiredUnits:
      audit.summary?.reviewRequiredUnits ??
      new Set(
        audit.risks.map(
          (risk) => risk.owningUnitId || risk.sourceUnitIds.at(-1)
        )
      ).size,
    reviewRequiredComponents:
      audit.summary?.reviewRequiredComponents ??
      new Set(
        audit.risks.map(
          (risk) =>
            risk.dynamicComponentId ||
            `${risk.owningUnitId || risk.sourceUnitIds.at(-1)}:${risk.componentType}:${risk.label || ""}`
        )
      ).size,
    risks: audit.risks.length,
  });
  const baseline = {
    manifestSha256: baselineManifest.manifestSha256,
    auditSha256: baselineAudit.auditSha256,
    ...manifestCounts(baselineManifest),
    ...auditCounts(baselineAudit),
  };
  const current = {
    manifestSha256: currentManifest.manifestSha256,
    auditSha256: currentAudit.auditSha256,
    ...manifestCounts(currentManifest),
    ...auditCounts(currentAudit),
  };
  const sourceIntegrityMaintained =
    baseline.sourceBlocks === current.sourceBlocks &&
    current.allBlocksTerminal &&
    current.unresolvedUnits === 0 &&
    current.reviewRequiredBlocks === 0;
  const payload = {
    schemaVersion: 1,
    contractId: A_ATOMICITY_COMPARISON_CONTRACT_ID,
    sourceUnitPlanSha256: baselineManifest.sourceUnitPlanSha256,
    baseline,
    current,
    delta: {
      semanticRequirements:
        current.semanticRequirements - baseline.semanticRequirements,
      semanticComponents:
        current.semanticComponents - baseline.semanticComponents,
      reviewRequiredUnits:
        current.reviewRequiredUnits - baseline.reviewRequiredUnits,
      reviewRequiredComponents:
        current.reviewRequiredComponents - baseline.reviewRequiredComponents,
      risks: current.risks - baseline.risks,
    },
    riskGroups: {
      resolved: riskGroupDelta.filter(({ baseline, current }) =>
        Boolean(baseline && !current)
      ),
      reduced: riskGroupDelta.filter(
        ({ baseline, current }) => current > 0 && current < baseline
      ),
      unchanged: riskGroupDelta.filter(
        ({ baseline, current }) => baseline > 0 && current === baseline
      ),
      increased: riskGroupDelta.filter(
        ({ baseline, current }) => baseline > 0 && current > baseline
      ),
      new: riskGroupDelta.filter(({ baseline, current }) =>
        Boolean(!baseline && current)
      ),
    },
    assessment: {
      sourceIntegrityMaintained,
      atomicitySignalsReduced: current.risks < baseline.risks,
      noNewRiskGroups: riskGroupDelta.every(
        ({ baseline, current }) => baseline > 0 || current === 0
      ),
      candidateImprovement:
        sourceIntegrityMaintained && current.risks < baseline.risks,
      productGatePassed: false,
    },
    proofLimit:
      "Ein reduzierter heuristischer Risikowert bei erhaltener Quellenintegrität ist nur Kandidatenevidenz. Er beweist weder fachlich richtige Atomisierung noch Generalisierung oder Produktreife; verbleibende, neue und weggefallene Gruppen müssen source-bound geprüft werden.",
  };
  return {
    ...payload,
    comparisonSha256: sha256(
      `${A_ATOMICITY_COMPARISON_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
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
    const compatibleTypes =
      LEGACY_ROLE_TO_DYNAMIC_TYPES[component.legacyFactRole] || [];
    const sourceOverlappingDynamicTargets = dynamicComponents
      .filter(
        (candidate) =>
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
    const directlyCompatibleDynamicTargets = sourceOverlappingDynamicTargets
      .filter((candidate) =>
        compatibleTypes.includes(candidate.dynamicComponentType)
      )
      .map((candidate) => ({
        ...candidate,
        matchScope: "DIRECT_COMPONENT_SOURCE",
      }));
    const requirementScopedCompatibleDynamicTargets =
      directlyCompatibleDynamicTargets.length > 0
        ? []
        : dynamic
            .filter(
              (requirement) =>
                intersection(
                  requirement.sourceBlockIds,
                  component.sourceBlockIds
                ).length > 0
            )
            .flatMap((requirement) =>
              requirement.components
                .filter(
                  (candidate) =>
                    compatibleTypes.includes(candidate.dynamicComponentType) &&
                    intersection(
                      candidate.sourceBlockIds,
                      component.sourceBlockIds
                    ).length === 0
                )
                .map((candidate) => ({
                  ...candidate,
                  matchScope: "SAME_DYNAMIC_REQUIREMENT",
                  overlappingRequirementSourceBlockIds: intersection(
                    requirement.sourceBlockIds,
                    component.sourceBlockIds
                  ),
                }))
            );
    const compatibleDynamicTargets = [
      ...directlyCompatibleDynamicTargets,
      ...requirementScopedCompatibleDynamicTargets,
    ];
    return {
      ...component,
      relationCandidate:
        sourceOverlappingDynamicTargets.length === 0 &&
        requirementScopedCompatibleDynamicTargets.length === 0
          ? "MISSING"
          : directlyCompatibleDynamicTargets.length === 0 &&
              requirementScopedCompatibleDynamicTargets.length > 0
            ? "INHERITED_ROLE_CANDIDATE"
            : compatibleDynamicTargets.length === 0
              ? "ROLE_INCOMPATIBLE"
              : compatibleDynamicTargets.length === 1
                ? "ONE_TO_ONE_CANDIDATE"
                : "SPLIT_CANDIDATE",
      sourceOverlappingDynamicTargets,
      requirementScopedCompatibleDynamicTargets,
      compatibleDynamicTargets,
    };
  });
  const dynamicComponentCrosswalk = dynamicComponents.map((component) => {
    const sourceOverlappingLegacySources = legacyComponents
      .filter(
        (candidate) =>
          intersection(candidate.sourceBlockIds, component.sourceBlockIds)
            .length > 0
      )
      .map(
        ({
          legacyRequirementId,
          legacyComponentId,
          legacyFactRole,
          label,
          sourceBlockIds,
        }) => ({
          legacyRequirementId,
          legacyComponentId,
          legacyFactRole,
          label,
          overlappingSourceBlockIds: intersection(
            sourceBlockIds,
            component.sourceBlockIds
          ),
        })
      );
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
        sourceOverlappingLegacySources.length === 0
          ? "ADDITIONAL"
          : compatibleLegacySources.length === 0
            ? "ROLE_INCOMPATIBLE"
            : compatibleLegacySources.length === 1
              ? "ONE_TO_ONE_CANDIDATE"
              : "MERGED_CANDIDATE",
      sourceOverlappingLegacySources,
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
  const {
    reviewedNonOperativeUnits,
    suspiciousNonOperativeUnits,
    reviewedOperativeUnits,
  } = assessADrivenTerminalRoleRisks({
    plan,
    manifest,
    legacySourceBlockIds,
  });

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
    suspiciousOperativeUnits: reviewedOperativeUnits.length,
    reviewedNonOperativeUnits: reviewedNonOperativeUnits.length,
    resolvedNonOperativeUnits:
      reviewedNonOperativeUnits.length - suspiciousNonOperativeUnits.length,
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
    roleIncompatibleLegacyComponents: componentCrosswalk.filter(
      ({ relationCandidate }) => relationCandidate === "ROLE_INCOMPATIBLE"
    ).length,
    inheritedRoleCandidateLegacyComponents: componentCrosswalk.filter(
      ({ relationCandidate }) =>
        relationCandidate === "INHERITED_ROLE_CANDIDATE"
    ).length,
    splitLegacyComponents: componentCrosswalk.filter(
      ({ relationCandidate }) => relationCandidate === "SPLIT_CANDIDATE"
    ).length,
    additionalDynamicComponents: dynamicComponentCrosswalk.filter(
      ({ relationCandidate }) => relationCandidate === "ADDITIONAL"
    ).length,
    roleIncompatibleDynamicComponents: dynamicComponentCrosswalk.filter(
      ({ relationCandidate }) => relationCandidate === "ROLE_INCOMPATIBLE"
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
  summary.operativeReviewPassed = summary.suspiciousOperativeUnits === 0;
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
    reviewedNonOperativeUnits,
    suspiciousNonOperativeUnits,
    reviewedOperativeUnits,
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
  A_ATOMICITY_COMPARISON_CONTRACT_ID,
  A_ATOMICITY_RISK_AUDIT_CONTRACT_ID,
  A_STATUS_AUDIT_CONTRACT_ID,
  LEGACY_ROLE_TO_DYNAMIC_TYPES,
  assessADrivenTerminalRoleRisks,
  assessADrivenManifestAtomicityRisks,
  buildADrivenAStatusAudit,
  compareADrivenManifestAtomicity,
};
