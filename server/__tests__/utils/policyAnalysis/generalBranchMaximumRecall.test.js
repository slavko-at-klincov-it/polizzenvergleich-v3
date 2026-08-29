const feCatalog = require("../../../resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json");
const lwCatalog = require("../../../resources/policyAnalysis/lw-occurrence-full-draft.v0.1.json");
const stCatalog = require("../../../resources/policyAnalysis/st-occurrence-full-draft.v0.1.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

const generalClause = [
  "B. ALLGEMEINER TEIL",
  "Die Höchstentschädigung im Schadensfall beträgt inklusive aller für die jeweilige Sparte vereinbarten Positionen maximal 150 % der vereinbarten Versicherungssumme.",
].join("\n");

function worksheet(catalog) {
  return buildControlledOccurrenceWorksheet({
    document: {
      id: `synthetic-${catalog.categoryView}`,
      sourceDocumentId: `synthetic-${catalog.categoryView}`,
      title: `synthetic-${catalog.categoryView}.pdf`,
      documentType: "pdf",
      pageContent: generalClause,
      pageMap: [{ pageNumber: 1, start: 0, end: generalClause.length }],
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
        complete: true,
      },
    },
    documentFingerprint: `synthetic-${catalog.categoryView}-fingerprint`,
    catalog,
  });
}

function component(result, requirementId, componentId) {
  return result.requirements
    .find(({ id }) => id === requirementId)
    .components.find(({ id }) => id === componentId);
}

describe("general branch maximum recall", () => {
  test.each([
    [feCatalog, "FE-F02", "fire_maximum_indemnity"],
    [lwCatalog, "LW-31", "water_line_maximum_compensation"],
    [stCatalog, "ST-34", "storm_maximum_compensation"],
  ])(
    "%s recalls the complete general branch maximum clause",
    (catalog, requirementId, componentId) => {
      const recalled = component(worksheet(catalog), requirementId, componentId);
      expect(recalled.occurrenceCount).toBeGreaterThan(0);
      expect(recalled.occurrences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sectionScopeHint: expect.objectContaining({
              scopeKey: "GENERAL_CONTRACT_TERMS",
            }),
            context: expect.objectContaining({
              text: expect.stringContaining("jeweilige Sparte"),
            }),
          }),
        ])
      );
    }
  );

  test("does not recall the Feuer annual aggregate from the maximum clause", () => {
    expect(
      component(worksheet(feCatalog), "FE-F02", "fire_annual_aggregate")
    ).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
  });
});
