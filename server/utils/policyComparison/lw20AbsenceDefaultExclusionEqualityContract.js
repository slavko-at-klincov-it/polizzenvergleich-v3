const crypto = require("crypto");
const {
  LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_CONTRACT_ID,
  LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_SCHEMA_VERSION,
  LW20_DEFAULT_EXCLUSION_OVERRIDE_DECISION_BASIS,
  LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_CONTRACT_ID,
  LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_FAMILY_DIGEST_SHA256,
  NO_OVERRIDE_REFERENCE_FOUND,
} = require("../policyAnalysis/lw20DefaultExclusionOverrideAudit");
const {
  PACKAGE_MEMBER,
  atomEventMode,
  comparisonApplicability,
} = require("./comparisonAtomCanonicalization");
const {
  buildQualifiedAbsenceSideProjection,
} = require("./bilateralAbsenceContract");
const {
  validPersistedLw20DefaultExclusionSourceAudit,
} = require("../policyAnalysis/lw20DefaultExclusionSourceAudit");

const LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_AUDIT_SCHEMA_VERSION = 1;
const LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_AUDIT_CONTRACT_ID =
  "LW20_QUALIFIED_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_AUDIT_V1";
const LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_RULE_ID =
  "LW20_QUALIFIED_ABSENCE_UNOVERRIDDEN_DEFAULT_EXCLUSION_EQUALITY_V1";
const LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_REASON_CODE =
  "EQUAL_LW20_QUALIFIED_ABSENCE_UNOVERRIDDEN_DEFAULT_EXCLUSION";
const LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_TREATMENT =
  "EQUAL_LW20_QUALIFIED_ABSENCE_UNOVERRIDDEN_DEFAULT_EXCLUSION_V1";

