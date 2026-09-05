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

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function comparisonDocumentIdentityMatches(uploaded, completed) {
  if (!uploaded?.uuid || uploaded.uuid !== completed?.uuid) return false;
  return ["side", "sha256", "role", "documentStatus"].every((field) => {
    if (uploaded[field] === undefined || completed[field] === undefined)
      return true;
    return uploaded[field] === completed[field];
  });
}

function presentComparisonError(value) {
  const message = String(value || "");
  if (message.startsWith("LF_REFERENCE_NEW_PROFILE_REQUIRED"))
    return "Die LF-Struktur von Dokument A wird nicht unterstützt; neues LF-Profil erforderlich.";
  if (message.startsWith("REFERENCE_SOURCE_DOCUMENT_FINGERPRINT_MISMATCH"))
    return "Die Quelldatei von Dokument A hat sich seit dem Upload geändert. Bitte erneut hochladen.";
  return message || "Unbekannter Fehler";
}

function sortDocumentsByPosition(documents) {
  return (Array.isArray(documents) ? documents : [])
    .map((document, index) => ({ document, index }))
    .sort((left, right) => {
      const leftPosition = nonNegativeInteger(left.document?.position);
      const rightPosition = nonNegativeInteger(right.document?.position);
      if (leftPosition !== null && rightPosition !== null)
        return leftPosition - rightPosition || left.index - right.index;
      if (leftPosition !== null) return -1;
      if (rightPosition !== null) return 1;
      return left.index - right.index;
    })
    .map(({ document }) => document);
}

function presentComparisonManifest({
  sessionDocuments = [],
  resultDocuments = null,
} = {}) {
  const uploadedDocuments = Array.isArray(sessionDocuments)
    ? sessionDocuments
    : [];
  const hasResultManifest = Array.isArray(resultDocuments);
  const completedDocuments = hasResultManifest ? resultDocuments : [];
  const missingFromResult = hasResultManifest
    ? uploadedDocuments.filter(
        (document) =>
          !completedDocuments.some((completed) =>
            comparisonDocumentIdentityMatches(document, completed)
          )
      )
    : [];
  const unexpectedInResult = hasResultManifest
    ? completedDocuments.filter(
        (document) =>
          !uploadedDocuments.some((uploaded) =>
            comparisonDocumentIdentityMatches(uploaded, document)
          )
      )
    : [];
  const documentsBySide = { A: [], B: [] };
  ["A", "B"].forEach((side) => {
    documentsBySide[side] = sortDocumentsByPosition(
      uploadedDocuments.filter((document) => document?.side === side)
    );
  });
  return {
    status:
      uploadedDocuments.length === 0
        ? "EMPTY"
        : !hasResultManifest
          ? "UPLOADED"
          : missingFromResult.length === 0 && unexpectedInResult.length === 0
            ? "MATCHED"
            : "MISMATCH",
    hasResultManifest,
    uploadedCount: uploadedDocuments.length,
    resultCount: hasResultManifest ? completedDocuments.length : null,
    missingFromResult,
    unexpectedInResult,
    documentsBySide,
  };
}

function presentComparisonProfileCoverage(result) {
  const profile =
    result?.productProfile && typeof result.productProfile === "object"
      ? result.productProfile
      : null;
  const categories = Array.isArray(result?.categories)
    ? result.categories
    : null;
  const expectedCategoryCount =
    nonNegativeInteger(profile?.categoryCount) ??
    (Array.isArray(profile?.categoryViews)
      ? profile.categoryViews.length
      : null);
  const expectedRowCount =
    nonNegativeInteger(profile?.rowCount) ??
    nonNegativeInteger(profile?.expectedRowCount);
  const observedCategoryCount = categories?.length ?? null;
  const observedRowCount = categories
    ? categories.reduce(
        (count, category) =>
          count + (Array.isArray(category?.rows) ? category.rows.length : 0),
        0
      )
    : null;
  const resultRows = categories
    ? categories.flatMap((category) =>
        Array.isArray(category?.rows) ? category.rows : []
      )
    : [];
  const rowIds = resultRows.map((row) => row?.categoryId).filter(Boolean);
  const sourceIndexes = resultRows.map(
    (row) => row?.packageA?.referenceSource?.manifestIndex
  );
  const rowIdentityValid =
    !profile?.manifestSha256 ||
    (categories !== null &&
      rowIds.length === resultRows.length &&
      new Set(rowIds).size === rowIds.length &&
      sourceIndexes.every(Number.isInteger) &&
      new Set(sourceIndexes).size === sourceIndexes.length &&
      resultRows.every(
        (row) =>
          row.categoryId === row.packageA?.referenceSource?.sourceReferenceId
      ));
  const comparable =
    categories !== null &&
    expectedCategoryCount !== null &&
    expectedRowCount !== null;
  const matches =
    comparable &&
    observedCategoryCount === expectedCategoryCount &&
    observedRowCount === expectedRowCount &&
    rowIdentityValid;
  return {
    status: !profile
      ? "UNAVAILABLE"
      : !comparable
        ? "UNKNOWN"
        : matches
          ? "MATCHED"
          : "MISMATCH",
    profileId: typeof profile?.id === "string" ? profile.id : null,
    expectedCategoryCount,
    expectedRowCount,
    observedCategoryCount,
    observedRowCount,
    requiresNewLfProfile:
      result?.comparisonMode === "LF_IMMO_REFERENCE_A_TO_B_V1" &&
      comparable &&
      !matches,
  };
}

function presentComparisonProgress(progress) {
  const completedDocuments = nonNegativeInteger(progress?.completedDocuments);
  const totalDocuments = nonNegativeInteger(progress?.totalDocuments);
  const completedCategories = nonNegativeInteger(progress?.completedCategories);
  const totalCategories = nonNegativeInteger(progress?.totalCategories);
  const hasCategoryProgress =
    totalCategories !== null &&
    totalCategories > 0 &&
    completedCategories !== null;
  const completed = hasCategoryProgress
    ? completedCategories
    : completedDocuments;
  const total = hasCategoryProgress ? totalCategories : totalDocuments;
  const percent =
    total !== null && total > 0 && completed !== null
      ? Math.min(100, Math.max(0, Math.round((completed / total) * 100)))
      : null;
  return {
    phase: typeof progress?.phase === "string" ? progress.phase : null,
    completedDocuments,
    totalDocuments,
    completedCategories,
    totalCategories,
    completed,
    total,
    percent,
    hasCategoryProgress,
    currentDocument: progress?.currentDocument || null,
    currentCategory: progress?.currentCategory || null,
  };
}

function presentComparisonCoverage({ session = null, result = null } = {}) {
  return {
    manifest: presentComparisonManifest({
      sessionDocuments: session?.documents,
      resultDocuments: Array.isArray(result?.documents)
        ? result.documents
        : null,
    }),
    profile: presentComparisonProfileCoverage(result),
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
  presentComparisonCoverage,
  presentComparisonError,
  presentComparisonManifest,
  presentComparisonMetrics,
  presentComparisonProgress,
  presentPointDecision,
  sortDocumentsByPosition,
};
