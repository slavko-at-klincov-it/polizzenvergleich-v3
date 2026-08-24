const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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
const {
  comparisonDocumentExtension,
  isSupportedComparisonDocument,
} = require("./supportedFormats");

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

function canonicalizeComparisonDocument(documentData, originalFilename) {
  const extension = comparisonDocumentExtension(originalFilename);
  if (extension === ".pdf") {
    validateCanonicalPdf(documentData);
    return {
      data: documentData,
      sourceSha256: documentData.pdfExtraction.sourceSha256.toLowerCase(),
    };
  }

  const pageContent = String(documentData?.pageContent || "");
  if (!pageContent.trim())
    throw new ComparisonDocumentError(
      "Parsed document contains no text content.",
      422
    );
  const sourceSha256 = crypto
    .createHash("sha256")
    .update(pageContent, "utf8")
    .digest("hex");
  return {
    data: {
      ...documentData,
      documentExtraction: {
        schemaVersion: 1,
        complete: true,
        kind: extension.slice(1),
        sourceSha256,
      },
    },
    sourceSha256,
  };
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
    await this.reconcileParsedReservations({ workspace, thread, user });
    const documents = await ComparisonDocument.forThread({
      workspaceId: workspace.id,
      threadId: thread.id,
      userId: user?.id ?? null,
    });
    return documents.map(ComparisonDocument.serialize);
  },

  reconcileParsedReservations: async function ({
    workspace,
    thread,
    user = null,
  }) {
    const parsedFiles = await WorkspaceParsedFiles.where({
      workspaceId: workspace.id,
      threadId: thread.id,
      ...(user ? { userId: user.id } : {}),
    });
    for (const parsedFile of parsedFiles) {
      await this.reserveParsedFile({
        workspace,
        thread,
        user: user ?? (parsedFile.userId ? { id: parsedFile.userId } : null),
        parsedFile,
      });
    }
    return true;
  },

  removeParsedFile: async function ({
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
    const parsedSource = sourcePathForParsedFile(parsedFile);
    // Remove the customer payload before dropping its scoped DB handle. If the
    // filesystem operation fails, keeping the row lets the user retry cleanup
    // instead of creating an unreachable orphan file.
    if (fs.existsSync(parsedSource)) fs.unlinkSync(parsedSource);
    const deleted = await WorkspaceParsedFiles.delete({
      id: parsedFile.id,
      workspaceId: workspace.id,
      threadId: thread.id,
      userId: user?.id ?? null,
    });
    if (!deleted)
      throw new ComparisonDocumentError(
        "Parsed comparison file could not be deleted."
      );
    return true;
  },

  reserveParsedFile: async function ({
    workspace,
    thread,
    user = null,
    parsedFile,
    reactivateExisting = false,
  }) {
    if (!thread)
      throw new ComparisonDocumentError(
        "Comparison documents require a thread.",
        400
      );
    if (!parsedFile)
      throw new ComparisonDocumentError("Parsed file was not found.", 404);

    const metadata = parsedFileMetadata(parsedFile);
    const originalFilename =
      metadata.originalFilename || metadata.title || parsedFile.filename;
    if (
      !isSupportedComparisonDocument({
        filename: originalFilename,
        mime: metadata.mimeType || "",
      })
    )
      throw new ComparisonDocumentError(
        "Unterstützt werden PDF, DOCX, ODT, TXT, MD, CSV, XLSX und PPTX.",
        415
      );

    const extension = comparisonDocumentExtension(originalFilename);
    return ComparisonDocument.reserve({
      workspaceId: workspace.id,
      threadId: thread.id,
      userId: user?.id ?? null,
      parsedFileId: parsedFile.id,
      originalFilename,
      tokenCount: parsedFile.tokenCountEstimate ?? 0,
      // Only PDFs have a physical, page-aware extraction contract. Office
      // and plain-text metadata must never manufacture page citations.
      pageCount: extension === ".pdf" ? pageCountFromMetadata(metadata) : null,
      reactivateExisting,
    });
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
    const comparisonDocument = await this.reserveParsedFile({
      workspace,
      thread,
      user,
      parsedFile,
      reactivateExisting: true,
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

      let data = safeJsonParse(fs.readFileSync(targetPath, "utf8"), null);
      if (!data?.pageContent)
        throw new ComparisonDocumentError(
          "Parsed document contains no text content.",
          422
        );
      const canonical = canonicalizeComparisonDocument(data, originalFilename);
      data = canonical.data;
      if (comparisonDocumentExtension(originalFilename) !== ".pdf")
        fs.writeFileSync(targetPath, JSON.stringify(data), {
          encoding: "utf8",
          mode: 0o600,
        });

      docId = uuidv4();
      await ComparisonDocument.update(comparisonDocument.id, {
        status: "indexing",
        error: null,
        docId,
        docpath: targetDocpath,
        sourceSha256: canonical.sourceSha256,
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
        documentExtraction: _documentExtraction,
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
            sourceSha256: canonical.sourceSha256,
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
      // Lance and FTS are now durably ready. Inventory inference is an
      // independent, retryable phase: do not hold the upload response open and
      // never roll the successful base indexes back if the model times out or
      // returns invalid evidence. Retrieval reuses the same inventory
      // single-flight and remains closed until its manifest is ready.
      void runComparisonDocumentLifecycleHooks("afterReady", {
        comparisonDocument: readyDocument,
        workspaceDocument,
        workspace,
        documentData: data,
      }).catch((inventoryError) => {
        console.error(
          `[PolicyComparison] Basisindex für Dokument ${comparisonDocument.id} ist bereit; Inventar bleibt fehlgeschlagen und kann erneut erstellt werden:`,
          inventoryError.message
        );
      });
      return ComparisonDocument.serialize({
        ...readyDocument,
        // The afterReady hook starts immediately below, but its first DB write
        // is asynchronous. Keep the upload chip polling across that short gap.
        inventoryStatus: readyDocument.inventoryStatus ?? "building",
      });
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

    // A browser can disappear after parsing but before the embed request.
    // Those thread-scoped sources are still customer documents and must be
    // cleaned with the same fail-closed, file-before-row semantics.
    const remainingParsedFiles = await WorkspaceParsedFiles.where({
      workspaceId: workspace.id,
      threadId: thread.id,
      ...(user ? { userId: user.id } : {}),
    });
    for (const parsedFile of remainingParsedFiles) {
      await this.removeParsedFile({
        workspace,
        thread,
        user: user ?? (parsedFile.userId ? { id: parsedFile.userId } : null),
        parsedFileId: parsedFile.id,
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
  canonicalizeComparisonDocument,
};
