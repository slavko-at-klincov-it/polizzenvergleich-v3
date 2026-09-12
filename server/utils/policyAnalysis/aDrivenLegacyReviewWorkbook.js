const ExcelJS = require("exceljs");
const {
  normalizeReviewerDecisions,
} = require("./aDrivenLegacyDoubleReview");

// QA-only bridge. It imports human worksheet entries into an unsigned reviewer
// input. It cannot sign a review, approve a crosswalk, authorize B or mutate a
// product result.
const REVIEW_WORKBOOK_CONTRACT_ID = "LF_A_631_REVIEW_WORKBOOK_V1";
const REVIEW_SHEET = "Review";
const CANDIDATE_SHEET = "Kandidaten";
const GUIDE_SHEET = "Anleitung";
const REVIEW_HEADER_ROW = 5;
const REVIEW_FIRST_DATA_ROW = 6;
const CANDIDATE_HEADER_ROW = 4;
const CANDIDATE_FIRST_DATA_ROW = 5;
const REVIEW_HEADERS = Object.freeze([
  "Nr.",
  "Record-ID",
  "Mechanischer Befund",
  "Legacy-Anforderung",
  "Legacy-Komponente",
  "Legacy-Rolle",
  "Seite(n)",
  "Legacy-Quellbeleg",
  "Kandidaten",
  "Zulässige Kandidaten-IDs",
  "Kandidaten-Kurzsicht",
  "Relation *",
  "Dynamic Target(s) *",
  "Merge Group ID",
  "Ursachenklasse *",
  "Begründung *",
  "Arbeitsstatus",
]);
const CANDIDATE_HEADERS = Object.freeze([
  "Record-ID",
  "Legacy-Anforderung",
  "Legacy-Komponente",
  "Mechanischer Befund",
  "Kandidat-Nr.",
  "Dynamic Component ID",
  "Dynamic Typ",
  "Dynamic Komponente",
  "Dynamic Requirement ID",
  "Dynamic Anforderung",
  "Seite(n)",
  "Dynamic Quellbeleg",
  "Kontextart",
]);
const INDEPENDENCE_ATTESTATION =
  "ICH HABE UNABHÄNGIG GEPRÜFT UND KEIN REVIEW-ERGEBNIS DER ANDEREN PERSON GESEHEN";
const MAX_WORKBOOK_BYTES = 16 * 1024 * 1024;

function workbookError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function clean(value) {
  return String(value ?? "")
    .replace(/\r\n?/gu, "\n")
    .trim();
}

function uniqueJoin(values, separator = "; ") {
  return [...new Set((values || []).map(clean).filter(Boolean))].join(
    separator
  );
}

function primitiveCellValue(cell, location) {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  throw workbookError("LF_A_REVIEW_WORKBOOK_CELL_TYPE_INVALID", location);
}

function expectedReviewRow(record, index) {
  const pages = uniqueJoin(
    record.sourceEvidence.map((entry) => entry.physicalPageNumber)
  );
  const source = uniqueJoin(
    record.sourceEvidence.map((entry) => entry.exactText),
    "\n\n"
  );
  const candidateIds = uniqueJoin(
    record.candidates.map((entry) => entry.dynamicComponentId)
  );
  const candidateSummary = record.candidates
    .map(
      (entry, candidateIndex) =>
        `${candidateIndex + 1}. ${entry.dynamicComponentId} | ${entry.dynamicComponentType} | ${clean(entry.dynamicComponentLabel)} | Anforderung: ${clean(entry.dynamicRequirementLabel)}`
    )
    .join("\n");
  return [
    index + 1,
    record.recordId,
    record.mechanicalRoleReview.disposition,
    `${record.legacyRequirementId} | ${clean(record.legacyRequirementLabel)}`,
    `${record.legacyComponentId} | ${clean(record.legacyComponentLabel)}`,
    record.legacyFactRole,
    pages,
    source,
    record.candidates.length,
    candidateIds,
    candidateSummary,
  ];
}

function expectedCandidateRows(draft) {
  const rows = [];
  for (const record of draft.records) {
    record.candidates.forEach((candidate, index) => {
      rows.push([
        record.recordId,
        `${record.legacyRequirementId} | ${clean(record.legacyRequirementLabel)}`,
        `${record.legacyComponentId} | ${clean(record.legacyComponentLabel)}`,
        record.mechanicalRoleReview.disposition,
        index + 1,
        candidate.dynamicComponentId,
        candidate.dynamicComponentType,
        clean(candidate.dynamicComponentLabel),
        candidate.dynamicRequirementId,
        clean(candidate.dynamicRequirementLabel),
        uniqueJoin(
          candidate.sourceEvidence.map((entry) => entry.physicalPageNumber)
        ),
        uniqueJoin(
          candidate.sourceEvidence.map((entry) => entry.exactText),
          "\n\n"
        ),
        candidate.contextKind,
      ]);
    });
  }
  return rows;
}

function assertRow(sheet, rowNumber, expected, prefix) {
  expected.forEach((value, index) => {
    const location = `${sheet.name}!${sheet.getCell(rowNumber, index + 1).address}`;
    const actual = primitiveCellValue(
      sheet.getCell(rowNumber, index + 1),
      location
    );
    const equal =
      typeof value === "number"
        ? actual === value
        : clean(actual) === clean(value);
    if (!equal)
      throw workbookError(
        "LF_A_REVIEW_WORKBOOK_EVIDENCE_MUTATED",
        `${prefix}:${location}`
      );
  });
}

