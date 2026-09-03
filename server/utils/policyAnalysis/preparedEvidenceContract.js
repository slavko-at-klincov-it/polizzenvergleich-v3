const {
  CONFLICT_STATE,
  COVERAGE_EFFECT,
  EVIDENCE_PRESENCE,
  rollupCategoryResult,
} = require("./categoryResultContract");
const {
  deterministicCategoryCandidateBinding,
  deterministicCategoryPreparedDecision,
  resolvedCategoryView,
} = require("./deterministicCategoryEvidenceRules");
const {
  certifyDeterministicTerminalRejection,
} = require("./deterministicTerminalRejectionContract");
const {
  assertTargetRequirementSelection,
} = require("./targetRequirementSelection");
const {
  VS22_OTHER_SCOPE_REJECTION,
  isVs22LiabilityOrStorageOccurrence,
} = require("./vs22WasteScopeContract");

const PREPARED_EVIDENCE_SCHEMA_VERSION = 1;
const DOCUMENT_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  FRAMEWORK_TERMS: "FRAMEWORK_TERMS",
  PROPOSAL: "PROPOSAL",
});
const DOCUMENT_APPLICABILITY = Object.freeze({
  ACTIVE: "ACTIVE",
  CONDITIONAL: "CONDITIONAL",
  PROPOSED_ONLY: "PROPOSED_ONLY",
  UNKNOWN: "UNKNOWN",
});
const REQUESTED_FIELD_STATUS = Object.freeze({
  NOT_REQUIRED: "NOT_REQUIRED",
  NOT_EVALUATED: "NOT_EVALUATED",
});
const ALLOWED_EFFECTS = new Set(Object.values(COVERAGE_EFFECT));
const ALLOWED_CONFLICTS = new Set(Object.values(CONFLICT_STATE));
const ALLOWED_TRIAGE_BINDINGS = new Set([
  "DIRECT",
  "NARROW_SCOPE",
  "MENTION_ONLY",
  "UNRESOLVED",
]);
const NON_COVERAGE_FACT_ROLES = new Set([
  "CONDITION",
  "DEFINITION",
  "LIMIT",
  "DEDUCTIBLE",
  "DOCUMENT_STATUS",
]);

function preparedError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function exactKeys(value, expected, code) {
  const actual = Object.keys(value || {}).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  )
    throw preparedError(code, actual.join(","));
}

function applicabilityFor(documentStatus, evidencePresence) {
  if (evidencePresence !== EVIDENCE_PRESENCE.FOUND)
    return DOCUMENT_APPLICABILITY.UNKNOWN;
  if (documentStatus === DOCUMENT_STATUS.ACTIVE)
    return DOCUMENT_APPLICABILITY.ACTIVE;
  if (documentStatus === DOCUMENT_STATUS.FRAMEWORK_TERMS)
    return DOCUMENT_APPLICABILITY.CONDITIONAL;
  if (documentStatus === DOCUMENT_STATUS.PROPOSAL)
    return DOCUMENT_APPLICABILITY.PROPOSED_ONLY;
  throw preparedError("PREPARED_DOCUMENT_STATUS_INVALID", documentStatus);
}

function validateWorksheet(worksheet, expectedTargetSelectionDigestSha256) {
  assertTargetRequirementSelection(worksheet, {
    expectedSelectionDigestSha256: expectedTargetSelectionDigestSha256,
  });
  if (
    worksheet?.candidateOnly !== true ||
    !Array.isArray(worksheet.requirements)
  )
    throw preparedError("PREPARED_WORKSHEET_INVALID");
}

