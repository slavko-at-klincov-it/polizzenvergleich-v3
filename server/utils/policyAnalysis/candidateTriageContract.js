const TRIAGE_SCHEMA_VERSION = 6;
const {
  deterministicCategoryCandidateBinding,
  expectedCategoryScopeKeys,
  resolvedCategoryView,
} = require("./deterministicCategoryEvidenceRules");
const { DETERMINISTIC_BINDING } = require("./deterministicVsEvidenceRules");
const {
  assertTargetRequirementSelection,
} = require("./targetRequirementSelection");
const {
  VS22_OTHER_SCOPE_BASIS,
  isVs22LiabilityOrStorageOccurrence,
} = require("./vs22WasteScopeContract");

const CANDIDATE_BINDING = Object.freeze({
  DIRECT: "DIRECT",
  NARROW_SCOPE: "NARROW_SCOPE",
  MENTION_ONLY: "MENTION_ONLY",
  UNRESOLVED: "UNRESOLVED",
});

const ALLOWED_BINDINGS = new Set(Object.values(CANDIDATE_BINDING));
const SHARED_GOVERNOR = "SHARED_GOVERNOR";
const SHARED_SPAN = "SHARED_SPAN";
const RIGHT_HEADED_COORDINATION = "RIGHT_HEADED_COORDINATION";
const SAME_CANDIDATE_BINDING = "SAME_CANDIDATE_BINDING";
const ROLE_MATCH = Object.freeze({
  MATCH: "MATCH",
  MISMATCH: "MISMATCH",
  UNRESOLVED: "UNRESOLVED",
});
const SCOPE_MATCH = Object.freeze({
  GENERAL: "GENERAL",
  GENERAL_WITH_NARROW: "GENERAL_WITH_NARROW",
  NARROW: "NARROW",
  OTHER_SCOPE: "OTHER_SCOPE",
  UNRESOLVED: "UNRESOLVED",
});
const ALLOWED_ROLE_MATCHES = new Set(Object.values(ROLE_MATCH));
const ALLOWED_SCOPE_MATCHES = new Set(Object.values(SCOPE_MATCH));

function normalizeRuleText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("de")
    .replace(/ä/gu, "ae")
    .replace(/ö/gu, "oe")
    .replace(/ü/gu, "ue")
    .replace(/ß/gu, "ss")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function containsNormalizedPhrase(text, phrase) {
  const normalizedText = ` ${normalizeRuleText(text)} `;
  const normalizedPhrase = normalizeRuleText(phrase);
  return Boolean(
    normalizedPhrase && normalizedText.includes(` ${normalizedPhrase} `)
  );
}

function hasExplicitLocalCostRole(members, contextText) {
  const normalizedContext = normalizeRuleText(contextText);
  const costDefinitionGovernors = [
    ...normalizedContext.matchAll(
      /\b\p{L}*kosten\s+sind\s+kosten\s+fuer\b/giu
    ),
  ];
  return members.every((member) => {
    const normalizedExactText = normalizeRuleText(member.exactText);
    const firstWord = normalizedExactText.split(" ")[0] || "";
    if (firstWord.endsWith("kosten")) return true;
    if (
      [
        `Kosten für ${member.exactText}`,
        `Kosten für die ${member.exactText}`,
        `Aufwendungen für ${member.exactText}`,
        `Aufwendungen für die ${member.exactText}`,
      ].some((phrase) => containsNormalizedPhrase(contextText, phrase))
    )
      return true;
    const occurrenceIndex = normalizedContext.indexOf(normalizedExactText);
    if (
      occurrenceIndex < 0 ||
      normalizedContext.indexOf(
        normalizedExactText,
        occurrenceIndex + normalizedExactText.length
      ) >= 0
    )
      return false;
    return costDefinitionGovernors.some(({ index, 0: governorText }) => {
      const governedStart = index + governorText.length;
      return (
        occurrenceIndex >= governedStart && occurrenceIndex - governedStart <= 280
      );
    });
  });
}

function isScopeSentenceBoundary(text, index) {
  const character = text[index];
  if (character === ";" || character === "!" || character === "?") return true;
  if (character !== ".") return false;
  let cursor = index + 1;
  while (cursor < text.length && /\s/u.test(text[cursor])) cursor += 1;
  if (cursor >= text.length) return true;
  return /\p{Lu}/u.test(text[cursor]);
}

