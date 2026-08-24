jest.mock("../../../models/comparisonDocumentInventory", () => ({
  ComparisonDocumentInventory: {
    get: jest.fn(),
    analysisUnits: jest.fn(),
    prepareAnalysis: jest.fn(),
    persistBlockSignals: jest.fn(),
    markBlockAmbiguous: jest.fn(),
    completeAnalysisUnit: jest.fn(),
    finalizeAnalysis: jest.fn(),
    markAnalysisFailed: jest.fn(),
    interruptedRuns: jest.fn(),
    analysisArtifacts: jest.fn(),
    clear: jest.fn(),
    successfulBlockStatuses: new Set([
      "deterministic_facts",
      "technical_non_content",
      "model_validated_facts",
      "model_verified_no_fact",
    ]),
  },
}));
jest.mock("../../../utils/files", () => ({ fileData: jest.fn() }));
jest.mock("../../../utils/PolicyComparison/ComparisonFactMapper", () => ({
  FACT_EXTRACTION_VERSION: 7,
  ComparisonFactMapper: { extract: jest.fn() },
  ComparisonAmbiguousFactResolver: { extract: jest.fn() },
}));
jest.mock("../../../utils/PolicyComparison/ComparisonClauseBlockIndex", () => ({
  ComparisonClauseBlockIndex: { indexRun: jest.fn(), removeRun: jest.fn() },
}));
jest.mock(
  "../../../utils/PolicyComparison/ComparisonClauseEmbeddingIndex",
  () => ({
    ComparisonClauseEmbeddingIndex: {
      indexRun: jest.fn(),
      removeVectorIds: jest.fn(),
    },
  })
);

const {
  ComparisonDocumentInventory,
} = require("../../../models/comparisonDocumentInventory");
const { fileData } = require("../../../utils/files");
const {
  ComparisonAmbiguousFactResolver,
} = require("../../../utils/PolicyComparison/ComparisonFactMapper");
const {
  ComparisonClauseBlockIndex,
} = require("../../../utils/PolicyComparison/ComparisonClauseBlockIndex");
const {
  ComparisonClauseEmbeddingIndex,
} = require("../../../utils/PolicyComparison/ComparisonClauseEmbeddingIndex");
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
  pageContent: "Vandalismus ist versichert, ausgenommen Graffiti.",
  pdfExtraction: {
    complete: true,
    sourceSha256: "a".repeat(64),
    totalPages: 1,
    pages: [
      { pageNumber: 1, start: 0, end: 49, method: "native", status: "ok" },
    ],
  },
};