function validateCandidateTriage({ worksheet, candidateTriage }) {
  if (candidateTriage === null || candidateTriage === undefined) return null;
  if (!Array.isArray(candidateTriage))
    throw preparedError("PREPARED_TRIAGE_INVALID");

  const expectedById = new Map();
  for (const requirement of worksheet.requirements)
    for (const component of requirement.components)
      for (const occurrence of component.occurrences || []) {
        const candidateId = String(occurrence.candidateId || "");
        if (!candidateId || expectedById.has(candidateId))
          throw preparedError(
            "PREPARED_WORKSHEET_CANDIDATE_INVALID",
            candidateId
          );
        expectedById.set(candidateId, {
          requirementId: requirement.id,
          componentId: component.id,
        });
      }

  const triageById = new Map();
  for (const judgement of candidateTriage) {
    const candidateId = String(judgement?.candidateId || "");
    if (!expectedById.has(candidateId))
      throw preparedError("PREPARED_TRIAGE_CANDIDATE_UNKNOWN", candidateId);
    if (triageById.has(candidateId))
      throw preparedError("PREPARED_TRIAGE_CANDIDATE_DUPLICATE", candidateId);
    const expected = expectedById.get(candidateId);
    if (
      judgement.requirementId !== expected.requirementId ||
      judgement.componentId !== expected.componentId
    )
      throw preparedError("PREPARED_TRIAGE_IDENTITY_MISMATCH", candidateId);
    if (!ALLOWED_TRIAGE_BINDINGS.has(judgement.binding))
      throw preparedError(
        "PREPARED_TRIAGE_BINDING_INVALID",
        `${candidateId}:${String(judgement.binding)}`
      );
    triageById.set(candidateId, judgement.binding);
  }
  const missing = [...expectedById.keys()].filter((id) => !triageById.has(id));
  if (missing.length)
    throw preparedError(
      "PREPARED_TRIAGE_COVERAGE_INCOMPLETE",
      missing.join(",")
    );
  return triageById;
}

function governingScopeLead(value) {
  const text = String(value || "");
  const markers = [
    /Nicht\s+versichert(?:\s+im\s+Rahmen[^:\n]{0,140})?\s+sind/giu,
    /(?<!Nicht\s)Versichert\s+sind/giu,
    /Zus[aä]tzlich[^\n]{0,160}\bversichert\b/giu,
    /Zus[aä]tzlich[\s\S]{0,220}?mitversichert/giu,
    /Katastrophen\b/giu,
  ];
  let lastStart = -1;
  for (const marker of markers)
    for (const match of text.matchAll(marker))
      if (match.index > lastStart) lastStart = match.index;
  if (lastStart >= 0) return text.slice(lastStart);
  return text.slice(-800);
}

function serverScopeRejection({
  worksheet,
  requirement,
  component,
  occurrence,
}) {
  const evidenceText = `${occurrence.scopeLead?.text || ""}\n${
    occurrence.context?.text || ""
  }`;
  if (
    worksheet.catalog?.categoryView === "VS" &&
    requirement.id === "VS-04" &&
    (occurrence.exactText?.trim().toLocaleLowerCase("de-AT") ===
      "pauschalversicherungssumme" ||
      (occurrence.exactText?.trim().toLocaleLowerCase("de-AT") ===
        "sachverständigengutachten" &&
        !/(?:Versicherungssumme[\s\S]{0,180}(?:ermittel|festsetz|entsprech)|(?:Gutachten|Neuwertschätzgutachten)[\s\S]{0,180}Versicherungssumme)/iu.test(
          occurrence.context?.text || ""
        )) ||
      /(?:Haftpflicht|AHVB|Schadenersatzverpflichtungen|Pauschaldeckungssumme|Versicherungsfälle\s+eines\s+Jahres)/iu.test(
        evidenceText
      ))
  )
    return "VS_04_SUM_LABEL_NOT_BUILDING_SUM_METHOD";
  if (
    worksheet.catalog?.categoryView === "VS" &&
    requirement.id === "VS-22" &&
    isVs22LiabilityOrStorageOccurrence(occurrence)
  )
    return VS22_OTHER_SCOPE_REJECTION;
  if (
    worksheet.catalog?.categoryView === "EL" &&
    /\bSchadenersatzverpflichtungen\b/iu.test(evidenceText)
  )
    return "EL_OTHER_SCOPE_LIABILITY";
  if (
    worksheet.catalog?.categoryView === "FE" &&
    requirement.id === "FE-D01" &&
    /\b(?:Sondermüll|Sonderabfall|gefährlich\p{L}*\s+Abfall)\b/iu.test(
      evidenceText
    )
  )
    return "FE_D01_NARROW_WASTE_SCOPE";
  if (
    worksheet.catalog?.categoryView === "FE" &&
    requirement.id === "FE-D01" &&
    component.factRole === "COST" &&
    /\bEinsätze\s+von\s+Feuerwehren\b/iu.test(occurrence.exactText) &&
    /\bSchäden\s+durch\b/iu.test(evidenceText)
  )
    return "FE_D01_DAMAGE_NOT_COST";
  return null;
}

