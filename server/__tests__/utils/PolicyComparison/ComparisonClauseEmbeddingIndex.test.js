const mockEmbedChunks = jest.fn();
const mockEmbedTextInput = jest.fn();
const mockConnect = jest.fn();
const mockUpdateOrCreateCollection = jest.fn();
const mockNamespaceExists = jest.fn();
const mockSimilarityResponse = jest.fn();
const mockVectorIdFilter = jest.fn((ids) => `id IN (${ids.join(",")})`);

jest.mock("../../../utils/helpers", () => ({
  getEmbeddingEngineSelection: () => ({
    embedChunks: mockEmbedChunks,
    embedTextInput: mockEmbedTextInput,
  }),
}));
jest.mock("../../../utils/vectorDbProviders/lance", () => ({
  LanceDb: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    updateOrCreateCollection: mockUpdateOrCreateCollection,
    namespaceExists: mockNamespaceExists,
    similarityResponse: mockSimilarityResponse,
    vectorIdFilter: mockVectorIdFilter,
  })),
}));
jest.mock("../../../utils/PolicyComparison/PolicyInferenceQueue", () => ({
  PolicyInferenceQueue: {
    runOperation: jest.fn(({ operation }) => operation()),
  },
}));

const {
  ComparisonClauseEmbeddingIndex,
} = require("../../../utils/PolicyComparison/ComparisonClauseEmbeddingIndex");

function vector(dimensions = 2560) {
  return Array.from({ length: dimensions }, (_, index) =>
    index === 0 ? 1 : 0
  );
}

function database() {
  const transaction = {
    comparison_document_block_embeddings: { upsert: jest.fn() },
    comparison_document_clause_blocks: { updateMany: jest.fn() },
  };
  return {
    comparison_document_clause_blocks: { findMany: jest.fn() },
    comparison_document_block_embeddings: {
      findMany: jest.fn(),
      upsert: jest.fn(({ create, update }) => ({ ...create, ...update })),
    },
    $transaction: jest.fn((operation) => operation(transaction)),
    transaction,
  };
}

describe("ComparisonClauseEmbeddingIndex", () => {
  const previousManaged = process.env.POLICY_MANAGED_EMBEDDING;

  beforeAll(() => {
    process.env.POLICY_MANAGED_EMBEDDING = "true";
  });

  afterAll(() => {
    if (previousManaged == null) delete process.env.POLICY_MANAGED_EMBEDDING;
    else process.env.POLICY_MANAGED_EMBEDDING = previousManaged;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue({ client: {} });
    mockUpdateOrCreateCollection.mockResolvedValue(true);
    mockNamespaceExists.mockResolvedValue(false);
  });

  test("persists one run-scoped Dinghy ledger row per clause block", async () => {
    const db = database();
    db.comparison_document_clause_blocks.findMany.mockResolvedValue([
      {
        id: 7,
        analysisRunId: 41,
        ordinal: 0,
        pageNumber: 3,
        text: "Selbstbehalt EUR 500",
        textHash: "a".repeat(64),
        embeddingStatus: "pending",
      },
    ]);
    mockEmbedChunks.mockResolvedValue([vector()]);

    await ComparisonClauseEmbeddingIndex.indexRun({
      analysisRunId: 41,
      comparisonDocument: {
        id: 9,
        workspaceId: 2,
        threadId: 3,
      },
      db,
    });

    expect(db.comparison_document_block_embeddings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { analysisRunId_blockId: { analysisRunId: 41, blockId: 7 } },
        create: expect.objectContaining({
          analysisRunId: 41,
          blockId: 7,
          dimensions: 2560,
          status: "pending",
        }),
      })
    );
    expect(
      db.transaction.comparison_document_block_embeddings.upsert
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "ready" }),
      })
    );
  });

  test("checkpoints Dinghy work in bounded batches", async () => {
    const db = database();
    const blocks = Array.from({ length: 17 }, (_, ordinal) => ({
      id: ordinal + 1,
      analysisRunId: 41,
      ordinal,
      pageNumber: ordinal + 1,
      text: `Klausel ${ordinal + 1}`,
      textHash: String(ordinal + 1).padStart(64, "0"),
      embeddingStatus: "pending",
    }));
    db.comparison_document_clause_blocks.findMany.mockResolvedValue(blocks);
    mockEmbedChunks.mockImplementation(async (texts) =>
      texts.map(() => vector())
    );

    await ComparisonClauseEmbeddingIndex.indexRun({
      analysisRunId: 41,
      comparisonDocument: { id: 9, workspaceId: 2, threadId: 3 },
      db,
    });

    expect(mockEmbedChunks).toHaveBeenCalledTimes(3);
    expect(mockEmbedChunks.mock.calls.map(([texts]) => texts.length)).toEqual([
      8, 8, 1,
    ]);
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });

  test("rejects a wrong dimension before LanceDB is opened", async () => {
    const db = database();
    db.comparison_document_clause_blocks.findMany.mockResolvedValue([
      {
        id: 7,
        ordinal: 0,
        pageNumber: 3,
        text: "Selbstbehalt EUR 500",
        textHash: "a".repeat(64),
        embeddingStatus: "pending",
      },
    ]);
    mockEmbedChunks.mockResolvedValue([vector(384)]);

    await expect(
      ComparisonClauseEmbeddingIndex.indexRun({
        analysisRunId: 41,
        comparisonDocument: { id: 9, workspaceId: 2, threadId: 3 },
        db,
      })
    ).rejects.toThrow("dimension mismatch");
    expect(mockConnect).not.toHaveBeenCalled();
  });

  test("semantic links are scoped to vector IDs from exactly one analysis run", async () => {
    const db = database();
    db.comparison_document_block_embeddings.findMany.mockResolvedValue([
      { vectorId: "run-41-vector" },
    ]);
    mockEmbedTextInput.mockResolvedValue(vector());
    mockNamespaceExists.mockResolvedValue(true);
    mockSimilarityResponse.mockResolvedValue({
      contextTexts: ["böswillige Beschädigung"],
      sourceDocuments: [{ blockId: 7, analysisRunId: 41 }],
    });

    await expect(
      ComparisonClauseEmbeddingIndex.semanticLinks({
        analysisRunId: 41,
        text: "Vandalismus",
        db,
      })
    ).resolves.toEqual([
      expect.objectContaining({
        blockId: 7,
        analysisRunId: 41,
        text: "böswillige Beschädigung",
      }),
    ]);
    expect(mockSimilarityResponse).toHaveBeenCalledWith(
      expect.objectContaining({ includeVectorIds: ["run-41-vector"] })
    );
  });

  test("deletes only the vector IDs owned by removed analysis runs", async () => {
    const remove = jest.fn();
    mockConnect.mockResolvedValue({
      client: { openTable: jest.fn().mockResolvedValue({ delete: remove }) },
    });
    mockNamespaceExists.mockResolvedValue(true);

    await ComparisonClauseEmbeddingIndex.removeVectorIds(["v1", "v2", "v1"]);

    expect(mockVectorIdFilter).toHaveBeenCalledWith(["v1", "v2"]);
    expect(remove).toHaveBeenCalledWith("id IN (v1,v2)");
  });
});
