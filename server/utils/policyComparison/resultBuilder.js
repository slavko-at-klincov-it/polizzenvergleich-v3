const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { SEARCH_DISPOSITION, decidePoint } = require("./pointDecision");
const {
  CATEGORY_ORDER,
  CATEGORY_ROW_COUNTS,
  EXPECTED_ROW_COUNT,
  PRODUCT_PROFILE,
} = require("./productContract");
const { customerResultText } = require("./customerResultPresenter");
const {
  CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT,
} = require("./customerResultRuleOutcomeContract");
const {
  assertCustomerResultSemanticParity,
  customerOutcomeFromText,
} = require("./customerResultSemanticContract");
const {
  publishComparisonArtifactSet,
} = require("./artifactSetPublisher");
const {
  deriveCustomerMetrics,
  validateCustomerComparison,
} = require("./customerMetricContract");
const {
  requirementSearchContractDigest,
} = require("../policyAnalysis/coverageOnlyCertificationContract");
const {
  componentScopeContract,
} = require("../policyAnalysis/componentScopePolicyContract");
const {
  FE_C07_COMPONENT_ID,
  validFeC07ConditionAbsenceAudit,
} = require("../policyAnalysis/feC07ConditionAbsenceAudit");
const {
  projectedFieldFactAppliesToAtom,
} = require("../policyAnalysis/requestedFieldBindingGroupContract");
const {
  buildLw20DefaultExclusionOverrideAudit,
} = require("../policyAnalysis/lw20DefaultExclusionOverrideAudit");
const {
  buildLw20DefaultExclusionSourceAudit,
} = require("../policyAnalysis/lw20DefaultExclusionSourceAudit");
const {
  VS22_HAZARDOUS_WASTE_PORTFOLIO_RULE_ID,
  buildVs22SourceAtomDigestReplay,
} = require("./vs22HazardousWastePortfolioComparisonContract");
const {
  VS24_SCAFFOLDING_COST_EQUALITY_RULE_ID,
  buildVs24SourceAtomDigestReplay,
} = require("./vs24ScaffoldingCostEqualityContract");
const {
  VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID,
  buildVs25SourceAtomDigestReplay,
} = require("./vs25AuthorityReconstructionLimitPortfolioContract");
const {
  buildMembershipConditionScopeQualificationReplay,
} = require("./membershipConditionScopeComparisonContract");
const {
  buildSpecializedComparisonQualificationReplay,
  comparisonContract: specializedComparisonContract,
} = require("./specializedComparisonQualificationReplayContract");
const {
  buildSourceBoundScopedPackageReferenceProofs,
} = require("../policyAnalysis/scopedPackageReferenceEvidenceContract");
const {
  buildSourceBoundReferencedTermsIdentityProofs,
} = require("../policyAnalysis/referencedTermsIdentityEvidenceContract");
const {
  buildSourceBoundCoverageConditionFormulaProof,
} = require("../policyAnalysis/coverageConditionFormulaEvidenceContract");
const {
  buildSupportingObjectMembershipProofsFromArtifact,
} = require("../policyAnalysis/controlledOccurrenceWorksheet");
const {
  DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASSIFICATION_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_VS22_NON_TARGET_WASTE_OCCURRENCE_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_VS25_SUM_EQUALIZATION_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID,
  TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
  certifiedTerminalTarget,
  terminalOccurrenceProof,
  terminalOccurrenceDigest,
  terminalRejectionSetDigest,
} = require("../policyAnalysis/deterministicTerminalRejectionContract");
const MISSING_EVIDENCE = "keine belegte Fundstelle gefunden";
const NOT_DETERMINABLE = "Nicht feststellbar";
const CONDITION_CONTEXT_RADIUS = 240;
const CUSTOMER_WORKBOOK_SHEET = "Gesamtvergleich";
const CUSTOMER_WORKBOOK_HEADERS = Object.freeze([
  "A_Kategorie-ID",
  "A_Stufe",
  "A_Kategorie-Name",
  "A_Vertragsinhalt",
  "A_Deckung",
  "A_Deckungssumme",
  "A_Quelle",
  "A_Prüfstatus",
  "B_Kategorie-ID",
  "B_Stufe",
  "B_Kategorie-Name",
  "B_Vertragsinhalt",
  "B_Deckung",
  "B_Deckungssumme",
  "B_Quelle",
  "B_Prüfstatus",
  "KI-Ergebnis",
]);

