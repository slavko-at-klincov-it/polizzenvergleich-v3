const crypto = require("crypto");
const {
  FOLLOWING_STRUCTURAL_BOUNDARY_KIND,
  FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID,
  validFollowingStructuralBoundaryProof,
} = require("./controlledOccurrenceWorksheet");
const {
  VS22_OTHER_SCOPE_BASIS,
  isVs22LiabilityOrStorageOccurrence,
  localOccurrenceSentence,
} = require("./vs22WasteScopeContract");

const DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_OTHER_CATEGORY_TERMINAL_V1";
const LEGACY_DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_V1";
const DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_V2";
const DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_V1";
const DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_V1";
const DETERMINISTIC_VS22_NON_TARGET_WASTE_OCCURRENCE_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_VS22_NON_TARGET_WASTE_OCCURRENCE_TERMINAL_V1";
const DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASSIFICATION_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASSIFICATION_TERMINAL_V1";
const DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_V2";
const TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID =
  "TERMINAL_OCCURRENCE_PROVENANCE_V3";
const COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID =
  "TERMINAL_OCCURRENCE_PROVENANCE_V5_OBJECT_CLASSIFICATION_SCOPE_LEAD";
const TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID =
  "TERMINAL_REJECTION_SET_PROVENANCE_V3";
const FE_C12_POST_LOSS_SCAFFOLDING_COST_DECISION_BASIS =
  "POST_LOSS_GLASS_REPAIR_SCAFFOLDING_COST_NOT_INSURED_OBJECT";
const FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE =
  "OCCURRENCE_LOCAL_POST_LOSS_GLASS_REPAIR_COST_V1";
const OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE = "OCCURRENCE_LOCAL_CLAUSE";
const LW20_NON_TARGET_OCCURRENCE_DECISION_BASIS =
  "LW20_NON_TARGET_GROUNDWATER_OCCURRENCE";
const LW20_NON_TARGET_OCCURRENCE_SCOPE_PROOF_MODE =
  "LW20_LOCAL_ROLE_OR_STORM_SCOPE_V1";
const VS22_NON_TARGET_WASTE_SCOPE_PROOF_MODE =
  "VS22_LOCAL_LIABILITY_OR_STORAGE_SCOPE_V1";
const COVERAGE_ONLY_OBJECT_CLASSIFICATION_DECISION_BASIS =
  "PURE_OBJECT_CLASSIFICATION_IS_NOT_OPERATIONAL_COVERAGE";
const COVERAGE_ONLY_OBJECT_CLASSIFICATION_SCOPE_PROOF_MODE =
  "LOCAL_PURE_OBJECT_CLASSIFICATION_V1";
const COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_DECISION_BASIS =
  "PURE_OBJECT_CLASS_EXCLUSION_IS_NOT_OPERATIONAL_COVERAGE";
const COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_SCOPE_PROOF_MODE =
  "LOCAL_PURE_OBJECT_CLASS_EXCLUSION_V2_GENERIC_LISTING_PREAMBLE";
const GENERIC_POLICY_LISTING_ELIGIBILITY_PREAMBLE_TREATMENT =
  "GENERIC_POLICY_LISTING_ELIGIBILITY_PREAMBLE_BEFORE_OBJECT_CLASS_BOUNDARY_V1";
const GENERIC_POLICY_LISTING_ELIGIBILITY_PREAMBLE =
  /(?:Definition\s+und\s+Zuordnung\.\s*)?Versicherungsschutz\s+besteht\s+ausschlie(?:ß|ss)lich\s+f(?:ü|u)r\s+jene\s+Sachen,\s+die\s+in\s+der\s+Polizze\s+angef(?:ü|u)hrt\s+sind\.\s*/iu;

const COVERAGE_ONLY_OBJECT_CLASSIFICATION_TARGETS = Object.freeze({
  "LW:LW-12:underfloor_heating": Object.freeze({
    contractId:
      DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASSIFICATION_TERMINAL_CONTRACT_ID,
    decisionBasis: COVERAGE_ONLY_OBJECT_CLASSIFICATION_DECISION_BASIS,
    auditProofMode:
      "ALL_OCCURRENCES_DETERMINISTICALLY_PURE_OBJECT_CLASSIFICATIONS",
    scopeProofMode: COVERAGE_ONLY_OBJECT_CLASSIFICATION_SCOPE_PROOF_MODE,
    terminalGate: "deterministicCoverageOnlyObjectClassificationTerminal",
    factRole: "INSURED_OBJECT",
    absenceMeaning: "COVERAGE_ONLY",
    membership: "MEMBER_OF_CLASS",
    allowedSubjects: ["Haustechnische Anlagen und Adaptierungen"],
    allowPrecedingScopeLeadReset: false,
  }),
  "VS:VS-19:outdoor_lighting": Object.freeze({
    contractId:
      DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_CONTRACT_ID,
    decisionBasis: COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_DECISION_BASIS,
    auditProofMode:
      "ALL_OCCURRENCES_DETERMINISTICALLY_PURE_OBJECT_CLASS_EXCLUSIONS",
    scopeProofMode: COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_SCOPE_PROOF_MODE,
    terminalGate: "deterministicCoverageOnlyObjectClassExclusionTerminal",
    factRole: "INSURED_OBJECT",
    absenceMeaning: "COVERAGE_ONLY",
    membership: "EXCLUDED_FROM_CLASS",
    allowedSubjects: ["Gebäude oder Gebäudebestandteile", "Betriebsinhalt"],
    allowedExactTexts: ["Beleuchtungsanlagen"],
    scopeLeadTargetConcept:
      /\b(?:Au(?:ß|ss)enbeleuchtung|Beleuchtungsanlagen?|Beleuchtungsk(?:ö|o)rper)\b/iu,
    maximumClassificationToContextGap: 16,
    allowPrecedingScopeLeadReset: true,
  }),
  "VS:VS-19:outdoor_paths": Object.freeze({
    contractId:
      DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_CONTRACT_ID,
    decisionBasis: COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_DECISION_BASIS,
    auditProofMode:
      "ALL_OCCURRENCES_DETERMINISTICALLY_PURE_OBJECT_CLASS_EXCLUSIONS",
    scopeProofMode: COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_SCOPE_PROOF_MODE,
    terminalGate: "deterministicCoverageOnlyObjectClassExclusionTerminal",
    factRole: "INSURED_OBJECT",
    absenceMeaning: "COVERAGE_ONLY",
    membership: "EXCLUDED_FROM_CLASS",
    allowedSubjects: ["Gebäude oder Gebäudebestandteile", "Betriebsinhalt"],
    allowedExactTexts: ["Außenanlagen"],
    scopeLeadTargetConcept:
      /\b(?:Au(?:ß|ss)enanlagen?|Gehwege?|Zufahrtswege?|befestigte(?:n|r|s)?\s+(?:Wege?|Fl(?:ä|a)chen?)|Bodenbefestigungen?|Asphalt(?:ierungen?)?|verlegte(?:n|r|s)?\s+Fl(?:ä|a)chen?|betonierte(?:n|r|s)?\s+Fl(?:ä|a)chen?)\b/iu,
    maximumClassificationToContextGap: 16,
    allowPrecedingScopeLeadReset: true,
  }),
});

const POST_LOSS_SCAFFOLDING_COST_TARGETS = Object.freeze({
  "FE:FE-C12:scaffolding": Object.freeze({
    factRole: "INSURED_OBJECT",
    absenceMeaning: "COVERAGE_MIXED",
    scopeProofMode: FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE,
  }),
});

const LW20_NON_TARGET_OCCURRENCE_TARGETS = Object.freeze({
  "LW:LW-20:ground_seepage_or_retained_water": Object.freeze({
    factRole: "PERIL",
    absenceMeaning: "COVERAGE_ONLY",
    scopeProofMode: LW20_NON_TARGET_OCCURRENCE_SCOPE_PROOF_MODE,
  }),
});

