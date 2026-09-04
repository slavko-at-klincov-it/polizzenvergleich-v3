const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  readValidatedComparisonResult,
} = require("../../utils/policyComparison/comparisonResultReader");
const {
  POLICY_COMPARISON_MODE,
} = require("../../utils/policyComparison/modes");

describe("policy comparison result reader", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "comparison-result-reader-"));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  function resultFile(comparisonMode) {
    const file = path.join(root, "comparison.private.json");
    fs.writeFileSync(file, JSON.stringify({ comparisonMode }));
    return file;
  }

  test("rejects an LF result attached to a symmetric session", () => {
    expect(() =>
      readValidatedComparisonResult(
        resultFile(POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B),
        POLICY_COMPARISON_MODE.SYMMETRIC_A_B
      )
    ).toThrow(
      "COMPARISON_RESULT_MODE_MISMATCH:SYMMETRIC_A_B_CORE5_V1:LF_IMMO_REFERENCE_A_TO_B_V1"
    );
  });

  test("rejects a symmetric result attached to an LF session", () => {
    expect(() =>
      readValidatedComparisonResult(
        resultFile(POLICY_COMPARISON_MODE.SYMMETRIC_A_B),
        POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B
      )
    ).toThrow(
      "COMPARISON_RESULT_MODE_MISMATCH:LF_IMMO_REFERENCE_A_TO_B_V1:SYMMETRIC_A_B_CORE5_V1"
    );
  });
});
