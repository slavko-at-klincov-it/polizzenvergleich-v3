/* global module */

const OUTCOME_LABELS = Object.freeze({
  VORTEIL_A: "Vorteil Paket A",
  VORTEIL_B: "Vorteil Paket B",
  DOKUMENTATIONSUNTERSCHIED: "Dokumentationsunterschied",
  GLEICHWERTIG: "Gleichwertig",
  KEIN_DOKUMENTIERTER_VORTEIL:
    "In beiden Polizzen keine passende Vertragsregelung gefunden",
  NICHT_VERGLEICHBAR: "Nicht vergleichbar",
  UNKLAR: "Unklar",
});

function presentPointDecision(row) {
  const pointDecision = row?.pointDecision;
  if (
    pointDecision &&
    Object.prototype.hasOwnProperty.call(OUTCOME_LABELS, pointDecision.outcome)
  )
    return {
      ...pointDecision,
      label: OUTCOME_LABELS[pointDecision.outcome],
      legacyFallback: false,
    };
  return {
    schemaVersion: 0,
    outcome: "UNKLAR",
    label: OUTCOME_LABELS.UNKLAR,
    reasonCode: "LEGACY_RESULT_WITHOUT_POINT_DECISION",
    reason:
      row?.difference ||
      "Für dieses ältere Ergebnis liegt noch keine regelgebundene Punktentscheidung vor.",
    reviewRequired: true,
    ruleId: "LEGACY_FAIL_CLOSED_V1",
    dimensions: [],
    legacyFallback: true,
  };
}

function presentComparisonMetrics(result) {
  const totals = result?.totals || {};
  const rows = (result?.categories || []).flatMap(
    ({ rows: categoryRows }) => categoryRows || []
  );
  const customerReviewRequired =
    rows.length > 0
      ? rows.filter((row) => presentPointDecision(row).reviewRequired).length
      : null;
  const storedCustomerReview = Number.isInteger(totals.customerReviewRequired)
    ? totals.customerReviewRequired
    : Number.isInteger(totals.pointDecisionReviewRequired)
      ? totals.pointDecisionReviewRequired
      : Number.isInteger(totals.pointDecisions?.UNKLAR)
        ? totals.pointDecisions.UNKLAR
        : null;
  const schemaVersion = Number(result?.schemaVersion);
  return {
    rows: rows.length > 0 ? rows.length : Number(totals.rows || 0),
    customerReviewRequired,
    legacyFallback: !Number.isFinite(schemaVersion) || schemaVersion < 6,
    storedMetricDiscrepancy:
      storedCustomerReview === null || customerReviewRequired === null
        ? null
        : storedCustomerReview !== customerReviewRequired,
  };
}

module.exports = {
  OUTCOME_LABELS,
  presentComparisonMetrics,
  presentPointDecision,
};
