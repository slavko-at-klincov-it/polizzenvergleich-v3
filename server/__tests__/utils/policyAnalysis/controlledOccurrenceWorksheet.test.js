const catalog = require("../../../resources/policyAnalysis/vs-occurrence-pilot.v0.1.json");
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
    ["ALLGEMEINE VERTRAGSBESTIMMUNGEN", "GENERAL_CONTRACT_TERMS"],
    ["7. Wohnungseigentum", "WOHNUNGSEIGENTUM_INSURANCE"],
    ["7. Glasbruch", "GLASBRUCH_INSURANCE"],
    ["B. ALLGEMEINER TEIL", "GENERAL_CONTRACT_TERMS"],
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
