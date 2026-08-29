const { COVERAGE_EFFECT } = require("./categoryResultContract");
const {
  DETERMINISTIC_BINDING,
  deterministicVsCandidateBinding,
  deterministicVsPreparedDecision,
} = require("./deterministicVsEvidenceRules");

const CATEGORY_SCOPE_KEYS = Object.freeze({
  FE: ["FEUER_INSURANCE"],
  LW: ["LEITUNGSWASSER_INSURANCE"],
  ST: ["STURM_INSURANCE"],
  EL: ["ELEMENTAR_INSURANCE"],
  HP: ["HAFTPFLICHT_INSURANCE"],
  VB: ["GENERAL_CONTRACT_TERMS"],
  WE: ["WOHNUNGSEIGENTUM_INSURANCE"],
});

const POSITIVE_GOVERNORS = Object.freeze([
  /(?:Zusätzlich\s+)?versichert\s+sind(?:\s+Schäden\s+durch)?/giu,
  /Zus[aä]tzlich[^\n]{0,160}\bversichert\b/giu,
  /(?:Als\s+)?mitversichert(?:\s+gelten)?/giu,
  /Versicherte\s+Gefahren/giu,
  /Versicherungsschutz\s+(?:besteht|gilt)/giu,
  /auf\s+[,„“"']*Erstes\s+Risiko/giu,
  /Katastrophen\s+bis/giu,
]);
const NEGATIVE_GOVERNORS = Object.freeze([
  /Nicht\s+versichert(?:\s+im\s+Rahmen[^:\n]{0,140})?\s+sind/giu,
  /nicht\s+mitversichert/giu,
  /(?:vom\s+Versicherungsschutz\s+)?ausgeschlossen/giu,
  /(?:Die\s+)?Versicherung(?:sschutz)?\s+erstreckt\s+sich\s+nicht/giu,
  /kein\s+Versicherungsschutz/giu,
]);
const INLINE_NEGATIVE_GOVERNORS = Object.freeze([
  /\b(?:jedoch\s+)?exklusive\b/giu,
]);
const CONDITIONAL_GOVERNORS = Object.freeze([
  /\b(?:wenn|sofern|vorausgesetzt|unter\s+der\s+Bedingung)\b/giu,
]);

function normalize(value) {
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

function containsPhrase(text, phrase) {
  const normalizedPhrase = normalize(phrase);
  return Boolean(
    normalizedPhrase && ` ${normalize(text)} `.includes(` ${normalizedPhrase} `)
  );
}

function lastPatternMatch(text, patterns) {
  let selected = null;
  for (const pattern of patterns) {
    const matcher = new RegExp(pattern.source, pattern.flags);
    for (const match of String(text || "").matchAll(matcher)) {
      if (!selected || match.index > selected.index)
        selected = { index: match.index, text: match[0] };
    }
  }
  return selected;
}

/**
 * Returns the nearest explicit coverage governor before the occurrence.
 * Inputs are server-owned source strings and offsets. Side effects: none.
 * Role: decide. A missing or ambiguous governor remains UNKNOWN.
 */
function clausePolarity({
  scopeLeadText = "",
  contextText = "",
  exactText = "",
  occurrenceStart = null,
  contextDocumentStart = null,
}) {
  let relativeStart = Number.isInteger(occurrenceStart)
    ? occurrenceStart - Number(contextDocumentStart)
    : String(contextText).indexOf(String(exactText || ""));
  if (!Number.isInteger(relativeStart) || relativeStart < 0)
    relativeStart = String(contextText).length;
  const localPrefix = String(contextText).slice(
    0,
    relativeStart + String(exactText || "").length
  );
  if (lastPatternMatch(localPrefix, INLINE_NEGATIVE_GOVERNORS))
    return "NEGATIVE";
  const prefix = `${String(scopeLeadText || "")}\n${localPrefix}`;
  const positive = lastPatternMatch(prefix, POSITIVE_GOVERNORS);
  const negative = lastPatternMatch(prefix, NEGATIVE_GOVERNORS);
  if (!positive && !negative) return "UNKNOWN";
  if (
    positive &&
    negative &&
    positive.index >= negative.index &&
    positive.index < negative.index + negative.text.length
  )
    return "NEGATIVE";
  if (positive && negative && positive.index === negative.index)
    return "UNKNOWN";
  return negative && (!positive || negative.index > positive.index)
    ? "NEGATIVE"
    : "POSITIVE";
}

function expectedCategoryScopeKeys(categoryView) {
  return CATEGORY_SCOPE_KEYS[String(categoryView || "").toUpperCase()] || [];
}

function resolvedCategoryView(worksheet, requirement) {
  return String(
    worksheet?.catalog?.categoryView ||
      String(requirement?.id || "").match(/^([A-Z]{2})-/u)?.[1] ||
      ""
  ).toUpperCase();
}

function matchedNarrowAlias(requirement, occurrence) {
  const narrowAliases = requirement?.scopeRules?.narrowAliases || [];
  const scopeText = `${occurrence?.coverageGovernorHint?.text || ""}\n${
    occurrence?.scopeLead?.text || ""
  }\n${occurrence?.context?.text || ""}`;
  return (
    narrowAliases.find((alias) => containsPhrase(scopeText, alias)) || null
  );
}

function factRoleMatchesGovernor(factRole, polarity, text) {
  if (!polarity || polarity === "UNKNOWN") return false;
  if (["PERIL", "DAMAGE", "EXCLUSION"].includes(factRole)) return true;
  if (factRole === "INSURED_OBJECT")
    return /(?:Sachen|Objekte|Gebäude|Anlagen|Einrichtungen|Bestandteile)/iu.test(
      text
    );
  if (factRole === "COST") return /Kosten/iu.test(text);
  if (factRole === "BENEFIT")
    return /(?:Entschädigung|Leistung|Ersatz|Ertragsausfall|Mietverlust)/iu.test(
      text
    );
  if (factRole === "LIMIT")
    return /(?:EUR|€|%|Höchstentschädigung|Sublimit|bis\s+zu|maximal)/iu.test(
      text
    );
  if (factRole === "DEDUCTIBLE") return /Selbstbehalt/iu.test(text);
  if (factRole === "CONDITION")
    return /(?:wenn|sofern|vorausgesetzt|Obliegenheit|Nachweis|Frist|Karenz)/iu.test(
      text
    );
  if (factRole === "DEFINITION")
    return /(?:\bist\b|\bsind\b|bedeutet|gilt\s+als|Definition)/iu.test(text);
  if (factRole === "DOCUMENT_STATUS") return false;
  return false;
}

function occurrenceClauseText(occurrence) {
  const text = String(occurrence?.context?.text || "");
  const contextStart = Number(occurrence?.context?.documentStart);
  const occurrenceStart = Number(occurrence?.documentStart) - contextStart;
  const occurrenceEnd = Number(occurrence?.documentEnd) - contextStart;
  if (
    !Number.isInteger(contextStart) ||
    !Number.isInteger(occurrenceStart) ||
    !Number.isInteger(occurrenceEnd) ||
    occurrenceStart < 0 ||
    occurrenceEnd <= occurrenceStart ||
    occurrenceEnd > text.length
  )
    return String(occurrence?.exactText || "");
  let start = occurrenceStart;
  while (start > 0 && !/[.!?;\n\r]/u.test(text[start - 1])) start -= 1;
  let end = occurrenceEnd;
  while (end < text.length && !/[.!?;\n\r]/u.test(text[end])) end += 1;
  return text.slice(start, end);
}

function explicitRoleMismatch(component, occurrence) {
  const clause = occurrenceClauseText(occurrence);
  if (
    component?.factRole === "LIMIT" &&
    !/(?:EUR|€|%|Höchstentschädigung|Sublimit|Versicherungssumme|auf\s+[,„“"']*Erstes\s+Risiko|bis\s+zu|maximal)/iu.test(
      clause
    )
  )
    return "LIMIT_TERM_WITHOUT_LOCAL_LIMIT";
  if (
    component?.factRole === "DEDUCTIBLE" &&
    !/(?:Selbstbehalt|Franchise|Selbstbeteiligung)/iu.test(clause)
  )
    return "DEDUCTIBLE_TERM_WITHOUT_LOCAL_DEDUCTIBLE";
  return null;
}

function explicitEl16GlassObjectBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  if (
    categoryView !== "EL" ||
    requirement?.id !== "EL-16" ||
    !["winter_garden", "display_case"].includes(component?.id) ||
    component?.factRole !== "INSURED_OBJECT"
  )
    return null;

  const evidenceText = `${occurrence?.coverageGovernorHint?.text || ""}\n${
    occurrence?.scopeLead?.text || ""
  }\n${occurrence?.context?.text || ""}`;
  if (
    !/(?:Glasbruch|Gebäude-Glaspauschale|Innenverglasungen)/iu.test(
      evidenceText
    )
  )
    return null;

  const polarity = clausePolarity({
    scopeLeadText: `${occurrence?.coverageGovernorHint?.text || ""}\n${
      occurrence?.scopeLead?.text || ""
    }`,
    contextText: occurrence?.context?.text,
    exactText: occurrence?.exactText,
    occurrenceStart: occurrence?.documentStart,
    contextDocumentStart: occurrence?.context?.documentStart,
  });
  if (!["POSITIVE", "NEGATIVE"].includes(polarity)) return null;
  return {
    binding: DETERMINISTIC_BINDING.DIRECT,
    basis: `EL_16_EXPLICIT_${polarity}_GLASS_OBJECT_CLAUSE`,
    authoritative: true,
  };
}

function explicitHp16TenantRecourseBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  if (
    categoryView !== "HP" ||
    requirement?.id !== "HP-16" ||
    !["recourse_waiver", "tenants"].includes(component?.id)
  )
    return null;
  const context = String(occurrence?.context?.text || "");
  if (
    !/gegen\s+einen\s+Mieter\s+des\s+versicherten\s+Gebäudes[\s\S]{0,320}?verzichtet\s+der\s+Versicherer\s+auf\s+seinen\s+Regressanspruch/iu.test(
      context
    )
  )
    return null;
  return {
    binding: DETERMINISTIC_BINDING.DIRECT,
    basis: "HP_16_EXPLICIT_TENANT_RECOURSE_WAIVER",
    authoritative: true,
  };
}

function explicitHp11LiabilityScopeBinding({
  categoryView,
  requirement,
  occurrence,
}) {
  if (categoryView !== "HP" || requirement?.id !== "HP-11") return null;
  const evidenceText = `${occurrence?.sectionScopeHint?.text || ""}\n${
    occurrence?.coverageGovernorHint?.text || ""
  }\n${occurrence?.scopeLead?.text || ""}\n${occurrence?.context?.text || ""}`;
  if (
    /(?:Gewässerschadenhaftpflicht|Haftpflicht|Anlagenrisiko|Umwelthaft)/iu.test(
      evidenceText
    )
  )
    return null;
  return {
    binding: DETERMINISTIC_BINDING.MENTION_ONLY,
    basis: "HP_11_TANK_OBJECT_WITHOUT_LIABILITY_SCOPE",
    authoritative: true,
  };
}

/**
 * Resolves only category-independent scope and role cases supported by an
 * explicit clause governor or section heading. VS keeps its already proven
 * specialised rules. Unknown wording deliberately returns null for the LLM.
 * Side effects: none. Role: decide.
 */
function deterministicCategoryCandidateBinding({
  worksheet,
  requirement,
  component,
  occurrence,
}) {
  const categoryView = resolvedCategoryView(worksheet, requirement);
  if (categoryView === "VS") {
    const vsDecision = deterministicVsCandidateBinding({
      requirementId: requirement?.id,
      componentId: component?.id,
      occurrence,
    });
    if (vsDecision) return vsDecision;
  }

  const el16Binding = explicitEl16GlassObjectBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (el16Binding) return el16Binding;

  const hp16Binding = explicitHp16TenantRecourseBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (hp16Binding) return hp16Binding;

  const hp11Binding = explicitHp11LiabilityScopeBinding({
    categoryView,
    requirement,
    occurrence,
  });
  if (hp11Binding) return hp11Binding;

  const roleMismatch = explicitRoleMismatch(component, occurrence);
  if (roleMismatch)
    return {
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: roleMismatch,
    };

  const expectedScopeKeys = expectedCategoryScopeKeys(categoryView);
  const observedScopeKey = occurrence?.sectionScopeHint?.scopeKey || null;
  const narrowAlias = matchedNarrowAlias(requirement, occurrence);
  const narrowScopeKey = (
    requirement?.scopeRules?.narrowScopeKeys || []
  ).includes(observedScopeKey)
    ? observedScopeKey
    : null;
  if (
    observedScopeKey &&
    expectedScopeKeys.length > 0 &&
    !expectedScopeKeys.includes(observedScopeKey) &&
    !narrowScopeKey
  )
    // A different chapter is a scope signal, not by itself proof that the
    // occurrence is irrelevant. Cross-cutting VB/WE rules and named perils can
    // legitimately live inside another coverage chapter.
    return null;

  const polarity = clausePolarity({
    scopeLeadText: `${occurrence?.coverageGovernorHint?.text || ""}\n${
      occurrence?.scopeLead?.text || ""
    }`,
    contextText: occurrence?.context?.text,
    exactText: occurrence?.exactText,
    occurrenceStart: occurrence?.documentStart,
    contextDocumentStart: occurrence?.context?.documentStart,
  });
  const evidenceText = `${occurrence?.coverageGovernorHint?.text || ""}\n${
    occurrence?.scopeLead?.text || ""
  }\n${occurrence?.context?.text || ""}`;
  if (!factRoleMatchesGovernor(component?.factRole, polarity, evidenceText))
    return null;
  const explicitVariantListClause = Boolean(
    occurrence?.variantScopeHint?.key &&
      occurrence?.variantScopeHint?.label &&
      occurrence?.coverageGovernorHint?.text &&
      occurrence?.context?.unitType === "LIST_ITEM" &&
      containsPhrase(occurrence?.context?.text, occurrence?.exactText)
  );
  return {
    binding:
      narrowAlias || narrowScopeKey
        ? DETERMINISTIC_BINDING.NARROW_SCOPE
        : DETERMINISTIC_BINDING.DIRECT,
    basis: narrowAlias
      ? "EXPLICIT_NARROW_CLAUSE_SCOPE"
      : narrowScopeKey
        ? "EXPLICIT_NARROW_SECTION_SCOPE"
        : `EXPLICIT_${polarity}_CLAUSE_GOVERNOR`,
    ...(explicitVariantListClause ? { authoritative: true } : {}),
  };
}

function effectForCandidate(target, candidate) {
  const localClause = String(candidate.contextText || "");
  const localLimitedCoverage =
    ["PERIL", "DAMAGE"].includes(target.factRole) &&
    containsPhrase(localClause, candidate.exactText) &&
    /(?:Versicherungssumme|Höchstentschädigung)\s+(?:bei|für)\s+Schäden\s+durch[\s\S]{0,180}?(?:maximal|höchstens|bis\s+(?:zu\s+)?)[\s\S]{0,80}?(?:EUR|€|%)/iu.test(
      localClause
    ) &&
    !lastPatternMatch(localClause, NEGATIVE_GOVERNORS);
  if (localLimitedCoverage) return COVERAGE_EFFECT.INCLUDED;

  const polarity = clausePolarity({
    scopeLeadText: candidate.scopeLeadText,
    contextText: candidate.contextText,
    exactText: candidate.exactText,
    occurrenceStart: candidate.documentStart,
    contextDocumentStart: candidate.contextDocumentStart,
  });
  if (polarity === "NEGATIVE") return COVERAGE_EFFECT.EXCLUDED;
  if (polarity !== "POSITIVE") return null;
  if (target.factRole === "DEFINITION") return COVERAGE_EFFECT.DEFINED;
  if (["LIMIT", "DEDUCTIBLE"].includes(target.factRole))
    return COVERAGE_EFFECT.DEFINED;
  if (target.factRole === "CONDITION") {
    const text = `${candidate.scopeLeadText || ""}\n${
      candidate.contextText || ""
    }`;
    return lastPatternMatch(text, CONDITIONAL_GOVERNORS)
      ? COVERAGE_EFFECT.CONDITIONAL
      : COVERAGE_EFFECT.DEFINED;
  }
  return COVERAGE_EFFECT.INCLUDED;
}

/**
 * Creates a server-terminal decision only when every surviving candidate has
 * an explicit clause governor and all candidates agree on one effect.
 * Ambiguous/mixed wording remains model-owned. Side effects: none. Role:
 * decide.
 */
function deterministicCategoryPreparedDecision(target) {
  if (String(target?.categoryView || "") === "VS") {
    const vsDecision = deterministicVsPreparedDecision(target);
    if (vsDecision) return vsDecision;
  }
  if (!Array.isArray(target?.candidates) || target.candidates.length === 0)
    return null;
  if (
    target.categoryView === "HP" &&
    target.requirementId === "HP-16" &&
    ["recourse_waiver", "tenants"].includes(target.componentId)
  ) {
    const selectedCandidateIds = target.candidates
      .filter(({ contextText }) =>
        /Mieter[\s\S]{0,260}verzichtet\s+der\s+Versicherer\s+auf\s+seinen\s+Regressanspruch/iu.test(
          contextText || ""
        )
      )
      .map(({ candidateId }) => candidateId);
    if (selectedCandidateIds.length > 0)
      return {
        selectedCandidateIds,
        coverageEffect:
          target.componentId === "recourse_waiver"
            ? COVERAGE_EFFECT.INCLUDED
            : COVERAGE_EFFECT.DEFINED,
        basis: `EXPLICIT_HP16_TENANT_RECOURSE_WAIVER:HP:HP-16`,
      };
  }
  if (
    target.candidates.some(
      ({ candidateBinding }) =>
        ![
          DETERMINISTIC_BINDING.DIRECT,
          DETERMINISTIC_BINDING.NARROW_SCOPE,
        ].includes(candidateBinding)
    )
  )
    return null;
  const candidatesWithEffects = target.candidates.map((candidate) => ({
    candidate,
    effect: effectForCandidate(target, candidate),
  }));
  const generalCandidates = candidatesWithEffects.filter(
    ({ candidate }) =>
      candidate.candidateBinding === DETERMINISTIC_BINDING.DIRECT
  );
  const decisiveCandidates =
    generalCandidates.length > 0 ? generalCandidates : candidatesWithEffects;
  if (decisiveCandidates.some(({ effect }) => effect === null)) return null;
  const uniqueEffects = [
    ...new Set(decisiveCandidates.map(({ effect }) => effect)),
  ];
  if (uniqueEffects.length !== 1) return null;
  return {
    selectedCandidateIds: decisiveCandidates.map(
      ({ candidate }) => candidate.candidateId
    ),
    coverageEffect: uniqueEffects[0],
    basis: `${
      generalCandidates.length > 0 &&
      generalCandidates.length < candidatesWithEffects.length
        ? "EXPLICIT_GENERAL_RULE_WITH_NARROW_EXCEPTION"
        : "EXPLICIT_CATEGORY_CLAUSE"
    }:${target.categoryView}:${target.requirementId}`,
  };
}

module.exports = {
  CATEGORY_SCOPE_KEYS,
  clausePolarity,
  deterministicCategoryCandidateBinding,
  deterministicCategoryPreparedDecision,
  expectedCategoryScopeKeys,
  resolvedCategoryView,
};
