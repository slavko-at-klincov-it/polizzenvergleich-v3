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

function worksheetFromText(text) {
  return buildControlledOccurrenceWorksheet({
    document: documentFromPages([text]),
    documentFingerprint: "synthetic-st-concept-recall-fingerprint",
    catalog,
  });
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
    const damage = component(worksheet, "ST-11", "gutter_downpipe_damage");
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
      component(worksheet, "ST-11", "gutter_downpipe_sublimit").terminalState
    ).toBe("NO_CONTROLLED_CANDIDATE");
  });

  test.each([
    "Kamin- und Schornsteinköpfe",
    "Kamin- und/oder Schornsteinköpfe",
    "Kamin- oder Schornsteinköpfe",
    "Kamin- sowie Schornsteinköpfe",
    "Kamin- bzw. Schornsteinköpfe",
    "Kamin-/Schornsteinköpfe",
    "Kamin- und Schornsteinköpfen",
    "Kamin- und/oder Schornsteinköpfen",
    "Kamin- oder Schornsteinköpfen",
    "Kamin- sowie Schornsteinköpfen",
    "Kamin- bzw. Schornsteinköpfen",
    "Kamin-/Schornsteinköpfen",
  ])("ST-13 recalls the coordinated chimney-head form %s", (wording) => {
    const result = worksheetFromText(
      ["5. STURMVERSICHERUNG", `Versichert sind ${wording}.`].join("\n")
    );

    expect(component(result, "ST-13", "chimney_head").occurrences).toEqual([
      expect.objectContaining({
        matchedAlias: wording,
        exactText: wording,
      }),
    ]);
    expect(component(result, "ST-13", "smokestack_head").occurrences).toEqual([
      expect.objectContaining({
        matchedAlias: expect.stringMatching(/^Schornsteink[öo]pf/u),
        exactText: expect.stringMatching(/^Schornsteink[öo]pf/u),
      }),
    ]);
  });

  test("ST-13 preserves direct head terms without promoting a fire-clause chimney", () => {
    const direct = worksheetFromText(
      [
        "5. STURMVERSICHERUNG",
        "Versichert sind Kaminköpfe und Schornsteinköpfe.",
      ].join("\n")
    );
    expect(component(direct, "ST-13", "chimney_head").occurrences).toEqual([
      expect.objectContaining({ exactText: "Kaminköpfe" }),
    ]);
    expect(component(direct, "ST-13", "smokestack_head").occurrences).toEqual([
      expect.objectContaining({ exactText: "Schornsteinköpfe" }),
    ]);

    const fireClause = worksheetFromText(
      [
        "FEUERVERSICHERUNG",
        "FE08 Kaminbrand",
        "Versichert sind Schäden am Kamin durch einen Brand, der sich innerhalb des Kamins entwickelt.",
      ].join("\n")
    );
    expect(component(fireClause, "ST-13", "chimney_head")).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
    expect(component(fireClause, "ST-13", "smokestack_head")).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
  });

  test("ST-13 does not infer a chimney head from Kaminbrand beside a real smokestack head", () => {
    const result = worksheetFromText(
      [
        "5. STURMVERSICHERUNG",
        "Kaminbrand und Schornsteinköpfe werden getrennt behandelt.",
      ].join("\n")
    );
    expect(component(result, "ST-13", "chimney_head")).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
    expect(component(result, "ST-13", "smokestack_head").occurrences).toEqual([
      expect.objectContaining({ exactText: "Schornsteinköpfe" }),
    ]);
  });

  test.each([
    "Kaminbrand",
    "Schornsteinbrand",
    "Kaminschleifen",
    "Innenputz des Kamins",
    "drei Kamine",
    "Kaminrohr",
    "Kamin- und Lüftungsanlagen",
    "Kaminsanierung",
    "Kaminaufsatz",
  ])("ST-13 does not promote the non-head wording %s", (wording) => {
    const result = worksheetFromText(
      ["FEUERVERSICHERUNG", `Versichert sind ${wording}.`].join("\n")
    );
    expect(component(result, "ST-13", "chimney_head")).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
    expect(component(result, "ST-13", "smokestack_head")).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
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
    expect(component(worksheet, "ST-16", "shading_system").occurrences).toEqual(
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
    expect(component(worksheet, "ST-25", "branch_removal_costs")).toMatchObject(
      {
        terminalState: "NO_CONTROLLED_CANDIDATE",
        occurrenceCount: 0,
      }
    );
  });

  test("ST-25 recalls disposal wording under a structured storm heading", () => {
    const result = worksheetFromText(
      [
        "B3 Sturmversicherung (ST)",
        "ST01 Entsorgung von Bäumen",
        "Die Kosten nach einem versicherten Sturmschaden für das Sichern und Entsorgen von",
        "Bäume, die von einem Sturmschaden betroffen sind, sind bis EUR 3.000.- mitversichert.",
      ].join("\n")
    );

    expect(component(result, "ST-25", "tree_removal_costs")).toMatchObject({
      terminalState: "CONTROLLED_CANDIDATES_FOUND",
      occurrenceCount: 1,
      occurrences: [
        expect.objectContaining({
          matchedAlias:
            "CONCEPT_SEARCH:storm-related-tree-securing-or-disposal-costs",
          sectionScopeHint: expect.objectContaining({
            scopeKey: "STURM_INSURANCE",
          }),
        }),
      ],
    });
    expect(component(result, "ST-25", "branch_removal_costs")).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
  });

  test("ST-29 recalls generally insured fences without inventing a storm phrase", () => {
    const fencing = component(worksheet, "ST-29", "storm_damage_to_fencing");
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
    const maximum = component(worksheet, "ST-34", "storm_maximum_compensation");
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

  test("recalls the confirmed storm concepts without merging distinct roles", () => {
    const result = worksheetFromText(
      [
        "5. STURMVERSICHERUNG",
        "Als Sturm gilt ein Wind mit einer Spitzengeschwindigkeit von über 60 km/h.",
        "Für die Feststellung der Spitzengeschwindigkeit ist die Auskunft der Zentralanstalt für Meteorologie und Geodynamik maßgebend.",
        "Versichert sind Schäden an den versicherten Gebäuden, die durch Herabrutschen von am Dach angesammelten Schnee- und Eismassen entstehen.",
        "Versichert sind Schäden durch stürzende Bäume des Nachbargrundstücks.",
        "Andere Gegenstände werden durch eine versicherte Sturmgefahr auf die versicherten Sachen geworfen.",
        "Kosten nach einem versicherten Sturmschaden für das Sichern und Entsorgen von Bäumen sind bis EUR 3.000 mitversichert.",
      ].join("\n")
    );
    const expectedConcepts = [
      [
        "ST-01",
        "storm_wind_speed_definition",
        "storm-definition-by-peak-wind-speed",
      ],
      ["ST-02", "measuring_station", "authoritative-peak-wind-speed-source"],
      [
        "ST-08",
        "roof_avalanche_on_own_installations",
        "snow-or-ice-slide-on-insured-property",
      ],
      [
        "ST-23",
        "foreign_tree_or_branch_impact",
        "foreign-tree-or-branch-impact",
      ],
      [
        "ST-25",
        "tree_removal_costs",
        "storm-related-tree-securing-or-disposal-costs",
      ],
    ];

    for (const [requirementId, componentId, conceptId] of expectedConcepts)
      expect(component(result, requirementId, componentId).occurrences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            matchedAlias: `CONCEPT_SEARCH:${conceptId}`,
            sectionScopeHint: expect.objectContaining({
              scopeKey: "STURM_INSURANCE",
            }),
          }),
        ])
      );

    expect(component(result, "ST-02", "wind_proof_duty")).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
    expect(component(result, "ST-25", "branch_removal_costs")).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
    const broaderImpactCandidates = component(
      result,
      "ST-23",
      "foreign_tree_or_branch_impact"
    ).occurrences;
    expect(broaderImpactCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchedAlias: "CONCEPT_SEARCH:storm-thrown-object-impact",
        }),
      ])
    );
    expect(
      broaderImpactCandidates.find(
        ({ matchedAlias }) =>
          matchedAlias === "CONCEPT_SEARCH:storm-thrown-object-impact"
      ).exactText
    ).not.toMatch(/Bäume|Äste/u);
  });

  test("rejects nearby weather, generic impact and landscaping wording", () => {
    const result = worksheetFromText(
      [
        "5. STURMVERSICHERUNG",
        "Die Wetterstation meldet Wind mit einer Spitzengeschwindigkeit von 40 km/h.",
        "Die Zentralanstalt erteilt Auskunft über die allgemeine Wetterlage.",
        "Schnee- und Eismassen rutschen vom Nachbargebäude auf fremde Sachen.",
        "Andere Gegenstände werden neben den versicherten Sachen gelagert.",
        "Kosten für das Entsorgen von Bäumen im Rahmen der Gartenpflege trägt der Eigentümer.",
      ].join("\n")
    );

    for (const [requirementId, componentId] of [
      ["ST-01", "storm_wind_speed_definition"],
      ["ST-02", "measuring_station"],
      ["ST-08", "roof_avalanche_on_own_installations"],
      ["ST-23", "foreign_tree_or_branch_impact"],
      ["ST-25", "tree_removal_costs"],
      ["ST-25", "branch_removal_costs"],
    ])
      expect(component(result, requirementId, componentId)).toMatchObject({
        terminalState: "NO_CONTROLLED_CANDIDATE",
        occurrenceCount: 0,
      });
  });
});
