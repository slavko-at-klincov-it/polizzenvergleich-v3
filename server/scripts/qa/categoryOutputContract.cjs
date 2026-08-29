const DEFAULT_EXPECTED_HEADERS = [
  "Kategorie-ID",
  "Stufe",
  "Kategorie-Name",
  "Belegter Vertragsinhalt",
  "Deckung",
  "Deckungssumme",
  "Quelle",
  "Prüfstatus",
];

const ALLOWED_COVERAGE = new Set([
  "Ja",
  "Nein",
  "Gemischt",
  "Nicht feststellbar",
]);
const ALLOWED_STATUS = new Set([
  "BELEGT",
  "TEILBELEGT",
  "WIDERSPRÜCHLICH",
  "UNGEKLÄRT",
]);
const ALLOWED_STATUS_COVERAGE = new Set([
  "BELEGT|Ja",
  "BELEGT|Nein",
  "BELEGT|Gemischt",
  "TEILBELEGT|Nicht feststellbar",
  "WIDERSPRÜCHLICH|Nicht feststellbar",
  "UNGEKLÄRT|Nicht feststellbar",
]);
const MISSING_EVIDENCE = "keine belegte Fundstelle gefunden";

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
}

function stripCodeTicks(value) {
  return String(value || "")
    .trim()
    .replace(/^`|`$/gu, "");
}

function stripOuterQuotes(value) {
  const normalized = normalizeWhitespace(value);
  if (
    (normalized.startsWith("„") && normalized.endsWith("“")) ||
    (normalized.startsWith('"') && normalized.endsWith('"'))
  )
    return normalized.slice(1, -1).trim();
  return normalized;
}

function splitMarkdownRow(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith("|")) return null;

  const rowBody = trimmed.endsWith("|")
    ? trimmed.slice(1, -1)
    : trimmed.slice(1);

  const cells = [];
  let current = "";
  let escaped = false;
  for (const character of rowBody) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (character === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  return cells;
}

function isSeparatorRow(cells) {
  return (
    Array.isArray(cells) &&
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/u.test(cell.trim()))
  );
}

function extractCategoryDefinitions(systemPrompt) {
  const definitions = [];
  for (const line of String(systemPrompt || "").split(/\r?\n/u)) {
    const cells = splitMarkdownRow(line);
    if (!cells || cells.length !== 3) continue;
    const id = stripCodeTicks(cells[0]);
    if (!/^[A-Z]{2}-(?:[A-Z]\d{2}|\d{2})$/u.test(id)) continue;
    definitions.push({
      id,
      stage: stripCodeTicks(cells[1]),
      label: stripCodeTicks(cells[2]),
    });
  }
  return definitions;
}

function extractRequiredNotice(systemPrompt) {
  const match = String(systemPrompt || "").match(
    /Schließe unmittelbar nach der Tabelle mit genau diesem Hinweis:\s*([\s\S]+?)\s*$/u
  );
  return match ? stripOuterQuotes(match[1]) : "";
}

function parseSourceCitations(source) {
  const citations = [];
  for (const part of String(source || "").split(/<br\s*\/?>/giu)) {
    const match = part
      .trim()
      .match(/^PDF-Seite\s+(\d+)\s*:\s*[„"]([\s\S]+)[“"]$/u);
    if (!match) return [];
    citations.push({ pageNumber: Number(match[1]), quote: match[2].trim() });
  }
  return citations;
}

