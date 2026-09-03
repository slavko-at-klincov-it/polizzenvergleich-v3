const crypto = require("crypto");
const {
  semanticCoverageHeadingPolarity,
} = require("./semanticCoverageGovernor");
const {
  assertCoverageOnlyCertification,
} = require("./coverageOnlyCertificationContract");
const coverageOnlyCertificationRegistry = require("../../resources/policyAnalysis/coverage-only-certifications.v0.1.json");

const WORKSHEET_SCHEMA_VERSION = 2;
const DEFAULT_CONTEXT_MAX_CHARS = 1_600;
const DEFAULT_CLAUSE_SECTION_MAX_CHARS = 6_000;
const DEFAULT_FALLBACK_WORDS_EACH_SIDE = 120;
const DEFAULT_SCOPE_WORDS_BEFORE = 120;
const DEFAULT_CONCEPT_SEARCH_MAX_LINES = 3;
const DEFAULT_CONCEPT_SEARCH_MAX_CHARS = 900;
const SHARED_GOVERNOR = "SHARED_GOVERNOR";
const SHARED_SPAN = "SHARED_SPAN";
const RIGHT_HEADED_COORDINATION = "RIGHT_HEADED_COORDINATION";
const SAME_CANDIDATE_BINDING = "SAME_CANDIDATE_BINDING";
const OBJECT_CLASSIFICATION_CONTEXT_CONTRACT =
  "CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1";
const FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID =
  "FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_V1";
const EXACT_CLAUSE_CODE_FIELD_GOVERNOR_POLICY =
  "SAME_DOCUMENT_EXACT_CLAUSE_CODE_V1";
const EXACT_CLAUSE_CODE_FIELD_GOVERNOR_CONTRACT_ID =
  "SAME_DOCUMENT_EXACT_CLAUSE_CODE_FIELD_GOVERNOR_V1";
const MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE = 4_096;
const FOLLOWING_STRUCTURAL_BOUNDARY_KIND = Object.freeze({
  LIST_ITEM: "LIST_ITEM",
  PARAGRAPH: "PARAGRAPH",
  SECTION_HEADING: "SECTION_HEADING",
  COVERAGE_GOVERNOR: "COVERAGE_GOVERNOR",
  CLAUSE_HEADING: "CLAUSE_HEADING",
  EOF: "EOF",
  TOO_DISTANT: "TOO_DISTANT",
});
const ALLOWED_FOLLOWING_STRUCTURAL_BOUNDARY_KINDS = new Set(
  Object.values(FOLLOWING_STRUCTURAL_BOUNDARY_KIND)
);
const ALLOWED_SCOPE_POLICIES = new Set([
  "GENERAL_REQUIRED",
  "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
  "MATCHING_SCOPE_DEFINITIVE_SUFFICIENT",
]);
const ALLOWED_COMPONENT_SATISFACTION_POLICIES = new Set(["ALL", "ANY"]);
const DIRECTED_OBJECT_FAMILY_CONTRACT_ID = "DIRECTED_OBJECT_FAMILY_V1";
const COVERAGE_PRESENCE_ONLY = "COVERAGE_PRESENCE_ONLY";
const ALLOWED_ABSENCE_COMPARISON_POLICIES = new Set([
  "ASSUME_NOT_INCLUDED_AFTER_COMPLETE_ZERO_OCCURRENCE_V1",
]);
const ALLOWED_NEGATIVE_SEARCH_POLICIES = new Set([
  "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
  "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1",
]);
const ALLOWED_ABSENCE_MEANINGS = new Set([
  "COVERAGE_ONLY",
  "COVERAGE_MIXED",
  "COST_COVERAGE",
  "EXCLUSION",
  "VALUE_TERM",
  "CONDITION_ONLY",
  "DEFINITION_ONLY",
  "DOCUMENT_REFERENCE",
]);
const ALLOWED_COVERAGE_AGGREGATION_POLICIES = new Set([
  "ALL_COMPONENT_EFFECTS",
  "COVERAGE_ROLES_ONLY",
]);
const ALLOWED_FACT_ROLES = new Set([
  "INSURED_OBJECT",
  "COST",
  "BENEFIT",
  "PERIL",
  "DEFINITION",
  "DAMAGE",
  "EXCLUSION",
  "LIMIT",
  "DEDUCTIBLE",
  "CONDITION",
  "DOCUMENT_STATUS",
]);
const CONTEXT_MODE = Object.freeze({
  STRUCTURAL: "STRUCTURAL",
  CLAUSE_SECTION: "CLAUSE_SECTION",
});
const ALLOWED_CONTEXT_MODES = new Set(Object.values(CONTEXT_MODE));

function worksheetError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function requireNonEmptyString(value, code, detail) {
  if (typeof value !== "string" || value.trim().length === 0)
    throw worksheetError(code, detail);
  return value.trim();
}

function transliterateCharacter(character) {
  const lower = character.normalize("NFKC").toLocaleLowerCase("de");
  if (lower === "ä") return "ae";
  if (lower === "ö") return "oe";
  if (lower === "ü") return "ue";
  if (lower === "ß") return "ss";
  return lower;
}

function hyphenatedLineBreakTarget(text, hyphenIndex) {
  if (text[hyphenIndex] !== "-") return null;
  const previous = text[hyphenIndex - 1] || "";
  if (!/\p{L}/u.test(previous)) return null;

  let cursor = hyphenIndex + 1;
  let includesLineBreak = false;
  while (cursor < text.length && /\s/u.test(text[cursor])) {
    if (text[cursor] === "\n" || text[cursor] === "\r")
      includesLineBreak = true;
    cursor += 1;
  }
  if (!includesLineBreak || !/\p{L}/u.test(text[cursor] || "")) return null;

  const followingWord = String(text.slice(cursor).match(/^\p{L}+/u)?.[0] || "")
    .toLocaleLowerCase("de")
    .trim();
  if (["und", "oder"].includes(followingWord)) return null;
  return cursor;
}

/**
 * Normalizes controlled search text while retaining an index for every output
 * character back to the original string. Side effects: none. Role: transform.
 */
function normalizeWithOffsetMap(value) {
  const text = String(value || "");
  const characters = [];
  const originalOffsets = [];

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\u00ad") continue;

    const joinedAt = hyphenatedLineBreakTarget(text, index);
    if (joinedAt !== null) {
      index = joinedAt - 1;
      continue;
    }

    if (!/[\p{L}\p{N}]/u.test(character)) {
      if (characters.length > 0 && characters.at(-1) !== " ") {
        characters.push(" ");
        originalOffsets.push(index);
      }
      continue;
    }

    for (const normalizedCharacter of transliterateCharacter(character)) {
      characters.push(normalizedCharacter);
      originalOffsets.push(index);
    }
  }

  while (characters[0] === " ") {
    characters.shift();
    originalOffsets.shift();
  }
  while (characters.at(-1) === " ") {
    characters.pop();
    originalOffsets.pop();
  }

  return {
    normalized: characters.join(""),
    originalOffsets,
  };
}

function isWordCharacter(character) {
  return Boolean(character && /[\p{L}\p{N}]/u.test(character));
}

function startsWithConcatenatedClauseCode(value) {
  return /^\d{2}\p{L}{2}\d{4}/u.test(String(value || ""));
}

function startsWithConcatenatedCurrencyValue(value) {
  return /^EUR\s*\d/iu.test(String(value || ""));
}

function findAliasRanges(pageText, alias) {
  const page = normalizeWithOffsetMap(pageText);
  const normalizedAlias = normalizeWithOffsetMap(alias).normalized;
  if (!normalizedAlias)
    throw worksheetError("EMPTY_NORMALIZED_ALIAS", String(alias));

  const ranges = [];
  let normalizedStart = page.normalized.indexOf(normalizedAlias);
  while (normalizedStart !== -1) {
    const normalizedEnd = normalizedStart + normalizedAlias.length;
    const before = page.normalized[normalizedStart - 1] || "";
    const after = page.normalized[normalizedEnd] || "";
    if (
      !isWordCharacter(before) &&
      (!isWordCharacter(after) ||
        startsWithConcatenatedClauseCode(
          page.normalized.slice(normalizedEnd)
        ) ||
        startsWithConcatenatedCurrencyValue(
          page.normalized.slice(normalizedEnd)
        ))
    ) {
      const originalStart = page.originalOffsets[normalizedStart];
      let originalEnd = page.originalOffsets[normalizedEnd - 1] + 1;
      const trimmedAlias = String(alias).trim();
      if (
        /[^\p{L}\p{N}]$/u.test(trimmedAlias) &&
        originalEnd < String(pageText).length &&
        /[^\p{L}\p{N}\s]/u.test(String(pageText)[originalEnd])
      )
        originalEnd += 1;
      ranges.push({
        originalStart,
        originalEnd,
        normalizedAlias,
      });
    }
    normalizedStart = page.normalized.indexOf(
      normalizedAlias,
      normalizedStart + 1
    );
  }
  return ranges;
}

function normalizedWordRecords(text) {
  return [...String(text || "").matchAll(/[\p{L}\p{N}]+/gu)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    normalized: normalizeWithOffsetMap(match[0]).normalized,
  }));
}

function conceptGroupsMatch(text, groups) {
  const words = normalizedWordRecords(text);
  const matchingIndexes = groups.map((group) =>
    words
      .map(({ normalized }, index) =>
        group.prefixes.some((prefix) => normalized.startsWith(prefix))
          ? index
          : -1
      )
      .filter((index) => index !== -1)
  );
  if (matchingIndexes.some((indexes) => indexes.length === 0)) return false;

  // Separate semantic atoms must be evidenced by separate source words. This
  // prevents one compound such as "Rohrbruch" from proving both the damage
  // and a distinct insured-pipe/object group merely because both start with
  // "Rohr".
  const assign = (groupIndex, usedWordIndexes) => {
    if (groupIndex === matchingIndexes.length) return true;
    return matchingIndexes[groupIndex].some((wordIndex) => {
      if (usedWordIndexes.has(wordIndex)) return false;
      const next = new Set(usedWordIndexes);
      next.add(wordIndex);
      return assign(groupIndex + 1, next);
    });
  };
  return assign(0, new Set());
}

function nonBlankLineRanges(text) {
  const ranges = [];
  let start = 0;
  let group = 0;
  while (start <= text.length) {
    const newline = text.indexOf("\n", start);
    const rawEnd = newline === -1 ? text.length : newline;
    const end =
      rawEnd > start && text[rawEnd - 1] === "\r" ? rawEnd - 1 : rawEnd;
    if (text.slice(start, end).trim()) ranges.push({ start, end, group });
    else group += 1;
    if (newline === -1) break;
    start = newline + 1;
  }
  return ranges;
}

function clauseRanges(text) {
  const ranges = [];
  const separator = /(?:[.!?;](?=\s|$)|\s+-\s+|[\t ]{2,})/gu;
  for (const [group, line] of nonBlankLineRanges(text).entries()) {
    const lineText = text.slice(line.start, line.end);
    let start = 0;
    for (const match of lineText.matchAll(separator)) {
      const end = /[.!?;]/u.test(match[0][0]) ? match.index + 1 : match.index;
      if (lineText.slice(start, end).trim())
        ranges.push({
          start: line.start + start,
          end: line.start + end,
          group,
        });
      start = match.index + match[0].length;
    }
    if (lineText.slice(start).trim())
      ranges.push({ start: line.start + start, end: line.end, group });
  }
  return ranges;
}

function boundedLogicalUnits(text, maxLines, maxChars) {
  const units = [];
  const addWindows = (ranges) => {
    for (let index = 0; index < ranges.length; index += 1) {
      for (let count = 1; count <= maxLines; count += 1) {
        const first = ranges[index];
        const last = ranges[index + count - 1];
        if (
          !last ||
          last.group !== first.group ||
          last.end - first.start > maxChars
        )
          break;
        units.push({ originalStart: first.start, originalEnd: last.end });
      }
    }
  };
  addWindows(nonBlankLineRanges(text));
  // Clause windows are additive because some PDF parsers flatten a complete
  // page or table into one physical line.
  addWindows(clauseRanges(text));
  return units;
}

/**
 * Finds candidate-only spans whose bounded logical unit contains every
 * declared concept group. Prefixes match complete normalized word starts;
 * they never loosen the global exact-alias word-boundary contract.
 */
function findConceptSearchRanges(pageText, search) {
  const matches = boundedLogicalUnits(
    pageText,
    search.maxLines,
    search.maxChars
  )
    .filter(({ originalStart, originalEnd }) => {
      const unit = pageText.slice(originalStart, originalEnd);
      return conceptGroupsMatch(unit, search.requiredGroups);
    })
    .sort(
      (left, right) =>
        left.originalEnd -
          left.originalStart -
          (right.originalEnd - right.originalStart) ||
        left.originalStart - right.originalStart
    );

  const selected = [];
  for (const match of matches) {
    if (
      selected.some(
        (existing) =>
          existing.originalStart >= match.originalStart &&
          existing.originalEnd <= match.originalEnd
      )
    )
      continue;
    selected.push(match);
  }
  return selected.sort(
    (left, right) => left.originalStart - right.originalStart
  );
}

