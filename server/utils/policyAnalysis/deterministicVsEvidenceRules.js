const { COVERAGE_EFFECT } = require("./categoryResultContract");

const DETERMINISTIC_BINDING = Object.freeze({
  DIRECT: "DIRECT",
  NARROW_SCOPE: "NARROW_SCOPE",
  MENTION_ONLY: "MENTION_ONLY",
});

const INDEX_TYPE_PATTERNS = Object.freeze([
  /BKI\s*2020\s*\(Baukostenindex\s+f[üu]r\s+den\s+Wohnhaus-\s+und\s+Siedlungsbau\s*-\s*Baumeisterarbeiten\s+2020\s*-\s*Insgesamt\)/iu,
  /Baukostenindex\s*\(Baumeisterarbeiten\)/iu,
  /Baukostenindex\s+f[üu]r\s+den\s+Wohnungs-\s+und\s+Siedlungsbau/iu,
]);

function evidenceText(occurrence) {
  return `${String(occurrence?.scopeLead?.text || "")}\n${String(
    occurrence?.context?.text || ""
  )}`;
}

function occurrenceContextText(occurrence) {
  return String(occurrence?.context?.text || "");
}

function occurrenceLocalText(occurrence, before = 620, after = 420) {
  const context = occurrenceContextText(occurrence);
  const contextStart = Number(occurrence?.context?.documentStart);
  const occurrenceStart = Number(occurrence?.documentStart);
  const occurrenceEnd = Number(occurrence?.documentEnd);
  if (
    !Number.isInteger(contextStart) ||
    !Number.isInteger(occurrenceStart) ||
    !Number.isInteger(occurrenceEnd)
  )
    return null;
  const relativeStart = occurrenceStart - contextStart;
  const relativeEnd = occurrenceEnd - contextStart;
  if (
    relativeStart < 0 ||
    relativeEnd < relativeStart ||
    relativeEnd > context.length
  )
    return null;
  return context.slice(
    Math.max(0, relativeStart - before),
    Math.min(context.length, relativeEnd + after)
  );
}

function textImmediatelyBeforeOccurrence(occurrence, length = 220) {
  const context = occurrenceContextText(occurrence);
  const contextStart = Number(occurrence?.context?.documentStart);
  const occurrenceStart = Number(occurrence?.documentStart);
  if (!Number.isInteger(contextStart) || !Number.isInteger(occurrenceStart))
    return null;
  const relativeStart = occurrenceStart - contextStart;
  if (relativeStart < 0 || relativeStart > context.length) return null;
  return context.slice(Math.max(0, relativeStart - length), relativeStart);
}

