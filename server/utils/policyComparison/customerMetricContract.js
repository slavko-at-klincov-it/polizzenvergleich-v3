const { POINT_OUTCOME } = require("./pointDecision");

const METRIC_CONTRACT_ID = "CUSTOMER_COMPARISON_METRICS_V2";
const POINT_OUTCOMES = Object.freeze(Object.values(POINT_OUTCOME));
const LEGACY_NON_DIFFERENCE_OUTCOMES = new Set([
  "INHALTLICH_GLEICH",
  "BEIDSEITIG_KEIN_BELEG",
  "BEIDSEITIG_VOLLSTÄNDIG_NICHT_GEFUNDEN",
]);
const LEGACY_TECHNICAL_OUTCOMES = new Set([
  ...LEGACY_NON_DIFFERENCE_OUTCOMES,
  "A_BELEGT_B_VOLLSTÄNDIG_NICHT_GEFUNDEN",
  "B_BELEGT_A_VOLLSTÄNDIG_NICHT_GEFUNDEN",
  "NUR_A_BELEGT",
  "NUR_B_BELEGT",
  "UNTERSCHIED_FACHLICH_PRÜFEN",
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
  const pointDecisionRowKeysByOutcome = Object.fromEntries(
    POINT_OUTCOMES.map((outcome) => [
      outcome,
      rows
        .filter(({ pointDecision }) => pointDecision?.outcome === outcome)
        .map(({ categoryView, categoryId }) => `${categoryView}:${categoryId}`),
    ])
  );
  const customerReviewRequired = rows.filter(
    ({ pointDecision }) => pointDecision?.reviewRequired === true
  ).length;
  const customerReviewRowKeysByReasonCode = {};
  for (const row of rows) {
    if (row.pointDecision?.outcome !== POINT_OUTCOME.UNCLEAR) continue;
    const reasonCode = String(row.pointDecision?.reasonCode || "").trim();
    if (!customerReviewRowKeysByReasonCode[reasonCode])
      customerReviewRowKeysByReasonCode[reasonCode] = [];
    customerReviewRowKeysByReasonCode[reasonCode].push(
      `${row.categoryView}:${row.categoryId}`
    );
  }
  const customerReviewByReasonCode = Object.fromEntries(
    Object.entries(customerReviewRowKeysByReasonCode)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([reasonCode, rowKeys]) => [reasonCode, rowKeys.length])
  );
  const legacyTechnicalDifferences = rows.filter(
    ({ outcome }) => !LEGACY_NON_DIFFERENCE_OUTCOMES.has(outcome)
  ).length;
  return {
    metricContractId: METRIC_CONTRACT_ID,
    rows: rows.length,
    customerReviewRequired,
    noCustomerReviewRequired: rows.length - customerReviewRequired,
    customerReviewByReasonCode,
    customerReviewRowKeysByReasonCode,
    legacyTechnicalDifferences,
    pointDecisions,
    pointDecisionRowKeysByOutcome,
  };
}

function validationError(code, details = []) {
  throw new Error([code, ...details].join(":"));
}

function deriveLegacyCustomerReview(result) {
  const rows = comparisonRows(result?.categories);
  if (rows.length === 0)
    return {
      legacy: true,
      metricContractId: null,
      rows: null,
      customerReviewRequired: null,
      noCustomerReviewRequired: null,
      pointDecisions: null,
      pointDecisionRowKeysByOutcome: null,
      storedMetricDiscrepancy: null,
    };
  const customerReviewRequired = rows.filter(({ pointDecision }) => {
    if (!pointDecision) return true;
    if (!POINT_OUTCOMES.includes(pointDecision.outcome)) return true;
    return pointDecision.outcome === POINT_OUTCOME.UNCLEAR;
  }).length;
  const pointDecisionRows = rows.map((row) => ({
    ...row,
    normalizedOutcome: POINT_OUTCOMES.includes(row.pointDecision?.outcome)
      ? row.pointDecision.outcome
      : POINT_OUTCOME.UNCLEAR,
  }));
  const pointDecisions = Object.fromEntries(
    POINT_OUTCOMES.map((outcome) => [
      outcome,
      pointDecisionRows.filter(({ normalizedOutcome }) =>
        normalizedOutcome === outcome
      ).length,
    ])
  );
  const pointDecisionRowKeysByOutcome = Object.fromEntries(
    POINT_OUTCOMES.map((outcome) => [
      outcome,
      pointDecisionRows
        .filter(({ normalizedOutcome }) => normalizedOutcome === outcome)
        .map(({ categoryView, categoryId }) => `${categoryView}:${categoryId}`),
    ])
  );
  const storedMetric = Number.isInteger(
    result?.totals?.pointDecisionReviewRequired
  )
    ? result.totals.pointDecisionReviewRequired
    : Number.isInteger(result?.totals?.pointDecisions?.[POINT_OUTCOME.UNCLEAR])
      ? result.totals.pointDecisions[POINT_OUTCOME.UNCLEAR]
      : null;
  return {
    legacy: true,
    metricContractId: null,
    rows: rows.length,
    customerReviewRequired,
    noCustomerReviewRequired: rows.length - customerReviewRequired,
    pointDecisions,
    pointDecisionRowKeysByOutcome,
    storedMetricDiscrepancy:
      storedMetric === null ? null : storedMetric !== customerReviewRequired,
  };
}

