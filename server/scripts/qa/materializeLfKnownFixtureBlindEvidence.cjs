#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  buildBlindEvidenceRowInputs,
  buildLfKnownFixtureBlindEvidencePacket,
} = require("../../utils/policyAnalysis/lfKnownFixtureBlindEvidence");
const {
  canonicalJson,
} = require("../../utils/policyAnalysis/lfReferenceGoldOracle");

function fail(message) {
  console.error(`[lf-blind-evidence-v2] ${message}`);
  process.exit(1);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      fail(`Ungültiges Argument: ${key || "-"}`);
    values[key.slice(2)] = value;
  }
  for (const required of [
    "semanticManifest",
    "oracle",
    "documentCatalogDirectory",
    "output",
  ])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return {
    semanticManifest: path.resolve(values.semanticManifest),
    oracle: path.resolve(values.oracle),
    documentCatalogDirectory: path.resolve(values.documentCatalogDirectory),
    output: path.resolve(values.output),
    rowOutputDirectory: values.rowOutputDirectory
      ? path.resolve(values.rowOutputDirectory)
      : null,
    maximumEvidenceGroupsPerCheck: Number(
      values.maximumEvidenceGroupsPerCheck || 12
    ),
    maximumNavigationAnchors: Number(values.maximumNavigationAnchors || 6),
    maximumEvidenceGroupCharacters: Number(
      values.maximumEvidenceGroupCharacters || 12_000
    ),
    maximumPartitionCharacters: Number(
      values.maximumPartitionCharacters || 80_000
    ),
  };
}

function readRegularBytes(file, label) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} ist ungültig`);
  return fs.readFileSync(file);
}

function readJson(file, label) {
  return JSON.parse(readRegularBytes(file, label).toString("utf8"));
}

function documentInputs(oracle, directory) {
  const entries = fs
    .readdirSync(directory)
    .filter((name) => /^document-\d+\.private\.json$/u.test(name))
    .sort()
    .map((name) => readJson(path.join(directory, name), name));
  const catalogsByUuid = new Map(
    entries.map((entry) => [entry.document?.uuid, entry])
  );
  return oracle.documents
    .filter(({ side }) => side === "B")
    .sort((left, right) => left.uuid.localeCompare(right.uuid))
    .map((expected) => {
      const catalog = catalogsByUuid.get(expected.uuid);
      if (!catalog?.document?.artifactPath)
        fail(`Dokumentkatalog fehlt: ${expected.uuid}`);
      const artifactBytes = readRegularBytes(
        catalog.document.artifactPath,
        `Originalartefakt ${expected.uuid}`
      );
      const artifact = JSON.parse(artifactBytes.toString("utf8"));
      const pageMapSha256 = sha256(
        Buffer.from(canonicalJson(artifact.document?.pageMap || []), "utf8")
      );
      if (
        catalog.document.sha256 !== expected.fingerprint ||
        catalog.document.artifactSha256 !== expected.artifactSha256 ||
        sha256(artifactBytes) !== expected.artifactSha256 ||
        artifact.fingerprint !== expected.fingerprint ||
        artifact.document?.sourceDocumentId !== expected.fingerprint ||
        pageMapSha256 !== expected.pageMapSha256 ||
        artifact.document?.pdfExtraction?.complete !== true ||
        artifact.document.pdfExtraction.totalPages !==
          artifact.document.pdfExtraction.processedPages ||
        artifact.document.pdfExtraction.totalPages !==
          artifact.document.pageMap.length
      )
        fail(`Originalartefakt-Bindung ungültig: ${expected.uuid}`);
      return {
        document: {
          uuid: expected.uuid,
          position: catalog.document.position,
          sha256: expected.fingerprint,
          originalName: expected.originalName,
          role: expected.role,
          documentStatus: expected.documentStatus,
        },
        artifact,
      };
    })
    .sort((left, right) => left.document.position - right.document.position)
    .map((entry, position) => ({
      ...entry,
      document: { ...entry.document, position },
    }));
}

function writePrivateJson(file, value) {
  if (fs.existsSync(file)) fail(`Ausgabe existiert bereits: ${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function run() {
  const args = argumentsFrom(process.argv.slice(2));
  const semanticManifest = readJson(args.semanticManifest, "Semantic Manifest");
  const oracle = readJson(args.oracle, "Oracle");
  const packet = buildLfKnownFixtureBlindEvidencePacket({
    semanticManifest,
    oracle,
    bDocuments: documentInputs(oracle, args.documentCatalogDirectory),
    maximumEvidenceGroupsPerCheck: args.maximumEvidenceGroupsPerCheck,
    maximumNavigationAnchors: args.maximumNavigationAnchors,
    maximumEvidenceGroupCharacters: args.maximumEvidenceGroupCharacters,
  });
  writePrivateJson(args.output, packet);
  if (args.rowOutputDirectory) {
    for (const row of packet.rows) {
      if (row.evidenceReadiness !== "READY") continue;
      const inputs = buildBlindEvidenceRowInputs(packet, row.requirementId, {
        maximumPartitionCharacters: args.maximumPartitionCharacters,
      });
      inputs.forEach((input, index) =>
        writePrivateJson(
          path.join(
            args.rowOutputDirectory,
            `${String(row.sourceOrder + 1).padStart(3, "0")}-${row.requirementId}-part-${String(
              index + 1
            ).padStart(2, "0")}.private.json`
          ),
          input
        )
      );
    }
  }
  console.log(
    `[lf-blind-evidence-v2] ${packet.status}: ${packet.summary.readyRows}/${packet.summary.rows} Zeilen, ${packet.summary.components} Komponenten, ${packet.summary.evidenceGroups} vollständige Evidenzgruppen`
  );
  console.log(JSON.stringify(packet.summary));
}

try {
  run();
} catch (error) {
  fail(error.stack || error.message);
}
