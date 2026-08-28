const fs = require("fs");
const path = require("path");
const {
  extractCategoryDefinitions,
} = require("../../../scripts/qa/categoryOutputContract.cjs");
const {
  assertCompleteCategoryCatalogCoverage,
  evaluateCategoryCatalogCoverage,
} = require("../../../utils/policyAnalysis/categoryCatalogCoverageContract");

const DEFINITIONS = [
  { id: "EL-01", label: "Erstes Thema" },
  { id: "EL-02", label: "Zweites Thema" },
];

describe("categoryCatalogCoverageContract", () => {
  test("reports partial adapted coverage without turning it into a pass", () => {
    expect(
      evaluateCategoryCatalogCoverage({
        categoryDefinitions: DEFINITIONS,
        catalog: {
          categoryView: "EL",
          requirements: [{ id: "EL-01", label: "Erstes Thema" }],
        },
      })
    ).toEqual({
      pass: false,
      categoryView: "EL",
      expectedCount: 2,
      representedCount: 1,
      coveragePercent: 50,
      missingIds: ["EL-02"],
      extraIds: [],
      orderMatches: false,
      labelMismatches: [],
    });
  });

  test("passes only exact prompt-to-catalog ID parity", () => {
    expect(
      assertCompleteCategoryCatalogCoverage({
        categoryDefinitions: DEFINITIONS,
        catalog: {
          categoryView: "EL",
          requirements: [
            { id: "EL-01", label: "Erstes Thema" },
            { id: "EL-02", label: "Zweites Thema" },
          ],
        },
      })
    ).toMatchObject({ pass: true, coveragePercent: 100 });
  });

  test("fails closed for missing, extra and duplicate IDs", () => {
    expect(() =>
      assertCompleteCategoryCatalogCoverage({
        categoryDefinitions: DEFINITIONS,
        catalog: {
          categoryView: "EL",
          requirements: [
            { id: "EL-01", label: "Erstes Thema" },
            { id: "EL-03", label: "Drittes Thema" },
          ],
        },
      })
    ).toThrow(
      "CATEGORY_CATALOG_COVERAGE_INCOMPLETE: missing=EL-02;extra=EL-03;order=false;labels="
    );
    expect(() =>
      evaluateCategoryCatalogCoverage({
        categoryDefinitions: DEFINITIONS,
        catalog: {
          categoryView: "EL",
          requirements: [
            { id: "EL-01", label: "Erstes Thema" },
            { id: "EL-01", label: "Erstes Thema" },
          ],
        },
      })
    ).toThrow("CATEGORY_CATALOG_ID_DUPLICATE: EL-01");
  });

  test("fails closed when order or the customer-visible label drifts", () => {
    expect(() =>
      assertCompleteCategoryCatalogCoverage({
        categoryDefinitions: DEFINITIONS,
        catalog: {
          categoryView: "EL",
          requirements: [
            { id: "EL-02", label: "Falscher Text" },
            { id: "EL-01", label: "Erstes Thema" },
          ],
        },
      })
    ).toThrow(
      "CATEGORY_CATALOG_COVERAGE_INCOMPLETE: missing=;extra=;order=false;labels=EL-02"
    );
  });

  test.each([
    ["VS", "VS_versicherungssumme_und_versicherte_sachen.md", "v0.2"],
    ["FE", "FE_feuer.md", "v0.1"],
    ["LW", "LW_leitungswasser.md", "v0.1"],
    ["ST", "ST_sturm.md", "v0.1"],
    ["EL", "EL_elementar_und_zusatzdeckungen.md", "v0.1"],
    ["HP", "HP_haus_und_grundbesitzhaftpflicht.md", "v0.1"],
    ["VB", "VB_vertragsbestimmungen.md", "v0.1"],
    ["WE", "WE_wohnungseigentum.md", "v0.1"],
  ])(
    "keeps the shipped %s prompt and full catalog in exact parity",
    (view, prompt, catalogVersion) => {
      const promptText = fs.readFileSync(
        path.join(__dirname, "../../../resources/workspaceTemplates", prompt),
        "utf8"
      );
      const catalog = JSON.parse(
        fs.readFileSync(
          path.join(
            __dirname,
            `../../../resources/policyAnalysis/${view.toLowerCase()}-occurrence-full-draft.${catalogVersion}.json`
          ),
          "utf8"
        )
      );

      expect(
        assertCompleteCategoryCatalogCoverage({
          categoryDefinitions: extractCategoryDefinitions(promptText),
          catalog,
        })
      ).toMatchObject({
        pass: true,
        categoryView: view,
        coveragePercent: 100,
        orderMatches: true,
        labelMismatches: [],
      });
    }
  );
});
