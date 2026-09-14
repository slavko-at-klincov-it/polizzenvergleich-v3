const A_DRIVEN_REFERENCE_PRODUCT_RESULT_CONTRACT_ID =
  "LF_A_DRIVEN_REFERENCE_A_TO_B_RESULT_V1";
const A_DRIVEN_REFERENCE_PRODUCT_RESULT_SCHEMA_VERSION = 1;

const LF_A_DRIVEN_REFERENCE_PROFILE = Object.freeze({
  id: "LF_REFERENCE_A_DRIVEN_V2",
  topologySource: "DYNAMIC_REFERENCE_PACKAGE_A",
  sourceEvidenceBoundAtRunTime: true,
  discoversTopologyFromSourceA: true,
  supportsMultipleSourceDocuments: true,
  fullPackageBSearchRequired: true,
  searchChannels: Object.freeze([
    "CURRENT_OCCURRENCES",
    "BM25",
    "STRUCTURE",
    "DINGHY",
    "VALUE",
    "ROLE",
  ]),
  binaryCustomerStatus: true,
  discoversSideBOnly: false,
  goldDefinesProductionRows: false,
});

module.exports = {
  A_DRIVEN_REFERENCE_PRODUCT_RESULT_CONTRACT_ID,
  A_DRIVEN_REFERENCE_PRODUCT_RESULT_SCHEMA_VERSION,
  LF_A_DRIVEN_REFERENCE_PROFILE,
};
