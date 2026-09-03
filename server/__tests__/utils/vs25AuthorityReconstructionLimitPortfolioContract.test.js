const {
  VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID,
  buildVs25SourceAtomDigestReplay,
  buildVs25AuthorityLimitPortfolioAudit,
  validateVs25AuthorityLimitPortfolioAudit,
} = require("../../utils/policyComparison/vs25AuthorityReconstructionLimitPortfolioContract");
const { decidePoint } = require("../../utils/policyComparison/pointDecision");
const {
  DETERMINISTIC_VS25_SUM_EQUALIZATION_TERMINAL_CONTRACT_ID,
  TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
  TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
  VS25_SUM_EQUALIZATION_DECISION_BASIS,
  VS25_SUM_EQUALIZATION_SCOPE_PROOF_MODE,
  terminalRejectionSetDigest,
} = require("../../utils/policyAnalysis/deterministicTerminalRejectionContract");

const DIGEST =
  "82d04fb0134a057ba083fef5d798340fb92106899a0b58cf022323b660208bb2";
const COMPONENTS = [
  { id: "authority_reconstruction_extra_costs", factRole: "COST" },
  { id: "authority_reconstruction_extra_cost_limit", factRole: "LIMIT" },
];

function document(uuid, side, role, documentStatus) {
  return {
    uuid,
    side,
    role,
    documentStatus,
    sha256: (side === "A" ? "a" : "b").repeat(64),
  };
}

function source(candidateId, text) {
  return {
    candidateId,
    physicalPageNumber: 1,
    exactText: "Mehrkosten durch behördliche Auflagen",
    conditionCheckText: text,
  };
}

function commonAtom(document, componentId, factRole, sourceText) {
  const candidateId = `${document.uuid}-${componentId}`;
  return {
    requirementId: "VS-25",
    componentId,
    componentLabel: componentId,
    factRole,
    documentUuids: [document.uuid],
    documentRole: document.role,
    documentStatus: document.documentStatus,
    documentApplicability: {
      ACTIVE: "ACTIVE",
      PROPOSAL: "PROPOSED_ONLY",
      FRAMEWORK_TERMS: "CONDITIONAL",
    }[document.documentStatus],
    evidencePresence: "FOUND",
    coverageEffect: factRole === "COST" ? "INCLUDED" : "DEFINED",
    conflictState: "NONE",
    selectedScopePicture: "GENERAL",
    selectedCandidateIds: [candidateId],
    unresolvedCandidateIds: [],
    componentSatisfactionPolicy: "ALL",
    coverageAggregationPolicy: "ALL_COMPONENT_EFFECTS",
    scopePolicy: "GENERAL_REQUIRED",
    requestedFields: ["limit"],
    optionalFields: [],
    requirementContractDigest: DIGEST,
    declaredComponents: COMPONENTS,
    sources: [source(candidateId, sourceText)],
  };
}

function costAtom(sourceDocument, sourceText) {
  return {
    ...commonAtom(
      sourceDocument,
      "authority_reconstruction_extra_costs",
      "COST",
      sourceText
    ),
    requestedFieldStatus: "NOT_FOUND",
    fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
  };
}

function limitAtom(sourceDocument, sourceText, fact) {
  const atom = commonAtom(
    sourceDocument,
    "authority_reconstruction_extra_cost_limit",
    "LIMIT",
    sourceText
  );
  return {
    ...atom,
    requestedFieldStatus: "COMPLETE",
    fields: [
      {
        field: "limit",
        status: "FOUND",
        facts: [
          {
            ...fact,
            binding: "DIRECT",
            source: {
              candidateId: atom.selectedCandidateIds[0],
              physicalPageNumber: 1,
              documentStart: 100,
              documentEnd: 105,
              exactText: fact.rawValue,
            },
          },
        ],
      },
    ],
  };
}

