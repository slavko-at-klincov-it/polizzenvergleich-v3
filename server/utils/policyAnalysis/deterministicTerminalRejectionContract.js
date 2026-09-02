const crypto = require("crypto");
const {
  FOLLOWING_STRUCTURAL_BOUNDARY_KIND,
  FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID,
  validFollowingStructuralBoundaryProof,
} = require("./controlledOccurrenceWorksheet");

const DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_OTHER_CATEGORY_TERMINAL_V1";
const LEGACY_DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_V1";
const DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_V2";
const DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_V1";
const TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID =
  "TERMINAL_OCCURRENCE_PROVENANCE_V3";
const TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID =
  "TERMINAL_REJECTION_SET_PROVENANCE_V3";
const FE_C12_POST_LOSS_SCAFFOLDING_COST_DECISION_BASIS =
  "POST_LOSS_GLASS_REPAIR_SCAFFOLDING_COST_NOT_INSURED_OBJECT";
const FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE =
  "OCCURRENCE_LOCAL_POST_LOSS_GLASS_REPAIR_COST_V1";
const OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE = "OCCURRENCE_LOCAL_CLAUSE";

const POST_LOSS_SCAFFOLDING_COST_TARGETS = Object.freeze({
  "FE:FE-C12:scaffolding": Object.freeze({
    factRole: "INSURED_OBJECT",
    absenceMeaning: "COVERAGE_MIXED",
    scopeProofMode: FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE,
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

function terminalOccurrenceProof(target, occurrence) {
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

function terminalOccurrenceDigest(occurrence) {
  const scopeProofMode = occurrence?.scopeProofMode || null;
  return sha256({
    digestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
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

function certifyDeterministicTerminalRejection(input) {
  return (
    certifyPostLossScaffoldingCostTerminalRejection(input) ||
    certifyOtherCategoryTerminalRejection(input) ||
    certifyNonContractualRiskInformationTerminalRejection(input)
  );
}

module.exports = {
  DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID,
  FE_C12_POST_LOSS_SCAFFOLDING_COST_DECISION_BASIS,
  FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE,
  LEGACY_DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID,
  OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
  TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
  TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
  certifiedTerminalTarget,
  certifyDeterministicTerminalRejection,
  feC12PostLossScaffoldingCostProof,
  legacyTerminalRejectionSetDigestV1,
  legacyTerminalRejectionSetDigestV2,
  terminalOccurrenceProof,
  terminalTargetAcceptsScopeProof,
  terminalTargetAcceptsObservedScopes,
  terminalOccurrenceDigest,
  terminalRejectionSetDigest,
};
