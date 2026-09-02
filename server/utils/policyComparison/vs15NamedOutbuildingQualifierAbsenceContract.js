const crypto = require("crypto");
const {
  PACKAGE_MEMBER,
  atomEventMode,
  comparisonApplicability,
  completeRawComparisonAtom,
} = require("./comparisonAtomCanonicalization");

const VS15_QUALIFIER_ABSENCE_AUDIT_SCHEMA_VERSION = 1;
const VS15_QUALIFIER_ABSENCE_AUDIT_CONTRACT_ID =
  "VS15_BILATERAL_CONTROLLED_QUALIFIER_ABSENCE_AUDIT_V1";
const VS15_QUALIFIER_ABSENCE_RULE_ID =
  "VS15_EQUAL_CONTROLLED_NAMED_OUTBUILDING_QUALIFIER_ABSENCE_BOTH_V1";
const VS15_QUALIFIER_ABSENCE_REASON_CODE =
  "EQUAL_VS15_CONTROLLED_NAMED_OUTBUILDING_QUALIFIER_ABSENCE_BOTH";
const VS15_QUALIFIER_ABSENCE_TREATMENT =
  "EQUAL_VS15_CONTROLLED_NAMED_OUTBUILDING_QUALIFIER_ABSENCE_BOTH_V1";

const CATEGORY_ID = "VS-15";
const CATALOG_ID = "vs-occurrence-full-draft-v0.9";
const REQUIREMENT_CONTRACT_DIGEST =
  "3618160e324ac0eac1d3d8805cd6206b0cdacb2f2f9b2370457a620bbc1cc51c";
const COVER_COMPONENT_ID = "outbuilding_cover";
const QUALIFIER_COMPONENT_ID = "named_outbuilding_designation";
const DECLARED_COMPONENTS = Object.freeze([
  Object.freeze({ id: COVER_COMPONENT_ID, factRole: "INSURED_OBJECT" }),
  Object.freeze({ id: QUALIFIER_COMPONENT_ID, factRole: "DEFINITION" }),
]);
const COMPONENTS = Object.freeze({
  [COVER_COMPONENT_ID]: Object.freeze({
    factRole: "INSURED_OBJECT",
    aliases: Object.freeze(["Nebengebäude", "Nebengebäuden"]),
  }),
  [QUALIFIER_COMPONENT_ID]: Object.freeze({
    factRole: "DEFINITION",
    aliases: Object.freeze([
      "namentlich angeführtes Nebengebäude",
      "namentlich angeführte Nebengebäude",
      "Nebengebäude namentlich in der Polizze angeführt",
    ]),
  }),
});
const SEARCH_PLAN_IDS = Object.freeze(
  Object.keys(COMPONENTS)
    .map((componentId) => `${CATALOG_ID}/${CATEGORY_ID}/${componentId}`)
    .sort()
);
const SEARCH_CELL_KEYS = Object.freeze([
  "absenceCertification",
  "absenceMeaning",
  "aliases",
  "catalogId",
  "comparisonPolicy",
  "comparisonTreatment",
  "conceptSearchIds",
  "disposition",
  "documentUuid",
  "gates",
  "negativeSearchPolicy",
  "physicalPagesChecked",
  "requirementContract",
  "searchPlanId",
  "totalPhysicalPages",
]);
const SEARCH_GATE_KEYS = Object.freeze([
  "certifiedNegativeSearch",
  "completeCategoryTechnicalContract",
  "completeTextExtraction",
  "negativeSearchApproved",
  "serverNegativeTerminal",
  "zeroCandidateTerminal",
  "zeroOccurrenceTerminal",
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sameJson(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(stableStringify(value))
    .digest("hex");
}

function domainDigest(domain, value) {
  return crypto
    .createHash("sha256")
    .update(`${domain}\u0000${stableStringify(value)}`)
    .digest("hex");
}

function canonicalStrings(values) {
  if (!Array.isArray(values)) return null;
  const normalized = values.map((value) => String(value || "").trim());
  if (normalized.some((value) => !value)) return null;
  const unique = [...new Set(normalized)].sort();
  return unique.length === normalized.length ? unique : null;
}

function hasExactKeys(value, keys) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      sameJson(Object.keys(value).sort(), [...keys].sort())
  );
}

