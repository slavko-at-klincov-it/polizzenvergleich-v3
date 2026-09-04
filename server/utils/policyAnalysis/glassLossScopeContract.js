const RG_COST_WITHOUT_EXPLICIT_GLASS_LOSS_SCOPE =
  "RG_COST_WITHOUT_EXPLICIT_GLASS_LOSS_SCOPE";
const {
  sourceBoundSectionScopeKeys,
} = require("./sourceBoundSectionScopeContract");

const EXPLICIT_GLASS_LOSS_SCOPE =
  /\b(?:Glasbruch(?:[\s-]*sch[aä]d\p{L}*)?|Glas[\s-]*sch[aä]d\p{L}*|Glasscheiben\p{L}*|versicherte\p{L}*\s+Gl[aä]ser\p{L}*|Glasversicherung\p{L}*|Glaspauschal\p{L}*)\b/iu;

function isSentenceBoundary(text, index) {
  const character = text[index];
  if (character === ";" || character === "!" || character === "?") return true;
  if (character === "\n" || character === "\r") {
    const before = text[index - 1];
    const after = text[index + 1];
    if (before === "\n" || before === "\r" || after === "\n" || after === "\r")
      return true;
    const followingLine =
      text.slice(index + 1).match(/^[ \t]*([^\r\n]*)/u)?.[1] || "";
    return /^(?:[-–—*•◦▪‣·]|\(?\d{1,3}[.)]|[a-zA-Z][.)])\s+/u.test(
      followingLine
    );
  }
  if (character !== ".") return false;
  let cursor = index + 1;
  while (cursor < text.length && /\s/u.test(text[cursor])) cursor += 1;
  if (cursor >= text.length) return true;
  return /\p{Lu}/u.test(text[cursor]);
}

/**
 * Returns only the sentence containing the server-owned occurrence. Invalid or
 * unavailable offsets deliberately return null instead of widening the scope.
 * Side effects: none. Role: transform.
 */
function occurrenceLocalSentence(occurrence) {
  const text = String(occurrence?.context?.text || "");
  const contextStart = Number(occurrence?.context?.documentStart);
  const occurrenceStart = Number(occurrence?.documentStart) - contextStart;
  const occurrenceEnd = Number(occurrence?.documentEnd) - contextStart;
  if (
    !Number.isInteger(contextStart) ||
    !Number.isInteger(occurrenceStart) ||
    !Number.isInteger(occurrenceEnd) ||
    occurrenceStart < 0 ||
    occurrenceEnd <= occurrenceStart ||
    occurrenceEnd > text.length ||
    text.slice(occurrenceStart, occurrenceEnd) !== occurrence?.exactText
  )
    return null;

  let sentenceStart = 0;
  for (let index = occurrenceStart - 1; index >= 0; index -= 1) {
    if (!isSentenceBoundary(text, index)) continue;
    sentenceStart = index + 1;
    break;
  }
  let sentenceEnd = text.length;
  for (let index = occurrenceEnd; index < text.length; index += 1) {
    if (!isSentenceBoundary(text, index)) continue;
    sentenceEnd = index + 1;
    break;
  }
  return text.slice(sentenceStart, sentenceEnd);
}

/**
 * Rejects generic cost wording from the replacement-glass view unless the
 * occurrence is locally tied to glass loss or structurally belongs to the
 * glass-insurance section. This contract is shared by triage and preparation
 * so a later authoritative binding cannot undo the scope rejection.
 * Side effects: none. Role: decide.
 */
function isRgCostWithoutExplicitGlassLossScope({
  categoryView,
  allCostMembers,
  occurrence,
}) {
  if (String(categoryView || "").toUpperCase() !== "RG" || !allCostMembers)
    return false;
  const observedSectionScopeKeys = sourceBoundSectionScopeKeys(occurrence);
  if (observedSectionScopeKeys.includes("GLASBRUCH_INSURANCE")) return false;
  return !EXPLICIT_GLASS_LOSS_SCOPE.test(
    occurrenceLocalSentence(occurrence) || occurrence?.exactText || ""
  );
}

module.exports = {
  RG_COST_WITHOUT_EXPLICIT_GLASS_LOSS_SCOPE,
  isRgCostWithoutExplicitGlassLossScope,
  occurrenceLocalSentence,
};
