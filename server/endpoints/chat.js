const { v4: uuidv4, validate: validateUuid } = require("uuid");
const { reqBody, userFromSession, multiUserMode } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const { Telemetry } = require("../models/telemetry");
const { streamChatWithWorkspace } = require("../utils/chats/stream");
const {
  ROLES,
  flexUserRoleValid,
} = require("../utils/middleware/multiUserProtected");
const { EventLogs } = require("../models/eventLogs");
const {
  validWorkspaceAndThreadSlug,
  validWorkspaceSlug,
} = require("../utils/middleware/validWorkspace");
const { writeResponseChunk } = require("../utils/helpers/chat/responses");
const { WorkspaceThread } = require("../models/workspaceThread");
const { User } = require("../models/user");
const { getModelTag } = require("./utils");
const {
  chatGenerationManager,
  detachedStreamResponse,
} = require("../utils/chats/ChatGenerationManager");

function generationScope(workspace, thread, user) {
  return {
    workspaceId: workspace.id,
    threadId: thread?.id ?? null,
    userId: user?.id ?? null,
  };
}

function validGenerationId(generationId) {
  return typeof generationId === "string" && validateUuid(generationId);
}

function chatEndpoints(app) {
  if (!app) return;

  app.post(
    "/workspace/:slug/stream-chat",
    [validatedRequest, flexUserRoleValid([ROLES.all]), validWorkspaceSlug],
    async (request, response) => {
      try {
        const user = await userFromSession(request, response);
        const {
          message,
          attachments = [],
          generationId = null,
        } = reqBody(request);
        const workspace = response.locals.workspace;

        if (typeof message !== "string" || message.trim().length === 0) {
          response.status(400).json({
            id: uuidv4(),
            type: "abort",
            textResponse: null,
            sources: [],
            close: true,
            error: "Message is empty.",
          });
          return;
        }
        if (generationId && !validGenerationId(generationId)) {
          response.status(400).json({ error: "Invalid generationId." });
          return;
        }

        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Content-Type", "text/event-stream");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Connection", "keep-alive");
        response.flushHeaders();

        if (multiUserMode(response) && !(await User.canSendChat(user))) {
          writeResponseChunk(response, {
            id: uuidv4(),
            type: "abort",
            textResponse: null,
            sources: [],
            close: true,
            error: `You have met your maximum 24 hour chat quota of ${user.dailyMessageLimit} chats. Try again later.`,
          });
          return;
        }

        const scope = generationScope(workspace, null, user);
        const { created, generation } = chatGenerationManager.begin(
          scope,
          generationId
        );
        if (!created) {
          writeResponseChunk(response, {
            id: generation.id,
            type: "abort",
            textResponse: null,
            sources: [],
            close: true,
            error: "In diesem Chat wird bereits eine Antwort erstellt.",
          });
          response.end();
          return;
        }

        const streamResponse = detachedStreamResponse(response, generation);
        writeResponseChunk(streamResponse, {
          id: generation.id,
          type: "generationStarted",
          generationId: generation.id,
          close: false,
        });
        try {
          await streamChatWithWorkspace(
            streamResponse,
            workspace,
            message,
            workspace?.chatMode,
            user,
            null,
            attachments,
            generation
          );
        } finally {
          streamResponse.detach();
          chatGenerationManager.finish(generation);
        }
        await Telemetry.sendTelemetry("sent_chat", {
          multiUserMode: multiUserMode(response),
          LLMSelection: process.env.LLM_PROVIDER || "openai",
          Embedder: process.env.EMBEDDING_ENGINE || "inherit",
          VectorDbSelection: process.env.VECTOR_DB || "lancedb",
          multiModal: Array.isArray(attachments) && attachments?.length !== 0,
          TTSSelection: process.env.TTS_PROVIDER || "native",
          LLMModel: getModelTag(),
        });

        await EventLogs.logEvent(
          "sent_chat",
          {
            workspaceName: workspace?.name,
            chatModel: workspace?.chatModel || "System Default",
          },
          user?.id
        );
        response.end();
      } catch (e) {
        console.error(e);
        writeResponseChunk(response, {
          id: uuidv4(),
          type: "abort",
          textResponse: null,
          sources: [],
          close: true,
          error: e.message,
        });
        response.end();
      }
    }
  );

  app.post(
    "/workspace/:slug/thread/:threadSlug/stream-chat",
    [
      validatedRequest,
      flexUserRoleValid([ROLES.all]),
      validWorkspaceAndThreadSlug,
    ],
    async (request, response) => {
      try {
        const user = await userFromSession(request, response);
        const {
          message,
          attachments = [],
          generationId = null,
        } = reqBody(request);
        const workspace = response.locals.workspace;
        const thread = response.locals.thread;

        if (typeof message !== "string" || message.trim().length === 0) {
          response.status(400).json({
            id: uuidv4(),
            type: "abort",
            textResponse: null,
            sources: [],
            close: true,
            error: "Message is empty.",
          });
          return;
        }
        if (generationId && !validGenerationId(generationId)) {
          response.status(400).json({ error: "Invalid generationId." });
          return;
        }

        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Content-Type", "text/event-stream");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Connection", "keep-alive");
        response.flushHeaders();

        if (multiUserMode(response) && !(await User.canSendChat(user))) {
          writeResponseChunk(response, {
            id: uuidv4(),
            type: "abort",
            textResponse: null,
            sources: [],
            close: true,
            error: `You have met your maximum 24 hour chat quota of ${user.dailyMessageLimit} chats. Try again later.`,
          });
          return;
        }

        const scope = generationScope(workspace, thread, user);
        const { created, generation } = chatGenerationManager.begin(
          scope,
          generationId
        );
        if (!created) {
          writeResponseChunk(response, {
            id: generation.id,
            type: "abort",
            textResponse: null,
            sources: [],
            close: true,
            error: "In diesem Thread wird bereits eine Antwort erstellt.",
          });
          response.end();
          return;
        }

        const streamResponse = detachedStreamResponse(response, generation);
        writeResponseChunk(streamResponse, {
          id: generation.id,
          type: "generationStarted",
          generationId: generation.id,
          close: false,
        });
        try {
          // The scope lock also covers auto-rename: duplicate handoffs must not
          // start a second model call before the main generation is claimed.
          await WorkspaceThread.autoRenameThread({
            thread,
            workspace,
            user,
            prompt: message,
            onRename: (thread) => {
              writeResponseChunk(streamResponse, {
                action: "rename_thread",
                thread: {
                  slug: thread.slug,
                  name: thread.name,
                },
              });
            },
          });

          await streamChatWithWorkspace(
            streamResponse,
            workspace,
            message,
            workspace?.chatMode,
            user,
            thread,
            attachments,
            generation
          );
        } finally {
          streamResponse.detach();
          chatGenerationManager.finish(generation);
        }

        await Telemetry.sendTelemetry("sent_chat", {
          multiUserMode: multiUserMode(response),
          LLMSelection: process.env.LLM_PROVIDER || "openai",
          Embedder: process.env.EMBEDDING_ENGINE || "inherit",
          VectorDbSelection: process.env.VECTOR_DB || "lancedb",
          multiModal: Array.isArray(attachments) && attachments?.length !== 0,
          TTSSelection: process.env.TTS_PROVIDER || "native",
          LLMModel: getModelTag(),
        });

        await EventLogs.logEvent(
          "sent_chat",
          {
            workspaceName: workspace.name,
            thread: thread.name,
            chatModel: workspace?.chatModel || "System Default",
          },
          user?.id
        );
        response.end();
      } catch (e) {
        console.error(e);
        writeResponseChunk(response, {
          id: uuidv4(),
          type: "abort",
          textResponse: null,
          sources: [],
          close: true,
          error: e.message,
        });
        response.end();
      }
    }
  );

  app.post(
    "/workspace/:slug/stop-generation",
    [validatedRequest, flexUserRoleValid([ROLES.all]), validWorkspaceSlug],
    async (request, response) => {
      const user = await userFromSession(request, response);
      const workspace = response.locals.workspace;
      const { generationId = null } = reqBody(request);
      if (!validGenerationId(generationId)) {
        response.status(400).json({ success: false, cancelled: false });
        return;
      }
      const cancelled = chatGenerationManager.cancel(
        generationScope(workspace, null, user),
        generationId
      );
      response.status(200).json({ success: true, cancelled });
    }
  );

  app.get(
    "/workspace/:slug/generation-status",
    [validatedRequest, flexUserRoleValid([ROLES.all]), validWorkspaceSlug],
    async (request, response) => {
      const user = await userFromSession(request, response);
      const workspace = response.locals.workspace;
      const generation = chatGenerationManager.get(
        generationScope(workspace, null, user)
      );
      response.status(200).json({
        active: Boolean(generation),
        generationId: generation?.id ?? null,
      });
    }
  );

  app.post(
    "/workspace/:slug/thread/:threadSlug/stop-generation",
    [
      validatedRequest,
      flexUserRoleValid([ROLES.all]),
      validWorkspaceAndThreadSlug,
    ],
    async (request, response) => {
      const user = await userFromSession(request, response);
      const workspace = response.locals.workspace;
      const thread = response.locals.thread;
      const { generationId = null } = reqBody(request);
      if (!validGenerationId(generationId)) {
        response.status(400).json({ success: false, cancelled: false });
        return;
      }
      const cancelled = chatGenerationManager.cancel(
        generationScope(workspace, thread, user),
        generationId
      );
      response.status(200).json({ success: true, cancelled });
    }
  );

  app.get(
    "/workspace/:slug/thread/:threadSlug/generation-status",
    [
      validatedRequest,
      flexUserRoleValid([ROLES.all]),
      validWorkspaceAndThreadSlug,
    ],
    async (request, response) => {
      const user = await userFromSession(request, response);
      const workspace = response.locals.workspace;
      const thread = response.locals.thread;
      const generation = chatGenerationManager.get(
        generationScope(workspace, thread, user)
      );
      response.status(200).json({
        active: Boolean(generation),
        generationId: generation?.id ?? null,
      });
    }
  );
}

module.exports = { chatEndpoints };