function absentAtom(sourceDocument, componentId, factRole) {
  const atom = {
    ...commonAtom(sourceDocument, componentId, factRole, ""),
    documentApplicability: "UNKNOWN",
    evidencePresence: "NOT_FOUND",
    coverageEffect: "UNKNOWN",
    selectedScopePicture: "UNKNOWN",
    selectedCandidateIds: [],
    requestedFieldStatus: "NOT_FOUND",
    fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
    sources: [],
  };
  atom.searchAudit = {
    disposition: "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
    comparisonTreatment: "DOCUMENTATION_ONLY_V1",
    negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
    absenceMeaning: "COST_COVERAGE",
    requirementContract: {
      digest: DIGEST,
      componentSatisfactionPolicy: "ALL",
      components: COMPONENTS,
    },
    searchPlanId: `VS-25/${componentId}`,
    documentUuid: sourceDocument.uuid,
    physicalPagesChecked: 3,
    totalPhysicalPages: 3,
    gates: {
      negativeSearchApproved: true,
      certifiedNegativeSearch: false,
      completeTextExtraction: true,
      completeCategoryTechnicalContract: true,
      zeroOccurrenceTerminal: true,
      zeroCandidateTerminal: true,
      serverNegativeTerminal: true,
    },
  };
  return atom;
}

function terminalSumEqualizationAbsence(atom) {
  const candidateId = `${atom.documentUuids[0]}-${atom.componentId}-allocation`;
  const rejection = {
    candidateId,
    terminalRejectionContractId:
      DETERMINISTIC_VS25_SUM_EQUALIZATION_TERMINAL_CONTRACT_ID,
    occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
    decisionBasis: VS25_SUM_EQUALIZATION_DECISION_BASIS,
    occurrenceDigestSha256: "c".repeat(64),
    physicalPageNumber: 1,
    sectionScopeSource: "OCCURRENCE_LOCAL_CLAUSE",
    observedScopeKeys: [],
    scopeProofMode: VS25_SUM_EQUALIZATION_SCOPE_PROOF_MODE,
  };
  atom.searchAudit.gates.zeroOccurrenceTerminal = false;
  atom.searchAudit.gates.zeroCandidateTerminal = false;
  atom.searchAudit.gates.deterministicVs25SumEqualizationTerminal = true;
  atom.searchAudit.terminalRejectionAudit = {
    schemaVersion: 3,
    contractId: DETERMINISTIC_VS25_SUM_EQUALIZATION_TERMINAL_CONTRACT_ID,
    requirementId: "VS-25",
    componentId: atom.componentId,
    decisionOwner: "SERVER",
    decisionBasis: VS25_SUM_EQUALIZATION_DECISION_BASIS,
    proofMode:
      "ALL_OCCURRENCES_DETERMINISTICALLY_PURE_SUM_EQUALIZATION_ALLOCATIONS",
    rejectedOccurrenceCount: 1,
    rejectedCandidateIds: [candidateId],
    rejectionDigestContractId: TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
    rejectionDigestSha256: terminalRejectionSetDigest([rejection]),
    rejections: [rejection],
  };
}

function newValueAtom(sourceDocument, amount = null) {
  const candidateId = `${sourceDocument.uuid}-vs01`;
  return {
    requirementId: "VS-01",
    componentId: "replacement_new_value",
    factRole: "BENEFIT",
    documentUuids: [sourceDocument.uuid],
    documentRole: sourceDocument.role,
    documentStatus: sourceDocument.documentStatus,
    documentApplicability: {
      ACTIVE: "ACTIVE",
      PROPOSAL: "PROPOSED_ONLY",
      FRAMEWORK_TERMS: "CONDITIONAL",
    }[sourceDocument.documentStatus],
    evidencePresence: "FOUND",
    coverageEffect: "INCLUDED",
    conflictState: "NONE",
    selectedScopePicture: "GENERAL",
    selectedCandidateIds: [candidateId],
    unresolvedCandidateIds: [],
    sources: [
      {
        candidateId,
        physicalPageNumber: 1,
        exactText: "Wohngebäude zum Neuwert",
        conditionCheckText: "Wohngebäude zum Neuwert versichert",
      },
    ],
    fields: amount
      ? [
          {
            field: "limit",
            status: "FOUND",
            facts: [
              {
                normalizedValue: amount,
                valueType: "MONEY",
                unit: "EUR",
                binding: "DIRECT",
                source: {
                  candidateId,
                  physicalPageNumber: 1,
                  documentStart: 10,
                  documentEnd: 26,
                  exactText: amount,
                },
              },
            ],
          },
        ]
      : [],
  };
}

