#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(`[hybrid-candidate-fallback] ${message}`);
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
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writePrivateJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(file, 0o600);
}

async function embedBatches({ client, model, inputs, batchSize = 32 }) {
  const vectors = [];
  for (let start = 0; start < inputs.length; start += batchSize) {
    const batch = inputs.slice(start, start + batchSize);
    const response = await client.embeddings.create({
      model,
      input: batch,
      encoding_format: "float",
    });
    if (response.model !== model)
      throw new Error(
        `EMBEDDING_MODEL_MISMATCH: erwartet ${model}, erhalten ${response.model || "NICHT_GEMELDET"}`
      );
    const rows = [...(response.data || [])].sort(
      (left, right) => left.index - right.index
    );
    if (
      rows.length !== batch.length ||
      rows.some(
        (row) => !Array.isArray(row.embedding) || row.embedding.length === 0
      )
    )
      throw new Error(`EMBEDDING_BATCH_INVALID: ${start}`);
    vectors.push(...rows.map((row) => row.embedding));
    console.log(
      `[hybrid-candidate-fallback] Dinghy ${Math.min(start + batch.length, inputs.length)}/${inputs.length}`
    );
  }
  return vectors;
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set([
    "worksheet",
    "documentArtifact",
    "fallbackCatalog",
    "systemPromptFile",
    "output",
    "report",
    "model",
    "modelTokenLimit",
    "embeddingModel",
    "chunkSize",
    "chunkOverlap",
    "maxAttemptsPerTarget",
  ]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  if (!args.output || !args.report)
    fail("--output und --report sind erforderlich");

  const worksheetFile = path.resolve(args.worksheet || "");
  const documentArtifactFile = path.resolve(args.documentArtifact || "");
  const fallbackCatalogFile = path.resolve(args.fallbackCatalog || "");
  const systemPromptFile = path.resolve(args.systemPromptFile || "");
  const worksheet = readJson(worksheetFile, "Worksheet");
  const artifact = readJson(documentArtifactFile, "Dokumentartefakt");
  const fallbackCatalog = readJson(fallbackCatalogFile, "Fallback-Katalog");
  if (!fs.existsSync(systemPromptFile))
    fail(`Systemprompt fehlt: ${systemPromptFile}`);
  const systemPrompt = fs.readFileSync(systemPromptFile, "utf8");
  if (
    artifact?.schemaVersion !== 1 ||
    artifact.fingerprint !== worksheet?.document?.fingerprint ||
    artifact.document?.sourceDocumentId !== artifact.fingerprint
  )
    fail("Dokumentartefakt und Worksheet gehören nicht zusammen");

  process.env.LMSTUDIO_BASE_PATH =
    process.env.LMSTUDIO_BASE_PATH || "http://127.0.0.1:1234/v1";
  process.env.LMSTUDIO_MODEL_PREF =
    args.model || process.env.LMSTUDIO_MODEL_PREF || "qwen3.5-4b-mlx";
  process.env.LMSTUDIO_MODEL_TOKEN_LIMIT =
    args.modelTokenLimit || process.env.LMSTUDIO_MODEL_TOKEN_LIMIT || "32768";
  const embeddingModel =
    args.embeddingModel || process.env.EMBEDDING_MODEL_PREF || "dinghy-embed";
  const chunkSize = Number(args.chunkSize || 3_000);
  const chunkOverlap = Number(args.chunkOverlap || 250);
  const maxAttemptsPerTarget = Number(args.maxAttemptsPerTarget || 2);
  if (
    !Number.isInteger(maxAttemptsPerTarget) ||
    maxAttemptsPerTarget < 1 ||
    maxAttemptsPerTarget > 3
  )
    fail("--maxAttemptsPerTarget muss zwischen 1 und 3 liegen");

  const {
    buildPageAwareRetrievalChunks,
    mergeHybridSelections,
    parseAndValidateHybridSelection,
    rankChunksForTargets,
    validateHybridFallbackCatalog,
  } = require("../../utils/policyAnalysis/hybridCandidateFallback");
  const {
    parseLMStudioBasePath,
    LMStudioLLM,
  } = require("../../utils/AiProviders/lmStudio");
  const { OpenAI } = require("openai");
  const validatedCatalog = validateHybridFallbackCatalog({
    catalog: fallbackCatalog,
    worksheet,
  });
  const eligibleTargets = validatedCatalog.targets.filter(
    (target) => target.eligible
  );
  const startedAt = new Date();
  if (eligibleTargets.length === 0) {
    writePrivateJson(path.resolve(args.output), {
      ...worksheet,
      hybridFallback: {
        schemaVersion: 1,
        candidateOnly: true,
        evaluatedSelectionCount: 0,
        acceptedSelectionCount: 0,
        addedCandidateCount: 0,
      },
    });
    writePrivateJson(path.resolve(args.report), {
      status: "PASS_NO_ELIGIBLE_TARGETS",
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      catalogId: validatedCatalog.catalogId,
      categoryView: validatedCatalog.categoryView,
      targetCount: validatedCatalog.targets.length,
      eligibleTargetCount: 0,
      addedCandidateCount: 0,
    });
    return;
  }

  const chunks = await buildPageAwareRetrievalChunks({
    document: artifact.document,
    chunkSize,
    chunkOverlap,
  });
  const embeddingClient = new OpenAI({
    baseURL: parseLMStudioBasePath(process.env.LMSTUDIO_BASE_PATH),
    apiKey: process.env.LMSTUDIO_AUTH_TOKEN ?? "lm-studio",
  });
  const chunkVectors = await embedBatches({
    client: embeddingClient,
    model: embeddingModel,
    inputs: chunks.map((chunk) => chunk.text),
  });
  const targetVectors = await embedBatches({
    client: embeddingClient,
    model: embeddingModel,
    inputs: eligibleTargets.map((target) => target.query),
  });
  const rankedTargets = rankChunksForTargets({
    targets: eligibleTargets,
    chunks,
    targetVectors,
    chunkVectors,
  });

  const llm = new LMStudioLLM(null, process.env.LMSTUDIO_MODEL_PREF);
  const calls = [];
  const selections = [];
  for (const target of rankedTargets) {
    for (const chunk of target.chunks) {
      const singleChunkTarget = { ...target, chunks: [chunk] };
      const payload = {
        schemaVersion: 1,
        target: {
          id: target.id,
          categoryView: validatedCatalog.categoryView,
          requirementId: target.requirementId,
          requirementLabel: target.requirementLabel,
          componentId: target.componentId,
          componentLabel: target.componentLabel,
          factRole: target.factRole,
          semanticContract: target.semanticContract,
        },
        chunks: [
          {
            chunkId: chunk.id,
            physicalPageNumber: chunk.physicalPageNumber,
            text: chunk.text,
          },
        ],
      };
      let validated = null;
      let previousError = null;
      for (let attempt = 1; attempt <= maxAttemptsPerTarget; attempt += 1) {
        const userPayload = previousError
          ? {
              ...payload,
              retryInstruction:
                "Die vorige Antwort war formal ungültig. Verwende die eine gelieferte chunkId genau einmal, nur eine erlaubte Relation und ausschließlich einen wortgetreuen Teilstring.",
              previousErrorCode: previousError.code,
            }
          : payload;
        const messages = llm.constructPrompt({
          systemPrompt,
          contextTexts: [],
          chatHistory: [],
          userPrompt: JSON.stringify(userPayload),
        });
        const completion = await llm.getChatCompletion(messages, {
          temperature: 0,
          maxTokens: 1_024,
        });
        if (
          completion?.metrics?.responseModel !== process.env.LMSTUDIO_MODEL_PREF
        )
          fail(
            `Falsches Chatmodell bei ${target.id}: erwartet ${process.env.LMSTUDIO_MODEL_PREF}, erhalten ${completion?.metrics?.responseModel || "NICHT_GEMELDET"}`
          );
        calls.push({
          targetId: target.id,
          chunkId: chunk.id,
          attempt,
          payloadSha256: sha256(JSON.stringify(userPayload)),
          responseText: completion?.textResponse || "",
          metrics: completion?.metrics || null,
        });
        try {
          validated = parseAndValidateHybridSelection({
            responseText: completion?.textResponse || "",
            target: singleChunkTarget,
            invalidEvidencePolicy: "downgrade",
          });
          break;
        } catch (error) {
          previousError = {
            code: error.code || "UNKNOWN",
            message: error.message,
          };
        }
      }
      if (validated) selections.push(...validated.selections);
      else
        selections.push({
          targetId: target.id,
          requirementId: target.requirementId,
          componentId: target.componentId,
          semanticContract: target.semanticContract,
          chunkId: chunk.id,
          relation: "UNRESOLVED",
          quote: null,
          score: chunk.score,
          pageNumber: chunk.pageNumber,
          documentStart: null,
          documentEnd: null,
          rejectedRelation: null,
          rejectionCode: previousError?.code || "HYBRID_MODEL_OUTPUT_INVALID",
        });
    }
  }

  const merged = mergeHybridSelections({
    worksheet,
    document: artifact.document,
    selections,
  });
  const outputFile = path.resolve(args.output);
  const reportFile = path.resolve(args.report);
  writePrivateJson(outputFile, merged.worksheet);
  writePrivateJson(reportFile, {
    status: "TECHNICAL_PASS_REVIEW_REQUIRED",
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    catalogId: validatedCatalog.catalogId,
    categoryView: validatedCatalog.categoryView,
    worksheetSha256: sha256(fs.readFileSync(worksheetFile)),
    documentFingerprint: artifact.fingerprint,
    systemPromptSha256: sha256(systemPrompt),
    configuration: {
      chunkSize,
      chunkOverlap,
      topKMaximum: Math.max(...eligibleTargets.map((target) => target.topK)),
      embeddingModel,
      chatModel: process.env.LMSTUDIO_MODEL_PREF,
      modelTokenLimit: Number(process.env.LMSTUDIO_MODEL_TOKEN_LIMIT),
      maxAttemptsPerTarget,
    },
    chunkCount: chunks.length,
    targetCount: validatedCatalog.targets.length,
    eligibleTargetCount: eligibleTargets.length,
    selectionCount: selections.length,
    acceptedSelectionCount: selections.filter((selection) => selection.quote)
      .length,
    rejectedEvidenceCount: selections.filter(
      (selection) => selection.rejectionCode
    ).length,
    rejectedEvidence: selections
      .filter((selection) => selection.rejectionCode)
      .map((selection) => ({
        targetId: selection.targetId,
        chunkId: selection.chunkId,
        rejectedRelation: selection.rejectedRelation,
        rejectionCode: selection.rejectionCode,
      })),
    addedCandidateCount: merged.added.length,
    added: merged.added,
    rankings: rankedTargets.map((target) => ({
      targetId: target.id,
      chunks: target.chunks.map((chunk) => ({
        chunkId: chunk.id,
        pageNumber: chunk.pageNumber,
        score: chunk.score,
      })),
    })),
    calls,
  });
  console.log(
    `[hybrid-candidate-fallback] ${merged.added.length} neue Kandidaten für ${eligibleTargets.length} Ziele`
  );
}

run().catch((error) => fail(error.stack || error.message));
