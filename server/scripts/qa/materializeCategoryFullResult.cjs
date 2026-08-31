#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  extractCategoryDefinitions,
  extractRequiredNotice,
  validateCategoryOutput,
} = require("./categoryOutputContract.cjs");
const {
  buildCategoryTableRows,
  renderCategoryTableMarkdown,
} = require("../../utils/policyAnalysis/categoryTableRenderer");
const {
  materializeRequestedFieldEvidence,
} = require("../../utils/policyAnalysis/requestedFieldEvidenceContract");

function fail(message) {
  console.error(`[category-full-materialize] ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined)
      fail(`Ungültiges Argument: ${key}`);
    values[key.slice(2)] = value;
  }
  return values;
}

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writePrivate(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    file,
    typeof value === "string" ? value : JSON.stringify(value, null, 2),
    { encoding: "utf8", mode: 0o600 }
  );
  fs.chmodSync(file, 0o600);
}

function sourceDocumentsFromArtifact(artifact) {
  const content = String(artifact?.document?.pageContent || "");
  return (artifact?.document?.pageMap || []).map((page) => ({
    pageNumber: page.pageNumber,
    text: content.slice(page.start, page.end),
  }));
}

function selectedEffectTriage({ materializedTriage, materializedEvidence }) {
  const selectedIds = new Set(
    materializedEvidence.judgements.flatMap(
      ({ selectedCandidateIds }) => selectedCandidateIds || []
    )
  );
  return materializedTriage.filter(({ candidateId }) =>
    selectedIds.has(candidateId)
  );
}

function worksheetMatchesCatalogShape(worksheet, catalog) {
  if (
    worksheet?.catalog?.id !== catalog?.catalogId ||
    worksheet?.catalog?.categoryView !== catalog?.categoryView ||
    !Array.isArray(worksheet?.requirements) ||
    !Array.isArray(catalog?.requirements) ||
    worksheet.requirements.length !== catalog.requirements.length
  )
    return false;
  return catalog.requirements.every((expected, requirementIndex) => {
    const observed = worksheet.requirements[requirementIndex];
    return (
      observed?.id === expected.id &&
      Array.isArray(observed?.components) &&
      Array.isArray(expected?.components) &&
      observed.components.length === expected.components.length &&
      expected.components.every(
        (component, componentIndex) =>
          observed.components[componentIndex]?.id === component.id
      )
    );
  });
}

/**
 * Materializes one complete category view from server-owned worksheet,
 * triage, effect and value artifacts. Inputs are read-only private artifacts;
 * outputs are private rows, Markdown and a gate report. Role: render/boundary.
 */
async function main() {
  const args = parseArguments(process.argv.slice(2));
  const allowedArguments = new Set([
    "categoryView",
    "documentKey",
    "pdf",
    "promptFile",
    "catalogFile",
    "documentArtifact",
    "worksheet",
    "triage",
    "triageReport",
    "effects",
    "effectsReport",
    "sources",
    "documentStatus",
    "model",
    "output",
  ]);
  const unknown = Object.keys(args).filter(
    (argument) => !allowedArguments.has(argument)
  );
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  const requiredFiles = [
    "pdf",
    "promptFile",
    "catalogFile",
    "documentArtifact",
    "worksheet",
    "triage",
    "triageReport",
    "effects",
    "effectsReport",
    "sources",
  ];
  const files = Object.fromEntries(
    requiredFiles.map((key) => [key, path.resolve(args[key] || "")])
  );
  for (const [label, file] of Object.entries(files))
    if (!file || !fs.existsSync(file)) fail(`${label} fehlt: ${file}`);
  if (!args.output) fail("--output ist erforderlich");
  if (!args.documentStatus) fail("--documentStatus ist erforderlich");
  if (!args.model) fail("--model ist erforderlich");

  const output = path.resolve(args.output);
  const prompt = fs.readFileSync(files.promptFile, "utf8");
  const definitions = extractCategoryDefinitions(prompt);
  const requiredNotice = extractRequiredNotice(prompt);
  const catalog = readJson(files.catalogFile);
  const categoryView = String(args.categoryView || catalog.categoryView || "");
  if (!categoryView || catalog.categoryView !== categoryView)
    fail(
      `Kategorie stimmt nicht überein: ${categoryView}/${catalog.categoryView}`
    );
  if (
    definitions.length === 0 ||
    definitions.some(({ id }) => !id.startsWith(`${categoryView}-`))
  )
    fail(`Keine gültigen ${categoryView}-Definitionen im Systemprompt`);

  const worksheet = readJson(files.worksheet);
  if (
    worksheet?.shadowSearch?.shadowOnly === true ||
    worksheet?.catalog?.id?.includes(":hybrid-shadow:")
  )
    fail("HYBRID_SHADOW_WORKSHEET_FORBIDDEN_IN_CUSTOMER_MATERIALIZER");
  const documentArtifact = readJson(files.documentArtifact);
  const materializedTriage = readJson(files.triage);
  const materializedEvidence = readJson(files.effects);
  const triageReport = readJson(files.triageReport);
  const effectsReport = readJson(files.effectsReport);
  const selectedSources = readJson(files.sources);
  const requestedFields = materializeRequestedFieldEvidence({
    worksheet,
    materializedCandidates: selectedEffectTriage({
      materializedTriage,
      materializedEvidence,
    }),
  });
  const rows = buildCategoryTableRows({
    definitions,
    worksheet,
    materializedEvidence,
    requestedFieldMaterialization: requestedFields,
    documentStatus: args.documentStatus,
  });
  const answer = `${renderCategoryTableMarkdown({
    definitions,
    worksheet,
    materializedEvidence,
    requestedFieldMaterialization: requestedFields,
    documentStatus: args.documentStatus,
  })}\n\n${requiredNotice}`;
  const tableContract = validateCategoryOutput({
    answer,
    categoryDefinitions: definitions,
    requiredNotice,
    sourceDocuments: sourceDocumentsFromArtifact(documentArtifact),
  });

  const pdfSha256 = sha256File(files.pdf);
  const worksheetSha256 = sha256File(files.worksheet);
  const triageSha256 = sha256File(files.triage);
  const effectsSha256 = sha256File(files.effects);
  const sourcesSha256 = sha256File(files.sources);
  const requestedFieldSummary = requestedFields.requirements.reduce(
    (summary, requirement) => {
      summary[requirement.requestedFieldStatus] =
        (summary[requirement.requestedFieldStatus] || 0) + 1;
      return summary;
    },
    {}
  );
  const gates = {
    documentArtifact: Boolean(
      documentArtifact?.schemaVersion === 1 &&
        documentArtifact.fingerprint === pdfSha256 &&
        documentArtifact.document?.sourceDocumentId === pdfSha256 &&
        documentArtifact.document?.pdfExtraction?.complete === true
    ),
    worksheetCatalog: Boolean(
      worksheetMatchesCatalogShape(worksheet, catalog) &&
        worksheet.document?.fingerprint === pdfSha256 &&
        definitions.every(
          ({ id }, index) => worksheet.requirements[index]?.id === id
        )
    ),
    triage: Boolean(
      ["PASS", "TECHNICAL_PASS_REVIEW_REQUIRED"].includes(
        triageReport.status
      ) &&
        triageReport.validation?.formalPass === true &&
        triageReport.controls?.pass === true &&
        triageReport.completion?.responseModelComplete === true
    ),
    effects: Boolean(
      ["PASS", "TECHNICAL_PASS_REVIEW_REQUIRED"].includes(
        effectsReport.status
      ) &&
        effectsReport.validation?.pass === true &&
        effectsReport.controls?.pass === true &&
        effectsReport.completion?.responseModelComplete === true
    ),
    artifactIdentity: Boolean(
      triageReport.contracts?.worksheetSha256 === worksheetSha256 &&
        effectsReport.contracts?.worksheetSha256 === worksheetSha256 &&
        effectsReport.contracts?.triageSha256 === triageSha256 &&
        triageReport.contracts?.materializedTriageSha256 === triageSha256 &&
        effectsReport.contracts?.materializedEvidenceSha256 === effectsSha256 &&
        effectsReport.contracts?.selectedSourcesSha256 === sourcesSha256 &&
        effectsReport.contracts?.documentStatus === args.documentStatus &&
        triageReport.model?.id === args.model &&
        effectsReport.model?.id === args.model
    ),
    tableContract: tableContract.pass,
  };
  const technicalPass = Object.values(gates).every(Boolean);
  const report = {
    status: technicalPass ? "TECHNICAL_PASS_REVIEW_REQUIRED" : "REVISE",
    categoryView,
    documentKey: args.documentKey || path.basename(files.pdf),
    pdfSha256,
    rowCount: rows.length,
    expectedRowCount: definitions.length,
    requestedFieldSummary,
    gates,
    tableContract,
    evidence: {
      candidateCount: worksheet.summary?.occurrenceCount || 0,
      componentsWithCandidates:
        worksheet.summary?.componentsWithCandidates || 0,
      componentCount: worksheet.summary?.componentCount || 0,
      selectedSourceCount: selectedSources.length,
    },
    qualityGate: {
      pass: false,
      status: "REVIEW_REQUIRED",
      reason: "NO_COMPLETE_CATEGORY_DOCUMENT_ORACLE",
    },
  };
  writePrivate(path.join(output, "answer.md"), answer);
  writePrivate(path.join(output, "rows.private.json"), rows);
  writePrivate(
    path.join(output, "requested-fields.private.json"),
    requestedFields
  );
  writePrivate(path.join(output, "report.json"), report);
  console.log(
    `[category-full-materialize] ${categoryView} ${report.status}: ${rows.length}/${definitions.length} Zeilen, ${report.evidence.selectedSourceCount} Quellen`
  );
  if (!technicalPass) process.exitCode = 2;
}

main().catch((error) => fail(error.stack || error.message));