function buildLineRecords(text) {
  const records = [];
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf("\n", start);
    const rawEnd = newline === -1 ? text.length : newline;
    const end =
      rawEnd > start && text[rawEnd - 1] === "\r" ? rawEnd - 1 : rawEnd;
    records.push({ start, end, text: text.slice(start, end) });
    if (newline === -1) break;
    start = newline + 1;
  }
  if (records.length === 0) records.push({ start: 0, end: 0, text: "" });
  return records;
}

function isBlankLine(line) {
  return line.text.trim().length === 0;
}

function bulletLineMetadata(line) {
  const match = String(line?.text || "").match(
    /^([\t ]*)([-•·])(?:\s+|(?=\p{L}))/u
  );
  return match ? { indentation: match[1], marker: match[2] } : null;
}

function isBulletLine(line) {
  return bulletLineMetadata(line) !== null;
}

function centeredWordWindow(text, occurrenceStart, occurrenceEnd, wordRadius) {
  const words = [...text.matchAll(/\S+/gu)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  const occurrenceWordIndex = words.findIndex(
    ({ start, end }) => occurrenceStart < end && occurrenceEnd > start
  );
  if (occurrenceWordIndex === -1)
    return { start: occurrenceStart, end: occurrenceEnd };
  const startWord = words[Math.max(0, occurrenceWordIndex - wordRadius)];
  const endWord =
    words[Math.min(words.length - 1, occurrenceWordIndex + wordRadius)];
  return { start: startWord.start, end: endWord.end };
}

function precedingWordWindow(text, beforeOffset, wordLimit) {
  const words = [...text.slice(0, beforeOffset).matchAll(/\S+/gu)].map(
    (match) => ({
      start: match.index,
      end: match.index + match[0].length,
    })
  );
  if (words.length === 0)
    return { pageStart: beforeOffset, pageEnd: beforeOffset, text: "" };
  const startWord = words[Math.max(0, words.length - wordLimit)];
  let pageEnd = beforeOffset;
  while (pageEnd > startWord.start && /\s/u.test(text[pageEnd - 1]))
    pageEnd -= 1;
  if (
    pageEnd > startWord.start &&
    /[-•·]/u.test(text[pageEnd - 1]) &&
    (pageEnd - 1 === 0 || /[\n\r]/u.test(text[pageEnd - 2]))
  ) {
    pageEnd -= 1;
    while (pageEnd > startWord.start && /\s/u.test(text[pageEnd - 1]))
      pageEnd -= 1;
  }
  return {
    pageStart: startWord.start,
    pageEnd,
    text: text.slice(startWord.start, pageEnd),
  };
}

function precedingListGovernorWindow(text, listItemStart, fallback, floor) {
  const lines = buildLineRecords(text);
  const listItemLineIndex = lines.findIndex(
    ({ start, end }) => listItemStart >= start && listItemStart <= end
  );
  const currentBullet = bulletLineMetadata(lines[listItemLineIndex]);
  if (listItemLineIndex === -1 || !currentBullet) return fallback;

  let firstSiblingIndex = listItemLineIndex;
  for (let index = listItemLineIndex - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (isBlankLine(line) || line.end <= floor.pageEnd) break;
    const bullet = bulletLineMetadata(line);
    if (!bullet) continue;
    if (
      bullet.indentation === currentBullet.indentation &&
      bullet.marker === currentBullet.marker
    ) {
      firstSiblingIndex = index;
      continue;
    }
    if (
      bullet.indentation.length > currentBullet.indentation.length &&
      bullet.indentation.startsWith(currentBullet.indentation)
    )
      continue;
    break;
  }

  let pageEnd = Math.min(fallback.pageEnd, lines[firstSiblingIndex].start);
  const minimumPageStart = Math.max(fallback.pageStart, floor.pageStart);
  while (pageEnd > minimumPageStart && /\s/u.test(text[pageEnd - 1]))
    pageEnd -= 1;
  const pageStart = Math.min(minimumPageStart, pageEnd);
  return {
    pageStart,
    pageEnd,
    text: text.slice(pageStart, pageEnd),
  };
}

function structuralContext({
  pageText,
  occurrenceStart,
  occurrenceEnd,
  maxChars,
  fallbackWordsEachSide,
  followingBoundaryLineStarts = new Set(),
}) {
  const lines = buildLineRecords(pageText);
  const occurrenceLineIndex = lines.findIndex(
    ({ start, end }) => occurrenceStart >= start && occurrenceStart <= end
  );
  if (occurrenceLineIndex === -1)
    throw worksheetError("OCCURRENCE_LINE_NOT_FOUND", String(occurrenceStart));

  let startLine = occurrenceLineIndex;
  let unitType = "PARAGRAPH";
  for (let index = occurrenceLineIndex; index >= 0; index -= 1) {
    if (isBulletLine(lines[index])) {
      startLine = index;
      unitType = "LIST_ITEM";
      break;
    }
    if (index < occurrenceLineIndex && isClauseSectionHeading(lines[index])) {
      startLine = index;
      break;
    }
    if (index < occurrenceLineIndex && isBlankLine(lines[index])) break;
    startLine = index;
  }

  let endLine = occurrenceLineIndex;
  for (let index = occurrenceLineIndex + 1; index < lines.length; index += 1) {
    if (
      isBlankLine(lines[index]) ||
      isBulletLine(lines[index]) ||
      isClauseSectionHeading(lines[index]) ||
      followingBoundaryLineStarts.has(lines[index].start)
    )
      break;
    endLine = index;
  }

  let contextStart = lines[startLine].start;
  let contextEnd = lines[endLine].end;
  if (contextEnd - contextStart > maxChars) {
    const fallback = centeredWordWindow(
      pageText,
      occurrenceStart,
      occurrenceEnd,
      fallbackWordsEachSide
    );
    contextStart = fallback.start;
    contextEnd = fallback.end;
    unitType = "WORD_WINDOW_FALLBACK";
  }

  return {
    unitType,
    pageStart: contextStart,
    pageEnd: contextEnd,
    text: pageText.slice(contextStart, contextEnd),
  };
}

function isClauseSectionHeading(line) {
  if (isBulletLine(line)) return false;
  const text = String(line?.text || "");
  return (
    /^\s*\d{1,3}\.\s+\p{L}/u.test(text) ||
    /^\s*\S[\s\S]*?\d{2}\p{Lu}{2}\d{4}\s*$/u.test(text)
  );
}

function trimContextRange(text, start, end) {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && /\s/u.test(text[trimmedStart]))
    trimmedStart += 1;
  while (trimmedEnd > trimmedStart && /\s/u.test(text[trimmedEnd - 1]))
    trimmedEnd -= 1;
  return { start: trimmedStart, end: trimmedEnd };
}

/**
 * Expands a direct occurrence to its enclosing numbered or clause-coded
 * section. This mirrors a human reading the complete clause until the next
 * heading, while retaining exact source offsets. If no controlled heading is
 * present or the section is unexpectedly large, it fails back to the smaller
 * structural context.
 */
function clauseSectionContext({
  pageText,
  occurrenceStart,
  occurrenceEnd,
  fallback,
  maxChars = DEFAULT_CLAUSE_SECTION_MAX_CHARS,
}) {
  const lines = buildLineRecords(pageText);
  const occurrenceLineIndex = lines.findIndex(
    ({ start, end }) => occurrenceStart >= start && occurrenceStart <= end
  );
  if (occurrenceLineIndex === -1) return fallback;

  let headingLineIndex = -1;
  for (let index = occurrenceLineIndex; index >= 0; index -= 1) {
    if (!isClauseSectionHeading(lines[index])) continue;
    headingLineIndex = index;
    break;
  }
  if (headingLineIndex === -1) return fallback;

  let nextHeadingLineIndex = lines.length;
  for (let index = headingLineIndex + 1; index < lines.length; index += 1) {
    if (!isClauseSectionHeading(lines[index])) continue;
    nextHeadingLineIndex = index;
    break;
  }
  const range = trimContextRange(
    pageText,
    lines[headingLineIndex].start,
    nextHeadingLineIndex < lines.length
      ? lines[nextHeadingLineIndex].start
      : pageText.length
  );
  if (
    occurrenceStart < range.start ||
    occurrenceEnd > range.end ||
    range.end - range.start > maxChars
  )
    return fallback;
  return {
    unitType: CONTEXT_MODE.CLAUSE_SECTION,
    pageStart: range.start,
    pageEnd: range.end,
    text: pageText.slice(range.start, range.end),
  };
}

function explicitPageScopeHints(pageText) {
  const patterns = [
    /\bDie\s+(Feuer|Leitungswasser|Sturm|Glas)versicherung\b/giu,
    /\bAllgemeine\s+Bedingungen\s+f[üu]r\s+die\s+(Feuer|Leitungswasser|Sturm|Glas)versicherung\b/giu,
  ];
  const hints = [];
  for (const pattern of patterns) {
    for (const match of String(pageText || "").matchAll(pattern)) {
      const text = match[0];
      const scopeKey = `${match[1].toLocaleUpperCase("de")}_INSURANCE`;
      if (!hints.some((hint) => hint.scopeKey === scopeKey))
        hints.push({
          scopeKey,
          text,
          pageStart: match.index,
          pageEnd: match.index + text.length,
        });
    }
  }
  return hints;
}

function explicitSectionHeadings(pageText) {
  const canonicalScopeForHeading = (value) => {
    const normalized = normalizeWithOffsetMap(value).normalized.replace(
      /\s+/gu,
      ""
    );
    if (normalized.includes("leitungswasser"))
      return "LEITUNGSWASSER_INSURANCE";
    if (normalized.includes("feuer")) return "FEUER_INSURANCE";
    if (normalized.includes("sturm")) return "STURM_INSURANCE";
    if (normalized.includes("elementar") || normalized.includes("katastrophen"))
      return "ELEMENTAR_INSURANCE";
    if (normalized.includes("haftpflicht")) return "HAFTPFLICHT_INSURANCE";
    if (normalized.includes("wohnungseigentum"))
      return "WOHNUNGSEIGENTUM_INSURANCE";
    if (
      normalized.includes("allgemeinevertragsbestimmungen") ||
      normalized === "vertragsbestimmungen" ||
      normalized === "allgemeinerteil" ||
      normalized.includes("zusammenfassungspartenundpraemien")
    )
      return "GENERAL_CONTRACT_TERMS";
    if (
      normalized.includes("glaspauschal") ||
      normalized.includes("glasbruch") ||
      normalized === "glasversicherung"
    )
      return "GLASBRUCH_INSURANCE";
    return null;
  };
  const patterns = [
    /^\s*((?:Allgemeine\s+Bedingungen\s+für\s+die\s+)?Haftpflichtversicherung(?:\s+für\s+Wohngebäude)?)\s*$/gimu,
    /^\s*(B\d{1,2}\s+(?:Feuer|Sturm|Leitungswasser|Elementar|Haftpflicht|Glas)versicherung\s*\((?:FE|ST|LW|EL|HP|GL)\))\s*$/gimu,
    /^[\t ]*([\p{L}-]+(?:[\t ]+[\p{L}-]+)*)VERSICHERUNG[\t ]*$/gimu,
    /^\s*\d{1,3}\.\s+([\p{L}-]+(?:\s+[\p{L}-]+)*versicherung)\s*$/gimu,
    /^\s*((?:ALLGEMEINE\s+)?VERTRAGSBESTIMMUNGEN|WOHNUNGSEIGENTUM)\s*$/gmu,
    /^\s*\d{1,3}\.\s+((?:Allgemeine\s+)?Vertragsbestimmungen|Wohnungseigentum|Glasbruch|Ökoschutz)\s*$/gimu,
    /^\s*(?:B\.\s*)?(ALLGEMEINER\s+TEIL)\s*$/gimu,
    /^\s*(ZUSAMMENFASSUNG\s+SPARTE\(N\)\s+UND\s+PRÄMIE\(N\))\s*$/gimu,
  ];
  const headings = [];
  for (const pattern of patterns) {
    for (const match of String(pageText || "").matchAll(pattern)) {
      const text = match[0].trim();
      if (headings.some(({ pageStart }) => pageStart === match.index)) continue;
      headings.push({
        scopeKey: canonicalScopeForHeading(match[1]),
        text,
        pageStart: match.index,
        pageEnd: match.index + match[0].length,
      });
    }
  }
  return headings.sort((left, right) => left.pageStart - right.pageStart);
}

const CLAUSE_FAMILY_SCOPE_KEYS = Object.freeze({
  12: "FEUER_INSURANCE",
  41: "GLASBRUCH_INSURANCE",
  62: "LEITUNGSWASSER_INSURANCE",
  64: "STURM_INSURANCE",
  81: "HAFTPFLICHT_INSURANCE",
});

function clauseFamilyScopeKey(clauseCode) {
  return CLAUSE_FAMILY_SCOPE_KEYS[String(clauseCode || "").slice(0, 2)] || null;
}

