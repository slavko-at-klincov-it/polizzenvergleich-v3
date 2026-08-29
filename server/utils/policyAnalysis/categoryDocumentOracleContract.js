const ORACLE_APPROVAL_STATUS = Object.freeze({
  APPROVED: "APPROVED",
  DRAFT: "DRAFT",
});

const SOURCE_RULE_KEYS = Object.freeze([
  "requiredCandidateIds",
  "allowedCandidateIds",
  "forbiddenCandidateIds",
  "requiredPhysicalPages",
  "allowedPhysicalPages",
  "forbiddenPhysicalPages",
]);

const VALUE_MATCHER_KEYS = Object.freeze([
  "field",
  "normalizedValue",
  "valueType",
  "unit",
  "limitKind",
  "qualifier",
  "variantScopeKey",
  "componentId",
  "factRole",
  "candidateId",
  "physicalPageNumber",
]);
const DOCUMENT_KEYS = Object.freeze([
  "documentKey",
  "pdfSha256",
  "physicalPages",
  "documentStatus",
  "approvalStatus",
  "rows",
]);
const ORACLE_ROW_KEYS = Object.freeze([
  "categoryId",
  "approvalStatus",
  "row",
  "requestedFieldStatus",
  "components",
  "valueExpectations",
  "sources",
]);
const FINAL_ROW_KEYS = Object.freeze([
  "coverage",
  "coverageAmount",
  "reviewStatus",
  "documentedContentIncludes",
  "documentedContentExcludes",
]);
const COMPONENT_KEYS = Object.freeze([
  "componentId",
  "evidencePresence",
  "coverageEffect",
  "documentApplicability",
  "conflictState",
  "selectedScopePicture",
  "sources",
]);

function oracleError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) =>
    String(left).localeCompare(String(right), "de")
  );
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function approvalStatus(value, fallback, detail) {
  const resolved = value || fallback;
  if (!Object.values(ORACLE_APPROVAL_STATUS).includes(resolved))
    throw oracleError("CATEGORY_ORACLE_APPROVAL_STATUS_INVALID", detail);
  return resolved;
}

function addCheck(checks, { axis, id, pass, expected, observed }) {
  checks.push({ axis, id, pass: Boolean(pass), expected, observed });
}

function assertUniqueRows(rows) {
  const ids = new Set();
  for (const row of rows) {
    const categoryId = String(row?.categoryId || "");
    if (!/^[A-Z]{2}-[A-Z]?\d{2}$/u.test(categoryId))
      throw oracleError("CATEGORY_ORACLE_ROW_ID_INVALID", categoryId);
    if (ids.has(categoryId))
      throw oracleError("CATEGORY_ORACLE_ROW_ID_DUPLICATE", categoryId);
    ids.add(categoryId);
  }
}

function validateSourceRules(rules, detail) {
  if (rules === undefined) return;
  if (!rules || typeof rules !== "object" || Array.isArray(rules))
    throw oracleError("CATEGORY_ORACLE_SOURCE_RULES_INVALID", detail);
  const unknown = Object.keys(rules).filter(
    (key) => !SOURCE_RULE_KEYS.includes(key)
  );
  if (unknown.length)
    throw oracleError(
      "CATEGORY_ORACLE_SOURCE_RULE_KEY_UNKNOWN",
      `${detail}:${unknown.join(",")}`
    );
  for (const key of Object.keys(rules))
    if (!Array.isArray(rules[key]))
      throw oracleError(
        "CATEGORY_ORACLE_SOURCE_RULE_ARRAY_REQUIRED",
        `${detail}:${key}`
      );
  for (const [requiredKey, allowedKey, forbiddenKey] of [
    ["requiredCandidateIds", "allowedCandidateIds", "forbiddenCandidateIds"],
    ["requiredPhysicalPages", "allowedPhysicalPages", "forbiddenPhysicalPages"],
  ]) {
    const required = new Set(rules[requiredKey] || []);
    const allowed = hasOwn(rules, allowedKey)
      ? new Set(rules[allowedKey])
      : null;
    const forbidden = new Set(rules[forbiddenKey] || []);
    if (allowed && [...required].some((value) => !allowed.has(value)))
      throw oracleError(
        "CATEGORY_ORACLE_REQUIRED_SOURCE_NOT_ALLOWED",
        `${detail}:${requiredKey}`
      );
    if ([...required].some((value) => forbidden.has(value)))
      throw oracleError(
        "CATEGORY_ORACLE_REQUIRED_SOURCE_FORBIDDEN",
        `${detail}:${requiredKey}`
      );
    if (allowed && [...allowed].some((value) => forbidden.has(value)))
      throw oracleError(
        "CATEGORY_ORACLE_ALLOWED_SOURCE_FORBIDDEN",
        `${detail}:${allowedKey}`
      );
  }
}