function occurrenceScopeSentence(occurrence) {
  const text = String(occurrence.context?.text || "");
  const contextStart = Number(occurrence.context?.documentStart);
  const occurrenceStart = Number(occurrence.documentStart) - contextStart;
  const occurrenceEnd = Number(occurrence.documentEnd) - contextStart;
  if (
    !Number.isInteger(contextStart) ||
    !Number.isInteger(occurrenceStart) ||
    !Number.isInteger(occurrenceEnd) ||
    occurrenceStart < 0 ||
    occurrenceEnd <= occurrenceStart ||
    occurrenceEnd > text.length ||
    text.slice(occurrenceStart, occurrenceEnd) !== occurrence.exactText
  )
    return null;

  let sentenceStart = 0;
  for (let index = occurrenceStart - 1; index >= 0; index -= 1) {
    if (!isScopeSentenceBoundary(text, index)) continue;
    sentenceStart = index + 1;
    break;
  }
  let sentenceEnd = text.length;
  for (let index = occurrenceEnd; index < text.length; index += 1) {
    if (!isScopeSentenceBoundary(text, index)) continue;
    sentenceEnd = index + 1;
    break;
  }
  return text.slice(sentenceStart, sentenceEnd);
}

function triageError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function exactKeys(value, expectedKeys, code) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  )
    throw triageError(code, actual.join(","));
}

function worksheetCandidates(worksheet) {
  assertTargetRequirementSelection(worksheet);
  if (
    worksheet?.candidateOnly !== true ||
    !Array.isArray(worksheet.requirements)
  )
    throw triageError("CANDIDATE_WORKSHEET_INVALID");

  const candidates = [];
  const candidateIds = new Set();
  for (const requirement of worksheet.requirements) {
    if (!Array.isArray(requirement.components))
      throw triageError("CANDIDATE_WORKSHEET_INVALID", requirement.id);
    for (const component of requirement.components) {
      if (!Array.isArray(component.occurrences))
        throw triageError(
          "CANDIDATE_WORKSHEET_INVALID",
          `${requirement.id}:${component.id}`
        );
      for (const occurrence of component.occurrences) {
        const candidateId = String(occurrence.candidateId || "");
        if (!candidateId.startsWith("candidate:"))
          throw triageError("CANDIDATE_ID_INVALID", candidateId);
        if (candidateIds.has(candidateId))
          throw triageError("DUPLICATE_WORKSHEET_CANDIDATE_ID", candidateId);
        candidateIds.add(candidateId);
        candidates.push({ requirement, component, occurrence });
      }
    }
  }
  return candidates;
}

function worksheetBindingGroups(worksheet, candidates) {
  const groups = Array.isArray(worksheet.bindingGroups)
    ? worksheet.bindingGroups
    : [];
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.occurrence.candidateId, candidate])
  );
  const groupIds = new Set();
  const groupIdByCandidateId = new Map();

  for (const group of groups) {
    if (!group || typeof group !== "object" || Array.isArray(group))
      throw triageError("TRIAGE_BINDING_GROUP_INVALID");
    exactKeys(
      group,
      [
        "id",
        "requirementId",
        "type",
        "constraint",
        "governorText",
        "candidateIds",
      ],
      "TRIAGE_BINDING_GROUP_KEYS_INVALID"
    );
    if (
      !String(group.id || "").startsWith("binding-group:") ||
      groupIds.has(group.id)
    )
      throw triageError("TRIAGE_BINDING_GROUP_ID_INVALID", group.id);
    groupIds.add(group.id);
    if (
      ![SHARED_GOVERNOR, SHARED_SPAN, RIGHT_HEADED_COORDINATION].includes(
        group.type
      ) ||
      group.constraint !== SAME_CANDIDATE_BINDING ||
      typeof group.governorText !== "string" ||
      group.governorText.trim().length === 0 ||
      !Array.isArray(group.candidateIds) ||
      group.candidateIds.length < 2
    )
      throw triageError("TRIAGE_BINDING_GROUP_INVALID", group.id);

    const componentIds = new Set();
    let sharedContextIdentity = null;
    const memberIds = new Set();
    for (const candidateId of group.candidateIds) {
      if (memberIds.has(candidateId))
        throw triageError(
          "TRIAGE_BINDING_GROUP_CANDIDATE_DUPLICATE",
          candidateId
        );
      memberIds.add(candidateId);
      const candidate = candidateById.get(candidateId);
      if (!candidate)
        throw triageError(
          "TRIAGE_BINDING_GROUP_CANDIDATE_UNKNOWN",
          candidateId
        );
      if (candidate.requirement.id !== group.requirementId)
        throw triageError(
          "TRIAGE_BINDING_GROUP_REQUIREMENT_MISMATCH",
          candidateId
        );
      if (groupIdByCandidateId.has(candidateId))
        throw triageError(
          "TRIAGE_CANDIDATE_MULTIPLE_BINDING_GROUPS",
          candidateId
        );
      groupIdByCandidateId.set(candidateId, group.id);
      componentIds.add(candidate.component.id);
      const contextIdentity = [
        candidate.occurrence.pageNumber,
        candidate.occurrence.context?.documentStart,
        candidate.occurrence.context?.documentEnd,
      ].join(":");
      if (sharedContextIdentity === null)
        sharedContextIdentity = contextIdentity;
      else if (
        sharedContextIdentity !== contextIdentity &&
        group.type !== RIGHT_HEADED_COORDINATION
      )
        throw triageError("TRIAGE_BINDING_GROUP_CONTEXT_MISMATCH", candidateId);
    }
    if (componentIds.size < 2)
      throw triageError("TRIAGE_BINDING_GROUP_COMPONENTS_INVALID", group.id);
  }

  for (const { occurrence } of candidates) {
    const declaredGroupId = groupIdByCandidateId.get(occurrence.candidateId);
    if ((occurrence.bindingGroupId || undefined) !== declaredGroupId)
      throw triageError(
        "TRIAGE_BINDING_GROUP_MEMBERSHIP_MISMATCH",
        occurrence.candidateId
      );
  }
  return groups;
}