// The proposal schedule activates special-condition codes inside explicit
// coverage chapters. Preserve that link so an appendix clause cannot later be
// treated as generally applicable merely because its text contains an alias.
function clauseActivationScopes(pages) {
  const scopesByClause = new Map();
  let inheritedSectionHeading = null;
  for (const page of pages) {
    const printed = printedPageIndex(page.printedPageLabel);
    if (printed?.current === 1) inheritedSectionHeading = null;
    for (const match of page.text.matchAll(
      /(?:Besondere\s+Bedingung\s*\n?\s*|\()\s*(\d{2}\p{Lu}{2}\d{4})\s*\)?/giu
    )) {
      const currentSectionHeading = page.sectionHeadings
        .filter(({ pageEnd, scopeKey }) => scopeKey && pageEnd <= match.index)
        .at(-1);
      const scopeKey =
        currentSectionHeading?.scopeKey || inheritedSectionHeading?.scopeKey;
      if (!scopeKey || !scopeKey.endsWith("_INSURANCE")) continue;
      const clauseCode = match[1].toLocaleUpperCase("de");
      if (!scopesByClause.has(clauseCode))
        scopesByClause.set(clauseCode, new Set());
      scopesByClause.get(clauseCode).add(scopeKey);
    }
    const lastScopedHeading = page.sectionHeadings
      .filter(({ scopeKey }) => scopeKey)
      .at(-1);
    if (lastScopedHeading) inheritedSectionHeading = lastScopedHeading;
  }
  return scopesByClause;
}

function positiveActivationGovernor(governor) {
  return (
    governor?.polarity === "POSITIVE" ||
    /^(?:Zus[aä]tzlich\s+)?(?:mit)?versichert\s+(?:sind|gelten)\b/iu.test(
      String(governor?.text || "").trim()
    )
  );
}

function exactClauseCodeFieldGovernors({
  pages,
  documentFingerprint,
  activationScopes,
}) {
  const governorsByClauseCode = new Map();
  const invalidClauseCodes = new Set();
  const codePattern =
    /(?:Besondere\s+Bedingung\s*\n?\s*|\()\s*(\d{2}\p{Lu}{2}\d{4})\s*\)?/giu;
  const moneyPattern =
    /(?<![\p{L}\p{N}])(?:EUR|€)\s*\d+(?:\.\d{3})*(?:,\d{2})?(?![\p{L}\p{N}])/giu;

  for (const page of pages) {
    for (const match of page.text.matchAll(codePattern)) {
      const matchedClauseCode = match[1].toLocaleUpperCase("de");
      const context = structuralContext({
        pageText: page.text,
        occurrenceStart: match.index,
        occurrenceEnd: match.index + match[0].length,
        maxChars: 2_000,
        fallbackWordsEachSide: DEFAULT_FALLBACK_WORDS_EACH_SIDE,
      });
      if (context.unitType !== "LIST_ITEM") continue;
      const codes = [...context.text.matchAll(codePattern)].map((candidate) =>
        candidate[1].toLocaleUpperCase("de")
      );
      const amounts = [...context.text.matchAll(moneyPattern)];
      if (
        codes.length !== 1 ||
        amounts.length !== 1 ||
        !/\b(?:auf\s+Erstes\s+Risiko|Versicherungssumme|H[oö]chstentsch[aä]digung|Limit|Sublimit)\b/iu.test(
          context.text
        ) ||
        /\b(?:kein(?:e[rsnm]?)?\s+Versicherungsschutz|nicht\s+(?:(?:mit)?versichert|gedeckt|eingeschlossen)|ausgeschlossen|ausgenommen|optional|wahlweise|gegen\s+(?:eine[nr]?\s+)?(?:Mehrpr[aä]mie|Mehrbeitrag|Pr[aä]mienzuschlag)|Selbstbehalt|Selbstbeteiligung|Eigenbehalt|Pr[aä]mie|entf[aä]llt|aufgehoben|ersetzt)\b/iu.test(
          context.text
        )
      ) {
        invalidClauseCodes.add(matchedClauseCode);
        continue;
      }

      const currentSectionHeading = page.sectionHeadings
        .filter(({ pageEnd, scopeKey }) => scopeKey && pageEnd <= match.index)
        .at(-1);
      const scopeKey =
        currentSectionHeading?.scopeKey ||
        page.inheritedSectionHeading?.scopeKey;
      if (!scopeKey?.endsWith("_INSURANCE")) {
        invalidClauseCodes.add(matchedClauseCode);
        continue;
      }
      const currentCoverageGovernor =
        page.coverageGovernors
          .filter(
            ({ pageEnd, pageStart }) =>
              pageEnd <= match.index &&
              (!currentSectionHeading ||
                pageStart >= currentSectionHeading.pageStart)
          )
          .at(-1) || page.inheritedCoverageGovernor;
      if (!positiveActivationGovernor(currentCoverageGovernor)) {
        invalidClauseCodes.add(matchedClauseCode);
        continue;
      }

      const clauseCode = codes[0];
      if (!activationScopes.get(clauseCode)?.has(scopeKey)) {
        invalidClauseCodes.add(matchedClauseCode);
        continue;
      }
      const amount = amounts[0];
      const documentStart = page.start + context.pageStart;
      const amountDocumentStart = documentStart + amount.index;
      const governor = {
        contractId: EXACT_CLAUSE_CODE_FIELD_GOVERNOR_CONTRACT_ID,
        policy: EXACT_CLAUSE_CODE_FIELD_GOVERNOR_POLICY,
        clauseCode,
        documentFingerprint,
        scopeKey,
        physicalPageNumber: page.physicalPageNumber,
        printedPageLabel: page.printedPageLabel,
        pageBoundaryPhysicalPageNumber: page.physicalPageNumber,
        pageDocumentStart: page.start,
        pageDocumentEnd: page.end,
        documentStart,
        documentEnd: page.start + context.pageEnd,
        text: context.text,
        amountDocumentStart,
        amountDocumentEnd: amountDocumentStart + amount[0].length,
        amountText: amount[0],
      };
      if (!governorsByClauseCode.has(clauseCode))
        governorsByClauseCode.set(clauseCode, []);
      governorsByClauseCode.get(clauseCode).push(governor);
    }
  }
  for (const clauseCode of invalidClauseCodes)
    governorsByClauseCode.delete(clauseCode);
  return governorsByClauseCode;
}

function explicitClauseSectionHeadings(pageText, activationScopes) {
  const headings = [];
  const linePattern = /^([^\n]*?)(\d{2}\p{Lu}{2}\d{4})\s*$/gmu;
  for (const match of String(pageText || "").matchAll(linePattern)) {
    const text = match[0].trim();
    const label = match[1].trim();
    const clauseCode = match[2].toLocaleUpperCase("de");
    if (
      !label ||
      /^[-•·]/u.test(label) ||
      /Besondere\s+Bedingung/iu.test(label)
    )
      continue;
    const activatedScopes = activationScopes.get(clauseCode) || new Set();
    const scopeKeys = [...activatedScopes].sort();
    const activationScopeKey = scopeKeys.length === 1 ? scopeKeys[0] : null;
    const familyScopeKey = clauseFamilyScopeKey(clauseCode);
    const scopeKey = activationScopeKey || familyScopeKey;
    const leading = match[0].indexOf(text);
    headings.push({
      scopeKey,
      ...(scopeKeys.length > 1 ? { scopeKeys } : {}),
      text,
      clauseCode,
      pageStart: match.index + leading,
      pageEnd: match.index + leading + text.length,
      source:
        activationScopeKey && !familyScopeKey
          ? "CLAUSE_ACTIVATION"
          : familyScopeKey
            ? "CLAUSE_FAMILY"
            : "CLAUSE_AMBIGUOUS",
    });
  }
  return headings;
}

function explicitCoverageGovernors(pageText) {
  const patterns = [
    /^\s*(?:\d+(?:\.\d+)*\.\s*)?(Nicht\s+versichert[^\n:]{0,180}(?:sind)?\s*:?)\s*$/gimu,
    /^\s*(?:\d+(?:\.\d+)*\.\s*)?((?:Zus[aä]tzlich\s+)?versichert\s+sind(?:\s+Sch[aä]den\s+durch)?\s*:?)\s*$/gimu,
    /^\s*(Zus[aä]tzlich[^\n]{0,160}\bversichert\b\s*:?)\s*$/gimu,
    /^\s*(?:\d+(?:\.\d+)*\.\s*)?((?:Als\s+)?mitversichert\s+(?:sind|gelten)\s*:?)\s*$/gimu,
  ];
  const governors = [];
  for (const line of buildLineRecords(pageText)) {
    const polarity = semanticCoverageHeadingPolarity(line.text);
    if (!polarity) continue;
    const text = line.text.trim();
    const leading = line.text.indexOf(text);
    governors.push({
      text,
      pageStart: line.start + leading,
      pageEnd: line.start + leading + text.length,
      kind: "SEMANTIC_COVERAGE_HEADING",
      polarity,
    });
  }
  for (const pattern of patterns) {
    for (const match of String(pageText || "").matchAll(pattern)) {
      const text = match[0].trim();
      if (governors.some(({ pageStart }) => pageStart === match.index))
        continue;
      governors.push({
        text,
        pageStart: match.index,
        pageEnd: match.index + match[0].length,
      });
    }
  }
  return governors.sort((left, right) => left.pageStart - right.pageStart);
}

function objectClassificationKind(subject) {
  const normalized = String(subject || "")
    .normalize("NFKC")
    .replace(/^\s*\d+(?:\.\d+)*\.?\s+/u, "")
    .trim();
  if (
    /\b(?:versichert(?:e|en|er|es)?|mitversichert|ausgeschlossen|gedeckt|versicherungsschutz|schäden?|gefahren?|kosten|entschädigung|selbstbehalt|limits?|obliegenheiten?|vorschäden?|dokumente?)\b/iu.test(
      normalized
    )
  )
    return "COVERAGE_OR_OTHER";
  return /\b(?:anlagen?|adaptierungen?|haustechnik|gebäude(?:bestandteile|zubehör)?|bestandteile?|zubehör|einrichtungen?|objekte?|sachen?|bauwerke?|verglasungen?|zahlungsmittel|betriebsinhalt)\b/iu.test(
    normalized
  )
    ? "OBJECT"
    : "OTHER";
}

