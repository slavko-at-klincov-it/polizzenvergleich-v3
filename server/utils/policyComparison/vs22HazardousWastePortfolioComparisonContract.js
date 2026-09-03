const crypto = require("crypto");
const {
  PACKAGE_MEMBER,
  comparisonApplicability,
  comparisonFieldSignature,
  completeRawComparisonAtom,
  validSourceBinding,
} = require("./comparisonAtomCanonicalization");
const {
  cleanNotFoundAtom,
  validComponentTerminal,
} = require("./bilateralAbsenceContract");
const { hasOptionalCoverageSource } = require("./comparisonAtomSemantics");
const { derivePackageReviewAudit } = require("./packageReviewAudit");
const {
  applicabilityFor,
} = require("../policyAnalysis/preparedEvidenceContract");

const VS22_CATEGORY_ID = "VS-22";
const VS22_CATALOG_ID = "vs-occurrence-full-draft-v0.16";
const VS22_REQUIREMENT_CONTRACT_DIGEST =
  "7022516926810b8ca7f891566e03c72ebe274c4342541012ecf5480fe55ffadb";
const VS22_COMPONENTS = Object.freeze([
  Object.freeze({ id: "disposal_costs", factRole: "COST" }),
  Object.freeze({ id: "hazardous_waste", factRole: "INSURED_OBJECT" }),
  Object.freeze({ id: "hazardous_waste_cost_limit", factRole: "LIMIT" }),
]);
const VS22_HAZARDOUS_COMPONENT_IDS = Object.freeze([
  "hazardous_waste",
  "hazardous_waste_cost_limit",
]);
const VS22_HAZARDOUS_WASTE_PORTFOLIO_AUDIT_CONTRACT_ID =
  "VS22_HAZARDOUS_WASTE_PORTFOLIO_AUDIT_V2";
const VS22_HAZARDOUS_WASTE_PORTFOLIO_AUDIT_SCHEMA_VERSION = 2;
const VS22_HAZARDOUS_WASTE_PORTFOLIO_RULE_ID =
  "VS22_HAZARDOUS_WASTE_PORTFOLIO_ADVANTAGE_V1";
const VS22_HAZARDOUS_WASTE_PORTFOLIO_REASON_CODE =
  "INCLUDED_HAZARDOUS_WASTE_OVER_COMPLETE_CONTROLLED_ABSENCE";
const VS22_HAZARDOUS_WASTE_PORTFOLIO_TREATMENT =
  "VS22_HAZARDOUS_WASTE_INCLUDED_OVER_CONTROLLED_ABSENCE_V1";
const VS22_SOURCE_ATOM_DIGEST_REPLAY_CONTRACT_ID =
  "VS22_SOURCE_ATOM_DIGEST_REPLAY_V1";
const HAZARDOUS_WASTE_ANCHOR =
  /(?<!\p{L})(?:sondermüll|sonderabfall|problemstoff\p{L}*|gefährlich\p{L}*\s+abf(?:all|äll)\p{L}*)(?!\p{L})/iu;
