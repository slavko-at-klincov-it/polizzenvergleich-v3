const crypto = require("crypto");
const {
  PACKAGE_MEMBER,
  atomEventMode,
  atomHasConditionalOrOptionalSource,
  canonicalComparisonAtoms,
  comparisonApplicability,
  comparisonAtomComplete,
} = require("./comparisonAtomCanonicalization");
const {
  buildQualifiedAbsenceSideProjection,
} = require("./bilateralAbsenceContract");

const UNILATERAL_COVERAGE_AUDIT_SCHEMA_VERSION = 1;
const UNILATERAL_COVERAGE_AUDIT_CONTRACT_ID =
  "QUALIFIED_COVERAGE_OVER_ABSENCE_AUDIT_V1";
const UNILATERAL_COVERAGE_RULE_ID = "INCLUDED_OVER_QUALIFIED_ABSENCE_V1";
const UNILATERAL_COVERAGE_REASON_CODE = "INCLUDED_OVER_QUALIFIED_ABSENCE";
const UNILATERAL_COVERAGE_TREATMENT = "INCLUDED_OVER_QUALIFIED_ABSENCE_V1";
const UNILATERAL_DOCUMENTATION_RULE_ID =
  "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V2";
const UNILATERAL_DOCUMENTATION_REASON_CODE =
  "QUALIFIED_SEARCH_DOCUMENTATION_DIFFERENCE";

const COVERAGE_ROLES = new Set([
  "BENEFIT",
  "DAMAGE",
  "INSURED_OBJECT",
  "PERIL",
]);
const CONTROLLED_NOT_FOUND = "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH";
const VERIFIED_NOT_FOUND = "NOT_FOUND_AFTER_COMPLETE_SEARCH";

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