function explicitObjectClassificationGovernors(pageText) {
  const lines = buildLineRecords(pageText);
  const governors = [];
  const addGovernor = ({
    subjectLine,
    terminalLine,
    subject,
    membership = "MEMBER_OF_CLASS",
  }) => {
    const textStart = subjectLine.start + subjectLine.text.search(/\S/u);
    const terminalTrimmed = terminalLine.text.trimEnd();
    const pageEnd = terminalLine.start + terminalTrimmed.length;
    const classificationKind = objectClassificationKind(subject);
    governors.push({
      text: pageText.slice(textStart, pageEnd),
      subject: subject.trim(),
      pageStart: textStart,
      pageEnd,
      kind: "OBJECT_CLASSIFICATION_BOUNDARY",
      classificationKind,
      membership,
      ...(classificationKind === "OBJECT"
        ? { contractId: OBJECT_CLASSIFICATION_CONTEXT_CONTRACT }
        : {}),
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    // Blank PDF-extraction lines cannot declare an object class. Skipping
    // them before the deliberately permissive subject grammar also prevents
    // overlapping whitespace branches from backtracking over long padding.
    if (isBlankLine(line)) continue;
    const sameLineSuffix = line.text.match(/,?\s+das\s+sind\s*:\s*$/iu);
    const sameLineSubject = sameLineSuffix
      ? line.text.slice(0, sameLineSuffix.index).trim()
      : "";
    if (sameLineSubject) {
      addGovernor({
        subjectLine: line,
        terminalLine: line,
        subject: sameLineSubject,
      });
      continue;
    }
    const excludedFromClass = line.text.match(
      /^\s*Nicht\s+als\s+(.+?)\s+(?:gelten|gilt|zählen|zählt)\s*:\s*$/iu
    );
    if (excludedFromClass) {
      addGovernor({
        subjectLine: line,
        terminalLine: line,
        subject: excludedFromClass[1],
        membership: "EXCLUDED_FROM_CLASS",
      });
      continue;
    }
    const next = lines[index + 1];
    if (
      !line.text.trim() ||
      !next ||
      !/^\s*das\s+sind\s*:\s*$/iu.test(next.text)
    )
      continue;
    addGovernor({ subjectLine: line, terminalLine: next, subject: line.text });
    index += 1;
  }
  return governors.sort((left, right) => left.pageStart - right.pageStart);
}

function explicitVariantHeadings(pageText) {
  const pattern =
    /^[\t ]*(?:\d+(?:\.\d+)*\.\s*)?Deckungsvariante\s+[„"']?\s*([\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*)\s*[“"']?[\t ]*$/gimu;
  const headings = [];
  for (const match of String(pageText || "").matchAll(pattern)) {
    const label = match[1].trim();
    const text = match[0].trim();
    const leading = match[0].indexOf(text);
    headings.push({
      key: normalizeWithOffsetMap(label)
        .normalized.replace(/\s+/gu, "_")
        .toLocaleUpperCase("de"),
      label,
      text,
      pageStart: match.index + leading,
      pageEnd: match.index + leading + text.length,
    });
  }
  return headings.sort((left, right) => left.pageStart - right.pageStart);
}

function explicitFieldGovernors(pageText) {
  const pattern =
    /^[\t ]*((?:Folgende|Nachstehende|Die\s+folgenden)\b[\s\S]{0,500}?\b(?:Versicherungssumme|Höchstentschädigung|Limit|Sublimit)\b[\s\S]{0,250}?\b(?:mitversichert|versichert|gedeckt)\s*:)[\t ]*$/gimu;
  const governors = [];
  for (const match of String(pageText || "").matchAll(pattern)) {
    if (!/(?:EUR|€)\s*\d|\d{1,3}(?:[.,]\d+)?\s*%/iu.test(match[1])) continue;
    const text = match[1];
    const relativeStart = match[0].indexOf(text);
    governors.push({
      text,
      pageStart: match.index + relativeStart,
      pageEnd: match.index + relativeStart + text.length,
    });
  }
  return governors.sort((left, right) => left.pageStart - right.pageStart);
}

function printedPageIndex(label) {
  const match = String(label || "").match(/^Seite\s+(\d+)\s+von\s+(\d+)$/iu);
  return match ? { current: Number(match[1]), total: Number(match[2]) } : null;
}

function validateDocument(document) {
  if (!document || typeof document !== "object")
    throw worksheetError("DOCUMENT_REQUIRED");
  const pageContent = String(document.pageContent || "");
  const pageMap = document.pageMap;
  const extraction = document.pdfExtraction;
  if (!Array.isArray(pageMap) || pageMap.length === 0)
    throw worksheetError("PDF_PAGEMAP_REQUIRED");
  if (
    extraction?.schemaVersion !== 1 ||
    extraction?.complete !== true ||
    extraction?.totalPages !== pageMap.length ||
    extraction?.processedPages !== extraction?.totalPages
  )
    throw worksheetError("PDF_PAGEMAP_INVALID");

  let previousEnd = 0;
  const pages = pageMap.map((page, index) => {
    const pageNumber = Number(page.pageNumber);
    const start = Number(page.start);
    const end = Number(page.end);
    if (
      pageNumber !== index + 1 ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < previousEnd ||
      end < start ||
      end > pageContent.length
    )
      throw worksheetError("PDF_PAGEMAP_INVALID", `page ${pageNumber}`);
    previousEnd = end;
    const text = pageContent.slice(start, end);
    const printedPageLabels = [
      ...text.matchAll(/\bSeite\s+\d+\s+von\s+\d+\b/giu),
    ].map((match) => match[0]);
    return {
      pageNumber,
      physicalPageNumber: pageNumber,
      printedPageLabel:
        new Set(printedPageLabels).size === 1 ? printedPageLabels[0] : null,
      start,
      end,
      text,
      scopeHints: explicitPageScopeHints(text),
      coverageGovernors: explicitCoverageGovernors(text).map((governor) => ({
        ...governor,
        physicalPageNumber: pageNumber,
      })),
      objectClassificationGovernors: explicitObjectClassificationGovernors(
        text
      ).map((governor) => ({
        ...governor,
        physicalPageNumber: pageNumber,
        documentStart: start + governor.pageStart,
        documentEnd: start + governor.pageEnd,
      })),
      clauseBoundaries: buildLineRecords(text)
        .filter(isClauseSectionHeading)
        .map((line) => ({
          kind: "CLAUSE_BOUNDARY",
          pageStart: line.start,
          pageEnd: line.end,
        })),
      variantHeadings: explicitVariantHeadings(text).map((heading) => ({
        ...heading,
        physicalPageNumber: pageNumber,
      })),
      fieldGovernors: explicitFieldGovernors(text).map((governor) => ({
        ...governor,
        physicalPageNumber: pageNumber,
      })),
      sectionHeadings: explicitSectionHeadings(text).map((heading) => ({
        ...heading,
        physicalPageNumber: pageNumber,
      })),
    };
  });
  const activationScopes = clauseActivationScopes(pages);
  for (const page of pages)
    page.sectionHeadings = [
      ...page.sectionHeadings,
      ...explicitClauseSectionHeadings(page.text, activationScopes).map(
        (heading) => ({
          ...heading,
          physicalPageNumber: page.pageNumber,
        })
      ),
    ].sort((left, right) => left.pageStart - right.pageStart);
  for (const page of pages)
    page.structuralBoundaryLineStarts = structuralBoundaryLineStarts(page);
  let inheritedSectionHeading = null;
  let previousPageCoverageGovernor = null;
  let inheritedVariantHeading = null;
  let inheritedObjectClassificationGovernor = null;
  for (const page of pages) {
    const printed = printedPageIndex(page.printedPageLabel);
    if (printed?.current === 1) {
      inheritedSectionHeading = null;
      inheritedVariantHeading = null;
      inheritedObjectClassificationGovernor = null;
    }
    page.inheritedSectionHeading = inheritedSectionHeading;
    page.inheritedVariantHeading = inheritedVariantHeading;
    page.inheritedObjectClassificationGovernor =
      inheritedObjectClassificationGovernor;
    page.inheritedCoverageGovernor =
      page.sectionHeadings.length === 0 ||
      page.sectionHeadings.some(
        ({ scopeKey }) => scopeKey === "GENERAL_CONTRACT_TERMS"
      )
        ? previousPageCoverageGovernor
        : null;
    if (page.sectionHeadings.length > 0) {
      const lastHeading = page.sectionHeadings.at(-1);
      inheritedSectionHeading =
        lastHeading.scopeKey || lastHeading.scopeKeys?.length
          ? lastHeading
          : null;
      inheritedVariantHeading = null;
    }
    if (page.variantHeadings.length > 0)
      inheritedVariantHeading = page.variantHeadings.at(-1);
    previousPageCoverageGovernor = page.coverageGovernors.at(-1) || null;
    const lastObjectClassificationBoundary = [
      ...page.objectClassificationGovernors,
      ...page.sectionHeadings.map((heading) => ({
        ...heading,
        kind: "SECTION_BOUNDARY",
      })),
      ...page.coverageGovernors.map((governor) => ({
        ...governor,
        kind: "COVERAGE_BOUNDARY",
      })),
      ...page.clauseBoundaries,
    ]
      .sort(
        (left, right) =>
          left.pageStart - right.pageStart || left.pageEnd - right.pageEnd
      )
      .at(-1);
    inheritedObjectClassificationGovernor =
      lastObjectClassificationBoundary?.kind ===
        "OBJECT_CLASSIFICATION_BOUNDARY" &&
      lastObjectClassificationBoundary.classificationKind === "OBJECT"
        ? lastObjectClassificationBoundary
        : null;
  }
  return { pageContent, pages };
}

function lineContainingOffset(lines, offset) {
  return (
    lines.find(({ start, end }) => offset >= start && offset <= end) || null
  );
}

function structuralBoundaryLineStarts(page) {
  const ranges = [
    ...page.sectionHeadings,
    ...page.coverageGovernors,
    ...page.clauseBoundaries,
  ];
  return new Set(
    buildLineRecords(page.text)
      .filter((line) =>
        ranges.some(
          ({ pageStart, pageEnd }) =>
            pageStart < line.end && pageEnd > line.start
        )
      )
      .map(({ start }) => start)
  );
}

function structuralMarkerForLine(page, line) {
  const markers = [
    ...page.sectionHeadings.map((marker) => ({
      ...marker,
      boundaryKind: FOLLOWING_STRUCTURAL_BOUNDARY_KIND.SECTION_HEADING,
      priority: 0,
    })),
    ...page.coverageGovernors.map((marker) => ({
      ...marker,
      boundaryKind: FOLLOWING_STRUCTURAL_BOUNDARY_KIND.COVERAGE_GOVERNOR,
      priority: 1,
    })),
    ...page.clauseBoundaries.map((marker) => ({
      ...marker,
      text: page.text.slice(marker.pageStart, marker.pageEnd),
      boundaryKind: FOLLOWING_STRUCTURAL_BOUNDARY_KIND.CLAUSE_HEADING,
      priority: 2,
    })),
  ]
    .filter(
      ({ pageStart, pageEnd }) => pageStart < line.end && pageEnd > line.start
    )
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.pageStart - right.pageStart ||
        left.pageEnd - right.pageEnd
    );
  const selected = markers[0] || null;
  if (!selected) return null;
  const declaredText = String(selected.text || "");
  const declaredRange = page.text.slice(selected.pageStart, selected.pageEnd);
  const relativeTextStart = declaredRange.indexOf(declaredText);
  if (declaredText && relativeTextStart >= 0)
    return {
      ...selected,
      pageStart: selected.pageStart + relativeTextStart,
      pageEnd: selected.pageStart + relativeTextStart + declaredText.length,
      text: declaredText,
    };
  return selected;
}

function printedPageHeaderEnd(page) {
  if (!page.printedPageLabel) return 0;
  const lines = buildLineRecords(page.text);
  const labelStart = page.text.indexOf(page.printedPageLabel);
  if (labelStart < 0) return 0;
  return lineContainingOffset(lines, labelStart)?.end || 0;
}

function structuralUnitsForPage(page) {
  const lines = buildLineRecords(page.text);
  const units = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isBlankLine(line)) continue;

    const marker = structuralMarkerForLine(page, line);
    if (marker) {
      units.push({
        kind: marker.boundaryKind,
        pageStart: marker.pageStart,
        pageEnd: marker.pageEnd,
      });
      continue;
    }

    let endIndex = index;
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex];
      if (
        isBlankLine(nextLine) ||
        isBulletLine(nextLine) ||
        structuralMarkerForLine(page, nextLine)
      )
        break;
      endIndex = nextIndex;
    }
    const firstNonWhitespace = line.text.search(/\S/u);
    const pageStart = line.start + Math.max(firstNonWhitespace, 0);
    const lastText = lines[endIndex].text.trimEnd();
    const pageEnd = lines[endIndex].start + lastText.length;
    units.push({
      kind: isBulletLine(line)
        ? FOLLOWING_STRUCTURAL_BOUNDARY_KIND.LIST_ITEM
        : FOLLOWING_STRUCTURAL_BOUNDARY_KIND.PARAGRAPH,
      pageStart,
      pageEnd,
    });
    index = endIndex;
  }
  return units;
}

function followingStructuralUnitIndex(pages) {
  return pages.flatMap((page) => {
    const headerEnd = printedPageHeaderEnd(page);
    return structuralUnitsForPage(page).map((unit) => ({
      ...unit,
      physicalPageNumber: page.physicalPageNumber,
      documentStart: page.start + unit.pageStart,
      documentEnd: page.start + unit.pageEnd,
      crossPageEligible: unit.pageStart >= headerEnd,
    }));
  });
}

function firstFollowingStructuralUnit({
  structuralUnits,
  originDocumentEnd,
  originPhysicalPageNumber,
}) {
  let lower = 0;
  let upper = structuralUnits.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (structuralUnits[middle].documentStart < originDocumentEnd)
      lower = middle + 1;
    else upper = middle;
  }
  for (let index = lower; index < structuralUnits.length; index += 1) {
    const unit = structuralUnits[index];
    if (
      unit.physicalPageNumber === originPhysicalPageNumber ||
      (unit.physicalPageNumber > originPhysicalPageNumber &&
        unit.crossPageEligible)
    )
      return unit;
  }
  return null;
}

/**
 * Captures the first structural unit after one occurrence context. Cross-page
 * print headers remain byte-for-byte visible in skippedRaw while the next
 * semantic unit is selected after the printed page-label line. Role:
 * provenance. Side effects: none.
 */