function explicitVs35LocalClauseBinding(key, occurrence) {
  const exactText = String(occurrence?.exactText || "").trim();
  const localText = occurrenceLocalText(occurrence);
  const immediatelyBefore = textImmediatelyBeforeOccurrence(occurrence);
  if (!localText || immediatelyBefore === null) return null;
  if (
    /(?:setzt\s+nicht\s+voraus|nicht\s+(?:vorausgesetzt|erforderlich)|keine\s+Voraussetzung|optional|wahlweise|sofern\s+besonders\s+vereinbart)[\s\S]{0,160}$/iu.test(
      immediatelyBefore
    )
  )
    return null;
  if (
    key === "VS-35:restoration_clause" &&
    /^F[üu]r\s+die\s+Wiederherstellung\s+gen[üu]gt\s+es$/iu.test(exactText) &&
    /zerstörte\s+oder\s+beschädigte\s+Gebäude[\s\S]{0,180}?gleichen\s+Zweck\s+dienen/iu.test(
      localText
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_RESTORATION_CLAUSE",
      authoritative: true,
    };
  if (
    key === "VS-35:restoration_clause" &&
    /^Wiederaufbau\s+(?:bzw\.?|oder)\s+die\s+Wiederherstellung\s+kann\s+auch$/iu.test(
      exactText
    ) &&
    /Wiederaufbau[\s\S]{0,100}?Wiederherstellung[\s\S]{0,160}?innerhalb\s+Österreichs\s+erfolgen/iu.test(
      localText
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_RESTORATION_CLAUSE",
      authoritative: true,
    };
  if (
    key === "VS-35:reconstruction_period" &&
    /^diese\s+Frist\s+um\s+die\s+Dauer\s+dieses\s+Prozesses\s+erstreckt$/iu.test(
      exactText
    ) &&
    /Im\s+Falle\s+eines\s+Deckungsprozesses[\s\S]{0,140}?diese\s+Frist[\s\S]{0,100}?erstreckt/iu.test(
      localText
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_RECONSTRUCTION_PERIOD",
      authoritative: true,
    };
  const compensationGovernor =
    /(?:Entschädigungsleistung|Gesamtentschädigung|Neuwertentschädigung|Zeitwertentschädigung)[\s\S]{0,420}?(?:Voraussetzungen?|Anspruch|sichergestellt|Wiederherstellung|Wiederbeschaffung)/iu.test(
      localText
    );
  if (!compensationGovernor) return null;
  if (
    key === "VS-35:restoration_clause" &&
    /^(?:(?:die\s+)?Wiederherstellung\s+(?:bzw\.?|oder)\s+Wiederbeschaffung\s+zur\s+Gänze\s+sichergestellt|Entschädigung\s+zur\s+Gänze\s+f[üu]r\s+die\s+Wiederherstellung\s+(?:bzw\.?|oder)\s+Wiederbeschaffung\s+verwendet)$/iu.test(
      exactText
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_RESTORATION_CLAUSE",
      authoritative: true,
    };
  if (
    key === "VS-35:reconstruction_period" &&
    /^(?:die\s+)?Wiederherstellung\s+(?:bzw\.?|oder)\s+Wiederbeschaffung\s+(?:binnen|innerhalb(?:\s+von)?)\s+(?:3|drei|dreier)\s+Jahren?$/iu.test(
      exactText
    ) &&
    /(?:binnen|innerhalb(?:\s+von)?)\s+(?:3|drei|dreier)\s+Jahren?[\s\S]{0,180}?(?:erfolgt|bindende[\s\S]{0,100}?Aufträge)/iu.test(
      localText
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_RECONSTRUCTION_PERIOD",
      authoritative: true,
    };
  return null;
}

function explicitAutomaticIndexAdjustment(text) {
  const positive =
    /(?:Aufwertung\s+der\s+Geb[äa]udeversicherungssummen\s+und\s+Pr[äa]mien\s+erfolgt\s+nach|Versicherungssumme\s+erh[öo]ht\s+oder\s+vermindert\s+sich\s+j[äa]hrlich)/iu.test(
      text
    );
  if (!positive) return false;
  return !/(?:\bkeine?\s+(?:automatische\s+)?(?:Aufwertung|Wertanpassung|Indexanpassung)\b|\b(?:Aufwertung|Wertanpassung|Indexanpassung)\b[\s\S]{0,100}\b(?:entf[aä]llt|aufgehoben|ausgesetzt|findet\s+nicht\s+statt)\b|\b(?:erh[öo]ht|vermindert|angepasst|aufgewertet|indexiert)\b[\s\S]{0,40}\bnicht\b|\b(?:kann|wahlweise)\b[\s\S]{0,100}\b(?:angepasst|aufgewertet|indexiert)\b|\b(?:auf\s+Antrag|nach\s+Zustimmung|gegen\s+(?:eine\s+)?Mehrpr[aä]mie|sofern[\s\S]{0,80}\bvereinbart)\b)/iu.test(
    text
  );
}

function boundLimitFollowsOccurrence(occurrence) {
  const context = occurrenceContextText(occurrence);
  const contextStart = Number(occurrence?.context?.documentStart);
  const occurrenceEnd = Number(occurrence?.documentEnd);
  if (!Number.isInteger(contextStart) || !Number.isInteger(occurrenceEnd))
    return false;
  const relativeEnd = occurrenceEnd - contextStart;
  if (relativeEnd < 0 || relativeEnd > context.length) return false;
  const following = context.slice(relativeEnd, relativeEnd + 360);
  return /(?:EUR\s*\d+(?:\.\d{3})*(?:,\d{2})?|(?:\d{1,3}|[lI]0)\s*%|bis\s+zu\s+EUR|maximal\s+(?:EUR\s*)?(?:\d{1,3}|[lI]0)\s*%)/iu.test(
    following
  );
}

function boundSectionGovernorPrecedesOccurrence(occurrence) {
  const context = occurrenceContextText(occurrence);
  const contextStart = Number(occurrence?.context?.documentStart);
  const occurrenceStart = Number(occurrence?.documentStart);
  if (!Number.isInteger(contextStart) || !Number.isInteger(occurrenceStart))
    return false;
  const relativeStart = occurrenceStart - contextStart;
  if (relativeStart < 0 || relativeStart > context.length) return false;
  return /bis\s+zu\s+jeweils\s+(?:10|[lI]0)\s*%\s+der\s+Gebäudeversicherungssumme\s+auf\s+[,„“"']*Erstes\s+Risiko/iu.test(
    context.slice(0, relativeStart)
  );
}

function explicitVs32TemporaryStorageScopeBinding(occurrence) {
  const context = occurrenceContextText(occurrence);
  const contextStart = Number(occurrence?.context?.documentStart);
  const occurrenceEnd = Number(occurrence?.documentEnd);
  const relativeEnd =
    Number.isInteger(contextStart) && Number.isInteger(occurrenceEnd)
      ? Math.max(0, Math.min(context.length, occurrenceEnd - contextStart))
      : context.length;
  const precedingScope = `${String(occurrence?.scopeLead?.text || "")}\n${context.slice(0, relativeEnd)}`;
  if (
    !/(?:Sonderm[üu]ll|Sonderabfall|gef[aä]hrlich(?:er|em|en)?\s+Abfall|radioaktiv\s+verunreinigt|kontaminiert|Entsorgungsma[ßs]nahmen|Ablagerungsst[aä]tte|Deponierung)/iu.test(
      precedingScope
    )
  )
    return null;
  return {
    binding: DETERMINISTIC_BINDING.NARROW_SCOPE,
    basis: "VS_32_WASTE_OR_CONTAMINATION_STORAGE_SCOPE",
    authoritative: true,
  };
}

const EXPLICIT_COMPONENT_RULES = Object.freeze({
  "VS-15:outbuilding_cover": {
    basis: "EXPLICIT_OUTBUILDING_COVER",
    pattern:
      /(?:Versicherungsschutz\s+f[üu]r[\s\S]{0,260}?Nebengebäude|(?:gemeinschaftlich\s+genutzte\s+)?Nebengebäude[\s\S]{0,220}?auf\s+Erstes\s+Risiko)/iu,
    reject: /(?:Schadenersatzverpflichtungen|Haftpflicht)/iu,
  },
  "VS-15:named_outbuilding_designation": {
    basis: "EXPLICIT_NAMED_OUTBUILDING_DESIGNATION",
    pattern:
      /(?:namentlich\s+angef[üu]hrte\s+Nebengebäude|Nebengebäude\s+namentlich\s+in\s+der\s+Polizze\s+angef[üu]hrt)/iu,
  },
  "VS-19:outdoor_paths": {
    basis: "EXPLICIT_OUTDOOR_PATHS",
    pattern: /Außenanlagen[\s\S]{0,900}?Gehwege/iu,
  },
  "VS-13:apartment_interior_fitout": {
    basis: "EXPLICIT_RESIDENT_INTERIOR_ADAPTATIONS",
    pattern: /-\s*Adaptierungen\s+und\s+Investitionen\s+der\s+Bewohner\s*;/iu,
    reject: /(?:Vorsorge|unerkannt\s+getätigte)/iu,
  },
  "VS-14:apartment_special_equipment": {
    basis: "EXPLICIT_APARTMENT_SPECIAL_EQUIPMENT_ABOVE_STANDARD",
    pattern:
      /(?=[\s\S]{0,800}\b(?:versichert|mitversichert|eingeschlossen|Versicherungsschutz)\b)[\s\S]{0,800}?(?:Sonderausstattung(?:en)?(?:\s+einzelner|\s+der)?\s+Wohnungen?[^.;\n]{0,220}(?:über\s+(?:die\s+)?Standardausführung\s+hinaus|übersteigt?\s+(?:die\s+)?Standardausführung)|(?:über\s+(?:die\s+)?Standardausführung\s+hinaus|übersteigt?\s+(?:die\s+)?Standardausführung)[^.;\n]{0,220}Sonderausstattung(?:en)?(?:\s+einzelner|\s+der)?\s+Wohnungen?)/iu,
    reject:
      /(?:nicht\s+(?:mit)?versichert|ausgeschlossen|keine\s+Deckung|Vorsorge|unerkannt\s+getätigte|Begriffsbestimmung|Definition)/iu,
  },
  "VS-19:outdoor_lighting": {
    basis: "EXPLICIT_OUTDOOR_LIGHTING",
    pattern:
      /(?:Außenanlagen[\s\S]{0,300}?Beleuchtungsanlagen|Beleuchtungskörper\s+für\s+allgemeine\s+Räume[\s\S]{0,160}?im\s+Freien)/iu,
    reject:
      /Verglasung\s+von\s+(?:Firmenschildern,\s*)?Außenbeleuchtung|Bruch\s+der\s+Verglasung[\s\S]{0,100}?Außenbeleuchtung|Elektroinstallationen[\s\S]{0,500}?Beleuchtungsanlagen/iu,
  },
  "VS-19:planting": {
    basis: "EXPLICIT_OUTDOOR_PLANTING",
    binding: DETERMINISTIC_BINDING.NARROW_SCOPE,
    pattern:
      /(?:Grünflächen,\s*Gartenanlagen,\s*Bäume|Revitalisierungs-[\s\S]{0,120}?Neupflanzungskosten\s+für\s+Gartenanlagen[\s\S]{0,220}?mitversichert|Bäume\s+und\s+Sträucher[\s\S]{0,140}?(?:Feuerversicherung|mitversichert|auf\s+Erstes\s+Risiko))/iu,
    reject:
      /(?:Schadenersatzverpflichtungen|Haftpflicht|aus\s+der\s+Innehabung|Beregnung[\s\S]{0,180}?Bewässerung)/iu,
  },
  "VS-20:playground": {
    basis: "EXPLICIT_PLAYGROUND",
    pattern:
      /(?:Einrichtungen\s+von\s+Kinderspiel-\s+und\s+Wäscheplätzen|Spielplatzeinrichtungen[\s\S]{0,180}?(?:auf\s+Erstes\s+Risiko|fest\s+installierte\s+Kinderspielgeräte|Als\s+mitversichert\s+gelten))/iu,
    reject:
      /(?:Schadenersatzverpflichtungen|Haftpflicht|aus\s+der\s+Innehabung)/iu,
  },
  "VS-20:playground_equipment": {
    basis: "EXPLICIT_PLAYGROUND_EQUIPMENT",
    pattern:
      /(?:Einrichtungen\s+von\s+Kinderspiel-\s+und\s+Wäscheplätzen|Spielplatzeinrichtungen[\s\S]{0,180}?(?:auf\s+Erstes\s+Risiko|fest\s+installierte\s+Kinderspielgeräte|Als\s+mitversichert\s+gelten)|fest\s+installierte\s+Kinderspielgeräte)/iu,
    reject:
      /(?:Schadenersatzverpflichtungen|Haftpflicht|aus\s+der\s+Innehabung)/iu,
  },
  "VS-22:disposal_costs": {
    basis: "EXPLICIT_DISPOSAL_COSTS",
    pattern:
      /(?:Entsorgungskosten\s+sind\s+Kosten|Kosten\s+für\s+(?:die\s+)?Behandlung\s+von\s+(?:Sondermüll|gefährlichem\s+Abfall)[\s\S]{0,500}?mitversichert|Mehrkosten\s+für\s+die\s+Behandlung\s+von\s+gefährlichem\s+Abfall[\s\S]{0,180}?(?:Gebäudeversicherungssumme|mitversichert))/iu,
  },
  "VS-22:hazardous_waste": {
    basis: "EXPLICIT_HAZARDOUS_WASTE_COSTS",
    pattern:
      /(?:Kosten\s+für\s+(?:die\s+)?Behandlung\s+von\s+(?:Sondermüll|gefährlichem\s+Abfall)[\s\S]{0,500}?mitversichert|Mehrkosten\s+für\s+die\s+Behandlung\s+von\s+gefährlichem\s+Abfall[\s\S]{0,180}?(?:Gebäudeversicherungssumme|mitversichert))/iu,
    reject:
      /keine\s+Position\s+Sondermüll\s+versichert|auch\s+wenn[\s\S]{0,100}?keine\s+Position\s+Sondermüll/iu,
  },
  "VS-23:movement_costs": {
    basis: "EXPLICIT_MOVEMENT_COSTS",
    pattern:
      /(?:Bewegungs-\s*,?\s*Schutz-[\s\S]{0,180}?bis\s+zu\s+maximal|Bewegungs-\s+und\s+Schutzkosten,?\s+sind\s+Kosten)/iu,
  },
  "VS-23:protection_costs": {
    basis: "EXPLICIT_PROTECTION_COSTS",
    pattern:
      /(?:Bewegungs-\s*,?\s*Schutz-[\s\S]{0,180}?bis\s+zu\s+maximal|Bewegungs-\s+und\s+Schutzkosten,?\s+sind\s+Kosten)/iu,
  },
  "VS-25:authority_reconstruction_extra_costs": {
    basis: "EXPLICIT_AUTHORITY_RECONSTRUCTION_COSTS",
    pattern:
      /(?:Mehrkosten\s+durch\s+behördliche\s+Auflagen(?:[\s\S]{0,180}?auf\s+Erstes\s+Risiko|[\s\S]{0,80}?Das\s+sind\s+Kosten)|Mehrkosten\s+für\s+bauliche\s+Verbesserungen[\s\S]{0,500}?(?:gesetzlicher|baupolizeilicher|feuerpolizeilicher|technischer)\s+Vorschriften)/iu,
  },
  "VS-29:rent_loss_amount_basis": {
    basis: "EXPLICIT_RENT_LOSS_AMOUNT_OR_BASIS",
    pattern:
      /(?:Mietverlust[\s\S]{0,200}?bis\s+zu\s+sechs\s+Monaten|Entgang\s+von\s+Mietzinseinnahmen[\s\S]{0,180}?auf\s+Erstes\s+Risiko|Versichert\s+gilt\s+der\s+Entgang\s+an\s+Erträgen)/iu,
  },
  "VS-31:hotel_or_replacement_accommodation_costs": {
    basis: "EXPLICIT_REPLACEMENT_ACCOMMODATION_COSTS",
    pattern:
      /(?:tatsächlichen\s+Kosten\s+für\s+Ersatzräumlichkeiten|Kosten\s+für\s+ein\s+Hotelzimmer\s*\/\s*Pension|Mehrkosten\s+für\s+eine\s+Ersatzunterkunft[\s\S]{0,180}?(?:auf\s+Erstes\s+Risiko|Der\s+Versicherer\s+ersetzt))/iu,
  },
  "VS-31:uninhabitability": {
    basis: "EXPLICIT_UNINHABITABILITY_CONDITION",
    pattern:
      /(?:Dauer\s+der\s+tatsächlichen\s+Unbenutzbarkeit|derart\s+beschädigt[\s\S]{0,100}?unbenutzbar)/iu,
  },
  "VS-31:accommodation_due_to_uninhabitability": {
    basis: "EXPLICIT_ACCOMMODATION_CAUSAL_CONDITION",
    pattern:
      /(?:Ersatzräumlichkeiten\s+für\s+die\s+Dauer\s+der\s+tatsächlichen\s+Unbenutzbarkeit|Mehrkosten\s+für\s+eine\s+Ersatzunterkunft\s+für\s+die\s+maximale\s+Dauer|Ersatzunterkunft,?\s+weil[\s\S]{0,240}?unbenutzbar)/iu,
  },
  "VS-33:contingency_cover_or_automatic_increase": {
    basis: "EXPLICIT_CONTINGENCY_COVER",
    pattern:
      /(?:Vorsorge\s+für\s+Neu-,\s*Zu-\s+und\s+Umbauten|Vorsorgeversicherung[\s\S]{0,180}?mit\s+einer\s+Versicherungssumme[\s\S]{0,100}?EUR)/iu,
    reject:
      /(?:Summenausgleich[\s\S]{0,500}?Aufteilung\s+der\s+Vorsorgeversicherung|Wurde\s+eine\s+Vorsorgeversicherung\s+vereinbart|Vorsorgeversicherungssumme\s+dient\s+(?:ausschließlich\s+)?zum\s+Ausgleich)/iu,
  },
  "VS-34:community_devices": {
    basis: "EXPLICIT_COMMUNITY_DEVICES",
    pattern:
      /(?:Werkzeuge,?\s+Geräte\s+und\s+Maschinen,?\s+welche\s+zur\s+Pflege\s+und\s+Wartung|Gemeinschaftliche\s+Einrichtungen,?\s+das\s+sind\s+Einrichtungen\s+und\s+Geräte|(?:Einfriedungen,?\s*)?Außenanlagen,?\s+gemeinschaftliche\s+Einrichtungen,?\s+Spielplatzeinrichtungen[\s\S]{0,120}?(?:auf\s+Erstes\s+Risiko|Als\s+mitversichert\s+gelten))/iu,
  },
  "VS-34:community_tools": {
    basis: "EXPLICIT_COMMUNITY_TOOLS",
    pattern:
      /Werkzeuge,?\s+Geräte\s+und\s+Maschinen,?\s+welche\s+zur\s+Pflege\s+und\s+Wartung/iu,
  },
  "VS-35:restoration_clause": {
    basis: "EXPLICIT_RESTORATION_CLAUSE",
    pattern:
      /(?:Verwendung\s+der\s+Entschädigung[\s\S]{0,300}?(?:Wiederbeschaffung|Wiederherstellung)|nicht\s+innerhalb\s+dreier\s+Jahre[\s\S]{0,220}?Entschädigung\s+nach\s+dem\s+Zeitwert|Frist\s+f[üu]r\s+die\s+Wiederherstellung[\s\S]{0,140}?Deckungsprozesses)/iu,
  },
  "VS-35:reconstruction_period": {
    basis: "EXPLICIT_RECONSTRUCTION_PERIOD",
    pattern:
      /(?:innerhalb\s+dreier\s+Jahre[\s\S]{0,200}?(?:sichergestellt|wiederhergestellt)|nicht\s+innerhalb\s+dreier\s+Jahre[\s\S]{0,220}?Entschädigung\s+nach\s+dem\s+Zeitwert|Frist\s+f[üu]r\s+die\s+Wiederherstellung[\s\S]{0,140}?Deckungsprozesses)/iu,
  },
  "VS-36:maximum_indemnity_per_event": {
    basis: "EXPLICIT_MAXIMUM_INDEMNITY_PER_LOSS",
    pattern:
      /Höchstentschädigung\s+im\s+Schadensfall[\s\S]{0,220}?maximal\s+150\s*%/iu,
  },
});

const LIMIT_COMPONENT_KEYS = new Set([
  "VS-22:hazardous_waste_cost_limit",
  "VS-23:movement_and_protection_cost_limit",
  "VS-25:authority_reconstruction_extra_cost_limit",
  "VS-31:accommodation_cost_limit",
  "VS-33:contingency_cover_or_automatic_increase_limit",
]);

const LIMIT_RULE_SOURCE = Object.freeze({
  "VS-22:hazardous_waste_cost_limit": "VS-22:hazardous_waste",
  "VS-23:movement_and_protection_cost_limit": "VS-23:movement_costs",
  "VS-25:authority_reconstruction_extra_cost_limit":
    "VS-25:authority_reconstruction_extra_costs",
  "VS-31:accommodation_cost_limit":
    "VS-31:hotel_or_replacement_accommodation_costs",
  "VS-33:contingency_cover_or_automatic_increase_limit":
    "VS-33:contingency_cover_or_automatic_increase",
});

function hasIndexType(text) {
  return INDEX_TYPE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Resolves only VS candidate bindings whose semantic role is proven by an
 * explicit legal phrase. Generic mentions stay non-evidentiary. Unknown
 * wording returns null and therefore remains an LLM decision.
 * Role: decide. Side effects: none.
 */
function deterministicVsCandidateBinding({
  requirementId,
  componentId,
  occurrence,
}) {
  const text = evidenceText(occurrence);
  const key = `${requirementId}:${componentId}`;
  const vs35LocalBinding = explicitVs35LocalClauseBinding(key, occurrence);
  if (vs35LocalBinding) return vs35LocalBinding;
  if (key === "VS-32:temporary_storage_costs") {
    const storageScope = explicitVs32TemporaryStorageScopeBinding(occurrence);
    if (storageScope) return storageScope;
  }
  if (
    ["VS-21:cleanup_costs", "VS-21:demolition_costs"].includes(key) &&
    occurrence?.sectionScopeHint?.scopeKey === "HAFTPFLICHT_INSURANCE"
  )
    return {
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "LIABILITY_SECTION_NOT_PROPERTY_CLEANUP_COST_COVER",
    };
  if (
    key === "VS-01:replacement_new_value" &&
    /(?:zum\s+Neuwert\s+zu\s+ersetzen|Wohngeb[äa]ude\s+zum\s+Neuwert|volle\s+Neuwertentsch[äa]digung\s+geleistet)/iu.test(
      text
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_NEW_VALUE_BENEFIT",
    };

  if (
    key === "VS-02:current_value_clause" &&
    /nicht\s+innerhalb\s+dreier\s+Jahre[\s\S]{0,260}?Entsch[äa]digung\s+nach\s+dem\s+Zeitwert/iu.test(
      text
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_CURRENT_VALUE_CLAUSE",
    };

  if (
    key === "VS-02:residual_value_threshold" &&
    /Zeitwert\s+von\s+mindestens\s+30\s*%/iu.test(text)
  )
    return {
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_RESIDUAL_VALUE_THRESHOLD",
    };

  if (
    key === "VS-07:underinsurance_waiver" &&
    /(?:(?:der\s+Versicherer\s+verzichtet|verzichtet\s+der\s+Versicherer)[\s\S]{0,180}?auf\s+den\s+Einwand|Verzicht\s+auf\s+den\s+Einwand)\s+(?:(?:einer\s+eventuell\s+bestehenden|der)\s+)?Unterversicherung/iu.test(
      text
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_UNDERINSURANCE_WAIVER",
    };

  if (
    key === "VS-08:underinsurance_waiver_condition" &&
    /(?:verzichtet\s+nicht|kein\s+Verzicht|Verzicht[\s\S]{0,80}?(?:aufgehoben|entf[äa]llt|findet\s+nicht\s+statt)|(?:kann|k[öo]nnte|wahlweise)[\s\S]{0,100}?verzicht)/iu.test(
      text
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "NEGATED_OR_OPTIONAL_UNDERINSURANCE_WAIVER",
    };

  if (
    key === "VS-08:underinsurance_waiver_condition" &&
    /(?:f[üu]r\s+alle\s+jene\s+Objekte,\s+f[üu]r\s+die|im\s+Schadenfall\s+nur\s+Anwendung,\s+wenn|bezieht\s+sich\s+der\s+Verzicht[\s\S]{0,100}?nur|verzichtet[\s\S]{0,180}?auf\s+den\s+Einwand\s+(?:einer\s+)?Unterversicherung[\s\S]{0,220}?soweit[\s\S]{0,120}?Versicherungssumme[\s\S]{0,160}?um\s+nicht\s+mehr\s+als\s+\d+(?:[.,]\d+)?\s*%[\s\S]{0,80}?vom\s+Versicherungswert\s+abweich)/iu.test(
      text
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_UNDERINSURANCE_CONDITION",
    };

  if (
    key === "VS-09:underinsurance_waiver_prerequisites" &&
    /(?:Neuwertsch[äa]tzgutachten\s+besteht|Versicherungssumme\s+dem\s+Neuwert\s+des\s+Gutachtens\s+entspricht|im\s+Schadenfall\s+nur\s+Anwendung,\s+wenn|Bei\s+Bestehen\s+mehrfacher\s+Versicherungen\s+f[üu]r\s+dasselbe\s+Interesse)/iu.test(
      text
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_UNDERINSURANCE_PREREQUISITE",
    };

  if (
    key === "VS-10:automatic_index_adjustment" &&
    explicitAutomaticIndexAdjustment(text)
  )
    return {
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_AUTOMATIC_INDEX_ADJUSTMENT",
    };

  if (key === "VS-11:index_type")
    return hasIndexType(text)
      ? {
          binding: DETERMINISTIC_BINDING.DIRECT,
          basis: "EXPLICIT_INDEX_TYPE",
        }
      : {
          binding: DETERMINISTIC_BINDING.MENTION_ONLY,
          basis: "GENERIC_INDEX_MENTION_WITHOUT_TYPE",
        };

  if (
    key === "VS-19:outdoor_paths" &&
    /^Außenanlagen$/iu.test(String(occurrence?.exactText || "").trim()) &&
    !/(?:Gehwege|befestigt(?:e|er|en|em|es)?\s+(?:Wege|Flächen)|Zufahrtswege|Asphaltierungen|Bodenbefestigungen)/iu.test(
      occurrenceContextText(occurrence)
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "GENERIC_OUTDOOR_FACILITIES_WITHOUT_PATHS",
      authoritative: true,
    };
  if (
    key === "VS-19:planting" &&
    /Begrenzungen[\s\S]{0,180}?Grünflächen/iu.test(text) &&
    !/(?:Gartenanlagen|Neupflanzungskosten|Bäume\s+und\s+Sträucher)/iu.test(
      occurrenceContextText(occurrence)
    )
  )
    return {
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "GREEN_AREA_BOUNDARY_NOT_PLANTING_COVER",
    };
  if (
    key === "VS-14:apartment_special_equipment" &&
    /Adaptierungen\s+und\s+Investitionen\s+der\s+Bewohner/iu.test(text)
  )
    return {
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "RESIDENT_ADAPTATIONS_DO_NOT_PROVE_ABOVE_STANDARD_EQUIPMENT",
    };

  const sourceRuleKey = LIMIT_RULE_SOURCE[key] || key;
  const explicitRule = EXPLICIT_COMPONENT_RULES[sourceRuleKey];
  if (explicitRule) {
    if (explicitRule.reject?.test(text))
      return {
        binding: DETERMINISTIC_BINDING.MENTION_ONLY,
        basis: `${explicitRule.basis}_WRONG_SCOPE`,
      };
    if (explicitRule.pattern.test(text)) {
      if (
        LIMIT_COMPONENT_KEYS.has(key) &&
        !boundLimitFollowsOccurrence(occurrence) &&
        !boundSectionGovernorPrecedesOccurrence(occurrence)
      )
        return {
          binding: DETERMINISTIC_BINDING.MENTION_ONLY,
          basis: `${explicitRule.basis}_WITHOUT_BOUND_LIMIT`,
        };
      return {
        binding: explicitRule.binding || DETERMINISTIC_BINDING.DIRECT,
        basis: explicitRule.basis,
      };
    }
  }

  if (key === "VS-15:outbuilding_cover" && /Nebengebäude/iu.test(text))
    return {
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "GENERIC_OUTBUILDING_MENTION_WITHOUT_COVER",
    };
  if (
    ["VS-35:restoration_clause", "VS-35:reconstruction_period"].includes(key) &&
    /(?:Wiederherstellung|Wiederaufbau)/iu.test(text)
  )
    return {
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "GENERIC_RESTORATION_MENTION_WITHOUT_CLAUSE",
    };

  return null;
}

const EFFECT_BY_COMPONENT = Object.freeze({
  "VS-01:replacement_new_value": COVERAGE_EFFECT.INCLUDED,
  "VS-02:current_value_clause": COVERAGE_EFFECT.INCLUDED,
  "VS-02:residual_value_threshold": COVERAGE_EFFECT.INCLUDED,
  "VS-07:underinsurance_waiver": COVERAGE_EFFECT.INCLUDED,
  "VS-08:underinsurance_waiver_condition": COVERAGE_EFFECT.CONDITIONAL,
  "VS-09:underinsurance_waiver_prerequisites": COVERAGE_EFFECT.CONDITIONAL,
  "VS-10:automatic_index_adjustment": COVERAGE_EFFECT.INCLUDED,
  "VS-11:index_type": COVERAGE_EFFECT.DEFINED,
  "VS-13:apartment_interior_fitout": COVERAGE_EFFECT.INCLUDED,
  "VS-14:apartment_special_equipment": COVERAGE_EFFECT.INCLUDED,
  "VS-15:outbuilding_cover": COVERAGE_EFFECT.INCLUDED,
  "VS-15:named_outbuilding_designation": COVERAGE_EFFECT.DEFINED,
  "VS-19:outdoor_paths": COVERAGE_EFFECT.INCLUDED,
  "VS-19:outdoor_lighting": COVERAGE_EFFECT.INCLUDED,
  "VS-19:planting": COVERAGE_EFFECT.INCLUDED,
  "VS-20:playground": COVERAGE_EFFECT.INCLUDED,
  "VS-20:playground_equipment": COVERAGE_EFFECT.INCLUDED,
  "VS-22:disposal_costs": COVERAGE_EFFECT.INCLUDED,
  "VS-22:hazardous_waste": COVERAGE_EFFECT.INCLUDED,
  "VS-22:hazardous_waste_cost_limit": COVERAGE_EFFECT.DEFINED,
  "VS-23:movement_costs": COVERAGE_EFFECT.INCLUDED,
  "VS-23:protection_costs": COVERAGE_EFFECT.INCLUDED,
  "VS-23:movement_and_protection_cost_limit": COVERAGE_EFFECT.DEFINED,
  "VS-25:authority_reconstruction_extra_costs": COVERAGE_EFFECT.INCLUDED,
  "VS-25:authority_reconstruction_extra_cost_limit": COVERAGE_EFFECT.DEFINED,
  "VS-29:rent_loss_amount_basis": COVERAGE_EFFECT.INCLUDED,
  "VS-31:hotel_or_replacement_accommodation_costs": COVERAGE_EFFECT.INCLUDED,
  "VS-31:uninhabitability": COVERAGE_EFFECT.DEFINED,
  "VS-31:accommodation_due_to_uninhabitability": COVERAGE_EFFECT.DEFINED,
  "VS-31:accommodation_cost_limit": COVERAGE_EFFECT.DEFINED,
  "VS-33:contingency_cover_or_automatic_increase": COVERAGE_EFFECT.INCLUDED,
  "VS-33:contingency_cover_or_automatic_increase_limit":
    COVERAGE_EFFECT.DEFINED,
  "VS-34:community_devices": COVERAGE_EFFECT.INCLUDED,
  "VS-34:community_tools": COVERAGE_EFFECT.INCLUDED,
  "VS-35:restoration_clause": COVERAGE_EFFECT.DEFINED,
  "VS-35:reconstruction_period": COVERAGE_EFFECT.DEFINED,
  "VS-36:maximum_indemnity_per_event": COVERAGE_EFFECT.INCLUDED,
});

function deterministicSelectionKey(target, candidate) {
  const text = String(candidate.contextText || "");
  if (target.requirementId === "VS-11") {
    const indexPattern = INDEX_TYPE_PATTERNS.findIndex((pattern) =>
      pattern.test(text)
    );
    return indexPattern === -1 ? null : `INDEX_TYPE:${indexPattern}`;
  }
  const contextStart = Number(candidate.contextDocumentStart);
  return Number.isInteger(contextStart)
    ? `CONTEXT:${contextStart}`
    : `CONTEXT_TEXT:${text}`;
}

function minimalDeterministicSelection(target) {
  const selected = new Map();
  for (const candidate of target.candidates) {
    const key = deterministicSelectionKey(target, candidate);
    if (key === null) return null;
    if (!selected.has(key)) selected.set(key, candidate.candidateId);
  }
  return [...selected.values()];
}

/**
 * Produces a terminal effect only when every surviving candidate was already
 * server-bound by the explicit VS rules above. Mixed or future wording stays
 * model-owned instead of being guessed.
 * Role: decide. Side effects: none.
 */
function deterministicVsPreparedDecision(target) {
  const coverageEffect =
    EFFECT_BY_COMPONENT[`${target?.requirementId}:${target?.componentId}`];
  if (!coverageEffect || !Array.isArray(target?.candidates)) return null;
  if (target.candidates.length === 0) return null;
  if (
    target.candidates.some(
      (candidate) =>
        ![
          DETERMINISTIC_BINDING.DIRECT,
          DETERMINISTIC_BINDING.NARROW_SCOPE,
        ].includes(candidate.candidateBinding) ||
        !candidate.deterministicBindingBasis
    )
  )
    return null;
  const selectedCandidateIds = minimalDeterministicSelection(target);
  if (!selectedCandidateIds) return null;
  return {
    selectedCandidateIds,
    coverageEffect,
    basis: `EXPLICIT_VS_RULE:${target.requirementId}`,
  };
}

module.exports = {
  DETERMINISTIC_BINDING,
  deterministicVsCandidateBinding,
  deterministicVsPreparedDecision,
};
