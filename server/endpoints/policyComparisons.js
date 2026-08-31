const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { reqBody, multiUserMode, userFromSession } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validWorkspaceSlug } = require("../utils/middleware/validWorkspace");
const { WorkspaceThread } = require("../models/workspaceThread");
const { PolicyComparison } = require("../models/policyComparison");
const { handlePolicyComparisonUpload } = require("../utils/files/multer");
const { isWithin, policyComparisonsPath } = require("../utils/files");
const { EventLogs } = require("../models/eventLogs");

function safeUnlink(file) {
  if (!file) return;
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (error) {
    console.warn(`Comparison file cleanup failed: ${error.message}`);
  }
}

function deleteStoredDocument(document) {
  const absolutePath = path.resolve(
    policyComparisonsPath,
    document.storagePath
  );
  if (!isWithin(policyComparisonsPath, absolutePath))
    throw new Error("COMPARISON_STORAGE_PATH_INVALID");
  safeUnlink(absolutePath);
}

function deleteSessionArtifacts(sessionUuid) {
  for (const parent of ["uploads", "runs"]) {
    const target = path.resolve(policyComparisonsPath, parent, sessionUuid);
    if (!isWithin(policyComparisonsPath, target))
      throw new Error("COMPARISON_STORAGE_PATH_INVALID");
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true });
  }
}

async function sha256File(file) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

function hasPdfHeader(file) {
  const descriptor = fs.openSync(file, "r");
  try {
    const buffer = Buffer.alloc(5);
    const bytesRead = fs.readSync(descriptor, buffer, 0, 5, 0);
    return bytesRead === 5 && buffer.toString("ascii") === "%PDF-";
  } finally {
    fs.closeSync(descriptor);
  }
}

function errorStatus(error) {
  if (
    [
      "INVALID_COMPARISON_SIDE",
      "INVALID_DOCUMENT_ROLE",
      "INVALID_DOCUMENT_STATUS",
      "NO_DOCUMENT_CHANGES",
    ].includes(error?.message)
  )
    return 400;
  if (error?.message === "COMPARISON_SIDE_LIMIT_REACHED") return 409;
  if (error?.message === "COMPARISON_SESSION_LOCKED") return 423;
  if (error?.code === "P2002") return 409;
  return 500;
}

async function resolveScope(request, response) {
  const workspace = response.locals.workspace;
  const user = await userFromSession(request, response);
  const threadSlug = request.query.threadSlug
    ? String(request.query.threadSlug)
    : null;
  const thread = threadSlug
    ? await WorkspaceThread.get({
        slug: threadSlug,
        workspace_id: workspace.id,
        ...(multiUserMode(response) ? { user_id: user?.id || -1 } : {}),
      })
    : null;
  if (threadSlug && !thread) return null;
  return {
    workspace,
    user,
    thread,
    ownerKey: multiUserMode(response) ? `user:${user?.id}` : "single-user",
    conversationKey: thread ? `thread:${thread.id}` : "workspace-default",
  };
}

async function loadOwnedSession(request, response, next) {
  try {
    const scope = await resolveScope(request, response);
    if (!scope)
      return response.status(404).json({
        success: false,
        error: "Comparison conversation was not found.",
      });
    const session = await PolicyComparison.getOwned({
      uuid: String(request.params.sessionUuid || ""),
      workspaceId: scope.workspace.id,
      ownerKey: scope.ownerKey,
      conversationKey: scope.conversationKey,
    });
    if (!session)
      return response.status(404).json({
        success: false,
        error: "Comparison session was not found.",
      });
    request.policyComparisonScope = scope;
    request.policyComparisonSession = session;
    return next();
  } catch (error) {
    console.error(error.message, error);
    return response.status(500).json({ success: false, error: error.message });
  }
}

