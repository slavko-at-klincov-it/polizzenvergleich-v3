const fs = require("fs");
const path = require("path");

const PAV8_BASELINE_COMMIT = "2d964b45d6bbf8a1ca0769ad25bc3b59d3a7c42b";
const PAV8_BASELINE_PRODUCT_PROFILE = Object.freeze({
  id: "CUSTOMER_CORE_5_V11_VS_SPECIAL_EQUIPMENT_PRECISION",
  comparisonContractId: "PACKAGE_FIRST_QUALIFIED_INCLUSION_ABSENCE_V1",
  categoryViews: Object.freeze(["VS", "FE", "LW", "ST", "EL"]),
  categoryRowCounts: Object.freeze({
    VS: 36,
    FE: 80,
    LW: 36,
    ST: 36,
    EL: 36,
  }),
  categoryCatalogIds: Object.freeze({
    VS: "vs-occurrence-full-draft-v0.7",
    FE: "fe-occurrence-full-draft-v0.5",
    LW: "lw-occurrence-full-draft-v0.5",
    ST: "st-occurrence-full-draft-v0.4",
    EL: "el-occurrence-full-draft-v0.6",
  }),
  expectedRowCount: 224,
});
const PAV8_BASELINE_CATALOG_FILES = Object.freeze({
  VS: "vs-occurrence-full-draft.v0.2.json",
  FE: "fe-occurrence-full-draft.v0.1.json",
  LW: "lw-occurrence-full-draft.v0.1.json",
  ST: "st-occurrence-full-draft.v0.1.json",
  EL: "el-occurrence-full-draft.v0.1.json",
});
const PAV8_BASELINE_CATALOG_SHA256 = Object.freeze({
  VS: "271b430c977e087232a6eec31146f70242a8feb93ad1e00559c0df85fdb8cffc",
  FE: "7978f1ce98617e782ca422d71dc7ae32c8e34d6ad1a74e4453acc2eeb435f248",
  LW: "9d43eadd994af8596e2ea3608d2cc56d66e1f61b7e71bc7c417aabb29b23846a",
  ST: "03a815d5139591fdb358cf0853ce390b88728baccadf4cc918699ff40d8b8e9c",
  EL: "382c37e12bc95aed43eb75f40eac5b635c427e3ee14f74d65688e35f746356f9",
});

function pav8BaselineCatalogBytes() {
  const fixtureDirectory = path.resolve(
    __dirname,
    "../../__tests__/fixtures/policyAnalysis/pav8-2d964b45"
  );
  return Object.fromEntries(
    Object.entries(PAV8_BASELINE_CATALOG_FILES).map(
      ([categoryView, filename]) => [
        categoryView,
        fs.readFileSync(path.join(fixtureDirectory, filename)),
      ]
    )
  );
}

module.exports = {
  PAV8_BASELINE_CATALOG_SHA256,
  PAV8_BASELINE_COMMIT,
  PAV8_BASELINE_PRODUCT_PROFILE,
  pav8BaselineCatalogBytes,
};