function validRequirementContract(contract) {
  return Boolean(
    contract?.digest === REQUIREMENT_CONTRACT_DIGEST &&
      contract?.componentSatisfactionPolicy === "ALL" &&
      sameJson(contract?.components, DECLARED_COMPONENTS)
  );
}

function expectedDocuments(side, documents) {
  if (!Array.isArray(documents) || documents.length === 0) return null;
  const normalized = documents.map((document) => ({
    uuid: String(document?.uuid || "").trim(),
    side: String(document?.side || "").trim(),
    sha256: String(document?.sha256 || "").trim(),
  }));
  if (
    normalized.some(
      (document) =>
        !document.uuid ||
        document.side !== side ||
        !/^[a-f0-9]{64}$/u.test(document.sha256)
    ) ||
    new Set(normalized.map(({ uuid }) => uuid)).size !== normalized.length
  )
    return null;
  return normalized.sort((left, right) => left.uuid.localeCompare(right.uuid));
}

function componentIdForSearchPlan(searchPlanId) {
  const prefix = `${CATALOG_ID}/${CATEGORY_ID}/`;
  return String(searchPlanId || "").startsWith(prefix)
    ? String(searchPlanId).slice(prefix.length)
    : null;
}

function validCommonSearchCell(cell, requirementContract) {
  const componentId = componentIdForSearchPlan(cell?.searchPlanId);
  const component = COMPONENTS[componentId];
  return Boolean(
    component &&
      hasExactKeys(cell, SEARCH_CELL_KEYS) &&
      hasExactKeys(cell.gates, SEARCH_GATE_KEYS) &&
      cell.catalogId === CATALOG_ID &&
      cell.documentUuid &&
      cell.negativeSearchPolicy ===
        "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1" &&
      cell.absenceMeaning === "COVERAGE_MIXED" &&
      cell.comparisonPolicy == null &&
      cell.absenceCertification == null &&
      sameJson(cell.requirementContract, requirementContract) &&
      Number.isInteger(cell.physicalPagesChecked) &&
      cell.physicalPagesChecked > 0 &&
      cell.physicalPagesChecked === cell.totalPhysicalPages &&
      sameJson(
        canonicalStrings(cell.aliases),
        canonicalStrings(component.aliases)
      ) &&
      sameJson(cell.conceptSearchIds, []) &&
      cell.gates.negativeSearchApproved === true &&
      cell.gates.certifiedNegativeSearch === false &&
      cell.gates.completeTextExtraction === true &&
      cell.gates.completeCategoryTechnicalContract === true
  );
}

function validControlledZeroCell(cell, requirementContract) {
  return Boolean(
    validCommonSearchCell(cell, requirementContract) &&
      cell.disposition === "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH" &&
      cell.comparisonTreatment === "DOCUMENTATION_ONLY_V1" &&
      cell.gates.zeroOccurrenceTerminal === true &&
      cell.gates.zeroCandidateTerminal === true &&
      cell.gates.serverNegativeTerminal === true
  );
}

function validFoundCell(cell, requirementContract) {
  return Boolean(
    validCommonSearchCell(cell, requirementContract) &&
      componentIdForSearchPlan(cell.searchPlanId) === COVER_COMPONENT_ID &&
      cell.disposition === "RELEVANT_FOUND" &&
      cell.comparisonTreatment == null &&
      cell.gates.zeroOccurrenceTerminal === false &&
      cell.gates.zeroCandidateTerminal === false &&
      cell.gates.serverNegativeTerminal === false
  );
}

