#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function fail(message) {
  console.error(`[category-worksheet] ${message}`);
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
  if (!fs.existsSync(file)) fail(`${label} fehlt: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set([
    "documentArtifact",
    "catalogFile",
    "output",
    "requirementIds",
  ]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  if (!args.output) fail("--output ist erforderlich");
  const artifact = readJson(
    path.resolve(args.documentArtifact || ""),
    "Dokument-Artefakt"
  );
  let catalog = readJson(path.resolve(args.catalogFile || ""), "Katalog");
  const wrapped =
    artifact?.schemaVersion === 1 &&
    artifact.fingerprint &&
    artifact.document?.sourceDocumentId === artifact.fingerprint;
  const document = wrapped ? artifact.document : artifact;
  const fingerprint = wrapped
    ? artifact.fingerprint
    : crypto
        .createHash("sha256")
        .update(String(document?.pageContent || ""))
        .digest("hex");
  if (
    !document?.pageContent ||
    !Array.isArray(document.pageMap) ||
    document.pdfExtraction?.complete !== true
  )
    fail("Dokument-Artefakt ist ungültig");
  if (args.requirementIds) {
    const requirementIds = [
      ...new Set(
        args.requirementIds
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      ),
    ];
    const requirementById = new Map(
      catalog.requirements.map((requirement) => [requirement.id, requirement])
    );
    const missing = requirementIds.filter((id) => !requirementById.has(id));
    if (missing.length)
      fail(`Unbekannte Requirement-IDs: ${missing.join(",")}`);
    catalog = {
      ...catalog,
      catalogId: `${catalog.catalogId}:subset:${requirementIds.join(",")}`,
      requirements: requirementIds.map((id) => requirementById.get(id)),
    };
  }

  const worksheet = buildControlledOccurrenceWorksheet({
    document,
    documentFingerprint: fingerprint,
    catalog,
  });
  const outputFile = path.resolve(args.output);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(outputFile, JSON.stringify(worksheet, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(outputFile, 0o600);
  console.log(
    `[category-worksheet] ${catalog.categoryView}: ${worksheet.summary.occurrenceCount} Kandidaten, ` +
      `${worksheet.summary.componentsWithCandidates}/${worksheet.summary.componentCount} Komponenten`
  );
}

run();
