const {
  safeMetric,
} = require("../../../utils/PolicyComparison/PolicyComparisonMetrics");

describe("PolicyComparisonMetrics", () => {
  test("keeps only allowlisted scalar timing fields and no customer text", () => {
    expect(
      safeMetric({
        event: "caller_settled",
        kind: "comparison_fact_map",
        analysisRunId: 5,
        queueWaitMs: 12,
        outcome: "resolved",
        prompt: "kundengeheimer Vertragstext",
        filename: "Kunde.pdf",
        nested: { text: "secret" },
      })
    ).toEqual({
      event: "caller_settled",
      kind: "comparison_fact_map",
      analysisRunId: 5,
      queueWaitMs: 12,
      outcome: "resolved",
    });
  });
});
