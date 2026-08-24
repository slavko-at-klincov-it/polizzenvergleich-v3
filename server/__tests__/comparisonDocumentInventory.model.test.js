const prisma = require("../utils/prisma");

jest.mock("../utils/prisma", () => ({
  comparison_documents: { findUnique: jest.fn(), update: jest.fn() },
  comparison_document_analysis_runs: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  comparison_document_clause_blocks: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  comparison_document_block_signals: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  comparison_document_block_embeddings: { findMany: jest.fn() },
  comparison_document_inventory_items: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  comparison_document_fact_evidence: { create: jest.fn() },
  $queryRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
}));

const {
  ComparisonDocumentInventory,
} = require("../models/comparisonDocumentInventory");

describe("ComparisonDocumentInventory run staging", () => {
  const SOURCE_A = "a".repeat(64);
  const SOURCE_B = "b".repeat(64);
  const block = {
    blockKey: "block-1",
    ordinal: 0,
    pageNumber: 1,
    pageStart: 0,
    pageEnd: "Der Selbstbehalt beträgt EUR 500.".length,
    sourceStart: 100,
    sourceEnd: 100 + "Der Selbstbehalt beträgt EUR 500.".length,
    textHash: "hash-1",
    text: "Der Selbstbehalt beträgt EUR 500.",
    sourceMethod: "native",
    structureKind: "paragraph",
    headingPath: ["Vandalismus"],
    layoutQuality: "native_spans",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma)
    );
    prisma.comparison_documents.findUnique.mockResolvedValue({
      id: 7,
      publishedAnalysisRunId: 41,
      inventoryStatus: "ready",
      inventoryVersion: 3,
      inventoryItemCount: 1,
      inventoryPageCount: 21,
      sourceSha256: SOURCE_A,
      inventorySourceSha256: SOURCE_A,
      inventoryError: null,
    });
    prisma.comparison_documents.update.mockResolvedValue({ id: 7 });
    prisma.comparison_document_analysis_runs.findUnique.mockResolvedValue(null);
    prisma.comparison_document_analysis_runs.findFirst.mockResolvedValue(null);
    prisma.comparison_document_analysis_runs.create.mockResolvedValue({
      id: 42,
      comparisonDocumentId: 7,
      pipelineVersion: 4,
      sourceSha256: SOURCE_B,
      pageCount: 21,
      expectedBlockCount: 1,
      status: "building",
    });
    prisma.comparison_document_analysis_runs.update.mockImplementation(
      async ({ where, data }) => ({
        id: where.id,
        comparisonDocumentId: 7,
        ...data,
      })
    );
    prisma.comparison_document_analysis_runs.findMany.mockResolvedValue([]);
    prisma.comparison_document_clause_blocks.createMany.mockResolvedValue({
      count: 1,
    });
    prisma.comparison_document_clause_blocks.findMany.mockResolvedValue([
      { id: 71, analysisRunId: 42, ...block, status: "pending" },
    ]);
    prisma.comparison_document_clause_blocks.findUnique.mockResolvedValue({
      id: 71,
      analysisRunId: 42,
      ...block,
    });
    prisma.comparison_document_clause_blocks.update.mockResolvedValue({});
    prisma.comparison_document_inventory_items.findMany.mockResolvedValue([]);
    prisma.comparison_document_inventory_items.deleteMany.mockResolvedValue({
      count: 0,
    });
    prisma.comparison_document_inventory_items.create.mockResolvedValue({
      id: 91,
    });
    prisma.comparison_document_fact_evidence.create.mockResolvedValue({
      id: 101,
    });
    prisma.comparison_document_block_embeddings.findMany.mockResolvedValue([]);
    prisma.$queryRawUnsafe.mockResolvedValue([{ blockId: 71 }]);
  });

  test("stages a new run without deleting or replacing the published run", async () => {
    const prepared = await ComparisonDocumentInventory.prepareAnalysis({
      comparisonDocumentId: 7,
      version: 4,
      sourceSha256: SOURCE_B,
      pageCount: 21,
      units: [block],
    });

    expect(prepared.analysisRunId).toBe(42);
    expect(
      prisma.comparison_document_analysis_runs.create
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        comparisonDocumentId: 7,
        sourceSha256: SOURCE_B,
        expectedBlockCount: 1,
      }),
    });
    expect(
      prisma.comparison_document_clause_blocks.createMany
    ).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ analysisRunId: 42, blockKey: "block-1" }),
      ],
      skipDuplicates: true,
    });
    expect(
      prisma.comparison_document_inventory_items.deleteMany
    ).not.toHaveBeenCalled();
    expect(
      prisma.comparison_document_analysis_runs.deleteMany
    ).not.toHaveBeenCalled();
    expect(prisma.comparison_documents.update).not.toHaveBeenCalled();
  });

  test("creates a fresh staging run beside a published run with the same source contract", async () => {
    prisma.comparison_documents.findUnique.mockResolvedValue({
      id: 7,
      publishedAnalysisRunId: 41,
      inventoryStatus: "ready",
    });
    prisma.comparison_document_analysis_runs.create.mockResolvedValue({
      id: 43,
      comparisonDocumentId: 7,
      pipelineVersion: 4,
      sourceSha256: SOURCE_A,
      status: "building",
    });
    prisma.comparison_document_clause_blocks.findMany.mockResolvedValue([
      { id: 72, analysisRunId: 43, ...block, status: "pending" },
    ]);

    const prepared = await ComparisonDocumentInventory.prepareAnalysis({
      comparisonDocumentId: 7,
      version: 4,
      sourceSha256: SOURCE_A,
      pageCount: 21,
      units: [block],
    });

    expect(prepared.analysisRunId).toBe(43);
    expect(
      prisma.comparison_document_analysis_runs.findFirst
    ).toHaveBeenCalledWith({
      where: expect.objectContaining({
        comparisonDocumentId: 7,
        sourceSha256: SOURCE_A,
        id: { not: 41 },
        status: { in: ["building", "retryable_failed"] },
      }),
      orderBy: [{ id: "desc" }],
    });
    expect(prisma.comparison_document_analysis_runs.create).toHaveBeenCalled();
    expect(prisma.comparison_documents.update).not.toHaveBeenCalled();
  });

  test("reuses the stable run identity when an interrupted source/version resumes", async () => {
    prisma.comparison_document_analysis_runs.findFirst.mockResolvedValue({
      id: 42,
      comparisonDocumentId: 7,
      pipelineVersion: 4,
      sourceSha256: SOURCE_B,
      status: "retryable_failed",
    });
    const prepared = await ComparisonDocumentInventory.prepareAnalysis({
      comparisonDocumentId: 7,
      version: 4,
      sourceSha256: SOURCE_B,
      pageCount: 21,
      units: [block],
    });

    expect(prepared.analysisRunId).toBe(42);
    expect(
      prisma.comparison_document_analysis_runs.create
    ).not.toHaveBeenCalled();
    expect(
      prisma.comparison_document_analysis_runs.update
    ).toHaveBeenCalledWith({
      where: { id: 42 },
      data: expect.objectContaining({ status: "building", error: null }),
    });
    expect(prisma.comparison_documents.update).not.toHaveBeenCalled();
  });

  test("keeps a legacy ready inventory published while the first staged run builds or fails", async () => {
    prisma.comparison_documents.findUnique.mockResolvedValue({
      id: 7,
      publishedAnalysisRunId: null,
      inventoryStatus: "ready",
      inventoryItemCount: 2,
      inventorySourceSha256: SOURCE_A,
    });

    await ComparisonDocumentInventory.prepareAnalysis({
      comparisonDocumentId: 7,
      version: 4,
      sourceSha256: SOURCE_B,
      pageCount: 21,
      units: [block],
    });
    expect(prisma.comparison_documents.update).not.toHaveBeenCalled();

    prisma.comparison_document_analysis_runs.findUnique.mockResolvedValue({
      id: 42,
      comparisonDocumentId: 7,
    });
    await ComparisonDocumentInventory.markAnalysisFailed({
      analysisRunId: 42,
      comparisonDocumentId: 7,
      error: "timeout",
    });
    expect(prisma.comparison_documents.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.not.objectContaining({ inventoryStatus: "failed" }),
    });
  });

  test("scopes fact replacement and evidence to exactly one analysis run", async () => {
    prisma.comparison_document_analysis_runs.findUnique.mockResolvedValue({
      id: 42,
      comparisonDocumentId: 7,
    });
    const evidenceText = "Der Selbstbehalt beträgt EUR 500.";
    await ComparisonDocumentInventory.completeAnalysisUnit({
      analysisRunId: 42,
      unitKey: "block-1",
      facts: [
        {
          factKey: "same-semantic-fact-as-old-run",
          unitKey: "block-1",
          factType: "deductible",
          label: "Selbstbehalt",
          claimText: evidenceText,
          pageNumber: 1,
          evidenceText,
          evidenceStart: 100,
          evidenceEnd: 100 + evidenceText.length,
        },
      ],
      reviewCount: 0,
      resultKind: "facts",
    });

    expect(
      prisma.comparison_document_inventory_items.deleteMany
    ).toHaveBeenCalledWith({
      where: { analysisRunId: 42, primaryBlockId: 71 },
    });
    expect(
      prisma.comparison_document_inventory_items.create
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        comparisonDocumentId: 7,
        analysisRunId: 42,
        primaryBlockId: 71,
        factKey: "same-semantic-fact-as-old-run",
      }),
    });
    expect(
      prisma.comparison_document_fact_evidence.create
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        analysisRunId: 42,
        inventoryItemId: 91,
        blockId: 71,
        sourceStart: 100,
        sourceEnd: 100 + evidenceText.length,
      }),
    });
  });

  test("does not allow unknown content to terminate merely because signals are absent", async () => {
    await expect(
      ComparisonDocumentInventory.completeAnalysisUnit({
        analysisRunId: 42,
        unitKey: "block-1",
        facts: [],
        reviewCount: 0,
        resultKind: "no_fact",
        noFactReason: "keine bekannte Regel erkannt",
      })
    ).rejects.toThrow("must remain ambiguous");
    expect(
      prisma.comparison_document_clause_blocks.update
    ).not.toHaveBeenCalled();
  });

  test("keeps multiple exact evidence spans attached to one run-scoped fact", async () => {
    prisma.comparison_document_analysis_runs.findUnique.mockResolvedValue({
      id: 42,
      comparisonDocumentId: 7,
    });
    prisma.comparison_document_clause_blocks.findUnique.mockImplementation(
      async ({ where }) => {
        const key = where.analysisRunId_blockKey.blockKey;
        if (key === "block-2")
          return {
            id: 72,
            analysisRunId: 42,
            blockKey: "block-2",
            pageNumber: 2,
            sourceStart: 200,
            sourceEnd: 223,
            text: "Polizeilich anzuzeigen.",
          };
        return { id: 71, analysisRunId: 42, ...block };
      }
    );

    await ComparisonDocumentInventory.completeAnalysisUnit({
      analysisRunId: 42,
      unitKey: "block-1",
      facts: [
        {
          factKey: "vandalismus-with-obligation",
          unitKey: "block-1",
          factType: "coverage",
          label: "Vandalismus",
          claimText: block.text,
          pageNumber: 1,
          evidenceText: block.text,
          evidenceStart: block.sourceStart,
          evidenceEnd: block.sourceEnd,
          evidences: [
            {
              blockKey: "block-2",
              pageNumber: 2,
              sourceStart: 200,
              sourceEnd: 223,
              evidenceText: "Polizeilich anzuzeigen.",
            },
          ],
        },
      ],
      reviewCount: 1,
      resultKind: "facts",
    });

    expect(
      prisma.comparison_document_fact_evidence.create
    ).toHaveBeenCalledTimes(2);
    expect(
      prisma.comparison_document_fact_evidence.create
    ).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        analysisRunId: 42,
        blockId: 72,
        ordinal: 1,
        pageNumber: 2,
      }),
    });
  });

  test("publishes by atomically switching the document pointer only after all gates pass", async () => {
    prisma.comparison_document_analysis_runs.findUnique.mockResolvedValue({
      id: 42,
      comparisonDocumentId: 7,
      pipelineVersion: 4,
      sourceSha256: SOURCE_B,
      pageCount: 21,
      expectedBlockCount: 1,
    });
    prisma.comparison_document_clause_blocks.findMany.mockResolvedValue([
      {
        id: 71,
        textHash: "hash-1",
        text: block.text,
        sourceStart: block.sourceStart,
        sourceEnd: block.sourceEnd,
        pageNumber: 1,
        factCount: 1,
        status: "model_validated_facts",
        ftsStatus: "ready",
        embeddingStatus: "ready",
      },
    ]);
    prisma.comparison_document_block_embeddings.findMany.mockResolvedValue([
      {
        analysisRunId: 42,
        blockId: 71,
        status: "ready",
        textHash: "hash-1",
        model: "dinghy-embed",
        dimensions: 2560,
      },
    ]);
    prisma.comparison_document_inventory_items.findMany.mockResolvedValue([
      {
        id: 91,
        comparisonDocumentId: 7,
        analysisRunId: 42,
        primaryBlockId: 71,
        pageNumber: 1,
        evidenceText: block.text,
        evidenceHash:
          "ad43664b483ee8ee22137e92ece60d78ee4c35abd5ba8f9edc98c97d742a62d2",
        evidenceStart: block.sourceStart,
        evidenceEnd: block.sourceEnd,
        evidences: [
          {
            id: 101,
            analysisRunId: 42,
            blockId: 71,
            ordinal: 0,
            pageNumber: 1,
            sourceStart: block.sourceStart,
            sourceEnd: block.sourceEnd,
            evidenceText: block.text,
            evidenceHash:
              "ad43664b483ee8ee22137e92ece60d78ee4c35abd5ba8f9edc98c97d742a62d2",
          },
        ],
      },
    ]);
    jest.spyOn(ComparisonDocumentInventory, "get").mockResolvedValue({
      comparisonDocumentId: 7,
      analysisRunId: 42,
      status: "ready",
    });

    await ComparisonDocumentInventory.finalizeAnalysis({
      analysisRunId: 42,
      comparisonDocumentId: 7,
      version: 4,
      sourceSha256: SOURCE_B,
    });

    expect(prisma.comparison_documents.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({
        publishedAnalysisRunId: 42,
        inventoryStatus: "ready",
        inventoryVersion: 4,
        inventorySourceSha256: SOURCE_B,
      }),
    });
    expect(
      prisma.comparison_document_analysis_runs.deleteMany
    ).not.toHaveBeenCalled();
  });

  test("leaves the published pointer unchanged when staged coverage is incomplete", async () => {
    prisma.comparison_document_analysis_runs.findUnique.mockResolvedValue({
      id: 42,
      comparisonDocumentId: 7,
      pipelineVersion: 4,
      sourceSha256: SOURCE_B,
      pageCount: 21,
      expectedBlockCount: 1,
    });
    prisma.comparison_document_clause_blocks.findMany.mockResolvedValue([
      {
        id: 71,
        status: "ambiguous_pending",
        ftsStatus: "ready",
        embeddingStatus: "ready",
      },
    ]);
    await expect(
      ComparisonDocumentInventory.finalizeAnalysis({
        analysisRunId: 42,
        comparisonDocumentId: 7,
        version: 4,
        sourceSha256: SOURCE_B,
      })
    ).rejects.toThrow("every primary block");
    expect(prisma.comparison_documents.update).not.toHaveBeenCalled();
  });

  test("rejects a primary evidence span owned by a different run block", async () => {
    const otherText = "Andere belegte Klausel.";
    const otherHash =
      "3aeb2e851017e7c7d1617b55d65b3779ada54c61a36fb036b9aea0a471be03da";
    prisma.comparison_document_analysis_runs.findUnique.mockResolvedValue({
      id: 42,
      comparisonDocumentId: 7,
      pipelineVersion: 4,
      sourceSha256: SOURCE_B,
      pageCount: 21,
      expectedBlockCount: 2,
    });
    prisma.comparison_document_clause_blocks.findMany.mockResolvedValue([
      {
        id: 71,
        textHash: "hash-1",
        text: block.text,
        sourceStart: block.sourceStart,
        sourceEnd: block.sourceEnd,
        pageNumber: 1,
        factCount: 1,
        status: "model_validated_facts",
        ftsStatus: "ready",
        embeddingStatus: "ready",
      },
      {
        id: 72,
        textHash: "hash-2",
        text: otherText,
        sourceStart: 200,
        sourceEnd: 200 + otherText.length,
        pageNumber: 1,
        factCount: 0,
        status: "technical_non_content",
        ftsStatus: "ready",
        embeddingStatus: "ready",
      },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValue([
      { blockId: 71 },
      { blockId: 72 },
    ]);
    prisma.comparison_document_block_embeddings.findMany.mockResolvedValue([
      {
        blockId: 71,
        status: "ready",
        textHash: "hash-1",
        model: "dinghy-embed",
        dimensions: 2560,
      },
      {
        blockId: 72,
        status: "ready",
        textHash: "hash-2",
        model: "dinghy-embed",
        dimensions: 2560,
      },
    ]);
    prisma.comparison_document_inventory_items.findMany.mockResolvedValue([
      {
        id: 91,
        comparisonDocumentId: 7,
        analysisRunId: 42,
        primaryBlockId: 71,
        pageNumber: 1,
        evidenceText: otherText,
        evidenceHash: otherHash,
        evidenceStart: 200,
        evidenceEnd: 200 + otherText.length,
        evidences: [
          {
            analysisRunId: 42,
            blockId: 72,
            ordinal: 0,
            pageNumber: 1,
            sourceStart: 200,
            sourceEnd: 200 + otherText.length,
            evidenceText: otherText,
            evidenceHash: otherHash,
          },
        ],
      },
    ]);

    await expect(
      ComparisonDocumentInventory.finalizeAnalysis({
        analysisRunId: 42,
        comparisonDocumentId: 7,
        version: 4,
        sourceSha256: SOURCE_B,
      })
    ).rejects.toThrow("Every fact and evidence");
    expect(prisma.comparison_documents.update).not.toHaveBeenCalled();
  });

  test("marks only the staged run failed when an older run is published", async () => {
    prisma.comparison_document_analysis_runs.findUnique.mockResolvedValue({
      id: 42,
      comparisonDocumentId: 7,
    });
    await ComparisonDocumentInventory.markAnalysisFailed({
      analysisRunId: 42,
      comparisonDocumentId: 7,
      error: "model timeout",
    });
    expect(
      prisma.comparison_document_analysis_runs.update
    ).toHaveBeenCalledWith({
      where: { id: 42 },
      data: expect.objectContaining({ status: "retryable_failed" }),
    });
    expect(prisma.comparison_documents.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.not.objectContaining({
        publishedAnalysisRunId: expect.anything(),
      }),
    });
  });
});
