// Recovery anchors only. The open LLM inventory is authoritative and is built
// from every canonical PDF page. These terms may recover familiar wording but
// never define completeness and never become contractual facts without a
// page-bound evidence hit.
const FALLBACK_TOPICS = [
  {
    id: "selbstbehalt",
    label: "Selbstbehalt",
    terms: [
      "selbstbehalt",
      "selbstbehalts",
      "selbstbehaltsregelung",
      "selbstbehalte",
      "selbstbeteiligung",
      "franchise",
      "eigenanteil",
      "selbst zu tragen",
    ],
  },
  {
    id: "praemie",
    label: "Prämie",
    terms: ["prämie", "praemie", "beitrag", "jahresbeitrag"],
  },
  {
    id: "deckungssumme",
    label: "Deckungsgrenze",
    terms: [
      "deckungssumme",
      "deckungssummen",
      "deckungsgrenze",
      "deckungsgrenzen",
      "versicherungssumme",
      "höchstentschädigung",
      "höchstleistung",
      "sublimit",
    ],
  },
  {
    id: "ausschluss",
    label: "Ausschluss",
    terms: [
      "ausschluss",
      "ausschlüsse",
      "ausgeschlossen",
      "keine deckung",
      "nicht versichert",
    ],
  },
  {
    id: "obliegenheit",
    label: "Obliegenheit",
    terms: ["obliegenheit", "obliegenheiten", "anzeigepflicht", "meldepflicht"],
  },
  {
    id: "laufzeit-kuendigung",
    label: "Laufzeit und Kündigung",
    terms: ["laufzeit", "kündigung", "kuendigung", "vertragsdauer"],
  },
  {
    id: "wartezeit",
    label: "Wartezeit",
    terms: ["wartezeit", "karenz", "karenzzeit"],
  },
  {
    id: "schadenabwicklung",
    label: "Schadenabwicklung",
    terms: ["schadenmeldung", "schadenfall", "versicherungsfall", "fälligkeit"],
  },
];

module.exports = { FALLBACK_TOPICS };
