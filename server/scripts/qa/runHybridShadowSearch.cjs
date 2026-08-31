#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
const {
  releaseIdentity,
} = require("../../utils/policyAnalysis/runIdentity");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");

function fail(message) {
  console.error(`[hybrid-shadow-search] ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) fail(`Ungültiges Argument: ${key}`);
    values[key.slice(2)] = value;
  }
  return values;
}

function readJson(file, label) {
  if (!file || !fs.existsSync(file)) fail(`${label} fehlt: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${label} ist kein gültiges JSON: ${error.message}`);
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function writePrivateJson(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function normalizeEmbeddingInput(value, mode) {
  const text = String(value);
  if (mode === "NONE_V1") return text;
  if (mode === "NFKC_WHITESPACE_V1")
    return text.normalize("NFKC").replace(/\s+/gu, " ").trim();
  throw new Error(`HYBRID_SHADOW_INPUT_NORMALIZATION_INVALID: ${mode}`);
}

async function embedBatches({ client, contract, inputs, label }) {
  const vectors = [];
  let requestCount = 0;
  for (
    let start = 0;
    start < inputs.length;
    start += contract.retrieval.batchSize
  ) {
    const batch = inputs.slice(start, start + contract.retrieval.batchSize);
    const response = await client.embeddings.create({
      model: contract.provider.model,
      input: batch,
      encoding_format: "float",
    });
    requestCount += 1;
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
  }
  return { vectors, requestCount };
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set([
    "worksheet",
    "documentArtifact",
    "contractFile",
    "runManifest",
    "expectedContractSha256",
    "output",
  ]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of [
    "worksheet",
    "documentArtifact",
    "contractFile",
    "runManifest",
    "output",
  ])
    if (!args[required]) fail(`--${required} ist erforderlich`);

  const worksheetFile = path.resolve(args.worksheet);
  const documentArtifactFile = path.resolve(args.documentArtifact);
  const contractFile = args.contractFile;
  const runManifestFile = path.resolve(args.runManifest);
  const outputDirectory = path.resolve(args.output);
  const worksheet = readJson(worksheetFile, "Primär-Worksheet");
  const documentArtifact = readJson(
    documentArtifactFile,
    "Dokument-Artefakt"
  );
  const runManifest = readJson(runManifestFile, "Shadow-Laufmanifest");

  const {
    buildHybridShadowTargets,
    buildHybridShadowWorksheet,
    exactSourceSpansFromNavigationChunk,
    loadHybridShadowContract,
  } = require("../../utils/policyAnalysis/hybridShadowSearch");
  const {
    buildPageAwareRetrievalChunks,
    rankChunksForTargets,
  } = require("../../utils/policyAnalysis/hybridCandidateFallback");

  const { contract, identity } = loadHybridShadowContract(contractFile);
  if (
    args.expectedContractSha256 &&
    identity.contractSha256 !== args.expectedContractSha256
  )
    fail("Der Shadow-Vertrag stimmt nicht mehr mit der Laufidentität überein");
  if (!contract.enabled) fail("Der explizite Shadow-Vertrag ist deaktiviert");
  if (
    !fs.existsSync(contract.provider.modelArtifactPath) ||
    !fs.statSync(contract.provider.modelArtifactPath).isFile()
  )
    fail(`Embedding-Modellartefakt fehlt: ${contract.provider.modelArtifactPath}`);
  if (
    !fs.existsSync(contract.provider.runtimeArtifactPath) ||
    !fs.statSync(contract.provider.runtimeArtifactPath).isFile()
  )
    fail(`Embedding-Runtimeartefakt fehlt: ${contract.provider.runtimeArtifactPath}`);
  if (
    sha256File(contract.provider.modelArtifactPath) !==
    contract.provider.modelArtifactSha256
  )
    fail("Embedding-Modellartefakt stimmt nicht mit dem Shadow-Vertrag überein");
  if (
    sha256File(contract.provider.runtimeArtifactPath) !==
    contract.provider.runtimeArtifactSha256
  )
    fail("Embedding-Runtimeartefakt stimmt nicht mit dem Shadow-Vertrag überein");
  const document = documentArtifact?.document;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    !document ||
    document.sourceDocumentId !== worksheet.document?.fingerprint ||
    documentArtifact.fingerprint !== worksheet.document?.fingerprint
  )
    fail("Dokument-Artefakt und Primär-Worksheet haben nicht dieselbe Identität");
  const primaryWorksheetSha256 = sha256File(worksheetFile);
  const documentArtifactSha256 = sha256File(documentArtifactFile);
  const manifestCategory = runManifest?.categories?.find(
    ({ categoryView }) => categoryView === worksheet.catalog?.categoryView
  );
  if (
    runManifest?.runKind !== "HYBRID_SHADOW_RECALL_QA" ||
    runManifest.shadowOnly !== true ||
    runManifest.primaryMutationAllowed !== false ||
    runManifest.resumeAllowed !== false ||
    runManifest.shadowImplementation?.repository !== REPOSITORY_ROOT ||
    runManifest.shadowImplementation?.releaseId !==
      releaseIdentity(REPOSITORY_ROOT) ||
    runManifest.contract?.contractSha256 !== identity.contractSha256 ||
    runManifest.primaryRun?.documentArtifactSha256 !==
      documentArtifactSha256 ||
    !manifestCategory ||
    path.resolve(manifestCategory.worksheetPath) !== worksheetFile ||
    manifestCategory.worksheetSha256 !== primaryWorksheetSha256
  )
    fail("Shadow-Laufmanifest und Eingabeartefakte sind identitätsfremd");

  const targets = buildHybridShadowTargets({ worksheet, contract });
  let chunks = [];
  let navigationRankedTargets = targets.map((target) => ({
    ...target,
    chunks: [],
  }));
  let rankedTargets = targets.map((target) => ({ ...target, spans: [] }));
  let embeddingRequestCount = 0;
  let exactSpanCount = 0;
  if (targets.length > 0) {
    chunks = await buildPageAwareRetrievalChunks({
      document,
      chunkSize: contract.retrieval.chunkSize,
      chunkOverlap: contract.retrieval.chunkOverlap,
    });
    if (chunks.length === 0)
      throw new Error("HYBRID_SHADOW_DOCUMENT_HAS_NO_RETRIEVAL_CHUNKS");
    const apiKey = contract.provider.apiKeyEnv
      ? process.env[contract.provider.apiKeyEnv]
      : "hybrid-shadow-no-api-key";
    if (contract.provider.apiKeyEnv && !apiKey)
      throw new Error(
        `HYBRID_SHADOW_API_KEY_MISSING: ${contract.provider.apiKeyEnv}`
      );
    const client = new OpenAI({
      baseURL: contract.provider.baseUrl,
      apiKey,
      timeout: contract.provider.requestTimeoutMs,
      maxRetries: 0,
    });
    const availableModels = await client.models.list();
    if (
      !Array.isArray(availableModels?.data) ||
      !availableModels.data.some(({ id }) => id === contract.provider.model)
    )
      throw new Error(
        `HYBRID_SHADOW_EMBEDDING_MODEL_NOT_LOADED: ${contract.provider.model}`
      );
    const targetEmbeddings = await embedBatches({
      client,
      contract,
      inputs: targets.map(({ query }) =>
        normalizeEmbeddingInput(query, contract.provider.inputNormalization)
      ),
      label: "targets",
    });
    const chunkEmbeddings = await embedBatches({
      client,
      contract,
      inputs: chunks.map(({ text }) =>
        normalizeEmbeddingInput(text, contract.provider.inputNormalization)
      ),
      label: "chunks",
    });
    navigationRankedTargets = rankChunksForTargets({
      targets,
      chunks,
      targetVectors: targetEmbeddings.vectors,
      chunkVectors: chunkEmbeddings.vectors,
    });
    const exactSpansByTarget = navigationRankedTargets.map((target) => {
      const unique = new Map();
      for (const navigationChunk of target.chunks) {
        for (const span of exactSourceSpansFromNavigationChunk({
          document,
          navigationChunk,
        })) {
          if (!unique.has(span.id)) unique.set(span.id, span);
        }
      }
      return { target, spans: [...unique.values()] };
    });
    const uniqueExactSpans = new Map();
    for (const { spans } of exactSpansByTarget)
      for (const span of spans)
        if (!uniqueExactSpans.has(span.id)) uniqueExactSpans.set(span.id, span);
    const exactSpans = [...uniqueExactSpans.values()];
    exactSpanCount = exactSpans.length;
    const exactSpanEmbeddings = await embedBatches({
      client,
      contract,
      inputs: exactSpans.map(({ text }) =>
        normalizeEmbeddingInput(text, contract.provider.inputNormalization)
      ),
      label: "exact-spans",
    });
    const exactVectorById = new Map(
      exactSpans.map((span, index) => [
        span.id,
        exactSpanEmbeddings.vectors[index],
      ])
    );
    rankedTargets = exactSpansByTarget.map(({ target, spans }, targetIndex) => {
      const ranked = rankChunksForTargets({
        targets: [target],
        chunks: spans,
        targetVectors: [targetEmbeddings.vectors[targetIndex]],
        chunkVectors: spans.map((span) => exactVectorById.get(span.id)),
      })[0];
      return { ...target, spans: ranked.chunks };
    });
    embeddingRequestCount =
      targetEmbeddings.requestCount +
      chunkEmbeddings.requestCount +
      exactSpanEmbeddings.requestCount;
  }

  const shadowWorksheet = buildHybridShadowWorksheet({
    primaryWorksheet: worksheet,
    document,
    rankedTargets,
    contractIdentity: identity,
    primaryWorksheetSha256,
    documentArtifactSha256,
  });
  const worksheetOutput = path.join(
    outputDirectory,
    "worksheet.shadow.private.json"
  );
  writePrivateJson(worksheetOutput, shadowWorksheet);
  const acceptedCandidateCount = shadowWorksheet.summary.occurrenceCount;
  const report = {
    schemaVersion: 1,
    artifactKind: "HYBRID_SHADOW_SEARCH_REPORT",
    status: targets.length === 0 ? "PASS_NO_ELIGIBLE_COMPONENTS" : "PASS",
    shadowOnly: true,
    primaryMutationAllowed: false,
    contract: identity,
    runtimeVerification: {
      modelIdReportedByEmbeddingResponse:
        targets.length > 0 ? contract.provider.model : null,
      modelArtifactSha256: contract.provider.modelArtifactSha256,
      runtimeRevision: contract.provider.runtimeRevision,
      runtimeArtifactSha256: contract.provider.runtimeArtifactSha256,
      inputNormalization: contract.provider.inputNormalization,
    },
    contracts: {
      shadowRunManifestPath: runManifestFile,
      shadowRunManifestSha256: sha256File(runManifestFile),
      primaryWorksheetPath: worksheetFile,
      primaryWorksheetSha256,
      documentArtifactPath: documentArtifactFile,
      documentArtifactSha256,
      shadowWorksheetPath: worksheetOutput,
      shadowWorksheetSha256: sha256File(worksheetOutput),
    },
    input: {
      eligibleZeroPrimaryComponentCount: targets.length,
      navigationChunkCount: chunks.length,
      exactSpanCount,
      embeddingRequestCount,
    },
    output: {
      rankedExactSpanCount: rankedTargets.reduce(
        (sum, target) => sum + target.spans.length,
        0
      ),
      acceptedCandidateCount,
      minimumScore: contract.retrieval.minimumScore,
    },
    navigationRankings: navigationRankedTargets.map((target) => ({
      targetId: target.id,
      requirementId: target.requirementId,
      componentId: target.componentId,
      chunks: target.chunks.map((chunk) => ({
        navigationChunkId: chunk.id,
        score: chunk.score,
        physicalPageNumber: chunk.physicalPageNumber,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        documentStart: chunk.documentStart,
        documentEnd: chunk.documentEnd,
      })),
    })),
    exactSpanRankings: rankedTargets.map((target) => ({
      targetId: target.id,
      requirementId: target.requirementId,
      componentId: target.componentId,
      querySha256: sha256(target.query),
      spans: target.spans.map((span) => ({
        exactSpanId: span.id,
        navigationChunkId: span.navigationChunkId,
        navigationScore: span.navigationScore,
        score: span.score,
        accepted: span.score >= contract.retrieval.minimumScore,
        physicalPageNumber: span.physicalPageNumber,
        pageStart: span.pageStart,
        pageEnd: span.pageEnd,
        documentStart: span.documentStart,
        documentEnd: span.documentEnd,
        exactQuoteSha256: sha256(span.text),
      })),
    })),
  };
  writePrivateJson(path.join(outputDirectory, "search-report.json"), report);
  console.log(
    `[hybrid-shadow-search] ${report.status}: ${acceptedCandidateCount} Shadow-Kandidaten für ${targets.length} Nulltreffer-Komponenten`
  );
}

run().catch((error) => fail(error.stack || error.message));
