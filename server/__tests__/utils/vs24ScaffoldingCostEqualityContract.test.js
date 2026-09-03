const {
  VS24_REQUIREMENT_CONTRACT_DIGEST_SHA256,
  buildVs24ScaffoldingCostEqualityAudit,
} = require("../../utils/policyComparison/vs24ScaffoldingCostEqualityContract");
const { decidePoint } = require("../../utils/policyComparison/pointDecision");

const components = [{ id: "scaffolding_costs", factRole: "COST" }];
const requirementContract = {
  digest: VS24_REQUIREMENT_CONTRACT_DIGEST_SHA256,
  componentSatisfactionPolicy: "ALL",
  components,
};

function document(side, suffix, overrides = {}) {
  return {
    uuid: `document-${side.toLowerCase()}-${suffix}`,
    side,
    role: suffix === "found" ? "SUPPLEMENT" : "MAIN_POLICY",
    documentStatus: suffix === "found" ? "FRAMEWORK_TERMS" : "ACTIVE",
    ...overrides,
  };
}

function foundAtom(side, expectedDocument, overrides = {}) {
  const candidateId = `candidate-${side.toLowerCase()}`;
  return {
    requirementId: "VS-24",
    requirementContractDigest: VS24_REQUIREMENT_CONTRACT_DIGEST_SHA256,
    componentId: "scaffolding_costs",
    componentLabel: "Gerüstkosten",
    factRole: "COST",
    componentSatisfactionPolicy: "ALL",
    declaredComponents: components,
    evidencePresence: "FOUND",
    coverageEffect: "INCLUDED",
    conflictState: "NONE",
    selectedScopePicture: "NARROW_ONLY",
    comparisonScopeKeys: ["GLASBRUCH_INSURANCE"],
    scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
    documentUuids: [expectedDocument.uuid],
    documentRole: expectedDocument.role,
    documentStatus: expectedDocument.documentStatus,
    documentApplicability:
      expectedDocument.documentStatus === "FRAMEWORK_TERMS"
        ? "CONDITIONAL"
        : "ACTIVE",
    selectedCandidateIds: [candidateId],
    unresolvedCandidateIds: [],
    requestedFieldStatus: "NOT_REQUIRED",
    requestedFields: [],
    optionalFields: ["limit"],
    fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
    sources: [
      {
        candidateId,
        candidateBinding: "NARROW_SCOPE",
        deterministicBindingBasis: "EXPLICIT_NARROW_SECTION_SCOPE",
        comparisonScopeKey: "GLASBRUCH_INSURANCE",
        physicalPageNumber: 14,
        exactText: "Gerüstkosten",
        conditionCheckText:
          "Mitversichert sind Gerüst- und Krankosten nach einem ersatzpflichtigen Glasschaden.",
      },
    ],
    ...overrides,
  };
}

function absentAtom(expectedDocument) {
  return {
    requirementId: "VS-24",
    requirementContractDigest: VS24_REQUIREMENT_CONTRACT_DIGEST_SHA256,
    componentId: "scaffolding_costs",
    componentLabel: "Gerüstkosten",
    factRole: "COST",
    componentSatisfactionPolicy: "ALL",
    declaredComponents: components,
    evidencePresence: "NOT_FOUND",
    coverageEffect: "UNKNOWN",
    conflictState: "NONE",
    selectedScopePicture: "UNKNOWN",
    scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
    documentUuids: [expectedDocument.uuid],
    documentRole: expectedDocument.role,
    documentStatus: expectedDocument.documentStatus,
    documentApplicability: "UNKNOWN",
    selectedCandidateIds: [],
    unresolvedCandidateIds: [],
    requestedFieldStatus: "NOT_REQUIRED",
    requestedFields: [],
    optionalFields: ["limit"],
    fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
    sources: [],
  };
}

function fixture() {
  const documentsA = [document("A", "found"), document("A", "zero")];
  const documentsB = [document("B", "found"), document("B", "zero")];
  return {
    categoryId: "VS-24",
    packageA: { evidenceFound: true, reviewStatus: "BELEGT" },
    packageB: { evidenceFound: true, reviewStatus: "BELEGT" },
    atomsA: [foundAtom("A", documentsA[0]), absentAtom(documentsA[1])],
    atomsB: [foundAtom("B", documentsB[0]), absentAtom(documentsB[1])],
    requirementContractA: requirementContract,
    requirementContractB: requirementContract,
    expectedDocumentsA: documentsA,
    expectedDocumentsB: documentsB,
  };
}

