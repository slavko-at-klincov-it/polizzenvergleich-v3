const prisma = require("../utils/prisma");

const COMPARISON_DOCUMENT_SLOTS = ["A", "B"];
const COMPARISON_DOCUMENT_STATUSES = [
  "indexing",
  "ready",
  "failed",
  "deleting",
];

class ComparisonDocumentLimitError extends Error {
  constructor(
    message = "A comparison thread can contain at most two documents."
  ) {
    super(message);
    this.name = "ComparisonDocumentLimitError";
    this.statusCode = 409;
  }
}

const ComparisonDocument = {
  slots: COMPARISON_DOCUMENT_SLOTS,
  statuses: COMPARISON_DOCUMENT_STATUSES,

  get: async function (clause = {}) {
    return prisma.comparison_documents.findFirst({ where: clause });
  },

  where: async function (clause = {}, orderBy = { slot: "asc" }) {
    return prisma.comparison_documents.findMany({
      where: clause,
      ...(orderBy ? { orderBy } : {}),
    });
  },

  forThread: async function ({ workspaceId, threadId, userId = null }) {
    return prisma.comparison_documents.findMany({
      where: {
        workspaceId: Number(workspaceId),
        threadId: Number(threadId),
        userId: userId == null ? null : Number(userId),
      },
      include: { workspaceDocument: true },
      orderBy: { slot: "asc" },
    });
  },

  readyForThread: async function ({ workspaceId, threadId, userId = null }) {
    return prisma.comparison_documents.findMany({
      where: {
        workspaceId: Number(workspaceId),
        threadId: Number(threadId),
        userId: userId == null ? null : Number(userId),
        status: "ready",
      },
      include: { workspaceDocument: true },
      orderBy: { slot: "asc" },
    });
  },

  update: async function (id, data = {}) {
    return prisma.comparison_documents.update({
      where: { id: Number(id) },
      data: { ...data, lastUpdatedAt: new Date() },
    });
  },

  delete: async function (clause = {}) {
    return prisma.comparison_documents.deleteMany({ where: clause });
  },

  /**
   * Reserves one of the two comparison slots. A unique (threadId, slot)
   * constraint is the final guard against concurrent requests.
   */
  reserve: async function ({
    workspaceId,
    threadId,
    userId = null,
    parsedFileId,
    originalFilename,
    tokenCount = 0,
    pageCount = null,
  }) {
    const existing = await this.get({
      workspaceId: Number(workspaceId),
      threadId: Number(threadId),
      parsedFileId: Number(parsedFileId),
    });
    if (existing) {
      if (existing.status === "ready") return existing;
      return this.update(existing.id, {
        status: "indexing",
        error: null,
        tokenCount: Number(tokenCount) || 0,
        pageCount: pageCount == null ? null : Number(pageCount),
      });
    }

    for (
      let attempt = 0;
      attempt < COMPARISON_DOCUMENT_SLOTS.length;
      attempt++
    ) {
      const occupied = await this.where(
        { workspaceId: Number(workspaceId), threadId: Number(threadId) },
        null
      );
      const slot = COMPARISON_DOCUMENT_SLOTS.find(
        (candidate) => !occupied.some((document) => document.slot === candidate)
      );
      if (!slot) throw new ComparisonDocumentLimitError();

      try {
        return await prisma.comparison_documents.create({
          data: {
            workspaceId: Number(workspaceId),
            threadId: Number(threadId),
            userId: userId == null ? null : Number(userId),
            slot,
            status: "indexing",
            originalFilename: String(originalFilename),
            tokenCount: Number(tokenCount) || 0,
            pageCount: pageCount == null ? null : Number(pageCount),
            parsedFileId: Number(parsedFileId),
          },
        });
      } catch (error) {
        if (error?.code !== "P2002") throw error;

        const sameFile = await this.get({ parsedFileId: Number(parsedFileId) });
        if (sameFile) return sameFile;
      }
    }

    throw new ComparisonDocumentLimitError();
  },

  serialize: function (document = null) {
    if (!document) return null;
    return {
      id: document.id,
      slot: document.slot,
      status: document.status,
      originalFilename: document.originalFilename,
      tokenCount: document.tokenCount ?? 0,
      pageCount: document.pageCount ?? null,
      parsedFileId: document.parsedFileId ?? null,
      workspaceDocumentId: document.workspaceDocumentId ?? null,
      docId: document.workspaceDocument?.docId ?? document.docId ?? null,
      location: document.workspaceDocument?.docpath ?? document.docpath ?? null,
      docpath: document.workspaceDocument?.docpath ?? document.docpath ?? null,
      error: document.error ?? null,
    };
  },
};

module.exports = {
  ComparisonDocument,
  ComparisonDocumentLimitError,
  COMPARISON_DOCUMENT_SLOTS,
  COMPARISON_DOCUMENT_STATUSES,
};
