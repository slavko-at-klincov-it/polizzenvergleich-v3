#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  evaluateCategoryDocumentOracle,
} = require("../../utils/policyAnalysis/categoryDocumentOracleContract");

function fail(message) {
  console.error(`[category-document-oracle] ${message}`);
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
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${label} ist ungültig: ${file}: ${error.message}`);
  }
}

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function writePrivateJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function unique(values) {
  return [...new Set(values)];
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set(["root", "oracle", "output"]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  if (!args.root) fail("--root ist erforderlich");
  if (!args.oracle) fail("--oracle ist erforderlich");

  const root = path.resolve(args.root);
  const oracleFile = path.resolve(args.oracle);
  const output = path.resolve(
    args.output || path.join(root, "quality-oracle-report.json")
  );
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory())
    fail(`QA-Run-Verzeichnis fehlt: ${root}`);

  const manifestFile = path.join(root, "manifest.private.json");
  const documentFile = path.join(root, "document.private.json");
  const manifest = readJson(manifestFile, "Run-Manifest");
  const documentArtifact = readJson(documentFile, "Dokumentartefakt");
  const oracleSet = readJson(oracleFile, "Oracle");
  const allowedOracleKeys = new Set([
    "schemaVersion",
    "oracleId",
    "approvalStatus",
    "documents",
  ]);
  const unknownOracleKeys = Object.keys(oracleSet || {}).filter(
    (key) => !allowedOracleKeys.has(key)
  );
  if (
    oracleSet?.schemaVersion !== 1 ||
    !oracleSet.oracleId ||
    !Array.isArray(oracleSet.documents) ||
    unknownOracleKeys.length > 0
  )
    fail(`Oracle-Vertrag ungültig: ${oracleFile}`);

  const pdfSha256 = manifest.document?.sha256;
  const matchingOracleDocuments = oracleSet.documents.filter(
    (document) => document.pdfSha256 === pdfSha256
  );
  if (matchingOracleDocuments.length > 1)
    fail(`Oracle enthält die Dokument-SHA mehrfach: ${pdfSha256}`);
  const [oracleDocument] = matchingOracleDocuments;
  if (!oracleDocument) {
    const report = {
      schemaVersion: 1,
      oracleId: oracleSet.oracleId,
      status: "NO_MATCHING_ORACLE_DOCUMENT",
      pass: false,
      run: {
        root,
        releaseId: manifest.releaseId || null,
        pdfSha256: pdfSha256 || null,
        documentStatus: manifest.configuration?.documentStatus || null,
      },
      oracleSha256: sha256File(oracleFile),
    };
    writePrivateJson(output, report);
    console.error(`[category-document-oracle] ${report.status}: ${output}`);
    process.exitCode = 2;
    return;
  }

  const categoryViews = unique(
    oracleDocument.rows.map(
      ({ categoryId }) => String(categoryId || "").split("-")[0]
    )
  );
  const combined = {
    rows: [],
    materializedEvidence: { judgements: [] },
    requestedFieldEvidence: { requirements: [] },
    selectedSources: [],
    worksheet: { requirements: [] },
  };
  for (const categoryView of categoryViews) {
    const categoryRoot = path.join(root, categoryView);
    combined.rows.push(
      ...readJson(
        path.join(categoryRoot, "result", "rows.private.json"),
        `${categoryView}-Zeilen`
      )
    );
    combined.requestedFieldEvidence.requirements.push(
      ...readJson(
        path.join(categoryRoot, "result", "requested-fields.private.json"),
        `${categoryView}-Werte`
      ).requirements
    );
    combined.materializedEvidence.judgements.push(
      ...readJson(
        path.join(categoryRoot, "effects", "materialized.private.json"),
        `${categoryView}-Wirkungen`
      ).judgements
    );
    combined.selectedSources.push(
      ...readJson(
        path.join(categoryRoot, "effects", "selected-sources.private.json"),
        `${categoryView}-Quellen`
      )
    );
    combined.worksheet.requirements.push(
      ...readJson(
        path.join(categoryRoot, "worksheet.private.json"),
        `${categoryView}-Worksheet`
      ).requirements
    );
  }

  const physicalPages =
    documentArtifact.document?.pdfExtraction?.totalPages ??
    documentArtifact.document?.pageMap?.length ??
    null;
  const evaluation = evaluateCategoryDocumentOracle({
    oracleDocument,
    oracleApprovalStatus: oracleSet.approvalStatus,
    pdfSha256,
    physicalPages,
    documentStatus: manifest.configuration?.documentStatus,
    ...combined,
  });
  const report = {
    schemaVersion: 1,
    oracleId: oracleSet.oracleId,
    oracleSha256: sha256File(oracleFile),
    run: {
      root,
      releaseId: manifest.releaseId || null,
      model: manifest.configuration?.model || null,
      pdfSha256,
      documentStatus: manifest.configuration?.documentStatus || null,
      physicalPages,
    },
    ...evaluation,
  };
  writePrivateJson(output, report);
  console.log(
    `[category-document-oracle] ${report.status}: APPROVED ${report.approved.passedAssertions}/${report.approved.assertionCount}, DRAFT ${report.draft.passedAssertions}/${report.draft.assertionCount}: ${output}`
  );
  if (report.status === "REVISE") process.exitCode = 2;
}

main();
