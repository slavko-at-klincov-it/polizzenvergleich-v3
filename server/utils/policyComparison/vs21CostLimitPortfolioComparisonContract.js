const {
  PACKAGE_MEMBER,
  comparisonApplicability,
  comparisonFieldSignature,
  completeRawComparisonAtom,
} = require("./comparisonAtomCanonicalization");

const VS21_CATEGORY_ID = "VS-21";
const VS21_COMPONENT_IDS = Object.freeze(["cleanup_costs", "demolition_costs"]);
const VS21_COST_LIMIT_PORTFOLIO_AUDIT_CONTRACT_ID =
  "VS21_COST_LIMIT_PORTFOLIO_AUDIT_V1";
const VS21_INCOMPATIBLE_LIMIT_TYPES_RULE_ID =
  "VS21_INCOMPATIBLE_LIMIT_VALUE_TYPES_V1";
const VS21_INCOMPATIBLE_LIMIT_TYPES_REASON_CODE =
  "INCOMPATIBLE_LIMIT_VALUE_TYPES";
const SHARED_SUM_INSURANCE_MODIFIER_CONTRACT_ID =
  "SHARED_SUM_INSURANCE_ALLOCATION_MODIFIER_V1";

function normalized(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function strings(values) {
  return [...new Set((values || []).map(String).filter(Boolean))].sort();
}

function exactVs21Contract(contract) {
  if (
    contract?.componentSatisfactionPolicy !== "ALL" ||
    !Array.isArray(contract?.components)
  )
    return false;
  const components = contract.components.map(({ id, factRole }) => ({
    id,
    factRole,
  }));
  return (
    JSON.stringify(components) ===
    JSON.stringify(
      VS21_COMPONENT_IDS.map((id) => ({
        id,
        factRole: "COST",
      }))
    )
  );
}

function sourceBindingValid(atom) {
  return (
    strings(atom?.documentUuids).length > 0 &&
    Array.isArray(atom?.selectedCandidateIds) &&
    atom.selectedCandidateIds.length > 0 &&
    atom.selectedCandidateIds.every((candidateId) =>
      atom.sources?.some(
        (source) =>
          source.candidateId === candidateId &&
          Number.isInteger(source.physicalPageNumber) &&
          source.physicalPageNumber > 0 &&
          String(source.exactText || "").trim().length > 0
      )
    )
  );
}

function containsNumericLimit(text) {
  return (
    /(?:\beur\b|\beuro\b|€)\s*\d/iu.test(text) ||
    /\d(?:[\d.,\s]*\d)?\s*%/u.test(text) ||
    /versicherungssumme\s+(?:von|bis(?:\s+zu)?)\s+\d/iu.test(text)
  );
}

function sharedSumModifierSource(source) {
  const text = normalized(source?.conditionCheckText);
  return Boolean(
    text.includes("aufräum") &&
    text.includes("abbruch") &&
    text.includes("feuerlösch") &&
    text.includes("gebäude") &&
    text.includes("inhalt") &&
    text.includes("gemeinsam summarisch versichert") &&
    !containsNumericLimit(text)
  );
}

function potentialSharedSumModifier(atom) {
  return Boolean(
    atom?.requirementId === VS21_CATEGORY_ID &&
    VS21_COMPONENT_IDS.includes(atom?.componentId) &&
    atom?.factRole === "COST" &&
    atom?.evidencePresence === "FOUND" &&
    atom?.coverageEffect === "INCLUDED" &&
    atom?.conflictState === "NONE" &&
    (atom?.unresolvedCandidateIds || []).length === 0 &&
    comparisonApplicability(atom) === PACKAGE_MEMBER &&
    atom?.requestedFieldStatus === "NOT_FOUND" &&
    JSON.stringify(atom?.requestedFields) === JSON.stringify(["limit"]) &&
    JSON.stringify(atom?.optionalFields) === JSON.stringify([]) &&
    Array.isArray(atom?.fields) &&
    atom.fields.length === 1 &&
    atom.fields[0]?.field === "limit" &&
    atom.fields[0]?.status === "NOT_FOUND" &&
    Array.isArray(atom.fields[0]?.facts) &&
    atom.fields[0].facts.length === 0 &&
    sourceBindingValid(atom) &&
    atom.sources.every(sharedSumModifierSource)
  );
}

function modifierGroupKey(atom) {
  const sourceKeys = (atom.sources || [])
    .map((source) =>
      JSON.stringify({
        physicalPageNumber: source.physicalPageNumber,
        conditionCheckText: normalized(source.conditionCheckText),
      })
    )
    .sort();
  return JSON.stringify({
    documentUuids: strings(atom.documentUuids),
    sourceKeys,
  });
}

function certifiedSharedSumModifiers(atoms) {
  const potential = (atoms || []).filter(potentialSharedSumModifier);
  const groups = new Map();
  for (const atom of potential) {
    const key = modifierGroupKey(atom);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(atom);
  }
  return [...groups.values()].flatMap((group) =>
    JSON.stringify(strings(group.map(({ componentId }) => componentId))) ===
    JSON.stringify([...VS21_COMPONENT_IDS].sort())
      ? group
      : []
  );
}

function sourceProof(atom) {
  return {
    componentId: atom.componentId,
    documentUuids: strings(atom.documentUuids),
    candidateIds: strings(atom.selectedCandidateIds),
    documentStatus: atom.documentStatus,
    documentApplicability: atom.documentApplicability,
    selectedScopePicture: atom.selectedScopePicture,
    sources: (atom.sources || [])
      .map(({ candidateId, physicalPageNumber, exactText }) => ({
        candidateId,
        physicalPageNumber,
        exactText,
      }))
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right), "de-AT")
      ),
  };
}

