#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const PDFLoader = require("../../../collector/processSingleFile/convert/asPDF/PDFLoader");
const {
  assemblePageMap,
} = require("../../../collector/processSingleFile/convert/asPDF/PDFPageMap");

function fail(message) {
  console.error(`[policy-document] ${message}`);
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
  const unknown = Object.keys(args).filter(
    (key) => !["pdfFile", "output"].includes(key)
  );
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  const pdfFile = path.resolve(args.pdfFile || "");
  const outputFile = path.resolve(args.output || "");
  if (!fs.existsSync(pdfFile)) fail(`PDF fehlt: ${pdfFile}`);
  if (!args.output) fail("--output ist erforderlich");

  const fingerprint = crypto
    .createHash("sha256")
    .update(fs.readFileSync(pdfFile))
    .digest("hex");
  if (fs.existsSync(outputFile)) {
    const existing = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    if (
      existing?.schemaVersion !== 1 ||
      existing.fingerprint !== fingerprint ||
      existing.document?.sourceDocumentId !== fingerprint
    )
      fail(
        `Vorhandenes Dokument-Artefakt gehört zu einer anderen PDF: ${outputFile}`
      );
    console.log(
      `[policy-document] Passendes Dokument-Artefakt wiederverwendet: ${outputFile}`
    );
    return;
  }
  const pages = await new PDFLoader(pdfFile, { splitPages: true }).load();
  const document = {
    id: fingerprint,
    sourceDocumentId: fingerprint,
    title: path.basename(pdfFile),
    documentType: "pdf",
    ...assemblePageMap(pages),
  };
  const artifact = {
    schemaVersion: 1,
    fingerprint,
    document,
  };
  fs.mkdirSync(path.dirname(outputFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(outputFile, JSON.stringify(artifact, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(outputFile, 0o600);
  console.log(
    `[policy-document] ${document.pdfExtraction.totalPages} Seiten einmalig vorbereitet: ${outputFile}`
  );
}

run().catch((error) => fail(error.stack || error.message));
