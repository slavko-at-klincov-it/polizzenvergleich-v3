const fs = require("fs");
const os = require("os");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const {
  ComparisonChunkIndex,
} = require("../../../utils/PolicyComparison/ComparisonChunkIndex");
const {
  ComparisonHybridRetriever,
} = require("../../../utils/PolicyComparison/ComparisonHybridRetriever");
const {
  ComparisonInventoryExtractor,
} = require("../../../utils/PolicyComparison/ComparisonInventoryExtractor");

function pageAwareDocument(pages, title) {
  const separator = "\n\n";
  let offset = 0;
  const pageMap = pages.map((text, index) => {
    const start = offset;
    offset += text.length;
    const page = {
      pageNumber: index + 1,
      start,
      end: offset,
      method: "native",
      status: "ok",
    };
    offset += index === pages.length - 1 ? 0 : separator.length;
    return page;
  });
  return {
    title,
    pageContent: pages.join(separator),
    pdfExtraction: { pages: pageMap },
  };
}

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

  test("indexes all 198 pages and finds a rare late clause", async () => {
    const pages = Array.from({ length: 198 }, (_, index) => {
      const pageNumber = index + 1;
      if (pageNumber === 2)
        return "Selbstbehalt: EUR 350 je Schadenfall.";
      if (pageNumber === 40)
        return "Deckungsgrenze: Die Versicherungssumme beträgt EUR 1.000.000.";
      if (pageNumber === 80)
        return "Ausschlüsse: Krieg und vorsätzliche Herbeiführung.";
      if (pageNumber === 187)
        return "Vandalismus: Mutwillige Beschädigung durch Dritte ist bis EUR 25.000 versichert.";
      return `Vertragsseite ${pageNumber}. Allgemeine Hinweise zur Abwicklung.`;
    });
    await ComparisonChunkIndex.indexDocument({
      comparisonDocument: {
        id: 198,
        workspaceId: 1,
        threadId: 2,
        workspaceDocumentId: 30,
        docId: "long-a",
        slot: "A",
        originalFilename: "Lang A.pdf",
      },
      documentData: pageAwareDocument(pages, "Lang A.pdf"),
      db,
    });

    const results = await ComparisonChunkIndex.searchDocument({
      threadId: 2,
      comparisonDocumentId: 198,
      query: "Vandalismus",
      db,
    });
    expect(results[0]).toEqual(expect.objectContaining({ pageNumber: 187 }));
    expect(results[0].text).toContain("Mutwillige Beschädigung");
  });

  test("finds Vandalismus and core clauses in both documents without topic competition", async () => {
    const pagesA = Array.from(
      { length: 198 },
      (_, index) => `Allgemeine Vertragsinformation Seite ${index + 1}.`
    );
    pagesA[1] = "Selbstbehalt: EUR 350 je Schadenfall.";
    pagesA[39] = "Deckungsgrenze: Versicherungssumme EUR 1.000.000.";
    pagesA[79] = "Ausschlüsse: Krieg ist ausdrücklich ausgeschlossen.";
    pagesA[186] =
      "Vandalismus: Mutwillige Beschädigung durch Dritte ist bis EUR 25.000 versichert.";
    const pagesB = Array.from(
      { length: 24 },
      (_, index) => `Besondere Vertragsinformation Seite ${index + 1}.`
    );
    pagesB[2] = "Selbstbehalt: EUR 500 je Schadenfall.";
    pagesB[6] = "Deckungsgrenze: Höchstentschädigung EUR 750.000.";
    pagesB[10] = "Ausschlüsse: Vorsatz ist ausdrücklich ausgeschlossen.";
    pagesB[16] =
      "Vandalismus: Schäden durch mutwillige Beschädigung sind versichert.";

    const comparisonDocuments = [
      {
        id: 301,
        workspaceId: 1,
        threadId: 2,
        workspaceDocumentId: 31,
        docId: "vandal-a",
        slot: "A",
        status: "ready",
        originalFilename: "A-198.pdf",
      },
      {
        id: 302,
        workspaceId: 1,
        threadId: 2,
        workspaceDocumentId: 32,
        docId: "vandal-b",
        slot: "B",
        status: "ready",
        originalFilename: "B-24.pdf",
      },
    ];
    const dataA = pageAwareDocument(pagesA, "A-198.pdf");
    const dataB = pageAwareDocument(pagesB, "B-24.pdf");
    dataA.pdfExtraction.complete = true;
    dataA.pdfExtraction.sourceSha256 = "a".repeat(64);
    dataA.pdfExtraction.totalPages = pagesA.length;
    dataB.pdfExtraction.complete = true;
    dataB.pdfExtraction.sourceSha256 = "b".repeat(64);
    dataB.pdfExtraction.totalPages = pagesB.length;
    await ComparisonChunkIndex.indexDocument({
      comparisonDocument: comparisonDocuments[0],
      documentData: dataA,
      db,
    });
    await ComparisonChunkIndex.indexDocument({
      comparisonDocument: comparisonDocuments[1],
      documentData: dataB,
      db,
    });

    const clauseDefinitions = [
      ["selbstbehalt", "Selbstbehalt", ["selbstbehalt", "franchise"]],
      [
        "deckungssumme",
        "Deckungsgrenze",
        ["deckungssumme", "deckungsgrenze", "höchstentschädigung"],
      ],
      [
        "ausschluss",
        "Ausschluss",
        ["ausschluss", "ausschlüsse", "ausgeschlossen"],
      ],
      [
        "vandalismus",
        "Vandalismus",
        ["vandalismus", "mutwillige beschädigung"],
      ],
    ];
    const extractTopics = async (documentData, pages) =>
      ComparisonInventoryExtractor.extract({
        documentData,
        Connector: {
          getChatCompletion: async (messages) => {
            const batch = messages.at(-1).content;
            const topics = [];
            pages.forEach((text, index) => {
              if (!batch.includes(text)) return;
              const definition = clauseDefinitions.find(([, , aliases]) =>
                aliases.some((term) =>
                  text.toLocaleLowerCase("de-AT").includes(term)
                )
              );
              if (!definition) return;
              topics.push({
                label: definition[1],
                aliases: definition[2],
                page: index + 1,
                evidence: text,
              });
            });
            return { textResponse: JSON.stringify({ topics }) };
          },
        },
      });
    const [inventoryA, inventoryB] = await Promise.all([
      extractTopics(dataA, pagesA),
      extractTopics(dataB, pagesB),
    ]);
    const discoveredTopics = new Map();
    for (const [slot, inventory] of [
      ["A", inventoryA],
      ["B", inventoryB],
    ]) {
      for (const item of inventory.inventoryItems) {
        const topic = discoveredTopics.get(item.facetKey) || {
          id: item.facetKey,
          label: item.label,
          terms: [],
          anchors: [],
        };
        topic.terms = [...new Set([...topic.terms, item.label, ...item.aliases])];
        topic.anchors.push({
          slot,
          pageNumber: item.pageNumber,
          evidenceText: item.evidenceText,
        });
        discoveredTopics.set(item.facetKey, topic);
      }
    }

    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(() => ({
        message: false,
        sources: [],
      })),
    };
    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 1, slug: "comparison", topN: 4 },
      thread: { id: 2 },
      query: "Vergleiche die beiden Policen vollständig",
      LLMConnector: {},
      VectorDb,
      documents: comparisonDocuments,
      index: {
        listThreadTopics: () => [...discoveredTopics.values()],
        searchTopic: (args) =>
          ComparisonChunkIndex.searchTopic({ ...args, db }),
      },
    });

    expect(VectorDb.performSimilaritySearch).toHaveBeenCalledTimes(8);
    for (const expected of [
      ["A", "vandalismus", 187],
      ["B", "vandalismus", 17],
      ["A", "selbstbehalt", 2],
      ["B", "selbstbehalt", 3],
      ["A", "deckungssumme", 40],
      ["B", "deckungssumme", 7],
      ["A", "ausschluss", 80],
      ["B", "ausschluss", 11],
    ]) {
      expect(result.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            documentSlot: expected[0],
            topicId: expected[1],
            pageNumber: expected[2],
          }),
        ])
      );
    }
    expect(result.contextTexts.join("\n")).toContain(
      "[THEMA Vandalismus | topicId=vandalismus]"
    );
    expect(result.coverage.noEvidence).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ topicId: "vandalismus" }),
      ])
    );
  });
});
