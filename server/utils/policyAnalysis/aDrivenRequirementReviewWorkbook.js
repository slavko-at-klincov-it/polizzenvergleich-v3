const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const {
  A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID,
} = require("./aDrivenBinaryReferenceResult");

const A_DRIVEN_REQUIREMENT_REVIEW_WORKBOOK_CONTRACT_ID =
  "LF_A_DRIVEN_REQUIREMENT_REVIEW_WORKBOOK_V1";
const SHEET_NAME = "LF Vergleich A nach B";
const HEADER_ROW = 5;
const HEADERS = Object.freeze([
  "Nr.",
  "Kategorie / Kapitel",
  "Zeilen-ID",
  "Prüfpunkt",
  "A-Vertragsinhalt",
  "A-Werte",
  "A-Fundstelle",
  "B-Gegenstück",
  "B-Werte / Abweichungen",
  "B-Fundstelle",
  "Fundstatus",
  "Vergleichsart",
  "Fachliche Bewertung (manuell)",
]);

function workbookError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function oneLine(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
}

function displayAValues(values) {
  return unique(
    values.map(({ label, rawValue, unit, qualifier }) =>
      oneLine(
        rawValue
          ? `${label}: ${rawValue}${unit ? ` ${unit}` : ""}${
              qualifier ? ` (${qualifier})` : ""
            }`
          : label
      )
    )
  ).join("\n");
}

function sourceLabel(evidence, documentsById) {
  const document = documentsById.get(evidence.documentUuid);
  const name =
    evidence.originalName ||
    document?.originalName ||
    (Number.isInteger(document?.documentPosition)
      ? `A-Dokument ${document.documentPosition + 1}`
      : null) ||
    evidence.documentUuid ||
    "Dokument";
  return `${name} · Seite ${evidence.physicalPageNumber}`;
}

function outcomeLabel(outcome) {
  return {
    FULL_COUNTERPART: "Vollständiges Gegenstück",
    PARTIAL_COUNTERPART: "Gegenstück mit Abweichungen",
    CONTRADICTED: "Gegenstück mit gegenteiliger Wirkung",
    NO_COUNTERPART_ESTABLISHED: "Kein Gegenstück",
  }[outcome];
}

function differenceText(row) {
  const componentDifferences = row.componentFindings
    .filter(({ outcome }) => outcome !== "MATCH")
    .map(
      ({ componentLabel, componentType, outcome }) =>
        `${componentLabel || componentType}: ${outcome}`
    );
  const otherDifferences = row.unmodeledDifferences.map(
    ({ dimension, description }) => `${dimension}: ${description}`
  );
  return unique([...componentDifferences, ...otherDifferences]).join("\n");
}

function reviewWorkbookRows(result) {
  if (
    result?.contractId !== A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID ||
    !Array.isArray(result.documents) ||
    !Array.isArray(result.rows) ||
    result.rows.length !== result.summary?.rows ||
    result.summary?.unresolved !== 0 ||
    result.summary?.binaryCustomerStatus !== true ||
    result.summary?.sideBOnlyRows !== 0
  )
    throw workbookError("LF_A_DRIVEN_REQUIREMENT_REVIEW_INPUT_INVALID");
  const documentsById = new Map(
    result.documents.map((document) => [document.documentUuid, document])
  );
  return result.rows.map((row, index) => {
    if (
      !["FOUND", "NOT_FOUND"].includes(row.customerStatus) ||
      !Array.isArray(row.aSourceSpans) ||
      row.aSourceSpans.length === 0 ||
      !Array.isArray(row.bCounterparts) ||
      (row.customerStatus === "FOUND" && row.bCounterparts.length === 0) ||
      (row.customerStatus === "NOT_FOUND" && row.bCounterparts.length !== 0)
    )
      throw workbookError(
        "LF_A_DRIVEN_REQUIREMENT_REVIEW_ROW_INVALID",
        row.requirementId
      );
    return [
      index + 1,
      row.aCategoryPath.join(" › "),
      row.requirementId,
      oneLine(row.aCheckPoint),
      oneLine(row.aOriginalContent),
      displayAValues(row.aValues),
      unique(
        row.aSourceSpans.map((span) => sourceLabel(span, documentsById))
      ).join("\n"),
      unique(row.bCounterparts.map(({ exactText }) => oneLine(exactText))).join(
        "\n"
      ),
      differenceText(row),
      unique(
        row.bCounterparts.map((evidence) =>
          sourceLabel(evidence, documentsById)
        )
      ).join("\n"),
      row.customerStatus === "FOUND" ? "Gefunden" : "Nicht gefunden",
      outcomeLabel(row.counterpartOutcome),
      "",
    ];
  });
}