function sameJson(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function canonicalStrings(values) {
  if (!Array.isArray(values)) return null;
  const normalized = values.map((value) => String(value || "").trim());
  if (normalized.some((value) => !value)) return null;
  const unique = [...new Set(normalized)].sort();
  return unique.length === normalized.length ? unique : null;
}

function validRequirementContract(contract) {
  if (
    !(
      /^[a-f0-9]{64}$/u.test(String(contract?.digest || "")) &&
      contract?.componentSatisfactionPolicy === "ALL" &&
      Array.isArray(contract?.components) &&
      contract.components.length > 0 &&
      contract.components.every(
        ({ id, factRole }) =>
          String(id || "").trim() && COVERAGE_ROLES.has(factRole)
      )
    )
  )
    return false;
  const componentIds = contract.components.map(({ id }) => String(id).trim());
  return new Set(componentIds).size === componentIds.length;
}

function projectAtom(atom) {
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

function canonicalProjectedAtoms(atoms) {
  return (atoms || [])
    .map(projectAtom)
    .sort((left, right) =>
      `${left.documentUuids?.[0] || ""}\u0000${left.componentId || ""}\u0000${sha256(left)}`.localeCompare(
        `${right.documentUuids?.[0] || ""}\u0000${right.componentId || ""}\u0000${sha256(right)}`
      )
    );
}

function cleanNotFoundAtom(atom) {
  return Boolean(
    atom?.evidencePresence === "NOT_FOUND" &&
      atom.coverageEffect === "UNKNOWN" &&
      atom.conflictState === "NONE" &&
      atom.selectedScopePicture === "UNKNOWN" &&
      atom.documentApplicability === "UNKNOWN" &&
      (atom.selectedCandidateIds || []).length === 0 &&
      (atom.unresolvedCandidateIds || []).length === 0 &&
      (atom.sources || []).length === 0 &&
      (atom.requestedFields || []).length === 0 &&
      (atom.optionalFields || []).length === 0 &&
      atom.requestedFieldStatus === "NOT_REQUIRED" &&
      (atom.fields || []).length === 0
  );
}

function completeSearchCell(component, requirementContract, expected) {
  if (
    !sameJson(component?.requirementContract, requirementContract) ||
    component?.catalogId !== expected.catalogId ||
    component?.searchPlanId !== expected.searchPlanId ||
    component?.documentUuid !== expected.documentUuid ||
    component?.absenceMeaning !== "COVERAGE_ONLY" ||
    !Number.isInteger(component?.physicalPagesChecked) ||
    component.physicalPagesChecked < 1 ||
    component.physicalPagesChecked !== component.totalPhysicalPages ||
    component.gates?.negativeSearchApproved !== true ||
    component.gates?.completeTextExtraction !== true ||
    component.gates?.completeCategoryTechnicalContract !== true
  )
    return false;
  if (component.disposition === "RELEVANT_FOUND")
    return (
      component.comparisonTreatment == null &&
      component.gates.certifiedNegativeSearch === false &&
      component.gates.zeroOccurrenceTerminal === false &&
      component.gates.zeroCandidateTerminal === false &&
      component.gates.serverNegativeTerminal === false
    );
  if (component.disposition === CONTROLLED_NOT_FOUND)
    return (
      component.comparisonTreatment === "DOCUMENTATION_ONLY_V1" &&
      component.gates.certifiedNegativeSearch === false &&
      component.gates.zeroOccurrenceTerminal === true &&
      component.gates.zeroCandidateTerminal === true &&
      component.gates.serverNegativeTerminal === true
    );
  if (component.disposition === VERIFIED_NOT_FOUND)
    return (
      component.comparisonTreatment === "ASSUMED_NOT_INCLUDED_V1" &&
      component.gates.certifiedNegativeSearch === true &&
      component.gates.zeroOccurrenceTerminal === true &&
      component.gates.zeroCandidateTerminal === true &&
      component.gates.serverNegativeTerminal === true
    );
  return false;
}

function evidenceSideAssessment({
  side,
  categoryId,
  packageSummary,
  requirementContract,
  atoms,
  expectedDocumentUuids,
}) {
  const blockers = new Set();
  if (!validRequirementContract(requirementContract))
    blockers.add("REQUIREMENT_NOT_PURE_ALL_COVERAGE");
  if (
    packageSummary?.searchDisposition !== "RELEVANT_FOUND" ||
    packageSummary?.evidenceFound !== true ||
    packageSummary?.coverage !== "Ja" ||
    packageSummary?.reviewStatus !== "BELEGT" ||
    packageSummary?.searchDisposition !== "RELEVANT_FOUND" ||
    !Array.isArray(packageSummary?.facts) ||
    packageSummary.facts.length === 0 ||
    packageSummary.facts.some(
      (fact) => fact?.coverage !== "Ja" || fact?.reviewStatus !== "BELEGT"
    )
  )
    blockers.add("PACKAGE_NOT_FULLY_PROVEN_INCLUDED");

  const audit = packageSummary?.searchAudit;
  const documentUuids = canonicalStrings(audit?.documentUuids);
  const canonicalExpectedDocumentUuids =
    expectedDocumentUuids === undefined
      ? documentUuids
      : canonicalStrings(expectedDocumentUuids);
  const rawCatalogIds = (audit?.components || []).map(({ catalogId }) =>
    String(catalogId || "").trim()
  );
  const catalogIds = [...new Set(rawCatalogIds.filter(Boolean))].sort();
  const catalogId = catalogIds.length === 1 ? catalogIds[0] : null;
  const searchPlanIds = canonicalStrings(audit?.searchPlanIds);
  const expectedSearchPlanIds = validRequirementContract(requirementContract)
    ? requirementContract.components
        .map(({ id }) => `${catalogId}/${categoryId}/${id}`)
        .sort()
    : null;
  if (
    !audit ||
    audit.disposition !== "SEARCH_INCOMPLETE" ||
    audit.comparisonTreatment != null ||
    !sameJson(audit.requirementContract, requirementContract) ||
    !Number.isInteger(audit.documentCount) ||
    audit.documentCount < 1 ||
    !Number.isInteger(audit.physicalPagesChecked) ||
    audit.physicalPagesChecked < 1 ||
    !documentUuids ||
    documentUuids.length !== audit.documentCount ||
    !canonicalExpectedDocumentUuids ||
    !sameJson(documentUuids, canonicalExpectedDocumentUuids) ||
    !catalogId ||
    !searchPlanIds ||
    !expectedSearchPlanIds ||
    !sameJson(searchPlanIds, expectedSearchPlanIds) ||
    !Array.isArray(audit.components) ||
    audit.components.length !== documentUuids.length * searchPlanIds.length
  )
    blockers.add("FOUND_SEARCH_MATRIX_INVALID");

  const expectedPairs = new Set(
    (documentUuids || []).flatMap((documentUuid) =>
      (searchPlanIds || []).map(
        (searchPlanId) => `${documentUuid}\u0000${searchPlanId}`
      )
    )
  );
  const foundComponentIds = new Set();
  const pagesPerDocument = new Map();
  for (const component of audit?.components || []) {
    const pair = `${component?.documentUuid || ""}\u0000${component?.searchPlanId || ""}`;
    const componentId = String(component?.searchPlanId || "")
      .split("/")
      .at(-1);
    if (
      !expectedPairs.delete(pair) ||
      !completeSearchCell(component, requirementContract, {
        catalogId,
        searchPlanId: component.searchPlanId,
        documentUuid: component.documentUuid,
      })
    )
      blockers.add("FOUND_SEARCH_MATRIX_INVALID");
    if (component.disposition === "RELEVANT_FOUND")
      foundComponentIds.add(componentId);
    if (!pagesPerDocument.has(component.documentUuid))
      pagesPerDocument.set(
        component.documentUuid,
        component.physicalPagesChecked
      );
    else if (
      pagesPerDocument.get(component.documentUuid) !==
      component.physicalPagesChecked
    )
      blockers.add("FOUND_PAGE_MATRIX_INVALID");
  }
  if (expectedPairs.size !== 0) blockers.add("FOUND_SEARCH_MATRIX_INVALID");
  if (
    [...pagesPerDocument.values()].reduce((sum, pages) => sum + pages, 0) !==
    audit?.physicalPagesChecked
  )
    blockers.add("FOUND_PAGE_MATRIX_INVALID");
  if (
    validRequirementContract(requirementContract) &&
    !sameJson(
      [...foundComponentIds].sort(),
      requirementContract.components.map(({ id }) => id).sort()
    )
  )
    blockers.add("DECLARED_COMPONENTS_NOT_FULLY_INCLUDED");

  const relevantAtoms = (atoms || []).filter(
    (atom) => atom.requirementId === categoryId
  );
  const projectedAtoms = canonicalProjectedAtoms(relevantAtoms);
  const packageAuditDigests = (audit?.components || [])
    .map((component) => sha256(component))
    .sort();
  const atomAuditDigests = relevantAtoms
    .map(({ searchAudit }) => sha256(searchAudit))
    .sort();
  if (
    relevantAtoms.length !== (audit?.components || []).length ||
    !sameJson(atomAuditDigests, packageAuditDigests)
  )
    blockers.add("RAW_ATOM_MATRIX_INVALID");
  for (const atom of relevantAtoms) {
    const declared = requirementContract?.components?.find(
      ({ id }) => id === atom.componentId
    );
    if (
      !declared ||
      declared.factRole !== atom.factRole ||
      atom.requirementContractDigest !== requirementContract?.digest ||
      atom.componentSatisfactionPolicy !== "ALL" ||
      !sameJson(atom.declaredComponents, requirementContract?.components) ||
      !Array.isArray(atom.documentUuids) ||
      atom.documentUuids.length !== 1 ||
      !documentUuids?.includes(atom.documentUuids[0]) ||
      atom.searchAudit?.searchPlanId !==
        `${catalogId}/${categoryId}/${atom.componentId}`
    )
      blockers.add("RAW_ATOM_MATRIX_INVALID");
    if (atom.evidencePresence === "FOUND") {
      if (
        atom.coverageEffect !== "INCLUDED" ||
        !COVERAGE_ROLES.has(atom.factRole) ||
        !comparisonAtomComplete(atom) ||
        comparisonApplicability(atom) !== PACKAGE_MEMBER ||
        (atom.requestedFields || []).length !== 0 ||
        (atom.optionalFields || []).length !== 0 ||
        atom.requestedFieldStatus !== "NOT_REQUIRED"
      )
        blockers.add("FOUND_ATOM_NOT_PURE_INCLUDED");
      if (atomHasConditionalOrOptionalSource(atom))
        blockers.add("CONDITIONAL_OR_OPTIONAL_SOURCE");
      if (atomEventMode(atom) !== "UNSPECIFIED")
        blockers.add("EVENT_MODE_NOT_UNSPECIFIED");
    } else if (!cleanNotFoundAtom(atom)) {
      blockers.add("RAW_ATOM_MATRIX_INVALID");
    }
  }

  const foundAtoms = relevantAtoms.filter(
    ({ evidencePresence }) => evidencePresence === "FOUND"
  );
  const canonicalFound = canonicalComparisonAtoms(foundAtoms);
  if (
    canonicalFound.length !== requirementContract?.components?.length ||
    canonicalFound.some(
      (atom) =>
        atom.coverageEffect !== "INCLUDED" ||
        atom.comparisonApplicability !== PACKAGE_MEMBER ||
        !comparisonAtomComplete(atom) ||
        atom.comparisonContributors.some(
          (contributor) =>
            contributor.complete !== true ||
            contributor.coverageEffect !== "INCLUDED" ||
            contributor.conditionalOrOptional !== false ||
            contributor.operationalEventMode !== "UNSPECIFIED"
        )
    )
  )
    blockers.add("CANONICAL_COMPONENT_PROJECTION_INVALID");

  const factDocumentUuids = canonicalStrings([
    ...new Set(
      (packageSummary?.facts || []).map(({ documentUuid }) => documentUuid)
    ),
  ]);
  const foundDocumentUuids = [
    ...new Set(foundAtoms.flatMap(({ documentUuids: values }) => values || [])),
  ].sort();
  if (!factDocumentUuids || !sameJson(factDocumentUuids, foundDocumentUuids))
    blockers.add("PACKAGE_FACT_BINDING_INVALID");

  const canonicalBlockers = [...blockers].sort();
  return {
    side,
    eligible: canonicalBlockers.length === 0,
    blockerCodes: canonicalBlockers,
    documentUuids: documentUuids || [],
    physicalPagesChecked: audit?.physicalPagesChecked || 0,
    searchPlanIds: searchPlanIds || [],
    searchAuditDigest: audit ? sha256(audit) : null,
    packageFactCount: packageSummary?.facts?.length || 0,
    packageFactsDigest: sha256(packageSummary?.facts || []),
    canonicalComponents: canonicalFound.map((atom) => ({
      componentId: atom.componentId,
      componentLabel: atom.componentLabel,
      factRole: atom.factRole,
      coverageEffect: atom.coverageEffect,
      selectedScopePicture: atom.selectedScopePicture,
      scopePolicy: atom.scopePolicy,
      operationalEventMode: atomEventMode(atom),
      documentUuids: atom.documentUuids,
      contributorCount: atom.comparisonContributors.length,
      contributorsDigest: sha256(atom.comparisonContributors),
      sourcesDigest: sha256(atom.sources),
    })),
    evidencedAtoms: projectedAtoms,
  };
}

function packageRequirementContract(packageSummary) {
  return (
    packageSummary?.requirementContract ||
    packageSummary?.searchAudit?.requirementContract ||
    null
  );
}

function buildUnilateralCoverageAbsenceAudit({
  categoryId,
  packageA,
  packageB,
  atomsA,
  atomsB,
  requirementContractA = packageRequirementContract(packageA),
  requirementContractB = packageRequirementContract(packageB),
  expectedDocumentUuidsA,
  expectedDocumentUuidsB,
}) {
  if (!sameJson(requirementContractA, requirementContractB)) return null;
  const evidencedSide = packageA?.evidenceFound
    ? packageB?.evidenceFound
      ? null
      : "A"
    : packageB?.evidenceFound
      ? "B"
      : null;
  if (!evidencedSide) return null;
  const absentSide = evidencedSide === "A" ? "B" : "A";
  const evidencedPackage = evidencedSide === "A" ? packageA : packageB;
  const absentPackage = absentSide === "A" ? packageA : packageB;
  const evidencedAtoms = evidencedSide === "A" ? atomsA : atomsB;
  const absentAtoms = absentSide === "A" ? atomsA : atomsB;
  const evidencedExpectedDocuments =
    evidencedSide === "A" ? expectedDocumentUuidsA : expectedDocumentUuidsB;
  const absentExpectedDocuments =
    absentSide === "A" ? expectedDocumentUuidsA : expectedDocumentUuidsB;
  const absence = buildQualifiedAbsenceSideProjection({
    side: absentSide,
    categoryId,
    packageSummary: absentPackage,
    requirementContract: requirementContractA,
    atoms: absentAtoms,
    expectedDocumentUuids: absentExpectedDocuments,
  });
  if (!absence) return null;
  const evidenced = evidenceSideAssessment({
    side: evidencedSide,
    categoryId,
    packageSummary: evidencedPackage,
    requirementContract: requirementContractA,
    atoms: evidencedAtoms,
    expectedDocumentUuids: evidencedExpectedDocuments,
  });
  const absenceMeanings = [
    ...new Set(
      (absentPackage?.searchAudit?.components || []).map(
        ({ absenceMeaning }) => absenceMeaning
      )
    ),
  ].sort();
  const blockerCodes = new Set(evidenced.blockerCodes);
  if (!sameJson(absenceMeanings, ["COVERAGE_ONLY"]))
    blockerCodes.add("ABSENCE_MEANING_NOT_COVERAGE_ONLY");
  const canonicalBlockers = [...blockerCodes].sort();
  const base = {
    schemaVersion: UNILATERAL_COVERAGE_AUDIT_SCHEMA_VERSION,
    contractId: UNILATERAL_COVERAGE_AUDIT_CONTRACT_ID,
    categoryId,
    evidencedSide,
    absentSide,
    eligible: canonicalBlockers.length === 0,
    blockerCodes: canonicalBlockers,
    requirementContractDigest: requirementContractA?.digest || null,
    componentSatisfactionPolicy:
      requirementContractA?.componentSatisfactionPolicy || null,
    declaredComponents: [...(requirementContractA?.components || [])].sort(
      (left, right) => left.id.localeCompare(right.id)
    ),
    absenceMeanings,
    searchPlanIds: absence.searchPlanIds,
    searchContractDigest: sha256({
      requirementContract: requirementContractA,
      searchPlanIds: absence.searchPlanIds,
    }),
    evidenced,
    absence,
  };
  return { ...base, assessmentDigest: sha256(base) };
}

function validateUnilateralCoverageAbsenceAudit(audit, options) {
  const atomsA =
    audit?.evidencedSide === "A" ? audit?.evidenced?.evidencedAtoms : undefined;
  const atomsB =
    audit?.evidencedSide === "B" ? audit?.evidenced?.evidencedAtoms : undefined;
  const expected = buildUnilateralCoverageAbsenceAudit({
    ...options,
    atomsA,
    atomsB,
  });
  if (!expected)
    throw new Error("UNILATERAL_COVERAGE_ABSENCE_AUDIT_NOT_QUALIFIED");
  if (!sameJson(audit, expected))
    throw new Error("UNILATERAL_COVERAGE_ABSENCE_AUDIT_MISMATCH");
  return true;
}

module.exports = {
  UNILATERAL_COVERAGE_AUDIT_CONTRACT_ID,
  UNILATERAL_COVERAGE_AUDIT_SCHEMA_VERSION,
  UNILATERAL_COVERAGE_REASON_CODE,
  UNILATERAL_COVERAGE_RULE_ID,
  UNILATERAL_COVERAGE_TREATMENT,
  UNILATERAL_DOCUMENTATION_REASON_CODE,
  UNILATERAL_DOCUMENTATION_RULE_ID,
  buildUnilateralCoverageAbsenceAudit,
  validateUnilateralCoverageAbsenceAudit,
};
