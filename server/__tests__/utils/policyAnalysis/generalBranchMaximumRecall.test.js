const feCatalog = require("../../../resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json");
const lwCatalog = require("../../../resources/policyAnalysis/lw-occurrence-full-draft.v0.1.json");
const stCatalog = require("../../../resources/policyAnalysis/st-occurrence-full-draft.v0.1.json");
const vsCatalog = require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

const generalClause = [
  "B. ALLGEMEINER TEIL",
  "Die Höchstentschädigung im Schadensfall beträgt inklusive aller für die jeweilige Sparte vereinbarten Positionen maximal 150 % der vereinbarten Versicherungssumme.",
].join("\n");

function worksheetFromText(catalog, text) {
  return buildControlledOccurrenceWorksheet({
    document: {
      id: `synthetic-${catalog.categoryView}`,
      sourceDocumentId: `synthetic-${catalog.categoryView}`,
      title: `synthetic-${catalog.categoryView}.pdf`,
      documentType: "pdf",
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
    documentFingerprint: `synthetic-${catalog.categoryView}-fingerprint`,
    catalog,
  });
}

function worksheet(catalog) {
  return worksheetFromText(catalog, generalClause);
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

  test("VS-36 recalls both general indemnity-boundary formulations", () => {
    const result = worksheetFromText(
      vsCatalog,
      [
        "B. ALLGEMEINER TEIL",
        "Die Versicherungssumme bildet die Grenze für die Entschädigung des Versicherers.",
        "Die Entschädigungsleistung ist pro Schadenereignis mit der in der Polizze vereinbarten Versicherungssumme, maximiert mit dem Versicherungswert, begrenzt.",
      ].join("\n")
    );
    const maximum = component(
      result,
      "VS-36",
      "maximum_indemnity_per_event"
    );

    expect(maximum.occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchedAlias:
            "CONCEPT_SEARCH:sum-insured-as-indemnity-boundary",
          sectionScopeHint: expect.objectContaining({
            scopeKey: "GENERAL_CONTRACT_TERMS",
          }),
        }),
        expect.objectContaining({
          matchedAlias: "CONCEPT_SEARCH:event-indemnity-cap",
          sectionScopeHint: expect.objectContaining({
            scopeKey: "GENERAL_CONTRACT_TERMS",
          }),
        }),
      ])
    );
  });

  test("VS-32 recalls only the evidenced temporary-storage cost role", () => {
    const result = worksheetFromText(
      vsCatalog,
      [
        "B. ALLGEMEINER TEIL",
        "Die Kosten einer höchstens sechsmonatigen Zwischenlagerung sind unter dieser Voraussetzung versichert.",
      ].join("\n")
    );

    expect(
      component(result, "VS-32", "temporary_storage_costs").occurrences
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchedAlias: "CONCEPT_SEARCH:insured-temporary-storage-costs",
          sectionScopeHint: expect.objectContaining({
            scopeKey: "GENERAL_CONTRACT_TERMS",
          }),
        }),
      ])
    );
    for (const componentId of [
      "moving_costs",
      "moving_and_temporary_storage_cost_limit",
    ])
      expect(component(result, "VS-32", componentId)).toMatchObject({
        terminalState: "NO_CONTROLLED_CANDIDATE",
        occurrenceCount: 0,
      });
  });

  test("does not turn sum adjustment or privately funded storage into a limit", () => {
    const result = worksheetFromText(
      vsCatalog,
      [
        "B. ALLGEMEINER TEIL",
        "Nach der Entschädigung wird die Versicherungssumme angepasst.",
        "Eine Zwischenlagerung organisiert der Mieter auf eigene Kosten.",
      ].join("\n")
    );

    expect(
      component(result, "VS-36", "maximum_indemnity_per_event")
    ).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
    expect(
      component(result, "VS-32", "temporary_storage_costs")
    ).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
  });
});