function styleWorkbook(sheet, dataRows) {
  sheet.showGridLines = false;
  sheet.views = [
    { state: "frozen", xSplit: 4, ySplit: HEADER_ROW, zoomScale: 80 },
  ];
  sheet.autoFilter = `A${HEADER_ROW}:M${HEADER_ROW + dataRows.length}`;
  sheet.columns = [8, 28, 22, 42, 58, 28, 38, 58, 44, 38, 18, 32, 42].map(
    (width) => ({ width })
  );

  sheet.getCell("A1").value = "LF-Dokumentvergleich A nach B";
  sheet.getCell("A2").value =
    "A bestimmt Reihenfolge und Prüfpunkte. B liefert ausschließlich Gegenstücke und Fundstellen.";
  sheet.getCell("A3").value = `${dataRows.length} Prüfpunkte · ${
    dataRows.filter((row) => row[10] === "Gefunden").length
  } gefunden · ${
    dataRows.filter((row) => row[10] === "Nicht gefunden").length
  } nicht gefunden`;
  sheet.getCell("A1").font = {
    name: "Aptos Display",
    size: 16,
    bold: true,
    color: { argb: "FF1F2937" },
  };
  sheet.getCell("A2").font = {
    name: "Aptos",
    size: 10,
    italic: true,
    color: { argb: "FF4B5563" },
  };
  sheet.getCell("A3").font = {
    name: "Aptos",
    size: 10,
    bold: true,
    color: { argb: "FF1F4E78" },
  };
  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 20;
  sheet.getRow(3).height = 20;
  sheet.getRow(HEADER_ROW).height = 34;

  sheet.getRow(HEADER_ROW).eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E78" },
    };
    cell.font = {
      name: "Aptos",
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF17365D" } },
    };
  });

  for (
    let rowNumber = HEADER_ROW + 1;
    rowNumber <= HEADER_ROW + dataRows.length;
    rowNumber += 1
  ) {
    const row = sheet.getRow(rowNumber);
    row.height = 72;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Aptos", size: 9, color: { argb: "FF1F2937" } };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFD1D5DB" } },
      };
    });
    row.getCell(1).alignment = { horizontal: "right", vertical: "top" };
    const status = row.getCell(11);
    status.font = { name: "Aptos", size: 9, bold: true };
    status.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: status.value === "Gefunden" ? "FFE2F0D9" : "FFFCE4D6",
      },
    };
    row.getCell(13).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF2CC" },
    };
  }
}

function persistedValues(sheet, rowNumber) {
  return HEADERS.map(
    (_header, index) => sheet.getCell(rowNumber, index + 1).value ?? ""
  );
}

async function validateADrivenRequirementReviewWorkbook(result, file) {
  const rows = reviewWorkbookRows(result);
  if (!fs.existsSync(file))
    throw workbookError("LF_A_DRIVEN_REQUIREMENT_REVIEW_FILE_MISSING");
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw workbookError("LF_A_DRIVEN_REQUIREMENT_REVIEW_FILE_INVALID");
  const persisted = new ExcelJS.Workbook();
  await persisted.xlsx.readFile(file);
  const persistedSheet = persisted.getWorksheet(SHEET_NAME);
  const formulaCells = [];
  persistedSheet?.eachRow((row) =>
    row.eachCell((cell) => {
      if (cell.formula) formulaCells.push(cell.address);
    })
  );
  const expectedWidths = [
    8, 28, 22, 42, 58, 28, 38, 58, 44, 38, 18, 32, 42,
  ];
  const view = persistedSheet?.views?.[0];
  const firstDataRow = persistedSheet?.getRow(HEADER_ROW + 1);
  const lastDataRow = persistedSheet?.getRow(HEADER_ROW + rows.length);
  if (
    !persistedSheet ||
    persisted.worksheets.length !== 1 ||
    persistedSheet.rowCount !== HEADER_ROW + rows.length ||
    JSON.stringify(persistedValues(persistedSheet, HEADER_ROW)) !==
      JSON.stringify(HEADERS) ||
    rows.some(
      (expected, index) =>
        JSON.stringify(
          persistedValues(persistedSheet, HEADER_ROW + 1 + index)
        ) !== JSON.stringify(expected)
    ) ||
    formulaCells.length !== 0 ||
    expectedWidths.some(
      (width, index) =>
        Math.abs(Number(persistedSheet.getColumn(index + 1).width) - width) >
        0.01
    ) ||
    view?.state !== "frozen" ||
    view.xSplit !== 4 ||
    view.ySplit !== HEADER_ROW ||
    firstDataRow?.getCell(13).fill?.fgColor?.argb !== "FFFFF2CC" ||
    lastDataRow?.getCell(13).fill?.fgColor?.argb !== "FFFFF2CC"
  )
    throw workbookError("LF_A_DRIVEN_REQUIREMENT_REVIEW_ROUNDTRIP_INVALID");
  return {
    contractId: A_DRIVEN_REQUIREMENT_REVIEW_WORKBOOK_CONTRACT_ID,
    file,
    rows: rows.length,
    found: rows.filter((row) => row[10] === "Gefunden").length,
    notFound: rows.filter((row) => row[10] === "Nicht gefunden").length,
    formulaCells: formulaCells.length,
    sheets: persisted.worksheets.length,
  };
}

async function writeADrivenRequirementReviewWorkbook(result, file) {
  const rows = reviewWorkbookRows(result);
  if (fs.existsSync(file))
    return validateADrivenRequirementReviewWorkbook(result, file);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Polizzenvergleich V3";
  workbook.subject = A_DRIVEN_REQUIREMENT_REVIEW_WORKBOOK_CONTRACT_ID;
  const sheet = workbook.addWorksheet(SHEET_NAME);
  sheet.getRow(HEADER_ROW).values = HEADERS;
  for (const row of rows) sheet.addRow(row);
  styleWorkbook(sheet, rows);

  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  await workbook.xlsx.writeFile(temporary);
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, file);

  return validateADrivenRequirementReviewWorkbook(result, file);
}

module.exports = {
  A_DRIVEN_REQUIREMENT_REVIEW_WORKBOOK_CONTRACT_ID,
  HEADERS,
  HEADER_ROW,
  SHEET_NAME,
  reviewWorkbookRows,
  validateADrivenRequirementReviewWorkbook,
  writeADrivenRequirementReviewWorkbook,
};
