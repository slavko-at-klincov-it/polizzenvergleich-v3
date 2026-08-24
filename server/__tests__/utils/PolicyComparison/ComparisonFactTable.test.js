const {
  ComparisonFactTable,
} = require("../../../utils/PolicyComparison/ComparisonFactTable");

function inventory(documentId, slot, facts) {
  return {
    document: {
      id: documentId,
      slot,
      originalFilename: `${slot}.pdf`,
    },
    manifest: {
      analysisRunId: 40 + documentId,
      comparisonDocumentId: documentId,
      items: facts,
    },
  };
}

function fact(factKey, factType, text, start) {
  return {
    factKey,
    factType,
    label: "Leitungswasser",
    claimText: text,
    evidenceText: text,
    pageNumber: 2,
    evidenceStart: start,
    evidenceEnd: start + text.length,
    unitKey: "leitungswasser-block",
    sourceContext: {
      blockKey: "leitungswasser-block",
      ordinal: 4,
      pageNumber: 2,
      headingPath: ["Leitungswasser"],
      structureKind: "paragraph",
    },
  };
}

describe("ComparisonFactTable", () => {
  test("renders grouped facts in the exact requested columns", () => {
    const prompt = `
Analysiere das Dokument vollständig. Keine Position auslassen.
1. Versicherte Sachen
2. Sparten
3. Erweiterungen
TABELLE
| Deckungsposition | Leistungsversprechen | Selbstbehalt | Quelle |
SPALTENREGELN
Keine Zusammenfassung.
`;
    const plan = ComparisonFactTable.plan(
      [
        inventory(1, "A", [
          fact("coverage", "coverage", "Rohrbruchschäden sind versichert.", 50),
          fact("deductible", "deductible", "Selbstbehalt EUR 500.", 90),
        ]),
      ],
      { userPrompt: prompt }
    );
    const markdown = ComparisonFactTable.render(plan);

    const rows = plan.documents[0].sections.flatMap((section) => section.rows);
    expect(rows).toHaveLength(1);
    expect(markdown).toContain(
      "| Deckungsposition | Leistungsversprechen | Selbstbehalt | Quelle |"
    );
    expect(markdown).toContain("Rohrbruchschäden sind versichert.");
    expect(markdown).toContain("Selbstbehalt EUR 500.");
    expect(markdown).toContain("physische PDF-Seite 2");
    expect(markdown).not.toContain("Versicherungssumme / Sublimit");
    expect(rows[0].cells.deductible).toBe("Selbstbehalt EUR 500.");
  });

  test("renders two complete document sections without mixing sources", () => {
    const plan = ComparisonFactTable.plan([
      inventory(1, "A", [fact("a", "coverage", "Feuer A.", 10)]),
      inventory(2, "B", [fact("b", "coverage", "Feuer B.", 20)]),
    ]);
    const markdown = ComparisonFactTable.render(plan);

    expect(markdown).toContain("# Dokument A – A.pdf");
    expect(markdown).toContain("# Dokument B – B.pdf");
    expect(markdown.indexOf("A.pdf")).toBeLessThan(markdown.indexOf("B.pdf"));
    expect(plan.expectedFactRefs).toEqual(["41:1:a", "42:2:b"]);
  });

  test("recognizes the broker's exhaustive structured prompt", () => {
    expect(
      ComparisonFactTable.isCompleteAnalysisRequest(
        "Analysiere das Dokument vollständig. Erstelle eine Tabelle aller Deckungsinhalte; keine Position auslassen."
      )
    ).toBe(true);
    expect(
      ComparisonFactTable.isCompleteAnalysisRequest(
        "Ist Vandalismus vollständig gedeckt?"
      )
    ).toBe(false);
  });
});
