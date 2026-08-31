const {
  POINT_OUTCOME,
  decidePoint,
} = require("../../utils/policyComparison/pointDecision");

function packageSummary(overrides = {}) {
  return {
    evidenceFound: true,
    reviewStatus: "BELEGT",
    ...overrides,
  };
}

function atom(side, overrides = {}) {
  const candidateId = `candidate-${side}`;
  return {
    requirementId: "LW-22",
    componentId: "fungus_damage",
    componentLabel: "Pilzschäden",
    factRole: "DAMAGE",
    documentUuids: [`document-${side}`],
    evidencePresence: "FOUND",
    coverageEffect: "INCLUDED",
    conflictState: "NONE",
    selectedScopePicture: "GENERAL",
    documentApplicability: "CONDITIONAL",
    selectedCandidateIds: [candidateId],
    unresolvedCandidateIds: [],
    requestedFieldStatus: "NOT_REQUIRED",
    fields: [],
    sources: [
      {
        candidateId,
        physicalPageNumber: 2,
        exactText: "Vertragsbeleg",
      },
    ],
    ...overrides,
  };
}

function decide(atomsA, atomsB, overrides = {}) {
  return decidePoint({
    categoryId: "LW-22",
    packageA: packageSummary(overrides.packageA),
    packageB: packageSummary(overrides.packageB),
    atomsA,
    atomsB,
  });
}

