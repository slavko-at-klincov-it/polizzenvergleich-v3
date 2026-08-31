const { COVERAGE_EFFECT } = require("./categoryResultContract");
const {
  DETERMINISTIC_BINDING,
  deterministicVsCandidateBinding,
  deterministicVsPreparedDecision,
} = require("./deterministicVsEvidenceRules");
const {
  SEMANTIC_NEGATIVE_COVERAGE_HEADING,
  SEMANTIC_POSITIVE_COVERAGE_HEADING,
} = require("./semanticCoverageGovernor");

const CATEGORY_SCOPE_KEYS = Object.freeze({
  FE: ["FEUER_INSURANCE"],
  LW: ["LEITUNGSWASSER_INSURANCE"],
  ST: ["STURM_INSURANCE"],
  EL: ["ELEMENTAR_INSURANCE"],
  HP: ["HAFTPFLICHT_INSURANCE"],
  VB: ["GENERAL_CONTRACT_TERMS"],
  WE: ["WOHNUNGSEIGENTUM_INSURANCE"],
});
const STRICT_COVERAGE_CATEGORY_VIEWS = new Set([
  "FE",
  "LW",
  "ST",
  "EL",
  "HP",
  "WE",
]);

const POSITIVE_GOVERNORS = Object.freeze([
  SEMANTIC_POSITIVE_COVERAGE_HEADING,
  /(?:Zusätzlich\s+)?versichert\s+sind(?:\s+Schäden\s+durch)?/giu,
  /Zus[aä]tzlich[^\n]{0,160}\bversichert\b/giu,
  /(?:Als\s+)?mitversichert(?:\s+gelten)?/giu,
  /Versicherungsschutz\s+(?:besteht|gilt)/giu,
  /auf\s+[,„“"']*Erstes\s+Risiko/giu,
  /Katastrophen\s+bis/giu,
]);
const NEGATIVE_GOVERNORS = Object.freeze([
  SEMANTIC_NEGATIVE_COVERAGE_HEADING,
  /Nicht\s+versichert(?:\s+im\s+Rahmen[^:\n]{0,140})?\s+sind/giu,
  /nicht\s+mitversichert/giu,
  /(?:vom\s+Versicherungsschutz\s+)?ausgeschlossen/giu,
  /(?:Die\s+)?Versicherung(?:sschutz)?\s+erstreckt\s+sich\s+nicht/giu,
  /kein\s+Versicherungsschutz/giu,
]);
const INLINE_NEGATIVE_GOVERNORS = Object.freeze([
  /\b(?:jedoch\s+)?exklusive\b/giu,
]);
const MULTILINE_INTENTIONAL_NEGATIVE_GOVERNORS = Object.freeze([
  /\b(?:nicht|weder)\b[^.!?;]{0,120}\b(?:vors[aä]tzlich|Vorsatz)\b/giu,
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
  const context = String(contextText || "");
  let localStart = relativeStart;
  while (localStart > 0 && !/[.!?;\n\r]/u.test(context[localStart - 1]))
    localStart -= 1;
  const localPrefix = context.slice(
    localStart,
    relativeStart + String(exactText || "").length
  );
  if (lastPatternMatch(localPrefix, INLINE_NEGATIVE_GOVERNORS))
    return "NEGATIVE";
  const multilineIntentionalPrefix = `${String(scopeLeadText || "").slice(-180)}\n${localPrefix}`;
  if (
    lastPatternMatch(
      multilineIntentionalPrefix,
      MULTILINE_INTENTIONAL_NEGATIVE_GOVERNORS
    )
  )
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

function explicitPageTitleScopeKeys(occurrence) {
  const sectionScopeKeys = [
    occurrence?.sectionScopeHint?.scopeKey,
    ...(occurrence?.sectionScopeHint?.scopeKeys || []),
  ].filter(Boolean);
  if (sectionScopeKeys.length > 0) return [];
  const pageScopeKeys = [
    ...new Set(
      (occurrence?.pageScopeHints || [])
        .filter(
          ({ scopeKey, pageStart, text }) =>
            scopeKey?.endsWith("_INSURANCE") &&
            Number.isInteger(pageStart) &&
            pageStart <= 240 &&
            /versicherung\b/iu.test(text || "")
        )
        .map(({ scopeKey }) => scopeKey)
    ),
  ];
  return pageScopeKeys.length === 1 ? pageScopeKeys : [];
}

function resolvedCategoryView(worksheet, requirement) {
  return String(
    worksheet?.catalog?.categoryView ||
      String(requirement?.id || "").match(/^([A-Z]{2})-/u)?.[1] ||
      ""
  ).toUpperCase();
}

function occurrencePrecedingClauseText(occurrence) {
  const text = String(occurrence?.context?.text || "");
  const contextStart = Number(occurrence?.context?.documentStart);
  let currentStart = Number(occurrence?.documentStart) - contextStart;
  if (
    !Number.isInteger(contextStart) ||
    !Number.isInteger(currentStart) ||
    currentStart <= 0
  )
    return "";
  while (currentStart > 0 && !/[.!?;\n\r]/u.test(text[currentStart - 1]))
    currentStart -= 1;
  let end = currentStart;
  while (end > 0 && /[\s.!?;\n\r]/u.test(text[end - 1])) end -= 1;
  let start = end;
  while (start > 0 && !/[.!?;\n\r]/u.test(text[start - 1])) start -= 1;
  return text.slice(start, end);
}

function matchedNarrowAlias(requirement, occurrence) {
  const narrowAliases = requirement?.scopeRules?.narrowAliases || [];
  const scopeText = `${occurrence?.coverageGovernorHint?.text || ""}\n${
    occurrence?.scopeLead?.text || ""
  }\n${occurrencePrecedingClauseText(occurrence)}\n${occurrenceClauseText(
    occurrence
  )}`;
  return (
    narrowAliases.find((alias) => containsPhrase(scopeText, alias)) || null
  );
}

function factRoleMatchesGovernor(factRole, polarity, text) {
  if (!polarity || polarity === "UNKNOWN") return false;
  if (["PERIL", "DAMAGE", "EXCLUSION"].includes(factRole)) return true;
  if (factRole === "INSURED_OBJECT")
    return /(?:Sachen|Objekte|Gebäude|Anlagen|Einrichtungen|Bestandteile|Rohre?)/iu.test(
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

/**
 * Recognises an operative promise or denial in the sentence that contains the
 * exact occurrence. Unlike a carried list governor, German operative clauses
 * often place "ersetzt" after the matched noun phrase. Side effects: none.
 */
function operativeCoveragePolarity(occurrence) {
  const clause = occurrenceClauseText(occurrence);
  if (!containsPhrase(clause, occurrence?.exactText)) return "UNKNOWN";
  if (
    /\b(?:werden|wird)\b[\s\S]{0,220}?\b(?:nicht|keine?[nmr]?|keinerlei)\b[\s\S]{0,120}?\b(?:ersetzt|entschädigt|vergütet)\b/iu.test(
      clause
    ) ||
    /\b(?:kein\w*\s+Ersatz|nicht\s+(?:ersetzt|entschädigt|vergütet))\b/iu.test(
      clause
    )
  )
    return "NEGATIVE";
  if (
    /\b(?:es\s+)?(?:werden|wird)\b[\s\S]{0,320}?\b(?:ersetzt|entschädigt|vergütet)\b/iu.test(
      clause
    ) ||
    /\b(?:der\s+)?Versicherer\s+leistet\s+Entschädigung\b/iu.test(clause)
  )
    return "POSITIVE";
  return "UNKNOWN";
}

function explicitRoleMismatch(component, occurrence) {
  const clause = occurrenceClauseText(occurrence);
  const context = String(occurrence?.context?.text || "");
  const subjectBoundIndirectLightningLimit = Boolean(
    component?.id === "indirect_lightning_limit" &&
      /(?:indirekter?\s+Blitzschlag|Überspannung[\s\S]{0,80}Blitzschlag)/iu.test(
        context
      ) &&
      /(?:bis\s+(?:insgesamt\s+)?|mindestens\s+|maximal\s+)[\s\S]{0,100}(?:EUR|€|%|Versicherungssumme)/iu.test(
        context
      )
  );
  if (
    component?.factRole === "LIMIT" &&
    !subjectBoundIndirectLightningLimit &&
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

function technicalSubcomponentObjectBinding(component, occurrence) {
  if (component?.factRole !== "INSURED_OBJECT") return null;
  const exactObject = normalize(occurrence?.exactText);
  if (!exactObject) return null;
  const escapedObject = exactObject.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const clause = normalize(occurrenceClauseText(occurrence));
  const technicalReference = new RegExp(
    `\\b(?:betaetigungs|bedienungs|steuerungs|antriebs)\\p{L}*\\s+(?:fuer|von|der|des)\\s+(?:(?:die|das|den)\\s+)?${escapedObject}\\b`,
    "u"
  );
  if (!technicalReference.test(clause)) return null;
  return {
    binding: DETERMINISTIC_BINDING.MENTION_ONLY,
    basis: "TECHNICAL_SUBCOMPONENT_NOT_WHOLE_OBJECT",
    authoritative: true,
  };
}

function comparativeReferenceCostBinding(component, occurrence) {
  if (component?.id !== "rescue_costs") return null;
  const context = String(occurrence?.context?.text || "");
  if (
    !/(?:über|oberhalb)\b[\s\S]{0,120}\bRettungskosten\b[\s\S]{0,180}(?:hinausgeh\p{L}*|übersteig\p{L}*)/iu.test(
      context
    )
  )
    return null;
  return {
    binding: DETERMINISTIC_BINDING.MENTION_ONLY,
    basis: "EXCESS_COST_REFERENCE_NOT_RESCUE_COST_COVERAGE",
    authoritative: true,
  };
}

function explicitRecoursePartyMismatch({
  categoryView,
  requirement,
  occurrence,
}) {
  if (categoryView !== "VB" || requirement?.id !== "VB-15") return null;
  const clause = occurrenceClauseText(occurrence);
  if (
    !/(?:Regressverzicht\s+gegenüber\s+Mietern|gegen\s+einen\s+Mieter)/iu.test(
      clause
    ) ||
    /Wohnungseigentümer/iu.test(clause)
  )
    return null;
  return {
    binding: DETERMINISTIC_BINDING.MENTION_ONLY,
    basis: "TENANT_RECOURSE_NOT_UNIT_OWNER_RECOURSE",
    authoritative: true,
  };
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

function explicitTenantRecourseBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  const hpTarget =
    categoryView === "HP" &&
    requirement?.id === "HP-16" &&
    ["recourse_waiver", "tenants"].includes(component?.id);
  const vbTarget =
    categoryView === "VB" &&
    requirement?.id === "VB-16" &&
    ["residents_recourse_waiver", "residents", "tenants"].includes(
      component?.id
    );
  if (!hpTarget && !vbTarget) return null;
  const context = String(occurrence?.context?.text || "");
  if (
    !/gegen\s+einen\s+Mieter\s+des\s+versicherten\s+Gebäudes[\s\S]{0,320}?verzichtet\s+der\s+Versicherer\s+auf\s+seinen\s+Regressanspruch/iu.test(
      context
    )
  )
    return null;
  if (
    component?.id === "residents" &&
    !/mit\s+ihm\s+in\s+häuslicher\s+Gemeinschaft\s+lebenden\s+Familienangehörigen/iu.test(
      context
    )
  )
    return null;
  return {
    binding: DETERMINISTIC_BINDING.DIRECT,
    basis: `${categoryView}_16_EXPLICIT_TENANT_RECOURSE_WAIVER`,
    authoritative: true,
  };
}

function explicitHp02AnnualAggregateBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  if (
    categoryView !== "HP" ||
    requirement?.id !== "HP-02" ||
    component?.id !== "annual_aggregate_multiple" ||
    component?.factRole !== "LIMIT" ||
    occurrence?.sectionScopeHint?.scopeKey !== "HAFTPFLICHT_INSURANCE"
  )
    return null;
  const clause = occurrenceClauseText(occurrence);
  if (
    !/(?:Deckungssumme|Pauschal(?:deckungs|versicherungs)summe)/iu.test(
      clause
    ) ||
    !/(?:Versicherungsf[aä]lle\s+eines\s+Jahres|Jahresh[oö]chstleistung|Jahres(?:gesamt|aggregate))/iu.test(
      clause
    ) ||
    !/(?:maximal|höchstens|bis\s+zu)\s+(?:das\s+)?(?:\d{1,2}|ein(?:e[rmn]?)?|eins|zwei|drei|vier|f(?:ue|ü)nf|sechs|sieben|acht|neun|zehn|elf|zw(?:oe|ö)lf)\s*(?:-?\s*mal|-?\s*fach(?:e[snrm]?)?)/iu.test(
      clause
    )
  )
    return null;
  return {
    binding: DETERMINISTIC_BINDING.DIRECT,
    basis: "HP_02_EXPLICIT_ANNUAL_AGGREGATE_MULTIPLE",
    authoritative: true,
  };
}

/**
 * A labelled liability summary can state the combined sum without repeating
 * "Personen- und Sachschäden". In that established policy notation the one
 * Pauschalversicherungssumme is the common limit for both damage classes.
 * Requiring the liability section and a local numeric amount prevents a
 * generic reference to the sum from becoming coverage evidence.
 */
function explicitHp01CombinedLiabilitySumBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  if (
    categoryView !== "HP" ||
    requirement?.id !== "HP-01" ||
    ![
      "combined_liability_limit",
      "personal_injury",
      "property_damage",
    ].includes(component?.id) ||
    occurrence?.sectionScopeHint?.scopeKey !== "HAFTPFLICHT_INSURANCE"
  )
    return null;
  if (!/Pauschalversicherungssumme/iu.test(occurrence?.exactText || ""))
    return null;
  const clause = occurrenceClauseText(occurrence);
  if (
    !/Pauschalversicherungssumme\s*(?:beträgt\s*)?(?:EUR|€)\s*\d/iu.test(
      clause
    ) ||
    /(?:Sublimit|angerechnet|Jahresh[oö]chstleistung|Versicherungsf[aä]lle\s+eines\s+Jahres)/iu.test(
      clause
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "HP_01_COMBINED_SUM_REFERENCE_WITHOUT_STANDALONE_LIMIT",
      authoritative: true,
    };
  return {
    binding: DETERMINISTIC_BINDING.DIRECT,
    basis: "HP_01_EXPLICIT_COMBINED_LIABILITY_SUM",
    authoritative: true,
  };
}

/**
 * Binds the compact product-summary form of the builders-liability clause.
 * Both the insured construction activity and the separate total-construction
 * cost must occur locally; the liability sublimit alone is insufficient.
 */
function explicitHp08BuildersLiabilityBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  if (
    categoryView !== "HP" ||
    requirement?.id !== "HP-08" ||
    !["builders_liability", "construction_sum_limit"].includes(component?.id) ||
    occurrence?.sectionScopeHint?.scopeKey !== "HAFTPFLICHT_INSURANCE"
  )
    return null;
  const clause = String(occurrence?.context?.text || "");
  if (
    !/Bauherr[\s\S]{0,100}?(?:Umbau|Neubau|Sanierung)shaftpflichtrisiko/iu.test(
      clause
    ) ||
    !/Gesamtbaukosten\s*(?:EUR|€)\s*\d/iu.test(clause)
  )
    return null;
  return {
    binding: DETERMINISTIC_BINDING.DIRECT,
    basis: "HP_08_EXPLICIT_BUILDERS_LIABILITY_AND_CONSTRUCTION_SUM",
    authoritative: true,
  };
}

function explicitSt27RoofAvalancheBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  if (
    categoryView !== "ST" ||
    requirement?.id !== "ST-27" ||
    !["avalanche", "snow_slide"].includes(component?.id) ||
    component?.factRole !== "PERIL" ||
    occurrence?.sectionScopeHint?.scopeKey !== "STURM_INSURANCE"
  )
    return null;
  const clause = occurrenceClauseText(occurrence);
  if (
    !/Dachlawinen?\s*\(\s*Schnee\s+und\s+Eis\s*\)/iu.test(clause) ||
    !/auf\s+[,„“"']*Erstes\s+Risiko/iu.test(clause)
  )
    return null;
  return {
    binding: DETERMINISTIC_BINDING.DIRECT,
    basis: "ST_27_EXPLICIT_ROOF_AVALANCHE_SNOW_SLIDE",
    authoritative: true,
  };
}

function explicitFeA10NamedObjectScopeBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  if (
    categoryView !== "FE" ||
    requirement?.id !== "FE-A10" ||
    component?.id !== "foreign_vehicle_impact" ||
    component?.factRole !== "PERIL"
  )
    return null;
  const clause = occurrenceClauseText(occurrence);
  if (
    /Sch[aä]den\s+an\s+(?:allen\s+)?versicherten\s+Sachen[\s\S]{0,160}(?:unbekannte|fremde)\s+(?:Land|Kraft)?fahrzeuge/iu.test(
      clause
    )
  )
    return null;
  const localText = String(occurrence?.context?.text || "");
  if (
    !/(?:unbekannte|fremde)\s+(?:Land|Kraft)?fahrzeuge/iu.test(localText) ||
    !/Sch[aä]den\s+an[\s\S]{0,180}(?:Einfriedungen|Z[aä]unen?|Mauern?|Toren?|Kulturen|Grundst[üu]cksumz[aä]unungen|Grundst[üu]cksbegrenzungen)/iu.test(
      localText
    )
  )
    return null;
  return {
    binding: DETERMINISTIC_BINDING.NARROW_SCOPE,
    basis: "FE_A10_NAMED_DAMAGED_OBJECT_SCOPE",
    authoritative: true,
  };
}

function explicitFeF05InsurancePeriodBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  if (
    categoryView !== "FE" ||
    requirement?.id !== "FE-F05" ||
    component?.id !== "temporal_validity" ||
    component?.factRole !== "CONDITION"
  )
    return null;
  const context = String(occurrence?.context?.text || "");
  if (
    !/(?:Versicherungsbeginn|Beginn\s+der\s+Versicherung)\s*:?\s*(?:0?[1-9]|[12]\d|3[01])[.]\s*(?:0?[1-9]|1[0-2])[.]\s*(?:19|20)\d{2}/iu.test(
      context
    ) ||
    !/(?:Versicherungsablauf|Ablauf\s+der\s+Versicherung)\s*:?\s*(?:0?[1-9]|[12]\d|3[01])[.]\s*(?:0?[1-9]|1[0-2])[.]\s*(?:19|20)\d{2}/iu.test(
      context
    )
  )
    return null;
  return {
    binding: DETERMINISTIC_BINDING.DIRECT,
    basis: "FE_F05_EXPLICIT_INSURANCE_PERIOD",
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

function isExplicitReinstatementDeadlineClause(clause) {
  const cardinal =
    "(?:\\d{1,3}|ein(?:e[rmn]?)?|eins|zwei(?:e[rmn])?|drei(?:e[rmn])?|vier(?:e[rmn])?|f(?:ue|ü)nf(?:e[rmn])?|sechs(?:e[rmn])?|sieben(?:e[rmn])?|acht(?:e[rmn])?|neun(?:e[rmn])?|zehn(?:e[rmn])?|elf(?:e[rmn])?|zw(?:oe|ö)lf(?:e[rmn])?)";
  const duration = `${cardinal}\\s+(?:Stunde(?:n)?|Tag(?:e|en)?|Woche(?:n)?|Monat(?:e|en)?|Jahr(?:e|en)?)`;
  const restorationSubject =
    "(?:Wiederbeschaffung(?:\\s+oder\\s+Wiederherstellung)?|Wiederherstellung(?:\\s+oder\\s+Wiederbeschaffung)?)(?:\\s+(?:versicherter\\s+Sachen|des\\s+Gebäudes|der\\s+versicherten\\s+Sache))?";
  return (
    new RegExp(
      `${restorationSubject}\\s+(?:(?:muss|hat)\\s+)?(?:innerhalb|binnen)\\s+(?:von\\s+)?${duration}`,
      "iu"
    ).test(clause) ||
    new RegExp(
      `(?:innerhalb|binnen)\\s+(?:von\\s+)?${duration}(?:\\s+(?:nach\\s+dem\\s+Schadenfall|ab\\s+dem\\s+Schadentag))?\\s+(?:wiederbeschafft|wiederhergestellt)`,
      "iu"
    ).test(clause) ||
    /Frist\s+f[üu]r\s+die\s+Wiederherstellung[\s\S]{0,100}?Dauer\s+des\s+Deckungsprozesses[\s\S]{0,60}?erstreckt/iu.test(
      clause
    )
  );
}

function explicitVbGeneralContractFactBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  if (
    categoryView !== "VB" ||
    occurrence?.sectionScopeHint?.scopeKey !== "GENERAL_CONTRACT_TERMS"
  )
    return null;
  const clause = occurrenceClauseText(occurrence);
  let basis = null;
  if (
    requirement?.id === "VB-01" &&
    component?.id === "contract_term" &&
    /(?:Vertragslaufzeit|Laufzeit(?:\s+des\s+Vertrages)?)\s*(?:von\s+)?(?:mind(?:estens)?\.?\s+)?\d{1,3}\s+Jahr(?:e|en)?/iu.test(
      clause
    )
  )
    basis = "VB_01_EXPLICIT_CONTRACT_TERM";
  if (
    requirement?.id === "VB-26" &&
    component?.id === "reinstatement_deadline" &&
    isExplicitReinstatementDeadlineClause(clause)
  )
    basis = "VB_26_EXPLICIT_REINSTATEMENT_DEADLINE";
  if (
    requirement?.id === "VB-27" &&
    component?.id === "total_premium" &&
    /Gesamtprämie[\s\S]{0,120}?\b(?:beträgt|beläuft\s+sich\s+auf)\s+(?:(?:monatlich|vierteljährlich|halbjährlich|jährlich)\s+)?(?:EUR|€)\s*\d/iu.test(
      clause
    )
  )
    basis = "VB_27_EXPLICIT_TOTAL_PREMIUM";
  if (
    requirement?.id === "VB-27" &&
    component?.id === "tax_included" &&
    (/(?:Gesamtprämie[\s\S]{0,80}?(?:inkl\.?|inklusive)\s+Steuern)/iu.test(
      clause
    ) ||
      /Gesamtprämie[\s\S]{0,120}?Steuern\s+und\s+Abgaben[\s\S]{0,80}?enthalten/iu.test(
        clause
      ))
  )
    basis = "VB_27_EXPLICIT_TAX_INCLUSION";
  return basis
    ? {
        binding: DETERMINISTIC_BINDING.DIRECT,
        basis,
        authoritative: true,
      }
    : null;
}

/**
 * Recognises the operative VB-24 right to appoint a different expert. This is
 * a procedural entitlement, so valid contract wording does not contain a
 * classic coverage governor such as "mitversichert" or "ersetzt". The three
 * anchors deliberately have to occur in the same local context to avoid
 * turning bare headings or cost clauses into a procedure benefit.
 */
function explicitVb24ExpertProcedureBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  if (
    categoryView !== "VB" ||
    requirement?.id !== "VB-24" ||
    component?.id !== "expert_procedure" ||
    component?.factRole !== "BENEFIT" ||
    (occurrence?.sectionScopeHint?.scopeKey &&
      occurrence.sectionScopeHint.scopeKey !== "GENERAL_CONTRACT_TERMS")
  )
    return null;

  const context = String(occurrence?.context?.text || "");
  if (
    !/mit\s+dem\s+Gutachten\s+des\s+vom\s+Versicherer\s+bestellten\s+Sachverständigen\s+nicht\s+einverstanden/iu.test(
      context
    ) ||
    !/frei,?\s+einen\s+Sachverständigen\s+des\s+jeweiligen\s+Sachgebietes\s+namhaft\s+zu\s+machen/iu.test(
      context
    ) ||
    !/Gutachten\s+tritt\s+an\s+Stelle\s+des\s+Schiedsgutachterverfahrens/iu.test(
      context
    )
  )
    return null;

  return {
    binding: DETERMINISTIC_BINDING.DIRECT,
    basis: "VB_24_EXPLICIT_EXPERT_PROCEDURE_RIGHT",
    authoritative: true,
  };
}

/**
 * Recognises a concrete claims-service contact block. Both the operational
 * service and a locally stated telephone channel are mandatory so a generic
 * mention of claims handling or an unrelated contact cannot satisfy VB-36.
 */
function explicitVb36ClaimsServiceBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  if (
    categoryView !== "VB" ||
    requirement?.id !== "VB-36" ||
    !["claims_handling", "claims_contact"].includes(component?.id) ||
    (occurrence?.sectionScopeHint?.scopeKey &&
      occurrence.sectionScopeHint.scopeKey !== "GENERAL_CONTRACT_TERMS")
  )
    return null;
  const context = String(occurrence?.context?.text || "");
  if (
    !/Schadenmanagement/iu.test(context) ||
    !/(?:unter\s+)?(?:\+?43[\s/-]*)?0?800(?:[\s/-]*\d{2,4}){2,4}/iu.test(
      context
    ) ||
    !/rund\s+um\s+die\s+Uhr[\s\S]{0,140}?telefonische\s+Schadenmeldung/iu.test(
      context
    ) ||
    !/(?:Beratung\s+und\s+Hilfestellung|wir\s+kümmern\s+uns\s+um)/iu.test(
      context
    )
  )
    return null;
  return {
    binding: DETERMINISTIC_BINDING.DIRECT,
    basis: "VB_36_EXPLICIT_CLAIMS_SERVICE_AND_TELEPHONE_CONTACT",
    authoritative: true,
  };
}

const GENERAL_BRANCH_MAXIMUM_TARGETS = Object.freeze({
  FE: Object.freeze({
    requirementId: "FE-F02",
    componentId: "fire_maximum_indemnity",
  }),
  LW: Object.freeze({
    requirementId: "LW-31",
    componentId: "water_line_maximum_compensation",
  }),
  ST: Object.freeze({
    requirementId: "ST-34",
    componentId: "storm_maximum_compensation",
  }),
});

function isGeneralBranchMaximumTarget({
  categoryView,
  requirementId,
  componentId,
}) {
  const target = GENERAL_BRANCH_MAXIMUM_TARGETS[categoryView];
  return Boolean(
    target &&
      target.requirementId === requirementId &&
      target.componentId === componentId
  );
}

/**
 * Binds a cross-branch maximum only when one general-contract clause states
 * all three grammatical anchors: operative maximum, applicability to the
 * respective branch, and a numeric percentage of the agreed sum insured.
 * This deliberately does not bind annual aggregates or branch-independent
 * maximum wording. Side effects: none. Role: decide.
 */
function explicitGeneralBranchMaximumBinding({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  if (
    !isGeneralBranchMaximumTarget({
      categoryView,
      requirementId: requirement?.id,
      componentId: component?.id,
    }) ||
    component?.factRole !== "LIMIT" ||
    occurrence?.sectionScopeHint?.scopeKey !== "GENERAL_CONTRACT_TERMS"
  )
    return null;

  const clause = occurrenceClauseText(occurrence);
  if (
    !/Höchstentschädigung\s+im\s+Schadensfall[\s\S]{0,100}?beträgt/iu.test(
      clause
    ) ||
    !/für\s+die\s+jeweilige\s+Sparte\s+vereinbarten\s+Positionen/iu.test(
      clause
    ) ||
    !/(?:maximal|höchstens)\s+\d{1,3}(?:[.,]\d+)?\s*%\s+der\s+vereinbarten\s+Versicherungssumme/iu.test(
      clause
    )
  )
    return null;

  return {
    binding: DETERMINISTIC_BINDING.DIRECT,
    basis: "GENERAL_BRANCH_MAXIMUM_INDEMNITY",
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
  const technicalSubcomponentBinding = technicalSubcomponentObjectBinding(
    component,
    occurrence
  );
  if (technicalSubcomponentBinding) return technicalSubcomponentBinding;

  const comparativeCostReference = comparativeReferenceCostBinding(
    component,
    occurrence
  );
  if (comparativeCostReference) return comparativeCostReference;

  const recoursePartyMismatch = explicitRecoursePartyMismatch({
    categoryView,
    requirement,
    occurrence,
  });
  if (recoursePartyMismatch) return recoursePartyMismatch;

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

  const tenantRecourseBinding = explicitTenantRecourseBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (tenantRecourseBinding) return tenantRecourseBinding;

  const hp02Binding = explicitHp02AnnualAggregateBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (hp02Binding) return hp02Binding;

  const hp01Binding = explicitHp01CombinedLiabilitySumBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (hp01Binding) return hp01Binding;

  const hp08Binding = explicitHp08BuildersLiabilityBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (hp08Binding) return hp08Binding;

  const st27RoofAvalancheBinding = explicitSt27RoofAvalancheBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (st27RoofAvalancheBinding) return st27RoofAvalancheBinding;

  const feA10NamedObjectScopeBinding = explicitFeA10NamedObjectScopeBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (feA10NamedObjectScopeBinding) return feA10NamedObjectScopeBinding;

  const feF05Binding = explicitFeF05InsurancePeriodBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (feF05Binding) return feF05Binding;

  const hp11Binding = explicitHp11LiabilityScopeBinding({
    categoryView,
    requirement,
    occurrence,
  });
  if (hp11Binding) return hp11Binding;

  const vbGeneralFactBinding = explicitVbGeneralContractFactBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (vbGeneralFactBinding) return vbGeneralFactBinding;

  const vb24ExpertProcedureBinding = explicitVb24ExpertProcedureBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (vb24ExpertProcedureBinding) return vb24ExpertProcedureBinding;

  const vb36ClaimsServiceBinding = explicitVb36ClaimsServiceBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (vb36ClaimsServiceBinding) return vb36ClaimsServiceBinding;

  const generalBranchMaximumBinding = explicitGeneralBranchMaximumBinding({
    categoryView,
    requirement,
    component,
    occurrence,
  });
  if (generalBranchMaximumBinding) return generalBranchMaximumBinding;

  const roleMismatch = explicitRoleMismatch(component, occurrence);
  if (roleMismatch)
    return {
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: roleMismatch,
    };

  const expectedScopeKeys = expectedCategoryScopeKeys(categoryView);
  const observedScopeKeys = [
    occurrence?.sectionScopeHint?.scopeKey,
    ...(occurrence?.sectionScopeHint?.scopeKeys || []),
    ...explicitPageTitleScopeKeys(occurrence),
  ].filter(Boolean);
  const narrowAlias = matchedNarrowAlias(requirement, occurrence);
  const narrowScopeKey = observedScopeKeys.find((scopeKey) =>
    (requirement?.scopeRules?.narrowScopeKeys || []).includes(scopeKey)
  );
  const matchingScopeKey = observedScopeKeys.find((scopeKey) =>
    expectedScopeKeys.includes(scopeKey)
  );
  if (
    observedScopeKeys.length > 0 &&
    expectedScopeKeys.length > 0 &&
    !matchingScopeKey &&
    !narrowScopeKey &&
    !narrowAlias
  )
    return STRICT_COVERAGE_CATEGORY_VIEWS.has(categoryView) &&
      observedScopeKeys.some((scopeKey) => scopeKey.endsWith("_INSURANCE"))
      ? {
          binding: DETERMINISTIC_BINDING.MENTION_ONLY,
          basis: "EXPLICIT_OTHER_CATEGORY_SECTION",
        }
      : null;

  const operativePolarity = operativeCoveragePolarity(occurrence);
  const operativeClause = occurrenceClauseText(occurrence);
  if (
    matchingScopeKey &&
    operativePolarity !== "UNKNOWN" &&
    factRoleMatchesGovernor(
      component?.factRole,
      operativePolarity,
      operativeClause
    )
  )
    return {
      binding:
        narrowAlias || narrowScopeKey
          ? DETERMINISTIC_BINDING.NARROW_SCOPE
          : DETERMINISTIC_BINDING.DIRECT,
      basis: `EXPLICIT_${operativePolarity}_OPERATIVE_COVERAGE_CLAUSE`,
      authoritative: true,
    };

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
  const explicitCategoryListClause = Boolean(
    matchingScopeKey &&
      occurrence?.coverageGovernorHint?.text &&
      occurrence?.context?.unitType === "LIST_ITEM" &&
      containsPhrase(occurrence?.context?.text, occurrence?.exactText) &&
      (lastPatternMatch(
        occurrence.coverageGovernorHint.text,
        POSITIVE_GOVERNORS
      ) ||
        lastPatternMatch(
          occurrence.coverageGovernorHint.text,
          NEGATIVE_GOVERNORS
        ))
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
    ...(explicitVariantListClause || explicitCategoryListClause
      ? { authoritative: true }
      : {}),
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

  const operativePolarity = operativeCoveragePolarity({
    exactText: candidate.exactText,
    documentStart: candidate.documentStart,
    documentEnd: candidate.documentEnd,
    context: {
      text: candidate.contextText,
      documentStart: candidate.contextDocumentStart,
    },
  });
  if (operativePolarity === "NEGATIVE") return COVERAGE_EFFECT.EXCLUDED;
  if (operativePolarity === "POSITIVE") {
    if (target.factRole === "DEFINITION") return COVERAGE_EFFECT.DEFINED;
    if (["LIMIT", "DEDUCTIBLE", "CONDITION"].includes(target.factRole))
      return COVERAGE_EFFECT.DEFINED;
    return COVERAGE_EFFECT.INCLUDED;
  }

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
    isGeneralBranchMaximumTarget({
      categoryView: target.categoryView,
      requirementId: target.requirementId,
      componentId: target.componentId,
    }) &&
    target.candidates.every(
      ({ deterministicBindingBasis }) =>
        deterministicBindingBasis === "GENERAL_BRANCH_MAXIMUM_INDEMNITY"
    )
  )
    return {
      selectedCandidateIds: target.candidates.map(
        ({ candidateId }) => candidateId
      ),
      coverageEffect: COVERAGE_EFFECT.DEFINED,
      basis: `EXPLICIT_GENERAL_BRANCH_MAXIMUM:${target.categoryView}:${target.requirementId}`,
    };
  if (
    target.categoryView === "FE" &&
    target.requirementId === "FE-F05" &&
    target.componentId === "temporal_validity" &&
    target.candidates.every(
      ({ deterministicBindingBasis }) =>
        deterministicBindingBasis === "FE_F05_EXPLICIT_INSURANCE_PERIOD"
    )
  )
    return {
      selectedCandidateIds: target.candidates.map(
        ({ candidateId }) => candidateId
      ),
      coverageEffect: COVERAGE_EFFECT.DEFINED,
      basis: "EXPLICIT_FEF05_INSURANCE_PERIOD:FE:FE-F05",
    };
  if (
    target.categoryView === "HP" &&
    target.requirementId === "HP-02" &&
    target.componentId === "annual_aggregate_multiple" &&
    target.candidates.every(
      ({ deterministicBindingBasis }) =>
        deterministicBindingBasis === "HP_02_EXPLICIT_ANNUAL_AGGREGATE_MULTIPLE"
    )
  )
    return {
      selectedCandidateIds: target.candidates.map(
        ({ candidateId }) => candidateId
      ),
      coverageEffect: COVERAGE_EFFECT.DEFINED,
      basis: "EXPLICIT_HP02_ANNUAL_AGGREGATE_MULTIPLE:HP:HP-02",
    };
  if (
    target.categoryView === "ST" &&
    target.requirementId === "ST-27" &&
    ["avalanche", "snow_slide"].includes(target.componentId)
  ) {
    const selectedCandidateIds = target.candidates
      .filter(
        ({ deterministicBindingBasis }) =>
          deterministicBindingBasis ===
          "ST_27_EXPLICIT_ROOF_AVALANCHE_SNOW_SLIDE"
      )
      .map(({ candidateId }) => candidateId);
    if (selectedCandidateIds.length > 0)
      return {
        selectedCandidateIds,
        coverageEffect: COVERAGE_EFFECT.INCLUDED,
        basis: "EXPLICIT_ST27_ROOF_AVALANCHE_SNOW_SLIDE:ST:ST-27",
      };
  }
  if (
    target.categoryView === "VB" &&
    ["VB-01", "VB-26", "VB-27"].includes(target.requirementId) &&
    target.candidates.every(({ deterministicBindingBasis }) =>
      /^(?:VB_01_EXPLICIT_CONTRACT_TERM|VB_26_EXPLICIT_REINSTATEMENT_DEADLINE|VB_27_EXPLICIT_(?:TOTAL_PREMIUM|TAX_INCLUSION))$/u.test(
        deterministicBindingBasis || ""
      )
    )
  )
    return {
      selectedCandidateIds: target.candidates.map(
        ({ candidateId }) => candidateId
      ),
      coverageEffect: COVERAGE_EFFECT.DEFINED,
      basis: `EXPLICIT_GENERAL_CONTRACT_FACT:${target.categoryView}:${target.requirementId}`,
    };
  if (
    target.categoryView === "VB" &&
    target.requirementId === "VB-24" &&
    target.componentId === "expert_procedure"
  ) {
    const selectedCandidateIds = target.candidates
      .filter(
        ({ deterministicBindingBasis }) =>
          deterministicBindingBasis === "VB_24_EXPLICIT_EXPERT_PROCEDURE_RIGHT"
      )
      .map(({ candidateId }) => candidateId);
    if (selectedCandidateIds.length > 0)
      return {
        selectedCandidateIds,
        coverageEffect: COVERAGE_EFFECT.INCLUDED,
        basis: "EXPLICIT_VB24_EXPERT_PROCEDURE_RIGHT:VB:VB-24",
      };
  }
  const hp16Target =
    target.categoryView === "HP" &&
    target.requirementId === "HP-16" &&
    ["recourse_waiver", "tenants"].includes(target.componentId);
  const vb16Target =
    target.categoryView === "VB" &&
    target.requirementId === "VB-16" &&
    ["residents_recourse_waiver", "residents", "tenants"].includes(
      target.componentId
    );
  if (hp16Target || vb16Target) {
    const selectedCandidateIds = target.candidates
      .filter(
        ({ contextText }) =>
          /Mieter[\s\S]{0,260}verzichtet\s+der\s+Versicherer\s+auf\s+seinen\s+Regressanspruch/iu.test(
            contextText || ""
          ) &&
          (target.componentId !== "residents" ||
            /mit\s+ihm\s+in\s+häuslicher\s+Gemeinschaft\s+lebenden\s+Familienangehörigen/iu.test(
              contextText || ""
            ))
      )
      .map(({ candidateId }) => candidateId);
    if (selectedCandidateIds.length > 0)
      return {
        selectedCandidateIds,
        coverageEffect:
          vb16Target || target.componentId === "recourse_waiver"
            ? COVERAGE_EFFECT.INCLUDED
            : COVERAGE_EFFECT.DEFINED,
        basis: `EXPLICIT_${target.categoryView}16_TENANT_RECOURSE_WAIVER:${target.categoryView}:${target.requirementId}`,
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
