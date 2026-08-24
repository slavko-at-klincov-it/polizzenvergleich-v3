jest.mock("../../../models/comparisonDocumentInventory", () => ({
  ComparisonDocumentInventory: {
    get: jest.fn(),
    markBuilding: jest.fn(),
    replace: jest.fn(),
    markFailed: jest.fn(),
    clear: jest.fn(),
  },
}));
jest.mock("../../../utils/files", () => ({ fileData: jest.fn() }));
jest.mock(
  "../../../utils/PolicyComparison/ComparisonInventoryExtractor",
  () => ({
    EXTRACTION_VERSION: 7,
    ComparisonInventoryExtractor: { extract: jest.fn() },
  })
);

const {
  ComparisonDocumentInventory,
} = require("../../../models/comparisonDocumentInventory");
const { fileData } = require("../../../utils/files");
const {
  ComparisonInventoryExtractor,
} = require("../../../utils/PolicyComparison/ComparisonInventoryExtractor");
const {
  ComparisonInventoryService,
} = require("../../../utils/PolicyComparison/ComparisonInventoryService");

const document = {
  id: 1,
  slot: "A",
  docpath: "custom-documents/a.json",
  sourceSha256: "a".repeat(64),
};
const documentData = {
  pageContent: "Vandalismus ist versichert.",
  pdfExtraction: {
    complete: true,
    sourceSha256: "a".repeat(64),
    totalPages: 1,
    pages: [
      { pageNumber: 1, start: 0, end: 27, method: "native", status: "ok" },
    ],
  },
};

