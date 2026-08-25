const {
  countModelTokens,
  tokenizerDirectory,
} = require("../LocalModelTokenizer");

function collectorEstimate(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.round(count) : 0;
}

/**
 * Returns an exact local-model count when explicitly configured, otherwise a
 * clearly typed collector estimate. This never labels an estimate as exact.
 */
async function countDocumentTokens(text, tokenCountEstimate) {
  if (tokenizerDirectory()) {
    try {
      const { count, label } = await countModelTokens(text);
      return { count, kind: "exact_model", label };
    } catch (error) {
      console.warn(
        `Could not count exact document tokens; using collector estimate: ${error.message}`
      );
    }
  }

  return {
    count: collectorEstimate(tokenCountEstimate),
    kind: "estimated",
    label: null,
  };
}

module.exports = { collectorEstimate, countDocumentTokens };
