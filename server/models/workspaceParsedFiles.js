const prisma = require("../utils/prisma");
const { EventLogs } = require("./eventLogs");
const { Document } = require("./documents");
const { documentsPath, directUploadsPath } = require("../utils/files");
const { safeJsonParse } = require("../utils/http");
const fs = require("fs");
const path = require("path");

const WorkspaceParsedFiles = {
  create: async function ({
    filename,
    workspaceId,
    userId = null,
    threadId = null,
    metadata = null,
    tokenCountEstimate = 0,
  }) {
    try {
      const file = await prisma.workspace_parsed_files.create({
        data: {
          filename,
          workspaceId: parseInt(workspaceId),
          userId: userId ? parseInt(userId) : null,
          threadId: threadId ? parseInt(threadId) : null,
          metadata,
          tokenCountEstimate,
        },
      });

      await EventLogs.logEvent(
        "workspace_file_uploaded",
        {
          filename,
          workspaceId,
        },
        userId
      );

      return { file, error: null };
    } catch (error) {
      console.error("FAILED TO CREATE PARSED FILE RECORD.", error.message);
      return { file: null, error: error.message };
    }
  },

  /**
   * Gets a parsed file by its ID or a clause.
   * @param {object} clause - The clause to filter the parsed files.
   * @returns {Promise<import("@prisma/client").workspace_parsed_files | null>} The parsed file.
   */
  get: async function (clause = {}) {
    try {
      const file = await prisma.workspace_parsed_files.findFirst({
        where: clause,
      });
      return file;
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },

  where: async function (
    clause = {},
    limit = null,
    orderBy = null,
    select = null
  ) {
    try {
      const files = await prisma.workspace_parsed_files.findMany({
        where: clause,
        ...(limit !== null ? { take: limit } : {}),
        ...(orderBy !== null ? { orderBy } : {}),
        ...(select !== null ? { select } : {}),
      });
      return files;
    } catch (error) {
      console.error(error.message);
      return [];
    }
  },

  delete: async function (clause = {}) {
    try {
      const result = await prisma.workspace_parsed_files.deleteMany({
        where: clause,
      });
      return result.count > 0;
    } catch (error) {
      console.error(error.message);
      return false;
    }
  },

  totalTokenCount: async function (clause = {}) {
    const { _sum } = await prisma.workspace_parsed_files.aggregate({
      where: clause,
      _sum: { tokenCountEstimate: true },
    });
    return _sum.tokenCountEstimate || 0;
  },

  /**
   * Moves a parsed file to the documents and embeds it.
   * @param {import("@prisma/client").users | null} user - The user performing the operation.
   * @param {number} fileId - The ID of the parsed file.
   * @param {import("@prisma/client").workspaces} workspace - The workspace the file belongs to.
   * @returns {Promise<{ success: boolean, error: string | null, document: import("@prisma/client").workspace_documents | null }>} The result of the operation.
   */
  moveToDocumentsAndEmbed: async function (user = null, fileId, workspace) {
    let embeddedSuccessfully = false;
    let sourceFile = null;
    let targetPath = null;
    try {
      const parsedFile = await this.get({
        id: parseInt(fileId),
        ...(user ? { userId: user.id } : {}),
        workspaceId: workspace.id,
      });
      if (!parsedFile) throw new Error("File not found");

      // Get file location from metadata
      const metadata = safeJsonParse(parsedFile.metadata, {});
      const location = metadata.location;
      if (!location) throw new Error("No file location in metadata");

      // Get file from metadata location
      sourceFile = path.join(directUploadsPath, path.basename(location));
      if (!fs.existsSync(sourceFile)) throw new Error("Source file not found");

      // Move to custom-documents
      const customDocsPath = path.join(documentsPath, "custom-documents");
      if (!fs.existsSync(customDocsPath))
        fs.mkdirSync(customDocsPath, { recursive: true });

      // Copy the file to custom-documents
      targetPath = path.join(customDocsPath, path.basename(location));
      fs.copyFileSync(sourceFile, targetPath);

      const {
        failedToEmbed = [],
        errors = [],
        embedded = [],
      } = await Document.addDocuments(
        workspace,
        [`custom-documents/${path.basename(location)}`],
        parsedFile.userId
      );

      if (failedToEmbed.length > 0)
        throw new Error(errors[0] || "Failed to embed document");
      if (embedded.length !== 1)
        throw new Error("Document vector commit did not complete");

      const document = await Document.get({
        workspaceId: workspace.id,
        docpath: embedded[0],
      });
      if (!document)
        throw new Error("Embedded document record was not committed");

      embeddedSuccessfully = true;
      try {
        fs.unlinkSync(sourceFile);
      } catch (cleanupError) {
        console.warn(
          `Embedded document committed, but parsed source cleanup failed: ${cleanupError.message}`
        );
      }
      return { success: true, error: null, document };
    } catch (error) {
      console.error("Failed to move and embed file:", error);
      return { success: false, error: error.message, document: null };
    } finally {
      if (embeddedSuccessfully) {
        await this.delete({
          id: parseInt(fileId),
          ...(user ? { userId: user.id } : {}),
          workspaceId: workspace.id,
        });
      } else if (targetPath && fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    }
  },

  getContextMetadataAndLimits: async function (
    workspace,
    thread = null,
    user = null
  ) {
    try {
      if (!workspace) throw new Error("Workspace is required");
      const files = await this.where({
        workspaceId: workspace.id,
        threadId: thread?.id || null,
        ...(user ? { userId: user.id } : {}),
      });

      const results = [];
      let totalTokens = 0;

      for (const file of files) {
        const metadata = safeJsonParse(file.metadata, {});
        totalTokens += file.tokenCountEstimate || 0;
        results.push({
          id: file.id,
          title: metadata.title || metadata.location,
          location: metadata.location,
          token_count_estimate: file.tokenCountEstimate,
        });
      }

      return {
        files: results,
        contextWindow: workspace.contextWindow,
        currentContextTokenCount: totalTokens,
      };
    } catch (error) {
      console.error("Failed to get context metadata:", error);
      return {
        files: [],
        contextWindow: Infinity,
        currentContextTokenCount: 0,
      };
    }
  },

  getContextFiles: async function (workspace, thread = null, user = null) {
    try {
      const files = await this.where({
        workspaceId: workspace.id,
        threadId: thread?.id || null,
        ...(user ? { userId: user.id } : {}),
      });

      const results = [];
      for (const file of files) {
        const metadata = safeJsonParse(file.metadata, {});
        const location = metadata.location;
        if (!location) continue;

        const sourceFile = path.join(
          directUploadsPath,
          path.basename(location)
        );
        if (!fs.existsSync(sourceFile)) continue;

        const content = fs.readFileSync(sourceFile, "utf-8");
        const data = safeJsonParse(content, null);
        if (!data?.pageContent) continue;

        results.push({
          pageContent: data.pageContent,
          token_count_estimate: file.tokenCountEstimate,
          ...metadata,
        });
      }

      return results;
    } catch (error) {
      console.error("Failed to get context files:", error);
      return [];
    }
  },
};

module.exports = { WorkspaceParsedFiles };