describe("ComparisonInventoryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ComparisonDocumentInventory.get.mockResolvedValue(null);
    ComparisonDocumentInventory.markBuilding.mockResolvedValue({
      comparisonDocumentId: 1,
      status: "building",
      version: 7,
      itemCount: 0,
      pageCount: 0,
      items: [],
    });
    ComparisonDocumentInventory.markFailed.mockResolvedValue({
      comparisonDocumentId: 1,
      status: "failed",
      version: 7,
      itemCount: 0,
      pageCount: 0,
      items: [],
    });
    ComparisonDocumentInventory.replace.mockImplementation(async (input) => ({
      comparisonDocumentId: input.comparisonDocumentId,
      status: "ready",
      version: input.version,
      itemCount: input.items.length,
      pageCount: input.pageCount,
      sourceSha256: input.sourceSha256,
      inventorySourceSha256: input.sourceSha256,
      error: null,
      items: input.items,
    }));
    ComparisonInventoryExtractor.extract.mockResolvedValue({
      pageCount: 1,
      sourceSha256: "a".repeat(64),
      inventorySourceSha256: "a".repeat(64),
      topics: [
        {
          id: "vandalismus",
          label: "Vandalismus",
          aliases: ["mutwillige Beschädigung"],
          origin: "model",
          occurrences: [
            {
              page: 1,
              evidence: "Vandalismus ist versichert.",
              evidenceValidation: "exact",
            },
          ],
        },
        {
          id: "selbstbehalt",
          label: "Selbstbehalt",
          aliases: [],
          origin: "fallback",
          occurrences: [],
        },
      ],
    });
  });

  test("persists only page-grounded model inventory facts", async () => {
    const result = await ComparisonInventoryService.buildForDocument({
      comparisonDocument: document,
      documentData,
      Connector: { getChatCompletion: jest.fn() },
    });

    expect(ComparisonDocumentInventory.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        comparisonDocumentId: 1,
        version: 7,
        pageCount: 1,
        items: [
          expect.objectContaining({
            facetKey: "vandalismus",
            aliases: ["mutwillige Beschädigung"],
            pageNumber: 1,
            evidenceText: "Vandalismus ist versichert.",
          }),
        ],
      })
    );
    expect(ComparisonDocumentInventory.markBuilding).toHaveBeenCalledWith({
      comparisonDocumentId: 1,
      version: 7,
    });
    expect(result.manifest.status).toBe("ready");
  });

  test("lazily regenerates legacy inventories from stored canonical JSON", async () => {
    const readyManifest = {
      comparisonDocumentId: 1,
      status: "ready",
      version: 7,
      itemCount: 1,
      pageCount: 1,
      sourceSha256: "a".repeat(64),
      inventorySourceSha256: "a".repeat(64),
      error: null,
      items: [{ label: "Vandalismus" }],
    };
    ComparisonDocumentInventory.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(readyManifest);
    fileData.mockResolvedValue(documentData);

    const result = await ComparisonInventoryService.ensureForDocuments({
      documents: [document],
      Connector: {},
    });

    expect(fileData).toHaveBeenCalledWith(document.docpath);
    expect(ComparisonInventoryExtractor.extract).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ document, manifest: readyManifest }]);
  });

  test("coalesces concurrent legacy regeneration for the same document", async () => {
    let manifest = null;
    ComparisonDocumentInventory.get.mockImplementation(async () => manifest);
    ComparisonDocumentInventory.replace.mockImplementation(async (input) => {
      manifest = {
        comparisonDocumentId: input.comparisonDocumentId,
        status: "ready",
        version: input.version,
        itemCount: input.items.length,
        pageCount: input.pageCount,
        sourceSha256: input.sourceSha256,
        inventorySourceSha256: input.sourceSha256,
        error: null,
        items: input.items,
      };
      return manifest;
    });
    fileData.mockResolvedValue(documentData);

    const [first, second] = await Promise.all([
      ComparisonInventoryService.ensureForDocuments({
        documents: [document],
        Connector: {},
      }),
      ComparisonInventoryService.ensureForDocuments({
        documents: [document],
        Connector: {},
      }),
    ]);

    expect(ComparisonInventoryExtractor.extract).toHaveBeenCalledTimes(1);
    expect(ComparisonDocumentInventory.replace).toHaveBeenCalledTimes(1);
    expect(first[0].manifest.status).toBe("ready");
    expect(second[0].manifest.status).toBe("ready");
  });

  test("skips a current source-bound inventory without loading the JSON", async () => {
    const manifest = {
      comparisonDocumentId: 1,
      status: "ready",
      version: 7,
      itemCount: 1,
      pageCount: 1,
      sourceSha256: "a".repeat(64),
      inventorySourceSha256: "a".repeat(64),
      error: null,
      items: [{ label: "Vandalismus" }],
    };
    ComparisonDocumentInventory.get.mockResolvedValue(manifest);

    await expect(
      ComparisonInventoryService.ensureForDocuments({
        documents: [document],
        Connector: {},
      })
    ).resolves.toEqual([{ document, manifest }]);
    expect(fileData).not.toHaveBeenCalled();
    expect(ComparisonInventoryExtractor.extract).not.toHaveBeenCalled();
  });

  test("reads current inventories without triggering a rebuild", async () => {
    const manifest = {
      comparisonDocumentId: 1,
      status: "ready",
      version: 7,
      itemCount: 1,
      pageCount: 1,
      sourceSha256: "a".repeat(64),
      inventorySourceSha256: "a".repeat(64),
      error: null,
      items: [{ label: "Vandalismus" }],
    };
    ComparisonDocumentInventory.get.mockResolvedValue(manifest);

    await expect(
      ComparisonInventoryService.readyForDocuments({ documents: [document] })
    ).resolves.toEqual([{ document, manifest }]);
    expect(fileData).not.toHaveBeenCalled();
    expect(ComparisonInventoryExtractor.extract).not.toHaveBeenCalled();
  });

  test("marks an interrupted deep analysis retryable after restart", async () => {
    await expect(
      ComparisonInventoryService.reconcileInterrupted({
        documents: [
          {
            ...document,
            inventoryStatus: "building",
            inventoryPageCount: 1,
          },
        ],
      })
    ).resolves.toBe(true);
    expect(ComparisonDocumentInventory.markFailed).toHaveBeenCalledWith({
      comparisonDocumentId: 1,
      version: 7,
      pageCount: 1,
      error: expect.stringContaining("Serverneustart"),
    });
  });

  test("rebuilds when the canonical source hash changed", async () => {
    const stale = {
      comparisonDocumentId: 1,
      status: "ready",
      version: 7,
      itemCount: 1,
      pageCount: 1,
      sourceSha256: "b".repeat(64),
      inventorySourceSha256: "b".repeat(64),
      error: null,
      items: [{ label: "Alt" }],
    };
    let calls = 0;
    ComparisonDocumentInventory.get.mockImplementation(async () => {
      calls += 1;
      if (calls < 3) return stale;
      return {
        ...stale,
        sourceSha256: "a".repeat(64),
        inventorySourceSha256: "a".repeat(64),
        items: [{ label: "Vandalismus" }],
      };
    });
    fileData.mockResolvedValue(documentData);

    await ComparisonInventoryService.ensureForDocuments({
      documents: [document],
      Connector: {},
    });
    expect(fileData).toHaveBeenCalledTimes(1);
    expect(ComparisonInventoryExtractor.extract).toHaveBeenCalledTimes(1);
  });

  test("fails closed when a stale inventory has no canonical source", async () => {
    ComparisonDocumentInventory.get.mockResolvedValue(null);
    fileData.mockResolvedValue(null);

    await expect(
      ComparisonInventoryService.ensureForDocuments({
        documents: [document],
        Connector: {},
      })
    ).rejects.toThrow("gespeicherte Textbestand");
    expect(ComparisonInventoryExtractor.extract).not.toHaveBeenCalled();
  });

  test("records a failed rebuild without deleting the last ready inventory", async () => {
    const stale = {
      comparisonDocumentId: 1,
      status: "ready",
      version: 6,
      itemCount: 1,
      pageCount: 1,
      sourceSha256: "b".repeat(64),
      inventorySourceSha256: "b".repeat(64),
      items: [{ label: "Alt" }],
    };
    ComparisonDocumentInventory.get.mockResolvedValue(stale);
    fileData.mockResolvedValue(documentData);
    ComparisonInventoryExtractor.extract.mockRejectedValue(
      new Error("model unavailable")
    );

    await expect(
      ComparisonInventoryService.ensureForDocuments({
        documents: [document],
        Connector: {},
      })
    ).rejects.toThrow("model unavailable");
    expect(ComparisonDocumentInventory.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        comparisonDocumentId: 1,
        error: "model unavailable",
      })
    );
    expect(ComparisonDocumentInventory.clear).not.toHaveBeenCalled();
  });

  test("rejects a canonical source that differs from existing FTS and vectors", async () => {
    const oldReady = {
      comparisonDocumentId: 1,
      status: "ready",
      version: 6,
      itemCount: 1,
      pageCount: 1,
      sourceSha256: "b".repeat(64),
      inventorySourceSha256: "b".repeat(64),
      items: [{ label: "Alt" }],
    };
    ComparisonDocumentInventory.get.mockResolvedValue(oldReady);

    await expect(
      ComparisonInventoryService.buildForDocument({
        comparisonDocument: {
          ...document,
          sourceSha256: "b".repeat(64),
        },
        documentData,
        Connector: {},
      })
    ).rejects.toThrow("does not match");
    expect(ComparisonInventoryExtractor.extract).not.toHaveBeenCalled();
    expect(ComparisonDocumentInventory.replace).not.toHaveBeenCalled();
    expect(ComparisonDocumentInventory.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ comparisonDocumentId: 1 })
    );
  });

  test("keeps open topics and adds fallback anchors without replacing them", () => {
    const topics = ComparisonInventoryService.unionTopics([
      {
        document: { slot: "A" },
        manifest: {
          items: [
            {
              facetKey: "glasbruch-sonderklausel",
              label: "Glasbruch-Sonderklausel",
              aliases: ["Spezialverglasung"],
              pageNumber: 44,
              evidenceHash: "hash",
            },
          ],
        },
      },
    ]);
    expect(topics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "glasbruch-sonderklausel",
          origins: ["A"],
          origin: "inventory",
        }),
        expect.objectContaining({ id: "selbstbehalt", origin: "fallback" }),
      ])
    );
  });
});
