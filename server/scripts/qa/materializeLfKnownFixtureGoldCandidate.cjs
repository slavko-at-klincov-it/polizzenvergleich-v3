#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const {
  buildLfKnownFixtureGoldCandidate,
  sha256,
} = require("../../utils/policyAnalysis/lfKnownFixtureGoldCandidate");

const CLAUDE_HEADERS = [
  "Kategorie",
  "Unterkategorie",
  "Zeilen-ID",
  "Prüfpunkt",
  "Gefunden Ja / Nein",
  "Deckung Ja / Nein",
  "Deckung in EUR / % / Zeit",
  "Quellzitat",
  "Quelldatei",
  "Hinweis",
  "Fachliche Bewertung (manuell)",
];
const SYSTEM_HEADERS = [
  "LF_Kategorie",
  "LF_Unterkategorie",
  "LF_Zeilen-ID",
  "LF_Prüfpunkt",
  "A_Vertragsinhalt",
  "A_Werte",
  "A_Quelle",
  "B_Gegenstück",
  "B_Deckung",
  "B_Werte",
  "B_Quelle",
  "KI_Fundstatus",
  "KI_Prüfhinweis",
  "Fachliche Bewertung (manuell)",
];

function fail(message) {
  console.error(`[lf-known-gold-candidate] ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
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
  const allowed = new Set([
    "claudeWorkbook",
    "systemWorkbook",
    "oracle",
    "claudeSourceDir",
    "output",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return values;
}

function regularFile(file, label) {
  if (!path.isAbsolute(file)) fail(`${label} muss absolut sein`);
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    fail(`${label} fehlt: ${file}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink())
    fail(`${label} muss eine reguläre Nicht-Symlink-Datei sein: ${file}`);
}

function regularDirectory(directory, label) {
  if (!path.isAbsolute(directory)) fail(`${label} muss absolut sein`);
  let stat;
  try {
    stat = fs.lstatSync(directory);
  } catch {
    fail(`${label} fehlt: ${directory}`);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink())
    fail(`${label} muss ein Nicht-Symlink-Verzeichnis sein: ${directory}`);
}

function sourceKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("de-AT")
    .replace(/[^a-z0-9]+/gu, "");
}

