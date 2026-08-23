jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  writeFileSync: jest.fn(),
}));
jest.mock("../../../utils/vectorStore/resetAllVectorStores", () => ({
  resetAllVectorStores: jest.fn(),
}));
jest.mock("../../../models/eventLogs", () => ({
  EventLogs: { logEvent: jest.fn() },
}));
jest.mock("../../../utils/AiProviders/lmStudio/managedModelSelection", () => ({
  resolveLoadedLMStudioChatModel: jest.fn(async (identifier) => {
    if (identifier === "dinghy-embed") throw new Error("not loaded as an LLM");
    return {
      id: identifier,
      modelKey:
        identifier === "gemma" ? "google/gemma-4-26b-a4b" : "qwen/qwen3.8-27b",
      contextLength: identifier === "gemma" ? 80128 : 42496,
      parallel: 1,
    };
  }),
  rememberLoadedLMStudioChatModel: jest.fn(),
}));

const {
  MANAGED_EMBEDDING_ENV,
} = require("../../../../shared/managedEmbeddingContract.cjs");
const {
  resetAllVectorStores,
} = require("../../../utils/vectorStore/resetAllVectorStores");
const {
  rememberLoadedLMStudioChatModel,
  resolveLoadedLMStudioChatModel,
} = require("../../../utils/AiProviders/lmStudio/managedModelSelection");