const VS22_NON_TARGET_WASTE_OCCURRENCE_TARGETS = Object.freeze({
  "VS:VS-22:hazardous_waste": Object.freeze({
    factRole: "INSURED_OBJECT",
    absenceMeaning: "COVERAGE_MIXED",
    scopeProofMode: VS22_NON_TARGET_WASTE_SCOPE_PROOF_MODE,
  }),
  "VS:VS-22:hazardous_waste_cost_limit": Object.freeze({
    factRole: "LIMIT",
    absenceMeaning: "COVERAGE_MIXED",
    scopeProofMode: VS22_NON_TARGET_WASTE_SCOPE_PROOF_MODE,
  }),
});

const CERTIFIED_TARGETS = Object.freeze({
  "FE:FE-B13:pre_inception_damage_exclusion": Object.freeze({
    factRole: "EXCLUSION",
    absenceMeaning: "EXCLUSION",
    otherScopeKey: "LEITUNGSWASSER_INSURANCE",
    exactClause: /\bvor\s+Beginn\s+des\s+Versicherungsschutzes\b/iu,
    targetCrossReference:
      /\b(?:Feuerversicherung|Feuerschaden|Brandschaden|Brandrisiko|Explosion|Blitzschlag)\b/iu,
    requirePageScopeHint: true,
  }),
  "ST:ST-14:skylight_dome": Object.freeze({
    factRole: "INSURED_OBJECT",
    absenceMeaning: "COVERAGE_ONLY",
    otherScopeKey: "GLASBRUCH_INSURANCE",
    exactClause: /\bLichtkuppeln?\b/iu,
    targetCrossReference:
      /\b(?:Sturm|Hagel|Schneedruck|Felssturz|Steinschlag|Erdrutsch|Lawine)\w*\b/iu,
    localCoverageRule: /\bversichert\s+sind\b/iu,
    localCoverageObject:
      /\b(?:Glasbruch|Glasversicherung|Glaspauschale|Geb[aä]udeverglasung|Verglasung)\w*\b/iu,
    scopeProofMode: "CURRENT_SECTION_PLUS_LOCAL_FOREIGN_COVERAGE_V1",
  }),
  "LW:LW-25:gradual_or_creeping_exclusion": Object.freeze({
    factRole: "DAMAGE",
    absenceMeaning: "COVERAGE_ONLY",
    otherScopeKey: "HAFTPFLICHT_INSURANCE",
    sectionScopeProofs: Object.freeze([
      Object.freeze({
        source: "PRECEDING_PAGE_HEADING",
        headingRule:
          /\bGeb[aä]ude-\s*und\s+Grundst[uü]ckshaftpflichtversicherung\b/iu,
        minimumPageDistance: 1,
        maximumPageDistance: 3,
      }),
      Object.freeze({
        source: "CURRENT_PAGE_HEADING",
        headingRule:
          /\bEntsch[aä]digung\s+aus\s+der\s+Haftpflichtversicherung\b/iu,
        minimumPageDistance: 0,
        maximumPageDistance: 0,
      }),
    ]),
    exactClause:
      /\b(?:Allm[aä]hlichkeitssch[aä]den?|Sch[aä]den\s+durch\s+Langzeiteinwirkung|Langzeitsch[aä]den?|allm[aä]hliche(?:r)?\s+Einwirkung\s+von\s+Feuchtigkeit|schleichende(?:r)?\s+Einwirkung)\b/iu,
    targetCrossReference:
      /\b(?:Leitungswasser(?:versicherung|sch[aä]den?)?|Rohr(?:bruch|gebrechen)|Zu-\s*und\s+Ableitungsrohre?|wasserf[uü]hrende\s+Rohre?|Armaturen?)\b/iu,
    localForeignRule:
      /(?:\bKein\s+Ersatz\s+wird\s+geleistet\b[\s\S]{0,260}\bAu[ßs]enseite\s+des\s+Geb[aä]udes\b|\bAllm[aä]hlichkeitssch[aä]den?\b[\s\S]{0,500}\b(?:AHVB|Schadenersatzverpflichtungen)\b)/iu,
    scopeProofMode: "INHERITED_LIABILITY_SECTION_PLUS_LOCAL_FOREIGN_CLAUSE_V1",
  }),
});

const NON_CONTRACTUAL_RISK_INFORMATION_TARGETS = Object.freeze({
  "EL:EL-12:flood_zone_exclusion_or_surcharge": Object.freeze({
    factRole: "CONDITION",
    absenceMeaning: "CONDITION_ONLY",
    matchedAlias: "CONCEPT_SEARCH:flood-risk-zone",
    sectionScopeKey: "STURM_INSURANCE",
    sectionScopeSource: "CURRENT_PAGE_HEADING",
    sectionHeadingRule: /\bSturmversicherung\b/iu,
    exactRiskInformation:
      /\bHochwasser[\s-]*Risiko[\s-]*Zone\s*:\s*unbekannt\b/iu,
    localRiskInformationRule:
      /\bRisikoinformation(?:en)?\s+zum\s+Versicherungsort\b/iu,
    contractualConsequenceRule:
      /(?:\b(?:HQ\s*\d+|HORA|ausgeschlossen|nicht\s+(?:mit)?versichert|kein\s+Versicherungsschutz|(?:mit)?versichert|eingeschlossen|mitgedeckt|gedeckt|Zuschlag|Pr[aä]mienzuschlag|Mehrpr[aä]mie|Pr[aä]mie|Beitrag|Selbstbehalt|Versicherungssumme|H[oö]chstentsch[aä]digung|Entsch[aä]digungsleistung|Entsch[aä]digungsgrenze|Sublimit|Limit|Deckung|Bedingung|wenn|sofern|vorausgesetzt|maximal|h[oö]chstens|bis\s+zu)\b|(?:EUR|€|\d\s*%))/iu,
    underwritingWorkflowRule:
      /\b(?:Annahme|Einzelpr[uü]fung|R[uü]cksprache|Risikopr[uü]fung|Freigabe|Zeichnung|Tarifierung|Vorbehalt|Sondervereinbarung)\b/iu,
    scopeProofMode: "CURRENT_RISK_INFORMATION_WITH_STRUCTURAL_BOUNDARY_V2",
  }),
});

function targetKey(categoryView, requirementId, componentId) {
  return `${categoryView || ""}:${requirementId || ""}:${componentId || ""}`;
}

