const catalog = require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function documentFromText(pageContent) {
  return {
    id: "synthetic-vs02-recall",
    sourceDocumentId: "synthetic-vs02-recall",
    title: "synthetic-vs02-recall.pdf",
    documentType: "pdf",
    pageContent,
    pageMap: [{ pageNumber: 1, start: 0, end: pageContent.length }],
    pdfExtraction: {
      schemaVersion: 1,
      totalPages: 1,
      processedPages: 1,
      pagesWithText: 1,
      complete: true,
    },
  };
}

function thresholdOccurrences(text) {
  const worksheet = buildControlledOccurrenceWorksheet({
    document: documentFromText(text),
    documentFingerprint: "synthetic-vs02-recall-fingerprint",
    catalog,
  });
  return worksheet.requirements
    .find(({ id }) => id === "VS-02")
    .components.find(({ id }) => id === "residual_value_threshold").occurrences;
}

describe("VS-02 residual value threshold recall", () => {
  test.each([
    [
      "Liegt der Zeitwert der Sachen unter 40 % der Neuherstellungskosten, wird maximal der Zeitwert ersetzt.",
      "Zeitwert der Sachen unter 40 % der Neuherstellungskosten",
    ],
    [
      "Sämtliche zum Neuwert versicherte Gebäude und Sachen sind zum Neuwert zu ersetzen, sofern der Zeitwert der versicherten Gebäude und Sachen im Schadenzeitpunkt zumindest 20 % des Neuwertes betragen hat.",
      "Zeitwert der versicherten Gebäude und Sachen im Schadenzeitpunkt zumindest 20 % des Neuwertes",
    ],
  ])("recalls a variable threshold clause: %s", (text, expectedText) => {
    expect(thresholdOccurrences(text)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchedAlias: "CONCEPT_SEARCH:residual-value-threshold-clause",
          exactText: expect.stringContaining(expectedText),
        }),
      ])
    );
  });

  test.each([
    "Der Zeitwert wird aus dem Neuwert abzüglich Alter und Abnützung ermittelt.",
    "Restwerte bis 15 % des jeweiligen Neuwertes werden ersetzt.",
    "Die Versicherungssumme weicht um 20 % vom Versicherungswert ab.",
  ])("does not recall an unrelated value statement: %s", (text) => {
    expect(thresholdOccurrences(text)).toEqual([]);
  });
});
