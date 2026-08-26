const fs = require("fs");
const os = require("os");
const path = require("path");
const lancedb = require("@lancedb/lancedb");
const {
  assertLanceProvenanceSchema,
} = require("../../../../utils/vectorDbProviders/lance/provenance");

function row(overrides = {}) {
  return {
    id: "vector-1",
    vector: [1, 0],
    text: "Ordinary text.",
    provenanceSchemaVersion: 1,
    docId: "doc-notes",
    sourceDocumentId: "source-notes",
    title: "notes.txt",
    pageNumber: 0,
    chunkIndex: 0,
    pageChunkIndex: 0,
    ...overrides,
  };
}

describe("Lance provenance schema integration", () => {
  let root;
  let client;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "lance-provenance-"));
    client = await lancedb.connect(root);
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test("keeps PDF provenance when a non-PDF creates the namespace first", async () => {
    const table = await client.createTable("workspace", [row()]);
    await assertLanceProvenanceSchema(table);
    await table.add([
      row({
        id: "vector-2",
        text: "PDF page five.",
        docId: "doc-policy",
        sourceDocumentId: "source-policy",
        title: "policy.pdf",
        pageNumber: 5,
      }),
      row({
        id: "vector-3",
        text: "Second PDF page five.",
        docId: "doc-policy-b",
        sourceDocumentId: "source-policy-b",
        title: "policy-b.pdf",
        pageNumber: 5,
      }),
    ]);
    await assertLanceProvenanceSchema(table);
    const rows = await table.query().toArray();
    expect(rows).toHaveLength(3);
    expect(rows.find(({ docId }) => docId === "doc-policy")).toMatchObject({
      title: "policy.pdf",
      pageNumber: 5,
      sourceDocumentId: "source-policy",
    });
    expect(
      rows
        .filter(({ pageNumber }) => pageNumber === 5)
        .map(({ docId, title }) => [docId, title])
        .sort()
    ).toEqual([
      ["doc-policy", "policy.pdf"],
      ["doc-policy-b", "policy-b.pdf"],
    ]);
  });

  test("rejects an existing namespace without required provenance columns", async () => {
    await client.createTable("legacy", [
      { id: "legacy", vector: [1, 0], text: "legacy" },
    ]);
    const table = await client.openTable("legacy");
    await expect(assertLanceProvenanceSchema(table)).rejects.toThrow(
      "LANCE_PROVENANCE_REINDEX_REQUIRED"
    );
  });
});
