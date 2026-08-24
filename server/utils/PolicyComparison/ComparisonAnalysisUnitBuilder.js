const crypto = require("crypto");

const DEFAULT_UNIT_CHARACTER_LIMIT = 2_400;
const MIN_UNIT_CHARACTER_LIMIT = 512;
const DEFAULT_CONTEXT_CHARACTER_LIMIT = 240;
const STRUCTURE_VERSION = 1;

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sourceHash(documentData = {}) {
  const value = String(
    documentData?.pdfExtraction?.sourceSha256 ||
      documentData?.documentExtraction?.sourceSha256 ||
      ""
  ).toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(value))
    throw new Error("Canonical document extraction must be source-hashed.");
  return value;
}

function canonicalPageRanges(documentData = {}) {
  const pageContent = String(documentData.pageContent || "");
  if (!pageContent && documentData?.documentExtraction?.complete !== true)
    throw new Error("Canonical document text is empty.");
  const pdf = documentData.pdfExtraction;
  if (pdf) {
    if (pdf.complete !== true || !Array.isArray(pdf.pages))
      throw new Error("Canonical PDF extraction must be complete.");
    if (pdf.totalPages !== pdf.pages.length)
      throw new Error("Canonical PDF page count does not match its page map.");
    return pdf.pages.map((page, index) => {
      const start = Number(page.start);
      const end = Number(page.end);
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end < start ||
        end > pageContent.length
      )
        throw new Error(`Canonical page ${index + 1} has invalid offsets.`);
      if (Number(page.pageNumber) !== index + 1)
        throw new Error("Canonical physical page numbers must be contiguous.");
      if (index > 0 && start < Number(pdf.pages[index - 1].end))
        throw new Error("Canonical PDF page offsets must not overlap.");
      return {
        pageNumber: index + 1,
        sourceStart: start,
        sourceEnd: end,
        sourceMethod: page.method || page.extractionMethod || "native",
        layoutQuality: page.layoutQuality || "text_only",
        layout: page.layout || null,
        text: pageContent.slice(start, end),
      };
    });
  }
  if (documentData?.documentExtraction?.complete !== true)
    throw new Error("Canonical document extraction must be complete.");
  return [
    {
      pageNumber: null,
      sourceStart: 0,
      sourceEnd: pageContent.length,
      sourceMethod: documentData.documentExtraction.method || "document",
      layoutQuality: "text_only",
      layout: null,
      text: pageContent,
    },
  ];
}

function structureKind(text) {
  const value = String(text).trim();
  if (!value) return "technical_empty";
  if (/^(?:[-*•‣▪]|\d+[.)]|[a-z][.)])\s+/iu.test(value)) return "list_item";
  if (/\t/u.test(value) || /\S\s{2,}\S/u.test(value)) return "table_row";
  const words = value.split(/\s+/u).filter(Boolean);
  if (
    /^(?:\d+(?:\.\d+){0,5}[.)]?\s+|ART(?:IKEL)?\s+|ABSCHNITT\s+|TEIL\s+|KLAUSEL\s+)/iu.test(
      value
    ) ||
    (words.length <= 12 && value.length <= 140 && /:$/u.test(value)) ||
    (words.length >= 2 && words.length <= 10 && value === value.toUpperCase())
  )
    return "heading";
  return "paragraph";
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.floor(sorted.length / 2)];
}

