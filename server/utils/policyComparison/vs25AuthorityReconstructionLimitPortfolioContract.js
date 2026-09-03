const crypto = require("crypto");
const {
  PACKAGE_MEMBER,
  comparisonApplicability,
  comparisonFieldSignature,
} = require("./comparisonAtomCanonicalization");
const {
  DETERMINISTIC_VS25_SUM_EQUALIZATION_TERMINAL_CONTRACT_ID,
  TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
  VS25_SUM_EQUALIZATION_DECISION_BASIS,
  terminalRejectionSetDigest,
} = require("../policyAnalysis/deterministicTerminalRejectionContract");

const VS25_CATEGORY_ID = "VS-25";
const VS25_COST_COMPONENT_ID = "authority_reconstruction_extra_costs";
const VS25_LIMIT_COMPONENT_ID = "authority_reconstruction_extra_cost_limit";
const VS25_REQUIREMENT_CONTRACT_DIGEST_SHA256 =
  "82d04fb0134a057ba083fef5d798340fb92106899a0b58cf022323b660208bb2";
const VS25_AUTHORITY_LIMIT_PORTFOLIO_AUDIT_CONTRACT_ID =
  "VS25_AUTHORITY_RECONSTRUCTION_LIMIT_PORTFOLIO_AUDIT_V1";
const VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID =
  "VS25_HIGHER_BUILDING_VALUE_PERCENT_LIMIT_V1";
const VS25_HIGHER_RELATIVE_LIMIT_REASON_CODE =
  "HIGHER_AUTHORITY_RECONSTRUCTION_RELATIVE_LIMIT";
const VS25_EQUAL_RELATIVE_LIMIT_REASON_CODE =
  "EQUAL_AUTHORITY_RECONSTRUCTION_RELATIVE_LIMIT";
const VS25_RECONCILIATION_CONTRACT_ID =
  "VS25_NBW_PERCENT_CURRENCY_RECONCILIATION_AUDIT_V1";
const VS25_SOURCE_ATOM_DIGEST_REPLAY_CONTRACT_ID =
  "VS25_SOURCE_REFERENCE_ATOM_DIGEST_REPLAY_V1";
const VS01_COMPONENT_ID = "replacement_new_value";
const EXPECTED_COMPONENTS = Object.freeze([
  { id: VS25_COST_COMPONENT_ID, factRole: "COST" },
  { id: VS25_LIMIT_COMPONENT_ID, factRole: "LIMIT" },
]);
const LOCAL_CONDITION_MARKER =
  /\b(?:nur\s+wenn|sofern|soweit|falls|vorausgesetzt|vorbehaltlich|optional|wahlweise|gegen\s+(?:Mehrpr[aä]mie|Mehrbeitrag|Pr[aä]mienzuschlag)|gesondert(?:e|en|er|es)?\s+Vereinbarung)\b/iu;
const PREFIX_CONDITION_MARKER =
  /\b(?:nur\s+wenn|sofern|falls|vorausgesetzt|vorbehaltlich|optional|wahlweise|gegen\s+(?:Mehrpr[aä]mie|Mehrbeitrag|Pr[aä]mienzuschlag)|gesondert(?:e|en|er|es)?\s+Vereinbarung)\b[^.!?;\n]{0,160}$/iu;

