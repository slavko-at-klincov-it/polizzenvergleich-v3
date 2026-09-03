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
      id: "CUSTOMER_CORE_5_V98_FE_C02_CONDITION_SCOPE_DECISION",
      comparisonContractId:
        "PACKAGE_FIRST_QUALIFIED_INCLUSION_ABSENCE_LW20_EQUALITY_FIRE_DEFINITION_VS15_QUALIFIER_VS08_CONSENSUS_OBJECT_FAMILY_ANY_IDENTITY_AMOUNT_LOCAL_CONDITION_VS21_COST_ROLE_BINDING_GROUP_FIELDS_LIMIT_PORTFOLIO_REVIEW_GATE_VS22_LOCAL_WASTE_SCOPE_EXACT_CLAUSE_CODE_FIELD_GOVERNOR_HAZARDOUS_WASTE_PORTFOLIO_HARDENED_VS24_OPTIONAL_LOCAL_LIMIT_EXACT_SCOPE_IDENTITY_GLASS_SCAFFOLDING_COST_EQUALITY_CUSTOMER_REPLAY_VALIDATION_PROOF_LIMIT_LANGUAGE_GATE_VS25_SUM_EQUALIZATION_PRECISION_COMBINED_SCOPE_HEADING_PRECISION_AMOUNT_RECONCILIATION_RELATIVE_LIMIT_PORTFOLIO_TYPED_LIMIT_BASIS_CUSTOMER_REPLAY_SOURCE_BINDING_SUM_EQUALIZATION_TERMINAL_LOCAL_BASIS_BINDING_SOURCE_PROOF_PERCENT_DOCUMENT_BASIS_VS36_SYMBOLIC_LIMITS_EXACT_EVENT_LIMIT_LIST_ITEM_FE_A05_NESTED_LIST_CONTINUATION_PROOF_SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_INTERNAL_SCOPE_PROVENANCE_SELECTED_SCOPE_REPLAY_FE_C02_CONDITION_SCOPE_DECISION_V59",
      categoryViews: ["VS", "FE", "LW", "ST", "EL"],
      expectedRowCount: 224,
    });
    expect(PRODUCT_PROFILE.categoryCatalogIds).not.toHaveProperty("HP");

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
