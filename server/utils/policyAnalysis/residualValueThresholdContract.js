const RESIDUAL_VALUE_THRESHOLD_CONTRACT_ID =
  "VS02_RESIDUAL_VALUE_THRESHOLD_CLAUSE_V1";
const RESIDUAL_VALUE_THRESHOLD_QUALIFIER =
  "MINIMUM_RESIDUAL_VALUE_FOR_NEW_VALUE";

const NUMBER = "(?<percent>\\d{1,3}(?:[.,]\\d+)?)";
const OBJECT_PHRASE =
  "(?:\\s+(?:der|von)\\s+(?:versicherten\\s+)?(?:Gebäude(?:n)?(?:\\s+und\\s+(?:Betriebseinrichtungen|Sachen))?|Sachen|Betriebseinrichtungen))?";
const LOSS_TIME = "(?:\\s+im\\s+Schadenzeitpunkt)?";
const REFERENCE =
  "(?:\\s+(?<reference>des\\s+Neuwertes|des\\s+Neuwerts|der\\s+Neuherstellungskosten))?";

const THRESHOLD_PATTERNS = Object.freeze([
  {
    clauseMode: "CURRENT_VALUE_DOWNGRADE_BELOW_THRESHOLD",
    pattern: new RegExp(
      `(?:liegt|beträgt)\\s+der\\s+Zeitwert${OBJECT_PHRASE}${LOSS_TIME}\\s+` +
        `(?<comparison>unter|weniger\\s+als)\\s+${NUMBER}\\s*%${REFERENCE}` +
        `[\\s,;:–—-]{0,24}(?:so\\s+)?(?:wird|werden)[\\s\\S]{0,100}?` +
        `(?:maximal|höchstens|nur)\\s+der\\s+Zeitwert\\s+ersetzt`,
      "giu"
    ),
  },
  {
    clauseMode: "NEW_VALUE_MINIMUM_THRESHOLD",
    pattern: new RegExp(
      `Zeitwert${OBJECT_PHRASE}${LOSS_TIME}\\s+(?:von\\s+)?` +
        `(?<comparison>mindestens|zumindest|nicht\\s+weniger\\s+als)\\s+` +
        `${NUMBER}\\s*%${REFERENCE}[\\s\\S]{0,240}?` +
        `(?:volle\\s+Neuwertentschädigung|zum\\s+Neuwert\\s+(?:zu\\s+)?ersetzt)`,
      "giu"
    ),
  },
  {
    clauseMode: "NEW_VALUE_MINIMUM_THRESHOLD",
    pattern: new RegExp(
      `(?:volle\\s+Neuwertentschädigung|zum\\s+Neuwert\\s+(?:zu\\s+)?ersetzen)` +
        `[\\s\\S]{0,260}?Zeitwert${OBJECT_PHRASE}${LOSS_TIME}\\s+(?:von\\s+)?` +
        `(?<comparison>mindestens|zumindest|nicht\\s+weniger\\s+als)\\s+` +
        `${NUMBER}\\s*%${REFERENCE}`,
      "giu"
    ),
  },
]);

function normalizedReference(value) {
  if (/Neuherstellungskosten/iu.test(value || "")) return "REPLACEMENT_COST";
  if (/Neuwert/iu.test(value || "")) return "NEW_VALUE";
  return "IMPLICIT_NEW_VALUE";
}

function parseResidualValueThresholdClauses(text) {
  const source = String(text || "");
  const matches = [];
  for (const { clauseMode, pattern } of THRESHOLD_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const thresholdPercent = Number(match.groups.percent.replace(",", "."));
      if (
        !Number.isFinite(thresholdPercent) ||
        thresholdPercent <= 0 ||
        thresholdPercent > 100
      )
        continue;
      matches.push({
        contractId: RESIDUAL_VALUE_THRESHOLD_CONTRACT_ID,
        clauseMode,
        start: match.index,
        end: match.index + match[0].length,
        rawValue: match[0],
        thresholdPercent,
        normalizedPercent: match.groups.percent.replace(",", "."),
        comparison: "MINIMUM",
        referenceBase: normalizedReference(match.groups.reference),
      });
    }
  }
  const unique = new Map();
  for (const match of matches) {
    const key = `${match.start}:${match.end}:${match.thresholdPercent}`;
    if (!unique.has(key)) unique.set(key, match);
  }
  return [...unique.values()].sort(
    (left, right) => left.start - right.start || left.end - right.end
  );
}

function residualValueThresholdForOccurrence(occurrence) {
  const text = String(occurrence?.context?.text || "");
  const contextStart = Number(occurrence?.context?.documentStart);
  const occurrenceStart = Number(occurrence?.documentStart);
  const occurrenceEnd = Number(occurrence?.documentEnd);
  if (
    !Number.isInteger(contextStart) ||
    !Number.isInteger(occurrenceStart) ||
    !Number.isInteger(occurrenceEnd)
  )
    return null;
  const relativeStart = occurrenceStart - contextStart;
  const relativeEnd = occurrenceEnd - contextStart;
  if (
    relativeStart < 0 ||
    relativeEnd <= relativeStart ||
    relativeEnd > text.length
  )
    return null;
  return (
    parseResidualValueThresholdClauses(text).find(
      (match) => match.start <= relativeStart && match.end >= relativeEnd
    ) || null
  );
}

module.exports = {
  RESIDUAL_VALUE_THRESHOLD_CONTRACT_ID,
  RESIDUAL_VALUE_THRESHOLD_QUALIFIER,
  parseResidualValueThresholdClauses,
  residualValueThresholdForOccurrence,
};
