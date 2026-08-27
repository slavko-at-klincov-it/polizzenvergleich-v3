function oracleError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) =>
    String(left).localeCompare(String(right), "de")
  );
}

function compareArrays(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function missingValues(required, observed) {
  const observedSet = new Set(observed);
  return required.filter((value) => !observedSet.has(value));
}

function disallowedValues(observed, allowed) {
  const allowedSet = new Set(allowed);
  return observed.filter((value) => !allowedSet.has(value));
}

function allowedValues(expected, requiredKey, allowedKey, forbiddenKey) {
  const required = uniqueSorted(expected[requiredKey] || []);
  const allowed = uniqueSorted(expected[allowedKey] || required);
  const forbidden = uniqueSorted(expected[forbiddenKey] || []);
  if (missingValues(required, allowed).length > 0)
    throw oracleError(
      "VS_ORACLE_ALLOWED_SET_INVALID",
      `${expected.categoryId}:${allowedKey}`
    );
  if (forbidden.some((value) => allowed.includes(value)))
    throw oracleError(
      "VS_ORACLE_FORBIDDEN_SET_INVALID",
      `${expected.categoryId}:${forbiddenKey}`
    );
  return { required, allowed, forbidden };
}

function requestedFieldByRequirement(requestedFieldEvidence) {
  if (!Array.isArray(requestedFieldEvidence?.requirements))
    throw oracleError("VS_ORACLE_REQUESTED_FIELDS_INVALID");
  return new Map(
    requestedFieldEvidence.requirements.map((requirement) => [
      requirement.requirementId,
      requirement,
    ])
  );
}

function rowSourcePages(source) {
  const pages = [];
  for (const match of String(source || "").matchAll(/PDF-Seite\s+(\d+)/gu))
    pages.push(Number(match[1]));
  return uniqueSorted(pages);
}

/**
 * Compares one document's deterministic pilot result to the frozen eight-cell
 * oracle. It checks identity, row decisions, typed values and selected source
 * pages independently so a formally valid table cannot hide a semantic miss.
 * Side effects: none. Role: validate.
 */
function evaluateVsPilotOracle({
  oracleDocument,
  pdfSha256,
  physicalPages,
  documentStatus,
  rows,
  requestedFieldEvidence,
  selectedSources,
}) {
  if (!oracleDocument || !Array.isArray(oracleDocument.rows))
    throw oracleError("VS_ORACLE_DOCUMENT_INVALID");
  if (!Array.isArray(rows) || !Array.isArray(selectedSources))
    throw oracleError("VS_ORACLE_RESULT_INVALID");

  const fieldByRequirement = requestedFieldByRequirement(
    requestedFieldEvidence
  );
  const rowById = new Map();
  for (const row of rows) {
    const id = String(row?.categoryId || "");
    if (!id || rowById.has(id))
      throw oracleError("VS_ORACLE_ROW_ID_INVALID", id);
    rowById.set(id, row);
  }
  const expectedIds = oracleDocument.rows.map(({ categoryId }) => categoryId);
  if (
    rows.length !== expectedIds.length ||
    expectedIds.some((id) => !rowById.has(id))
  )
    throw oracleError("VS_ORACLE_ROW_COVERAGE_INVALID");

  const identityReasons = [];
  if (pdfSha256 !== oracleDocument.pdfSha256)
    identityReasons.push("PDF_SHA256_MISMATCH");
  if (physicalPages !== oracleDocument.physicalPages)
    identityReasons.push("PHYSICAL_PAGE_COUNT_MISMATCH");
  if (documentStatus !== oracleDocument.documentStatus)
    identityReasons.push("DOCUMENT_STATUS_MISMATCH");

  const results = oracleDocument.rows.map((expected) => {
    const observed = rowById.get(expected.categoryId);
    const requested = fieldByRequirement.get(expected.categoryId);
    if (!requested)
      throw oracleError(
        "VS_ORACLE_REQUESTED_FIELD_ROW_MISSING",
        expected.categoryId
      );
    const normalizedValues = uniqueSorted(
      requested.fields.flatMap(({ facts }) =>
        facts.map(({ normalizedValue }) => normalizedValue)
      )
    );
    const valueCandidateIds = uniqueSorted(
      requested.fields
        .flatMap(({ facts }) =>
          facts.map(({ source }) => String(source?.candidateId || ""))
        )
        .filter(Boolean)
    );
    const valueSourcePages = uniqueSorted(
      requested.fields
        .flatMap(({ facts }) =>
          facts.map(({ source }) => Number(source?.physicalPageNumber))
        )
        .filter(Number.isInteger)
    );
    const expectedValues = uniqueSorted(expected.normalizedValues);
    const sourcePages = uniqueSorted(
      selectedSources
        .filter(({ requirementId }) => requirementId === expected.categoryId)
        .map(({ physicalPageNumber }) => Number(physicalPageNumber))
    );
    const selectedCandidateIds = uniqueSorted(
      selectedSources
        .filter(({ requirementId }) => requirementId === expected.categoryId)
        .map(({ candidateId }) => String(candidateId || ""))
        .filter(Boolean)
    );
    const renderedSourcePages = rowSourcePages(observed.source);
    const candidateSet = allowedValues(
      expected,
      "requiredCandidateIds",
      "allowedCandidateIds",
      "forbiddenCandidateIds"
    );
    const sourcePageSet = allowedValues(
      expected,
      "requiredSourcePages",
      "allowedSourcePages",
      "forbiddenSourcePages"
    );
    const valueCandidateSet = allowedValues(
      expected,
      "requiredValueCandidateIds",
      "allowedValueCandidateIds",
      "forbiddenValueCandidateIds"
    );
    const valueSourcePageSet = allowedValues(
      expected,
      "requiredValueSourcePages",
      "allowedValueSourcePages",
      "forbiddenValueSourcePages"
    );
    const reasons = [];
    if (observed.coverage !== expected.coverage)
      reasons.push("COVERAGE_MISMATCH");
    if (observed.reviewStatus !== expected.reviewStatus)
      reasons.push("REVIEW_STATUS_MISMATCH");
    if (observed.coverageAmount !== expected.coverageAmount)
      reasons.push("COVERAGE_AMOUNT_MISMATCH");
    for (const fragment of expected.documentedContentIncludes || [])
      if (!String(observed.documentedContent || "").includes(fragment))
        reasons.push(`DOCUMENTED_CONTENT_MISSING:${fragment}`);
    if (requested.requestedFieldStatus !== expected.requestedFieldStatus)
      reasons.push("REQUESTED_FIELD_STATUS_MISMATCH");
    if (!compareArrays(normalizedValues, expectedValues))
      reasons.push("NORMALIZED_VALUES_MISMATCH");
    if (missingValues(valueCandidateSet.required, valueCandidateIds).length > 0)
      reasons.push("VALUE_CANDIDATES_MISMATCH");
    for (const candidateId of disallowedValues(
      valueCandidateIds,
      valueCandidateSet.allowed
    ))
      reasons.push(`VALUE_CANDIDATE_NOT_ALLOWED:${candidateId}`);
    for (const candidateId of valueCandidateSet.forbidden)
      if (valueCandidateIds.includes(candidateId))
        reasons.push(`FORBIDDEN_VALUE_CANDIDATE_SELECTED:${candidateId}`);
    if (missingValues(valueSourcePageSet.required, valueSourcePages).length > 0)
      reasons.push("VALUE_SOURCE_PAGES_MISMATCH");
    for (const page of disallowedValues(
      valueSourcePages,
      valueSourcePageSet.allowed
    ))
      reasons.push(`VALUE_SOURCE_PAGE_NOT_ALLOWED:${page}`);
    for (const page of valueSourcePageSet.forbidden)
      if (valueSourcePages.includes(page))
        reasons.push(`FORBIDDEN_VALUE_SOURCE_PAGE_SELECTED:${page}`);
    if (missingValues(candidateSet.required, selectedCandidateIds).length > 0)
      reasons.push("SELECTED_CANDIDATES_MISMATCH");
    for (const candidateId of disallowedValues(
      selectedCandidateIds,
      candidateSet.allowed
    ))
      reasons.push(`SELECTED_CANDIDATE_NOT_ALLOWED:${candidateId}`);
    for (const candidateId of candidateSet.forbidden)
      if (selectedCandidateIds.includes(candidateId))
        reasons.push(`FORBIDDEN_CANDIDATE_SELECTED:${candidateId}`);
    if (missingValues(sourcePageSet.required, sourcePages).length > 0)
      reasons.push("SELECTED_SOURCE_PAGES_MISMATCH");
    for (const page of disallowedValues(sourcePages, sourcePageSet.allowed))
      reasons.push(`SELECTED_SOURCE_PAGE_NOT_ALLOWED:${page}`);
    if (missingValues(sourcePageSet.required, renderedSourcePages).length > 0)
      reasons.push("RENDERED_SOURCE_PAGES_MISMATCH");
    for (const page of disallowedValues(
      renderedSourcePages,
      sourcePageSet.allowed
    ))
      reasons.push(`RENDERED_SOURCE_PAGE_NOT_ALLOWED:${page}`);
    for (const page of sourcePageSet.forbidden)
      if (sourcePages.includes(page) || renderedSourcePages.includes(page))
        reasons.push(`FORBIDDEN_SOURCE_PAGE_SELECTED:${page}`);
    return {
      categoryId: expected.categoryId,
      pass: reasons.length === 0,
      reasons,
      observed: {
        coverage: observed.coverage,
        reviewStatus: observed.reviewStatus,
        requestedFieldStatus: requested.requestedFieldStatus,
        normalizedValues,
        valueCandidateIds,
        valueSourcePages,
        selectedCandidateIds,
        sourcePages,
        renderedSourcePages,
      },
    };
  });

  return {
    pass: identityReasons.length === 0 && results.every(({ pass }) => pass),
    identityReasons,
    passedRows: results.filter(({ pass }) => pass).length,
    totalRows: results.length,
    results,
  };
}

module.exports = { evaluateVsPilotOracle };
