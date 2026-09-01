const catalog = require("../../../resources/policyAnalysis/vs-occurrence-pilot.v0.1.json");
const fullCatalog = require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");
const lwFullCatalog = require("../../../resources/policyAnalysis/lw-occurrence-full-draft.v0.1.json");
const feFullCatalog = require("../../../resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json");
const elFullCatalog = require("../../../resources/policyAnalysis/el-occurrence-full-draft.v0.1.json");
const vbFullCatalog = require("../../../resources/policyAnalysis/vb-occurrence-full-draft.v0.1.json");
const {
  buildControlledOccurrenceWorksheet,
  findAliasRanges,
  normalizeWithOffsetMap,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  buildCandidateTriagePayload,
} = require("../../../utils/policyAnalysis/candidateTriageContract");

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
    id: "synthetic-vs",
    sourceDocumentId: "synthetic-vs",
    title: "synthetic-vs.pdf",
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

const SYNTHETIC_DOCUMENT = documentFromPages([
  [
    "Seite 1",
    "1. Versicherte Sachen",
    "",
    "- Garagen sind versichert.",
    "- Tiefgara-",
    "gen sind ausgeschlossen.",
    "- Garageneinrichtungen sind optional.",
    "- Müll\u00adräume, Fahrradabstellräume und Kinderwagenräume sind versichert.",
  ].join("\n"),
  [
    "Seite 2",
    "2. Kosten und Ertragsausfall",
    "",
    "- Kosten für Aufräumung und Abbruch sind bis 10 % mitversichert.",
    "- Der Mietverlust ist bis zu sechs Monaten versichert.",
  ].join("\n"),
]);

function component(worksheet, requirementId, componentId) {
  return worksheet.requirements
    .find(({ id }) => id === requirementId)
    .components.find(({ id }) => id === componentId);
}

