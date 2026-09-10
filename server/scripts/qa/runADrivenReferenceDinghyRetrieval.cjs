#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  buildADrivenCounterpartSearchPlan,
  materializeADrivenCounterpartSearchExecution,
} = require("../../utils/policyAnalysis/aDrivenCounterpartSearchPlan");
const {
  buildClauseBoundaries,
  buildDinghyRankingResult,
  retrieveADrivenCounterpartCandidates,
} = require("../../utils/policyAnalysis/aDrivenCounterpartRetrieval");
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
const {
  cosineSimilarity,
} = require("../../utils/policyAnalysis/hybridCandidateFallback");
const {
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");

const RUN_CONTRACT_ID = "LF_A_DRIVEN_DINGHY_RETRIEVAL_RUN_V1";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fail(message) {
  console.error(`[lf-a-driven-dinghy] ${message}`);
  process.exit(1);
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      fail(`Ungültiges Argument: ${key || "-"}`);
    const name = key.slice(2);
    if (Object.hasOwn(values, name)) fail(`Doppeltes Argument: ${name}`);
    values[name] = value;
  }
  const allowed = new Set(["shadowRoot", "runRoot", "contractFile", "output"]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of ["shadowRoot", "runRoot", "contractFile", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, path.resolve(value)])
  );
}

function readJson(file, code) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    throw new Error(`${code}_MISSING`);
  }
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`${code}_INVALID`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error(`${code}_INVALID`);
  }
}

