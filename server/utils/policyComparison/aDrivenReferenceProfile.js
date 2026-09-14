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

module.exports = { LF_A_DRIVEN_REFERENCE_PROFILE };
