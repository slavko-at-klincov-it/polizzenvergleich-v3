#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { releaseIdentity } = require("../../utils/policyAnalysis/runIdentity");
const {
  buildHybridShadowTargets,
  buildHybridShadowWorksheet,
  exactSourceSpansFromNavigationChunk,
  loadHybridShadowContract,
} = require("../../utils/policyAnalysis/hybridShadowSearch");
const {
  loadHybridShadowPilot,
  pilotCasesForWorksheet,
} = require("../../utils/policyAnalysis/hybridShadowPilot");
const {
  createEmbeddingClient,
  embedBatches,
  normalizeEmbeddingInput,
  verifyHybridShadowRuntimeArtifacts,
  verifyLoadedEmbeddingModel,
} = require("../../utils/policyAnalysis/hybridShadowEmbeddingClient");
const {
  buildPageAwareRetrievalChunks,
  rankChunksForTargets,
} = require("../../utils/policyAnalysis/hybridCandidateFallback");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");

function fail(message) {
  console.error(`[hybrid-shadow-pilot-search] ${message}`);
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

function verifyManifest({ manifest, manifestFile, pilotIdentity, contractIdentity }) {
  if (
    manifest?.schemaVersion !== 1 ||
    manifest.runKind !== "HYBRID_SHADOW_TWO_PHASE_PILOT_QA" ||
    manifest.status !== "CREATED" ||
    manifest.shadowOnly !== true ||
    manifest.primaryMutationAllowed !== false ||
    manifest.customerMaterializationAllowed !== false ||
    manifest.resumeAllowed !== false ||
    manifest.implementation?.repository !== REPOSITORY_ROOT ||
    manifest.implementation?.releaseId !== releaseIdentity(REPOSITORY_ROOT) ||
    manifest.pilot?.pilotSha256 !== pilotIdentity.pilotSha256 ||
    manifest.embeddingContract?.contractSha256 !==
      contractIdentity.contractSha256 ||
    path.resolve(manifestFile) !==
      path.join(path.dirname(manifestFile), "manifest.private.json")
  )
    throw new Error("HYBRID_SHADOW_PILOT_MANIFEST_IDENTITY_MISMATCH");
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set(["manifest", "pilotFile", "contractFile", "output"]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!args[required]) fail(`--${required} ist erforderlich`);

  const manifestFile = path.resolve(args.manifest);
  const pilotFile = path.resolve(args.pilotFile);
  const contractFile = path.resolve(args.contractFile);
  const output = path.resolve(args.output);
  const manifest = readJson(manifestFile, "Pilot-Manifest");
  const { pilot, identity: pilotIdentity } = loadHybridShadowPilot(pilotFile);
  const { contract, identity: contractIdentity } =
    loadHybridShadowContract(contractFile);
  verifyManifest({ manifest, manifestFile, pilotIdentity, contractIdentity });
  if (!contract.enabled) throw new Error("HYBRID_SHADOW_CONTRACT_NOT_ENABLED");
  if (output !== path.join(path.dirname(manifestFile), "search"))
    throw new Error("HYBRID_SHADOW_PILOT_SEARCH_OUTPUT_INVALID");
  if (fs.existsSync(output))
    throw new Error("HYBRID_SHADOW_PILOT_SEARCH_OUTPUT_EXISTS");
  await verifyHybridShadowRuntimeArtifacts(contract);
  const loadedRuntime = await verifyLoadedEmbeddingModel(contract);
  const client = createEmbeddingClient(contract);
  const searchStartedAt = new Date().toISOString();
  const searchStarted = performance.now();
  const documentCompletions = [];
  const allBatchTimings = [];

  for (const manifestDocument of manifest.documents) {
    const pilotDocument = pilot.documents.find(
      ({ documentFingerprint }) =>
        documentFingerprint === manifestDocument.documentFingerprint
    );
    if (!pilotDocument)
      throw new Error("HYBRID_SHADOW_PILOT_DOCUMENT_NOT_IN_ORACLE");
    const documentArtifactFile = manifestDocument.documentArtifactPath;
    if (
      sha256File(documentArtifactFile) !==
      manifestDocument.documentArtifactSha256
    )
      throw new Error("HYBRID_SHADOW_PILOT_DOCUMENT_ARTIFACT_CHANGED");
    const documentArtifact = readJson(
      documentArtifactFile,
      "Dokument-Artefakt"
    );
    const document = documentArtifact.document;
    if (
      documentArtifact.fingerprint !== manifestDocument.documentFingerprint ||
      document?.sourceDocumentId !== manifestDocument.documentFingerprint
    )
      throw new Error("HYBRID_SHADOW_PILOT_DOCUMENT_IDENTITY_MISMATCH");

    const documentStarted = performance.now();
    const chunks = await buildPageAwareRetrievalChunks({
      document,
      chunkSize: contract.retrieval.chunkSize,
      chunkOverlap: contract.retrieval.chunkOverlap,
    });
    if (chunks.length === 0)
      throw new Error("HYBRID_SHADOW_DOCUMENT_HAS_NO_RETRIEVAL_CHUNKS");
    const categoryInputs = manifestDocument.categories.map(
      (manifestCategory) => {
        if (
          sha256File(manifestCategory.worksheetPath) !==
          manifestCategory.worksheetSha256
        )
          throw new Error("HYBRID_SHADOW_PILOT_PRIMARY_WORKSHEET_CHANGED");
        const worksheet = readJson(
          manifestCategory.worksheetPath,
          `${manifestCategory.categoryView}-Primär-Worksheet`
        );
        const selectedCases = pilotCasesForWorksheet({
          pilotDocument,
          worksheet,
        });
        const targets = buildHybridShadowTargets({
          worksheet,
          contract,
          allowedTargets: selectedCases,
        }).map((target) => ({
          ...target,
          id: `${manifestCategory.categoryView}:${target.id}`,
          categoryView: manifestCategory.categoryView,
        }));
        return { manifestCategory, worksheet, selectedCases, targets };
      }
    );
    const targets = categoryInputs.flatMap(({ targets }) => targets);
    if (targets.length !== pilotDocument.cases.length)
      throw new Error("HYBRID_SHADOW_PILOT_TARGET_COUNT_MISMATCH");

    const targetEmbeddings = await embedBatches({
      client,
      contract,
      inputs: targets.map(({ query }) =>
        normalizeEmbeddingInput(query, contract.provider.inputNormalization)
      ),
      label: `${manifestDocument.documentFingerprint}:targets`,
    });
    const chunkEmbeddings = await embedBatches({
      client,
      contract,
      inputs: chunks.map(({ text }) =>
        normalizeEmbeddingInput(text, contract.provider.inputNormalization)
      ),
      label: `${manifestDocument.documentFingerprint}:chunks`,
    });
    const navigationRankedTargets = rankChunksForTargets({
      targets,
      chunks,
      targetVectors: targetEmbeddings.vectors,
      chunkVectors: chunkEmbeddings.vectors,
    });
    const exactSpansByTarget = navigationRankedTargets.map((target) => {
      const unique = new Map();
      for (const navigationChunk of target.chunks)
        for (const span of exactSourceSpansFromNavigationChunk({
          document,
          navigationChunk,
        }))
          if (!unique.has(span.id)) unique.set(span.id, span);
      return { target, spans: [...unique.values()] };
    });
    const uniqueExactSpans = new Map();
    for (const { spans } of exactSpansByTarget)
      for (const span of spans)
        if (!uniqueExactSpans.has(span.id)) uniqueExactSpans.set(span.id, span);
    const exactSpans = [...uniqueExactSpans.values()];
    const exactSpanEmbeddings = await embedBatches({
      client,
      contract,
      inputs: exactSpans.map(({ text }) =>
        normalizeEmbeddingInput(text, contract.provider.inputNormalization)
      ),
      label: `${manifestDocument.documentFingerprint}:exact-spans`,
    });
    const exactVectorById = new Map(
      exactSpans.map((span, index) => [
        span.id,
        exactSpanEmbeddings.vectors[index],
      ])
    );
    const rankedTargets = exactSpansByTarget.map(
      ({ target, spans }, targetIndex) => {
        const ranked = rankChunksForTargets({
          targets: [target],
          chunks: spans,
          targetVectors: [targetEmbeddings.vectors[targetIndex]],
          chunkVectors: spans.map((span) => exactVectorById.get(span.id)),
        })[0];
        return { ...target, spans: ranked.chunks };
      }
    );
    allBatchTimings.push(
      ...targetEmbeddings.batches,
      ...chunkEmbeddings.batches,
      ...exactSpanEmbeddings.batches
    );

    const categoryCompletions = [];
    for (const categoryInput of categoryInputs) {
      const categoryView = categoryInput.manifestCategory.categoryView;
      const categoryRankings = rankedTargets.filter(
        (target) => target.categoryView === categoryView
      );
      const categoryNavigationRankings = navigationRankedTargets.filter(
        (target) => target.categoryView === categoryView
      );
      const categoryDirectory = path.join(
        output,
        `document-${manifestDocument.documentIndex + 1}`,
        categoryView
      );
      const shadowWorksheet = buildHybridShadowWorksheet({
        primaryWorksheet: categoryInput.worksheet,
        document,
        rankedTargets: categoryRankings,
        contractIdentity,
        primaryWorksheetSha256:
          categoryInput.manifestCategory.worksheetSha256,
        documentArtifactSha256: manifestDocument.documentArtifactSha256,
        allowedTargets: categoryInput.selectedCases,
        pilotIdentity: {
          schemaVersion: pilotIdentity.schemaVersion,
          pilotId: pilotIdentity.pilotId,
          caseCount: pilotIdentity.caseCount,
          pilotSha256: pilotIdentity.pilotSha256,
        },
      });
      const worksheetOutput = path.join(
        categoryDirectory,
        "worksheet.shadow.private.json"
      );
      writePrivateJson(worksheetOutput, shadowWorksheet);
      const exactSpanRankings = categoryRankings.map((target) => ({
        caseId: target.pilotCaseId,
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
      }));
      const report = {
        schemaVersion: 1,
        artifactKind: "HYBRID_SHADOW_PILOT_SEARCH_REPORT",
        status: "PASS",
        shadowOnly: true,
        primaryMutationAllowed: false,
        categoryView,
        documentFingerprint: manifestDocument.documentFingerprint,
        contract: contractIdentity,
        pilot: {
          schemaVersion: pilotIdentity.schemaVersion,
          pilotId: pilotIdentity.pilotId,
          caseCount: pilotIdentity.caseCount,
          pilotSha256: pilotIdentity.pilotSha256,
        },
        runtimeVerification: {
          ...loadedRuntime,
          modelArtifactSha256: contract.provider.modelArtifactSha256,
          runtimeRevision: contract.provider.runtimeRevision,
          runtimeArtifactSha256: contract.provider.runtimeArtifactSha256,
          embeddingDimensions: contract.provider.dimensions,
        },
        contracts: {
          pilotManifestPath: manifestFile,
          pilotManifestSha256: sha256File(manifestFile),
          primaryWorksheetPath: categoryInput.manifestCategory.worksheetPath,
          primaryWorksheetSha256:
            categoryInput.manifestCategory.worksheetSha256,
          documentArtifactPath: manifestDocument.documentArtifactPath,
          documentArtifactSha256: manifestDocument.documentArtifactSha256,
          shadowWorksheetPath: worksheetOutput,
          shadowWorksheetSha256: sha256File(worksheetOutput),
        },
        input: {
          selectedPrimaryNullComponentCount: categoryRankings.length,
          sharedDocumentChunkCount: chunks.length,
          sharedExactSpanCount: exactSpans.length,
        },
        output: {
          acceptedCandidateCount: shadowWorksheet.summary.occurrenceCount,
          minimumScore: contract.retrieval.minimumScore,
        },
        navigationRankings: categoryNavigationRankings.map((target) => ({
          caseId: target.pilotCaseId,
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
            exactChunkSha256: sha256(chunk.text),
          })),
        })),
        exactSpanRankings,
      };
      const reportFile = path.join(categoryDirectory, "search-report.json");
      writePrivateJson(reportFile, report);
      categoryCompletions.push({
        categoryView,
        selectedCaseIds: exactSpanRankings.map(({ caseId }) => caseId),
        shadowWorksheetPath: worksheetOutput,
        shadowWorksheetSha256: sha256File(worksheetOutput),
        searchReportPath: reportFile,
        searchReportSha256: sha256File(reportFile),
      });
    }
    documentCompletions.push({
      documentIndex: manifestDocument.documentIndex,
      documentFingerprint: manifestDocument.documentFingerprint,
      chunkCount: chunks.length,
      exactSpanCount: exactSpans.length,
      targetCount: targets.length,
      embeddingRequestCount:
        targetEmbeddings.requestCount +
        chunkEmbeddings.requestCount +
        exactSpanEmbeddings.requestCount,
      embeddingApiDurationMs:
        targetEmbeddings.durationMs +
        chunkEmbeddings.durationMs +
        exactSpanEmbeddings.durationMs,
      documentSearchWallDurationMs: performance.now() - documentStarted,
      categories: categoryCompletions,
    });
  }

  const completion = {
    schemaVersion: 1,
    artifactKind: "HYBRID_SHADOW_PILOT_SEARCH_COMPLETE",
    status: "SEARCH_COMPLETE",
    shadowOnly: true,
    primaryMutationAllowed: false,
    startedAt: searchStartedAt,
    finishedAt: new Date().toISOString(),
    contracts: {
      pilotManifestPath: manifestFile,
      pilotManifestSha256: sha256File(manifestFile),
      pilotSha256: pilotIdentity.pilotSha256,
      embeddingContractSha256: contractIdentity.contractSha256,
    },
    runtimeVerification: loadedRuntime,
    timing: {
      embeddingApiDurationMs: allBatchTimings.reduce(
        (sum, batch) => sum + batch.durationMs,
        0
      ),
      searchWallDurationMs: performance.now() - searchStarted,
      embeddingRequestCount: allBatchTimings.length,
      batchTimings: allBatchTimings,
    },
    documents: documentCompletions,
  };
  writePrivateJson(path.join(output, "complete.private.json"), completion);
  console.log(
    `[hybrid-shadow-pilot-search] SEARCH_COMPLETE: ${pilot.caseCount} Fälle, ${allBatchTimings.length} Embedding-Requests`
  );
}

run().catch((error) => fail(error.stack || error.message));
