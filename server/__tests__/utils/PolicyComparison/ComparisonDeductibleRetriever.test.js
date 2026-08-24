jest.mock("../../../utils/PolicyComparison/ComparisonClauseBlockIndex", () => ({
  ComparisonClauseBlockIndex: { searchAllRun: jest.fn() },
}));
jest.mock(
  "../../../utils/PolicyComparison/ComparisonClauseEmbeddingIndex",
  () => ({
    ComparisonClauseEmbeddingIndex: { semanticLinks: jest.fn() },
  })
);

const {
  ComparisonClauseBlockIndex,
} = require("../../../utils/PolicyComparison/ComparisonClauseBlockIndex");
const {
  ComparisonClauseEmbeddingIndex,
} = require("../../../utils/PolicyComparison/ComparisonClauseEmbeddingIndex");
const {
  ComparisonDeductibleRetriever,
} = require("../../../utils/PolicyComparison/ComparisonDeductibleRetriever");

function signal(kind, evidenceText, normalizedValue, sourceStart) {
  return {
    kind,
    evidenceText,
    normalizedValue,
    sourceStart,
    sourceEnd: sourceStart + evidenceText.length,
  };
}

function ledger({ document, analysisRunId, units }) {
  return {
    comparisonDocument: document,
    analysisRunId,
    units,
    deterministicResults: new Map(
      units.map((unit) => [
        unit.blockKey,
        {
          facts: unit.deductibleEvidence
            ? [
                {
                  factKey: `fact-${unit.blockKey}`,
                  factType: "deductible",
                  value: unit.value || null,
                  evidenceText: unit.deductibleEvidence,
                  evidenceStart: unit.sourceStart,
                  evidenceEnd:
                    unit.sourceStart + unit.deductibleEvidence.length,
                },
              ]
            : [],
        },
      ])
    ),
  };
}

