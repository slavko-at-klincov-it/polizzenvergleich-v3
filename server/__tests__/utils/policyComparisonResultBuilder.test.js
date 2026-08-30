const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  CATEGORY_ORDER,
  buildComparisonResult,
  comparePackages,
  summarizePackage,
  writeComparisonArtifacts,
} = require("../../utils/policyComparison/resultBuilder");

function row(categoryId, overrides = {}) {
  return {
    categoryId,
    stage: "Basis",
    categoryName: `Kategorie ${categoryId}`,
    documentedContent: "keine belegte Fundstelle gefunden",
    coverage: "Nicht feststellbar",
    coverageAmount: "Nicht feststellbar",
    source: "keine belegte Fundstelle gefunden",
    reviewStatus: "UNGEKLÄRT",
    ...overrides,
  };
}

function document(uuid, side, role = "MAIN_POLICY") {
  return {
    uuid,
    side,
    role,
    documentStatus: "ACTIVE",
    originalName: `${uuid}.pdf`,
    sha256: uuid.repeat(64).slice(0, 64),
  };
}

function writeRun(root, sourceDocument, rowOverrides = {}) {
  const outputDirectory = path.join(root, sourceDocument.uuid);
  for (const categoryView of CATEGORY_ORDER) {
    const resultDirectory = path.join(outputDirectory, categoryView, "result");
    fs.mkdirSync(resultDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(resultDirectory, "rows.private.json"),
      JSON.stringify([
        row(`${categoryView}-01`, rowOverrides[categoryView] || {}),
      ])
    );
  }
  return { document: sourceDocument, outputDirectory };
}

