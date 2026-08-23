const {
  pendingChatIdentifiers,
  readChatModelState,
  writeChatModelState,
} = require("../../../../shared/lmStudioChatModelState.cjs");

const REQUEST_TIMEOUT_MS = 10_000;

function nativeModelsEndpoint(basePath = process.env.LMSTUDIO_BASE_PATH) {
  const endpoint = new URL(basePath || "http://127.0.0.1:1234/v1");
  endpoint.pathname = "/api/v1/models";
  endpoint.search = "";
  return endpoint;
}

async function loadedLMStudioChatModels({
  basePath = process.env.LMSTUDIO_BASE_PATH,
  apiKey = process.env.LMSTUDIO_AUTH_TOKEN,
} = {}) {
  const response = await fetch(nativeModelsEndpoint(basePath), {
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(
      `LM Studio model metadata is unavailable (${response.status}).`
    );

  const payload = await response.json();
  return (Array.isArray(payload?.models) ? payload.models : [])
    .filter((model) => String(model?.type || "").toLowerCase() === "llm")
    .flatMap((model) =>
      (Array.isArray(model?.loaded_instances)
        ? model.loaded_instances
        : []
      ).map((instance) => ({
        id: instance?.id,
        name:
          instance?.id === model?.key
            ? model?.key
            : `${model?.key} (${instance?.id})`,
        organization: "lmstudio",
        modelKey: model?.key,
        contextLength: Number(instance?.config?.context_length),
        parallel: Number(instance?.config?.parallel),
      }))
    )
    .filter((model) => model.id && model.modelKey);
}

async function resolveLoadedLMStudioChatModel(identifier, options = {}) {
  const selected = (await loadedLMStudioChatModels(options)).find(
    (model) => model.id === identifier
  );
  if (!selected)
    throw new Error(
      `Chat model '${identifier}' is not loaded as an LLM in LM Studio.`
    );
  if (!Number.isFinite(selected.contextLength))
    throw new Error(`Chat model '${identifier}' has no runtime context.`);
  if (selected.parallel !== 1)
    throw new Error(
      `Chat model '${identifier}' must be loaded with parallelism 1.`
    );
  return selected;
}

function rememberLoadedLMStudioChatModel({
  selection,
  previousIdentifier = null,
}) {
  const current = readChatModelState();
  const changed = current.chatIdentifier !== selection.id;
  const pendingIdentifiers = [
    ...pendingChatIdentifiers(current),
    previousIdentifier,
  ]
    .map((identifier) => String(identifier || "").trim())
    .filter(
      (identifier, index, values) =>
        Boolean(identifier) &&
        identifier !== selection.id &&
        values.indexOf(identifier) === index
    );
  return writeChatModelState({
    chatIdentifier: selection.id,
    chatModelKey: selection.modelKey,
    chatIndexedModelIdentifier: changed
      ? null
      : current.chatIndexedModelIdentifier || null,
    previousChatIdentifiers: pendingIdentifiers,
    // Preserve the old singular field until every installed customer has run
    // at least one model-job cycle with the new state format.
    previousChatIdentifier: pendingIdentifiers[0] || null,
    tokenizerPath: changed ? null : current.tokenizerPath || null,
  });
}

module.exports = {
  loadedLMStudioChatModels,
  nativeModelsEndpoint,
  rememberLoadedLMStudioChatModel,
  resolveLoadedLMStudioChatModel,
};