function certifiedTerminalTarget({ categoryView, requirementId, componentId }) {
  const key = targetKey(categoryView, requirementId, componentId);
  const objectClassificationContract =
    COVERAGE_ONLY_OBJECT_CLASSIFICATION_TARGETS[key];
  if (objectClassificationContract)
    return Object.freeze({
      contractId: objectClassificationContract.contractId,
      decisionBasis: objectClassificationContract.decisionBasis,
      auditProofMode: objectClassificationContract.auditProofMode,
      terminalGate: objectClassificationContract.terminalGate,
      factRole: objectClassificationContract.factRole,
      absenceMeaning: objectClassificationContract.absenceMeaning,
      allowedObservedScopeKeys: [],
      sectionScopeSources: ["CURRENT_PAGE_OBJECT_CLASSIFICATION"],
      scopeProofMode: objectClassificationContract.scopeProofMode,
      occurrenceDigestContractId:
        COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID,
      objectClassificationMembership: objectClassificationContract.membership,
      allowedObjectClassificationSubjects:
        objectClassificationContract.allowedSubjects,
      allowedExactTexts: objectClassificationContract.allowedExactTexts || null,
      scopeLeadTargetConcept:
        objectClassificationContract.scopeLeadTargetConcept || null,
      maximumClassificationToContextGap:
        objectClassificationContract.maximumClassificationToContextGap ?? null,
      allowPrecedingScopeLeadReset:
        objectClassificationContract.allowPrecedingScopeLeadReset,
    });
  const lw20NonTargetContract = LW20_NON_TARGET_OCCURRENCE_TARGETS[key];
  if (lw20NonTargetContract)
    return Object.freeze({
      contractId: DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID,
      decisionBasis: LW20_NON_TARGET_OCCURRENCE_DECISION_BASIS,
      auditProofMode:
        "ALL_OCCURRENCES_DETERMINISTICALLY_NON_TARGET_GROUNDWATER",
      terminalGate: "deterministicLw20NonTargetOccurrenceTerminal",
      factRole: lw20NonTargetContract.factRole,
      absenceMeaning: lw20NonTargetContract.absenceMeaning,
      allowedObservedScopeKeys: ["STURM_INSURANCE"],
      sectionScopeSources: [
        "CURRENT_PAGE_HEADING",
        "PRECEDING_PAGE_HEADING",
        OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
      ],
      scopeProofMode: lw20NonTargetContract.scopeProofMode,
      occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
    });
  const vs22NonTargetContract = VS22_NON_TARGET_WASTE_OCCURRENCE_TARGETS[key];
  if (vs22NonTargetContract)
    return Object.freeze({
      contractId:
        DETERMINISTIC_VS22_NON_TARGET_WASTE_OCCURRENCE_TERMINAL_CONTRACT_ID,
      decisionBasis: VS22_OTHER_SCOPE_BASIS,
      auditProofMode:
        "ALL_OCCURRENCES_DETERMINISTICALLY_NON_TARGET_WASTE_SCOPE",
      terminalGate: "deterministicVs22NonTargetWasteOccurrenceTerminal",
      factRole: vs22NonTargetContract.factRole,
      absenceMeaning: vs22NonTargetContract.absenceMeaning,
      allowedObservedScopeKeys: ["HAFTPFLICHT_INSURANCE"],
      sectionScopeSources: [
        "CURRENT_PAGE_HEADING",
        "PRECEDING_PAGE_HEADING",
        OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
      ],
      scopeProofMode: vs22NonTargetContract.scopeProofMode,
      occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
    });
  const postLossScaffoldingCostContract =
    POST_LOSS_SCAFFOLDING_COST_TARGETS[key];
  if (postLossScaffoldingCostContract)
    return Object.freeze({
      contractId: DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID,
      decisionBasis: FE_C12_POST_LOSS_SCAFFOLDING_COST_DECISION_BASIS,
      auditProofMode:
        "ALL_OCCURRENCES_DETERMINISTICALLY_POST_LOSS_SCAFFOLDING_COSTS",
      terminalGate: "deterministicPostLossScaffoldingCostTerminal",
      factRole: postLossScaffoldingCostContract.factRole,
      absenceMeaning: postLossScaffoldingCostContract.absenceMeaning,
      allowedObservedScopeKeys: ["GLASBRUCH_INSURANCE"],
      sectionScopeSources: [
        "CURRENT_PAGE_HEADING",
        OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
      ],
      scopeProofMode: postLossScaffoldingCostContract.scopeProofMode,
      occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
    });
  const otherCategoryContract = CERTIFIED_TARGETS[key];
  if (otherCategoryContract)
    return Object.freeze({
      contractId: DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID,
      decisionBasis: "EXPLICIT_OTHER_CATEGORY_SECTION",
      auditProofMode: "ALL_OCCURRENCES_DETERMINISTICALLY_OUT_OF_CATEGORY",
      terminalGate: "deterministicOutOfCategoryTerminal",
      factRole: otherCategoryContract.factRole,
      absenceMeaning: otherCategoryContract.absenceMeaning,
      requiredObservedScopeKey: otherCategoryContract.otherScopeKey,
      allowedObservedScopeKeys: [otherCategoryContract.otherScopeKey],
      sectionScopeSources: canonicalStrings(
        otherCategoryContract.sectionScopeProofs?.map(
          ({ source }) => source
        ) || [
          otherCategoryContract.sectionScopeSource || "CURRENT_PAGE_HEADING",
        ]
      ),
      scopeProofMode: otherCategoryContract.scopeProofMode || null,
      occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
    });
  const riskInformationContract = NON_CONTRACTUAL_RISK_INFORMATION_TARGETS[key];
  if (!riskInformationContract) return null;
  return Object.freeze({
    contractId:
      DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID,
    decisionBasis: "EXPLICIT_NON_CONTRACTUAL_RISK_INFORMATION",
    auditProofMode:
      "ALL_OCCURRENCES_DETERMINISTICALLY_NON_CONTRACTUAL_RISK_INFORMATION",
    terminalGate: "deterministicNonContractualRiskInformationTerminal",
    factRole: riskInformationContract.factRole,
    absenceMeaning: riskInformationContract.absenceMeaning,
    requiredObservedScopeKey: riskInformationContract.sectionScopeKey,
    allowedObservedScopeKeys: canonicalStrings([
      riskInformationContract.sectionScopeKey,
      "LEITUNGSWASSER_INSURANCE",
    ]),
    sectionScopeSources: [riskInformationContract.sectionScopeSource],
    scopeProofMode: riskInformationContract.scopeProofMode,
    occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
  });
}

function canonicalStrings(values) {
  return [...new Set((values || []).map(String).filter(Boolean))].sort();
}

function observedScopeKeys(occurrence) {
  return canonicalStrings([
    occurrence?.sectionScopeHint?.scopeKey,
    ...(occurrence?.sectionScopeHint?.scopeKeys || []),
    ...(occurrence?.pageScopeHints || []).map(({ scopeKey }) => scopeKey),
  ]);
}

function feC12ObservedScopeKeys(occurrence) {
  return canonicalStrings(
    [
      occurrence?.sectionScopeHint?.scopeKey,
      ...(occurrence?.sectionScopeHint?.scopeKeys || []),
      ...(occurrence?.pageScopeHints || []).map(({ scopeKey }) => scopeKey),
    ].filter(Boolean)
  );
}

function lw20ObservedScopeKeys(occurrence) {
  return canonicalStrings(
    [
      occurrence?.sectionScopeHint?.scopeKey,
      ...(occurrence?.sectionScopeHint?.scopeKeys || []),
      ...(occurrence?.pageScopeHints || []).map(({ scopeKey }) => scopeKey),
    ].filter(Boolean)
  );
}

function terminalTargetAcceptsObservedScopes(target, scopes) {
  const canonical = canonicalStrings(scopes);
  return Boolean(
    target &&
      Array.isArray(scopes) &&
      JSON.stringify(canonical) === JSON.stringify(scopes) &&
      canonical.every((scope) => scope.endsWith("_INSURANCE")) &&
      canonical.includes(target.requiredObservedScopeKey) &&
      canonical.every((scope) =>
        target.allowedObservedScopeKeys.includes(scope)
      )
  );
}

function terminalTargetAcceptsScopeProof(
  target,
  { sectionScopeSource, observedScopeKeys: scopes }
) {
  if (
    [
      DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASSIFICATION_TERMINAL_CONTRACT_ID,
      DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_CONTRACT_ID,
    ].includes(target?.contractId)
  )
    return Boolean(
      target.sectionScopeSources.includes(sectionScopeSource) &&
        Array.isArray(scopes) &&
        scopes.length === 0
    );
  if (
    target?.contractId ===
    DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID
  ) {
    const canonical = canonicalStrings(scopes);
    if (
      !Array.isArray(scopes) ||
      JSON.stringify(canonical) !== JSON.stringify(scopes)
    )
      return false;
    if (sectionScopeSource === OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE)
      return canonical.length === 0;
    return (
      ["CURRENT_PAGE_HEADING", "PRECEDING_PAGE_HEADING"].includes(
        sectionScopeSource
      ) &&
      canonical.length === 1 &&
      canonical[0] === "STURM_INSURANCE"
    );
  }
  if (
    target?.contractId ===
    DETERMINISTIC_VS22_NON_TARGET_WASTE_OCCURRENCE_TERMINAL_CONTRACT_ID
  ) {
    const canonical = canonicalStrings(scopes);
    if (
      !Array.isArray(scopes) ||
      JSON.stringify(canonical) !== JSON.stringify(scopes)
    )
      return false;
    if (sectionScopeSource === OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE)
      return canonical.length === 0;
    return (
      ["CURRENT_PAGE_HEADING", "PRECEDING_PAGE_HEADING"].includes(
        sectionScopeSource
      ) &&
      canonical.length === 1 &&
      canonical[0] === "HAFTPFLICHT_INSURANCE"
    );
  }
  if (
    target?.contractId ===
    DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID
  ) {
    const canonical = canonicalStrings(scopes);
    if (
      !Array.isArray(scopes) ||
      JSON.stringify(canonical) !== JSON.stringify(scopes)
    )
      return false;
    if (sectionScopeSource === "CURRENT_PAGE_HEADING")
      return canonical.length === 1 && canonical[0] === "GLASBRUCH_INSURANCE";
    return (
      sectionScopeSource === OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE &&
      canonical.length === 0
    );
  }
  return Boolean(
    target?.sectionScopeSources?.includes(sectionScopeSource) &&
      terminalTargetAcceptsObservedScopes(target, scopes)
  );
}

