const CATEGORY_ROW_COUNTS = Object.freeze({
  VS: 36,
  FE: 80,
  LW: 36,
  ST: 36,
  EL: 36,
});

const CATEGORY_ORDER = Object.freeze(Object.keys(CATEGORY_ROW_COUNTS));
const EXPECTED_ROW_COUNT = Object.values(CATEGORY_ROW_COUNTS).reduce(
  (sum, count) => sum + count,
  0
);
const PRODUCT_PROFILE = Object.freeze({
  id: "CUSTOMER_CORE_5_V8_STATUS_METADATA",
  comparisonContractId: "PACKAGE_FIRST_STATUS_METADATA_TYPED_V1",
  categoryViews: CATEGORY_ORDER,
  categoryRowCounts: CATEGORY_ROW_COUNTS,
  categoryCatalogIds: Object.freeze({
    VS: "vs-occurrence-full-draft-v0.6",
    FE: "fe-occurrence-full-draft-v0.5",
    LW: "lw-occurrence-full-draft-v0.5",
    ST: "st-occurrence-full-draft-v0.4",
    EL: "el-occurrence-full-draft-v0.6",
  }),
  expectedRowCount: EXPECTED_ROW_COUNT,
});

module.exports = {
  CATEGORY_ORDER,
  CATEGORY_ROW_COUNTS,
  EXPECTED_ROW_COUNT,
  PRODUCT_PROFILE,
};
