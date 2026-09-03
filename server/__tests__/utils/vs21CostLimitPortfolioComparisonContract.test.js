const {
  buildVs21CostLimitPortfolioAudit,
} = require("../../utils/policyComparison/vs21CostLimitPortfolioComparisonContract");
const { decidePoint } = require("../../utils/policyComparison/pointDecision");

const digest = "2".repeat(64);
const components = [
  { id: "cleanup_costs", factRole: "COST" },
  { id: "demolition_costs", factRole: "COST" },
];
const requirementContract = {
  digest,
  componentSatisfactionPolicy: "ALL",
  components,
};
const sharedSumText =
  "Sind Gebäude und Inhalt gegen die gleiche Gefahr versichert, gelten die Aufräum-, Abbruch- und Feuerlöschkosten für Gebäude und Inhalt gemeinsam summarisch versichert.";

function primaryAtom(side, componentId, valueType, overrides = {}) {
  const candidateId = `candidate:${side}:${componentId}`;
  const money = valueType === "MONEY";
  return {
    requirementId: "VS-21",
    componentId,
    componentLabel: componentId,
    factRole: "COST",
    documentUuids: [`document-${side}`],
    documentRole: "MAIN_POLICY",
    documentStatus: "ACTIVE",
    evidencePresence: "FOUND",
    coverageEffect: "INCLUDED",
    conflictState: "NONE",
    selectedScopePicture: "GENERAL",
    scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
    documentApplicability: "ACTIVE",
    selectedCandidateIds: [candidateId],
    unresolvedCandidateIds: [],
    requestedFieldStatus: "COMPLETE",
    requestedFields: ["limit"],
    optionalFields: [],
    componentSatisfactionPolicy: "ALL",
    requirementContractDigest: digest,
    declaredComponents: components,
    fields: [
      {
        field: "limit",
        status: "FOUND",
        facts: [
          {
            rawValue: money ? "EUR 6.121.600,00" : "15 %",
            normalizedValue: money ? "EUR 6.121.600,00" : "15 %",
            valueType,
            unit: money ? "EUR" : "%",
            limitKind: "CAPPED",
            source: {
              candidateId,
              physicalPageNumber: 2,
              documentStart: 100,
              documentEnd: 104,
              exactText: money ? "EUR 6.121.600,00" : "15 %",
            },
          },
        ],
      },
    ],
    sources: [
      {
        candidateId,
        physicalPageNumber: 2,
        exactText: `${componentId} sind versichert.`,
        conditionCheckText: `${componentId} bis ${money ? "EUR 6.121.600,00" : "15 %"}.`,
      },
    ],
    ...overrides,
  };
}

function sharedSumModifier(side, componentId, overrides = {}) {
  const candidateId = `candidate:${side}:modifier:${componentId}`;
  return {
    ...primaryAtom(side, componentId, "MONEY"),
    documentUuids: [`document-${side}-terms`],
    documentRole: "TERMS",
    documentStatus: "FRAMEWORK_TERMS",
    documentApplicability: "CONDITIONAL",
    selectedCandidateIds: [candidateId],
    requestedFieldStatus: "NOT_FOUND",
    fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
    sources: [
      {
        candidateId,
        physicalPageNumber: 8,
        exactText: "Aufräum-, Abbruch- und Feuerlöschkosten",
        conditionCheckText: sharedSumText,
      },
    ],
    ...overrides,
  };
}

function sideAtoms(side, valueType, { modifier = false } = {}) {
  const atoms = components.map(({ id }) => primaryAtom(side, id, valueType));
  if (modifier)
    atoms.push(...components.map(({ id }) => sharedSumModifier(side, id)));
  return atoms;
}

function packageSummary(reviewStatus, side = "a") {
  return {
    evidenceFound: true,
    reviewStatus,
    requirementContract,
    facts:
      reviewStatus === "BELEGT"
        ? []
        : [
            { documentUuid: `document-${side}`, reviewStatus: "BELEGT" },
            {
              documentUuid: `document-${side}-terms`,
              reviewStatus: "TEILBELEGT",
            },
          ],
  };
}