/**
 * Reduces a server-owned occurrence worksheet to one small decision target per
 * atomic component. Sources and identities remain server-owned.
 * Role: transform. Side effects: none.
 */
function buildPreparedEvidenceTargets({
  worksheet,
  documentStatus,
  candidateTriage = null,
  expectedTargetSelectionDigestSha256 = null,
}) {
  validateWorksheet(worksheet, expectedTargetSelectionDigestSha256);
  applicabilityFor(documentStatus, EVIDENCE_PRESENCE.FOUND);
  const triageById = validateCandidateTriage({ worksheet, candidateTriage });
  return worksheet.requirements.flatMap((requirement) =>
    requirement.components.map((component) => {
      const candidates = [];
      const serverRejectedCandidates = [];
      const unresolvedCandidateIds = [];
      for (const occurrence of component.occurrences) {
        const triagedCandidateBinding =
          triageById?.get(occurrence.candidateId) || null;
        const deterministicBinding = deterministicCategoryCandidateBinding({
          worksheet,
          requirement,
          component,
          occurrence,
        });
        const terminalRejection = certifyDeterministicTerminalRejection({
          categoryView: resolvedCategoryView(worksheet, requirement),
          requirement,
          component,
          occurrence,
          deterministicBinding,
        });
        // A very small set of category rules is server-authoritative because
        // the clause itself explicitly governs the exact atomic component.
        // This prevents a model MENTION_ONLY result from discarding that
        // evidence while leaving all ordinary triage decisions untouched.
        const candidateBinding = terminalRejection
          ? "MENTION_ONLY"
          : deterministicBinding?.authoritative
            ? deterministicBinding.binding
            : triagedCandidateBinding;
        if (candidateBinding === "MENTION_ONLY") {
          serverRejectedCandidates.push({
            candidateId: occurrence.candidateId,
            reason: "TRIAGE_MENTION_ONLY",
            ...(terminalRejection || {}),
          });
          continue;
        }
        if (candidateBinding === "UNRESOLVED") {
          unresolvedCandidateIds.push(occurrence.candidateId);
          serverRejectedCandidates.push({
            candidateId: occurrence.candidateId,
            reason: "TRIAGE_UNRESOLVED",
          });
          continue;
        }
        const rejectionReason = serverScopeRejection({
          worksheet,
          requirement,
          component,
          occurrence,
        });
        if (rejectionReason) {
          serverRejectedCandidates.push({
            candidateId: occurrence.candidateId,
            reason: rejectionReason,
          });
          continue;
        }
        candidates.push({
          candidateId: occurrence.candidateId,
          ...(candidateBinding ? { candidateBinding } : {}),
          ...(deterministicBinding?.binding === candidateBinding
            ? { deterministicBindingBasis: deterministicBinding.basis }
            : {}),
          physicalPageNumber:
            occurrence.physicalPageNumber || occurrence.pageNumber,
          printedPageLabel: occurrence.printedPageLabel || null,
          exactText: occurrence.exactText,
          documentStart: Number.isInteger(occurrence.documentStart)
            ? occurrence.documentStart
            : null,
          documentEnd: Number.isInteger(occurrence.documentEnd)
            ? occurrence.documentEnd
            : null,
          contextUnitType: occurrence.context.unitType,
          contextText: occurrence.context.text,
          contextDocumentStart: Number.isInteger(
            occurrence.context.documentStart
          )
            ? occurrence.context.documentStart
            : null,
          objectClassificationContractId:
            occurrence.objectClassificationGovernorHint?.contractId || null,
          scopeLeadText: governingScopeLead(
            `${occurrence.coverageGovernorHint?.text || ""}\n${
              occurrence.scopeLead?.text || ""
            }`
          ),
          pageScopeHints: Array.isArray(occurrence.pageScopeHints)
            ? occurrence.pageScopeHints.map(({ scopeKey, text }) => ({
                scopeKey,
                text,
              }))
            : [],
          bindingGroupId: occurrence.bindingGroupId || null,
        });
      }
      return {
        targetId: `prepared-target:${requirement.id}:${component.id}`,
        categoryView: resolvedCategoryView(worksheet, requirement),
        requirementId: requirement.id,
        requirementLabel: requirement.label,
        componentId: component.id,
        componentLabel: component.label,
        factRole: component.factRole,
        documentStatus,
        candidates,
        serverRejectedCandidates,
        unresolvedCandidateIds,
      };
    })
  );
}

