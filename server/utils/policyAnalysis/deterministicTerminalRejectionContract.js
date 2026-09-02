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
  if (
    !contract ||
    component?.factRole !== contract.factRole ||
    requirement?.negativeSearchPolicy !==
      "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1" ||
    requirement?.absenceMeaning !== contract.absenceMeaning ||
    deterministicBinding?.binding !== "MENTION_ONLY" ||
    deterministicBinding?.basis !== "EXPLICIT_OTHER_CATEGORY_SECTION" ||
    occurrence?.sectionScopeHint?.source !== "CURRENT_PAGE_HEADING" ||
    occurrence?.sectionScopeHint?.scopeKey !== contract.otherScopeKey ||
    !Array.isArray(occurrence?.pageScopeHints) ||
    (contract.requirePageScopeHint && occurrence.pageScopeHints.length === 0)
  )
    return null;

  const scopes = observedScopeKeys(occurrence);
  const localCoverageText = `${occurrence?.scopeLead?.text || ""}\n${occurrence?.context?.text || ""}`;
  if (
    scopes.length !== 1 ||
    scopes[0] !== contract.otherScopeKey ||
    !contract.exactClause.test(String(occurrence?.exactText || "")) ||
    contract.targetCrossReference.test(localCoverageText) ||
    (contract.localCoverageRule &&
      !contract.localCoverageRule.test(localCoverageText)) ||
    (contract.localCoverageObject &&
      !contract.localCoverageObject.test(localCoverageText)) ||
    !Number.isInteger(
      occurrence?.physicalPageNumber || occurrence?.pageNumber
    ) ||
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
    physicalPageNumber: occurrence.physicalPageNumber || occurrence.pageNumber,
    sectionScopeSource: "CURRENT_PAGE_HEADING",
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