function validateCustomerComparison(result, { allowLegacy = false } = {}) {
  if (Number(result?.schemaVersion) < 6) {
    if (allowLegacy) return deriveLegacyCustomerReview(result);
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
  const recomputedOutcomeRowKeys = Object.fromEntries(
    POINT_OUTCOMES.map((outcome) => [outcome, []])
  );
  const recomputedReviewRowKeysByReasonCode = {};
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
    recomputedOutcomeRowKeys[outcome].push(rowKey);
    const reviewRequired = row.pointDecision?.reviewRequired;
    if (reviewRequired !== (outcome === "UNKLAR"))
      validationError("COMPARISON_CUSTOMER_REVIEW_INVARIANT_VIOLATION", [
        rowKey,
        outcome,
        reviewRequired,
      ]);
    if (reviewRequired) recomputedReview += 1;
    if (reviewRequired) {
      const reasonCode = String(row.pointDecision?.reasonCode || "").trim();
      if (!reasonCode)
        validationError("COMPARISON_CUSTOMER_REVIEW_REASON_MISSING", [rowKey]);
      if (!recomputedReviewRowKeysByReasonCode[reasonCode])
        recomputedReviewRowKeysByReasonCode[reasonCode] = [];
      recomputedReviewRowKeysByReasonCode[reasonCode].push(rowKey);
    }
    if (!LEGACY_TECHNICAL_OUTCOMES.has(row.outcome))
      validationError("COMPARISON_LEGACY_TECHNICAL_OUTCOME_INVALID", [
        rowKey,
        row.outcome,
      ]);
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
  if (
    JSON.stringify(totals.pointDecisionRowKeysByOutcome) !==
    JSON.stringify(recomputedOutcomeRowKeys)
  )
    validationError("COMPARISON_POINT_DECISION_MEMBERSHIP_MISMATCH");

  const recomputedReviewByReasonCode = Object.fromEntries(
    Object.entries(recomputedReviewRowKeysByReasonCode)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([reasonCode, rowKeys]) => [reasonCode, rowKeys.length])
  );
  if (
    JSON.stringify(totals.customerReviewByReasonCode) !==
    JSON.stringify(recomputedReviewByReasonCode)
  )
    validationError("COMPARISON_CUSTOMER_REVIEW_REASON_AGGREGATE_MISMATCH");
  if (
    JSON.stringify(totals.customerReviewRowKeysByReasonCode) !==
    JSON.stringify(recomputedReviewRowKeysByReasonCode)
  )
    validationError("COMPARISON_CUSTOMER_REVIEW_REASON_MEMBERSHIP_MISMATCH");
  const reasonTotal = Object.values(recomputedReviewByReasonCode).reduce(
    (sum, count) => sum + count,
    0
  );
  if (reasonTotal !== recomputedReview)
    validationError("COMPARISON_CUSTOMER_REVIEW_REASON_TOTAL_MISMATCH", [
      reasonTotal,
      recomputedReview,
    ]);

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
    noCustomerReviewRequired: rows.length - recomputedReview,
    pointDecisions: recomputedOutcomes,
    pointDecisionRowKeysByOutcome: recomputedOutcomeRowKeys,
  };
}

function validateCustomerComparisonFile(file, options) {
  const fs = require("fs");
  return validateCustomerComparison(
    JSON.parse(fs.readFileSync(file, "utf8")),
    options
  );
}

function customerSafeComparisonReadView(result) {
  const customerMetrics = validateCustomerComparison(result, {
    allowLegacy: true,
  });
  const totals = { ...(result?.totals || {}) };
  delete totals.reviewRequired;
  return { ...result, totals, customerMetrics };
}

module.exports = {
  METRIC_CONTRACT_ID,
  POINT_OUTCOMES,
  LEGACY_TECHNICAL_OUTCOMES,
  deriveCustomerMetrics,
  deriveLegacyCustomerReview,
  customerSafeComparisonReadView,
  validateCustomerComparison,
  validateCustomerComparisonFile,
};