describe("policy comparison point decision", () => {
  test("prefers explicit inclusion over explicit exclusion in the same atomic scope", () => {
    const result = decide(
      [atom("a", { coverageEffect: "EXCLUDED" })],
      [atom("b", { coverageEffect: "INCLUDED" })]
    );

    expect(result).toMatchObject({
      outcome: POINT_OUTCOME.ADVANTAGE_B,
      ruleId: "INCLUDED_OVER_EXCLUDED_V1",
      reviewRequired: false,
    });
    expect(result.reason).toContain("A ausdrücklich ausgeschlossen");
    expect(result.reason).toContain("B eingeschlossen");
  });

  test("does not turn one-sided or missing evidence into an advantage", () => {
    expect(
      decide([atom("a")], [], {
        packageB: { evidenceFound: false, reviewStatus: "UNGEKLÄRT" },
      })
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "MISSING_ONE_SIDE",
    });
    expect(
      decide([], [], {
        packageA: { evidenceFound: false, reviewStatus: "UNGEKLÄRT" },
        packageB: { evidenceFound: false, reviewStatus: "UNGEKLÄRT" },
      })
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "MISSING_BOTH",
    });
  });

  test("blocks partial, contradictory and unresolved package states", () => {
    for (const reviewStatus of [
      "TEILBELEGT",
      "WIDERSPRÜCHLICH",
      "RANGFOLGE_PRÜFEN",
      "UNGEKLÄRT",
    ]) {
      expect(
        decide([atom("a")], [atom("b")], {
          packageA: { reviewStatus },
        })
      ).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
      });
    }
  });

  test("keeps conditional coverage effects and options fail-closed", () => {
    for (const coverageEffect of ["CONDITIONAL", "DEFINED", "UNKNOWN"]) {
      expect(
        decide([atom("a", { coverageEffect })], [atom("b", { coverageEffect })])
      ).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        reasonCode: "NO_APPROVED_RULE_FOR_ALL_DIMENSIONS",
      });
    }
  });

  test("keeps coverage clauses with conditions or exceptions fail-closed", () => {
    for (const exactText of [
      "Schäden durch Holzfäule sind ausgeschlossen, außer sie sind auf ein versichertes Ereignis zurückzuführen.",
      "Schäden sind eingeschlossen, sofern die Leitung ordnungsgemäß gewartet wurde.",
      "Schäden sind versichert, wenn die Anlage dauerhaft bewohnt ist.",
      "Schäden sind gedeckt, soweit keine andere Versicherung leistet.",
      "Schäden sind ausgenommen, vorausgesetzt der Versicherungsnehmer weist die Ursache nach.",
    ]) {
      const result = decide(
        [atom("a", { coverageEffect: "EXCLUDED" })],
        [
          atom("b", {
            coverageEffect: "INCLUDED",
            sources: [
              {
                candidateId: "candidate-b",
                physicalPageNumber: 2,
                exactText: "Holzfäule",
                conditionCheckText: exactText,
              },
            ],
          }),
        ]
      );
      expect(result).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        reasonCode: "CONDITIONAL_OR_EXCEPTION_SCOPE",
        ruleId: "FAIL_CLOSED_CONDITIONAL_SOURCE_V1",
        reviewRequired: true,
      });
      expect(result.reason).toContain("Bedingung oder Ausnahme");
    }
  });

  test("does not mistake a peril definition for a conditional coverage promise", () => {
    const definition =
      "Direkter Blitzschlag ist die schädigende Kraft oder Wärmewirkung des Blitzes, wenn er unmittelbar in die versicherten Sachen einschlägt.";
    const result = decide(
      [atom("a")],
      [
        atom("b", {
          sources: [
            {
              candidateId: "candidate-b",
              physicalPageNumber: 2,
              exactText: "Direkter Blitzschlag",
              conditionCheckText: definition,
            },
          ],
        }),
      ]
    );
    expect(result).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
    });
  });

  test("treats different applicability, scope and qualifier as not comparable", () => {
    expect(
      decide(
        [atom("a")],
        [atom("b", { documentApplicability: "PROPOSED_ONLY" })]
      )
    ).toMatchObject({ outcome: POINT_OUTCOME.NOT_COMPARABLE });

    const limit = (side, qualifier) =>
      atom(side, {
        componentId: "coverage_limit",
        componentLabel: "Deckungslimit",
        factRole: "LIMIT",
        coverageEffect: "DEFINED",
        requestedFieldStatus: "COMPLETE",
        fields: [
          {
            field: "limit",
            status: "FOUND",
            facts: [
              {
                normalizedValue: "EUR 5.000.000",
                valueType: "MONEY",
                unit: "EUR",
                limitKind: "CAPPED",
                qualifier,
                source: {
                  candidateId: `candidate-${side}`,
                  physicalPageNumber: 2,
                  exactText: "EUR 5.000.000",
                },
              },
            ],
          },
        ],
      });
    expect(
      decide([limit("a", "je Ereignis")], [limit("b", "Jahreshöchstlimit")])
    ).toMatchObject({ outcome: POINT_OUTCOME.NOT_COMPARABLE });
  });

  test("orders only typed comparable limits and deductibles", () => {
    const valuedAtom = (side, factRole, amount) =>
      atom(side, {
        componentId:
          factRole === "LIMIT" ? "coverage_limit" : "policy_deductible",
        componentLabel: factRole === "LIMIT" ? "Deckungslimit" : "Selbstbehalt",
        factRole,
        coverageEffect: "DEFINED",
        requestedFieldStatus: "COMPLETE",
        fields: [
          {
            field: "limit",
            status: "FOUND",
            facts: [
              {
                normalizedValue: amount,
                valueType: "MONEY",
                unit: "EUR",
                limitKind: "CAPPED",
                qualifier: "je Schadenfall",
                source: {
                  candidateId: `candidate-${side}`,
                  physicalPageNumber: 2,
                  exactText: amount,
                },
              },
            ],
          },
        ],
      });

    const higherLimit = decide(
      [valuedAtom("a", "LIMIT", "EUR 5.000.000")],
      [valuedAtom("b", "LIMIT", "EUR 3.000.000")]
    );
    expect(higherLimit).toMatchObject({
      outcome: POINT_OUTCOME.ADVANTAGE_A,
      ruleId: "HIGHER_COVERAGE_LIMIT_V1",
    });
    expect(higherLimit.reason).toContain("A EUR 5.000.000");
    expect(higherLimit.reason).toContain("B EUR 3.000.000");
    expect(
      decide(
        [valuedAtom("a", "DEDUCTIBLE", "EUR 1.000")],
        [valuedAtom("b", "DEDUCTIBLE", "EUR 500")]
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.ADVANTAGE_B,
      ruleId: "LOWER_DEDUCTIBLE_V1",
    });
  });

  test("recognizes equivalent inclusions and explicit exclusions", () => {
    expect(decide([atom("a")], [atom("b")])).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
    });
    expect(
      decide(
        [atom("a", { coverageEffect: "EXCLUDED" })],
        [atom("b", { coverageEffect: "EXCLUDED" })]
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
    });
  });

  test("blocks mixed winners and invalid server-bound sources", () => {
    const second = (side, effect) =>
      atom(side, {
        componentId: "rot_damage",
        componentLabel: "Fäulnisschäden",
        coverageEffect: effect,
      });
    expect(
      decide(
        [atom("a"), second("a", "EXCLUDED")],
        [atom("b", { coverageEffect: "EXCLUDED" }), second("b", "INCLUDED")]
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "MIXED_DIMENSION_WINNERS",
    });
    expect(decide([atom("a", { sources: [] })], [atom("b")])).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "ATOMIC_EVIDENCE_INCOMPLETE",
    });
    const invalidFieldSource = atom("a", {
      factRole: "LIMIT",
      coverageEffect: "DEFINED",
      requestedFieldStatus: "COMPLETE",
      fields: [
        {
          field: "limit",
          status: "FOUND",
          facts: [
            {
              normalizedValue: "EUR 5.000.000",
              valueType: "MONEY",
              unit: "EUR",
              limitKind: "CAPPED",
            },
          ],
        },
      ],
    });
    expect(
      decide([invalidFieldSource], [{ ...invalidFieldSource }])
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "ATOMIC_EVIDENCE_INCOMPLETE",
    });
  });

  test("is symmetric and insensitive to duplicate document facts and ordering", () => {
    const a = atom("a", { coverageEffect: "EXCLUDED" });
    const b = atom("b", { coverageEffect: "INCLUDED" });
    expect(decide([a, { ...a }], [b]).outcome).toBe(POINT_OUTCOME.ADVANTAGE_B);
    expect(decide([b], [a]).outcome).toBe(POINT_OUTCOME.ADVANTAGE_A);
  });
});
