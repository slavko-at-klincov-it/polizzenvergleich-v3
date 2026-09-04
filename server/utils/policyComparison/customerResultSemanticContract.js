const { POINT_OUTCOME } = require("./pointDecision");

const CUSTOMER_PREFIX_OUTCOMES = Object.freeze([
  ["Vorteil Polizze A:", POINT_OUTCOME.ADVANTAGE_A],
  ["Vorteil Polizze B:", POINT_OUTCOME.ADVANTAGE_B],
  ["Kein klarer Vorteil: gleichwertig –", POINT_OUTCOME.EQUIVALENT],
  [
    "Kein klarer Vorteil: nicht vergleichbar –",
    POINT_OUTCOME.NOT_COMPARABLE,
  ],
  [
    "Kein klarer Vorteil: Dokumentationsunterschied –",
    POINT_OUTCOME.DOCUMENTATION_DIFFERENCE,
  ],
  [
    "Kein klarer Vorteil: In beiden Polizzen wurde nach vollständiger kontrollierter Suche keine passende Vertragsregelung gefunden.",
    POINT_OUTCOME.NO_DOCUMENTED_ADVANTAGE,
  ],
  ["Kein klarer Vorteil: ungeklärt –", POINT_OUTCOME.UNCLEAR],
]);

/** Classifies only the stable customer-visible result signal. */
function customerOutcomeFromText(value) {
  const text = String(value || "");
  return (
    CUSTOMER_PREFIX_OUTCOMES.find(([prefix]) => text.startsWith(prefix))?.[1] ||
    null
  );
}

/**
 * Prevents an export from silently changing the server-owned point outcome.
 * Side effects: throws on semantic divergence. Role: validate.
 */
function assertCustomerResultSemanticParity({ categoryId, outcome, text }) {
  const customerOutcome = customerOutcomeFromText(text);
  if (customerOutcome !== outcome)
    throw new Error(
      `CUSTOMER_RESULT_SEMANTIC_MISMATCH:${String(categoryId || "UNKNOWN")}:${String(outcome || "UNKNOWN")}:${String(customerOutcome || "UNCLASSIFIED")}`
    );
  return true;
}

module.exports = {
  assertCustomerResultSemanticParity,
  customerOutcomeFromText,
};
