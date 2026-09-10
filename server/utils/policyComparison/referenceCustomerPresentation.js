const { POLICY_COMPARISON_MODE } = require("./modes");

const LF_CUSTOMER_PRESENTATION_CONTRACT_ID =
  "LF_REFERENCE_CUSTOMER_PRESENTATION_V1";
const LF_CUSTOMER_PRESENTATION_SCHEMA_VERSION = 1;
const LF_CUSTOMER_SEARCH_STATUS = Object.freeze({
  FOUND: "GEFUNDEN",
  NOT_FOUND: "NICHT_GEFUNDEN",
});
const LF_CUSTOMER_SEARCH_STATUS_LABELS = Object.freeze({
  [LF_CUSTOMER_SEARCH_STATUS.FOUND]: "Gefunden",
  [LF_CUSTOMER_SEARCH_STATUS.NOT_FOUND]: "Nicht gefunden",
});

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function displayableContributors(row) {
  return (row?.packageB?.contributors || []).filter(
    ({ documentUuid, source }) => nonEmpty(documentUuid) && nonEmpty(source)
  );
}

function referenceCustomerSearchStatus(row) {
  return displayableContributors(row).length > 0 &&
    nonEmpty(row?.packageB?.documentedContent) &&
    nonEmpty(row?.packageB?.source)
    ? LF_CUSTOMER_SEARCH_STATUS.FOUND
    : LF_CUSTOMER_SEARCH_STATUS.NOT_FOUND;
}

function referenceCustomerSearchStatusLabel(row) {
  return LF_CUSTOMER_SEARCH_STATUS_LABELS[referenceCustomerSearchStatus(row)];
}

function publicPackage(value, { contributors = false } = {}) {
  const {
    atomizationStatus: _atomizationStatus,
    reviewStatus: _reviewStatus,
    searchPlanStatus: _searchPlanStatus,
    contributors: _sourceContributors,
    ...result
  } = value || {};
  if (contributors)
    result.contributors = displayableContributors({ packageB: value }).map(
      ({ reviewStatus: _contributorReviewStatus, ...contributor }) =>
        contributor
    );
  return result;
}

function referenceCustomerSearchHint(row) {
  const status = referenceCustomerSearchStatus(row);
  if (status === LF_CUSTOMER_SEARCH_STATUS.FOUND)
    return "Im Dokumentpaket B wurde mindestens eine belastbare Fundstelle gefunden. Der gefundene Inhalt und seine Quelle sind in den Spalten B_Gegenstück und B_Quelle dargestellt.";
  const missing =
    "Im aktuellen Lauf wurde keine belastbare Fundstelle im Dokumentpaket B gefunden. Das bedeutet nicht automatisch, dass kein Versicherungsschutz besteht.";
  if (row?.pointDecision?.outcome !== "REFERENZZEILE_UNKLAR") return missing;
  return `${row.pointDecision.reason || "Die LF-Referenzzeile ist fachlich zu prüfen."} ${missing}`;
}

function presentReferenceCustomerRow(row) {
  const status = referenceCustomerSearchStatus(row);
  const {
    analysisRowId: _analysisRowId,
    outcome: _outcome,
    pointDecision: _pointDecision,
    ...customerRow
  } = row;
  return {
    ...customerRow,
    packageA: publicPackage(row.packageA),
    packageB: publicPackage(row.packageB, { contributors: true }),
    customerSearchStatus: status,
    customerSearchStatusLabel: LF_CUSTOMER_SEARCH_STATUS_LABELS[status],
    customerSearchHint: referenceCustomerSearchHint(row),
  };
}

function customerSearchRowKey(categoryView, row) {
  return `${categoryView}:${row.categoryId}`;
}