function layoutStructureKind(text, spans, allSpans) {
  const lexical = structureKind(text);
  if (!spans.length) return lexical;
  const bodyHeight = median(allSpans.map((span) => Number(span.height)));
  const blockHeight = median(spans.map((span) => Number(span.height)));
  const boldRatio =
    spans.filter((span) => span.boldHint === true).length / spans.length;
  if (
    lexical === "paragraph" &&
    (boldRatio >= 0.6 ||
      (bodyHeight && blockHeight && blockHeight >= bodyHeight * 1.2))
  )
    return "heading";
  if (lexical === "paragraph" && spans.length >= 2) {
    const rows = [];
    for (const span of [...spans].sort(
      (a, b) => Number(a.y) - Number(b.y) || Number(a.x) - Number(b.x)
    )) {
      const tolerance = Math.max(2, Number(span.height || 0) * 0.45);
      const row = rows.find(
        (candidate) => Math.abs(candidate.y - Number(span.y)) <= tolerance
      );
      if (row) row.spans.push(span);
      else rows.push({ y: Number(span.y), spans: [span] });
    }
    const hasColumnGap = rows.some((row) => {
      const ordered = row.spans.sort((a, b) => Number(a.x) - Number(b.x));
      return ordered.slice(1).some((span, index) => {
        const previous = ordered[index];
        if (!Number.isFinite(span.x) || !Number.isFinite(previous.x))
          return false;
        const previousEnd = previous.x + Number(previous.width || 0);
        return (
          span.x - previousEnd > Math.max(12, Number(span.height || 0) * 1.5)
        );
      });
    });
    if (hasColumnGap) return "table_row";
  }
  return lexical;
}

function headingLevel(text) {
  const numbered = String(text)
    .trim()
    .match(/^(\d+(?:\.\d+){0,5})[.)]?\s+/u);
  return numbered ? numbered[1].split(".").length : 1;
}

function lineRanges(text) {
  if (!text.length) return [[0, 0]];
  const lines = [];
  const pattern = /.*(?:\n|$)/gu;
  let match;
  while ((match = pattern.exec(text))) {
    if (!match[0]) break;
    lines.push([match.index, match.index + match[0].length]);
  }
  return lines;
}

function structuralRanges(text, allSpans = []) {
  const ranges = [];
  let paragraph = null;
  const flush = () => {
    if (!paragraph) return;
    ranges.push(paragraph);
    paragraph = null;
  };
  for (const [start, end] of lineRanges(text)) {
    const spans = allSpans.filter(
      (span) => span.charEnd > start && span.charStart < end
    );
    const kind = layoutStructureKind(text.slice(start, end), spans, allSpans);
    if (kind === "paragraph") {
      paragraph = paragraph ? [paragraph[0], end] : [start, end];
      continue;
    }
    if (kind === "technical_empty") {
      if (paragraph) paragraph[1] = end;
      else if (ranges.length) ranges[ranges.length - 1][1] = end;
      else ranges.push([start, end]);
      flush();
      continue;
    }
    flush();
    ranges.push([start, end]);
  }
  flush();
  if (!ranges.length) ranges.push([0, text.length]);
  return ranges;
}

function nextBoundary(text, start, limit, hardLimit) {
  const hardEnd = Math.min(hardLimit, start + limit);
  if (hardEnd >= hardLimit) return hardLimit;
  const minimum = start + Math.floor(limit * 0.55);
  const window = text.slice(minimum, hardEnd);
  for (const pattern of [/\n\s*\n/gu, /\n/gu, /[.!?;:]\s+/gu]) {
    let match;
    let boundary = -1;
    while ((match = pattern.exec(window)))
      boundary = match.index + match[0].length;
    if (boundary > 0) return minimum + boundary;
  }
  return hardEnd;
}

function boundedRanges(text, characterLimit, allSpans = []) {
  const result = [];
  for (const [rangeStart, rangeEnd] of structuralRanges(text, allSpans)) {
    if (rangeEnd - rangeStart <= characterLimit) {
      result.push([rangeStart, rangeEnd]);
      continue;
    }
    for (let start = rangeStart; start < rangeEnd; ) {
      const end = nextBoundary(text, start, characterLimit, rangeEnd);
      result.push([start, end]);
      start = end;
    }
  }
  return result;
}

