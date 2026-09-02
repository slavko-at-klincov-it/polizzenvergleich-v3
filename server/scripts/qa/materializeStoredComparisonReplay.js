#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  writeComparisonArtifacts,
} = require("../../utils/policyComparison/resultBuilder");

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function main() {
  const [inputManifestFile, sourceRunRoot, outputDirectory, sessionUuid] =
    process.argv.slice(2);
  for (const candidate of [
    inputManifestFile,
    sourceRunRoot,
    outputDirectory,
  ]) {
    if (!candidate || !path.isAbsolute(candidate))
      throw new Error("ABSOLUTE_PATHS_REQUIRED");
  }
  if (!sessionUuid) throw new Error("SESSION_UUID_REQUIRED");
  if (fs.existsSync(outputDirectory)) throw new Error("OUTPUT_ALREADY_EXISTS");

  const inputManifest = readJson(inputManifestFile);
  if (!Array.isArray(inputManifest?.documents) || inputManifest.documents.length < 1)
    throw new Error("INPUT_MANIFEST_INVALID");

  const runBySha = new Map();
  for (const name of fs.readdirSync(sourceRunRoot)) {
    const runDirectory = path.join(sourceRunRoot, name);
    const manifestFile = path.join(runDirectory, "manifest.private.json");
    if (!fs.statSync(runDirectory).isDirectory() || !fs.existsSync(manifestFile))
      continue;
    const manifest = readJson(manifestFile);
    const documentSha256 = String(manifest?.document?.sha256 || "");
    if (!/^[a-f0-9]{64}$/u.test(documentSha256)) continue;
    if (runBySha.has(documentSha256))
      throw new Error(`DUPLICATE_DOCUMENT_RUN:${documentSha256}`);
    runBySha.set(documentSha256, runDirectory);
  }

  const documentRuns = inputManifest.documents.map((document) => {
    const outputDirectoryForDocument = runBySha.get(document.sha256);
    if (!outputDirectoryForDocument)
      throw new Error(`DOCUMENT_RUN_MISSING:${document.uuid}`);
    return { document, outputDirectory: outputDirectoryForDocument };
  });

  const artifacts = await writeComparisonArtifacts({
    documentRuns,
    outputDirectory,
    metadata: {
      sessionUuid,
      replaySource: {
        runRoot: sourceRunRoot,
        inputManifestFile,
        inputManifestSha256: sha256File(inputManifestFile),
      },
    },
    enforceProductProfile: true,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "STORED_COMPARISON_REPLAY_COMPLETE",
        outputDirectory,
        schemaVersion: artifacts.result.schemaVersion,
        totals: artifacts.result.totals,
        sha256: {
          comparison: sha256File(artifacts.jsonFile),
          markdown: sha256File(artifacts.markdownFile),
          workbook: sha256File(artifacts.workbookFile),
        },
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