describe("controlledOccurrenceWorksheet", () => {
  test("binds an indirect-lightning limit to its peril clause, not an unrelated equal amount", () => {
    const document = documentFromPages([
      [
        "AK05 Architekten- und Ingenieurgebühren",
        "Mitversichert sind mindestens EUR 10.000 auf erstes Risiko für Architekten- und Ingenieurgebühren.",
        "",
        "FE04 Erdkabel",
        "Mitversichert ist der indirekter Blitzschlag an Erdkabel inklusive Nebenkosten bis insgesamt EUR 5.000 je Schadenfall.",
      ].join("\n"),
    ]);
    const worksheet = buildControlledOccurrenceWorksheet({
      document,
      documentFingerprint: "indirect-lightning-limit-fixture",
      catalog: feFullCatalog,
    });
    const limit = component(worksheet, "FE-A06", "indirect_lightning_limit");
    const requirement = worksheet.requirements.find(
      ({ id }) => id === "FE-A06"
    );

    expect(requirement.scopeRules.narrowAliases).toEqual([
      "Erdkabel",
      "Gebäude-Elektroinstallationen",
      "Sachen außerhalb von Gebäuden",
    ]);
    expect(limit.occurrences).toHaveLength(1);
    expect(limit.occurrences[0]).toMatchObject({
      exactText: "indirekter Blitzschlag",
      context: {
        text: expect.stringContaining("EUR 5.000"),
      },
    });
    expect(limit.occurrences[0].context.text).not.toContain(
      "Architekten- und Ingenieurgebühren."
    );
  });

  test("attaches controlled variant and list-value governors to occurrences", () => {
    const document = documentFromPages([
      [
        "6.2. Deckungsvariante „C-Deckung“",
        "Zusätzlich zur Grunddeckung sind versichert:",
        "Folgende Haftungserweiterungen gelten mit einer Versicherungssumme von € 7.500 auf „Erstes Risiko“ mitversichert:",
        "• die Kosten für den Wasserverlust nach einem Schaden;",
      ].join("\n"),
    ]);
    const worksheet = buildControlledOccurrenceWorksheet({
      document,
      documentFingerprint: "variant-governor-fixture",
      catalog: {
        schemaVersion: 1,
        catalogId: "variant-governor-test",
        categoryView: "LW",
        requirements: [
          {
            id: "LW-27",
            label: "Wasserverlustkosten",
            requestedFields: ["limit"],
            components: [
              {
                id: "water_loss",
                label: "Wasserverlust",
                factRole: "COST",
                aliases: ["Kosten für den Wasserverlust"],
              },
            ],
          },
        ],
      },
    });

    const [candidate] = worksheet.requirements[0].components[0].occurrences;
    expect(candidate.variantScopeHint).toMatchObject({
      key: "C_DECKUNG",
      label: "C-Deckung",
      source: "CURRENT_PAGE_HEADING",
    });
    expect(candidate.fieldGovernorHint).toMatchObject({
      text: expect.stringContaining("€ 7.500"),
      source: "CURRENT_PAGE_FIELD_GOVERNOR",
      documentStart: expect.any(Number),
      documentEnd: expect.any(Number),
    });
    expect(
      document.pageContent.slice(
        candidate.fieldGovernorHint.documentStart,
        candidate.fieldGovernorHint.documentEnd
      )
    ).toBe(candidate.fieldGovernorHint.text);
  });

  test("inherits a variant across a continued page and resets it at the next variant heading", () => {
    const document = documentFromPages([
      [
        "6.2. Deckungsvariante „C-Deckung“",
        "Folgende Erweiterungen gelten mit einer Versicherungssumme von € 7.500 mitversichert:",
        "• Kosten für Wasserverlust;",
      ].join("\n"),
      "• Kosten für Wasserverlust im Folgeschaden;",
      [
        "6.3. Deckungsvariante „D-Deckung“",
        "Kosten für Wasserverlust bis € 10.000 je Schadenfall.",
      ].join("\n"),
    ]);
    const worksheet = buildControlledOccurrenceWorksheet({
      document,
      documentFingerprint: "variant-inheritance-fixture",
      catalog: {
        schemaVersion: 1,
        catalogId: "variant-inheritance-test",
        categoryView: "LW",
        requirements: [
          {
            id: "LW-27",
            label: "Wasserverlustkosten",
            requestedFields: ["limit"],
            components: [
              {
                id: "water_loss",
                label: "Wasserverlust",
                factRole: "COST",
                aliases: ["Kosten für Wasserverlust"],
              },
            ],
          },
        ],
      },
    });

    const occurrences = worksheet.requirements[0].components[0].occurrences;
    expect(occurrences.map(({ variantScopeHint }) => variantScopeHint)).toEqual(
      [
        expect.objectContaining({ key: "C_DECKUNG" }),
        expect.objectContaining({
          key: "C_DECKUNG",
          source: "PRECEDING_PAGE_HEADING",
        }),
        expect.objectContaining({ key: "D_DECKUNG" }),
      ]
    );
    expect(occurrences[2].fieldGovernorHint).toBeNull();
  });

  test("inherits a numbered storm heading and keeps the narrow clause lead for later exclusions", () => {
    const document = documentFromPages([
      [
        "5. Sturmversicherung",
        "Versichert sind Schäden durch Hagel und Schneedruck.",
        "Zusätzlich versichert sind Schäden durch Schnee- und Eisrutsch.",
        "Nicht versichert sind Schäden an Hausfassade und Dachbelag.",
      ].join("\n"),
    ]);
    const worksheet = buildControlledOccurrenceWorksheet({
      document,
      documentFingerprint: "st-scope-fixture",
      catalog: {
        schemaVersion: 1,
        catalogId: "st-scope-test",
        categoryView: "ST",
        requirements: [
          {
            id: "ST-04",
            label: "Hagel",
            requestedFields: [],
            scopeRules: { narrowAliases: ["Schnee- und Eisrutsch"] },
            components: [
              {
                id: "hail",
                label: "Hagel",
                factRole: "PERIL",
                aliases: ["Hagel", "Hausfassade"],
              },
            ],
          },
        ],
      },
    });

    const [hail, facade] = worksheet.requirements[0].components[0].occurrences;
    expect(hail.sectionScopeHint).toMatchObject({
      scopeKey: "STURM_INSURANCE",
      text: "5. Sturmversicherung",
    });
    expect(facade.sectionScopeHint.scopeKey).toBe("STURM_INSURANCE");
    expect(facade.scopeLead.text).toContain("Schnee- und Eisrutsch");
    expect(facade.scopeLead.text).toContain("Nicht versichert sind");
  });

  test.each([
    [
      "Versicherte Kosten gemäß Art. 3:",
      "POSITIVE",
      "Nicht versichert sind Kosten für die Behebung der Ursache.",
    ],
    [
      "Nicht versicherte Schäden:",
      "NEGATIVE",
      "Versichert sind Schäden durch Naturgefahren.",
    ],
    [
      "Versicherte Kosten im Rahmen der Versicherungssumme",
      "POSITIVE",
      "Nicht versichert sind Kosten für die Behebung der Ursache.",
    ],
  ])(
    "resets an earlier governor at the complete semantic heading %s",
    (heading, expectedPolarity, supersededGovernor) => {
      const worksheet = buildControlledOccurrenceWorksheet({
        document: documentFromPages([
          [
            "5. Sturmversicherung",
            supersededGovernor,
            heading,
            "Suchkosten und Schäden durch Hagel bis EUR 2.000.",
          ].join("\n"),
        ]),
        documentFingerprint: `semantic-governor-${expectedPolarity}`,
        catalog: {
          schemaVersion: 1,
          catalogId: "semantic-governor-reset",
          categoryView: "ST",
          requirements: [
            {
              id: "ST-X01",
              label: "Suchkosten",
              requestedFields: [],
              components: [
                {
                  id: "search_costs",
                  label: "Suchkosten",
                  factRole: "COST",
                  aliases: ["Suchkosten"],
                },
              ],
            },
          ],
        },
      });
      const [occurrence] = component(
        worksheet,
        "ST-X01",
        "search_costs"
      ).occurrences;

      expect(occurrence.coverageGovernorHint).toMatchObject({
        text: heading,
        kind: "SEMANTIC_COVERAGE_HEADING",
        polarity: expectedPolarity,
        source: "CURRENT_PAGE_GOVERNOR",
      });
      expect(occurrence.scopeLead.text).toContain(heading);
      expect(occurrence.scopeLead.text).not.toContain(supersededGovernor);
    }
  );

  test.each([
    "Die versicherten Kosten umfassen Suchkosten bis EUR 2.000.",
    "Die versicherten Kosten im Rahmen der Versicherungssumme umfassen Suchkosten.",
    "Versicherte Kosten: Suchkosten bis EUR 2.000.",
    "Der Abschnitt beschreibt nicht versicherte Schäden, Gefahren und Suchkosten.",
  ])("does not promote flowing text to a semantic governor: %s", (line) => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([["5. Sturmversicherung", line].join("\n")]),
      documentFingerprint: `semantic-governor-prose-${line.length}`,
      catalog: {
        schemaVersion: 1,
        catalogId: "semantic-governor-prose",
        categoryView: "ST",
        requirements: [
          {
            id: "ST-X01",
            label: "Suchkosten",
            requestedFields: [],
            components: [
              {
                id: "search_costs",
                label: "Suchkosten",
                factRole: "COST",
                aliases: ["Suchkosten"],
              },
            ],
          },
        ],
      },
    });
    const [occurrence] = component(
      worksheet,
      "ST-X01",
      "search_costs"
    ).occurrences;

    expect(occurrence.coverageGovernorHint).toBeNull();
  });

  test.each([
    ["ALLGEMEINE VERTRAGSBESTIMMUNGEN", "GENERAL_CONTRACT_TERMS"],
    ["7. Wohnungseigentum", "WOHNUNGSEIGENTUM_INSURANCE"],
    ["7. Glasbruch", "GLASBRUCH_INSURANCE"],
    ["B. ALLGEMEINER TEIL", "GENERAL_CONTRACT_TERMS"],
    ["B2 Feuerversicherung (FE)", "FEUER_INSURANCE"],
    ["B3 Sturmversicherung (ST)", "STURM_INSURANCE"],
    ["B4 Leitungswasserversicherung (LW)", "LEITUNGSWASSER_INSURANCE"],
  ])("recognizes the cross-cutting section %s", (heading, scopeKey) => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        `${heading}\nVersichert sind Schäden durch Hagel.`,
      ]),
      documentFingerprint: `heading-${scopeKey}`,
      catalog: {
        schemaVersion: 1,
        catalogId: "section-heading-test",
        categoryView: "ST",
        requirements: [
          {
            id: "ST-04",
            label: "Hagel",
            requestedFields: [],
            components: [
              {
                id: "hail",
                label: "Hagel",
                factRole: "PERIL",
                aliases: ["Hagel"],
              },
            ],
          },
        ],
      },
    });

    expect(
      worksheet.requirements[0].components[0].occurrences[0].sectionScopeHint
    ).toMatchObject({ scopeKey, text: heading });
  });

  test("normalizes German characters, soft hyphens and line-break hyphenation with reversible offsets", () => {
    const original = "Müll\u00adräume und Tiefgara-\ngen";
    const normalized = normalizeWithOffsetMap(original);

    expect(normalized.normalized).toBe("muellraeume und tiefgaragen");
    for (const alias of ["Müllräume", "Tiefgaragen"]) {
      const [range] = findAliasRanges(original, alias);
      expect(original.slice(range.originalStart, range.originalEnd)).toMatch(
        alias === "Müllräume" ? /Müll.*räume/u : /Tiefgara-\ngen/u
      );
    }
  });

  test("finds controlled phrases despite harmless punctuation differences", () => {
    const text =
      "Absturz und Anprall von Luft- oder Raumfahrzeugen, deren Teile bzw. Ladung.";
    const alias =
      "Absturz und Anprall von Luft oder Raumfahrzeugen deren Teile bzw Ladung";
    const [range] = findAliasRanges(text, alias);

    expect(text.slice(range.originalStart, range.originalEnd)).toBe(
      "Absturz und Anprall von Luft- oder Raumfahrzeugen, deren Teile bzw. Ladung"
    );
  });

  test("enumerates each controlled component across all physical pages with exact original offsets", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: SYNTHETIC_DOCUMENT,
      documentFingerprint: "fixture-sha256",
      catalog,
    });

    expect(worksheet).toMatchObject({
      candidateOnly: true,
      summary: {
        requirementCount: 4,
        componentCount: 8,
        componentsWithCandidates: 8,
        componentsWithoutCandidates: 0,
        occurrenceCount: 8,
      },
    });
    for (const requirement of worksheet.requirements) {
      for (const item of requirement.components) {
        expect(item.terminalState).toBe("CONTROLLED_CANDIDATES_FOUND");
        expect(item.occurrenceCount).toBe(1);
        const [occurrence] = item.occurrences;
        expect(
          SYNTHETIC_DOCUMENT.pageContent.slice(
            occurrence.documentStart,
            occurrence.documentEnd
          )
        ).toBe(occurrence.exactText);
      }
    }
  });

  test("uses token boundaries so Garage does not match Tiefgarage or Garageneinrichtung", () => {
    const garage = component(
      buildControlledOccurrenceWorksheet({
        document: SYNTHETIC_DOCUMENT,
        documentFingerprint: "fixture-sha256",
        catalog,
      }),
      "VS-16",
      "garage"
    );

    expect(garage.occurrenceCount).toBe(1);
    expect(garage.occurrences[0].exactText).toBe("Garagen");
  });

  test("accepts a PDF-concatenated clause code as a boundary without allowing ordinary word suffixes", () => {
    const heading =
      "Indirekter Blitzschlag an Gebäude-Elektroinstallationen12PG0340";

    expect(
      findAliasRanges(
        heading,
        "Indirekter Blitzschlag an Gebäude-Elektroinstallationen"
      )
    ).toHaveLength(1);
    expect(findAliasRanges("Garageneinrichtung", "Garage")).toEqual([]);
  });

  test("accepts a PDF-concatenated EUR value as a boundary without allowing an ordinary EUR-prefixed suffix", () => {
    expect(
      findAliasRanges(
        "Wohngebäude zum NeuwertEUR30.608.000,00",
        "Wohngebäude zum Neuwert"
      )
    ).toHaveLength(1);
    expect(findAliasRanges("NeuwertEURopa", "Neuwert")).toEqual([]);
  });

  test("finds the controlled coordinated form Aufräumungs- without broad substring matching", () => {
    const text =
      "Aufräumungs- und Reparaturarbeiten; Aufräumungskosten; Aufräumungshelfer";

    expect(
      findAliasRanges(text, "Aufräumungs-").map(
        ({ originalStart, originalEnd }) =>
          text.slice(originalStart, originalEnd)
      )
    ).toEqual(["Aufräumungs-"]);
  });

  test("keeps the smallest complete list item as candidate context", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: SYNTHETIC_DOCUMENT,
      documentFingerprint: "fixture-sha256",
      catalog,
    });
    const undergroundGarage = component(
      worksheet,
      "VS-16",
      "underground_garage"
    );
    const [occurrence] = undergroundGarage.occurrences;

    expect(occurrence.context.unitType).toBe("LIST_ITEM");
    expect(occurrence.context.text).toBe(
      "- Tiefgara-\ngen sind ausgeschlossen."
    );
    expect(occurrence.context.text).not.toContain("Garageneinrichtungen");
  });

  test("recognizes PDF bullets even when extraction removes the space after the dash", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        [
          "FEUERVERSICHERUNG",
          "-Wohngebäude zum NeuwertEUR30.000.000,00",
          " Bauart: massiv",
          "-NebengebäudeEUR1.000.000,00",
        ].join("\n"),
      ]),
      documentFingerprint: "compact-bullet-fixture",
      catalog: {
        schemaVersion: 1,
        catalogId: "compact-bullet-test",
        categoryView: "VS",
        requirements: [
          {
            id: "VS-01",
            label: "Neuwert",
            requestedFields: [],
            components: [
              {
                id: "replacement_new_value",
                label: "Neuwert",
                factRole: "BENEFIT",
                aliases: ["Wohngebäude zum Neuwert"],
              },
            ],
          },
        ],
      },
    });

    const [candidate] = worksheet.requirements[0].components[0].occurrences;
    expect(candidate.context).toMatchObject({
      unitType: "LIST_ITEM",
      text: "-Wohngebäude zum NeuwertEUR30.000.000,00\n Bauart: massiv",
    });
  });

  test.each([
    ["Versichert sind:", "INCLUDED"],
    ["Nicht versichert sind:", "EXCLUDED"],
  ])(
    "isolates middle-dot PDF list items while retaining the %s governor",
    (governor, expectedPolarity) => {
      const worksheet = buildControlledOccurrenceWorksheet({
        document: documentFromPages([
          [
            governor,
            "·Jalousien und Rollläden (nicht Sonnensegel und nicht Markisen);",
            "·Solar- und Photovoltaikanlagen;",
          ].join("\n"),
        ]),
        documentFingerprint: `middle-dot-list-${expectedPolarity}`,
        catalog: {
          schemaVersion: 1,
          catalogId: "middle-dot-list-test",
          categoryView: "ST",
          requirements: [
            {
              id: "ST-21",
              label: "Solarthermieanlagen",
              requestedFields: [],
              components: [
                {
                  id: "solar_thermal_system",
                  label: "Solarthermieanlagen",
                  factRole: "INSURED_OBJECT",
                  aliases: ["Solar- und Photovoltaikanlagen"],
                },
              ],
            },
          ],
        },
      });
      const [occurrence] = component(
        worksheet,
        "ST-21",
        "solar_thermal_system"
      ).occurrences;

      expect(occurrence.context).toMatchObject({
        unitType: "LIST_ITEM",
        text: "·Solar- und Photovoltaikanlagen;",
      });
      expect(occurrence.scopeLead.text).toBe(governor);
      expect(occurrence.scopeLead.text).not.toContain("nicht Sonnensegel");
      expect(occurrence.coverageGovernorHint).toMatchObject({
        text: governor,
        kind: "SEMANTIC_COVERAGE_HEADING",
        polarity: expectedPolarity,
        source: "CURRENT_PAGE_GOVERNOR",
      });
    }
  );

  test("expands catalog-authorized occurrences to a numbered clause section only", () => {
    const sectionCatalog = {
      schemaVersion: 1,
      catalogId: "vs-section-context-test",
      categoryView: "VS",
      requirements: [
        {
          id: "VS-10",
          label: "Automatische Indexanpassung",
          requestedFields: [],
          components: [
            {
              id: "automatic_index_adjustment",
              label: "Automatische Indexanpassung",
              factRole: "CONDITION",
              contextMode: "CLAUSE_SECTION",
              aliases: ["Aufwertung der Gebäudeversicherungssummen"],
            },
          ],
        },
      ],
    };
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        [
          "32. Vorherige Klausel",
          "Nicht relevant.",
          "33. Indexvereinbarung",
          "Die Aufwertung der Gebäudeversicherungssummen erfolgt nach dem Baukostenindex.",
          "34. Unterversicherungsverzicht",
          "Der Versicherer verzichtet unter Voraussetzungen.",
        ].join("\n"),
      ]),
      documentFingerprint: "numbered-clause-context",
      catalog: sectionCatalog,
    });
    const [candidate] = component(
      worksheet,
      "VS-10",
      "automatic_index_adjustment"
    ).occurrences;

    expect(candidate.context).toMatchObject({
      unitType: "CLAUSE_SECTION",
      text: [
        "33. Indexvereinbarung",
        "Die Aufwertung der Gebäudeversicherungssummen erfolgt nach dem Baukostenindex.",
      ].join("\n"),
    });
    expect(candidate.context.text).not.toContain("Unterversicherungsverzicht");
  });

  test("expands catalog-authorized occurrences from a coded heading to the next coded heading", () => {
    const sectionCatalog = {
      schemaVersion: 1,
      catalogId: "vs-coded-section-context-test",
      categoryView: "VS",
      requirements: [
        {
          id: "VS-09",
          label: "Voraussetzungen des Unterversicherungsverzichts",
          requestedFields: ["condition"],
          components: [
            {
              id: "underinsurance_waiver_prerequisites",
              label: "Voraussetzungen",
              factRole: "CONDITION",
              contextMode: "CLAUSE_SECTION",
              aliases: ["im Schadenfall nur Anwendung, wenn"],
            },
          ],
        },
      ],
    };
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        [
          "Wertanpassung nach dem Baukostenindex10PA0400",
          "1.Die Versicherungssumme erhöht sich jährlich.",
          "3.Die Vorschriften über Unterversicherung finden im Schadenfall nur Anwendung, wenn",
          "a) die Versicherungssumme nicht dem tatsächlichen Wert entsprochen hat.",
          "Aufräum-, Abbruch- und Feuerlöschkosten12PA0130",
          "Diese nächste Klausel gehört nicht mehr dazu.",
        ].join("\n"),
      ]),
      documentFingerprint: "coded-clause-context",
      catalog: sectionCatalog,
    });
    const [candidate] = component(
      worksheet,
      "VS-09",
      "underinsurance_waiver_prerequisites"
    ).occurrences;

    expect(candidate.context.unitType).toBe("CLAUSE_SECTION");
    expect(candidate.context.text).toContain(
      "Wertanpassung nach dem Baukostenindex10PA0400"
    );
    expect(candidate.context.text).toContain("Versicherungssumme erhöht");
    expect(candidate.context.text).not.toContain("Diese nächste Klausel");
  });

  test("rejects unknown catalog context modes", () => {
    const invalidCatalog = {
      schemaVersion: 1,
      catalogId: "invalid-context-mode",
      categoryView: "VS",
      requirements: [
        {
          id: "VS-99",
          label: "Ungültig",
          components: [
            {
              id: "invalid",
              label: "Ungültig",
              factRole: "CONDITION",
              contextMode: "WHOLE_DOCUMENT",
              aliases: ["Klausel"],
            },
          ],
        },
      ],
    };

    expect(() =>
      buildControlledOccurrenceWorksheet({
        document: documentFromPages(["Klausel"]),
        documentFingerprint: "invalid-context-mode",
        catalog: invalidCatalog,
      })
    ).toThrow("COMPONENT_CONTEXT_MODE_INVALID");
  });

  test("keeps a separate preceding reading window for scope without enlarging the evidence unit", () => {
    const scopedDocument = documentFromPages([
      [
        "Zusätzlich sind mitversichert bis 5 %:",
        "- Fahrradräume;",
        "- Kinderwagenräume;",
      ].join("\n"),
    ]);
    const worksheet = buildControlledOccurrenceWorksheet({
      document: scopedDocument,
      documentFingerprint: "scope-fixture",
      catalog,
    });
    const bicycleRoom = component(worksheet, "VS-17", "bicycle_room");
    const [occurrence] = bicycleRoom.occurrences;

    expect(occurrence.context.text).toBe("- Fahrradräume;");
    expect(occurrence.scopeLead.text).toBe(
      "Zusätzlich sind mitversichert bis 5 %:"
    );
    expect(
      scopedDocument.pageContent.slice(
        occurrence.scopeLead.documentStart,
        occurrence.scopeLead.documentEnd
      )
    ).toBe(occurrence.scopeLead.text);
  });

  test("carries an explicit coverage governor across exactly one continued PDF page", () => {
    const continuationCatalog = {
      schemaVersion: 1,
      catalogId: "cross-page-governor",
      categoryView: "HP",
      requirements: [
        {
          id: "HP-26",
          label: "Mietsachschäden",
          requestedFields: [],
          components: [
            {
              id: "rented_property_damage",
              label: "Mietsachschäden",
              factRole: "DAMAGE",
              aliases: ["gemieteten Sachen"],
            },
          ],
        },
      ],
    };
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        "8.4. Nicht versichert im Rahmen der Gebäudehaftpflichtversicherung sind:",
        "d) Schäden an gemieteten Sachen.",
        "Unabhängiger Folgetext mit gemieteten Sachen.",
      ]),
      documentFingerprint: "cross-page-governor",
      catalog: continuationCatalog,
    });
    const occurrences = component(
      worksheet,
      "HP-26",
      "rented_property_damage"
    ).occurrences;

    expect(occurrences[0].coverageGovernorHint).toMatchObject({
      text: "8.4. Nicht versichert im Rahmen der Gebäudehaftpflichtversicherung sind:",
      physicalPageNumber: 1,
      source: "PRECEDING_PAGE_GOVERNOR",
    });
    expect(occurrences[1].coverageGovernorHint).toBeNull();
  });

  test("keeps physical PDF page and visible printed page label as separate source fields", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        "Vorschlag\nSeite 1 von 14\nGaragen sind versichert.",
      ]),
      documentFingerprint: "printed-page-label",
      catalog,
    });
    const occurrence = component(worksheet, "VS-16", "garage").occurrences[0];

    expect(occurrence).toMatchObject({
      pageNumber: 1,
      physicalPageNumber: 1,
      printedPageLabel: "Seite 1 von 14",
    });
  });

  test("attaches only explicit page-level insurance scope hints", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        [
          "Garagen sind versichert.",
          "Allgemeines",
          "Die Sturmversicherung ist wertgesichert.",
        ].join("\n"),
      ]),
      documentFingerprint: "page-scope-hint",
      catalog,
    });
    const occurrence = component(worksheet, "VS-16", "garage").occurrences[0];

    expect(occurrence.pageScopeHints).toEqual([
      expect.objectContaining({
        scopeKey: "STURM_INSURANCE",
        text: "Die Sturmversicherung",
      }),
    ]);
  });

  test("carries an explicit section heading across proposal pages and resets at a new printed document", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        "Seite 1 von 7\nFEUERVERSICHERUNG\nAufräum- und Abbruchkosten sind versichert.",
        "Seite 2 von 7\nAufräum- und Abbruchkosten sind weiterhin versichert.",
        "Seite 1 von 14\nAufräum- und Abbruchkosten werden allgemein definiert.",
      ]),
      documentFingerprint: "section-scope-carry",
      catalog,
    });
    const occurrences = component(
      worksheet,
      "VS-21",
      "cleanup_costs"
    ).occurrences;

    expect(occurrences[0].sectionScopeHint).toMatchObject({
      scopeKey: "FEUER_INSURANCE",
      source: "CURRENT_PAGE_HEADING",
    });
    expect(occurrences[1].sectionScopeHint).toMatchObject({
      scopeKey: "FEUER_INSURANCE",
      source: "PRECEDING_PAGE_HEADING",
      physicalPageNumber: 1,
    });
    expect(occurrences[2].sectionScopeHint).toBeNull();
  });

  test("recognizes title-case insurance headings as category scope", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        [
          "Allgemeine Bedingungen für die Glasbruchversicherung",
          "Versichert sind Wintergartenverglasungen.",
        ].join("\n"),
      ]),
      documentFingerprint: "title-case-glass-scope",
      catalog: {
        schemaVersion: 1,
        catalogId: "title-case-glass-scope",
        categoryView: "EL",
        requirements: [
          {
            id: "EL-16",
            label: "Wintergartenverglasung",
            requestedFields: [],
            components: [
              {
                id: "winter_garden",
                label: "Wintergarten",
                factRole: "INSURED_OBJECT",
                aliases: ["Wintergartenverglasungen"],
              },
            ],
          },
        ],
      },
    });

    expect(
      worksheet.requirements[0].components[0].occurrences[0].sectionScopeHint
    ).toMatchObject({
      scopeKey: "GLASBRUCH_INSURANCE",
      source: "CURRENT_PAGE_HEADING",
    });
  });

  test("recognizes a multiline residential-building liability conditions title", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        [
          "Allgemeine Bedingungen für die",
          "Haftpflichtversicherung für Wohngebäude",
          "(AHVB-W 2023)",
          "Personen, die den Schaden vorsätzlich herbeigeführt haben.",
        ].join("\n"),
      ]),
      documentFingerprint: "multiline-liability-scope",
      catalog: {
        schemaVersion: 1,
        catalogId: "multiline-liability-scope",
        categoryView: "HP",
        requirements: [
          {
            id: "HP-36",
            label: "Vorsatzausschluss",
            requestedFields: [],
            components: [
              {
                id: "intentional_damage_exclusion",
                label: "Vorsatzausschluss",
                factRole: "EXCLUSION",
                aliases: ["vorsätzlich herbeigeführt"],
              },
            ],
          },
        ],
      },
    });

    expect(
      worksheet.requirements[0].components[0].occurrences[0].sectionScopeHint
    ).toMatchObject({
      scopeKey: "HAFTPFLICHT_INSURANCE",
      source: "CURRENT_PAGE_HEADING",
      text: "Allgemeine Bedingungen für die\nHaftpflichtversicherung für Wohngebäude",
    });
  });

  test("does not carry a coverage governor across a new coded clause heading", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        [
          "Nicht versichert sind:",
          "- Sachen des Haushalts;",
          "AK20 Mehrkosten durch behördliche Auflagen10PA0130",
          "Das sind Kosten für technische Verbesserungen.",
        ].join("\n"),
      ]),
      documentFingerprint: "coded-heading-governor-reset",
      catalog: {
        schemaVersion: 1,
        catalogId: "coded-heading-governor-reset",
        categoryView: "WE",
        requirements: [
          {
            id: "WE-08",
            label: "Verbesserungen über Standard",
            requestedFields: [],
            components: [
              {
                id: "upgraded_improvements",
                label: "Verbesserungen",
                factRole: "INSURED_OBJECT",
                aliases: ["Verbesserungen"],
              },
            ],
          },
        ],
      },
    });
    const [occurrence] = worksheet.requirements[0].components[0].occurrences;

    expect(occurrence.scopeLead.text).toContain(
      "AK20 Mehrkosten durch behördliche Auflagen10PA0130"
    );
    expect(occurrence.scopeLead.text).not.toContain("Nicht versichert");
    expect(occurrence.coverageGovernorHint).toBeNull();
  });

  test("carries a known clause-family scope across appendix pages", () => {
    const scopeCatalog = {
      schemaVersion: 1,
      id: "clause-family-test",
      categoryView: "ST",
      requirements: [
        {
          id: "ST-X01",
          label: "Garagen",
          requestedFields: [],
          components: [
            {
              id: "garage",
              label: "Garagen",
              factRole: "INSURED_OBJECT",
              aliases: ["Garagen"],
            },
          ],
        },
      ],
    };
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        "Seite 12 von 14\nNiederschlags- und Schmelzwasser64PA0051\nGaragen sind versichert.",
        "Seite 13 von 14\nGaragen sind weiterhin versichert.",
      ]),
      documentFingerprint: "clause-family-scope-carry",
      catalog: scopeCatalog,
    });
    const garages = component(worksheet, "ST-X01", "garage").occurrences;
    expect(garages[0].sectionScopeHint).toMatchObject({
      scopeKey: "STURM_INSURANCE",
      clauseCode: "64PA0051",
      source: "CURRENT_PAGE_HEADING",
    });
    expect(garages[1].sectionScopeHint).toMatchObject({
      scopeKey: "STURM_INSURANCE",
      clauseCode: "64PA0051",
      source: "PRECEDING_PAGE_HEADING",
    });
  });

  test("scopes a generic clause to the proposal chapter that activates it", () => {
    const markisenCatalog = {
      schemaVersion: 1,
      id: "markisen-test",
      categoryView: "ST",
      requirements: [
        {
          id: "ST-16",
          label: "Markisen",
          requestedFields: [],
          components: [
            {
              id: "awning",
              label: "Markisen",
              factRole: "INSURED_OBJECT",
              aliases: ["Markisen"],
            },
          ],
        },
      ],
    };
    const scoped = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        "Seite 1 von 7\nFEUERVERSICHERUNG\n- Markisen (Besondere Bedingung 10PA0230)",
        "Seite 6 von 14\nMarkisen und Schirme10PA0230\nMarkisen gelten mitversichert.",
      ]),
      documentFingerprint: "clause-activation-scope-markisen",
      catalog: markisenCatalog,
    });
    expect(
      scoped.requirements[0].components[0].occurrences.at(-1).sectionScopeHint
    ).toMatchObject({
      scopeKey: "FEUER_INSURANCE",
      clauseCode: "10PA0230",
      source: "CURRENT_PAGE_HEADING",
    });
  });

  test("uses an ambiguous generic clause as a boundary without inventing one category scope", () => {
    const markisenCatalog = {
      schemaVersion: 1,
      id: "ambiguous-clause-test",
      categoryView: "ST",
      requirements: [
        {
          id: "ST-X02",
          label: "Markisen",
          requestedFields: [],
          components: [
            {
              id: "awning",
              label: "Markisen",
              factRole: "INSURED_OBJECT",
              aliases: ["Markisen"],
            },
          ],
        },
      ],
    };
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        [
          "Seite 1 von 7",
          "FEUERVERSICHERUNG",
          "- Markisen (Besondere Bedingung 10PA0230)",
          "STURMVERSICHERUNG",
          "- Markisen (Besondere Bedingung 10PA0230)",
        ].join("\n"),
        [
          "Seite 6 von 14",
          "Feuerspezifische Klausel12PA0141",
          "Markisen und Schirme10PA0230",
          "Markisen gelten mitversichert.",
        ].join("\n"),
      ]),
      documentFingerprint: "ambiguous-clause-boundary",
      catalog: markisenCatalog,
    });
    const appendixOccurrences =
      worksheet.requirements[0].components[0].occurrences.filter(
        ({ physicalPageNumber }) => physicalPageNumber === 2
      );

    expect(appendixOccurrences).toHaveLength(2);
    for (const occurrence of appendixOccurrences)
      expect(occurrence.sectionScopeHint).toMatchObject({
        scopeKey: null,
        scopeKeys: ["FEUER_INSURANCE", "STURM_INSURANCE"],
        clauseCode: "10PA0230",
      });
  });

  test("makes the seven WEVIG proposal positions server-owned narrow scopes", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        [
          "Seite 1 von 7",
          "FEUERVERSICHERUNG",
          "Aufräum-, Abbruch- und Feuerlöschkosten EUR6.121.600,00",
          "Entgang von Mietzinseinnahmen mit einer Haftungszeit von 6 Monaten",
        ].join("\n"),
        [
          "Seite 2 von 7",
          "LEITUNGSWASSERVERSICHERUNG",
          "Aufräum- und Abbruchkosten EUR6.121.600,00",
          "Entgang von Mietzinseinnahmen mit einer Haftungszeit von 6 Monaten",
        ].join("\n"),
        "Seite 3 von 7\nSTURMVERSICHERUNG",
        [
          "Seite 4 von 7",
          "Aufräum- und Abbruchkosten EUR6.121.600,00",
          "Entgang von Mietzinseinnahmen mit einer Haftungszeit von 6 Monaten",
          "GLASPAUSCHALVERSICHERUNG",
        ].join("\n"),
        "Seite 5 von 7\nAufräum- und Abbruchkosten EUR6.121.600,00",
      ]),
      documentFingerprint: "wevig-27b-section-replay",
      catalog,
    });
    const targets = buildCandidateTriagePayload(
      worksheet
    ).bindingTargets.filter(
      ({ requirementId, physicalPageNumber }) =>
        (requirementId === "VS-21" &&
          [1, 2, 4, 5].includes(physicalPageNumber)) ||
        (requirementId === "VS-28" && [1, 2, 4].includes(physicalPageNumber))
    );

    expect(targets).toHaveLength(7);
    const expectedScopeByTarget = new Map([
      ["VS-21:1", "FEUER_INSURANCE"],
      ["VS-21:2", "LEITUNGSWASSER_INSURANCE"],
      ["VS-21:4", "STURM_INSURANCE"],
      ["VS-21:5", "GLASBRUCH_INSURANCE"],
      ["VS-28:1", "FEUER_INSURANCE"],
      ["VS-28:2", "LEITUNGSWASSER_INSURANCE"],
      ["VS-28:4", "STURM_INSURANCE"],
    ]);
    for (const target of targets) {
      expect(target.scopeResolution).toMatchObject({
        owner: "SERVER",
        scopeMatch: "NARROW",
        basis: "CATALOG_NARROW_SECTION",
        matchedAlias: expectedScopeByTarget.get(
          `${target.requirementId}:${target.physicalPageNumber}`
        ),
      });
      expect(target.modelDecisionFields).not.toContain("scopeMatch");
    }
  });

  test("switches inherited storm scope to the recognized liability section", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        "Seite 3 von 7\nSTURMVERSICHERUNG",
        "Seite 4 von 7\nHAFTPFLICHTVERSICHERUNG\nAufräum- und Abbruchkosten EUR 1.000,00",
        "Seite 5 von 7\nAufräum- und Abbruchkosten EUR 2.000,00",
      ]),
      documentFingerprint: "unknown-section-resets-carry",
      catalog,
    });
    const occurrences = component(
      worksheet,
      "VS-21",
      "cleanup_costs"
    ).occurrences;

    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].sectionScopeHint).toMatchObject({
      scopeKey: "HAFTPFLICHT_INSURANCE",
      source: "CURRENT_PAGE_HEADING",
    });
    expect(occurrences[1].sectionScopeHint).toMatchObject({
      scopeKey: "HAFTPFLICHT_INSURANCE",
      source: "PRECEDING_PAGE_HEADING",
    });
  });

  test("switches inherited liability scope to the general contract section", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        "Seite 17\n8. Gebäude- und Grundstückshaftpflichtversicherung",
        "Seite 25\nB. ALLGEMEINER TEIL\nAufräum- und Abbruchkosten EUR 1.000,00",
        "Seite 26\nAufräum- und Abbruchkosten EUR 2.000,00",
      ]),
      documentFingerprint: "general-section-resets-liability",
      catalog,
    });
    const occurrences = component(
      worksheet,
      "VS-21",
      "cleanup_costs"
    ).occurrences;

    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].sectionScopeHint).toMatchObject({
      scopeKey: "GENERAL_CONTRACT_TERMS",
      source: "CURRENT_PAGE_HEADING",
      text: "B. ALLGEMEINER TEIL",
    });
    expect(occurrences[1].sectionScopeHint).toMatchObject({
      scopeKey: "GENERAL_CONTRACT_TERMS",
      source: "PRECEDING_PAGE_HEADING",
      physicalPageNumber: 2,
    });
  });

  test("resets inherited coverage scope and governor at proposal summary headings", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        [
          "Seite 5 von 7",
          "HAFTPFLICHTVERSICHERUNG",
          "Mitversichert gelten",
          "Schäden aus dem Hausbesitz.",
        ].join("\n"),
        [
          "Seite 6 von 7",
          "ZUSAMMENFASSUNG SPARTE(N) UND PRÄMIE(N)",
          "Die Gesamtprämie inkl. Steuern (Bruttoprämie) beträgt vierteljährlich EUR 14.747,66.",
          "In der angeführten Gesamtprämie sind sämtliche Steuern und Abgaben enthalten.",
          "WICHTIGE INFORMATIONEN",
          "Dauerrabatt 20 % - Laufzeit mind. 10 Jahre",
          "Mit Rücksicht auf die vereinbarte Vertragslaufzeit wird ein Dauerrabatt gewährt.",
        ].join("\n"),
      ]),
      documentFingerprint: "proposal-summary-resets-liability",
      catalog: vbFullCatalog,
    });
    const totalPremium = component(
      worksheet,
      "VB-27",
      "total_premium"
    ).occurrences;
    expect(component(worksheet, "VB-27", "total_premium").factRole).toBe(
      "CONDITION"
    );
    const taxIncluded = component(
      worksheet,
      "VB-27",
      "tax_included"
    ).occurrences;
    const contractTerm = component(
      worksheet,
      "VB-01",
      "contract_term"
    ).occurrences;

    expect(totalPremium).toHaveLength(2);
    expect(taxIncluded).toHaveLength(2);
    expect(contractTerm).toHaveLength(2);
    for (const occurrence of [
      ...totalPremium,
      ...taxIncluded,
      ...contractTerm,
    ]) {
      expect(occurrence.sectionScopeHint).toMatchObject({
        scopeKey: "GENERAL_CONTRACT_TERMS",
        source: "CURRENT_PAGE_HEADING",
      });
      expect(occurrence.coverageGovernorHint).toBeNull();
    }

    const targets = buildCandidateTriagePayload(
      worksheet
    ).bindingTargets.filter(({ requirementId }) =>
      ["VB-01", "VB-27"].includes(requirementId)
    );
    expect(targets).toHaveLength(6);
    for (const target of targets) {
      expect(target.scopeResolution).toMatchObject({
        owner: "SERVER",
        scopeMatch: "GENERAL",
      });
      expect(target.modelDecisionFields).not.toContain("scopeMatch");
    }
    const deterministicGeneralFacts = targets.filter(
      ({ deterministicBindingBasis }) =>
        deterministicBindingBasis?.startsWith("VB_")
    );
    expect(deterministicGeneralFacts).toHaveLength(4);
    for (const target of deterministicGeneralFacts) {
      expect(target.roleResolution).toMatchObject({
        owner: "SERVER",
        roleMatch: "MATCH",
      });
      expect(target.modelDecisionFields).toEqual([]);
    }
    expect(
      targets.filter(
        ({ scopeResolution }) =>
          scopeResolution.basis === "MATCHING_CATEGORY_SECTION" &&
          scopeResolution.matchedAlias === "GENERAL_CONTRACT_TERMS"
      )
    ).toHaveLength(6);
  });

  test("keeps inherited scope before and resets it after a later summary heading", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        [
          "Seite 5 von 7",
          "HAFTPFLICHTVERSICHERUNG",
          "Mitversichert gelten",
        ].join("\n"),
        [
          "Gesamtprämie EUR 1.000,00",
          "ZUSAMMENFASSUNG SPARTE(N) UND PRÄMIE(N)",
          "Die Gesamtprämie beträgt EUR 2.000,00",
        ].join("\n"),
      ]),
      documentFingerprint: "position-aware-summary-boundary",
      catalog: vbFullCatalog,
    });
    const occurrences = component(
      worksheet,
      "VB-27",
      "total_premium"
    ).occurrences;

    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].sectionScopeHint).toMatchObject({
      scopeKey: "HAFTPFLICHT_INSURANCE",
      source: "PRECEDING_PAGE_HEADING",
    });
    expect(occurrences[0].coverageGovernorHint).toMatchObject({
      source: "PRECEDING_PAGE_GOVERNOR",
    });
    expect(occurrences[1].sectionScopeHint).toMatchObject({
      scopeKey: "GENERAL_CONTRACT_TERMS",
      source: "CURRENT_PAGE_HEADING",
    });
    expect(occurrences[1].coverageGovernorHint).toBeNull();
  });

  test("resets inherited liability scope at the Oekoschutz section boundary", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        "Seite 17\n8. Gebäude- und Grundstückshaftpflichtversicherung",
        "Seite 22\n9. Ökoschutz\nAufräum- und Abbruchkosten EUR 1.000,00",
        "Seite 23\nAufräum- und Abbruchkosten EUR 2.000,00",
      ]),
      documentFingerprint: "eco-section-resets-liability",
      catalog,
    });
    const occurrences = component(
      worksheet,
      "VS-21",
      "cleanup_costs"
    ).occurrences;

    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].sectionScopeHint).toBeNull();
    expect(occurrences[1].sectionScopeHint).toBeNull();
  });

  test("groups different components governed by the same coordinated Kosten für phrase", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: SYNTHETIC_DOCUMENT,
      documentFingerprint: "fixture-sha256",
      catalog,
    });
    const cleanup = component(worksheet, "VS-21", "cleanup_costs");
    const demolition = component(worksheet, "VS-21", "demolition_costs");

    expect(worksheet.bindingGroups).toHaveLength(1);
    expect(worksheet.bindingGroups[0]).toMatchObject({
      type: "SHARED_GOVERNOR",
      constraint: "SAME_CANDIDATE_BINDING",
      governorText: "Kosten für",
      candidateIds: [
        cleanup.occurrences[0].candidateId,
        demolition.occurrences[0].candidateId,
      ],
    });
    expect(cleanup.occurrences[0].bindingGroupId).toBe(
      worksheet.bindingGroups[0].id
    );
    expect(demolition.occurrences[0].bindingGroupId).toBe(
      worksheet.bindingGroups[0].id
    );
  });

  test("groups catalog-declared components that share one exact composite span", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        "Aufräum- und Abbruchkosten sind auf Erstes Risiko versichert.",
      ]),
      documentFingerprint: "shared-span-costs",
      catalog,
    });
    const cleanup = component(worksheet, "VS-21", "cleanup_costs");
    const demolition = component(worksheet, "VS-21", "demolition_costs");

    expect(worksheet.bindingGroups).toHaveLength(1);
    expect(worksheet.bindingGroups[0]).toMatchObject({
      type: "SHARED_SPAN",
      constraint: "SAME_CANDIDATE_BINDING",
      governorText: "Aufräum- und Abbruchkosten",
      candidateIds: [
        cleanup.occurrences[0].candidateId,
        demolition.occurrences[0].candidateId,
      ],
    });
  });

  test.each([
    [
      "Aufräumungs-, Abbruch-, Feuerlösch- und Reinigungskosten sind bis 10 % versichert.",
      "Reinigungskosten",
    ],
    [
      "Aufräum-, Abbruch- (für Erdreich auch Aushub-) und Isolierungskosten sind versichert.",
      "Isolierungskosten",
    ],
  ])(
    "groups catalog-declared right-headed cost coordination: %s",
    (sentence, expectedHead) => {
      const worksheet = buildControlledOccurrenceWorksheet({
        document: documentFromPages([sentence]),
        documentFingerprint: `right-headed-${expectedHead}`,
        catalog,
      });
      const group = worksheet.bindingGroups.find(
        ({ type }) => type === "RIGHT_HEADED_COORDINATION"
      );

      expect(group).toMatchObject({
        type: "RIGHT_HEADED_COORDINATION",
        constraint: "SAME_CANDIDATE_BINDING",
        governorText: expectedHead,
      });
      expect(group.candidateIds).toHaveLength(2);
    }
  );

  test("does not turn ordinary demolition activity followed by costs into a right-headed cost group", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        "Aufräumung und Abbruch eines Gebäudes verursachen zusätzliche Kosten.",
      ]),
      documentFingerprint: "right-headed-negative",
      catalog,
    });

    expect(
      worksheet.bindingGroups.filter(
        ({ type }) => type === "RIGHT_HEADED_COORDINATION"
      )
    ).toEqual([]);
  });

  test("does not group cost components from separate structural contexts", () => {
    const separateClauses = documentFromPages([
      [
        "- Kosten für Aufräumung sind mitversichert.",
        "- Kosten für Abbruch sind ausgeschlossen.",
      ].join("\n"),
    ]);
    const worksheet = buildControlledOccurrenceWorksheet({
      document: separateClauses,
      documentFingerprint: "separate-cost-clauses",
      catalog,
    });

    expect(worksheet.bindingGroups).toEqual([]);
    expect(
      component(worksheet, "VS-21", "cleanup_costs").occurrences[0]
        .bindingGroupId
    ).toBeUndefined();
    expect(
      component(worksheet, "VS-21", "demolition_costs").occurrences[0]
        .bindingGroupId
    ).toBeUndefined();
  });

  test("does not group candidates separated by a component-specific predicate", () => {
    const contrastingPredicate = documentFromPages([
      "Kosten für Aufräumung sind versichert, Abbruch ist ausgeschlossen.",
    ]);
    const worksheet = buildControlledOccurrenceWorksheet({
      document: contrastingPredicate,
      documentFingerprint: "contrasting-cost-predicate",
      catalog,
    });

    expect(worksheet.bindingGroups).toEqual([]);
  });

  test("reports an explicit terminal no-candidate state without inventing exclusion", () => {
    const missingCatalog = {
      schemaVersion: 1,
      catalogId: "missing",
      categoryView: "VS",
      requirements: [
        {
          id: "VS-99",
          label: "Nicht enthalten",
          requestedFields: [],
          components: [
            {
              id: "missing",
              label: "Fehlend",
              factRole: "INSURED_OBJECT",
              aliases: ["nicht vorhandener Fachbegriff"],
            },
          ],
        },
      ],
    };
    const worksheet = buildControlledOccurrenceWorksheet({
      document: SYNTHETIC_DOCUMENT,
      documentFingerprint: "fixture-sha256",
      catalog: missingCatalog,
    });
    const missing = component(worksheet, "VS-99", "missing");

    expect(missing).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
      occurrences: [],
    });
    expect(JSON.stringify(worksheet)).not.toMatch(/EXCLUDED|coverageEffect/u);
  });

  test("creates stable candidate IDs for identical document and catalog inputs", () => {
    const inputs = {
      document: SYNTHETIC_DOCUMENT,
      documentFingerprint: "fixture-sha256",
      catalog,
    };
    expect(buildControlledOccurrenceWorksheet(inputs)).toEqual(
      buildControlledOccurrenceWorksheet(inputs)
    );
  });

  test.each(["VS-21", "VS-28"])(
    "%s accepts its declared property-module scope as complete evidence",
    (requirementId) => {
      for (const selectedCatalog of [catalog, fullCatalog]) {
        const requirement = selectedCatalog.requirements.find(
          ({ id }) => id === requirementId
        );
        expect(requirement.scopePolicy).toBe(
          "MATCHING_SCOPE_INCLUDED_SUFFICIENT"
        );
        expect(requirement.scopeRules.narrowScopeKeys.length).toBeGreaterThan(
          0
        );
      }
    }
  );

  test("carries only the explicitly declared LW coverage aggregation policies", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: SYNTHETIC_DOCUMENT,
      documentFingerprint: "fixture-sha256",
      catalog: lwFullCatalog,
    });
    const policies = new Map(
      worksheet.requirements.map(({ id, coverageAggregationPolicy }) => [
        id,
        coverageAggregationPolicy,
      ])
    );

    expect(policies.get("LW-03")).toBe("COVERAGE_ROLES_ONLY");
    expect(policies.get("LW-04")).toBe("COVERAGE_ROLES_ONLY");
    expect(
      [...policies.entries()].filter(
        ([, policy]) => policy === "COVERAGE_ROLES_ONLY"
      )
    ).toHaveLength(2);
  });

  test("limits definitive matching-scope evidence to the declared EL-15 host scope", () => {
    const worksheet = buildControlledOccurrenceWorksheet({
      document: SYNTHETIC_DOCUMENT,
      documentFingerprint: "fixture-sha256",
      catalog: elFullCatalog,
    });
    const el13 = worksheet.requirements.find(({ id }) => id === "EL-13");
    const el15 = worksheet.requirements.find(({ id }) => id === "EL-15");

    expect(el13.scopePolicy).toBe("MATCHING_SCOPE_INCLUDED_SUFFICIENT");
    expect(el15).toMatchObject({
      scopePolicy: "MATCHING_SCOPE_DEFINITIVE_SUFFICIENT",
      scopeRules: { narrowScopeKeys: ["GLASBRUCH_INSURANCE"] },
    });
  });

  test.each(["EL-01", "EL-11"])(
    "%s accepts its declared storm host scope for a complete value fact",
    (requirementId) => {
      const worksheet = buildControlledOccurrenceWorksheet({
        document: SYNTHETIC_DOCUMENT,
        documentFingerprint: "fixture-sha256",
        catalog: elFullCatalog,
      });
      const requirement = worksheet.requirements.find(
        ({ id }) => id === requirementId
      );

      expect(requirement).toMatchObject({
        scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
        scopeRules: { narrowScopeKeys: ["STURM_INSURANCE"] },
      });
    }
  );

  test("rejects definitive matching-scope policy without an explicit host scope", () => {
    expect(() =>
      buildControlledOccurrenceWorksheet({
        document: SYNTHETIC_DOCUMENT,
        documentFingerprint: "fixture-sha256",
        catalog: {
          schemaVersion: 1,
          catalogId: "unsafe-definitive-scope",
          categoryView: "EL",
          requirements: [
            {
              id: "EL-99",
              label: "Unsicherer enger Scope",
              requestedFields: [],
              scopePolicy: "MATCHING_SCOPE_DEFINITIVE_SUFFICIENT",
              components: [
                {
                  id: "glass",
                  label: "Glas",
                  factRole: "INSURED_OBJECT",
                  aliases: ["Garagen"],
                },
              ],
            },
          ],
        },
      })
    ).toThrow("DEFINITIVE_SCOPE_KEYS_REQUIRED: EL-99");
  });

  test("finds a source-exact candidate from all required lexical concept groups", () => {
    const document = documentFromPages([
      [
        "Leitungswasserversicherung",
        "Versichert sind Suchkosten sowie die Kosten der Wiederherstellung",
        "in den ursprünglichen Zustand nach einem Rohrbruch.",
      ].join("\n"),
    ]);
    const worksheet = buildControlledOccurrenceWorksheet({
      document,
      documentFingerprint: "concept-search-fixture",
      catalog: {
        schemaVersion: 1,
        catalogId: "concept-search-test",
        categoryView: "LW",
        requirements: [
          {
            id: "LW-09",
            label: "Wiederherstellung nach Ortung",
            requestedFields: [],
            components: [
              {
                id: "restoration",
                label: "Wiederherstellungskosten",
                factRole: "COST",
                aliases: ["Wiederherstellungskosten nach der Ortung"],
                conceptSearches: [
                  {
                    id: "restoration-after-location",
                    requiredGroups: [
                      { prefixes: ["wiederherstell"] },
                      { prefixes: ["suchkost", "rohrbruch", "ortung"] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const [candidate] = worksheet.requirements[0].components[0].occurrences;

    expect(candidate).toMatchObject({
      matchedAlias: "CONCEPT_SEARCH:restoration-after-location",
      exactText: expect.stringContaining("Kosten der Wiederherstellung"),
    });
    expect(candidate.exactText).toContain("Suchkosten");
    expect(
      document.pageContent.slice(candidate.documentStart, candidate.documentEnd)
    ).toBe(candidate.exactText);
  });

  test("keeps a component unresolved when one required concept group is absent", () => {
    const document = documentFromPages([
      "Leitungswasser: Kosten der Wiederherstellung nach einem Schaden.",
    ]);
    const worksheet = buildControlledOccurrenceWorksheet({
      document,
      documentFingerprint: "concept-search-negative-fixture",
      catalog: {
        schemaVersion: 1,
        catalogId: "concept-search-negative-test",
        categoryView: "LW",
        requirements: [
          {
            id: "LW-09",
            label: "Wiederherstellung nach Ortung",
            requestedFields: [],
            components: [
              {
                id: "restoration",
                label: "Wiederherstellungskosten",
                factRole: "COST",
                aliases: ["Wiederherstellungskosten nach der Ortung"],
                conceptSearches: [
                  {
                    id: "restoration-after-location",
                    requiredGroups: [
                      { prefixes: ["wiederherstell"] },
                      { prefixes: ["suchkost", "rohrbruch", "ortung"] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(worksheet.requirements[0].components[0]).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
  });

  test("rejects unsafe or overly broad concept prefixes", () => {
    expect(() =>
      buildControlledOccurrenceWorksheet({
        document: SYNTHETIC_DOCUMENT,
        documentFingerprint: "invalid-concept-prefix",
        catalog: {
          schemaVersion: 1,
          catalogId: "invalid-concept-prefix",
          categoryView: "LW",
          requirements: [
            {
              id: "LW-99",
              label: "Unsicherer Suchvertrag",
              requestedFields: [],
              components: [
                {
                  id: "unsafe",
                  label: "Unsicher",
                  factRole: "DAMAGE",
                  aliases: ["Rohrbruch"],
                  conceptSearches: [
                    {
                      id: "unsafe",
                      requiredGroups: [{ prefixes: ["ro"] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
    ).toThrow("CONCEPT_PREFIX_INVALID");
  });

  test("fails closed on an incomplete or corrupt PageMap", () => {
    expect(() =>
      buildControlledOccurrenceWorksheet({
        document: {
          ...SYNTHETIC_DOCUMENT,
          pdfExtraction: {
            ...SYNTHETIC_DOCUMENT.pdfExtraction,
            complete: false,
          },
        },
        documentFingerprint: "fixture-sha256",
        catalog,
      })
    ).toThrow("PDF_PAGEMAP_INVALID");
  });
});
