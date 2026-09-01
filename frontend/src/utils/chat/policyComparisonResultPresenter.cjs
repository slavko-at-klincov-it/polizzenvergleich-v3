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

const REVIEW_REASON_LABELS = Object.freeze({
  PACKAGE_REVIEW_STATUS_BLOCKS_DECISION:
    "Mindestens ein Paket-Prüfstatus blockiert die Entscheidung",
  MISSING_BOTH: "Auf beiden Seiten fehlt ein belastbarer Beleg",
  MISSING_ONE_SIDE: "Nur eine Seite enthält einen belastbaren Beleg",
  ATOMIC_DOCUMENT_RANK_UNRESOLVED: "Dokumentrang oder Ersetzung ungeklärt",
  ATOMIC_EVIDENCE_INCOMPLETE: "Erforderlicher Teilpunkt unvollständig",
  NO_APPROVED_RULE_FOR_ALL_DIMENSIONS: "Freigegebene Vergleichsregel fehlt",
  ANY_COMPONENT_EVIDENCE_INCOMPLETE:
    "Erforderliche alternative Teilpunkte unvollständig",
  CONDITIONAL_OR_EXCEPTION_SCOPE: "Bedingung oder Ausnahmebereich ungeklärt",
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
  const presentedRows = rows.map((row) => presentPointDecision(row));
  const reviewRows = presentedRows.filter(
    ({ outcome }) => outcome === "UNKLAR"
  );
  const customerReviewRequired = rows.length > 0 ? reviewRows.length : null;
  const customerReviewByReasonCode = reviewRows.reduce(
    (counts, { reasonCode }) => {
      const key = String(reasonCode || "REASON_NOT_AVAILABLE");
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    },
    {}
  );
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
    customerReviewBreakdown: Object.entries(customerReviewByReasonCode)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([reasonCode, count]) => ({
        reasonCode,
        label: REVIEW_REASON_LABELS[reasonCode] || "Anderer Prüfgrund",
        count,
      })),
    legacyFallback: !Number.isFinite(schemaVersion) || schemaVersion < 6,
    storedMetricDiscrepancy:
      storedCustomerReview === null || customerReviewRequired === null
        ? null
        : storedCustomerReview !== customerReviewRequired,
  };
}

module.exports = {
  OUTCOME_LABELS,
  REVIEW_REASON_LABELS,
  presentComparisonMetrics,
  presentPointDecision,
};
