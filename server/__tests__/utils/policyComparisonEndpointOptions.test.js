const {
  comparisonOptions,
} = require("../../endpoints/policyComparisons");

describe("policy comparison endpoint options", () => {
  test("keeps an existing session mode authoritative for all UI options", () => {
    const options = comparisonOptions(
      { policyComparisonMode: "SYMMETRIC_A_B_CORE5_V1" },
      { comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1" }
    );

    expect(options.mode).toMatchObject({
      id: "LF_IMMO_REFERENCE_A_TO_B_V1",
      direction: "A_TO_B",
      maxDocumentsA: 1,
    });
  });
});
