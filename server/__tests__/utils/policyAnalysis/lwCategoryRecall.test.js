const catalog = require("../../../resources/policyAnalysis/lw-occurrence-full-draft.v0.1.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function worksheetFromText(text) {
  const document = {
    id: "synthetic-lw-recall",
    sourceDocumentId: "synthetic-lw-recall",
    title: "synthetic-lw-recall.pdf",
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
  };
  return buildControlledOccurrenceWorksheet({
    document,
    documentFingerprint: "synthetic-lw-recall-fingerprint",
    catalog,
  });
}

function component(worksheet, requirementId, componentId) {
  return worksheet.requirements
    .find(({ id }) => id === requirementId)
    .components.find(({ id }) => id === componentId);
}

describe("LW category recall", () => {
  test.each([
    "WC-Schale",
    "WC-Schalen",
    "Toilettenbecken",
    "Klosettbecken",
    "Sanitärgegenstände",
    "Sanitäreinrichtungen",
  ])("LW-07 recalls the sanitary fixture form %s", (wording) => {
    const clause = `Ersatz oder Reparatur von ${wording} auch ohne Rohrgebrechen`;
    const worksheet = worksheetFromText(
      ["Leitungswasserversicherung", clause].join("\n")
    );
    const result = component(worksheet, "LW-07", "sanitary_ceramics");

    expect(result.occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchedAlias: wording,
          exactText: wording,
          context: expect.objectContaining({
            text: expect.stringContaining(clause),
          }),
        }),
      ])
    );
  });

  test.each([
    "Frostschaden an angeschlossenen Einrichtungen",
    "Frostschäden an angeschlossenen Einrichtungen",
    "Frost an angeschlossenen Einrichtungen",
    "Schäden an angeschlossenen Einrichtungen und Armaturen anlässlich Rohrbruch, Rohrbruch durch Korrosion und Frostschaden",
  ])("LW-07 binds connected sanitary fixtures to frost in %s", (wording) => {
    const worksheet = worksheetFromText(
      ["Leitungswasserversicherung", wording].join("\n")
    );

    expect(
      component(worksheet, "LW-07", "sanitary_ceramics").occurrences
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchedAlias: wording,
          exactText: wording,
        }),
      ])
    );
  });

  test.each([
    "WC-Sitz",
    "WC-Spülkasten",
    "Keramikfliesen",
    "Sanitärreinigung",
    "Siphon",
    "angeschlossene elektrische Einrichtungen",
    "Reparatur angeschlossener Einrichtungen nach Überspannung",
  ])("LW-07 does not promote the unapproved fixture wording %s", (wording) => {
    const worksheet = worksheetFromText(
      ["Leitungswasserversicherung", wording].join("\n")
    );

    expect(component(worksheet, "LW-07", "sanitary_ceramics")).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
  });

  test.each([
    "Allmählichkeitsschaden",
    "Allmählichkeitsschäden",
    "Schäden durch Langzeiteinwirkung",
    "Langzeitschaden",
    "Langzeitschäden",
  ])("LW-25 recalls the gradual-damage clause form %s", (wording) => {
    const worksheet = worksheetFromText(
      [
        "B4 Leitungswasserversicherung (LW)",
        `LW01 ${wording}`,
        `${wording} sind generell mitversichert.`,
      ].join("\n")
    );
    const result = component(
      worksheet,
      "LW-25",
      "gradual_or_creeping_exclusion"
    );
    expect(result.occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchedAlias: wording,
          sectionScopeHint: expect.objectContaining({
            scopeKey: "LEITUNGSWASSER_INSURANCE",
            source: "CURRENT_PAGE_HEADING",
          }),
        }),
      ])
    );
  });

  test("LW-25 recalls the real positive wording without changing its effect in retrieval", () => {
    const wording =
      "Allmählichkeitsschäden und Schäden durch Langzeiteinwirkung sind generell mitversichert";
    const worksheet = worksheetFromText(
      [
        "B4 Leitungswasserversicherung (LW)",
        "LW01 Allmählichkeitsschäden",
        wording,
      ].join("\n")
    );
    const result = component(
      worksheet,
      "LW-25",
      "gradual_or_creeping_exclusion"
    );
    expect(result.occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exactText: "Allmählichkeitsschäden",
          context: expect.objectContaining({
            text: expect.stringContaining(wording),
          }),
        }),
        expect.objectContaining({
          exactText: "Schäden durch Langzeiteinwirkung",
          context: expect.objectContaining({
            text: expect.stringContaining(wording),
          }),
        }),
      ])
    );
  });

  test.each([
    "dauernde Versicherung",
    "Das Gebäude ist dauernd entwertet.",
    "Austrocknungs- und Entfeuchtungskosten sind mitversichert.",
    "Korrosion und Verschleiß sind ausgeschlossen.",
    "Holzfäule, Schwamm und Vermorschung sind nicht versichert.",
  ])(
    "LW-25 does not promote the narrower or unrelated wording %s",
    (wording) => {
      const worksheet = worksheetFromText(
        ["B4 Leitungswasserversicherung (LW)", wording].join("\n")
      );
      expect(
        component(worksheet, "LW-25", "gradual_or_creeping_exclusion")
      ).toMatchObject({
        terminalState: "NO_CONTROLLED_CANDIDATE",
        occurrenceCount: 0,
      });
    }
  );
});
