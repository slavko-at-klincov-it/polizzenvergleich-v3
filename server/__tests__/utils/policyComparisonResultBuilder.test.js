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