const DOCUMENT_ROLES = new Set([
  "MAIN_POLICY",
  "SUPPLEMENT",
  "ENDORSEMENT",
  "TERMS",
  "OTHER",
]);
const DOCUMENT_STATUSES = new Set(["ACTIVE", "FRAMEWORK_TERMS", "PROPOSAL"]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function sameJson(left, right) {
  return (
    JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
  );
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function strings(values) {
  if (!Array.isArray(values)) return null;
  const normalized = values.map((value) => String(value || "").trim());
  if (normalized.some((value) => !value)) return null;
  const unique = [...new Set(normalized)].sort();
  return unique.length === normalized.length ? unique : null;
}

function exactVs22Contract(contract) {
  return Boolean(
    contract?.digest === VS22_REQUIREMENT_CONTRACT_DIGEST &&
      contract?.componentSatisfactionPolicy === "ALL" &&
      sameJson(contract?.components, VS22_COMPONENTS)
  );
}

function canonicalDocumentManifest(expectedDocuments, side) {
  if (!Array.isArray(expectedDocuments) || expectedDocuments.length === 0)
    return null;
  const manifest = expectedDocuments
    .map((document) => ({
      uuid: String(document?.uuid || "").trim(),
      sha256: String(document?.sha256 || "").trim(),
      side: String(document?.side || "").trim(),
      role: String(document?.role || "").trim(),
      documentStatus: String(document?.documentStatus || "").trim(),
    }))
    .sort((left, right) => left.uuid.localeCompare(right.uuid));
  if (
    manifest.some(
      (document) =>
        !document.uuid ||
        !/^[a-f0-9]{64}$/u.test(document.sha256) ||
        document.side !== side ||
        !DOCUMENT_ROLES.has(document.role) ||
        !DOCUMENT_STATUSES.has(document.documentStatus)
    ) ||
    new Set(manifest.map(({ uuid }) => uuid)).size !== manifest.length
  )
    return null;
  return manifest;
}

function searchMatrix(packageSummary, requirementContract, manifest) {
  const audit = packageSummary?.searchAudit;
  const documentUuids = manifest.map(({ uuid }) => uuid);
  const catalogIds = [
    ...new Set(
      (audit?.components || [])
        .map(({ catalogId }) => String(catalogId || "").trim())
        .filter(Boolean)
    ),
  ];
  const catalogId = catalogIds.length === 1 ? catalogIds[0] : null;
  const expectedSearchPlanIds = catalogId
    ? VS22_COMPONENTS.map(
        ({ id }) => `${catalogId}/${VS22_CATEGORY_ID}/${id}`
      ).sort()
    : null;
  const searchPlanIds = strings(audit?.searchPlanIds);
  if (
    !audit ||
    !sameJson(audit.requirementContract, requirementContract) ||
    audit.documentCount !== manifest.length ||
    !sameJson(strings(audit.documentUuids), documentUuids) ||
    catalogId !== VS22_CATALOG_ID ||
    !sameJson(searchPlanIds, expectedSearchPlanIds) ||
    !Number.isInteger(audit.physicalPagesChecked) ||
    audit.physicalPagesChecked < 1 ||
    !Array.isArray(audit.components) ||
    audit.components.length !== documentUuids.length * VS22_COMPONENTS.length
  )
    return null;

  const expectedPairs = new Set(
    documentUuids.flatMap((documentUuid) =>
      expectedSearchPlanIds.map(
        (searchPlanId) => `${documentUuid}\u0000${searchPlanId}`
      )
    )
  );
  const pagesPerDocument = new Map();
  for (const cell of audit.components) {
    const pair = `${cell?.documentUuid || ""}\u0000${cell?.searchPlanId || ""}`;
    if (
      !expectedPairs.delete(pair) ||
      !sameJson(cell?.requirementContract, requirementContract) ||
      cell?.catalogId !== catalogId ||
      cell?.absenceMeaning !== "COVERAGE_MIXED" ||
      cell?.negativeSearchPolicy !==
        "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1" ||
      !Number.isInteger(cell?.physicalPagesChecked) ||
      cell.physicalPagesChecked < 1 ||
      cell.physicalPagesChecked !== cell.totalPhysicalPages ||
      cell.gates?.negativeSearchApproved !== true ||
      cell.gates?.certifiedNegativeSearch !== false ||
      cell.gates?.completeTextExtraction !== true ||
      cell.gates?.completeCategoryTechnicalContract !== true
    )
      return null;
    if (!pagesPerDocument.has(cell.documentUuid))
      pagesPerDocument.set(cell.documentUuid, cell.physicalPagesChecked);
    else if (
      pagesPerDocument.get(cell.documentUuid) !== cell.physicalPagesChecked
    )
      return null;
  }
  if (
    expectedPairs.size !== 0 ||
    [...pagesPerDocument.values()].reduce((sum, pages) => sum + pages, 0) !==
      audit.physicalPagesChecked
  )
    return null;
  return {
    audit,
    catalogId,
    documentManifest: manifest,
    documentUuids,
    expectedSearchPlanIds,
  };
}

function atomMatrix(categoryId, atoms, matrix, requirementContract) {
  const relevant = (atoms || []).filter(
    (atom) => atom?.requirementId === categoryId
  );
  if (relevant.length !== matrix.audit.components.length) return null;
  const cells = new Map(
    matrix.audit.components.map((cell) => [
      `${cell.documentUuid}\u0000${cell.searchPlanId.split("/").at(-1)}`,
      cell,
    ])
  );
  const documents = new Map(
    matrix.documentManifest.map((document) => [document.uuid, document])
  );
  for (const atom of relevant) {
    const documentUuids = strings(atom?.documentUuids);
    const key = `${documentUuids?.[0] || ""}\u0000${atom?.componentId || ""}`;
    const cell = cells.get(key);
    const document = documents.get(documentUuids?.[0]);
    const declared = VS22_COMPONENTS.find(({ id }) => id === atom.componentId);
    if (
      !cell ||
      !document ||
      documentUuids?.length !== 1 ||
      !declared ||
      atom.factRole !== declared.factRole ||
      atom.requirementContractDigest !== requirementContract.digest ||
      atom.componentSatisfactionPolicy !== "ALL" ||
      atom.documentRole !== document.role ||
      atom.documentStatus !== document.documentStatus ||
      atom.documentApplicability !==
        applicabilityFor(document.documentStatus, atom.evidencePresence) ||
      !sameJson(atom.declaredComponents, requirementContract.components) ||
      !sameJson(atom.searchAudit, cell)
    )
      return null;
    cells.delete(key);
  }
  return cells.size === 0 ? relevant : null;
}

function cleanControlledAbsence(atom) {
  const cell = atom?.searchAudit;
  return Boolean(
    cleanNotFoundAtom(atom) &&
      cell?.disposition === "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH" &&
      cell?.comparisonTreatment === "DOCUMENTATION_ONLY_V1" &&
      cell?.gates?.serverNegativeTerminal === true &&
      validComponentTerminal(cell, VS22_CATEGORY_ID)
  );
}

function validBoundPage(physicalPageNumber, totalPhysicalPages) {
  return Boolean(
    Number.isInteger(physicalPageNumber) &&
      physicalPageNumber > 0 &&
      Number.isInteger(totalPhysicalPages) &&
      physicalPageNumber <= totalPhysicalPages
  );
}

function sourceHasHazardousWasteAnchor(source) {
  return HAZARDOUS_WASTE_ANCHOR.test(
    `${source?.exactText || ""}\n${source?.conditionCheckText || ""}`
  );
}

function sourceHasDirectHazardousWasteBinding(source) {
  return Boolean(
    source?.candidateBinding === "DIRECT" &&
      source?.deterministicBindingBasis === "EXPLICIT_HAZARDOUS_WASTE_COSTS"
  );
}

function validAtomSourcePages(atom) {
  const totalPhysicalPages = atom?.searchAudit?.totalPhysicalPages;
  return Boolean(
    Array.isArray(atom?.sources) &&
      atom.sources.length > 0 &&
      atom.sources.every(({ physicalPageNumber }) =>
        validBoundPage(physicalPageNumber, totalPhysicalPages)
      ) &&
      (atom.fields || []).every(({ facts }) =>
        (facts || []).every(({ source }) =>
          validBoundPage(source?.physicalPageNumber, totalPhysicalPages)
        )
      )
  );
}

function hazardousFieldSourcesMatchCandidates(atom) {
  const sources = new Map(
    (atom?.sources || []).map((source) => [source.candidateId, source])
  );
  return (atom?.fields || []).every(({ facts }) =>
    (facts || []).every(({ source: fieldSource }) => {
      const candidateSource = sources.get(fieldSource?.candidateId);
      return Boolean(
        candidateSource &&
          candidateSource.physicalPageNumber ===
            fieldSource.physicalPageNumber &&
          sourceHasHazardousWasteAnchor(candidateSource)
      );
    })
  );
}

function safeHazardousCoverageAtom(atom) {
  const fields = atom?.fields || [];
  return Boolean(
    atom?.componentId === "hazardous_waste" &&
      atom?.evidencePresence === "FOUND" &&
      atom.coverageEffect === "INCLUDED" &&
      atom.conflictState === "NONE" &&
      atom.selectedScopePicture === "GENERAL" &&
      (atom.unresolvedCandidateIds || []).length === 0 &&
      comparisonApplicability(atom) === PACKAGE_MEMBER &&
      validSourceBinding(atom) &&
      validAtomSourcePages(atom) &&
      atom.sources.every(sourceHasHazardousWasteAnchor) &&
      !hasOptionalCoverageSource(atom) &&
      sameJson(atom.requestedFields, ["limit"]) &&
      sameJson(atom.optionalFields, []) &&
      ["NOT_FOUND", "NOT_EVALUATED"].includes(atom.requestedFieldStatus) &&
      fields.length === 1 &&
      fields[0]?.field === "limit" &&
      fields[0]?.status === "NOT_FOUND" &&
      Array.isArray(fields[0]?.facts) &&
      fields[0].facts.length === 0
  );
}

function safeHazardousLimitAtom(atom) {
  const fields = comparisonFieldSignature(atom);
  return Boolean(
    atom?.componentId === "hazardous_waste_cost_limit" &&
      atom.evidencePresence === "FOUND" &&
      atom.coverageEffect === "DEFINED" &&
      atom.conflictState === "NONE" &&
      atom.selectedScopePicture === "GENERAL" &&
      (atom.unresolvedCandidateIds || []).length === 0 &&
      comparisonApplicability(atom) === PACKAGE_MEMBER &&
      completeRawComparisonAtom(atom) &&
      validAtomSourcePages(atom) &&
      atom.sources.every(sourceHasHazardousWasteAnchor) &&
      atom.sources.every(sourceHasDirectHazardousWasteBinding) &&
      hazardousFieldSourcesMatchCandidates(atom) &&
      !hasOptionalCoverageSource(atom) &&
      fields.length > 0 &&
      fields.every(
        ({ field, fieldStatus, value, valueType, unit, limitKind }) =>
          field === "limit" &&
          fieldStatus === "FOUND" &&
          String(value || "") &&
          ["MONEY", "PERCENT"].includes(valueType) &&
          ((valueType === "MONEY" && unit === "EUR") ||
            (valueType === "PERCENT" && unit === "%")) &&
          limitKind === "CAPPED"
      )
  );
}

function safeDisposalContributor(atom) {
  const fields = atom?.fields || [];
  const fieldStateValid =
    (atom?.requestedFieldStatus === "COMPLETE" &&
      comparisonFieldSignature(atom).length > 0) ||
    (["NOT_FOUND", "NOT_EVALUATED"].includes(atom?.requestedFieldStatus) &&
      fields.length === 1 &&
      fields[0]?.field === "limit" &&
      fields[0]?.status === "NOT_FOUND" &&
      Array.isArray(fields[0]?.facts) &&
      fields[0].facts.length === 0);
  return Boolean(
    atom?.componentId === "disposal_costs" &&
      atom.evidencePresence === "FOUND" &&
      atom.coverageEffect === "INCLUDED" &&
      atom.conflictState === "NONE" &&
      atom.selectedScopePicture === "GENERAL" &&
      (atom.unresolvedCandidateIds || []).length === 0 &&
      comparisonApplicability(atom) === PACKAGE_MEMBER &&
      validSourceBinding(atom) &&
      validAtomSourcePages(atom) &&
      !hasOptionalCoverageSource(atom) &&
      sameJson(atom.requestedFields, ["limit"]) &&
      sameJson(atom.optionalFields, []) &&
      fieldStateValid
  );
}

function projectedAtoms(atoms) {
  return atoms
    .map((atom) => stableValue(atom))
    .sort((left, right) =>
      `${left.documentUuids?.[0] || ""}\u0000${left.componentId || ""}`.localeCompare(
        `${right.documentUuids?.[0] || ""}\u0000${right.componentId || ""}`
      )
    );
}

function buildVs22SourceAtomDigestReplay({ categoryId, atomsA, atomsB }) {
  if (
    categoryId !== VS22_CATEGORY_ID ||
    !Array.isArray(atomsA) ||
    !Array.isArray(atomsB)
  )
    return null;
  const body = {
    schemaVersion: 1,
    contractId: VS22_SOURCE_ATOM_DIGEST_REPLAY_CONTRACT_ID,
    categoryId,
    sourceAtomDigestsSha256: {
      A: sha256(projectedAtoms(atomsA)),
      B: sha256(projectedAtoms(atomsB)),
    },
  };
  return { ...body, replayDigestSha256: sha256(body) };
}

function validVs22SourceAtomDigestReplay(replay) {
  if (
    replay?.schemaVersion !== 1 ||
    replay?.contractId !== VS22_SOURCE_ATOM_DIGEST_REPLAY_CONTRACT_ID ||
    replay?.categoryId !== VS22_CATEGORY_ID ||
    !/^[a-f0-9]{64}$/u.test(replay?.sourceAtomDigestsSha256?.A || "") ||
    !/^[a-f0-9]{64}$/u.test(replay?.sourceAtomDigestsSha256?.B || "")
  )
    return false;
  const { replayDigestSha256, ...body } = replay;
  return replayDigestSha256 === sha256(body);
}

function atomProof(atom) {
  return stableValue({
    componentId: atom.componentId,
    factRole: atom.factRole,
    documentUuids: strings(atom.documentUuids),
    selectedCandidateIds: strings(atom.selectedCandidateIds),
    documentStatus: atom.documentStatus,
    documentApplicability: atom.documentApplicability,
    comparisonApplicability: comparisonApplicability(atom),
    selectedScopePicture: atom.selectedScopePicture,
    fields: comparisonFieldSignature(atom),
    sources: (atom.sources || []).map(
      ({ candidateId, physicalPageNumber, exactText }) => ({
        candidateId,
        physicalPageNumber,
        exactText,
      })
    ),
  });
}

function absenceProof(atom) {
  const audit = atom.searchAudit?.terminalRejectionAudit;
  return stableValue({
    componentId: atom.componentId,
    documentUuid: atom.documentUuids[0],
    disposition: atom.searchAudit.disposition,
    searchPlanId: atom.searchAudit.searchPlanId,
    physicalPagesChecked: atom.searchAudit.physicalPagesChecked,
    terminalContractId: audit?.contractId || null,
    terminalRejectionDigestSha256: audit?.rejectionDigestSha256 || null,
    zeroOccurrenceTerminal: atom.searchAudit.gates.zeroOccurrenceTerminal,
    zeroCandidateTerminal: atom.searchAudit.gates.zeroCandidateTerminal,
  });
}

function sideAssessment({
  side,
  categoryId,
  packageSummary,
  atoms,
  requirementContract,
  expectedDocuments,
  mode,
}) {
  const manifest = canonicalDocumentManifest(expectedDocuments, side);
  const matrix = manifest
    ? searchMatrix(packageSummary, requirementContract, manifest)
    : null;
  const relevant = matrix
    ? atomMatrix(categoryId, atoms, matrix, requirementContract)
    : null;
  if (!manifest || !matrix || !relevant) return null;
  if (
    relevant.some(
      (atom) =>
        atom.conflictState !== "NONE" ||
        atom.coverageEffect === "EXCLUDED" ||
        (atom.unresolvedCandidateIds || []).length > 0
    )
  )
    return null;

  const byComponent = Object.fromEntries(
    VS22_COMPONENTS.map(({ id }) => [
      id,
      relevant.filter((atom) => atom.componentId === id),
    ])
  );
  const includedDisposal = byComponent.disposal_costs.filter(
    safeDisposalContributor
  );
  if (
    includedDisposal.length === 0 ||
    byComponent.disposal_costs.some((atom) =>
      atom.evidencePresence === "FOUND"
        ? !safeDisposalContributor(atom)
        : !cleanControlledAbsence(atom)
    )
  )
    return null;
  const atomProjection = projectedAtoms(relevant);

  if (mode === "INCLUDED") {
    const hazardousWaste = byComponent.hazardous_waste.filter(
      safeHazardousCoverageAtom
    );
    const hazardousLimit = byComponent.hazardous_waste_cost_limit.filter(
      safeHazardousLimitAtom
    );
    if (
      packageSummary?.reviewStatus !== "BELEGT" ||
      hazardousWaste.length === 0 ||
      hazardousLimit.length === 0 ||
      byComponent.hazardous_waste.some(
        (atom) =>
          atom.evidencePresence === "FOUND" && !safeHazardousCoverageAtom(atom)
      ) ||
      byComponent.hazardous_waste_cost_limit.some(
        (atom) =>
          atom.evidencePresence === "FOUND" && !safeHazardousLimitAtom(atom)
      ) ||
      [
        ...byComponent.hazardous_waste,
        ...byComponent.hazardous_waste_cost_limit,
      ].some(
        (atom) =>
          atom.evidencePresence === "NOT_FOUND" && !cleanControlledAbsence(atom)
      )
    )
      return null;
    return {
      status: "HAZARDOUS_WASTE_INCLUDED_WITH_LIMIT",
      documentManifest: manifest,
      disposalProofs: includedDisposal.map(atomProof),
      hazardousWasteProofs: hazardousWaste.map(atomProof),
      hazardousWasteLimitProofs: hazardousLimit.map(atomProof),
      projectedAtoms: atomProjection,
      projectedAtomsDigestSha256: sha256(atomProjection),
    };
  }

  const hazardousAtoms = VS22_HAZARDOUS_COMPONENT_IDS.flatMap(
    (componentId) => byComponent[componentId]
  );
  if (
    packageSummary?.reviewStatus !== "TEILBELEGT" ||
    hazardousAtoms.length !== manifest.length * 2 ||
    hazardousAtoms.some((atom) => !cleanControlledAbsence(atom))
  )
    return null;
  return {
    status: "GENERAL_DISPOSAL_INCLUDED_HAZARDOUS_WASTE_CONTROLLED_ABSENT",
    documentManifest: manifest,
    disposalProofs: includedDisposal.map(atomProof),
    hazardousAbsenceProofs: hazardousAtoms.map(absenceProof),
    projectedAtoms: atomProjection,
    projectedAtomsDigestSha256: sha256(atomProjection),
  };
}

function packageReviewAllowsVs22Decision({
  categoryId,
  packageA,
  packageB,
  atomsA,
  atomsB,
  absentSide,
}) {
  const audit = derivePackageReviewAudit({
    categoryId,
    packageA,
    packageB,
    atomsA,
    atomsB,
  });
  if (!audit || !Array.isArray(audit.blockers) || audit.blockers.length < 2)
    return false;
  const missing = new Set();
  for (const blocker of audit.blockers) {
    if (blocker.side !== absentSide || blocker.requirementId !== categoryId)
      return false;
    if (
      blocker.code === "MISSING_REQUIRED_COMPONENT" &&
      VS22_HAZARDOUS_COMPONENT_IDS.includes(blocker.componentId)
    ) {
      missing.add(blocker.componentId);
      continue;
    }
    if (
      blocker.code === "FIELD_INCOMPLETE" &&
      blocker.level === "REQUIREMENT" &&
      blocker.componentId === null
    )
      continue;
    if (
      blocker.code === "MULTIPLE_ATOMS_SAME_COMPONENT" &&
      blocker.componentId === "disposal_costs"
    )
      continue;
    return false;
  }
  return sameJson(
    [...missing].sort(),
    [...VS22_HAZARDOUS_COMPONENT_IDS].sort()
  );
}

function buildVs22HazardousWastePortfolioAudit({
  categoryId,
  packageA,
  packageB,
  atomsA,
  atomsB,
  requirementContractA,
  requirementContractB,
  expectedDocumentsA,
  expectedDocumentsB,
}) {
  if (
    categoryId !== VS22_CATEGORY_ID ||
    !exactVs22Contract(requirementContractA) ||
    !sameJson(requirementContractA, requirementContractB)
  )
    return null;
  const inputs = {
    A: {
      side: "A",
      categoryId,
      packageSummary: packageA,
      atoms: atomsA,
      requirementContract: requirementContractA,
      expectedDocuments: expectedDocumentsA,
    },
    B: {
      side: "B",
      categoryId,
      packageSummary: packageB,
      atoms: atomsB,
      requirementContract: requirementContractB,
      expectedDocuments: expectedDocumentsB,
    },
  };
  let winner;
  let absentSide;
  let included;
  let absent;
  for (const [candidateWinner, candidateAbsent] of [
    ["A", "B"],
    ["B", "A"],
  ]) {
    const candidateIncluded = sideAssessment({
      ...inputs[candidateWinner],
      mode: "INCLUDED",
    });
    const candidateAbsence = sideAssessment({
      ...inputs[candidateAbsent],
      mode: "ABSENT",
    });
    if (!candidateIncluded || !candidateAbsence) continue;
    if (winner) return null;
    winner = candidateWinner;
    absentSide = candidateAbsent;
    included = candidateIncluded;
    absent = candidateAbsence;
  }
  if (
    !winner ||
    !packageReviewAllowsVs22Decision({
      categoryId,
      packageA,
      packageB,
      atomsA,
      atomsB,
      absentSide,
    })
  )
    return null;
  const body = {
    schemaVersion: VS22_HAZARDOUS_WASTE_PORTFOLIO_AUDIT_SCHEMA_VERSION,
    contractId: VS22_HAZARDOUS_WASTE_PORTFOLIO_AUDIT_CONTRACT_ID,
    categoryId,
    catalogId: VS22_CATALOG_ID,
    requirementContractDigest: requirementContractA.digest,
    componentSatisfactionPolicy: "ALL",
    declaredComponents: VS22_COMPONENTS,
    winner,
    absentSide,
    missingComponentIds: VS22_HAZARDOUS_COMPONENT_IDS,
    comparisonTreatment: VS22_HAZARDOUS_WASTE_PORTFOLIO_TREATMENT,
    sides: { [winner]: included, [absentSide]: absent },
  };
  return { ...body, assessmentDigestSha256: sha256(body) };
}

function vs22HazardousWastePortfolioDecision(audit) {
  const winner = audit.winner;
  const absentSide = audit.absentSide;
  return {
    schemaVersion: 7,
    outcome: winner === "A" ? "VORTEIL_A" : "VORTEIL_B",
    reasonCode: VS22_HAZARDOUS_WASTE_PORTFOLIO_REASON_CODE,
    reason: `Vorteil Polizze ${winner}: Polizze ${winner} enthält belegten zusätzlichen Schutz für Sondermüll beziehungsweise gefährlichen Abfall mit zugeordnetem Limit. In Polizze ${absentSide} wurde nach vollständiger kontrollierter Prüfung aller bereitgestellten Paketdokumente keine entsprechende Sondermüllregelung gefunden. Damit ist dieser Schutz für den Vergleich in Polizze ${winner} enthalten und in Polizze ${absentSide} nicht enthalten; ein ausdrücklicher Ausschluss oder ein Null-Euro-Limit in Polizze ${absentSide} wird nicht behauptet.`,
    reviewRequired: false,
    ruleId: VS22_HAZARDOUS_WASTE_PORTFOLIO_RULE_ID,
    comparisonTreatment: VS22_HAZARDOUS_WASTE_PORTFOLIO_TREATMENT,
    vs22HazardousWastePortfolioAudit: audit,
    dimensions: [],
  };
}

function validateVs22HazardousWastePortfolioAudit(audit, options) {
  const externalAtomsProvided = Boolean(
    Array.isArray(options?.atomsA) && Array.isArray(options?.atomsB)
  );
  const externalReplay = externalAtomsProvided
    ? buildVs22SourceAtomDigestReplay({
        categoryId: options.categoryId,
        atomsA: options.atomsA,
        atomsB: options.atomsB,
      })
    : options?.sourceAtomDigestReplay;
  if (!validVs22SourceAtomDigestReplay(externalReplay))
    throw new Error("VS22_SOURCE_ATOM_DIGEST_REPLAY_REQUIRED");
  if (
    audit?.sides?.A?.projectedAtomsDigestSha256 !==
      externalReplay.sourceAtomDigestsSha256.A ||
    audit?.sides?.B?.projectedAtomsDigestSha256 !==
      externalReplay.sourceAtomDigestsSha256.B
  )
    throw new Error("VS22_SOURCE_ATOM_DIGEST_REPLAY_MISMATCH");
  const expected = buildVs22HazardousWastePortfolioAudit({
    ...options,
    atomsA: externalAtomsProvided
      ? options.atomsA
      : audit?.sides?.A?.projectedAtoms,
    atomsB: externalAtomsProvided
      ? options.atomsB
      : audit?.sides?.B?.projectedAtoms,
  });
  if (!expected)
    throw new Error("VS22_HAZARDOUS_WASTE_PORTFOLIO_NOT_QUALIFIED");
  if (!sameJson(audit, expected))
    throw new Error("VS22_HAZARDOUS_WASTE_PORTFOLIO_AUDIT_MISMATCH");
  return true;
}

module.exports = {
  VS22_HAZARDOUS_WASTE_PORTFOLIO_AUDIT_CONTRACT_ID,
  VS22_HAZARDOUS_WASTE_PORTFOLIO_AUDIT_SCHEMA_VERSION,
  VS22_HAZARDOUS_WASTE_PORTFOLIO_REASON_CODE,
  VS22_HAZARDOUS_WASTE_PORTFOLIO_RULE_ID,
  VS22_HAZARDOUS_WASTE_PORTFOLIO_TREATMENT,
  VS22_REQUIREMENT_CONTRACT_DIGEST,
  VS22_SOURCE_ATOM_DIGEST_REPLAY_CONTRACT_ID,
  buildVs22HazardousWastePortfolioAudit,
  buildVs22SourceAtomDigestReplay,
  validateVs22HazardousWastePortfolioAudit,
  vs22HazardousWastePortfolioDecision,
};
