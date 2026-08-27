const {
  LEGACY_VS_USER_PROMPT,
  evaluateLegacyRows,
  evaluatePilotComparison,
} = require("../../../utils/policyAnalysis/vsPilotComparisonContract");

describe("vsPilotComparisonContract", () => {
  test("uses the exact established VS execution prompt", () => {
    expect(LEGACY_VS_USER_PROMPT).toBe(
      "Analysiere die vollständig im Kontext bereitgestellten Vertragsdokumente gemäß dem Systemprompt. Gib ausschließlich die definierte Tabelle für VS-01 bis VS-36 und anschließend den vorgeschriebenen Hinweis aus."
    );
  });

  test("scores semantic values across content and amount instead of B renderer wording", () => {
    const evaluation = evaluateLegacyRows({
      legacyRows: [
        {
          categoryId: "VS-21",
          coverage: "Ja",
          coverageAmount: "10 % der Gebäudeversicherungssumme (Feuer: 15 %)",
          documentedContent:
            "Kosten für Aufräumung und Abbruch sind mitversichert.",
          reviewStatus: "BELEGT",
        },
        {
          categoryId: "VS-28",
          coverage: "Ja",
          coverageAmount: "-",
          documentedContent: "Der Mietverlust gilt bis zu sechs Monaten.",
          reviewStatus: "BELEGT",
        },
      ],
      oracleDocument: {
        rows: [
          {
            categoryId: "VS-21",
            coverage: "Ja",
            reviewStatus: "BELEGT",
            requestedFieldStatus: "COMPLETE",
            normalizedValues: ["10 %", "15 %"],
          },
          {
            categoryId: "VS-28",
            coverage: "Ja",
            reviewStatus: "BELEGT",
            requestedFieldStatus: "COMPLETE",
            normalizedValues: ["6 Monate"],
          },
        ],
      },
    });

    expect(evaluation).toMatchObject({ passedRows: 2, totalRows: 2 });
  });

  test.each([
    ["110 % der Versicherungssumme", "10 %"],
    ["16 Monate Haftungszeit", "6 Monate"],
  ])("does not accept %s as semantic value %s", (observedValue, expected) => {
    const evaluation = evaluateLegacyRows({
      legacyRows: [
        {
          categoryId: "VS-21",
          coverage: "Ja",
          coverageAmount: observedValue,
          documentedContent: "",
          reviewStatus: "BELEGT",
        },
      ],
      oracleDocument: {
        rows: [
          {
            categoryId: "VS-21",
            coverage: "Ja",
            reviewStatus: "BELEGT",
            requestedFieldStatus: "COMPLETE",
            normalizedValues: [expected],
          },
        ],
      },
    });

    expect(evaluation).toMatchObject({ passedRows: 0, totalRows: 1 });
    expect(evaluation.results[0].reasons).toContain(
      `NORMALIZED_VALUE_MISSING:${expected}`
    );
  });

  test.each([
    [2, 0, false, false, false, "PILOT_NOT_READY"],
    [4, 2, true, true, false, "IMPROVED"],
    [4, 4, true, false, false, "EQUIVALENT"],
    [3, 4, false, false, true, "REGRESSED"],
  ])(
    "compares pilot %i/4 against legacy %i/4 without false positives",
    (pilotRows, legacyRows, absolutePass, improvement, regression, outcome) => {
      expect(
        evaluatePilotComparison({
          pilotEvaluation: {
            pass: pilotRows === 4,
            passedRows: pilotRows,
            totalRows: 4,
          },
          legacyEvaluation: { passedRows: legacyRows, totalRows: 4 },
        })
      ).toEqual({
        pilotAbsolutePass: absolutePass,
        pilotNonRegression: pilotRows >= legacyRows,
        pilotStrictImprovement: improvement,
        regression,
        positiveEffectObserved: absolutePass && improvement && !regression,
        outcome,
      });
    }
  );
});