function policyComparisonEndpoints(app) {
  if (!app) return;
  const protectedRoute = [
    validatedRequest,
    flexUserRoleValid([ROLES.all]),
    validWorkspaceSlug,
  ];

  app.get(
    "/workspace/:slug/policy-comparison",
    protectedRoute,
    async (request, response) => {
      try {
        const scope = await resolveScope(request, response);
        if (!scope)
          return response.status(404).json({
            success: false,
            error: "Comparison conversation was not found.",
          });
        const session = await PolicyComparison.getForScope({
          workspaceId: scope.workspace.id,
          ownerKey: scope.ownerKey,
          conversationKey: scope.conversationKey,
        });
        return response.status(200).json({
          success: true,
          session: session ? PolicyComparison.publicSession(session) : null,
          options: {
            sides: PolicyComparison.SIDES,
            documentRoles: PolicyComparison.DOCUMENT_ROLES,
            documentStatuses: PolicyComparison.DOCUMENT_STATUSES,
          },
        });
      } catch (error) {
        console.error(error.message, error);
        return response
          .status(500)
          .json({ success: false, error: error.message });
      }
    }
  );

  app.post(
    "/workspace/:slug/policy-comparison",
    protectedRoute,
    async (request, response) => {
      try {
        const scope = await resolveScope(request, response);
        if (!scope)
          return response.status(404).json({
            success: false,
            error: "Comparison conversation was not found.",
          });
        const session = await PolicyComparison.getOrCreate({
          workspaceId: scope.workspace.id,
          userId: scope.user?.id || null,
          threadId: scope.thread?.id || null,
          ownerKey: scope.ownerKey,
          conversationKey: scope.conversationKey,
        });
        return response.status(201).json({
          success: true,
          session: PolicyComparison.publicSession(session),
          options: {
            sides: PolicyComparison.SIDES,
            documentRoles: PolicyComparison.DOCUMENT_ROLES,
            documentStatuses: PolicyComparison.DOCUMENT_STATUSES,
          },
        });
      } catch (error) {
        console.error(error.message, error);
        return response
          .status(500)
          .json({ success: false, error: error.message });
      }
    }
  );

  app.post(
    "/workspace/:slug/policy-comparison/:sessionUuid/documents",
    [...protectedRoute, loadOwnedSession, handlePolicyComparisonUpload],
    async (request, response) => {
      const uploadedPath = request.file?.path || null;
      try {
        if (!request.file) throw new Error("COMPARISON_PDF_MISSING");
        fs.chmodSync(uploadedPath, 0o600);
        if (!hasPdfHeader(uploadedPath)) {
          safeUnlink(uploadedPath);
          return response.status(415).json({
            success: false,
            error: "The uploaded file is not a valid PDF.",
          });
        }
        const { side, role, documentStatus = "ACTIVE" } = reqBody(request);
        const session = request.policyComparisonSession;
        const relativePath = path.relative(policyComparisonsPath, uploadedPath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath))
          throw new Error("COMPARISON_STORAGE_PATH_INVALID");
        const document = await PolicyComparison.addDocument({
          session,
          side,
          role,
          documentStatus,
          originalName: request.file.originalname,
          storedName: request.policyComparisonStoredName,
          storagePath: relativePath,
          mimeType: "application/pdf",
          byteSize: request.file.size,
          sha256: await sha256File(uploadedPath),
        });
        await EventLogs.logEvent(
          "policy_comparison_document_uploaded",
          {
            workspaceId: request.policyComparisonScope.workspace.id,
            sessionUuid: session.uuid,
            documentUuid: document.uuid,
            side: document.side,
            role: document.role,
          },
          request.policyComparisonScope.user?.id
        );
        return response.status(201).json({
          success: true,
          document: PolicyComparison.publicDocument(document),
        });
      } catch (error) {
        safeUnlink(uploadedPath);
        console.error(error.message, error);
        const duplicate = error?.code === "P2002";
        return response.status(errorStatus(error)).json({
          success: false,
          error: duplicate
            ? "This PDF is already assigned to that package."
            : error.message,
        });
      }
    }
  );

  app.patch(
    "/workspace/:slug/policy-comparison/:sessionUuid/documents/:documentUuid",
    [...protectedRoute, loadOwnedSession],
    async (request, response) => {
      try {
        const { role, documentStatus } = reqBody(request);
        const document = await PolicyComparison.updateDocument({
          session: request.policyComparisonSession,
          documentUuid: request.params.documentUuid,
          role,
          documentStatus,
        });
        if (!document)
          return response.status(404).json({
            success: false,
            error: "Comparison document was not found.",
          });
        return response.status(200).json({
          success: true,
          document: PolicyComparison.publicDocument(document),
        });
      } catch (error) {
        console.error(error.message, error);
        return response
          .status(errorStatus(error))
          .json({ success: false, error: error.message });
      }
    }
  );

  app.delete(
    "/workspace/:slug/policy-comparison/:sessionUuid/documents/:documentUuid",
    [...protectedRoute, loadOwnedSession],
    async (request, response) => {
      try {
        const document = await PolicyComparison.removeDocument({
          session: request.policyComparisonSession,
          documentUuid: request.params.documentUuid,
        });
        if (!document)
          return response.status(404).json({
            success: false,
            error: "Comparison document was not found.",
          });
        deleteStoredDocument(document);
        return response.status(200).json({ success: true });
      } catch (error) {
        console.error(error.message, error);
        return response
          .status(errorStatus(error))
          .json({ success: false, error: error.message });
      }
    }
  );

  app.post(
    "/workspace/:slug/policy-comparison/:sessionUuid/start",
    [...protectedRoute, loadOwnedSession],
    async (request, response) => {
      let queuedSession = null;
      let child = null;
      try {
        const current = request.policyComparisonSession;
        const { session } = await PolicyComparison.queue(current);
        queuedSession = session;
        const worker = path.resolve(
          __dirname,
          "../scripts/policyComparisonWorker.cjs"
        );
        child = spawn(process.execPath, [worker, session.uuid], {
          cwd: path.resolve(__dirname, "../.."),
          env: process.env,
          detached: true,
          stdio: "ignore",
        });
        if (!Number.isInteger(child.pid) || child.pid <= 1)
          throw new Error("COMPARISON_WORKER_PID_INVALID");
        await PolicyComparison.setWorkerPid(session.id, child.pid);
        child.once("error", async (error) => {
          console.error("Comparison worker failed to start", error);
          await PolicyComparison.markFailed(session.id, error.message).catch(
            console.error
          );
        });
        child.unref();
        await EventLogs.logEvent(
          "policy_comparison_started",
          {
            workspaceId: request.policyComparisonScope.workspace.id,
            sessionUuid: session.uuid,
            documents: current.documents.length,
          },
          request.policyComparisonScope.user?.id
        );
        return response.status(202).json({
          success: true,
          session: PolicyComparison.publicSession({
            ...session,
            documents: current.documents,
          }),
        });
      } catch (error) {
        console.error(error.message, error);
        if (Number.isInteger(child?.pid) && child.pid > 1) {
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch (killError) {
            if (killError.code !== "ESRCH") console.error(killError);
          }
        }
        if (queuedSession)
          await PolicyComparison.markFailed(
            queuedSession.id,
            error.message
          ).catch(console.error);
        const status =
          error.message === "COMPARISON_BOTH_SIDES_REQUIRED"
            ? 400
            : errorStatus(error);
        return response
          .status(status)
          .json({ success: false, error: error.message });
      }
    }
  );

  app.get(
    "/workspace/:slug/policy-comparison/:sessionUuid/result",
    [...protectedRoute, loadOwnedSession],
    async (request, response) => {
      try {
        const session = request.policyComparisonSession;
        if (session.status !== "COMPLETED" || !session.resultPath)
          return response.status(409).json({
            success: false,
            error: "Comparison result is not available yet.",
          });
        const resultFile = path.resolve(
          policyComparisonsPath,
          session.resultPath,
          "comparison.private.json"
        );
        if (
          !isWithin(policyComparisonsPath, resultFile) ||
          !fs.existsSync(resultFile)
        )
          throw new Error("COMPARISON_RESULT_MISSING");
        return response.status(200).json({
          success: true,
          result: JSON.parse(fs.readFileSync(resultFile, "utf8")),
        });
      } catch (error) {
        console.error(error.message, error);
        return response
          .status(500)
          .json({ success: false, error: error.message });
      }
    }
  );

  app.post(
    "/workspace/:slug/policy-comparison/:sessionUuid/cancel",
    [...protectedRoute, loadOwnedSession],
    async (request, response) => {
      try {
        const current = request.policyComparisonSession;
        if (!PolicyComparison.LOCKED_STATUSES.includes(current.status))
          return response.status(409).json({
            success: false,
            error: "Comparison is not running.",
          });
        if (Number.isInteger(current.workerPid) && current.workerPid > 1) {
          try {
            process.kill(-current.workerPid, "SIGTERM");
          } catch (error) {
            if (error.code !== "ESRCH") throw error;
          }
        }
        const session = await PolicyComparison.cancel(current);
        return response.status(200).json({
          success: true,
          session: PolicyComparison.publicSession(session),
        });
      } catch (error) {
        console.error(error.message, error);
        return response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  app.get(
    "/workspace/:slug/policy-comparison/:sessionUuid/download/xlsx",
    [...protectedRoute, loadOwnedSession],
    async (request, response) => {
      try {
        const session = request.policyComparisonSession;
        if (session.status !== "COMPLETED" || !session.resultPath)
          return response.status(409).json({
            success: false,
            error: "Comparison result is not available yet.",
          });
        const workbook = path.resolve(
          policyComparisonsPath,
          session.resultPath,
          "polizzenvergleich.xlsx"
        );
        if (
          !isWithin(policyComparisonsPath, workbook) ||
          !fs.existsSync(workbook)
        )
          throw new Error("COMPARISON_WORKBOOK_MISSING");
        return response.download(workbook, "Gesamtvergleich.xlsx");
      } catch (error) {
        console.error(error.message, error);
        return response
          .status(500)
          .json({ success: false, error: error.message });
      }
    }
  );

  app.post(
    "/workspace/:slug/policy-comparison/:sessionUuid/reset",
    [...protectedRoute, loadOwnedSession],
    async (request, response) => {
      try {
        const { session, documents } = await PolicyComparison.reset(
          request.policyComparisonSession
        );
        documents.forEach(deleteStoredDocument);
        deleteSessionArtifacts(request.policyComparisonSession.uuid);
        return response.status(200).json({
          success: true,
          session: PolicyComparison.publicSession({
            ...session,
            documents: [],
          }),
        });
      } catch (error) {
        console.error(error.message, error);
        return response
          .status(errorStatus(error))
          .json({ success: false, error: error.message });
      }
    }
  );
}

module.exports = { policyComparisonEndpoints };
