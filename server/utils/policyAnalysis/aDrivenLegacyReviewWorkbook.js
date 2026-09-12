const ExcelJS = require("exceljs");
const {
  REVIEW_RELATION_VALUES,
  ROOT_CAUSE_DISPOSITION_VALUES,
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
const WORKBOOK_FONT = "Arial";
const COLORS = Object.freeze({
  dark: "FF1F2937",
  muted: "FF5B6472",
  navy: "FF23395D",
  white: "FFFFFFFF",
  amber: "FFFFF2CC",
  lightBlue: "FFE8EEF7",
  line: "FFD9DEE7",
});

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
  for (let row = firstUnexpectedRow; row <= sheet.rowCount; row += 1) {
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

function statusFormula(rowNumber) {
  return `IF(COUNTA(L${rowNumber}:P${rowNumber})=0,"OFFEN",IF(OR(L${rowNumber}="",O${rowNumber}="",P${rowNumber}=""),"UNVOLLSTÄNDIG","EINGABE VORHANDEN - IMPORTPRÜFUNG OFFEN"))`;
}

function assertStatusFormula(sheet, rowNumber) {
  const cell = sheet.getCell(rowNumber, 17);
  if (
    !cell.value ||
    typeof cell.value !== "object" ||
    clean(cell.value.formula) !== statusFormula(rowNumber)
  )
    throw workbookError(
      "LF_A_REVIEW_WORKBOOK_STATUS_FORMULA_INVALID",
      `${sheet.name}!${cell.address}`
    );
}

function assertWorkbookStructure({ workbook, draft, input, template }) {
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
  const attestation = primitiveCellValue(
    guide.getCell("B22"),
    `${GUIDE_SHEET}!B22`
  );
  if (
    (template
      ? clean(attestation) !== ""
      : clean(attestation) !== INDEPENDENCE_ATTESTATION) ||
    clean(guide.getCell("B23").value) !== input.reviewerSlot ||
    clean(guide.getCell("B24").value) !== input.reviewerId
  )
    throw workbookError("LF_A_REVIEW_WORKBOOK_ATTESTATION_INVALID");

  assertHeaders(review, REVIEW_HEADER_ROW, REVIEW_HEADERS);
  draft.records.forEach((record, index) => {
    const rowNumber = REVIEW_FIRST_DATA_ROW + index;
    assertRow(
      review,
      rowNumber,
      expectedReviewRow(record, index),
      record.recordId
    );
    assertStatusFormula(review, rowNumber);
    if (!template) return;
    for (let column = 12; column <= 16; column += 1) {
      const cell = review.getCell(rowNumber, column);
      if (primitiveCellValue(cell, `${REVIEW_SHEET}!${cell.address}`) !== null)
        throw workbookError(
          "LF_A_REVIEW_WORKBOOK_TEMPLATE_DECISION_NOT_EMPTY",
          `${REVIEW_SHEET}!${cell.address}`
        );
    }
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
}

function setHeaderStyle(row) {
  row.height = 30;
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.navy },
    };
    cell.font = {
      name: WORKBOOK_FONT,
      size: 10,
      bold: true,
      color: { argb: COLORS.white },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = { bottom: { style: "thin", color: { argb: COLORS.white } } };
  });
}

function styleTitle(sheet, title, subtitle) {
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = {
    name: WORKBOOK_FONT,
    size: 14,
    bold: true,
    color: { argb: COLORS.navy },
  };
  sheet.getCell("A2").value = subtitle;
  sheet.getCell("A2").font = {
    name: WORKBOOK_FONT,
    size: 10,
    italic: true,
    color: { argb: COLORS.muted },
  };
}

function createGuideSheet(workbook, draft, input) {
  const sheet = workbook.addWorksheet(GUIDE_SHEET, {
    views: [{ showGridLines: false }],
  });
  styleTitle(
    sheet,
    "LF-A – Arbeitsmappe für die 631er Doppelprüfung",
    "Private QA-Vorbereitung · kein Kundenergebnis · keine Freigabe · keine Signatur"
  );
  const metrics = [
    ["Prüfbasis", "eingefrorener Crosswalk-Draft"],
    ["Datensätze", draft.records.length],
    ["Legacy-Anforderungen", draft.summary?.legacyRequirements ?? ""],
    ["Dynamische Anforderungen", draft.summary?.dynamicRequirements ?? ""],
    ["Dynamische Komponenten", draft.summary?.dynamicComponents ?? ""],
    ["Basis-SHA-256", draft.basisSha256],
    ["Draft-SHA-256", draft.draftSha256],
    [
      "Offen",
      {
        formula: `COUNTIF(${REVIEW_SHEET}!$Q$6:$Q$${draft.records.length + 5},"OFFEN")+COUNTIF(${REVIEW_SHEET}!$Q$6:$Q$${draft.records.length + 5},"UNVOLLSTÄNDIG")`,
        result: draft.records.length,
      },
    ],
    [
      "Eingabe vorhanden",
      {
        formula: `COUNTIF(${REVIEW_SHEET}!$Q$6:$Q$${draft.records.length + 5},"EINGABE VORHANDEN - IMPORTPRÜFUNG OFFEN")`,
        result: 0,
      },
    ],
  ];
  metrics.forEach((values, index) => {
    sheet.getRow(4 + index).values = values;
    sheet.getCell(4 + index, 1).font = {
      name: WORKBOOK_FONT,
      size: 10,
      bold: true,
      color: { argb: COLORS.dark },
    };
  });
  const relations = [
    ["Relation", "Zielanzahl", "Bedeutung"],
    ["EQUIVALENT", "1", "inhaltlich gleich"],
    ["REPHRASED_EQUIVALENT", "1", "gleich, anders formuliert"],
    ["MOVED_EQUIVALENT", "1", "gleich, an anderer Strukturstelle"],
    [
      "SPLIT_INTO_DYNAMIC",
      ">=2",
      "Legacy-Komponente wurde in mehrere dynamische Komponenten geteilt",
    ],
    [
      "MERGED_INTO_DYNAMIC",
      "1",
      "mehrere Legacy-Komponenten gehen in dieselbe dynamische Komponente ein",
    ],
    ["MISSING", "0", "relevantes dynamisches Element fehlt"],
    ["AMBIGUOUS", "0..n", "Beleg reicht für keine eindeutige Relation"],
  ];
  relations.forEach((values, index) => {
    sheet.getRow(4 + index).getCell(4).value = values[0];
    sheet.getRow(4 + index).getCell(5).value = values[1];
    sheet.getRow(4 + index).getCell(6).value = values[2];
  });
  ["D4", "E4", "F4"].forEach((address) => {
    const cell = sheet.getCell(address);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.navy },
    };
    cell.font = {
      name: WORKBOOK_FONT,
      size: 10,
      bold: true,
      color: { argb: COLORS.white },
    };
  });
  sheet.getRow(14).values = ["Arbeitsablauf", "Vorgehen"];
  [
    "Jede Zeile ausschließlich anhand des Legacy-Belegs und der Kandidaten prüfen.",
    "Relation, Ziel-ID(s), gegebenenfalls Merge-Gruppe, Ursachenklasse und Begründung erfassen.",
    "Bei SPLIT mindestens zwei Ziel-IDs; bei MERGED genau eine Ziel-ID und dieselbe Merge-Gruppe für mindestens zwei Legacy-Zeilen.",
    "MISSING hat keine Ziel-ID und verlangt DYNAMIC_COMPONENT_MISSING. AMBIGUOUS ist kein freigabefähiger Endzustand.",
    "Nach technischer Rückprüfung entsteht nur ein unsigniertes Reviewer-JSON.",
    "Registry, Unabhängigkeitsattestierung, Ed25519-Signatur und Gate bleiben getrennt.",
  ].forEach((value, index) => {
    sheet.getRow(15 + index).values = [index + 1, value];
  });
  setHeaderStyle(sheet.getRow(14));
  sheet.getRow(22).values = ["Unabhängigkeitsattestierung *", null];
  sheet.getRow(23).values = ["Reviewer-Slot *", input.reviewerSlot];
  sheet.getRow(24).values = ["Reviewer-ID *", input.reviewerId];
  for (let row = 22; row <= 24; row += 1) {
    sheet.getCell(row, 1).font = {
      name: WORKBOOK_FONT,
      size: 10,
      bold: true,
      color: { argb: COLORS.dark },
    };
    sheet.getCell(row, 2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.amber },
    };
  }
  sheet.getCell("B22").dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: [`"${INDEPENDENCE_ATTESTATION}"`],
  };
  sheet.getCell("B23").dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ['"A,B"'],
  };
  sheet.columns = [
    { width: 32 },
    { width: 76 },
    { width: 3 },
    { width: 26 },
    { width: 12 },
    { width: 56 },
    { width: 3 },
    { width: 34 },
    { width: 34 },
  ];
  sheet.eachRow((row) =>
    row.eachCell((cell) => {
      cell.font = {
        ...cell.font,
        name: WORKBOOK_FONT,
        size: cell.font?.size || 10,
      };
      cell.alignment = {
        ...cell.alignment,
        vertical: "top",
        wrapText: true,
      };
    })
  );
  return sheet;
}

