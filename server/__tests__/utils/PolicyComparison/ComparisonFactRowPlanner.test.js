const {
  ComparisonFactRowPlanner,
} = require("../../../utils/PolicyComparison/ComparisonFactRowPlanner");
const {
  PromptOutputContractParser,
} = require("../../../utils/PolicyComparison/PromptOutputContractParser");

function fact(
  factKey,
  factType,
  evidenceText,
  {
    label = "Vandalismus",
    blockKey = "block-vandalismus",
    headingPath = ["Sachversicherung", "Vandalismus"],
    pageNumber = 18,
    evidenceStart = 100,
    value = null,
  } = {}
) {
  return {
    factKey,
    factType,
    label,
    claimText: evidenceText,
    evidenceText,
    value,
    pageNumber,
    evidenceStart,
    evidenceEnd: evidenceStart + evidenceText.length,
    unitKey: blockKey,
    sourceContext: {
      blockKey,
      ordinal: 7,
      pageNumber,
      printedPageLabel: null,
      headingPath,
      structureKind: "paragraph",
    },
    evidences: [
      {
        pageNumber,
        sourceStart: evidenceStart,
        sourceEnd: evidenceStart + evidenceText.length,
        evidenceText,
      },
    ],
  };
}

function inventory(documentId, slot, facts, analysisRunId = 100 + documentId) {
  return {
    document: {
      id: documentId,
      slot,
      originalFilename: `${slot}.pdf`,
    },
    manifest: {
      analysisRunId,
      comparisonDocumentId: documentId,
      items: facts,
    },
  };
}

const contract = PromptOutputContractParser.parse({
  userPrompt: "Analysiere alle Deckungsinhalte vollständig.",
});