describe("ComparisonDeductibleRetriever", () => {
  beforeEach(() => jest.clearAllMocks());

  test("routes ordinary deductible questions but not the exhaustive broker template", () => {
    expect(
      ComparisonDeductibleRetriever.matches(
        "Vergleiche mir die Selbstbehalte der beiden Dokumente."
      )
    ).toBe(true);
    expect(
      ComparisonDeductibleRetriever.matches(
        "Ermittle alle Selbstbehalte im Dokument. Nenne Betrag, Bedingung und physische PDF-Seite."
      )
    ).toBe(true);
    expect(
      ComparisonDeductibleRetriever.matches(`
        Analysiere das Dokument vollständig. Tabelle je Abschnitt:
        Versicherungssumme / Sublimit | Selbstbehalt | Voraussetzungen.
      `)
    ).toBe(false);
    expect(
      ComparisonDeductibleRetriever.matches(
        "Vergleiche Selbstbehalte und Deckungsgrenzen."
      )
    ).toBe(false);
  });

  test("renders every lexical deductible occurrence with amount, condition, heading and physical page without a model call", async () => {
    const document = {
      id: 1,
      slot: "A",
      originalFilename: "A.pdf",
    };
    const units = [
      {
        id: 11,
        blockKey: "fire",
        ordinal: 0,
        pageNumber: 2,
        sourceStart: 0,
        text: "Selbstbehalt EUR 350 je Schadenfall.",
        structureKind: "paragraph",
        headingPath: ["Feuer"],
        deductibleEvidence: "Selbstbehalt EUR 350 je Schadenfall.",
        value: { kind: "money", amount: 350, currency: "EUR" },
        riskSignals: [signal("condition", "je Schadenfall", null, 21)],
      },
      {
        id: 12,
        blockKey: "water",
        ordinal: 1,
        pageNumber: 5,
        sourceStart: 100,
        text: "Franchise EUR 500 bei Leerstand.",
        structureKind: "paragraph",
        headingPath: ["Leitungswasser", "Variante C"],
        deductibleEvidence: "Franchise EUR 500 bei Leerstand.",
        value: { kind: "money", amount: 500, currency: "EUR" },
        riskSignals: [signal("condition", "bei Leerstand", null, 118)],
      },
    ];
    const inventoryService = {
      ensureDeterministicLedgerForDocuments: jest.fn(async () => [
        ledger({ document, analysisRunId: 41, units }),
      ]),
    };
    ComparisonClauseBlockIndex.searchAllRun.mockResolvedValue([
      { blockId: 11 },
      { blockId: 12 },
    ]);
    ComparisonClauseEmbeddingIndex.semanticLinks.mockResolvedValue([]);

    const result = await ComparisonDeductibleRetriever.retrieve({
      documents: [document],
      inventoryService,
    });

    expect(result.coverage).toEqual({
      documents: 1,
      matchedRows: 2,
      modelCalls: 0,
      generativeModelCalls: 0,
      semanticQueryEmbeddingCalls: 1,
      unresolvedCandidates: 0,
    });
    expect(result.deterministicTextResponse).toContain("Feuer");
    expect(result.deterministicTextResponse).toContain("350 EUR");
    expect(result.deterministicTextResponse).toContain("je Schadenfall");
    expect(result.deterministicTextResponse).toContain(
      "Leitungswasser › Variante C"
    );
    expect(result.deterministicTextResponse).toContain("500 EUR");
    expect(result.sources.map((source) => source.pageNumber)).toEqual([2, 5]);
  });

  test("uses a directly adjacent table value without merging unrelated pages", async () => {
    const document = {
      id: 1,
      slot: "A",
      originalFilename: "Tabelle.pdf",
    };
    const units = [
      {
        id: 21,
        blockKey: "label",
        ordinal: 4,
        pageNumber: 3,
        sourceStart: 0,
        text: "Selbstbehalt",
        structureKind: "table_row",
        headingPath: ["Sturm", "Premiumschutz"],
        deductibleEvidence: "Selbstbehalt",
        riskSignals: [signal("deductible", "Selbstbehalt", "selbstbehalt", 0)],
      },
      {
        id: 22,
        blockKey: "value",
        ordinal: 5,
        pageNumber: 3,
        sourceStart: 20,
        text: "EUR 750",
        structureKind: "table_row",
        headingPath: ["Sturm", "Premiumschutz"],
        riskSignals: [signal("money", "EUR 750", "750", 20)],
      },
      {
        id: 23,
        blockKey: "other-page",
        ordinal: 6,
        pageNumber: 4,
        sourceStart: 30,
        text: "EUR 9.999",
        structureKind: "table_row",
        headingPath: ["Sturm", "Premiumschutz"],
        riskSignals: [signal("money", "EUR 9.999", "9999", 30)],
      },
    ];
    const inventoryService = {
      ensureDeterministicLedgerForDocuments: jest.fn(async () => [
        ledger({ document, analysisRunId: 42, units }),
      ]),
    };
    ComparisonClauseBlockIndex.searchAllRun.mockResolvedValue([
      { blockId: 21 },
    ]);
    ComparisonClauseEmbeddingIndex.semanticLinks.mockResolvedValue([]);

    const result = await ComparisonDeductibleRetriever.retrieve({
      documents: [document],
      inventoryService,
    });

    expect(result.deterministicTextResponse).toContain("750 EUR");
    expect(result.deterministicTextResponse).not.toContain("9.999");
  });

  test("does not borrow an unrelated amount from an adjacent ordinary paragraph with the same heading", async () => {
    const document = { id: 1, slot: "A", originalFilename: "A.pdf" };
    const units = [
      {
        id: 31,
        blockKey: "deductible-label",
        ordinal: 1,
        pageNumber: 2,
        sourceStart: 0,
        text: "Selbstbehalt laut Vereinbarung.",
        structureKind: "paragraph",
        headingPath: ["Feuer"],
        deductibleEvidence: "Selbstbehalt laut Vereinbarung.",
        riskSignals: [],
      },
      {
        id: 32,
        blockKey: "coverage-limit",
        ordinal: 2,
        pageNumber: 2,
        sourceStart: 40,
        text: "Höchstentschädigung EUR 50.000.",
        structureKind: "paragraph",
        headingPath: ["Feuer"],
        riskSignals: [signal("money", "EUR 50.000", "50000", 61)],
      },
    ];
    const inventoryService = {
      ensureDeterministicLedgerForDocuments: jest.fn(async () => [
        ledger({ document, analysisRunId: 45, units }),
      ]),
    };
    ComparisonClauseBlockIndex.searchAllRun.mockResolvedValue([
      { blockId: 31 },
    ]);
    ComparisonClauseEmbeddingIndex.semanticLinks.mockResolvedValue([]);

    const result = await ComparisonDeductibleRetriever.retrieve({
      documents: [document],
      inventoryService,
    });

    expect(result.deterministicTextResponse).toContain(
      "keine Betragsangabe im Beleg"
    );
    expect(result.deterministicTextResponse).not.toContain("50.000");
  });

  test("does not treat an unqualified generic 'selbst zu tragen' cost as a deductible", async () => {
    const document = { id: 1, slot: "A", originalFilename: "A.pdf" };
    const text = "Nicht ersetzte Reisekosten sind selbst zu tragen.";
    const unit = {
      id: 41,
      blockKey: "generic-cost",
      ordinal: 0,
      pageNumber: 7,
      sourceStart: 0,
      text,
      structureKind: "paragraph",
      headingPath: ["Allgemeine Kosten"],
      deductibleEvidence: text,
      riskSignals: [
        signal("deductible", "selbst zu tragen", "selbst zu tragen", 29),
      ],
    };
    const inventoryService = {
      ensureDeterministicLedgerForDocuments: jest.fn(async () => [
        ledger({ document, analysisRunId: 46, units: [unit] }),
      ]),
    };
    ComparisonClauseBlockIndex.searchAllRun.mockResolvedValue([
      { blockId: 41 },
    ]);
    ComparisonClauseEmbeddingIndex.semanticLinks.mockResolvedValue([]);

    const result = await ComparisonDeductibleRetriever.retrieve({
      documents: [document],
      inventoryService,
    });

    expect(result.rows).toHaveLength(0);
    expect(result.coverage.unresolvedCandidates).toBe(1);
  });

  test("keeps every anonymized gold-case deductible as a separate evidenced row", async () => {
    const document = {
      id: 2,
      slot: "B",
      originalFilename: "synthetisch-b.pdf",
    };
    const fixtures = [
      ["Vandalismuserweiterung", 6, "EUR 500", "500"],
      ["Erdbeben", 8, "EUR 350", "350"],
      ["Umweltschaden", 11, "10 %", "10"],
      ["Gefährlicher Abfall", 13, "25 %", "25"],
    ];
    const units = fixtures.map(
      ([heading, page, evidenceValue, value], index) => {
        const text = `${heading}: Selbstbehalt ${evidenceValue} je Schadenfall.`;
        const isPercentage = evidenceValue.includes("%");
        return {
          id: 100 + index,
          blockKey: `gold-${index}`,
          ordinal: index,
          pageNumber: page,
          sourceStart: index * 100,
          text,
          structureKind: "paragraph",
          headingPath: [heading],
          deductibleEvidence: text,
          value: isPercentage
            ? { kind: "percentage", percent: Number(value) }
            : { kind: "money", amount: Number(value), currency: "EUR" },
          riskSignals: [
            signal(
              "condition",
              "je Schadenfall",
              "je schadenfall",
              index * 100 + text.indexOf("je Schadenfall")
            ),
          ],
        };
      }
    );
    const inventoryService = {
      ensureDeterministicLedgerForDocuments: jest.fn(async () => [
        ledger({ document, analysisRunId: 43, units }),
      ]),
    };
    ComparisonClauseBlockIndex.searchAllRun.mockResolvedValue(
      units.map((unit) => ({ blockId: unit.id }))
    );
    ComparisonClauseEmbeddingIndex.semanticLinks.mockResolvedValue([]);

    const result = await ComparisonDeductibleRetriever.retrieve({
      documents: [document],
      inventoryService,
    });

    expect(result.rows).toHaveLength(4);
    expect(result.deterministicTextResponse).toContain("500 EUR");
    expect(result.deterministicTextResponse).toContain("350 EUR");
    expect(result.deterministicTextResponse).toContain("10 %");
    expect(result.deterministicTextResponse).toContain("25 %");
    expect(result.sources.map((source) => source.pageNumber)).toEqual([
      6, 8, 11, 13,
    ]);
  });

  test("derives a grounded condition phrase when no generic condition signal exists", async () => {
    const document = { id: 1, slot: "A", originalFilename: "A.pdf" };
    const text = "Für Personenschäden gilt kein vereinbarter Selbstbehalt.";
    const unit = {
      id: 301,
      blockKey: "person-damage",
      ordinal: 0,
      pageNumber: 5,
      sourceStart: 0,
      text,
      structureKind: "paragraph",
      headingPath: ["Haus- und Grundbesitzerhaftpflicht"],
      deductibleEvidence: text,
      riskSignals: [],
    };
    const inventoryService = {
      ensureDeterministicLedgerForDocuments: jest.fn(async () => [
        ledger({ document, analysisRunId: 44, units: [unit] }),
      ]),
    };
    ComparisonClauseBlockIndex.searchAllRun.mockResolvedValue([
      { blockId: unit.id },
    ]);
    ComparisonClauseEmbeddingIndex.semanticLinks.mockResolvedValue([]);

    const result = await ComparisonDeductibleRetriever.retrieve({
      documents: [document],
      inventoryService,
    });

    expect(result.deterministicTextResponse).toContain(
      "Für Personenschäden gilt kein vereinbarter Selbstbehalt"
    );
    expect(result.sources[0].pageNumber).toBe(5);
  });
});
