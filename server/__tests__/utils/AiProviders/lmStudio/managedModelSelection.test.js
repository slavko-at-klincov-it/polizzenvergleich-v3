const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  loadedLMStudioChatModels,
  rememberLoadedLMStudioChatModel,
  resolveLoadedLMStudioChatModel,
} = require("../../../../utils/AiProviders/lmStudio/managedModelSelection");
const {
  readChatModelState,
} = require("../../../../../shared/lmStudioChatModelState.cjs");

describe("managed LM Studio chat model selection", () => {
  const originalEnvironment = { ...process.env };
  const originalFetch = global.fetch;
  let runtimeDirectory;

  beforeEach(() => {
    runtimeDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "policy-model-state-")
    );
    process.env.POLICY_RUNTIME_DIR = runtimeDirectory;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        models: [
          {
            type: "llm",
            key: "google/gemma-4-26b-a4b",
            loaded_instances: [
              {
                id: "gemma",
                config: { context_length: 80128, parallel: 1 },
              },
            ],
          },
          {
            type: "embedding",
            key: "text-embedding-dinghy-law-4b-v1",
            loaded_instances: [
              {
                id: "dinghy-embed",
                config: { context_length: 8192 },
              },
            ],
          },
        ],
      }),
    }));
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    global.fetch = originalFetch;
    fs.rmSync(runtimeDirectory, { recursive: true, force: true });
  });

  test("lists only loaded LLM instances and excludes Dinghy", async () => {
    await expect(loadedLMStudioChatModels()).resolves.toEqual([
      expect.objectContaining({
        id: "gemma",
        modelKey: "google/gemma-4-26b-a4b",
        contextLength: 80128,
        parallel: 1,
      }),
    ]);
  });

  test("persists the alias-to-key mapping atomically for the next reboot", async () => {
    const selection = await resolveLoadedLMStudioChatModel("gemma");
    rememberLoadedLMStudioChatModel({
      selection,
      previousIdentifier: "qwen/qwen3.8-27b",
    });

    expect(readChatModelState()).toMatchObject({
      chatIdentifier: "gemma",
      chatModelKey: "google/gemma-4-26b-a4b",
      previousChatIdentifier: "qwen/qwen3.8-27b",
      previousChatIdentifiers: ["qwen/qwen3.8-27b"],
      tokenizerPath: null,
    });
    const mode = fs.statSync(path.join(runtimeDirectory, "models.json")).mode;
    expect(mode & 0o077).toBe(0);
  });

  test("retains every pending managed-model cleanup across rapid switches", () => {
    rememberLoadedLMStudioChatModel({
      selection: {
        id: "gemma",
        modelKey: "google/gemma-4-26b-a4b",
      },
      previousIdentifier: "qwen/qwen3.8-27b",
    });
    rememberLoadedLMStudioChatModel({
      selection: { id: "mistral", modelKey: "mistralai/mistral" },
      previousIdentifier: "gemma",
    });

    expect(readChatModelState()).toMatchObject({
      chatIdentifier: "mistral",
      previousChatIdentifiers: ["qwen/qwen3.8-27b", "gemma"],
    });
  });

  test("rejects embedding instances and unsafe parallelism", async () => {
    await expect(
      resolveLoadedLMStudioChatModel("dinghy-embed")
    ).rejects.toThrow("not loaded as an LLM");

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          {
            type: "llm",
            key: "google/gemma-4-26b-a4b",
            loaded_instances: [
              {
                id: "gemma",
                config: { context_length: 32768, parallel: 2 },
              },
            ],
          },
        ],
      }),
    });
    await expect(resolveLoadedLMStudioChatModel("gemma")).rejects.toThrow(
      "parallelism 1"
    );
  });
});
