jest.mock("../../../utils/PolicyComparison/ComparisonChunkIndex", () => ({
  ComparisonChunkIndex: {
    indexDocument: jest.fn(),
    removeDocument: jest.fn(),
  },
}));
jest.mock("../../../utils/PolicyComparison/ComparisonInventoryService", () => ({
  ComparisonInventoryService: {
    buildForDocument: jest.fn(),
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
const {
  resolveProviderConnector,
} = require("../../../utils/helpers");
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

  test("keeps FTS and Lance lifecycle and adds full-page inventory before ready", async () => {
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
    expect(ComparisonInventoryService.buildForDocument).toHaveBeenCalledWith({
      comparisonDocument,
      documentData,
      Connector: { id: "llm" },
    });
    expect(
      ComparisonChunkIndex.indexDocument.mock.invocationCallOrder[0]
    ).toBeLessThan(
      ComparisonInventoryService.buildForDocument.mock.invocationCallOrder[0]
    );
  });

  test("cleans FTS and persistent inventory before document removal", async () => {
    await runComparisonDocumentLifecycleHooks("beforeRemoved", {
      comparisonDocument: { id: 44 },
    });
    expect(ComparisonChunkIndex.removeDocument).toHaveBeenCalledWith(44);
    expect(ComparisonInventoryService.clear).toHaveBeenCalledWith(44);
  });
});
