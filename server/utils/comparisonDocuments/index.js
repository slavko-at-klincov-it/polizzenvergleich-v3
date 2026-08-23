const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const prisma = require("../prisma");
const {
  ComparisonDocument,
  ComparisonDocumentLimitError,
} = require("../../models/comparisonDocument");
const { WorkspaceParsedFiles } = require("../../models/workspaceParsedFiles");
const { DocumentVectors } = require("../../models/vectors");
const { getVectorDbClass } = require("../helpers");
const {
  directUploadsPath,
  documentsPath,
  purgeSourceDocument,
  purgeVectorCache,
} = require("../files");
const { safeJsonParse } = require("../http");
const { PageAwareTextSplitter } = require("../PageAwareTextSplitter");
const { runComparisonDocumentLifecycleHooks } = require("./lifecycleHooks");

class ComparisonDocumentError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "ComparisonDocumentError";
    this.statusCode = statusCode;
  }
}

const embedOperations = new Map();

function pageCountFromMetadata(metadata = {}) {
  const candidates = [
    metadata.pageCount,
    metadata.totalPages,
    metadata.extraction?.totalPages,
    metadata.pdfExtraction?.totalPages,
    metadata.pdf?.totalPages,
    Array.isArray(metadata.pageMap) ? metadata.pageMap.length : null,
    Array.isArray(metadata.pages) ? metadata.pages.length : null,
  ];
  const count = candidates.find(
    (candidate) => Number.isInteger(Number(candidate)) && Number(candidate) > 0
  );
  return count == null ? null : Number(count);
}

function parsedFileMetadata(parsedFile) {
  return safeJsonParse(parsedFile?.metadata, {});
}

function sourcePathForParsedFile(parsedFile) {
  const metadata = parsedFileMetadata(parsedFile);
  if (!metadata.location)
    throw new ComparisonDocumentError(
      "Parsed file has no storage location.",
      400
    );
  return path.join(directUploadsPath, path.basename(metadata.location));
}

function docpathForParsedFile(parsedFile) {
  const metadata = parsedFileMetadata(parsedFile);
  if (!metadata.location)
    throw new ComparisonDocumentError(
      "Parsed file has no storage location.",
      400
    );
  return `custom-documents/${path.basename(metadata.location)}`;
}

function validateCanonicalPdf(documentData) {
  const extraction = documentData?.pdfExtraction;
  if (
    extraction?.complete !== true ||
    !/^[a-f0-9]{64}$/iu.test(String(extraction?.sourceSha256 || "").trim())
  )
    throw new ComparisonDocumentError(
      "PDF extraction is incomplete or has no source hash.",
      422
    );
  const pages = PageAwareTextSplitter.extractionPages(documentData);
  const expectedPages = Number(extraction.totalPages);
  if (
    !Array.isArray(pages) ||
    pages.length === 0 ||
    !Number.isInteger(expectedPages) ||
    expectedPages !== pages.length ||
    pages.some((page, index) => page.pageNumber !== index + 1)
  )
    throw new ComparisonDocumentError(
      "PDF page map is incomplete or not contiguous.",
      422
    );
  return pages;
}

async function removeWorkspaceDocumentArtifacts({
  comparisonDocument,
  workspace,
  workspaceDocument = null,
}) {
  const VectorDb = getVectorDbClass();
  const docId = workspaceDocument?.docId ?? comparisonDocument?.docId ?? null;
  const docpath =
    workspaceDocument?.docpath ?? comparisonDocument?.docpath ?? null;

  await runComparisonDocumentLifecycleHooks("beforeRemoved", {
    comparisonDocument,
    workspaceDocument,
    workspace,
  });

  if (docId) {
    await VectorDb.deleteDocumentFromNamespace(workspace.slug, docId);
    await DocumentVectors.delete({ docId });
    await prisma.workspace_documents.deleteMany({
      where: { workspaceId: workspace.id, docId },
    });
  } else if (workspaceDocument?.id) {
    await prisma.workspace_documents.deleteMany({
      where: { id: workspaceDocument.id, workspaceId: workspace.id },
    });
  }

  if (docpath) {
    await purgeVectorCache(docpath);
    await purgeSourceDocument(docpath);
  }
}

async function rollbackEmbed({
  comparisonDocument,
  workspace,
  workspaceDocument,
  targetDocpath,
}) {
  try {
    await removeWorkspaceDocumentArtifacts({
      comparisonDocument: {
        ...comparisonDocument,
        docId: workspaceDocument?.docId ?? comparisonDocument?.docId,
        docpath: targetDocpath ?? comparisonDocument?.docpath,
      },
      workspace,
      workspaceDocument,
    });
    return true;
  } catch (rollbackError) {
    console.error("Comparison document rollback failed:", rollbackError);
    return false;
  }
}

