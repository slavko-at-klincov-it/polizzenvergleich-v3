#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const PDFLoader = require("../../../collector/processSingleFile/convert/asPDF/PDFLoader");
const {
  extractCategoryDefinitions,
  extractRequiredNotice,
  splitMarkdownRow,
  validateCategoryOutput,
} = require("./categoryOutputContract.cjs");
const {
  buildCategoryTableRows,
  renderCategoryTableMarkdown,
} = require("../../utils/policyAnalysis/categoryTableRenderer");
const {
  materializeRequestedFieldEvidence,
} = require("../../utils/policyAnalysis/requestedFieldEvidenceContract");
const {
  evaluateVsPilotOracle,
} = require("../../utils/policyAnalysis/vsPilotOracleContract");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const CATEGORY_PROMPT = path.join(
  REPOSITORY_ROOT,
  "server/resources/workspaceTemplates/VS_versicherungssumme_und_versicherte_sachen.md"
);
const PILOT_ORACLE = path.join(
  REPOSITORY_ROOT,
  "server/resources/policyAnalysis/vs-pilot-oracle.v0.1.json"
);
const FULL_CATALOG = path.join(
  REPOSITORY_ROOT,
  "server/resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json"
);
const PILOT_IDS = Object.freeze(["VS-16", "VS-17", "VS-21", "VS-28"]);
const V321_VS_PROMPT_SHA256 =
  "0ff41d99eaa30eb516af5c60f536a39f381ce7184a46bbed4ce69525e47f466a";
const V321_VS_USER_PROMPT_SHA256 =
  "36c32370835bbaf9b8ae25b61f661b54bbe178f16f6a9f8bc4c1dadab9713979";