function fixture({ aPercent = "1000", bPercent = "500" } = {}) {
  const docA = document("a", "A", "MAIN_POLICY", "FRAMEWORK_TERMS");
  const docBMoney = document("b-money", "B", "MAIN_POLICY", "PROPOSAL");
  const docBPercent = document(
    "b-percent",
    "B",
    "SUPPLEMENT",
    "FRAMEWORK_TERMS"
  );
  const docBAbsent = document("b-absent", "B", "TERMS", "ACTIVE");
  const aText =
    "Mehrkosten durch behördliche Auflagen bis 10 % der Gebäudeversicherungssumme auf Erstes Risiko mitversichert.";
  const bMoneyText =
    "Mehrkosten durch behördliche Auflagen auf Erstes Risiko (Besondere Bedingung 10PA0130) EUR 1.530.400,00";
  const bPercentText =
    "Mehrkosten durch behördliche Auflagen bis 5 % des NBW gemäß 10PA0130";
  const atomsA = [
    costAtom(docA, aText),
    limitAtom(docA, aText, {
      rawValue: "10 %",
      normalizedValue: `${Number(aPercent) / 100} %`,
      valueType: "PERCENT",
      unit: "%",
      limitKind: "CAPPED",
      qualifier: "auf Erstes Risiko",
      comparisonBasis: "BUILDING_INSURANCE_SUM",
    }),
  ];
  const atomsB = [
    costAtom(docBMoney, bMoneyText),
    limitAtom(docBMoney, bMoneyText, {
      rawValue: "EUR 1.530.400,00",
      normalizedValue: "EUR 1.530.400,00",
      valueType: "MONEY",
      unit: "EUR",
      limitKind: "CAPPED",
      qualifier: "auf Erstes Risiko",
    }),
    costAtom(docBPercent, bPercentText),
    limitAtom(docBPercent, bPercentText, {
      rawValue: "5 %",
      normalizedValue: `${Number(bPercent) / 100} %`,
      valueType: "PERCENT",
      unit: "%",
      limitKind: "CAPPED",
      comparisonBasis: "BUILDING_NEW_VALUE_INSURANCE_SUM",
    }),
    absentAtom(docBAbsent, "authority_reconstruction_extra_costs", "COST"),
    absentAtom(
      docBAbsent,
      "authority_reconstruction_extra_cost_limit",
      "LIMIT"
    ),
  ];
  const packageA = {
    evidenceFound: true,
    reviewStatus: "BELEGT",
    facts: [],
  };
  const packageB = {
    evidenceFound: true,
    reviewStatus: "BELEGT",
    facts: [],
    vs25AmountReconciliation: {
      schemaVersion: 1,
      contractId: "VS25_NBW_PERCENT_CURRENCY_RECONCILIATION_AUDIT_V1",
      categoryId: "VS-25",
      comparisonBasis: "BUILDING_NEW_VALUE_INSURANCE_SUM",
      clauseCode: "10PA0130",
      base: {
        documentUuid: "b-money",
        amountMinor: "3060800000",
        atomProof: {
          requirementContractDigest: undefined,
          documentUuid: "b-money",
          documentRole: "MAIN_POLICY",
          documentStatus: "PROPOSAL",
          documentApplicability: "PROPOSED_ONLY",
          selectedCandidateIds: ["b-money-vs01"],
          valueSources: [
            {
              normalizedValue: "EUR 30.608.000,00",
              candidateId: "b-money-vs01",
              physicalPageNumber: 1,
              documentStart: 10,
              documentEnd: 26,
              exactText: "EUR 30.608.000,00",
            },
          ],
        },
      },
      percentage: {
        documentUuid: "b-percent",
        percentageHundredths: bPercent,
        qualifier: "GENERAL",
      },
      currency: {
        documentUuid: "b-money",
        amountMinor: "153040000",
        qualifier: "FIRST_RISK",
      },
      calculation: {
        numerator: "1530400000000",
        divisor: "10000",
        calculatedAmountMinor: "153040000",
        documentedAmountMinor: "153040000",
        remainder: "0",
      },
    },
  };
  return {
    categoryId: "VS-25",
    packageA,
    packageB,
    atomsA,
    atomsB,
    referenceAtomsA: [newValueAtom(docA)],
    referenceAtomsB: [newValueAtom(docBMoney, "EUR 30.608.000,00")],
    expectedDocumentsA: [docA],
    expectedDocumentsB: [docBMoney, docBPercent, docBAbsent],
  };
}

