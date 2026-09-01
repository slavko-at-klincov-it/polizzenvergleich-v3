const {
  embedBatches,
  verifyHybridShadowRuntimeArtifacts,
  verifyLoadedEmbeddingModel,
} = require("../../../utils/policyAnalysis/hybridShadowEmbeddingClient");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

function contract() {
  return {
    provider: {
      baseUrl: "http://127.0.0.1:1234/v1",
      model: "dinghy-embed",
      dimensions: 2,
      requestTimeoutMs: 5000,
    },
    retrieval: { batchSize: 2 },
  };
}

describe("hybridShadowEmbeddingClient", () => {
  afterEach(() => jest.restoreAllMocks());

  test("requires the exact embedding model in loaded state", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "dinghy-embed",
            type: "embeddings",
            state: "not-loaded",
          },
        ],
      }),
    });

    await expect(verifyLoadedEmbeddingModel(contract())).rejects.toThrow(
      "HYBRID_SHADOW_EMBEDDING_MODEL_NOT_LOADED"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:1234/api/v0/models",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  test("persists one timing row per deterministic embedding batch", async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        model: "dinghy-embed",
        data: [
          { index: 0, embedding: [1, 0] },
          { index: 1, embedding: [0, 1] },
        ],
      })
      .mockResolvedValueOnce({
        model: "dinghy-embed",
        data: [{ index: 0, embedding: [0.5, 0.5] }],
      });
    const result = await embedBatches({
      client: { embeddings: { create } },
      contract: contract(),
      inputs: ["one", "two", "three"],
      label: "fixture",
    });

    expect(result.vectors).toEqual([
      [1, 0],
      [0, 1],
      [0.5, 0.5],
    ]);
    expect(result.requestCount).toBe(2);
    expect(result.batches).toEqual([
      expect.objectContaining({ label: "fixture", start: 0, inputCount: 2 }),
      expect.objectContaining({ label: "fixture", start: 2, inputCount: 1 }),
    ]);
  });

  test("verifies model artifacts through a streaming digest", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-hash-"));
    const modelFile = path.join(directory, "model.bin");
    const runtimeFile = path.join(directory, "runtime.bin");
    fs.writeFileSync(modelFile, "model-fixture");
    fs.writeFileSync(runtimeFile, "runtime-fixture");
    const digest = (file) =>
      crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    const checkedContract = {
      provider: {
        modelArtifactPath: modelFile,
        modelArtifactSha256: digest(modelFile),
        runtimeArtifactPath: runtimeFile,
        runtimeArtifactSha256: digest(runtimeFile),
      },
    };

    try {
      await expect(
        verifyHybridShadowRuntimeArtifacts(checkedContract)
      ).resolves.toBeUndefined();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