function exactEmptyFields(atom) {
  return Boolean(
    atom?.requestedFieldStatus === "NOT_REQUIRED" &&
      sameJson(atom?.requestedFields, []) &&
      sameJson(atom?.optionalFields, ["limit"]) &&
      sameJson(atom?.fields, [
        { field: "limit", status: "NOT_FOUND", facts: [] },
      ])
  );
}

function commonAtom(atom, componentId, requirementContract, searchCell) {
  return Boolean(
    atom?.requirementId === CATEGORY_ID &&
      atom?.componentId === componentId &&
      atom?.factRole === COMPONENTS[componentId].factRole &&
      atom?.requirementContractDigest === requirementContract.digest &&
      atom?.componentSatisfactionPolicy === "ALL" &&
      atom?.coverageAggregationPolicy === "ALL_COMPONENT_EFFECTS" &&
      atom?.scopePolicy === "GENERAL_REQUIRED" &&
      sameJson(atom?.declaredComponents, DECLARED_COMPONENTS) &&
      Array.isArray(atom?.documentUuids) &&
      atom.documentUuids.length === 1 &&
      atom.documentUuids[0] === searchCell.documentUuid &&
      String(atom?.documentRole || "").trim() &&
      String(atom?.documentStatus || "").trim() &&
      sameJson(atom?.searchAudit, searchCell)
  );
}

function cleanNotFoundAtom(atom, componentId, requirementContract, searchCell) {
  return Boolean(
    commonAtom(atom, componentId, requirementContract, searchCell) &&
      validControlledZeroCell(searchCell, requirementContract) &&
      atom?.evidencePresence === "NOT_FOUND" &&
      atom?.coverageEffect === "UNKNOWN" &&
      atom?.conflictState === "NONE" &&
      atom?.selectedScopePicture === "UNKNOWN" &&
      atom?.documentApplicability === "UNKNOWN" &&
      sameJson(atom?.selectedCandidateIds, []) &&
      sameJson(atom?.unresolvedCandidateIds, []) &&
      sameJson(atom?.sources, []) &&
      exactEmptyFields(atom)
  );
}

function exactSourceBinding(atom) {
  const selectedIds = canonicalStrings(atom?.selectedCandidateIds);
  const sourceIds = canonicalStrings(
    (atom?.sources || []).map(({ candidateId }) => candidateId)
  );
  return Boolean(
    selectedIds &&
      selectedIds.length > 0 &&
      sourceIds &&
      sameJson(selectedIds, sourceIds) &&
      atom.sources.length === selectedIds.length &&
      atom.sources.every(
        (source) =>
          Number.isInteger(source?.physicalPageNumber) &&
          source.physicalPageNumber > 0 &&
          String(source?.exactText || "").trim()
      )
  );
}

function completeCoverAtom(atom, requirementContract, searchCell) {
  return Boolean(
    commonAtom(atom, COVER_COMPONENT_ID, requirementContract, searchCell) &&
      validFoundCell(searchCell, requirementContract) &&
      atom?.evidencePresence === "FOUND" &&
      atom?.coverageEffect === "INCLUDED" &&
      atom?.conflictState === "NONE" &&
      atom?.selectedScopePicture === "GENERAL" &&
      atom?.requestedFieldStatus === "NOT_REQUIRED" &&
      sameJson(atom?.requestedFields, []) &&
      sameJson(atom?.optionalFields, ["limit"]) &&
      Array.isArray(atom?.fields) &&
      atom.fields.length === 1 &&
      atom.fields[0]?.field === "limit" &&
      sameJson(atom?.unresolvedCandidateIds, []) &&
      exactSourceBinding(atom) &&
      comparisonApplicability(atom) === PACKAGE_MEMBER &&
      atomEventMode(atom) === "UNSPECIFIED" &&
      completeRawComparisonAtom(atom)
  );
}