describe("installer-managed environment persistence", () => {
  const managed = {
    SERVER_HOST: "127.0.0.1",
    COLLECTOR_HOST: "127.0.0.1",
    COLLECTOR_API_HOST: "127.0.0.1",
    COLLECTOR_HOTDIR_PATH: "/private/hotdir",
    MODEL_TOKENIZER_PATH: "/private/model",
    MODEL_TOKENIZER_LABEL: "Gemma 4",
    EMBEDDING_QUERY_PREFIX: "Instruct: policy retrieval",
    ...MANAGED_EMBEDDING_ENV,
  };

  afterEach(() => {
    for (const key of Object.keys(managed)) delete process.env[key];
    require("fs").writeFileSync.mockClear();
    resetAllVectorStores.mockClear();
    rememberLoadedLMStudioChatModel.mockClear();
    resolveLoadedLMStudioChatModel.mockClear();
  });

  it("keeps fork-specific settings when AnythingLLM dumps .env", () => {
    Object.assign(process.env, managed);
    const { dumpENV } = require("../../../utils/helpers/updateENV");
    dumpENV();
    const content = require("fs").writeFileSync.mock.calls[0][1];
    for (const [key, value] of Object.entries(managed)) {
      expect(content).toContain(`${key}='${value}'`);
    }
  });

  it.each([
    ["EmbeddingEngine", "native"],
    ["EmbeddingBasePath", "http://127.0.0.1:9999/v1"],
    ["EmbeddingModelPref", "Xenova/all-MiniLM-L6-v2"],
    ["EmbeddingModelMaxChunkLength", "512"],
    ["VectorDB", "qdrant"],
  ])("rejects destructive managed setting drift for %s", async (key, value) => {
    Object.assign(process.env, MANAGED_EMBEDDING_ENV);
    const before = { ...process.env };
    const { updateENV } = require("../../../utils/helpers/updateENV");

    const result = await updateENV({ [key]: value });

    expect(result.error).toContain("2560-dimensionale LanceDB-Index");
    expect(result.newValues).toEqual({});
    expect(resetAllVectorStores).not.toHaveBeenCalled();
    for (const [envKey, expected] of Object.entries(MANAGED_EMBEDDING_ENV))
      expect(process.env[envKey]).toBe(before[envKey] || expected);
  });

  it("accepts idempotent writes of the exact managed values without a reset", async () => {
    Object.assign(process.env, MANAGED_EMBEDDING_ENV, {
      LLM_PROVIDER: "lmstudio",
      LMSTUDIO_BASE_PATH: "http://127.0.0.1:1234/v1",
    });
    const { updateENV } = require("../../../utils/helpers/updateENV");
    const result = await updateENV({
      EmbeddingEngine: MANAGED_EMBEDDING_ENV.EMBEDDING_ENGINE,
      EmbeddingModelPref: MANAGED_EMBEDDING_ENV.EMBEDDING_MODEL_PREF,
      VectorDB: MANAGED_EMBEDDING_ENV.VECTOR_DB,
    });
    expect(result.error).toBe(false);
    expect(resetAllVectorStores).not.toHaveBeenCalled();
  });

  it("rejects a mixed settings request before mutating unrelated values", async () => {
    Object.assign(process.env, MANAGED_EMBEDDING_ENV, {
      LLM_PROVIDER: "lmstudio",
    });
    const { updateENV } = require("../../../utils/helpers/updateENV");

    const result = await updateENV({
      LLMProvider: "openai",
      EmbeddingEngine: "native",
    });

    expect(result.newValues).toEqual({});
    expect(result.error).toContain("2560-dimensionale LanceDB-Index");
    expect(process.env.LLM_PROVIDER).toBe("lmstudio");
    expect(process.env.EMBEDDING_ENGINE).toBe("lmstudio");
    expect(resetAllVectorStores).not.toHaveBeenCalled();
    delete process.env.LLM_PROVIDER;
  });

  it("persists a loaded alternative chat model without touching Dinghy or LanceDB", async () => {
    Object.assign(process.env, MANAGED_EMBEDDING_ENV, {
      LLM_PROVIDER: "lmstudio",
      LMSTUDIO_BASE_PATH: "http://127.0.0.1:1234/v1",
      LMSTUDIO_MODEL_PREF: "qwen/qwen3.8-27b",
      LMSTUDIO_MODEL_TOKEN_LIMIT: "32768",
      MODEL_TOKENIZER_PATH: "/models/qwen",
      MODEL_TOKENIZER_LABEL: "Qwen",
    });
    const { updateENV } = require("../../../utils/helpers/updateENV");

    const result = await updateENV({
      LLMProvider: "lmstudio",
      LMStudioBasePath: "http://127.0.0.1:1234/v1",
      LMStudioModelPref: "gemma",
      LMStudioTokenLimit: "42496",
    });

    expect(result.error).toBe(false);
    expect(process.env.LMSTUDIO_MODEL_PREF).toBe("gemma");
    expect(process.env.LMSTUDIO_MODEL_TOKEN_LIMIT).toBe("42496");
    expect(process.env.MODEL_TOKENIZER_PATH).toBeUndefined();
    expect(process.env.MODEL_TOKENIZER_LABEL).toBeUndefined();
    expect(rememberLoadedLMStudioChatModel).toHaveBeenCalledWith({
      selection: expect.objectContaining({
        id: "gemma",
        modelKey: "google/gemma-4-26b-a4b",
      }),
      previousIdentifier: "qwen/qwen3.8-27b",
    });
    expect(resolveLoadedLMStudioChatModel).toHaveBeenCalledWith("gemma", {
      basePath: "http://127.0.0.1:1234/v1",
    });
    expect(resetAllVectorStores).not.toHaveBeenCalled();
    expect(process.env.EMBEDDING_MODEL_PREF).toBe("dinghy-embed");
  });

  it("rejects embedding aliases, unsafe providers and invalid model contexts", async () => {
    Object.assign(process.env, MANAGED_EMBEDDING_ENV, {
      LLM_PROVIDER: "lmstudio",
      LMSTUDIO_BASE_PATH: "http://127.0.0.1:1234/v1",
      LMSTUDIO_MODEL_PREF: "qwen/qwen3.8-27b",
      LMSTUDIO_MODEL_TOKEN_LIMIT: "32768",
    });
    const { updateENV } = require("../../../utils/helpers/updateENV");

    await expect(updateENV({ LLMProvider: "openai" })).resolves.toMatchObject({
      error: expect.stringContaining("LM Studio"),
    });
    await expect(
      updateENV({ LMStudioModelPref: "dinghy-embed" })
    ).resolves.toMatchObject({
      error: expect.stringContaining("not loaded as an LLM"),
    });
    await expect(
      updateENV({ LMStudioTokenLimit: "2048" })
    ).resolves.toMatchObject({ error: expect.stringContaining("4096") });
    await expect(
      updateENV({ LMStudioModelPref: "gemma", LMStudioTokenLimit: "90000" })
    ).resolves.toMatchObject({
      error: expect.stringContaining("größer als"),
    });
    expect(resetAllVectorStores).not.toHaveBeenCalled();
  });
});
