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
      comparisonDocumentId: documentId,
      items: facts,
    },
  };
}

describe("ComparisonFactTable", () => {
  test("renders every validated fact exactly once in code-controlled order", () => {
    const inventories = [
      inventory(1, "A", [
        {
          factKey: "coverage",
          factType: "coverage",
          label: "Leitungswasser",
          claimText: "Rohrbruchschäden sind versichert.",
          evidenceText: "Rohrbruchschäden sind versichert.",
          pageNumber: 2,
          evidenceStart: 50,
          evidenceEnd: 84,
        },
        {
          factKey: "limit",
          factType: "limit",
          label: "Leitungswasser",
          claimText: "Höchstentschädigung 10.000 Euro.",
          evidenceText: "Höchstentschädigung EUR 10.000.",
          value: 10_000,
          unit: "EUR",
          pageNumber: 2,
          evidenceStart: 90,
          evidenceEnd: 125,
        },
      ]),
      inventory(2, "B", [
        {
          factKey: "coverage",
          factType: "exclusion",
          label: "Leitungswasser",
          claimText: "Bei Leerstand ausgeschlossen.",
          evidenceText: "Bei Leerstand ausgeschlossen.",
          pageNumber: 7,
          evidenceStart: 20,
          evidenceEnd: 49,
        },
      ]),
    ];

    const plan = ComparisonFactTable.plan(inventories);
    const markdown = ComparisonFactTable.render(plan);

    expect(plan.rows).toHaveLength(3);
    expect(plan.expectedFactKeys).toEqual([
      "1:coverage",
      "1:limit",
      "2:coverage",
    ]);
    expect(markdown.match(/A\.pdf/gu)).toHaveLength(2);
    expect(markdown.match(/B\.pdf/gu)).toHaveLength(1);
    expect(markdown).toContain("10.000 EUR");
    expect(markdown).toContain("physische PDF-Seite 7");
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