function writePrivateJson(file, value) {
  if (fs.existsSync(file))
    throw new Error(`LF_A_DRIVEN_DINGHY_OUTPUT_EXISTS:${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function documentDirectory(runRoot, document) {
  return path.join(
    runRoot,
    "documents",
    `${document.side}-${String(document.position + 1).padStart(2, "0")}-${document.uuid}`
  );
}

function loadBDocuments(runRoot) {
  const manifest = readJson(
    path.join(runRoot, "input-manifest.private.json"),
    "LF_A_DRIVEN_DINGHY_INPUT_MANIFEST"
  );
  const documents = manifest.documents
    .filter(({ side }) => side === "B")
    .sort((left, right) => left.position - right.position)
    .map((document) => ({
      document,
      artifact: readJson(
        path.join(
          documentDirectory(runRoot, document),
          "document.private.json"
        ),
        "LF_A_DRIVEN_DINGHY_DOCUMENT_ARTIFACT"
      ),
    }));
  if (!documents.length)
    throw new Error("LF_A_DRIVEN_DINGHY_B_DOCUMENTS_MISSING");
  return documents;
}

function clausesFor(item) {
  const pageContent = item.artifact?.document?.pageContent;
  return buildClauseBoundaries({
    uuid: item.document.uuid,
    sha256: item.document.sha256,
    pageContent,
    pageContentSha256: sha256(pageContent || ""),
    pageMap: item.artifact?.document?.pageMap,
  });
}

function rankedClauses({
  clauses,
  queryVector,
  clauseVectors,
  topK,
  minimumScore,
}) {
  if (clauses.length !== clauseVectors.length)
    throw new Error("LF_A_DRIVEN_DINGHY_VECTOR_COUNT_MISMATCH");
  return clauses
    .map((clause, index) => ({
      clauseBoundaryId: clause.clauseBoundaryId,
      documentStart: clause.documentStart,
      score: cosineSimilarity(queryVector, clauseVectors[index]),
    }))
    .filter(({ score }) => score >= minimumScore)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.documentStart - right.documentStart ||
        left.clauseBoundaryId.localeCompare(right.clauseBoundaryId)
    )
    .slice(0, topK)
    .map(({ clauseBoundaryId, score }) => ({
      clauseBoundaryId,
      score: Number(score.toFixed(8)),
    }));
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  if (fs.existsSync(args.output))
    throw new Error("LF_A_DRIVEN_DINGHY_OUTPUT_ALREADY_EXISTS");
  const dynamicManifest = readJson(
    path.join(args.shadowRoot, "dynamic-semantic-manifest.private.json"),
    "LF_A_DRIVEN_DINGHY_SEMANTIC_MANIFEST"
  );
  const documents = loadBDocuments(args.runRoot);
  const { contract, identity } = loadHybridShadowContract(args.contractFile);
  if (!contract?.enabled || !identity?.contractSha256)
    throw new Error("LF_A_DRIVEN_DINGHY_CONTRACT_NOT_ENABLED");
  await verifyHybridShadowRuntimeArtifacts(contract);
  const loadedModel = await verifyLoadedEmbeddingModel(contract);
  const plan = buildADrivenCounterpartSearchPlan({
    manifest: dynamicManifest,
    documents: documents.map(({ document }) => document),
    perChannelTopK: contract.retrieval.topK,
  });
  const clausesByDocument = new Map(
    documents.map((item) => [item.document.uuid, clausesFor(item)])
  );
  const client = createEmbeddingClient(contract);
  const uniqueQueries = new Map();
  for (const packageItem of plan.packages) {
    const querySha256 = sha256(stableStringify(packageItem.query));
    if (!uniqueQueries.has(querySha256))
      uniqueQueries.set(
        querySha256,
        normalizeEmbeddingInput(
          packageItem.query.contextText,
          contract.provider.inputNormalization
        )
      );
  }
  const queryEntries = [...uniqueQueries.entries()];
  const queryEmbedding = await embedBatches({
    client,
    contract,
    inputs: queryEntries.map(([, value]) => value),
    label: "A_COMPONENT_QUERIES",
  });
  const queryVectors = new Map(
    queryEntries.map(([querySha256], index) => [
      querySha256,
      queryEmbedding.vectors[index],
    ])
  );
  const rankings = [];
  const documentEmbeddingRuns = [];
  for (const item of documents) {
    const clauses = clausesByDocument.get(item.document.uuid);
    const embedded = await embedBatches({
      client,
      contract,
      inputs: clauses.map(({ exactText }) =>
        normalizeEmbeddingInput(exactText, contract.provider.inputNormalization)
      ),
      label: `B_DOCUMENT_${item.document.uuid}`,
    });
    documentEmbeddingRuns.push({
      documentUuid: item.document.uuid,
      clauses: clauses.length,
      requestCount: embedded.requestCount,
      durationMs: embedded.durationMs,
    });
    for (const packageItem of plan.packages.filter(
      ({ documentUuid }) => documentUuid === item.document.uuid
    )) {
      const querySha256 = sha256(stableStringify(packageItem.query));
      rankings.push(
        buildDinghyRankingResult({
          packageItem,
          clauses,
          modelId: contract.provider.model,
          embeddingContractSha256: identity.contractSha256,
          rankedClauses: rankedClauses({
            clauses,
            queryVector: queryVectors.get(querySha256),
            clauseVectors: embedded.vectors,
            topK: plan.retrievalPolicy.perChannelTopK,
            minimumScore: contract.retrieval.minimumScore,
          }),
        })
      );
    }
    console.log(
      `[lf-a-driven-dinghy] B-Dokument ${item.document.position + 1}/${documents.length}: ${clauses.length} Klauseln`
    );
  }
  const rankingMap = new Map(
    rankings.map((ranking) => [ranking.packageId, ranking])
  );
  if (rankingMap.size !== plan.packages.length)
    throw new Error("LF_A_DRIVEN_DINGHY_RANKING_MATRIX_INCOMPLETE");
  const retrieval = retrieveADrivenCounterpartCandidates({
    plan,
    documents,
    dinghyRankings: rankingMap,
  });
  const execution = materializeADrivenCounterpartSearchExecution({
    plan,
    retrieval,
  });
  const payload = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    dynamicManifestSha256: dynamicManifest.manifestSha256,
    searchPlanSha256: plan.planSha256,
    embeddingContractSha256: identity.contractSha256,
    embeddingModel: loadedModel,
    documents: documents.length,
    clauses: [...clausesByDocument.values()].reduce(
      (sum, clauses) => sum + clauses.length,
      0
    ),
    uniqueQueries: uniqueQueries.size,
    packages: plan.packages.length,
    rankingResults: rankings.length,
    retrievalSha256: retrieval.retrievalSha256,
    executionSha256: execution.executionSha256,
    queryEmbedding: {
      requestCount: queryEmbedding.requestCount,
      durationMs: queryEmbedding.durationMs,
    },
    documentEmbeddingRuns,
    absenceCertified: false,
    customerNotFoundEligible: false,
  };
  const summary = {
    ...payload,
    runSha256: sha256(`${RUN_CONTRACT_ID}\u0000${stableStringify(payload)}`),
  };
  writePrivateJson(path.join(args.output, "search-plan.private.json"), plan);
  writePrivateJson(
    path.join(args.output, "dinghy-rankings.private.json"),
    rankings
  );
  writePrivateJson(
    path.join(args.output, "counterpart-retrieval.private.json"),
    retrieval
  );
  writePrivateJson(
    path.join(args.output, "search-execution.private.json"),
    execution
  );
  writePrivateJson(path.join(args.output, "summary.private.json"), summary);
  console.log(
    `[lf-a-driven-dinghy] FERTIG: ${rankings.length}/${plan.packages.length} Rankings, ${retrieval.summary.candidates} kompaktierte Kandidaten`
  );
}

if (require.main === module)
  run().catch((error) => fail(error.stack || error.message));

module.exports = { rankedClauses };