function buildSinglePreparedEvidencePayload({ target }) {
  return {
    schemaVersion: PREPARED_EVIDENCE_SCHEMA_VERSION,
    task: "CLASSIFY_ONE_ATOMIC_EVIDENCE_COMPONENT",
    target,
    allowedValues: {
      coverageEffect: Object.values(COVERAGE_EFFECT),
      conflictState: Object.values(CONFLICT_STATE),
    },
  };
}

function normalizeResponse(responseText) {
  const response = String(responseText || "").trim();
  const fenced = response.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/iu);
  return fenced ? fenced[1].trim() : response;
}

function serverNormalizedCoverageEffect({
  target,
  selectedCandidateIds,
  coverageEffect,
}) {
  if (
    coverageEffect !== COVERAGE_EFFECT.DEFINED ||
    !["COST", "PERIL", "DAMAGE", "INSURED_OBJECT"].includes(target.factRole)
  )
    return { coverageEffect, normalizedByServer: false };
  const selected = new Set(selectedCandidateIds);
  const hasExplicitPositiveRule = target.candidates
    .filter(({ candidateId }) => selected.has(candidateId))
    .some(({ contextText, scopeLeadText }) =>
      /\b(?:mitversichert|Mitversichert\s+gelten|Versicherte\s+Gefahren|versichert\s+sind|eingeschlossen|maximal|bis\s+zu|bis\s+\d)\b/iu.test(
        `${scopeLeadText || ""}\n${contextText || ""}`
      )
    );
  return {
    coverageEffect: hasExplicitPositiveRule
      ? COVERAGE_EFFECT.INCLUDED
      : coverageEffect,
    normalizedByServer: hasExplicitPositiveRule,
  };
}

function hasExplicitPositiveCandidateRule(candidate) {
  const text = `${candidate.scopeLeadText || ""}\n${candidate.contextText || ""}`;
  const exactContext = String(candidate.contextText || "");
  if (
    /\b(?:nicht\s+versichert|ausgeschlossen|kein\s+Versicherungsschutz)\b/iu.test(
      exactContext
    )
  )
    return false;
  return /\b(?:mitversichert(?:\s+gelten)?|versichert\s+(?:sind|gilt)|auf\s+Erstes\s+Risiko|eingeschlossen)\b/iu.test(
    text
  );
}

function serverExpandedSelectedCandidateIds({
  target,
  selectedCandidateIds,
  coverageEffect,
  conflictState,
}) {
  if (
    selectedCandidateIds.length === 0 ||
    coverageEffect !== COVERAGE_EFFECT.INCLUDED ||
    conflictState !== CONFLICT_STATE.NONE
  )
    return { selectedCandidateIds, expandedByServer: false };
  const selected = new Set(selectedCandidateIds);
  for (const candidate of target.candidates) {
    if (
      candidate.candidateBinding === "NARROW_SCOPE" &&
      hasExplicitPositiveCandidateRule(candidate)
    )
      selected.add(candidate.candidateId);
  }
  return {
    selectedCandidateIds: target.candidates
      .map(({ candidateId }) => candidateId)
      .filter((candidateId) => selected.has(candidateId)),
    expandedByServer: selected.size > selectedCandidateIds.length,
  };
}

