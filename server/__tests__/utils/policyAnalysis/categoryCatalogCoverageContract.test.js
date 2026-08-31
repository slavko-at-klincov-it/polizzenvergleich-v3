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

  test("keeps proven VS pilot definitions unchanged beneath the additive absence contract", () => {
    const resources = path.join(__dirname, "../../../resources/policyAnalysis");
    const pilot = JSON.parse(
      fs.readFileSync(
        path.join(resources, "vs-occurrence-pilot.v0.1.json"),
        "utf8"
      )
    );
    const full = JSON.parse(
      fs.readFileSync(
        path.join(resources, "vs-occurrence-full-draft.v0.2.json"),
        "utf8"
      )
    );
    const fullById = new Map(
      full.requirements.map((requirement) => [requirement.id, requirement])
    );

    for (const requirement of pilot.requirements) {
      if (requirement.id !== "VS-16") {
        const {
          negativeSearchPolicy: _negativeSearchPolicy,
          absenceMeaning: _absenceMeaning,
          ...unchangedDefinition
        } = fullById.get(requirement.id);
        expect(unchangedDefinition).toEqual(requirement);
        continue;
      }
      const extended = fullById.get(requirement.id);
      expect(extended).toMatchObject({
        id: requirement.id,
        scopePolicy: requirement.scopePolicy,
        componentSatisfactionPolicy: "ANY",
        negativeSearchPolicy: "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1",
        absenceMeaning: "COVERAGE_ONLY",
        absenceComparisonPolicy:
          "ASSUME_NOT_INCLUDED_AFTER_COMPLETE_ZERO_OCCURRENCE_V1",
      });
      for (const pilotComponent of requirement.components) {
        const extendedComponent = extended.components.find(
          ({ id }) => id === pilotComponent.id
        );
        expect(extendedComponent).toMatchObject({
          id: pilotComponent.id,
          label: pilotComponent.label,
          factRole: pilotComponent.factRole,
        });
        expect(extendedComponent.aliases).toEqual(
          expect.arrayContaining(pilotComponent.aliases)
        );
      }
      expect(extended.components.map(({ id }) => id)).toEqual(
        expect.arrayContaining([
          "garage",
          "underground_garage",
          "parking_space",
          "parking_deck",
          "carport",
        ])
      );
    }
  });

  test.each([
    "VS_versicherungssumme_und_versicherte_sachen.md",
    "FE_feuer.md",
    "LW_leitungswasser.md",
    "ST_sturm.md",
    "EL_elementar_und_zusatzdeckungen.md",
    "HP_haus_und_grundbesitzhaftpflicht.md",
    "VB_vertragsbestimmungen.md",
    "WE_wohnungseigentum.md",
  ])("defines the complete mixed-row contract in %s", (prompt) => {
    const promptText = fs.readFileSync(
      path.join(__dirname, "../../../resources/workspaceTemplates", prompt),
      "utf8"
    );

    expect(promptText).toContain("- `Gemischt`:");
    expect(promptText).toContain("- `BELEGT` + `Gemischt`");
    expect(promptText).toContain(
      "Nur `Ja`, `Nein`, `Gemischt` oder `Nicht feststellbar`"
    );
  });
});
