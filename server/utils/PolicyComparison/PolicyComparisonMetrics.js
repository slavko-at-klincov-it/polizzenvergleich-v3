const ALLOWED_FIELDS = new Set([
  "event",
  "operationId",
  "kind",
  "analysisRunId",
  "batchSize",
  "pass",
  "queueWaitMs",
  "callerTotalMs",
  "providerDurationMs",
  "outcome",
  "timeoutPhase",
]);

function safeMetric(event = {}) {
  const result = {};
  for (const [key, value] of Object.entries(event)) {
    if (!ALLOWED_FIELDS.has(key) || value == null) continue;
    if (["number", "string", "boolean"].includes(typeof value))
      result[key] = value;
  }
  return result;
}

const PolicyComparisonMetrics = {
  emit(event) {
    try {
      console.info(
        `[PolicyComparisonMetrics] ${JSON.stringify(safeMetric(event))}`
      );
    } catch {
      // Metrics must never affect inference, persistence or queue release.
    }
  },
};

module.exports = { PolicyComparisonMetrics, safeMetric };