function buildBindingTargets(worksheet, candidates, bindingGroups) {
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.occurrence.candidateId, candidate])
  );
  const groupByCandidateId = new Map();
  for (const group of bindingGroups)
    for (const candidateId of group.candidateIds)
      groupByCandidateId.set(candidateId, group);

  const emittedTargetIds = new Set();
  const targets = [];
  for (const candidate of candidates) {
    const candidateId = candidate.occurrence.candidateId;
    const group = groupByCandidateId.get(candidateId);
    const targetId = group?.id || candidateId;
    if (emittedTargetIds.has(targetId)) continue;
    emittedTargetIds.add(targetId);

    const members = (group?.candidateIds || [candidateId]).map((memberId) => {
      const member = candidateById.get(memberId);
      return {
        candidateId: memberId,
        componentId: member.component.id,
        componentLabel: member.component.label,
        factRole: member.component.factRole,
        matchedAlias: member.occurrence.matchedAlias,
        exactText: member.occurrence.exactText,
      };
    });
    const source = candidate.occurrence;
    const isHybridSemanticCandidate = new Set([
      "HYBRID_CHUNK_SEMANTIC",
      "HYBRID_EXACT_SPAN_SEMANTIC",
    ]).has(source.discoveryMethod);
    const categoryView = resolvedCategoryView(worksheet, candidate.requirement);
    const allCostMembers = members.every(
      (member) => member.factRole === "COST"
    );
    const allExplicitCostTerms = members.every((member) =>
      /kosten$/u.test(
        String(member.exactText || "")
          .normalize("NFKC")
          .toLocaleLowerCase("de")
          .replace(/[^\p{L}\p{N}]+/gu, "")
      )
    );
    const scopeSentence = occurrenceScopeSentence(source);
    const scopeLeadText = `${source.coverageGovernorHint?.text || ""}\n${
      source.scopeLead?.text || ""
    }`.trim();
    const liabilityContext = `${scopeLeadText}\n${source.context?.text || ""}`;
    const explicitCostGovernorContext = scopeSentence || source.context?.text;
    const hasExplicitLocalCostRoleEvidence =
      allCostMembers &&
      hasExplicitLocalCostRole(members, explicitCostGovernorContext);
    const hasExplicitCostGovernor =
      allCostMembers &&
      /(?:Kosten\s+für\s+(?:die\s+)?(?:nötige[nr]?\s+)?(?:Aufräumung|Abbruch)|Aufräum(?:ungs)?-?\s*(?:und|,)?\s*Abbruchkosten|Aufräum-\s*,?\s*Abbruch-\s*und\s*Feuerlöschkosten)/iu.test(
        explicitCostGovernorContext
      );
    const isCleanupWorkStartNotCost =
      allCostMembers &&
      /Beginn\s+der\s+Aufräumungs-\s+und\s+Reparaturarbeiten/iu.test(
        source.context?.text || ""
      );
    const isVs22NonDisposalScope =
      candidate.requirement.id === "VS-22" &&
      isVs22LiabilityOrStorageOccurrence(source);
    const localLiabilityContext = `${scopeLeadText}\n${
      scopeSentence || source.exactText || ""
    }`;
    const isStructurallyLiabilityScoped = [
      source.sectionScopeHint?.scopeKey,
      ...(source.sectionScopeHint?.scopeKeys || []),
    ].includes("HAFTPFLICHT_INSURANCE");
    const isExplicitLiabilityScope =
      !["HP", "VB"].includes(categoryView) &&
      (isVs22NonDisposalScope ||
        (allCostMembers &&
          (isStructurallyLiabilityScoped ||
            /(?:\b(?:Umwelt)?Haftpflicht\p{L}*|\bSchadenersatzverpflichtungen\b|\bAHVB\b)/iu.test(
              localLiabilityContext
            ))));
    const isVs04LiabilitySum =
      candidate.requirement.id === "VS-04" &&
      (source.exactText?.trim().toLocaleLowerCase("de-AT") ===
        "pauschalversicherungssumme" ||
        (source.exactText?.trim().toLocaleLowerCase("de-AT") ===
          "sachverständigengutachten" &&
          !/(?:Versicherungssumme[\s\S]{0,180}(?:ermittel|festsetz|entsprech)|(?:Gutachten|Neuwertschätzgutachten)[\s\S]{0,180}Versicherungssumme)/iu.test(
            source.context?.text || ""
          )) ||
        /(?:Haftpflicht|AHVB|Schadenersatzverpflichtungen|Pauschaldeckungssumme|Versicherungsfälle\s+eines\s+Jahres)/iu.test(
          liabilityContext
        ));
    let roleResolution = {
      owner: "MODEL",
      roleMatch: null,
      basis: "MODEL_REQUIRED",
    };
    if (
      isExplicitLiabilityScope ||
      isVs04LiabilitySum ||
      isCleanupWorkStartNotCost
    ) {
      roleResolution = {
        owner: "SERVER",
        roleMatch: ROLE_MATCH.MISMATCH,
        basis: isVs04LiabilitySum
          ? "VS04_LIABILITY_SUM_NOT_BUILDING_SUM_METHOD"
          : isVs22NonDisposalScope
            ? VS22_OTHER_SCOPE_BASIS
            : isExplicitLiabilityScope
              ? "LIABILITY_NOT_INSURED_COST"
              : "CLEANUP_WORK_START_NOT_COST",
      };
    } else if (allCostMembers && group) {
      roleResolution = {
        owner: "SERVER",
        roleMatch: ROLE_MATCH.MATCH,
        basis: group.type,
      };
    } else if (
      allCostMembers &&
      (allExplicitCostTerms ||
        hasExplicitCostGovernor ||
        hasExplicitLocalCostRoleEvidence)
    ) {
      roleResolution = {
        owner: "SERVER",
        roleMatch: ROLE_MATCH.MATCH,
        basis: allExplicitCostTerms
          ? "EXPLICIT_COST_TERM"
          : hasExplicitCostGovernor
            ? "EXPLICIT_COST_GOVERNOR"
            : "EXPLICIT_LOCAL_COST_ROLE",
      };
    } else if (allCostMembers) {
      roleResolution = {
        owner: "SERVER",
        roleMatch: ROLE_MATCH.UNRESOLVED,
        basis: "NO_EXPLICIT_COST_ROLE",
      };
    }
    const matchedNarrowAlias = (
      candidate.requirement.scopeRules?.narrowAliases || []
    ).find((alias) =>
      containsNormalizedPhrase(
        `${scopeLeadText}\n${scopeSentence || ""}`,
        alias
      )
    );
    const observedSectionScopeKeys = [
      source.sectionScopeHint?.scopeKey,
      ...(source.sectionScopeHint?.scopeKeys || []),
    ].filter(Boolean);
    const matchedNarrowScopeKey = observedSectionScopeKeys.find((scopeKey) =>
      (candidate.requirement.scopeRules?.narrowScopeKeys || []).includes(
        scopeKey
      )
    );
    let scopeResolution = {
      owner: "MODEL",
      scopeMatch: null,
      basis: "MODEL_REQUIRED",
      matchedAlias: null,
    };
    if (isExplicitLiabilityScope || isVs04LiabilitySum) {
      scopeResolution = {
        owner: "SERVER",
        scopeMatch: SCOPE_MATCH.OTHER_SCOPE,
        basis: "EXPLICIT_LIABILITY_SCOPE",
        matchedAlias: null,
      };
    } else if (
      roleResolution.owner === "SERVER" &&
      roleResolution.roleMatch === ROLE_MATCH.UNRESOLVED
    ) {
      scopeResolution = {
        owner: "SERVER",
        scopeMatch: SCOPE_MATCH.UNRESOLVED,
        basis: "ROLE_UNRESOLVED",
        matchedAlias: null,
      };
    } else if (matchedNarrowAlias || matchedNarrowScopeKey) {
      scopeResolution = {
        owner: "SERVER",
        scopeMatch: SCOPE_MATCH.NARROW,
        basis: matchedNarrowAlias
          ? "CATALOG_NARROW_ALIAS"
          : "CATALOG_NARROW_SECTION",
        matchedAlias: matchedNarrowAlias || matchedNarrowScopeKey,
      };
    } else if (
      observedSectionScopeKeys.some((scopeKey) =>
        expectedCategoryScopeKeys(worksheet.catalog?.categoryView).includes(
          scopeKey
        )
      )
    ) {
      const matchedScopeKey = observedSectionScopeKeys.find((scopeKey) =>
        expectedCategoryScopeKeys(worksheet.catalog?.categoryView).includes(
          scopeKey
        )
      );
      scopeResolution = {
        owner: "SERVER",
        scopeMatch: SCOPE_MATCH.GENERAL,
        basis: "MATCHING_CATEGORY_SECTION",
        matchedAlias: matchedScopeKey,
      };
    }
    const deterministicCategoryBinding =
      group || isHybridSemanticCandidate
        ? null
        : deterministicCategoryCandidateBinding({
            worksheet,
            requirement: candidate.requirement,
            component: candidate.component,
            occurrence: candidate.occurrence,
          });
    if (deterministicCategoryBinding) {
      const mentionOnly =
        deterministicCategoryBinding.binding ===
        DETERMINISTIC_BINDING.MENTION_ONLY;
      const narrowScope =
        deterministicCategoryBinding.binding ===
        DETERMINISTIC_BINDING.NARROW_SCOPE;
      if (
        mentionOnly ||
        roleResolution.owner === "MODEL" ||
        roleResolution.roleMatch === ROLE_MATCH.UNRESOLVED
      )
        roleResolution = {
          owner: "SERVER",
          roleMatch: mentionOnly ? ROLE_MATCH.MISMATCH : ROLE_MATCH.MATCH,
          basis: deterministicCategoryBinding.basis,
        };
      if (
        scopeResolution.owner === "MODEL" ||
        scopeResolution.scopeMatch === SCOPE_MATCH.UNRESOLVED
      )
        scopeResolution = {
          owner: "SERVER",
          scopeMatch: narrowScope ? SCOPE_MATCH.NARROW : SCOPE_MATCH.GENERAL,
          basis: deterministicCategoryBinding.basis,
          matchedAlias: null,
        };
    }
    // Dinghy and the semantic span selector are discovery-only. Even when a
    // selected quote sits below a matching category heading, it must not gain
    // a server-authoritative DIRECT binding. Deterministic rejections remain
    // authoritative; positive role/scope acceptance requires the normal Qwen
    // triage before effects or table materialization can see the candidate.
    if (
      isHybridSemanticCandidate &&
      roleResolution.owner === "SERVER" &&
      roleResolution.roleMatch === ROLE_MATCH.MATCH
    )
      roleResolution = {
        owner: "MODEL",
        roleMatch: null,
        basis: "HYBRID_SEMANTIC_MODEL_REQUIRED",
      };
    if (
      isHybridSemanticCandidate &&
      scopeResolution.owner === "SERVER" &&
      [SCOPE_MATCH.GENERAL, SCOPE_MATCH.GENERAL_WITH_NARROW].includes(
        scopeResolution.scopeMatch
      )
    )
      scopeResolution = {
        owner: "MODEL",
        scopeMatch: null,
        basis: "HYBRID_SEMANTIC_MODEL_REQUIRED",
        matchedAlias: null,
      };
    const modelDecisionFields = [];
    if (roleResolution.owner === "MODEL") modelDecisionFields.push("roleMatch");
    if (scopeResolution.owner === "MODEL")
      modelDecisionFields.push("scopeMatch");
    targets.push({
      targetId,
      categoryView,
      candidateIds: members.map((member) => member.candidateId),
      requirementId: candidate.requirement.id,
      requirementLabel: candidate.requirement.label,
      requestedFields: candidate.requirement.requestedFields,
      members,
      pageNumber: source.pageNumber,
      physicalPageNumber: source.physicalPageNumber || source.pageNumber,
      printedPageLabel: source.printedPageLabel || null,
      contextUnitType: source.context.unitType,
      focusText: scopeSentence || source.exactText,
      ...(isHybridSemanticCandidate
        ? { hybridSemanticContract: source.hybridSemanticContract }
        : {}),
      pageScopeHints: Array.isArray(source.pageScopeHints)
        ? source.pageScopeHints.map(({ scopeKey, text }) => ({
            scopeKey,
            text,
          }))
        : [],
      sectionScopeHint: source.sectionScopeHint || null,
      scopeLeadText,
      contextText: source.context.text,
      structure: group
        ? { type: group.type, governorText: group.governorText }
        : null,
      roleResolution,
      scopeResolution,
      deterministicBindingBasis: deterministicCategoryBinding?.basis || null,
      modelDecisionFields,
    });
  }
  return targets;
}

