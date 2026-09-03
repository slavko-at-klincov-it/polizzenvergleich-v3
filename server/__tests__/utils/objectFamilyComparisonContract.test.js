const {
  buildObjectFamilyCoverageAudit,
} = require("../../utils/policyComparison/objectFamilyComparisonContract");
const {
  decidePoint,
} = require("../../utils/policyComparison/pointDecision");

const digest = "a".repeat(64);
const components = [
  { id: "enclosures", factRole: "INSURED_OBJECT" },
  { id: "fences", factRole: "INSURED_OBJECT" },
  { id: "walls", factRole: "INSURED_OBJECT" },
  { id: "gates", factRole: "INSURED_OBJECT" },
];
const componentFamilyContract = {
  contractId: "DIRECTED_OBJECT_FAMILY_V1",
  rootComponentId: "enclosures",
  memberComponentIds: ["fences", "walls", "gates"],
  rootCoversMembers: true,
  rowComparison: "COVERAGE_PRESENCE_ONLY",
};
const requirementContract = {
  digest,
  componentSatisfactionPolicy: "ALL",
  componentFamilyContract,
  components,
};

function atom(side, componentId, overrides = {}) {
  const candidateId = `candidate:${side}:${componentId}`;
  return {
    requirementId: "VS-18",
    componentId,
    componentLabel: componentId,
    factRole: "INSURED_OBJECT",
    documentUuids: [`document-${side}`],
    documentRole: "MAIN_POLICY",
    documentStatus: "ACTIVE",
    evidencePresence: "FOUND",
    coverageEffect: "INCLUDED",
    conflictState: "NONE",
    selectedScopePicture: "GENERAL",
    documentApplicability: "ACTIVE",
    selectedCandidateIds: [candidateId],
    unresolvedCandidateIds: [],
    requestedFieldStatus: "NOT_REQUIRED",
    requestedFields: [],
    optionalFields: [],
    fields: [],
    componentSatisfactionPolicy: "ALL",
    componentFamilyContract,
    requirementContractDigest: digest,
    declaredComponents: components,
    sources: [
      {
        candidateId,
        physicalPageNumber: 2,
        exactText: "Einfriedungen sind mitversichert.",
      },
    ],
    ...overrides,
  };
}

function absent(side, componentId) {
  return atom(side, componentId, {
    evidencePresence: "NOT_FOUND",
    coverageEffect: "UNKNOWN",
    selectedScopePicture: "UNKNOWN",
    documentApplicability: "UNKNOWN",
    selectedCandidateIds: [],
    sources: [],
  });
}

function sideAtoms(side, rootOverrides = {}) {
  return [
    atom(side, "enclosures", rootOverrides),
    absent(side, "fences"),
    absent(side, "walls"),
    absent(side, "gates"),
  ];
}

function packageSummary(side) {
  return {
    evidenceFound: true,
    reviewStatus: "TEILBELEGT",
    requirementContract,
    facts: [
      {
        documentUuid: `document-${side}`,
        reviewStatus: "TEILBELEGT",
      },
    ],
  };
}

describe("directed object family comparison contract", () => {
  test("treats two complete general root inclusions as equal family coverage", () => {
    const atomsA = sideAtoms("a");
    const atomsB = sideAtoms("b");
    const result = decidePoint({
      categoryId: "VS-18",
      packageA: packageSummary("a"),
      packageB: packageSummary("b"),
      atomsA,
      atomsB,
    });

    expect(result).toMatchObject({
      outcome: "GLEICHWERTIG",
      reasonCode: "EQUAL_DIRECTED_OBJECT_FAMILY_COVERAGE",
      reviewRequired: false,
      ruleId: "EQUAL_DIRECTED_OBJECT_FAMILY_COVERAGE_V1",
      objectFamilyCoverageAudit: {
        schemaVersion: 1,
        contractId: "OBJECT_FAMILY_COVERAGE_PRESENCE_AUDIT_V1",
        categoryId: "VS-18",
        sides: {
          A: { status: "FAMILY_INCLUDED" },
          B: { status: "FAMILY_INCLUDED" },
        },
      },
    });
  });

  test.each([
    [
      "a definition without inclusion",
      sideAtoms("b", { coverageEffect: "DEFINED" }),
    ],
    [
      "a narrow root inclusion",
      sideAtoms("b", { selectedScopePicture: "NARROW_ONLY" }),
    ],
    [
      "a child inclusion without a root inclusion",
      [absent("b", "enclosures"), atom("b", "gates")],
    ],
    [
      "an explicit excluded family member",
      [...sideAtoms("b"), atom("b2", "gates", { coverageEffect: "EXCLUDED" })],
    ],
  ])("fails closed for %s", (_label, atomsB) => {
    expect(
      buildObjectFamilyCoverageAudit({
        categoryId: "VS-18",
        atomsA: sideAtoms("a"),
        atomsB,
        requirementContractA: requirementContract,
        requirementContractB: requirementContract,
      })
    ).toBeNull();
  });
});
