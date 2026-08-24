const prisma = require("../utils/prisma");

jest.mock("../utils/prisma", () => ({
  comparison_documents: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

const {
  ComparisonDocument,
  ComparisonDocumentLimitError,
} = require("../models/comparisonDocument");

describe("ComparisonDocument", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects a third document in the same thread", async () => {
    prisma.comparison_documents.findFirst.mockResolvedValue(null);
    prisma.comparison_documents.findMany.mockResolvedValue([
      { id: 1, slot: "A" },
      { id: 2, slot: "B" },
    ]);

    await expect(
      ComparisonDocument.reserve({
        workspaceId: 1,
        threadId: 2,
        parsedFileId: 3,
        originalFilename: "third.pdf",
      })
    ).rejects.toBeInstanceOf(ComparisonDocumentLimitError);
    expect(prisma.comparison_documents.create).not.toHaveBeenCalled();
  });

  it("does not turn a persisted failure back into indexing during hydration", async () => {
    const failed = {
      id: 7,
      status: "failed",
      error: "Failed to decode batch",
    };
    prisma.comparison_documents.findFirst.mockResolvedValue(failed);

    await expect(
      ComparisonDocument.reserve({
        workspaceId: 1,
        threadId: 2,
        parsedFileId: 3,
        originalFilename: "failed.pdf",
      })
    ).resolves.toBe(failed);
    expect(prisma.comparison_documents.update).not.toHaveBeenCalled();
  });

  it("reactivates a failed document only for an explicit embed retry", async () => {
    prisma.comparison_documents.findFirst.mockResolvedValue({
      id: 7,
      status: "failed",
      error: "Failed to decode batch",
    });
    prisma.comparison_documents.update.mockResolvedValue({
      id: 7,
      status: "indexing",
      error: null,
    });

    await ComparisonDocument.reserve({
      workspaceId: 1,
      threadId: 2,
      parsedFileId: 3,
      originalFilename: "failed.pdf",
      reactivateExisting: true,
    });

    expect(prisma.comparison_documents.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ status: "indexing", error: null }),
    });
  });

  it("returns only ready records for the requested user and thread", async () => {
    prisma.comparison_documents.findMany.mockResolvedValue([]);

    await ComparisonDocument.readyForThread({
      workspaceId: 4,
      threadId: 5,
      userId: 6,
    });

    expect(prisma.comparison_documents.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 4,
        threadId: 5,
        userId: 6,
        status: "ready",
      },
      include: { workspaceDocument: true },
      orderBy: { slot: "asc" },
    });
  });

  it("returns all statuses so indexing threads never fall back to global RAG", async () => {
    prisma.comparison_documents.findMany.mockResolvedValue([]);

    await ComparisonDocument.forThread({
      workspaceId: 4,
      threadId: 5,
      userId: 6,
    });

    expect(prisma.comparison_documents.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 4, threadId: 5, userId: 6 },
      include: { workspaceDocument: true },
      orderBy: { slot: "asc" },
    });
  });

  it("serializes the stable frontend and retrieval contract", () => {
    expect(
      ComparisonDocument.serialize({
        id: 9,
        slot: "B",
        status: "ready",
        originalFilename: "Polizze B.pdf",
        tokenCount: 123,
        pageCount: 30,
        workspaceDocumentId: 10,
        inventoryStatus: "ready",
        inventoryItemCount: 12,
        workspaceDocument: { docId: "doc-b", docpath: "custom/b.json" },
      })
    ).toEqual({
      id: 9,
      slot: "B",
      status: "ready",
      originalFilename: "Polizze B.pdf",
      tokenCount: 123,
      pageCount: 30,
      parsedFileId: null,
      workspaceDocumentId: 10,
      docId: "doc-b",
      location: "custom/b.json",
      docpath: "custom/b.json",
      sourceSha256: null,
      inventoryStatus: "ready",
      inventoryItemCount: 12,
      inventoryError: null,
      error: null,
    });
  });
});
