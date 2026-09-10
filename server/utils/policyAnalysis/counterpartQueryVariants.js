const { normalize } = require("./counterpartRetrievalPrimitives");

// Retrieval-only terminology families. They may widen navigation but never
// establish semantic equivalence or customer-visible coverage by themselves.
const CONTROLLED_TERM_FAMILIES = Object.freeze([
  [
    "versichert",
    "mitversichert",
    "eingeschlossen",
    "gedeckt",
    "deckung",
    "versicherungsschutz",
  ],
  [
    "ausgeschlossen",
    "nicht versichert",
    "kein versicherungsschutz",
    "keine deckung",
  ],
  ["selbstbehalt", "eigenbehalt", "franchise"],
  [
    "versicherungssumme",
    "deckungssumme",
    "höchstentschädigung",
    "hoechstentschaedigung",
    "entschädigungsgrenze",
    "entschaedigungsgrenze",
    "limit",
  ],
  ["kosten", "aufwendungen", "spesen"],
  ["versicherungsnehmer", "vn"],
  ["versicherer", "versicherungsgesellschaft"],
  ["einschließlich", "einschliesslich", "inklusive", "inkl"],
  ["beispielsweise", "zum beispiel", "z b"],
  ["erstes risiko", "erstrisiko"],
]);

function containsTerm(haystack, needle) {
  return ` ${haystack} `.includes(` ${needle} `);
}

function controlledQueryVariants(values) {
  const input = normalize((values || []).filter(Boolean).join(" "));
  if (!input) return [];
  return [
    ...new Set(
      CONTROLLED_TERM_FAMILIES.filter((family) =>
        family.some((term) => containsTerm(input, normalize(term)))
      ).flat()
    ),
  ].sort((left, right) => left.localeCompare(right, "de-AT"));
}

module.exports = {
  CONTROLLED_TERM_FAMILIES,
  controlledQueryVariants,
};