function occurrenceLocalClauseText(occurrence) {
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
    occurrenceEnd > text.length ||
    text.slice(occurrenceStart, occurrenceEnd) !==
      String(occurrence?.exactText || "")
  )
    return null;

  const numberedBoundaries = [];
  for (const match of text.matchAll(/(?:^|\n)\s*\d+(?:\.\d+)+(?![\d.])/gu))
    numberedBoundaries.push(match.index + (match[0].startsWith("\n") ? 1 : 0));
  const precedingBoundary = numberedBoundaries
    .filter((index) => index <= occurrenceStart)
    .at(-1);
  const followingBoundary = numberedBoundaries.find(
    (index) => index > occurrenceStart
  );
  if (Number.isInteger(precedingBoundary))
    return text.slice(precedingBoundary, followingBoundary ?? text.length);

  if (
    ["LIST_ITEM", "PARAGRAPH"].includes(occurrence?.context?.unitType) &&
    text.length <= 1_000
  )
    return text;
  return text.slice(
    Math.max(0, occurrenceStart - 320),
    Math.min(text.length, occurrenceEnd + 320)
  );
}

/**
 * Proves that one FE-C12 scaffolding occurrence is a post-loss repair-cost
 * role, not an insured scaffolding object during renovation. The proof is
 * occurrence-local and fails closed on target scope, option, exclusion,
 * mixed scope, or incomplete provenance. Role: classify. Side effects: none.
 */
function feC12PostLossScaffoldingCostProof(occurrence) {
  const exactText = String(occurrence?.exactText || "");
  const matchedAlias = String(occurrence?.matchedAlias || "");
  const localClause = occurrenceLocalClauseText(occurrence);
  const occurrencePage =
    occurrence?.physicalPageNumber || occurrence?.pageNumber || null;
  if (
    !/^(?:Bau)?Gerüste?$/iu.test(exactText) ||
    !/^(?:Bau)?Gerüste?$/iu.test(matchedAlias) ||
    !localClause ||
    !localClause.includes(exactText) ||
    !Number.isInteger(occurrencePage) ||
    String(occurrence?.candidateId || "").length === 0 ||
    !Array.isArray(occurrence?.pageScopeHints)
  )
    return null;

  const costRole =
    /(?:\bGerüst(?:e)?kosten\b|\bGerüst(?:e)?\s*-\s*und\s+Krankosten\b|\bKosten\s+(?:für|der)\s+(?:(?:unbedingt\s+)?(?:notwendig|erforderlich)\p{L}*\s+){0,2}(?:Bau)?Gerüste?\b)/iu;
  const targetScope =
    /\b(?:Sanier\p{L}*|Renovier\p{L}*|Umbau\p{L}*|Instandsetz\p{L}*|Baustelleneinricht\p{L}*|Baustellenanlag\p{L}*|Bauhilfseinricht\p{L}*|Baucontainer\p{L}*|Bauger[aä]t\p{L}*|Bauarbeiten?)\b/iu;
  const conditionalOrNegative =
    /\b(?:nicht\s+(?:mit)?versichert|ausgeschlossen|kein(?:e[snmr]?)?\s+Versicherungsschutz|gegen\s+(?:Mehr|Zusatz)pr[aä]mie|optional|wahlweise|sofern|wenn|vorausgesetzt|besonders\s+vereinbart|nur\s+bei\s+Vereinbarung)\b/iu;
  const explicitInsuredObject =
    /(?:\b(?:versichert\s+sind|mitversichert\s+(?:sind|gelten))\s+(?:auch\s+)?(?:die\s+)?(?:Bau)?Gerüste?\b(?!\s*-\s*und\s+Krankosten)|\b(?:Bau)?Gerüste?\b[\s\S]{0,80}\b(?:gelten\s+als\s+versicherte\s+Sachen|sind\s+(?:mit)?versichert)\b)/iu;
  if (
    !costRole.test(localClause) ||
    targetScope.test(localClause) ||
    conditionalOrNegative.test(localClause) ||
    explicitInsuredObject.test(localClause)
  )
    return null;

  const scopes = feC12ObservedScopeKeys(occurrence);
  const sectionScope = occurrence?.sectionScopeHint || null;
  const explicitCurrentGlassSection = Boolean(
    sectionScope?.scopeKey === "GLASBRUCH_INSURANCE" &&
      sectionScope?.source === "CURRENT_PAGE_HEADING" &&
      scopes.length === 1 &&
      scopes[0] === "GLASBRUCH_INSURANCE"
  );
  const postLossPurpose =
    /\b(?:Ersatzausführung|Glasschaden|Glasbruch|Reparatur\p{L}*|Notverglasung|Notverschalung|Wiederherstellung|ersetzt)\b/iu;
  const localGlassObject =
    /\b(?:versicherte\s+Gläser|Glasschaden|Glasbruch|Notverglasung|Notverschalung)\b/iu;
  const localRepairEffect =
    /\b(?:Reparatur\p{L}*|Ersatzausführung|Wiederherstellung|ersetzt)\b/iu;

  if (explicitCurrentGlassSection) {
    if (!postLossPurpose.test(localClause)) return null;
    return {
      physicalPageNumber: occurrencePage,
      sectionScopeSource: "CURRENT_PAGE_HEADING",
      observedScopeKeys: scopes,
    };
  }
  if (
    sectionScope !== null ||
    scopes.length !== 0 ||
    !localGlassObject.test(localClause) ||
    !localRepairEffect.test(localClause)
  )
    return null;
  return {
    physicalPageNumber: occurrencePage,
    sectionScopeSource: OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
    observedScopeKeys: [],
  };
}

/**
 * Proves either a scope-less treatment-cost role mismatch or a tightly bound
 * storm-section occurrence. Neither proof says anything about LW-20 coverage;
 * it only certifies that the occurrence is not an LW-20 peril clause.
 * Role: classify. Side effects: none.
 */
function lw20NonTargetOccurrenceProof(occurrence) {
  const exactText = String(occurrence?.exactText || "");
  const matchedAlias = String(occurrence?.matchedAlias || "");
  const localClause = occurrenceLocalClauseText(occurrence);
  const occurrencePage =
    occurrence?.physicalPageNumber || occurrence?.pageNumber || null;
  if (
    !/^(?:Grundwasser|Sickerwasser|Stauwasser)$/iu.test(exactText) ||
    matchedAlias !== exactText ||
    !localClause ||
    !localClause.includes(exactText) ||
    !Number.isInteger(occurrencePage) ||
    String(occurrence?.candidateId || "").length === 0 ||
    !Array.isArray(occurrence?.pageScopeHints)
  )
    return null;

  const scopes = lw20ObservedScopeKeys(occurrence);
  const section = occurrence?.sectionScopeHint || null;
  const treatmentCostRole = Boolean(
    section === null &&
      scopes.length === 0 &&
      occurrence?.context?.unitType === "PARAGRAPH" &&
      /Kosten\s+f[üu]r\s+die\s+Behandlung\s+von\s+nicht\s+versicherten\s+Sachen/iu.test(
        localClause
      ) &&
      /Wasser\s*\(\s*inkl\.\s*Grundwasser\s*\)[\s\S]{0,100}?Luft\s+und\s+Erdreich/iu.test(
        localClause
      ) &&
      /werden\s+nicht\s+ersetzt/iu.test(localClause) &&
      !/Sch[aä]den\s+durch\s+(?:Grundwasser|Sickerwasser|Stauwasser)/iu.test(
        localClause
      )
  );
  if (treatmentCostRole)
    return {
      physicalPageNumber: occurrencePage,
      sectionScopeSource: OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
      observedScopeKeys: [],
    };

  if (
    section?.scopeKey !== "STURM_INSURANCE" ||
    scopes.length !== 1 ||
    scopes[0] !== "STURM_INSURANCE" ||
    !["CURRENT_PAGE_HEADING", "PRECEDING_PAGE_HEADING"].includes(
      section?.source
    ) ||
    !Number.isInteger(section?.physicalPageNumber)
  )
    return null;
  const pageDistance = occurrencePage - section.physicalPageNumber;
  if (
    (section.source === "CURRENT_PAGE_HEADING" && pageDistance !== 0) ||
    (section.source === "PRECEDING_PAGE_HEADING" && pageDistance !== 1) ||
    !/(?:Sturmversicherung|Niederschlags-\s*und\s*Schmelzwasser|Hochwasser,\s*Überschwemmung,\s*Lawinen\s*und\s*Muren)/iu.test(
      String(section.text || "")
    ) ||
    !/(?:Sch[aä]den|versicherten\s+Sachen)[\s\S]{0,100}?durch\s+Grundwasser|durch\s+Grundwasser[\s\S]{0,80}?(?:Grundfeuchte|Sturmflut|R[üu]ckstau)/iu.test(
      localClause
    ) ||
    /(?:Leitungswasser(?:versicherung|schaden)?|Rohrbruch|Rohrgebrechen)/iu.test(
      localClause
    )
  )
    return null;
  return {
    physicalPageNumber: occurrencePage,
    sectionScopeSource: section.source,
    observedScopeKeys: scopes,
  };
}