describe("VS-24 scaffolding cost equality contract", () => {
  test("certifies equal glass-loss coverage without inventing an unlimited limit", () => {
    expect(buildVs24ScaffoldingCostEqualityAudit(fixture())).toMatchObject({
      schemaVersion: 1,
      contractId: "VS24_GLASS_LOSS_SCAFFOLDING_COST_EQUALITY_AUDIT_V1",
      categoryId: "VS-24",
      sides: {
        A: {
          scopeKey: "GLASBRUCH_INSURANCE",
          localLimitStatus: "NOT_FOUND",
        },
        B: {
          scopeKey: "GLASBRUCH_INSURANCE",
          localLimitStatus: "NOT_FOUND",
        },
      },
    });
  });

  test.each([
    [
      "a missing scope key",
      (input) => (input.atomsA[0].comparisonScopeKeys = []),
    ],
    [
      "a different scope key",
      (input) => {
        input.atomsA[0].comparisonScopeKeys = ["FEUER_INSURANCE"];
        input.atomsA[0].sources[0].comparisonScopeKey = "FEUER_INSURANCE";
      },
    ],
    [
      "multiple scopes",
      (input) => input.atomsA[0].comparisonScopeKeys.push("FEUER_INSURANCE"),
    ],
    [
      "a model-only scope",
      (input) => delete input.atomsA[0].sources[0].deterministicBindingBasis,
    ],
    [
      "a local money limit",
      (input) =>
        (input.atomsA[0].sources[0].conditionCheckText += " Bis EUR 5.000."),
    ],
    [
      "a local percentage limit",
      (input) =>
        (input.atomsA[0].sources[0].conditionCheckText += " Bis 50 %."),
    ],
    [
      "an optional clause",
      (input) =>
        (input.atomsA[0].sources[0].conditionCheckText =
          "Gerüstkosten können gegen Mehrprämie mitversichert werden."),
    ],
    [
      "a found limit fact",
      (input) => {
        input.atomsA[0].fields[0] = {
          field: "limit",
          status: "FOUND",
          facts: [{ normalizedValue: "EUR 5.000" }],
        };
      },
    ],
    ["two found documents", (input) => (input.atomsA[1] = input.atomsA[0])],
    ["an omitted document", (input) => input.atomsA.pop()],
    [
      "a document role mismatch",
      (input) => (input.atomsA[0].documentRole = "MAIN_POLICY"),
    ],
    [
      "a stale requirement digest",
      (input) => (input.requirementContractA.digest = "a".repeat(64)),
    ],
    ["another category", (input) => (input.categoryId = "VS-23")],
  ])("fails closed for %s", (_label, mutate) => {
    const input = fixture();
    mutate(input);
    expect(buildVs24ScaffoldingCostEqualityAudit(input)).toBeNull();
  });

  test("is symmetric across package A and B", () => {
    const input = fixture();
    input.atomsA[0].sources[0].exactText = "Kosten für Gerüste";
    input.atomsA[0].sources[0].conditionCheckText =
      "Kosten für Gerüste, die zur Ersatzausführung erforderlich sind.";
    input.atomsB[0].sources[0].exactText = "Gerüstkosten";

    const first = buildVs24ScaffoldingCostEqualityAudit(input);
    const sourceA = input.atomsA[0].sources[0];
    const sourceB = input.atomsB[0].sources[0];
    [sourceA.exactText, sourceB.exactText] = [
      sourceB.exactText,
      sourceA.exactText,
    ];
    [sourceA.conditionCheckText, sourceB.conditionCheckText] = [
      sourceB.conditionCheckText,
      sourceA.conditionCheckText,
    ];
    const second = buildVs24ScaffoldingCostEqualityAudit(input);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
  });

  test.each(["FRAMEWORK_TERMS", "ACTIVE"])(
    "decides equal scoped costs for %s package members",
    (documentStatus) => {
      const input = fixture();
      for (const [documents, atoms] of [
        [input.expectedDocumentsA, input.atomsA],
        [input.expectedDocumentsB, input.atomsB],
      ]) {
        documents[0].documentStatus = documentStatus;
        atoms[0].documentStatus = documentStatus;
        atoms[0].documentApplicability =
          documentStatus === "ACTIVE" ? "ACTIVE" : "CONDITIONAL";
      }

      expect(decidePoint(input)).toMatchObject({
        schemaVersion: 4,
        outcome: "GLEICHWERTIG",
        reasonCode:
          "EQUIVALENT_GLASS_LOSS_SCAFFOLDING_COST_WITHOUT_LOCAL_LIMIT",
        reviewRequired: false,
        ruleId:
          "VS24_EQUIVALENT_GLASS_LOSS_SCAFFOLDING_COST_WITHOUT_LOCAL_LIMIT_V1",
        vs24ScaffoldingCostEqualityAudit: {
          sides: {
            A: { localLimitStatus: "NOT_FOUND" },
            B: { localLimitStatus: "NOT_FOUND" },
          },
        },
      });
    }
  );

  test("routes fire versus glass to not comparable", () => {
    const input = fixture();
    input.atomsA[0].comparisonScopeKeys = ["FEUER_INSURANCE"];
    input.atomsA[0].sources[0].comparisonScopeKey = "FEUER_INSURANCE";

    expect(decidePoint(input)).toMatchObject({
      outcome: "NICHT_VERGLEICHBAR",
      reasonCode: "COMPARABILITY_GATE_FAILED",
      reviewRequired: false,
    });
  });

  test("keeps a missing authenticated scope key unclear", () => {
    const input = fixture();
    input.atomsA[0].comparisonScopeKeys = [];

    expect(decidePoint(input)).toMatchObject({
      outcome: "UNKLAR",
      reasonCode: "ATOMIC_EVIDENCE_INCOMPLETE",
      reviewRequired: true,
    });
  });
});
