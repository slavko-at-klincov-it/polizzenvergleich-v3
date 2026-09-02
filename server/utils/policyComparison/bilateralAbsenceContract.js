const crypto = require("crypto");
const {
  DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID,
  terminalRejectionSetDigest,
} = require("../policyAnalysis/deterministicTerminalRejectionContract");

const BILATERAL_ABSENCE_AUDIT_SCHEMA_VERSION = 1;
const BILATERAL_ABSENCE_AUDIT_CONTRACT_ID =
  "BILATERAL_QUALIFIED_ABSENCE_AUDIT_V1";
const BILATERAL_ABSENCE_RULE_ID = "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1";
const BILATERAL_ABSENCE_REASON_CODE = "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH";
const BILATERAL_ABSENCE_TREATMENT = "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1";

const QUALIFIED_ABSENCE = Object.freeze({
  NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH: {
    reviewStatus: "KEIN_TREFFER_NACH_VOLLSTÄNDIGER_KONTROLLIERTER_SUCHE",
    comparisonTreatment: "DOCUMENTATION_ONLY_V1",
    certified: false,
  },
  NOT_FOUND_AFTER_COMPLETE_SEARCH: {
    reviewStatus: "NICHT_GEFUNDEN_NACH_VOLLSTÄNDIGER_PRÜFUNG",
    comparisonTreatment: "ASSUMED_NOT_INCLUDED_V1",
    certified: true,
  },
});

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

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(stableStringify(value))
    .digest("hex");
}

function canonicalStrings(values) {
  if (!Array.isArray(values)) return null;
  const normalized = values.map((value) => String(value || "").trim());
  if (normalized.some((value) => !value)) return null;
  const unique = [...new Set(normalized)].sort();
  return unique.length === normalized.length ? unique : null;
}