const ComparisonDocumentService = {
  list: async function ({ workspace, thread, user = null }) {
    const documents = await ComparisonDocument.forThread({
      workspaceId: workspace.id,
      threadId: thread.id,
      userId: user?.id ?? null,
    });
    return documents.map(ComparisonDocument.serialize);
  },

  embedParsedFile: async function (args) {
    const key = [
      args?.workspace?.id,
      args?.thread?.id,
      args?.user?.id ?? "anonymous",
      Number(args?.parsedFileId),
    ].join(":");
    const existing = embedOperations.get(key);
    if (existing) return existing;
    const operation = this._embedParsedFile(args).finally(() => {
      if (embedOperations.get(key) === operation) embedOperations.delete(key);
    });
    embedOperations.set(key, operation);
    return operation;
  },

  _embedParsedFile: async function ({
    workspace,
    thread,
    user = null,
    parsedFileId,
  }) {
    const parsedFile = await WorkspaceParsedFiles.get({
      id: Number(parsedFileId),
      workspaceId: workspace.id,
      threadId: thread.id,
      userId: user?.id ?? null,
    });
    if (!parsedFile)
      throw new ComparisonDocumentError(
        "Parsed file was not found in this comparison thread.",
        404
      );

    const metadata = parsedFileMetadata(parsedFile);
    const sourcePath = sourcePathForParsedFile(parsedFile);
    if (!fs.existsSync(sourcePath))
      throw new ComparisonDocumentError(
        "Parsed source file was not found.",
        404
      );

    const originalFilename =
      metadata.originalFilename || metadata.title || parsedFile.filename;
    if (path.extname(String(originalFilename)).toLowerCase() !== ".pdf")
      throw new ComparisonDocumentError(
        "Only PDF files can be added to a policy comparison.",
        415
      );
    const comparisonDocument = await ComparisonDocument.reserve({
      workspaceId: workspace.id,
      threadId: thread.id,
      userId: user?.id ?? null,
      parsedFileId: parsedFile.id,
      originalFilename,
      tokenCount: parsedFile.tokenCountEstimate ?? 0,
      pageCount: pageCountFromMetadata(metadata),
    });
    if (comparisonDocument.status === "ready")
      return ComparisonDocument.serialize(comparisonDocument);

    const targetDocpath = docpathForParsedFile(parsedFile);
    const targetPath = path.join(documentsPath, targetDocpath);
    const targetDirectory = path.dirname(targetPath);
    let workspaceDocument = null;
    let docId = null;

    try {
      if (comparisonDocument.docId || comparisonDocument.workspaceDocumentId) {
        const staleWorkspaceDocument = comparisonDocument.workspaceDocumentId
          ? await prisma.workspace_documents.findFirst({
              where: {
                id: comparisonDocument.workspaceDocumentId,
                workspaceId: workspace.id,
              },
            })
          : null;
        await removeWorkspaceDocumentArtifacts({
          comparisonDocument,
          workspace,
          workspaceDocument: staleWorkspaceDocument,
        });
      }

      if (!fs.existsSync(targetDirectory))
        fs.mkdirSync(targetDirectory, { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);

      const data = safeJsonParse(fs.readFileSync(targetPath, "utf8"), null);
      if (!data?.pageContent)
        throw new ComparisonDocumentError(
          "Parsed document contains no text content.",
          422
        );
      validateCanonicalPdf(data);

      docId = uuidv4();
      await ComparisonDocument.update(comparisonDocument.id, {
        status: "indexing",
        error: null,
        docId,
        docpath: targetDocpath,
        sourceSha256: data.pdfExtraction.sourceSha256.toLowerCase(),
        workspaceDocumentId: null,
      });

      const VectorDb = getVectorDbClass();
      const { vectorized, error } = await VectorDb.addDocumentToNamespace(
        workspace.slug,
        { ...data, docId },
        targetDocpath
      );
      if (!vectorized)
        throw new ComparisonDocumentError(
          error || "Document could not be embedded."
        );

      const {
        pageContent: _pageContent,
        pages: _pages,
        pageMap: _pageMap,
        pdfExtraction: _pdfExtraction,
        ...documentMetadata
      } = data;
      workspaceDocument = await prisma.workspace_documents.create({
        data: {
          docId,
          filename: path.basename(targetDocpath),
          docpath: targetDocpath,
          workspaceId: workspace.id,
          metadata: JSON.stringify(documentMetadata),
        },
      });

      const indexingRecord = {
        ...comparisonDocument,
        status: "indexing",
        docId,
        docpath: targetDocpath,
        workspaceDocumentId: workspaceDocument.id,
      };
      await runComparisonDocumentLifecycleHooks("afterEmbedded", {
        comparisonDocument: indexingRecord,
        workspaceDocument,
        workspace,
        documentData: data,
      });

      const [readyDocument] = await prisma.$transaction([
        prisma.comparison_documents.update({
          where: { id: comparisonDocument.id },
          data: {
            status: "ready",
            error: null,
            docId,
            docpath: targetDocpath,
            sourceSha256: data.pdfExtraction.sourceSha256.toLowerCase(),
            workspaceDocumentId: workspaceDocument.id,
            lastUpdatedAt: new Date(),
          },
          include: { workspaceDocument: true },
        }),
        prisma.workspace_parsed_files.delete({
          where: { id: parsedFile.id },
        }),
      ]);

      try {
        fs.unlinkSync(sourcePath);
      } catch (unlinkError) {
        console.warn(
          `Could not remove finalized parsed source ${sourcePath}:`,
          unlinkError.message
        );
      }
      return ComparisonDocument.serialize(readyDocument);
    } catch (error) {
      const rolledBack = await rollbackEmbed({
        comparisonDocument: { ...comparisonDocument, docId },
        workspace,
        workspaceDocument,
        targetDocpath,
      });
      await ComparisonDocument.update(comparisonDocument.id, {
        status: "failed",
        error: error.message,
        ...(rolledBack
          ? { docId: null, docpath: null, workspaceDocumentId: null }
          : { docId, docpath: targetDocpath }),
      });
      if (error instanceof ComparisonDocumentError) throw error;
      throw new ComparisonDocumentError(error.message);
    }
  },

  remove: async function ({ workspace, thread, user = null, id }) {
    const comparisonDocument = await ComparisonDocument.get({
      id: Number(id),
      workspaceId: workspace.id,
      threadId: thread.id,
      userId: user?.id ?? null,
    });
    if (!comparisonDocument)
      throw new ComparisonDocumentError(
        "Comparison document was not found in this thread.",
        404
      );

    await ComparisonDocument.update(comparisonDocument.id, {
      status: "deleting",
      error: null,
    });

    const workspaceDocument = comparisonDocument.workspaceDocumentId
      ? await prisma.workspace_documents.findFirst({
          where: {
            id: comparisonDocument.workspaceDocumentId,
            workspaceId: workspace.id,
          },
        })
      : null;
    await removeWorkspaceDocumentArtifacts({
      comparisonDocument,
      workspace,
      workspaceDocument,
    });

    if (comparisonDocument.parsedFileId) {
      const parsedFile = await WorkspaceParsedFiles.get({
        id: comparisonDocument.parsedFileId,
        workspaceId: workspace.id,
        threadId: thread.id,
        userId: user?.id ?? null,
      });
      if (parsedFile) {
        const parsedSource = sourcePathForParsedFile(parsedFile);
        if (fs.existsSync(parsedSource)) fs.unlinkSync(parsedSource);
        const parsedDeleted = await WorkspaceParsedFiles.delete({
          id: parsedFile.id,
          workspaceId: workspace.id,
          threadId: thread.id,
          userId: user?.id ?? null,
        });
        if (!parsedDeleted)
          throw new ComparisonDocumentError(
            "Parsed comparison file could not be deleted."
          );
      }
    }

    await ComparisonDocument.delete({ id: comparisonDocument.id });
    return true;
  },

  cleanupThread: async function ({ workspace, thread, user = null }) {
    const documents = await ComparisonDocument.where(
      {
        workspaceId: workspace.id,
        threadId: thread.id,
        ...(user ? { userId: user.id } : {}),
      },
      null
    );
    for (const document of documents) {
      await this.remove({
        workspace,
        thread,
        user: user ?? (document.userId ? { id: document.userId } : null),
        id: document.id,
      });
    }
    return true;
  },

  cleanupThreads: async function (threads = []) {
    for (const thread of threads) {
      const workspace = await prisma.workspaces.findFirst({
        where: { id: thread.workspace_id },
      });
      if (!workspace) continue;
      await this.cleanupThread({ workspace, thread, user: null });
    }
    return true;
  },
};

module.exports = {
  ComparisonDocumentService,
  ComparisonDocumentError,
  ComparisonDocumentLimitError,
  pageCountFromMetadata,
  validateCanonicalPdf,
};