function followingStructuralBoundaryProof({
  pageContent,
  pages,
  structuralUnits,
  occurrencePage,
  context,
}) {
  const originDocumentStart = Number(context?.documentStart);
  const originDocumentEnd = Number(context?.documentEnd);
  const originPageIndex = pages.findIndex(
    ({ physicalPageNumber }) =>
      physicalPageNumber === occurrencePage.physicalPageNumber
  );
  if (
    !Number.isInteger(originDocumentStart) ||
    !Number.isInteger(originDocumentEnd) ||
    originDocumentEnd < originDocumentStart ||
    originPageIndex < 0
  )
    throw worksheetError("FOLLOWING_BOUNDARY_ORIGIN_INVALID");

  const unit = firstFollowingStructuralUnit({
    structuralUnits,
    originDocumentEnd,
    originPhysicalPageNumber: occurrencePage.physicalPageNumber,
  });
  if (unit) {
    const documentStart = unit.documentStart;
    const documentEnd = unit.documentEnd;
    if (documentStart < originDocumentEnd)
      throw worksheetError("FOLLOWING_BOUNDARY_OVERLAPS_ORIGIN");
    const gapLength = documentStart - originDocumentEnd;
    const boundaryLength = documentEnd - documentStart;
    const inspectedSpanLength = documentEnd - originDocumentEnd;
    if (inspectedSpanLength > MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE) {
      const skippedDocumentEnd = Math.min(
        documentStart,
        originDocumentEnd + MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE
      );
      return {
        contractId: FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID,
        origin: {
          physicalPageNumber: occurrencePage.physicalPageNumber,
          documentStart: originDocumentStart,
          documentEnd: originDocumentEnd,
        },
        kind: FOLLOWING_STRUCTURAL_BOUNDARY_KIND.TOO_DISTANT,
        observedKind: unit.kind,
        reason:
          gapLength > MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE
            ? "FOLLOWING_BOUNDARY_GAP_EXCEEDS_MAX"
            : boundaryLength > MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE
              ? "FOLLOWING_BOUNDARY_UNIT_EXCEEDS_MAX"
              : "FOLLOWING_BOUNDARY_SPAN_EXCEEDS_MAX",
        maximumDistance: MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE,
        physicalPageNumber: unit.physicalPageNumber,
        documentStart,
        documentEnd,
        text: null,
        textSha256: crypto
          .createHash("sha256")
          .update(pageContent.slice(documentStart, documentEnd))
          .digest("hex"),
        skippedRaw: {
          documentStart: originDocumentEnd,
          documentEnd: skippedDocumentEnd,
          complete: skippedDocumentEnd === documentStart,
          text: pageContent.slice(originDocumentEnd, skippedDocumentEnd),
        },
      };
    }
    const unitText = pageContent.slice(documentStart, documentEnd);
    return {
      contractId: FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID,
      origin: {
        physicalPageNumber: occurrencePage.physicalPageNumber,
        documentStart: originDocumentStart,
        documentEnd: originDocumentEnd,
      },
      kind: unit.kind,
      physicalPageNumber: unit.physicalPageNumber,
      documentStart,
      documentEnd,
      text: unitText,
      skippedRaw: {
        documentStart: originDocumentEnd,
        documentEnd: documentStart,
        complete: true,
        text: pageContent.slice(originDocumentEnd, documentStart),
      },
    };
  }

  const eofOffset = pageContent.length;
  if (eofOffset < originDocumentEnd)
    throw worksheetError("FOLLOWING_BOUNDARY_EOF_OVERLAPS_ORIGIN");
  if (
    eofOffset - originDocumentEnd >
    MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE
  ) {
    const skippedDocumentEnd =
      originDocumentEnd + MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE;
    return {
      contractId: FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID,
      origin: {
        physicalPageNumber: occurrencePage.physicalPageNumber,
        documentStart: originDocumentStart,
        documentEnd: originDocumentEnd,
      },
      kind: FOLLOWING_STRUCTURAL_BOUNDARY_KIND.TOO_DISTANT,
      observedKind: FOLLOWING_STRUCTURAL_BOUNDARY_KIND.EOF,
      reason: "FOLLOWING_BOUNDARY_GAP_EXCEEDS_MAX",
      maximumDistance: MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE,
      physicalPageNumber: pages.at(-1).physicalPageNumber,
      documentStart: eofOffset,
      documentEnd: eofOffset,
      text: null,
      textSha256: crypto.createHash("sha256").update("").digest("hex"),
      skippedRaw: {
        documentStart: originDocumentEnd,
        documentEnd: skippedDocumentEnd,
        complete: false,
        text: pageContent.slice(originDocumentEnd, skippedDocumentEnd),
      },
    };
  }
  return {
    contractId: FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID,
    origin: {
      physicalPageNumber: occurrencePage.physicalPageNumber,
      documentStart: originDocumentStart,
      documentEnd: originDocumentEnd,
    },
    kind: FOLLOWING_STRUCTURAL_BOUNDARY_KIND.EOF,
    physicalPageNumber: pages.at(-1).physicalPageNumber,
    documentStart: eofOffset,
    documentEnd: eofOffset,
    text: "",
    skippedRaw: {
      documentStart: originDocumentEnd,
      documentEnd: eofOffset,
      complete: true,
      text: pageContent.slice(originDocumentEnd, eofOffset),
    },
  };
}

function validFollowingStructuralBoundaryProof(occurrence) {
  const context = occurrence?.context;
  const proof = context?.followingStructuralBoundaryProof;
  const skipped = proof?.skippedRaw;
  const origin = proof?.origin;
  if (
    proof?.contractId !== FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID ||
    !ALLOWED_FOLLOWING_STRUCTURAL_BOUNDARY_KINDS.has(proof?.kind) ||
    !Number.isInteger(occurrence?.physicalPageNumber) ||
    !Number.isInteger(context?.documentStart) ||
    !Number.isInteger(context?.documentEnd) ||
    origin?.physicalPageNumber !== occurrence.physicalPageNumber ||
    origin?.documentStart !== context.documentStart ||
    origin?.documentEnd !== context.documentEnd ||
    !Number.isInteger(proof?.physicalPageNumber) ||
    proof.physicalPageNumber < occurrence.physicalPageNumber ||
    !Number.isInteger(proof?.documentStart) ||
    !Number.isInteger(proof?.documentEnd) ||
    proof.documentStart < context.documentEnd ||
    proof.documentEnd < proof.documentStart ||
    skipped?.documentStart !== context.documentEnd ||
    !Number.isInteger(skipped?.documentEnd) ||
    skipped.documentEnd < skipped.documentStart ||
    skipped.documentEnd > proof.documentStart ||
    typeof skipped?.complete !== "boolean" ||
    typeof skipped?.text !== "string" ||
    skipped.text.length !== skipped.documentEnd - skipped.documentStart
  )
    return false;
  if (proof.kind === FOLLOWING_STRUCTURAL_BOUNDARY_KIND.TOO_DISTANT)
    return Boolean(
      [
        "FOLLOWING_BOUNDARY_GAP_EXCEEDS_MAX",
        "FOLLOWING_BOUNDARY_UNIT_EXCEEDS_MAX",
        "FOLLOWING_BOUNDARY_SPAN_EXCEEDS_MAX",
      ].includes(proof.reason) &&
        proof.maximumDistance === MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE &&
        ALLOWED_FOLLOWING_STRUCTURAL_BOUNDARY_KINDS.has(proof.observedKind) &&
        proof.observedKind !== FOLLOWING_STRUCTURAL_BOUNDARY_KIND.TOO_DISTANT &&
        proof.text === null &&
        /^[a-f0-9]{64}$/u.test(String(proof.textSha256 || "")) &&
        skipped.text.length <= MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE &&
        skipped.complete === (skipped.documentEnd === proof.documentStart) &&
        (proof.reason === "FOLLOWING_BOUNDARY_GAP_EXCEEDS_MAX"
          ? proof.documentStart - context.documentEnd >
            MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE
          : proof.reason === "FOLLOWING_BOUNDARY_UNIT_EXCEEDS_MAX"
            ? proof.documentEnd - proof.documentStart >
              MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE
            : proof.documentEnd - context.documentEnd >
              MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE)
    );
  if (
    typeof proof?.text !== "string" ||
    proof.text.length !== proof.documentEnd - proof.documentStart ||
    skipped.complete !== true ||
    skipped.documentEnd !== proof.documentStart ||
    Object.prototype.hasOwnProperty.call(proof, "textSha256")
  )
    return false;
  return proof.kind === FOLLOWING_STRUCTURAL_BOUNDARY_KIND.EOF
    ? proof.documentStart === proof.documentEnd && proof.text === ""
    : proof.documentEnd > proof.documentStart && proof.text.trim().length > 0;
}