/**
 * Accepts either raw JSON or exactly one surrounding Markdown JSON fence.
 * This normalizes transport syntax only; the parsed payload remains subject to
 * the complete fail-closed schema, ID and binding validation below.
 * Role: boundary. Side effects: none.
 */
function normalizeCandidateTriageResponse(responseText) {
  const response = String(responseText || "").trim();
  const fenced = response.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/iu);
  return fenced ? fenced[1].trim() : response;
}

/**
 * Reduces a private occurrence worksheet to the only fields Qwen may inspect.
 * Role: transform. Side effects: none.
 */
function buildCandidateTriagePayload(
  worksheet,
  { expectedTargetSelectionDigestSha256 = null } = {}
) {
  assertTargetRequirementSelection(worksheet, {
    expectedSelectionDigestSha256: expectedTargetSelectionDigestSha256,
  });
  const candidates = worksheetCandidates(worksheet);
  const bindingGroups = worksheetBindingGroups(worksheet, candidates);
  return {
    schemaVersion: TRIAGE_SCHEMA_VERSION,
    task: "CLASSIFY_BINDING_TARGETS",
    definitions: {
      bindings: Object.values(CANDIDATE_BINDING),
      candidateOnly: true,
      bindingGroupConstraint: SAME_CANDIDATE_BINDING,
      roleMatches: Object.values(ROLE_MATCH),
      scopeMatches: Object.values(SCOPE_MATCH),
    },
    bindingTargets: buildBindingTargets(worksheet, candidates, bindingGroups),
  };
}

