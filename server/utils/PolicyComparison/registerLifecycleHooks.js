const { ComparisonChunkIndex } = require("./ComparisonChunkIndex");
const { ComparisonInventoryService } = require("./ComparisonInventoryService");
const { resolveProviderConnector } = require("../helpers");
const {
  registerComparisonDocumentLifecycleHook,
} = require("../comparisonDocuments/lifecycleHooks");

// The comparison lifecycle owns both semantic vectors and the local FTS index.
// A failed FTS write aborts embedding so the UI can never report a document as
// ready while exact retrieval is incomplete.
registerComparisonDocumentLifecycleHook({
  afterEmbedded: async ({ comparisonDocument, documentData, workspace }) => {
    await ComparisonChunkIndex.indexDocument({
      comparisonDocument,
      documentData,
    });
    const { connector } = await resolveProviderConnector({
      workspace,
      prompt: "Erstelle das offene Klauselinventar der neu abgelegten Police.",
    });
    await ComparisonInventoryService.buildForDocument({
      comparisonDocument,
      documentData,
      Connector: connector,
    });
  },
  beforeRemoved: async ({ comparisonDocument }) => {
    await ComparisonChunkIndex.removeDocument(comparisonDocument.id);
    await ComparisonInventoryService.clear(comparisonDocument.id);
  },
});