function createReviewSheet(workbook, draft) {
  const sheet = workbook.addWorksheet(REVIEW_SHEET, {
    views: [{ state: "frozen", xSplit: 2, ySplit: 5, showGridLines: false }],
  });
  styleTitle(
    sheet,
    `${draft.records.length} Legacy-Komponenten – unabhängige fachliche Prüfung`,
    "Gelbe Spalten ausfüllen. Ziel-IDs mit Semikolon trennen; ausschließlich IDs aus derselben Zeile verwenden."
  );
  sheet.getCell("A3").value = `Draft ${draft.draftSha256}`;
  sheet.getCell("A3").font = {
    name: WORKBOOK_FONT,
    size: 9,
    italic: true,
    color: { argb: COLORS.muted },
  };
  sheet.getRow(REVIEW_HEADER_ROW).values = REVIEW_HEADERS;
  setHeaderStyle(sheet.getRow(REVIEW_HEADER_ROW));
  draft.records.forEach((record, index) => {
    const rowNumber = REVIEW_FIRST_DATA_ROW + index;
    const row = sheet.getRow(rowNumber);
    row.values = [
      ...expectedReviewRow(record, index),
      null,
      null,
      null,
      null,
      null,
      { formula: statusFormula(rowNumber), result: "OFFEN" },
    ];
    row.height = 72;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = {
        name: WORKBOOK_FONT,
        size: 10,
        color: { argb: COLORS.dark },
      };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: COLORS.line } } };
    });
    for (let column = 12; column <= 16; column += 1)
      row.getCell(column).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.amber },
      };
    row.getCell(17).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.lightBlue },
    };
    row.getCell(12).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${REVIEW_RELATION_VALUES.join(",")}"`],
    };
    row.getCell(15).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${ROOT_CAUSE_DISPOSITION_VALUES.join(",")}"`],
    };
  });
  const widths = [
    7, 28, 24, 40, 38, 16, 10, 58, 11, 58, 72, 27, 48, 24, 32, 52, 30,
  ];
  widths.forEach((width, index) => (sheet.getColumn(index + 1).width = width));
  sheet.autoFilter = `A${REVIEW_HEADER_ROW}:Q${draft.records.length + 5}`;
  return sheet;
}

