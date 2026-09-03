const VS36_SYMBOLIC_LIMIT_CONTRACT_ID =
  "VS36_SYMBOLIC_MAXIMUM_INDEMNITY_LIMIT_V1";

const SYMBOLIC_LIMIT_PATTERNS = Object.freeze([
  Object.freeze({
    type: "POSITION_INSURANCE_SUM_INDEX_ADJUSTED",
    normalizedValue:
      "Versicherungssumme der betroffenen Position, bis zum Schadenzeitpunkt indexangepasst",
    qualifier: "je betroffene Position",
    pattern:
      /Abweichend\s+von\s+den\s+ABS\s+bildet\s+die\s+in\s+der\s+Polizze\s+ausgewiesene\s+Versicherungssumme\s+der\s+vom\s+Schaden\s+betroffenen\s+Position,\s*unter\s+Berücksichtigung\s+der\s+prozentuellen\s+Indexveränderung\s+bis\s+zum\s+Schadenzeitpunkt,\s*die\s+Grenze\s+der\s+Ersatzleistung/giu,
  }),
  Object.freeze({
    type: "POLICY_OR_MAXIMUM_LIABILITY_SUM",
    normalizedValue:
      "Versicherungssumme oder Höchsthaftungssumme als Ersatzleistungsgrenze",
    qualifier: "allgemeine Ersatzleistungsgrenze",
    pattern:
      /Die\s+Ersatzleistung\s+ist\s+jedenfalls\s+mit\s+der\s+Versicherungssumme\s+bzw\.\s+mit\s+der\s+Höchsthaftungssumme\s+oder\s+dergleichen\s+begrenzt/giu,
  }),
  Object.freeze({
    type: "POSITION_INSURANCE_SUM",
    normalizedValue: "Versicherungssumme der betreffenden Position",
    qualifier: "je Position",
    pattern:
      /Die\s+Versicherungssumme\s+bildet\s+die\s+Grenze\s+für\s+die\s+Entschädigung\s+des\s+Versicherers,\s*wobei\s+die\s+Entschädigung\s+für\s+die\s+unter\s+jeder\s+einzelnen\s+Position\s+der\s+Polizze\s+versicherten\s+Sachen\s+durch\s+die\s+für\s+die\s+betreffende\s+Position\s+angegebene\s+Versicherungssumme\s+begrenzt\s+ist/giu,
  }),
  Object.freeze({
    type: "EVENT_POLICY_SUM_MAXIMIZED_WITH_INSURED_VALUE",
    normalizedValue:
      "Versicherungssumme, maximiert mit dem Versicherungswert",
    qualifier: "pro Schadenereignis",
    pattern:
      /Die\s+Entschädigungsleistung\s+ist\s+pro\s+Schadenereignis\s+mit\s+der\s+in\s+der\s+Polizze\s+vereinbarten\s+Versicherungssumme,\s*maximiert\s+mit\s+dem\s+Versicherungswert,\s*begrenzt/giu,
  }),
]);

function validOccurrenceContext(occurrence) {
  const contextText = occurrence?.context?.text;
  const contextStart = Number(occurrence?.context?.documentStart);
  const contextEnd = Number(occurrence?.context?.documentEnd);
  const occurrenceStart = Number(occurrence?.documentStart);
  const occurrenceEnd = Number(occurrence?.documentEnd);
  const exactText = String(occurrence?.exactText || "");
  if (
    typeof contextText !== "string" ||
    !["PARAGRAPH", "WORD_WINDOW_FALLBACK"].includes(
      occurrence?.context?.unitType
    ) ||
    !Number.isInteger(contextStart) ||
    !Number.isInteger(contextEnd) ||
    contextEnd !== contextStart + contextText.length ||
    !Number.isInteger(occurrenceStart) ||
    !Number.isInteger(occurrenceEnd) ||
    occurrenceStart < contextStart ||
    occurrenceEnd <= occurrenceStart ||
    occurrenceEnd > contextEnd ||
    contextText.slice(
      occurrenceStart - contextStart,
      occurrenceEnd - contextStart
    ) !== exactText
  )
    return null;
  return {
    text: contextText,
    occurrenceStart: occurrenceStart - contextStart,
    occurrenceEnd: occurrenceEnd - contextStart,
  };
}

function overlapsOccurrence(match, context) {
  const start = Number(match.index);
  const end = start + match[0].length;
  return start < context.occurrenceEnd && end > context.occurrenceStart;
}

function vs36SymbolicLimitForOccurrence(occurrence) {
  const context = validOccurrenceContext(occurrence);
  if (!context) return null;
  const matches = SYMBOLIC_LIMIT_PATTERNS.flatMap((contract) =>
    [...context.text.matchAll(contract.pattern)]
      .filter((match) => overlapsOccurrence(match, context))
      .map((match) => ({ contract, match }))
  );
  if (matches.length !== 1) return null;
  const { contract, match } = matches[0];
  return {
    match,
    value: {
      normalizedValue: contract.normalizedValue,
      valueType: "SYMBOLIC_LIMIT",
      unit: "CONTRACTUAL_SUM",
      limitKind: "CAPPED",
      qualifier: contract.qualifier,
      symbolicLimitType: contract.type,
      semanticContractId: VS36_SYMBOLIC_LIMIT_CONTRACT_ID,
    },
  };
}

module.exports = {
  SYMBOLIC_LIMIT_PATTERNS,
  VS36_SYMBOLIC_LIMIT_CONTRACT_ID,
  vs36SymbolicLimitForOccurrence,
};