function projectedAtom(atom) {
  return stableValue({
    requirementId: atom.requirementId,
    componentId: atom.componentId,
    componentLabel: atom.componentLabel,
    factRole: atom.factRole,
    documentUuids: atom.documentUuids,
    documentRole: atom.documentRole,
    documentStatus: atom.documentStatus,
    evidencePresence: atom.evidencePresence,
    coverageEffect: atom.coverageEffect,
    conflictState: atom.conflictState,
    selectedScopePicture: atom.selectedScopePicture,
    scopePolicy: atom.scopePolicy,
    documentApplicability: atom.documentApplicability,
    selectedCandidateIds: atom.selectedCandidateIds,
    unresolvedCandidateIds: atom.unresolvedCandidateIds,
    requestedFieldStatus: atom.requestedFieldStatus,
    requestedFields: atom.requestedFields,
    optionalFields: atom.optionalFields,
    componentSatisfactionPolicy: atom.componentSatisfactionPolicy,
    coverageAggregationPolicy: atom.coverageAggregationPolicy,
    requirementContractDigest: atom.requirementContractDigest,
    declaredComponents: atom.declaredComponents,
    fields: atom.fields,
    sources: atom.sources,
    searchAudit: atom.searchAudit,
  });
}

function projectedAtoms(atoms) {
  return atoms
    .map(projectedAtom)
    .sort((left, right) =>
      `${left.documentUuids?.[0] || ""}\u0000${left.componentId}`.localeCompare(
        `${right.documentUuids?.[0] || ""}\u0000${right.componentId}`
      )
    );
}

