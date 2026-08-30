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

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const RUNNER = path.join(REPOSITORY_ROOT, "run-all-categories-quality.command");

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

async function updateSession(id, data) {
  await prisma.policy_comparison_sessions.update({
    where: { id },
    data: { ...data, lastUpdatedAt: new Date() },
  });
}

function runDocument({ file, documentStatus, outputDirectory, logFile }) {
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
        stdio: ["ignore", log, log],
      }
    );
    child.once("error", (error) => {
      closeLog();
      reject(error);
    });
    child.once("exit", (code, signal) => {
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
    manifest?.schemaVersion !== 1 ||
    manifest?.sessionUuid !== sessionUuid ||
    !Array.isArray(manifest.documents)
  )
    throw new Error("COMPARISON_INPUT_MANIFEST_INVALID");

  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const runRoot = path.resolve(
    policyComparisonsPath,
    "runs",
    sessionUuid,
    timestamp
  );
  if (!isWithin(policyComparisonsPath, runRoot))
    throw new Error("COMPARISON_RUN_PATH_INVALID");
  privateDirectory(runRoot);
  fs.writeFileSync(
    path.join(runRoot, "input-manifest.private.json"),
    JSON.stringify(manifest, null, 2),
    { encoding: "utf8", mode: 0o600 }
  );

  await updateSession(session.id, {
    status: "RUNNING",
    startedAt: new Date(),
    progress: JSON.stringify({
      phase: "ANALYZING_DOCUMENTS",
      completedDocuments: 0,
      totalDocuments: manifest.documents.length,
      currentDocument: null,
    }),
  });

  const documentRuns = [];
  for (const [index, document] of manifest.documents.entries()) {
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
    await updateSession(session.id, {
      progress: JSON.stringify({
        phase: "ANALYZING_DOCUMENTS",
        completedDocuments: index,
        totalDocuments: manifest.documents.length,
        currentDocument: {
          uuid: document.uuid,
          side: document.side,
          originalName: document.originalName,
        },
      }),
    });
    const documentOutput = path.join(
      runRoot,
      "documents",
      `${document.side}-${String(document.position + 1).padStart(2, "0")}-${document.uuid}`
    );
    await runDocument({
      file: sourceFile,
      documentStatus: document.documentStatus,
      outputDirectory: documentOutput,
      logFile: path.join(runRoot, "worker.log"),
    });
    documentRuns.push({ document, outputDirectory: documentOutput });
  }

  await updateSession(session.id, {
    progress: JSON.stringify({
      phase: "BUILDING_COMPARISON",
      completedDocuments: manifest.documents.length,
      totalDocuments: manifest.documents.length,
      currentDocument: null,
    }),
  });
  const resultDirectory = path.join(runRoot, "result");
  await writeComparisonArtifacts({
    documentRuns,
    outputDirectory: resultDirectory,
    metadata: { sessionUuid },
  });
  const resultPath = path.relative(policyComparisonsPath, resultDirectory);
  await updateSession(session.id, {
    status: "COMPLETED",
    progress: JSON.stringify({
      phase: "COMPLETED",
      completedDocuments: manifest.documents.length,
      totalDocuments: manifest.documents.length,
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
