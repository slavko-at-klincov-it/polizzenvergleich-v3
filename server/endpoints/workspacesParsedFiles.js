const { reqBody, multiUserMode, userFromSession } = require("../utils/http");
const { handleFileUpload } = require("../utils/files/multer");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const { Telemetry } = require("../models/telemetry");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { EventLogs } = require("../models/eventLogs");
const { validWorkspaceSlug } = require("../utils/middleware/validWorkspace");
const { CollectorApi } = require("../utils/collectorApi");
const { WorkspaceThread } = require("../models/workspaceThread");
const { WorkspaceParsedFiles } = require("../models/workspaceParsedFiles");
const { countModelTokens } = require("../utils/LocalModelTokenizer");
const fs = require("fs");
const {
  isSupportedComparisonDocument,
} = require("../utils/comparisonDocuments/supportedFormats");
const { ComparisonDocumentService } = require("../utils/comparisonDocuments");

function removeRejectedUpload(request) {
  try {
    if (request?.file?.path && fs.existsSync(request.file.path))
      fs.unlinkSync(request.file.path);
  } catch (error) {
    console.warn("Could not remove rejected comparison upload:", error.message);
  }
}

function workspaceParsedFilesEndpoints(app) {
  if (!app) return;

  app.get(
    "/workspace/:slug/parsed-files",
    [validatedRequest, flexUserRoleValid([ROLES.all]), validWorkspaceSlug],
    async (request, response) => {
      try {
        const threadSlug = request.query.threadSlug || null;
        const user = await userFromSession(request, response);
        const workspace = response.locals.workspace;
        const thread = threadSlug
          ? await WorkspaceThread.get({ slug: String(threadSlug) })
          : null;
        const { files, contextWindow, currentContextTokenCount } =
          await WorkspaceParsedFiles.getContextMetadataAndLimits(
            workspace,
            thread || null,
            multiUserMode(response) ? user : null
          );

        return response
          .status(200)
          .json({ files, contextWindow, currentContextTokenCount });
      } catch (e) {
        console.error(e.message, e);
        return response.sendStatus(500).end();
      }
    }
  );

  app.delete(
    "/workspace/:slug/delete-parsed-files",
    [validatedRequest, flexUserRoleValid([ROLES.all]), validWorkspaceSlug],
    async function (request, response) {
      try {
        const { fileIds = [] } = reqBody(request);
        if (!fileIds.length) return response.sendStatus(400).end();
        const user = await userFromSession(request, response);
        const workspace = response.locals.workspace;
        const success = await WorkspaceParsedFiles.delete({
          id: {
            in: fileIds.map((id) => parseInt(id)),
          },
          ...(user ? { userId: user.id } : {}),
          workspaceId: workspace.id,
        });
        return response.status(success ? 200 : 403).end();
      } catch (e) {
        console.error(e.message, e);
        return response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/workspace/:slug/embed-parsed-file/:fileId",
    [
      validatedRequest,
      // Embed is still an admin/manager only feature
      flexUserRoleValid([ROLES.admin, ROLES.manager]),
      validWorkspaceSlug,
    ],
    async function (request, response) {
      const { fileId = null } = request.params;
      try {
        const user = await userFromSession(request, response);
        const workspace = response.locals.workspace;

        if (!fileId) return response.sendStatus(400).end();
        const { success, error, document } =
          await WorkspaceParsedFiles.moveToDocumentsAndEmbed(
            user,
            fileId,
            workspace
          );

        if (!success) {
          return response.status(500).json({
            success: false,
            error: error || "Failed to embed file",
          });
        }

        await Telemetry.sendTelemetry("document_embedded");
        await EventLogs.logEvent(
          "document_embedded",
          {
            documentName: document?.name || "unknown",
            workspaceId: workspace.id,
          },
          user?.id
        );

        return response.status(200).json({
          success: true,
          error: null,
          document,
        });
      } catch (e) {
        console.error(e.message, e);
        return response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/workspace/:slug/parse",
    [
      validatedRequest,
      flexUserRoleValid([ROLES.all]),
      handleFileUpload,
      validWorkspaceSlug,
    ],
    async function (request, response) {
      try {
        const user = await userFromSession(request, response);
        const workspace = response.locals.workspace;
        const Collector = new CollectorApi();
        const { originalname, mimetype } = request.file;
        if (
          !isSupportedComparisonDocument({
            filename: originalname,
            mime: mimetype,
          })
        ) {
          removeRejectedUpload(request);
          return response.status(415).json({
            success: false,
            error:
              "Unterstützt werden PDF, DOCX, ODT, TXT, MD, CSV, XLSX und PPTX.",
          });
        }

        // Resolve and scope the thread before the collector writes extracted
        // customer text. A supplied but invalid slug must never degrade into
        // an unscoped/default-chat upload.
        const { threadSlug = null } = reqBody(request);
        const thread = threadSlug
          ? await WorkspaceThread.get({
              slug: String(threadSlug),
              workspace_id: workspace.id,
              user_id: user?.id || null,
            })
          : null;
        if (threadSlug && !thread) {
          removeRejectedUpload(request);
          return response.status(404).json({
            success: false,
            error: "Der Vergleichs-Thread wurde nicht gefunden.",
          });
        }
        const processingOnline = await Collector.online();

        if (!processingOnline) {
          return response.status(500).json({
            success: false,
            error: `Document processing API is not online. Document ${originalname} will not be parsed.`,
          });
        }

        const { success, reason, documents } =
          await Collector.parseDocument(originalname);
        if (!success || !documents?.[0]) {
          return response.status(500).json({
            success: false,
            error: reason || "No document returned from collector",
          });
        }

        const files = await Promise.all(
          documents.map(async (doc) => {
            const metadata = {
              ...doc,
              originalFilename: originalname,
              mimeType: mimetype || null,
            };
            // Strip out pageContent
            delete metadata.pageContent;
            const filename = `${originalname}-${doc.id}.json`;
            let modelTokenCount = null;
            let modelTokenLabel = null;
            try {
              const tokenResult = await countModelTokens(doc.pageContent);
              modelTokenCount = tokenResult.count;
              modelTokenLabel = tokenResult.label;
            } catch (error) {
              console.warn(
                "Could not count local model tokens:",
                error.message
              );
            }
            const { file, error: dbError } = await WorkspaceParsedFiles.create({
              filename,
              workspaceId: workspace.id,
              userId: user?.id || null,
              threadId: thread?.id || null,
              metadata: JSON.stringify(metadata),
              tokenCountEstimate:
                modelTokenCount ?? doc.token_count_estimate ?? 0,
            });

            if (dbError) throw new Error(dbError);
            try {
              if (thread)
                await ComparisonDocumentService.reserveParsedFile({
                  workspace,
                  thread,
                  user,
                  parsedFile: file,
                });
            } catch (reservationError) {
              try {
                await ComparisonDocumentService.removeParsedFile({
                  workspace,
                  thread,
                  user,
                  parsedFileId: file.id,
                });
              } catch (cleanupError) {
                console.error(
                  "Could not clean a rejected comparison upload:",
                  cleanupError
                );
              }
              throw reservationError;
            }
            return {
              ...file,
              modelTokenCount,
              modelTokenLabel,
              // Backward compatibility for the existing prototype UI.
              qwenTokenCount: modelTokenCount,
            };
          })
        );

        Collector.log(`Document ${originalname} parsed successfully.`);
        await EventLogs.logEvent(
          "document_uploaded_to_chat",
          {
            documentName: originalname,
            workspace: workspace.slug,
            thread: thread?.name || null,
          },
          user?.id
        );

        return response.status(200).json({
          success: true,
          error: null,
          files,
        });
      } catch (e) {
        console.error(e.message, e);
        return response.status(e.statusCode || 500).json({
          success: false,
          error: e.message || "Document could not be parsed.",
        });
      }
    }
  );
}

module.exports = { workspaceParsedFilesEndpoints };