function vs22NonTargetWasteOccurrenceProof(occurrence) {
  const exactText = String(occurrence?.exactText || "");
  const matchedAlias = String(occurrence?.matchedAlias || "");
  const localClause = occurrenceLocalClauseText(occurrence);
  const localSentence = localOccurrenceSentence(occurrence);
  const occurrencePage =
    occurrence?.physicalPageNumber || occurrence?.pageNumber || null;
  if (
    exactText !== matchedAlias ||
    !/gef[aä]hrlich\p{L}*\s+Abf(?:all|[aä]ll)\p{L}*/iu.test(exactText) ||
    !localClause ||
    !localClause.includes(exactText) ||
    !localSentence.includes(exactText) ||
    !isVs22LiabilityOrStorageOccurrence(occurrence) ||
    !Number.isInteger(occurrencePage) ||
    String(occurrence?.candidateId || "").length === 0 ||
    !Array.isArray(occurrence?.pageScopeHints) ||
    /(?:Sach|Geb[aä]ude)versicherung[\s\S]{0,120}(?:Entsorgungskosten|gef[aä]hrlich\p{L}*\s+Abf(?:all|[aä]ll))/iu.test(
      localSentence
    )
  )
    return null;

  const section = occurrence?.sectionScopeHint || null;
  const scopes = observedScopeKeys(occurrence);
  const sectionPageDistance = Number.isInteger(section?.physicalPageNumber)
    ? occurrencePage - section.physicalPageNumber
    : null;
  const structuralLiability = Boolean(
    section?.scopeKey === "HAFTPFLICHT_INSURANCE" &&
      ["CURRENT_PAGE_HEADING", "PRECEDING_PAGE_HEADING"].includes(
        section?.source
      ) &&
      /Haftpflichtversicherung/iu.test(String(section?.text || "")) &&
      ((section.source === "CURRENT_PAGE_HEADING" &&
        sectionPageDistance === 0) ||
        (section.source === "PRECEDING_PAGE_HEADING" &&
          Number.isInteger(sectionPageDistance) &&
          sectionPageDistance >= 1 &&
          sectionPageDistance <= 3)) &&
      scopes.length === 1 &&
      scopes[0] === "HAFTPFLICHT_INSURANCE"
  );
  const localStorageCarveback = Boolean(
    section === null &&
      scopes.length === 0 &&
      /Nicht\s+unter\s+diesem\s+Ausschluss\s+fallen[\s\S]{0,260}?kurzfristige\s+Zwischenlagerung[\s\S]{0,180}?gef[aä]hrlich\p{L}*\s+Abf(?:all|[aä]ll)\p{L}*/iu.test(
        localSentence
      )
  );
  if (!structuralLiability && !localStorageCarveback) return null;
  return {
    physicalPageNumber: occurrencePage,
    sectionScopeSource: structuralLiability
      ? section.source
      : OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
    observedScopeKeys: structuralLiability ? scopes : [],
  };
}

/**
 * Proves that a candidate is only an item in a locally declared object-class
 * list. The target controls whether that list defines membership or exclusion
 * from a class. The proof rejects operational coverage, conditions, options,
 * duties, values, and overrides. Role: classify. Side effects: none.
 */
