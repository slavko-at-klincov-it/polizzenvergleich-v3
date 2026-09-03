const {
  buildSourceBoundObjectScopeProof,
} = require("../../utils/policyAnalysis/objectScopeEvidenceContract");
const {
  OBJECT_SCOPE_IDENTITY,
  OBJECT_SCOPE_IDENTITY_COMPARISON_CONTRACT_ID,
  OBJECT_SCOPE_IDENTITY_COMPARISON_POLICY,
  OBJECT_SCOPE_IDENTITY_SATISFACTION_POLICY,
  compareObjectScopeIdentity,
} = require("../../utils/policyComparison/objectScopeIdentityComparisonContract");
const {
  POINT_OUTCOME,
  decidePoint,
} = require("../../utils/policyComparison/pointDecision");

const COMPONENT = Object.freeze({
  id: "building_glazing_breakage",
  factRole: "DAMAGE",
});
const REQUIREMENT_DIGEST = "e".repeat(64);

function evidenceContract() {
  return {
    contractId: "SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_V1",
    allowedEvidenceSources: [
      "STRUCTURAL_LOCAL_CONTEXT",
      "NESTED_LIST_CONTINUATION",
    ],
    families: [
      {
        objectScopeKey: "ALL_INSURED_BUILDING_GLAZING",
        patterns: [
          {
            sourceKinds: ["STRUCTURAL_LOCAL_CONTEXT"],
            allOf: [["Verglasung der versicherten Gebäude, insbesondere"]],
          },
        ],
      },
      {
        objectScopeKey: "COMMON_ACCESS_AREA_BUILDING_GLAZING",
        patterns: [
          {
            sourceKinds: ["STRUCTURAL_LOCAL_CONTEXT"],
            allOf: [
              ["Gebäudeverglasung von allgemein zugänglichen Bereichen"],
            ],
          },
        ],
      },
    ],
  };
}

function comparisonContract() {
  return {
    contractId: OBJECT_SCOPE_IDENTITY_COMPARISON_CONTRACT_ID,
    allowedObjectScopeKeys: [
      "ALL_INSURED_BUILDING_GLAZING",
      "COMMON_ACCESS_AREA_BUILDING_GLAZING",
    ],
    comparisonPolicy: OBJECT_SCOPE_IDENTITY_COMPARISON_POLICY,
    satisfactionPolicy: OBJECT_SCOPE_IDENTITY_SATISFACTION_POLICY,
  };
}

function atom(side, text) {
  const documentStart = 100;
  const candidateId = `candidate-${side}`;
  const objectScopeProof = buildSourceBoundObjectScopeProof({
    contract: evidenceContract(),
    occurrence: {
      physicalPageNumber: 2,
      context: {
        unitType: "LIST_ITEM",
        documentStart,
        documentEnd: documentStart + text.length,
        text,
      },
    },
  });
  return {
    requirementId: "EL-13",
    componentId: COMPONENT.id,
    componentLabel: "Glasbruch an der Gebäudeverglasung",
    factRole: COMPONENT.factRole,
    documentUuids: [`document-${side}`],
    evidencePresence: "FOUND",
    coverageEffect: "INCLUDED",
    conflictState: "NONE",
    selectedScopePicture: "NARROW_ONLY",
    comparisonScopeKeys: ["GLASBRUCH_INSURANCE"],
    scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
    documentApplicability: "ACTIVE",
    documentRole: "MAIN_POLICY",
    documentStatus: "ACTIVE",
    selectedCandidateIds: [candidateId],
    unresolvedCandidateIds: [],
    requestedFieldStatus: "NOT_REQUIRED",
    requestedFields: [],
    optionalFields: [],
    componentSatisfactionPolicy: "ALL",
    requirementContractDigest: REQUIREMENT_DIGEST,
    declaredComponents: [COMPONENT],
    fields: [],
    objectScopeEvidenceContract: evidenceContract(),
    objectScopeIdentityComparisonContract: comparisonContract(),
    sources: [
      {
        candidateId,
        physicalPageNumber: 2,
        exactText: text,
        conditionCheckDocumentStart: documentStart,
        conditionCheckDocumentEnd: documentStart + text.length,
        conditionCheckText: text,
        objectScopeProof,
      },
    ],
  };
}