function sameJson(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function validDeterministicTerminalRejection(component, categoryId) {
  const audit = component?.terminalRejectionAudit;
  const componentId = String(component?.searchPlanId || "")
    .split("/")
    .pop();
  const ids = canonicalStrings(audit?.rejectedCandidateIds);
  if (
    categoryId !== "FE-B13" ||
    componentId !== "pre_inception_damage_exclusion" ||
    component?.gates?.zeroOccurrenceTerminal !== false ||
    component?.gates?.zeroCandidateTerminal !== false ||
    component?.gates?.deterministicOutOfCategoryTerminal !== true ||
    audit?.schemaVersion !== 1 ||
    audit?.contractId !== DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID ||
    audit?.requirementId !== categoryId ||
    audit?.componentId !== componentId ||
    audit?.decisionOwner !== "SERVER" ||
    audit?.decisionBasis !== "EXPLICIT_OTHER_CATEGORY_SECTION" ||
    audit?.proofMode !== "ALL_OCCURRENCES_DETERMINISTICALLY_OUT_OF_CATEGORY" ||
    !Number.isInteger(audit?.rejectedOccurrenceCount) ||
    audit.rejectedOccurrenceCount < 1 ||
    !ids ||
    ids.length !== audit.rejectedOccurrenceCount ||
    !Array.isArray(audit?.rejections) ||
    audit.rejections.length !== audit.rejectedOccurrenceCount ||
    !/^[a-f0-9]{64}$/u.test(String(audit?.rejectionDigestSha256 || "")) ||
    audit.rejectionDigestSha256 !==
      terminalRejectionSetDigest(audit.rejections) ||
    audit.rejections.some(
      (rejection) =>
        !ids.includes(rejection?.candidateId) ||
        rejection?.decisionBasis !== "EXPLICIT_OTHER_CATEGORY_SECTION" ||
        !/^[a-f0-9]{64}$/u.test(
          String(rejection?.occurrenceDigestSha256 || "")
        ) ||
        !Number.isInteger(rejection?.physicalPageNumber) ||
        rejection.physicalPageNumber < 1 ||
        rejection?.sectionScopeSource !== "CURRENT_PAGE_HEADING" ||
        !Array.isArray(rejection?.observedScopeKeys) ||
        rejection.observedScopeKeys.length !== 1 ||
        !String(rejection.observedScopeKeys[0] || "").endsWith("_INSURANCE")
    )
  )
    return false;
  return true;
}

function validComponentTerminal(component, categoryId) {
  const zeroTerminal = Boolean(
    component?.gates?.zeroOccurrenceTerminal === true &&
      component?.gates?.zeroCandidateTerminal === true &&
      component?.gates?.deterministicOutOfCategoryTerminal === undefined &&
      component?.terminalRejectionAudit === undefined
  );
  return (
    zeroTerminal || validDeterministicTerminalRejection(component, categoryId)
  );
}

function validRequirementContract(contract) {
  if (
    !(
      /^[a-f0-9]{64}$/u.test(String(contract?.digest || "")) &&
      ["ALL", "ANY"].includes(contract?.componentSatisfactionPolicy) &&
      Array.isArray(contract?.components) &&
      contract.components.length > 0 &&
      contract.components.every(
        ({ id, factRole }) =>
          String(id || "").trim() && String(factRole || "").trim()
      )
    )
  )
    return false;
  const componentIds = contract.components.map(({ id }) => String(id).trim());
  return new Set(componentIds).size === componentIds.length;
}

function canonicalSearchAudit(audit) {
  return {
    ...audit,
    documentUuids: [...(audit.documentUuids || [])].sort(),
    searchPlanIds: [...(audit.searchPlanIds || [])].sort(),
    components: [...(audit.components || [])]
      .map((component) => ({
        ...component,
        aliases: [...(component.aliases || [])].sort(),
        conceptSearchIds: [...(component.conceptSearchIds || [])].sort(),
      }))
      .sort((left, right) =>
        `${left.documentUuid || ""}\u0000${left.searchPlanId || ""}`.localeCompare(
          `${right.documentUuid || ""}\u0000${right.searchPlanId || ""}`
        )
      ),
  };
}

function cleanNotFoundAtom(atom) {
  const fields = atom.fields || [];
  const requestedFields = atom.requestedFields || [];
  const optionalFields = atom.optionalFields || [];
  const canonicalRequestedFields = canonicalStrings(requestedFields);
  const canonicalOptionalFields = canonicalStrings(optionalFields);
  const canonicalObservedFields = canonicalStrings(
    fields.map(({ field }) => field)
  );
  const canonicalExpectedFields =
    canonicalRequestedFields && canonicalOptionalFields
      ? [
          ...new Set([...canonicalRequestedFields, ...canonicalOptionalFields]),
        ].sort()
      : null;
  const fieldNamesClean = Boolean(
    canonicalExpectedFields &&
      canonicalExpectedFields.length ===
        canonicalRequestedFields.length + canonicalOptionalFields.length &&
      canonicalObservedFields &&
      sameJson(canonicalObservedFields, canonicalExpectedFields)
  );
  const requestedFieldsClean =
    ((canonicalRequestedFields?.length > 0 &&
      ["NOT_FOUND", "NOT_EVALUATED"].includes(atom.requestedFieldStatus)) ||
      (canonicalRequestedFields?.length === 0 &&
        atom.requestedFieldStatus === "NOT_REQUIRED")) &&
    fieldNamesClean &&
    fields.every(
      ({ field, status, facts }) =>
        String(field || "").trim() &&
        status === "NOT_FOUND" &&
        Array.isArray(facts) &&
        facts.length === 0
    );
  return Boolean(
    atom.evidencePresence === "NOT_FOUND" &&
      atom.coverageEffect === "UNKNOWN" &&
      atom.conflictState === "NONE" &&
      atom.selectedScopePicture === "UNKNOWN" &&
      atom.documentApplicability === "UNKNOWN" &&
      (atom.selectedCandidateIds || []).length === 0 &&
      (atom.unresolvedCandidateIds || []).length === 0 &&
      (atom.sources || []).length === 0 &&
      requestedFieldsClean
  );
}

function qualifiedSideProjection({
  side,
  categoryId,
  packageSummary,
  requirementContract,
  atoms,
  expectedDocumentUuids,
}) {
  const disposition = String(packageSummary?.searchDisposition || "");
  const policy = QUALIFIED_ABSENCE[disposition];
  if (
    !policy ||
    packageSummary?.evidenceFound !== false ||
    !Array.isArray(packageSummary?.facts) ||
    packageSummary.facts.length !== 0 ||
    packageSummary?.reviewStatus !== policy.reviewStatus ||
    packageSummary?.comparisonTreatment !== policy.comparisonTreatment ||
    !validRequirementContract(requirementContract)
  )
    return null;

  const audit = packageSummary?.searchAudit;
  if (
    !audit ||
    audit.disposition !== disposition ||
    audit.comparisonTreatment !== policy.comparisonTreatment ||
    !sameJson(audit.requirementContract, requirementContract) ||
    !Number.isInteger(audit.documentCount) ||
    audit.documentCount < 1 ||
    !Number.isInteger(audit.physicalPagesChecked) ||
    audit.physicalPagesChecked < 1
  )
    return null;

  const documentUuids = canonicalStrings(audit.documentUuids);
  const canonicalExpectedDocumentUuids =
    expectedDocumentUuids === undefined
      ? null
      : canonicalStrings(expectedDocumentUuids);
  const rawCatalogIds = (audit.components || []).map(({ catalogId }) =>
    String(catalogId || "").trim()
  );
  if (rawCatalogIds.length === 0 || rawCatalogIds.some((value) => !value))
    return null;
  const catalogIds = [...new Set(rawCatalogIds)].sort();
  if (catalogIds.length !== 1) return null;
  const expectedSearchPlanIds = requirementContract.components
    .map(({ id }) => `${catalogIds[0]}/${categoryId}/${id}`)
    .sort();
  const searchPlanIds = canonicalStrings(audit.searchPlanIds);
  if (
    !documentUuids ||
    documentUuids.length !== audit.documentCount ||
    (expectedDocumentUuids !== undefined &&
      (!canonicalExpectedDocumentUuids ||
        !sameJson(documentUuids, canonicalExpectedDocumentUuids))) ||
    !searchPlanIds ||
    !sameJson(searchPlanIds, expectedSearchPlanIds) ||
    !Array.isArray(audit.components) ||
    audit.components.length !== documentUuids.length * searchPlanIds.length
  )
    return null;

  const expectedPairs = new Set(
    documentUuids.flatMap((documentUuid) =>
      searchPlanIds.map(
        (searchPlanId) => `${documentUuid}\u0000${searchPlanId}`
      )
    )
  );
  for (const component of audit.components) {
    const pair = `${component?.documentUuid || ""}\u0000${component?.searchPlanId || ""}`;
    if (!expectedPairs.delete(pair)) return null;
    if (
      component.disposition !== disposition ||
      component.comparisonTreatment !== policy.comparisonTreatment ||
      !sameJson(component.requirementContract, requirementContract) ||
      component.catalogId !== catalogIds[0] ||
      !Number.isInteger(component.physicalPagesChecked) ||
      component.physicalPagesChecked < 1 ||
      component.physicalPagesChecked !== component.totalPhysicalPages ||
      component.gates?.negativeSearchApproved !== true ||
      component.gates?.certifiedNegativeSearch !== policy.certified ||
      component.gates?.completeTextExtraction !== true ||
      component.gates?.completeCategoryTechnicalContract !== true ||
      !validComponentTerminal(component, categoryId) ||
      component.gates?.serverNegativeTerminal !== true
    )
      return null;
  }
  if (expectedPairs.size !== 0) return null;
  const pagesPerDocument = new Map();
  for (const component of audit.components) {
    if (!pagesPerDocument.has(component.documentUuid))
      pagesPerDocument.set(
        component.documentUuid,
        component.physicalPagesChecked
      );
    else if (
      pagesPerDocument.get(component.documentUuid) !==
      component.physicalPagesChecked
    )
      return null;
  }
  if (
    [...pagesPerDocument.values()].reduce((sum, pages) => sum + pages, 0) !==
    audit.physicalPagesChecked
  )
    return null;

  if (atoms !== undefined) {
    const relevantAtoms = (atoms || []).filter(
      (atom) => atom.requirementId === categoryId
    );
    if (
      relevantAtoms.length !== audit.components.length ||
      relevantAtoms.some((atom) => {
        const component = requirementContract.components.find(
          ({ id }) => id === atom.componentId
        );
        const expectedSearchPlanId = `${catalogIds[0]}/${categoryId}/${atom.componentId}`;
        return (
          !cleanNotFoundAtom(atom) ||
          !component ||
          atom.factRole !== component.factRole ||
          atom.requirementContractDigest !== requirementContract.digest ||
          atom.componentSatisfactionPolicy !==
            requirementContract.componentSatisfactionPolicy ||
          !sameJson(atom.declaredComponents, requirementContract.components) ||
          !Array.isArray(atom.documentUuids) ||
          atom.documentUuids.length !== 1 ||
          atom.documentUuids[0] !== atom.searchAudit?.documentUuid ||
          atom.searchAudit?.searchPlanId !== expectedSearchPlanId
        );
      })
    )
      return null;
    const atomAudits = relevantAtoms
      .map(({ searchAudit }) => stableStringify(searchAudit))
      .sort();
    const packageAudits = audit.components
      .map((component) => stableStringify(component))
      .sort();
    if (!sameJson(atomAudits, packageAudits)) return null;
  }

  return {
    side,
    disposition,
    comparisonTreatment: policy.comparisonTreatment,
    reviewStatus: policy.reviewStatus,
    documentUuids,
    physicalPagesChecked: audit.physicalPagesChecked,
    searchPlanIds,
    componentAuditCount: audit.components.length,
    searchAuditDigest: sha256(canonicalSearchAudit(audit)),
  };
}

function buildBilateralAbsenceAudit({
  categoryId,
  packageA,
  packageB,
  atomsA,
  atomsB,
  requirementContractA,
  requirementContractB,
  expectedDocumentUuidsA,
  expectedDocumentUuidsB,
}) {
  if (
    !validRequirementContract(requirementContractA) ||
    !sameJson(requirementContractA, requirementContractB)
  )
    return null;
  const sideA = qualifiedSideProjection({
    side: "A",
    categoryId,
    packageSummary: packageA,
    requirementContract: requirementContractA,
    atoms: atomsA,
    expectedDocumentUuids: expectedDocumentUuidsA,
  });
  const sideB = qualifiedSideProjection({
    side: "B",
    categoryId,
    packageSummary: packageB,
    requirementContract: requirementContractB,
    atoms: atomsB,
    expectedDocumentUuids: expectedDocumentUuidsB,
  });
  if (
    !sideA ||
    !sideB ||
    sideA.disposition !== sideB.disposition ||
    sideA.comparisonTreatment !== sideB.comparisonTreatment ||
    !sameJson(sideA.searchPlanIds, sideB.searchPlanIds)
  )
    return null;
  return {
    schemaVersion: BILATERAL_ABSENCE_AUDIT_SCHEMA_VERSION,
    contractId: BILATERAL_ABSENCE_AUDIT_CONTRACT_ID,
    categoryId,
    requirementContractDigest: requirementContractA.digest,
    componentSatisfactionPolicy:
      requirementContractA.componentSatisfactionPolicy,
    declaredComponents: [...requirementContractA.components].sort(
      (left, right) => left.id.localeCompare(right.id)
    ),
    searchPlanIds: sideA.searchPlanIds,
    searchContractDigest: sha256({
      requirementContract: requirementContractA,
      searchPlanIds: sideA.searchPlanIds,
    }),
    sides: [sideA, sideB],
  };
}

function validateBilateralAbsenceAudit(audit, options) {
  const {
    categoryId,
    packageA,
    packageB,
    expectedDocumentUuidsA,
    expectedDocumentUuidsB,
  } = options;
  const contractA =
    packageA?.requirementContract || packageA?.searchAudit?.requirementContract;
  const contractB =
    packageB?.requirementContract || packageB?.searchAudit?.requirementContract;
  const expected = buildBilateralAbsenceAudit({
    categoryId,
    packageA,
    packageB,
    requirementContractA: contractA,
    requirementContractB: contractB,
    expectedDocumentUuidsA,
    expectedDocumentUuidsB,
  });
  if (!expected) throw new Error("BILATERAL_ABSENCE_AUDIT_NOT_QUALIFIED");
  if (!sameJson(audit, expected))
    throw new Error("BILATERAL_ABSENCE_AUDIT_MISMATCH");
  return true;
}

module.exports = {
  BILATERAL_ABSENCE_AUDIT_CONTRACT_ID,
  BILATERAL_ABSENCE_AUDIT_SCHEMA_VERSION,
  BILATERAL_ABSENCE_REASON_CODE,
  BILATERAL_ABSENCE_RULE_ID,
  BILATERAL_ABSENCE_TREATMENT,
  buildBilateralAbsenceAudit,
  buildQualifiedAbsenceSideProjection: qualifiedSideProjection,
  validateBilateralAbsenceAudit,
};
