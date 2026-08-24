const { ComparisonChunkIndex } = require("./ComparisonChunkIndex");
const {
  registerComparisonDocumentLifecycleHook,
} = require("../comparisonDocuments/lifecycleHooks");

// The comparison lifecycle owns both semantic vectors and the local FTS index.
// A failed FTS write aborts embedding so the UI can never report a document as
// ready while exact retrieval is incomplete. The optional deep inventory is
// started explicitly and never blocks normal targeted document questions.
registerComparisonDocumentLifecycleHook({
  afterEmbedded: async ({ comparisonDocument, documentData }) => {
    await ComparisonChunkIndex.indexDocument({
      comparisonDocument,
      documentData,
    });
  },
  beforeRemoved: async ({ comparisonDocument }) => {
    const {
      ComparisonInventoryService,
    } = require("./ComparisonInventoryService");
    await ComparisonChunkIndex.removeDocument(comparisonDocument.id);
    await ComparisonInventoryService.clear(comparisonDocument.id);
  },
});
