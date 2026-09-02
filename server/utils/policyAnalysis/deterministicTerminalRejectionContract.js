const crypto = require("crypto");

const DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID =
  "DETERMINISTIC_OTHER_CATEGORY_TERMINAL_V1";

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
    factRole: "EXCLUSION",
    absenceMeaning: "EXCLUSION",
    otherScopeKey: "HAFTPFLICHT_INSURANCE",
    sectionScopeSource: "PRECEDING_PAGE_HEADING",
    sectionHeadingRule:
      /\bGeb[aä]ude-\s*und\s+Grundst[uü]ckshaftpflichtversicherung\b/iu,
    maxInheritedPageDistance: 3,
    exactClause:
      /\b(?:Allm[aä]hlichkeitssch[aä]den?|Sch[aä]den\s+durch\s+Langzeiteinwirkung|Langzeitsch[aä]den?|allm[aä]hliche(?:r)?\s+Einwirkung\s+von\s+Feuchtigkeit|schleichende(?:r)?\s+Einwirkung)\b/iu,
    targetCrossReference:
      /\b(?:Leitungswasser(?:versicherung|sch[aä]den?)?|Rohr(?:bruch|gebrechen)|Zu-\s*und\s+Ableitungsrohre?|wasserf[uü]hrende\s+Rohre?|Armaturen?)\b/iu,
    localForeignRule:
      /(?:\bKein\s+Ersatz\s+wird\s+geleistet\b[\s\S]{0,260}\bAu[ßs]enseite\s+des\s+Geb[aä]udes\b|\bAllm[aä]hlichkeitssch[aä]den?\b[\s\S]{0,500}\b(?:AHVB|Schadenersatzverpflichtungen)\b)/iu,
    scopeProofMode:
      "INHERITED_LIABILITY_SECTION_PLUS_LOCAL_FOREIGN_CLAUSE_V1",
  }),
});

function targetKey(categoryView, requirementId, componentId) {
  return `${categoryView || ""}:${requirementId || ""}:${componentId || ""}`;
}

function certifiedTerminalTarget({ categoryView, requirementId, componentId }) {
  const contract =
    CERTIFIED_TARGETS[targetKey(categoryView, requirementId, componentId)];
  if (!contract) return null;
  return Object.freeze({
    factRole: contract.factRole,
    absenceMeaning: contract.absenceMeaning,
    otherScopeKey: contract.otherScopeKey,
    sectionScopeSource:
      contract.sectionScopeSource || "CURRENT_PAGE_HEADING",
    scopeProofMode: contract.scopeProofMode || null,
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
    ...(scopeProofMode
      ? {
          scopeProofMode,
          context: occurrence?.context || null,
          scopeLead: occurrence?.scopeLead || null,
        }
      : {}),
  });
}

function terminalRejectionSetDigest(rejections) {
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
 * Certifies one raw occurrence as exclusively belonging to a different
 * insurance category. Each target is enabled individually; a foreign heading
 * alone is never sufficient. Role: validate. Side effects: none.
 */
function certifyDeterministicTerminalRejection({
  categoryView,
  requirement,
  component,
  occurrence,
  deterministicBinding,
}) {
  const contract =
    CERTIFIED_TARGETS[targetKey(categoryView, requirement?.id, component?.id)];
  const sectionScopeSource =
    contract?.sectionScopeSource || "CURRENT_PAGE_HEADING";
  if (
    !contract ||
    component?.factRole !== contract.factRole ||
    requirement?.negativeSearchPolicy !==
      "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1" ||
    requirement?.absenceMeaning !== contract.absenceMeaning ||
    deterministicBinding?.binding !== "MENTION_ONLY" ||
    deterministicBinding?.basis !== "EXPLICIT_OTHER_CATEGORY_SECTION" ||
    occurrence?.sectionScopeHint?.source !== sectionScopeSource ||
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
    (contract.sectionHeadingRule &&
      !contract.sectionHeadingRule.test(
        String(occurrence?.sectionScopeHint?.text || "")
      )) ||
    (contract.maxInheritedPageDistance &&
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

module.exports = {
  DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID,
  certifiedTerminalTarget,
  certifyDeterministicTerminalRejection,
  terminalOccurrenceDigest,
  terminalRejectionSetDigest,
};
