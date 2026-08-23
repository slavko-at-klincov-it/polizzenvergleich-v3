const MANAGED_QUERY_PREFIX =
  "Instruct: Retrieve all relevant passages from German and Austrian insurance contracts for exact clause comparison, including deductibles, exclusions, limits, monetary amounts, percentages, conditions, and synonymous wording.";

const MANAGED_EMBEDDING_ENV = Object.freeze({
  POLICY_MANAGED_EMBEDDING: "true",
  EMBEDDING_ENGINE: "lmstudio",
  EMBEDDING_BASE_PATH: "http://127.0.0.1:1234/v1",
  EMBEDDING_MODEL_PREF: "dinghy-embed",
  EMBEDDING_MODEL_MAX_CHUNK_LENGTH: "8192",
  EMBEDDING_QUERY_PREFIX: MANAGED_QUERY_PREFIX,
  VECTOR_DB: "lancedb",
});

const EXPECTED_EMBEDDING_DIMENSIONS = 2560;

const MANAGED_UPDATE_VALUES = Object.freeze({
  EmbeddingEngine: MANAGED_EMBEDDING_ENV.EMBEDDING_ENGINE,
  EmbeddingBasePath: MANAGED_EMBEDDING_ENV.EMBEDDING_BASE_PATH,
  EmbeddingModelPref: MANAGED_EMBEDDING_ENV.EMBEDDING_MODEL_PREF,
  EmbeddingModelMaxChunkLength:
    MANAGED_EMBEDDING_ENV.EMBEDDING_MODEL_MAX_CHUNK_LENGTH,
  VectorDB: MANAGED_EMBEDDING_ENV.VECTOR_DB,
});

function managedEmbeddingEnabled(environment = process.env) {
  return environment.POLICY_MANAGED_EMBEDDING === "true";
}

function embeddingContractProblems(environment = process.env) {
  return Object.entries(MANAGED_EMBEDDING_ENV)
    .filter(([key, expected]) => String(environment[key] || "") !== expected)
    .map(([key, expected]) => `${key} must be ${JSON.stringify(expected)}.`);
}

function assertManagedEmbeddingEnvironment(environment = process.env) {
  const problems = embeddingContractProblems(environment);
  if (problems.length > 0)
    throw new Error(`Managed Dinghy configuration mismatch: ${problems.join(" ")}`);
  return true;
}

function rejectManagedEmbeddingUpdate(key, _previous, nextValue) {
  if (!managedEmbeddingEnabled()) return null;
  if (!Object.prototype.hasOwnProperty.call(MANAGED_UPDATE_VALUES, key))
    return null;
  const expected = MANAGED_UPDATE_VALUES[key];
  return String(nextValue) === expected
    ? null
    : `${key} ist in dieser Installation auf ${expected} festgelegt, damit der bestehende 2560-dimensionale LanceDB-Index nicht beschädigt wird.`;
}

function assertManagedEmbeddingVector(vector) {
  if (!managedEmbeddingEnabled()) return true;
  if (!Array.isArray(vector) || vector.length !== EXPECTED_EMBEDDING_DIMENSIONS)
    throw new Error(
      `Dinghy embedding dimension mismatch: expected ${EXPECTED_EMBEDDING_DIMENSIONS}, received ${Array.isArray(vector) ? vector.length : "invalid"}. LanceDB was not opened.`
    );
  return true;
}

module.exports = {
  MANAGED_QUERY_PREFIX,
  MANAGED_EMBEDDING_ENV,
  MANAGED_UPDATE_VALUES,
  EXPECTED_EMBEDDING_DIMENSIONS,
  managedEmbeddingEnabled,
  embeddingContractProblems,
  assertManagedEmbeddingEnvironment,
  rejectManagedEmbeddingUpdate,
  assertManagedEmbeddingVector,
};
