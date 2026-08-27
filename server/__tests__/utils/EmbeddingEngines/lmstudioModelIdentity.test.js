const {
  LMStudioEmbedder,
} = require("../../../utils/EmbeddingEngines/lmstudio");

describe("LMStudioEmbedder model identity", () => {
  const originalEnvironment = {
    basePath: process.env.EMBEDDING_BASE_PATH,
    model: process.env.EMBEDDING_MODEL_PREF,
    maxLength: process.env.EMBEDDING_MODEL_MAX_CHUNK_LENGTH,
  };

  beforeEach(() => {
    process.env.EMBEDDING_BASE_PATH = "http://127.0.0.1:1234/v1";
    process.env.EMBEDDING_MODEL_PREF = "expected-embedding-model";
    process.env.EMBEDDING_MODEL_MAX_CHUNK_LENGTH = "8192";
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const [key, value] of Object.entries({
      EMBEDDING_BASE_PATH: originalEnvironment.basePath,
      EMBEDDING_MODEL_PREF: originalEnvironment.model,
      EMBEDDING_MODEL_MAX_CHUNK_LENGTH: originalEnvironment.maxLength,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function embedderWithResponse(model) {
    const embedder = new LMStudioEmbedder();
    embedder.lmstudio = {
      models: { list: jest.fn().mockResolvedValue({ data: [{ id: model }] }) },
      embeddings: {
        create: jest.fn().mockResolvedValue({
          model,
          data: [{ embedding: [0.1, 0.2] }],
        }),
      },
    };
    return embedder;
  }

  test("accepts only the exact requested response model", async () => {
    await expect(
      embedderWithResponse("expected-embedding-model").embedTextInput("test")
    ).resolves.toEqual([0.1, 0.2]);
  });

  test("rejects a response from another or unnamed embedding model", async () => {
    await expect(
      embedderWithResponse("other-embedding-model").embedTextInput("test")
    ).rejects.toThrow("EMBEDDING_MODEL_MISMATCH");
  });
});