function validateValueExpectations(valueExpectations, detail) {
  if (valueExpectations === undefined) return;
  if (
    !valueExpectations ||
    typeof valueExpectations !== "object" ||
    Array.isArray(valueExpectations)
  )
    throw oracleError("CATEGORY_ORACLE_VALUE_EXPECTATIONS_INVALID", detail);
  const unknownGroups = Object.keys(valueExpectations).filter(
    (key) => !["required", "allowed", "forbidden"].includes(key)
  );
  if (unknownGroups.length)
    throw oracleError(
      "CATEGORY_ORACLE_VALUE_GROUP_UNKNOWN",
      `${detail}:${unknownGroups.join(",")}`
    );
  for (const [group, matchers] of Object.entries(valueExpectations)) {
    if (!Array.isArray(matchers))
      throw oracleError(
        "CATEGORY_ORACLE_VALUE_GROUP_ARRAY_REQUIRED",
        `${detail}:${group}`
      );
    for (const [index, matcher] of matchers.entries()) {
      if (!matcher || typeof matcher !== "object" || Array.isArray(matcher))
        throw oracleError(
          "CATEGORY_ORACLE_VALUE_MATCHER_INVALID",
          `${detail}:${group}:${index}`
        );
      const unknownKeys = Object.keys(matcher).filter(
        (key) => !VALUE_MATCHER_KEYS.includes(key)
      );
      if (unknownKeys.length)
        throw oracleError(
          "CATEGORY_ORACLE_VALUE_MATCHER_KEY_UNKNOWN",
          `${detail}:${group}:${unknownKeys.join(",")}`
        );
      if (Object.keys(matcher).length === 0)
        throw oracleError(
          "CATEGORY_ORACLE_VALUE_MATCHER_EMPTY",
          `${detail}:${group}:${index}`
        );
    }
  }
}

