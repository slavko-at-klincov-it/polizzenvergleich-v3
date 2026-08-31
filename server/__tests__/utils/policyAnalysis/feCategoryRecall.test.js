const catalog = require("../../../resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function documentFromPages(pages) {
  let pageContent = "";
  const pageMap = pages.map((text, index) => {
    const start = pageContent.length;
    pageContent += text;
    const end = pageContent.length;
    if (index < pages.length - 1) pageContent += "\n";
    return { pageNumber: index + 1, start, end };
  });
  return {
    id: "synthetic-fe-recall",
    sourceDocumentId: "synthetic-fe-recall",
    title: "synthetic-fe-recall.pdf",
    documentType: "pdf",
    pageContent,
    pageMap,
    pdfExtraction: {
      schemaVersion: 1,
      totalPages: pages.length,
      processedPages: pages.length,
      pagesWithText: pages.length,
      complete: true,
    },
  };
}

function component(worksheet, requirementId, componentId) {
  return worksheet.requirements
    .find(({ id }) => id === requirementId)
    .components.find(({ id }) => id === componentId);
}

function worksheetFromText(text) {
  return buildControlledOccurrenceWorksheet({
    document: documentFromPages([text]),
    documentFingerprint: "synthetic-fe-concept-recall-fingerprint",
    catalog,
  });
}

describe("FE category recall", () => {
  const worksheet = buildControlledOccurrenceWorksheet({
    document: documentFromPages([
      [
        "B. ALLGEMEINER TEIL",
        "Die Verletzung dieser Verpflichtungen führt nach Maßgabe des Gesetzes zur Leistungsfreiheit des Versicherers.",
      ].join("\n"),
      [
        "FEUERVERSICHERUNG",
        "Versichert gelten Verletzungen von vereinbarten Obliegenheiten gemäß Allgemeinen und Besonderen Bedingungen.",
        "Diese Deckungserweiterung gilt nicht für sonstige Fälle der Leistungsfreiheit.",
      ].join("\n"),
    ]),
    documentFingerprint: "synthetic-fe-recall-fingerprint",
    catalog,
  });

  test("FE-E16 recalls causal and coverage-extension obligation wording", () => {
    expect(
      component(
        worksheet,
        "FE-E16",
        "obligation_breach_consequences"
      ).occurrences
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          physicalPageNumber: 1,
          exactText: "Verletzung dieser Verpflichtungen",
        }),
        expect.objectContaining({
          physicalPageNumber: 2,
          exactText: "Verletzungen von vereinbarten Obliegenheiten",
        }),
      ])
    );
  });

  test("FE-E16 keeps the resulting release from liability as a separate fact", () => {
    expect(
      component(
        worksheet,
        "FE-E16",
        "benefit_reduction_or_release"
      ).occurrences
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          physicalPageNumber: 1,
          exactText: "Leistungsfreiheit",
        }),
        expect.objectContaining({
          physicalPageNumber: 2,
          exactText: "Leistungsfreiheit",
        }),
      ])
    );
  });

  test("recalls the confirmed FE concept variants inside the fire scope", () => {
    const result = worksheetFromText(
      [
        "FEUERVERSICHERUNG",
        "Versichert sind Schäden durch die Einwirkung unbekannter motorisierter Fahrzeuge.",
        "Flugzeugabsturz ist der Absturz oder Anprall eines Raumfahrzeuges einschließlich seiner Teile und der Ladung.",
        "Versicherte Sachen sind Solaranlagen sowie Fotovoltaikanlagen am Gebäude.",
        "Beim Löschen mit Wasser beschädigte versicherte Sachen werden ersetzt.",
        "Beim Löschen mit Schaum beschädigte Gebäudeteile werden ersetzt.",
        "Beim Löschen mit Pulver zerstörte versicherte Sachen werden ersetzt.",
      ].join("\n")
    );

    const expectedConcepts = [
      ["FE-A10", "foreign_vehicle_impact", "damage-by-unknown-vehicle"],
      ["FE-A13", "aircraft_crash", "aircraft-crash-parts-and-cargo"],
      ["FE-A13", "aircraft_parts", "aircraft-crash-parts-and-cargo"],
      ["FE-A13", "aircraft_cargo", "aircraft-crash-parts-and-cargo"],
      [
        "FE-C02",
        "photovoltaic_as_damaged_object",
        "solar-and-photovoltaic-installations",
      ],
      [
        "FE-D03",
        "extinguishing_water_damage",
        "water-specific-extinguishing-damage",
      ],
      [
        "FE-D03",
        "extinguishing_foam_damage",
        "foam-specific-extinguishing-damage",
      ],
      [
        "FE-D03",
        "extinguishing_powder_damage",
        "powder-specific-extinguishing-damage",
      ],
    ];

    for (const [requirementId, componentId, conceptId] of expectedConcepts) {
      const recalled = component(result, requirementId, componentId);
      expect(recalled.occurrences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            matchedAlias: `CONCEPT_SEARCH:${conceptId}`,
            sectionScopeHint: expect.objectContaining({
              scopeKey: "FEUER_INSURANCE",
            }),
          }),
        ])
      );
    }
  });

  test("recalls wrapped unknown-vehicle clauses without a document-specific phrase", () => {
    const result = worksheetFromText(
      [
        "FEUERVERSICHERUNG",
        "Beschädigung von Einfriedungen und Kulturen des",
        "Versicherungsgrundstücks durch unbekannte Fahrzeuge;",
        "Versichert sind Schäden durch",
        "- unbekannte Fahrzeuge an Gebäuden und Gebäudebestandteilen.",
      ].join("\n")
    );

    expect(component(result, "FE-A10", "foreign_vehicle_impact")).toMatchObject(
      {
        terminalState: "CONTROLLED_CANDIDATES_FOUND",
        occurrenceCount: 2,
      }
    );
  });

  test("keeps generic extinguishing wording and incomplete concept atoms open", () => {
    const result = worksheetFromText(
      [
        "FEUERVERSICHERUNG",
        "Ersetzt wird die Wertminderung versicherter Sachen, die durch Löschen, Niederreißen oder Ausräumen beschädigt werden.",
        "Unbekannte Fahrzeuge müssen der Polizei angezeigt werden.",
        "Die Photovoltaikbranche nutzt Solarenergie ohne Vertragsbezug.",
      ].join("\n")
    );

    for (const componentId of [
      "extinguishing_water_damage",
      "extinguishing_foam_damage",
      "extinguishing_powder_damage",
    ])
      expect(component(result, "FE-D03", componentId)).toMatchObject({
        terminalState: "NO_CONTROLLED_CANDIDATE",
        occurrenceCount: 0,
      });
    expect(component(result, "FE-A10", "foreign_vehicle_impact")).toMatchObject(
      {
        terminalState: "NO_CONTROLLED_CANDIDATE",
        occurrenceCount: 0,
      }
    );
    expect(
      component(result, "FE-C02", "photovoltaic_as_damaged_object")
    ).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
  });
});
