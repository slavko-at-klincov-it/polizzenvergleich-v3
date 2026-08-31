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
  archiveComparisonWorkbook,
} = require("../utils/policyComparison/workbookArchive");
const {
  releaseIdentity,
  sha256,
} = require("../utils/policyAnalysis/runIdentity");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const RUNNER = path.join(REPOSITORY_ROOT, "run-all-categories-quality.command");
const CATEGORY_COUNT = CATEGORY_ORDER.length;
const MODEL = process.env.POLICY_FULL_MODEL || "qwen/qwen3.6-35b-a3b";
const MODEL_TOKEN_LIMIT = Number(
  process.env.POLICY_FULL_MODEL_TOKEN_LIMIT || 42496
);

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

function resumableRun({ sessionUuid, manifest }) {
  const contract = {
    schemaVersion: 3,
    releaseId: releaseIdentity(REPOSITORY_ROOT),
    productProfile: PRODUCT_PROFILE,
    configuration: {
      model: MODEL,
      modelTokenLimit: MODEL_TOKEN_LIMIT,
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
  if (fs.existsSync(contractFile)) {
    const existing = JSON.parse(fs.readFileSync(contractFile, "utf8"));
    if (JSON.stringify(existing) !== JSON.stringify(contract))
      throw new Error("COMPARISON_RESUME_CONTRACT_MISMATCH");
  } else {
    writePrivateJson(contractFile, contract);
  }
  return { runRoot, signature };
}

async function updateSession(id, data) {
  await prisma.policy_comparison_sessions.update({
    where: { id },
    data: { ...data, lastUpdatedAt: new Date() },
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

async function main() {
  const sessionUuid = String(process.argv[2] || "").trim();
  if (!sessionUuid) throw new Error("SESSION_UUID_REQUIRED");
  const session = await prisma.policy_comparison_sessions.findUnique({
    where: { uuid: sessionUuid },
  });
  if (!session) throw new Error("COMPARISON_SESSION_NOT_FOUND");
  if (session.status !== "QUEUED")
    throw new Error(`COMPARISON_SESSION_NOT_QUEUED:${session.status}`);
  const manifest = JSON.parse(session.inputManifest || "null");
  if (
    manifest?.schemaVersion !== 2 ||
    manifest?.sessionUuid !== sessionUuid ||
    JSON.stringify(manifest?.productProfile) !==
      JSON.stringify(PRODUCT_PROFILE) ||
    !Array.isArray(manifest.documents)
  )
    throw new Error("COMPARISON_INPUT_MANIFEST_INVALID");

  const { runRoot, signature } = resumableRun({ sessionUuid, manifest });
  writePrivateJson(path.join(runRoot, "input-manifest.private.json"), manifest);
  const plannedRuns = manifest.documents.map((document) => ({
    document,
    outputDirectory: path.join(
      runRoot,
      "documents",
      `${document.side}-${String(document.position + 1).padStart(2, "0")}-${document.uuid}`
    ),
  }));
  const resumedCategories = plannedRuns.reduce(
    (sum, { outputDirectory }) =>
      sum + completedCategoryViews(outputDirectory).length,
    0
  );

  await updateSession(session.id, {
    status: "RUNNING",
    startedAt: new Date(),
    progress: JSON.stringify({
      phase: "ANALYZING_DOCUMENTS",
      completedDocuments: 0,
      totalDocuments: manifest.documents.length,
      completedCategories: resumedCategories,
      totalCategories: manifest.documents.length * CATEGORY_COUNT,
      resumedCategories,
      currentDocument: null,
    }),
  });

  const documentRuns = [];
  for (const [index, plannedRun] of plannedRuns.entries()) {
    const { document, outputDirectory: documentOutput } = plannedRun;
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
    const completedBeforeRun = completedCategoryViews(documentOutput).length;
    await updateSession(session.id, {
      progress: JSON.stringify({
        phase: "ANALYZING_DOCUMENTS",
        completedDocuments: index,
        totalDocuments: manifest.documents.length,
        completedCategories: index * CATEGORY_COUNT + completedBeforeRun,
        totalCategories: manifest.documents.length * CATEGORY_COUNT,
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
    await runDocument({
      file: sourceFile,
      documentStatus: document.documentStatus,
      outputDirectory: documentOutput,
      logFile: path.join(runRoot, "worker.log"),
      initialCompletedCategories: completedCategoryViews(documentOutput),
      onCategoryComplete: (categoryView, completedInDocument) => {
        progressUpdates = progressUpdates.then(() =>
          updateSession(session.id, {
            progress: JSON.stringify({
              phase: "ANALYZING_DOCUMENTS",
              completedDocuments: index,
              totalDocuments: manifest.documents.length,
              completedCategories: index * CATEGORY_COUNT + completedInDocument,
              totalCategories: manifest.documents.length * CATEGORY_COUNT,
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
      },
    });
    await progressUpdates;
    documentRuns.push({ document, outputDirectory: documentOutput });
  }

  await updateSession(session.id, {
    progress: JSON.stringify({
      phase: "BUILDING_COMPARISON",
      completedDocuments: manifest.documents.length,
      totalDocuments: manifest.documents.length,
      completedCategories: manifest.documents.length * CATEGORY_COUNT,
      totalCategories: manifest.documents.length * CATEGORY_COUNT,
      resumedCategories,
      currentCategory: null,
      currentDocument: null,
    }),
  });
  const resultDirectory = path.join(runRoot, "result");
  const artifacts = await writeComparisonArtifacts({
    documentRuns,
    outputDirectory: resultDirectory,
    metadata: { sessionUuid, runSignature: signature },
    enforceProductProfile: true,
  });
  const archivedWorkbook = archiveComparisonWorkbook({
    workbookFile: artifacts.workbookFile,
    sessionUuid,
    runSignature: signature,
  });
  writePrivateJson(path.join(resultDirectory, "export.private.json"), {
    schemaVersion: 1,
    archivedWorkbook,
  });
  const resultPath = path.relative(policyComparisonsPath, resultDirectory);
  await updateSession(session.id, {
    status: "COMPLETED",
    progress: JSON.stringify({
      phase: "COMPLETED",
      completedDocuments: manifest.documents.length,
      totalDocuments: manifest.documents.length,
      completedCategories: manifest.documents.length * CATEGORY_COUNT,
      totalCategories: manifest.documents.length * CATEGORY_COUNT,
      resumedCategories,
      currentCategory: null,
      currentDocument: null,
    }),
    resultPath,
    error: null,
    completedAt: new Date(),
  });
}

main()
  .catch(async (error) => {
    console.error(error.stack || error.message);
    const sessionUuid = String(process.argv[2] || "").trim();
    if (!sessionUuid) return;
    const session = await prisma.policy_comparison_sessions.findUnique({
      where: { uuid: sessionUuid },
    });
    if (!session) return;
    if (session.status === "CANCELLED") return;
    await updateSession(session.id, {
      status: "FAILED",
      error: error.message,
      completedAt: new Date(),
    });
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
