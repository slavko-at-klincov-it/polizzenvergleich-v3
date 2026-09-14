#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const prisma = require("../utils/prisma");
const { isWithin, policyComparisonsPath } = require("../utils/files");
const {
  writeComparisonArtifacts,
} = require("../utils/policyComparison/resultBuilder");
const {
  CATEGORY_ORDER,
  PRODUCT_PROFILE,
} = require("../utils/policyComparison/productContract");
const {
  POLICY_COMPARISON_MODE,
  normalizePolicyComparisonMode,
} = require("../utils/policyComparison/modes");
const {
  LF_DYNAMIC_REFERENCE_PROFILE,
} = require("../utils/policyComparison/lfDynamicReferenceProfile");
const {
  LF_A_DRIVEN_REFERENCE_PROFILE,
} = require("../utils/policyComparison/aDrivenReferenceProfile");
const {
  analyzeReferenceDocument,
  completedReferenceCategoryViews,
  extractReferenceDocument,
} = require("../utils/policyComparison/referenceRunner");
const {
  prepareDynamicReferenceTemplate,
} = require("../utils/policyComparison/dynamicReferenceRunner");
const {
  validateDynamicReferenceComparison,
  writeDynamicReferenceComparisonArtifacts,
} = require("../utils/policyComparison/dynamicReferenceResultBuilder");
const {
  archiveComparisonWorkbook,
} = require("../utils/policyComparison/workbookArchive");
const {
  buildComparisonExportContract,
} = require("../utils/policyComparison/comparisonExportContract");
const {
  validatePublishedComparisonArtifactSet,
} = require("../utils/policyComparison/artifactSetPublisher");
const {
  readValidatedComparisonResult,
} = require("../utils/policyComparison/comparisonResultReader");
const {
  validateCustomerComparisonFile,
} = require("../utils/policyComparison/customerMetricContract");
const {
  releaseIdentity,
  sha256,
} = require("../utils/policyAnalysis/runIdentity");
const {
  CACHE_SCHEMA_VERSION: MODEL_RESPONSE_CACHE_SCHEMA_VERSION,
  seedResponseCacheFromRunHistory,
} = require("../utils/policyAnalysis/validatedModelResponseCache");
const {
  loadHybridShadowContract,
} = require("../utils/policyAnalysis/hybridShadowSearch");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const RUNNER = path.join(REPOSITORY_ROOT, "run-all-categories-quality.command");
const A_DRIVEN_RUNNER = path.join(
  REPOSITORY_ROOT,
  "run-a-driven-reference-product-v2.command"
);
const MODEL = process.env.POLICY_FULL_MODEL || "qwen/qwen3.6-35b-a3b";
const MODEL_TOKEN_LIMIT = Number(
  process.env.POLICY_FULL_MODEL_TOKEN_LIMIT || 42496
);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
let activeLease = null;
let activeProductRunner = null;

function forceTerminateOwnedWorkerGroup() {
  if (process.env.POLICY_COMPARISON_WORKER_GROUP_LEADER === "1") {
    try {
      process.kill(-process.pid, "SIGKILL");
      return;
    } catch (error) {
      if (error.code !== "ESRCH") console.error(error);
    }
  }
  process.exit(143);
}

function terminateOwnedWorkerGroup() {
  if (activeProductRunner && activeProductRunner.exitCode === null) {
    activeProductRunner.kill("SIGTERM");
    const timer = setTimeout(forceTerminateOwnedWorkerGroup, 15_000);
    timer.unref();
    return;
  }
  forceTerminateOwnedWorkerGroup();
}

process.once("SIGTERM", terminateOwnedWorkerGroup);
process.once("SIGINT", terminateOwnedWorkerGroup);

async function sha256File(file) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

function privateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function writePrivateJson(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function completedCategoryViews(outputDirectory) {
  return CATEGORY_ORDER.filter((categoryView) => {
    const resultDirectory = path.join(outputDirectory, categoryView, "result");
    return ["report.json", "answer.md", "rows.private.json"].every((name) =>
      fs.existsSync(path.join(resultDirectory, name))
    );
  });
}

function resumableRun({
  sessionUuid,
  manifest,
  comparisonMode,
  embeddingContractIdentity = null,
}) {
  const contract = {
    schemaVersion: embeddingContractIdentity ? 6 : 5,
    releaseId: releaseIdentity(REPOSITORY_ROOT),
    comparisonMode,
    productProfile: manifest.productProfile,
    configuration: {
      model: MODEL,
      modelTokenLimit: MODEL_TOKEN_LIMIT,
      validatedModelResponseCacheSchemaVersion:
        comparisonMode === POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B
          ? MODEL_RESPONSE_CACHE_SCHEMA_VERSION
          : null,
      ...(embeddingContractIdentity
        ? { embeddingContract: embeddingContractIdentity }
        : {}),
    },
    documents: manifest.documents.map(
      ({
        uuid,
        side,
        position,
        role,
        documentStatus,
        originalName,
        sha256: documentSha256,
      }) => ({
        uuid,
        side,
        position,
        role,
        documentStatus,
        originalName,
        sha256: documentSha256,
      })
    ),
  };
  const signature = sha256(JSON.stringify(contract));
  const runRoot = path.resolve(
    policyComparisonsPath,
    "runs",
    sessionUuid,
    `resume-${signature.slice(0, 24)}`
  );
  if (!isWithin(policyComparisonsPath, runRoot))
    throw new Error("COMPARISON_RUN_PATH_INVALID");
  privateDirectory(runRoot);
  const contractFile = path.join(runRoot, "run-contract.private.json");
  const generatedAt = new Date().toISOString();
  if (fs.existsSync(contractFile)) {
    const existing = JSON.parse(fs.readFileSync(contractFile, "utf8"));
    const comparableExisting = embeddingContractIdentity
      ? Object.fromEntries(
          Object.entries(existing).filter(([key]) => key !== "generatedAt")
        )
      : existing;
    if (JSON.stringify(comparableExisting) !== JSON.stringify(contract))
      throw new Error("COMPARISON_RESUME_CONTRACT_MISMATCH");
    if (
      embeddingContractIdentity &&
      (!existing.generatedAt || Number.isNaN(Date.parse(existing.generatedAt)))
    )
      throw new Error("COMPARISON_RESUME_GENERATED_AT_INVALID");
    return {
      runRoot,
      signature,
      generatedAt: embeddingContractIdentity
        ? existing.generatedAt
        : generatedAt,
    };
  } else {
    writePrivateJson(
      contractFile,
      embeddingContractIdentity ? { ...contract, generatedAt } : contract
    );
  }
  return { runRoot, signature, generatedAt };
}

function configuredADrivenEmbeddingContract() {
  const configured = String(
    process.env.POLICY_A_DRIVEN_EMBEDDING_CONTRACT_FILE || ""
  ).trim();
  if (!configured)
    throw new Error("LF_A_DRIVEN_EMBEDDING_CONTRACT_REQUIRED");
  if (!path.isAbsolute(configured))
    throw new Error("LF_A_DRIVEN_EMBEDDING_CONTRACT_PATH_INVALID");
  const contractFile = path.resolve(configured);
  const { contract, identity } = loadHybridShadowContract(contractFile);
  if (!contract?.enabled || identity?.enabled !== true)
    throw new Error("LF_A_DRIVEN_EMBEDDING_CONTRACT_NOT_ENABLED");
  return { contractFile, identity };
}

function snapshotADrivenEmbeddingContract({ runRoot, contractFile, identity }) {
  const sourceStat = fs.lstatSync(contractFile);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink())
    throw new Error("LF_A_DRIVEN_EMBEDDING_CONTRACT_FILE_INVALID");
  const bytes = fs.readFileSync(contractFile);
  if (sha256(bytes) !== identity.contractSha256)
    throw new Error("LF_A_DRIVEN_EMBEDDING_CONTRACT_CHANGED");
  const snapshotFile = path.join(
    runRoot,
    "embedding-contract.private.json"
  );
  if (fs.existsSync(snapshotFile)) {
    const snapshotStat = fs.lstatSync(snapshotFile);
    if (
      !snapshotStat.isFile() ||
      snapshotStat.isSymbolicLink() ||
      !fs.readFileSync(snapshotFile).equals(bytes)
    )
      throw new Error("LF_A_DRIVEN_EMBEDDING_CONTRACT_RESUME_MISMATCH");
    return snapshotFile;
  }
  const temporary = `${snapshotFile}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, bytes, { mode: 0o600 });
  fs.renameSync(temporary, snapshotFile);
  fs.chmodSync(snapshotFile, 0o600);
  return snapshotFile;
}

async function claimWorkerLease(session, inputManifest, leaseNonce) {
  const claimed = await prisma.policy_comparison_sessions.updateMany({
    where: {
      id: session.id,
      status: "QUEUED",
      inputManifest,
      workerPid: null,
    },
    data: {
      status: "RUNNING",
      workerPid: process.pid,
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
    },
  });
  if (claimed.count !== 1)
    throw new Error("COMPARISON_WORKER_LEASE_CLAIM_FAILED");
  activeLease = {
    sessionId: session.id,
    inputManifest,
    leaseNonce,
    workerPid: process.pid,
  };
}

async function updateSession(id, data) {
  if (!activeLease || activeLease.sessionId !== id)
    throw new Error("COMPARISON_WORKER_LEASE_REQUIRED");
  const updated = await prisma.policy_comparison_sessions.updateMany({
    where: {
      id,
      status: "RUNNING",
      inputManifest: activeLease.inputManifest,
      workerPid: activeLease.workerPid,
    },
    data: { ...data, lastUpdatedAt: new Date() },
  });
  if (updated.count !== 1) throw new Error("COMPARISON_WORKER_LEASE_LOST");
}

async function failOwnedSession(sessionUuid, leaseNonce, error) {
  const session = await prisma.policy_comparison_sessions.findUnique({
    where: { uuid: sessionUuid },
  });
  if (!session || session.status === "CANCELLED") return;
  let manifest;
  try {
    manifest = JSON.parse(session.inputManifest || "null");
  } catch {
    return;
  }
  if (manifest?.workerLeaseNonce !== leaseNonce) return;
  await prisma.policy_comparison_sessions.updateMany({
    where: {
      id: session.id,
      inputManifest: session.inputManifest,
      OR: [
        { status: "QUEUED", workerPid: null },
        { status: "RUNNING", workerPid: process.pid },
      ],
    },
    data: {
      status: "FAILED",
      error: error.message,
      workerPid: null,
      completedAt: new Date(),
      lastUpdatedAt: new Date(),
    },
  });
}

async function releaseOwnedWorkerPid() {
  if (!activeLease) return;
  await prisma.policy_comparison_sessions.updateMany({
    where: {
      id: activeLease.sessionId,
      inputManifest: activeLease.inputManifest,
      workerPid: activeLease.workerPid,
    },
    data: {
      workerPid: null,
      lastUpdatedAt: new Date(),
    },
  });
}

function runDocument({
  file,
  documentStatus,
  outputDirectory,
  logFile,
  initialCompletedCategories = [],
  onCategoryComplete = () => {},
}) {
  return new Promise((resolve, reject) => {
    privateDirectory(outputDirectory);
    const log = fs.openSync(logFile, "a", 0o600);
    let logClosed = false;
    const closeLog = () => {
      if (logClosed) return;
      fs.closeSync(log);
      logClosed = true;
    };
    const child = spawn(
      "/bin/bash",
      [RUNNER, file, documentStatus, outputDirectory],
      {
        cwd: REPOSITORY_ROOT,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    const lineBuffers = new Map([
      ["stdout", ""],
      ["stderr", ""],
    ]);
    const completedCategories = new Set(initialCompletedCategories);
    const consumeOutput = (channel, chunk) => {
      fs.writeSync(log, chunk);
      const buffered = `${lineBuffers.get(channel)}${chunk.toString("utf8")}`;
      const lines = buffered.split(/\r?\n/gu);
      lineBuffers.set(channel, lines.pop() || "");
      for (const line of lines) {
        const categoryView =
          line.match(/^\[category-full-materialize\] ([A-Z]{2})\b/u)?.[1] ||
          line.match(
            /^\[all-categories\] ([A-Z]{2}) – bereits vollständig/u
          )?.[1];
        if (
          !CATEGORY_ORDER.includes(categoryView) ||
          completedCategories.has(categoryView)
        )
          continue;
        completedCategories.add(categoryView);
        onCategoryComplete(categoryView, completedCategories.size);
      }
    };
    child.stdout.on("data", (chunk) => consumeOutput("stdout", chunk));
    child.stderr.on("data", (chunk) => consumeOutput("stderr", chunk));
    child.once("error", (error) => {
      closeLog();
      reject(error);
    });
    child.once("close", (code, signal) => {
      closeLog();
      if (code === 0) return resolve();
      return reject(
        new Error(
          `DOCUMENT_ANALYSIS_FAILED: exit=${code ?? "null"} signal=${signal || "none"} log=${logFile}`
        )
      );
    });
  });
}

function runADrivenReferenceProduct({
  runRoot,
  contractFile,
  sessionUuid,
  runSignature,
  generatedAt,
  logFile,
}) {
  return new Promise((resolve, reject) => {
    const log = fs.openSync(logFile, "a", 0o600);
    let logClosed = false;
    const closeLog = () => {
      if (logClosed) return;
      fs.closeSync(log);
      logClosed = true;
    };
    const child = spawn(
      "/bin/bash",
      [
        A_DRIVEN_RUNNER,
        runRoot,
        contractFile,
        sessionUuid,
        runSignature,
        generatedAt,
      ],
      {
        cwd: REPOSITORY_ROOT,
        env: process.env,
        stdio: ["ignore", log, log],
      }
    );
    activeProductRunner = child;
    child.once("error", (error) => {
      activeProductRunner = null;
      closeLog();
      reject(error);
    });
    child.once("close", (code, signal) => {
      activeProductRunner = null;
      closeLog();
      if (code === 0) return resolve();
      reject(
        new Error(
          `LF_A_DRIVEN_PRODUCT_FAILED:exit=${code ?? "null"}:signal=${signal || "none"}:log=${logFile}`
        )
      );
    });
  });
}

async function main() {
  const sessionUuid = String(process.argv[2] || "").trim();
  const leaseNonce = String(process.argv[3] || "").trim();
  if (!sessionUuid) throw new Error("SESSION_UUID_REQUIRED");
  if (!UUID_PATTERN.test(leaseNonce))
    throw new Error("COMPARISON_WORKER_LEASE_INVALID");
  const session = await prisma.policy_comparison_sessions.findUnique({
    where: { uuid: sessionUuid },
  });
  if (!session) throw new Error("COMPARISON_SESSION_NOT_FOUND");
  if (session.status !== "QUEUED")
    throw new Error(`COMPARISON_SESSION_NOT_QUEUED:${session.status}`);
  const manifest = JSON.parse(session.inputManifest || "null");
  const comparisonMode = normalizePolicyComparisonMode(
    manifest?.comparisonMode || session.comparisonMode
  );
  const referenceMode =
    comparisonMode === POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B;
  const validReferenceProfiles = [
    LF_DYNAMIC_REFERENCE_PROFILE,
    LF_A_DRIVEN_REFERENCE_PROFILE,
  ];
  const profileValid = referenceMode
    ? validReferenceProfiles.some(
        (profile) =>
          JSON.stringify(manifest?.productProfile) === JSON.stringify(profile)
      )
    : JSON.stringify(manifest?.productProfile) === JSON.stringify(PRODUCT_PROFILE);
  if (
    manifest?.schemaVersion !== 3 ||
    manifest?.sessionUuid !== sessionUuid ||
    manifest?.workerLeaseNonce !== leaseNonce ||
    !profileValid ||
    manifest?.comparisonMode !== comparisonMode ||
    !Array.isArray(manifest.documents)
  )
    throw new Error("COMPARISON_INPUT_MANIFEST_INVALID");
  await claimWorkerLease(session, session.inputManifest, leaseNonce);

  const aDrivenReferenceMode =
    referenceMode &&
    JSON.stringify(manifest.productProfile) ===
      JSON.stringify(LF_A_DRIVEN_REFERENCE_PROFILE);
  const embedding = aDrivenReferenceMode
    ? configuredADrivenEmbeddingContract()
    : null;
  const {
    runRoot,
    signature: resumeSignature,
    generatedAt,
  } = resumableRun({
    sessionUuid,
    manifest,
    comparisonMode,
    embeddingContractIdentity: embedding?.identity || null,
  });
  const embeddingContractFile = aDrivenReferenceMode
    ? snapshotADrivenEmbeddingContract({ runRoot, ...embedding })
    : null;
  const responseCacheDirectory = referenceMode
    && !aDrivenReferenceMode
    ? path.join(policyComparisonsPath, "runs", sessionUuid, "response-cache-v1")
    : null;
  const responseCacheSeed = referenceMode && !aDrivenReferenceMode
    ? seedResponseCacheFromRunHistory({
        sessionRunsRoot: path.join(policyComparisonsPath, "runs", sessionUuid),
        cacheDirectory: responseCacheDirectory,
      })
    : null;
  const runInputManifest = aDrivenReferenceMode
    ? {
        schemaVersion: manifest.schemaVersion,
        sessionUuid: manifest.sessionUuid,
        comparisonMode: manifest.comparisonMode,
        productProfile: manifest.productProfile,
        documents: manifest.documents,
      }
    : manifest;
  writePrivateJson(
    path.join(runRoot, "input-manifest.private.json"),
    runInputManifest
  );
  if (responseCacheSeed)
    writePrivateJson(
      path.join(runRoot, "response-cache-seed.private.json"),
      responseCacheSeed
    );
  const plannedRuns = manifest.documents.map((document) => ({
    document,
    outputDirectory: path.join(
      runRoot,
      "documents",
      `${document.side}-${String(document.position + 1).padStart(2, "0")}-${document.uuid}`
    ),
  }));

  async function validatedSourceFile(document) {
    const sourceFile = path.resolve(
      policyComparisonsPath,
      document.storagePath
    );
    if (
      !isWithin(policyComparisonsPath, sourceFile) ||
      !fs.existsSync(sourceFile)
    )
      throw new Error(`COMPARISON_SOURCE_MISSING:${document.uuid}`);
    if ((await sha256File(sourceFile)) !== document.sha256)
      throw new Error(`COMPARISON_SOURCE_IDENTITY_MISMATCH:${document.uuid}`);
    return sourceFile;
  }

  if (aDrivenReferenceMode) {
    const logFile = path.join(runRoot, "worker.log");
    for (const [index, plannedRun] of plannedRuns.entries()) {
      await updateSession(session.id, {
        status: "RUNNING",
        startedAt: new Date(),
        progress: JSON.stringify({
          phase: "EXTRACTING_REFERENCE_DOCUMENTS",
          completedDocuments: index,
          totalDocuments: manifest.documents.length,
          currentDocument: {
            uuid: plannedRun.document.uuid,
            side: plannedRun.document.side,
            originalName: plannedRun.document.originalName,
          },
        }),
      });
      await extractReferenceDocument({
        file: await validatedSourceFile(plannedRun.document),
        outputDirectory: plannedRun.outputDirectory,
        logFile,
      });
    }
    await updateSession(session.id, {
      progress: JSON.stringify({
        phase: "ANALYZING_REFERENCE_PRODUCT",
        completedDocuments: 0,
        totalDocuments: manifest.documents.length,
        currentDocument: null,
      }),
    });
    await runADrivenReferenceProduct({
      runRoot,
      contractFile: embeddingContractFile,
      sessionUuid,
      runSignature: resumeSignature,
      generatedAt,
      logFile,
    });
    const resultDirectory = path.join(runRoot, "result");
    const published = validatePublishedComparisonArtifactSet(resultDirectory);
    const result = readValidatedComparisonResult(
      published.files["comparison.private.json"],
      comparisonMode
    );
    if (result.sessionUuid !== sessionUuid)
      throw new Error("COMPARISON_RESULT_SESSION_MISMATCH");
    if (result.runSignature !== resumeSignature)
      throw new Error("COMPARISON_RESULT_RUN_SIGNATURE_MISMATCH");
    const archivedWorkbook = archiveComparisonWorkbook({
      workbookFile: published.files["polizzenvergleich.xlsx"],
      sessionUuid,
      runSignature: resumeSignature,
      comparisonMode,
    });
    const exportContract = buildComparisonExportContract({
      comparisonMode,
      sessionUuid,
      runSignature: resumeSignature,
      artifactSetManifestFile: published.manifestFile,
      archivedWorkbook,
    });
    writePrivateJson(
      path.join(resultDirectory, "export.private.json"),
      exportContract
    );
    await updateSession(session.id, {
      status: "COMPLETED",
      progress: JSON.stringify({
        phase: "COMPLETED",
        completedDocuments: manifest.documents.length,
        totalDocuments: manifest.documents.length,
        completedCategories: result.totals.rows,
        totalCategories: result.totals.rows,
        currentDocument: null,
      }),
      resultPath: path.relative(policyComparisonsPath, resultDirectory),
      error: null,
      workerPid: null,
      completedAt: new Date(),
    });
    return;
  }

  let dynamicTemplate = null;
  if (referenceMode) {
    const sourceRun = plannedRuns.find(({ document }) => document.side === "A");
    if (!sourceRun) throw new Error("LF_DYNAMIC_REFERENCE_SOURCE_A_MISSING");
    await updateSession(session.id, {
      status: "RUNNING",
      startedAt: new Date(),
      progress: JSON.stringify({
        phase: "BUILDING_A_TEMPLATE",
        completedDocuments: 0,
        totalDocuments: manifest.documents.length,
        currentDocument: {
          uuid: sourceRun.document.uuid,
          side: "A",
          originalName: sourceRun.document.originalName,
        },
      }),
    });
    dynamicTemplate = await prepareDynamicReferenceTemplate({
      runRoot,
      sourceFile: await validatedSourceFile(sourceRun.document),
      documentRun: sourceRun,
      logFile: path.join(runRoot, "worker.log"),
    });
  }
  const contracts = referenceMode ? dynamicTemplate.contracts : null;
  const categoryOrder = referenceMode
    ? contracts.map(({ categoryView }) => categoryView)
    : CATEGORY_ORDER;
  const categoryCount = categoryOrder.length;
  const analysisRuns = referenceMode
    ? plannedRuns.filter(({ document }) => document.side === "B")
    : plannedRuns;
  const signature = referenceMode
    ? sha256(
        JSON.stringify({
          resumeSignature,
          templateDigest: dynamicTemplate.templateDigest,
        })
      )
    : resumeSignature;
  const totalCategoryRuns = analysisRuns.length * categoryCount;
  const resumedCategories = analysisRuns.reduce(
    (sum, { outputDirectory }) =>
      sum +
      (referenceMode
        ? completedReferenceCategoryViews(outputDirectory, contracts).length
        : completedCategoryViews(outputDirectory).length),
    0
  );

  await updateSession(session.id, {
    status: "RUNNING",
    startedAt: new Date(),
    progress: JSON.stringify({
      phase: "ANALYZING_DOCUMENTS",
      completedDocuments: referenceMode ? 1 : 0,
      totalDocuments: manifest.documents.length,
      completedCategories: resumedCategories,
      totalCategories: totalCategoryRuns,
      resumedCategories,
      currentDocument: null,
    }),
  });

  const documentRuns = [];
  for (const [index, plannedRun] of analysisRuns.entries()) {
    const { document, outputDirectory: documentOutput } = plannedRun;
    const sourceFile = await validatedSourceFile(document);
    const completedBeforeRun = referenceMode
      ? completedReferenceCategoryViews(documentOutput, contracts).length
      : completedCategoryViews(documentOutput).length;
    await updateSession(session.id, {
      progress: JSON.stringify({
        phase: "ANALYZING_DOCUMENTS",
        completedDocuments: referenceMode ? index + 1 : index,
        totalDocuments: manifest.documents.length,
        completedCategories: index * categoryCount + completedBeforeRun,
        totalCategories: totalCategoryRuns,
        resumedCategories,
        currentCategory: null,
        currentDocument: {
          uuid: document.uuid,
          side: document.side,
          originalName: document.originalName,
        },
      }),
    });
    let progressUpdates = Promise.resolve();
    const onCategoryComplete = (categoryView, completedInDocument) => {
      const completedCount = Number.isInteger(completedInDocument)
        ? completedInDocument
        : categoryOrder.indexOf(categoryView) + 1;
      progressUpdates = progressUpdates.then(() =>
        updateSession(session.id, {
          progress: JSON.stringify({
            phase: "ANALYZING_DOCUMENTS",
            completedDocuments: referenceMode ? index + 1 : index,
            totalDocuments: manifest.documents.length,
            completedCategories: index * categoryCount + completedCount,
            totalCategories: totalCategoryRuns,
            resumedCategories,
            currentCategory: categoryView,
            currentDocument: {
              uuid: document.uuid,
              side: document.side,
              originalName: document.originalName,
            },
          }),
        })
      );
    };
    if (referenceMode)
      await analyzeReferenceDocument({
        file: sourceFile,
        documentStatus: document.documentStatus,
        outputDirectory: documentOutput,
        logFile: path.join(runRoot, "worker.log"),
        contracts,
        model: MODEL,
        modelTokenLimit: MODEL_TOKEN_LIMIT,
        responseCacheDirectory,
        onCategoryComplete,
      });
    else
      await runDocument({
        file: sourceFile,
        documentStatus: document.documentStatus,
        outputDirectory: documentOutput,
        logFile: path.join(runRoot, "worker.log"),
        initialCompletedCategories: completedCategoryViews(documentOutput),
        onCategoryComplete,
      });
    await progressUpdates;
    documentRuns.push({ document, outputDirectory: documentOutput });
  }

  await updateSession(session.id, {
    progress: JSON.stringify({
      phase: "BUILDING_COMPARISON",
      completedDocuments: manifest.documents.length,
      totalDocuments: manifest.documents.length,
      completedCategories: totalCategoryRuns,
      totalCategories: totalCategoryRuns,
      resumedCategories,
      currentCategory: null,
      currentDocument: null,
    }),
  });
  const resultDirectory = path.join(runRoot, "result");
  let artifacts;
  if (fs.existsSync(resultDirectory)) {
    const published = validatePublishedComparisonArtifactSet(resultDirectory);
    const result = readValidatedComparisonResult(
      published.files["comparison.private.json"],
      comparisonMode
    );
    if (result.sessionUuid !== sessionUuid)
      throw new Error("COMPARISON_RESULT_SESSION_MISMATCH");
    if (result.runSignature !== signature)
      throw new Error("COMPARISON_RESULT_RUN_SIGNATURE_MISMATCH");
    artifacts = {
      result,
      jsonFile: published.files["comparison.private.json"],
      markdownFile: published.files["comparison.md"],
      workbookFile: published.files["polizzenvergleich.xlsx"],
      artifactSetManifest: published.manifest,
      artifactSetManifestFile: published.manifestFile,
      reused: true,
    };
  } else {
    artifacts = referenceMode
      ? await writeDynamicReferenceComparisonArtifacts({
          sourceDocument: plannedRuns.find(
            ({ document }) => document.side === "A"
          ).document,
          sideBDocumentRuns: documentRuns,
          manifest: dynamicTemplate.manifest,
          contracts,
          outputDirectory: resultDirectory,
          metadata: {
            sessionUuid,
            runSignature: signature,
            templateDigest: dynamicTemplate.templateDigest,
          },
        })
      : await writeComparisonArtifacts({
          documentRuns,
          outputDirectory: resultDirectory,
          metadata: { sessionUuid, runSignature: signature },
          enforceProductProfile: true,
        });
  }
  if (referenceMode)
    validateDynamicReferenceComparison(artifacts.result, {
      manifest: dynamicTemplate.manifest,
    });
  else validateCustomerComparisonFile(artifacts.jsonFile);
  const archivedWorkbook = archiveComparisonWorkbook({
    workbookFile: artifacts.workbookFile,
    sessionUuid,
    runSignature: signature,
    comparisonMode,
  });
  const exportContract = buildComparisonExportContract({
    comparisonMode,
    sessionUuid,
    runSignature: signature,
    artifactSetManifestFile: artifacts.artifactSetManifestFile,
    archivedWorkbook,
  });
  writePrivateJson(
    path.join(resultDirectory, "export.private.json"),
    exportContract
  );
  const resultPath = path.relative(policyComparisonsPath, resultDirectory);
  await updateSession(session.id, {
    status: "COMPLETED",
    progress: JSON.stringify({
      phase: "COMPLETED",
      completedDocuments: manifest.documents.length,
      totalDocuments: manifest.documents.length,
      completedCategories: totalCategoryRuns,
      totalCategories: totalCategoryRuns,
      resumedCategories,
      currentCategory: null,
      currentDocument: null,
    }),
    resultPath,
    error: null,
    workerPid: null,
    completedAt: new Date(),
  });
}

main()
  .catch(async (error) => {
    process.exitCode = 1;
    console.error(error.stack || error.message);
    const sessionUuid = String(process.argv[2] || "").trim();
    const leaseNonce = String(process.argv[3] || "").trim();
    if (!sessionUuid || !UUID_PATTERN.test(leaseNonce)) return;
    await failOwnedSession(sessionUuid, leaseNonce, error).catch(console.error);
  })
  .finally(async () => {
    await releaseOwnedWorkerPid().catch(console.error);
    await prisma.$disconnect();
  });
