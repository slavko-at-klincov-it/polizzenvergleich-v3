const fs = require("fs");
const os = require("os");
const path = require("path");
const ExcelJS = require("exceljs");
const {
  HEADERS,
  validateDynamicReferenceComparison,
  workbookValues,
  writeWorkbook,
} = require("../../utils/policyComparison/dynamicReferenceResultBuilder");
const {
  LF_DYNAMIC_REFERENCE_PROFILE,
} = require("../../utils/policyComparison/lfDynamicReferenceProfile");
const {
  REFERENCE_OUTCOME,
} = require("../../utils/policyComparison/referenceResultBuilder");

function fixture() {
  const manifest = {
    manifestSha256: "a".repeat(64),
    source: { sourceBlockLedgerSha256: "b".repeat(64) },
    summary: {
      sourceBlocks: 3,
      semanticRequirements: 1,
      decisionEligibleRequirements: 1,
      incompleteSearchRequirements: 1,
      reviewRequiredBlocks: 1,
    },
    requirements: [{ requirementId: "A-01" }],
    sharedValueGovernors: [],
    sharedSemanticGovernors: [],
  };
  const row = {
    categoryId: "A-01",
    sourceOrder: 0,
    packageA: {
      documentUuid: "source-a",
      searchPlanStatus: "EXPLORATORY_INCOMPLETE",
    },
    packageB: { contributors: [] },
    outcome: REFERENCE_OUTCOME.UNCLEAR,
    pointDecision: { outcome: REFERENCE_OUTCOME.UNCLEAR, reviewRequired: true },
  };
  const outcomes = Object.fromEntries(
    Object.values(REFERENCE_OUTCOME).map((outcome) => [outcome, 0])
  );
  outcomes[REFERENCE_OUTCOME.UNCLEAR] = 1;
  const result = {
    schemaVersion: 3,
    contractId: "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1",
    comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
    productProfile: LF_DYNAMIC_REFERENCE_PROFILE,
    template: {
      semanticRequirementManifestSha256: manifest.manifestSha256,
      sourceBlockLedgerSha256: manifest.source.sourceBlockLedgerSha256,
      ...manifest.summary,
      sharedValueGovernors: 0,
      sharedSemanticGovernors: 0,
    },
    documents: [
      { uuid: "source-a", side: "A" },
      { uuid: "counterpart-b", side: "B" },
    ],
    categories: [{ categoryView: "A", rows: [row] }],
    totals: {
      rows: 1,
      categories: 1,
      referenceRowsAnalyzed: 1,
      sideBOnlyRows: 0,
      customerReviewRequired: 1,
      outcomes,
    },
  };
  return { manifest, result };
}

describe("dynamic LF reference result", () => {
  test("exports B values and keeps the final customer assessment column empty", () => {
    const category = { categoryName: "Kategorie" };
    const row = {
      subcategoryName: "Unterkategorie",
      categoryId: "A-01",
      categoryName: "Prüfpunkt",
      packageA: {
        documentedContent: "A-Inhalt",
        coverageAmount: "A-Wert",
        source: "A-Fundstelle",
      },
      packageB: {
        documentedContent: "B-Gegenstück",
        coverage: "B-Wirkung",
        coverageAmount: "B-Wert",
        source: "B-Fundstelle",
      },
      outcome: REFERENCE_OUTCOME.PARTIAL,
      pointDecision: { reason: "Prüfhinweis" },
    };

    expect(HEADERS).toHaveLength(14);
    expect(HEADERS.at(-1)).toBe("Fachliche_Bewertung_manuell");
    expect(workbookValues(category, row)).toEqual([
      "Kategorie",
      "Unterkategorie",
      "A-01",
      "Prüfpunkt",
      "A-Inhalt",
      "A-Wert",
      "A-Fundstelle",
      "B-Gegenstück",
      "B-Wirkung",
      "B-Wert",
      "B-Fundstelle",
      REFERENCE_OUTCOME.PARTIAL,
      "Prüfhinweis",
      "",
    ]);
  });

  test("writes a compact review workbook with exact row parity", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lf-review-workbook-"));
    const file = path.join(root, "review.xlsx");
    const category = { categoryName: "Kategorie" };
    const row = {
      subcategoryName: "Unterkategorie",
      categoryId: "A-01",
      categoryName: "Prüfpunkt",
      packageA: {
        documentedContent: "A-Inhalt",
        coverageAmount: "A-Wert",
        source: "A-Fundstelle",
      },
      packageB: {
        documentedContent: "B-Gegenstück",
        coverage: "B-Wirkung",
        coverageAmount: "B-Wert",
        source: "B-Fundstelle",
      },
      outcome: REFERENCE_OUTCOME.PARTIAL,
      pointDecision: { reason: "Prüfhinweis" },
    };
    try {
      await writeWorkbook({ categories: [{ ...category, rows: [row] }] }, file);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file);
      const sheet = workbook.getWorksheet("LF Vorlage A nach B");

      expect(sheet.getRow(1).values.slice(1)).toEqual(HEADERS);
      expect(sheet.getRow(2).values.slice(1)).toEqual(
        workbookValues(category, row).slice(0, -1)
      );
      expect(sheet.views[0]).toMatchObject({ xSplit: 4, ySplit: 1 });
      expect(sheet.getRow(2).height).toBe(66);
      expect(sheet.getCell("N2").value).toBeNull();
      expect(sheet.getCell("N2").fill.fgColor.argb).toBe("FFFFF2CC");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("accepts the manifest-owned row order and zero B-only rows", () => {
    const { manifest, result } = fixture();
    expect(validateDynamicReferenceComparison(result, { manifest })).toBe(
      result
    );
  });

  test("forbids a controlled null result for an incomplete B search plan", () => {
    const { manifest, result } = fixture();
    result.categories[0].rows[0].outcome = REFERENCE_OUTCOME.NOT_FOUND;
    result.categories[0].rows[0].pointDecision.outcome =
      REFERENCE_OUTCOME.NOT_FOUND;
    result.totals.outcomes[REFERENCE_OUTCOME.UNCLEAR] = 0;
    result.totals.outcomes[REFERENCE_OUTCOME.NOT_FOUND] = 1;
    expect(() =>
      validateDynamicReferenceComparison(result, { manifest })
    ).toThrow("LF_DYNAMIC_REFERENCE_RESULT_DECISION_INVALID");
  });
});
