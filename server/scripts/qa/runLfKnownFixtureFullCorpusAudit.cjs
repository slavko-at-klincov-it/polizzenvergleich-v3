#!/usr/bin/env node

process.umask(0o077);

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  buildLfKnownFixtureFullCorpusAudit,
  sha256,
} = require("../../utils/policyAnalysis/lfKnownFixtureFullCorpusAudit");

function fail(message) {
  console.error(`[lf-full-corpus-audit] ${message}`);
  process.exit(1);
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) fail(`Ungültiges Argument: ${key}`);
    values[key.slice(2)] = value;
  }
  for (const required of ["oracle", "queries", "pdfRoot", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, path.resolve(value)])
  );
}

function readRegularFile(file, code) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(code);
  return fs.readFileSync(file);
}

function extractPdfKitPages(pdfFile) {
  const jxa = [
    'ObjC.import("PDFKit");',
    'ObjC.import("Foundation");',
    `const url = $.NSURL.fileURLWithPath(${JSON.stringify(pdfFile)});`,
    "const document = $.PDFDocument.alloc.initWithURL(url);",
    'if (!document) throw new Error("PDF_OPEN_FAILED");',
    "const count = Number(document.pageCount);",
    "const pages = [];",
    "for (let index = 0; index < count; index += 1) {",
    "  const value = document.pageAtIndex(index).string;",
    '  pages.push(value ? ObjC.unwrap(value) : "");',
    "}",
    "JSON.stringify({ pageCount: count, pages });",
  ].join("\n");
  const result = execFileSync("/usr/bin/osascript", [
    "-l",
    "JavaScript",
    "-e",
    jxa,
  ], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const parsed = JSON.parse(result);
  if (parsed.pageCount !== parsed.pages.length)
    throw new Error(`PDF_PAGE_COUNT_INVALID:${pdfFile}`);
  return parsed.pages;
}

function writePrivateJson(file, value) {
  if (fs.existsSync(file)) throw new Error(`OUTPUT_EXISTS:${file}`);
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
  const oracleBuffer = readRegularFile(args.oracle, "ORACLE_INVALID");
  const queryBuffer = readRegularFile(args.queries, "QUERIES_INVALID");
  const oracle = JSON.parse(oracleBuffer);
  const querySpec = JSON.parse(queryBuffer);
  const extractedDocuments = oracle.documents
    .filter(({ side }) => side === "B")
    .map((document) => {
      const pdfFile = path.join(args.pdfRoot, document.originalName);
      const pdfBuffer = readRegularFile(pdfFile, "PDF_INVALID");
      const pdfSha256 = sha256(pdfBuffer);
      if (pdfSha256 !== document.fingerprint)
        throw new Error(`PDF_FINGERPRINT_MISMATCH:${document.originalName}`);
      return {
        originalName: document.originalName,
        fingerprint: document.fingerprint,
        pdfSha256,
        pages: extractPdfKitPages(pdfFile),
      };
    });
  const artifact = buildLfKnownFixtureFullCorpusAudit({
    oracle,
    oracleSha256: sha256(oracleBuffer),
    querySpec,
    querySpecSha256: sha256(queryBuffer),
    extractedDocuments,
  });
  writePrivateJson(args.output, artifact);
  console.log(JSON.stringify(artifact.summary));
  console.log(`[lf-full-corpus-audit] ${artifact.auditSha256}`);
}

if (require.main === module)
  try {
    run();
  } catch (error) {
    fail(error.stack || error.message);
  }

module.exports = { argumentsFrom, extractPdfKitPages };
