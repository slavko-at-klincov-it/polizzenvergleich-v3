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
        categories: [
          {
            categoryView: "VS",
            rows: [
              {
                categoryId: "VS-01",
                pointDecision: {
                  outcome: "UNKLAR",
                  reasonCode: "MISSING_ONE_SIDE",
                  reviewRequired: false,
                },
              },
            ],
          },
        ],
        totals: {
          rows: 1,
          customerReviewRequired: 1,
          legacyTechnicalDifferences: 105,
          pointDecisions: {
            VORTEIL_A: 0,
            VORTEIL_B: 0,
            DOKUMENTATIONSUNTERSCHIED: 0,
            GLEICHWERTIG: 0,
            KEIN_DOKUMENTIERTER_VORTEIL: 0,
            NICHT_VERGLEICHBAR: 0,
            UNKLAR: 1,
          },
        },
      })
    ).toEqual({
      rows: 1,
      customerReviewRequired: 1,
      pointDecisions: {
        VORTEIL_A: 0,
        VORTEIL_B: 0,
        DOKUMENTATIONSUNTERSCHIED: 0,
        GLEICHWERTIG: 0,
        KEIN_DOKUMENTIERTER_VORTEIL: 0,
        NICHT_VERGLEICHBAR: 0,
        UNKLAR: 1,
      },
      pointDecisionRowKeysByOutcome: {
        VORTEIL_A: [],
        VORTEIL_B: [],
        DOKUMENTATIONSUNTERSCHIED: [],
        GLEICHWERTIG: [],
        KEIN_DOKUMENTIERTER_VORTEIL: [],
        NICHT_VERGLEICHBAR: [],
        UNKLAR: ["VS:VS-01"],
      },
      customerReviewBreakdown: [
        {
          reasonCode: "MISSING_ONE_SIDE",
          label: "Nur eine Seite enthält einen belastbaren Beleg",
          count: 1,
        },
      ],
      legacyFallback: false,
      storedMetricDiscrepancy: false,
    });
    expect(
      presentComparisonMetrics({
        schemaVersion: 5,
        categories: [
          {
            categoryView: "VS",
            rows: [
              {
                categoryId: "VS-01",
                difference: "Altes Ergebnis ohne Punktentscheidung",
              },
            ],
          },
        ],
        totals: {
          rows: 1,
          reviewRequired: 105,
          pointDecisionReviewRequired: 0,
        },
      })
    ).toEqual({
      rows: 1,
      customerReviewRequired: 1,
      pointDecisions: {
        VORTEIL_A: 0,
        VORTEIL_B: 0,
        DOKUMENTATIONSUNTERSCHIED: 0,
        GLEICHWERTIG: 0,
        KEIN_DOKUMENTIERTER_VORTEIL: 0,
        NICHT_VERGLEICHBAR: 0,
        UNKLAR: 1,
      },
      pointDecisionRowKeysByOutcome: {
        VORTEIL_A: [],
        VORTEIL_B: [],
        DOKUMENTATIONSUNTERSCHIED: [],
        GLEICHWERTIG: [],
        KEIN_DOKUMENTIERTER_VORTEIL: [],
        NICHT_VERGLEICHBAR: [],
        UNKLAR: ["VS:VS-01"],
      },
      customerReviewBreakdown: [
        {
          reasonCode: "LEGACY_RESULT_WITHOUT_POINT_DECISION",
          label: "Anderer Prüfgrund",
          count: 1,
        },
      ],
      legacyFallback: true,
      storedMetricDiscrepancy: true,
    });
  });

  test("labels package review blockers without multiplying their row count", () => {
    const metrics = presentComparisonMetrics({
      schemaVersion: 7,
      categories: [
        {
          categoryView: "VS",
          rows: [
            {
              categoryId: "VS-01",
              pointDecision: {
                outcome: "UNKLAR",
                reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
                reviewRequired: true,
              },
            },
          ],
        },
      ],
      totals: {
        rows: 1,
        customerReviewRequired: 1,
        pointDecisions: {
          VORTEIL_A: 0,
          VORTEIL_B: 0,
          DOKUMENTATIONSUNTERSCHIED: 0,
          GLEICHWERTIG: 0,
          KEIN_DOKUMENTIERTER_VORTEIL: 0,
          NICHT_VERGLEICHBAR: 0,
          UNKLAR: 1,
        },
      },
    });
    expect(metrics.customerReviewRequired).toBe(1);
    expect(metrics.customerReviewBreakdown).toEqual([
      {
        reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
        label: "Offene Teilpunkte in mindestens einer Polizze",
        count: 1,
      },
    ]);
  });
});