function primaryProof(atom) {
  return {
    ...sourceProof(atom),
    fields: comparisonFieldSignature(atom),
  };
}

function modifierProof(atom) {
  return {
    ...sourceProof(atom),
    modifierContractId: SHARED_SUM_INSURANCE_MODIFIER_CONTRACT_ID,
  };
}

function sidePortfolio(categoryId, atoms) {
  const relevant = (atoms || []).filter(
    (atom) => atom.requirementId === categoryId
  );
  if (
    relevant.length === 0 ||
    relevant.some(
      (atom) =>
        !VS21_COMPONENT_IDS.includes(atom.componentId) ||
        atom.conflictState !== "NONE" ||
        (atom.unresolvedCandidateIds || []).length > 0 ||
        (atom.evidencePresence === "FOUND" &&
          comparisonApplicability(atom) !== PACKAGE_MEMBER) ||
        atom.coverageEffect === "EXCLUDED"
    )
  )
    return null;

  const modifiers = certifiedSharedSumModifiers(relevant);
  const modifierKeys = new Set(modifiers.map(modifierGroupKey));
  const unclassifiedIncompleteInclusions = relevant.filter(
    (atom) =>
      atom.evidencePresence === "FOUND" &&
      atom.coverageEffect === "INCLUDED" &&
      !completeRawComparisonAtom(atom) &&
      !modifierKeys.has(modifierGroupKey(atom))
  );
  if (unclassifiedIncompleteInclusions.length > 0) return null;

  const primaryAtoms = relevant.filter(
    (atom) =>
      atom.factRole === "COST" &&
      atom.coverageEffect === "INCLUDED" &&
      completeRawComparisonAtom(atom)
  );
  if (
    VS21_COMPONENT_IDS.some(
      (componentId) =>
        !primaryAtoms.some((atom) => atom.componentId === componentId)
    )
  )
    return null;

  const fields = primaryAtoms.flatMap(comparisonFieldSignature);
  if (
    fields.length === 0 ||
    fields.some(
      ({ field, fieldStatus, value, valueType }) =>
        field !== "limit" ||
        fieldStatus !== "FOUND" ||
        !String(value || "") ||
        !["MONEY", "PERCENT"].includes(valueType)
    )
  )
    return null;
  const valueTypes = strings(fields.map(({ valueType }) => valueType));
  if (valueTypes.length !== 1) return null;

  return {
    status: "COMPLETE_INCLUDED_COST_LIMIT_PORTFOLIO",
    valueType: valueTypes[0],
    componentIds: [...VS21_COMPONENT_IDS],
    primaryProofs: primaryAtoms.map(primaryProof),
    allocationModifiers: modifiers.map(modifierProof),
  };
}

function buildVs21CostLimitPortfolioAudit({
  categoryId,
  atomsA,
  atomsB,
  requirementContractA,
  requirementContractB,
}) {
  if (
    categoryId !== VS21_CATEGORY_ID ||
    !exactVs21Contract(requirementContractA) ||
    JSON.stringify(requirementContractA) !==
      JSON.stringify(requirementContractB)
  )
    return null;
  const sideA = sidePortfolio(categoryId, atomsA);
  const sideB = sidePortfolio(categoryId, atomsB);
  if (!sideA || !sideB) return null;
  if (
    JSON.stringify(strings([sideA.valueType, sideB.valueType])) !==
    JSON.stringify(["MONEY", "PERCENT"])
  )
    return null;
  return {
    schemaVersion: 1,
    contractId: VS21_COST_LIMIT_PORTFOLIO_AUDIT_CONTRACT_ID,
    categoryId,
    sides: { A: sideA, B: sideB },
  };
}

function vs21CostLimitPortfolioDecision(audit) {
  return {
    schemaVersion: 4,
    outcome: "NICHT_VERGLEICHBAR",
    reasonCode: VS21_INCOMPATIBLE_LIMIT_TYPES_REASON_CODE,
    reason:
      "Nicht direkt vergleichbar: Aufräum- und Abbruchkosten sind in beiden Polizzen belegt. Eine Polizze begrenzt die Leistung prozentuell, die andere mit einem festen Eurobetrag. Ohne eine für genau denselben Deckungsumfang belegte gemeinsame Berechnungsbasis darf daraus weder Gleichwertigkeit noch ein Vorteil abgeleitet werden. Eine Klausel zur gemeinsamen summarischen Versicherung beschreibt nur die Verteilung der Versicherungssumme und ersetzt kein eigenes Limit.",
    reviewRequired: false,
    ruleId: VS21_INCOMPATIBLE_LIMIT_TYPES_RULE_ID,
    vs21CostLimitPortfolioAudit: audit,
    dimensions: [],
  };
}

module.exports = {
  SHARED_SUM_INSURANCE_MODIFIER_CONTRACT_ID,
  VS21_COST_LIMIT_PORTFOLIO_AUDIT_CONTRACT_ID,
  VS21_INCOMPATIBLE_LIMIT_TYPES_REASON_CODE,
  VS21_INCOMPATIBLE_LIMIT_TYPES_RULE_ID,
  buildVs21CostLimitPortfolioAudit,
  vs21CostLimitPortfolioDecision,
};