function deriveCandidateBinding({ roleMatch, scopeMatch }) {
  if (
    roleMatch === ROLE_MATCH.MISMATCH ||
    scopeMatch === SCOPE_MATCH.OTHER_SCOPE
  )
    return CANDIDATE_BINDING.MENTION_ONLY;
  if (
    roleMatch === ROLE_MATCH.UNRESOLVED ||
    scopeMatch === SCOPE_MATCH.UNRESOLVED
  )
    return CANDIDATE_BINDING.UNRESOLVED;
  if (roleMatch !== ROLE_MATCH.MATCH)
    throw triageError("TRIAGE_ROLE_SCOPE_COMBINATION_INVALID");
  if (
    scopeMatch === SCOPE_MATCH.GENERAL ||
    scopeMatch === SCOPE_MATCH.GENERAL_WITH_NARROW
  )
    return CANDIDATE_BINDING.DIRECT;
  if (scopeMatch === SCOPE_MATCH.NARROW) return CANDIDATE_BINDING.NARROW_SCOPE;
  throw triageError("TRIAGE_ROLE_SCOPE_COMBINATION_INVALID");
}

function buildSingleBindingTargetPayload({ payload, targetId }) {
  if (
    payload?.schemaVersion !== TRIAGE_SCHEMA_VERSION ||
    !Array.isArray(payload.bindingTargets)
  )
    throw triageError("TRIAGE_PAYLOAD_INVALID");
  const matches = payload.bindingTargets.filter(
    (target) => target.targetId === targetId
  );
  if (matches.length !== 1)
    throw triageError("TRIAGE_TARGET_SELECTION_INVALID", targetId);
  return {
    schemaVersion: TRIAGE_SCHEMA_VERSION,
    task: "CLASSIFY_ONE_BINDING_TARGET",
    definitions: payload.definitions,
    bindingTarget: matches[0],
  };
}

