jest.mock("../../../utils/PolicyComparison/ComparisonChunkIndex", () => ({
  ComparisonChunkIndex: {
    indexDocument: jest.fn(),
    removeDocument: jest.fn(),
  },
}));
jest.mock("../../../utils/PolicyComparison/ComparisonInventoryService", () => ({
  ComparisonInventoryService: {
    buildForDocument: jest.fn(),
    ensureForDocuments: jest.fn(),
    clear: jest.fn(),
  },
}));
jest.mock("../../../utils/helpers", () => ({
  resolveProviderConnector: jest.fn(),
}));

const {
  ComparisonChunkIndex,
} = require("../../../utils/PolicyComparison/ComparisonChunkIndex");
const {
  ComparisonInventoryService,
} = require("../../../utils/PolicyComparison/ComparisonInventoryService");
const { resolveProviderConnector } = require("../../../utils/helpers");
const {
  clearComparisonDocumentLifecycleHooks,
  runComparisonDocumentLifecycleHooks,
} = require("../../../utils/comparisonDocuments/lifecycleHooks");

describe("policy comparison lifecycle registration", () => {
  beforeAll(() => {
    clearComparisonDocumentLifecycleHooks();
    resolveProviderConnector.mockResolvedValue({ connector: { id: "llm" } });
    require("../../../utils/PolicyComparison/registerLifecycleHooks");
  });

  beforeEach(() => jest.clearAllMocks());

  test("keeps FTS in the base phase and starts inventory only after ready", async () => {
    const comparisonDocument = { id: 1 };
    const documentData = { pageContent: "canonical" };
    const workspace = { id: 2 };

    await runComparisonDocumentLifecycleHooks("afterEmbedded", {
      comparisonDocument,
      documentData,
      workspace,
    });

    expect(ComparisonChunkIndex.indexDocument).toHaveBeenCalledWith({
      comparisonDocument,
      documentData,
    });
    expect(
      ComparisonInventoryService.ensureForDocuments
    ).not.toHaveBeenCalled();

    await runComparisonDocumentLifecycleHooks("afterReady", {
      comparisonDocument,
      documentData,
      workspace,
    });
    expect(ComparisonInventoryService.ensureForDocuments).toHaveBeenCalledWith({
      documents: [comparisonDocument],
      Connector: { id: "llm" },
    });
  });

  test("keeps the successful FTS phase when retryable inventory inference fails", async () => {
    const comparisonDocument = { id: 9 };
    const documentData = { pageContent: "canonical" };
    const workspace = { id: 2 };
    ComparisonInventoryService.ensureForDocuments.mockRejectedValueOnce(
      new Error("Policy model call timed out.")
    );

    await expect(
      runComparisonDocumentLifecycleHooks("afterReady", {
        comparisonDocument,
        documentData,
        workspace,
      })
    ).rejects.toThrow("Policy model call timed out.");

    expect(ComparisonChunkIndex.indexDocument).not.toHaveBeenCalled();
    expect(ComparisonChunkIndex.removeDocument).not.toHaveBeenCalled();
    expect(ComparisonInventoryService.clear).not.toHaveBeenCalled();
  });

  test("cleans FTS and persistent inventory before document removal", async () => {
    await runComparisonDocumentLifecycleHooks("beforeRemoved", {
      comparisonDocument: { id: 44 },
    });
    expect(ComparisonChunkIndex.removeDocument).toHaveBeenCalledWith(44);
    expect(ComparisonInventoryService.clear).toHaveBeenCalledWith(44);
  });
});
