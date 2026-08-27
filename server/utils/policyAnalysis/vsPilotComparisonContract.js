const LEGACY_VS_USER_PROMPT =
  "Analysiere die vollständig im Kontext bereitgestellten Vertragsdokumente gemäß dem Systemprompt. Gib ausschließlich die definierte Tabelle für VS-01 bis VS-36 und anschließend den vorgeschriebenen Hinweis aus.";

function normalizeSemanticText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("de")
    .replace(/\bsechs\s+monaten?\b/gu, "6 monate")
    .replace(/\b(\d+)\s+monaten\b/gu, "$1 monate")
    .replace(/\s+/gu, " ")
    .trim();
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function containsNormalizedValue(semanticText, expectedValue) {
  const normalizedValue = normalizeSemanticText(expectedValue);
  if (!normalizedValue) return false;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegularExpression(normalizedValue)}(?![\\p{L}\\p{N}])`,
    "u"
  ).test(semanticText);
}

function evaluateLegacyRows({ legacyRows, oracleDocument }) {
  const rowsById = new Map(
    legacyRows.map((row) => [String(row.categoryId || ""), row])
  );
  const results = oracleDocument.rows.map((expected) => {
    const observed = rowsById.get(expected.categoryId);
    const reasons = [];
    if (!observed || observed.missing) reasons.push("ROW_MISSING");
    if (observed?.coverage !== expected.coverage)
      reasons.push("COVERAGE_MISMATCH");
    if (observed?.reviewStatus !== expected.reviewStatus)
      reasons.push("REVIEW_STATUS_MISMATCH");

    const semanticText = normalizeSemanticText(
      `${observed?.coverageAmount || ""} ${observed?.documentedContent || ""}`
    );
    if (expected.requestedFieldStatus === "COMPLETE") {
      for (const value of expected.normalizedValues || []) {
        if (!containsNormalizedValue(semanticText, value))
          reasons.push(`NORMALIZED_VALUE_MISSING:${value}`);
      }
    }
    return {
      categoryId: expected.categoryId,
      pass: reasons.length === 0,
      reasons,
    };
  });
  return {
    passedRows: results.filter(({ pass }) => pass).length,
    totalRows: results.length,
    results,
  };
}

function evaluatePilotComparison({ pilotEvaluation, legacyEvaluation }) {
  const pilotAbsolutePass = Boolean(
    pilotEvaluation?.pass === true &&
      pilotEvaluation.passedRows === pilotEvaluation.totalRows
  );
  const pilotNonRegression =
    pilotEvaluation.passedRows >= legacyEvaluation.passedRows;
  const pilotStrictImprovement = Boolean(
    pilotAbsolutePass &&
      pilotEvaluation.passedRows > legacyEvaluation.passedRows
  );
  const regression = pilotEvaluation.passedRows < legacyEvaluation.passedRows;
  const outcome = regression
    ? "REGRESSED"
    : !pilotAbsolutePass
      ? "PILOT_NOT_READY"
      : pilotStrictImprovement
        ? "IMPROVED"
        : "EQUIVALENT";
  return {
    pilotAbsolutePass,
    pilotNonRegression,
    pilotStrictImprovement,
    regression,
    positiveEffectObserved:
      pilotAbsolutePass && pilotStrictImprovement && !regression,
    outcome,
  };
}

module.exports = {
  LEGACY_VS_USER_PROMPT,
  evaluateLegacyRows,
  evaluatePilotComparison,
};
