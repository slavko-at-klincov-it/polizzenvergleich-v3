const fs = require("fs");
const os = require("os");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const {
  ComparisonChunkIndex,
} = require("../../../utils/PolicyComparison/ComparisonChunkIndex");

describe("ComparisonChunkIndex SQLite FTS5 integration", () => {
  let tempDirectory;
  let db;

  beforeEach(() => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "policy-fts-"));
    db = new PrismaClient({
      datasources: {
        db: { url: `file:${path.join(tempDirectory, "comparison.db")}` },
      },
    });
    ComparisonChunkIndex._schemaPromise = null;
  });

  afterEach(async () => {
    await db.$disconnect();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
    ComparisonChunkIndex._schemaPromise = null;
  });

  test("indexes and finds an exact German clause with page evidence", async () => {
    const pageOne = "Allgemeine Vertragsinformationen.";
    const pageTwo = "Der Selbstbehalt beträgt EUR 350 je Schadenfall.";
    const separator = "\n\n";
    const pageContent = `${pageOne}${separator}${pageTwo}`;

    const indexed = await ComparisonChunkIndex.indexDocument({
      comparisonDocument: {
        id: 11,
        workspaceId: 1,
        threadId: 2,
        workspaceDocumentId: 3,
        docId: "doc-a",
        slot: "A",
        originalFilename: "Polizze A.pdf",
      },
      documentData: {
        title: "Polizze A.pdf",
        pageContent,
        pdfExtraction: {
          pages: [
            {
              pageNumber: 1,
              start: 0,
              end: pageOne.length,
              method: "native",
              status: "ok",
            },
            {
              pageNumber: 2,
              start: pageOne.length + separator.length,
              end: pageContent.length,
              method: "ocr",
              status: "ok",
            },
          ],
        },
      },
      db,
    });
    const results = await ComparisonChunkIndex.searchDocument({
      threadId: 2,
      comparisonDocumentId: 11,
      query: "Selbstbehalt",
      db,
    });

    expect(indexed.indexed).toBe(2);
    expect(results).toEqual([
      expect.objectContaining({
        docId: "doc-a",
        slot: "A",
        pageNumber: 2,
        exactMatch: true,
      }),
    ]);
    expect(results[0].text).toContain("EUR 350");
  });

  test("keeps identically named documents isolated by thread and mapping", async () => {
    await ComparisonChunkIndex.ensureSchema(db);
    await db.$executeRawUnsafe(
      `INSERT INTO comparison_document_chunks_fts (
        comparisonDocumentId, workspaceId, threadId, workspaceDocumentId,
        docId, slot, originalFilename, pageNumber, chunkIndex, text,
        normalizedText
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      99,
      1,
      999,
      3,
      "other-thread",
      "A",
      "Polizze A.pdf",
      77,
      0,
      "Selbstbehalt EUR 999",
      "selbstbehalt eur 999"
    );

    const results = await ComparisonChunkIndex.searchDocument({
      threadId: 2,
      comparisonDocumentId: 11,
      query: "Selbstbehalt",
      db,
    });
    expect(results).toEqual([]);
  });
});
