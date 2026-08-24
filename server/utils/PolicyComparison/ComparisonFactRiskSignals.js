const crypto = require("crypto");

const SIGNAL_RULE_VERSION = 1;
const SIGNALS = [
  [
    "money",
    /(?:\bEUR\b|€)\s*\d+(?:\.\d{3})*(?:,\d+)?|\d+(?:\.\d{3})*(?:,\d+)?\s*(?:\bEUR\b|€)/giu,
  ],
  ["percentage", /\b\d+(?:[.,]\d+)?\s*%/gu],
  [
    "duration",
    /\b\d+(?:[.,]\d+)?\s*(?:stunden?|tage?|wochen?|monate?|jahre?|lfm|laufende meter|m)\b/giu,
  ],
  [
    "limit",
    /\b(?:versicherungssumme|sublimit|höchstentschädigung|hoechstentschaedigung|erstes risiko|jahreshöchst(?:entschädigung|leistung)|maximal|mindestens|höchstens|unbegrenzt|bis(?=\s+(?:EUR|€|\d)))\b/giu,
  ],
  ["deductible", /\b(?:selbstbehalt|selbstbeteiligung|franchise)\b/giu],
  [
    "coverage",
    /\b(?:versichert|mitversichert|gedeckt|eingeschlossen|ersetzt|entschädigt|leistet)\b/giu,
  ],
  [
    "exclusion",
    /\b(?:ausgeschlossen|nicht versichert|kein versicherungsschutz|entfällt|entfaellt|ausgenommen)\b/giu,
  ],
  [
    "obligation",
    /\b(?:obliegenheit|verpflichtet|anzuzeigen|einzuhalten|unverzüglich|unverzueglich|polizeilich)\b/giu,
  ],
  [
    "condition",
    /\b(?:nur\s+ohne\b[^\n.;]{0,160}|voraussetzung|sofern|wenn|falls|nur wenn|unter der bedingung|innerhalb von|je schadenfall)\b/giu,
  ],
  [
    "insured_object",
    /\b(?:versicherte sachen|gebäudebestandteil|gebaeudebestandteil|zum gebäude|zum gebaeude)\b/giu,
  ],
  [
    "variant",
    /\b(?:grunddeckung|premiumschutz|variante\s+[A-Z]|[A-Z]-deckung)\b/gu,
  ],
  [
    "clause_reference",
    /\b(?:artikel|art\.|klausel|punkt|abschnitt)\s*[\dA-Z][\w./-]*/gu,
  ],
];

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function normalizedValue(kind, evidenceText) {
  const value = String(evidenceText)
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
  if (kind === "money") {
    const number = value
      .replace(/[^\d,.-]/gu, "")
      .replace(/\./gu, "")
      .replace(",", ".");
    return Number.isFinite(Number(number))
      ? String(Number(number))
      : value.toLowerCase();
  }
  if (kind === "percentage") return value.replace(/\s+/gu, "");
  return value.toLocaleLowerCase("de-AT");
}

const ComparisonFactRiskSignals = {
  version: SIGNAL_RULE_VERSION,
  detect(text = "", { sourceStart = 0 } = {}) {
    const value = String(text);
    const found = [];
    for (const [kind, pattern] of SIGNALS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(value))) {
        const evidenceText = match[0];
        const start = sourceStart + match.index;
        const end = start + evidenceText.length;
        found.push({
          signalKey: sha256(
            [SIGNAL_RULE_VERSION, kind, start, end, evidenceText].join("\u0000")
          ),
          kind,
          normalizedValue: normalizedValue(kind, evidenceText),
          sourceStart: start,
          sourceEnd: end,
          evidenceText,
          evidenceHash: sha256(evidenceText.normalize("NFKC")),
          ruleVersion: SIGNAL_RULE_VERSION,
        });
        if (match[0].length === 0) pattern.lastIndex += 1;
      }
    }
    return found.sort(
      (left, right) =>
        left.sourceStart - right.sourceStart ||
        left.kind.localeCompare(right.kind)
    );
  },
  hasSignals(text = "") {
    return this.detect(text).length > 0;
  },
};

module.exports = {
  ComparisonFactRiskSignals,
  SIGNALS,
  SIGNAL_RULE_VERSION,
};
