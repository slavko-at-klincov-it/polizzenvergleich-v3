const crypto = require("crypto");
const {
  PACKAGE_MEMBER,
  comparisonApplicability,
  completeRawComparisonAtom,
} = require("./comparisonAtomCanonicalization");

const VS08_CONDITION_CONSENSUS_AUDIT_SCHEMA_VERSION = 1;
const VS08_CONDITION_CONSENSUS_AUDIT_CONTRACT_ID =
  "VS08_PACKAGE_CONDITION_CONSENSUS_AUDIT_V1";
const VS08_CONDITION_CONSENSUS_RULE_ID =
  "VS08_EQUAL_PACKAGE_CONDITION_CONSENSUS_V1";
const VS08_CONDITION_CONSENSUS_REASON_CODE =
  "EQUAL_VS08_PACKAGE_CONDITION_CONSENSUS";

const CATEGORY_ID = "VS-08";
const CATALOG_ID = "vs-occurrence-full-draft-v0.13";
const COMPONENT_ID = "underinsurance_waiver_condition";
const REQUIREMENT_CONTRACT_DIGEST =
  "06d56f1c92de98964da40daa375663e634213fa7ae2198d953bf0adc167b9024";
const DECLARED_COMPONENTS = Object.freeze([
  Object.freeze({ id: COMPONENT_ID, factRole: "CONDITION" }),
]);
const SEARCH_PLAN_ID = `${CATALOG_ID}/${CATEGORY_ID}/${COMPONENT_ID}`;
const CONDITION_VALUE = "bedingt";
const ALIASES = Object.freeze([
  "Unterversicherungsverzicht gilt",
  "Unterversicherungsverzicht besteht",
  "Einwand der Unterversicherung verzichtet",
  "für die Dauer von ca. 3 Jahren",
  "im Schadenfall nur Anwendung, wenn",
  "bezieht sich der Verzicht auf den Einwand der Unterversicherung nur",
]);
const CONCEPT_SEARCH_IDS = Object.freeze([
  "underinsurance-waiver-deviation-condition",
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

function normalized(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
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
  const result = documents.map((document) => ({
    uuid: String(document?.uuid || "").trim(),
    side: String(document?.side || "").trim(),
    sha256: String(document?.sha256 || "").trim(),
  }));
  if (
    result.some(
      (document) =>
        !document.uuid ||
        document.side !== side ||
        !/^[a-f0-9]{64}$/u.test(document.sha256)
    ) ||
    new Set(result.map(({ uuid }) => uuid)).size !== result.length
  )
    return null;
  return result.sort((left, right) => left.uuid.localeCompare(right.uuid));
}

function validCommonSearchCell(cell, requirementContract) {
  return Boolean(
    cell?.catalogId === CATALOG_ID &&
      cell?.searchPlanId === SEARCH_PLAN_ID &&
      String(cell?.documentUuid || "").trim() &&
      cell?.negativeSearchPolicy ===
        "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1" &&
      cell?.absenceMeaning === "CONDITION_ONLY" &&
      cell?.comparisonPolicy == null &&
      cell?.absenceCertification == null &&
      sameJson(cell?.requirementContract, requirementContract) &&
      Number.isInteger(cell?.physicalPagesChecked) &&
      cell.physicalPagesChecked > 0 &&
      cell.physicalPagesChecked === cell.totalPhysicalPages &&
      sameJson(canonicalStrings(cell?.aliases), canonicalStrings(ALIASES)) &&
      sameJson(cell?.conceptSearchIds, CONCEPT_SEARCH_IDS) &&
      cell?.gates?.negativeSearchApproved === true &&
      cell?.gates?.certifiedNegativeSearch === false &&
      cell?.gates?.completeTextExtraction === true &&
      cell?.gates?.completeCategoryTechnicalContract === true
  );
}

function validFoundCell(cell, requirementContract) {
  return Boolean(
    validCommonSearchCell(cell, requirementContract) &&
      cell.disposition === "RELEVANT_FOUND" &&
      cell.comparisonTreatment == null &&
      cell.gates.zeroOccurrenceTerminal === false &&
      cell.gates.zeroCandidateTerminal === false &&
      cell.gates.serverNegativeTerminal === false
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

function commonAtom(atom, requirementContract, searchCell) {
  return Boolean(
    atom?.requirementId === CATEGORY_ID &&
      atom?.componentId === COMPONENT_ID &&
      atom?.factRole === "CONDITION" &&
      atom?.requirementContractDigest === requirementContract.digest &&
      atom?.componentSatisfactionPolicy === "ALL" &&
      atom?.coverageAggregationPolicy === "ALL_COMPONENT_EFFECTS" &&
      atom?.scopePolicy === "GENERAL_REQUIRED" &&
      sameJson(atom?.declaredComponents, DECLARED_COMPONENTS) &&
      Array.isArray(atom?.documentUuids) &&
      atom.documentUuids.length === 1 &&
      atom.documentUuids[0] === searchCell.documentUuid &&
      sameJson(atom?.searchAudit, searchCell)
  );
}

function validSourceBindings(atom) {
  const selectedIds = canonicalStrings(atom?.selectedCandidateIds);
  const sourceIds = canonicalStrings(
    (atom?.sources || []).map(({ candidateId }) => candidateId)
  );
  if (
    !selectedIds ||
    selectedIds.length === 0 ||
    !sourceIds ||
    !sameJson(selectedIds, sourceIds) ||
    atom.sources.length !== selectedIds.length
  )
    return false;
  return atom.sources.every(
    (source) =>
      Number.isInteger(source?.physicalPageNumber) &&
      source.physicalPageNumber > 0 &&
      String(source?.exactText || "").trim() &&
      String(source?.conditionCheckText || "").trim() &&
      /unterversicher/iu.test(source.conditionCheckText) &&
      !/(?:kein|ohne)\s+Unterversicherungsverzicht|Verzicht\s+(?:gilt\s+)?nicht|(?:kann|könnte)\s+[^.]{0,80}\bverzicht/iu.test(
        source.conditionCheckText
      )
  );
}

function validConditionFacts(atom) {
  if (
    atom?.requestedFieldStatus !== "COMPLETE" ||
    !sameJson(atom?.requestedFields, ["condition"]) ||
    !sameJson(atom?.optionalFields, []) ||
    !Array.isArray(atom?.fields) ||
    atom.fields.length !== 1
  )
    return false;
  const field = atom.fields[0];
  if (
    field?.field !== "condition" ||
    field?.status !== "FOUND" ||
    !Array.isArray(field?.facts) ||
    field.facts.length === 0
  )
    return false;
  return field.facts.every(
    (fact) =>
      normalized(fact?.normalizedValue) === CONDITION_VALUE &&
      fact?.valueType === "TEXT" &&
      fact?.unit == null &&
      fact?.binding === "DIRECT" &&
      atom.selectedCandidateIds.includes(fact?.source?.candidateId) &&
      Number.isInteger(fact?.source?.physicalPageNumber) &&
      fact.source.physicalPageNumber > 0 &&
      Number.isInteger(fact?.source?.documentStart) &&
      Number.isInteger(fact?.source?.documentEnd) &&
      fact.source.documentEnd > fact.source.documentStart &&
      String(fact?.source?.exactText || "").trim()
  );
}

function completeConditionalAtom(atom, requirementContract, searchCell) {
  return Boolean(
    commonAtom(atom, requirementContract, searchCell) &&
      validFoundCell(searchCell, requirementContract) &&
      atom?.evidencePresence === "FOUND" &&
      atom?.coverageEffect === "CONDITIONAL" &&
      atom?.conflictState === "NONE" &&
      atom?.selectedScopePicture === "GENERAL" &&
      sameJson(atom?.unresolvedCandidateIds, []) &&
      comparisonApplicability(atom) === PACKAGE_MEMBER &&
      validSourceBindings(atom) &&
      validConditionFacts(atom) &&
      completeRawComparisonAtom(atom)
  );
}

function cleanNotFoundAtom(atom, requirementContract, searchCell) {
  return Boolean(
    commonAtom(atom, requirementContract, searchCell) &&
      validControlledZeroCell(searchCell, requirementContract) &&
      atom?.evidencePresence === "NOT_FOUND" &&
      atom?.coverageEffect === "UNKNOWN" &&
      atom?.conflictState === "NONE" &&
      atom?.selectedScopePicture === "UNKNOWN" &&
      atom?.documentApplicability === "UNKNOWN" &&
      sameJson(atom?.selectedCandidateIds, []) &&
      sameJson(atom?.unresolvedCandidateIds, []) &&
      sameJson(atom?.sources, []) &&
      atom?.requestedFieldStatus === "NOT_FOUND" &&
      sameJson(atom?.requestedFields, ["condition"]) &&
      sameJson(atom?.optionalFields, []) &&
      sameJson(atom?.fields, [
        { field: "condition", status: "NOT_FOUND", facts: [] },
      ])
  );
}

function projectedAtom(atom) {
  return stableValue({
    requirementId: atom.requirementId,
    componentId: atom.componentId,
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

function sideProjection({
  side,
  packageSummary,
  atoms,
  requirementContract,
  documents,
}) {
  const manifest = expectedDocuments(side, documents);
  const searchAudit = packageSummary?.searchAudit;
  const manifestUuids = manifest?.map(({ uuid }) => uuid);
  const auditUuids = canonicalStrings(searchAudit?.documentUuids);
  if (
    !manifest ||
    packageSummary?.evidenceFound !== true ||
    packageSummary?.coverage !== "Ja" ||
    packageSummary?.reviewStatus !== "BELEGT" ||
    packageSummary?.searchDisposition !== "RELEVANT_FOUND" ||
    searchAudit?.disposition !== "SEARCH_INCOMPLETE" ||
    searchAudit?.comparisonTreatment != null ||
    !sameJson(searchAudit?.requirementContract, requirementContract) ||
    searchAudit?.documentCount !== manifest.length ||
    !auditUuids ||
    !sameJson(auditUuids, manifestUuids) ||
    !sameJson(searchAudit?.searchPlanIds, [SEARCH_PLAN_ID]) ||
    !Array.isArray(searchAudit?.components) ||
    searchAudit.components.length !== manifest.length
  )
    return null;

  const cells = new Map();
  for (const cell of searchAudit.components) {
    if (
      !manifestUuids.includes(cell?.documentUuid) ||
      cells.has(cell.documentUuid) ||
      !validCommonSearchCell(cell, requirementContract)
    )
      return null;
    cells.set(cell.documentUuid, cell);
  }

  const relevantAtoms = (atoms || []).filter(
    ({ requirementId }) => requirementId === CATEGORY_ID
  );
  if (relevantAtoms.length !== manifest.length) return null;
  const atomsByDocument = new Map();
  for (const atom of relevantAtoms) {
    const documentUuid = atom?.documentUuids?.[0];
    if (
      atom?.documentUuids?.length !== 1 ||
      !manifestUuids.includes(documentUuid) ||
      atomsByDocument.has(documentUuid) ||
      !sameJson(atom?.searchAudit, cells.get(documentUuid))
    )
      return null;
    atomsByDocument.set(documentUuid, atom);
  }

  const foundAtoms = [];
  for (const documentUuid of manifestUuids) {
    const cell = cells.get(documentUuid);
    const atom = atomsByDocument.get(documentUuid);
    if (completeConditionalAtom(atom, requirementContract, cell))
      foundAtoms.push(atom);
    else if (!cleanNotFoundAtom(atom, requirementContract, cell)) return null;
  }
  if (foundAtoms.length === 0) return null;

  const pagesByDocument = new Map(
    searchAudit.components.map((cell) => [
      cell.documentUuid,
      cell.physicalPagesChecked,
    ])
  );
  const physicalPagesChecked = [...pagesByDocument.values()].reduce(
    (sum, pages) => sum + pages,
    0
  );
  if (physicalPagesChecked !== searchAudit.physicalPagesChecked) return null;

  const projectedAtoms = relevantAtoms
    .map(projectedAtom)
    .sort((left, right) =>
      left.documentUuids[0].localeCompare(right.documentUuids[0])
    );
  return {
    side,
    conditionValues: [CONDITION_VALUE],
    documents: manifest,
    documentManifestDigest: sha256(manifest),
    documentUuids: auditUuids,
    physicalPagesChecked,
    foundDocumentUuids: foundAtoms
      .map(({ documentUuids }) => documentUuids[0])
      .sort(),
    foundAtomCount: foundAtoms.length,
    controlledZeroCount: manifest.length - foundAtoms.length,
    searchAuditDigest: sha256(searchAudit),
    projectedAtoms,
    projectedAtomsDigest: sha256(projectedAtoms),
  };
}

function packageRequirementContract(packageSummary) {
  return (
    packageSummary?.requirementContract ||
    packageSummary?.searchAudit?.requirementContract ||
    null
  );
}

function buildVs08ConditionConsensusAudit({
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
  if (
    !sideA ||
    !sideB ||
    !sameJson(sideA.conditionValues, sideB.conditionValues)
  )
    return null;

  const base = {
    schemaVersion: VS08_CONDITION_CONSENSUS_AUDIT_SCHEMA_VERSION,
    contractId: VS08_CONDITION_CONSENSUS_AUDIT_CONTRACT_ID,
    categoryId,
    catalogId: CATALOG_ID,
    requirementContractDigest: requirementContractA.digest,
    componentId: COMPONENT_ID,
    conditionValues: sideA.conditionValues,
    searchPlanId: SEARCH_PLAN_ID,
    sides: [sideA, sideB],
  };
  return {
    ...base,
    assessmentDigest: domainDigest(
      VS08_CONDITION_CONSENSUS_AUDIT_CONTRACT_ID,
      base
    ),
  };
}

function validateVs08ConditionConsensusAudit(audit, options) {
  const sideA = audit?.sides?.find(({ side }) => side === "A");
  const sideB = audit?.sides?.find(({ side }) => side === "B");
  const expected = buildVs08ConditionConsensusAudit({
    ...options,
    atomsA: sideA?.projectedAtoms,
    atomsB: sideB?.projectedAtoms,
  });
  if (!expected)
    throw new Error("VS08_CONDITION_CONSENSUS_AUDIT_NOT_QUALIFIED");
  if (!sameJson(audit, expected))
    throw new Error("VS08_CONDITION_CONSENSUS_AUDIT_MISMATCH");
  return true;
}

function vs08ConditionConsensusDecision(audit) {
  if (
    audit?.contractId !== VS08_CONDITION_CONSENSUS_AUDIT_CONTRACT_ID ||
    audit?.schemaVersion !== VS08_CONDITION_CONSENSUS_AUDIT_SCHEMA_VERSION ||
    !sameJson(audit?.conditionValues, [CONDITION_VALUE])
  )
    return null;
  return {
    schemaVersion: 8,
    outcome: "GLEICHWERTIG",
    reasonCode: VS08_CONDITION_CONSENSUS_REASON_CODE,
    reason:
      "Gleichwertig: Der Unterversicherungsverzicht ist in beiden vollständig kontrolliert geprüften Paketen bedingt. Sämtliche gefundenen VS-08-Vertragsquellen stimmen in dieser Einordnung überein; unterschiedliche konkrete Voraussetzungen werden damit nicht gleichgesetzt und sind getrennt unter VS-09 zu vergleichen.",
    reviewRequired: false,
    ruleId: VS08_CONDITION_CONSENSUS_RULE_ID,
    vs08ConditionConsensusAudit: audit,
    dimensions: [],
  };
}

module.exports = {
  VS08_CONDITION_CONSENSUS_AUDIT_CONTRACT_ID,
  VS08_CONDITION_CONSENSUS_AUDIT_SCHEMA_VERSION,
  VS08_CONDITION_CONSENSUS_REASON_CODE,
  VS08_CONDITION_CONSENSUS_RULE_ID,
  VS08_REQUIREMENT_CONTRACT_DIGEST: REQUIREMENT_CONTRACT_DIGEST,
  buildVs08ConditionConsensusAudit,
  validateVs08ConditionConsensusAudit,
  vs08ConditionConsensusDecision,
};