function packageSummary() {
  return {
    evidenceFound: true,
    reviewStatus: "BELEGT",
    requirementContract: {
      digest: REQUIREMENT_DIGEST,
      componentSatisfactionPolicy: "ALL",
      components: [COMPONENT],
    },
  };
}

const BROAD =
  "Verglasung der versicherten Gebäude, insbesondere Fassadenverglasung.";
const RESTRICTED =
  "Gebäudeverglasung von allgemein zugänglichen Bereichen.";

describe("source-bound object-scope identity comparison", () => {
  test("keeps different complete scopes side-neutral and never chooses a winner", () => {
    const aToB = compareObjectScopeIdentity(atom("A", BROAD), atom("B", RESTRICTED));
    const bToA = compareObjectScopeIdentity(atom("A", RESTRICTED), atom("B", BROAD));

    expect(aToB.identity).toBe(OBJECT_SCOPE_IDENTITY.DIFFERENT);
    expect(bToA.identity).toBe(OBJECT_SCOPE_IDENTITY.DIFFERENT);
    expect(aToB.audit.sides).toMatchObject({
      A: { objectScopeKey: "ALL_INSURED_BUILDING_GLAZING" },
      B: { objectScopeKey: "COMMON_ACCESS_AREA_BUILDING_GLAZING" },
    });
    expect(bToA.audit.sides).toMatchObject({
      A: { objectScopeKey: "COMMON_ACCESS_AREA_BUILDING_GLAZING" },
      B: { objectScopeKey: "ALL_INSURED_BUILDING_GLAZING" },
    });
    expect(aToB.audit).not.toHaveProperty("winnerSide");
    expect(bToA.audit).not.toHaveProperty("winnerSide");
  });

  test("allows the regular comparison only for the same complete key", () => {
    expect(
      compareObjectScopeIdentity(atom("A", BROAD), atom("B", BROAD)).identity
    ).toBe(OBJECT_SCOPE_IDENTITY.SAME);
    expect(
      compareObjectScopeIdentity(
        atom("A", RESTRICTED),
        atom("B", RESTRICTED)
      ).identity
    ).toBe(OBJECT_SCOPE_IDENTITY.SAME);
  });

  test("fails closed for a missing, ambiguous, or manipulated proof", () => {
    const missing = atom("A", BROAD);
    delete missing.sources[0].objectScopeProof;
    expect(
      compareObjectScopeIdentity(missing, atom("B", RESTRICTED)).identity
    ).toBe(OBJECT_SCOPE_IDENTITY.INCOMPLETE);

    const ambiguous = atom("A", `${BROAD} ${RESTRICTED}`);
    expect(
      compareObjectScopeIdentity(ambiguous, atom("B", RESTRICTED)).identity
    ).toBe(OBJECT_SCOPE_IDENTITY.INCOMPLETE);

    const manipulated = atom("A", BROAD);
    manipulated.sources[0].objectScopeProof.objectScopeKeys = [
      "COMMON_ACCESS_AREA_BUILDING_GLAZING",
    ];
    expect(
      compareObjectScopeIdentity(manipulated, atom("B", RESTRICTED)).identity
    ).toBe(OBJECT_SCOPE_IDENTITY.INCOMPLETE);
  });

  test("maps different scopes to non-comparable and missing scope to unclear", () => {
    const different = decidePoint({
      categoryId: "EL-13",
      packageA: packageSummary(),
      packageB: packageSummary(),
      atomsA: [atom("A", BROAD)],
      atomsB: [atom("B", RESTRICTED)],
    });
    expect(different).toMatchObject({
      outcome: POINT_OUTCOME.NOT_COMPARABLE,
      reasonCode: "OBJECT_SCOPE_KEYS_DIFFER",
      reviewRequired: false,
    });

    const missing = atom("A", BROAD);
    delete missing.sources[0].objectScopeProof;
    const incomplete = decidePoint({
      categoryId: "EL-13",
      packageA: packageSummary(),
      packageB: packageSummary(),
      atomsA: [missing],
      atomsB: [atom("B", RESTRICTED)],
    });
    expect(incomplete).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "OBJECT_SCOPE_PROVENANCE_INCOMPLETE",
      reviewRequired: true,
    });
  });
});
