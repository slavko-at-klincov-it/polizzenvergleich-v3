#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

function fail(message) {
  console.error(`[pdf-provenance-live] ${message}`);
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

const cliArguments = parseArguments(process.argv.slice(2));
const pdfPath = path.resolve(cliArguments.pdf || "");
const outputPath = path.resolve(cliArguments.output || "");

if (!pdfPath || !fs.existsSync(pdfPath)) fail(`PDF fehlt: ${pdfPath}`);
if (path.extname(pdfPath).toLowerCase() !== ".pdf")
  fail(`Nur PDF-Dateien sind erlaubt: ${pdfPath}`);
if (!cliArguments.output) fail("--output ist erforderlich");

fs.mkdirSync(outputPath, { recursive: true, mode: 0o700 });
fs.chmodSync(outputPath, 0o700);
const storagePath = path.join(outputPath, "storage");
fs.mkdirSync(storagePath, { recursive: true, mode: 0o700 });
fs.chmodSync(storagePath, 0o700);

process.env.NODE_ENV = "production";
process.env.STORAGE_DIR = storagePath;
process.env.VECTOR_DB = "lancedb";
process.env.EMBEDDING_ENGINE = "lmstudio";
process.env.EMBEDDING_BASE_PATH =
  process.env.EMBEDDING_BASE_PATH || "http://127.0.0.1:1234/v1";
process.env.EMBEDDING_MODEL_PREF = process.env.EMBEDDING_MODEL_PREF || "";
if (!process.env.EMBEDDING_MODEL_PREF)
  fail(
    "EMBEDDING_MODEL_PREF ist für diesen historischen Legacy-Runner explizit erforderlich; V3.5.0 lädt kein Embeddingmodell mehr"
  );
process.env.EMBEDDING_MODEL_MAX_CHUNK_LENGTH =
  process.env.EMBEDDING_MODEL_MAX_CHUNK_LENGTH || "8192";
process.env.LLM_PROVIDER = "lmstudio";
process.env.LMSTUDIO_BASE_PATH =
  process.env.LMSTUDIO_BASE_PATH || "http://127.0.0.1:1234/v1";
process.env.LMSTUDIO_MODEL_PREF =
  process.env.LMSTUDIO_MODEL_PREF || "qwen/qwen3.6-35b-a3b";
process.env.LMSTUDIO_MODEL_TOKEN_LIMIT =
  process.env.LMSTUDIO_MODEL_TOKEN_LIMIT || "42496";

const repositoryRoot = path.resolve(__dirname, "../../..");
const parsePdf = require(
  path.join(repositoryRoot, "collector/processSingleFile/convert/asPDF")
);
const { PageAwareTextSplitter } = require(
  path.join(repositoryRoot, "server/utils/PageAwareTextSplitter")
);
const { LMStudioEmbedder } = require(
  path.join(repositoryRoot, "server/utils/EmbeddingEngines/lmstudio")
);
const { LMStudioLLM } = require(
  path.join(repositoryRoot, "server/utils/AiProviders/lmStudio")
);
const { LanceDb } = require(
  path.join(repositoryRoot, "server/utils/vectorDbProviders/lance")
);
const { materializeProvenance } = require(
  path.join(repositoryRoot, "server/utils/vectorDbProviders/lance/provenance")
);
const {
  extractCategoryDefinitions,
  extractRequiredNotice,
  validateCategoryOutput,
} = require("./categoryOutputContract.cjs");

const systemPromptPath = path.resolve(cliArguments.systemPromptFile || "");
if (!cliArguments.systemPromptFile || !fs.existsSync(systemPromptPath))
  fail(`Systemprompt fehlt: ${systemPromptPath}`);
if (!cliArguments.userPrompt) fail("--userPrompt ist erforderlich");

const SYSTEM_PROMPT = fs.readFileSync(systemPromptPath, "utf8");
const USER_PROMPT = cliArguments.userPrompt;
const RETRIEVAL_QUERY = cliArguments.retrievalQuery || USER_PROMPT;
const CATEGORY_DEFINITIONS = extractCategoryDefinitions(SYSTEM_PROMPT);
const REQUIRED_NOTICE = extractRequiredNotice(SYSTEM_PROMPT);
if (CATEGORY_DEFINITIONS.length === 0)
  fail("Der Systemprompt enthält keinen lesbaren Kategorienkatalog.");
if (!REQUIRED_NOTICE)
  fail("Der Systemprompt enthält keinen lesbaren verbindlichen Hinweis.");

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function stripChunkHeader(text) {
  const marker = "</document_metadata>\n\n";
  const markerIndex = text.indexOf(marker);
  return markerIndex === -1 ? text : text.slice(markerIndex + marker.length);
}

function writeJson(fileName, value) {
  fs.writeFileSync(
    path.join(outputPath, fileName),
    JSON.stringify(value, null, 2),
    { encoding: "utf8", mode: 0o600 }
  );
  fs.chmodSync(path.join(outputPath, fileName), 0o600);
}

async function main() {
  const startedAt = new Date();
  const fileName = path.basename(pdfPath);
  const pdfSha256 = sha256File(pdfPath);
  const documentId = `live-${pdfSha256.slice(0, 24)}`;
  const namespace = `live_${pdfSha256.slice(0, 16)}`;
  const chunkSize = Number(cliArguments.chunkSize || 3000);
  const chunkOverlap = Number(cliArguments.chunkOverlap || 250);
  const topN = Number(cliArguments.topN || 32);
  const modelTokenLimit = Number(cliArguments.modelTokenLimit || 32768);
  const maxCompletionTokenArgument = cliArguments.maxCompletionTokens || "8192";
  const maxCompletionTokens =
    maxCompletionTokenArgument === "provider-default"
      ? null
      : Number(maxCompletionTokenArgument);
  if (
    maxCompletionTokens !== null &&
    (!Number.isInteger(maxCompletionTokens) || maxCompletionTokens < 1)
  )
    fail(`Ungültige --maxCompletionTokens: ${maxCompletionTokenArgument}`);
  process.env.LMSTUDIO_MODEL_TOKEN_LIMIT = String(modelTokenLimit);

  console.log(`[pdf-provenance-live] Parse: ${fileName}`);
  const parsed = await parsePdf({
    fullFilePath: pdfPath,
    filename: fileName,
    options: { absolutePath: true, parseOnly: false },
  });
  if (!parsed.success || parsed.documents?.length !== 1)
    fail(`PDF-Parse fehlgeschlagen: ${parsed.reason || "unbekannt"}`);

  const documentData = {
    ...parsed.documents[0],
    id: documentId,
    docId: documentId,
    sourceDocumentId: documentId,
    title: fileName,
  };
  const pages = PageAwareTextSplitter.pages(documentData);
  const chunks = await PageAwareTextSplitter.splitDocument({
    documentData,
    chunkSize,
    chunkOverlap,
  });
  if (chunks.length === 0) fail("Der PDF-Splitter hat keine Chunks erzeugt.");

  for (const chunk of chunks) {
    const page = pages.find(
      ({ pageNumber }) => pageNumber === chunk.metadata.pageNumber
    );
    const body = stripChunkHeader(chunk.text).trim();
    if (!page || !body || !page.text.includes(body))
      fail(
        `Chunk ${chunk.metadata.chunkIndex} ist nicht exakt an seine Seite gebunden.`
      );
    if (
      !chunk.text.includes(`documentId: ${documentId}`) ||
      !chunk.text.includes(`physicalPdfPage: ${chunk.metadata.pageNumber}`) ||
      !chunk.text.includes(
        `citationLabel: ${fileName} — physische PDF-Seite ${chunk.metadata.pageNumber}`
      )
    )
      fail(
        `Chunk ${chunk.metadata.chunkIndex} enthält keinen sichtbaren Provenienz-Header.`
      );
  }

  console.log(
    `[pdf-provenance-live] Dinghy: ${chunks.length} seitengebundene Chunks`
  );
  const embedder = new LMStudioEmbedder();
  const vectors = await embedder.embedChunks(chunks.map(({ text }) => text));
  if (!Array.isArray(vectors) || vectors.length !== chunks.length)
    fail("Dinghy hat nicht für jeden Chunk einen Vektor geliefert.");

  const lance = new LanceDb();
  const { client } = await lance.connect();
  const submissions = chunks.map((chunk, index) => ({
    id: uuidv4(),
    vector: vectors[index],
    text: chunk.text,
    ...materializeProvenance({
      metadata: chunk.metadata,
      documentData,
      docId: documentId,
      isPdf: true,
    }),
  }));
  await lance.updateOrCreateCollection(client, submissions, namespace);

  const table = await client.openTable(namespace);
  const storedRowCount = await table.countRows();
  if (storedRowCount !== chunks.length)
    fail(`LanceDB enthält ${storedRowCount} statt ${chunks.length} Chunks.`);

  console.log(
    `[pdf-provenance-live] Retrieval: Top N ${Math.min(topN, chunks.length)}`
  );
  const queryVector = await embedder.embedTextInput(RETRIEVAL_QUERY);
  const retrieved = await lance.similarityResponse({
    client,
    namespace,
    queryVector,
    similarityThreshold: 0,
    topN: Math.min(topN, chunks.length),
  });
  if (retrieved.contextTexts.length === 0) fail("Dinghy-Retrieval blieb leer.");

  const llm = new LMStudioLLM(embedder, process.env.LMSTUDIO_MODEL_PREF);
  const messages = llm.constructPrompt({
    systemPrompt: SYSTEM_PROMPT,
    contextTexts: retrieved.contextTexts,
    chatHistory: [],
    userPrompt: USER_PROMPT,
  });
  console.log(`[pdf-provenance-live] Qwen: ${process.env.LMSTUDIO_MODEL_PREF}`);
  const completion = await llm.getChatCompletion(messages, {
    temperature: 0,
    ...(maxCompletionTokens === null ? {} : { maxTokens: maxCompletionTokens }),
  });
  if (!completion?.textResponse) fail("Qwen hat keine Antwort geliefert.");
  if (completion?.metrics?.responseModel !== process.env.LMSTUDIO_MODEL_PREF)
    fail(
      `Falsches LM-Studio-Chatmodell: erwartet ${process.env.LMSTUDIO_MODEL_PREF}, erhalten ${completion?.metrics?.responseModel || "NICHT_GEMELDET"}. Lauf sofort abgebrochen.`
    );

  const sourceSummary = retrieved.sourceDocuments.map((source) => ({
    docId: source.docId,
    sourceDocumentId: source.sourceDocumentId,
    title: source.title,
    pageNumber: source.pageNumber,
    chunkIndex: source.chunkIndex,
    pageChunkIndex: source.pageChunkIndex,
    score: source.score,
    text: source.text,
  }));
  const acceptance = validateCategoryOutput({
    answer: completion.textResponse,
    categoryDefinitions: CATEGORY_DEFINITIONS,
    requiredNotice: REQUIRED_NOTICE,
    sourceDocuments: sourceSummary,
  });
  const report = {
    status: acceptance.pass ? "PASS" : "REVISE",
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    pdf: { fileName, path: pdfPath, sha256: pdfSha256 },
    models: {
      embedding: process.env.EMBEDDING_MODEL_PREF,
      llm: process.env.LMSTUDIO_MODEL_PREF,
    },
    promptContract: {
      systemPromptPath,
      systemPromptSha256: sha256File(systemPromptPath),
      userPromptSha256: crypto
        .createHash("sha256")
        .update(USER_PROMPT)
        .digest("hex"),
      retrievalQuerySha256: crypto
        .createHash("sha256")
        .update(RETRIEVAL_QUERY)
        .digest("hex"),
      categoryIds: CATEGORY_DEFINITIONS.map(({ id }) => id),
      systemPromptPersisted: false,
    },
    configuration: {
      chunkSize,
      chunkOverlap,
      topN,
      modelTokenLimit,
      maxCompletionTokens,
      completionTokenMode:
        maxCompletionTokens === null ? "PROVIDER_DEFAULT_V321" : "EXPLICIT",
      namespace,
    },
    extraction: {
      physicalPages: documentData.pdfExtraction.totalPages,
      processedPages: documentData.pdfExtraction.processedPages,
      pagesWithText: documentData.pdfExtraction.pagesWithText,
      chunks: chunks.length,
      storedRows: storedRowCount,
      vectorDimensions: vectors[0].length,
    },
    retrieval: {
      sources: sourceSummary.length,
      physicalPages: [
        ...new Set(sourceSummary.map(({ pageNumber }) => pageNumber)),
      ].sort((left, right) => left - right),
    },
    completion: completion.metrics,
    acceptance,
  };

  writeJson("report.json", report);
  writeJson("retrieved-sources.private.json", sourceSummary);
  writeJson("messages.private.json", messages);
  fs.writeFileSync(
    path.join(outputPath, "answer.md"),
    completion.textResponse,
    {
      encoding: "utf8",
      mode: 0o600,
    }
  );
  fs.chmodSync(path.join(outputPath, "answer.md"), 0o600);
  console.log(
    `[pdf-provenance-live] ${report.status}: ${path.join(outputPath, "report.json")}`
  );
  if (!acceptance.pass)
    console.log(
      `[pdf-provenance-live] Vertragsabweichungen: ${acceptance.reasons.join(", ")}`
    );
}

main().catch((error) => fail(error.stack || error.message));