function pageBlocks(page, { sourceSha256, characterLimit }) {
  const headingPath = [];
  const allSpans = Array.isArray(page.layout?.spans) ? page.layout.spans : [];
  return boundedRanges(page.text, characterLimit, allSpans).map(
    ([pageStart, pageEnd], part) => {
      const text = page.text.slice(pageStart, pageEnd);
      const spans = allSpans.filter(
        (span) => span.charEnd > pageStart && span.charStart < pageEnd
      );
      const kind = layoutStructureKind(text, spans, allSpans);
      if (kind === "heading") {
        const level = headingLevel(text);
        // PDF extracts can begin with a subsection such as "1.1" or jump
        // directly from level 1 to level 3. Keep the available hierarchy
        // dense instead of creating sparse `undefined` entries, which are not
        // valid persisted inventory JSON values.
        const pathIndex = Math.min(level - 1, headingPath.length);
        headingPath.splice(pathIndex);
        headingPath[pathIndex] = text.trim();
      }
      const textHash = sha256(text);
      const sourceStart = page.sourceStart + pageStart;
      const sourceEnd = page.sourceStart + pageEnd;
      const blockKey = sha256(
        [
          sourceSha256,
          STRUCTURE_VERSION,
          page.pageNumber ?? "document",
          sourceStart,
          sourceEnd,
          textHash,
        ].join("\u0000")
      );
      return {
        blockKey,
        unitKey: blockKey,
        pageNumber: page.pageNumber,
        part: part + 1,
        pageStart,
        pageEnd,
        sourceStart,
        sourceEnd,
        text,
        textHash,
        sourceMethod: page.sourceMethod,
        structureKind: kind,
        headingPath: [...headingPath],
        layoutQuality: page.layoutQuality,
      };
    }
  );
}

function assertCompleteCoverage(pages, units) {
  for (const page of pages) {
    const pageUnits = units
      .filter((unit) => unit.pageNumber === page.pageNumber)
      .sort((left, right) => left.pageStart - right.pageStart);
    if (!pageUnits.length) throw new Error("A canonical page has no block.");
    let cursor = 0;
    for (const unit of pageUnits) {
      if (unit.pageStart !== cursor)
        throw new Error("Clause blocks have a gap or overlap.");
      cursor = unit.pageEnd;
    }
    if (cursor !== page.text.length)
      throw new Error("Clause blocks do not cover the complete page.");
  }
  return true;
}

const ComparisonClauseBlockBuilder = {
  build({
    documentData = {},
    characterLimit = DEFAULT_UNIT_CHARACTER_LIMIT,
  } = {}) {
    if (
      !Number.isInteger(characterLimit) ||
      characterLimit < MIN_UNIT_CHARACTER_LIMIT
    )
      throw new Error(
        `characterLimit must be an integer of at least ${MIN_UNIT_CHARACTER_LIMIT}.`
      );
    const canonicalSourceSha256 = sourceHash(documentData);
    const pages = canonicalPageRanges(documentData);
    const units = pages
      .flatMap((page) =>
        pageBlocks(page, {
          sourceSha256: canonicalSourceSha256,
          characterLimit,
        })
      )
      .map((unit, ordinal) => ({ ...unit, ordinal }));
    for (const [index, unit] of units.entries()) {
      const previous = units[index - 1];
      const next = units[index + 1];
      unit.contextBefore =
        previous?.pageNumber === unit.pageNumber
          ? previous.text.slice(-DEFAULT_CONTEXT_CHARACTER_LIMIT)
          : "";
      unit.contextAfter =
        next?.pageNumber === unit.pageNumber
          ? next.text.slice(0, DEFAULT_CONTEXT_CHARACTER_LIMIT)
          : "";
    }
    assertCompleteCoverage(pages, units);
    return {
      sourceSha256: canonicalSourceSha256,
      pageCount: pages.length,
      pages,
      units,
    };
  },
  assertCompleteCoverage,
};

module.exports = {
  ComparisonAnalysisUnitBuilder: ComparisonClauseBlockBuilder,
  ComparisonClauseBlockBuilder,
  DEFAULT_UNIT_CHARACTER_LIMIT,
  MIN_UNIT_CHARACTER_LIMIT,
  STRUCTURE_VERSION,
  DEFAULT_CONTEXT_CHARACTER_LIMIT,
  structureKind,
};
