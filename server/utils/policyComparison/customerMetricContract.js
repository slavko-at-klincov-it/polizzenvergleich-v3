const { POINT_OUTCOME } = require("./pointDecision");

const METRIC_CONTRACT_ID = "CUSTOMER_COMPARISON_METRICS_V1";
const POINT_OUTCOMES = Object.freeze(Object.values(POINT_OUTCOME));
const LEGACY_NON_DIFFERENCE_OUTCOMES = new Set([
  "INHALTLICH_GLEICH",
  "BEIDSEITIG_KEIN_BELEG",
  "BEIDSEITIG_VOLLSTÄNDIG_NICHT_GEFUNDEN",
]);

function comparisonRows(categories) {
  return (categories || []).flatMap(({ categoryView, rows }) =>
    (rows || []).map((row) => ({ ...row, categoryView }))
  );
}

function deriveCustomerMetrics(categories) {
  const rows = comparisonRows(categories);
  const pointDecisions = Object.fromEntries(
    POINT_OUTCOMES.map((outcome) => [
      outcome,
      rows.filter(({ pointDecision }) => pointDecision?.outcome === outcome)
        .length,
    ])
  );
  const customerReviewRequired = rows.filter(
    ({ pointDecision }) => pointDecision?.reviewRequired === true
  ).length;
  const legacyTechnicalDifferences = rows.filter(
    ({ outcome }) => !LEGACY_NON_DIFFERENCE_OUTCOMES.has(outcome)
  ).length;
  return {
    metricContractId: METRIC_CONTRACT_ID,
    rows: rows.length,
    customerReviewRequired,
    noCustomerReviewRequired: rows.length - customerReviewRequired,
    legacyTechnicalDifferences,
    pointDecisions,
  };
}

function validationError(code, details = []) {
  throw new Error([code, ...details].join(":"));
}

function validateCustomerComparison(result, { allowLegacy = false } = {}) {
  if (Number(result?.schemaVersion) < 6) {
    if (allowLegacy) return { legacy: true, metricContractId: null };
    validationError("COMPARISON_METRIC_SCHEMA_UNSUPPORTED", [
      result?.schemaVersion,
    ]);
  }
  const totals = result?.totals;
  if (totals?.metricContractId !== METRIC_CONTRACT_ID)
    validationError("COMPARISON_METRIC_CONTRACT_MISMATCH", [
      totals?.metricContractId,
      METRIC_CONTRACT_ID,
    ]);

  const rows = comparisonRows(result?.categories);
  const seenRows = new Set();
  const recomputedOutcomes = Object.fromEntries(
    POINT_OUTCOMES.map((outcome) => [outcome, 0])
  );
  let recomputedReview = 0;
  let recomputedLegacyDifferences = 0;

  for (const row of rows) {
    const rowKey = `${row.categoryView}:${row.categoryId}`;
    if (seenRows.has(rowKey))
      validationError("COMPARISON_CUSTOMER_ROW_DUPLICATE", [rowKey]);
    seenRows.add(rowKey);
    const outcome = row.pointDecision?.outcome;
    if (!POINT_OUTCOMES.includes(outcome))
      validationError("COMPARISON_POINT_OUTCOME_INVALID", [rowKey, outcome]);
    recomputedOutcomes[outcome] += 1;
    const reviewRequired = row.pointDecision?.reviewRequired;
    if (reviewRequired !== (outcome === "UNKLAR"))
      validationError("COMPARISON_CUSTOMER_REVIEW_INVARIANT_VIOLATION", [
        rowKey,
        outcome,
        reviewRequired,
      ]);
    if (reviewRequired) recomputedReview += 1;
    const legacyDifference = !LEGACY_NON_DIFFERENCE_OUTCOMES.has(row.outcome);
    if (legacyDifference) recomputedLegacyDifferences += 1;
  }

  const outcomeTotal = Object.values(recomputedOutcomes).reduce(
    (sum, count) => sum + count,
    0
  );
  if (outcomeTotal !== rows.length)
    validationError("COMPARISON_POINT_DECISION_TOTAL_MISMATCH", [
      outcomeTotal,
      rows.length,
    ]);
  if (
    JSON.stringify(totals.pointDecisions) !== JSON.stringify(recomputedOutcomes)
  )
    validationError("COMPARISON_POINT_DECISION_AGGREGATE_MISMATCH");

  const exactMetrics = {
    rows: rows.length,
    customerReviewRequired: recomputedReview,
    noCustomerReviewRequired: rows.length - recomputedReview,
    legacyTechnicalDifferences: recomputedLegacyDifferences,
  };
  for (const [metric, expected] of Object.entries(exactMetrics)) {
    if (totals[metric] !== expected)
      validationError("COMPARISON_CUSTOMER_METRIC_MISMATCH", [
        metric,
        totals[metric],
        expected,
      ]);
  }

  if (result.status !== "COMPARISON_RESULT_MATERIALIZED")
    validationError("COMPARISON_CUSTOMER_STATUS_MISMATCH", [
      result.status,
      "COMPARISON_RESULT_MATERIALIZED",
    ]);
  return {
    legacy: false,
    metricContractId: METRIC_CONTRACT_ID,
    rows: rows.length,
    customerReviewRequired: recomputedReview,
  };
}

function validateCustomerComparisonFile(file, options) {
  const fs = require("fs");
  return validateCustomerComparison(
    JSON.parse(fs.readFileSync(file, "utf8")),
    options
  );
}

module.exports = {
  METRIC_CONTRACT_ID,
  POINT_OUTCOMES,
  deriveCustomerMetrics,
  validateCustomerComparison,
  validateCustomerComparisonFile,
};