function validateOracleDocument(oracleDocument, defaultApprovalStatus) {
  if (
    !oracleDocument ||
    typeof oracleDocument !== "object" ||
    !Array.isArray(oracleDocument.rows) ||
    oracleDocument.rows.length === 0
  )
    throw oracleError("CATEGORY_ORACLE_DOCUMENT_INVALID");
  const unknownDocumentKeys = Object.keys(oracleDocument).filter(
    (key) => !DOCUMENT_KEYS.includes(key)
  );
  if (unknownDocumentKeys.length)
    throw oracleError(
      "CATEGORY_ORACLE_DOCUMENT_KEY_UNKNOWN",
      unknownDocumentKeys.join(",")
    );
  if (!String(oracleDocument.pdfSha256 || ""))
    throw oracleError("CATEGORY_ORACLE_DOCUMENT_SHA_REQUIRED");
  approvalStatus(
    oracleDocument.approvalStatus,
    defaultApprovalStatus,
    oracleDocument.documentKey || oracleDocument.pdfSha256 || "document"
  );
  assertUniqueRows(oracleDocument.rows);
  for (const row of oracleDocument.rows) {
    const detail = row.categoryId;
    const unknownRowKeys = Object.keys(row).filter(
      (key) => !ORACLE_ROW_KEYS.includes(key)
    );
    if (unknownRowKeys.length)
      throw oracleError(
        "CATEGORY_ORACLE_ROW_KEY_UNKNOWN",
        `${detail}:${unknownRowKeys.join(",")}`
      );
    approvalStatus(
      row.approvalStatus,
      oracleDocument.approvalStatus || defaultApprovalStatus,
      detail
    );
    validateSourceRules(row.sources, detail);
    validateValueExpectations(row.valueExpectations, detail);
    if (row.row !== undefined) {
      if (!row.row || typeof row.row !== "object" || Array.isArray(row.row))
        throw oracleError("CATEGORY_ORACLE_FINAL_ROW_INVALID", detail);
      const unknownFinalRowKeys = Object.keys(row.row).filter(
        (key) => !FINAL_ROW_KEYS.includes(key)
      );
      if (unknownFinalRowKeys.length)
        throw oracleError(
          "CATEGORY_ORACLE_FINAL_ROW_KEY_UNKNOWN",
          `${detail}:${unknownFinalRowKeys.join(",")}`
        );
      for (const key of [
        "documentedContentIncludes",
        "documentedContentExcludes",
      ])
        if (hasOwn(row.row, key) && !Array.isArray(row.row[key]))
          throw oracleError(
            "CATEGORY_ORACLE_FINAL_ROW_FRAGMENT_ARRAY_REQUIRED",
            `${detail}:${key}`
          );
    }
    if (row.components !== undefined) {
      if (!Array.isArray(row.components))
        throw oracleError("CATEGORY_ORACLE_COMPONENTS_INVALID", detail);
      const componentIds = new Set();
      for (const component of row.components) {
        const componentId = String(component?.componentId || "");
        if (!componentId || componentIds.has(componentId))
          throw oracleError(
            "CATEGORY_ORACLE_COMPONENT_ID_INVALID",
            `${detail}:${componentId}`
          );
        componentIds.add(componentId);
        const unknownComponentKeys = Object.keys(component).filter(
          (key) => !COMPONENT_KEYS.includes(key)
        );
        if (unknownComponentKeys.length)
          throw oracleError(
            "CATEGORY_ORACLE_COMPONENT_KEY_UNKNOWN",
            `${detail}:${componentId}:${unknownComponentKeys.join(",")}`
          );
        validateSourceRules(component.sources, `${detail}:${componentId}`);
      }
    }
    if (
      !row.row &&
      row.requestedFieldStatus === undefined &&
      row.components === undefined &&
      row.valueExpectations === undefined &&
      row.sources === undefined
    )
      throw oracleError("CATEGORY_ORACLE_ROW_EMPTY", detail);
  }
}

function evaluateSourceRules({ checks, axis, idPrefix, rules, sources }) {
  if (!rules) return;
  const candidateIds = uniqueSorted(
    sources.map(({ candidateId }) => String(candidateId || "")).filter(Boolean)
  );
  const pages = uniqueSorted(
    sources
      .map(({ physicalPageNumber }) => Number(physicalPageNumber))
      .filter(Number.isInteger)
  );
  const observedByKey = {
    requiredCandidateIds: candidateIds,
    allowedCandidateIds: candidateIds,
    forbiddenCandidateIds: candidateIds,
    requiredPhysicalPages: pages,
    allowedPhysicalPages: pages,
    forbiddenPhysicalPages: pages,
  };
  for (const key of SOURCE_RULE_KEYS) {
    if (!hasOwn(rules, key)) continue;
    const expected = uniqueSorted(rules[key]);
    const observed = observedByKey[key];
    let pass;
    if (key.startsWith("required"))
      pass = expected.every((value) => observed.includes(value));
    else if (key.startsWith("allowed"))
      pass = observed.every((value) => expected.includes(value));
    else pass = expected.every((value) => !observed.includes(value));
    addCheck(checks, {
      axis,
      id: `${idPrefix}:${key}`,
      pass,
      expected,
      observed,
    });
  }
}

function valueFactMatches(observed, expected) {
  return Object.entries(expected).every(([key, value]) => {
    const observedValue = observed[key];
    if (typeof value === "string")
      return normalizedText(observedValue) === normalizedText(value);
    return observedValue === value;
  });
}