describe("policy comparison result builder", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "policy-comparison-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("keeps simultaneous object facts separate instead of inventing a contradiction", () => {
    const packageSummary = summarizePackage([
      {
        document: document("a", "A", "MAIN_POLICY"),
        row: row("EL-16", {
          documentedContent: "Wintergärten sind eingeschlossen",
          coverage: "Ja",
          source: "PDF-Seite 12",
          reviewStatus: "BELEGT",
        }),
      },
      {
        document: document("b", "A", "SUPPLEMENT"),
        row: row("EL-16", {
          documentedContent: "Vitrinen sind ausgeschlossen",
          coverage: "Nein",
          source: "PDF-Seite 3",
          reviewStatus: "BELEGT",
        }),
      },
    ]);

    expect(packageSummary.documentedContent).toContain("Wintergärten");
    expect(packageSummary.documentedContent).toContain("Vitrinen");
    expect(packageSummary.reviewStatus).toBe("RANGFOLGE_PRÜFEN");
    expect(packageSummary.reviewStatus).not.toBe("WIDERSPRÜCHLICH");
    expect(packageSummary.facts).toHaveLength(2);
  });

  test("does not call one-sided evidence an automatic advantage", () => {
    const withEvidence = summarizePackage([
      {
        document: document("a", "A"),
        row: row("VS-01", {
          documentedContent: "Gebäudeversicherungssumme 2 Mio. EUR",
          coverage: "Ja",
          coverageAmount: "2 Mio. EUR",
          source: "PDF-Seite 1",
          reviewStatus: "BELEGT",
        }),
      },
    ]);
    const withoutEvidence = summarizePackage([
      { document: document("b", "B"), row: row("VS-01") },
    ]);
    const comparison = comparePackages(withEvidence, withoutEvidence);

    expect(comparison.outcome).toBe("NUR_A_BELEGT");
    expect(comparison.difference).toContain("automatischer Vorteilsschluss");
    expect(comparison.difference).toContain("nicht zulässig");
  });

  test("does not invent precedence for equivalent EUR formatting", () => {
    const packageSummary = summarizePackage([
      {
        document: document("a", "B", "MAIN_POLICY"),
        row: row("VB-14", {
          documentedContent: "Betragsgrenze grobe Fahrlässigkeit",
          coverage: "Ja",
          coverageAmount: "EUR 5.000.000,00 auf Erstes Risiko",
          source: "PDF-Seite 1: Besondere Bedingung 10PA0460",
          reviewStatus: "BELEGT",
        }),
      },
      {
        document: document("b", "B", "SUPPLEMENT"),
        row: row("VB-14", {
          documentedContent: "Betragsgrenze grobe Fahrlässigkeit",
          coverage: "Ja",
          coverageAmount: "EUR 5.000.000",
          source: "PDF-Seite 6: gemäß 10PA0460",
          reviewStatus: "BELEGT",
        }),
      },
    ]);

    expect(packageSummary.reviewStatus).toBe("BELEGT");
    expect(packageSummary.coverageAmount).toBe(
      "EUR 5.000.000,00 auf Erstes Risiko"
    );
  });

  test("keeps genuinely different EUR limits review-required", () => {
    const packageSummary = summarizePackage([
      {
        document: document("a", "B"),
        row: row("VB-14", {
          documentedContent: "Betragsgrenze grobe Fahrlässigkeit",
          coverage: "Ja",
          coverageAmount: "EUR 5.000.000",
          source: "PDF-Seite 1",
          reviewStatus: "BELEGT",
        }),
      },
      {
        document: document("b", "B"),
        row: row("VB-14", {
          documentedContent: "Betragsgrenze grobe Fahrlässigkeit",
          coverage: "Ja",
          coverageAmount: "EUR 4.000.000",
          source: "PDF-Seite 2",
          reviewStatus: "BELEGT",
        }),
      },
    ]);

    expect(packageSummary.reviewStatus).toBe("RANGFOLGE_PRÜFEN");
  });

  test("keeps equal numbers with different limit periods review-required", () => {
    const packageSummary = summarizePackage([
      {
        document: document("a", "B"),
        row: row("HP-01", {
          documentedContent: "Limit pro Ereignis",
          coverage: "Ja",
          coverageAmount: "EUR 5.000.000 je Ereignis",
          source: "PDF-Seite 1",
          reviewStatus: "BELEGT",
        }),
      },
      {
        document: document("b", "B"),
        row: row("HP-01", {
          documentedContent: "Jahreshöchstlimit",
          coverage: "Ja",
          coverageAmount: "EUR 5.000.000 je Versicherungsjahr",
          source: "PDF-Seite 2",
          reviewStatus: "BELEGT",
        }),
      },
    ]);

    expect(packageSummary.reviewStatus).toBe("RANGFOLGE_PRÜFEN");
  });

  test("reconciles an NBW percentage only with an exact package base", () => {
    const absolute = {
      document: document("a", "B", "MAIN_POLICY"),
      row: row("VS-25", {
        documentedContent: "Behördliche Mehrkosten",
        coverage: "Ja",
        coverageAmount: "EUR 1.530.400,00 auf Erstes Risiko",
        source: "PDF-Seite 1: Besondere Bedingung 10PA0130",
        reviewStatus: "BELEGT",
      }),
    };
    const percentage = {
      document: document("b", "B", "SUPPLEMENT"),
      row: row("VS-25", {
        documentedContent: "Behördliche Mehrkosten bis 5 % des NBW",
        coverage: "Ja",
        coverageAmount: "5 %",
        source: "PDF-Seite 6: bis 5 % des NBW gemäß 10PA0130",
        reviewStatus: "BELEGT",
      }),
    };
    const base = {
      document: document("a", "B", "MAIN_POLICY"),
      row: row("VS-01", {
        documentedContent: "Wohngebäude zum Neuwert",
        coverage: "Ja",
        coverageAmount: "EUR 30.608.000,00",
        source: "PDF-Seite 1: Wohngebäude zum Neuwert",
        reviewStatus: "BELEGT",
      }),
    };

    expect(
      summarizePackage([absolute, percentage], {
        referenceEntries: [absolute, percentage, base],
      }).reviewStatus
    ).toBe("BELEGT");
    expect(
      summarizePackage([absolute, percentage], {
        referenceEntries: [absolute, percentage],
      }).reviewStatus
    ).toBe("RANGFOLGE_PRÜFEN");
    expect(
      summarizePackage([absolute, percentage], {
        referenceEntries: [
          absolute,
          percentage,
          {
            ...base,
            row: {
              ...base.row,
              categoryId: "VS-25",
            },
          },
        ],
      }).reviewStatus
    ).toBe("RANGFOLGE_PRÜFEN");
  });

  test("counts one-sided evidence as a review-required difference", () => {
    const runA = writeRun(root, document("a", "A"), {
      VS: {
        documentedContent: "Gebäudeversicherungssumme 2 Mio. EUR",
        coverage: "Ja",
        coverageAmount: "2 Mio. EUR",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    });
    const runB = writeRun(root, document("b", "B"));

    const result = buildComparisonResult([runA, runB]);

    expect(result.categories[0].rows[0].outcome).toBe("NUR_A_BELEGT");
    expect(result.totals.reviewRequired).toBe(1);
  });

  test("builds all eight category views with document-level provenance", async () => {
    const runA = writeRun(root, document("a", "A"), {
      VS: {
        documentedContent: "Versicherungssumme A",
        coverage: "Ja",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    });
    const runB = writeRun(root, document("b", "B"), {
      VS: {
        documentedContent: "Versicherungssumme B",
        coverage: "Ja",
        source: "PDF-Seite 2",
        reviewStatus: "BELEGT",
      },
    });

    const result = buildComparisonResult([runA, runB], {
      sessionUuid: "session-1",
    });
    expect(result.categories.map(({ categoryView }) => categoryView)).toEqual(
      CATEGORY_ORDER
    );
    expect(result.totals.rows).toBe(8);
    expect(result.categories[0].rows[0].packageA.facts[0]).toMatchObject({
      documentUuid: "a",
      source: "PDF-Seite 1",
    });

    const outputDirectory = path.join(root, "result");
    const artifacts = await writeComparisonArtifacts({
      documentRuns: [runA, runB],
      outputDirectory,
      metadata: { sessionUuid: "session-1" },
    });
    expect(fs.existsSync(artifacts.jsonFile)).toBe(true);
    expect(fs.existsSync(artifacts.markdownFile)).toBe(true);
    expect(fs.existsSync(artifacts.workbookFile)).toBe(true);
    expect(fs.statSync(artifacts.workbookFile).mode & 0o077).toBe(0);
  });
});
