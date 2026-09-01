const crypto = require("crypto");
const fs = require("fs");
const { performance } = require("perf_hooks");
const { OpenAI } = require("openai");

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function verifyHybridShadowRuntimeArtifacts(contract) {
  for (const [label, file, expectedSha256] of [
    [
      "EMBEDDING_MODEL",
      contract.provider.modelArtifactPath,
      contract.provider.modelArtifactSha256,
    ],
    [
      "EMBEDDING_RUNTIME",
      contract.provider.runtimeArtifactPath,
      contract.provider.runtimeArtifactSha256,
    ],
  ]) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile())
      throw new Error(`HYBRID_SHADOW_${label}_ARTIFACT_MISSING: ${file}`);
    if (sha256File(file) !== expectedSha256)
      throw new Error(`HYBRID_SHADOW_${label}_ARTIFACT_SHA256_MISMATCH`);
  }
}

function normalizeEmbeddingInput(value, mode) {
  const text = String(value);
  if (mode === "NONE_V1") return text;
  if (mode === "NFKC_WHITESPACE_V1")
    return text.normalize("NFKC").replace(/\s+/gu, " ").trim();
  throw new Error(`HYBRID_SHADOW_INPUT_NORMALIZATION_INVALID: ${mode}`);
}

function createEmbeddingClient(contract) {
  const apiKey = contract.provider.apiKeyEnv
    ? process.env[contract.provider.apiKeyEnv]
    : "hybrid-shadow-no-api-key";
  if (contract.provider.apiKeyEnv && !apiKey)
    throw new Error(
      `HYBRID_SHADOW_API_KEY_MISSING: ${contract.provider.apiKeyEnv}`
    );
  return new OpenAI({
    baseURL: contract.provider.baseUrl,
    apiKey,
    timeout: contract.provider.requestTimeoutMs,
    maxRetries: 0,
  });
}

async function verifyLoadedEmbeddingModel(contract) {
  const apiRoot = contract.provider.baseUrl.replace(/\/v1\/?$/u, "");
  const response = await fetch(`${apiRoot}/api/v0/models`, {
    signal: AbortSignal.timeout(contract.provider.requestTimeoutMs),
  });
  if (!response.ok)
    throw new Error(
      `HYBRID_SHADOW_RUNTIME_MODEL_LIST_FAILED: ${response.status}`
    );
  const body = await response.json();
  const loaded = body?.data?.find(
    ({ id, type, state }) =>
      id === contract.provider.model &&
      type === "embeddings" &&
      state === "loaded"
  );
  if (!loaded)
    throw new Error(
      `HYBRID_SHADOW_EMBEDDING_MODEL_NOT_LOADED: ${contract.provider.model}`
    );
  return {
    id: loaded.id,
    type: loaded.type,
    state: loaded.state,
    loadedContextLength: Number(loaded.loaded_context_length || 0) || null,
    compatibilityType: loaded.compatibility_type || null,
  };
}

async function embedBatches({ client, contract, inputs, label }) {
  const vectors = [];
  const batches = [];
  const responseModels = new Set();
  for (
    let start = 0;
    start < inputs.length;
    start += contract.retrieval.batchSize
  ) {
    const batch = inputs.slice(start, start + contract.retrieval.batchSize);
    const started = performance.now();
    const response = await client.embeddings.create({
      model: contract.provider.model,
      input: batch,
      encoding_format: "float",
    });
    const durationMs = performance.now() - started;
    responseModels.add(response.model || "");
    if (response.model !== contract.provider.model)
      throw new Error(
        `HYBRID_SHADOW_EMBEDDING_MODEL_MISMATCH: erwartet ${contract.provider.model}, erhalten ${response.model || "NICHT_GEMELDET"}`
      );
    const rows = [...(response.data || [])].sort(
      (left, right) => left.index - right.index
    );
    if (
      rows.length !== batch.length ||
      rows.some(
        (row, index) =>
          row.index !== index ||
          !Array.isArray(row.embedding) ||
          row.embedding.length !== contract.provider.dimensions ||
          row.embedding.some((value) => !Number.isFinite(value))
      )
    )
      throw new Error(
        `HYBRID_SHADOW_EMBEDDING_BATCH_INVALID: ${label}:${start}`
      );
    vectors.push(...rows.map((row) => row.embedding));
    batches.push({
      label,
      start,
      inputCount: batch.length,
      durationMs,
      responseModel: response.model,
    });
  }
  return {
    vectors,
    requestCount: batches.length,
    durationMs: batches.reduce((sum, batch) => sum + batch.durationMs, 0),
    batches,
    responseModels: [...responseModels],
  };
}

module.exports = {
  createEmbeddingClient,
  embedBatches,
  normalizeEmbeddingInput,
  verifyHybridShadowRuntimeArtifacts,
  verifyLoadedEmbeddingModel,
};