function strings(values) {
  return [...new Set((values || []).map(String).filter(Boolean))].sort();
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

function projectedAtoms(atoms, requirementId) {
  return (atoms || [])
    .filter((atom) => atom?.requirementId === requirementId)
    .map((atom) => JSON.parse(JSON.stringify(atom)))
    .sort((left, right) =>
      JSON.stringify(stableValue(left)).localeCompare(
        JSON.stringify(stableValue(right)),
        "de-AT"
      )
    );
}

function buildVs25SourceAtomDigestReplay({
  categoryId,
  atomsA,
  atomsB,
  referenceAtomsA,
  referenceAtomsB,
  expectedDocumentsA,
  expectedDocumentsB,
}) {
  if (categoryId !== VS25_CATEGORY_ID) return null;
  const projections = {
    A: {
      targetAtoms: projectedAtoms(atomsA, VS25_CATEGORY_ID),
      referenceAtoms: projectedAtoms(referenceAtomsA, "VS-01"),
      documents: expectedDocumentsForSide(expectedDocumentsA, "A"),
    },
    B: {
      targetAtoms: projectedAtoms(atomsB, VS25_CATEGORY_ID),
      referenceAtoms: projectedAtoms(referenceAtomsB, "VS-01"),
      documents: expectedDocumentsForSide(expectedDocumentsB, "B"),
    },
  };
  if (
    projections.A.targetAtoms.length === 0 ||
    projections.B.targetAtoms.length === 0 ||
    projections.A.referenceAtoms.length === 0 ||
    projections.B.referenceAtoms.length === 0 ||
    !projections.A.documents ||
    !projections.B.documents
  )
    return null;
  return {
    schemaVersion: 1,
    contractId: VS25_SOURCE_ATOM_DIGEST_REPLAY_CONTRACT_ID,
    categoryId: VS25_CATEGORY_ID,
    sourceAtomDigestsSha256: {
      A: {
        targetAtoms: sha256(projections.A.targetAtoms),
        referenceAtoms: sha256(projections.A.referenceAtoms),
        documents: sha256(projections.A.documents),
      },
      B: {
        targetAtoms: sha256(projections.B.targetAtoms),
        referenceAtoms: sha256(projections.B.referenceAtoms),
        documents: sha256(projections.B.documents),
      },
    },
  };
}

function exactRequirementContract(contract) {
  return Boolean(
    contract?.digest === VS25_REQUIREMENT_CONTRACT_DIGEST_SHA256 &&
      contract?.componentSatisfactionPolicy === "ALL" &&
      JSON.stringify(contract?.components) ===
        JSON.stringify(EXPECTED_COMPONENTS)
  );
}

function expectedDocumentsForSide(expectedDocuments, side) {
  if (!Array.isArray(expectedDocuments) || expectedDocuments.length === 0)
    return null;
  const documents = expectedDocuments.map(
    ({
      uuid,
      side: documentSide,
      role,
      documentStatus,
      sha256: documentSha,
    }) => ({
      uuid: String(uuid || ""),
      side: String(documentSide || ""),
      role: String(role || ""),
      documentStatus: String(documentStatus || ""),
      sha256: String(documentSha || ""),
    })
  );
  if (
    documents.some(
      (document) =>
        !document.uuid ||
        document.side !== side ||
        !document.role ||
        !document.documentStatus ||
        !/^[a-f0-9]{64}$/u.test(document.sha256)
    ) ||
    strings(documents.map(({ uuid }) => uuid)).length !== documents.length
  )
    return null;
  return documents.sort((left, right) => left.uuid.localeCompare(right.uuid));
}

function sourceBindingValid(atom) {
  return Boolean(
    Array.isArray(atom?.selectedCandidateIds) &&
      atom.selectedCandidateIds.length > 0 &&
      atom.selectedCandidateIds.every((candidateId) =>
        atom.sources?.some(
          (source) =>
            source.candidateId === candidateId &&
            Number.isInteger(source.physicalPageNumber) &&
            source.physicalPageNumber > 0 &&
            String(source.exactText || "").trim().length > 0 &&
            String(source.conditionCheckText || "").trim().length > 0
        )
      )
  );
}

function localSourceWindow(source) {
  const text = String(source?.conditionCheckText || "");
  const exactText = String(source?.exactText || "");
  const index = text.indexOf(exactText);
  if (index < 0) return null;
  const prefix = text.slice(Math.max(0, index - 180), index);
  const localPrefix = prefix.slice(
    Math.max(
      prefix.lastIndexOf("."),
      prefix.lastIndexOf(";"),
      prefix.lastIndexOf("\n")
    ) + 1
  );
  return { fromAnchor: text.slice(index), prefix: localPrefix };
}

function sourceSemanticsValid(atom) {
  if (!sourceBindingValid(atom)) return false;
  return atom.sources.every((source) => {
    const local = localSourceWindow(source);
    return (
      local &&
      /(?:behördliche\s+Mehrkosten|Mehrkosten\s+(?:durch|infolge)\s+behördliche[rs]?\s+Auflagen|Mehrkosten\s+für\s+bauliche\s+Verbesserungen)/iu.test(
        source.exactText
      ) &&
      !LOCAL_CONDITION_MARKER.test(local.fromAnchor) &&
      !PREFIX_CONDITION_MARKER.test(local.prefix)
    );
  });
}

function exactAtomContract(atom, expectedDocument, componentId, factRole) {
  return Boolean(
    atom?.requirementId === VS25_CATEGORY_ID &&
      atom?.componentId === componentId &&
      atom?.factRole === factRole &&
      atom?.componentSatisfactionPolicy === "ALL" &&
      atom?.scopePolicy === "GENERAL_REQUIRED" &&
      atom?.requirementContractDigest ===
        VS25_REQUIREMENT_CONTRACT_DIGEST_SHA256 &&
      JSON.stringify(atom?.declaredComponents) ===
        JSON.stringify(EXPECTED_COMPONENTS) &&
      JSON.stringify(atom?.documentUuids) ===
        JSON.stringify([expectedDocument.uuid]) &&
      atom?.documentRole === expectedDocument.role &&
      atom?.documentStatus === expectedDocument.documentStatus &&
      atom?.conflictState === "NONE" &&
      (atom?.unresolvedCandidateIds || []).length === 0
  );
}

function exactAbsentAtom(atom, expectedDocument, componentId, factRole) {
  const searchAudit = atom?.searchAudit;
  const controlledAbsence =
    searchAudit?.disposition === "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH" &&
    searchAudit?.comparisonTreatment === "DOCUMENTATION_ONLY_V1" &&
    searchAudit?.gates?.certifiedNegativeSearch === false;
  const certifiedAbsence =
    searchAudit?.disposition === "VERIFIED_NOT_FOUND" &&
    searchAudit?.comparisonTreatment === "ASSUMED_NOT_INCLUDED_V1" &&
    searchAudit?.gates?.certifiedNegativeSearch === true;
  const terminalAudit = searchAudit?.terminalRejectionAudit;
  const deterministicSumEqualizationTerminal = Boolean(
    searchAudit?.gates?.deterministicVs25SumEqualizationTerminal === true &&
      terminalAudit?.schemaVersion === 3 &&
      terminalAudit?.contractId ===
        DETERMINISTIC_VS25_SUM_EQUALIZATION_TERMINAL_CONTRACT_ID &&
      terminalAudit?.requirementId === VS25_CATEGORY_ID &&
      terminalAudit?.componentId === componentId &&
      terminalAudit?.decisionOwner === "SERVER" &&
      terminalAudit?.decisionBasis === VS25_SUM_EQUALIZATION_DECISION_BASIS &&
      terminalAudit?.proofMode ===
        "ALL_OCCURRENCES_DETERMINISTICALLY_PURE_SUM_EQUALIZATION_ALLOCATIONS" &&
      terminalAudit?.rejectionDigestContractId ===
        TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID &&
      Array.isArray(terminalAudit?.rejections) &&
      terminalAudit.rejections.length > 0 &&
      terminalAudit.rejectedOccurrenceCount ===
        terminalAudit.rejections.length &&
      sameJson(
        terminalAudit.rejectedCandidateIds,
        strings(terminalAudit.rejections.map(({ candidateId }) => candidateId))
      ) &&
      terminalAudit.rejections.every(
        (rejection) =>
          rejection?.terminalRejectionContractId ===
            DETERMINISTIC_VS25_SUM_EQUALIZATION_TERMINAL_CONTRACT_ID &&
          rejection?.occurrenceDigestContractId ===
            "TERMINAL_OCCURRENCE_PROVENANCE_V3" &&
          rejection?.decisionBasis === VS25_SUM_EQUALIZATION_DECISION_BASIS &&
          rejection?.decisionOwner === undefined &&
          /^[a-f0-9]{64}$/u.test(rejection?.occurrenceDigestSha256 || "") &&
          Number.isInteger(rejection?.physicalPageNumber) &&
          rejection.physicalPageNumber > 0 &&
          rejection.physicalPageNumber <= searchAudit.totalPhysicalPages &&
          rejection?.sectionScopeSource === "OCCURRENCE_LOCAL_CLAUSE" &&
          sameJson(rejection?.observedScopeKeys, []) &&
          rejection?.scopeProofMode ===
            "VS25_LOCAL_SUM_EQUALIZATION_ALLOCATION_V1"
      ) &&
      terminalAudit.rejectionDigestSha256 ===
        terminalRejectionSetDigest(terminalAudit.rejections)
  );
  const zeroTerminal = Boolean(
    searchAudit?.gates?.zeroOccurrenceTerminal === true &&
      searchAudit?.gates?.zeroCandidateTerminal === true &&
      terminalAudit === undefined
  );
  if (
    deterministicSumEqualizationTerminal &&
    (searchAudit?.gates?.zeroOccurrenceTerminal !== false ||
      searchAudit?.gates?.zeroCandidateTerminal !== false)
  )
    return false;
  return Boolean(
    exactAtomContract(atom, expectedDocument, componentId, factRole) &&
      atom?.evidencePresence === "NOT_FOUND" &&
      atom?.coverageEffect === "UNKNOWN" &&
      atom?.selectedScopePicture === "UNKNOWN" &&
      (atom?.selectedCandidateIds || []).length === 0 &&
      (atom?.sources || []).length === 0 &&
      searchAudit?.documentUuid === expectedDocument.uuid &&
      String(searchAudit?.searchPlanId || "").endsWith(`/${componentId}`) &&
      exactRequirementContract(searchAudit?.requirementContract) &&
      (controlledAbsence || certifiedAbsence) &&
      Number.isInteger(searchAudit?.physicalPagesChecked) &&
      searchAudit.physicalPagesChecked > 0 &&
      searchAudit.physicalPagesChecked === searchAudit.totalPhysicalPages &&
      searchAudit?.gates?.negativeSearchApproved === true &&
      searchAudit?.gates?.completeTextExtraction === true &&
      searchAudit?.gates?.completeCategoryTechnicalContract === true &&
      (zeroTerminal || deterministicSumEqualizationTerminal) &&
      searchAudit?.gates?.serverNegativeTerminal === true
  );
}

function exactFoundCostAtom(atom, expectedDocument) {
  return Boolean(
    exactAtomContract(atom, expectedDocument, VS25_COST_COMPONENT_ID, "COST") &&
      atom?.evidencePresence === "FOUND" &&
      atom?.coverageEffect === "INCLUDED" &&
      atom?.selectedScopePicture === "GENERAL" &&
      comparisonApplicability(atom) === PACKAGE_MEMBER &&
      atom?.requestedFieldStatus === "NOT_FOUND" &&
      Array.isArray(atom?.fields) &&
      atom.fields.length === 1 &&
      atom.fields[0]?.field === "limit" &&
      atom.fields[0]?.status === "NOT_FOUND" &&
      (atom.fields[0]?.facts || []).length === 0 &&
      sourceSemanticsValid(atom)
  );
}

function exactFoundLimitAtom(atom, expectedDocument) {
  const fields = comparisonFieldSignature(atom);
  return Boolean(
    exactAtomContract(
      atom,
      expectedDocument,
      VS25_LIMIT_COMPONENT_ID,
      "LIMIT"
    ) &&
      atom?.evidencePresence === "FOUND" &&
      atom?.coverageEffect === "DEFINED" &&
      atom?.selectedScopePicture === "GENERAL" &&
      comparisonApplicability(atom) === PACKAGE_MEMBER &&
      atom?.requestedFieldStatus === "COMPLETE" &&
      fields.length === 1 &&
      fields[0]?.field === "limit" &&
      fields[0]?.fieldStatus === "FOUND" &&
      ["MONEY", "PERCENT"].includes(fields[0]?.valueType) &&
      /^\d+$/u.test(fields[0]?.value || "") &&
      directFieldFactsValid(atom, fields[0]) &&
      sourceSemanticsValid(atom)
  );
}

function exactVs01ReferenceAtom(atom, expectedDocumentUuids) {
  return Boolean(
    atom?.requirementId === "VS-01" &&
      atom?.componentId === VS01_COMPONENT_ID &&
      atom?.factRole === "BENEFIT" &&
      atom?.evidencePresence === "FOUND" &&
      atom?.coverageEffect === "INCLUDED" &&
      atom?.conflictState === "NONE" &&
      (atom?.unresolvedCandidateIds || []).length === 0 &&
      atom?.selectedScopePicture === "GENERAL" &&
      comparisonApplicability(atom) === PACKAGE_MEMBER &&
      Array.isArray(atom?.documentUuids) &&
      atom.documentUuids.length === 1 &&
      expectedDocumentUuids.has(atom.documentUuids[0]) &&
      sourceBindingValid(atom) &&
      atom.sources.every(({ exactText, conditionCheckText }) =>
        /(?:Wohngebäude\s+zum\s+Neuwert|Neuwertentschädigung|zum\s+Neuwert\s+zu\s+ersetzen)/iu.test(
          `${exactText || ""}\n${conditionCheckText || ""}`
        )
      )
  );
}

function clauseCodes(atom) {
  return strings(
    (atom?.sources || [])
      .flatMap((source) => {
        const local = localSourceWindow(source);
        if (!local) return [];
        return [
          ...`${local.prefix}${local.fromAnchor.slice(0, 320)}`.matchAll(
            /\b\d{2}[A-Z]{2}\d{4}\b/gu
          ),
        ];
      })
      .map(([code]) => code)
  );
}

function directFieldFactsValid(atom, signature) {
  const selectedCandidateIds = new Set(atom.selectedCandidateIds || []);
  const facts = (atom.fields || []).flatMap(
    ({ facts: fieldFacts }) => fieldFacts || []
  );
  if (facts.length === 0) return false;
  return facts.every((fact) => {
    const source = fact?.source;
    const expectedUnit = fact.valueType === "MONEY" ? "EUR" : "%";
    return Boolean(
      fact?.binding === "DIRECT" &&
        fact?.valueType === signature.valueType &&
        fact?.unit === expectedUnit &&
        fact?.limitKind === "CAPPED" &&
        selectedCandidateIds.has(source?.candidateId) &&
        Number.isInteger(source?.physicalPageNumber) &&
        source.physicalPageNumber > 0 &&
        Number.isInteger(source?.documentStart) &&
        Number.isInteger(source?.documentEnd) &&
        source.documentStart >= 0 &&
        source.documentEnd > source.documentStart &&
        String(source?.exactText || "").trim() &&
        (fact.valueType !== "PERCENT" ||
          [
            "BUILDING_INSURANCE_SUM",
            "BUILDING_NEW_VALUE_INSURANCE_SUM",
          ].includes(fact.comparisonBasis))
    );
  });
}

function limitPresentation(atom) {
  const field = comparisonFieldSignature(atom)[0];
  const typedBases = strings(
    (atom.fields || [])
      .flatMap(({ facts }) => facts || [])
      .map(({ comparisonBasis }) => comparisonBasis)
  );
  if (field.valueType === "PERCENT") {
    if (
      typedBases.length !== 1 ||
      !["BUILDING_INSURANCE_SUM", "BUILDING_NEW_VALUE_INSURANCE_SUM"].includes(
        typedBases[0]
      )
    )
      return null;
  }
  return {
    documentUuid: atom.documentUuids[0],
    valueType: field.valueType,
    value: field.value,
    displayValue: field.displayValue,
    qualifier: field.qualifier,
    basis: field.valueType === "PERCENT" ? typedBases[0] : null,
    clauseCodes: clauseCodes(atom),
    selectedCandidateIds: strings(atom.selectedCandidateIds),
    sources: atom.sources.map(
      ({ candidateId, physicalPageNumber, exactText, conditionCheckText }) => ({
        candidateId,
        physicalPageNumber,
        exactText,
        conditionCheckText,
      })
    ),
  };
}

function vs01BaseAtomProof(atom, amountMinor) {
  const signature = comparisonFieldSignature(atom);
  if (
    signature.length !== 1 ||
    signature[0]?.valueType !== "MONEY" ||
    signature[0]?.value !== amountMinor
  )
    return null;
  const moneyFacts = (atom?.fields || [])
    .filter(({ field, status }) => field === "limit" && status === "FOUND")
    .flatMap(({ facts }) => facts || [])
    .filter(({ valueType }) => valueType === "MONEY");
  const selectedCandidateIds = new Set(atom.selectedCandidateIds || []);
  if (
    moneyFacts.length === 0 ||
    moneyFacts.some(
      (fact) =>
        fact?.binding !== "DIRECT" ||
        fact?.unit !== "EUR" ||
        !selectedCandidateIds.has(fact?.source?.candidateId) ||
        !Number.isInteger(fact?.source?.physicalPageNumber) ||
        fact.source.physicalPageNumber < 1 ||
        !Number.isInteger(fact?.source?.documentStart) ||
        !Number.isInteger(fact?.source?.documentEnd) ||
        fact.source.documentStart < 0 ||
        fact.source.documentEnd <= fact.source.documentStart ||
        !String(fact?.source?.exactText || "").trim()
    )
  )
    return null;
  return {
    requirementContractDigest: atom.requirementContractDigest,
    documentUuid: atom.documentUuids[0],
    documentRole: atom.documentRole,
    documentStatus: atom.documentStatus,
    documentApplicability: atom.documentApplicability,
    selectedCandidateIds: strings(atom.selectedCandidateIds),
    valueSources: moneyFacts.map(({ normalizedValue, source }) => ({
      normalizedValue,
      candidateId: source?.candidateId,
      physicalPageNumber: source?.physicalPageNumber,
      documentStart: source?.documentStart,
      documentEnd: source?.documentEnd,
      exactText: source?.exactText,
    })),
  };
}

function reconciliationValid(
  reconciliation,
  money,
  percentage,
  newValueReferences
) {
  if (
    reconciliation?.schemaVersion !== 1 ||
    reconciliation?.contractId !== VS25_RECONCILIATION_CONTRACT_ID ||
    reconciliation?.categoryId !== VS25_CATEGORY_ID ||
    reconciliation?.comparisonBasis !== "BUILDING_NEW_VALUE_INSURANCE_SUM" ||
    reconciliation?.currency?.documentUuid !== money.documentUuid ||
    reconciliation?.currency?.amountMinor !== money.value ||
    reconciliation?.percentage?.documentUuid !== percentage.documentUuid ||
    reconciliation?.percentage?.percentageHundredths !== percentage.value ||
    reconciliation?.percentage?.qualifier !== "GENERAL" ||
    reconciliation?.calculation?.documentedAmountMinor !== money.value ||
    reconciliation?.calculation?.calculatedAmountMinor !== money.value ||
    reconciliation?.calculation?.remainder !== "0" ||
    reconciliation?.calculation?.divisor !== "10000" ||
    reconciliation?.currency?.qualifier !== "FIRST_RISK" ||
    !/^\d+$/u.test(reconciliation?.base?.amountMinor || "")
  )
    return false;
  const commonCodes = money.clauseCodes.filter((code) =>
    percentage.clauseCodes.includes(code)
  );
  if (commonCodes.length !== 1 || reconciliation.clauseCode !== commonCodes[0])
    return false;
  const base = BigInt(reconciliation.base.amountMinor);
  const percent = BigInt(percentage.value);
  const amount = BigInt(money.value);
  const numerator = base * percent;
  const matchingReferences = newValueReferences.filter(
    (atom) =>
      atom.documentUuids[0] === reconciliation.base.documentUuid &&
      sameJson(
        vs01BaseAtomProof(atom, reconciliation.base.amountMinor),
        reconciliation.base.atomProof
      )
  );
  return Boolean(
    matchingReferences.length === 1 &&
      reconciliation.calculation.numerator === numerator.toString() &&
      numerator === amount * 10_000n
  );
}

function sidePortfolio({
  side,
  packageSummary,
  atoms,
  referenceAtoms,
  expectedDocuments,
}) {
  if (
    packageSummary?.reviewStatus !== "BELEGT" ||
    packageSummary?.evidenceFound !== true
  )
    return null;
  const documents = expectedDocumentsForSide(expectedDocuments, side);
  if (!documents) return null;
  const relevant = (atoms || []).filter(
    ({ requirementId }) => requirementId === VS25_CATEGORY_ID
  );
  if (relevant.length !== documents.length * EXPECTED_COMPONENTS.length)
    return null;
  const byKey = new Map();
  for (const atom of relevant) {
    const documentUuid = Array.isArray(atom?.documentUuids)
      ? atom.documentUuids[0]
      : null;
    const key = `${documentUuid}:${atom?.componentId}`;
    if (!documentUuid || byKey.has(key)) return null;
    byKey.set(key, atom);
  }

  const limitAtoms = [];
  for (const document of documents) {
    const cost = byKey.get(`${document.uuid}:${VS25_COST_COMPONENT_ID}`);
    const limit = byKey.get(`${document.uuid}:${VS25_LIMIT_COMPONENT_ID}`);
    if (!cost || !limit) return null;
    if (cost.evidencePresence === "NOT_FOUND") {
      if (
        !exactAbsentAtom(cost, document, VS25_COST_COMPONENT_ID, "COST") ||
        !exactAbsentAtom(limit, document, VS25_LIMIT_COMPONENT_ID, "LIMIT")
      )
        return null;
      continue;
    }
    if (
      !exactFoundCostAtom(cost, document) ||
      !exactFoundLimitAtom(limit, document)
    )
      return null;
    limitAtoms.push(limit);
  }
  if (limitAtoms.length === 0) return null;

  const expectedDocumentUuids = new Set(documents.map(({ uuid }) => uuid));
  const newValueReferences = (referenceAtoms || []).filter((atom) =>
    exactVs01ReferenceAtom(atom, expectedDocumentUuids)
  );
  if (newValueReferences.length === 0) return null;
  const presentations = limitAtoms.map(limitPresentation);
  if (presentations.some((presentation) => !presentation)) return null;
  const percentages = presentations.filter(
    ({ valueType }) => valueType === "PERCENT"
  );
  const money = presentations.filter(({ valueType }) => valueType === "MONEY");
  if (percentages.length !== 1 || money.length > 1) return null;
  if (
    money.length === 1 &&
    !reconciliationValid(
      packageSummary.vs25AmountReconciliation,
      money[0],
      percentages[0],
      newValueReferences
    )
  )
    return null;
  if (money.length === 0 && packageSummary.vs25AmountReconciliation)
    return null;

  const effectiveQualifier =
    money.length === 1
      ? percentages[0].qualifier === "" &&
        money[0].qualifier === "auf erstes risiko"
        ? "FIRST_RISK"
        : null
      : percentages[0].qualifier === "auf erstes risiko"
        ? "FIRST_RISK"
        : null;
  if (effectiveQualifier !== "FIRST_RISK") return null;

  return {
    side,
    status: "COMPLETE_INCLUDED_AUTHORITY_COST_RELATIVE_LIMIT_PORTFOLIO",
    expectedDocumentUuids: [...expectedDocumentUuids].sort(),
    expectedDocumentManifest: documents,
    comparisonBasis: "BUILDING_NEW_VALUE_INSURANCE_SUM",
    canonicalRelativeLimitHundredths: percentages[0].value,
    displayRelativeLimit: percentages[0].displayValue,
    effectiveQualifier,
    presentations,
    newValueReferenceDocumentUuids: strings(
      newValueReferences.flatMap(({ documentUuids }) => documentUuids)
    ),
    projectedAtoms: projectedAtoms(relevant, VS25_CATEGORY_ID),
    projectedReferenceAtoms: projectedAtoms(referenceAtoms, "VS-01"),
    projectedAtomDigestsSha256: {
      targetAtoms: sha256(projectedAtoms(relevant, VS25_CATEGORY_ID)),
      referenceAtoms: sha256(projectedAtoms(referenceAtoms, "VS-01")),
    },
    ...(money.length === 1
      ? { reconciliation: packageSummary.vs25AmountReconciliation }
      : {}),
  };
}

function buildVs25AuthorityLimitPortfolioAudit({
  categoryId,
  packageA,
  packageB,
  atomsA,
  atomsB,
  referenceAtomsA,
  referenceAtomsB,
  requirementContractA,
  requirementContractB,
  expectedDocumentsA,
  expectedDocumentsB,
}) {
  if (
    categoryId !== VS25_CATEGORY_ID ||
    !exactRequirementContract(requirementContractA) ||
    JSON.stringify(requirementContractA) !==
      JSON.stringify(requirementContractB)
  )
    return null;
  const sideA = sidePortfolio({
    side: "A",
    packageSummary: packageA,
    atoms: atomsA,
    referenceAtoms: referenceAtomsA,
    expectedDocuments: expectedDocumentsA,
  });
  const sideB = sidePortfolio({
    side: "B",
    packageSummary: packageB,
    atoms: atomsB,
    referenceAtoms: referenceAtomsB,
    expectedDocuments: expectedDocumentsB,
  });
  if (!sideA || !sideB) return null;
  const valueA = BigInt(sideA.canonicalRelativeLimitHundredths);
  const valueB = BigInt(sideB.canonicalRelativeLimitHundredths);
  return {
    schemaVersion: 1,
    contractId: VS25_AUTHORITY_LIMIT_PORTFOLIO_AUDIT_CONTRACT_ID,
    categoryId: VS25_CATEGORY_ID,
    requirementContractDigestSha256: VS25_REQUIREMENT_CONTRACT_DIGEST_SHA256,
    comparisonBasis: "BUILDING_NEW_VALUE_INSURANCE_SUM",
    sides: { A: sideA, B: sideB },
    winnerSide: valueA === valueB ? null : valueA > valueB ? "A" : "B",
  };
}

function vs25AuthorityLimitPortfolioDecision(audit) {
  const valueA = audit.sides.A.displayRelativeLimit;
  const valueB = audit.sides.B.displayRelativeLimit;
  if (!audit.winnerSide)
    return {
      schemaVersion: 4,
      outcome: "GLEICHWERTIG",
      reasonCode: VS25_EQUAL_RELATIVE_LIMIT_REASON_CODE,
      reason: `Gleichwertig: Beide Polizzen decken behördliche Mehrkosten beim Wiederaufbau mit derselben relativen Grenze von ${valueA} der jeweils belegten Gebäude-Neuwertversicherungssumme.`,
      reviewRequired: false,
      ruleId: VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID,
      vs25AuthorityLimitPortfolioAudit: audit,
      dimensions: [],
    };
  const winner = audit.winnerSide;
  const loser = winner === "A" ? "B" : "A";
  return {
    schemaVersion: 4,
    outcome: winner === "A" ? "VORTEIL_A" : "VORTEIL_B",
    reasonCode: VS25_HIGHER_RELATIVE_LIMIT_REASON_CODE,
    reason: `Vorteil Polizze ${winner}: Beide Polizzen decken behördliche Mehrkosten beim Wiederaufbau. Polizze ${winner} dokumentiert mit ${audit.sides[winner].displayRelativeLimit} eine höhere relative Grenze als Polizze ${loser} mit ${audit.sides[loser].displayRelativeLimit}, jeweils bezogen auf die belegte Gebäude-Neuwertversicherungssumme. Der Vergleich bewertet die relative Grenze; ohne beidseitigen Euro-Neubauwert wird daraus kein höherer absoluter Eurobetrag abgeleitet.`,
    reviewRequired: false,
    ruleId: VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID,
    vs25AuthorityLimitPortfolioAudit: audit,
    dimensions: [],
  };
}

function validateVs25AuthorityLimitPortfolioAudit(audit, options) {
  const replay = options?.sourceAtomDigestReplay;
  if (
    replay?.schemaVersion !== 1 ||
    replay?.contractId !== VS25_SOURCE_ATOM_DIGEST_REPLAY_CONTRACT_ID ||
    replay?.categoryId !== VS25_CATEGORY_ID
  )
    throw new Error("VS25_SOURCE_REFERENCE_ATOM_DIGEST_REPLAY_REQUIRED");
  for (const side of ["A", "B"]) {
    const replayDigests = replay?.sourceAtomDigestsSha256?.[side];
    const auditSide = audit?.sides?.[side];
    if (
      !/^[a-f0-9]{64}$/u.test(replayDigests?.targetAtoms || "") ||
      !/^[a-f0-9]{64}$/u.test(replayDigests?.referenceAtoms || "") ||
      !/^[a-f0-9]{64}$/u.test(replayDigests?.documents || "") ||
      auditSide?.projectedAtomDigestsSha256?.targetAtoms !==
        replayDigests.targetAtoms ||
      auditSide?.projectedAtomDigestsSha256?.referenceAtoms !==
        replayDigests.referenceAtoms ||
      sha256(auditSide?.projectedAtoms) !== replayDigests.targetAtoms ||
      sha256(auditSide?.projectedReferenceAtoms) !==
        replayDigests.referenceAtoms ||
      sha256(auditSide?.expectedDocumentManifest) !== replayDigests.documents ||
      sha256(
        expectedDocumentsForSide(options?.[`expectedDocuments${side}`], side)
      ) !== replayDigests.documents
    )
      throw new Error("VS25_SOURCE_REFERENCE_ATOM_DIGEST_REPLAY_MISMATCH");
  }
  const expected = buildVs25AuthorityLimitPortfolioAudit({
    ...options,
    atomsA: audit?.sides?.A?.projectedAtoms,
    atomsB: audit?.sides?.B?.projectedAtoms,
    referenceAtomsA: audit?.sides?.A?.projectedReferenceAtoms,
    referenceAtomsB: audit?.sides?.B?.projectedReferenceAtoms,
  });
  if (!expected) throw new Error("VS25_AUTHORITY_LIMIT_NOT_QUALIFIED");
  if (!sameJson(audit, expected))
    throw new Error("VS25_AUTHORITY_LIMIT_AUDIT_MISMATCH");
  return true;
}

module.exports = {
  VS25_AUTHORITY_LIMIT_PORTFOLIO_AUDIT_CONTRACT_ID,
  VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID,
  VS25_EQUAL_RELATIVE_LIMIT_REASON_CODE,
  VS25_HIGHER_RELATIVE_LIMIT_REASON_CODE,
  VS25_REQUIREMENT_CONTRACT_DIGEST_SHA256,
  VS25_SOURCE_ATOM_DIGEST_REPLAY_CONTRACT_ID,
  buildVs25SourceAtomDigestReplay,
  buildVs25AuthorityLimitPortfolioAudit,
  validateVs25AuthorityLimitPortfolioAudit,
  vs25AuthorityLimitPortfolioDecision,
};
