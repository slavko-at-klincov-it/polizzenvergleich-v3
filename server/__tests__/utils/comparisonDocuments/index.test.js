const fs = require("fs");
const prisma = require("../../../utils/prisma");
const {
  ComparisonDocument,
} = require("../../../models/comparisonDocument");
const {
  WorkspaceParsedFiles,
} = require("../../../models/workspaceParsedFiles");
const { DocumentVectors } = require("../../../models/vectors");
const { getVectorDbClass } = require("../../../utils/helpers");
const {
  runComparisonDocumentLifecycleHooks,
} = require("../../../utils/comparisonDocuments/lifecycleHooks");

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));
jest.mock("uuid", () => ({ v4: jest.fn(() => "new-doc-id") }));
jest.mock("../../../utils/prisma", () => ({
  workspace_documents: {
    create: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
  },
  comparison_documents: { update: jest.fn() },
  workspace_parsed_files: { delete: jest.fn() },
  workspaces: { findFirst: jest.fn() },
  $transaction: jest.fn(async (operations) => Promise.all(operations)),
}));
jest.mock("../../../models/comparisonDocument", () => ({
  ComparisonDocument: {
    reserve: jest.fn(),
    forThread: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
    where: jest.fn(),
    delete: jest.fn(),
    serialize: jest.fn((document) => ({
      id: document.id,
      slot: document.slot,
      status: document.status,
      originalFilename: document.originalFilename,
      tokenCount: document.tokenCount ?? 0,
      pageCount: document.pageCount ?? null,
      workspaceDocumentId: document.workspaceDocumentId ?? null,
      docId: document.workspaceDocument?.docId ?? document.docId ?? null,
      location: document.workspaceDocument?.docpath ?? document.docpath ?? null,
      docpath: document.workspaceDocument?.docpath ?? document.docpath ?? null,
      error: document.error ?? null,
    })),
  },
  ComparisonDocumentLimitError: class ComparisonDocumentLimitError extends Error {},
}));
jest.mock("../../../models/workspaceParsedFiles", () => ({
  WorkspaceParsedFiles: {
    get: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock("../../../models/vectors", () => ({
  DocumentVectors: { delete: jest.fn() },
}));
jest.mock("../../../utils/helpers", () => ({
  getVectorDbClass: jest.fn(),
}));
jest.mock("../../../utils/files", () => ({
  directUploadsPath: "/direct-uploads",
  documentsPath: "/documents",
  purgeSourceDocument: jest.fn(),
  purgeVectorCache: jest.fn(),
}));
jest.mock("../../../utils/comparisonDocuments/lifecycleHooks", () => ({
  runComparisonDocumentLifecycleHooks: jest.fn(),
}));

const {
  ComparisonDocumentService,
} = require("../../../utils/comparisonDocuments");

const workspace = { id: 1, slug: "policies" };
const thread = { id: 2, workspace_id: 1 };
const user = { id: 3 };
const parsedFile = {
  id: 4,
  workspaceId: 1,
  threadId: 2,
  userId: 3,
  filename: "fallback-name.json",
  tokenCountEstimate: 456,
  metadata: JSON.stringify({
    location: "parsed-a.json",
    title: "Polizze A.pdf",
    pdf: { totalPages: 30 },
  }),
};
const reservation = {
  id: 5,
  workspaceId: 1,
  threadId: 2,
  userId: 3,
  slot: "A",
  status: "indexing",
  originalFilename: "Polizze A.pdf",
  tokenCount: 456,
  pageCount: 30,
  parsedFileId: 4,
};

describe("ComparisonDocumentService", () => {
  const VectorDb = {
    addDocumentToNamespace: jest.fn(),
    deleteDocumentFromNamespace: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(
      JSON.stringify({
        title: "Polizze A.pdf",
        pageContent: "Versicherung mit Selbstbehalt.",
        pdfExtraction: {
          complete: true,
          sourceSha256: "a".repeat(64),
          totalPages: 1,
          pages: [
            {
              pageNumber: 1,
              start: 0,
              end: "Versicherung mit Selbstbehalt.".length,
              method: "native",
              status: "ok",
            },
          ],
        },
      })
    );
    WorkspaceParsedFiles.get.mockResolvedValue(parsedFile);
    WorkspaceParsedFiles.delete.mockResolvedValue(true);
    ComparisonDocument.reserve.mockResolvedValue(reservation);
    ComparisonDocument.update.mockImplementation(async (_id, data) => ({
      ...reservation,
      ...data,
    }));
    ComparisonDocument.delete.mockResolvedValue({ count: 1 });
    getVectorDbClass.mockReturnValue(VectorDb);
    VectorDb.addDocumentToNamespace.mockResolvedValue({
      vectorized: true,
      error: null,
    });
    VectorDb.deleteDocumentFromNamespace.mockResolvedValue(true);
    DocumentVectors.delete.mockResolvedValue(true);
    prisma.workspace_documents.create.mockResolvedValue({
      id: 6,
      docId: "new-doc-id",
      docpath: "custom-documents/parsed-a.json",
      workspaceId: 1,
    });
    prisma.workspace_documents.deleteMany.mockResolvedValue({ count: 1 });
    prisma.comparison_documents.update.mockResolvedValue({
      ...reservation,
      status: "ready",
      workspaceDocumentId: 6,
      docId: "new-doc-id",
      docpath: "custom-documents/parsed-a.json",
      workspaceDocument: {
        id: 6,
        docId: "new-doc-id",
        docpath: "custom-documents/parsed-a.json",
      },
    });
    prisma.workspace_parsed_files.delete.mockResolvedValue(parsedFile);
    runComparisonDocumentLifecycleHooks.mockResolvedValue(undefined);
  });

  it("embeds, commits the ready mapping and removes the parsed retry source", async () => {
    const document = await ComparisonDocumentService.embedParsedFile({
      workspace,
      thread,
      user,
      parsedFileId: parsedFile.id,
    });

    expect(ComparisonDocument.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 1,
        threadId: 2,
        userId: 3,
        parsedFileId: 4,
        originalFilename: "Polizze A.pdf",
        tokenCount: 456,
        pageCount: 30,
      })
    );
    expect(VectorDb.addDocumentToNamespace).toHaveBeenCalledWith(
      "policies",
      expect.objectContaining({ docId: "new-doc-id" }),
      "custom-documents/parsed-a.json"
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(fs.unlinkSync).toHaveBeenCalledWith("/direct-uploads/parsed-a.json");
    expect(document).toEqual(
      expect.objectContaining({
        id: 5,
        slot: "A",
        status: "ready",
        workspaceDocumentId: 6,
        docId: "new-doc-id",
      })
    );
  });

  it("coalesces duplicate embed requests for the same parsed file", async () => {
    let releaseVector;
    VectorDb.addDocumentToNamespace.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseVector = () => resolve({ vectorized: true, error: null });
        })
    );
    const args = { workspace, thread, user, parsedFileId: parsedFile.id };
    const first = ComparisonDocumentService.embedParsedFile(args);
    const second = ComparisonDocumentService.embedParsedFile(args);
    while (!releaseVector)
      await new Promise((resolve) => setImmediate(resolve));
    expect(WorkspaceParsedFiles.get).toHaveBeenCalledTimes(1);
    releaseVector();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(VectorDb.addDocumentToNamespace).toHaveBeenCalledTimes(1);
    expect(ComparisonDocument.reserve).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual(secondResult);
  });

  it("rolls back vector artifacts and keeps the parsed file when embedding fails", async () => {
    VectorDb.addDocumentToNamespace.mockResolvedValue({
      vectorized: false,
      error: "embedder offline",
    });

    await expect(
      ComparisonDocumentService.embedParsedFile({
        workspace,
        thread,
        user,
        parsedFileId: parsedFile.id,
      })
    ).rejects.toThrow("embedder offline");

    expect(prisma.workspace_parsed_files.delete).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalledWith(
      "/direct-uploads/parsed-a.json"
    );
    expect(VectorDb.deleteDocumentFromNamespace).toHaveBeenCalledWith(
      "policies",
      "new-doc-id"
    );
    expect(ComparisonDocument.update).toHaveBeenLastCalledWith(
      5,
      expect.objectContaining({ status: "failed", error: "embedder offline" })
    );
  });

  it("rejects non-PDF parsed files before reserving a comparison slot", async () => {
    WorkspaceParsedFiles.get.mockResolvedValue({
      ...parsedFile,
      metadata: JSON.stringify({
        location: "conditions.json",
        title: "conditions.docx",
      }),
    });

    await expect(
      ComparisonDocumentService.embedParsedFile({
        workspace,
        thread,
        user,
        parsedFileId: parsedFile.id,
      })
    ).rejects.toMatchObject({ statusCode: 415 });
    expect(ComparisonDocument.reserve).not.toHaveBeenCalled();
  });

  it("fails closed before embedding when the canonical page map is incomplete", async () => {
    fs.readFileSync.mockReturnValue(
      JSON.stringify({
        title: "Polizze A.pdf",
        pageContent: "Unvollständiger Text",
        pdfExtraction: { complete: false, pages: [] },
      })
    );

    await expect(
      ComparisonDocumentService.embedParsedFile({
        workspace,
        thread,
        user,
        parsedFileId: parsedFile.id,
      })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(VectorDb.addDocumentToNamespace).not.toHaveBeenCalled();
  });

  it("rolls back a created workspace document when a retrieval hook fails", async () => {
    runComparisonDocumentLifecycleHooks.mockImplementation(
      async (event) => {
        if (event === "afterEmbedded") throw new Error("FTS unavailable");
      }
    );

    await expect(
      ComparisonDocumentService.embedParsedFile({
        workspace,
        thread,
        user,
        parsedFileId: parsedFile.id,
      })
    ).rejects.toThrow("FTS unavailable");

    expect(prisma.workspace_parsed_files.delete).not.toHaveBeenCalled();
    expect(prisma.workspace_documents.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 1, docId: "new-doc-id" },
    });
  });

  it("removes all persisted artifacts before deleting a comparison record", async () => {
    const readyRecord = {
      ...reservation,
      status: "ready",
      parsedFileId: null,
      workspaceDocumentId: 6,
      docId: "new-doc-id",
      docpath: "custom-documents/parsed-a.json",
    };
    ComparisonDocument.get.mockResolvedValue(readyRecord);
    prisma.workspace_documents.findFirst.mockResolvedValue({
      id: 6,
      docId: "new-doc-id",
      docpath: "custom-documents/parsed-a.json",
    });

    await ComparisonDocumentService.remove({
      workspace,
      thread,
      user,
      id: readyRecord.id,
    });

    expect(VectorDb.deleteDocumentFromNamespace).toHaveBeenCalledWith(
      "policies",
      "new-doc-id"
    );
    expect(DocumentVectors.delete).toHaveBeenCalledWith({
      docId: "new-doc-id",
    });
    expect(ComparisonDocument.delete).toHaveBeenCalledWith({ id: 5 });
  });
});
