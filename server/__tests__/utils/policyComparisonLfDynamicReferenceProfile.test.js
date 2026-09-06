const resource = require("../../resources/policyAnalysis/lf-immo-reference-complete.v1.json");
const {
  LF_DYNAMIC_REFERENCE_PROFILE,
  categoryCatalogsFromManifest,
} = require("../../utils/policyComparison/lfDynamicReferenceProfile");

function manifestFromResource() {
  const categories = [];
  const requirements = resource.requirements.map((definition, sourceOrder) => {
    let category = categories.find(({ id }) => id === definition.categoryId);
    if (!category) {
      category = { id: definition.categoryId, label: definition.categoryLabel, subcategories: [] };
      categories.push(category);
    }
    let subcategory = category.subcategories.find(
      ({ id }) => id === definition.subcategoryId
    );
    if (!subcategory) {
      subcategory = {
        id: definition.subcategoryId,
        label: definition.subcategoryLabel,
        requirementIds: [],
      };
      category.subcategories.push(subcategory);
    }
    subcategory.requirementIds.push(definition.id);
    return {
      requirementId: definition.id,
      sourceOrder,
      displayLabel: definition.label,
      physicalPages: definition.pages,
      searchPlanStatus: "EXPLORATORY_INCOMPLETE",
      components: definition.components.map((component) => ({
        ...component,
        factRole: {
          AGGREGATION: "CONDITION",
          BASIS: "CONDITION",
          COVERAGE: "BENEFIT",
          CONFLICT: "DOCUMENT_STATUS",
          DURATION: "LIMIT",
          OBLIGATION: "CONDITION",
          PROCESS: "CONDITION",
          REVIEW: "DOCUMENT_STATUS",
          RIGHT: "BENEFIT",
          SCOPE: "CONDITION",
          TERMINATION: "CONDITION",
          VALUATION: "CONDITION",
        }[component.factRole] || component.factRole,
      })),
      sourceSpans: [{ spanId: `${definition.id}-span` }],
    };
  });
  return { manifestSha256: "a".repeat(64), categories, requirements };
}

describe("complete LF dynamic reference profile", () => {
  test("contains the complete ordered semantic inventory", () => {
    expect(resource.requirements).toHaveLength(283);
    expect(new Set(resource.requirements.map(({ id }) => id)).size).toBe(283);
    expect(resource.requirements[0].id).toBe("PR-01");
    expect(resource.requirements.at(-1).id).toBe("AV-46");
    expect(resource.requirements.filter(({ crossPage }) => crossPage)).toHaveLength(10);
    expect(LF_DYNAMIC_REFERENCE_PROFILE.dynamicCounts).toBe(true);
  });

  test("creates 13 execution catalogs while preserving all 283 source rows", () => {
    const catalogs = categoryCatalogsFromManifest(manifestFromResource());
    expect(catalogs).toHaveLength(13);
    expect(
      catalogs.reduce((sum, entry) => sum + entry.catalog.requirements.length, 0)
    ).toBe(283);
    expect(
      catalogs.flatMap(({ catalog }) => catalog.requirements).every(
        (requirement) =>
          requirement.negativeSearchPolicy === undefined &&
          requirement.sourceReferenceId
      )
    ).toBe(true);
  });

  test("keeps the printed expert-clause contradiction review-only", () => {
    const conflict = resource.requirements.find(({ id }) => id === "AV-34");
    expect(conflict.components.map(({ factRole }) => factRole)).toEqual([
      "CONFLICT",
      "REVIEW",
    ]);
  });
});
