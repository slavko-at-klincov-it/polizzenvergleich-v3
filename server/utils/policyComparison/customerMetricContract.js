const {
  POINT_OUTCOME,
  decideQualifiedCoverageOverAbsence,
} = require("./pointDecision");
const {
  PACKAGE_REVIEW_AUDIT_CONTRACT_ID,
  PACKAGE_REVIEW_AUDIT_SCHEMA_VERSION,
  validatePackageReviewAudit,
} = require("./packageReviewAudit");
const {
  packageReviewCustomerExplanation,
} = require("./customerResultPresenter");
const { PRODUCT_PROFILE } = require("./productContract");
const {
  BILATERAL_ABSENCE_REASON_CODE,
  BILATERAL_ABSENCE_RULE_ID,
  BILATERAL_ABSENCE_TREATMENT,
  buildBilateralAbsenceAudit,
  validateBilateralAbsenceAudit,
} = require("./bilateralAbsenceContract");
const {
  UNILATERAL_COVERAGE_REASON_CODE,
  UNILATERAL_COVERAGE_RULE_ID,
  UNILATERAL_COVERAGE_TREATMENT,
  UNILATERAL_DOCUMENTATION_REASON_CODE,
  UNILATERAL_DOCUMENTATION_RULE_ID,
  validateUnilateralCoverageAbsenceAudit,
} = require("./unilateralCoverageAbsenceContract");
const {
  LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_REASON_CODE,
  LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_RULE_ID,
  LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_TREATMENT,
  lw20AbsenceDefaultExclusionEqualityDecision,
  validateLw20AbsenceDefaultExclusionEqualityAudit,
} = require("./lw20AbsenceDefaultExclusionEqualityContract");

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
const HISTORICAL_SCHEMA_8_PROFILE = Object.freeze({
  id: "CUSTOMER_CORE_5_V8_STATUS_METADATA",
  comparisonContractId: "PACKAGE_FIRST_STATUS_METADATA_TYPED_V1",
});
const HISTORICAL_SCHEMA_9_PROFILE = Object.freeze({
  id: "CUSTOMER_CORE_5_V9_BILATERAL_ABSENCE_EQUALITY",
  comparisonContractId: "PACKAGE_FIRST_BILATERAL_ABSENCE_EQUALITY_V1",
});
const HISTORICAL_SCHEMA_10_PROFILE = Object.freeze({
  id: "CUSTOMER_CORE_5_V10_QUALIFIED_ONE_SIDED_INCLUSION",
  comparisonContractId: "PACKAGE_FIRST_QUALIFIED_INCLUSION_ABSENCE_V1",
});
const ONE_SIDED_TECHNICAL_OUTCOMES = new Map([
  ["A_BELEGT_B_VOLLSTÄNDIG_NICHT_GEFUNDEN", ["A", "B"]],
  ["B_BELEGT_A_VOLLSTÄNDIG_NICHT_GEFUNDEN", ["B", "A"]],
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

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function sameJson(left, right) {
  return (
    JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
  );
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
      pointDecisionRows.filter(
        ({ normalizedOutcome }) => normalizedOutcome === outcome
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
  const productProfileId = String(result?.productProfile?.id || "");
  const comparisonContractId = String(
    result?.productProfile?.comparisonContractId || ""
  );
  if (Number(result.schemaVersion) === 8) {
    if (
      productProfileId !== HISTORICAL_SCHEMA_8_PROFILE.id ||
      comparisonContractId !== HISTORICAL_SCHEMA_8_PROFILE.comparisonContractId
    )
      validationError("COMPARISON_PRODUCT_PROFILE_CONTRACT_MISMATCH", [
        productProfileId,
        comparisonContractId,
      ]);
  } else if (Number(result.schemaVersion) === 9) {
    if (
      productProfileId !== HISTORICAL_SCHEMA_9_PROFILE.id ||
      comparisonContractId !== HISTORICAL_SCHEMA_9_PROFILE.comparisonContractId
    )
      validationError("COMPARISON_PRODUCT_PROFILE_CONTRACT_MISMATCH", [
        productProfileId,
        comparisonContractId,
      ]);
  } else if (Number(result.schemaVersion) === 10) {
    if (
      productProfileId !== HISTORICAL_SCHEMA_10_PROFILE.id ||
      comparisonContractId !== HISTORICAL_SCHEMA_10_PROFILE.comparisonContractId
    )
      validationError("COMPARISON_PRODUCT_PROFILE_CONTRACT_MISMATCH", [
        productProfileId,
        comparisonContractId,
      ]);
  } else if (Number(result.schemaVersion) >= 11) {
    if (
      productProfileId !== PRODUCT_PROFILE.id ||
      comparisonContractId !== PRODUCT_PROFILE.comparisonContractId
    )
      validationError("COMPARISON_PRODUCT_PROFILE_CONTRACT_MISMATCH", [
        productProfileId,
        comparisonContractId,
      ]);
  }
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
  const manifestDocuments = Array.isArray(result?.documents)
    ? result.documents
    : [];
  const validManifestDocuments = manifestDocuments.every(
    (document) =>
      document &&
      typeof document === "object" &&
      !Array.isArray(document) &&
      typeof document.uuid === "string" &&
      document.uuid === document.uuid.trim() &&
      document.uuid.length > 0 &&
      ["A", "B"].includes(document.side) &&
      /^[a-f0-9]{64}$/u.test(String(document.sha256 || ""))
  );
  const manifestDocumentUuids = validManifestDocuments
    ? manifestDocuments.map(({ uuid }) => uuid)
    : [];
  if (
    Number(result.schemaVersion) >= 11 &&
    (!Array.isArray(result?.documents) ||
      !validManifestDocuments ||
      new Set(manifestDocumentUuids).size !== manifestDocumentUuids.length ||
      !manifestDocuments.some(({ side }) => side === "A") ||
      !manifestDocuments.some(({ side }) => side === "B"))
  )
    validationError("COMPARISON_DOCUMENT_MANIFEST_INVALID");
  const allowedDocumentUuidsBySide = Object.fromEntries(
    ["A", "B"].map((side) => [
      side,
      new Set(
        (result?.documents || [])
          .filter((document) => document.side === side)
          .map(({ uuid }) => uuid)
      ),
    ])
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
    recomputedOutcomeRowKeys[outcome].push(rowKey);
    const reviewRequired = row.pointDecision?.reviewRequired;
    if (reviewRequired !== (outcome === "UNKLAR"))
      validationError("COMPARISON_CUSTOMER_REVIEW_INVARIANT_VIOLATION", [
        rowKey,
        outcome,
        reviewRequired,
      ]);
    if (reviewRequired) recomputedReview += 1;
    const bilateralAbsenceDecision =
      row.pointDecision?.ruleId === BILATERAL_ABSENCE_RULE_ID ||
      row.pointDecision?.reasonCode === BILATERAL_ABSENCE_REASON_CODE ||
      row.pointDecision?.comparisonTreatment === BILATERAL_ABSENCE_TREATMENT ||
      row.pointDecision?.bilateralAbsenceAudit !== undefined ||
      row.outcome === "BEIDSEITIG_VOLLSTÄNDIG_NICHT_GEFUNDEN";
    const expectedBilateralAbsenceAudit = buildBilateralAbsenceAudit({
      categoryId: row.categoryId,
      packageA: row.packageA,
      packageB: row.packageB,
      requirementContractA:
        row.packageA?.requirementContract ||
        row.packageA?.searchAudit?.requirementContract,
      requirementContractB:
        row.packageB?.requirementContract ||
        row.packageB?.searchAudit?.requirementContract,
      expectedDocumentUuidsA: [...allowedDocumentUuidsBySide.A],
      expectedDocumentUuidsB: [...allowedDocumentUuidsBySide.B],
    });
    if (
      Number(result.schemaVersion) >= 9 &&
      Boolean(expectedBilateralAbsenceAudit) !== bilateralAbsenceDecision
    )
      validationError("COMPARISON_BILATERAL_ABSENCE_DECISION_OMISSION", [
        rowKey,
      ]);
    if (Number(result.schemaVersion) >= 9 && bilateralAbsenceDecision) {
      if (
        outcome !== POINT_OUTCOME.EQUIVALENT ||
        row.pointDecision?.ruleId !== BILATERAL_ABSENCE_RULE_ID ||
        row.pointDecision?.reasonCode !== BILATERAL_ABSENCE_REASON_CODE ||
        row.pointDecision?.comparisonTreatment !==
          BILATERAL_ABSENCE_TREATMENT ||
        row.pointDecision?.reviewRequired !== false ||
        row.outcome !== "BEIDSEITIG_VOLLSTÄNDIG_NICHT_GEFUNDEN" ||
        row.pointDecision?.schemaVersion !== 4 ||
        !Array.isArray(row.pointDecision?.dimensions) ||
        row.pointDecision.dimensions.length !== 0
      )
        validationError("COMPARISON_BILATERAL_ABSENCE_DECISION_INVALID", [
          rowKey,
        ]);
      try {
        validateBilateralAbsenceAudit(row.pointDecision.bilateralAbsenceAudit, {
          categoryId: row.categoryId,
          packageA: row.packageA,
          packageB: row.packageB,
          expectedDocumentUuidsA: [...allowedDocumentUuidsBySide.A],
          expectedDocumentUuidsB: [...allowedDocumentUuidsBySide.B],
        });
      } catch (error) {
        validationError("COMPARISON_BILATERAL_ABSENCE_AUDIT_INVALID", [
          rowKey,
          error.message,
        ]);
      }
    }
    if (Number(result.schemaVersion) >= 10) {
      const oneSidedDirection = ONE_SIDED_TECHNICAL_OUTCOMES.get(row.outcome);
      const lw20EqualityDecision =
        row.pointDecision?.ruleId ===
          LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_RULE_ID ||
        row.pointDecision?.reasonCode ===
          LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_REASON_CODE ||
        row.pointDecision?.comparisonTreatment ===
          LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_TREATMENT ||
        row.pointDecision?.lw20AbsenceDefaultExclusionEqualityAudit !==
          undefined;
      if (lw20EqualityDecision) {
        const audit =
          row.pointDecision.lw20AbsenceDefaultExclusionEqualityAudit;
        try {
          validateLw20AbsenceDefaultExclusionEqualityAudit(audit, {
            categoryId: row.categoryId,
            packageA: row.packageA,
            packageB: row.packageB,
            expectedDocumentUuidsA: [...allowedDocumentUuidsBySide.A],
            expectedDocumentUuidsB: [...allowedDocumentUuidsBySide.B],
            expectedDocumentsA: manifestDocuments.filter(
              ({ side }) => side === "A"
            ),
            expectedDocumentsB: manifestDocuments.filter(
              ({ side }) => side === "B"
            ),
          });
        } catch (error) {
          validationError("COMPARISON_LW20_EQUALITY_AUDIT_INVALID", [
            rowKey,
            error.message,
          ]);
        }
        const direction = oneSidedDirection || [];
        const reconstructed =
          lw20AbsenceDefaultExclusionEqualityDecision(audit);
        if (
          row.categoryView !== "LW" ||
          row.categoryId !== "LW-20" ||
          direction[0] !== audit?.excludedSide ||
          direction[1] !== audit?.absentSide ||
          outcome !== POINT_OUTCOME.EQUIVALENT ||
          row.pointDecision?.schemaVersion !== 6 ||
          row.pointDecision?.reviewRequired !== false ||
          row.pointDecision?.ruleId !==
            LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_RULE_ID ||
          row.pointDecision?.reasonCode !==
            LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_REASON_CODE ||
          row.pointDecision?.comparisonTreatment !==
            LW20_ABSENCE_DEFAULT_EXCLUSION_EQUALITY_TREATMENT ||
          row.pointDecision?.bilateralAbsenceAudit !== undefined ||
          row.pointDecision?.unilateralCoverageAbsenceAudit !== undefined ||
          !sameJson(row.pointDecision, reconstructed)
        )
          validationError("COMPARISON_LW20_EQUALITY_DECISION_INVALID", [
            rowKey,
          ]);
      }
      const unilateralDecision =
        row.pointDecision?.ruleId === UNILATERAL_COVERAGE_RULE_ID ||
        row.pointDecision?.ruleId === UNILATERAL_DOCUMENTATION_RULE_ID ||
        row.pointDecision?.reasonCode === UNILATERAL_COVERAGE_REASON_CODE ||
        row.pointDecision?.reasonCode ===
          UNILATERAL_DOCUMENTATION_REASON_CODE ||
        row.pointDecision?.comparisonTreatment ===
          UNILATERAL_COVERAGE_TREATMENT ||
        row.pointDecision?.unilateralCoverageAbsenceAudit !== undefined;
      const directionalAuditFailedClosed = Boolean(
        oneSidedDirection &&
          !unilateralDecision &&
          outcome === POINT_OUTCOME.UNCLEAR &&
          row.pointDecision?.schemaVersion === 3 &&
          row.pointDecision?.reasonCode ===
            "QUALIFIED_DIRECTIONAL_AUDIT_INCOMPLETE" &&
          row.pointDecision?.ruleId === "FAIL_CLOSED_V1" &&
          row.pointDecision?.reviewRequired === true
      );
      if (
        Boolean(oneSidedDirection) !== unilateralDecision &&
        !directionalAuditFailedClosed &&
        !lw20EqualityDecision
      )
        validationError("COMPARISON_UNILATERAL_DECISION_OMISSION", [rowKey]);
      if (oneSidedDirection && unilateralDecision) {
        const [evidencedSide, absentSide] = oneSidedDirection;
        const audit = row.pointDecision.unilateralCoverageAbsenceAudit;
        try {
          validateUnilateralCoverageAbsenceAudit(audit, {
            categoryId: row.categoryId,
            packageA: row.packageA,
            packageB: row.packageB,
            expectedDocumentUuidsA: [...allowedDocumentUuidsBySide.A],
            expectedDocumentUuidsB: [...allowedDocumentUuidsBySide.B],
          });
        } catch (error) {
          validationError("COMPARISON_UNILATERAL_AUDIT_INVALID", [
            rowKey,
            error.message,
          ]);
        }
        if (
          audit?.evidencedSide !== evidencedSide ||
          audit?.absentSide !== absentSide ||
          row.pointDecision?.schemaVersion !== 5 ||
          row.pointDecision?.reviewRequired !== false
        )
          validationError("COMPARISON_UNILATERAL_DECISION_INVALID", [rowKey]);
        const expectedOutcome =
          evidencedSide === "A"
            ? POINT_OUTCOME.ADVANTAGE_A
            : POINT_OUTCOME.ADVANTAGE_B;
        if (audit.eligible) {
          if (
            outcome !== expectedOutcome ||
            row.pointDecision.ruleId !== UNILATERAL_COVERAGE_RULE_ID ||
            row.pointDecision.reasonCode !== UNILATERAL_COVERAGE_REASON_CODE ||
            row.pointDecision.comparisonTreatment !==
              UNILATERAL_COVERAGE_TREATMENT
          )
            validationError("COMPARISON_UNILATERAL_WINNER_INVALID", [rowKey]);
        } else if (
          outcome !== POINT_OUTCOME.DOCUMENTATION_DIFFERENCE ||
          row.pointDecision.ruleId !== UNILATERAL_DOCUMENTATION_RULE_ID ||
          row.pointDecision.reasonCode !==
            UNILATERAL_DOCUMENTATION_REASON_CODE ||
          row.pointDecision.comparisonTreatment !== "DOCUMENTATION_ONLY_V1"
        )
          validationError("COMPARISON_UNILATERAL_BLOCKED_INVALID", [rowKey]);
        const reconstructedDecision = decideQualifiedCoverageOverAbsence({
          categoryId: row.categoryId,
          packageA: row.packageA,
          packageB: row.packageB,
          unilateralCoverageAbsenceAudit: audit,
        });
        if (
          row.pointDecision.reason !== reconstructedDecision.reason ||
          JSON.stringify(row.pointDecision.dimensions) !==
            JSON.stringify(reconstructedDecision.dimensions)
        )
          validationError("COMPARISON_UNILATERAL_PRESENTATION_MISMATCH", [
            rowKey,
          ]);
      }
    }
    if (reviewRequired) {
      const reasonCode = String(row.pointDecision?.reasonCode || "").trim();
      if (!reasonCode)
        validationError("COMPARISON_CUSTOMER_REVIEW_REASON_MISSING", [rowKey]);
      if (!recomputedReviewRowKeysByReasonCode[reasonCode])
        recomputedReviewRowKeysByReasonCode[reasonCode] = [];
      recomputedReviewRowKeysByReasonCode[reasonCode].push(rowKey);
      if (
        Number(result.schemaVersion) >= 7 &&
        reasonCode === "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION"
      ) {
        const packageReviewAudit = row.pointDecision?.packageReviewAudit;
        if (
          Number(result.schemaVersion) >= 8 &&
          (packageReviewAudit?.schemaVersion !==
            PACKAGE_REVIEW_AUDIT_SCHEMA_VERSION ||
            packageReviewAudit?.contractId !== PACKAGE_REVIEW_AUDIT_CONTRACT_ID)
        )
          validationError("COMPARISON_PACKAGE_REVIEW_AUDIT_VERSION_MISMATCH", [
            rowKey,
          ]);
        validatePackageReviewAudit(row.pointDecision?.packageReviewAudit, {
          categoryId: row.categoryId,
          packageAStatus: row.packageA?.reviewStatus,
          packageBStatus: row.packageB?.reviewStatus,
          allowedDocumentUuidsBySide,
        });
      }
    }
    if (
      Number(result.schemaVersion) >= 7 &&
      row.pointDecision?.reasonCode !==
        "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION" &&
      row.pointDecision?.packageReviewAudit !== undefined
    )
      validationError("COMPARISON_PACKAGE_REVIEW_AUDIT_UNEXPECTED", [rowKey]);
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
  const categories = Array.isArray(result?.categories)
    ? result.categories.map((category) => ({
        ...category,
        rows: (category.rows || []).map((row) => {
          const explanation = packageReviewCustomerExplanation(
            row.pointDecision
          );
          if (!explanation) return row;
          return {
            ...row,
            pointDecision: {
              ...row.pointDecision,
              reason: explanation,
            },
          };
        }),
      }))
    : result?.categories;
  return { ...result, categories, totals, customerMetrics };
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
