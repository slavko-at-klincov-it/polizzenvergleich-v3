const prisma = require("../utils/prisma");
const { v4: uuidv4 } = require("uuid");
const { safeJsonParse } = require("../utils/http");
const {
  PRODUCT_PROFILE,
} = require("../utils/policyComparison/productContract");
const {
  DEFAULT_POLICY_COMPARISON_MODE,
  POLICY_COMPARISON_MODE,
  normalizePolicyComparisonMode,
  policyComparisonMode,
} = require("../utils/policyComparison/modes");
const {
  LF_REFERENCE_PROFILE,
} = require("../utils/policyComparison/lfReferenceProfile");

const SIDES = Object.freeze(["A", "B"]);
const DOCUMENT_ROLES = Object.freeze([
  "MAIN_POLICY",
  "SUPPLEMENT",
  "ENDORSEMENT",
  "TERMS",
  "OTHER",
]);
const DOCUMENT_STATUSES = Object.freeze([
  "ACTIVE",
  "FRAMEWORK_TERMS",
  "PROPOSAL",
]);
const LOCKED_STATUSES = Object.freeze(["QUEUED", "RUNNING"]);
const MAX_DOCUMENTS_PER_SIDE = 9;

function publicDocument(document) {
  return {
    uuid: document.uuid,
    side: document.side,
    role: document.role,
    documentStatus: document.documentStatus,
    originalName: document.originalName,
    mimeType: document.mimeType,
    byteSize: document.byteSize,
    sha256: document.sha256,
    position: document.position,
    createdAt: document.createdAt,
    lastUpdatedAt: document.lastUpdatedAt,
  };
}

function publicSession(session) {
  const documents = Array.isArray(session?.documents)
    ? session.documents.map(publicDocument)
    : [];
  return {
    uuid: session.uuid,
    status: session.status,
    progress: safeJsonParse(session.progress, null),
    error: session.error,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    createdAt: session.createdAt,
    lastUpdatedAt: session.lastUpdatedAt,
    resultAvailable: Boolean(session.resultPath),
    comparisonMode: normalizePolicyComparisonMode(session.comparisonMode),
    documents,
    counts: {
      A: documents.filter(({ side }) => side === "A").length,
      B: documents.filter(({ side }) => side === "B").length,
    },
    limits: (() => {
      const mode = policyComparisonMode(session.comparisonMode);
      return {
        perSide: MAX_DOCUMENTS_PER_SIDE,
        A: mode.maxDocumentsA,
        B: mode.maxDocumentsB,
      };
    })(),
  };
}

const includeDocuments = {
  documents: { orderBy: [{ side: "asc" }, { position: "asc" }] },
};