function createCandidateSheet(workbook, draft) {
  const sheet = workbook.addWorksheet(CANDIDATE_SHEET, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 4, showGridLines: false }],
  });
  styleTitle(
    sheet,
    "Dynamische Kandidaten – normalisierte Belegansicht",
    "Nur Entscheidungshilfe. Importiert werden ausschließlich die gelben Eingabespalten im Blatt Review."
  );
  sheet.getRow(CANDIDATE_HEADER_ROW).values = CANDIDATE_HEADERS;
  setHeaderStyle(sheet.getRow(CANDIDATE_HEADER_ROW));
  const rows = expectedCandidateRows(draft);
  rows.forEach((values, index) => {
    const row = sheet.getRow(CANDIDATE_FIRST_DATA_ROW + index);
    row.values = values;
    row.height = 54;
    row.eachCell((cell) => {
      cell.font = {
        name: WORKBOOK_FONT,
        size: 10,
        color: { argb: COLORS.dark },
      };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: COLORS.line } } };
    });
  });
  const widths = [28, 38, 38, 24, 11, 28, 17, 50, 28, 58, 10, 58, 28];
  widths.forEach((width, index) => (sheet.getColumn(index + 1).width = width));
  sheet.autoFilter = `A${CANDIDATE_HEADER_ROW}:M${rows.length + 4}`;
  return sheet;
}

function createReviewerWorkbook({ draft, input }) {
  validateTemplateBinding({ draft, input });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Polizzenvergleich QA";
  workbook.created = new Date(0);
  workbook.modified = new Date(0);
  workbook.calcProperties.fullCalcOnLoad = true;
  createGuideSheet(workbook, draft, input);
  createReviewSheet(workbook, draft);
  createCandidateSheet(workbook, draft);
  assertWorkbookStructure({ workbook, draft, input, template: true });
  return workbook;
}

async function exportReviewerWorkbookBuffer(args) {
  const workbook = createReviewerWorkbook(args);
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  if (bytes.length === 0 || bytes.length > MAX_WORKBOOK_BYTES)
    throw workbookError("LF_A_REVIEW_WORKBOOK_EXPORTED_BYTES_INVALID");
  const reloaded = await loadReviewWorkbook(bytes);
  assertWorkbookStructure({ ...args, workbook: reloaded, template: true });
  return bytes;
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
  assertWorkbookStructure({ workbook, draft, input, template: false });
  const review = workbook.getWorksheet(REVIEW_SHEET);
  const decisions = draft.records.map((record, index) => {
    const rowNumber = REVIEW_FIRST_DATA_ROW + index;
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
  exportReviewerWorkbookBuffer,
  importReviewerWorkbook,
  loadReviewWorkbook,
  createReviewerWorkbook,
};
