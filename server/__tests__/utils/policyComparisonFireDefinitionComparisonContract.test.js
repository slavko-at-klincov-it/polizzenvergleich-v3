const {
  FIRE_DEFINITION_COMPARISON_RULE_ID,
  compareFireDefinition,
} = require("../../utils/policyComparison/fireDefinitionComparisonContract");
const {
  canonicalComparisonAtoms,
} = require("../../utils/policyComparison/comparisonAtomCanonicalization");

const REQUIREMENT_DIGEST = "a".repeat(64);
const COMPONENTS = Object.freeze([
  { id: "fire_definition", factRole: "DEFINITION" },
]);
const SPREAD_ONLY =
  "Brand das ist ein Feuer, das sich bestimmungswidrig ausbreitet.";
const ARISE_OR_SPREAD =
  "Brand ist ein Feuer, das bestimmungswidrig entsteht und/oder sich bestimmungswidrig ausbreitet (Schadenfeuer).";

function definitionAtom(side, conditionCheckText, overrides = {}) {
  const candidateId = `candidate-${side}`;
  return {
    requirementId: "FE-A01",
    componentId: "fire_definition",
    componentLabel: "Definition des Brandbegriffs im Bedingungswerk",
    factRole: "DEFINITION",
    documentUuids: [`document-${side}`],
    evidencePresence: "FOUND",
    coverageEffect: "DEFINED",
    conflictState: "NONE",
    selectedScopePicture: "GENERAL",
    scopePolicy: "GENERAL_REQUIRED",
    documentApplicability: "CONDITIONAL",
    documentRole: "FRAMEWORK_TERMS",
    documentStatus: "FRAMEWORK_TERMS",
    selectedCandidateIds: [candidateId],
    unresolvedCandidateIds: [],
    requestedFieldStatus: "NOT_REQUIRED",
    requestedFields: [],
    optionalFields: [],
    componentSatisfactionPolicy: "ALL",
    requirementContractDigest: REQUIREMENT_DIGEST,
    declaredComponents: COMPONENTS,
    fields: [],
    sources: [
      {
        candidateId,
        physicalPageNumber: 2,
        exactText: "Brand ist ein Feuer",
        conditionCheckText,
      },
    ],
    ...overrides,
  };
}

describe("FE-A01 fire-definition comparison contract", () => {
  test("orders the arise-or-spread definition above spread-only", () => {
    expect(
      compareFireDefinition(
        definitionAtom("a", SPREAD_ONLY),
        definitionAtom("b", ARISE_OR_SPREAD)
      )
    ).toEqual({
      equivalent: false,
      winnerSide: "B",
      ruleId: FIRE_DEFINITION_COMPARISON_RULE_ID,
    });
    expect(
      compareFireDefinition(
        definitionAtom("a", ARISE_OR_SPREAD),
        definitionAtom("b", SPREAD_ONLY)
      )
    ).toEqual({
      equivalent: false,
      winnerSide: "A",
      ruleId: FIRE_DEFINITION_COMPARISON_RULE_ID,
    });
  });

  test.each([SPREAD_ONLY, ARISE_OR_SPREAD])(
    "treats the same recognized definition as equal: %s",
    (definition) => {
      expect(
        compareFireDefinition(
          definitionAtom("a", definition),
          definitionAtom("b", definition)
        )
      ).toEqual({
        equivalent: true,
        winnerSide: null,
        ruleId: FIRE_DEFINITION_COMPARISON_RULE_ID,
      });
    }
  );

  test("keeps the real spread-only clause source-bound despite adjacent Kaminbrand text", () => {
    const lfClause =
      "Brand das ist ein Feuer, das sich bestimmungswidrig ausbreitet; Schäden durch Kaminbrand sind mitversichert. Das Regressrecht bleibt unberührt.";
    expect(
      compareFireDefinition(
        definitionAtom("a", lfClause),
        definitionAtom("b", ARISE_OR_SPREAD)
      )
    ).toMatchObject({ winnerSide: "B" });
  });

  test("supports canonical package atoms without trusting flattened sources", () => {
    const canonicalA = canonicalComparisonAtoms([
      definitionAtom("a", SPREAD_ONLY),
    ])[0];
    const canonicalB = canonicalComparisonAtoms([
      definitionAtom("b", ARISE_OR_SPREAD),
    ])[0];
    expect(compareFireDefinition(canonicalA, canonicalB)).toMatchObject({
      equivalent: false,
      winnerSide: "B",
      ruleId: FIRE_DEFINITION_COMPARISON_RULE_ID,
    });
  });

  test.each([
    [
      "negated definition",
      "Brand ist kein Feuer, das sich bestimmungswidrig ausbreitet.",
      {},
    ],
    [
      "negated origin",
      "Brand ist ein Feuer, das nicht bestimmungswidrig entsteht und/oder sich bestimmungswidrig ausbreitet.",
      {},
    ],
    ["excluded context", `Nicht versichert: ${ARISE_OR_SPREAD}`, {}],
    ["optional context", `Optional vereinbar: ${ARISE_OR_SPREAD}`, {}],
    [
      "conjunctive form",
      "Brand ist ein Feuer, das bestimmungswidrig entsteht und sich bestimmungswidrig ausbreitet.",
      {},
    ],
    ["unknown form", "Brand ist ein Feuer, das bestimmungsgemäß entsteht.", {}],
    ["other role", ARISE_OR_SPREAD, { factRole: "PERIL" }],
    ["other component", ARISE_OR_SPREAD, { componentId: "fire_damage" }],
    ["narrow scope", ARISE_OR_SPREAD, { selectedScopePicture: "NARROW_ONLY" }],
    [
      "unresolved evidence",
      ARISE_OR_SPREAD,
      { unresolvedCandidateIds: ["candidate-review"] },
    ],
  ])("fails closed for %s", (_label, text, overrides) => {
    expect(
      compareFireDefinition(
        definitionAtom("a", SPREAD_ONLY),
        definitionAtom("b", text, overrides)
      )
    ).toBeNull();
  });

  test("fails closed when bound sources disagree or are not selected", () => {
    const conflicting = definitionAtom("b", ARISE_OR_SPREAD);
    conflicting.sources.push({
      candidateId: "candidate-b",
      physicalPageNumber: 3,
      exactText: SPREAD_ONLY,
    });
    expect(
      compareFireDefinition(definitionAtom("a", SPREAD_ONLY), conflicting)
    ).toBeNull();

    const unselected = definitionAtom("b", ARISE_OR_SPREAD);
    unselected.sources.push({
      candidateId: "candidate-unselected",
      physicalPageNumber: 3,
      exactText: ARISE_OR_SPREAD,
    });
    expect(
      compareFireDefinition(definitionAtom("a", SPREAD_ONLY), unselected)
    ).toBeNull();
  });
});
