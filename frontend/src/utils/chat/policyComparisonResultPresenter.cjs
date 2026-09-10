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

const LF_SEARCH_STATUS_LABELS = Object.freeze({
  GEFUNDEN: "Gefunden",
  NICHT_GEFUNDEN: "Nicht gefunden",
});
const LF_CUSTOMER_PRESENTATION_CONTRACT_ID =
  "LF_REFERENCE_CUSTOMER_PRESENTATION_V1";

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

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function presentLfSearchStatus(row) {
  const displayableContributor = (row?.packageB?.contributors || []).some(
    ({ documentUuid, source }) => nonEmpty(documentUuid) && nonEmpty(source)
  );
  const status =
    displayableContributor &&
    nonEmpty(row?.packageB?.documentedContent) &&
    nonEmpty(row?.packageB?.source)
      ? "GEFUNDEN"
      : "NICHT_GEFUNDEN";
  return { status, label: LF_SEARCH_STATUS_LABELS[status] };
}

function presentComparisonError(value) {
  const message = String(value || "");
  if (
    message.startsWith("NEUES_LF_PROFIL_ERFORDERLICH") ||
    message.startsWith("LF_REFERENCE_NEW_PROFILE_REQUIRED")
  )
    return "Die Struktur des LF-IMMO-Dokuments A wird von dieser Vorlage nicht sicher unterstützt. Dafür ist ein neues, fachlich geprüftes LF-Profil erforderlich.";
  if (message.startsWith("REFERENCE_SOURCE_DOCUMENT_FINGERPRINT_MISMATCH"))
    return "Das LF-IMMO-Dokument A hat sich seit dem Upload geändert. Bitte die Datei erneut hochladen und den Vergleich neu starten.";
  if (message.startsWith("DOCUMENT_ANALYSIS_FAILED"))
    return "Die Dokumentanalyse konnte technisch nicht abgeschlossen werden. Bitte die Quelldateien prüfen und den Vergleich erneut starten.";
  return "Der Vergleich konnte technisch nicht abgeschlossen werden. Bitte erneut versuchen oder die Administration kontaktieren.";
}

function presentComparisonMetrics(result) {
  const totals = result?.totals || {};
  const rows = (result?.categories || []).flatMap(({ categoryView, rows }) =>
    (rows || []).map((row) => ({ ...row, categoryView }))
  );
  if (
    result?.comparisonMode === "LF_IMMO_REFERENCE_A_TO_B_V1" &&
    result?.contractId === LF_CUSTOMER_PRESENTATION_CONTRACT_ID
  ) {
    const presentedSearchRows = rows.map((row) => ({
      ...presentLfSearchStatus(row),
      rowKey: `${row.categoryView}:${row.categoryId}`,
      declaredStatus: row.customerSearchStatus,
      declaredLabel: row.customerSearchStatusLabel,
    }));
    const searchRowKeysByStatus = Object.fromEntries(
      Object.keys(LF_SEARCH_STATUS_LABELS).map((status) => [
        status,
        presentedSearchRows
          .filter((row) => row.status === status)
          .map(({ rowKey }) => rowKey),
      ])
    );
    const searchStatuses = Object.fromEntries(
      Object.entries(searchRowKeysByStatus).map(([status, rowKeys]) => [
        status,
        rowKeys.length,
      ])
    );
    const storedRowKeysByStatus = totals.customerSearchRowKeysByStatus || {};
    const storedStatuses = totals.customerSearchStatuses || {};
    const declaredRowDiscrepancy = presentedSearchRows.some(
      ({ status, label, declaredStatus, declaredLabel }) =>
        status !== declaredStatus || label !== declaredLabel
    );
    return {
      rows: rows.length,
      customerReviewRequired: null,
      pointDecisions: {},
      searchStatuses,
      searchRowKeysByStatus,
      pointDecisionRowKeysByOutcome: {},
      customerReviewBreakdown: [],
      customerPresentation: true,
      legacyFallback: false,
      storedMetricDiscrepancy: Boolean(
        declaredRowDiscrepancy ||
        Number(totals.rows) !== rows.length ||
        Number(totals.sideBOnlyRows) !== 0 ||
        Object.keys(LF_SEARCH_STATUS_LABELS).some(
          (status) =>
            Number(storedStatuses[status]) !== searchStatuses[status] ||
            JSON.stringify(storedRowKeysByStatus[status]) !==
              JSON.stringify(searchRowKeysByStatus[status])
        )
      ),
    };
  }
  const presentedRows = rows.map((row) => ({
    ...presentPointDecision(row),
    rowKey: `${row.categoryView}:${row.categoryId}`,
  }));
  if (result?.comparisonMode === "LF_IMMO_REFERENCE_A_TO_B_V1") {
    const searchStatuses = rows.reduce(
      (counts, row) => {
        counts[presentLfSearchStatus(row).status] += 1;
        return counts;
      },
      { GEFUNDEN: 0, NICHT_GEFUNDEN: 0 }
    );
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
      searchStatuses,
      customerPresentation: false,
      pointDecisionRowKeysByOutcome: {},
      customerReviewBreakdown: Object.entries(reviewCounts).map(
        ([reasonCode, count]) => ({
          reasonCode,
          label: REVIEW_REASON_LABELS[reasonCode] || reasonCode,
          count,
        })
      ),
      legacyFallback: false,
      storedMetricDiscrepancy: Boolean(
        Number(totals.rows) !== rows.length ||
        Number(totals.sideBOnlyRows) !== 0 ||
        (totals.customerSearchStatuses &&
          (Number(totals.customerSearchStatuses.GEFUNDEN) !==
            searchStatuses.GEFUNDEN ||
            Number(totals.customerSearchStatuses.NICHT_GEFUNDEN) !==
              searchStatuses.NICHT_GEFUNDEN))
      ),
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
  presentComparisonError,
  presentComparisonMetrics,
  presentLfSearchStatus,
  presentPointDecision,
};
