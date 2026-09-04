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
  GEGENSTUECK_GEFUNDEN: "Gegenstück gefunden",
  TEILWEISES_GEGENSTUECK: "Teilweises Gegenstück",
  KEIN_GEGENSTUECK_NACH_KONTROLLIERTER_SUCHE:
    "Kein Gegenstück nach kontrollierter Suche",
  REFERENZZEILE_UNKLAR: "LF-Referenzzeile unklar",
  GEGENSTUECK_UNKLAR: "Gegenstück unklar",
});

const SYMMETRIC_OUTCOMES = Object.freeze([
  "VORTEIL_A",
  "VORTEIL_B",
  "DOKUMENTATIONSUNTERSCHIED",
  "GLEICHWERTIG",
  "KEIN_DOKUMENTIERTER_VORTEIL",
  "NICHT_VERGLEICHBAR",
  "UNKLAR",
]);

const REVIEW_REASON_LABELS = Object.freeze({
  PACKAGE_REVIEW_STATUS_BLOCKS_DECISION:
    "Offene Teilpunkte in mindestens einer Polizze",
  MISSING_BOTH: "Auf beiden Seiten fehlt ein belastbarer Beleg",
  MISSING_ONE_SIDE: "Nur eine Seite enthält einen belastbaren Beleg",
  ATOMIC_DOCUMENT_RANK_UNRESOLVED: "Dokumentrang oder Ersetzung ungeklärt",
  ATOMIC_EVIDENCE_INCOMPLETE: "Erforderlicher Teilpunkt unvollständig",
  NO_APPROVED_RULE_FOR_ALL_DIMENSIONS: "Freigegebene Vergleichsregel fehlt",
  ANY_COMPONENT_EVIDENCE_INCOMPLETE:
    "Erforderliche alternative Teilpunkte unvollständig",
  CONDITIONAL_OR_EXCEPTION_SCOPE: "Bedingung oder Ausnahmebereich ungeklärt",
  REFERENCE_ROW_NOT_FULLY_EVIDENCED:
    "LF-Referenzzeile nicht vollständig belegt",
  ONLY_PART_OF_REFERENCE_COMPONENTS_EVIDENCED_IN_B:
    "Gegenstück in B nur teilweise belegt",
  COUNTERPART_EVIDENCE_CONFLICTING_OR_UNRESOLVED:
    "Gegenstück in B widersprüchlich oder ungeklärt",
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
  const rows = (result?.categories || []).flatMap(({ categoryView, rows }) =>
    (rows || []).map((row) => ({ ...row, categoryView }))
  );
  const presentedRows = rows.map((row) => ({
    ...presentPointDecision(row),
    rowKey: `${row.categoryView}:${row.categoryId}`,
  }));
  if (result?.comparisonMode === "LF_IMMO_REFERENCE_A_TO_B_V1") {
    const customerReviewRequired = presentedRows.filter(
      ({ reviewRequired }) => reviewRequired === true
    ).length;
    const reviewCounts = presentedRows
      .filter(({ reviewRequired }) => reviewRequired === true)
      .reduce((counts, { reasonCode }) => {
        const key = String(reasonCode || "REASON_NOT_AVAILABLE");
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {});
    return {
      rows: rows.length,
      customerReviewRequired,
      pointDecisions: { ...(totals.outcomes || {}) },
      pointDecisionRowKeysByOutcome: {},
      customerReviewBreakdown: Object.entries(reviewCounts).map(
        ([reasonCode, count]) => ({
          reasonCode,
          label: REVIEW_REASON_LABELS[reasonCode] || reasonCode,
          count,
        })
      ),
      legacyFallback: false,
      storedMetricDiscrepancy:
        Number(totals.rows) !== rows.length ||
        Number(totals.customerReviewRequired) !== customerReviewRequired ||
        Number(totals.sideBOnlyRows) !== 0,
    };
  }
  const pointDecisionRowKeysByOutcome = Object.fromEntries(
    SYMMETRIC_OUTCOMES.map((outcome) => [
      outcome,
      presentedRows
        .filter((row) => row.outcome === outcome)
        .map(({ rowKey }) => rowKey),
    ])
  );
  const pointDecisions = Object.fromEntries(
    Object.entries(pointDecisionRowKeysByOutcome).map(([outcome, rowKeys]) => [
      outcome,
      rowKeys.length,
    ])
  );
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
  const storedPointDecisions = totals.pointDecisions || {};
  const storedMetricDiscrepancy =
    rows.length > 0 &&
    (Number(totals.rows) !== rows.length ||
      storedCustomerReview !== customerReviewRequired ||
      SYMMETRIC_OUTCOMES.some(
        (outcome) =>
          Number(storedPointDecisions[outcome]) !== pointDecisions[outcome]
      ));
  return {
    rows: rows.length > 0 ? rows.length : Number(totals.rows || 0),
    customerReviewRequired,
    pointDecisions,
    pointDecisionRowKeysByOutcome,
    customerReviewBreakdown: Object.entries(customerReviewByReasonCode)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([reasonCode, count]) => ({
        reasonCode,
        label: REVIEW_REASON_LABELS[reasonCode] || "Anderer Prüfgrund",
        count,
      })),
    legacyFallback: !Number.isFinite(schemaVersion) || schemaVersion < 6,
    storedMetricDiscrepancy: rows.length === 0 ? null : storedMetricDiscrepancy,
  };
}

module.exports = {
  OUTCOME_LABELS,
  REVIEW_REASON_LABELS,
  presentComparisonMetrics,
  presentPointDecision,
};
