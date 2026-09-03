const {
  RESIDUAL_VALUE_THRESHOLD_CONTRACT_ID,
  parseResidualValueThresholdClauses,
  residualValueThresholdForOccurrence,
} = require("../../../utils/policyAnalysis/residualValueThresholdContract");

function occurrence(text, exactText) {
  const contextStart = 1_000;
  const relativeStart = text.indexOf(exactText);
  if (relativeStart < 0) throw new Error("TEST_EXACT_TEXT_MISSING");
  return {
    exactText,
    documentStart: contextStart + relativeStart,
    documentEnd: contextStart + relativeStart + exactText.length,
    context: {
      text,
      documentStart: contextStart,
      documentEnd: contextStart + text.length,
    },
  };
}

describe("VS-02 residual value threshold contract", () => {
  test.each([
    [
      "Liegt der Zeitwert der Sachen unter 40 % der Neuherstellungskosten, wird maximal der Zeitwert ersetzt.",
      40,
      "REPLACEMENT_COST",
      "CURRENT_VALUE_DOWNGRADE_BELOW_THRESHOLD",
    ],
    [
      "Für Gebäude gilt ein Zeitwert von zumindest 42,5 % und damit die volle Neuwertentschädigung.",
      42.5,
      "IMPLICIT_NEW_VALUE",
      "NEW_VALUE_MINIMUM_THRESHOLD",
    ],
    [
      "Sämtliche zum Neuwert versicherte Gebäude und Sachen sind zum Neuwert zu ersetzen, sofern der Zeitwert der versicherten Gebäude und Sachen im Schadenzeitpunkt zumindest 20% des Neuwertes betragen hat.",
      20,
      "NEW_VALUE",
      "NEW_VALUE_MINIMUM_THRESHOLD",
    ],
  ])(
    "normalizes a complete threshold clause: %s",
    (text, thresholdPercent, referenceBase, clauseMode) => {
      expect(parseResidualValueThresholdClauses(text)).toEqual([
        expect.objectContaining({
          contractId: RESIDUAL_VALUE_THRESHOLD_CONTRACT_ID,
          thresholdPercent,
          referenceBase,
          clauseMode,
          comparison: "MINIMUM",
        }),
      ]);
    }
  );

  test.each([
    "Der Zeitwert wird aus dem Neuwert abzüglich Alter und Abnützung ermittelt.",
    "Der Zeitwert beträgt 40 %.",
    "Restwerte bis 15 % des jeweiligen Neuwertes werden ersetzt.",
    "Die Versicherungssumme weicht um nicht mehr als 20 % vom Versicherungswert ab.",
    "Die Grenze von 40 % gilt nicht und entfällt.",
    "Liegt der Zeitwert der Sachen unter 120 % der Neuherstellungskosten, wird maximal der Zeitwert ersetzt.",
  ])("rejects a non-qualifying percentage: %s", (text) => {
    expect(parseResidualValueThresholdClauses(text)).toEqual([]);
  });

  test("binds only the parsed clause overlapping the candidate", () => {
    const text = [
      "Die Versicherungssumme weicht um 20 % vom Versicherungswert ab.",
      "Liegt der Zeitwert der Sachen unter 40 % der Neuherstellungskosten, wird maximal der Zeitwert ersetzt.",
    ].join("\n");
    expect(
      residualValueThresholdForOccurrence(
        occurrence(text, "Zeitwert der Sachen unter 40 %")
      )
    ).toMatchObject({ thresholdPercent: 40 });
    expect(
      residualValueThresholdForOccurrence(
        occurrence(text, "Versicherungssumme")
      )
    ).toBeNull();
  });
});