describe("VS-21 cost limit portfolio comparison contract", () => {
  test("closes percent versus money without treating an allocation modifier as a missing limit", () => {
    const result = decidePoint({
      categoryId: "VS-21",
      packageA: packageSummary("BELEGT"),
      packageB: packageSummary("TEILBELEGT", "b"),
      atomsA: sideAtoms("a", "PERCENT"),
      atomsB: sideAtoms("b", "MONEY", { modifier: true }),
    });

    expect(result).toMatchObject({
      schemaVersion: 4,
      outcome: "NICHT_VERGLEICHBAR",
      reasonCode: "INCOMPATIBLE_LIMIT_VALUE_TYPES",
      reviewRequired: false,
      ruleId: "VS21_INCOMPATIBLE_LIMIT_VALUE_TYPES_V1",
      vs21CostLimitPortfolioAudit: {
        schemaVersion: 1,
        contractId: "VS21_COST_LIMIT_PORTFOLIO_AUDIT_V1",
        categoryId: "VS-21",
        sides: {
          A: { valueType: "PERCENT", allocationModifiers: [] },
          B: {
            valueType: "MONEY",
            allocationModifiers: [
              {
                componentId: "cleanup_costs",
                modifierContractId:
                  "SHARED_SUM_INSURANCE_ALLOCATION_MODIFIER_V1",
              },
              {
                componentId: "demolition_costs",
                modifierContractId:
                  "SHARED_SUM_INSURANCE_ALLOCATION_MODIFIER_V1",
              },
            ],
          },
        },
      },
    });
  });

  test("is symmetric when the fixed amount is on side A", () => {
    expect(
      decidePoint({
        categoryId: "VS-21",
        packageA: packageSummary("BELEGT"),
        packageB: packageSummary("BELEGT"),
        atomsA: sideAtoms("a", "MONEY"),
        atomsB: sideAtoms("b", "PERCENT"),
      })
    ).toMatchObject({
      outcome: "NICHT_VERGLEICHBAR",
      reviewRequired: false,
      ruleId: "VS21_INCOMPATIBLE_LIMIT_VALUE_TYPES_V1",
    });
  });

  test.each([
    [
      "a modifier carrying its own numeric limit",
      (atoms) => {
        atoms[2].sources[0].conditionCheckText = `${sharedSumText} EUR 5.000,00`;
        atoms[3].sources[0].conditionCheckText = `${sharedSumText} EUR 5.000,00`;
      },
    ],
    [
      "a modifier missing the shared-sum language",
      (atoms) => {
        atoms[2].sources[0].conditionCheckText =
          "Aufräum- und Abbruchkosten sind versichert.";
        atoms[3].sources[0].conditionCheckText =
          "Aufräum- und Abbruchkosten sind versichert.";
      },
    ],
    ["only one component of the modifier pair", (atoms) => atoms.pop()],
    [
      "another incomplete included cost clause",
      (atoms) => {
        atoms.push(
          sharedSumModifier("b", "cleanup_costs", {
            documentUuids: ["unclassified-document"],
            sources: [
              {
                candidateId: "candidate:b:modifier:cleanup_costs",
                physicalPageNumber: 9,
                exactText: "Aufräumkosten",
                conditionCheckText:
                  "Aufräumkosten sind ohne bestimmtes Limit mitversichert.",
              },
            ],
          })
        );
      },
    ],
  ])("fails closed for %s", (_label, mutate) => {
    const atomsB = sideAtoms("b", "MONEY", { modifier: true });
    mutate(atomsB);
    expect(
      buildVs21CostLimitPortfolioAudit({
        categoryId: "VS-21",
        packageA: packageSummary("BELEGT"),
        packageB: packageSummary("TEILBELEGT", "b"),
        atomsA: sideAtoms("a", "PERCENT"),
        atomsB,
        requirementContractA: requirementContract,
        requirementContractB: requirementContract,
      })
    ).toBeNull();
  });

  test.each([
    ["the same value type", "MONEY"],
    ["an unsupported value type", "DURATION"],
  ])("does not decide %s", (_label, rightValueType) => {
    expect(
      buildVs21CostLimitPortfolioAudit({
        categoryId: "VS-21",
        packageA: packageSummary("BELEGT"),
        packageB: packageSummary("BELEGT"),
        atomsA: sideAtoms("a", "MONEY"),
        atomsB: sideAtoms("b", rightValueType),
        requirementContractA: requirementContract,
        requirementContractB: requirementContract,
      })
    ).toBeNull();
  });

  test("requires both complete cost components", () => {
    expect(
      buildVs21CostLimitPortfolioAudit({
        categoryId: "VS-21",
        packageA: packageSummary("BELEGT"),
        packageB: packageSummary("BELEGT"),
        atomsA: sideAtoms("a", "PERCENT").slice(0, 1),
        atomsB: sideAtoms("b", "MONEY"),
        requirementContractA: requirementContract,
        requirementContractB: requirementContract,
      })
    ).toBeNull();
  });
});