function validateReferenceCustomerResult(result) {
  if (
    result?.schemaVersion !== LF_CUSTOMER_PRESENTATION_SCHEMA_VERSION ||
    result?.contractId !== LF_CUSTOMER_PRESENTATION_CONTRACT_ID ||
    result?.status !== "LF_REFERENCE_CUSTOMER_RESULT_PRESENTED" ||
    result?.comparisonMode !== POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B ||
    result?.sourceResultContract?.customerPresentationContractId !==
      LF_CUSTOMER_PRESENTATION_CONTRACT_ID ||
    !Number.isInteger(result?.sourceResultContract?.schemaVersion) ||
    !nonEmpty(result?.sourceResultContract?.contractId) ||
    !Array.isArray(result?.categories)
  )
    throw new Error("LF_REFERENCE_CUSTOMER_PRESENTATION_CONTRACT_INVALID");

  const keyedRows = result.categories.flatMap(({ categoryView, rows }) =>
    (rows || []).map((row) => ({
      row,
      rowKey: customerSearchRowKey(categoryView, row),
    }))
  );
  const rowKeys = keyedRows.map(({ rowKey }) => rowKey);
  if (new Set(rowKeys).size !== rowKeys.length)
    throw new Error("LF_REFERENCE_CUSTOMER_PRESENTATION_ROWS_INVALID");

  const privateRowFields = ["analysisRowId", "outcome", "pointDecision"];
  const privatePackageFields = [
    "atomizationStatus",
    "reviewStatus",
    "searchPlanStatus",
  ];
  if (
    keyedRows.some(({ row }) => {
      const expectedStatus = referenceCustomerSearchStatus(row);
      return (
        privateRowFields.some((field) => Object.hasOwn(row, field)) ||
        [row.packageA, row.packageB].some((value) =>
          privatePackageFields.some((field) =>
            Object.hasOwn(value || {}, field)
          )
        ) ||
        (row.packageB?.contributors || []).some(
          (contributor) =>
            Object.hasOwn(contributor, "reviewStatus") ||
            !nonEmpty(contributor.documentUuid) ||
            !nonEmpty(contributor.source)
        ) ||
        row.customerSearchStatus !== expectedStatus ||
        row.customerSearchStatusLabel !==
          LF_CUSTOMER_SEARCH_STATUS_LABELS[expectedStatus]
      );
    })
  )
    throw new Error("LF_REFERENCE_CUSTOMER_PRESENTATION_ROWS_INVALID");

  const rowKeysByStatus = Object.fromEntries(
    Object.values(LF_CUSTOMER_SEARCH_STATUS).map((status) => [
      status,
      keyedRows
        .filter(({ row }) => row.customerSearchStatus === status)
        .map(({ rowKey }) => rowKey),
    ])
  );
  const storedRowKeysByStatus =
    result?.totals?.customerSearchRowKeysByStatus || {};
  const storedStatuses = result?.totals?.customerSearchStatuses || {};
  const statuses = Object.values(LF_CUSTOMER_SEARCH_STATUS);
  if (
    Number(result?.totals?.rows) !== keyedRows.length ||
    Number(result?.totals?.categories) !== result.categories.length ||
    Number(result?.totals?.referenceRowsAnalyzed) !== keyedRows.length ||
    Number(result?.totals?.sideBOnlyRows) !== 0 ||
    JSON.stringify(Object.keys(storedRowKeysByStatus).sort()) !==
      JSON.stringify([...statuses].sort()) ||
    statuses.some(
      (status) =>
        !Array.isArray(storedRowKeysByStatus[status]) ||
        JSON.stringify(storedRowKeysByStatus[status]) !==
          JSON.stringify(rowKeysByStatus[status]) ||
        Number(storedStatuses[status]) !== rowKeysByStatus[status].length
    ) ||
    new Set(statuses.flatMap((status) => storedRowKeysByStatus[status] || []))
      .size !== rowKeys.length
  )
    throw new Error("LF_REFERENCE_CUSTOMER_PRESENTATION_TOTALS_INVALID");
  return result;
}

function presentReferenceCustomerResult(result) {
  if (
    result?.comparisonMode !== POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B ||
    result?.customerPresentationContractId !==
      LF_CUSTOMER_PRESENTATION_CONTRACT_ID ||
    !Array.isArray(result.categories)
  )
    throw new Error("LF_REFERENCE_CUSTOMER_PRESENTATION_INPUT_INVALID");
  const categories = result.categories.map((category) => ({
    ...category,
    rows: (category.rows || []).map(presentReferenceCustomerRow),
  }));
  const keyedRows = categories.flatMap(({ categoryView, rows }) =>
    rows.map((row) => ({
      row,
      rowKey: customerSearchRowKey(categoryView, row),
    }))
  );
  const customerSearchRowKeysByStatus = Object.fromEntries(
    Object.values(LF_CUSTOMER_SEARCH_STATUS).map((status) => [
      status,
      keyedRows
        .filter(({ row }) => row.customerSearchStatus === status)
        .map(({ rowKey }) => rowKey),
    ])
  );
  const customerSearchStatuses = Object.fromEntries(
    Object.entries(customerSearchRowKeysByStatus).map(([status, rowKeys]) => [
      status,
      rowKeys.length,
    ])
  );
  return validateReferenceCustomerResult({
    schemaVersion: LF_CUSTOMER_PRESENTATION_SCHEMA_VERSION,
    contractId: LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
    status: "LF_REFERENCE_CUSTOMER_RESULT_PRESENTED",
    comparisonMode: result.comparisonMode,
    generatedAt: result.generatedAt,
    sessionUuid: result.sessionUuid,
    runSignature: result.runSignature,
    templateDigest: result.templateDigest,
    sourceResultContract: {
      schemaVersion: result.schemaVersion,
      contractId: result.contractId,
      customerPresentationContractId: result.customerPresentationContractId,
    },
    productProfile: result.productProfile,
    template: result.template,
    documents: result.documents,
    categories,
    totals: {
      rows: keyedRows.length,
      categories: categories.length,
      referenceRowsAnalyzed: keyedRows.length,
      sideBOnlyRows: 0,
      customerSearchStatuses,
      customerSearchRowKeysByStatus,
    },
    proofLimit: result.proofLimit,
  });
}

module.exports = {
  LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
  LF_CUSTOMER_PRESENTATION_SCHEMA_VERSION,
  LF_CUSTOMER_SEARCH_STATUS,
  LF_CUSTOMER_SEARCH_STATUS_LABELS,
  presentReferenceCustomerResult,
  referenceCustomerSearchHint,
  referenceCustomerSearchStatus,
  referenceCustomerSearchStatusLabel,
  validateReferenceCustomerResult,
};
