const crypto = require("crypto");
const fullCatalog = require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function worksheetFor(text) {
  const fingerprint = crypto.createHash("sha256").update(text).digest("hex");
  const catalog = {
    ...fullCatalog,
    requirements: fullCatalog.requirements.filter(({ id }) => id === "VS-22"),
  };
  return buildControlledOccurrenceWorksheet({
    documentFingerprint: fingerprint,
    catalog,
    document: {
      id: fingerprint,
      sourceDocumentId: fingerprint,
      title: "synthetic.pdf",
      pageContent: text,
      pageMap: [
        {
          pageNumber: 1,
          physicalPageNumber: 1,
          printedPageLabel: null,
          start: 0,
          end: text.length,
        },
      ],
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
        complete: true,
      },
    },
  });
}

function component(worksheet, id) {
  return worksheet.requirements[0].components.find(
    (candidate) => candidate.id === id
  );
}

describe("VS-22 hazardous-waste inflection recall", () => {
  test.each([
    "Die Mehrkosten für die Behandlung von gefährlichem Abfall sind mitversichert.",
    "Die Behandlung von gefährlichen Abfällen erfolgt nach einem versicherten Schaden.",
    "Kosten zur Beseitigung gefährlicher Abfälle werden ersetzt.",
    "Die Zwischenlagerung von gefährlichen Abfällen ist geregelt.",
  ])("finds the controlled hazardous-waste word form: %s", (text) => {
    const worksheet = worksheetFor(text);

    expect(
      component(worksheet, "hazardous_waste").occurrenceCount
    ).toBeGreaterThan(0);
    expect(
      component(worksheet, "hazardous_waste_cost_limit").occurrenceCount
    ).toBeGreaterThan(0);
  });

  test.each([
    "Die gewöhnlichen Entsorgungskosten sind mitversichert.",
    "Abfälle werden getrennt gesammelt.",
    "Problemstoffe sind im Lagerverzeichnis genannt.",
  ])(
    "does not infer hazardous waste from an adjacent generic term: %s",
    (text) => {
      const worksheet = worksheetFor(text);

      expect(component(worksheet, "hazardous_waste").occurrenceCount).toBe(0);
      expect(
        component(worksheet, "hazardous_waste_cost_limit").occurrenceCount
      ).toBe(0);
    }
  );
});
