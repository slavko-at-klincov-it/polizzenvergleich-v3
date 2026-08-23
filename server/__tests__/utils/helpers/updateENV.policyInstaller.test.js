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

const {
  MANAGED_EMBEDDING_ENV,
} = require("../../../../shared/managedEmbeddingContract.cjs");
const {
  resetAllVectorStores,
} = require("../../../utils/vectorStore/resetAllVectorStores");

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
    Object.assign(process.env, MANAGED_EMBEDDING_ENV);
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
});