const PolicyComparison = {
  SIDES,
  DOCUMENT_ROLES,
  DOCUMENT_STATUSES,
  LOCKED_STATUSES,
  MAX_DOCUMENTS_PER_SIDE,
  publicDocument,
  publicSession,

  async getForScope({ workspaceId, ownerKey, conversationKey }) {
    return prisma.policy_comparison_sessions.findFirst({
      where: { workspaceId, ownerKey, conversationKey },
      include: includeDocuments,
    });
  },

  async getOrCreate({
    workspaceId,
    userId = null,
    threadId = null,
    ownerKey,
    conversationKey,
    comparisonMode = DEFAULT_POLICY_COMPARISON_MODE,
  }) {
    const where = { workspaceId, ownerKey, conversationKey };
    const existing = await prisma.policy_comparison_sessions.findFirst({
      where,
      include: includeDocuments,
    });
    if (existing) return existing;

    try {
      return await prisma.policy_comparison_sessions.create({
        data: {
          uuid: uuidv4(),
          workspaceId,
          userId,
          threadId,
          ownerKey,
          conversationKey,
          comparisonMode: normalizePolicyComparisonMode(comparisonMode),
        },
        include: includeDocuments,
      });
    } catch (error) {
      // Two initial GETs can race. The unique scope is authoritative.
      if (error?.code !== "P2002") throw error;
      return prisma.policy_comparison_sessions.findFirst({
        where,
        include: includeDocuments,
      });
    }
  },

  async getOwned({ uuid, workspaceId, ownerKey, conversationKey }) {
    return prisma.policy_comparison_sessions.findFirst({
      where: { uuid, workspaceId, ownerKey, conversationKey },
      include: includeDocuments,
    });
  },

  async addDocument({
    session,
    side,
    role,
    documentStatus,
    originalName,
    storedName,
    storagePath,
    mimeType,
    byteSize,
    sha256,
  }) {
    if (!SIDES.includes(side)) throw new Error("INVALID_COMPARISON_SIDE");
    if (!DOCUMENT_ROLES.includes(role))
      throw new Error("INVALID_DOCUMENT_ROLE");
    if (!DOCUMENT_STATUSES.includes(documentStatus))
      throw new Error("INVALID_DOCUMENT_STATUS");
    if (LOCKED_STATUSES.includes(session.status))
      throw new Error("COMPARISON_SESSION_LOCKED");

    return prisma.$transaction(async (tx) => {
      const currentSession = await tx.policy_comparison_sessions.findUnique({
        where: { id: session.id },
      });
      if (!currentSession || LOCKED_STATUSES.includes(currentSession.status))
        throw new Error("COMPARISON_SESSION_LOCKED");

      const existingCount = await tx.policy_comparison_documents.count({
        where: { sessionId: session.id, side },
      });
      const mode = policyComparisonMode(currentSession.comparisonMode);
      const sideLimit = side === "A" ? mode.maxDocumentsA : mode.maxDocumentsB;
      if (existingCount >= sideLimit)
        throw new Error("COMPARISON_SIDE_LIMIT_REACHED");

      const document = await tx.policy_comparison_documents.create({
        data: {
          uuid: uuidv4(),
          sessionId: session.id,
          side,
          role,
          documentStatus,
          originalName,
          storedName,
          storagePath,
          mimeType,
          byteSize,
          sha256,
          position: existingCount,
        },
      });
      await tx.policy_comparison_sessions.update({
        where: { id: session.id },
        data: {
          status: "DRAFT",
          progress: null,
          inputManifest: null,
          resultPath: null,
          error: null,
          workerPid: null,
          cancelRequested: false,
          startedAt: null,
          completedAt: null,
          lastUpdatedAt: new Date(),
        },
      });
      return document;
    });
  },

  async updateDocument({ session, documentUuid, role, documentStatus }) {
    if (LOCKED_STATUSES.includes(session.status))
      throw new Error("COMPARISON_SESSION_LOCKED");
    if (role !== undefined && !DOCUMENT_ROLES.includes(role))
      throw new Error("INVALID_DOCUMENT_ROLE");
    if (
      documentStatus !== undefined &&
      !DOCUMENT_STATUSES.includes(documentStatus)
    )
      throw new Error("INVALID_DOCUMENT_STATUS");
    if (role === undefined && documentStatus === undefined)
      throw new Error("NO_DOCUMENT_CHANGES");

    const document = await prisma.policy_comparison_documents.findFirst({
      where: { uuid: documentUuid, sessionId: session.id },
    });
    if (!document) return null;
    return prisma.$transaction(async (tx) => {
      const updated = await tx.policy_comparison_documents.update({
        where: { id: document.id },
        data: {
          ...(role !== undefined ? { role } : {}),
          ...(documentStatus !== undefined ? { documentStatus } : {}),
          lastUpdatedAt: new Date(),
        },
      });
      await tx.policy_comparison_sessions.update({
        where: { id: session.id },
        data: {
          status: "DRAFT",
          progress: null,
          inputManifest: null,
          resultPath: null,
          error: null,
          workerPid: null,
          cancelRequested: false,
          startedAt: null,
          completedAt: null,
          lastUpdatedAt: new Date(),
        },
      });
      return updated;
    });
  },

  async removeDocument({ session, documentUuid }) {
    if (LOCKED_STATUSES.includes(session.status))
      throw new Error("COMPARISON_SESSION_LOCKED");
    return prisma.$transaction(async (tx) => {
      const document = await tx.policy_comparison_documents.findFirst({
        where: { uuid: documentUuid, sessionId: session.id },
      });
      if (!document) return null;
      await tx.policy_comparison_documents.delete({
        where: { id: document.id },
      });
      const remaining = await tx.policy_comparison_documents.findMany({
        where: { sessionId: session.id, side: document.side },
        orderBy: { position: "asc" },
      });
      for (const [position, item] of remaining.entries()) {
        if (item.position === position) continue;
        await tx.policy_comparison_documents.update({
          where: { id: item.id },
          data: { position, lastUpdatedAt: new Date() },
        });
      }
      await tx.policy_comparison_sessions.update({
        where: { id: session.id },
        data: {
          status: "DRAFT",
          progress: null,
          inputManifest: null,
          resultPath: null,
          error: null,
          workerPid: null,
          cancelRequested: false,
          startedAt: null,
          completedAt: null,
          lastUpdatedAt: new Date(),
        },
      });
      return document;
    });
  },

  async reset(session) {
    if (LOCKED_STATUSES.includes(session.status))
      throw new Error("COMPARISON_SESSION_LOCKED");
    return prisma.$transaction(async (tx) => {
      const documents = await tx.policy_comparison_documents.findMany({
        where: { sessionId: session.id },
      });
      await tx.policy_comparison_documents.deleteMany({
        where: { sessionId: session.id },
      });
      const updated = await tx.policy_comparison_sessions.update({
        where: { id: session.id },
        data: {
          status: "DRAFT",
          progress: null,
          inputManifest: null,
          resultPath: null,
          error: null,
          workerPid: null,
          cancelRequested: false,
          startedAt: null,
          completedAt: null,
          lastUpdatedAt: new Date(),
        },
      });
      return { session: updated, documents };
    });
  },

  async queue(session) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.policy_comparison_sessions.findUnique({
        where: { id: session.id },
        include: includeDocuments,
      });
      if (!current) throw new Error("COMPARISON_SESSION_NOT_FOUND");
      if (LOCKED_STATUSES.includes(current.status))
        throw new Error("COMPARISON_SESSION_LOCKED");
      const countA = current.documents.filter(
        ({ side }) => side === "A"
      ).length;
      const countB = current.documents.filter(
        ({ side }) => side === "B"
      ).length;
      if (countA === 0 || countB === 0)
        throw new Error("COMPARISON_BOTH_SIDES_REQUIRED");
      const comparisonMode = normalizePolicyComparisonMode(
        current.comparisonMode
      );
      if (
        comparisonMode === POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B &&
        countA !== 1
      )
        throw new Error("COMPARISON_REFERENCE_EXACTLY_ONE_A_REQUIRED");
      if (
        comparisonMode === POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B &&
        current.documents.find(({ side }) => side === "A")?.sha256 !==
          LF_REFERENCE_PROFILE.sourceProduct.documentSha256
      )
        throw new Error("COMPARISON_REFERENCE_LF_DOCUMENT_REQUIRED");
      const inputManifest = {
        schemaVersion: 3,
        sessionUuid: current.uuid,
        queuedAt: new Date().toISOString(),
        comparisonMode,
        productProfile:
          comparisonMode === POLICY_COMPARISON_MODE.SYMMETRIC_A_B
            ? PRODUCT_PROFILE
            : LF_REFERENCE_PROFILE,
        documents: current.documents.map((document) => ({
          uuid: document.uuid,
          side: document.side,
          role: document.role,
          documentStatus: document.documentStatus,
          originalName: document.originalName,
          storagePath: document.storagePath,
          sha256: document.sha256,
          position: document.position,
        })),
      };
      const progress = {
        phase: "QUEUED",
        completedDocuments: 0,
        totalDocuments: current.documents.length,
        currentDocument: null,
      };
      const queued = await tx.policy_comparison_sessions.update({
        where: { id: current.id },
        data: {
          status: "QUEUED",
          progress: JSON.stringify(progress),
          inputManifest: JSON.stringify(inputManifest),
          resultPath: null,
          error: null,
          workerPid: null,
          cancelRequested: false,
          startedAt: null,
          completedAt: null,
          lastUpdatedAt: new Date(),
        },
      });
      return { session: queued, inputManifest };
    });
  },

  async markFailed(sessionId, error) {
    return prisma.policy_comparison_sessions.updateMany({
      where: { id: sessionId, status: { not: "CANCELLED" } },
      data: {
        status: "FAILED",
        error: String(error || "Comparison failed"),
        workerPid: null,
        completedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });
  },

  async setWorkerPid(sessionId, workerPid) {
    return prisma.policy_comparison_sessions.update({
      where: { id: sessionId },
      data: { workerPid, lastUpdatedAt: new Date() },
    });
  },

  async cancel(session) {
    if (!LOCKED_STATUSES.includes(session.status))
      throw new Error("COMPARISON_SESSION_NOT_RUNNING");
    const result = await prisma.policy_comparison_sessions.updateMany({
      where: { id: session.id, status: { in: LOCKED_STATUSES } },
      data: {
        status: "CANCELLED",
        cancelRequested: true,
        workerPid: null,
        error: null,
        completedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });
    if (result.count !== 1) throw new Error("COMPARISON_SESSION_NOT_RUNNING");
    return prisma.policy_comparison_sessions.findUnique({
      where: { id: session.id },
      include: includeDocuments,
    });
  },
};

module.exports = { PolicyComparison };
