#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  BENCHMARK_CONTRACT_ID,
  BENCHMARK_SCHEMA_VERSION,
  canonicalJson,
  fuseCandidateChannels,
  inventoryLfReferenceRun,
  occurrenceCandidate,
  prepareDocumentCandidatePools,
  rankEmbeddingCandidates,
  rankLexicalCandidates,
  sha256,
} = require("../../utils/policyAnalysis/lfReferenceDiscoveryBenchmark");
const {
  createEmbeddingClient,
  embedBatches,
  normalizeEmbeddingInput,
  verifyHybridShadowRuntimeArtifacts,
  verifyLoadedEmbeddingModel,
} = require("../../utils/policyAnalysis/hybridShadowEmbeddingClient");
const {
  loadHybridShadowContract,
} = require("../../utils/policyAnalysis/hybridShadowSearch");
const { releaseIdentity } = require("../../utils/policyAnalysis/runIdentity");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const BENCHMARK_CANDIDATES_CONTRACT_ID =
  "LF_COUNTERPART_BENCHMARK_CANDIDATES_V1";

function fail(message) {
  console.error(`[lf-discovery-benchmark] ${message}`);
  process.exitCode = 1;
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error(`LF_DISCOVERY_ARGUMENT_INVALID:${key || "-"}`);
    values[key.slice(2)] = value;
  }
  const allowed = new Set([
    "runRoot",
    "output",
    "contractFile",
    "expectedPublicNotFoundRows",
    "expectedPureNullRows",
    "expectedComponents",
    "expectedCells",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length)
    throw new Error(`LF_DISCOVERY_ARGUMENT_UNKNOWN:${unknown.join(",")}`);
  for (const required of ["runRoot", "output"])
    if (!values[required])
      throw new Error(`LF_DISCOVERY_ARGUMENT_REQUIRED:${required}`);
  const expected = Object.fromEntries(
    [
      "expectedPublicNotFoundRows",
      "expectedPureNullRows",
      "expectedComponents",
      "expectedCells",
    ]
      .filter((key) => values[key] !== undefined)
      .map((key) => {
        const number = Number(values[key]);
        if (!Number.isSafeInteger(number) || number < 0)
          throw new Error(`LF_DISCOVERY_ARGUMENT_INVALID:${key}`);
        return [key, number];
      })
  );
  return {
    runRoot: path.resolve(values.runRoot),
    output: path.resolve(values.output),
    contractFile: values.contractFile
      ? path.resolve(values.contractFile)
      : null,
    expected,
  };
}

function writePrivateJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function validateExpected(summary, expected) {
  const checks = {
    expectedPublicNotFoundRows: summary.publicNotFoundRows,
    expectedPureNullRows: summary.pureNullRows,
    expectedComponents: summary.uniqueComponentTargets,
    expectedCells: summary.componentDocumentCells,
  };
  for (const [key, expectedValue] of Object.entries(expected))
    if (checks[key] !== expectedValue)
      throw new Error(
        `LF_DISCOVERY_EXPECTED_COUNT_MISMATCH:${key}:${checks[key]}:${expectedValue}`
      );
}

function uniqueQueries(targets) {
  const queries = new Map();
  for (const target of targets) {
    const existing = queries.get(target.querySha256);
    if (existing && existing.query !== target.query)
      throw new Error("LF_DISCOVERY_QUERY_HASH_COLLISION");
    if (!existing)
      queries.set(target.querySha256, {
        querySha256: target.querySha256,
        query: target.query,
      });
  }
  return [...queries.values()].sort((left, right) =>
    left.querySha256.localeCompare(right.querySha256)
  );
}

async function prepareEmbeddingChannel({ contractFile, targets }) {
  if (!contractFile)
    return {
      enabled: false,
      identity: null,
      contract: null,
      client: null,
      runtime: null,
      queryVectorBySha256: new Map(),
      timings: [],
    };
  const { contract, identity } = loadHybridShadowContract(contractFile);
  if (!contract?.enabled)
    throw new Error("LF_DISCOVERY_EMBEDDING_CONTRACT_NOT_ENABLED");
  await verifyHybridShadowRuntimeArtifacts(contract);
  const runtime = await verifyLoadedEmbeddingModel(contract);
  const client = createEmbeddingClient(contract);
  const queries = uniqueQueries(targets);
  const embedded = await embedBatches({
    client,
    contract,
    inputs: queries.map(({ query }) =>
      normalizeEmbeddingInput(query, contract.provider.inputNormalization)
    ),
    label: "lf-discovery:unique-component-queries",
  });
  return {
    enabled: true,
    identity,
    contract,
    client,
    runtime,
    queryVectorBySha256: new Map(
      queries.map(({ querySha256 }, index) => [
        querySha256,
        embedded.vectors[index],
      ])
    ),
    timings: [...embedded.batches],
  };
}