function worksheetRequirementContract(worksheet, requirement) {
  const catalogId = String(worksheet?.catalog?.id || "").trim();
  if (!catalogId || !requirement) return null;
  return {
    digest: requirementSearchContractDigest({ catalogId, requirement }),
    componentSatisfactionPolicy:
      requirement.componentSatisfactionPolicy || null,
    ...(requirement.componentFamilyContract
      ? { componentFamilyContract: requirement.componentFamilyContract }
      : {}),
    components: (requirement.components || []).map(({ id, factRole }) => ({
      id,
      factRole,
    })),
  };
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function conditionCheckSource(candidate) {
  const contextText = String(candidate?.contextText || "");
  const contextStart = Number(candidate?.contextDocumentStart);
  const documentStart = Number(candidate?.documentStart);
  const documentEnd = Number(candidate?.documentEnd);
  if (
    !contextText ||
    !Number.isFinite(contextStart) ||
    !Number.isFinite(documentStart) ||
    !Number.isFinite(documentEnd)
  )
    return {
      text: String(candidate?.exactText || ""),
      documentStart,
      documentEnd,
    };
  const relativeStart = documentStart - contextStart;
  const relativeEnd = documentEnd - contextStart;
  if (
    relativeStart < 0 ||
    relativeEnd < relativeStart ||
    relativeStart > contextText.length ||
    relativeEnd > contextText.length
  )
    return {
      text: String(candidate?.exactText || ""),
      documentStart,
      documentEnd,
    };
  const contextSliceStart = Math.max(
    0,
    relativeStart - CONDITION_CONTEXT_RADIUS
  );
  const contextSliceEnd = Math.min(
    contextText.length,
    relativeEnd + CONDITION_CONTEXT_RADIUS
  );
  return {
    text: contextText.slice(contextSliceStart, contextSliceEnd),
    documentStart: contextStart + contextSliceStart,
    documentEnd: contextStart + contextSliceEnd,
  };
}

function normalized(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function isEvidenceRow(row) {
  return !(
    normalized(row?.documentedContent) === normalized(MISSING_EVIDENCE) &&
    normalized(row?.source) === normalized(MISSING_EVIDENCE)
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function decimalParts(value) {
  const compact = String(value || "")
    .replace(/[\s\u00a0]/gu, "")
    .trim();
  if (!/^\d[\d.,]*$/u.test(compact)) return null;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let decimalSeparator = null;
  if (lastComma >= 0 && lastDot >= 0)
    decimalSeparator = lastComma > lastDot ? "," : ".";
  else if (lastComma >= 0 && compact.length - lastComma - 1 <= 2)
    decimalSeparator = ",";
  else if (lastDot >= 0 && compact.length - lastDot - 1 <= 2)
    decimalSeparator = ".";
  const parts = decimalSeparator
    ? compact.split(decimalSeparator)
    : [compact, ""];
  const integerDigits = parts[0].replace(/[.,]/gu, "");
  const decimalDigits = String(parts[1] || "").replace(/[.,]/gu, "");
  if (!integerDigits || integerDigits.length > 30 || decimalDigits.length > 2)
    return null;
  return {
    integer: BigInt(integerDigits),
    fraction: BigInt(decimalDigits.padEnd(2, "0") || "0"),
  };
}

function singleCurrencyAmount(value) {
  const text = String(value || "");
  const matches = [
    ...text.matchAll(/(?:EUR|\u20ac)\s*([0-9][0-9.,\s\u00a0]*)/giu),
    ...text.matchAll(/([0-9][0-9.,\s\u00a0]*)\s*(?:EUR|\u20ac)/giu),
  ];
  const amounts = unique(
    matches
      .map((match) => decimalParts(match[1]))
      .filter(Boolean)
      .map(({ integer, fraction }) => `${integer * 100n + fraction}`)
  );
  return amounts.length === 1 ? BigInt(amounts[0]) : null;
}

function singlePercentage(value) {
  const percentages = unique(
    [...String(value || "").matchAll(/([0-9]+(?:[.,][0-9]{1,2})?)\s*%/gu)]
      .map((match) => decimalParts(match[1]))
      .filter(Boolean)
      .map(({ integer, fraction }) => `${integer * 100n + fraction}`)
  );
  return percentages.length === 1 ? BigInt(percentages[0]) : null;
}

function nativeAmountKey(value) {
  const currency = singleCurrencyAmount(value);
  if (currency !== null) return `EUR:${currency}`;
  const percentage = singlePercentage(value);
  if (percentage !== null) return `PERCENT:${percentage}`;
  return `TEXT:${normalized(value)}`;
}

function clauseCodes(fact) {
  return unique(
    [
      ...`${fact.documentedContent || ""}\n${fact.source || ""}`.matchAll(
        /\b\d{2}[A-Z]{2}\d{4}\b/gu
      ),
    ].map(([code]) => code)
  );
}

function sharedClauseCodes(facts) {
  const sets = facts.map((fact) => new Set(clauseCodes(fact)));
  if (sets.length === 0) return [];
  return [...sets[0]].filter((code) =>
    sets.slice(1).every((set) => set.has(code))
  );
}

function amountQualifier(fact) {
  const text = `${fact.coverageAmount || ""}\n${fact.source || ""}`;
  const qualifiers = [];
  if (/\b(?:Jahresh[oö]chst|pro\s+Jahr|je\s+Versicherungsjahr)\b/iu.test(text))
    qualifiers.push("ANNUAL");
  if (/\b(?:je|pro)\s+(?:Schadenfall|Ereignis)\b/iu.test(text))
    qualifiers.push("EVENT");
  if (/\bauf\s+[,„“"']*Erstes\s+Risiko\b/iu.test(text))
    qualifiers.push("FIRST_RISK");
  return qualifiers.sort().join("+") || "GENERAL";
}

function newBuildingValueBases(referenceEntries) {
  return unique(
    (referenceEntries || [])
      .filter(({ row }) => isEvidenceRow(row))
      .filter(({ row }) => row.reviewStatus === "BELEGT")
      .filter(({ row }) => row.categoryId === "VS-01")
      .filter(({ row }) =>
        /\b(?:NBW|Neubauwert|Wohngeb[aä]ude\s+zum\s+Neuwert)\b/iu.test(
          `${row.documentedContent || ""}\n${row.source || ""}`
        )
      )
      .map(({ row }) => singleCurrencyAmount(row.coverageAmount))
      .filter((value) => value !== null)
      .map(String)
  ).map(BigInt);
}

function vs01BaseAtomProof(
  referenceAtomicFacts,
  { documentUuid, amountMinor }
) {
  const atoms = (referenceAtomicFacts || []).filter(
    (atom) =>
      atom?.requirementId === "VS-01" &&
      atom?.componentId === "replacement_new_value" &&
      atom?.factRole === "BENEFIT" &&
      atom?.evidencePresence === "FOUND" &&
      atom?.coverageEffect === "INCLUDED" &&
      atom?.conflictState === "NONE" &&
      (atom?.unresolvedCandidateIds || []).length === 0 &&
      Array.isArray(atom?.documentUuids) &&
      atom.documentUuids.length === 1 &&
      atom.documentUuids[0] === documentUuid
  );
  if (atoms.length !== 1) return null;
  const atom = atoms[0];
  const moneyFacts = (atom.fields || [])
    .filter(({ field, status }) => field === "limit" && status === "FOUND")
    .flatMap(({ facts }) => facts || [])
    .filter(
      ({ valueType, normalizedValue }) =>
        valueType === "MONEY" && singleCurrencyAmount(normalizedValue) !== null
    );
  const amounts = unique(
    moneyFacts.map(({ normalizedValue }) =>
      singleCurrencyAmount(normalizedValue).toString()
    )
  );
  if (amounts.length !== 1 || amounts[0] !== amountMinor.toString())
    return null;
  if (
    !Array.isArray(atom.selectedCandidateIds) ||
    atom.selectedCandidateIds.length === 0 ||
    atom.selectedCandidateIds.some(
      (candidateId) =>
        !atom.sources?.some(
          (source) =>
            source.candidateId === candidateId &&
            Number.isInteger(source.physicalPageNumber) &&
            source.physicalPageNumber > 0 &&
            String(source.exactText || "").trim()
        )
    )
  )
    return null;
  return {
    requirementContractDigest: atom.requirementContractDigest,
    documentUuid,
    documentRole: atom.documentRole,
    documentStatus: atom.documentStatus,
    documentApplicability: atom.documentApplicability,
    selectedCandidateIds: [...atom.selectedCandidateIds].sort(),
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

function newBuildingValueBaseReferences(
  referenceEntries,
  referenceAtomicFacts
) {
  return (referenceEntries || [])
    .filter(({ row }) => isEvidenceRow(row))
    .filter(({ row }) => row.reviewStatus === "BELEGT")
    .filter(({ row }) => row.categoryId === "VS-01")
    .filter(({ row }) =>
      /\b(?:NBW|Neubauwert|Wohngeb[aä]ude\s+zum\s+Neuwert)\b/iu.test(
        `${row.documentedContent || ""}\n${row.source || ""}`
      )
    )
    .map(({ document, row }) => {
      const documentUuid = String(document?.uuid || "");
      const amountMinor = singleCurrencyAmount(row.coverageAmount);
      return {
        documentUuid,
        documentRole: String(document?.role || ""),
        documentStatus: String(document?.documentStatus || ""),
        amountMinor,
        coverageAmount: String(row.coverageAmount || ""),
        documentedContent: String(row.documentedContent || ""),
        source: String(row.source || ""),
        reviewStatus: row.reviewStatus,
        atomProof:
          documentUuid && amountMinor !== null
            ? vs01BaseAtomProof(referenceAtomicFacts, {
                documentUuid,
                amountMinor,
              })
            : null,
      };
    })
    .filter(
      ({ documentUuid, amountMinor, atomProof }) =>
        documentUuid && amountMinor !== null && atomProof
    );
}

function vs25AuthorityLimitReconciliationAudit({
  categoryId,
  facts,
  referenceEntries,
  referenceAtomicFacts,
}) {
  if (categoryId !== "VS-25") return null;
  const amountFacts = facts.filter(
    ({ coverageAmount }) =>
      normalized(coverageAmount) !== normalized(NOT_DETERMINABLE)
  );
  const currencyFacts = amountFacts
    .map((fact) => ({
      ...fact,
      amountMinor: singleCurrencyAmount(fact.coverageAmount),
    }))
    .filter(({ amountMinor }) => amountMinor !== null);
  const percentageFacts = amountFacts
    .map((fact) => ({
      ...fact,
      percentageHundredths: singlePercentage(fact.coverageAmount),
    }))
    .filter(({ percentageHundredths }) => percentageHundredths !== null);
  if (currencyFacts.length !== 1 || percentageFacts.length !== 1) return null;

  const currencyFact = currencyFacts[0];
  const percentageFact = percentageFacts[0];
  const commonCodes = sharedClauseCodes([currencyFact, percentageFact]);
  if (
    commonCodes.length !== 1 ||
    !/\b(?:des\s+NBW|vom\s+NBW|des\s+Neubauwerts?)\b/iu.test(
      `${percentageFact.documentedContent || ""}\n${percentageFact.source || ""}`
    )
  )
    return null;

  const bases = newBuildingValueBaseReferences(
    referenceEntries,
    referenceAtomicFacts
  ).filter(({ documentUuid }) => documentUuid === currencyFact.documentUuid);
  if (bases.length !== 1) return null;
  const base = bases[0];
  const numerator = base.amountMinor * percentageFact.percentageHundredths;
  if (
    numerator % 10_000n !== 0n ||
    numerator / 10_000n !== currencyFact.amountMinor
  )
    return null;

  return {
    schemaVersion: 1,
    contractId: "VS25_NBW_PERCENT_CURRENCY_RECONCILIATION_AUDIT_V1",
    categoryId: "VS-25",
    comparisonBasis: "BUILDING_NEW_VALUE_INSURANCE_SUM",
    clauseCode: commonCodes[0],
    base: {
      ...base,
      amountMinor: base.amountMinor.toString(),
    },
    percentage: {
      documentUuid: percentageFact.documentUuid,
      coverageAmount: percentageFact.coverageAmount,
      percentageHundredths: percentageFact.percentageHundredths.toString(),
      qualifier: amountQualifier(percentageFact),
      documentedContent: percentageFact.documentedContent,
      source: percentageFact.source,
    },
    currency: {
      documentUuid: currencyFact.documentUuid,
      coverageAmount: currencyFact.coverageAmount,
      amountMinor: currencyFact.amountMinor.toString(),
      qualifier: amountQualifier(currencyFact),
      documentedContent: currencyFact.documentedContent,
      source: currencyFact.source,
    },
    calculation: {
      numerator: numerator.toString(),
      divisor: "10000",
      calculatedAmountMinor: (numerator / 10_000n).toString(),
      documentedAmountMinor: currencyFact.amountMinor.toString(),
      remainder: (numerator % 10_000n).toString(),
    },
  };
}

function canonicalAmountKeys(facts, referenceEntries) {
  const commonClauseCodes = sharedClauseCodes(
    facts.filter(
      ({ coverageAmount }) =>
        normalized(coverageAmount) !== normalized(NOT_DETERMINABLE)
    )
  );
  const commonClauseKey = commonClauseCodes.join(",");
  const values = facts
    .filter(
      ({ coverageAmount }) =>
        normalized(coverageAmount) !== normalized(NOT_DETERMINABLE)
    )
    .map((fact) => ({
      fact,
      nativeKey: nativeAmountKey(fact.coverageAmount),
    }));
  const preserveClauseQualifier =
    values.length > 0 &&
    values.every(({ fact }) => amountQualifier(fact) !== "GENERAL");
  const canonicalQualifier = (fact) =>
    preserveClauseQualifier ? amountQualifier(fact) : "GENERAL";
  const bases = newBuildingValueBases(referenceEntries);
  const currencyTargets = [
    ...new Map(
      values
        .filter(({ nativeKey }) => nativeKey.startsWith("EUR:"))
        .map(({ fact, nativeKey }) => {
          const amount = nativeKey.slice(4);
          const qualifier = canonicalQualifier(fact);
          return [
            `${amount}:${qualifier}`,
            { amount: BigInt(amount), qualifier },
          ];
        })
    ).values(),
  ];

  return values.map(({ fact, nativeKey }) => {
    if (!nativeKey.startsWith("PERCENT:"))
      return commonClauseKey
        ? `CLAUSE:${commonClauseKey}:${nativeKey}:QUALIFIER:${canonicalQualifier(fact)}`
        : `${nativeKey}:QUALIFIER:${amountQualifier(fact)}`;
    if (
      !commonClauseKey ||
      !/\b(?:des\s+NBW|vom\s+NBW|des\s+Neubauwerts?)\b/iu.test(
        `${fact.documentedContent || ""}\n${fact.source || ""}`
      )
    )
      return commonClauseKey
        ? `CLAUSE:${commonClauseKey}:${nativeKey}:QUALIFIER:${canonicalQualifier(fact)}`
        : `${nativeKey}:QUALIFIER:${amountQualifier(fact)}`;
    const percentageHundredths = BigInt(nativeKey.slice("PERCENT:".length));
    const matchingTargets = unique(
      bases
        .flatMap((base) =>
          currencyTargets.filter(({ amount }) => {
            const numerator = base * percentageHundredths;
            const rounded = (numerator + 5_000n) / 10_000n;
            return rounded === amount;
          })
        )
        .map(({ amount, qualifier }) => `${amount}:${qualifier}`)
    );
    return matchingTargets.length === 1
      ? `CLAUSE:${commonClauseKey}:EUR:${matchingTargets[0].replace(":", ":QUALIFIER:")}`
      : `CLAUSE:${commonClauseKey}:${nativeKey}:QUALIFIER:${canonicalQualifier(fact)}`;
  });
}

const PACKAGE_AMOUNT_FIELD_NAMES = new Set([
  "limit",
  "limits",
  "amount",
  "deductible",
]);

function explicitComponentScopedAmountComparison(
  facts,
  atomicFacts,
  referenceEntries,
  categoryId
) {
  const amountBearingFacts = facts.filter(
    ({ coverageAmount }) =>
      normalized(coverageAmount) !== normalized(NOT_DETERMINABLE)
  );
  if (amountBearingFacts.length === 0) return null;
  const atoms = (atomicFacts || []).filter(
    ({ evidencePresence }) => evidencePresence === "FOUND"
  );
  if (
    atoms.length === 0 ||
    !categoryId ||
    !atoms.every(
      (atom) =>
        atom.componentSatisfactionPolicy === "ANY" &&
        atom.requirementId === categoryId
    )
  )
    return null;
  const factsByDocument = new Map();
  for (const fact of facts) {
    if (!fact.documentUuid || factsByDocument.has(fact.documentUuid))
      return null;
    factsByDocument.set(fact.documentUuid, fact);
  }

  const entries = [];
  for (const atom of atoms) {
    if (
      !atom.componentId ||
      !Array.isArray(atom.documentUuids) ||
      atom.documentUuids.length !== 1 ||
      !factsByDocument.has(atom.documentUuids[0])
    )
      return null;
    for (const field of atom.fields || []) {
      if (!PACKAGE_AMOUNT_FIELD_NAMES.has(field?.field)) continue;
      if (field?.status !== "FOUND") continue;
      for (const fact of field.facts || []) {
        if (
          fact?.componentScope?.id !== atom.componentId ||
          typeof fact?.componentScope?.label !== "string" ||
          !fact.componentScope.label.trim() ||
          typeof fact?.normalizedValue !== "string" ||
          !fact.normalizedValue.trim()
        )
          return null;
        const componentLabel =
          String(
            fact.componentScope.label || atom.componentLabel || ""
          ).trim() || atom.componentId;
        const value = [fact.normalizedValue, fact.qualifier]
          .filter(Boolean)
          .join(" ");
        const atomLocalText = (atom.sources || [])
          .map(({ conditionCheckText, exactText }) =>
            String(conditionCheckText || exactText || "")
          )
          .filter(Boolean)
          .join("\n");
        for (const documentUuid of atom.documentUuids) {
          if (!documentUuid) return null;
          entries.push({
            componentId: atom.componentId,
            componentLabel,
            documentUuid,
            value,
            displayValue: `${componentLabel}: ${value}`,
            atomLocalText,
          });
        }
      }
    }
  }
  if (entries.length === 0) return null;
  if (
    JSON.stringify(
      unique(entries.map(({ documentUuid }) => documentUuid)).sort()
    ) !==
    JSON.stringify(
      unique(amountBearingFacts.map(({ documentUuid }) => documentUuid)).sort()
    )
  )
    return null;

  for (const fact of amountBearingFacts) {
    const actual = unique(
      String(fact.coverageAmount)
        .split(/\s*;\s*/u)
        .map(normalized)
    ).sort();
    const expected = unique(
      entries
        .filter(({ documentUuid }) => documentUuid === fact.documentUuid)
        .map(({ displayValue }) => normalized(displayValue))
    ).sort();
    if (
      expected.length === 0 ||
      JSON.stringify(actual) !== JSON.stringify(expected)
    )
      return null;
  }

  const components = unique(entries.map(({ componentId }) => componentId))
    .sort((left, right) => left.localeCompare(right, "de-AT"))
    .map((componentId) => {
      const componentEntries = entries.filter(
        (entry) => entry.componentId === componentId
      );
      const comparisonFacts = componentEntries.map((entry) => {
        return {
          coverageAmount: entry.value,
          documentedContent: entry.atomLocalText,
          source: entry.atomLocalText,
        };
      });
      return {
        componentId,
        componentLabel: componentEntries[0].componentLabel,
        canonicalAmountKeys: unique(
          canonicalAmountKeys(comparisonFacts, referenceEntries)
        ).sort(),
        displayValues: unique(
          componentEntries.map(({ displayValue }) => displayValue)
        ).sort((left, right) => left.localeCompare(right, "de-AT")),
      };
    });
  return {
    contractId: "ANY_EXPLICIT_COMPONENT_SCOPED_PACKAGE_AMOUNT_PRECEDENCE_V1",
    conflict: components.some(
      ({ canonicalAmountKeys: keys }) => keys.length > 1
    ),
    components,
    displayValues: unique(entries.map(({ displayValue }) => displayValue)).sort(
      (left, right) => left.localeCompare(right, "de-AT")
    ),
  };
}

function roleLabel(role) {
  return (
    {
      MAIN_POLICY: "Hauptpolizze",
      SUPPLEMENT: "Zusatzvertrag",
      ENDORSEMENT: "Nachtrag / Änderung",
      TERMS: "Bedingungen",
      OTHER: "Sonstiges",
    }[role] || role
  );
}

function summarizePackage(
  entries,
  {
    referenceEntries = entries,
    searchAudit = null,
    atomicFacts = [],
    referenceAtomicFacts = atomicFacts,
  } = {}
) {
  const evidenceEntries = entries.filter(({ row }) => isEvidenceRow(row));
  if (evidenceEntries.length === 0) {
    if (
      [
        SEARCH_DISPOSITION.CONTROLLED_NOT_FOUND,
        SEARCH_DISPOSITION.VERIFIED_NOT_FOUND,
      ].includes(searchAudit?.disposition)
    ) {
      const assumedNotIncluded =
        searchAudit.comparisonTreatment === "ASSUMED_NOT_INCLUDED_V1";
      return {
        evidenceFound: false,
        documentedContent:
          searchAudit.disposition === SEARCH_DISPOSITION.VERIFIED_NOT_FOUND
            ? "IM VOLLSTÄNDIG GEPRÜFTEN BEREITGESTELLTEN PAKET NICHT GEFUNDEN"
            : "IM VOLLSTÄNDIGEN KONTROLLIERTEN SUCHLAUF DES BEREITGESTELLTEN PAKETS NICHT GEFUNDEN",
        coverage: assumedNotIncluded
          ? "Für diesen Vergleich als nicht enthalten angenommen"
          : NOT_DETERMINABLE,
        coverageAmount: NOT_DETERMINABLE,
        source: `Dokumentweite kontrollierte Suche über ${searchAudit.documentCount} Dokument(e) und ${searchAudit.physicalPagesChecked} physische Textseite(n); Suchplan: ${searchAudit.searchPlanIds.join(", ")}. Mit den ausgewiesenen Suchbegriffen wurde keine entsprechende Fundstelle ermittelt.`,
        reviewStatus: assumedNotIncluded
          ? "NICHT_GEFUNDEN_NACH_VOLLSTÄNDIGER_PRÜFUNG"
          : "KEIN_TREFFER_NACH_VOLLSTÄNDIGER_KONTROLLIERTER_SUCHE",
        searchDisposition: searchAudit.disposition,
        comparisonTreatment: searchAudit.comparisonTreatment,
        searchAudit,
        facts: [],
      };
    }
    return {
      evidenceFound: false,
      documentedContent: MISSING_EVIDENCE,
      coverage: NOT_DETERMINABLE,
      coverageAmount: NOT_DETERMINABLE,
      source: MISSING_EVIDENCE,
      reviewStatus: "UNGEKLÄRT",
      searchDisposition: SEARCH_DISPOSITION.INCOMPLETE,
      comparisonTreatment: null,
      searchAudit,
      facts: [],
    };
  }

  const facts = evidenceEntries.map(({ document, row }) => ({
    documentUuid: document.uuid,
    documentName: document.originalName,
    role: document.role,
    documentStatus: document.documentStatus,
    documentedContent: row.documentedContent,
    coverage: row.coverage,
    coverageAmount: row.coverageAmount,
    source: row.source,
    reviewStatus: row.reviewStatus,
  }));
  const coverageValues = unique(
    facts
      .map(({ coverage }) => coverage)
      .filter((value) => normalized(value) !== normalized(NOT_DETERMINABLE))
  );
  const amountValues = unique(
    facts
      .map(({ coverageAmount }) => coverageAmount)
      .filter((value) => normalized(value) !== normalized(NOT_DETERMINABLE))
  );
  const amountKeys = unique(canonicalAmountKeys(facts, referenceEntries));
  const categoryIds = unique(evidenceEntries.map(({ row }) => row.categoryId));
  const categoryId = categoryIds.length === 1 ? categoryIds[0] : null;
  const vs25AmountReconciliation = vs25AuthorityLimitReconciliationAudit({
    categoryId,
    facts,
    referenceEntries,
    referenceAtomicFacts,
  });
  const componentAmountComparison = explicitComponentScopedAmountComparison(
    facts,
    atomicFacts,
    referenceEntries,
    categoryId
  );
  const amountConflict = componentAmountComparison
    ? componentAmountComparison.conflict
    : amountKeys.length > 1;
  const unresolvedPrecedence = coverageValues.length > 1 || amountConflict;
  const reviewStatus = facts.some(
    ({ reviewStatus: status }) => status === "WIDERSPRÜCHLICH"
  )
    ? "WIDERSPRÜCHLICH"
    : unresolvedPrecedence
      ? "RANGFOLGE_PRÜFEN"
      : facts.every(({ reviewStatus: status }) => status === "BELEGT")
        ? "BELEGT"
        : "TEILBELEGT";

  return {
    evidenceFound: true,
    documentedContent: facts
      .map(
        (fact) =>
          `[${fact.documentName} · ${roleLabel(fact.role)}] ${fact.documentedContent}`
      )
      .join("\n"),
    coverage:
      coverageValues.length === 0
        ? NOT_DETERMINABLE
        : coverageValues.length === 1
          ? coverageValues[0]
          : "Mehrere dokumentbezogene Werte – Rangfolge prüfen",
    coverageAmount:
      amountKeys.length === 0
        ? NOT_DETERMINABLE
        : componentAmountComparison
          ? componentAmountComparison.conflict
            ? "Mehrere komponentenbezogene Werte – Rangfolge prüfen"
            : componentAmountComparison.displayValues.join("; ")
          : amountKeys.length === 1
            ? amountValues.reduce(
                (selected, candidate) =>
                  candidate.length > selected.length ? candidate : selected,
                amountValues[0]
              )
            : "Mehrere dokumentbezogene Werte – Rangfolge prüfen",
    source: facts
      .map(
        (fact) =>
          `[${fact.documentName} · ${roleLabel(fact.role)}] ${fact.source}`
      )
      .join("\n"),
    reviewStatus,
    searchDisposition: SEARCH_DISPOSITION.RELEVANT_FOUND,
    comparisonTreatment: null,
    ...(componentAmountComparison
      ? { amountComparison: componentAmountComparison }
      : {}),
    ...(vs25AmountReconciliation ? { vs25AmountReconciliation } : {}),
    searchAudit,
    facts,
  };
}

function comparableDocumentedContent(fact) {
  const text = String(fact?.documentedContent || "");
  const prefix = {
    PROPOSAL: "Vorschlag (PROPOSED_ONLY):",
    FRAMEWORK_TERMS: "Rahmenbedingung (FRAMEWORK_TERMS):",
  }[fact?.documentStatus];
  return prefix && text.startsWith(prefix)
    ? text.slice(prefix.length).trimStart()
    : text;
}

function statusNeutralComparable(packageSummary) {
  const unique = new Map();
  for (const fact of packageSummary.facts) {
    const comparableFact = {
      documentedContent: normalized(comparableDocumentedContent(fact)),
      coverage: normalized(fact.coverage),
      coverageAmount: normalized(fact.coverageAmount),
    };
    unique.set(JSON.stringify(comparableFact), comparableFact);
  }
  return [...unique.values()].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right), "de-AT")
  );
}

function comparable(packageSummary) {
  return packageSummary.facts
    .map((fact) => ({
      documentedContent: normalized(fact.documentedContent),
      coverage: normalized(fact.coverage),
      coverageAmount: normalized(fact.coverageAmount),
      documentStatus: fact.documentStatus,
    }))
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right), "de-AT")
    );
}

function comparePackages(packageA, packageB) {
  const completeNotFound = (packageSummary) =>
    [
      SEARCH_DISPOSITION.CONTROLLED_NOT_FOUND,
      SEARCH_DISPOSITION.VERIFIED_NOT_FOUND,
    ].includes(packageSummary?.searchDisposition);
  const absentA = completeNotFound(packageA);
  const absentB = completeNotFound(packageB);
  if (absentA && absentB)
    return {
      outcome: "BEIDSEITIG_VOLLSTÄNDIG_NICHT_GEFUNDEN",
      difference:
        "In beiden vollständig kontrolliert geprüften bereitgestellten Paketen wurde mit den ausgewiesenen Suchplänen keine entsprechende Fundstelle ermittelt. Das belegt weder ausdrückliche Gleichheit noch einen ausdrücklichen Ausschluss.",
    };
  if (packageA.evidenceFound && absentB)
    return {
      outcome: "A_BELEGT_B_VOLLSTÄNDIG_NICHT_GEFUNDEN",
      difference:
        "Paket A enthält belegten Inhalt; der vollständige kontrollierte Suchlauf für Paket B blieb ohne entsprechende Fundstelle. Die Punktentscheidung darf daraus nur eine ausdrücklich freigegebene fachliche Wirkung ableiten.",
    };
  if (absentA && packageB.evidenceFound)
    return {
      outcome: "B_BELEGT_A_VOLLSTÄNDIG_NICHT_GEFUNDEN",
      difference:
        "Paket B enthält belegten Inhalt; der vollständige kontrollierte Suchlauf für Paket A blieb ohne entsprechende Fundstelle. Die Punktentscheidung darf daraus nur eine ausdrücklich freigegebene fachliche Wirkung ableiten.",
    };
  if (!packageA.evidenceFound && !packageB.evidenceFound)
    return {
      outcome: "BEIDSEITIG_KEIN_BELEG",
      difference:
        "Beidseitig keine belegte Fundstelle; daraus folgt keine Deckungsaussage.",
    };
  if (packageA.evidenceFound && !packageB.evidenceFound)
    return {
      outcome: "NUR_A_BELEGT",
      difference:
        "Nur Paket A enthält belegten Inhalt. Ein automatischer Vorteilsschluss ist nicht zulässig.",
    };
  if (!packageA.evidenceFound && packageB.evidenceFound)
    return {
      outcome: "NUR_B_BELEGT",
      difference:
        "Nur Paket B enthält belegten Inhalt. Ein automatischer Vorteilsschluss ist nicht zulässig.",
    };
  const comparableView =
    packageA.reviewStatus === "BELEGT" &&
    packageB.reviewStatus === "BELEGT" &&
    [...packageA.facts, ...packageB.facts].some(({ documentStatus }) =>
      ["FRAMEWORK_TERMS", "PROPOSAL"].includes(documentStatus)
    )
      ? statusNeutralComparable
      : comparable;
  if (
    JSON.stringify(comparableView(packageA)) ===
    JSON.stringify(comparableView(packageB))
  )
    return {
      outcome: "INHALTLICH_GLEICH",
      difference:
        "Die belegten dokumentbezogenen Werte sind in beiden Paketen gleich.",
    };
  return {
    outcome: "UNTERSCHIED_FACHLICH_PRÜFEN",
    difference:
      "Die belegten Inhalte unterscheiden sich. Vorteil, Rangfolge und Vertragswirkung sind fachlich zu prüfen.",
  };
}

function readJsonIfPresent(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function completeTextExtraction(documentArtifact) {
  const extraction = documentArtifact?.document?.pdfExtraction;
  return Boolean(
    documentArtifact?.schemaVersion === 1 &&
      extraction?.complete === true &&
      Number.isInteger(extraction.totalPages) &&
      extraction.totalPages > 0 &&
      extraction.processedPages === extraction.totalPages &&
      extraction.pagesWithText === extraction.totalPages
  );
}

function completeCategoryTechnicalContract({
  documentArtifact,
  worksheet,
  materializedEvidence,
  targets,
  report,
}) {
  const componentCount = Number(worksheet?.summary?.componentCount || 0);
  return Boolean(
    completeTextExtraction(documentArtifact) &&
      worksheet?.document?.physicalPages ===
        documentArtifact.document.pdfExtraction.totalPages &&
      ["PASS", "TECHNICAL_PASS_REVIEW_REQUIRED"].includes(report?.status) &&
      Number.isInteger(report?.rowCount) &&
      report.rowCount > 0 &&
      report.rowCount === report.expectedRowCount &&
      report?.gates &&
      Object.values(report.gates).length > 0 &&
      Object.values(report.gates).every(Boolean) &&
      componentCount > 0 &&
      materializedEvidence?.judgements?.length === componentCount &&
      targets?.length === componentCount
  );
}

function deterministicTerminalRejectionAudit({
  requirement,
  component,
  target,
}) {
  const certifiedTarget = certifiedTerminalTarget({
    categoryView: String(requirement?.id || "").split("-")[0],
    requirementId: requirement?.id,
    componentId: component?.id,
  });
  const occurrences = component?.occurrences;
  const rejections = target?.serverRejectedCandidates;
  if (
    !certifiedTarget ||
    !Array.isArray(occurrences) ||
    occurrences.length === 0 ||
    component?.occurrenceCount !== occurrences.length ||
    !Array.isArray(target?.candidates) ||
    target.candidates.length !== 0 ||
    !Array.isArray(target?.unresolvedCandidateIds) ||
    target.unresolvedCandidateIds.length !== 0 ||
    !Array.isArray(rejections) ||
    rejections.length !== occurrences.length
  )
    return null;

  const occurrenceIds = [
    ...new Set(occurrences.map(({ candidateId }) => candidateId)),
  ].sort();
  const rejectionIds = [
    ...new Set(rejections.map(({ candidateId }) => candidateId)),
  ].sort();
  const occurrenceById = new Map(
    occurrences.map((occurrence) => [occurrence.candidateId, occurrence])
  );
  if (
    occurrenceIds.length !== occurrences.length ||
    rejectionIds.length !== rejections.length ||
    JSON.stringify(occurrenceIds) !== JSON.stringify(rejectionIds) ||
    rejections.some((rejection) => {
      const occurrence = occurrenceById.get(rejection?.candidateId);
      const occurrenceProof = terminalOccurrenceProof(
        certifiedTarget,
        occurrence
      );
      return (
        !occurrenceProof ||
        rejection?.reason !== "TRIAGE_MENTION_ONLY" ||
        rejection?.terminalRejectionContractId !== certifiedTarget.contractId ||
        rejection?.occurrenceDigestContractId !==
          certifiedTarget.occurrenceDigestContractId ||
        rejection?.decisionOwner !== "SERVER" ||
        rejection?.decisionBasis !== certifiedTarget.decisionBasis ||
        !certifiedTarget.sectionScopeSources.includes(
          rejection?.sectionScopeSource
        ) ||
        !Number.isInteger(rejection?.physicalPageNumber) ||
        rejection.physicalPageNumber < 1 ||
        rejection.physicalPageNumber !== occurrenceProof.physicalPageNumber ||
        rejection?.sectionScopeSource !== occurrenceProof.sectionScopeSource ||
        JSON.stringify(rejection?.observedScopeKeys) !==
          JSON.stringify(occurrenceProof.observedScopeKeys) ||
        (rejection?.scopeProofMode || null) !==
          certifiedTarget.scopeProofMode ||
        rejection?.occurrenceDigestSha256 !==
          terminalOccurrenceDigest(
            {
              ...occurrence,
              ...(rejection?.scopeProofMode
                ? { scopeProofMode: rejection.scopeProofMode }
                : {}),
            },
            certifiedTarget.occurrenceDigestContractId
          )
      );
    })
  )
    return null;

  return {
    schemaVersion: 3,
    contractId: certifiedTarget.contractId,
    requirementId: requirement?.id || null,
    componentId: component?.id || null,
    decisionOwner: "SERVER",
    decisionBasis: certifiedTarget.decisionBasis,
    proofMode: certifiedTarget.auditProofMode,
    rejectedOccurrenceCount: rejections.length,
    rejectedCandidateIds: rejectionIds,
    rejectionDigestContractId: TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
    rejectionDigestSha256: terminalRejectionSetDigest(rejections),
    rejections: rejections
      .map(
        ({
          candidateId,
          terminalRejectionContractId,
          occurrenceDigestContractId,
          decisionBasis,
          occurrenceDigestSha256,
          physicalPageNumber,
          sectionScopeSource,
          observedScopeKeys,
          scopeProofMode,
        }) => ({
          candidateId,
          terminalRejectionContractId,
          occurrenceDigestContractId,
          decisionBasis,
          occurrenceDigestSha256,
          physicalPageNumber,
          sectionScopeSource,
          observedScopeKeys,
          ...(scopeProofMode ? { scopeProofMode } : {}),
        })
      )
      .sort((left, right) =>
        left.candidateId.localeCompare(right.candidateId, "de-AT")
      ),
  };
}

function componentSearchAudit({
  document,
  documentArtifact,
  worksheet,
  materializedEvidence,
  targets,
  report,
  requirement,
  component,
  judgement,
  target,
}) {
  const extraction = documentArtifact?.document?.pdfExtraction || {};
  const searchPlanId = `${worksheet?.catalog?.id || "unknown"}/${requirement?.id || judgement?.requirementId}/${component?.id || judgement?.componentId}`;
  const zeroOccurrenceTerminal =
    component?.terminalState === "NO_CONTROLLED_CANDIDATE" &&
    component?.occurrenceCount === 0 &&
    Array.isArray(component?.occurrences) &&
    component.occurrences.length === 0;
  const zeroCandidateTerminal =
    Array.isArray(target?.candidates) &&
    target.candidates.length === 0 &&
    Array.isArray(target?.serverRejectedCandidates) &&
    target.serverRejectedCandidates.length === 0 &&
    Array.isArray(target?.unresolvedCandidateIds) &&
    target.unresolvedCandidateIds.length === 0;
  const terminalRejectionAudit = deterministicTerminalRejectionAudit({
    requirement,
    component,
    target,
  });
  const deterministicOutOfCategoryTerminal = Boolean(
    terminalRejectionAudit?.contractId ===
      DETERMINISTIC_OTHER_CATEGORY_TERMINAL_CONTRACT_ID
  );
  const deterministicCoverageOnlyObjectClassificationTerminal = Boolean(
    terminalRejectionAudit?.contractId ===
      DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASSIFICATION_TERMINAL_CONTRACT_ID
  );
  const deterministicCoverageOnlyObjectClassExclusionTerminal = Boolean(
    terminalRejectionAudit?.contractId ===
      DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_CONTRACT_ID
  );
  const deterministicNonContractualRiskInformationTerminal = Boolean(
    terminalRejectionAudit?.contractId ===
      DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_CONTRACT_ID
  );
  const deterministicPostLossScaffoldingCostTerminal = Boolean(
    terminalRejectionAudit?.contractId ===
      DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID
  );
  const deterministicLw20NonTargetOccurrenceTerminal = Boolean(
    terminalRejectionAudit?.contractId ===
      DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID
  );
  const deterministicVs22NonTargetWasteOccurrenceTerminal = Boolean(
    terminalRejectionAudit?.contractId ===
      DETERMINISTIC_VS22_NON_TARGET_WASTE_OCCURRENCE_TERMINAL_CONTRACT_ID
  );
  const deterministicVs25SumEqualizationTerminal = Boolean(
    terminalRejectionAudit?.contractId ===
      DETERMINISTIC_VS25_SUM_EQUALIZATION_TERMINAL_CONTRACT_ID
  );
  const deterministicRejectionTerminal = Boolean(terminalRejectionAudit);
  const lw20DefaultExclusionOverrideAudit =
    buildLw20DefaultExclusionOverrideAudit({
      document,
      documentArtifact,
      requirementId: requirement?.id,
      componentId: component?.id,
    });
  const lw20DefaultExclusionSourceAudit = buildLw20DefaultExclusionSourceAudit({
    document,
    documentArtifact,
    requirement,
    component,
    judgement,
    target,
  });
  const serverNegativeTerminal = Boolean(
    judgement?.evidencePresence === "NOT_FOUND" &&
      judgement?.coverageEffect === "UNKNOWN" &&
      judgement?.conflictState === "NONE" &&
      judgement?.decisionOwner === "SERVER" &&
      Array.isArray(judgement?.selectedCandidateIds) &&
      judgement.selectedCandidateIds.length === 0 &&
      Array.isArray(judgement?.unresolvedCandidateIds) &&
      judgement.unresolvedCandidateIds.length === 0
  );
  const negativeSearchApproved = [
    "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
    "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1",
  ].includes(requirement?.negativeSearchPolicy);
  const completeControlledSearch = Boolean(
    negativeSearchApproved &&
      completeCategoryTechnicalContract({
        documentArtifact,
        worksheet,
        materializedEvidence,
        targets,
        report,
      }) &&
      ((zeroOccurrenceTerminal && zeroCandidateTerminal) ||
        deterministicRejectionTerminal) &&
      serverNegativeTerminal
  );
  const verified = Boolean(
    completeControlledSearch &&
      requirement?.negativeSearchPolicy ===
        "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1" &&
      requirement?.absenceCertification?.requirementDigest
  );
  const comparisonTreatment =
    verified &&
    requirement?.absenceComparisonPolicy ===
      "ASSUME_NOT_INCLUDED_AFTER_COMPLETE_ZERO_OCCURRENCE_V1"
      ? "ASSUMED_NOT_INCLUDED_V1"
      : completeControlledSearch
        ? "DOCUMENTATION_ONLY_V1"
        : null;
  return {
    disposition:
      judgement?.evidencePresence === "FOUND"
        ? SEARCH_DISPOSITION.RELEVANT_FOUND
        : verified
          ? SEARCH_DISPOSITION.VERIFIED_NOT_FOUND
          : completeControlledSearch
            ? SEARCH_DISPOSITION.CONTROLLED_NOT_FOUND
            : SEARCH_DISPOSITION.INCOMPLETE,
    comparisonTreatment,
    negativeSearchPolicy: requirement?.negativeSearchPolicy || null,
    absenceMeaning: requirement?.absenceMeaning || null,
    comparisonPolicy: requirement?.absenceComparisonPolicy || null,
    absenceCertification: requirement?.absenceCertification || null,
    requirementContract: worksheetRequirementContract(worksheet, requirement),
    searchPlanId,
    documentUuid: document.uuid,
    catalogId: worksheet?.catalog?.id || null,
    physicalPagesChecked: completeTextExtraction(documentArtifact)
      ? extraction.totalPages
      : 0,
    totalPhysicalPages: Number(extraction.totalPages || 0),
    aliases: component?.aliases || [],
    conceptSearchIds: (component?.conceptSearches || []).map(({ id }) => id),
    ...(terminalRejectionAudit ? { terminalRejectionAudit } : {}),
    ...(lw20DefaultExclusionOverrideAudit
      ? { lw20DefaultExclusionOverrideAudit }
      : {}),
    ...(lw20DefaultExclusionSourceAudit
      ? { lw20DefaultExclusionSourceAudit }
      : {}),
    gates: {
      negativeSearchApproved,
      certifiedNegativeSearch: verified,
      completeTextExtraction: completeTextExtraction(documentArtifact),
      completeCategoryTechnicalContract: completeCategoryTechnicalContract({
        documentArtifact,
        worksheet,
        materializedEvidence,
        targets,
        report,
      }),
      zeroOccurrenceTerminal,
      zeroCandidateTerminal,
      serverNegativeTerminal,
      ...(deterministicOutOfCategoryTerminal
        ? { deterministicOutOfCategoryTerminal: true }
        : {}),
      ...(deterministicCoverageOnlyObjectClassificationTerminal
        ? { deterministicCoverageOnlyObjectClassificationTerminal: true }
        : {}),
      ...(deterministicCoverageOnlyObjectClassExclusionTerminal
        ? { deterministicCoverageOnlyObjectClassExclusionTerminal: true }
        : {}),
      ...(deterministicNonContractualRiskInformationTerminal
        ? { deterministicNonContractualRiskInformationTerminal: true }
        : {}),
      ...(deterministicPostLossScaffoldingCostTerminal
        ? { deterministicPostLossScaffoldingCostTerminal: true }
        : {}),
      ...(deterministicLw20NonTargetOccurrenceTerminal
        ? { deterministicLw20NonTargetOccurrenceTerminal: true }
        : {}),
      ...(deterministicVs22NonTargetWasteOccurrenceTerminal
        ? { deterministicVs22NonTargetWasteOccurrenceTerminal: true }
        : {}),
      ...(deterministicVs25SumEqualizationTerminal
        ? { deterministicVs25SumEqualizationTerminal: true }
        : {}),
    },
  };
}

function materializeAtomicFacts({
  document,
  worksheet,
  materializedEvidence,
  requestedFields,
  targets,
  documentArtifact,
  report,
}) {
  if (!worksheet || !materializedEvidence || !requestedFields || !targets)
    return [];
  const requirements = new Map(
    (worksheet.requirements || []).map((requirement) => [
      requirement.id,
      requirement,
    ])
  );
  const fieldResults = new Map(
    (requestedFields.requirements || []).map((requirement) => [
      requirement.requirementId,
      requirement,
    ])
  );
  const targetsById = new Map(
    (targets || []).map((target) => [target.targetId, target])
  );
  return (materializedEvidence.judgements || []).map((judgement) => {
    const requirement = requirements.get(judgement.requirementId);
    const component = requirement?.components?.find(
      ({ id }) => id === judgement.componentId
    );
    const scopeContract = componentScopeContract(requirement, component);
    const fieldResult = fieldResults.get(judgement.requirementId) || {
      requestedFieldStatus: "NOT_EVALUATED",
      fields: [],
    };
    const selectedCandidateIds = judgement.selectedCandidateIds || [];
    const selectedSet = new Set(selectedCandidateIds);
    const fields = (fieldResult.fields || []).map((field) => {
      const facts = (field.facts || [])
        .filter((fact) =>
          projectedFieldFactAppliesToAtom({
            fact,
            requirementId: judgement.requirementId,
            componentId: judgement.componentId,
            selectedCandidateIds,
          })
        )
        .map((fact) => {
          const sourceBoundFeC07Field =
            requirement?.id === "FE-C07" &&
            component?.id === FE_C07_COMPONENT_ID &&
            fact?.source;
          return {
            ...fact,
            ...(sourceBoundFeC07Field
              ? {
                  source: {
                    ...fact.source,
                    exactTextSha256: sha256Text(fact.source.exactText),
                    ...(document.sha256
                      ? { documentFingerprint: document.sha256 }
                      : {}),
                  },
                }
              : {}),
          };
        });
      const rawAbsenceAudit =
        requirement?.id === "FE-C07" &&
        component?.id === FE_C07_COMPONENT_ID &&
        field.field === "condition" &&
        field.status === "NOT_FOUND" &&
        facts.length === 0 &&
        selectedSet.has(field.absenceAudit?.source?.candidateId) &&
        validFeC07ConditionAbsenceAudit(field.absenceAudit)
          ? field.absenceAudit
          : null;
      const absenceAudit = rawAbsenceAudit
        ? {
            ...rawAbsenceAudit,
            source: {
              ...rawAbsenceAudit.source,
              ...(document.sha256
                ? { documentFingerprint: document.sha256 }
                : {}),
            },
          }
        : null;
      return {
        field: field.field,
        status: facts.length > 0 ? field.status : "NOT_FOUND",
        ...(facts.length === 0 && absenceAudit ? { absenceAudit } : {}),
        facts,
      };
    });
    const requestedFieldNames = Array.isArray(requirement?.requestedFields)
      ? requirement.requestedFields
      : [];
    const requestedAtomFields = fields.filter(({ field }) =>
      requestedFieldNames.includes(field)
    );
    const evaluatedRequestedAtomFields = requestedAtomFields.filter(
      ({ status }) => status !== "NOT_EVALUATED"
    );
    const foundRequestedAtomFieldCount = requestedAtomFields.filter(
      ({ status }) => status === "FOUND"
    ).length;
    let requestedFieldStatus = "NOT_REQUIRED";
    if (requestedAtomFields.length > 0) {
      if (evaluatedRequestedAtomFields.length === 0) {
        requestedFieldStatus = "NOT_EVALUATED";
      } else if (foundRequestedAtomFieldCount === requestedAtomFields.length) {
        requestedFieldStatus = "COMPLETE";
      } else if (
        requestedAtomFields.some(({ status }) => status === "PARTIAL") ||
        foundRequestedAtomFieldCount > 0 ||
        evaluatedRequestedAtomFields.length < requestedAtomFields.length
      ) {
        requestedFieldStatus = "PARTIAL";
      } else {
        requestedFieldStatus = "NOT_FOUND";
      }
    }
    const target = targetsById.get(judgement.targetId);
    const selectedTargetCandidates = (target?.candidates || []).filter(
      ({ candidateId }) => selectedSet.has(candidateId)
    );
    const sourceBoundFormulaCandidates = (() => {
      const contracts =
        requirement?.supportingCoverageConditionFormulaEvidenceContracts || [];
      if (contracts.length === 0) return [];
      if (
        selectedSet.size !== selectedCandidateIds.length ||
        selectedTargetCandidates.length !== selectedSet.size
      )
        throw new Error("COVERAGE_CONDITION_FORMULA_TARGET_REPLAY_INVALID");
      const occurrences = component?.occurrences || [];
      return selectedTargetCandidates.map((candidate) => {
        const matches = occurrences.filter(
          ({ candidateId }) => candidateId === candidate.candidateId
        );
        if (matches.length !== 1)
          throw new Error("COVERAGE_CONDITION_FORMULA_TARGET_REPLAY_INVALID");
        const [occurrence] = matches;
        if (
          candidate.physicalPageNumber !==
            (occurrence.physicalPageNumber || occurrence.pageNumber) ||
          candidate.documentStart !== occurrence.documentStart ||
          candidate.documentEnd !== occurrence.documentEnd ||
          candidate.exactText !== occurrence.exactText
        )
          throw new Error("COVERAGE_CONDITION_FORMULA_TARGET_REPLAY_INVALID");
        return occurrence;
      });
    })();
    const supportingCoverageConditionFormulaProofs = (
      requirement?.supportingCoverageConditionFormulaEvidenceContracts || []
    )
      .map((contract) =>
        buildSourceBoundCoverageConditionFormulaProof({
          contract,
          documentArtifact,
          targetCandidates: sourceBoundFormulaCandidates,
        })
      )
      .filter(Boolean)
      .sort((left, right) => left.proofDigest.localeCompare(right.proofDigest));
    const supportingObjectMembershipProofs = (() => {
      const contracts =
        requirement?.supportingObjectMembershipEvidenceContracts || [];
      const proofs = requirement?.supportingObjectMembershipProofs || [];
      if (contracts.length === 0) return [];
      const expected = buildSupportingObjectMembershipProofsFromArtifact({
        documentArtifact,
        categoryView: worksheet?.catalog?.categoryView,
        catalogId: worksheet?.catalog?.id,
        requirement,
      });
      const actual = [...proofs].sort((left, right) =>
        left.proofDigest.localeCompare(right.proofDigest)
      );
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error("OBJECT_MEMBERSHIP_SUPPORT_PROOF_REPLAY_INVALID");
      return JSON.parse(JSON.stringify(expected));
    })();
    const supportingScopedPackageReferenceProofs = (() => {
      const contracts =
        requirement?.supportingScopedPackageReferenceEvidenceContracts || [];
      const proofs = requirement?.supportingScopedPackageReferenceProofs || [];
      if (contracts.length === 0) return [];
      const expected = contracts
        .flatMap((contract) =>
          buildSourceBoundScopedPackageReferenceProofs({
            contract,
            documentArtifact,
          })
        )
        .sort((left, right) =>
          left.proofDigest.localeCompare(right.proofDigest)
        );
      const actual = [...proofs].sort((left, right) =>
        left.proofDigest.localeCompare(right.proofDigest)
      );
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error("SCOPED_PACKAGE_REFERENCE_PROOF_REPLAY_INVALID");
      return JSON.parse(JSON.stringify(actual));
    })();
    const supportingReferencedTermsIdentityProofs = (() => {
      const contracts =
        requirement?.supportingReferencedTermsIdentityEvidenceContracts || [];
      const proofs = requirement?.supportingReferencedTermsIdentityProofs || [];
      if (contracts.length === 0) return [];
      const expected = contracts
        .flatMap((contract) =>
          buildSourceBoundReferencedTermsIdentityProofs({
            contract,
            documentArtifact,
          })
        )
        .sort((left, right) =>
          left.proofDigest.localeCompare(right.proofDigest)
        );
      const actual = [...proofs].sort((left, right) =>
        left.proofDigest.localeCompare(right.proofDigest)
      );
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error("REFERENCED_TERMS_IDENTITY_PROOF_REPLAY_INVALID");
      return JSON.parse(JSON.stringify(actual));
    })();
    const sources = selectedTargetCandidates.map((candidate) => {
      const {
        candidateId,
        physicalPageNumber,
        printedPageLabel,
        exactText,
        candidateBinding,
        deterministicBindingBasis,
        comparisonScopeKey,
      } = candidate;
      const conditionSource = conditionCheckSource(candidate);
      const sourceRangeAvailable =
        Number.isInteger(candidate.documentStart) &&
        Number.isInteger(candidate.documentEnd);
      const conditionRangeAvailable =
        Number.isInteger(conditionSource.documentStart) &&
        Number.isInteger(conditionSource.documentEnd);
      return {
        candidateId,
        physicalPageNumber,
        printedPageLabel,
        exactText,
        conditionCheckText: conditionSource.text,
        ...(document.sha256 ? { documentFingerprint: document.sha256 } : {}),
        ...(Number.isInteger(physicalPageNumber)
          ? { candidateIdentityPageNumber: physicalPageNumber }
          : {}),
        ...(sourceRangeAvailable
          ? {
              documentStart: candidate.documentStart,
              documentEnd: candidate.documentEnd,
              exactTextSha256: sha256Text(exactText),
            }
          : {}),
        ...(conditionRangeAvailable
          ? {
              conditionCheckDocumentStart: conditionSource.documentStart,
              conditionCheckDocumentEnd: conditionSource.documentEnd,
              conditionCheckTextSha256: sha256Text(conditionSource.text),
            }
          : {}),
        ...(candidateBinding ? { candidateBinding } : {}),
        ...(deterministicBindingBasis ? { deterministicBindingBasis } : {}),
        ...(comparisonScopeKey ? { comparisonScopeKey } : {}),
        ...(candidate.objectScopeProof
          ? {
              objectScopeProof: JSON.parse(
                JSON.stringify(candidate.objectScopeProof)
              ),
            }
          : {}),
        ...(candidate.objectMembershipProof
          ? {
              objectMembershipProof: JSON.parse(
                JSON.stringify(candidate.objectMembershipProof)
              ),
            }
          : {}),
      };
    });
    const comparisonScopeKeys = unique(
      sources.map(({ comparisonScopeKey }) => comparisonScopeKey)
    ).sort();
    return {
      requirementId: judgement.requirementId,
      componentId: judgement.componentId,
      componentLabel: component?.label || judgement.componentId,
      factRole: component?.factRole || target?.factRole || "UNKNOWN",
      documentUuids: [document.uuid],
      documentRole: document.role,
      documentStatus: document.documentStatus,
      evidencePresence: judgement.evidencePresence,
      coverageEffect: judgement.coverageEffect,
      conflictState: judgement.conflictState,
      selectedScopePicture: judgement.selectedScopePicture,
      documentApplicability: judgement.documentApplicability,
      selectedCandidateIds,
      unresolvedCandidateIds: judgement.unresolvedCandidateIds || [],
      requestedFieldStatus,
      fields,
      sources,
      ...(comparisonScopeKeys.length > 0 ? { comparisonScopeKeys } : {}),
      componentSatisfactionPolicy:
        requirement?.componentSatisfactionPolicy || "ALL",
      coverageAggregationPolicy: requirement?.coverageAggregationPolicy || null,
      ...(requirement?.componentFamilyContract
        ? { componentFamilyContract: requirement.componentFamilyContract }
        : {}),
      ...(requirement?.supportingObjectMembershipEvidenceContracts?.length > 0
        ? {
            supportingObjectMembershipEvidenceContracts:
              requirement.supportingObjectMembershipEvidenceContracts,
            supportingObjectMembershipProofs,
          }
        : {}),
      ...(requirement?.supportingCoverageConditionFormulaEvidenceContracts
        ?.length > 0
        ? {
            supportingCoverageConditionFormulaEvidenceContracts:
              requirement.supportingCoverageConditionFormulaEvidenceContracts,
            supportingCoverageConditionFormulaProofs,
          }
        : {}),
      ...(requirement?.supportingScopedPackageReferenceEvidenceContracts
        ?.length > 0
        ? {
            supportingScopedPackageReferenceEvidenceContracts:
              requirement.supportingScopedPackageReferenceEvidenceContracts,
            supportingScopedPackageReferenceProofs,
          }
        : {}),
      ...(requirement?.supportingReferencedTermsIdentityEvidenceContracts
        ?.length > 0
        ? {
            supportingReferencedTermsIdentityEvidenceContracts:
              requirement.supportingReferencedTermsIdentityEvidenceContracts,
            supportingReferencedTermsIdentityProofs,
          }
        : {}),
      ...(requirement?.packageActivatedObjectMembershipAuditContract
        ? {
            packageActivatedObjectMembershipAuditContract:
              requirement.packageActivatedObjectMembershipAuditContract,
          }
        : {}),
      ...(requirement?.membershipConditionScopeComparisonContract
        ? {
            membershipConditionScopeComparisonContract:
              requirement.membershipConditionScopeComparisonContract,
          }
        : {}),
      ...(component?.objectScopeEvidenceContract
        ? { objectScopeEvidenceContract: component.objectScopeEvidenceContract }
        : {}),
      ...(component?.objectScopeIdentityComparisonContract
        ? {
            objectScopeIdentityComparisonContract:
              component.objectScopeIdentityComparisonContract,
          }
        : {}),
      scopePolicy: scopeContract.scopePolicy,
      requestedFields: Array.isArray(requirement?.requestedFields)
        ? [...requirement.requestedFields]
        : [],
      optionalFields: Array.isArray(requirement?.optionalFields)
        ? requirement.optionalFields.filter(
            (field) => !(requirement?.requestedFields || []).includes(field)
          )
        : [],
      requirementContractDigest:
        worksheetRequirementContract(worksheet, requirement)?.digest || null,
      declaredComponents: (requirement?.components || []).map(
        ({ id, factRole }) => ({ id, factRole })
      ),
      searchAudit: componentSearchAudit({
        document,
        documentArtifact,
        worksheet,
        materializedEvidence,
        targets,
        report,
        requirement,
        component,
        judgement,
        target,
      }),
    };
  });
}

function readDocumentAnalysis(documentRun) {
  const documentArtifact = readJsonIfPresent(
    path.join(documentRun.outputDirectory, "document.private.json")
  );
  const categories = {};
  const atomicFacts = {};
  for (const categoryView of CATEGORY_ORDER) {
    const categoryDirectory = path.join(
      documentRun.outputDirectory,
      categoryView
    );
    const file = path.join(categoryDirectory, "result", "rows.private.json");
    if (!fs.existsSync(file))
      throw new Error(
        `COMPARISON_CATEGORY_RESULT_MISSING:${documentRun.document.uuid}:${categoryView}`
      );
    categories[categoryView] = JSON.parse(fs.readFileSync(file, "utf8"));
    const report = readJsonIfPresent(
      path.join(categoryDirectory, "result", "report.json")
    );
    atomicFacts[categoryView] = materializeAtomicFacts({
      document: documentRun.document,
      worksheet: readJsonIfPresent(
        path.join(categoryDirectory, "worksheet.private.json")
      ),
      materializedEvidence: readJsonIfPresent(
        path.join(categoryDirectory, "effects", "materialized.private.json")
      ),
      requestedFields: readJsonIfPresent(
        path.join(categoryDirectory, "result", "requested-fields.private.json")
      ),
      targets: readJsonIfPresent(
        path.join(categoryDirectory, "effects", "targets.private.json")
      ),
      documentArtifact,
      report,
    });
  }
  return { categories, atomicFacts };
}

function aggregatePackageSearchAudit({
  loadedRuns,
  side,
  categoryView,
  categoryId,
}) {
  const sideRuns = loadedRuns.filter(({ document }) => document.side === side);
  const perDocument = sideRuns.map((run) => {
    const atoms = (run.atomicFacts[categoryView] || []).filter(
      (atom) => atom.requirementId === categoryId
    );
    return {
      documentUuid: run.document.uuid,
      atoms,
      completeNotFound:
        atoms.length > 0 &&
        atoms.every((atom) =>
          [
            SEARCH_DISPOSITION.CONTROLLED_NOT_FOUND,
            SEARCH_DISPOSITION.VERIFIED_NOT_FOUND,
          ].includes(atom.searchAudit?.disposition)
        ),
      verified:
        atoms.length > 0 &&
        atoms.every(
          (atom) =>
            atom.searchAudit?.disposition ===
            SEARCH_DISPOSITION.VERIFIED_NOT_FOUND
        ),
    };
  });
  const completeNotFound =
    perDocument.length > 0 &&
    perDocument.every((entry) => entry.completeNotFound);
  const verified =
    perDocument.length > 0 && perDocument.every((entry) => entry.verified);
  const audits = perDocument.flatMap(({ atoms }) =>
    atoms.map(({ searchAudit }) => searchAudit).filter(Boolean)
  );
  const requirementContracts = unique(
    audits.map(({ requirementContract }) =>
      requirementContract ? JSON.stringify(requirementContract) : null
    )
  ).map((value) => JSON.parse(value));
  return {
    disposition: verified
      ? SEARCH_DISPOSITION.VERIFIED_NOT_FOUND
      : completeNotFound
        ? SEARCH_DISPOSITION.CONTROLLED_NOT_FOUND
        : SEARCH_DISPOSITION.INCOMPLETE,
    comparisonTreatment: verified
      ? audits.every(
          ({ comparisonTreatment }) =>
            comparisonTreatment === "ASSUMED_NOT_INCLUDED_V1"
        )
        ? "ASSUMED_NOT_INCLUDED_V1"
        : "DOCUMENTATION_ONLY_V1"
      : completeNotFound
        ? "DOCUMENTATION_ONLY_V1"
        : null,
    documentCount: perDocument.length,
    documentUuids: perDocument.map(({ documentUuid }) => documentUuid).sort(),
    physicalPagesChecked: unique(
      audits.map(
        ({ documentUuid, physicalPagesChecked }) =>
          `${documentUuid}:${physicalPagesChecked}`
      )
    ).reduce(
      (sum, value) => sum + Number(value.slice(value.lastIndexOf(":") + 1)),
      0
    ),
    searchPlanIds: unique(
      audits.map(({ searchPlanId }) => searchPlanId)
    ).sort(),
    requirementContract:
      requirementContracts.length === 1 ? requirementContracts[0] : null,
    components: audits,
  };
}

function buildComparisonResult(documentRuns, metadata = {}) {
  const loadedRuns = documentRuns.map((run) => ({
    ...run,
    ...readDocumentAnalysis(run),
  }));
  const packageEntries = Object.fromEntries(
    ["A", "B"].map((side) => [
      side,
      loadedRuns
        .filter(({ document }) => document.side === side)
        .flatMap(({ document, categories }) =>
          CATEGORY_ORDER.flatMap((categoryView) =>
            categories[categoryView].map((row) => ({ document, row }))
          )
        ),
    ])
  );
  const packageAtomicFacts = Object.fromEntries(
    ["A", "B"].map((side) => [
      side,
      loadedRuns
        .filter(({ document }) => document.side === side)
        .flatMap(({ atomicFacts }) =>
          CATEGORY_ORDER.flatMap(
            (categoryView) => atomicFacts[categoryView] || []
          )
        ),
    ])
  );
  const categories = CATEGORY_ORDER.map((categoryView) => {
    const byDocument = loadedRuns.map((run) => ({
      document: run.document,
      rows: run.categories[categoryView],
    }));
    const rowIds =
      byDocument[0]?.rows.map(({ categoryId }) => categoryId) || [];
    const rows = rowIds.map((categoryId) => {
      const entries = byDocument.map(({ document, rows: documentRows }) => {
        const row = documentRows.find(
          (candidate) => candidate.categoryId === categoryId
        );
        if (!row)
          throw new Error(
            `COMPARISON_ROW_MISSING:${document.uuid}:${categoryId}`
          );
        return { document, row };
      });
      const first = entries[0].row;
      const searchAuditA = aggregatePackageSearchAudit({
        loadedRuns,
        side: "A",
        categoryView,
        categoryId,
      });
      const searchAuditB = aggregatePackageSearchAudit({
        loadedRuns,
        side: "B",
        categoryView,
        categoryId,
      });
      const atomsA = loadedRuns
        .filter(({ document }) => document.side === "A")
        .flatMap(({ atomicFacts }) => atomicFacts[categoryView] || [])
        .filter(({ requirementId }) => requirementId === categoryId);
      const atomsB = loadedRuns
        .filter(({ document }) => document.side === "B")
        .flatMap(({ atomicFacts }) => atomicFacts[categoryView] || [])
        .filter(({ requirementId }) => requirementId === categoryId);
      const packageA = summarizePackage(
        entries.filter(({ document }) => document.side === "A"),
        {
          referenceEntries: packageEntries.A,
          referenceAtomicFacts: packageAtomicFacts.A,
          searchAudit: searchAuditA,
          atomicFacts: atomsA,
        }
      );
      const packageB = summarizePackage(
        entries.filter(({ document }) => document.side === "B"),
        {
          referenceEntries: packageEntries.B,
          referenceAtomicFacts: packageAtomicFacts.B,
          searchAudit: searchAuditB,
          atomicFacts: atomsB,
        }
      );
      const comparison = comparePackages(packageA, packageB);
      const expectedDocumentsA = loadedRuns
        .filter(({ document }) => document.side === "A")
        .map(({ document }) => document);
      const expectedDocumentsB = loadedRuns
        .filter(({ document }) => document.side === "B")
        .map(({ document }) => document);
      const pointDecision = decidePoint({
        categoryId,
        packageA,
        packageB,
        atomsA,
        atomsB,
        referenceAtomsA: packageAtomicFacts.A,
        referenceAtomsB: packageAtomicFacts.B,
        expectedDocumentsA,
        expectedDocumentsB,
      });
      const vs22SourceAtomDigestReplay =
        pointDecision.ruleId === VS22_HAZARDOUS_WASTE_PORTFOLIO_RULE_ID
          ? buildVs22SourceAtomDigestReplay({ categoryId, atomsA, atomsB })
          : null;
      const vs24SourceAtomDigestReplay =
        pointDecision.ruleId === VS24_SCAFFOLDING_COST_EQUALITY_RULE_ID
          ? buildVs24SourceAtomDigestReplay({ categoryId, atomsA, atomsB })
          : null;
      const vs25SourceAtomDigestReplay =
        pointDecision.ruleId === VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID
          ? buildVs25SourceAtomDigestReplay({
              categoryId,
              atomsA,
              atomsB,
              referenceAtomsA: packageAtomicFacts.A,
              referenceAtomsB: packageAtomicFacts.B,
              expectedDocumentsA,
              expectedDocumentsB,
            })
          : null;
      const membershipConditionScopeQualificationReplay =
        categoryView === "FE" && categoryId === "FE-C02"
          ? buildMembershipConditionScopeQualificationReplay({
              categoryView,
              categoryId,
              atomsA,
              atomsB,
              expectedDocumentsA,
              expectedDocumentsB,
            })
          : null;
      if (
        categoryView === "FE" &&
        categoryId === "FE-C02" &&
        !membershipConditionScopeQualificationReplay
      )
        throw new Error(
          "MEMBERSHIP_CONDITION_SCOPE_QUALIFICATION_REPLAY_UNAVAILABLE:FE-C02"
        );
      const specializedComparisonQualificationReplay =
        specializedComparisonContract(categoryView, categoryId)
          ? buildSpecializedComparisonQualificationReplay({
              categoryView,
              categoryId,
              atomsA,
              atomsB,
              expectedDocumentsA,
              expectedDocumentsB,
            })
          : null;
      if (
        specializedComparisonContract(categoryView, categoryId) &&
        !specializedComparisonQualificationReplay
      )
        throw new Error(
          `SPECIALIZED_COMPARISON_QUALIFICATION_REPLAY_UNAVAILABLE:${categoryId}`
        );
      return {
        categoryId,
        stage: first.stage,
        categoryName: first.categoryName,
        packageA,
        packageB,
        ...comparison,
        pointDecision,
        ...(vs22SourceAtomDigestReplay ? { vs22SourceAtomDigestReplay } : {}),
        ...(vs24SourceAtomDigestReplay ? { vs24SourceAtomDigestReplay } : {}),
        ...(vs25SourceAtomDigestReplay ? { vs25SourceAtomDigestReplay } : {}),
        ...(membershipConditionScopeQualificationReplay
          ? { membershipConditionScopeQualificationReplay }
          : {}),
        ...(specializedComparisonQualificationReplay
          ? { specializedComparisonQualificationReplay }
          : {}),
      };
    });
    return { categoryView, rows };
  });
  const totals = deriveCustomerMetrics(categories);
  const result = {
    schemaVersion: 15,
    status: "COMPARISON_RESULT_MATERIALIZED",
    generatedAt: new Date().toISOString(),
    ...metadata,
    productProfile: PRODUCT_PROFILE,
    customerResultRuleOutcomeContract: {
      schemaVersion: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.schemaVersion,
      contractId: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.contractId,
    },
    documents: loadedRuns.map(({ document }) => ({
      uuid: document.uuid,
      side: document.side,
      role: document.role,
      documentStatus: document.documentStatus,
      originalName: document.originalName,
      sha256: document.sha256,
    })),
    categories,
    totals,
    proofLimit:
      "Punktweise, regelgebundene Vergleichsentscheidung. Ein vollständig belegter reiner Einschluss darf gegenüber einer unter demselben versionierten Komponenten- und Suchvertrag vollständig kontrolliert fundlosen Gegenseite als dokumentierter Vorteil ausgewiesen werden. Ausschließlich für LW-20 darf ein vollständiger kontrollierter Nichtfund mit einem belegten, paketweit nicht aufgehobenen Standardausschluss als gleiche dokumentierte Nichtdeckung bewertet werden; der Negativbefund wird dabei niemals in einen ausdrücklichen Ausschluss umgeschrieben. Für FE-A01 darf die vollständig quellengebundene Branddefinition 'bestimmungswidriges Entstehen oder Ausbreiten' gegenüber einer Definition nur über die bestimmungswidrige Ausbreitung als breiterer Begriffsumfang bewertet werden. Für FE-C02 darf ausschließlich ein vollständiger sourcegebundener Boolescher Vergleich derselben Photovoltaik-Komponente im selben Feuerscope einen Vorteil für den breiteren vertraglichen Voraussetzungsscope ausweisen; dies behauptet weder einen ausdrücklichen Ausschluss noch die konkrete Nichterfüllung der engeren Bedingungen. Für FE-C07 darf ausschließlich eine höhere, beidseitig auf dieselbe Gebäudeversicherungssumme und das erste Risiko bezogene Prozentgrenze gewinnen, wenn die höhere Seite sourcegebunden ohne zusätzliche lokale Sauna-Bedingung zertifiziert und die niedrigere Seite entweder ebenso unbeschränkt oder mit der bekannten Haftungs- und Gefahrversicherungsbedingung vollständig belegt ist. Für VS-15 darf ausschließlich der beidseitig vollständig kontrollierte Nichtfund der namentlichen Nebengebäude-Anführung bei zugleich beidseitig belegtem allgemeinem Nebengebäudeschutz als gleiche dokumentierte Fundlage bewertet werden; unterschiedliche Limits werden dadurch nicht gleichgesetzt. Für VS-22 darf belegter Sondermüllschutz mit eigenem belegtem Limit gegenüber einem Paket mit belegten allgemeinen Entsorgungskosten, aber vollständig kontrolliertem Nichtfund beider Sondermüllkomponenten, als Vorteil bewertet werden. Dieser Vergleichsschluss behauptet weder einen ausdrücklichen Ausschluss noch ein Null-Euro-Limit auf der fundlosen Seite. Für VS-24 darf Gleichwertigkeit nur bei beidseitig vollständig belegten Gerüstkosten nach einem Glasschaden im exakt gleichen Glasbruchscope und ohne dokumentiertes eigenes lokales Gerüstkostenlimit festgestellt werden; fehlende lokale Limitangaben werden nicht als unbegrenzte Deckung bezeichnet. Für VS-25 darf eine höhere relative Grenze für behördliche Wiederaufbau-Mehrkosten nur bei beidseitig belegter Neuwertdeckung, typisierter gemeinsamer Bezugsgröße, vollständig gebundenen Kosten- und Limitbelegen sowie – bei Prozent-/Euro-Doppeldarstellung – identischem Klauselcode und centgenauer VS-01-Rechnung als Vorteil ausgewiesen werden. Der Schluss bewertet ausschließlich die relative Prozentgrenze und behauptet ohne beidseitige Euro-Basis keinen höheren absoluten Eurobetrag. Andere Suchbefunde bleiben von ihrer fachlichen Wirkung getrennt. Es gibt keinen Gesamtsieger; Dokumentrang, Ersatzwirkung und unvollständige Fakten bleiben sichtbar prüfpflichtig.",
  };
  validateCustomerComparison(result);
  return result;
}

function markdownResult(result) {
  const lines = [
    "# Polizzenvergleich A/B",
    "",
    `Status: ${result.status}`,
    "",
    `Zeilen: ${result.totals.rows}; Kundenprüfung erforderlich: ${result.totals.customerReviewRequired}.`,
    "",
    result.proofLimit,
    "",
  ];
  for (const category of result.categories) {
    lines.push(
      `## ${category.categoryView}`,
      "",
      "| Kategorie-ID | Kategorie | Paket A | A-Prüfstatus | A-Quellen | Paket B | B-Prüfstatus | B-Quellen | Punktentscheidung | Begründung | Technischer Prüfhinweis |",
      "|---|---|---|---|---|---|---|---|---|---|---|"
    );
    for (const row of category.rows) {
      const cells = [
        row.categoryId,
        row.categoryName,
        row.packageA.documentedContent,
        row.packageA.reviewStatus,
        row.packageA.source,
        row.packageB.documentedContent,
        row.packageB.reviewStatus,
        row.packageB.source,
        row.pointDecision.outcome,
        row.pointDecision.reason,
        row.difference,
      ].map((value) =>
        String(value || "")
          .replace(/\r?\n/gu, "<br>")
          .replace(/\|/gu, "\\|")
      );
      lines.push(`| ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function estimatedWrappedLines(value, width) {
  const capacity = Math.max(8, Math.floor(width * 1.05));
  return String(value || "")
    .split(/\r?\n/gu)
    .reduce((total, paragraph) => {
      const words = paragraph.split(/\s+/gu).filter(Boolean);
      if (words.length === 0) return total + 1;
      let lines = 1;
      let used = 0;
      for (const word of words) {
        const required = Math.min(word.length, capacity);
        if (used > 0 && used + 1 + required > capacity) {
          lines += 1;
          used = required;
        } else {
          used += (used > 0 ? 1 : 0) + required;
        }
        if (word.length > capacity) {
          lines += Math.floor((word.length - 1) / capacity);
          used = word.length % capacity;
        }
      }
      return total + lines;
    }, 0);
}

function orderedWorkbookRows(result) {
  const stageOrder = new Map(
    ["K", "S", "V"].map((stage, index) => [stage, index])
  );
  return result.categories
    .flatMap((category, categoryIndex) =>
      category.rows.map((row, rowIndex) => ({
        row,
        categoryIndex,
        rowIndex,
      }))
    )
    .sort(
      (left, right) =>
        (stageOrder.get(left.row.stage) ?? Number.MAX_SAFE_INTEGER) -
          (stageOrder.get(right.row.stage) ?? Number.MAX_SAFE_INTEGER) ||
        left.categoryIndex - right.categoryIndex ||
        left.rowIndex - right.rowIndex
    );
}

async function writeWorkbook(result, outputFile) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Polizzenvergleich V3";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(CUSTOMER_WORKBOOK_SHEET);
  sheet.properties.defaultRowHeight = 16;
  sheet.views = [{ state: "normal", zoomScale: 80 }];
  sheet.columns = [
    { header: "A_Kategorie-ID", key: "aCategoryId", width: 10.83203125 },
    { header: "A_Stufe", key: "aStage", width: 10.83203125 },
    { header: "A_Kategorie-Name", key: "aCategoryName", width: 56.83203125 },
    { header: "A_Vertragsinhalt", key: "aContent", width: 42 },
    { header: "A_Deckung", key: "aCoverage", width: 19 },
    { header: "A_Deckungssumme", key: "aAmount", width: 20.5 },
    { header: "A_Quelle", key: "aSource", width: 39.6640625 },
    { header: "A_Prüfstatus", key: "aReview", width: 10.83203125 },
    { header: "B_Kategorie-ID", key: "bCategoryId", width: 10.83203125 },
    { header: "B_Stufe", key: "bStage", width: 10.83203125 },
    { header: "B_Kategorie-Name", key: "bCategoryName", width: 30.33203125 },
    { header: "B_Vertragsinhalt", key: "bContent", width: 41.83203125 },
    { header: "B_Deckung", key: "bCoverage", width: 19.83203125 },
    { header: "B_Deckungssumme", key: "bAmount", width: 20 },
    { header: "B_Quelle", key: "bSource", width: 25.33203125 },
    { header: "B_Prüfstatus", key: "bReview", width: 17.1640625 },
    { header: "KI-Ergebnis", key: "customerResult", width: 54.33203125 },
  ];
  const workbookRows = orderedWorkbookRows(result);
  for (const { row } of workbookRows) {
    const customerResult = customerResultText(row);
    assertCustomerResultSemanticParity({
      categoryId: row.categoryId,
      outcome: row.pointDecision?.outcome,
      text: customerResult,
    });
    sheet.addRow({
      aCategoryId: row.categoryId,
      aStage: row.stage,
      aCategoryName: row.categoryName,
      aContent: row.packageA.documentedContent,
      aCoverage: row.packageA.coverage,
      aAmount: row.packageA.coverageAmount,
      aSource: row.packageA.source,
      aReview: row.packageA.reviewStatus,
      bCategoryId: row.categoryId,
      bStage: row.stage,
      bCategoryName: row.categoryName,
      bContent: row.packageB.documentedContent,
      bCoverage: row.packageB.coverage,
      bAmount: row.packageB.coverageAmount,
      bSource: row.packageB.source,
      bReview: row.packageB.reviewStatus,
      customerResult,
    });
  }
  const wrappedColumns = new Set([4, 7, 11, 12, 14, 15, 17]);
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.height =
      rowNumber === 1
        ? 17
        : Math.min(
            409.6,
            Math.max(
              2,
              ...[...wrappedColumns].map((columnNumber) =>
                estimatedWrappedLines(
                  row.getCell(columnNumber).value,
                  sheet.getColumn(columnNumber).width
                )
              )
            ) * 17
          );
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = {
        name: "Aptos Narrow",
        size: 12,
        bold: rowNumber === 1 && columnNumber === 17,
      };
      cell.alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: wrappedColumns.has(columnNumber),
      };
    });
  });
  sheet.autoFilter = `A1:Q${sheet.rowCount}`;
  sheet.pageMargins = {
    left: 0.7,
    right: 0.7,
    top: 0.787401575,
    bottom: 0.787401575,
    header: 0.3,
    footer: 0.3,
  };
  await workbook.xlsx.writeFile(outputFile);
  fs.chmodSync(outputFile, 0o600);
}

async function validateComparisonArtifactRoundTrip({ result, files }) {
  const persistedResult = JSON.parse(
    fs.readFileSync(files["comparison.private.json"], "utf8")
  );
  if (JSON.stringify(persistedResult) !== JSON.stringify(result))
    throw new Error("COMPARISON_ARTIFACT_JSON_ROUNDTRIP_MISMATCH");
  if (
    fs.readFileSync(files["comparison.md"], "utf8") !== markdownResult(result)
  )
    throw new Error("COMPARISON_ARTIFACT_MARKDOWN_ROUNDTRIP_MISMATCH");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(files["polizzenvergleich.xlsx"]);
  if (workbook.worksheets.length !== 1)
    throw new Error("COMPARISON_ARTIFACT_WORKBOOK_SHEET_COUNT_INVALID");
  const sheet = workbook.getWorksheet(CUSTOMER_WORKBOOK_SHEET);
  if (!sheet)
    throw new Error("COMPARISON_ARTIFACT_WORKBOOK_SHEET_MISSING");
  if (
    JSON.stringify(sheet.getRow(1).values.slice(1)) !==
    JSON.stringify(CUSTOMER_WORKBOOK_HEADERS)
  )
    throw new Error("COMPARISON_ARTIFACT_WORKBOOK_HEADERS_INVALID");

  const expectedRows = orderedWorkbookRows(result).map(({ row }) => row);
  if (sheet.rowCount !== expectedRows.length + 1)
    throw new Error("COMPARISON_ARTIFACT_WORKBOOK_ROW_COUNT_INVALID");
  const observedIds = [];
  for (const [index, expected] of expectedRows.entries()) {
    const rowNumber = index + 2;
    const categoryIdA = sheet.getCell(`A${rowNumber}`).value;
    const categoryIdB = sheet.getCell(`I${rowNumber}`).value;
    if (
      categoryIdA !== expected.categoryId ||
      categoryIdB !== expected.categoryId ||
      sheet.getCell(`B${rowNumber}`).value !== expected.stage ||
      sheet.getCell(`J${rowNumber}`).value !== expected.stage ||
      sheet.getCell(`C${rowNumber}`).value !== expected.categoryName ||
      sheet.getCell(`K${rowNumber}`).value !== expected.categoryName
    )
      throw new Error(
        `COMPARISON_ARTIFACT_WORKBOOK_ROW_IDENTITY_INVALID:${expected.categoryId}`
      );
    const customerOutcome = customerOutcomeFromText(
      sheet.getCell(`Q${rowNumber}`).value
    );
    if (customerOutcome !== expected.pointDecision?.outcome)
      throw new Error(
        `COMPARISON_ARTIFACT_WORKBOOK_OUTCOME_INVALID:${expected.categoryId}`
      );
    observedIds.push(categoryIdA);
  }
  if (new Set(observedIds).size !== observedIds.length)
    throw new Error("COMPARISON_ARTIFACT_WORKBOOK_DUPLICATE_CATEGORY_ID");
}

async function writeComparisonArtifacts({
  documentRuns,
  outputDirectory,
  metadata,
  enforceProductProfile = false,
}) {
  const result = buildComparisonResult(documentRuns, metadata);
  if (enforceProductProfile) {
    for (const category of result.categories) {
      if (category.rows.length !== CATEGORY_ROW_COUNTS[category.categoryView])
        throw new Error(
          `COMPARISON_CATEGORY_ROW_COUNT_MISMATCH:${category.categoryView}:${category.rows.length}:${CATEGORY_ROW_COUNTS[category.categoryView]}`
        );
    }
    if (result.totals.rows !== EXPECTED_ROW_COUNT)
      throw new Error(
        `COMPARISON_TOTAL_ROW_COUNT_MISMATCH:${result.totals.rows}:${EXPECTED_ROW_COUNT}`
      );
  }
  const published = await publishComparisonArtifactSet({
    outputDirectory,
    writeArtifacts: async (stagingDirectory) => {
      const jsonFile = path.join(
        stagingDirectory,
        "comparison.private.json"
      );
      const markdownFile = path.join(stagingDirectory, "comparison.md");
      const workbookFile = path.join(
        stagingDirectory,
        "polizzenvergleich.xlsx"
      );
      fs.writeFileSync(jsonFile, JSON.stringify(result, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      });
      fs.writeFileSync(markdownFile, markdownResult(result), {
        encoding: "utf8",
        mode: 0o600,
      });
      await writeWorkbook(result, workbookFile);
    },
    validateArtifacts: ({ files }) =>
      validateComparisonArtifactRoundTrip({ result, files }),
  });
  return {
    result,
    jsonFile: published.files["comparison.private.json"],
    markdownFile: published.files["comparison.md"],
    workbookFile: published.files["polizzenvergleich.xlsx"],
    artifactSetManifest: published.manifest,
    artifactSetManifestFile: published.manifestFile,
  };
}

module.exports = {
  CATEGORY_ORDER,
  buildComparisonResult,
  comparePackages,
  materializeAtomicFacts,
  summarizePackage,
  writeComparisonArtifacts,
};
