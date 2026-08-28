#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const PDFLoader = require("../../../collector/processSingleFile/convert/asPDF/PDFLoader");
const {
  assemblePageMap,
} = require("../../../collector/processSingleFile/convert/asPDF/PDFPageMap");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function fail(message) {
  console.error(`[vs-occurrence-worksheet] ${message}`);
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

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowedArguments = new Set([
    "pdfFile",
    "catalogFile",
    "output",
    "requirementIds",
  ]);
  const unknownArguments = Object.keys(args).filter(
    (argument) => !allowedArguments.has(argument)
  );
  if (unknownArguments.length)
    fail(`Unbekannte Argumente: ${unknownArguments.join(",")}`);
  const pdfFile = path.resolve(args.pdfFile || "");
  const catalogFile = path.resolve(args.catalogFile || "");
  const outputFile = path.resolve(args.output || "");
  for (const [label, file] of [
    ["PDF", pdfFile],
    ["Katalog", catalogFile],
  ]) {
    if (!file || !fs.existsSync(file)) fail(`${label} fehlt: ${file}`);
  }
  if (!args.output) fail("--output ist erforderlich");

  const pdfBuffer = fs.readFileSync(pdfFile);
  const fingerprint = crypto
    .createHash("sha256")
    .update(pdfBuffer)
    .digest("hex");
  const pages = await new PDFLoader(pdfFile, { splitPages: true }).load();
  const extraction = assemblePageMap(pages);
  const document = {
    id: fingerprint,
    sourceDocumentId: fingerprint,
    title: path.basename(pdfFile),
    documentType: "pdf",
    ...extraction,
  };
  let catalog = JSON.parse(fs.readFileSync(catalogFile, "utf8"));
  if (args.requirementIds) {
    const requirementIds = [
      ...new Set(
        args.requirementIds
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      ),
    ];
    if (requirementIds.length === 0) fail("--requirementIds ist leer");
    const byId = new Map(
      (catalog.requirements || []).map((requirement) => [
        requirement.id,
        requirement,
      ])
    );
    const missing = requirementIds.filter((id) => !byId.has(id));
    if (missing.length)
      fail(`Unbekannte Requirement-IDs: ${missing.join(",")}`);
    catalog = {
      ...catalog,
      catalogId: `${catalog.catalogId}:subset:${requirementIds.join(",")}`,
      requirements: requirementIds.map((id) => byId.get(id)),
    };
  }
  const worksheet = buildControlledOccurrenceWorksheet({
    document,
    documentFingerprint: fingerprint,
    catalog,
  });

  fs.mkdirSync(path.dirname(outputFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(outputFile, JSON.stringify(worksheet, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(outputFile, 0o600);
  console.log(
    `[vs-occurrence-worksheet] ${worksheet.summary.occurrenceCount} Kandidaten, ` +
      `${worksheet.summary.componentsWithCandidates}/${worksheet.summary.componentCount} Komponenten: ${outputFile}`
  );
}

run().catch((error) => fail(error.stack || error.message));
