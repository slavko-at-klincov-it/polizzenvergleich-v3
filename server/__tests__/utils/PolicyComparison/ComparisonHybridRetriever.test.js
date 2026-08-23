const {
  ComparisonHybridRetriever,
} = require("../../../utils/PolicyComparison/ComparisonHybridRetriever");

const documents = [
  {
    id: 1,
    workspaceId: 10,
    threadId: 20,
    workspaceDocumentId: 100,
    docId: "doc-a",
    slot: "A",
    status: "ready",
    originalFilename: "A.pdf",
  },
  {
    id: 2,
    workspaceId: 10,
    threadId: 20,
    workspaceDocumentId: 101,
    docId: "doc-b",
    slot: "B",
    status: "ready",
    originalFilename: "B.pdf",
  },
];

describe("ComparisonHybridRetriever", () => {
  test("searches and returns evidence separately for both documents", async () => {
    const index = {
      searchDocument: jest.fn(({ comparisonDocumentId }) => [
        {
          docId: comparisonDocumentId === 1 ? "doc-a" : "doc-b",
          pageNumber: comparisonDocumentId === 1 ? 4 : 9,
          text: `Lexical evidence ${comparisonDocumentId}`,
          exactMatch: true,
        },
      ]),
      searchComparisonCatalog: jest.fn(),
    };
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(({ includeDocIds }) => ({
        message: false,
        sources: [
          {
            title: includeDocIds[0] === "doc-a" ? "A.pdf" : "B.pdf",
            pageNumber: includeDocIds[0] === "doc-a" ? 4 : 9,
            text: `Semantic evidence ${includeDocIds[0]}`,
          },
        ],
      })),
    };
    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare", topN: 4 },
      thread: { id: 20 },
      query: "Selbstbehalt",
      LLMConnector: {},
      VectorDb,
      documents,
      index,
    });

    expect(result.ready).toBe(true);
    expect(index.searchDocument).toHaveBeenCalledTimes(2);
    expect(VectorDb.performSimilaritySearch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ includeDocIds: ["doc-a"] })
    );
    expect(VectorDb.performSimilaritySearch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ includeDocIds: ["doc-b"] })
    );
    expect(result.contextTexts.join("\n")).toContain("DOKUMENT A");
    expect(result.contextTexts.join("\n")).toContain("DOKUMENT B");
    expect(result.sources.map((source) => source.documentSlot)).toEqual(
      expect.arrayContaining(["A", "B"])
    );
  });

  test("refuses comparison until exactly two documents are ready", async () => {
    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare" },
      thread: { id: 20 },
      query: "Vergleiche",
      LLMConnector: {},
      VectorDb: {},
      documents: documents.slice(0, 1),
    });
    expect(result).toMatchObject({ active: true, ready: false });
  });

  test("uses category-balanced lexical retrieval for a full comparison", async () => {
    const index = {
      searchDocument: jest.fn(),
      searchComparisonCatalog: jest.fn(({ comparisonDocumentId }) => [
        {
          docId: comparisonDocumentId === 1 ? "doc-a" : "doc-b",
          pageNumber: 1,
          text: "Catalog evidence",
          exactMatch: true,
        },
      ]),
    };
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(() => ({
        message: false,
        sources: [],
      })),
    };

    await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare", topN: 4 },
      thread: { id: 20 },
      query: "Vergleiche die beiden Policen vollständig",
      LLMConnector: {},
      VectorDb,
      documents,
      index,
    });

    expect(index.searchComparisonCatalog).toHaveBeenCalledTimes(2);
    expect(index.searchDocument).not.toHaveBeenCalled();
    expect(VectorDb.performSimilaritySearch).toHaveBeenCalledWith(
      expect.objectContaining({ topN: 24 })
    );
  });

  test("fails closed when the vector database cannot enforce document scope", async () => {
    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare" },
      thread: { id: 20 },
      query: "Vergleiche",
      LLMConnector: {},
      VectorDb: { name: "Qdrant" },
      documents,
    });
    expect(result).toMatchObject({ active: true, ready: false });
    expect(result.message).toContain("LanceDB");
  });
});
