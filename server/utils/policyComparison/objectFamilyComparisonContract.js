const {
  PACKAGE_MEMBER,
  comparisonApplicability,
  completeRawComparisonAtom,
} = require("./comparisonAtomCanonicalization");

const DIRECTED_OBJECT_FAMILY_CONTRACT_ID = "DIRECTED_OBJECT_FAMILY_V1";
const OBJECT_FAMILY_COMPARISON_AUDIT_CONTRACT_ID =
  "OBJECT_FAMILY_COVERAGE_PRESENCE_AUDIT_V1";
const OBJECT_FAMILY_EQUALITY_RULE_ID =
  "EQUAL_DIRECTED_OBJECT_FAMILY_COVERAGE_V1";
const OBJECT_FAMILY_EQUALITY_REASON_CODE =
  "EQUAL_DIRECTED_OBJECT_FAMILY_COVERAGE";

function strings(values) {
  return [...new Set((values || []).map(String).filter(Boolean))].sort();
}

function validFamilyContract(contract, components) {
  if (
    contract?.contractId !== DIRECTED_OBJECT_FAMILY_CONTRACT_ID ||
    contract?.rootCoversMembers !== true ||
    contract?.rowComparison !== "COVERAGE_PRESENCE_ONLY" ||
    !String(contract?.rootComponentId || "").trim() ||
    !Array.isArray(contract?.memberComponentIds) ||
    contract.memberComponentIds.length === 0 ||
    strings(contract.memberComponentIds).length !==
      contract.memberComponentIds.length
  )
    return false;
  const declared = new Set((components || []).map(({ id }) => id));
  return (
    declared.has(contract.rootComponentId) &&
    !contract.memberComponentIds.includes(contract.rootComponentId) &&
    contract.memberComponentIds.every((id) => declared.has(id))
  );
}

function sourceProof(atom) {
  return {
    componentId: atom.componentId,
    documentUuids: strings(atom.documentUuids),
    candidateIds: strings(atom.selectedCandidateIds),
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

function sideFamilyProof({ categoryId, atoms, familyContract }) {
  const componentIds = new Set([
    familyContract.rootComponentId,
    ...familyContract.memberComponentIds,
  ]);
  const relevant = (atoms || []).filter(
    (atom) =>
      atom.requirementId === categoryId && componentIds.has(atom.componentId)
  );
  if (
    relevant.length === 0 ||
    relevant.some(
      (atom) =>
        atom.conflictState !== "NONE" ||
        (atom.unresolvedCandidateIds || []).length > 0 ||
        (atom.evidencePresence === "FOUND" &&
          comparisonApplicability(atom) !== PACKAGE_MEMBER) ||
        (atom.evidencePresence === "FOUND" &&
          !["INCLUDED", "DEFINED"].includes(atom.coverageEffect))
    )
  )
    return null;

  const roots = relevant.filter(
    (atom) =>
      atom.componentId === familyContract.rootComponentId &&
      atom.coverageEffect === "INCLUDED" &&
      atom.selectedScopePicture === "GENERAL" &&
      completeRawComparisonAtom(atom)
  );
  if (roots.length === 0) return null;

  return {
    status: "FAMILY_INCLUDED",
    rootComponentId: familyContract.rootComponentId,
    rootCoverageProofs: roots.map(sourceProof),
    observedMemberComponentIds: strings(
      relevant
        .filter(
          (atom) =>
            atom.evidencePresence === "FOUND" &&
            familyContract.memberComponentIds.includes(atom.componentId)
        )
        .map(({ componentId }) => componentId)
    ),
  };
}

function buildObjectFamilyCoverageAudit({
  categoryId,
  atomsA,
  atomsB,
  requirementContractA,
  requirementContractB,
}) {
  const left = requirementContractA?.componentFamilyContract;
  const right = requirementContractB?.componentFamilyContract;
  if (
    !left ||
    JSON.stringify(left) !== JSON.stringify(right) ||
    !validFamilyContract(left, requirementContractA?.components) ||
    !validFamilyContract(right, requirementContractB?.components)
  )
    return null;
  const sideA = sideFamilyProof({ categoryId, atoms: atomsA, familyContract: left });
  const sideB = sideFamilyProof({ categoryId, atoms: atomsB, familyContract: left });
  if (!sideA || !sideB) return null;
  return {
    schemaVersion: 1,
    contractId: OBJECT_FAMILY_COMPARISON_AUDIT_CONTRACT_ID,
    categoryId,
    familyContract: left,
    sides: { A: sideA, B: sideB },
  };
}

function objectFamilyCoverageDecision(audit) {
  return {
    schemaVersion: 4,
    outcome: "GLEICHWERTIG",
    reasonCode: OBJECT_FAMILY_EQUALITY_REASON_CODE,
    reason:
      "Gleichwertig: Beide Polizzen enthalten einen vollständig belegten allgemeinen Einschluss der im Katalog gerichteten Objektfamilie. Einzelne Unterbegriffe erweitern die Suche, müssen neben dem belegten Oberbegriff aber nicht nochmals wörtlich vorkommen. Limits und Bedingungen werden damit nicht gleichgesetzt.",
    reviewRequired: false,
    ruleId: OBJECT_FAMILY_EQUALITY_RULE_ID,
    objectFamilyCoverageAudit: audit,
    dimensions: [],
  };
}

module.exports = {
  DIRECTED_OBJECT_FAMILY_CONTRACT_ID,
  OBJECT_FAMILY_COMPARISON_AUDIT_CONTRACT_ID,
  OBJECT_FAMILY_EQUALITY_REASON_CODE,
  OBJECT_FAMILY_EQUALITY_RULE_ID,
  buildObjectFamilyCoverageAudit,
  objectFamilyCoverageDecision,
};