const CATEGORY_ID = "LW-20";
const COMPONENT_ID = "ground_seepage_or_retained_water";
const FACT_ROLE = "PERIL";
const CATALOG_ID = "lw-occurrence-full-draft-v0.9";
const SEARCH_PLAN_ID = `${CATALOG_ID}/${CATEGORY_ID}/${COMPONENT_ID}`;
const OVERRIDE_FAMILY_IDS = Object.freeze([
  "LW20_ITEM_C_EXCLUSION_OVERRIDE_REFERENCE_V2",
  "LW20_DEFAULT_HEADING_OVERRIDE_REFERENCE_V2",
  "LW20_COMPLETE_EXCLUSION_BLOCK_OVERRIDE_V2",
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

function sameJson(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function hasExactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return sameJson(Object.keys(value).sort(), [...keys].sort());
}

function canonicalStrings(values) {
  if (!Array.isArray(values)) return null;
  const strings = values.map((value) => String(value || "").trim());
  if (strings.some((value) => !value)) return null;
  const unique = [...new Set(strings)].sort();
  return unique.length === strings.length ? unique : null;
}

function validRequirementContract(contract) {
  return Boolean(
    /^[a-f0-9]{64}$/u.test(String(contract?.digest || "")) &&
      contract?.componentSatisfactionPolicy === "ALL" &&
      sameJson(contract?.components, [
        { id: COMPONENT_ID, factRole: FACT_ROLE },
      ])
  );
}

function expectedDocumentMap(expectedDocuments) {
  if (expectedDocuments === undefined) return null;
  if (!Array.isArray(expectedDocuments)) return false;
  const entries = expectedDocuments.map((document) => [
    String(document?.uuid || "").trim(),
    String(document?.sha256 || "").trim(),
  ]);
  if (
    entries.some(
      ([uuid, digest]) => !uuid || !/^[a-f0-9]{64}$/u.test(digest)
    ) ||
    new Set(entries.map(([uuid]) => uuid)).size !== entries.length
  )
    return false;
  return new Map(entries);
}

function validAbsencePackageCells(
  packageSummary,
  requirementContract,
  expectedDocuments
) {
  const components = packageSummary?.searchAudit?.components;
  return Boolean(
    sameJson(packageSummary?.searchAudit?.searchPlanIds, [SEARCH_PLAN_ID]) &&
      Array.isArray(components) &&
      components.length > 0 &&
      components.every(
        (component) =>
          validCommonSearchCell(
            component,
            requirementContract,
            expectedDocuments?.get(component.documentUuid)
          ) &&
          component.disposition ===
            "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH" &&
          component.comparisonTreatment === "DOCUMENTATION_ONLY_V1"
      )
  );
}

function validB1OverrideAudit(audit, component, expectedDocumentSha256) {
  const documentAudit = audit?.document;
  const familyContract = audit?.patternFamilyContract;
  if (
    !hasExactKeys(audit, [
      "assessmentDigestSha256",
      "candidateCount",
      "candidateSetDigestSha256",
      "candidates",
      "componentId",
      "contractId",
      "decisionBasis",
      "decisionOwner",
      "document",
      "patternFamilyContract",
      "requirementId",
      "schemaVersion",
      "status",
    ]) ||
    !hasExactKeys(documentAudit, [
      "documentArtifactDigestSha256",
      "pageContentSha256",
      "pageMapSha256",
      "physicalPagesChecked",
      "sha256",
      "totalPhysicalPages",
      "uuid",
    ]) ||
    !hasExactKeys(familyContract, [
      "contractId",
      "digestSha256",
      "familyIds",
    ]) ||
    audit?.schemaVersion !==
      LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_SCHEMA_VERSION ||
    audit?.contractId !== LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_CONTRACT_ID ||
    audit?.requirementId !== CATEGORY_ID ||
    audit?.componentId !== COMPONENT_ID ||
    audit?.decisionOwner !== "SERVER" ||
    audit?.decisionBasis !== LW20_DEFAULT_EXCLUSION_OVERRIDE_DECISION_BASIS ||
    audit?.status !== NO_OVERRIDE_REFERENCE_FOUND ||
    audit?.candidateCount !== 0 ||
    !Array.isArray(audit?.candidates) ||
    audit.candidates.length !== 0 ||
    documentAudit?.uuid !== component?.documentUuid ||
    !/^[a-f0-9]{64}$/u.test(String(documentAudit?.sha256 || "")) ||
    (expectedDocumentSha256 !== undefined &&
      documentAudit.sha256 !== expectedDocumentSha256) ||
    documentAudit?.physicalPagesChecked !== component?.physicalPagesChecked ||
    documentAudit?.totalPhysicalPages !== component?.totalPhysicalPages ||
    ![
      documentAudit?.documentArtifactDigestSha256,
      documentAudit?.pageContentSha256,
      documentAudit?.pageMapSha256,
    ].every((digest) => /^[a-f0-9]{64}$/u.test(String(digest || ""))) ||
    familyContract?.contractId !==
      LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_CONTRACT_ID ||
    !sameJson(familyContract?.familyIds, OVERRIDE_FAMILY_IDS) ||
    familyContract?.digestSha256 !==
      LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_FAMILY_DIGEST_SHA256
  )
    return false;

  if (
    audit.candidateSetDigestSha256 !==
    domainDigest(
      "LW20_DEFAULT_EXCLUSION_ALIAS_FREE_OVERRIDE_CANDIDATE_SET_V2",
      []
    )
  )
    return false;
  const { assessmentDigestSha256, ...base } = audit;
  return (
    assessmentDigestSha256 ===
    domainDigest(LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_CONTRACT_ID, base)
  );
}

function validCommonSearchCell(
  component,
  requirementContract,
  expectedDocumentSha256
) {
  return Boolean(
    component?.catalogId === CATALOG_ID &&
      component?.searchPlanId === SEARCH_PLAN_ID &&
      component?.absenceMeaning === "COVERAGE_ONLY" &&
      component?.negativeSearchPolicy ===
        "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1" &&
      component?.comparisonPolicy == null &&
      component?.absenceCertification == null &&
      sameJson(component?.requirementContract, requirementContract) &&
      Number.isInteger(component?.physicalPagesChecked) &&
      component.physicalPagesChecked > 0 &&
      component.physicalPagesChecked === component.totalPhysicalPages &&
      sameJson(component?.aliases, [
        "Grundwasser",
        "Sickerwasser",
        "Stauwasser",
      ]) &&
      sameJson(component?.conceptSearchIds, []) &&
      component?.gates?.negativeSearchApproved === true &&
      component?.gates?.certifiedNegativeSearch === false &&
      component?.gates?.completeTextExtraction === true &&
      component?.gates?.completeCategoryTechnicalContract === true &&
      validB1OverrideAudit(
        component?.lw20DefaultExclusionOverrideAudit,
        component,
        expectedDocumentSha256
      )
  );
}

function cleanQualifiedNotFoundAtom(
  atom,
  requirementContract,
  expectedDocumentSha256
) {
  const component = atom?.searchAudit;
  if (
    !validCommonSearchCell(
      component,
      requirementContract,
      expectedDocumentSha256
    ) ||
    component?.lw20DefaultExclusionSourceAudit !== undefined ||
    component?.disposition !== "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH" ||
    component?.comparisonTreatment !== "DOCUMENTATION_ONLY_V1"
  )
    return false;
  const projection = buildQualifiedAbsenceSideProjection({
    side: "N",
    categoryId: CATEGORY_ID,
    packageSummary: {
      evidenceFound: false,
      facts: [],
      reviewStatus: "KEIN_TREFFER_NACH_VOLLSTÄNDIGER_KONTROLLIERTER_SUCHE",
      searchDisposition: component.disposition,
      comparisonTreatment: component.comparisonTreatment,
      searchAudit: {
        disposition: component.disposition,
        comparisonTreatment: component.comparisonTreatment,
        documentCount: 1,
        documentUuids: [component.documentUuid],
        physicalPagesChecked: component.physicalPagesChecked,
        searchPlanIds: [component.searchPlanId],
        requirementContract,
        components: [component],
      },
    },
    requirementContract,
    atoms: [atom],
    expectedDocumentUuids: [component.documentUuid],
  });
  return Boolean(projection);
}

function defaultExclusionSource(atom, expectedDocumentSha256) {
  const sourceCandidateIds = canonicalStrings(
    (atom?.sources || []).map(({ candidateId }) => candidateId)
  );
  if (
    !Array.isArray(atom?.selectedCandidateIds) ||
    atom.selectedCandidateIds.length !== 1 ||
    new Set(atom.selectedCandidateIds).size !==
      atom.selectedCandidateIds.length ||
    !Array.isArray(atom?.sources) ||
    atom.sources.length !== atom.selectedCandidateIds.length ||
    !sourceCandidateIds ||
    !sameJson(sourceCandidateIds, [...atom.selectedCandidateIds].sort())
  )
    return false;
  const source = atom.sources[0];
  const audit = atom?.searchAudit?.lw20DefaultExclusionSourceAudit;
  return Boolean(
    source?.candidateId === atom.selectedCandidateIds[0] &&
      source?.candidateId === audit?.source?.candidateId &&
      source?.physicalPageNumber === audit?.document?.physicalPageNumber &&
      source?.exactText === audit?.source?.exactText &&
      validPersistedLw20DefaultExclusionSourceAudit(audit, {
        documentUuid: atom?.documentUuids?.[0],
        documentSha256: expectedDocumentSha256 || audit?.document?.sha256,
        candidateId: source?.candidateId,
      })
  );
}

function completeDefaultExclusionAtom(
  atom,
  requirementContract,
  expectedDocumentSha256
) {
  const component = atom?.searchAudit;
  const validApplicability =
    (atom?.documentApplicability === "ACTIVE" &&
      atom?.documentStatus === "ACTIVE") ||
    (atom?.documentApplicability === "CONDITIONAL" &&
      atom?.documentStatus === "FRAMEWORK_TERMS" &&
      atom?.documentRole === "TERMS");
  return Boolean(
    validCommonSearchCell(
      component,
      requirementContract,
      expectedDocumentSha256
    ) &&
      component?.disposition === "RELEVANT_FOUND" &&
      component?.comparisonTreatment == null &&
      component?.gates?.zeroOccurrenceTerminal === false &&
      component?.gates?.zeroCandidateTerminal === false &&
      component?.gates?.serverNegativeTerminal === false &&
      component?.terminalRejectionAudit === undefined &&
      atom?.requirementId === CATEGORY_ID &&
      atom?.componentId === COMPONENT_ID &&
      atom?.factRole === FACT_ROLE &&
      atom?.requirementContractDigest === requirementContract.digest &&
      atom?.componentSatisfactionPolicy === "ALL" &&
      sameJson(atom?.declaredComponents, requirementContract.components) &&
      atom?.evidencePresence === "FOUND" &&
      atom?.coverageEffect === "EXCLUDED" &&
      atom?.conflictState === "NONE" &&
      atom?.selectedScopePicture === "GENERAL" &&
      atom?.scopePolicy === "GENERAL_REQUIRED" &&
      ["ACTIVE", "CONDITIONAL"].includes(atom?.documentApplicability) &&
      validApplicability &&
      comparisonApplicability(atom) === PACKAGE_MEMBER &&
      atomEventMode(atom) === "UNSPECIFIED" &&
      Array.isArray(atom?.unresolvedCandidateIds) &&
      atom.unresolvedCandidateIds.length === 0 &&
      atom?.requestedFieldStatus === "NOT_REQUIRED" &&
      sameJson(atom?.requestedFields, []) &&
      sameJson(atom?.optionalFields, []) &&
      sameJson(atom?.fields, []) &&
      Array.isArray(atom?.documentUuids) &&
      sameJson(atom.documentUuids, [component.documentUuid]) &&
      String(atom?.documentRole || "").trim() &&
      defaultExclusionSource(atom, expectedDocumentSha256)
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
  return (atoms || [])
    .map(projectedAtom)
    .sort((left, right) =>
      `${left.documentUuids?.[0] || ""}\u0000${sha256(left)}`.localeCompare(
        `${right.documentUuids?.[0] || ""}\u0000${sha256(right)}`,
        "en"
      )
    );
}

function defaultExclusionSideProjection({
  side,
  packageSummary,
  requirementContract,
  atoms,
  expectedDocumentUuids,
  expectedDocuments,
}) {
  if (
    packageSummary?.evidenceFound !== true ||
    packageSummary?.coverage !== "Nein" ||
    packageSummary?.reviewStatus !== "BELEGT" ||
    packageSummary?.searchDisposition !== "RELEVANT_FOUND" ||
    packageSummary?.comparisonTreatment != null ||
    !Array.isArray(packageSummary?.facts) ||
    packageSummary.facts.length !== 1 ||
    packageSummary.facts[0]?.coverage !== "Nein" ||
    packageSummary.facts[0]?.reviewStatus !== "BELEGT"
  )
    return null;

  const audit = packageSummary?.searchAudit;
  const documentUuids = canonicalStrings(audit?.documentUuids);
  const expectedUuids =
    expectedDocumentUuids === undefined
      ? documentUuids
      : canonicalStrings(expectedDocumentUuids);
  const expectedDocumentByUuid = expectedDocumentMap(expectedDocuments);
  if (expectedDocumentByUuid === false) return null;
  if (
    audit?.disposition !== "SEARCH_INCOMPLETE" ||
    audit?.comparisonTreatment != null ||
    !sameJson(audit?.requirementContract, requirementContract) ||
    !Number.isInteger(audit?.documentCount) ||
    audit.documentCount < 1 ||
    !documentUuids ||
    documentUuids.length !== audit.documentCount ||
    !expectedUuids ||
    !sameJson(documentUuids, expectedUuids) ||
    (expectedDocumentByUuid &&
      !sameJson(documentUuids, [...expectedDocumentByUuid.keys()].sort())) ||
    !sameJson(audit?.searchPlanIds, [SEARCH_PLAN_ID]) ||
    !Array.isArray(audit?.components) ||
    audit.components.length !== documentUuids.length
  )
    return null;

  const relevantAtoms = (atoms || []).filter(
    ({ requirementId }) => requirementId === CATEGORY_ID
  );
  if (relevantAtoms.length !== documentUuids.length) return null;
  const byDocument = new Map();
  for (const atom of relevantAtoms) {
    const documentUuid = atom?.documentUuids?.[0];
    if (
      !documentUuids.includes(documentUuid) ||
      byDocument.has(documentUuid) ||
      atom?.componentId !== COMPONENT_ID ||
      atom?.factRole !== FACT_ROLE ||
      atom?.requirementContractDigest !== requirementContract.digest ||
      atom?.componentSatisfactionPolicy !== "ALL" ||
      !sameJson(atom?.declaredComponents, requirementContract.components) ||
      atom?.conflictState !== "NONE" ||
      (atom?.unresolvedCandidateIds || []).length !== 0
    )
      return null;
    byDocument.set(documentUuid, atom);
  }
  const packageCells = new Map(
    audit.components.map((component) => [component?.documentUuid, component])
  );
  if (
    packageCells.size !== documentUuids.length ||
    documentUuids.some(
      (uuid) =>
        !byDocument.has(uuid) ||
        !sameJson(byDocument.get(uuid).searchAudit, packageCells.get(uuid))
    )
  )
    return null;

  const foundAtoms = relevantAtoms.filter(
    ({ evidencePresence }) => evidencePresence === "FOUND"
  );
  if (
    foundAtoms.length !== 1 ||
    !completeDefaultExclusionAtom(
      foundAtoms[0],
      requirementContract,
      expectedDocumentByUuid?.get(foundAtoms[0]?.documentUuids?.[0])
    ) ||
    relevantAtoms.some(
      (atom) =>
        atom !== foundAtoms[0] &&
        !cleanQualifiedNotFoundAtom(
          atom,
          requirementContract,
          expectedDocumentByUuid?.get(atom?.documentUuids?.[0])
        )
    )
  )
    return null;

  const foundDocumentUuid = foundAtoms[0].documentUuids[0];
  if (packageSummary.facts[0]?.documentUuid !== foundDocumentUuid) return null;
  const pagesByDocument = new Map();
  for (const component of audit.components) {
    if (
      !validCommonSearchCell(
        component,
        requirementContract,
        expectedDocumentByUuid?.get(component.documentUuid)
      ) ||
      pagesByDocument.has(component.documentUuid)
    )
      return null;
    pagesByDocument.set(component.documentUuid, component.physicalPagesChecked);
  }
  const physicalPagesChecked = [...pagesByDocument.values()].reduce(
    (sum, pages) => sum + pages,
    0
  );
  if (physicalPagesChecked !== audit.physicalPagesChecked) return null;

  const atomsProjection = projectedAtoms(relevantAtoms);
  const overrideAudits = audit.components
    .map(({ lw20DefaultExclusionOverrideAudit }) =>
      stableValue(lw20DefaultExclusionOverrideAudit)
    )
    .sort((left, right) =>
      left.document.uuid.localeCompare(right.document.uuid, "en")
    );
  return {
    side,
    documentUuids,
    physicalPagesChecked,
    foundDocumentUuid,
    packageFactCount: 1,
    packageFactsDigest: sha256(packageSummary.facts),
    searchAuditDigest: sha256(audit),
    overrideAuditCount: overrideAudits.length,
    overrideAuditsDigest: sha256(overrideAudits),
    projectedAtoms: atomsProjection,
    projectedAtomsDigest: sha256(atomsProjection),
  };
}

function packageRequirementContract(packageSummary) {
  return (
    packageSummary?.requirementContract ||
    packageSummary?.searchAudit?.requirementContract ||
    null
  );
}

function buildLw20AbsenceDefaultExclusionEqualityAudit({
  categoryId,
  packageA,
  packageB,
  atomsA,
  atomsB,
  requirementContractA = packageRequirementContract(packageA),
  requirementContractB = packageRequirementContract(packageB),
  expectedDocumentUuidsA,
  expectedDocumentUuidsB,
  expectedDocumentsA,
  expectedDocumentsB,
}) {
  if (
    categoryId !== CATEGORY_ID ||
    !validRequirementContract(requirementContractA) ||
    !sameJson(requirementContractA, requirementContractB)
  )
    return null;
  const absentSide = packageA?.evidenceFound === false ? "A" : "B";
  const excludedSide = absentSide === "A" ? "B" : "A";
  const absentPackage = absentSide === "A" ? packageA : packageB;
  const excludedPackage = excludedSide === "A" ? packageA : packageB;
  if (
    absentPackage?.evidenceFound !== false ||
    excludedPackage?.evidenceFound !== true
  )
    return null;
  const absentExpectedDocumentMap = expectedDocumentMap(
    absentSide === "A" ? expectedDocumentsA : expectedDocumentsB
  );
  if (absentExpectedDocumentMap === false) return null;
  const absentAtoms = absentSide === "A" ? atomsA : atomsB;
  const qualifiedAbsence = buildQualifiedAbsenceSideProjection({
    side: absentSide,
    categoryId,
    packageSummary: absentPackage,
    requirementContract: requirementContractA,
    atoms: absentAtoms,
    expectedDocumentUuids:
      absentSide === "A" ? expectedDocumentUuidsA : expectedDocumentUuidsB,
  });
  const exclusion = defaultExclusionSideProjection({
    side: excludedSide,
    packageSummary: excludedPackage,
    requirementContract: requirementContractA,
    atoms: excludedSide === "A" ? atomsA : atomsB,
    expectedDocumentUuids:
      excludedSide === "A" ? expectedDocumentUuidsA : expectedDocumentUuidsB,
    expectedDocuments:
      excludedSide === "A" ? expectedDocumentsA : expectedDocumentsB,
  });
  const absenceRelevantAtoms = (absentAtoms || []).filter(
    ({ requirementId }) => requirementId === CATEGORY_ID
  );
  if (
    !qualifiedAbsence ||
    !validAbsencePackageCells(
      absentPackage,
      requirementContractA,
      absentExpectedDocumentMap
    ) ||
    absenceRelevantAtoms.length !==
      absentPackage.searchAudit.components.length ||
    absenceRelevantAtoms.some(
      (atom) =>
        !cleanQualifiedNotFoundAtom(
          atom,
          requirementContractA,
          absentExpectedDocumentMap?.get(atom?.documentUuids?.[0])
        )
    ) ||
    !exclusion
  )
    return null;
  const absenceAtomsProjection = projectedAtoms(absenceRelevantAtoms);
  const absence = {
    ...qualifiedAbsence,
    projectedAtoms: absenceAtomsProjection,
    projectedAtomsDigest: sha256(absenceAtomsProjection),
  };

  const base = {
    schemaVersion: LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_AUDIT_SCHEMA_VERSION,
    contractId: LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_AUDIT_CONTRACT_ID,
    categoryId,
    absentSide,
    excludedSide,
    requirementContractDigest: requirementContractA.digest,
    componentSatisfactionPolicy: "ALL",
    declaredComponents: [{ id: COMPONENT_ID, factRole: FACT_ROLE }],
    absenceMeanings: ["COVERAGE_ONLY"],
    searchPlanIds: [SEARCH_PLAN_ID],
    searchContractDigest: sha256({
      requirementContract: requirementContractA,
      searchPlanIds: [SEARCH_PLAN_ID],
    }),
    absence,
    exclusion,
  };
  return {
    ...base,
    assessmentDigest: domainDigest(
      LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_AUDIT_CONTRACT_ID,
      base
    ),
  };
}

function validateLw20AbsenceDefaultExclusionEqualityAudit(audit, options) {
  const atomsA =
    audit?.excludedSide === "A"
      ? audit?.exclusion?.projectedAtoms
      : audit?.absence?.projectedAtoms;
  const atomsB =
    audit?.excludedSide === "B"
      ? audit?.exclusion?.projectedAtoms
      : audit?.absence?.projectedAtoms;
  const expected = buildLw20AbsenceDefaultExclusionEqualityAudit({
    ...options,
    atomsA,
    atomsB,
  });
  if (!expected)
    throw new Error("LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_NOT_QUALIFIED");
  if (!sameJson(audit, expected))
    throw new Error("LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_AUDIT_MISMATCH");
  return true;
}

function lw20AbsenceDefaultExclusionEqualityDecision(audit) {
  if (
    audit?.contractId !==
    LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_AUDIT_CONTRACT_ID
  )
    return null;
  return {
    schemaVersion: 6,
    outcome: "GLEICHWERTIG",
    reasonCode: LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_REASON_CODE,
    reason: `Gleichwertig: Polizze ${audit.absentSide} besitzt einen vollständig kontrollierten Nichtfund; Polizze ${audit.excludedSide} enthält einen paketweit nicht aufgehobenen Standardausschluss. In beiden Polizzen ist damit für LW-20 keine dokumentierte Deckung belegt. Der kontrollierte Nichtfund von Polizze ${audit.absentSide} wird dabei ausdrücklich nicht als Ausschluss dargestellt.`,
    reviewRequired: false,
    ruleId: LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_RULE_ID,
    comparisonTreatment: LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_TREATMENT,
    lw20AbsenceDefaultExclusionEqualityAudit: audit,
    dimensions: [],
  };
}

module.exports = {
  LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_AUDIT_CONTRACT_ID,
  LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_AUDIT_SCHEMA_VERSION,
  LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_REASON_CODE,
  LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_RULE_ID,
  LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_TREATMENT,
  buildLw20AbsenceDefaultExclusionEqualityAudit,
  lw20AbsenceDefaultExclusionEqualityDecision,
  validateLw20AbsenceDefaultExclusionEqualityAudit,
};