function sideProjection({
  side,
  packageSummary,
  atoms,
  requirementContract,
  documents,
}) {
  const manifest = expectedDocuments(side, documents);
  const searchAudit = packageSummary?.searchAudit;
  const documentUuids = canonicalStrings(searchAudit?.documentUuids);
  const manifestUuids = manifest?.map(({ uuid }) => uuid);
  if (
    !manifest ||
    packageSummary?.evidenceFound !== true ||
    packageSummary?.coverage !== "Nicht feststellbar" ||
    packageSummary?.coverageAmount !== "Nicht feststellbar" ||
    packageSummary?.reviewStatus !== "TEILBELEGT" ||
    packageSummary?.searchDisposition !== "RELEVANT_FOUND" ||
    packageSummary?.comparisonTreatment != null ||
    searchAudit?.disposition !== "SEARCH_INCOMPLETE" ||
    searchAudit?.comparisonTreatment != null ||
    !validRequirementContract(searchAudit?.requirementContract) ||
    !sameJson(searchAudit.requirementContract, requirementContract) ||
    !Number.isInteger(searchAudit?.documentCount) ||
    searchAudit.documentCount !== manifest.length ||
    !documentUuids ||
    !sameJson(documentUuids, manifestUuids) ||
    !sameJson(searchAudit?.searchPlanIds, SEARCH_PLAN_IDS) ||
    !Array.isArray(searchAudit?.components) ||
    searchAudit.components.length !== manifest.length * SEARCH_PLAN_IDS.length
  )
    return null;

  const cellsByPair = new Map();
  for (const cell of searchAudit.components) {
    const key = `${cell?.documentUuid || ""}\u0000${cell?.searchPlanId || ""}`;
    if (
      !manifestUuids.includes(cell?.documentUuid) ||
      !SEARCH_PLAN_IDS.includes(cell?.searchPlanId) ||
      cellsByPair.has(key) ||
      !validCommonSearchCell(cell, requirementContract)
    )
      return null;
    cellsByPair.set(key, cell);
  }

  const relevantAtoms = (atoms || []).filter(
    ({ requirementId }) => requirementId === CATEGORY_ID
  );
  if (relevantAtoms.length !== manifest.length * SEARCH_PLAN_IDS.length)
    return null;
  const atomsByPair = new Map();
  for (const atom of relevantAtoms) {
    const documentUuid = atom?.documentUuids?.[0];
    const searchPlanId = `${CATALOG_ID}/${CATEGORY_ID}/${atom?.componentId}`;
    const key = `${documentUuid || ""}\u0000${searchPlanId}`;
    if (
      atom?.documentUuids?.length !== 1 ||
      !manifestUuids.includes(documentUuid) ||
      !SEARCH_PLAN_IDS.includes(searchPlanId) ||
      atomsByPair.has(key) ||
      !sameJson(atom?.searchAudit, cellsByPair.get(key))
    )
      return null;
    atomsByPair.set(key, atom);
  }

  const foundCoverAtoms = [];
  for (const documentUuid of manifestUuids) {
    const qualifierKey = `${documentUuid}\u0000${CATALOG_ID}/${CATEGORY_ID}/${QUALIFIER_COMPONENT_ID}`;
    const coverKey = `${documentUuid}\u0000${CATALOG_ID}/${CATEGORY_ID}/${COVER_COMPONENT_ID}`;
    const qualifierCell = cellsByPair.get(qualifierKey);
    const qualifierAtom = atomsByPair.get(qualifierKey);
    const coverCell = cellsByPair.get(coverKey);
    const coverAtom = atomsByPair.get(coverKey);
    if (
      !cleanNotFoundAtom(
        qualifierAtom,
        QUALIFIER_COMPONENT_ID,
        requirementContract,
        qualifierCell
      )
    )
      return null;
    if (completeCoverAtom(coverAtom, requirementContract, coverCell))
      foundCoverAtoms.push(coverAtom);
    else if (
      !cleanNotFoundAtom(
        coverAtom,
        COVER_COMPONENT_ID,
        requirementContract,
        coverCell
      )
    )
      return null;
  }
  if (foundCoverAtoms.length === 0) return null;

  const facts = packageSummary?.facts;
  const factDocumentUuids = canonicalStrings(
    (facts || []).map(({ documentUuid }) => documentUuid)
  );
  const foundDocumentUuids = foundCoverAtoms
    .map(({ documentUuids: [documentUuid] }) => documentUuid)
    .sort();
  if (
    !Array.isArray(facts) ||
    facts.length !== foundCoverAtoms.length ||
    !factDocumentUuids ||
    !sameJson(factDocumentUuids, foundDocumentUuids) ||
    facts.some(
      (fact) =>
        fact?.reviewStatus !== "TEILBELEGT" ||
        fact?.coverage !== "Nicht feststellbar"
    )
  )
    return null;

  const pagesByDocument = new Map();
  for (const cell of searchAudit.components) {
    if (
      pagesByDocument.has(cell.documentUuid) &&
      pagesByDocument.get(cell.documentUuid) !== cell.physicalPagesChecked
    )
      return null;
    pagesByDocument.set(cell.documentUuid, cell.physicalPagesChecked);
  }
  const physicalPagesChecked = [...pagesByDocument.values()].reduce(
    (sum, pages) => sum + pages,
    0
  );
  if (physicalPagesChecked !== searchAudit.physicalPagesChecked) return null;

  const atomProjection = projectedAtoms(relevantAtoms);
  return {
    side,
    documents: manifest,
    documentManifestDigest: sha256(manifest),
    documentUuids,
    physicalPagesChecked,
    foundCoverDocumentUuids: foundDocumentUuids,
    foundCoverAtomCount: foundCoverAtoms.length,
    qualifierControlledZeroCount: manifest.length,
    packageFactsDigest: sha256(facts),
    searchAuditDigest: sha256(searchAudit),
    projectedAtoms: atomProjection,
    projectedAtomsDigest: sha256(atomProjection),
  };
}

function packageRequirementContract(packageSummary) {
  return (
    packageSummary?.requirementContract ||
    packageSummary?.searchAudit?.requirementContract ||
    null
  );
}

