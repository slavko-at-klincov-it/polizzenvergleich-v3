const {
  CONFLICT_STATE,
  COVERAGE_EFFECT,
  COVERAGE_PICTURE,
  EVIDENCE_COMPLETENESS,
  EVIDENCE_PRESENCE,
  REVIEW_STATUS,
  rollupCategoryResult,
} = require("../../../utils/policyAnalysis/categoryResultContract");

const FOUND = EVIDENCE_PRESENCE.FOUND;
const NOT_FOUND = EVIDENCE_PRESENCE.NOT_FOUND;
const NONE = CONFLICT_STATE.NONE;

function component(
  componentId,
  coverageEffect,
  { evidencePresence = FOUND, conflictState = NONE } = {}
) {
  return {
    componentId,
    evidencePresence,
    coverageEffect,
    conflictState,
  };
}

function rollup(
  componentResults,
  requiredComponentIds = ["wintergarten", "vitrine"]
) {
  return rollupCategoryResult({
    categoryId: "EL-16",
    requiredComponentIds,
    componentResults,
  });
}

describe("categoryResultContract", () => {
  test("rolls included Wintergarten and excluded Vitrine into complete mixed coverage without conflict", () => {
    const result = rollup([
      component("wintergarten", COVERAGE_EFFECT.INCLUDED),
      component("vitrine", COVERAGE_EFFECT.EXCLUDED),
    ]);

    expect(result).toMatchObject({
      categoryId: "EL-16",
      evidenceCompleteness: EVIDENCE_COMPLETENESS.COMPLETE,
      coveragePicture: COVERAGE_PICTURE.MIXED,
      conflictState: CONFLICT_STATE.NONE,
      reviewStatus: REVIEW_STATUS.BELEGT,
    });
  });

  test("keeps different component effects mixed rather than contradictory", () => {
    const result = rollup([
      component("vitrine", COVERAGE_EFFECT.EXCLUDED),
      component("wintergarten", COVERAGE_EFFECT.INCLUDED),
    ]);

    expect(result.conflictState).toBe(CONFLICT_STATE.NONE);
    expect(result.coveragePicture).toBe(COVERAGE_PICTURE.MIXED);
    expect(
      result.componentResults.map(({ componentId }) => componentId)
    ).toEqual(["wintergarten", "vitrine"]);
  });

  test("propagates an already validated active same-scope conflict without choosing an effect", () => {
    const result = rollup(
      [
        component("wintergarten", COVERAGE_EFFECT.UNKNOWN, {
          conflictState: CONFLICT_STATE.ACTIVE_SAME_SCOPE,
        }),
      ],
      ["wintergarten"]
    );

    expect(result).toMatchObject({
      evidenceCompleteness: EVIDENCE_COMPLETENESS.COMPLETE,
      coveragePicture: COVERAGE_PICTURE.NOT_DETERMINABLE,
      conflictState: CONFLICT_STATE.ACTIVE_SAME_SCOPE,
      reviewStatus: REVIEW_STATUS.WIDERSPRUCHLICH,
    });
  });

  test("keeps unresolved precedence open instead of inventing a winner or conflict", () => {
    const result = rollup(
      [
        component("wintergarten", COVERAGE_EFFECT.UNKNOWN, {
          conflictState: CONFLICT_STATE.UNRESOLVED_PRECEDENCE,
        }),
      ],
      ["wintergarten"]
    );

    expect(result).toMatchObject({
      evidenceCompleteness: EVIDENCE_COMPLETENESS.COMPLETE,
      coveragePicture: COVERAGE_PICTURE.NOT_DETERMINABLE,
      conflictState: CONFLICT_STATE.UNRESOLVED_PRECEDENCE,
      reviewStatus: REVIEW_STATUS.UNGEKLAERT,
    });
  });

  test("treats a known resolved replacement as the surviving effect", () => {
    const result = rollup(
      [component("wintergarten", COVERAGE_EFFECT.INCLUDED)],
      ["wintergarten"]
    );

    expect(result).toMatchObject({
      evidenceCompleteness: EVIDENCE_COMPLETENESS.COMPLETE,
      coveragePicture: COVERAGE_PICTURE.INCLUDED,
      conflictState: CONFLICT_STATE.NONE,
      reviewStatus: REVIEW_STATUS.BELEGT,
    });
  });

  test("keeps a missing required component partial and not determinable", () => {
    const result = rollup([
      component("wintergarten", COVERAGE_EFFECT.INCLUDED),
      component("vitrine", COVERAGE_EFFECT.UNKNOWN, {
        evidencePresence: NOT_FOUND,
      }),
    ]);

    expect(result).toMatchObject({
      evidenceCompleteness: EVIDENCE_COMPLETENESS.PARTIAL,
      coveragePicture: COVERAGE_PICTURE.NOT_DETERMINABLE,
      conflictState: CONFLICT_STATE.NONE,
      reviewStatus: REVIEW_STATUS.TEILBELEGT,
    });
  });

  test("supports an explicit ANY policy for alternative object examples", () => {
    const result = rollupCategoryResult({
      categoryId: "VS-34",
      requiredComponentIds: ["community_devices", "community_tools"],
      componentSatisfactionPolicy: "ANY",
      componentResults: [
        component("community_devices", COVERAGE_EFFECT.INCLUDED),
        component("community_tools", COVERAGE_EFFECT.UNKNOWN, {
          evidencePresence: NOT_FOUND,
        }),
      ],
    });

    expect(result).toMatchObject({
      componentSatisfactionPolicy: "ANY",
      evidenceCompleteness: EVIDENCE_COMPLETENESS.COMPLETE,
      coveragePicture: COVERAGE_PICTURE.INCLUDED,
      reviewStatus: REVIEW_STATUS.BELEGT,
    });
  });

  test("keeps no evidence unresolved and never turns it into exclusion", () => {
    const result = rollup([
      component("wintergarten", COVERAGE_EFFECT.UNKNOWN, {
        evidencePresence: NOT_FOUND,
      }),
      component("vitrine", COVERAGE_EFFECT.UNKNOWN, {
        evidencePresence: NOT_FOUND,
      }),
    ]);

    expect(result).toMatchObject({
      evidenceCompleteness: EVIDENCE_COMPLETENESS.NONE,
      coveragePicture: COVERAGE_PICTURE.NOT_DETERMINABLE,
      conflictState: CONFLICT_STATE.NONE,
      reviewStatus: REVIEW_STATUS.UNGEKLAERT,
    });
  });

  test.each([COVERAGE_EFFECT.CONDITIONAL, COVERAGE_EFFECT.OPTION_ONLY])(
    "keeps a fully evidenced %s effect belegbar without forcing it into included or excluded",
    (coverageEffect) => {
      const result = rollup(
        [component("wintergarten", coverageEffect)],
        ["wintergarten"]
      );

      expect(result).toMatchObject({
        evidenceCompleteness: EVIDENCE_COMPLETENESS.COMPLETE,
        coveragePicture: COVERAGE_PICTURE.NOT_DETERMINABLE,
        conflictState: CONFLICT_STATE.NONE,
        reviewStatus: REVIEW_STATUS.BELEGT,
      });
    }
  );

  test("keeps a proven definition belegbar without inventing positive coverage", () => {
    const result = rollup(
      [component("brand_definition", COVERAGE_EFFECT.DEFINED)],
      ["brand_definition"]
    );

    expect(result).toMatchObject({
      evidenceCompleteness: EVIDENCE_COMPLETENESS.COMPLETE,
      coveragePicture: COVERAGE_PICTURE.NOT_DETERMINABLE,
      conflictState: CONFLICT_STATE.NONE,
      reviewStatus: REVIEW_STATUS.BELEGT,
    });
  });

  test("uses condition components for completeness without letting them erase a proven coverage effect", () => {
    const result = rollupCategoryResult({
      categoryId: "LW-03",
      requiredComponentIds: ["supply_pipe", "outside_on_property"],
      coverageComponentIds: ["supply_pipe"],
      componentResults: [
        component("supply_pipe", COVERAGE_EFFECT.INCLUDED),
        component("outside_on_property", COVERAGE_EFFECT.CONDITIONAL),
      ],
    });

    expect(result).toMatchObject({
      coverageComponentIds: ["supply_pipe"],
      evidenceCompleteness: EVIDENCE_COMPLETENESS.COMPLETE,
      coveragePicture: COVERAGE_PICTURE.INCLUDED,
      conflictState: CONFLICT_STATE.NONE,
      reviewStatus: REVIEW_STATUS.BELEGT,
    });
  });

  test("does not turn a conditional coverage-bearing component into proven coverage", () => {
    const result = rollupCategoryResult({
      categoryId: "LW-03",
      requiredComponentIds: ["supply_pipe", "outside_on_property"],
      coverageComponentIds: ["supply_pipe"],
      componentResults: [
        component("supply_pipe", COVERAGE_EFFECT.CONDITIONAL),
        component("outside_on_property", COVERAGE_EFFECT.DEFINED),
      ],
    });

    expect(result).toMatchObject({
      evidenceCompleteness: EVIDENCE_COMPLETENESS.COMPLETE,
      coveragePicture: COVERAGE_PICTURE.NOT_DETERMINABLE,
      reviewStatus: REVIEW_STATUS.BELEGT,
    });
  });

  test("keeps an optional supporting condition partial under role-only aggregation", () => {
    const result = rollupCategoryResult({
      categoryId: "LW-03",
      requiredComponentIds: ["supply_pipe", "outside_on_property"],
      coverageComponentIds: ["supply_pipe"],
      componentResults: [
        component("supply_pipe", COVERAGE_EFFECT.INCLUDED),
        component("outside_on_property", COVERAGE_EFFECT.OPTION_ONLY),
      ],
    });

    expect(result).toMatchObject({
      coveragePicture: COVERAGE_PICTURE.INCLUDED,
      reviewStatus: REVIEW_STATUS.TEILBELEGT,
    });
  });

  test("keeps found but uninterpreted evidence unresolved", () => {
    const result = rollup(
      [component("wintergarten", COVERAGE_EFFECT.UNKNOWN)],
      ["wintergarten"]
    );

    expect(result).toMatchObject({
      evidenceCompleteness: EVIDENCE_COMPLETENESS.COMPLETE,
      coveragePicture: COVERAGE_PICTURE.NOT_DETERMINABLE,
      conflictState: CONFLICT_STATE.NONE,
      reviewStatus: REVIEW_STATUS.UNGEKLAERT,
    });
  });

  test("fails closed when a required component has no terminal result", () => {
    expect(() =>
      rollup([component("wintergarten", COVERAGE_EFFECT.INCLUDED)])
    ).toThrow("MISSING_COMPONENT_RESULT: vitrine");
  });

  test("rejects duplicate, unknown and inconsistent component results", () => {
    expect(() =>
      rollup([
        component("wintergarten", COVERAGE_EFFECT.INCLUDED),
        component("wintergarten", COVERAGE_EFFECT.EXCLUDED),
      ])
    ).toThrow("DUPLICATE_COMPONENT_RESULT: wintergarten");

    expect(() =>
      rollup([
        component("wintergarten", COVERAGE_EFFECT.INCLUDED),
        component("fremd", COVERAGE_EFFECT.EXCLUDED),
      ])
    ).toThrow("UNKNOWN_COMPONENT_RESULT: fremd");

    expect(() =>
      rollup([
        component("wintergarten", COVERAGE_EFFECT.INCLUDED),
        component("vitrine", COVERAGE_EFFECT.EXCLUDED, {
          evidencePresence: NOT_FOUND,
        }),
      ])
    ).toThrow("MISSING_EVIDENCE_MUST_BE_UNKNOWN: vitrine");
  });

  test("rejects a chosen effect for an unresolved conflict", () => {
    expect(() =>
      rollup(
        [
          component("wintergarten", COVERAGE_EFFECT.INCLUDED, {
            conflictState: CONFLICT_STATE.ACTIVE_SAME_SCOPE,
          }),
        ],
        ["wintergarten"]
      )
    ).toThrow("CONFLICT_EFFECT_MUST_BE_UNKNOWN: wintergarten");
  });

  test("rejects unknown enum values", () => {
    expect(() =>
      rollup(
        [
          component("wintergarten", "MAYBE", {
            evidencePresence: "POSSIBLY_FOUND",
          }),
        ],
        ["wintergarten"]
      )
    ).toThrow("INVALID_EVIDENCE_PRESENCE: wintergarten: POSSIBLY_FOUND");
  });

  test("rejects a coverage component outside the required component set", () => {
    expect(() =>
      rollupCategoryResult({
        categoryId: "LW-03",
        requiredComponentIds: ["supply_pipe", "outside_on_property"],
        coverageComponentIds: ["foreign"],
        componentResults: [
          component("supply_pipe", COVERAGE_EFFECT.INCLUDED),
          component("outside_on_property", COVERAGE_EFFECT.CONDITIONAL),
        ],
      })
    ).toThrow("UNKNOWN_COVERAGE_COMPONENT_ID: foreign");
  });
});