describe("ComparisonFactRowPlanner", () => {
  test("keeps all related Vandalismus roles in one code-owned row", () => {
    const facts = [
      fact("coverage", "coverage", "Vandalismusschäden sind versichert."),
      fact("percent", "limit", "Die Entschädigung beträgt 1 %.", {
        evidenceStart: 150,
        value: { kind: "percentage", percent: 1 },
      }),
      fact("maximum", "limit", "Maximal werden EUR 10.000 ersetzt.", {
        evidenceStart: 190,
        value: { kind: "money", amount: 10_000, currency: "EUR" },
      }),
      fact("deductible", "deductible", "Der Selbstbehalt beträgt EUR 500.", {
        evidenceStart: 240,
        value: { kind: "money", amount: 500, currency: "EUR" },
      }),
      fact(
        "condition",
        "condition",
        "Nur ohne versuchten Einbruch oder Raub.",
        {
          evidenceStart: 290,
        }
      ),
      fact(
        "exclusion",
        "exclusion",
        "Schäden durch Graffiti sind ausgeschlossen.",
        {
          evidenceStart: 340,
        }
      ),
      fact(
        "obligation",
        "obligation",
        "Der Schaden ist der Polizei anzuzeigen.",
        {
          evidenceStart: 390,
        }
      ),
    ];

    const plan = ComparisonFactRowPlanner.plan({
      inventories: [inventory(2, "B", facts)],
      outputContract: contract,
    });
    const rows = plan.documents.flatMap((document) =>
      document.sections.flatMap((section) => section.rows)
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].factRefs).toHaveLength(7);
    expect(rows[0].cells.limit).toContain("1 %");
    expect(rows[0].cells.limit).toContain("EUR 10.000");
    expect(rows[0].cells.deductible).toContain("EUR 500");
    expect(rows[0].cells.restriction).toContain("Ausschluss");
    expect(rows[0].cells.restriction).toContain("Graffiti");
    expect(rows[0].cells.restriction).toContain("Obliegenheit");
    expect(rows[0].cellFactRefs.limit).toHaveLength(2);
    expect(rows[0].cellFactRefs.deductible).toHaveLength(1);
    expect(rows[0].cellFactRefs.restriction).toHaveLength(3);
    expect(rows[0].cellFactRefs.source).toHaveLength(7);
    expect(plan.expectedFactRefs).toHaveLength(7);
  });

  test("never merges the same topic across variants", () => {
    const plan = ComparisonFactRowPlanner.plan({
      inventories: [
        inventory(1, "A", [
          fact("c-limit", "limit", "Variante C: EUR 7.500.", {
            blockKey: "variant-c",
            headingPath: ["Leitungswasser", "VARIANTE C"],
            value: { kind: "money", amount: 7_500, currency: "EUR" },
          }),
          fact("d-limit", "limit", "Variante D: EUR 10.000.", {
            blockKey: "variant-d",
            headingPath: ["Leitungswasser", "VARIANTE D"],
            value: { kind: "money", amount: 10_000, currency: "EUR" },
          }),
        ]),
      ],
      outputContract: contract,
    });
    const rows = plan.documents[0].sections.flatMap((section) => section.rows);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.variant.label).sort()).toEqual([
      "Variante C",
      "Variante D",
    ]);
    expect(
      rows.find((row) => row.variant.label === "Variante C").cells.limit
    ).toContain("7.500");
    expect(
      rows.find((row) => row.variant.label === "Variante D").cells.limit
    ).toContain("10.000");
  });

  test("uses each evidence block's own heading path in the source cell", () => {
    const item = fact(
      "multi-evidence",
      "exclusion",
      "Graffiti ist ausgeschlossen.",
      { evidenceStart: 340 }
    );
    item.evidences.push({
      pageNumber: 19,
      sourceStart: 500,
      sourceEnd: 540,
      evidenceText: "Zusätzliche Ausschlussregel.",
      sourceContext: {
        blockKey: "block-graffiti",
        printedPageLabel: "6 von 14",
        headingPath: ["Ausschlüsse", "Graffiti"],
      },
    });
    const plan = ComparisonFactRowPlanner.plan({
      inventories: [inventory(2, "B", [item])],
      outputContract: contract,
    });
    const row = plan.documents[0].sections.flatMap(
      (section) => section.rows
    )[0];

    expect(row.cells.source).toContain("Sachversicherung › Vandalismus");
    expect(row.cells.source).toContain("Ausschlüsse › Graffiti");
    expect(row.cells.source).toContain("physische PDF-Seite 19");
  });

  test("keeps documents and equal fact keys isolated", () => {
    const plan = ComparisonFactRowPlanner.plan({
      inventories: [
        inventory(1, "A", [
          fact("same-key", "coverage", "Feuerschäden sind versichert.", {
            label: "Feuer",
            blockKey: "a-feuer",
            pageNumber: 2,
          }),
        ]),
        inventory(2, "B", [
          fact("same-key", "coverage", "Brandschäden sind versichert.", {
            label: "Feuer",
            blockKey: "b-feuer",
            pageNumber: null,
          }),
        ]),
      ],
      outputContract: contract,
    });

    expect(plan.documents).toHaveLength(2);
    expect(plan.expectedFactRefs).toEqual(["101:1:same-key", "102:2:same-key"]);
    expect(
      plan.documents[0].sections.flatMap((section) => section.rows)
    ).toHaveLength(1);
    expect(
      plan.documents[1].sections.flatMap((section) => section.rows)
    ).toHaveLength(1);
    expect(
      plan.documents[1].sections.flatMap((section) => section.rows)[0].cells
        .source
    ).not.toContain("physische PDF-Seite");
  });

  test("fails closed when a fact ownership is missing or duplicated", () => {
    const plan = ComparisonFactRowPlanner.plan({
      inventories: [
        inventory(1, "A", [
          fact("coverage", "coverage", "Feuer ist versichert.", {
            label: "Feuer",
          }),
        ]),
      ],
      outputContract: contract,
    });
    const row = plan.documents[0].sections.flatMap(
      (section) => section.rows
    )[0];
    row.factRefs = [];
    expect(() => ComparisonFactRowPlanner.assertCoverage(plan)).toThrow(
      "1 missing"
    );
    row.factRefs = [plan.expectedFactRefs[0], plan.expectedFactRefs[0]];
    expect(() => ComparisonFactRowPlanner.assertCoverage(plan)).toThrow(
      "1 duplicate"
    );
  });
});