function fileSha256(file) {
  return sha256(fs.readFileSync(file));
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${label} ist ungültig: ${error.message}`);
  }
}

function headerTexts(worksheet, count) {
  return Array.from({ length: count }, (_unused, index) =>
    worksheet
      .getRow(1)
      .getCell(index + 1)
      .text.trim()
  );
}

function assertHeaders(worksheet, expected, label) {
  const actual = headerTexts(worksheet, expected.length);
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    fail(`${label}-Spaltenvertrag stimmt nicht`);
}

function cellTexts(row, count) {
  return Array.from({ length: count }, (_unused, index) =>
    row.getCell(index + 1).text.trim()
  );
}

async function readClaudeRows(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) fail("Claude-Arbeitsblatt fehlt");
  assertHeaders(worksheet, CLAUDE_HEADERS, "Claude");
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = cellTexts(row, CLAUDE_HEADERS.length);
    rows.push({
      category: values[0],
      subcategory: values[1],
      requirementId: values[2],
      point: values[3],
      foundStatus: values[4],
      coverageStatus: values[5],
      values: values[6],
      sourceQuote: values[7],
      sourceFiles: values[8],
      note: values[9],
      manualAssessment: values[10],
    });
  });
  return rows;
}

async function readSystemRows(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) fail("System-Arbeitsblatt fehlt");
  assertHeaders(worksheet, SYSTEM_HEADERS, "System");
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = cellTexts(row, SYSTEM_HEADERS.length);
    rows.push({
      category: values[0],
      subcategory: values[1],
      requirementId: values[2],
      point: values[3],
      aContent: values[4],
      aValues: values[5],
      aSource: values[6],
      bCounterpart: values[7],
      bCoverage: values[8],
      bValues: values[9],
      bSource: values[10],
      customerSearchStatus: values[11],
      note: values[12],
      manualAssessment: values[13],
    });
  });
  return rows;
}

function resolveSourceDocuments({ claudeRows, sourceDirectory, oracle }) {
  const referencedNames = [];
  const referencedKeys = new Set();
  for (const row of claudeRows) {
    for (const name of row.sourceFiles.split(";")) {
      const trimmed = name.trim();
      if (!trimmed || trimmed === "–") continue;
      const key = sourceKey(trimmed);
      if (referencedKeys.has(key)) continue;
      referencedKeys.add(key);
      referencedNames.push(trimmed);
    }
  }
  const available = fs
    .readdirSync(sourceDirectory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.isSymbolicLink() &&
        !entry.name.startsWith("~$") &&
        new Set([".pdf", ".docx", ".md"]).has(
          path.extname(entry.name).toLocaleLowerCase("de-AT")
        )
    )
    .map((entry) => ({
      name: entry.name,
      key: sourceKey(entry.name),
      file: path.join(sourceDirectory, entry.name),
    }));
  const oracleDocuments = (oracle.documents || []).filter(
    ({ side }) => side === "B"
  );
  const resolved = referencedNames.map((referencedName) => {
    const key = sourceKey(referencedName);
    const matches = available.filter(
      (entry) =>
        entry.key === key || entry.key.includes(key) || key.includes(entry.key)
    );
    if (matches.length !== 1)
      fail(`Claude-Quelldatei nicht eindeutig: ${referencedName}`);
    const match = matches[0];
    const digest = fileSha256(match.file);
    let productDocument = oracleDocuments.find(
      ({ fingerprint }) => fingerprint === digest
    );
    let sourceRelation = "EXACT_PRODUCT_DOCUMENT_SHA";
    if (!productDocument) {
      sourceRelation = "DERIVED_REPRESENTATION_REQUIRES_QUOTE_REBIND";
      if (key.includes("musterberechnung"))
        productDocument = oracleDocuments.find(({ originalName }) =>
          sourceKey(originalName).includes("musterberechnung")
        );
      else if (key.includes("rahmenvereinbarung"))
        productDocument = oracleDocuments.find(
          ({ role }) => role === "SUPPLEMENT"
        );
    }
    if (!productDocument)
      fail(`Claude-Quelle nicht an B-Dokument bindbar: ${referencedName}`);
    return {
      name: referencedName,
      sourceArtifactName: match.name,
      sha256: digest,
      sourceRelation,
      productDocumentUuid: productDocument.uuid,
      productDocumentFingerprint: productDocument.fingerprint,
      productDocumentName: productDocument.originalName,
    };
  });
  if (resolved.length !== 9)
    fail(
      `Erwartet sind neun Claude-Quelldokumente, erhalten: ${resolved.length}`
    );
  const exact = resolved.filter(
    ({ sourceRelation }) => sourceRelation === "EXACT_PRODUCT_DOCUMENT_SHA"
  );
  if (exact.length !== 7)
    fail(`Sieben exakte PDF-Identitäten erwartet, erhalten: ${exact.length}`);
  return resolved;
}

function writePrivateJson(file, value) {
  if (!path.isAbsolute(file)) fail("--output muss absolut sein");
  if (fs.existsSync(file)) fail(`Ausgabe existiert bereits: ${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const files = {
    claudeWorkbook: path.resolve(args.claudeWorkbook),
    systemWorkbook: path.resolve(args.systemWorkbook),
    oracle: path.resolve(args.oracle),
  };
  for (const [label, file] of Object.entries(files)) regularFile(file, label);
  const sourceDirectory = path.resolve(args.claudeSourceDir);
  regularDirectory(sourceDirectory, "claudeSourceDir");
  const oracle = readJson(files.oracle, "Oracle");
  const claudeRows = await readClaudeRows(files.claudeWorkbook);
  const systemRows = await readSystemRows(files.systemWorkbook);
  const sourceDocuments = resolveSourceDocuments({
    claudeRows,
    sourceDirectory,
    oracle,
  });
  const candidate = buildLfKnownFixtureGoldCandidate({
    claudeRows,
    systemRows,
    oracle,
    bindings: {
      claudeWorkbookName: path.basename(files.claudeWorkbook),
      claudeWorkbookSha256: fileSha256(files.claudeWorkbook),
      systemWorkbookName: path.basename(files.systemWorkbook),
      systemWorkbookSha256: fileSha256(files.systemWorkbook),
      oracleName: path.basename(files.oracle),
      oracleSha256: fileSha256(files.oracle),
      oracleId: oracle.oracleId,
      systemRunReleaseCommitSha: oracle.bindings?.runReleaseCommitSha || null,
      systemRunSessionUuid: oracle.bindings?.sessionUuid || null,
      systemRunSignature: oracle.bindings?.runSignature || null,
    },
    sourceDocuments,
  });
  writePrivateJson(path.resolve(args.output), candidate);
  console.log(
    `[lf-known-gold-candidate] SOURCE_REVIEW_REQUIRED: ${candidate.summary.rowCount} Zeilen, ${candidate.summary.componentCount} Komponenten, ${candidate.summary.representativeReviewRowCount} Erstprüfungen`
  );
  console.log(JSON.stringify(candidate.summary));
}

run().catch((error) => fail(error.stack || error.message));
