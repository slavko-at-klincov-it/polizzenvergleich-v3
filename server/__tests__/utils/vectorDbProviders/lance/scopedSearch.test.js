const fs = require("fs");
const os = require("os");
const path = require("path");
const lancedb = require("@lancedb/lancedb");
process.env.STORAGE_DIR ||= path.join(os.tmpdir(), "policy-lance-test-storage");
const { LanceDb } = require("../../../../utils/vectorDbProviders/lance");

describe("LanceDb scoped similarity search", () => {
  let tempDirectory;
  let client;

  beforeEach(async () => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "policy-lance-"));
    client = await lancedb.connect(tempDirectory);
    await client.createTable("policies", [
      {
        id: "vector-a",
        vector: [1, 0, 0],
        text: "Selbstbehalt in Dokument A",
        title: "A.pdf",
        pageNumber: 2,
      },
      {
        id: "vector-b",
        vector: [1, 0, 0],
        text: "Selbstbehalt in Dokument B",
        title: "B.pdf",
        pageNumber: 9,
      },
    ]);
  });

  afterEach(() => {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  test("filters candidates before top-N selection", async () => {
    const db = new LanceDb();
    const result = await db.similarityResponse({
      client,
      namespace: "policies",
      queryVector: [1, 0, 0],
      similarityThreshold: 0,
      topN: 2,
      includeVectorIds: ["vector-b"],
    });

    expect(result.sourceDocuments).toHaveLength(1);
    expect(result.sourceDocuments[0]).toMatchObject({
      id: "vector-b",
      title: "B.pdf",
      pageNumber: 9,
    });
  });

  test("escapes vector IDs used in Lance SQL filters", () => {
    const db = new LanceDb();
    expect(db.vectorIdFilter(["a'b"])).toBe("id IN ('a''b')");
  });

  test("excludes comparison vectors before top-N selection", async () => {
    const db = new LanceDb();
    const result = await db.similarityResponse({
      client,
      namespace: "policies",
      queryVector: [1, 0, 0],
      similarityThreshold: 0,
      topN: 2,
      excludeVectorIds: ["vector-a"],
    });

    expect(result.sourceDocuments).toHaveLength(1);
    expect(result.sourceDocuments[0].id).toBe("vector-b");
  });

  test("rejects a wrong-dimensional managed query before opening LanceDB", async () => {
    const previous = process.env.POLICY_MANAGED_EMBEDDING;
    process.env.POLICY_MANAGED_EMBEDDING = "true";
    const db = new LanceDb();
    const connect = jest.spyOn(db, "connect");
    try {
      await expect(
        db.performSimilaritySearch({
          namespace: "policies",
          input: "Vandalismus",
          LLMConnector: {
            embedTextInput: jest.fn(async () => Array(384).fill(0)),
          },
        })
      ).rejects.toThrow("expected 2560");
      expect(connect).not.toHaveBeenCalled();
    } finally {
      connect.mockRestore();
      if (previous == null) delete process.env.POLICY_MANAGED_EMBEDDING;
      else process.env.POLICY_MANAGED_EMBEDDING = previous;
    }
  });
});
