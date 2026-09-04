const {
  DEFAULT_POLICY_COMPARISON_MODE,
  POLICY_COMPARISON_MODE,
  PolicyComparisonModeError,
  normalizePolicyComparisonMode,
  policyComparisonMode,
  publicPolicyComparisonModes,
} = require("../../utils/policyComparison/modes");

describe("policy comparison modes", () => {
  test("defines one directed and one symmetric workflow", () => {
    const modes = publicPolicyComparisonModes();
    expect(modes).toHaveLength(2);
    expect(modes.map(({ id }) => id)).toEqual([
      POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
      POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
    ]);
    expect(
      policyComparisonMode(POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B)
    ).toMatchObject({
      direction: "A_TO_B",
      maxDocumentsA: 1,
      maxDocumentsB: 9,
      discoversSideBOnly: false,
    });
  });

  test("defaults legacy callers to the symmetric workflow", () => {
    expect(normalizePolicyComparisonMode()).toBe(
      DEFAULT_POLICY_COMPARISON_MODE
    );
  });

  test("rejects removed or malformed workflow identifiers", () => {
    expect(() => normalizePolicyComparisonMode("VS")).toThrow(
      PolicyComparisonModeError
    );
    expect(() => normalizePolicyComparisonMode({ id: "VS" })).toThrow(
      PolicyComparisonModeError
    );
  });
});