function valueFacts({ requestedFieldEvidence, selectedSources, worksheet }) {
  const sourceByCandidateId = new Map(
    selectedSources.map((source) => [String(source.candidateId || ""), source])
  );
  const roleByComponent = new Map();
  for (const requirement of worksheet?.requirements || [])
    for (const component of requirement.components || [])
      roleByComponent.set(
        `${requirement.id}:${component.id}`,
        component.factRole || null
      );

  return (requestedFieldEvidence?.requirements || []).flatMap((requirement) =>
    (requirement.fields || []).flatMap((field) =>
      (field.facts || []).map((fact) => {
        const candidateId = String(fact.source?.candidateId || "");
        const selectedSource = sourceByCandidateId.get(candidateId) || {};
        const componentId = selectedSource.componentId || null;
        return {
          requirementId: requirement.requirementId,
          field: field.field,
          normalizedValue: fact.normalizedValue,
          valueType: fact.valueType,
          unit: fact.unit,
          limitKind: fact.limitKind,
          qualifier: fact.qualifier,
          variantScopeKey: fact.variantScope?.key || null,
          componentId,
          factRole:
            roleByComponent.get(
              `${requirement.requirementId}:${componentId}`
            ) || null,
          candidateId,
          physicalPageNumber: Number.isInteger(fact.source?.physicalPageNumber)
            ? fact.source.physicalPageNumber
            : selectedSource.physicalPageNumber,
        };
      })
    )
  );
}

function evaluateValueExpectations({ checks, rowId, expectations, facts }) {
  if (!expectations) return;
  const observed = facts.filter(({ requirementId }) => requirementId === rowId);
  const required = expectations.required || [];
  const unusedObserved = new Set(observed.map((_, index) => index));
  for (const [index, matcher] of required.entries()) {
    const matchedIndex = [...unusedObserved].find((candidateIndex) =>
      valueFactMatches(observed[candidateIndex], matcher)
    );
    if (matchedIndex !== undefined) unusedObserved.delete(matchedIndex);
    addCheck(checks, {
      axis: "VALUES_AND_ROLES",
      id: `${rowId}:value:required:${index}`,
      pass: matchedIndex !== undefined,
      expected: matcher,
      observed,
    });
  }
  if (hasOwn(expectations, "allowed"))
    for (const [index, fact] of observed.entries())
      addCheck(checks, {
        axis: "VALUES_AND_ROLES",
        id: `${rowId}:value:allowed:${index}`,
        pass: expectations.allowed.some((matcher) =>
          valueFactMatches(fact, matcher)
        ),
        expected: expectations.allowed,
        observed: fact,
      });
  for (const [index, matcher] of (expectations.forbidden || []).entries())
    addCheck(checks, {
      axis: "VALUES_AND_ROLES",
      id: `${rowId}:value:forbidden:${index}`,
      pass: !observed.some((fact) => valueFactMatches(fact, matcher)),
      expected: matcher,
      observed,
    });
}

function summarize(results, status) {
  const selected = results.filter(
    ({ approvalStatus: observedStatus }) => observedStatus === status
  );
  const selectedRows = selected.filter(
    ({ categoryId }) => categoryId !== "__DOCUMENT__"
  );
  const checks = selected.flatMap((result) => result.checks);
  return {
    pass: checks.length > 0 && checks.every(({ pass }) => pass),
    rowCount: selectedRows.length,
    passedRows: selectedRows.filter(({ pass }) => pass).length,
    assertionCount: checks.length,
    passedAssertions: checks.filter(({ pass }) => pass).length,
    axes: [...new Set(checks.map(({ axis }) => axis))].reduce(
      (summary, axis) => {
        const axisChecks = checks.filter((check) => check.axis === axis);
        summary[axis] = {
          pass: axisChecks.every(({ pass }) => pass),
          passed: axisChecks.filter(({ pass }) => pass).length,
          total: axisChecks.length,
        };
        return summary;
      },
      {}
    ),
  };
}

