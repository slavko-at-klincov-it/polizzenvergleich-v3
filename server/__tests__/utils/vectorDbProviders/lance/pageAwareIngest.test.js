const mockEmbedChunks = jest.fn();
const mockCachedVectorInformation = jest.fn();
const mockStoreVectorResult = jest.fn();
const mockBulkInsert = jest.fn();

jest.mock("../../../../utils/helpers", () => ({
  toChunks: (items, size) => {
    const result = [];
    for (let index = 0; index < items.length; index += size)
      result.push(items.slice(index, index + size));
    return result;
  },
  getEmbeddingEngineSelection: () => ({
    embeddingMaxChunkLength: 1_000,
    embeddingPrefix: "",
    embedChunks: mockEmbedChunks,
  }),
}));
jest.mock("../../../../utils/files", () => ({
  cachedVectorInformation: mockCachedVectorInformation,
  storeVectorResult: mockStoreVectorResult,
}));
jest.mock("../../../../models/systemSettings", () => ({
  SystemSettings: {
    getValueOrFallback: jest.fn(async ({ label }, fallback) =>
      label === "text_splitter_chunk_size" ? 1_000 : fallback
    ),
  },
}));
jest.mock("../../../../models/vectors", () => ({
  DocumentVectors: { bulkInsert: mockBulkInsert, where: jest.fn() },
}));
jest.mock("../../../../utils/chats", () => ({
  sourceIdentifier: jest.fn(),
}));
jest.mock("../../../../utils/EmbeddingRerankers/native", () => ({
  NativeEmbeddingReranker: jest.fn(),
}));

const { LanceDb } = require("../../../../utils/vectorDbProviders/lance");

function pageMappedPdf({ docId = "current-doc", id = "source-doc" } = {}) {
  const first = "Brand ist ein Feuer.";
  const second = "Selbstbehalt EUR 350.";
  const pageContent = `${first}\n\n${second}`;
  return {
    docId,
    id,
    documentType: "pdf",
    title: "policy.pdf",
    pageContent,
    pageMap: [
      { pageNumber: 1, start: 0, end: first.length },
      {
        pageNumber: 2,
        start: first.length + 2,
        end: pageContent.length,
      },
    ],
    pdfExtraction: {
      schemaVersion: 1,
      totalPages: 2,
      processedPages: 2,
      pagesWithText: 2,
      complete: true,
    },
  };
}

function currentCacheMetadata(overrides = {}) {
  return {
    provenanceSchemaVersion: 1,
    docId: "cached-doc",
    sourceDocumentId: "source-doc",
    title: "policy.pdf",
    pageNumber: 1,
    chunkIndex: 0,
    pageChunkIndex: 0,
    text: "Brand ist ein Feuer.",
    ...overrides,
  };
}

describe("LanceDb page-aware ingestion", () => {
  let db;
  let submissions;
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    submissions = null;
    client = { tableNames: jest.fn().mockResolvedValue([]) };
    db = new LanceDb();
    jest.spyOn(db, "connect").mockResolvedValue({ client });
    jest
      .spyOn(db, "updateOrCreateCollection")
      .mockImplementation(async (_client, values) => {
        submissions = values;
        return true;
      });
  });

  test("stores complete provenance on newly embedded PDF chunks", async () => {
    mockCachedVectorInformation.mockResolvedValue({
      exists: false,
      chunks: [],
    });
    mockEmbedChunks.mockResolvedValue([
      [1, 0],
      [0, 1],
    ]);

    const result = await db.addDocumentToNamespace(
      "workspace",
      pageMappedPdf(),
      "custom-documents/policy.json"
    );

    expect(result.vectorized).toBe(true);
    expect(submissions).toHaveLength(2);
    expect(submissions.map(({ pageNumber }) => pageNumber)).toEqual([1, 2]);
    expect(submissions[0]).toMatchObject({
      provenanceSchemaVersion: 1,
      docId: "current-doc",
      sourceDocumentId: "source-doc",
      title: "policy.pdf",
      chunkIndex: 0,
      pageChunkIndex: 0,
    });
    expect(submissions[0].text).toContain("physicalPdfPage: 1");
    expect(submissions[0].text).toContain(
      "citationLabel: policy.pdf — physische PDF-Seite 1"
    );
    const cached = mockStoreVectorResult.mock.calls[0][0].flat();
    expect(cached[1].metadata).toMatchObject({
      docId: "current-doc",
      pageNumber: 2,
      chunkIndex: 1,
      pageChunkIndex: 0,
    });
  });

  test("materializes the shared provenance schema for non-PDF chunks", async () => {
    mockCachedVectorInformation.mockResolvedValue({
      exists: false,
      chunks: [],
    });
    mockEmbedChunks.mockResolvedValue([[1, 0]]);

    const result = await db.addDocumentToNamespace(
      "workspace",
      {
        docId: "notes-doc",
        id: "source-notes",
        title: "notes.txt",
        pageContent: "Ordinary knowledge-base text.",
      },
      "custom-documents/notes.json"
    );

    expect(result.vectorized).toBe(true);
    expect(submissions[0]).toMatchObject({
      provenanceSchemaVersion: 1,
      pageNumber: 0,
      docId: "notes-doc",
      sourceDocumentId: "source-notes",
      chunkIndex: 0,
      pageChunkIndex: 0,
    });
  });

  test("reuses only versioned cache and overwrites its docId", async () => {
    mockCachedVectorInformation.mockResolvedValue({
      exists: true,
      chunks: [
        [
          {
            values: [1, 0],
            metadata: currentCacheMetadata(),
          },
        ],
      ],
    });

    const result = await db.addDocumentToNamespace(
      "workspace",
      pageMappedPdf({ docId: "new-workspace-doc" }),
      "custom-documents/policy.json"
    );

    expect(result.vectorized).toBe(true);
    expect(mockEmbedChunks).not.toHaveBeenCalled();
    expect(submissions[0]).toMatchObject({
      docId: "new-workspace-doc",
      sourceDocumentId: "source-doc",
      pageNumber: 1,
    });
  });

  test("re-embeds legacy cache without provenance version", async () => {
    mockCachedVectorInformation.mockResolvedValue({
      exists: true,
      chunks: [
        [
          {
            values: [1, 0],
            metadata: { text: "Legacy flat chunk." },
          },
        ],
      ],
    });
    mockEmbedChunks.mockResolvedValue([
      [1, 0],
      [0, 1],
    ]);

    const result = await db.addDocumentToNamespace(
      "workspace",
      pageMappedPdf(),
      "custom-documents/policy.json"
    );

    expect(result.vectorized).toBe(true);
    expect(mockEmbedChunks).toHaveBeenCalledTimes(1);
    expect(mockStoreVectorResult).toHaveBeenCalledTimes(1);
  });

  test("fails closed for a legacy namespace schema", async () => {
    client.tableNames.mockResolvedValue(["workspace"]);
    client.openTable = jest.fn().mockResolvedValue({
      schema: jest.fn().mockResolvedValue({ fields: [{ name: "text" }] }),
    });

    const result = await db.addDocumentToNamespace(
      "workspace",
      pageMappedPdf(),
      "custom-documents/policy.json"
    );

    expect(result.vectorized).toBe(false);
    expect(result.error).toContain("LANCE_PROVENANCE_REINDEX_REQUIRED");
    expect(mockEmbedChunks).not.toHaveBeenCalled();
  });
});
