const {
  VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID,
  buildVs25AuthorityLimitPortfolioAudit,
} = require("../../utils/policyComparison/vs25AuthorityReconstructionLimitPortfolioContract");
const { decidePoint } = require("../../utils/policyComparison/pointDecision");

const DIGEST =
  "82d04fb0134a057ba083fef5d798340fb92106899a0b58cf022323b660208bb2";
const COMPONENTS = [
  { id: "authority_reconstruction_extra_costs", factRole: "COST" },
  { id: "authority_reconstruction_extra_cost_limit", factRole: "LIMIT" },
];

function document(uuid, side, role, documentStatus) {
  return { uuid, side, role, documentStatus };
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
    }),
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
      },
      percentage: {
        documentUuid: "b-percent",
        percentageHundredths: bPercent,
      },
      currency: {
        documentUuid: "b-money",
        amountMinor: "153040000",
        qualifier: "FIRST_RISK",
      },
      calculation: {
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
    expectedDocumentsB: [docBMoney, docBPercent],
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

  test.each([
    ["one-cent mismatch", (input) => {
      input.packageB.vs25AmountReconciliation.calculation.documentedAmountMinor =
        "153040001";
    }],
    ["missing new-value reference", (input) => {
      input.referenceAtomsA = [];
    }],
    ["mismatched clause", (input) => {
      input.atomsB[3].sources[0].conditionCheckText =
        "Mehrkosten durch behördliche Auflagen bis 5 % des NBW gemäß 10PA9999";
    }],
    ["local condition", (input) => {
      input.atomsA[0].sources[0].conditionCheckText =
        "Mehrkosten durch behördliche Auflagen nur wenn gesondert vereinbart";
    }],
  ])("fails closed for %s", (_label, mutate) => {
    const input = fixture();
    mutate(input);
    expect(buildVs25AuthorityLimitPortfolioAudit(input)).toBeNull();
    expect(decidePoint(input)).not.toMatchObject({
      ruleId: VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID,
    });
  });
});