/**
 * Evaluates one document's sparse, reviewer-owned oracle against immutable QA
 * artifacts. Missing oracle rows remain outside the denominator. Side effects:
 * none. Role: validate.
 */
function evaluateCategoryDocumentOracle({
  oracleDocument,
  oracleApprovalStatus = ORACLE_APPROVAL_STATUS.DRAFT,
  pdfSha256,
  physicalPages,
  documentStatus,
  rows,
  materializedEvidence,
  requestedFieldEvidence,
  selectedSources,
  worksheet,
}) {
  validateOracleDocument(oracleDocument, oracleApprovalStatus);
  if (
    !Array.isArray(rows) ||
    !Array.isArray(materializedEvidence?.judgements) ||
    !Array.isArray(requestedFieldEvidence?.requirements) ||
    !Array.isArray(selectedSources) ||
    !Array.isArray(worksheet?.requirements)
  )
    throw oracleError("CATEGORY_ORACLE_RESULT_INVALID");

  const documentApprovalStatus = approvalStatus(
    oracleDocument.approvalStatus,
    oracleApprovalStatus,
    oracleDocument.documentKey || "document"
  );
  const rowApprovalStatuses = oracleDocument.rows.map((row) =>
    approvalStatus(row.approvalStatus, documentApprovalStatus, row.categoryId)
  );
  const identityApprovalStatus = rowApprovalStatuses.includes(
    ORACLE_APPROVAL_STATUS.APPROVED
  )
    ? ORACLE_APPROVAL_STATUS.APPROVED
    : documentApprovalStatus;
  const identityChecks = [];
  addCheck(identityChecks, {
    axis: "DOCUMENT_IDENTITY",
    id: "document:pdfSha256",
    pass: pdfSha256 === oracleDocument.pdfSha256,
    expected: oracleDocument.pdfSha256,
    observed: pdfSha256,
  });
  if (hasOwn(oracleDocument, "physicalPages"))
    addCheck(identityChecks, {
      axis: "DOCUMENT_IDENTITY",
      id: "document:physicalPages",
      pass: physicalPages === oracleDocument.physicalPages,
      expected: oracleDocument.physicalPages,
      observed: physicalPages,
    });
  if (hasOwn(oracleDocument, "documentStatus"))
    addCheck(identityChecks, {
      axis: "DOCUMENT_IDENTITY",
      id: "document:documentStatus",
      pass: documentStatus === oracleDocument.documentStatus,
      expected: oracleDocument.documentStatus,
      observed: documentStatus,
    });

  const rowById = new Map(rows.map((row) => [row.categoryId, row]));
  const judgementById = new Map(
    materializedEvidence.judgements.map((judgement) => [
      `${judgement.requirementId}:${judgement.componentId}`,
      judgement,
    ])
  );
  const requestedById = new Map(
    requestedFieldEvidence.requirements.map((requirement) => [
      requirement.requirementId,
      requirement,
    ])
  );
  const facts = valueFacts({
    requestedFieldEvidence,
    selectedSources,
    worksheet,
  });

  const results = oracleDocument.rows.map((expected) => {
    const observedRow = rowById.get(expected.categoryId);
    const resolvedApprovalStatus = approvalStatus(
      expected.approvalStatus,
      documentApprovalStatus,
      expected.categoryId
    );
    const checks = [];
    addCheck(checks, {
      axis: "FINAL_ROW",
      id: `${expected.categoryId}:row:present`,
      pass: Boolean(observedRow),
      expected: true,
      observed: Boolean(observedRow),
    });
    for (const key of ["coverage", "coverageAmount", "reviewStatus"])
      if (hasOwn(expected.row, key))
        addCheck(checks, {
          axis: "FINAL_ROW",
          id: `${expected.categoryId}:row:${key}`,
          pass: observedRow?.[key] === expected.row[key],
          expected: expected.row[key],
          observed: observedRow?.[key],
        });
    for (const [index, fragment] of (
      expected.row?.documentedContentIncludes || []
    ).entries())
      addCheck(checks, {
        axis: "FINAL_ROW",
        id: `${expected.categoryId}:row:documentedContentIncludes:${index}`,
        pass: normalizedText(observedRow?.documentedContent).includes(
          normalizedText(fragment)
        ),
        expected: fragment,
        observed: observedRow?.documentedContent,
      });
    for (const [index, fragment] of (
      expected.row?.documentedContentExcludes || []
    ).entries())
      addCheck(checks, {
        axis: "FINAL_ROW",
        id: `${expected.categoryId}:row:documentedContentExcludes:${index}`,
        pass: !normalizedText(observedRow?.documentedContent).includes(
          normalizedText(fragment)
        ),
        expected: fragment,
        observed: observedRow?.documentedContent,
      });

    if (hasOwn(expected, "requestedFieldStatus"))
      addCheck(checks, {
        axis: "VALUES_AND_ROLES",
        id: `${expected.categoryId}:requestedFieldStatus`,
        pass:
          requestedById.get(expected.categoryId)?.requestedFieldStatus ===
          expected.requestedFieldStatus,
        expected: expected.requestedFieldStatus,
        observed: requestedById.get(expected.categoryId)?.requestedFieldStatus,
      });

    for (const component of expected.components || []) {
      const observed = judgementById.get(
        `${expected.categoryId}:${component.componentId}`
      );
      addCheck(checks, {
        axis: "COMPONENT_EFFECT",
        id: `${expected.categoryId}:${component.componentId}:present`,
        pass: Boolean(observed),
        expected: true,
        observed: Boolean(observed),
      });
      for (const key of [
        "evidencePresence",
        "coverageEffect",
        "documentApplicability",
        "conflictState",
        "selectedScopePicture",
      ])
        if (hasOwn(component, key))
          addCheck(checks, {
            axis:
              key === "selectedScopePicture" || key === "conflictState"
                ? "SCOPE_AND_CONFLICT"
                : "COMPONENT_EFFECT",
            id: `${expected.categoryId}:${component.componentId}:${key}`,
            pass: observed?.[key] === component[key],
            expected: component[key],
            observed: observed?.[key],
          });
      evaluateSourceRules({
        checks,
        axis: "PROVENANCE",
        idPrefix: `${expected.categoryId}:${component.componentId}:sources`,
        rules: component.sources,
        sources: selectedSources.filter(
          (source) =>
            source.requirementId === expected.categoryId &&
            source.componentId === component.componentId
        ),
      });
    }

    evaluateSourceRules({
      checks,
      axis: "PROVENANCE",
      idPrefix: `${expected.categoryId}:sources`,
      rules: expected.sources,
      sources: selectedSources.filter(
        (source) => source.requirementId === expected.categoryId
      ),
    });
    evaluateValueExpectations({
      checks,
      rowId: expected.categoryId,
      expectations: expected.valueExpectations,
      facts,
    });
    return {
      categoryId: expected.categoryId,
      approvalStatus: resolvedApprovalStatus,
      pass: checks.every(({ pass }) => pass),
      checks,
    };
  });

  const identityResult = {
    approvalStatus: identityApprovalStatus,
    pass: identityChecks.every(({ pass }) => pass),
    checks: identityChecks,
  };
  const resultsWithIdentity = [
    {
      categoryId: "__DOCUMENT__",
      ...identityResult,
    },
    ...results,
  ];
  const approved = summarize(
    resultsWithIdentity,
    ORACLE_APPROVAL_STATUS.APPROVED
  );
  const draft = summarize(resultsWithIdentity, ORACLE_APPROVAL_STATUS.DRAFT);
  return {
    status:
      approved.rowCount === 0
        ? "DRAFT_REVIEW_REQUIRED"
        : approved.pass
          ? "APPROVED_ORACLE_PASS"
          : "REVISE",
    pass: approved.rowCount > 0 && approved.pass,
    identity: identityResult,
    approved,
    draft,
    results,
  };
}

module.exports = {
  ORACLE_APPROVAL_STATUS,
  evaluateCategoryDocumentOracle,
};
