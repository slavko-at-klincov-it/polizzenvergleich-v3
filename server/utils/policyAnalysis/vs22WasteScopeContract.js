const VS22_OTHER_SCOPE_BASIS = "VS22_LIABILITY_OR_STORAGE_NOT_DISPOSAL_COST";
const VS22_OTHER_SCOPE_REJECTION = "VS_22_OTHER_SCOPE_LIABILITY_OR_STORAGE";

function isSentenceBoundary(text, index) {
  const character = text[index];
  if (character === ";" || character === "!" || character === "?") return true;
  if (character !== ".") return false;
  let cursor = index + 1;
  while (cursor < text.length && /\s/u.test(text[cursor])) cursor += 1;
  if (cursor >= text.length) return true;
  return /\p{Lu}/u.test(text[cursor]);
}

function localOccurrenceSentence(occurrence) {
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
    text.slice(occurrenceStart, occurrenceEnd) !== occurrence.exactText
  )
    return String(occurrence?.exactText || "");

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

function sectionScopeKeys(occurrence) {
  return [
    occurrence?.sectionScopeHint?.scopeKey,
    ...(occurrence?.sectionScopeHint?.scopeKeys || []),
  ].filter(Boolean);
}

function isVs22LiabilityOrStorageOccurrence(occurrence) {
  const localSentence = localOccurrenceSentence(occurrence);
  const explicitLiabilitySection = sectionScopeKeys(occurrence).includes(
    "HAFTPFLICHT_INSURANCE"
  );
  const explicitLocalLiability =
    /\b(?:Haftpflicht|Umwelthaftpflicht|Schadenersatzverpflichtungen|AHVB)\b/iu.test(
      localSentence
    );
  const localStorageCarveback =
    /Nicht\s+unter\s+diesem\s+Ausschluss\s+fallen[\s\S]{0,260}?kurzfristige\s+Zwischenlagerung[\s\S]{0,180}?gefährlich\p{L}*\s+Abfall/iu.test(
      localSentence
    );
  return (
    explicitLiabilitySection || explicitLocalLiability || localStorageCarveback
  );
}

module.exports = {
  VS22_OTHER_SCOPE_BASIS,
  VS22_OTHER_SCOPE_REJECTION,
  isVs22LiabilityOrStorageOccurrence,
  localOccurrenceSentence,
};