describe("ComparisonInventoryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ComparisonDocumentInventory.get.mockResolvedValue(null);
    ComparisonDocumentInventory.analysisUnits.mockResolvedValue([]);
    ComparisonDocumentInventory.persistBlockSignals.mockResolvedValue(true);
    ComparisonDocumentInventory.markBlockAmbiguous.mockResolvedValue(true);
    ComparisonDocumentInventory.interruptedRuns.mockResolvedValue([]);
    ComparisonDocumentInventory.analysisArtifacts.mockResolvedValue({
      runIds: [],
      vectorIds: [],
    });
    ComparisonClauseBlockIndex.indexRun.mockResolvedValue(1);
    ComparisonClauseEmbeddingIndex.indexRun.mockResolvedValue(1);
    ComparisonClauseEmbeddingIndex.removeVectorIds.mockResolvedValue(true);
    ComparisonDocumentInventory.markAnalysisFailed.mockResolvedValue({
      comparisonDocumentId: 1,
      status: "failed",
      version: 7,
      itemCount: 0,
      pageCount: 0,
      items: [],
    });
    ComparisonDocumentInventory.prepareAnalysis.mockImplementation(
      async (input) => ({
        analysisRunId: 41,
        units: input.units.map((unit) => ({
          ...unit,
          blockKey: unit.blockKey,
          status: "pending",
        })),
      })
    );
    ComparisonDocumentInventory.completeAnalysisUnit.mockResolvedValue(true);
    ComparisonDocumentInventory.finalizeAnalysis.mockImplementation(
      async (input) => ({
        comparisonDocumentId: input.comparisonDocumentId,
        status: "ready",
        version: input.version,
        itemCount: 1,
        pageCount: 1,
        sourceSha256: input.sourceSha256,
        inventorySourceSha256: input.sourceSha256,
        error: null,
        analysisCoverage: { unitCount: 1, validatedUnitCount: 1 },
        items: [{ label: "Vandalismus" }],
      })
    );
    ComparisonAmbiguousFactResolver.extract.mockImplementation(
      async ({ units, onUnitValidated }) => {
        const fact = {
          factKey: "fact",
          unitKey: units[0].unitKey,
          factType: "coverage",
          label: "Vandalismus",
          aliases: [],
          claimText: "Vandalismus ist versichert, ausgenommen Graffiti.",
          pageNumber: 1,
          evidenceText: "Vandalismus ist versichert, ausgenommen Graffiti.",
          evidenceStart: 0,
          evidenceEnd: 49,
        };
        await onUnitValidated({
          unit: units[0],
          facts: [fact],
          reviewCount: 0,
          resultKind: "facts",
          noFactReason: null,
        });
        return { complete: true, units: [{ unit: units[0] }], facts: [fact] };
      }
    );
  });

  test("persists only page-grounded model inventory facts", async () => {
    const result = await ComparisonInventoryService.buildForDocument({
      comparisonDocument: document,
      documentData,
      Connector: { getChatCompletion: jest.fn() },
    });

    expect(
      ComparisonDocumentInventory.completeAnalysisUnit
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        comparisonDocumentId: 1,
        facts: expect.arrayContaining([
          expect.objectContaining({
            factType: "coverage",
            pageNumber: 1,
            evidenceText: "Vandalismus ist versichert, ausgenommen Graffiti.",
          }),
        ]),
      })
    );
    expect(ComparisonDocumentInventory.prepareAnalysis).toHaveBeenCalled();
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
      analysisCoverage: { unitCount: 1, validatedUnitCount: 1 },
    };
    ComparisonDocumentInventory.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(readyManifest);
    fileData.mockResolvedValue(documentData);

    const result = await ComparisonInventoryService.ensureForDocuments({
      documents: [document],
      Connector: {},
    });

    expect(fileData).toHaveBeenCalledWith(document.docpath);
    expect(ComparisonAmbiguousFactResolver.extract).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ document, manifest: readyManifest }]);
  });

  test("prepares the complete deterministic clause ledger without invoking the fact mapper", async () => {
    fileData.mockResolvedValue(documentData);

    const [ledger] =
      await ComparisonInventoryService.ensureDeterministicLedgerForDocuments({
        documents: [document],
        includeEmbeddings: true,
      });

    expect(ledger).toMatchObject({
      comparisonDocument: document,
      analysisRunId: 41,
      coverage: { pageCount: 1 },
    });
    expect(ComparisonDocumentInventory.prepareAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ announceInventory: false })
    );
    expect(ComparisonClauseBlockIndex.indexRun).toHaveBeenCalledWith({
      analysisRunId: 41,
      comparisonDocumentId: 1,
    });
    expect(ComparisonClauseEmbeddingIndex.indexRun).toHaveBeenCalledWith({
      analysisRunId: 41,
      comparisonDocument: document,
    });
    expect(ComparisonAmbiguousFactResolver.extract).not.toHaveBeenCalled();
    expect(ComparisonDocumentInventory.finalizeAnalysis).not.toHaveBeenCalled();
  });

  test("reuses the immutable published ledger without creating a new staged run", async () => {
    const readyManifest = {
      comparisonDocumentId: 1,
      analysisRunId: 77,
      status: "ready",
      version: 7,
      itemCount: 1,
      pageCount: 1,
      sourceSha256: "a".repeat(64),
      inventorySourceSha256: "a".repeat(64),
      items: [{ factKey: "fact" }],
      analysisCoverage: { unitCount: 1, validatedUnitCount: 1 },
    };
    ComparisonDocumentInventory.get.mockResolvedValue(readyManifest);
    ComparisonDocumentInventory.analysisUnits.mockResolvedValue([
      {
        id: 17,
        blockKey: "published-block",
        ordinal: 0,
        pageNumber: 1,
        sourceStart: 0,
        sourceEnd: 23,
        text: "Selbstbehalt EUR 350.",
        headingPathJson: '["Erdbeben"]',
        structureKind: "paragraph",
      },
    ]);

    const [ledger] =
      await ComparisonInventoryService.ensureDeterministicLedgerForDocuments({
        documents: [document],
      });

    expect(ledger.analysisRunId).toBe(77);
    expect(ledger.units[0].headingPath).toEqual(["Erdbeben"]);
    expect(ledger.deterministicResults.get("published-block").facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factType: "deductible", pageNumber: 1 }),
      ])
    );
    expect(fileData).not.toHaveBeenCalled();
    expect(ComparisonDocumentInventory.prepareAnalysis).not.toHaveBeenCalled();
  });

  test("coalesces concurrent legacy regeneration for the same document", async () => {
    let manifest = null;
    ComparisonDocumentInventory.get.mockImplementation(async () => manifest);
    ComparisonDocumentInventory.finalizeAnalysis.mockImplementation(
      async (input) => {
        manifest = {
          comparisonDocumentId: input.comparisonDocumentId,
          status: "ready",
          version: input.version,
          itemCount: 1,
          pageCount: 1,
          sourceSha256: input.sourceSha256,
          inventorySourceSha256: input.sourceSha256,
          error: null,
          items: [{ label: "Vandalismus" }],
          analysisCoverage: { unitCount: 1, validatedUnitCount: 1 },
        };
        return manifest;
      }
    );
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

    expect(ComparisonAmbiguousFactResolver.extract).toHaveBeenCalledTimes(1);
    expect(ComparisonDocumentInventory.finalizeAnalysis).toHaveBeenCalledTimes(
      1
    );
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
      analysisCoverage: { unitCount: 1, validatedUnitCount: 1 },
    };
    ComparisonDocumentInventory.get.mockResolvedValue(manifest);

    await expect(
      ComparisonInventoryService.ensureForDocuments({
        documents: [document],
        Connector: {},
      })
    ).resolves.toEqual([{ document, manifest }]);
    expect(fileData).not.toHaveBeenCalled();
    expect(ComparisonAmbiguousFactResolver.extract).not.toHaveBeenCalled();
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
      analysisCoverage: { unitCount: 1, validatedUnitCount: 1 },
    };
    ComparisonDocumentInventory.get.mockResolvedValue(manifest);

    await expect(
      ComparisonInventoryService.readyForDocuments({ documents: [document] })
    ).resolves.toEqual([{ document, manifest }]);
    expect(fileData).not.toHaveBeenCalled();
    expect(ComparisonAmbiguousFactResolver.extract).not.toHaveBeenCalled();
  });

  test("marks an interrupted deep analysis retryable after restart", async () => {
    ComparisonDocumentInventory.interruptedRuns.mockResolvedValue([{ id: 41 }]);
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
    expect(ComparisonDocumentInventory.markAnalysisFailed).toHaveBeenCalledWith(
      {
        analysisRunId: 41,
        comparisonDocumentId: 1,
        error: expect.stringContaining("Serverneustart"),
      }
    );
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
      if (calls < 2) return stale;
      return {
        ...stale,
        sourceSha256: "a".repeat(64),
        inventorySourceSha256: "a".repeat(64),
        items: [{ label: "Vandalismus" }],
        analysisCoverage: { unitCount: 1, validatedUnitCount: 1 },
      };
    });
    fileData.mockResolvedValue(documentData);

    await ComparisonInventoryService.ensureForDocuments({
      documents: [document],
      Connector: {},
    });
    expect(fileData).toHaveBeenCalledTimes(1);
    expect(ComparisonAmbiguousFactResolver.extract).toHaveBeenCalledTimes(1);
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
    expect(ComparisonAmbiguousFactResolver.extract).not.toHaveBeenCalled();
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
    ComparisonAmbiguousFactResolver.extract.mockRejectedValue(
      new Error("model unavailable")
    );

    await expect(
      ComparisonInventoryService.ensureForDocuments({
        documents: [document],
        Connector: {},
      })
    ).rejects.toThrow("model unavailable");
    expect(ComparisonDocumentInventory.markAnalysisFailed).toHaveBeenCalledWith(
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
    expect(ComparisonAmbiguousFactResolver.extract).not.toHaveBeenCalled();
    expect(ComparisonDocumentInventory.finalizeAnalysis).not.toHaveBeenCalled();
    expect(
      ComparisonDocumentInventory.markAnalysisFailed
    ).not.toHaveBeenCalled();
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

  test("removes run-scoped FTS and vectors before deleting SQL staging data", async () => {
    const order = [];
    ComparisonDocumentInventory.analysisArtifacts.mockResolvedValue({
      runIds: [41, 42],
      vectorIds: ["vector-41", "vector-42"],
    });
    ComparisonClauseBlockIndex.removeRun.mockImplementation(async (runId) => {
      order.push(`fts:${runId}`);
    });
    ComparisonClauseEmbeddingIndex.removeVectorIds.mockImplementation(
      async () => order.push("vectors")
    );
    ComparisonDocumentInventory.clear.mockImplementation(async () => {
      order.push("sql");
      return null;
    });

    await ComparisonInventoryService.clear(1);

    expect(order).toEqual(["fts:41", "fts:42", "vectors", "sql"]);
    expect(ComparisonClauseEmbeddingIndex.removeVectorIds).toHaveBeenCalledWith(
      ["vector-41", "vector-42"]
    );
  });
});
