const prisma = require("../utils/prisma");

jest.mock("../utils/prisma", () => ({
  comparison_documents: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  comparison_document_inventory_items: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));

const {
  ComparisonDocumentInventory,
} = require("../models/comparisonDocumentInventory");

describe("ComparisonDocumentInventory", () => {
  const SOURCE_SHA256 = "a".repeat(64);
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.comparison_documents.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma)
    );
    prisma.comparison_document_inventory_items.deleteMany.mockResolvedValue({
      count: 0,
    });
    prisma.comparison_document_inventory_items.createMany.mockResolvedValue({
      count: 0,
    });
    prisma.comparison_documents.update.mockImplementation(
      async ({ where, data }) => ({ id: where.id, ...data })
    );
  });

  it("reads the nullable manifest and deserializes open inventory values", async () => {
    prisma.comparison_documents.findUnique.mockResolvedValue({
      id: 7,
      inventoryStatus: "ready",
      inventoryVersion: 2,
      inventoryItemCount: 1,
      inventoryPageCount: 30,
      sourceSha256: SOURCE_SHA256,
      inventorySourceSha256: SOURCE_SHA256,
      inventoryError: null,
      inventoryItems: [
        {
          id: 8,
          factKey: "fact-1",
          facetKey: "kundenspezifisch:glasbruch",
          label: "Sonderdeckung Glasbruch",
          aliasesJson: '["Glasbruch-Sonderdeckung"]',
          polarity: "partially-covered",
          valueJson: '{"amount":25000,"currency":"EUR"}',
          unit: "je Schadenfall",
          conditionsJson: '["nur bei benutzten Gebäuden"]',
          pageNumber: 12,
          evidenceText: "Glasbruch ist bis EUR 25.000 gedeckt.",
          evidenceHash: "hash-1",
          sourceMethod: "ocr",
          confidence: 0.91,
        },
      ],
    });

    await expect(ComparisonDocumentInventory.get(7)).resolves.toEqual({
      comparisonDocumentId: 7,
      status: "ready",
      version: 2,
      itemCount: 1,
      pageCount: 30,
      sourceSha256: SOURCE_SHA256,
      inventorySourceSha256: SOURCE_SHA256,
      error: null,
      items: [
        expect.objectContaining({
          id: 8,
          facetKey: "kundenspezifisch:glasbruch",
          aliases: ["Glasbruch-Sonderdeckung"],
          polarity: "partially-covered",
          value: { amount: 25000, currency: "EUR" },
          conditions: ["nur bei benutzten Gebäuden"],
          pageNumber: 12,
          sourceMethod: "ocr",
        }),
      ],
    });
    expect(prisma.comparison_documents.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      include: {
        inventoryItems: {
          orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
        },
      },
    });
  });

  it("atomically replaces, normalizes and deduplicates an open inventory", async () => {
    const fact = {
      facetKey: "vandalismus-und-graffiti",
      label: "Böswillige Beschädigung",
      aliases: ["Vandalismus", "Graffiti", "vandalismus"],
      polarity: "conditional-cover",
      value: { currency: "EUR", amount: 25_000 },
      unit: "je Schadenfall",
      conditions: { minimumDeductible: 500, rate: 0.1 },
      pageNumber: 19,
      evidenceText:
        "Mutwillige Beschädigung durch Dritte ist bis EUR 25.000 versichert.",
      sourceMethod: "native",
      confidence: 0.97,
    };
    prisma.comparison_documents.findUnique.mockResolvedValue({
      id: 7,
      inventoryStatus: "ready",
      inventoryVersion: 3,
      inventoryItemCount: 1,
      inventoryPageCount: 30,
      inventoryError: null,
      inventoryItems: [],
    });

    await ComparisonDocumentInventory.replace({
      comparisonDocumentId: 7,
      version: 3,
      pageCount: 30,
      sourceSha256: SOURCE_SHA256,
      items: [
        fact,
        {
          ...fact,
          value: { amount: 25_000, currency: "EUR" },
          conditions: { rate: 0.1, minimumDeductible: 500 },
        },
      ],
    });

    const create =
      prisma.comparison_document_inventory_items.createMany.mock.calls[0][0];
    expect(create.data).toHaveLength(1);
    expect(create.data[0]).toEqual(
      expect.objectContaining({
        comparisonDocumentId: 7,
        facetKey: "vandalismus-und-graffiti",
        aliasesJson: '["Vandalismus","Graffiti"]',
        polarity: "conditional-cover",
        valueJson: '{"amount":25000,"currency":"EUR"}',
        conditionsJson: '{"minimumDeductible":500,"rate":0.1}',
        pageNumber: 19,
        evidenceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        factKey: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );
    expect(prisma.comparison_documents.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({
        inventoryStatus: "ready",
        inventoryVersion: 3,
        inventoryItemCount: 1,
        inventoryPageCount: 30,
        inventoryError: null,
      }),
    });
  });

  it("does not write an inventory whose evidence page exceeds coverage", async () => {
    await expect(
      ComparisonDocumentInventory.replace({
        comparisonDocumentId: 7,
        version: 1,
        pageCount: 10,
        sourceSha256: SOURCE_SHA256,
        items: [
          {
            label: "Vandalismus",
            pageNumber: 11,
            evidenceText: "Vandalismus ist versichert.",
          },
        ],
      })
    ).rejects.toThrow("beyond the processed pages");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not publish ready without processed pages", async () => {
    await expect(
      ComparisonDocumentInventory.replace({
        comparisonDocumentId: 7,
        version: 1,
        pageCount: 0,
        sourceSha256: SOURCE_SHA256,
        items: [],
      })
    ).rejects.toThrow("pageCount must be a positive integer");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not publish an empty fallback-only inventory", async () => {
    await expect(
      ComparisonDocumentInventory.replace({
        comparisonDocumentId: 7,
        version: 1,
        pageCount: 10,
        sourceSha256: SOURCE_SHA256,
        items: [],
      })
    ).rejects.toThrow("at least one grounded item");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("clears stale items on building, failed and legacy reset transitions", async () => {
    const building = await ComparisonDocumentInventory.markBuilding({
      comparisonDocumentId: 7,
      version: 4,
    });
    expect(building).toMatchObject({
      comparisonDocumentId: 7,
      status: "building",
      version: 4,
      itemCount: 0,
      pageCount: 0,
      error: null,
    });

    const failed = await ComparisonDocumentInventory.markFailed({
      comparisonDocumentId: 7,
      version: 4,
      pageCount: 9,
      error: "OCR page 10 failed",
    });
    expect(failed).toMatchObject({
      status: "failed",
      version: 4,
      itemCount: 0,
      pageCount: 9,
      error: "OCR page 10 failed",
    });

    const cleared = await ComparisonDocumentInventory.clear(7);
    expect(cleared).toMatchObject({
      status: null,
      version: null,
      itemCount: 0,
      pageCount: 0,
      error: null,
    });
    expect(
      prisma.comparison_document_inventory_items.deleteMany
    ).toHaveBeenCalledTimes(3);
  });

  it("keeps the last ready inventory while a rebuild starts or fails", async () => {
    const ready = {
      id: 7,
      inventoryStatus: "ready",
      inventoryVersion: 3,
      inventoryItemCount: 2,
      inventoryPageCount: 30,
      inventoryError: null,
    };
    prisma.comparison_documents.findUnique.mockResolvedValue(ready);

    await expect(
      ComparisonDocumentInventory.markBuilding({
        comparisonDocumentId: 7,
        version: 4,
      })
    ).resolves.toMatchObject({
      status: "ready",
      version: 3,
      itemCount: 2,
      pageCount: 30,
    });
    expect(
      prisma.comparison_document_inventory_items.deleteMany
    ).not.toHaveBeenCalled();
    expect(prisma.comparison_documents.update).not.toHaveBeenCalled();

    prisma.comparison_documents.update.mockResolvedValue({
      ...ready,
      inventoryError: "Extractor unavailable",
    });
    await expect(
      ComparisonDocumentInventory.markFailed({
        comparisonDocumentId: 7,
        version: 4,
        pageCount: 10,
        error: "Extractor unavailable",
      })
    ).resolves.toMatchObject({
      status: "ready",
      version: 3,
      itemCount: 2,
      pageCount: 30,
      error: "Extractor unavailable",
    });
    expect(
      prisma.comparison_document_inventory_items.deleteMany
    ).not.toHaveBeenCalled();
    expect(prisma.comparison_documents.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        inventoryError: "Extractor unavailable",
        lastUpdatedAt: expect.any(Date),
      },
    });
  });

  it("never publishes ready when item persistence fails", async () => {
    prisma.comparison_document_inventory_items.createMany.mockRejectedValue(
      new Error("disk full")
    );

    await expect(
      ComparisonDocumentInventory.replace({
        comparisonDocumentId: 7,
        version: 1,
        pageCount: 1,
        sourceSha256: SOURCE_SHA256,
        items: [
          {
            label: "Selbstbehalt",
            pageNumber: 1,
            evidenceText: "Der Selbstbehalt beträgt EUR 350.",
          },
        ],
      })
    ).rejects.toThrow("disk full");
    expect(prisma.comparison_documents.update).not.toHaveBeenCalled();
    expect(prisma.comparison_documents.findUnique).not.toHaveBeenCalled();
  });
});
