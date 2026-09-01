const {
  METRIC_CONTRACT_ID,
  customerSafeComparisonReadView,
  deriveCustomerMetrics,
  validateCustomerComparison,
} = require("../../utils/policyComparison/customerMetricContract");

function row(
  categoryId,
  outcome,
  legacyOutcome = "UNTERSCHIED_FACHLICH_PRÜFEN",
  reasonCode = outcome === "UNKLAR" ? "MISSING_ONE_SIDE" : "TEST_DECISION"
) {
  return {
    categoryId,
    outcome: legacyOutcome,
    pointDecision: {
      outcome,
      reasonCode,
      reviewRequired: outcome === "UNKLAR",
    },
  };
}

function resultFor(rows) {
  const categories = [{ categoryView: "VS", rows }];
  return {
    schemaVersion: 6,
    status: "COMPARISON_RESULT_MATERIALIZED",
    categories,
    totals: deriveCustomerMetrics(categories),
  };
}

describe("policy comparison customer metric contract", () => {
  test("derives customer review only from unclear point decisions", () => {
    const result = resultFor([
      row("VS-01", "UNKLAR"),
      row("VS-02", "DOKUMENTATIONSUNTERSCHIED"),
      row("VS-03", "KEIN_DOKUMENTIERTER_VORTEIL", "BEIDSEITIG_KEIN_BELEG"),
    ]);

    expect(result.totals).toMatchObject({
      metricContractId: METRIC_CONTRACT_ID,
      rows: 3,
      customerReviewRequired: 1,
      noCustomerReviewRequired: 2,
      customerReviewByReasonCode: { MISSING_ONE_SIDE: 1 },
      customerReviewRowKeysByReasonCode: {
        MISSING_ONE_SIDE: ["VS:VS-01"],
      },
      legacyTechnicalDifferences: 2,
      pointDecisionRowKeysByOutcome: {
        VORTEIL_A: [],
        VORTEIL_B: [],
        DOKUMENTATIONSUNTERSCHIED: ["VS:VS-02"],
        GLEICHWERTIG: [],
        KEIN_DOKUMENTIERTER_VORTEIL: ["VS:VS-03"],
        NICHT_VERGLEICHBAR: [],
        UNKLAR: ["VS:VS-01"],
      },
    });
    expect(result.totals).not.toHaveProperty("reviewRequired");
    expect(validateCustomerComparison(result)).toMatchObject({
      rows: 3,
      customerReviewRequired: 1,
    });
  });

  test.each([
    [
      "stored customer review",
      (value) => (value.totals.customerReviewRequired = 2),
    ],
    [
      "stored outcome total",
      (value) => (value.totals.pointDecisions.UNKLAR = 0),
    ],
    [
      "stored outcome membership",
      (value) => value.totals.pointDecisionRowKeysByOutcome.UNKLAR.pop(),
    ],
    [
      "stored review reason count",
      (value) => (value.totals.customerReviewByReasonCode.MISSING_ONE_SIDE = 2),
    ],
    [
      "stored review reason membership",
      (value) =>
        value.totals.customerReviewRowKeysByReasonCode.MISSING_ONE_SIDE.push(
          "VS:VS-99"
        ),
    ],
    [
      "row review flag",
      (value) =>
        (value.categories[0].rows[0].pointDecision.reviewRequired = false),
    ],
    [
      "duplicate row identity",
      (value) =>
        value.categories[0].rows.push({ ...value.categories[0].rows[0] }),
    ],
    [
      "materialization status",
      (value) => (value.status = "CUSTOMER_RESULT_COMPLETE"),
    ],
    [
      "legacy technical outcome",
      (value) => (value.categories[0].rows[0].outcome = "UNKNOWN_VALUE"),
    ],
  ])("rejects a manipulated %s", (_label, mutate) => {
    const result = resultFor([row("VS-01", "UNKLAR")]);
    mutate(result);
    expect(() => validateCustomerComparison(result)).toThrow(/^COMPARISON_/u);
  });

  test("requires every unclear row to have one auditable reason group", () => {
    const result = resultFor([row("VS-01", "UNKLAR")]);
    result.categories[0].rows[0].pointDecision.reasonCode = "";
    result.totals = deriveCustomerMetrics(result.categories);
    expect(() => validateCustomerComparison(result)).toThrow(
      "COMPARISON_CUSTOMER_REVIEW_REASON_MISSING"
    );
  });

  test("allows stored V5 results only through the explicit legacy adapter", () => {
    const legacy = { schemaVersion: 5, totals: { reviewRequired: 105 } };
    expect(() => validateCustomerComparison(legacy)).toThrow(
      "COMPARISON_METRIC_SCHEMA_UNSUPPORTED"
    );
    expect(validateCustomerComparison(legacy, { allowLegacy: true })).toEqual({
      legacy: true,
      metricContractId: null,
      rows: null,
      customerReviewRequired: null,
      noCustomerReviewRequired: null,
      pointDecisions: null,
      pointDecisionRowKeysByOutcome: null,
      storedMetricDiscrepancy: null,
    });
  });

  test("recomputes legacy review from rows and treats missing point decisions fail-closed", () => {
    const legacy = {
      schemaVersion: 5,
      categories: [
        {
          categoryView: "VS",
          rows: [
            row("VS-01", "GLEICHWERTIG"),
            { categoryId: "VS-02", outcome: "INHALTLICH_GLEICH" },
          ],
        },
      ],
      totals: { pointDecisionReviewRequired: 0 },
    };
    expect(validateCustomerComparison(legacy, { allowLegacy: true })).toEqual({
      legacy: true,
      metricContractId: null,
      rows: 2,
      customerReviewRequired: 1,
      noCustomerReviewRequired: 1,
      pointDecisions: {
        VORTEIL_A: 0,
        VORTEIL_B: 0,
        DOKUMENTATIONSUNTERSCHIED: 0,
        GLEICHWERTIG: 1,
        KEIN_DOKUMENTIERTER_VORTEIL: 0,
        NICHT_VERGLEICHBAR: 0,
        UNKLAR: 1,
      },
      pointDecisionRowKeysByOutcome: {
        VORTEIL_A: [],
        VORTEIL_B: [],
        DOKUMENTATIONSUNTERSCHIED: [],
        GLEICHWERTIG: ["VS:VS-01"],
        KEIN_DOKUMENTIERTER_VORTEIL: [],
        NICHT_VERGLEICHBAR: [],
        UNKLAR: ["VS:VS-02"],
      },
      storedMetricDiscrepancy: true,
    });
  });

  test("returns a customer-safe legacy read view without the ambiguous total", () => {
    const legacy = {
      schemaVersion: 5,
      categories: [
        {
          categoryView: "VS",
          rows: [{ categoryId: "VS-01", outcome: "INHALTLICH_GLEICH" }],
        },
      ],
      totals: { rows: 1, reviewRequired: 105 },
    };
    const view = customerSafeComparisonReadView(legacy);
    expect(view.totals).not.toHaveProperty("reviewRequired");
    expect(view.customerMetrics).toMatchObject({
      rows: 1,
      customerReviewRequired: 1,
      pointDecisions: { UNKLAR: 1 },
    });
  });
});