function validateCategoryOutput({
  answer,
  categoryDefinitions,
  requiredNotice,
  sourceDocuments = [],
  expectedHeaders = DEFAULT_EXPECTED_HEADERS,
}) {
  const reasons = [];
  const normalizedAnswer = String(answer || "")
    .replace(/^\uFEFF/u, "")
    .trim();
  const lines = normalizedAnswer.split(/\r?\n/u);
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstContentIndex === -1) {
    return {
      pass: false,
      reasons: ["EMPTY_ANSWER"],
      expectedIds: categoryDefinitions.map(({ id }) => id),
      observedIds: [],
      rowCount: 0,
      columnCounts: [],
    };
  }

  const headerCells = splitMarkdownRow(lines[firstContentIndex]);
  if (!headerCells) reasons.push("INTRO_OR_MISSING_TABLE_HEADER");
  else if (
    headerCells.length !== expectedHeaders.length ||
    headerCells.some((cell, index) => cell !== expectedHeaders[index])
  )
    reasons.push("INVALID_TABLE_HEADER");

  const separatorCells = splitMarkdownRow(lines[firstContentIndex + 1]);
  if (
    !isSeparatorRow(separatorCells) ||
    separatorCells.length !== expectedHeaders.length
  )
    reasons.push("INVALID_TABLE_SEPARATOR");

  const dataRows = [];
  let lineIndex = firstContentIndex + 2;
  while (lineIndex < lines.length) {
    const cells = splitMarkdownRow(lines[lineIndex]);
    if (!cells) break;
    dataRows.push({ lineNumber: lineIndex + 1, cells });
    lineIndex += 1;
  }

  const expectedIds = categoryDefinitions.map(({ id }) => id);
  const observedIds = dataRows.map(({ cells }) => stripCodeTicks(cells[0]));
  const columnCounts = dataRows.map(({ cells }) => cells.length);

  if (dataRows.length !== categoryDefinitions.length)
    reasons.push(`ROW_COUNT:${dataRows.length}/${categoryDefinitions.length}`);
  if (columnCounts.some((count) => count !== expectedHeaders.length))
    reasons.push("INVALID_COLUMN_COUNT");
  if (new Set(observedIds).size !== observedIds.length)
    reasons.push("DUPLICATE_CATEGORY_ID");
  if (
    observedIds.length !== expectedIds.length ||
    observedIds.some((id, index) => id !== expectedIds[index])
  )
    reasons.push("CATEGORY_ID_ORDER_OR_COMPLETENESS");

  dataRows.forEach(({ cells }, index) => {
    if (cells.length < expectedHeaders.length - 1) return;
    const definition = categoryDefinitions[index];
    const [id, stage, label, content, coverage, amount, source, status] =
      cells.map(stripCodeTicks);

    if (!definition || id !== definition.id) return;
    if (stage !== definition.stage) reasons.push(`STAGE_MISMATCH:${id}`);
    if (label !== definition.label) reasons.push(`LABEL_MISMATCH:${id}`);
    if (!ALLOWED_COVERAGE.has(coverage)) reasons.push(`INVALID_COVERAGE:${id}`);
    if (!ALLOWED_STATUS.has(status)) reasons.push(`INVALID_STATUS:${id}`);
    if (!ALLOWED_STATUS_COVERAGE.has(`${status}|${coverage}`))
      reasons.push(`INVALID_STATUS_COVERAGE:${id}`);

    if (status === "UNGEKLÄRT") {
      if (content !== MISSING_EVIDENCE)
        reasons.push(`INVALID_MISSING_CONTENT:${id}`);
      if (amount !== "Nicht feststellbar")
        reasons.push(`INVALID_MISSING_AMOUNT:${id}`);
      if (source !== MISSING_EVIDENCE)
        reasons.push(`INVALID_MISSING_SOURCE:${id}`);
    } else {
      const citations = parseSourceCitations(source);
      if (citations.length === 0) reasons.push(`INVALID_SOURCE_FORMAT:${id}`);
      else if (sourceDocuments.length > 0) {
        for (const { pageNumber, quote } of citations) {
          const normalizedQuote = normalizeWhitespace(quote);
          const quoteIsOnPage = sourceDocuments.some(
            (candidate) =>
              Number(candidate.pageNumber) === pageNumber &&
              normalizeWhitespace(candidate.text).includes(normalizedQuote)
          );
          if (!quoteIsOnPage)
            reasons.push(`QUOTE_NOT_FOUND_ON_PAGE:${id}:${pageNumber}`);
        }
      }
    }
  });

  const trailingText = lines.slice(lineIndex).join("\n").trim();
  if (!requiredNotice) reasons.push("SYSTEM_PROMPT_NOTICE_NOT_FOUND");
  else if (stripOuterQuotes(trailingText) !== stripOuterQuotes(requiredNotice))
    reasons.push("INVALID_OR_EXTRA_TRAILING_NOTICE");

  return {
    pass: reasons.length === 0,
    reasons: [...new Set(reasons)],
    expectedIds,
    observedIds,
    rowCount: dataRows.length,
    columnCounts,
  };
}

module.exports = {
  DEFAULT_EXPECTED_HEADERS,
  MISSING_EVIDENCE,
  extractCategoryDefinitions,
  extractRequiredNotice,
  parseSourceCitations,
  splitMarkdownRow,
  validateCategoryOutput,
};