function buildVs15QualifierAbsenceAudit({
  categoryId,
  packageA,
  packageB,
  atomsA,
  atomsB,
  requirementContractA = packageRequirementContract(packageA),
  requirementContractB = packageRequirementContract(packageB),
  expectedDocumentsA,
  expectedDocumentsB,
}) {
  if (
    categoryId !== CATEGORY_ID ||
    !validRequirementContract(requirementContractA) ||
    !sameJson(requirementContractA, requirementContractB)
  )
    return null;
  const sideA = sideProjection({
    side: "A",
    packageSummary: packageA,
    atoms: atomsA,
    requirementContract: requirementContractA,
    documents: expectedDocumentsA,
  });
  const sideB = sideProjection({
    side: "B",
    packageSummary: packageB,
    atoms: atomsB,
    requirementContract: requirementContractB,
    documents: expectedDocumentsB,
  });
  if (!sideA || !sideB) return null;

  const base = {
    schemaVersion: VS15_QUALIFIER_ABSENCE_AUDIT_SCHEMA_VERSION,
    contractId: VS15_QUALIFIER_ABSENCE_AUDIT_CONTRACT_ID,
    categoryId,
    requirementContractDigest: requirementContractA.digest,
    componentSatisfactionPolicy: "ALL",
    declaredComponents: DECLARED_COMPONENTS,
    coverComponentId: COVER_COMPONENT_ID,
    qualifierComponentId: QUALIFIER_COMPONENT_ID,
    searchPlanIds: SEARCH_PLAN_IDS,
    sides: [sideA, sideB],
  };
  return {
    ...base,
    assessmentDigest: domainDigest(
      VS15_QUALIFIER_ABSENCE_AUDIT_CONTRACT_ID,
      base
    ),
  };
}

function validateVs15QualifierAbsenceAudit(audit, options) {
  const sideA = audit?.sides?.find(({ side }) => side === "A");
  const sideB = audit?.sides?.find(({ side }) => side === "B");
  const expected = buildVs15QualifierAbsenceAudit({
    ...options,
    atomsA: sideA?.projectedAtoms,
    atomsB: sideB?.projectedAtoms,
  });
  if (!expected) throw new Error("VS15_QUALIFIER_ABSENCE_AUDIT_NOT_QUALIFIED");
  if (!sameJson(audit, expected))
    throw new Error("VS15_QUALIFIER_ABSENCE_AUDIT_MISMATCH");
  return true;
}

function vs15QualifierAbsenceDecision(audit) {
  if (
    audit?.contractId !== VS15_QUALIFIER_ABSENCE_AUDIT_CONTRACT_ID ||
    audit?.schemaVersion !== VS15_QUALIFIER_ABSENCE_AUDIT_SCHEMA_VERSION
  )
    return null;
  return {
    schemaVersion: 7,
    outcome: "GLEICHWERTIG",
    reasonCode: VS15_QUALIFIER_ABSENCE_REASON_CODE,
    reason:
      "Gleichwertig: In beiden vollständig kontrolliert geprüften Paketen ist allgemeiner Nebengebäudeschutz belegt; ein namentlich in der Polizze angeführtes Nebengebäude wurde unter demselben versionierten Such- und Komponentenvertrag in keinem Paket gefunden. Der kontrollierte Nichtfund wird nicht als ausdrücklicher Ausschluss dargestellt.",
    reviewRequired: false,
    ruleId: VS15_QUALIFIER_ABSENCE_RULE_ID,
    comparisonTreatment: VS15_QUALIFIER_ABSENCE_TREATMENT,
    vs15QualifierAbsenceAudit: audit,
    dimensions: [],
  };
}

module.exports = {
  VS15_QUALIFIER_ABSENCE_AUDIT_CONTRACT_ID,
  VS15_QUALIFIER_ABSENCE_AUDIT_SCHEMA_VERSION,
  VS15_QUALIFIER_ABSENCE_REASON_CODE,
  VS15_QUALIFIER_ABSENCE_RULE_ID,
  VS15_QUALIFIER_ABSENCE_TREATMENT,
  VS15_REQUIREMENT_CONTRACT_DIGEST: REQUIREMENT_CONTRACT_DIGEST,
  buildVs15QualifierAbsenceAudit,
  validateVs15QualifierAbsenceAudit,
  vs15QualifierAbsenceDecision,
};
