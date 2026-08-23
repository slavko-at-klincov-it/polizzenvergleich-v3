const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const {
  validWorkspaceAndThreadSlug,
} = require("../utils/middleware/validWorkspace");
const { userFromSession } = require("../utils/http");
const { ComparisonDocumentService } = require("../utils/comparisonDocuments");
const { ComparisonDocument } = require("../models/comparisonDocument");

const middleware = [
  validatedRequest,
  flexUserRoleValid([ROLES.all]),
  validWorkspaceAndThreadSlug,
];

function comparisonDocumentEndpoints(app) {
  if (!app) return;

  app.get(
    "/workspace/:slug/thread/:threadSlug/comparison-documents",
    middleware,
    async (request, response) => {
      try {
        const user = await userFromSession(request, response);
        const documents = await ComparisonDocumentService.list({
          workspace: response.locals.workspace,
          thread: response.locals.thread,
          user,
        });
        return response.status(200).json({ documents });
      } catch (error) {
        console.error("Failed to list comparison documents:", error);
        return response.status(error.statusCode || 500).json({
          documents: [],
          error: error.message,
        });
      }
    }
  );

  app.post(
    "/workspace/:slug/thread/:threadSlug/comparison-documents/:fileId",
    middleware,
    async (request, response) => {
      let user = null;
      try {
        user = await userFromSession(request, response);
        const document = await ComparisonDocumentService.embedParsedFile({
          workspace: response.locals.workspace,
          thread: response.locals.thread,
          user,
          parsedFileId: request.params.fileId,
        });
        return response.status(200).json({
          success: true,
          error: null,
          document,
        });
      } catch (error) {
        console.error("Failed to embed comparison document:", error);
        const failedDocument = await ComparisonDocument.get({
          workspaceId: response.locals.workspace.id,
          threadId: response.locals.thread.id,
          userId: user?.id ?? null,
          parsedFileId: Number(request.params.fileId),
        }).catch(() => null);
        return response.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
          document: ComparisonDocument.serialize(failedDocument),
        });
      }
    }
  );

  app.delete(
    "/workspace/:slug/thread/:threadSlug/comparison-documents/:id",
    middleware,
    async (request, response) => {
      try {
        const user = await userFromSession(request, response);
        await ComparisonDocumentService.remove({
          workspace: response.locals.workspace,
          thread: response.locals.thread,
          user,
          id: request.params.id,
        });
        return response.status(200).json({ success: true, error: null });
      } catch (error) {
        console.error("Failed to delete comparison document:", error);
        return response.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  app.delete(
    "/workspace/:slug/thread/:threadSlug/comparison-parsed-files/:fileId",
    middleware,
    async (request, response) => {
      try {
        const user = await userFromSession(request, response);
        await ComparisonDocumentService.removeParsedFile({
          workspace: response.locals.workspace,
          thread: response.locals.thread,
          user,
          parsedFileId: request.params.fileId,
        });
        return response.status(200).json({ success: true, error: null });
      } catch (error) {
        return response.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );
}

module.exports = { comparisonDocumentEndpoints };
