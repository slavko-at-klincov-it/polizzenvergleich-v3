const fs = require("fs");
const path = require("path");
const {
  CATEGORY_ORDER,
  CATEGORY_ROW_COUNTS,
  EXPECTED_ROW_COUNT,
  PRODUCT_PROFILE,
} = require("../../utils/policyComparison/productContract");

const CATALOG_FILES = Object.freeze({
  VS: "vs-occurrence-full-draft.v0.2.json",
  FE: "fe-occurrence-full-draft.v0.1.json",
  LW: "lw-occurrence-full-draft.v0.1.json",
  ST: "st-occurrence-full-draft.v0.1.json",
  EL: "el-occurrence-full-draft.v0.1.json",
});

describe("policy comparison product contract", () => {
  test("binds the five customer categories to exactly 224 catalog rows", () => {
    expect(CATEGORY_ORDER).toEqual(["VS", "FE", "LW", "ST", "EL"]);
    expect(CATEGORY_ROW_COUNTS).toEqual({
      VS: 36,
      FE: 80,
      LW: 36,
      ST: 36,
      EL: 36,
    });
    expect(EXPECTED_ROW_COUNT).toBe(224);
    expect(PRODUCT_PROFILE).toMatchObject({
      id: "CUSTOMER_CORE_5_V2",
      comparisonContractId: "QUALIFIED_ABSENCE_TYPED_V1",
      expectedRowCount: 224,
    });

    for (const categoryView of CATEGORY_ORDER) {
      const catalog = JSON.parse(
        fs.readFileSync(
          path.join(
            __dirname,
            "../../resources/policyAnalysis",
            CATALOG_FILES[categoryView]
          ),
          "utf8"
        )
      );
      expect(catalog.categoryView).toBe(categoryView);
      expect(catalog.catalogId).toBe(
        PRODUCT_PROFILE.categoryCatalogIds[categoryView]
      );
      expect(catalog.requirements).toHaveLength(
        CATEGORY_ROW_COUNTS[categoryView]
      );
    }
  });
});