function coverageOnlyObjectClassificationProof(occurrence, target) {
  const hint = occurrence?.objectClassificationGovernorHint;
  const context = occurrence?.context;
  const exactText = String(occurrence?.exactText || "");
  const contextText = String(context?.text || "");
  const normalizedSubject = String(hint?.subject || "")
    .normalize("NFKC")
    .replace(/^\s*\d+(?:\.\d+)*\.?\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim();
  const normalizedHintText = String(hint?.text || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
  const exclusionBoundaryMatches =
    target?.contractId !==
      DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_CONTRACT_ID ||
    ["gelten", "gilt", "zählen", "zählt"].some(
      (verb) =>
        normalizedHintText.localeCompare(
          `Nicht als ${normalizedSubject} ${verb}:`,
          "de-AT",
          { sensitivity: "accent" }
        ) === 0
    );
  const occurrencePage =
    occurrence?.physicalPageNumber || occurrence?.pageNumber || null;
  const classificationPage = hint?.physicalPageNumber || null;
  const relativeStart = occurrence?.documentStart - context?.documentStart;
  const relativeEnd = occurrence?.documentEnd - context?.documentStart;
  const classificationToContextGap = context?.documentStart - hint?.documentEnd;
  const scopeLeadText = String(occurrence?.scopeLead?.text || "");
  const scopeLeadResetAtClassification = Boolean(
    target?.allowPrecedingScopeLeadReset === true &&
      scopeLeadText.trim() &&
      Number.isInteger(occurrence?.scopeLead?.documentStart) &&
      Number.isInteger(occurrence?.scopeLead?.documentEnd) &&
      Number.isInteger(hint?.documentStart) &&
      occurrence.scopeLead.documentStart >= 0 &&
      occurrence.scopeLead.documentEnd > occurrence.scopeLead.documentStart &&
      occurrence.scopeLead.documentEnd <= hint?.documentStart
  );
  const genericListingPreambleMatches = scopeLeadText.match(
    new RegExp(GENERIC_POLICY_LISTING_ELIGIBILITY_PREAMBLE, "giu")
  );
  const neutralizeGenericListingPreamble = Boolean(
    target?.contractId ===
      DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_CONTRACT_ID &&
      scopeLeadResetAtClassification &&
      genericListingPreambleMatches?.length === 1 &&
      target?.scopeLeadTargetConcept instanceof RegExp &&
      !target.scopeLeadTargetConcept.test(scopeLeadText)
  );
  const scopeLeadScanText = neutralizeGenericListingPreamble
    ? scopeLeadText.replace(GENERIC_POLICY_LISTING_ELIGIBILITY_PREAMBLE, "")
    : scopeLeadText;
  const localText = `${hint?.text || ""}\n${hint?.subject || ""}\n${
    occurrence?.coverageGovernorHint?.text || ""
  }\n${scopeLeadScanText}\n${contextText}`;
  const operationalCoverage =
    /\b(?:versichert(?:e|en|er|es)?|mitversichert|ausgeschlossen|eingeschlossen|gedeckt|versicherungsschutz|nicht\s+versichert|kein(?:e|en|er|es)?\s+deckung)\b/iu;
  const conditionalOrOptional =
    /\b(?:sofern|soweit|wenn|falls|vorausgesetzt|vorbehaltlich|optional|wahlweise|auf\s+wunsch|nur\s+bei\s+vereinbarung|gegen\s+(?:mehrpr[aä]mie|mehrbeitrag|zuschlag)|besonders\s+vereinbart)\b/iu;
  const nonCoverageDuty =
    /\b(?:gefahrenerh[oö]hung|anzeige(?:pflicht)?|melden|meldepflicht|obliegenheit)\b/iu;
  const valueOrOverride =
    /(?:\b(?:limit|h[oö]chstentsch[aä]digung|versicherungssumme|selbstbehalt|vorrang|nachtrag|ersetzt|abweichend)\b|\bEUR\b|€|\d\s*%)/iu;
  if (
    hint?.contractId !== "CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1" ||
    hint?.kind !== "OBJECT_CLASSIFICATION_BOUNDARY" ||
    hint?.classificationKind !== "OBJECT" ||
    hint?.membership !== target?.objectClassificationMembership ||
    hint?.source !== "CURRENT_PAGE_OBJECT_CLASSIFICATION" ||
    !target?.allowedObjectClassificationSubjects?.includes(normalizedSubject) ||
    (Array.isArray(target?.allowedExactTexts) &&
      !target.allowedExactTexts.includes(exactText.normalize("NFKC").trim())) ||
    !exclusionBoundaryMatches ||
    context?.unitType !== "LIST_ITEM" ||
    !exactText ||
    !Number.isInteger(relativeStart) ||
    !Number.isInteger(relativeEnd) ||
    relativeStart < 0 ||
    relativeEnd <= relativeStart ||
    contextText.slice(relativeStart, relativeEnd) !== exactText ||
    String(occurrence?.candidateId || "").length === 0 ||
    !Number.isInteger(hint?.documentStart) ||
    !Number.isInteger(hint?.documentEnd) ||
    hint.documentEnd <= hint.documentStart ||
    hint.documentEnd > occurrence.documentStart ||
    (Number.isInteger(target?.maximumClassificationToContextGap) &&
      (!Number.isInteger(classificationToContextGap) ||
        classificationToContextGap < 0 ||
        classificationToContextGap >
          target.maximumClassificationToContextGap)) ||
    !Number.isInteger(occurrencePage) ||
    !Number.isInteger(classificationPage) ||
    classificationPage !== occurrencePage ||
    occurrence?.sectionScopeHint !== null ||
    occurrence?.coverageGovernorHint !== null ||
    (scopeLeadText.trim() !== "" && !scopeLeadResetAtClassification) ||
    !Array.isArray(occurrence?.pageScopeHints) ||
    occurrence.pageScopeHints.length !== 0 ||
    operationalCoverage.test(localText) ||
    conditionalOrOptional.test(localText) ||
    nonCoverageDuty.test(localText) ||
    valueOrOverride.test(localText)
  )
    return null;
  return {
    physicalPageNumber: occurrencePage,
    sectionScopeSource: hint.source,
    observedScopeKeys: [],
    scopeLeadTreatment: neutralizeGenericListingPreamble
      ? GENERIC_POLICY_LISTING_ELIGIBILITY_PREAMBLE_TREATMENT
      : null,
  };
}

function terminalOccurrenceProof(target, occurrence) {
  if (
    [
      DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASSIFICATION_TERMINAL_CONTRACT_ID,
      DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_CONTRACT_ID,
    ].includes(target?.contractId)
  )
    return coverageOnlyObjectClassificationProof(occurrence, target);
  if (
    target?.contractId ===
    DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID
  )
    return lw20NonTargetOccurrenceProof(occurrence);
  if (
    target?.contractId ===
    DETERMINISTIC_VS22_NON_TARGET_WASTE_OCCURRENCE_TERMINAL_CONTRACT_ID
  )
    return vs22NonTargetWasteOccurrenceProof(occurrence);
  if (
    target?.contractId ===
    DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID
  )
    return feC12PostLossScaffoldingCostProof(occurrence);
  const proof = {
    physicalPageNumber:
      occurrence?.physicalPageNumber || occurrence?.pageNumber || null,
    sectionScopeSource: occurrence?.sectionScopeHint?.source || null,
    observedScopeKeys: observedScopeKeys(occurrence),
  };
  return terminalTargetAcceptsScopeProof(target, proof) ? proof : null;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function terminalOccurrenceDigest(
  occurrence,
  digestContractId = TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID
) {
  if (
    ![
      TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
      COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID,
    ].includes(digestContractId)
  )
    throw new Error("TERMINAL_OCCURRENCE_DIGEST_CONTRACT_INVALID");
  const scopeProofMode = occurrence?.scopeProofMode || null;
  return sha256({
    digestContractId,
    occurrence: {
      candidateId: occurrence?.candidateId || null,
      matchedAlias: occurrence?.matchedAlias || null,
      physicalPageNumber:
        occurrence?.physicalPageNumber || occurrence?.pageNumber || null,
      documentStart: Number.isInteger(occurrence?.documentStart)
        ? occurrence.documentStart
        : null,
      documentEnd: Number.isInteger(occurrence?.documentEnd)
        ? occurrence.documentEnd
        : null,
      exactText: occurrence?.exactText || null,
      sectionScopeHint: occurrence?.sectionScopeHint || null,
      pageScopeHints: occurrence?.pageScopeHints || [],
      context: occurrence?.context || null,
      scopeLead: occurrence?.scopeLead || null,
      ...(digestContractId ===
      COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID
        ? {
            objectClassificationGovernorHint:
              occurrence?.objectClassificationGovernorHint || null,
            coverageGovernorHint: occurrence?.coverageGovernorHint || null,
          }
        : {}),
      ...(scopeProofMode ? { scopeProofMode } : {}),
    },
  });
}

function terminalRejectionSetDigest(rejections) {
  return sha256({
    digestContractId: TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
    rejections: [...(rejections || [])]
      .map(
        ({
          candidateId,
          terminalRejectionContractId,
          occurrenceDigestContractId,
          decisionBasis,
          occurrenceDigestSha256,
          physicalPageNumber,
          sectionScopeSource,
          observedScopeKeys: scopes,
          scopeProofMode,
          scopeLeadTreatment,
        }) => ({
          candidateId,
          terminalRejectionContractId: terminalRejectionContractId || null,
          occurrenceDigestContractId: occurrenceDigestContractId || null,
          decisionBasis,
          occurrenceDigestSha256,
          physicalPageNumber: Number.isInteger(physicalPageNumber)
            ? physicalPageNumber
            : null,
          sectionScopeSource: sectionScopeSource || null,
          observedScopeKeys: scopes,
          ...(scopeProofMode ? { scopeProofMode } : {}),
          ...(scopeLeadTreatment ? { scopeLeadTreatment } : {}),
        })
      )
      .sort((left, right) =>
        String(left.candidateId || "").localeCompare(
          String(right.candidateId || ""),
          "de-AT"
        )
      ),
  });
}

/**
 * Reconstructs the immutable digest written by terminal-rejection audit
 * schema v1. It intentionally omits the per-rejection contract id because
 * that field did not exist in persisted v1 audit entries. New writes must use
 * terminalRejectionSetDigest and schema v3. Role: compatibility. Side effects:
 * none.
 */
function legacyTerminalRejectionSetDigestV1(rejections) {
  return sha256(
    [...(rejections || [])]
      .map(
        ({
          candidateId,
          decisionBasis,
          occurrenceDigestSha256,
          observedScopeKeys: scopes,
          scopeProofMode,
        }) => ({
          candidateId,
          decisionBasis,
          occurrenceDigestSha256,
          observedScopeKeys: scopes,
          ...(scopeProofMode ? { scopeProofMode } : {}),
        })
      )
      .sort((left, right) =>
        String(left.candidateId || "").localeCompare(
          String(right.candidateId || ""),
          "de-AT"
        )
      )
  );
}

/**
 * Reconstructs the schema-v2 rejection-set digest written immediately before
 * schema v3. V2 bound the per-rejection terminal contract id, but not page,
 * section source, or an occurrence-digest contract id. New writes must use
 * terminalRejectionSetDigest. Role: compatibility. Side effects: none.
 */
function legacyTerminalRejectionSetDigestV2(rejections) {
  return sha256(
    [...(rejections || [])]
      .map(
        ({
          candidateId,
          terminalRejectionContractId,
          decisionBasis,
          occurrenceDigestSha256,
          observedScopeKeys: scopes,
          scopeProofMode,
        }) => ({
          candidateId,
          terminalRejectionContractId: terminalRejectionContractId || null,
          decisionBasis,
          occurrenceDigestSha256,
          observedScopeKeys: scopes,
          ...(scopeProofMode ? { scopeProofMode } : {}),
        })
      )
      .sort((left, right) =>
        String(left.candidateId || "").localeCompare(
          String(right.candidateId || ""),
          "de-AT"
        )
      )
  );
}

/**
 * Certifies one raw occurrence under one target-specific terminal rejection
 * contract. Each target is enabled individually and must prove its complete
 * local semantic boundary. Role: validate. Side effects: none.
 */
function certifyOtherCategoryTerminalRejection({
  categoryView,
  requirement,
  component,
  occurrence,
  deterministicBinding,
}) {
  const contract =
    CERTIFIED_TARGETS[targetKey(categoryView, requirement?.id, component?.id)];
  const sectionScopeSource = occurrence?.sectionScopeHint?.source || null;
  const sectionScopeProof = contract?.sectionScopeProofs
    ? contract.sectionScopeProofs.find(
        ({ source, headingRule, minimumPageDistance, maximumPageDistance }) => {
          if (sectionScopeSource !== source) return false;
          if (
            !headingRule.test(String(occurrence?.sectionScopeHint?.text || ""))
          )
            return false;
          const occurrencePage =
            occurrence?.physicalPageNumber || occurrence?.pageNumber || null;
          const sectionPage =
            occurrence?.sectionScopeHint?.physicalPageNumber || null;
          if (
            !Number.isInteger(occurrencePage) ||
            !Number.isInteger(sectionPage)
          )
            return false;
          const pageDistance = occurrencePage - sectionPage;
          return (
            pageDistance >= minimumPageDistance &&
            pageDistance <= maximumPageDistance
          );
        }
      )
    : null;
  const expectedSectionScopeSource =
    contract?.sectionScopeSource || "CURRENT_PAGE_HEADING";
  if (
    !contract ||
    component?.factRole !== contract.factRole ||
    requirement?.negativeSearchPolicy !==
      "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1" ||
    requirement?.absenceMeaning !== contract.absenceMeaning ||
    deterministicBinding?.binding !== "MENTION_ONLY" ||
    deterministicBinding?.basis !== "EXPLICIT_OTHER_CATEGORY_SECTION" ||
    (contract.sectionScopeProofs
      ? !sectionScopeProof
      : sectionScopeSource !== expectedSectionScopeSource) ||
    occurrence?.sectionScopeHint?.scopeKey !== contract.otherScopeKey ||
    !Array.isArray(occurrence?.pageScopeHints) ||
    (contract.requirePageScopeHint && occurrence.pageScopeHints.length === 0)
  )
    return null;

  const scopes = observedScopeKeys(occurrence);
  const localCoverageText = `${occurrence?.scopeLead?.text || ""}\n${occurrence?.context?.text || ""}`;
  const occurrencePage =
    occurrence?.physicalPageNumber || occurrence?.pageNumber || null;
  const sectionPage = occurrence?.sectionScopeHint?.physicalPageNumber || null;
  if (
    scopes.length !== 1 ||
    scopes[0] !== contract.otherScopeKey ||
    !contract.exactClause.test(String(occurrence?.exactText || "")) ||
    contract.targetCrossReference.test(localCoverageText) ||
    (contract.localCoverageRule &&
      !contract.localCoverageRule.test(localCoverageText)) ||
    (contract.localCoverageObject &&
      !contract.localCoverageObject.test(localCoverageText)) ||
    (contract.localForeignRule &&
      !contract.localForeignRule.test(localCoverageText)) ||
    (!contract.sectionScopeProofs &&
      contract.sectionHeadingRule &&
      !contract.sectionHeadingRule.test(
        String(occurrence?.sectionScopeHint?.text || "")
      )) ||
    (!contract.sectionScopeProofs &&
      contract.maxInheritedPageDistance &&
      (!Number.isInteger(sectionPage) ||
        !Number.isInteger(occurrencePage) ||
        occurrencePage <= sectionPage ||
        occurrencePage - sectionPage > contract.maxInheritedPageDistance)) ||
    !Number.isInteger(occurrencePage) ||
    String(occurrence?.candidateId || "").length === 0
  )
    return null;

  const digestOccurrence = contract.scopeProofMode
    ? { ...occurrence, scopeProofMode: contract.scopeProofMode }
    : occurrence;
  return {
    terminalRejectionContractId:
      DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID,
    occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
    decisionOwner: "SERVER",
    decisionBasis: "EXPLICIT_OTHER_CATEGORY_SECTION",
    physicalPageNumber: occurrencePage,
    sectionScopeSource,
    observedScopeKeys: scopes,
    ...(contract.scopeProofMode
      ? { scopeProofMode: contract.scopeProofMode }
      : {}),
    occurrenceDigestSha256: terminalOccurrenceDigest(digestOccurrence),
  };
}

function certifyPostLossScaffoldingCostTerminalRejection({
  categoryView,
  requirement,
  component,
  occurrence,
  deterministicBinding,
}) {
  const contract =
    POST_LOSS_SCAFFOLDING_COST_TARGETS[
      targetKey(categoryView, requirement?.id, component?.id)
    ];
  if (
    !contract ||
    component?.factRole !== contract.factRole ||
    requirement?.negativeSearchPolicy !==
      "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1" ||
    requirement?.absenceMeaning !== contract.absenceMeaning ||
    deterministicBinding?.binding !== "MENTION_ONLY" ||
    deterministicBinding?.basis !==
      FE_C12_POST_LOSS_SCAFFOLDING_COST_DECISION_BASIS
  )
    return null;
  const proof = feC12PostLossScaffoldingCostProof(occurrence);
  const target = certifiedTerminalTarget({
    categoryView,
    requirementId: requirement?.id,
    componentId: component?.id,
  });
  if (!proof || !terminalTargetAcceptsScopeProof(target, proof)) return null;
  const digestOccurrence = {
    ...occurrence,
    scopeProofMode: contract.scopeProofMode,
  };
  return {
    terminalRejectionContractId:
      DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID,
    occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
    decisionOwner: "SERVER",
    decisionBasis: FE_C12_POST_LOSS_SCAFFOLDING_COST_DECISION_BASIS,
    physicalPageNumber: proof.physicalPageNumber,
    sectionScopeSource: proof.sectionScopeSource,
    observedScopeKeys: proof.observedScopeKeys,
    scopeProofMode: contract.scopeProofMode,
    occurrenceDigestSha256: terminalOccurrenceDigest(digestOccurrence),
  };
}

function certifyLw20NonTargetOccurrenceTerminalRejection({
  categoryView,
  requirement,
  component,
  occurrence,
  deterministicBinding,
}) {
  const contract =
    LW20_NON_TARGET_OCCURRENCE_TARGETS[
      targetKey(categoryView, requirement?.id, component?.id)
    ];
  const acceptedBinding = Boolean(
    deterministicBinding?.binding === "MENTION_ONLY" &&
      [
        "EXPLICIT_OTHER_CATEGORY_SECTION",
        "LW20_TREATMENT_COST_OBJECT_NOT_GROUNDWATER_PERIL",
      ].includes(deterministicBinding?.basis)
  );
  if (
    !contract ||
    component?.factRole !== contract.factRole ||
    requirement?.negativeSearchPolicy !==
      "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1" ||
    requirement?.absenceMeaning !== contract.absenceMeaning ||
    !acceptedBinding
  )
    return null;
  const proof = lw20NonTargetOccurrenceProof(occurrence);
  const target = certifiedTerminalTarget({
    categoryView,
    requirementId: requirement?.id,
    componentId: component?.id,
  });
  if (!proof || !terminalTargetAcceptsScopeProof(target, proof)) return null;
  return {
    terminalRejectionContractId:
      DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID,
    occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
    decisionOwner: "SERVER",
    decisionBasis: LW20_NON_TARGET_OCCURRENCE_DECISION_BASIS,
    physicalPageNumber: proof.physicalPageNumber,
    sectionScopeSource: proof.sectionScopeSource,
    observedScopeKeys: proof.observedScopeKeys,
    scopeProofMode: contract.scopeProofMode,
    occurrenceDigestSha256: terminalOccurrenceDigest({
      ...occurrence,
      scopeProofMode: contract.scopeProofMode,
    }),
  };
}

function certifyVs22NonTargetWasteOccurrenceTerminalRejection({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  const contract =
    VS22_NON_TARGET_WASTE_OCCURRENCE_TARGETS[
      targetKey(categoryView, requirement?.id, component?.id)
    ];
  if (
    !contract ||
    component?.factRole !== contract.factRole ||
    requirement?.negativeSearchPolicy !==
      "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1" ||
    requirement?.absenceMeaning !== contract.absenceMeaning ||
    !isVs22LiabilityOrStorageOccurrence(occurrence)
  )
    return null;
  const proof = vs22NonTargetWasteOccurrenceProof(occurrence);
  const target = certifiedTerminalTarget({
    categoryView,
    requirementId: requirement?.id,
    componentId: component?.id,
  });
  if (!proof || !terminalTargetAcceptsScopeProof(target, proof)) return null;
  return {
    terminalRejectionContractId:
      DETERMINISTIC_VS22_NON_TARGET_WASTE_OCCURRENCE_TERMINAL_CONTRACT_ID,
    occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
    decisionOwner: "SERVER",
    decisionBasis: VS22_OTHER_SCOPE_BASIS,
    physicalPageNumber: proof.physicalPageNumber,
    sectionScopeSource: proof.sectionScopeSource,
    observedScopeKeys: proof.observedScopeKeys,
    scopeProofMode: contract.scopeProofMode,
    occurrenceDigestSha256: terminalOccurrenceDigest({
      ...occurrence,
      scopeProofMode: contract.scopeProofMode,
    }),
  };
}

function certifyNonContractualRiskInformationTerminalRejection({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  const contract =
    NON_CONTRACTUAL_RISK_INFORMATION_TARGETS[
      targetKey(categoryView, requirement?.id, component?.id)
    ];
  const occurrencePage =
    occurrence?.physicalPageNumber || occurrence?.pageNumber || null;
  const sectionPage = occurrence?.sectionScopeHint?.physicalPageNumber || null;
  const exactText = String(occurrence?.exactText || "");
  const localText = `${occurrence?.scopeLead?.text || ""}\n${occurrence?.context?.text || ""}`;
  const followingProof = occurrence?.context?.followingStructuralBoundaryProof;
  const followingSemanticText = [
    FOLLOWING_STRUCTURAL_BOUNDARY_KIND.LIST_ITEM,
    FOLLOWING_STRUCTURAL_BOUNDARY_KIND.PARAGRAPH,
  ].includes(followingProof?.kind)
    ? String(followingProof?.text || "")
    : "";
  const unownedFollowingText = `${followingProof?.skippedRaw?.text || ""}\n${followingSemanticText}`;
  if (
    !contract ||
    component?.factRole !== contract.factRole ||
    component?.followingStructuralBoundaryProofContractId !==
      FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID ||
    requirement?.negativeSearchPolicy !==
      "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1" ||
    requirement?.absenceMeaning !== contract.absenceMeaning ||
    occurrence?.matchedAlias !== contract.matchedAlias ||
    occurrence?.context?.unitType !== "LIST_ITEM" ||
    occurrence?.sectionScopeHint?.scopeKey !== contract.sectionScopeKey ||
    occurrence?.sectionScopeHint?.source !== contract.sectionScopeSource ||
    !contract.sectionHeadingRule.test(
      String(occurrence?.sectionScopeHint?.text || "")
    ) ||
    !Number.isInteger(occurrencePage) ||
    !Number.isInteger(sectionPage) ||
    occurrencePage !== sectionPage ||
    !Array.isArray(occurrence?.pageScopeHints) ||
    !contract.exactRiskInformation.test(exactText) ||
    !contract.exactRiskInformation.test(localText) ||
    !contract.localRiskInformationRule.test(localText) ||
    contract.contractualConsequenceRule.test(localText) ||
    contract.underwritingWorkflowRule.test(localText) ||
    !validFollowingStructuralBoundaryProof(occurrence) ||
    followingProof?.kind === FOLLOWING_STRUCTURAL_BOUNDARY_KIND.TOO_DISTANT ||
    contract.contractualConsequenceRule.test(unownedFollowingText) ||
    contract.underwritingWorkflowRule.test(unownedFollowingText) ||
    String(occurrence?.candidateId || "").length === 0
  )
    return null;

  const scopes = observedScopeKeys(occurrence);
  const target = certifiedTerminalTarget({
    categoryView,
    requirementId: requirement?.id,
    componentId: component?.id,
  });
  if (!terminalTargetAcceptsObservedScopes(target, scopes)) return null;
  const digestOccurrence = {
    ...occurrence,
    scopeProofMode: contract.scopeProofMode,
  };
  return {
    terminalRejectionContractId:
      DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID,
    occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
    decisionOwner: "SERVER",
    decisionBasis: "EXPLICIT_NON_CONTRACTUAL_RISK_INFORMATION",
    physicalPageNumber: occurrencePage,
    sectionScopeSource: contract.sectionScopeSource,
    observedScopeKeys: scopes,
    scopeProofMode: contract.scopeProofMode,
    occurrenceDigestSha256: terminalOccurrenceDigest(digestOccurrence),
  };
}

function certifyCoverageOnlyObjectClassificationTerminalRejection({
  categoryView,
  requirement,
  component,
  occurrence,
}) {
  const contract =
    COVERAGE_ONLY_OBJECT_CLASSIFICATION_TARGETS[
      targetKey(categoryView, requirement?.id, component?.id)
    ];
  if (
    !contract ||
    component?.factRole !== contract.factRole ||
    requirement?.negativeSearchPolicy !==
      "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1" ||
    requirement?.absenceMeaning !== contract.absenceMeaning
  )
    return null;
  const target = certifiedTerminalTarget({
    categoryView,
    requirementId: requirement?.id,
    componentId: component?.id,
  });
  const proof = coverageOnlyObjectClassificationProof(occurrence, target);
  if (!proof || !terminalTargetAcceptsScopeProof(target, proof)) return null;
  return {
    terminalRejectionContractId: target.contractId,
    occurrenceDigestContractId:
      COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID,
    decisionOwner: "SERVER",
    decisionBasis: target.decisionBasis,
    physicalPageNumber: proof.physicalPageNumber,
    sectionScopeSource: proof.sectionScopeSource,
    observedScopeKeys: proof.observedScopeKeys,
    scopeProofMode: target.scopeProofMode,
    scopeLeadTreatment: proof.scopeLeadTreatment,
    occurrenceDigestSha256: terminalOccurrenceDigest(
      {
        ...occurrence,
        scopeProofMode: target.scopeProofMode,
      },
      COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID
    ),
  };
}

function certifyDeterministicTerminalRejection(input) {
  return (
    certifyCoverageOnlyObjectClassificationTerminalRejection(input) ||
    certifyVs22NonTargetWasteOccurrenceTerminalRejection(input) ||
    certifyLw20NonTargetOccurrenceTerminalRejection(input) ||
    certifyPostLossScaffoldingCostTerminalRejection(input) ||
    certifyOtherCategoryTerminalRejection(input) ||
    certifyNonContractualRiskInformationTerminalRejection(input)
  );
}

module.exports = {
  COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_DECISION_BASIS,
  COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_SCOPE_PROOF_MODE,
  COVERAGE_ONLY_OBJECT_CLASSIFICATION_DECISION_BASIS,
  COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID,
  COVERAGE_ONLY_OBJECT_CLASSIFICATION_SCOPE_PROOF_MODE,
  DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASSIFICATION_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_VS22_NON_TARGET_WASTE_OCCURRENCE_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID,
  FE_C12_POST_LOSS_SCAFFOLDING_COST_DECISION_BASIS,
  FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE,
  LEGACY_DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID,
  OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
  LW20_NON_TARGET_OCCURRENCE_DECISION_BASIS,
  LW20_NON_TARGET_OCCURRENCE_SCOPE_PROOF_MODE,
  VS22_NON_TARGET_WASTE_SCOPE_PROOF_MODE,
  TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
  TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
  certifiedTerminalTarget,
  certifyDeterministicTerminalRejection,
  feC12PostLossScaffoldingCostProof,
  lw20NonTargetOccurrenceProof,
  vs22NonTargetWasteOccurrenceProof,
  legacyTerminalRejectionSetDigestV1,
  legacyTerminalRejectionSetDigestV2,
  terminalOccurrenceProof,
  terminalTargetAcceptsScopeProof,
  terminalTargetAcceptsObservedScopes,
  terminalOccurrenceDigest,
  terminalRejectionSetDigest,
};
