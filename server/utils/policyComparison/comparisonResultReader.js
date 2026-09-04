const fs = require("fs");
const { customerSafeComparisonReadView } = require("./customerMetricContract");
const {
  normalizePolicyComparisonMode,
  POLICY_COMPARISON_MODE,
} = require("./modes");
const { customerSafeReferenceReadView } = require("./referenceResultBuilder");

function readValidatedComparisonResult(resultFile, expectedComparisonMode) {
  const expectedMode = normalizePolicyComparisonMode(expectedComparisonMode, {
    allowDefault: false,
  });
  const result = JSON.parse(fs.readFileSync(resultFile, "utf8"));
  const resultMode = normalizePolicyComparisonMode(result?.comparisonMode, {
    allowDefault: false,
  });
  if (resultMode !== expectedMode)
    throw new Error(
      `COMPARISON_RESULT_MODE_MISMATCH:${expectedMode}:${resultMode}`
    );
  if (expectedMode === POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B)
    return customerSafeReferenceReadView(result);
  return customerSafeComparisonReadView(result);
}

module.exports = { readValidatedComparisonResult };