function publicInventory(inventory) {
  return {
    schemaVersion: inventory.schemaVersion,
    contractId: inventory.contractId,
    runRoot: inventory.runRoot,
    sourceBindings: inventory.sourceBindings,
    summary: inventory.summary,
    rowSets: inventory.rowSets,
    targets: inventory.targets,
  };
}

function flatCandidate({
  cell,
  documentRun,
  channel,
  candidate,
  rank,
  score,
  channelProvenance,
}) {
  const exactQuote = candidate.exactText || candidate.text;
  const exactQuoteSha256 = candidate.exactTextSha256 || sha256(exactQuote);
  const source = {
    documentUuid: documentRun.input.uuid,
    documentFingerprint: documentRun.input.sha256,
    physicalPageNumber: candidate.physicalPageNumber,
    pageStart: candidate.pageStart ?? null,
    pageEnd: candidate.pageEnd ?? null,
    documentStart: candidate.documentStart,
    documentEnd: candidate.documentEnd,
    exactQuote,
    exactQuoteSha256,
  };
  return {
    candidateId: `lf-counterpart-benchmark:${sha256(
      [
        cell.analysisRowId,
        cell.componentId,
        documentRun.input.uuid,
        documentRun.input.position,
        documentRun.input.sha256,
        channel,
        source.physicalPageNumber,
        source.documentStart,
        source.documentEnd,
      ].join(":")
    )}`,
    analysisRowId: cell.analysisRowId,
    requirementId: cell.publicRowId,
    componentId: cell.componentId,
    channel,
    rank,
    score,
    candidateKind: "NAVIGATION_EXACT_ORIGINAL_SPAN",
    navigationOnly: true,
    semanticDecision: null,
    source,
    channelProvenance,
  };
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  if (
    args.output === args.runRoot ||
    args.output.startsWith(`${args.runRoot}${path.sep}`) ||
    args.output === REPOSITORY_ROOT ||
    args.output.startsWith(`${REPOSITORY_ROOT}${path.sep}`)
  )
    throw new Error("LF_DISCOVERY_OUTPUT_LOCATION_FORBIDDEN");
  if (fs.existsSync(args.output)) throw new Error("LF_DISCOVERY_OUTPUT_EXISTS");

  const inventory = inventoryLfReferenceRun({ runRoot: args.runRoot });
  validateExpected(inventory.summary, args.expected);
  const challengerTargetKeys = new Set(
    inventory.cells
      .filter(({ currentCandidateCount }) => currentCandidateCount === 0)
      .map(({ targetKey }) => targetKey)
  );
  const challengerTargets = inventory.targets.filter(({ targetKey }) =>
    challengerTargetKeys.has(targetKey)
  );
  const embedding = await prepareEmbeddingChannel({
    contractFile: args.contractFile,
    targets: challengerTargets,
  });
  fs.mkdirSync(args.output, { recursive: false, mode: 0o700 });
  const inventoryFile = path.join(args.output, "inventory.private.json");
  writePrivateJson(inventoryFile, publicInventory(inventory));

  const targetByKey = new Map(
    inventory.targets.map((target) => [target.targetKey, target])
  );
  const outputDocuments = [];
  const flatCandidates = [];
  const channelTotals = {
    CURRENT: 0,
    LEXICAL_BM25: 0,
    STRUCTURAL: 0,
    DINGHY: 0,
    UNION: 0,
  };
  for (const documentRun of inventory.documents) {
    const document = documentRun.artifact.document;
    const pools = await prepareDocumentCandidatePools({
      document,
      chunkSize: embedding.contract?.retrieval.chunkSize || 3_000,
      chunkOverlap: embedding.contract?.retrieval.chunkOverlap || 250,
    });
    let embeddingVectors = [];
    if (embedding.enabled) {
      const embeddedDocument = await embedBatches({
        client: embedding.client,
        contract: embedding.contract,
        inputs: pools.navigationChunks.map(({ text }) =>
          normalizeEmbeddingInput(
            text,
            embedding.contract.provider.inputNormalization
          )
        ),
        label: `lf-discovery:document:${documentRun.input.uuid}`,
      });
      embeddingVectors = embeddedDocument.vectors;
      embedding.timings.push(...embeddedDocument.batches);
    }
    const cells = inventory.cells
      .filter(({ documentUuid }) => documentUuid === documentRun.input.uuid)
      .map((cell) => {
        const target = targetByKey.get(cell.targetKey);
        if (!target)
          throw new Error(`LF_DISCOVERY_TARGET_MISSING:${cell.targetKey}`);
        const current = cell.currentOccurrences.map(occurrenceCandidate);
        const challengerEligible = current.length === 0;
        const lexical = challengerEligible
          ? rankLexicalCandidates({
              target,
              candidates: pools.lexicalCandidates,
              index: pools.lexicalIndex,
              topK: 5,
            })
          : [];
        const structural = challengerEligible
          ? rankLexicalCandidates({
              target,
              candidates: pools.structuralCandidates,
              index: pools.structuralIndex,
              topK: 5,
              structural: true,
            })
          : [];
        const dinghy =
          embedding.enabled && challengerEligible
            ? rankEmbeddingCandidates({
                target,
                targetVector: embedding.queryVectorBySha256.get(
                  target.querySha256
                ),
                candidates: pools.lexicalCandidates,
                candidateVectors: embeddingVectors,
                topK: embedding.contract.retrieval.topK,
                minimumScore: embedding.contract.retrieval.minimumScore,
              })
            : [];
        const union = fuseCandidateChannels(
          {
            CURRENT: current,
            LEXICAL_BM25: lexical,
            STRUCTURAL: structural,
            DINGHY: dinghy,
          },
          {
            analysisRowId: cell.analysisRowId,
            componentId: cell.componentId,
            documentUuid: documentRun.input.uuid,
            documentPosition: documentRun.input.position,
            documentFingerprint: documentRun.input.sha256,
          }
        );
        for (const candidate of union)
          flatCandidates.push(
            flatCandidate({
              cell,
              documentRun,
              channel: "UNION",
              candidate: candidate.source,
              rank: candidate.unionRank,
              score: candidate.fusion.score,
              channelProvenance: {
                fusion: candidate.fusion,
                channelTraces: candidate.channelTraces,
              },
            })
          );
        channelTotals.CURRENT += current.length;
        channelTotals.LEXICAL_BM25 += lexical.length;
        channelTotals.STRUCTURAL += structural.length;
        channelTotals.DINGHY += dinghy.length;
        channelTotals.UNION += union.length;
        return {
          cellKey: cell.cellKey,
          targetKey: cell.targetKey,
          publicRowId: cell.publicRowId,
          analysisRowId: cell.analysisRowId,
          componentId: cell.componentId,
          querySha256: target.querySha256,
          currentCandidateCount: current.length,
          challengerEligible,
          channels: {
            CURRENT: current,
            LEXICAL_BM25: lexical,
            STRUCTURAL: structural,
            DINGHY: dinghy,
          },
          union,
        };
      });
    const artifact = {
      schemaVersion: BENCHMARK_SCHEMA_VERSION,
      contractId: BENCHMARK_CONTRACT_ID,
      artifactKind: "LF_REFERENCE_DISCOVERY_DOCUMENT_CHANNELS",
      shadowOnly: true,
      primaryMutationAllowed: false,
      qwenExecuted: false,
      document: {
        uuid: documentRun.input.uuid,
        position: documentRun.input.position,
        name: documentRun.input.originalName,
        sha256: documentRun.input.sha256,
        artifactPath: documentRun.artifactFile,
        artifactSha256: documentRun.artifactSha256,
      },
      corpus: {
        navigationChunks: pools.navigationChunks.length,
        structuralSpans: pools.structuralCandidates.length,
        documentChunksBuiltOnce: true,
      },
      cells,
    };
    const filename = `document-${String(
      documentRun.input.position + 1
    ).padStart(2, "0")}.private.json`;
    const file = path.join(args.output, "documents", filename);
    writePrivateJson(file, artifact);
    outputDocuments.push({
      documentUuid: documentRun.input.uuid,
      filename: path.relative(args.output, file),
      sha256: sha256File(file),
      cellCount: cells.length,
      navigationChunkCount: pools.navigationChunks.length,
      structuralSpanCount: pools.structuralCandidates.length,
    });
  }

  const completionStatus = embedding.enabled
    ? "CHANNELS_COMPLETE_REVIEW_REQUIRED"
    : "EMBEDDING_NOT_RUN";
  const candidatesArtifact = {
    schemaVersion: 1,
    contractId: BENCHMARK_CANDIDATES_CONTRACT_ID,
    artifactKind: "LF_COUNTERPART_BENCHMARK_CANDIDATES",
    status: completionStatus,
    shadowOnly: true,
    primaryMutationAllowed: false,
    qwenExecuted: false,
    candidateKind: "NAVIGATION_EXACT_ORIGINAL_SPAN",
    source: {
      inventoryPath: inventoryFile,
      inventorySha256: sha256File(inventoryFile),
      runSignature: inventory.sourceBindings.runSignature,
      resultPath: inventory.sourceBindings.files.comparison.path,
      resultSha256: inventory.sourceBindings.files.comparison.sha256,
      semanticManifestPath:
        inventory.sourceBindings.files.semanticManifest.path,
      semanticManifestSha256:
        inventory.sourceBindings.files.semanticManifest.sha256,
      semanticRequirementManifestSha256:
        inventory.sourceBindings.semanticRequirementManifestSha256,
    },
    runSignature: inventory.sourceBindings.runSignature,
    sourceResultSha256: inventory.sourceBindings.files.comparison.sha256,
    sourceSemanticManifestSha256:
      inventory.sourceBindings.files.semanticManifest.sha256,
    sourceInventorySha256: sha256File(inventoryFile),
    summary: {
      candidateCount: flatCandidates.length,
      byContributingChannel: Object.fromEntries(
        ["CURRENT", "LEXICAL_BM25", "STRUCTURAL", "DINGHY"].map((channel) => [
          channel,
          flatCandidates.filter((candidate) =>
            candidate.channelProvenance.channelTraces.some(
              (trace) => trace.channel === channel
            )
          ).length,
        ])
      ),
    },
    candidates: flatCandidates,
    proofLimit:
      "Every candidate is an exact original-text navigation span. A candidate, rank, similarity score or channel union makes no semantic coverage, scope, effect, value or absence decision.",
  };
  const candidatesFile = path.join(args.output, "candidates.private.json");
  writePrivateJson(candidatesFile, candidatesArtifact);

  const uniqueQueryCount = uniqueQueries(challengerTargets).length;
  const manifest = {
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    contractId: BENCHMARK_CONTRACT_ID,
    artifactKind: "LF_REFERENCE_DISCOVERY_BENCHMARK_MANIFEST",
    status: completionStatus,
    shadowOnly: true,
    primaryMutationAllowed: false,
    customerMaterializationAllowed: false,
    qwenExecuted: false,
    createdAt: new Date().toISOString(),
    implementation: {
      repository: REPOSITORY_ROOT,
      releaseId: releaseIdentity(REPOSITORY_ROOT),
    },
    source: {
      inventoryPath: inventoryFile,
      inventorySha256: sha256File(inventoryFile),
      candidatesPath: candidatesFile,
      candidatesSha256: sha256File(candidatesFile),
      ...inventory.sourceBindings,
    },
    population: {
      ...inventory.summary,
      uniqueQueryCount,
    },
    channels: {
      CURRENT: { enabled: true, candidateCount: channelTotals.CURRENT },
      LEXICAL_BM25: {
        enabled: true,
        candidateCount: channelTotals.LEXICAL_BM25,
        topKPerComponentDocument: 5,
      },
      STRUCTURAL: {
        enabled: true,
        candidateCount: channelTotals.STRUCTURAL,
        topKPerComponentDocument: 5,
        unit: "ONE_TO_THREE_CONTIGUOUS_SOURCE_LINES",
      },
      DINGHY: {
        enabled: embedding.enabled,
        candidateCount: channelTotals.DINGHY,
        contract: embedding.identity,
        runtime: embedding.runtime,
      },
      UNION: {
        candidateCount: channelTotals.UNION,
        fusion: "CHANNEL_RECIPROCAL_RANK_SUM_K60",
      },
    },
    embeddingTiming: {
      requestCount: embedding.timings.length,
      apiDurationMs: embedding.timings.reduce(
        (sum, timing) => sum + timing.durationMs,
        0
      ),
      batches: embedding.timings,
    },
    documents: outputDocuments,
    proofLimit:
      "QA-only candidate-discovery benchmark. Rankings and union candidates are navigation evidence, not proof of coverage or absence. No customer result was changed and no Qwen judgement was executed.",
  };
  manifest.manifestSha256 = sha256(canonicalJson(manifest));
  const manifestFile = path.join(args.output, "manifest.private.json");
  writePrivateJson(manifestFile, manifest);
  console.log(
    `[lf-discovery-benchmark] ${completionStatus}: ${inventory.summary.publicNotFoundRows} öffentliche Nichtfunde, ${inventory.summary.pureNullRows} reine B-Nullzeilen, ${inventory.summary.uniqueComponentTargets} Komponenten, ${inventory.summary.componentDocumentCells} Zellen, Dinghy=${embedding.enabled ? "AN" : "AUS"}`
  );
}

run().catch((error) => fail(error.stack || error.message));
