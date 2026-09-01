const {
  presentComparisonMetrics,
  presentPointDecision,
} = require("../../../frontend/src/utils/chat/policyComparisonResultPresenter.cjs");

describe("policy comparison result presenter", () => {
  test("presents a V2 point decision", () => {
    expect(
      presentPointDecision({
        pointDecision: {
          outcome: "VORTEIL_B",
          reason: "B ist in diesem Punkt besser.",
          ruleId: "RULE_V1",
        },
      })
    ).toMatchObject({
      outcome: "VORTEIL_B",
      label: "Vorteil Paket B",
      legacyFallback: false,
    });
  });

  test("keeps a stored V1 result fail-closed", () => {
    expect(
      presentPointDecision({ difference: "Fachlich zu prüfen." })
    ).toMatchObject({
      outcome: "UNKLAR",
      reason: "Fachlich zu prüfen.",
      ruleId: "LEGACY_FAIL_CLOSED_V1",
      legacyFallback: true,
    });
  });

  test("labels bilateral complete absence without calling it equivalent", () => {
    expect(
      presentPointDecision({
        pointDecision: {
          outcome: "KEIN_DOKUMENTIERTER_VORTEIL",
          reason: "In beiden Paketen nicht gefunden.",
          ruleId: "COMPLETE_SEARCH_ABSENCE_BOTH_V1",
        },
      })
    ).toMatchObject({
      outcome: "KEIN_DOKUMENTIERTER_VORTEIL",
      label: "In beiden Polizzen keine passende Vertragsregelung gefunden",
      legacyFallback: false,
    });
  });

  test("labels a one-sided controlled zero match as documentation difference", () => {
    expect(
      presentPointDecision({
        pointDecision: {
          outcome: "DOKUMENTATIONSUNTERSCHIED",
          reason: "Nur in Paket A dokumentiert.",
          ruleId: "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V1",
        },
      })
    ).toMatchObject({
      outcome: "DOKUMENTATIONSUNTERSCHIED",
      label: "Dokumentationsunterschied",
      legacyFallback: false,
    });
  });

  test("uses only the customer-review metric and never the legacy difference total", () => {
    expect(
      presentComparisonMetrics({
        schemaVersion: 6,
        totals: {
          rows: 224,
          customerReviewRequired: 67,
          legacyTechnicalDifferences: 105,
        },
      })
    ).toEqual({ rows: 224, customerReviewRequired: 67, legacyFallback: false });
    expect(
      presentComparisonMetrics({
        schemaVersion: 5,
        totals: {
          rows: 224,
          reviewRequired: 105,
          pointDecisionReviewRequired: 67,
        },
      })
    ).toEqual({ rows: 224, customerReviewRequired: 67, legacyFallback: true });
  });
});
