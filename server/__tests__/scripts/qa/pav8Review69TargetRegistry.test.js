const registry = require("../../../resources/policyAnalysis/pav8-review-69-targets.qa-only.v0.1.json");

const CATEGORY_CONTRACTS = [
  {
    categoryView: "VS",
    expectedCount: 19,
    catalog: require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json"),
  },
  {
    categoryView: "FE",
    expectedCount: 14,
    catalog: require("../../../resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json"),
  },
  {
    categoryView: "LW",
    expectedCount: 10,
    catalog: require("../../../resources/policyAnalysis/lw-occurrence-full-draft.v0.1.json"),
  },
  {
    categoryView: "ST",
    expectedCount: 13,
    catalog: require("../../../resources/policyAnalysis/st-occurrence-full-draft.v0.1.json"),
  },
  {
    categoryView: "EL",
    expectedCount: 13,
    catalog: require("../../../resources/policyAnalysis/el-occurrence-full-draft.v0.1.json"),
  },
];

describe("PAV8 69-row targeted QA registry", () => {
  test("preserves the exact historical 69-row target registry and its requirement order", () => {
    expect(registry).toMatchObject({
      schemaVersion: 1,
      status: "TARGETED_QA_ONLY",
      documentSpecificQaOnly: true,
      productionRule: false,
      publishable: false,
      deployable: false,
      canonicalCategoryOrder: ["VS", "FE", "LW", "ST", "EL"],
      expectedRequirementCount: 69,
      expectedDistribution: {
        VS: 19,
        FE: 14,
        LW: 10,
        ST: 13,
        EL: 13,
      },
      baseline: {
        runId: "PAV8-03D-VS14-2D964B45-20260902-073000",
        runSignatureSha256:
          "e3fa86164b0a027dbc219681bd308a1f7e027e0e5297f70b122feebf4e18d55e",
        packageContractSha256:
          "2b390be8aa5597a9990735151b5458e023c9b561134e4c1023f5e6a765479173",
        comparisonSha256:
          "4b0714d8d0667cdcd5d52c1f5377e2c65dd6a7fd47530c2ac95f8244b6d7c6b5",
        codeCommitSha: "2d964b45d6bbf8a1ca0769ad25bc3b59d3a7c42b",
      },
    });

    expect(
      registry.categoryTargets.map(({ categoryView }) => categoryView)
    ).toEqual(registry.canonicalCategoryOrder);

    const allRequirementIds = registry.categoryTargets.flatMap(
      ({ requirementIds }) => requirementIds
    );
    expect(allRequirementIds).toHaveLength(69);
    expect(new Set(allRequirementIds).size).toBe(69);

    for (const { categoryView, expectedCount, catalog } of CATEGORY_CONTRACTS) {
      const target = registry.categoryTargets.find(
        (candidate) => candidate.categoryView === categoryView
      );
      expect(target).toBeDefined();
      const historicalCatalogMigrations = {
        VS: ["vs-occurrence-full-draft-v0.7", "vs-occurrence-full-draft-v0.16"],
        FE: ["fe-occurrence-full-draft-v0.5", "fe-occurrence-full-draft-v0.13"],
        LW: ["lw-occurrence-full-draft-v0.5", "lw-occurrence-full-draft-v0.10"],
        ST: ["st-occurrence-full-draft-v0.4", "st-occurrence-full-draft-v0.6"],
        EL: ["el-occurrence-full-draft-v0.6", "el-occurrence-full-draft-v0.8"],
      };
      if (historicalCatalogMigrations[categoryView]) {
        expect([target.catalogId, catalog.catalogId]).toEqual(
          historicalCatalogMigrations[categoryView]
        );
      } else expect(target.catalogId).toBe(catalog.catalogId);
      expect(target.requirementIds).toHaveLength(expectedCount);
      expect(
        target.requirementIds.every((id) => id.startsWith(`${categoryView}-`))
      ).toBe(true);

      const targetIds = new Set(target.requirementIds);
      const canonicalTargetOrder = catalog.requirements
        .map(({ id }) => id)
        .filter((id) => targetIds.has(id));
      expect(canonicalTargetOrder).toEqual(target.requirementIds);
      expect(canonicalTargetOrder).toHaveLength(targetIds.size);
    }
  });
});
