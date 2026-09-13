const crypto = require("crypto");

const LF_KNOWN_FIXTURE_GOLD_CANDIDATE_CONTRACT_ID =
  "LF_1PLUS9_GOLD_CANDIDATE_V1";
const CLAUDE_STATUSES = new Set(["Ja", "Teilweise", "Nein"]);
const SYSTEM_STATUSES = new Set(["Gefunden", "Nicht gefunden"]);
const ADJUDICATION_STATUSES = new Set(["UNREVIEWED", "SOURCE_ADJUDICATED"]);

function candidateError(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(Buffer.isBuffer(value) ? value : String(value))
    .digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function requiredString(value, code) {
  if (typeof value !== "string" || !value.trim()) throw candidateError(code);
  return value.trim();
}

function optionalString(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/u.test(value || "");
}

function statusRelation(claudeStatus, systemStatus) {
  const claudeClass =
    claudeStatus === "Ja"
      ? "FULL"
      : claudeStatus === "Teilweise"
        ? "PARTIAL"
        : "ABSENT";
  const systemClass = systemStatus === "Gefunden" ? "FOUND" : "MISS";
  return `CLAUDE_${claudeClass}__SYSTEM_${systemClass}`;
}

function categoryPrefix(requirementId) {
  return requirementId.split("-")[0];
}

function takeBalanced(rows, count) {
  const selected = [];
  const selectedIds = new Set();
  const prefixes = new Set();
  for (const row of rows) {
    const prefix = categoryPrefix(row.requirementId);
    if (prefixes.has(prefix)) continue;
    selected.push(row);
    selectedIds.add(row.requirementId);
    prefixes.add(prefix);
    if (selected.length === count) return selected;
  }
  for (const row of rows) {
    if (selectedIds.has(row.requirementId)) continue;
    selected.push(row);
    if (selected.length === count) return selected;
  }
  return selected;
}

function selectRepresentativeRows(rows, sampleSize = 30) {
  if (!Number.isInteger(sampleSize) || sampleSize < 1)
    throw candidateError("LF_GOLD_CANDIDATE_SAMPLE_SIZE_INVALID");
  const quotas = [
    ["CLAUDE_ABSENT__SYSTEM_FOUND", 8],
    ["CLAUDE_FULL__SYSTEM_MISS", 10],
    ["CLAUDE_PARTIAL__SYSTEM_MISS", 5],
    ["CLAUDE_FULL__SYSTEM_FOUND", 4],
    ["CLAUDE_ABSENT__SYSTEM_MISS", 3],
  ];
  const selected = [];
  const selectedIds = new Set();
  for (const [relation, quota] of quotas) {
    const candidates = rows.filter((row) => row.relation === relation);
    for (const row of takeBalanced(candidates, quota)) {
      if (selectedIds.has(row.requirementId)) continue;
      selected.push(row);
      selectedIds.add(row.requirementId);
    }
  }
  for (const row of rows) {
    if (selected.length >= sampleSize) break;
    if (selectedIds.has(row.requirementId)) continue;
    selected.push(row);
    selectedIds.add(row.requirementId);
  }
  if (selected.length !== sampleSize)
    throw candidateError("LF_GOLD_CANDIDATE_SAMPLE_INCOMPLETE");
  return selected.map(({ analysisRowId, requirementId, relation }) => ({
    analysisRowId,
    requirementId,
    relation,
  }));
}

function countBy(values, selector) {
  const counts = {};
  for (const value of values) {
    const key = selector(value);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort());
}

function normalizeClaudeRow(row) {
  const foundStatus = requiredString(
    row.foundStatus,
    "LF_GOLD_CANDIDATE_CLAUDE_STATUS_REQUIRED"
  );
  if (!CLAUDE_STATUSES.has(foundStatus))
    throw candidateError(
      "LF_GOLD_CANDIDATE_CLAUDE_STATUS_INVALID",
      foundStatus
    );
  return {
    category: requiredString(
      row.category,
      "LF_GOLD_CANDIDATE_CLAUDE_CATEGORY_REQUIRED"
    ),
    subcategory: requiredString(
      row.subcategory,
      "LF_GOLD_CANDIDATE_CLAUDE_SUBCATEGORY_REQUIRED"
    ),
    requirementId: requiredString(
      row.requirementId,
      "LF_GOLD_CANDIDATE_CLAUDE_REQUIREMENT_REQUIRED"
    ),
    point: requiredString(row.point, "LF_GOLD_CANDIDATE_CLAUDE_POINT_REQUIRED"),
    foundStatus,
    coverageStatus: requiredString(
      row.coverageStatus,
      "LF_GOLD_CANDIDATE_CLAUDE_COVERAGE_REQUIRED"
    ),
    values: optionalString(row.values),
    sourceQuote: requiredString(
      row.sourceQuote,
      "LF_GOLD_CANDIDATE_CLAUDE_QUOTE_REQUIRED"
    ),
    sourceFiles: requiredString(
      row.sourceFiles,
      "LF_GOLD_CANDIDATE_CLAUDE_SOURCES_REQUIRED"
    ),
    note: requiredString(row.note, "LF_GOLD_CANDIDATE_CLAUDE_NOTE_REQUIRED"),
    manualAssessment: optionalString(row.manualAssessment),
  };
}

function normalizeSystemRow(row) {
  const customerSearchStatus = requiredString(
    row.customerSearchStatus,
    "LF_GOLD_CANDIDATE_SYSTEM_STATUS_REQUIRED"
  );
  if (!SYSTEM_STATUSES.has(customerSearchStatus))
    throw candidateError(
      "LF_GOLD_CANDIDATE_SYSTEM_STATUS_INVALID",
      customerSearchStatus
    );
  return {
    category: requiredString(
      row.category,
      "LF_GOLD_CANDIDATE_SYSTEM_CATEGORY_REQUIRED"
    ),
    subcategory: requiredString(
      row.subcategory,
      "LF_GOLD_CANDIDATE_SYSTEM_SUBCATEGORY_REQUIRED"
    ),
    requirementId: requiredString(
      row.requirementId,
      "LF_GOLD_CANDIDATE_SYSTEM_REQUIREMENT_REQUIRED"
    ),
    point: requiredString(row.point, "LF_GOLD_CANDIDATE_SYSTEM_POINT_REQUIRED"),
    aContent: requiredString(
      row.aContent,
      "LF_GOLD_CANDIDATE_SYSTEM_A_CONTENT_REQUIRED"
    ),
    aValues: optionalString(row.aValues),
    aSource: requiredString(
      row.aSource,
      "LF_GOLD_CANDIDATE_SYSTEM_A_SOURCE_REQUIRED"
    ),
    bCounterpart: requiredString(
      row.bCounterpart,
      "LF_GOLD_CANDIDATE_SYSTEM_B_CONTENT_REQUIRED"
    ),
    bCoverage: requiredString(
      row.bCoverage,
      "LF_GOLD_CANDIDATE_SYSTEM_B_COVERAGE_REQUIRED"
    ),
    bValues: optionalString(row.bValues),
    bSource: requiredString(
      row.bSource,
      "LF_GOLD_CANDIDATE_SYSTEM_B_SOURCE_REQUIRED"
    ),
    customerSearchStatus,
    note: requiredString(row.note, "LF_GOLD_CANDIDATE_SYSTEM_NOTE_REQUIRED"),
    manualAssessment: optionalString(row.manualAssessment),
  };
}

function buildLfKnownFixtureGoldCandidate({
  claudeRows,
  systemRows,
  oracle,
  bindings,
  sourceDocuments,
  createdAt = new Date().toISOString(),
}) {
  if (!Array.isArray(claudeRows) || claudeRows.length !== 283)
    throw candidateError("LF_GOLD_CANDIDATE_CLAUDE_ROWS_INVALID");
  if (!Array.isArray(systemRows) || systemRows.length !== 283)
    throw candidateError("LF_GOLD_CANDIDATE_SYSTEM_ROWS_INVALID");
  if (
    oracle?.contractId !== "LF_COUNTERPART_GOLD_ORACLE_V1" ||
    oracle?.summary?.rowCount !== 283 ||
    oracle?.summary?.componentCount !== 631 ||
    !Array.isArray(oracle.rows) ||
    oracle.rows.length !== 283
  )
    throw candidateError("LF_GOLD_CANDIDATE_ORACLE_INVALID");
  for (const key of [
    "claudeWorkbookSha256",
    "systemWorkbookSha256",
    "oracleSha256",
  ])
    if (!validSha256(bindings?.[key]))
      throw candidateError("LF_GOLD_CANDIDATE_BINDING_INVALID", key);
  if (!Array.isArray(sourceDocuments) || sourceDocuments.length !== 9)
    throw candidateError("LF_GOLD_CANDIDATE_SOURCE_DOCUMENTS_INVALID");
  if (
    sourceDocuments.some(
      (document) =>
        !requiredString(
          document.name,
          "LF_GOLD_CANDIDATE_SOURCE_NAME_REQUIRED"
        ) || !validSha256(document.sha256)
    )
  )
    throw candidateError("LF_GOLD_CANDIDATE_SOURCE_DOCUMENTS_INVALID");

  const normalizedClaudeRows = claudeRows.map(normalizeClaudeRow);
  const normalizedSystemRows = systemRows.map(normalizeSystemRow);
  const seenRequirementIds = new Set();
  const rows = oracle.rows.map((oracleRow, sourceOrder) => {
    const claude = normalizedClaudeRows[sourceOrder];
    const system = normalizedSystemRows[sourceOrder];
    const requirementId = requiredString(
      oracleRow.requirementId,
      "LF_GOLD_CANDIDATE_ORACLE_REQUIREMENT_REQUIRED"
    );
    if (
      oracleRow.sourceOrder !== sourceOrder ||
      claude.requirementId !== requirementId ||
      system.requirementId !== requirementId ||
      claude.category !== system.category ||
      claude.subcategory !== system.subcategory ||
      claude.point !== system.point
    )
      throw candidateError(
        "LF_GOLD_CANDIDATE_ROW_ALIGNMENT_INVALID",
        requirementId
      );
    if (seenRequirementIds.has(requirementId))
      throw candidateError(
        "LF_GOLD_CANDIDATE_REQUIREMENT_DUPLICATE",
        requirementId
      );
    seenRequirementIds.add(requirementId);
    const analysisRowId = requiredString(
      oracleRow.analysisRowId,
      "LF_GOLD_CANDIDATE_ANALYSIS_ROW_REQUIRED"
    );
    const components = oracleRow.components.map((component) => ({
      componentId: component.componentId,
      label: component.label,
      factRole: component.factRole,
      benchmarkCandidateCount: component.benchmarkCandidateIds.length,
      adjudication: {
        status: "UNREVIEWED",
        truth: null,
        selectedSourceRanges: [],
        rationale: null,
      },
    }));
    return {
      analysisRowId,
      requirementId,
      sourceOrder,
      category: claude.category,
      subcategory: claude.subcategory,
      point: claude.point,
      relation: statusRelation(claude.foundStatus, system.customerSearchStatus),
      claude,
      system,
      benchmarkCandidateCount: oracleRow.benchmarkCandidateIds.length,
      components,
      adjudication: {
        status: "UNREVIEWED",
        truth: null,
        selectedSourceRanges: [],
        rationale: null,
      },
    };
  });
  const componentCount = rows.reduce(
    (total, row) => total + row.components.length,
    0
  );
  if (componentCount !== 631)
    throw candidateError("LF_GOLD_CANDIDATE_COMPONENT_COUNT_INVALID");
  const representativeReview = selectRepresentativeRows(rows);
  const payload = {
    schemaVersion: 1,
    contractId: LF_KNOWN_FIXTURE_GOLD_CANDIDATE_CONTRACT_ID,
    artifactKind: "LF_KNOWN_1PLUS9_SOURCE_REVIEW_CANDIDATE",
    status: "SOURCE_REVIEW_REQUIRED",
    qaOnly: true,
    productionRule: false,
    createdAt,
    authority:
      "ORIGINAL_SOURCE_ADJUDICATION; MODEL_AGREEMENT_ALONE_IS_NOT_GOLD",
    bindings,
    sourceDocuments,
    summary: {
      rowCount: rows.length,
      componentCount,
      claudeStatuses: countBy(rows, (row) => row.claude.foundStatus),
      systemStatuses: countBy(rows, (row) => row.system.customerSearchStatus),
      relations: countBy(rows, (row) => row.relation),
      sourceAdjudicatedRows: 0,
      sourceAdjudicatedComponents: 0,
      representativeReviewRowCount: representativeReview.length,
    },
    representativeReview,
    rows,
  };
  return validateLfKnownFixtureGoldCandidate({
    ...payload,
    candidateSha256: sha256(
      `${LF_KNOWN_FIXTURE_GOLD_CANDIDATE_CONTRACT_ID}\u0000${canonicalJson(
        payload
      )}`
    ),
  });
}

function validateLfKnownFixtureGoldCandidate(candidate) {
  if (
    candidate?.contractId !== LF_KNOWN_FIXTURE_GOLD_CANDIDATE_CONTRACT_ID ||
    candidate?.schemaVersion !== 1 ||
    candidate?.artifactKind !== "LF_KNOWN_1PLUS9_SOURCE_REVIEW_CANDIDATE" ||
    candidate?.status !== "SOURCE_REVIEW_REQUIRED" ||
    candidate?.qaOnly !== true ||
    candidate?.productionRule !== false ||
    !Array.isArray(candidate.rows) ||
    candidate.rows.length !== 283 ||
    !Array.isArray(candidate.representativeReview) ||
    candidate.representativeReview.length !== 30 ||
    !validSha256(candidate.candidateSha256)
  )
    throw candidateError("LF_GOLD_CANDIDATE_CONTRACT_INVALID");
  const { candidateSha256, ...payload } = candidate;
  if (
    candidateSha256 !==
    sha256(
      `${LF_KNOWN_FIXTURE_GOLD_CANDIDATE_CONTRACT_ID}\u0000${canonicalJson(
        payload
      )}`
    )
  )
    throw candidateError("LF_GOLD_CANDIDATE_HASH_INVALID");
  const requirementIds = new Set();
  const analysisRowIds = new Set();
  let componentCount = 0;
  let sourceAdjudicatedRows = 0;
  let sourceAdjudicatedComponents = 0;
  for (const [sourceOrder, row] of candidate.rows.entries()) {
    if (
      row.sourceOrder !== sourceOrder ||
      requirementIds.has(row.requirementId) ||
      analysisRowIds.has(row.analysisRowId) ||
      !CLAUDE_STATUSES.has(row.claude?.foundStatus) ||
      !SYSTEM_STATUSES.has(row.system?.customerSearchStatus) ||
      row.relation !==
        statusRelation(
          row.claude.foundStatus,
          row.system.customerSearchStatus
        ) ||
      !ADJUDICATION_STATUSES.has(row.adjudication?.status) ||
      !Array.isArray(row.components) ||
      row.components.length < 1
    )
      throw candidateError("LF_GOLD_CANDIDATE_ROW_INVALID", row.requirementId);
    requirementIds.add(row.requirementId);
    analysisRowIds.add(row.analysisRowId);
    if (row.adjudication.status === "SOURCE_ADJUDICATED")
      sourceAdjudicatedRows += 1;
    for (const component of row.components) {
      if (!ADJUDICATION_STATUSES.has(component.adjudication?.status))
        throw candidateError(
          "LF_GOLD_CANDIDATE_COMPONENT_INVALID",
          `${row.requirementId}:${component.componentId}`
        );
      if (component.adjudication.status === "SOURCE_ADJUDICATED")
        sourceAdjudicatedComponents += 1;
      componentCount += 1;
    }
  }
  const expectedSummary = {
    rowCount: 283,
    componentCount,
    claudeStatuses: countBy(candidate.rows, (row) => row.claude.foundStatus),
    systemStatuses: countBy(
      candidate.rows,
      (row) => row.system.customerSearchStatus
    ),
    relations: countBy(candidate.rows, (row) => row.relation),
    sourceAdjudicatedRows,
    sourceAdjudicatedComponents,
    representativeReviewRowCount: 30,
  };
  if (canonicalJson(candidate.summary) !== canonicalJson(expectedSummary))
    throw candidateError("LF_GOLD_CANDIDATE_SUMMARY_INVALID");
  if (componentCount !== 631)
    throw candidateError("LF_GOLD_CANDIDATE_COMPONENT_COUNT_INVALID");
  const reviewIds = new Set(
    candidate.representativeReview.map(({ requirementId }) => requirementId)
  );
  if (
    reviewIds.size !== 30 ||
    [...reviewIds].some((requirementId) => !requirementIds.has(requirementId))
  )
    throw candidateError("LF_GOLD_CANDIDATE_SAMPLE_INVALID");
  return candidate;
}

module.exports = {
  LF_KNOWN_FIXTURE_GOLD_CANDIDATE_CONTRACT_ID,
  buildLfKnownFixtureGoldCandidate,
  canonicalJson,
  selectRepresentativeRows,
  sha256,
  statusRelation,
  validateLfKnownFixtureGoldCandidate,
};
