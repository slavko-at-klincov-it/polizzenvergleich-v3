const { ComparisonChunkIndex } = require("./ComparisonChunkIndex");
const { ComparisonInventoryService } = require("./ComparisonInventoryService");
const { resolveProviderConnector } = require("../helpers");
const {
  registerComparisonDocumentLifecycleHook,
} = require("../comparisonDocuments/lifecycleHooks");

// The comparison lifecycle owns both semantic vectors and the local FTS index.
// A failed FTS write aborts embedding so the UI can never report a document as
// ready while exact retrieval is incomplete. The open inventory is a separate,
// retryable phase: its failure must not delete already valid Lance/FTS data.
registerComparisonDocumentLifecycleHook({
  afterEmbedded: async ({ comparisonDocument, documentData, workspace }) => {
    await ComparisonChunkIndex.indexDocument({
      comparisonDocument,
      documentData,
    });
  },
  afterReady: async ({ comparisonDocument, workspace }) => {
    const { connector } = await resolveProviderConnector({
      workspace,
      prompt: "Erstelle das offene Klauselinventar der neu abgelegten Police.",
    });
    await ComparisonInventoryService.ensureForDocuments({
      documents: [comparisonDocument],
      Connector: connector,
    });
  },
  beforeRemoved: async ({ comparisonDocument }) => {
    await ComparisonChunkIndex.removeDocument(comparisonDocument.id);
    await ComparisonInventoryService.clear(comparisonDocument.id);
  },
});
