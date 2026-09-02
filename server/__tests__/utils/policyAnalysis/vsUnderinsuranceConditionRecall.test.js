const crypto = require("crypto");
const fullCatalog = require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function worksheetFor(text) {
  const fingerprint = crypto.createHash("sha256").update(text).digest("hex");
  return buildControlledOccurrenceWorksheet({
    documentFingerprint: fingerprint,
    catalog: {
      ...fullCatalog,
      requirements: fullCatalog.requirements.filter(({ id }) => id === "VS-08"),
    },
    document: {
      sourceDocumentId: fingerprint,
      title: "underinsurance-condition-fixture.pdf",
      pageContent: text,
      pageMap: [{ pageNumber: 1, start: 0, end: text.length }],
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

function component(worksheet) {
  return worksheet.requirements[0].components[0];
}

describe("VS-08 percentage-deviation condition recall", () => {
  test.each(["10 %", "25,5 %"])(
    "finds a source-bound waiver threshold with %s deviation",
    (threshold) => {
      const worksheet = worksheetFor(
        `AK35 Unterversicherungsverzicht\nDer Versicherer verzichtet auf den Einwand einer Unterversicherung, soweit die Versicherungssumme bzw. die Höchsthaftungssumme um nicht mehr als ${threshold} vom Versicherungswert abweichen.`
      );
      const result = component(worksheet);

      expect(result.occurrenceCount).toBeGreaterThan(0);
      expect(result.occurrences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            matchedAlias:
              "CONCEPT_SEARCH:underinsurance-waiver-deviation-condition",
            context: expect.objectContaining({
              unitType: "CLAUSE_SECTION",
              text: expect.stringContaining("vom Versicherungswert abweichen"),
            }),
          }),
        ])
      );
    }
  );

  test.each([
    "Die Versicherungssumme darf um nicht mehr als 25 % vom Versicherungswert abweichen.",
    "Der Versicherer prüft bei Unterversicherung die Abweichung vom Versicherungswert.",
    "Ein Verzicht wird erwähnt, die Versicherungssumme bleibt jedoch unverändert.",
  ])("does not recall an incomplete concept family: %s", (text) => {
    expect(component(worksheetFor(text)).occurrenceCount).toBe(0);
  });
});