function parseAndValidateSingleBindingTarget({ responseText, target }) {
  const targetId = target?.targetId;
  if (
    !targetId ||
    !target.roleResolution ||
    !target.scopeResolution ||
    !Array.isArray(target.modelDecisionFields)
  )
    throw triageError("TRIAGE_SINGLE_TARGET_INVALID");
  if (target.modelDecisionFields.length === 0)
    throw triageError("TRIAGE_SINGLE_TARGET_SERVER_TERMINAL", targetId);
  let parsed;
  try {
    parsed = JSON.parse(normalizeCandidateTriageResponse(responseText));
  } catch (error) {
    throw triageError("TRIAGE_JSON_INVALID", error.message);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw triageError("TRIAGE_ROOT_INVALID");
  exactKeys(
    parsed,
    ["schemaVersion", "roleMatch", "scopeMatch"],
    "TRIAGE_ROOT_KEYS_INVALID"
  );
  if (parsed.schemaVersion !== TRIAGE_SCHEMA_VERSION)
    throw triageError("TRIAGE_SCHEMA_VERSION_INVALID", parsed.schemaVersion);
  if (!ALLOWED_ROLE_MATCHES.has(parsed.roleMatch))
    throw triageError(
      "TRIAGE_ROLE_MATCH_INVALID",
      `${targetId}:${String(parsed.roleMatch)}`
    );
  if (!ALLOWED_SCOPE_MATCHES.has(parsed.scopeMatch))
    throw triageError(
      "TRIAGE_SCOPE_MATCH_INVALID",
      `${targetId}:${String(parsed.scopeMatch)}`
    );
  if (
    target.roleResolution.owner === "SERVER" &&
    parsed.roleMatch !== target.roleResolution.roleMatch
  )
    throw triageError(
      "TRIAGE_SERVER_ROLE_CONFLICT",
      `${targetId}:${parsed.roleMatch}`
    );
  if (
    target.scopeResolution.owner === "SERVER" &&
    parsed.scopeMatch !== target.scopeResolution.scopeMatch
  )
    throw triageError(
      "TRIAGE_SERVER_SCOPE_CONFLICT",
      `${targetId}:${parsed.scopeMatch}`
    );
  const roleMatch =
    target.roleResolution.owner === "SERVER"
      ? target.roleResolution.roleMatch
      : parsed.roleMatch;
  const scopeMatch =
    target.scopeResolution.owner === "SERVER"
      ? target.scopeResolution.scopeMatch
      : parsed.scopeMatch;
  return {
    targetId,
    roleMatch,
    scopeMatch,
    binding: deriveCandidateBinding({
      roleMatch,
      scopeMatch,
    }),
    decisionOwner:
      target.roleResolution.owner === "MODEL" &&
      target.scopeResolution.owner === "MODEL"
        ? "MODEL"
        : "SERVER_AND_MODEL",
  };
}

function parseAndValidateCandidateTriage({ responseText, worksheet }) {
  const candidates = worksheetCandidates(worksheet);
  const bindingGroups = worksheetBindingGroups(worksheet, candidates);
  const bindingTargets = buildBindingTargets(
    worksheet,
    candidates,
    bindingGroups
  );
  let parsed;
  try {
    parsed = JSON.parse(normalizeCandidateTriageResponse(responseText));
  } catch (error) {
    throw triageError("TRIAGE_JSON_INVALID", error.message);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw triageError("TRIAGE_ROOT_INVALID");
  exactKeys(
    parsed,
    ["schemaVersion", "judgements"],
    "TRIAGE_ROOT_KEYS_INVALID"
  );
  if (parsed.schemaVersion !== TRIAGE_SCHEMA_VERSION)
    throw triageError("TRIAGE_SCHEMA_VERSION_INVALID", parsed.schemaVersion);
  if (!Array.isArray(parsed.judgements))
    throw triageError("TRIAGE_JUDGEMENTS_REQUIRED");

  const allowedTargetIds = new Set(
    bindingTargets.map(({ targetId }) => targetId)
  );
  const judgementByTargetId = new Map();
  for (const judgement of parsed.judgements) {
    if (!judgement || typeof judgement !== "object" || Array.isArray(judgement))
      throw triageError("TRIAGE_JUDGEMENT_INVALID");
    exactKeys(
      judgement,
      ["targetId", "binding"],
      "TRIAGE_JUDGEMENT_KEYS_INVALID"
    );
    const targetId = String(judgement.targetId || "");
    if (!allowedTargetIds.has(targetId))
      throw triageError("TRIAGE_TARGET_ID_UNKNOWN", targetId);
    if (judgementByTargetId.has(targetId))
      throw triageError("TRIAGE_TARGET_ID_DUPLICATE", targetId);
    if (!ALLOWED_BINDINGS.has(judgement.binding))
      throw triageError(
        "TRIAGE_BINDING_INVALID",
        `${targetId}:${String(judgement.binding)}`
      );
    judgementByTargetId.set(targetId, {
      targetId,
      binding: judgement.binding,
    });
  }

  const missingTargetIds = [...allowedTargetIds].filter(
    (id) => !judgementByTargetId.has(id)
  );
  if (missingTargetIds.length > 0)
    throw triageError("TRIAGE_TARGET_ID_MISSING", missingTargetIds.join(","));
  if (judgementByTargetId.size !== allowedTargetIds.size)
    throw triageError(
      "TRIAGE_JUDGEMENT_COUNT_INVALID",
      `${judgementByTargetId.size}/${allowedTargetIds.size}`
    );

  const bindingByCandidateId = new Map();
  for (const target of bindingTargets) {
    const binding = judgementByTargetId.get(target.targetId).binding;
    for (const candidateId of target.candidateIds)
      bindingByCandidateId.set(candidateId, binding);
  }

  return {
    schemaVersion: TRIAGE_SCHEMA_VERSION,
    targetJudgements: bindingTargets.map(({ targetId }) =>
      judgementByTargetId.get(targetId)
    ),
    judgements: candidates.map(({ occurrence }) => ({
      candidateId: occurrence.candidateId,
      binding: bindingByCandidateId.get(occurrence.candidateId),
    })),
  };
}

/**
 * Joins validated model labels back to server-owned sources. The model cannot
 * inject or alter text, pages, offsets or component identity.
 * Role: boundary. Side effects: none.
 */
function materializeCandidateTriage({ worksheet, validatedTriage }) {
  const candidates = worksheetCandidates(worksheet);
  worksheetBindingGroups(worksheet, candidates);
  const judgementById = new Map(
    validatedTriage.judgements.map((judgement) => [
      judgement.candidateId,
      judgement,
    ])
  );
  return candidates.map(({ requirement, component, occurrence }) => ({
    requirementId: requirement.id,
    requirementLabel: requirement.label,
    componentId: component.id,
    componentLabel: component.label,
    candidateId: occurrence.candidateId,
    binding: judgementById.get(occurrence.candidateId).binding,
    pageNumber: occurrence.pageNumber,
    physicalPageNumber: occurrence.physicalPageNumber || occurrence.pageNumber,
    printedPageLabel: occurrence.printedPageLabel || null,
    exactText: occurrence.exactText,
    documentStart: occurrence.documentStart,
    documentEnd: occurrence.documentEnd,
    bindingGroupId: occurrence.bindingGroupId || null,
    context: occurrence.context,
  }));
}

function evaluateCandidateTriageControls({ materialized, controlSet }) {
  if (
    controlSet?.schemaVersion !== 1 ||
    !Array.isArray(controlSet.controls) ||
    controlSet.controls.length === 0
  )
    throw triageError("TRIAGE_CONTROL_SET_INVALID");
  const controlIds = new Set();
  return controlSet.controls.map((control) => {
    if (!control.id) throw triageError("TRIAGE_CONTROL_ID_REQUIRED");
    if (controlIds.has(control.id))
      throw triageError("TRIAGE_CONTROL_ID_DUPLICATE", control.id);
    controlIds.add(control.id);
    if (
      !control.selector ||
      !Array.isArray(control.allowedBindings) ||
      control.allowedBindings.length === 0
    )
      throw triageError("TRIAGE_CONTROL_RULE_INVALID", control.id);
    const matches = materialized.filter((candidate) =>
      Object.entries(control.selector || {}).every(
        ([key, value]) => candidate[key] === value
      )
    );
    if (matches.length !== 1)
      return {
        id: control.id,
        pass: false,
        reason: `CONTROL_SELECTOR_MATCH_COUNT:${matches.length}`,
      };
    const [candidate] = matches;
    const pass = control.allowedBindings.includes(candidate.binding);
    return {
      id: control.id,
      pass,
      candidateId: candidate.candidateId,
      observedBinding: candidate.binding,
      allowedBindings: control.allowedBindings,
      reason: pass ? null : "CONTROL_BINDING_REJECTED",
    };
  });
}

module.exports = {
  CANDIDATE_BINDING,
  ROLE_MATCH,
  SCOPE_MATCH,
  TRIAGE_SCHEMA_VERSION,
  buildCandidateTriagePayload,
  buildSingleBindingTargetPayload,
  deriveCandidateBinding,
  evaluateCandidateTriageControls,
  materializeCandidateTriage,
  normalizeCandidateTriageResponse,
  parseAndValidateCandidateTriage,
  parseAndValidateSingleBindingTarget,
};
