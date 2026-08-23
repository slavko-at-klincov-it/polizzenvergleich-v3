const { v4: uuidv4 } = require("uuid");
const { DocumentManager } = require("../DocumentManager");
const { WorkspaceChats } = require("../../models/workspaceChats");
const { WorkspaceParsedFiles } = require("../../models/workspaceParsedFiles");
const { ComparisonDocument } = require("../../models/comparisonDocument");
const { getVectorDbClass, resolveProviderConnector } = require("../helpers");
const {
  writeResponseChunk,
  safeJSONStringify,
} = require("../helpers/chat/responses");
const { abortConnectorOnClientDisconnect } = require("../helpers/abortSignals");
const {
  ComparisonHybridRetriever,
} = require("../PolicyComparison/ComparisonHybridRetriever");
const { grepAgents } = require("./agents");
const {
  grepCommand,
  VALID_COMMANDS,
  chatPrompt,
  recentChatHistory,
  sourceIdentifier,
} = require("./index");

const VALID_CHAT_MODE = ["automatic", "chat", "query"];

async function streamChatWithWorkspace(
  response,
  workspace,
  message,
  chatMode = "automatic",
  user = null,
  thread = null,
  attachments = []
) {
  const uuid = uuidv4();
  const updatedMessage = await grepCommand(message, user);

  if (Object.keys(VALID_COMMANDS).includes(updatedMessage)) {
    const data = await VALID_COMMANDS[updatedMessage](
      workspace,
      message,
      uuid,
      user,
      thread,
      response,
      attachments
    );
    writeResponseChunk(response, data);
    return;
  }

  // If is agent enabled chat we will exit this flow early.
  const isAgentChat = await grepAgents({
    uuid,
    response,
    message: updatedMessage,
    user,
    workspace,
    thread,
    attachments,
  });
  if (isAgentChat) return;

  const {
    connector: LLMConnector,
    routingMetadata,
    prefetchedContext,
    error: routerError,
  } = await resolveLLMConnector({
    workspace,
    message: updatedMessage,
    user,
    thread,
    attachments,
  });

  if (routerError) {
    return writeResponseChunk(response, {
      id: uuid,
      type: "abort",
      textResponse: null,
      sources: [],
      close: true,
      error: routerError,
    });
  }

  // Stopping the generation (or closing the tab) should stop the provider
  // generating too, not just stop us reading the response.
  abortConnectorOnClientDisconnect(response, LLMConnector);

  if (routingMetadata?.routedTo?.shouldNotify) {
    writeResponseChunk(response, {
      uuid: `${uuid}:route`,
      type: "modelRouteNotification",
      routedTo: routingMetadata.routedTo,
    });
  }

  const VectorDb = getVectorDbClass();

  const messageLimit = workspace?.openAiHistory || 20;
  const hasVectorizedSpace = await VectorDb.hasNamespace(workspace.slug);
  const embeddingsCount = await VectorDb.namespaceCount(workspace.slug);

  let completeText;
  let metrics = {};
  let contextTexts = [];
  let sources = [];
  let pinnedDocIdentifiers = [];

  // If the router pre-fetched context we can reuse it; otherwise fetch fresh.
  const {
    rawHistory,
    chatHistory,
    pinnedDocs: prefetchedPinnedDocs,
    parsedFiles: prefetchedParsedFiles,
  } = prefetchedContext ??
  (await recentChatHistory({ user, workspace, thread, messageLimit }));

  // A thread must survive even when the client navigates away or a local model
  // aborts before it emits its first token. Persist a visible placeholder now,
  // then replace it with the final answer below. It is created only after the
  // current history was read, so it cannot leak into this request's prompt.
  const interruptedResponse = {
    text: "Antwort wurde nicht fertiggestellt. Sende die Frage erneut, um eine neue Antwort zu erhalten.",
    sources: [],
    type: chatMode,
    attachments,
    pending: true,
  };
  const { chat: pendingChat } = await WorkspaceChats.new({
    workspaceId: workspace.id,
    prompt: message,
    response: interruptedResponse,
    threadId: thread?.id || null,
    user,
  });
  const updatePendingChat = async (responseData, include = true) => {
    if (!pendingChat) {
      const { chat } = await WorkspaceChats.new({
        workspaceId: workspace.id,
        prompt: message,
        response: responseData,
        threadId: thread?.id || null,
        include,
        user,
      });
      return chat;
    }

    const updated = await WorkspaceChats._update(pendingChat.id, {
      response: safeJSONStringify(responseData),
      include,
    });
    return updated ? pendingChat : null;
  };

  let comparisonContext = { active: false };
  try {
    comparisonContext = await ComparisonHybridRetriever.retrieve({
      workspace,
      thread,
      user,
      query: updatedMessage,
      LLMConnector,
      VectorDb,
      topNPerDocument: Math.max(4, workspace?.topN || 4),
    });
  } catch (error) {
    await updatePendingChat({
      ...interruptedResponse,
      text: `Der dokumentgebundene Vergleich konnte nicht vorbereitet werden: ${error.message}`,
      pending: false,
      interrupted: true,
    });
    writeResponseChunk(response, {
      id: uuid,
      type: "abort",
      textResponse: null,
      sources: [],
      close: true,
      error: error.message,
    });
    return;
  }

  if (comparisonContext.active && !comparisonContext.ready) {
    writeResponseChunk(response, {
      id: uuid,
      type: "textResponse",
      textResponse: comparisonContext.message,
      sources: [],
      attachments,
      close: true,
      error: null,
    });
    await updatePendingChat(
      {
        text: comparisonContext.message,
        sources: [],
        type: chatMode,
        attachments,
      },
      false
    );
    return;
  }

  // A comparison thread is an isolated evidence boundary. Pinned documents,
  // parsed full-context files, and workspace-global vector results must never
  // be mixed into it.
  if (comparisonContext.active) {
    contextTexts = comparisonContext.contextTexts;
    sources = comparisonContext.sources;
  } else {
    // Comparison vectors share the physical workspace namespace for lifecycle
    // compatibility, but must be invisible to ordinary chats and other
    // threads. The filter is applied inside Lance before top-N selection.
    const workspaceComparisonDocuments = await ComparisonDocument.where(
      { workspaceId: workspace.id, status: "ready" },
      null
    );
    const comparisonDocIds = new Set(
      workspaceComparisonDocuments
        .map((document) => document.docId)
        .filter(Boolean)
    );
    const comparisonSourceIdentifiers = new Set(
      workspaceComparisonDocuments
        .flatMap((document) => [document.docpath, document.originalFilename])
        .filter(Boolean)
    );
    // Query-mode without comparison documents still follows the generic
    // workspace behavior and requires at least one vectorized document.
    if (
      (!hasVectorizedSpace || embeddingsCount === 0) &&
      chatMode === "query"
    ) {
      const textResponse =
        workspace?.queryRefusalResponse ??
        "There is no relevant information in this workspace to answer your query.";
      writeResponseChunk(response, {
        id: uuid,
        type: "textResponse",
        textResponse,
        sources: [],
        attachments,
        close: true,
        error: null,
      });
      await updatePendingChat(
        {
          text: textResponse,
          sources: [],
          type: chatMode,
          attachments,
        },
        false
      );
      return;
    }

    // Pinned docs — reuse pre-fetched if available, otherwise fetch with token cap.
    const pinnedDocs =
      prefetchedPinnedDocs ??
      (await new DocumentManager({
        workspace,
        maxTokens: LLMConnector.promptWindowLimit(),
      }).pinnedDocs());
    pinnedDocs
      .filter(
        (doc) =>
          !comparisonDocIds.has(doc.docId) &&
          !comparisonSourceIdentifiers.has(sourceIdentifier(doc)) &&
          !comparisonSourceIdentifiers.has(doc.location) &&
          !comparisonSourceIdentifiers.has(doc.title)
      )
      .forEach((doc) => {
        const { pageContent, ...metadata } = doc;
        pinnedDocIdentifiers.push(sourceIdentifier(doc));
        contextTexts.push(doc.pageContent);
        sources.push({
          text:
            pageContent.slice(0, 1_000) +
            "...continued on in source document...",
          ...metadata,
        });
      });

    // Parsed files — reuse pre-fetched if available, otherwise fetch fresh.
    const parsedFiles =
      prefetchedParsedFiles ??
      (await WorkspaceParsedFiles.getContextFiles(
        workspace,
        thread || null,
        user || null
      ));
    parsedFiles.forEach((doc) => {
      const { pageContent, ...metadata } = doc;
      contextTexts.push(doc.pageContent);
      sources.push({
        text:
          pageContent.slice(0, 1_000) + "...continued on in source document...",
        ...metadata,
      });
    });

    const vectorSearchResults =
      embeddingsCount !== 0
        ? await VectorDb.performSimilaritySearch({
            namespace: workspace.slug,
            input: updatedMessage,
            LLMConnector,
            similarityThreshold: workspace?.similarityThreshold,
            topN: workspace?.topN,
            filterIdentifiers: pinnedDocIdentifiers,
            excludeDocIds: [...comparisonDocIds],
            rerank: workspace?.vectorSearchMode === "rerank",
          })
        : {
            contextTexts: [],
            sources: [],
            message: null,
          };

    // Failed similarity search if it was run at all and failed.
    if (!!vectorSearchResults.message) {
      await updatePendingChat({
        ...interruptedResponse,
        text: `Antwort konnte nicht erzeugt werden: ${vectorSearchResults.message}`,
        pending: false,
        interrupted: true,
      });
      writeResponseChunk(response, {
        id: uuid,
        type: "abort",
        textResponse: null,
        sources: [],
        close: true,
        error: vectorSearchResults.message,
      });
      return;
    }

    const { fillSourceWindow } = require("../helpers/chat");
    const filledSources = fillSourceWindow({
      nDocs: workspace?.topN || 4,
      searchResults: vectorSearchResults.sources,
      history: rawHistory,
      filterIdentifiers: pinnedDocIdentifiers,
    });

    // Why does contextTexts get all the info, but sources only get current search?
    // This is to give the ability of the LLM to "comprehend" a contextual response without
    // populating the Citations under a response with documents the user "thinks" are irrelevant
    // due to how we manage backfilling of the context to keep chats with the LLM more correct in responses.
    // If a past citation was used to answer the question - that is visible in the history so it logically makes sense
    // and does not appear to the user that a new response used information that is otherwise irrelevant for a given prompt.
    // TLDR; reduces GitHub issues for "LLM citing document that has no answer in it" while keep answers highly accurate.
    contextTexts = [...contextTexts, ...filledSources.contextTexts];
    sources = [...sources, ...vectorSearchResults.sources];
  }

  // If in query mode and no context chunks are found from search, backfill, or pins -  do not
  // let the LLM try to hallucinate a response or use general knowledge and exit early
  if (chatMode === "query" && contextTexts.length === 0) {
    const textResponse =
      workspace?.queryRefusalResponse ??
      "There is no relevant information in this workspace to answer your query.";
    writeResponseChunk(response, {
      id: uuid,
      type: "textResponse",
      textResponse,
      sources: [],
      close: true,
      error: null,
    });

    await updatePendingChat(
      {
        text: textResponse,
        sources: [],
        type: chatMode,
        attachments,
      },
      false
    );
    return;
  }

  // Compress & Assemble message to ensure prompt passes token limit with room for response
  // and build system messages based on inputs and history.
  // Reuse the system prompt from routing pre-fetch when available.
  const baseSystemPrompt =
    prefetchedContext?.systemPrompt ??
    (await chatPrompt(workspace, user, {
      prompt: updatedMessage,
      rawHistory,
    }));
  const systemPrompt = comparisonContext.active
    ? `${baseSystemPrompt}\n\n${comparisonContext.systemPrompt}`
    : baseSystemPrompt;
  const messages = await LLMConnector.compressMessages(
    {
      systemPrompt,
      userPrompt: updatedMessage,
      contextTexts,
      chatHistory,
      attachments,
    },
    rawHistory
  );

  // If streaming is not explicitly enabled for connector
  // we do regular waiting of a response and send a single chunk.
  if (LLMConnector.streamingEnabled() !== true) {
    console.log(
      `\x1b[31m[STREAMING DISABLED]\x1b[0m Streaming is not available for ${LLMConnector.constructor.name}. Will use regular chat method.`
    );
    const { textResponse, metrics: performanceMetrics } =
      await LLMConnector.getChatCompletion(messages, {
        temperature: workspace?.openAiTemp ?? LLMConnector.defaultTemp,
        user: user,
      });

    completeText = textResponse;
    metrics = performanceMetrics;
    writeResponseChunk(response, {
      uuid,
      sources,
      type: "textResponseChunk",
      textResponse: completeText,
      close: true,
      error: false,
      metrics,
    });
  } else {
    const stream = await LLMConnector.streamGetChatCompletion(messages, {
      temperature: workspace?.openAiTemp ?? LLMConnector.defaultTemp,
      user: user,
    });
    completeText = await LLMConnector.handleStream(response, stream, {
      uuid,
      sources,
    });
    metrics = stream.metrics;
  }

  if (completeText?.length > 0) {
    const chat = await updatePendingChat({
      text: completeText,
      sources,
      type: chatMode,
      attachments,
      metrics,
    });

    writeResponseChunk(response, {
      uuid,
      type: "finalizeResponseStream",
      close: true,
      error: false,
      chatId: chat?.id ?? null,
      metrics,
    });
    return;
  }

  const chat = await updatePendingChat({
    ...interruptedResponse,
    pending: false,
    interrupted: true,
    metrics,
  });
  writeResponseChunk(response, {
    uuid,
    sources: [],
    type: "textResponseChunk",
    textResponse: interruptedResponse.text,
    close: true,
    error: false,
    metrics,
  });
  writeResponseChunk(response, {
    uuid,
    type: "finalizeResponseStream",
    close: true,
    error: false,
    chatId: chat?.id ?? null,
    metrics,
  });
  return;
}

async function resolveLLMConnector({
  workspace,
  message,
  user,
  thread,
  attachments,
}) {
  try {
    const result = await resolveProviderConnector({
      workspace,
      prompt: message,
      user,
      thread,
      attachments,
    });
    return { ...result, error: null };
  } catch (routerError) {
    return {
      connector: null,
      routingMetadata: null,
      prefetchedContext: null,
      error: `Model router error: ${routerError.message}`,
    };
  }
}

module.exports = {
  VALID_CHAT_MODE,
  streamChatWithWorkspace,
};