function validateCatalog(catalog) {
  if (
    ![1, 2].includes(catalog?.schemaVersion) ||
    !Array.isArray(catalog.requirements)
  )
    throw worksheetError("CATALOG_INVALID");
  const requirementIds = new Set();
  return catalog.requirements.map((requirement) => {
    const id = requireNonEmptyString(
      requirement.id,
      "REQUIREMENT_ID_REQUIRED",
      "requirement"
    );
    if (requirementIds.has(id))
      throw worksheetError("DUPLICATE_REQUIREMENT_ID", id);
    requirementIds.add(id);
    if (
      !Array.isArray(requirement.components) ||
      requirement.components.length === 0
    )
      throw worksheetError("REQUIREMENT_COMPONENTS_REQUIRED", id);
    if (
      catalog.schemaVersion === 2 &&
      (requirement.negativeSearchPolicy === undefined ||
        requirement.absenceMeaning === undefined)
    )
      throw worksheetError("QUALIFIED_ABSENCE_CONTRACT_REQUIRED", id);
    if (
      requirement.absenceComparisonPolicy !== undefined &&
      requirement.negativeSearchPolicy !== "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1"
    )
      throw worksheetError("CERTIFIED_NEGATIVE_SEARCH_REQUIRED", id);

    const componentIds = new Set();
    const components = requirement.components.map((component) => {
      const componentId = requireNonEmptyString(
        component.id,
        "COMPONENT_ID_REQUIRED",
        id
      );
      if (componentIds.has(componentId))
        throw worksheetError("DUPLICATE_COMPONENT_ID", `${id}:${componentId}`);
      componentIds.add(componentId);
      if (!Array.isArray(component.aliases) || component.aliases.length === 0)
        throw worksheetError(
          "COMPONENT_ALIASES_REQUIRED",
          `${id}:${componentId}`
        );
      const aliases = [
        ...new Set(
          component.aliases.map((alias) =>
            requireNonEmptyString(
              alias,
              "ALIAS_REQUIRED",
              `${id}:${componentId}`
            )
          )
        ),
      ];
      if (
        component.conceptSearches !== undefined &&
        !Array.isArray(component.conceptSearches)
      )
        throw worksheetError(
          "CONCEPT_SEARCHES_INVALID",
          `${id}:${componentId}`
        );
      const conceptSearchIds = new Set();
      const conceptSearches = Array.isArray(component.conceptSearches)
        ? component.conceptSearches.map((search, searchIndex) => {
            const detail = `${id}:${componentId}:conceptSearches[${searchIndex}]`;
            if (
              !search ||
              typeof search !== "object" ||
              Array.isArray(search) ||
              Object.keys(search).some(
                (key) =>
                  !["id", "requiredGroups", "maxLines", "maxChars"].includes(
                    key
                  )
              ) ||
              !Array.isArray(search.requiredGroups) ||
              search.requiredGroups.length === 0
            )
              throw worksheetError("CONCEPT_SEARCH_INVALID", detail);
            const searchId = requireNonEmptyString(
              search.id,
              "CONCEPT_SEARCH_ID_REQUIRED",
              detail
            );
            if (conceptSearchIds.has(searchId))
              throw worksheetError(
                "CONCEPT_SEARCH_ID_DUPLICATE",
                `${id}:${componentId}:${searchId}`
              );
            conceptSearchIds.add(searchId);
            const requiredGroups = search.requiredGroups.map(
              (group, groupIndex) => {
                const groupDetail = `${detail}:requiredGroups[${groupIndex}]`;
                if (
                  !group ||
                  typeof group !== "object" ||
                  Array.isArray(group) ||
                  !Array.isArray(group.prefixes) ||
                  group.prefixes.length === 0 ||
                  Object.keys(group).some((key) => key !== "prefixes")
                )
                  throw worksheetError("CONCEPT_GROUP_INVALID", groupDetail);
                const prefixes = [
                  ...new Set(
                    group.prefixes.map((prefix) => {
                      const normalized = normalizeWithOffsetMap(
                        requireNonEmptyString(
                          prefix,
                          "CONCEPT_PREFIX_REQUIRED",
                          groupDetail
                        )
                      ).normalized;
                      if (normalized.length < 4 || normalized.includes(" "))
                        throw worksheetError(
                          "CONCEPT_PREFIX_INVALID",
                          `${groupDetail}:${prefix}`
                        );
                      return normalized;
                    })
                  ),
                ];
                return { prefixes };
              }
            );
            const maxLines = Number(
              search.maxLines || DEFAULT_CONCEPT_SEARCH_MAX_LINES
            );
            const maxChars = Number(
              search.maxChars || DEFAULT_CONCEPT_SEARCH_MAX_CHARS
            );
            if (
              !Number.isInteger(maxLines) ||
              maxLines < 1 ||
              maxLines > 3 ||
              !Number.isInteger(maxChars) ||
              maxChars < 80 ||
              maxChars > DEFAULT_CONCEPT_SEARCH_MAX_CHARS
            )
              throw worksheetError("CONCEPT_SEARCH_BOUNDS_INVALID", detail);
            return { id: searchId, requiredGroups, maxLines, maxChars };
          })
        : [];
      const followingStructuralBoundaryProofContractId =
        component.followingStructuralBoundaryProofContractId === undefined
          ? null
          : requireNonEmptyString(
              component.followingStructuralBoundaryProofContractId,
              "FOLLOWING_BOUNDARY_PROOF_CONTRACT_REQUIRED",
              `${id}:${componentId}`
            );
      if (
        followingStructuralBoundaryProofContractId !== null &&
        followingStructuralBoundaryProofContractId !==
          FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID
      )
        throw worksheetError(
          "FOLLOWING_BOUNDARY_PROOF_CONTRACT_INVALID",
          `${id}:${componentId}:${followingStructuralBoundaryProofContractId}`
        );
      const fieldGovernorPolicy =
        component.fieldGovernorPolicy === undefined
          ? null
          : requireNonEmptyString(
              component.fieldGovernorPolicy,
              "FIELD_GOVERNOR_POLICY_REQUIRED",
              `${id}:${componentId}`
            );
      if (
        fieldGovernorPolicy !== null &&
        fieldGovernorPolicy !== EXACT_CLAUSE_CODE_FIELD_GOVERNOR_POLICY
      )
        throw worksheetError(
          "FIELD_GOVERNOR_POLICY_INVALID",
          `${id}:${componentId}:${fieldGovernorPolicy}`
        );
      return {
        id: componentId,
        label: requireNonEmptyString(
          component.label,
          "COMPONENT_LABEL_REQUIRED",
          `${id}:${componentId}`
        ),
        factRole: (() => {
          const factRole = requireNonEmptyString(
            component.factRole,
            "COMPONENT_FACT_ROLE_REQUIRED",
            `${id}:${componentId}`
          );
          if (!ALLOWED_FACT_ROLES.has(factRole))
            throw worksheetError(
              "COMPONENT_FACT_ROLE_INVALID",
              `${id}:${componentId}:${factRole}`
            );
          return factRole;
        })(),
        contextMode: (() => {
          const contextMode = component.contextMode || CONTEXT_MODE.STRUCTURAL;
          if (!ALLOWED_CONTEXT_MODES.has(contextMode))
            throw worksheetError(
              "COMPONENT_CONTEXT_MODE_INVALID",
              `${id}:${componentId}:${String(contextMode)}`
            );
          return contextMode;
        })(),
        aliases,
        conceptSearches,
        ...(followingStructuralBoundaryProofContractId
          ? { followingStructuralBoundaryProofContractId }
          : {}),
        ...(fieldGovernorPolicy ? { fieldGovernorPolicy } : {}),
      };
    });
    const componentFamilyContract = (() => {
      if (requirement.componentFamilyContract === undefined) return null;
      const contract = requirement.componentFamilyContract;
      if (
        !contract ||
        typeof contract !== "object" ||
        Array.isArray(contract) ||
        JSON.stringify(Object.keys(contract).sort()) !==
          JSON.stringify(
            [
              "contractId",
              "memberComponentIds",
              "rootComponentId",
              "rootCoversMembers",
              "rowComparison",
            ].sort()
          ) ||
        contract.contractId !== DIRECTED_OBJECT_FAMILY_CONTRACT_ID ||
        contract.rootCoversMembers !== true ||
        contract.rowComparison !== COVERAGE_PRESENCE_ONLY ||
        !componentIds.has(contract.rootComponentId) ||
        !Array.isArray(contract.memberComponentIds) ||
        contract.memberComponentIds.length === 0 ||
        new Set(contract.memberComponentIds).size !==
          contract.memberComponentIds.length ||
        contract.memberComponentIds.includes(contract.rootComponentId) ||
        contract.memberComponentIds.some(
          (componentId) => !componentIds.has(componentId)
        )
      )
        throw worksheetError("COMPONENT_FAMILY_CONTRACT_INVALID", id);
      return {
        contractId: contract.contractId,
        rootComponentId: contract.rootComponentId,
        memberComponentIds: [...contract.memberComponentIds],
        rootCoversMembers: true,
        rowComparison: contract.rowComparison,
      };
    })();
    const bindingStructures = Array.isArray(requirement.bindingStructures)
      ? requirement.bindingStructures.map((structure, index) => {
          const detail = `${id}:bindingStructures[${index}]`;
          if (
            ![SHARED_GOVERNOR, SHARED_SPAN, RIGHT_HEADED_COORDINATION].includes(
              structure?.type
            ) ||
            structure?.constraint !== SAME_CANDIDATE_BINDING
          )
            throw worksheetError("BINDING_STRUCTURE_INVALID", detail);
          let governorAliases = [];
          let headSuffixes = [];
          if (structure.type === SHARED_GOVERNOR) {
            if (
              !Array.isArray(structure.governorAliases) ||
              structure.governorAliases.length === 0
            )
              throw worksheetError("BINDING_GOVERNOR_ALIASES_REQUIRED", detail);
            governorAliases = [
              ...new Set(
                structure.governorAliases.map((alias) =>
                  requireNonEmptyString(
                    alias,
                    "BINDING_GOVERNOR_ALIAS_REQUIRED",
                    detail
                  )
                )
              ),
            ];
            if (structure.headSuffixes !== undefined)
              throw worksheetError(
                "BINDING_GOVERNOR_HEAD_SUFFIX_FORBIDDEN",
                detail
              );
          } else if (structure.type === RIGHT_HEADED_COORDINATION) {
            if (
              !Array.isArray(structure.headSuffixes) ||
              structure.headSuffixes.length === 0
            )
              throw worksheetError("BINDING_HEAD_SUFFIXES_REQUIRED", detail);
            headSuffixes = [
              ...new Set(
                structure.headSuffixes.map((suffix) =>
                  requireNonEmptyString(
                    suffix,
                    "BINDING_HEAD_SUFFIX_REQUIRED",
                    detail
                  )
                )
              ),
            ];
            if (structure.governorAliases !== undefined)
              throw worksheetError(
                "BINDING_RIGHT_HEAD_GOVERNOR_FORBIDDEN",
                detail
              );
          } else if (
            structure.governorAliases !== undefined ||
            structure.headSuffixes !== undefined
          ) {
            throw worksheetError(
              "BINDING_SHARED_SPAN_GOVERNOR_FORBIDDEN",
              detail
            );
          }
          if (
            !Array.isArray(structure.memberComponentIds) ||
            structure.memberComponentIds.length < 2
          )
            throw worksheetError("BINDING_MEMBER_COMPONENTS_REQUIRED", detail);
          const memberComponentIds = [
            ...new Set(
              structure.memberComponentIds.map((componentId) =>
                requireNonEmptyString(
                  componentId,
                  "BINDING_MEMBER_COMPONENT_ID_REQUIRED",
                  detail
                )
              )
            ),
          ];
          if (memberComponentIds.length !== structure.memberComponentIds.length)
            throw worksheetError("BINDING_MEMBER_COMPONENT_DUPLICATE", detail);
          for (const memberComponentId of memberComponentIds) {
            if (!componentIds.has(memberComponentId))
              throw worksheetError(
                "BINDING_STRUCTURE_COMPONENT_UNKNOWN",
                `${detail}:${memberComponentId}`
              );
          }
          return {
            type: structure.type,
            governorAliases,
            headSuffixes,
            memberComponentIds,
            constraint: SAME_CANDIDATE_BINDING,
          };
        })
      : [];
    let scopeRules = { narrowAliases: [], narrowScopeKeys: [] };
    if (requirement.scopeRules !== undefined) {
      const scopeRuleKeys = Object.keys(requirement.scopeRules || {});
      if (
        !requirement.scopeRules ||
        typeof requirement.scopeRules !== "object" ||
        Array.isArray(requirement.scopeRules) ||
        scopeRuleKeys.length === 0 ||
        scopeRuleKeys.some(
          (key) => !["narrowAliases", "narrowScopeKeys"].includes(key)
        ) ||
        (requirement.scopeRules.narrowAliases !== undefined &&
          !Array.isArray(requirement.scopeRules.narrowAliases)) ||
        (requirement.scopeRules.narrowScopeKeys !== undefined &&
          !Array.isArray(requirement.scopeRules.narrowScopeKeys))
      )
        throw worksheetError("SCOPE_RULES_INVALID", id);
      scopeRules = {
        narrowAliases: [
          ...new Set(
            (requirement.scopeRules.narrowAliases || []).map((alias) =>
              requireNonEmptyString(alias, "SCOPE_ALIAS_REQUIRED", id)
            )
          ),
        ],
        narrowScopeKeys: [
          ...new Set(
            (requirement.scopeRules.narrowScopeKeys || []).map((scopeKey) =>
              requireNonEmptyString(scopeKey, "SCOPE_SECTION_KEY_REQUIRED", id)
            )
          ),
        ],
      };
    }
    const validatedRequirement = {
      id,
      label: requireNonEmptyString(
        requirement.label,
        "REQUIREMENT_LABEL_REQUIRED",
        id
      ),
      requestedFields: Array.isArray(requirement.requestedFields)
        ? [...requirement.requestedFields]
        : [],
      optionalFields: Array.isArray(requirement.optionalFields)
        ? [
            ...new Set(
              requirement.optionalFields.map((field) =>
                requireNonEmptyString(field, "OPTIONAL_FIELD_INVALID", id)
              )
            ),
          ]
        : [],
      scopePolicy: (() => {
        const scopePolicy = requirement.scopePolicy || "GENERAL_REQUIRED";
        if (!ALLOWED_SCOPE_POLICIES.has(scopePolicy))
          throw worksheetError("SCOPE_POLICY_INVALID", id);
        if (
          scopePolicy === "MATCHING_SCOPE_DEFINITIVE_SUFFICIENT" &&
          scopeRules.narrowScopeKeys.length === 0
        )
          throw worksheetError("DEFINITIVE_SCOPE_KEYS_REQUIRED", id);
        return scopePolicy;
      })(),
      componentSatisfactionPolicy: (() => {
        const policy = requirement.componentSatisfactionPolicy || "ALL";
        if (!ALLOWED_COMPONENT_SATISFACTION_POLICIES.has(policy))
          throw worksheetError("COMPONENT_SATISFACTION_POLICY_INVALID", id);
        return policy;
      })(),
      negativeSearchPolicy: (() => {
        if (requirement.negativeSearchPolicy === undefined) return null;
        const policy = requireNonEmptyString(
          requirement.negativeSearchPolicy,
          "NEGATIVE_SEARCH_POLICY_INVALID",
          id
        );
        if (!ALLOWED_NEGATIVE_SEARCH_POLICIES.has(policy))
          throw worksheetError("NEGATIVE_SEARCH_POLICY_INVALID", id);
        return policy;
      })(),
      absenceMeaning: (() => {
        if (requirement.absenceMeaning === undefined) return null;
        const meaning = requireNonEmptyString(
          requirement.absenceMeaning,
          "ABSENCE_MEANING_INVALID",
          id
        );
        if (!ALLOWED_ABSENCE_MEANINGS.has(meaning))
          throw worksheetError("ABSENCE_MEANING_INVALID", id);
        return meaning;
      })(),
      absenceComparisonPolicy: (() => {
        if (requirement.absenceComparisonPolicy === undefined) return null;
        const policy = requireNonEmptyString(
          requirement.absenceComparisonPolicy,
          "ABSENCE_COMPARISON_POLICY_INVALID",
          id
        );
        if (!ALLOWED_ABSENCE_COMPARISON_POLICIES.has(policy))
          throw worksheetError("ABSENCE_COMPARISON_POLICY_INVALID", id);
        return policy;
      })(),
      ...(requirement.absenceCertificationId
        ? {
            absenceCertificationId: requireNonEmptyString(
              requirement.absenceCertificationId,
              "ABSENCE_CERTIFICATION_ID_INVALID",
              id
            ),
          }
        : {}),
      coverageAggregationPolicy: (() => {
        const policy =
          requirement.coverageAggregationPolicy || "ALL_COMPONENT_EFFECTS";
        if (!ALLOWED_COVERAGE_AGGREGATION_POLICIES.has(policy))
          throw worksheetError("COVERAGE_AGGREGATION_POLICY_INVALID", id);
        if (
          policy === "COVERAGE_ROLES_ONLY" &&
          components.every(({ factRole }) =>
            [
              "CONDITION",
              "DEFINITION",
              "LIMIT",
              "DEDUCTIBLE",
              "DOCUMENT_STATUS",
            ].includes(factRole)
          )
        )
          throw worksheetError("COVERAGE_ROLE_COMPONENT_REQUIRED", id);
        return policy;
      })(),
      ...(componentFamilyContract ? { componentFamilyContract } : {}),
      bindingStructures,
      scopeRules,
      components,
    };
    if (validatedRequirement.absenceComparisonPolicy) {
      const certification = assertCoverageOnlyCertification({
        categoryView: catalog.categoryView,
        catalogId: catalog.catalogId,
        requirement: validatedRequirement,
      });
      validatedRequirement.absenceCertification = {
        certificationId: certification.certificationId,
        registryId: coverageOnlyCertificationRegistry.registryId,
        requirementDigest: certification.requirementDigest,
      };
    }
    return validatedRequirement;
  });
}

function removeOverlappingRanges(ranges) {
  const selected = [];
  for (const range of [...ranges].sort((left, right) => {
    const priorityDifference =
      (left.discoveryPriority || 0) - (right.discoveryPriority || 0);
    if (priorityDifference) return priorityDifference;
    const leftLength = left.originalEnd - left.originalStart;
    const rightLength = right.originalEnd - right.originalStart;
    const lengthDifference =
      (left.discoveryPriority || 0) === 0
        ? rightLength - leftLength
        : leftLength - rightLength;
    return lengthDifference || left.originalStart - right.originalStart;
  })) {
    const overlaps = selected.some(
      (candidate) =>
        range.originalStart < candidate.originalEnd &&
        range.originalEnd > candidate.originalStart
    );
    if (!overlaps) selected.push(range);
  }
  return selected.sort(
    (left, right) => left.originalStart - right.originalStart
  );
}

function candidateId({
  documentFingerprint,
  requirementId,
  componentId,
  pageNumber,
  documentStart,
  documentEnd,
}) {
  const identity = [
    documentFingerprint,
    requirementId,
    componentId,
    pageNumber,
    documentStart,
    documentEnd,
  ].join(":");
  return `candidate:${crypto.createHash("sha256").update(identity).digest("hex")}`;
}