function selectedScopePicture({ target, selectedCandidateIds }) {
  const selected = new Set(selectedCandidateIds);
  const bindings = new Set(
    target.candidates
      .filter(({ candidateId }) => selected.has(candidateId))
      .map(({ candidateBinding }) => candidateBinding)
      .filter(Boolean)
  );
  if (bindings.size === 0) return "UNKNOWN";
  const hasDirect = bindings.has("DIRECT");
  const hasNarrow = bindings.has("NARROW_SCOPE");
  if (hasDirect && hasNarrow) return "GENERAL_AND_NARROW";
  if (hasDirect) return "GENERAL";
  if (hasNarrow) return "NARROW_ONLY";
  return "UNKNOWN";
}

/**
 * Converts an explicit deterministic category rule into the same immutable
 * evidence judgement shape used for validated model answers. Returning null
 * keeps the target on the model path.
 * Role: decide. Side effects: none.
 */
function buildDeterministicPreparedEvidenceJudgement(target) {
  const decision = deterministicCategoryPreparedDecision(target);
  if (!decision) return null;
  return {
    targetId: target.targetId,
    requirementId: target.requirementId,
    componentId: target.componentId,
    selectedCandidateIds: decision.selectedCandidateIds,
    candidateIdCorrections: [],
    unresolvedCandidateIds: [...(target.unresolvedCandidateIds || [])],
    evidencePresence: EVIDENCE_PRESENCE.FOUND,
    coverageEffect: decision.coverageEffect,
    conflictState: CONFLICT_STATE.NONE,
    selectedScopePicture: selectedScopePicture({
      target,
      selectedCandidateIds: decision.selectedCandidateIds,
    }),
    documentApplicability: applicabilityFor(
      target.documentStatus,
      EVIDENCE_PRESENCE.FOUND
    ),
    decisionOwner: `SERVER_${decision.basis}`,
  };
}

function isBoundedOpaqueIdEdit(left, right, maxDistance = 2) {
  if (
    !String(left).startsWith("candidate:") ||
    !String(right).startsWith("candidate:") ||
    Math.abs(left.length - right.length) > maxDistance
  )
    return false;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
      rowMinimum = Math.min(rowMinimum, current[rightIndex]);
    }
    if (rowMinimum > maxDistance) return false;
    previous = current;
  }
  return previous[right.length] > 0 && previous[right.length] <= maxDistance;
}

function repairSelectedCandidateIds({
  selectedCandidateIds,
  allowedIds,
  allowUniqueCandidateIdRepair,
}) {
  const corrections = [];
  const repaired = selectedCandidateIds.map((candidateId) => {
    if (allowedIds.has(candidateId)) return candidateId;
    if (!allowUniqueCandidateIdRepair)
      throw preparedError("PREPARED_SELECTED_ID_UNKNOWN", candidateId);
    const matches = [...allowedIds].filter((allowedId) =>
      isBoundedOpaqueIdEdit(candidateId, allowedId)
    );
    if (matches.length !== 1)
      throw preparedError("PREPARED_SELECTED_ID_UNKNOWN", candidateId);
    corrections.push({ observed: candidateId, repaired: matches[0] });
    return matches[0];
  });
  if (new Set(repaired).size !== repaired.length)
    throw preparedError("PREPARED_SELECTED_ID_DUPLICATE_AFTER_REPAIR");
  return { repaired, corrections };
}

