const POLICY_COMPARISON_MODE = Object.freeze({
  LF_REFERENCE_A_TO_B: "LF_IMMO_REFERENCE_A_TO_B_V1",
  SYMMETRIC_A_B: "SYMMETRIC_A_B_CORE5_V1",
});

const DEFAULT_POLICY_COMPARISON_MODE = POLICY_COMPARISON_MODE.SYMMETRIC_A_B;

const POLICY_COMPARISON_MODES = Object.freeze([
  Object.freeze({
    id: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
    name: "LF-IMMO-Referenzvergleich (A → B)",
    description:
      "LF IMMO auf Seite A analysieren und ausschließlich zu diesen A-Zeilen Gegenstücke im Dokumentpaket B suchen.",
    direction: "A_TO_B",
    sideALabel: "LF-IMMO-Referenzdokument A",
    sideBLabel: "Vergleichsdokumente B",
    maxDocumentsA: 1,
    maxDocumentsB: 9,
    discoversSideBOnly: false,
  }),
  Object.freeze({
    id: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
    name: "Vollständiger A/B-Vergleich",
    description:
      "Beide Dokumentpakete vollständig und gleichberechtigt nach dem bestehenden V3.6.0-Verfahren vergleichen.",
    direction: "SYMMETRIC",
    sideALabel: "Dokumentpaket A",
    sideBLabel: "Dokumentpaket B",
    maxDocumentsA: 9,
    maxDocumentsB: 9,
    discoversSideBOnly: true,
  }),
]);

const MODES_BY_ID = new Map(
  POLICY_COMPARISON_MODES.map((mode) => [mode.id, mode])
);

class PolicyComparisonModeError extends Error {
  constructor(message) {
    super(message);
    this.name = "PolicyComparisonModeError";
  }
}

function normalizePolicyComparisonMode(value, { allowDefault = true } = {}) {
  if (value === null || value === undefined || String(value).trim() === "") {
    if (allowDefault) return DEFAULT_POLICY_COMPARISON_MODE;
    throw new PolicyComparisonModeError("Bitte Analyseverfahren auswählen.");
  }
  if (typeof value !== "string")
    throw new PolicyComparisonModeError("Ungültiges Analyseverfahren.");
  const normalized = value.trim().toUpperCase();
  if (!MODES_BY_ID.has(normalized))
    throw new PolicyComparisonModeError(
      `Unbekanntes Analyseverfahren '${normalized}'.`
    );
  return normalized;
}

function policyComparisonMode(value, options) {
  return MODES_BY_ID.get(normalizePolicyComparisonMode(value, options));
}

function publicPolicyComparisonModes() {
  return POLICY_COMPARISON_MODES.map((mode) => ({ ...mode }));
}

module.exports = {
  DEFAULT_POLICY_COMPARISON_MODE,
  POLICY_COMPARISON_MODE,
  POLICY_COMPARISON_MODES,
  PolicyComparisonModeError,
  normalizePolicyComparisonMode,
  policyComparisonMode,
  publicPolicyComparisonModes,
};