function assertHeaders(sheet, rowNumber, expected) {
  assertRow(sheet, rowNumber, expected, "HEADER");
}

function parseTargets(value) {
  if (!value) return [];
  return [
    ...new Set(
      clean(value)
        .split(/[;\n]+/u)
        .map(clean)
        .filter(Boolean)
    ),
  ];
}

function assertNoUnexpectedRows(sheet, firstUnexpectedRow, idColumn) {
  for (let row = firstUnexpectedRow; row <= sheet.actualRowCount; row += 1) {
    const cell = sheet.getCell(row, idColumn);
    if (primitiveCellValue(cell, `${sheet.name}!${cell.address}`) !== null)
      throw workbookError(
        "LF_A_REVIEW_WORKBOOK_EXTRA_ROW",
        `${sheet.name}!${cell.address}`
      );
  }
}

function validateTemplateBinding({ draft, input }) {
  if (
    !draft ||
    !Array.isArray(draft.records) ||
    !input ||
    input.basisSha256 !== draft.basisSha256 ||
    input.draftSha256 !== draft.draftSha256 ||
    !Array.isArray(input.decisions) ||
    input.decisions.length !== draft.records.length ||
    input.decisions.some(
      (decision, index) => decision.recordId !== draft.records[index].recordId
    )
  )
    throw workbookError("LF_A_REVIEW_WORKBOOK_TEMPLATE_BINDING_INVALID");
  if (
    input.decisions.some(
      (decision) =>
        decision.relation !== "UNREVIEWED" ||
        decision.rootCauseDisposition !== "UNREVIEWED" ||
        decision.dynamicTargets?.length !== 0 ||
        decision.mergeGroupId !== null ||
        decision.rationale !== ""
    )
  )
    throw workbookError("LF_A_REVIEW_WORKBOOK_TEMPLATE_NOT_PRISTINE");
}

async function loadReviewWorkbook(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0)
    throw workbookError("LF_A_REVIEW_WORKBOOK_BYTES_INVALID");
  if (buffer.length > MAX_WORKBOOK_BYTES)
    throw workbookError("LF_A_REVIEW_WORKBOOK_TOO_LARGE");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw workbookError("LF_A_REVIEW_WORKBOOK_XLSX_INVALID");
  }
  return workbook;
}

function importReviewerWorkbook({ workbook, draft, input }) {
  validateTemplateBinding({ draft, input });
  const guide = workbook.getWorksheet(GUIDE_SHEET);
  const review = workbook.getWorksheet(REVIEW_SHEET);
  const candidates = workbook.getWorksheet(CANDIDATE_SHEET);
  if (!guide || !review || !candidates)
    throw workbookError("LF_A_REVIEW_WORKBOOK_SHEET_MISSING");
  if (
    clean(guide.getCell("B9").value) !== draft.basisSha256 ||
    clean(guide.getCell("B10").value) !== draft.draftSha256
  )
    throw workbookError("LF_A_REVIEW_WORKBOOK_DRAFT_BINDING_INVALID");
  if (
    clean(guide.getCell("B22").value) !== INDEPENDENCE_ATTESTATION ||
    clean(guide.getCell("B23").value) !== input.reviewerSlot ||
    clean(guide.getCell("B24").value) !== input.reviewerId
  )
    throw workbookError("LF_A_REVIEW_WORKBOOK_ATTESTATION_INVALID");

  assertHeaders(review, REVIEW_HEADER_ROW, REVIEW_HEADERS);
  const decisions = draft.records.map((record, index) => {
    const rowNumber = REVIEW_FIRST_DATA_ROW + index;
    assertRow(review, rowNumber, expectedReviewRow(record, index), record.recordId);
    const values = [];
    for (let column = 12; column <= 16; column += 1) {
      const cell = review.getCell(rowNumber, column);
      values.push(primitiveCellValue(cell, `${REVIEW_SHEET}!${cell.address}`));
    }
    return {
      recordId: record.recordId,
      relation: clean(values[0]),
      dynamicTargets: parseTargets(values[1]),
      mergeGroupId: clean(values[2]) || null,
      rootCauseDisposition: clean(values[3]),
      rationale: clean(values[4]),
    };
  });
  assertNoUnexpectedRows(
    review,
    REVIEW_FIRST_DATA_ROW + draft.records.length,
    2
  );

  assertHeaders(candidates, CANDIDATE_HEADER_ROW, CANDIDATE_HEADERS);
  const expectedCandidates = expectedCandidateRows(draft);
  expectedCandidates.forEach((row, index) =>
    assertRow(
      candidates,
      CANDIDATE_FIRST_DATA_ROW + index,
      row,
      `CANDIDATE_${index + 1}`
    )
  );
  assertNoUnexpectedRows(
    candidates,
    CANDIDATE_FIRST_DATA_ROW + expectedCandidates.length,
    1
  );

  const normalized = normalizeReviewerDecisions(decisions, draft);
  return {
    ...input,
    independenceAttestation: {
      otherReviewerDecisionArtifactSeenBeforeSubmission: false,
      reviewPerformedIndependently: true,
    },
    decisions: normalized,
  };
}

module.exports = {
  CANDIDATE_HEADERS,
  INDEPENDENCE_ATTESTATION,
  MAX_WORKBOOK_BYTES,
  REVIEW_HEADERS,
  REVIEW_WORKBOOK_CONTRACT_ID,
  expectedCandidateRows,
  expectedReviewRow,
  importReviewerWorkbook,
  loadReviewWorkbook,
};