function clauseStartBefore(text, beforeOffset) {
  for (let index = beforeOffset - 1; index >= 0; index -= 1) {
    if (/[.!?;:\n\r]/u.test(text[index])) return index + 1;
  }
  return 0;
}

function nearestGovernor({ pageText, occurrenceStart, aliases }) {
  const clauseStart = clauseStartBefore(pageText, occurrenceStart);
  const prefix = pageText.slice(clauseStart, occurrenceStart);
  let selected = null;
  for (const alias of aliases) {
    for (const range of findAliasRanges(prefix, alias)) {
      const candidate = {
        matchedAlias: alias,
        pageStart: clauseStart + range.originalStart,
        pageEnd: clauseStart + range.originalEnd,
      };
      if (!selected || candidate.pageStart > selected.pageStart)
        selected = candidate;
    }
  }
  return selected;
}

function isControlledCoordinationSeparator(value) {
  const normalized = normalizeWithOffsetMap(value).normalized;
  const hasComma = String(value).includes(",");
  if (!normalized) return hasComma;
  const containsSeparator =
    hasComma || /\b(?:und|oder|sowie)\b/u.test(normalized);
  const remainder = normalized
    .replace(/\b(?:und|oder|sowie)\b/gu, "")
    .replace(/\s/gu, "");
  return containsSeparator && remainder.length === 0;
}

function hasTrailingCoordinationHyphen(pageText, occurrence) {
  if (pageText[occurrence.pageEnd - 1] === "-") return true;
  let cursor = occurrence.pageEnd;
  while (cursor < pageText.length && /[\t ]/u.test(pageText[cursor]))
    cursor += 1;
  return pageText[cursor] === "-";
}

function rightHeadAfterOccurrence({
  pageText,
  occurrence,
  contextEnd,
  headSuffixes,
}) {
  const tail = pageText.slice(occurrence.pageEnd, contextEnd);
  for (const match of tail.matchAll(/\p{L}+/gu)) {
    const word = match[0];
    const normalizedWord = normalizeWithOffsetMap(word).normalized;
    const matchedSuffix = headSuffixes.find((suffix) =>
      normalizedWord.endsWith(normalizeWithOffsetMap(suffix).normalized)
    );
    if (!matchedSuffix) continue;
    const connector = tail.slice(0, match.index);
    if (!/(?:,|\b(?:und|oder|sowie)\b)/iu.test(connector)) continue;
    return {
      matchedAlias: word,
      pageStart: occurrence.pageEnd + match.index,
      pageEnd: occurrence.pageEnd + match.index + word.length,
    };
  }
  return null;
}

function stableBindingGroupId({
  documentFingerprint,
  requirementId,
  structureIndex,
  pageNumber,
  governorPageStart,
  candidateIds,
}) {
  const identity = [
    documentFingerprint,
    requirementId,
    structureIndex,
    pageNumber,
    governorPageStart,
    ...candidateIds,
  ].join(":");
  return `binding-group:${crypto
    .createHash("sha256")
    .update(identity)
    .digest("hex")}`;
}

/**
 * Builds only catalog-authorized shared binding groups. A group constrains
 * candidate relevance/scope equality; it never determines coverage or money.
 * Side effects: none. Role: transform.
 */
function buildRequirementBindingGroups({
  requirement,
  components,
  pages,
  documentFingerprint,
}) {
  const pageByNumber = new Map(pages.map((page) => [page.pageNumber, page]));
  const groups = [];

  requirement.bindingStructures.forEach((structure, structureIndex) => {
    if (structure.type === SHARED_SPAN) {
      const spanBuckets = new Map();
      for (const component of components) {
        if (!structure.memberComponentIds.includes(component.id)) continue;
        for (const occurrence of component.occurrences) {
          const key = [
            occurrence.pageNumber,
            occurrence.documentStart,
            occurrence.documentEnd,
          ].join(":");
          if (!spanBuckets.has(key)) spanBuckets.set(key, []);
          spanBuckets.get(key).push({ componentId: component.id, occurrence });
        }
      }
      for (const candidates of spanBuckets.values()) {
        const componentCounts = new Map();
        for (const candidate of candidates)
          componentCounts.set(
            candidate.componentId,
            (componentCounts.get(candidate.componentId) || 0) + 1
          );
        const containsEveryDeclaredComponent =
          structure.memberComponentIds.every(
            (componentId) => componentCounts.get(componentId) === 1
          ) && componentCounts.size === structure.memberComponentIds.length;
        if (!containsEveryDeclaredComponent) continue;
        const sorted = [...candidates].sort(
          (left, right) =>
            structure.memberComponentIds.indexOf(left.componentId) -
            structure.memberComponentIds.indexOf(right.componentId)
        );
        const first = sorted[0].occurrence;
        const candidateIds = sorted.map(
          ({ occurrence }) => occurrence.candidateId
        );
        groups.push({
          id: stableBindingGroupId({
            documentFingerprint,
            requirementId: requirement.id,
            structureIndex,
            pageNumber: first.pageNumber,
            governorPageStart: first.pageStart,
            candidateIds,
          }),
          requirementId: requirement.id,
          type: SHARED_SPAN,
          constraint: structure.constraint,
          governorText: first.exactText,
          candidateIds,
        });
      }
      return;
    }
    if (structure.type === RIGHT_HEADED_COORDINATION) {
      const buckets = new Map();
      for (const component of components) {
        if (!structure.memberComponentIds.includes(component.id)) continue;
        for (const occurrence of component.occurrences) {
          const page = pageByNumber.get(occurrence.pageNumber);
          if (!hasTrailingCoordinationHyphen(page.text, occurrence)) continue;
          const key = String(occurrence.pageNumber);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push({ componentId: component.id, occurrence });
        }
      }

      for (const candidates of buckets.values()) {
        const sorted = [...candidates].sort(
          (left, right) =>
            left.occurrence.pageStart - right.occurrence.pageStart
        );
        const runs = [];
        let run = [];
        for (const candidate of sorted) {
          const previous = run.at(-1);
          if (
            previous &&
            !isControlledCoordinationSeparator(
              pageByNumber
                .get(candidate.occurrence.pageNumber)
                .text.slice(
                  previous.occurrence.pageEnd,
                  candidate.occurrence.pageStart
                )
            )
          ) {
            runs.push(run);
            run = [];
          }
          run.push(candidate);
        }
        if (run.length > 0) runs.push(run);

        for (const coordinated of runs) {
          const componentCounts = new Map();
          for (const candidate of coordinated)
            componentCounts.set(
              candidate.componentId,
              (componentCounts.get(candidate.componentId) || 0) + 1
            );
          const containsEveryDeclaredComponent =
            structure.memberComponentIds.every(
              (componentId) => componentCounts.get(componentId) === 1
            ) && componentCounts.size === structure.memberComponentIds.length;
          if (!containsEveryDeclaredComponent) continue;

          const page = pageByNumber.get(coordinated[0].occurrence.pageNumber);
          const last = coordinated.at(-1).occurrence;
          const head = rightHeadAfterOccurrence({
            pageText: page.text,
            occurrence: last,
            contextEnd: last.context.pageEnd,
            headSuffixes: structure.headSuffixes,
          });
          if (!head) continue;
          const candidateIds = coordinated.map(
            ({ occurrence }) => occurrence.candidateId
          );
          groups.push({
            id: stableBindingGroupId({
              documentFingerprint,
              requirementId: requirement.id,
              structureIndex,
              pageNumber: last.pageNumber,
              governorPageStart: head.pageStart,
              candidateIds,
            }),
            requirementId: requirement.id,
            type: RIGHT_HEADED_COORDINATION,
            constraint: structure.constraint,
            governorText: head.matchedAlias,
            candidateIds,
          });
        }
      }
      return;
    }
    const buckets = new Map();
    for (const component of components) {
      if (!structure.memberComponentIds.includes(component.id)) continue;
      for (const occurrence of component.occurrences) {
        const page = pageByNumber.get(occurrence.pageNumber);
        const governor = nearestGovernor({
          pageText: page.text,
          occurrenceStart: occurrence.pageStart,
          aliases: structure.governorAliases,
        });
        if (!governor || governor.pageEnd > occurrence.pageStart) continue;
        const key = [
          occurrence.pageNumber,
          occurrence.context.pageStart,
          occurrence.context.pageEnd,
          governor.pageStart,
          governor.pageEnd,
        ].join(":");
        if (!buckets.has(key)) buckets.set(key, []);
        buckets
          .get(key)
          .push({ componentId: component.id, occurrence, governor });
      }
    }

    for (const candidates of buckets.values()) {
      const sorted = [...candidates].sort(
        (left, right) => left.occurrence.pageStart - right.occurrence.pageStart
      );
      const runs = [];
      let run = [];
      for (const candidate of sorted) {
        const previous = run.at(-1);
        if (
          previous &&
          !isControlledCoordinationSeparator(
            pageByNumber
              .get(candidate.occurrence.pageNumber)
              .text.slice(
                previous.occurrence.pageEnd,
                candidate.occurrence.pageStart
              )
          )
        ) {
          runs.push(run);
          run = [];
        }
        run.push(candidate);
      }
      if (run.length > 0) runs.push(run);

      for (const coordinated of runs) {
        const componentCounts = new Map();
        for (const candidate of coordinated)
          componentCounts.set(
            candidate.componentId,
            (componentCounts.get(candidate.componentId) || 0) + 1
          );
        const containsEveryDeclaredComponent =
          structure.memberComponentIds.every(
            (componentId) => componentCounts.get(componentId) === 1
          ) && componentCounts.size === structure.memberComponentIds.length;
        if (!containsEveryDeclaredComponent) continue;

        const candidateIds = coordinated.map(
          ({ occurrence }) => occurrence.candidateId
        );
        const first = coordinated[0];
        groups.push({
          id: stableBindingGroupId({
            documentFingerprint,
            requirementId: requirement.id,
            structureIndex,
            pageNumber: first.occurrence.pageNumber,
            governorPageStart: first.governor.pageStart,
            candidateIds,
          }),
          requirementId: requirement.id,
          type: structure.type,
          constraint: structure.constraint,
          governorText: first.governor.matchedAlias,
          candidateIds,
        });
      }
    }
  });

  const groupIdByCandidateId = new Map();
  for (const group of groups) {
    for (const candidateId of group.candidateIds) {
      if (groupIdByCandidateId.has(candidateId))
        throw worksheetError("CANDIDATE_MULTIPLE_BINDING_GROUPS", candidateId);
      groupIdByCandidateId.set(candidateId, group.id);
    }
  }
  return {
    groups,
    components: components.map((component) => ({
      ...component,
      occurrences: component.occurrences.map((occurrence) => {
        const bindingGroupId = groupIdByCandidateId.get(occurrence.candidateId);
        return bindingGroupId ? { ...occurrence, bindingGroupId } : occurrence;
      }),
    })),
  };
}

/**
 * Enumerates controlled aliases across every physical page and creates a
 * candidate-only worksheet for inspection before any LLM call.
 *
 * Inputs: canonical V3 PageMap document, document fingerprint and catalog.
 * Output: immutable-by-convention JSON data. Side effects: none. Role: transform.
 */