function parseAndValidatePreparedEvidenceResponse({
  responseText,
  target,
  allowUniqueCandidateIdRepair = false,
}) {
  let parsed;
  try {
    parsed = JSON.parse(normalizeResponse(responseText));
  } catch {
    throw preparedError("PREPARED_RESPONSE_JSON_INVALID", target.targetId);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw preparedError("PREPARED_RESPONSE_INVALID", target.targetId);
  exactKeys(
    parsed,
    [
      "schemaVersion",
      "componentId",
      "selectedCandidateIds",
      "coverageEffect",
      "conflictState",
    ],
    "PREPARED_RESPONSE_KEYS_INVALID"
  );
  if (parsed.schemaVersion !== PREPARED_EVIDENCE_SCHEMA_VERSION)
    throw preparedError("PREPARED_RESPONSE_SCHEMA_INVALID", target.targetId);
  if (parsed.componentId !== target.componentId)
    throw preparedError("PREPARED_COMPONENT_ID_MISMATCH", target.targetId);
  if (!Array.isArray(parsed.selectedCandidateIds))
    throw preparedError("PREPARED_SELECTED_IDS_INVALID", target.targetId);
  const modelSelectedCandidateIds = [...parsed.selectedCandidateIds];
  if (
    new Set(modelSelectedCandidateIds).size !== modelSelectedCandidateIds.length
  )
    throw preparedError("PREPARED_SELECTED_ID_DUPLICATE", target.targetId);
  const allowedIds = new Set(
    target.candidates.map(({ candidateId }) => candidateId)
  );
  const candidateIdRepair = repairSelectedCandidateIds({
    selectedCandidateIds: modelSelectedCandidateIds,
    allowedIds,
    allowUniqueCandidateIdRepair,
  });
  modelSelectedCandidateIds.splice(
    0,
    modelSelectedCandidateIds.length,
    ...candidateIdRepair.repaired
  );
  if (!ALLOWED_EFFECTS.has(parsed.coverageEffect))
    throw preparedError("PREPARED_EFFECT_INVALID", target.targetId);
  if (!ALLOWED_CONFLICTS.has(parsed.conflictState))
    throw preparedError("PREPARED_CONFLICT_INVALID", target.targetId);
  const expandedSelection = serverExpandedSelectedCandidateIds({
    target,
    selectedCandidateIds: modelSelectedCandidateIds,
    coverageEffect: parsed.coverageEffect,
    conflictState: parsed.conflictState,
  });
  const selectedCandidateIds = expandedSelection.selectedCandidateIds;
  const evidencePresence =
    selectedCandidateIds.length > 0
      ? EVIDENCE_PRESENCE.FOUND
      : EVIDENCE_PRESENCE.NOT_FOUND;
  if (
    evidencePresence === EVIDENCE_PRESENCE.NOT_FOUND &&
    (parsed.coverageEffect !== COVERAGE_EFFECT.UNKNOWN ||
      parsed.conflictState !== CONFLICT_STATE.NONE)
  )
    throw preparedError(
      "PREPARED_MISSING_EVIDENCE_INCONSISTENT",
      target.targetId
    );
  if (
    parsed.conflictState !== CONFLICT_STATE.NONE &&
    parsed.coverageEffect !== COVERAGE_EFFECT.UNKNOWN
  )
    throw preparedError(
      "PREPARED_CONFLICT_EFFECT_INCONSISTENT",
      target.targetId
    );
  const normalizedEffect = serverNormalizedCoverageEffect({
    target,
    selectedCandidateIds,
    coverageEffect: parsed.coverageEffect,
  });
  return {
    targetId: target.targetId,
    requirementId: target.requirementId,
    componentId: target.componentId,
    selectedCandidateIds,
    candidateIdCorrections: candidateIdRepair.corrections,
    unresolvedCandidateIds: [...(target.unresolvedCandidateIds || [])],
    evidencePresence,
    coverageEffect: normalizedEffect.coverageEffect,
    conflictState: parsed.conflictState,
    selectedScopePicture: selectedScopePicture({
      target,
      selectedCandidateIds,
    }),
    documentApplicability: applicabilityFor(
      target.documentStatus,
      evidencePresence
    ),
    decisionOwner: expandedSelection.expandedByServer
      ? "MODEL_EFFECT_SERVER_POSITIVE_SCOPE_UNION"
      : normalizedEffect.normalizedByServer
        ? "MODEL_SELECTION_SERVER_EFFECT_RULE"
        : "MODEL",
  };
}

function terminalMissingJudgement(target) {
  return {
    targetId: target.targetId,
    requirementId: target.requirementId,
    componentId: target.componentId,
    selectedCandidateIds: [],
    unresolvedCandidateIds: [],
    evidencePresence: EVIDENCE_PRESENCE.NOT_FOUND,
    coverageEffect: COVERAGE_EFFECT.UNKNOWN,
    conflictState: CONFLICT_STATE.NONE,
    selectedScopePicture: "UNKNOWN",
    documentApplicability: DOCUMENT_APPLICABILITY.UNKNOWN,
    decisionOwner: "SERVER",
  };
}

function terminalUnresolvedJudgement(target) {
  return {
    targetId: target.targetId,
    requirementId: target.requirementId,
    componentId: target.componentId,
    selectedCandidateIds: [],
    unresolvedCandidateIds: [...target.unresolvedCandidateIds],
    evidencePresence: EVIDENCE_PRESENCE.FOUND,
    coverageEffect: COVERAGE_EFFECT.UNKNOWN,
    conflictState: CONFLICT_STATE.NONE,
    selectedScopePicture: "UNKNOWN",
    documentApplicability: applicabilityFor(
      target.documentStatus,
      EVIDENCE_PRESENCE.FOUND
    ),
    decisionOwner: "SERVER_TRIAGE_UNRESOLVED",
  };
}

/**
 * Materializes validated atomic judgements and deterministic category rollups.
 * It never accepts model-authored sources, pages, quotes or unknown IDs.
 * Role: decide. Side effects: none.
 */
function materializePreparedEvidence({ worksheet, targets, judgements }) {
  validateWorksheet(worksheet);
  const targetById = new Map(
    targets.map((target) => [target.targetId, target])
  );
  const judgementByTargetId = new Map();
  for (const judgement of judgements) {
    if (!targetById.has(judgement.targetId))
      throw preparedError(
        "PREPARED_JUDGEMENT_TARGET_UNKNOWN",
        judgement.targetId
      );
    if (judgementByTargetId.has(judgement.targetId))
      throw preparedError("PREPARED_JUDGEMENT_DUPLICATE", judgement.targetId);
    judgementByTargetId.set(judgement.targetId, judgement);
  }

  const completeJudgements = targets.map((target) => {
    if (target.candidates.length === 0)
      return target.unresolvedCandidateIds?.length
        ? terminalUnresolvedJudgement(target)
        : terminalMissingJudgement(target);
    const judgement = judgementByTargetId.get(target.targetId);
    if (!judgement)
      throw preparedError("PREPARED_JUDGEMENT_MISSING", target.targetId);
    return judgement;
  });
  const rollups = worksheet.requirements.map((requirement) => {
    const componentJudgements = requirement.components.map((component) =>
      completeJudgements.find(
        (judgement) =>
          judgement.requirementId === requirement.id &&
          judgement.componentId === component.id
      )
    );
    const categoryRollup = rollupCategoryResult({
      categoryId: requirement.id,
      requiredComponentIds: requirement.components.map(({ id }) => id),
      coverageComponentIds:
        requirement.coverageAggregationPolicy === "COVERAGE_ROLES_ONLY"
          ? requirement.components
              .filter(({ factRole }) => !NON_COVERAGE_FACT_ROLES.has(factRole))
              .map(({ id }) => id)
          : undefined,
      componentSatisfactionPolicy:
        requirement.componentSatisfactionPolicy || "ALL",
      componentResults: componentJudgements.map(
        ({ componentId, evidencePresence, coverageEffect, conflictState }) => ({
          componentId,
          evidencePresence,
          coverageEffect,
          conflictState,
        })
      ),
    });
    const requestedFields = Array.isArray(requirement.requestedFields)
      ? [...requirement.requestedFields]
      : [];
    return Object.freeze({
      ...categoryRollup,
      requestedFields,
      requestedFieldStatus:
        requestedFields.length === 0
          ? REQUESTED_FIELD_STATUS.NOT_REQUIRED
          : REQUESTED_FIELD_STATUS.NOT_EVALUATED,
    });
  });
  return { judgements: completeJudgements, rollups };
}

module.exports = {
  DOCUMENT_APPLICABILITY,
  DOCUMENT_STATUS,
  PREPARED_EVIDENCE_SCHEMA_VERSION,
  REQUESTED_FIELD_STATUS,
  applicabilityFor,
  buildDeterministicPreparedEvidenceJudgement,
  buildPreparedEvidenceTargets,
  buildSinglePreparedEvidencePayload,
  materializePreparedEvidence,
  parseAndValidatePreparedEvidenceResponse,
};