describe("VS-25 authority reconstruction limit portfolio contract", () => {
  test("compares 10 percent against reconciled 5 percent plus EUR amount", () => {
    const input = fixture();
    const decision = decidePoint(input);

    expect(decision).toMatchObject({
      outcome: "VORTEIL_A",
      reasonCode: "HIGHER_AUTHORITY_RECONSTRUCTION_RELATIVE_LIMIT",
      reviewRequired: false,
      ruleId: VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID,
      vs25AuthorityLimitPortfolioAudit: {
        comparisonBasis: "BUILDING_NEW_VALUE_INSURANCE_SUM",
        winnerSide: "A",
        sides: {
          A: { canonicalRelativeLimitHundredths: "1000" },
          B: { canonicalRelativeLimitHundredths: "500" },
        },
      },
    });
    expect(decision.reason).toContain("kein höherer absoluter Eurobetrag");
  });

  test("supports equality and the reverse winner under the same contract", () => {
    expect(decidePoint(fixture({ aPercent: "500" }))).toMatchObject({
      outcome: "GLEICHWERTIG",
      reasonCode: "EQUAL_AUTHORITY_RECONSTRUCTION_RELATIVE_LIMIT",
      reviewRequired: false,
    });
    expect(decidePoint(fixture({ aPercent: "400" }))).toMatchObject({
      outcome: "VORTEIL_B",
      reviewRequired: false,
    });
  });

  test("accepts a fully audited sum-equalization-only occurrence as terminal", () => {
    const input = fixture();
    terminalSumEqualizationAbsence(input.atomsB[4]);
    terminalSumEqualizationAbsence(input.atomsB[5]);

    expect(decidePoint(input)).toMatchObject({
      outcome: "VORTEIL_A",
      ruleId: VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID,
      reviewRequired: false,
    });
    input.atomsB[4].searchAudit.terminalRejectionAudit.rejections[0].physicalPageNumber = 2;
    expect(decidePoint(input)).not.toMatchObject({
      ruleId: VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID,
    });
  });

  test("replays target and VS-01 reference atoms and rejects tampering", () => {
    const input = fixture();
    const audit = buildVs25AuthorityLimitPortfolioAudit({
      ...input,
      requirementContractA: {
        digest: DIGEST,
        componentSatisfactionPolicy: "ALL",
        components: COMPONENTS,
      },
      requirementContractB: {
        digest: DIGEST,
        componentSatisfactionPolicy: "ALL",
        components: COMPONENTS,
      },
    });
    const replay = buildVs25SourceAtomDigestReplay(input);
    const options = {
      ...input,
      requirementContractA: {
        digest: DIGEST,
        componentSatisfactionPolicy: "ALL",
        components: COMPONENTS,
      },
      requirementContractB: {
        digest: DIGEST,
        componentSatisfactionPolicy: "ALL",
        components: COMPONENTS,
      },
      sourceAtomDigestReplay: replay,
    };

    expect(validateVs25AuthorityLimitPortfolioAudit(audit, options)).toBe(true);
    const tampered = JSON.parse(JSON.stringify(audit));
    tampered.sides.B.projectedReferenceAtoms[0].coverageEffect = "EXCLUDED";
    expect(() =>
      validateVs25AuthorityLimitPortfolioAudit(tampered, options)
    ).toThrow("VS25_SOURCE_REFERENCE_ATOM_DIGEST_REPLAY_MISMATCH");
    const tamperedManifest = JSON.parse(JSON.stringify(options));
    tamperedManifest.expectedDocumentsB[0].sha256 = "f".repeat(64);
    expect(() =>
      validateVs25AuthorityLimitPortfolioAudit(audit, tamperedManifest)
    ).toThrow("VS25_SOURCE_REFERENCE_ATOM_DIGEST_REPLAY_MISMATCH");
  });

  test.each([
    [
      "one-cent mismatch",
      (input) => {
        input.packageB.vs25AmountReconciliation.calculation.documentedAmountMinor =
          "153040001";
      },
    ],
    [
      "missing new-value reference",
      (input) => {
        input.referenceAtomsA = [];
      },
    ],
    [
      "mismatched clause",
      (input) => {
        input.atomsB[3].sources[0].conditionCheckText =
          "Mehrkosten durch behördliche Auflagen bis 5 % des NBW gemäß 10PA9999";
      },
    ],
    [
      "local condition",
      (input) => {
        input.atomsA[0].sources[0].conditionCheckText =
          "Mehrkosten durch behördliche Auflagen nur wenn gesondert vereinbart";
      },
    ],
    [
      "prefix condition",
      (input) => {
        input.atomsA[0].sources[0].conditionCheckText =
          "Nur wenn gesondert vereinbart: Mehrkosten durch behördliche Auflagen";
      },
    ],
    [
      "incomplete absence search",
      (input) => {
        input.atomsB[4].searchAudit.disposition = "SEARCH_INCOMPLETE";
        input.atomsB[4].searchAudit.comparisonTreatment = null;
        input.atomsB[4].searchAudit.gates.zeroOccurrenceTerminal = false;
      },
    ],
    [
      "unbound reconstruction base",
      (input) => {
        input.packageB.vs25AmountReconciliation.base.atomProof.selectedCandidateIds =
          ["different-vs01"];
      },
    ],
    [
      "indirect limit field",
      (input) => {
        input.atomsA[1].fields[0].facts[0].binding = "INFERRED";
      },
    ],
    [
      "wrong limit unit",
      (input) => {
        input.atomsA[1].fields[0].facts[0].unit = "EUR";
      },
    ],
    [
      "conflicting percentage qualifier",
      (input) => {
        input.atomsB[3].fields[0].facts[0].qualifier = "pro Jahr";
      },
    ],
    [
      "typed percentage basis without local wording",
      (input) => {
        input.atomsB[3].sources[0].conditionCheckText =
          "Mehrkosten durch behördliche Auflagen bis 5 % gemäß 10PA0130";
      },
    ],
    [
      "distant neighbouring clause code",
      (input) => {
        for (const atom of [input.atomsB[1], input.atomsB[3]])
          atom.sources[0].conditionCheckText =
            `Mehrkosten durch behördliche Auflagen ${"ohne Klauselcode ".repeat(16)}10PA0130`;
      },
    ],
  ])("fails closed for %s", (_label, mutate) => {
    const input = fixture();
    mutate(input);
    expect(buildVs25AuthorityLimitPortfolioAudit(input)).toBeNull();
    expect(decidePoint(input)).not.toMatchObject({
      ruleId: VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID,
    });
  });
});
