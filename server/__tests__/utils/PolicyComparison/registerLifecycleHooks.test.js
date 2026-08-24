jest.mock("../../../utils/PolicyComparison/ComparisonChunkIndex", () => ({
  ComparisonChunkIndex: {
    indexDocument: jest.fn(),
    removeDocument: jest.fn(),
  },
}));
jest.mock("../../../utils/PolicyComparison/ComparisonInventoryService", () => ({
  ComparisonInventoryService: {
    clear: jest.fn(),
  },
}));

const {
  ComparisonChunkIndex,
} = require("../../../utils/PolicyComparison/ComparisonChunkIndex");
const {
  ComparisonInventoryService,
} = require("../../../utils/PolicyComparison/ComparisonInventoryService");
const {
  clearComparisonDocumentLifecycleHooks,
  runComparisonDocumentLifecycleHooks,
} = require("../../../utils/comparisonDocuments/lifecycleHooks");

describe("policy comparison lifecycle registration", () => {
  beforeAll(() => {
    clearComparisonDocumentLifecycleHooks();
    require("../../../utils/PolicyComparison/registerLifecycleHooks");
  });

  beforeEach(() => jest.clearAllMocks());

  test("keeps FTS in the base phase without auto-starting inventory", async () => {
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
    await runComparisonDocumentLifecycleHooks("afterReady", {
      comparisonDocument,
      documentData,
      workspace,
    });
    expect(ComparisonChunkIndex.indexDocument).toHaveBeenCalledTimes(1);
  });

  test("does not run optional inference from the after-ready lifecycle", async () => {
    const comparisonDocument = { id: 9 };
    const documentData = { pageContent: "canonical" };
    const workspace = { id: 2 };
    await expect(
      runComparisonDocumentLifecycleHooks("afterReady", {
        comparisonDocument,
        documentData,
        workspace,
      })
    ).resolves.toBeUndefined();

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
