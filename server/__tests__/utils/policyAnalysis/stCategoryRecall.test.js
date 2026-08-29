const catalog = require("../../../resources/policyAnalysis/st-occurrence-full-draft.v0.1.json");
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
    id: "synthetic-st-recall",
    sourceDocumentId: "synthetic-st-recall",
    title: "synthetic-st-recall.pdf",
    documentType: "pdf",
    pageContent,
    pageMap,
    pdfExtraction: {
      schemaVersion: 1,
      totalPages: pages.length,
      processedPages: pages.length,
      pagesWithText: pages.filter(Boolean).length,
      complete: true,
    },
  };
}

function component(worksheet, requirementId, componentId) {
  return worksheet.requirements
    .find(({ id }) => id === requirementId)
    .components.find(({ id }) => id === componentId);
}

describe("ST category recall", () => {
  const document = documentFromPages([
    [
      "1. Versicherungsumfang",
      "Versichert sind Solar- und Fotovoltaikanlagen am Gebäude.",
      "Versichert sind Markisen, Jalousien und Rollläden am Gebäude.",
      "Mitversichert sind Grundstücksbegrenzungen sowie Begrenzungen und Umzäunungen wie Mauern, Zäune.",
    ].join("\n"),
    [
      "2. Versicherungsumfang Feuer-, Sturm- und Leitungswasserversicherung",
      "Sicherungs-, Aufräumungs-, Abbruch-, Bewegungs- und Schutzkosten sind bis 10 % mitversichert.",
    ].join("\n"),
    [
      "5. Sturmversicherung",
      "Versichert sind Schäden durch",
      "• Sturm (Wind mit Spitzengeschwindigkeiten von mehr als 60 km/h);",
      "• Hagel;",
      "• Schneedruck;",
      "Zusätzlich versichert sind Schäden durch Schnee- und Eisrutsch.",
      "Nicht versichert sind Schäden durch Auftauen und Reparaturen von Dachrinnen und Außenablaufrohren.",
    ].join("\n"),
    "Zusätzlich versichert sind Kosten für das Sichern, Entfernen bzw. Entsorgen von am Versicherungsgrundstück befindlichen Bäumen, die das Gebäude gefährden, bis 5 % auf Erstes Risiko.",
    [
      "B. ALLGEMEINER TEIL",
      "Die Höchstentschädigung im Schadensfall beträgt inklusive aller für die jeweilige Sparte vereinbarten Positionen maximal 150 % der vereinbarten Versicherungssumme.",
    ].join("\n"),
  ]);
  const worksheet = buildControlledOccurrenceWorksheet({
    document,
    documentFingerprint: "synthetic-st-recall-fingerprint",
    catalog,
  });

  test("ST-10 recalls securing costs while an absent emergency cover remains open", () => {
    expect(component(worksheet, "ST-10", "securing_measures")).toMatchObject({
      terminalState: "CONTROLLED_CANDIDATES_FOUND",
      occurrenceCount: 1,
    });
    expect(component(worksheet, "ST-10", "emergency_cover")).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
  });

  test("ST-11 recalls the exclusion only under the narrow snow-slide scope", () => {
    const damage = component(
      worksheet,
      "ST-11",
      "gutter_downpipe_damage"
    );
    expect(damage.occurrences).toHaveLength(1);
    expect(damage.occurrences[0]).toMatchObject({
      physicalPageNumber: 3,
      sectionScopeHint: { scopeKey: "STURM_INSURANCE" },
    });
    expect(damage.occurrences[0].scopeLead.text).toContain(
      "Schnee- und Eisrutsch"
    );
    expect(damage.occurrences[0].context.text).toContain("Nicht versichert");
    expect(
      component(worksheet, "ST-11", "gutter_downpipe_sublimit")
        .terminalState
    ).toBe("NO_CONTROLLED_CANDIDATE");
  });

  test("ST-18 recalls the photovoltaic object and both storm and hail perils", () => {
    expect(
      component(worksheet, "ST-18", "photovoltaic_system").occurrences.some(
        ({ physicalPageNumber }) => physicalPageNumber === 1
      )
    ).toBe(true);
    for (const componentId of ["storm", "hail"])
      expect(component(worksheet, "ST-18", componentId).occurrences).toEqual([
        expect.objectContaining({
          physicalPageNumber: 3,
          sectionScopeHint: expect.objectContaining({
            scopeKey: "STURM_INSURANCE",
          }),
        }),
      ]);
  });

  test("ST-19 recalls the photovoltaic object and snow-pressure peril", () => {
    expect(
      component(worksheet, "ST-19", "photovoltaic_system").occurrences.some(
        ({ physicalPageNumber }) => physicalPageNumber === 1
      )
    ).toBe(true);
    expect(component(worksheet, "ST-19", "snow_pressure").occurrences).toEqual([
      expect.objectContaining({
        physicalPageNumber: 3,
        sectionScopeHint: expect.objectContaining({
          scopeKey: "STURM_INSURANCE",
        }),
      }),
    ]);
  });

  test("ST-21 recalls coordinated solar installations", () => {
    expect(
      component(worksheet, "ST-21", "solar_thermal_system").occurrences.some(
        ({ physicalPageNumber, exactText }) =>
          physicalPageNumber === 1 &&
          exactText === "Solar- und Fotovoltaikanlagen"
      )
    ).toBe(true);
  });

  test("ST-16 treats blinds and roller shutters as shading systems", () => {
    expect(component(worksheet, "ST-16", "awning").occurrences).toEqual([
      expect.objectContaining({
        physicalPageNumber: 1,
        exactText: "Markisen",
      }),
    ]);
    expect(
      component(worksheet, "ST-16", "shading_system").occurrences
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          physicalPageNumber: 1,
          exactText: "Jalousien",
        }),
        expect.objectContaining({
          physicalPageNumber: 1,
          exactText: "Rollläden",
        }),
      ])
    );
  });

  test("ST-25 recalls tree costs while an absent branch fact remains open", () => {
    expect(component(worksheet, "ST-25", "tree_removal_costs")).toMatchObject({
      terminalState: "CONTROLLED_CANDIDATES_FOUND",
      occurrenceCount: 1,
    });
    expect(
      component(worksheet, "ST-25", "branch_removal_costs")
    ).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
  });

  test("ST-29 recalls generally insured fences without inventing a storm phrase", () => {
    const fencing = component(
      worksheet,
      "ST-29",
      "storm_damage_to_fencing"
    );
    expect(
      fencing.occurrences.some(
        ({ physicalPageNumber }) => physicalPageNumber === 1
      )
    ).toBe(true);
    expect(
      fencing.occurrences.every(
        ({ exactText }) => !/Sturmschaden/u.test(exactText)
      )
    ).toBe(true);
  });

  test("ST-34 recalls the per-division 150-percent maximum in general terms", () => {
    const maximum = component(
      worksheet,
      "ST-34",
      "storm_maximum_compensation"
    );
    expect(maximum.occurrences.length).toBeGreaterThan(0);
    expect(maximum.occurrences[0]).toMatchObject({
      physicalPageNumber: 5,
      sectionScopeHint: {
        scopeKey: "GENERAL_CONTRACT_TERMS",
        source: "CURRENT_PAGE_HEADING",
      },
    });
    expect(maximum.occurrences[0].context.text).toContain("150 %");
    expect(maximum.occurrences[0].context.text).toContain("jeweilige Sparte");
  });
});