function buildControlledOccurrenceWorksheet({
  document,
  documentFingerprint,
  catalog,
  contextMaxChars = DEFAULT_CONTEXT_MAX_CHARS,
  fallbackWordsEachSide = DEFAULT_FALLBACK_WORDS_EACH_SIDE,
  scopeWordsBefore = DEFAULT_SCOPE_WORDS_BEFORE,
}) {
  const fingerprint = requireNonEmptyString(
    documentFingerprint,
    "DOCUMENT_FINGERPRINT_REQUIRED",
    "documentFingerprint"
  );
  const { pageContent, pages } = validateDocument(document);
  const requirements = validateCatalog(catalog);
  const activationScopes = clauseActivationScopes(pages);
  const exactClauseCodeGovernors = exactClauseCodeFieldGovernors({
    pages,
    documentFingerprint: fingerprint,
    activationScopes,
  });
  const clauseSectionCounts = new Map();
  for (const page of pages)
    for (const heading of page.sectionHeadings) {
      if (!heading.clauseCode) continue;
      clauseSectionCounts.set(
        heading.clauseCode,
        (clauseSectionCounts.get(heading.clauseCode) || 0) + 1
      );
    }
  const structuralUnits = requirements.some((requirement) =>
    requirement.components.some(
      (component) => component.followingStructuralBoundaryProofContractId
    )
  )
    ? followingStructuralUnitIndex(pages)
    : [];
  const sourceDocumentId = String(
    document.sourceDocumentId || document.id || fingerprint
  );

  const bindingGroups = [];
  const worksheetRequirements = requirements.map((requirement) => {
    const rawComponents = requirement.components.map((component) => {
      const occurrences = [];
      for (const page of pages) {
        const pageRanges = [];
        for (const alias of component.aliases) {
          for (const range of findAliasRanges(page.text, alias))
            pageRanges.push({
              ...range,
              matchedAlias: alias,
              discoveryPriority: 0,
            });
        }
        for (const search of component.conceptSearches) {
          for (const range of findConceptSearchRanges(page.text, search))
            pageRanges.push({
              ...range,
              matchedAlias: `CONCEPT_SEARCH:${search.id}`,
              discoveryPriority: 1,
            });
        }

        for (const range of removeOverlappingRanges(pageRanges)) {
          const documentStart = page.start + range.originalStart;
          const documentEnd = page.start + range.originalEnd;
          const context = structuralContext({
            pageText: page.text,
            occurrenceStart: range.originalStart,
            occurrenceEnd: range.originalEnd,
            maxChars: contextMaxChars,
            fallbackWordsEachSide,
            followingBoundaryLineStarts: page.structuralBoundaryLineStarts,
          });
          const evidenceContext =
            component.contextMode === CONTEXT_MODE.CLAUSE_SECTION
              ? clauseSectionContext({
                  pageText: page.text,
                  occurrenceStart: range.originalStart,
                  occurrenceEnd: range.originalEnd,
                  fallback: context,
                })
              : context;
          const currentSectionBoundary = page.sectionHeadings
            .filter(({ pageStart }) => pageStart <= range.originalStart)
            .at(-1);
          const currentCoverageGovernor = page.coverageGovernors
            .filter(
              ({ pageStart, pageEnd }) =>
                pageEnd <= range.originalStart &&
                (!currentSectionBoundary ||
                  pageStart >= currentSectionBoundary.pageStart)
            )
            .at(-1);
          const currentObjectClassificationBoundary = [
            ...page.objectClassificationGovernors,
            ...page.sectionHeadings.map((heading) => ({
              ...heading,
              kind: "SECTION_BOUNDARY",
            })),
            ...page.coverageGovernors.map((governor) => ({
              ...governor,
              kind: "COVERAGE_BOUNDARY",
            })),
            ...page.clauseBoundaries,
          ]
            .filter(({ pageEnd }) => pageEnd <= range.originalStart)
            .sort(
              (left, right) =>
                left.pageStart - right.pageStart || left.pageEnd - right.pageEnd
            )
            .at(-1);
          const scopeFloor = [currentSectionBoundary, currentCoverageGovernor]
            .filter(Boolean)
            .sort((left, right) => left.pageStart - right.pageStart)
            .at(-1) || { pageStart: 0, pageEnd: 0 };
          const precedingScopeLead = precedingWordWindow(
            page.text,
            range.originalStart,
            scopeWordsBefore
          );
          const rawScopeLead =
            context.unitType === "LIST_ITEM"
              ? precedingListGovernorWindow(
                  page.text,
                  context.pageStart,
                  precedingScopeLead,
                  scopeFloor
                )
              : precedingScopeLead;
          const scopeLeadStart = Math.max(
            rawScopeLead.pageStart,
            currentSectionBoundary?.pageStart ?? rawScopeLead.pageStart,
            currentCoverageGovernor?.kind === "SEMANTIC_COVERAGE_HEADING"
              ? currentCoverageGovernor.pageStart
              : rawScopeLead.pageStart
          );
          const scopeLead = {
            pageStart: scopeLeadStart,
            pageEnd: rawScopeLead.pageEnd,
            text: page.text.slice(scopeLeadStart, rawScopeLead.pageEnd),
          };
          const sectionScopeHint = currentSectionBoundary
            ? currentSectionBoundary.scopeKey ||
              currentSectionBoundary.scopeKeys?.length
              ? {
                  ...currentSectionBoundary,
                  source: "CURRENT_PAGE_HEADING",
                }
              : null
            : page.inheritedSectionHeading
              ? {
                  ...page.inheritedSectionHeading,
                  source: "PRECEDING_PAGE_HEADING",
                }
              : null;
          const coverageGovernorHint = currentCoverageGovernor
            ? { ...currentCoverageGovernor, source: "CURRENT_PAGE_GOVERNOR" }
            : !currentSectionBoundary && page.inheritedCoverageGovernor
              ? {
                  ...page.inheritedCoverageGovernor,
                  source: "PRECEDING_PAGE_GOVERNOR",
                }
              : null;
          const activeObjectClassificationGovernor =
            currentObjectClassificationBoundary?.kind ===
              "OBJECT_CLASSIFICATION_BOUNDARY" &&
            currentObjectClassificationBoundary.classificationKind === "OBJECT"
              ? {
                  ...currentObjectClassificationBoundary,
                  source: "CURRENT_PAGE_OBJECT_CLASSIFICATION",
                }
              : !currentObjectClassificationBoundary &&
                  page.inheritedObjectClassificationGovernor
                ? {
                    ...page.inheritedObjectClassificationGovernor,
                    source: "PRECEDING_PAGE_OBJECT_CLASSIFICATION",
                  }
                : null;
          const objectClassificationGovernorHint =
            activeObjectClassificationGovernor &&
            context.unitType === "LIST_ITEM" &&
            context.text.includes(pageContent.slice(documentStart, documentEnd))
              ? activeObjectClassificationGovernor
              : null;
          const currentVariantHeading = page.variantHeadings
            .filter(({ pageEnd }) => pageEnd <= range.originalStart)
            .at(-1);
          const variantScopeHint = currentVariantHeading
            ? { ...currentVariantHeading, source: "CURRENT_PAGE_HEADING" }
            : !currentSectionBoundary && page.inheritedVariantHeading
              ? {
                  ...page.inheritedVariantHeading,
                  source: "PRECEDING_PAGE_HEADING",
                }
              : null;
          const currentFieldGovernor = page.fieldGovernors
            .filter(({ pageEnd }) => pageEnd <= range.originalStart)
            .at(-1);
          const fieldGovernorHint =
            currentFieldGovernor &&
            evidenceContext.unitType === "LIST_ITEM" &&
            currentFieldGovernor.pageEnd <= evidenceContext.pageStart &&
            evidenceContext.pageStart - currentFieldGovernor.pageEnd <= 2_000 &&
            (!currentVariantHeading ||
              currentFieldGovernor.pageStart >
                currentVariantHeading.pageStart) &&
            (!currentSectionBoundary ||
              currentFieldGovernor.pageStart > currentSectionBoundary.pageStart)
              ? {
                  ...currentFieldGovernor,
                  documentStart: page.start + currentFieldGovernor.pageStart,
                  documentEnd: page.start + currentFieldGovernor.pageEnd,
                  source: "CURRENT_PAGE_FIELD_GOVERNOR",
                }
              : null;
          const exactClauseCodeFieldGovernorHints =
            component.fieldGovernorPolicy ===
              EXACT_CLAUSE_CODE_FIELD_GOVERNOR_POLICY &&
            sectionScopeHint?.clauseCode &&
            clauseSectionCounts.get(sectionScopeHint.clauseCode) === 1
              ? (
                  exactClauseCodeGovernors.get(
                    sectionScopeHint.clauseCode.toLocaleUpperCase("de")
                  ) || []
                ).filter(({ scopeKey }) =>
                  sectionScopeHint.scopeKeys?.length
                    ? sectionScopeHint.scopeKeys.includes(scopeKey)
                    : sectionScopeHint.scopeKey === scopeKey
                )
              : [];
          occurrences.push({
            candidateId: candidateId({
              documentFingerprint: fingerprint,
              requirementId: requirement.id,
              componentId: component.id,
              pageNumber: page.pageNumber,
              documentStart,
              documentEnd,
            }),
            matchedAlias: range.matchedAlias,
            pageNumber: page.pageNumber,
            physicalPageNumber: page.physicalPageNumber,
            printedPageLabel: page.printedPageLabel,
            pageScopeHints: page.scopeHints,
            sectionScopeHint,
            coverageGovernorHint,
            objectClassificationGovernorHint,
            variantScopeHint,
            fieldGovernorHint,
            ...(exactClauseCodeFieldGovernorHints.length > 0
              ? { exactClauseCodeFieldGovernorHints }
              : {}),
            pageStart: range.originalStart,
            pageEnd: range.originalEnd,
            documentStart,
            documentEnd,
            exactText: pageContent.slice(documentStart, documentEnd),
            context: {
              unitType: evidenceContext.unitType,
              pageStart: evidenceContext.pageStart,
              pageEnd: evidenceContext.pageEnd,
              documentStart: page.start + evidenceContext.pageStart,
              documentEnd: page.start + evidenceContext.pageEnd,
              text: evidenceContext.text,
              ...(component.followingStructuralBoundaryProofContractId
                ? {
                    followingStructuralBoundaryProof:
                      followingStructuralBoundaryProof({
                        pageContent,
                        pages,
                        structuralUnits,
                        occurrencePage: page,
                        context: {
                          documentStart: page.start + evidenceContext.pageStart,
                          documentEnd: page.start + evidenceContext.pageEnd,
                        },
                      }),
                  }
                : {}),
            },
            scopeLead: {
              pageStart: scopeLead.pageStart,
              pageEnd: scopeLead.pageEnd,
              documentStart: page.start + scopeLead.pageStart,
              documentEnd: page.start + scopeLead.pageEnd,
              text: scopeLead.text,
            },
          });
        }
      }
      return {
        id: component.id,
        label: component.label,
        factRole: component.factRole,
        contextMode: component.contextMode,
        aliases: component.aliases,
        ...(component.conceptSearches.length > 0
          ? { conceptSearches: component.conceptSearches }
          : {}),
        ...(component.followingStructuralBoundaryProofContractId
          ? {
              followingStructuralBoundaryProofContractId:
                component.followingStructuralBoundaryProofContractId,
            }
          : {}),
        ...(component.fieldGovernorPolicy
          ? { fieldGovernorPolicy: component.fieldGovernorPolicy }
          : {}),
        terminalState:
          occurrences.length > 0
            ? "CONTROLLED_CANDIDATES_FOUND"
            : "NO_CONTROLLED_CANDIDATE",
        occurrenceCount: occurrences.length,
        occurrences,
      };
    });
    const grouped = buildRequirementBindingGroups({
      requirement,
      components: rawComponents,
      pages,
      documentFingerprint: fingerprint,
    });
    bindingGroups.push(...grouped.groups);
    return {
      id: requirement.id,
      label: requirement.label,
      requestedFields: requirement.requestedFields,
      ...(requirement.optionalFields.length > 0
        ? { optionalFields: requirement.optionalFields }
        : {}),
      scopeRules: requirement.scopeRules,
      scopePolicy: requirement.scopePolicy,
      componentSatisfactionPolicy: requirement.componentSatisfactionPolicy,
      ...(requirement.negativeSearchPolicy
        ? { negativeSearchPolicy: requirement.negativeSearchPolicy }
        : {}),
      ...(requirement.absenceMeaning
        ? { absenceMeaning: requirement.absenceMeaning }
        : {}),
      ...(requirement.absenceComparisonPolicy
        ? { absenceComparisonPolicy: requirement.absenceComparisonPolicy }
        : {}),
      ...(requirement.absenceCertification
        ? { absenceCertification: requirement.absenceCertification }
        : {}),
      coverageAggregationPolicy: requirement.coverageAggregationPolicy,
      ...(requirement.componentFamilyContract
        ? { componentFamilyContract: requirement.componentFamilyContract }
        : {}),
      componentCount: grouped.components.length,
      components: grouped.components,
    };
  });

  const allComponents = worksheetRequirements.flatMap(
    (requirement) => requirement.components
  );
  return {
    schemaVersion: WORKSHEET_SCHEMA_VERSION,
    candidateOnly: true,
    catalog: {
      id: String(catalog.catalogId || "unknown"),
      categoryView: String(catalog.categoryView || "unknown"),
      schemaVersion: catalog.schemaVersion,
    },
    document: {
      sourceDocumentId,
      title: String(document.title || "Unknown document"),
      fingerprint,
      physicalPages: pages.length,
      pageContentSha256: crypto
        .createHash("sha256")
        .update(pageContent)
        .digest("hex"),
      pageContentLength: pageContent.length,
    },
    summary: {
      requirementCount: worksheetRequirements.length,
      componentCount: allComponents.length,
      componentsWithCandidates: allComponents.filter(
        ({ occurrenceCount }) => occurrenceCount > 0
      ).length,
      componentsWithoutCandidates: allComponents.filter(
        ({ occurrenceCount }) => occurrenceCount === 0
      ).length,
      occurrenceCount: allComponents.reduce(
        (sum, component) => sum + component.occurrenceCount,
        0
      ),
    },
    bindingGroups,
    requirements: worksheetRequirements,
  };
}

module.exports = {
  CONTEXT_MODE,
  DEFAULT_CLAUSE_SECTION_MAX_CHARS,
  DEFAULT_CONTEXT_MAX_CHARS,
  DEFAULT_FALLBACK_WORDS_EACH_SIDE,
  DEFAULT_SCOPE_WORDS_BEFORE,
  FOLLOWING_STRUCTURAL_BOUNDARY_KIND,
  FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID,
  EXACT_CLAUSE_CODE_FIELD_GOVERNOR_CONTRACT_ID,
  EXACT_CLAUSE_CODE_FIELD_GOVERNOR_POLICY,
  MAX_FOLLOWING_STRUCTURAL_BOUNDARY_DISTANCE,
  WORKSHEET_SCHEMA_VERSION,
  buildControlledOccurrenceWorksheet,
  findAliasRanges,
  normalizeWithOffsetMap,
  structuralContext,
  validFollowingStructuralBoundaryProof,
};