function fail(message) {
  console.error(`[vs-full-materialize] ${message}`);
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

function sourceDocumentsFromPages(pages) {
  return pages.map((page, index) => ({
    pageNumber: index + 1,
    text: String(page.pageContent || ""),
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

function parseLegacyRows(answer, definitions) {
  const rows = new Map();
  const expectedIds = new Set(definitions.map(({ id }) => id));
  for (const line of String(answer || "").split(/\r?\n/u)) {
    const parsedCells = splitMarkdownRow(line);
    if (!parsedCells) continue;
    const cells = [...parsedCells];
    const categoryId = String(cells[0] || "").replace(/^`|`$/gu, "");
    if (!expectedIds.has(categoryId)) continue;
    // v3.2.1 occasionally omitted the Deckungssumme cell entirely. Preserve
    // the row for comparison and make the structural defect explicit.
    if (cells.length === 7) {
      const finalCell = normalized(cells[6]);
      if (
        ["BELEGT", "TEILBELEGT", "WIDERSPRÜCHLICH", "UNGEKLÄRT"].includes(
          finalCell
        )
      )
        cells.splice(5, 0, "FEHLT");
      else cells.push("FEHLT");
    }
    if (cells.length !== 8) continue;
    if (rows.has(categoryId))
      throw new Error(`LEGACY_ROW_DUPLICATE:${categoryId}`);
    rows.set(categoryId, {
      categoryId,
      stage: cells[1],
      categoryName: cells[2],
      documentedContent: cells[3],
      coverage: cells[4],
      coverageAmount: cells[5],
      source: cells[6],
      reviewStatus: cells[7],
    });
  }
  return definitions.map(
    ({ id }) =>
      rows.get(id) || {
        categoryId: id,
        missing: true,
        coverage: "FEHLT",
        coverageAmount: "—",
        reviewStatus: "FEHLT",
        documentedContent: "Zeile fehlt im v3.2.1-Ergebnis",
        source: "—",
      }
  );
}

function normalized(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
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
    if (
      observed?.id !== expected.id ||
      !Array.isArray(observed?.components) ||
      !Array.isArray(expected?.components) ||
      observed.components.length !== expected.components.length
    )
      return false;
    return expected.components.every(
      (component, componentIndex) =>
        observed.components[componentIndex]?.id === component.id
    );
  });
}

function compareRows({
  legacyRows,
  adaptedRows,
  selectedSources,
  pilotOracle,
}) {
  const legacyById = new Map(legacyRows.map((row) => [row.categoryId, row]));
  const pagesById = new Map();
  for (const source of selectedSources) {
    if (!pagesById.has(source.requirementId))
      pagesById.set(source.requirementId, new Set());
    pagesById.get(source.requirementId).add(source.physicalPageNumber);
  }
  return adaptedRows.map((adapted) => {
    const legacy = legacyById.get(adapted.categoryId);
    const changes = [
      ["coverage", legacy.coverage, adapted.coverage],
      ["reviewStatus", legacy.reviewStatus, adapted.reviewStatus],
      ["coverageAmount", legacy.coverageAmount, adapted.coverageAmount],
      [
        "documentedContent",
        legacy.documentedContent,
        adapted.documentedContent,
      ],
      ["source", legacy.source, adapted.source],
    ]
      .filter(([, before, after]) => normalized(before) !== normalized(after))
      .map(([field, before, after]) => ({ field, before, after }));
    return {
      categoryId: adapted.categoryId,
      legacy,
      adapted,
      adaptedPhysicalPages: [...(pagesById.get(adapted.categoryId) || [])].sort(
        (left, right) => left - right
      ),
      changes,
      changed: changes.length > 0,
      qualityAssessment: PILOT_IDS.includes(adapted.categoryId)
        ? pilotOracle?.results.find(
            ({ categoryId }) => categoryId === adapted.categoryId
          )?.pass
          ? "PILOT_ORACLE_PASS"
          : "PILOT_ORACLE_REVISE"
        : "REVIEW_REQUIRED_NO_DOCUMENT_ORACLE",
    };
  });
}

function comparisonMarkdown(documentKey, comparisons) {
  const escape = (value) =>
    normalized(value).replace(/\|/gu, "\\|").replace(/\r?\n/gu, " ");
  const lines = [
    `# VS-01–36 Qualitätsvergleich – ${documentKey}`,
    "",
    "A ist ein v3.2.1-kompatibles Legacy-Verhaltensreplay im aktuellen gehärteten QA-Harness: identischer VS-Prompt, Retrievalvertrag und Provider-Default ohne max_tokens. Es ist keine Ausführung des alten Git-Tags. B ist der vollständige servergebundene v3.3-Discovery-Pfad.",
    "`REVIEW_REQUIRED_NO_DOCUMENT_ORACLE` bedeutet: Unterschied sichtbar, aber noch nicht automatisch als besser oder schlechter bewiesen.",
    "",
    "| ID | A Deckung / Status / Wert | B Deckung / Status / Wert | B-Seiten | Geänderte Felder | Bewertung |",
    "|---|---|---|---:|---|---|",
  ];
  for (const result of comparisons) {
    lines.push(
      `| ${result.categoryId} | ${escape(`${result.legacy.coverage} / ${result.legacy.reviewStatus} / ${result.legacy.coverageAmount}`)} | ${escape(`${result.adapted.coverage} / ${result.adapted.reviewStatus} / ${result.adapted.coverageAmount}`)} | ${result.adaptedPhysicalPages.join(", ") || "—"} | ${result.changes.map(({ field }) => field).join(", ") || "keine"} | ${result.qualityAssessment} |`
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const allowedArguments = new Set([
    "documentKey",
    "pdf",
    "worksheet",
    "triage",
    "triageReport",
    "effects",
    "effectsReport",
    "sources",
    "legacyAnswer",
    "legacyReport",
    "documentStatus",
    "model",
    "embeddingModel",
    "output",
  ]);
  const unknownArguments = Object.keys(args).filter(
    (argument) => !allowedArguments.has(argument)
  );
  if (unknownArguments.length)
    fail(`Unbekannte Argumente: ${unknownArguments.join(",")}`);
  const files = {
    pdf: path.resolve(args.pdf || ""),
    worksheet: path.resolve(args.worksheet || ""),
    triage: path.resolve(args.triage || ""),
    triageReport: path.resolve(args.triageReport || ""),
    effects: path.resolve(args.effects || ""),
    effectsReport: path.resolve(args.effectsReport || ""),
    sources: path.resolve(args.sources || ""),
    legacyAnswer: path.resolve(args.legacyAnswer || ""),
    legacyReport: path.resolve(args.legacyReport || ""),
  };
  const output = path.resolve(args.output || "");
  for (const [label, file] of Object.entries(files))
    if (!file || !fs.existsSync(file)) fail(`${label} fehlt: ${file}`);
  if (!args.output) fail("--output ist erforderlich");
  if (!args.documentStatus) fail("--documentStatus ist erforderlich");
  if (!args.model) fail("--model ist erforderlich");
  if (!args.embeddingModel) fail("--embeddingModel ist erforderlich");

  const categoryPrompt = fs.readFileSync(CATEGORY_PROMPT, "utf8");
  const fullCatalog = readJson(FULL_CATALOG);
  const definitions = extractCategoryDefinitions(categoryPrompt);
  const requiredNotice = extractRequiredNotice(categoryPrompt);
  if (definitions.length !== 36)
    fail(`36 VS-Definitionen erwartet, erhalten: ${definitions.length}`);

  const worksheet = readJson(files.worksheet);
  if (worksheet?.targetRequirementSelection)
    fail("TARGET_REQUIREMENT_WORKSHEET_FORBIDDEN_IN_FULL_MATERIALIZER");
  const materializedTriage = readJson(files.triage);
  const materializedEvidence = readJson(files.effects);
  const selectedSources = readJson(files.sources);
  const triageReport = readJson(files.triageReport);
  const effectsReport = readJson(files.effectsReport);
  const legacyReport = readJson(files.legacyReport);
  const requestedFields = materializeRequestedFieldEvidence({
    worksheet,
    materializedCandidates: selectedEffectTriage({
      materializedTriage,
      materializedEvidence,
    }),
  });
  const adaptedRows = buildCategoryTableRows({
    definitions,
    worksheet,
    materializedEvidence,
    requestedFieldMaterialization: requestedFields,
    documentStatus: args.documentStatus,
  });
  const adaptedAnswer = `${renderCategoryTableMarkdown({
    definitions,
    worksheet,
    materializedEvidence,
    requestedFieldMaterialization: requestedFields,
    documentStatus: args.documentStatus,
  })}\n\n${requiredNotice}`;
  const pages = await new PDFLoader(files.pdf, { splitPages: true }).load();
  const tableContract = validateCategoryOutput({
    answer: adaptedAnswer,
    categoryDefinitions: definitions,
    requiredNotice,
    sourceDocuments: sourceDocumentsFromPages(pages),
  });
  const legacyAnswer = fs.readFileSync(files.legacyAnswer, "utf8");
  const legacyRows = parseLegacyRows(legacyAnswer, definitions);
  const pdfSha256 = sha256File(files.pdf);
  const oracleSet = readJson(PILOT_ORACLE);
  const oracleDocument = oracleSet.documents.find(
    (document) => document.pdfSha256 === pdfSha256
  );
  if (!oracleDocument) fail(`Kein Pilot-Oracle für PDF: ${pdfSha256}`);
  const pilotOracle = evaluateVsPilotOracle({
    oracleDocument,
    pdfSha256,
    physicalPages: worksheet.document.physicalPages,
    documentStatus: args.documentStatus,
    rows: adaptedRows.filter(({ categoryId }) =>
      PILOT_IDS.includes(categoryId)
    ),
    requestedFieldEvidence: requestedFields,
    selectedSources,
    // The full catalog intentionally adds overlapping aliases and therefore
    // may assign different opaque candidate IDs to the same bound clause.
    // Full validation remains strict for PDF identity, row semantics, typed
    // values and physical source pages; the dedicated pilot runner keeps the
    // default STRICT candidate-ID contract.
    candidateIdentityMode: "ALLOW_ALIAS_DRIFT",
  });
  const comparisons = compareRows({
    legacyRows,
    adaptedRows,
    selectedSources,
    pilotOracle,
  });
  const requestedFieldSummary = requestedFields.requirements.reduce(
    (summary, requirement) => {
      summary[requirement.requestedFieldStatus] =
        (summary[requirement.requestedFieldStatus] || 0) + 1;
      return summary;
    },
    {}
  );
  const baselineUsesProviderDefault =
    legacyReport.configuration?.completionTokenMode ===
      "PROVIDER_DEFAULT_V321" ||
    !Object.prototype.hasOwnProperty.call(
      legacyReport.configuration || {},
      "maxCompletionTokens"
    );
  const worksheetSha256 = sha256File(files.worksheet);
  const triageSha256 = sha256File(files.triage);
  const effectsSha256 = sha256File(files.effects);
  const sourcesSha256 = sha256File(files.sources);
  const expectedIds = definitions.map(({ id }) => id);
  const observedIds = worksheet.requirements.map(({ id }) => id);
  const fullCatalogPass = Boolean(
    worksheetMatchesCatalogShape(worksheet, fullCatalog) &&
      worksheet.document?.fingerprint === pdfSha256 &&
      worksheet.requirements.length === 36 &&
      expectedIds.every((id, index) => observedIds[index] === id)
  );
  const artifactIdentityPass = Boolean(
    triageReport.contracts?.worksheetSha256 === worksheetSha256 &&
      effectsReport.contracts?.worksheetSha256 === worksheetSha256 &&
      effectsReport.contracts?.triageSha256 === triageSha256 &&
      triageReport.contracts?.materializedTriageSha256 === triageSha256 &&
      effectsReport.contracts?.materializedEvidenceSha256 === effectsSha256 &&
      effectsReport.contracts?.selectedSourcesSha256 === sourcesSha256 &&
      effectsReport.contracts?.documentStatus === args.documentStatus &&
      legacyReport.pdf?.sha256 === pdfSha256 &&
      legacyReport.configuration?.chunkSize === 3000 &&
      legacyReport.configuration?.chunkOverlap === 250 &&
      legacyReport.configuration?.topN === 55 &&
      legacyReport.models?.llm === args.model &&
      legacyReport.completion?.responseModel === args.model &&
      legacyReport.models?.embedding === args.embeddingModel &&
      triageReport.model?.id === args.model &&
      effectsReport.model?.id === args.model
  );
  const upstreamGates = {
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
    pilotOracle: pilotOracle.pass,
    tableContract: tableContract.pass,
    baselineContract: Boolean(
      legacyReport.promptContract?.systemPromptSha256 ===
        V321_VS_PROMPT_SHA256 &&
        legacyReport.promptContract?.userPromptSha256 ===
          V321_VS_USER_PROMPT_SHA256 &&
        legacyReport.promptContract?.retrievalQuerySha256 ===
          V321_VS_USER_PROMPT_SHA256 &&
        baselineUsesProviderDefault
    ),
    artifactIdentity: artifactIdentityPass,
    fullCatalog: fullCatalogPass,
  };
  const technicalPass = Object.values(upstreamGates).every(Boolean);
  const report = {
    status: technicalPass ? "TECHNICAL_PASS_REVIEW_REQUIRED" : "REVISE",
    documentKey: args.documentKey || path.basename(files.pdf),
    pdfSha256,
    rowCount: adaptedRows.length,
    changedRows: comparisons.filter(({ changed }) => changed).length,
    unchangedRows: comparisons.filter(({ changed }) => !changed).length,
    requestedFieldSummary,
    upstreamGates,
    baseline: {
      executionClassification:
        legacyReport.configuration?.completionTokenMode ===
        "PROVIDER_DEFAULT_V321"
          ? "V3_2_1_COMPATIBLE_BEHAVIOR_REPLAY_NOT_OLD_TAG_EXECUTION"
          : "HISTORICAL_PROVIDER_DEFAULT_REPORT_WITHOUT_TAG_IN_MANIFEST",
      status: legacyReport.status,
      promptSha256: legacyReport.promptContract?.systemPromptSha256 || null,
      completionTokenMode:
        legacyReport.configuration?.completionTokenMode || null,
      responseModel: legacyReport.completion?.responseModel || null,
    },
    artifactIdentity: {
      worksheetSha256,
      triageSha256,
      effectsSha256,
      sourcesSha256,
      baselinePdfSha256: legacyReport.pdf?.sha256 || null,
      baselineModel: legacyReport.models?.llm || null,
      triageModel: triageReport.model?.id || null,
      effectsModel: effectsReport.model?.id || null,
      requestedModel: args.model,
      baselineEmbeddingModel: legacyReport.models?.embedding || null,
      requestedEmbeddingModel: args.embeddingModel,
    },
    tableContract,
    pilotOracle,
    qualityGate: {
      pass: false,
      status: "REVIEW_REQUIRED",
      reason: "NO_FULL_DOCUMENT_ORACLE",
      oracleBackedCategoryIds: ["VS-16", "VS-17", "VS-21", "VS-28"],
    },
  };
  writePrivate(path.join(output, "answer.md"), adaptedAnswer);
  writePrivate(path.join(output, "rows.private.json"), adaptedRows);
  writePrivate(
    path.join(output, "requested-fields.private.json"),
    requestedFields
  );
  writePrivate(path.join(output, "comparison.private.json"), comparisons);
  writePrivate(
    path.join(output, "comparison.md"),
    comparisonMarkdown(report.documentKey, comparisons)
  );
  writePrivate(path.join(output, "report.json"), report);
  console.log(
    `[vs-full-materialize] ${report.status}: ${report.rowCount}/36 Zeilen, ${report.changedRows} Deltas, Volloracle ${report.qualityGate.status}`
  );
  if (!technicalPass) process.exitCode = 2;
}

main().catch((error) => fail(error.stack || error.message));
