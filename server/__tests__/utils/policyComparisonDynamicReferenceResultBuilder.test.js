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
const {
  LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
} = require("../../utils/policyComparison/referenceCustomerPresentation");

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
    customerPresentationContractId: LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
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
        contributors: [
          { documentUuid: "counterpart-b", source: "B-Fundstelle" },
        ],
      },
      outcome: REFERENCE_OUTCOME.PARTIAL,
      pointDecision: { reason: "Prüfhinweis" },
    };

    expect(HEADERS).toHaveLength(14);
    expect(HEADERS.slice(-3)).toEqual([
      "KI_Fundstatus",
      "KI_Prüfhinweis",
      "Fachliche Bewertung (manuell)",
    ]);
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
      "Gefunden",
      "Im Dokumentpaket B wurde mindestens eine belastbare Fundstelle gefunden. Der gefundene Inhalt und seine Quelle sind in den Spalten B_Gegenstück und B_Quelle dargestellt.",
      "",
    ]);
  });

  test("explains a binary not-found workbook status without claiming missing coverage", () => {
    const category = { categoryName: "Kategorie" };
    const row = {
      subcategoryName: "Unterkategorie",
      categoryId: "A-02",
      categoryName: "Prüfpunkt",
      packageA: {
        documentedContent: "A-Inhalt",
        coverageAmount: "A-Wert",
        source: "A-Fundstelle",
      },
      packageB: {
        documentedContent: "Fundlage nicht eindeutig auflösbar",
        coverage: "Nicht feststellbar",
        coverageAmount: "Nicht feststellbar",
        source: "keine entscheidungsreife Fundstelle",
        contributors: [],
      },
      outcome: REFERENCE_OUTCOME.UNCLEAR,
      pointDecision: {
        outcome: REFERENCE_OUTCOME.UNCLEAR,
        reason: "Interne Fundlage ungeklärt.",
      },
    };

    const values = workbookValues(category, row);
    expect(values[11]).toBe("Nicht gefunden");
    expect(values[12]).toContain(
      "Im aktuellen Lauf wurde keine belastbare Fundstelle"
    );
    expect(values[12]).toContain(
      "nicht automatisch, dass kein Versicherungsschutz besteht"
    );
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
        workbookValues(category, row)
      );
      expect(sheet.views[0]).toMatchObject({ xSplit: 4, ySplit: 1 });
      expect(sheet.getRow(2).height).toBe(66);
      expect(sheet.getCell("N2").value).toBe("");
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

  test("rejects an unknown customer-presentation contract marker", () => {
    const { manifest, result } = fixture();
    result.customerPresentationContractId = "UNKNOWN_PRESENTATION";
    expect(() =>
      validateDynamicReferenceComparison(result, { manifest })
    ).toThrow("LF_DYNAMIC_REFERENCE_RESULT_PRESENTATION_INVALID");
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
