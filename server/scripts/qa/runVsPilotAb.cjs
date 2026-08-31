#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync, execFileSync } = require("child_process");
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
const {
  LEGACY_VS_USER_PROMPT,
  evaluateLegacyRows,
  evaluatePilotComparison,
} = require("../../utils/policyAnalysis/vsPilotComparisonContract");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const PILOT_IDS = Object.freeze(["VS-16", "VS-17", "VS-21", "VS-28"]);
const PATHS = Object.freeze({
  catalog: path.join(
    REPOSITORY_ROOT,
    "server/resources/policyAnalysis/vs-occurrence-pilot.v0.1.json"
  ),
  triagePrompt: path.join(
    REPOSITORY_ROOT,
    "server/resources/policyAnalysis/vs-candidate-triage-system.v0.1.md"
  ),
  effectPrompt: path.join(
    REPOSITORY_ROOT,
    "server/resources/policyAnalysis/vs-prepared-evidence-system.v0.1.md"
  ),
  categoryPrompt: path.join(
    REPOSITORY_ROOT,
    "server/resources/workspaceTemplates/VS_versicherungssumme_und_versicherte_sachen.md"
  ),
  oracle: path.join(
    REPOSITORY_ROOT,
    "server/resources/policyAnalysis/vs-pilot-oracle.v0.1.json"
  ),
  worksheetRunner: path.join(
    REPOSITORY_ROOT,
    "server/scripts/qa/buildVsOccurrenceWorksheet.cjs"
  ),
  triageRunner: path.join(
    REPOSITORY_ROOT,
    "server/scripts/qa/runVsCandidateTriage.cjs"
  ),
  effectRunner: path.join(
    REPOSITORY_ROOT,
    "server/scripts/qa/runPreparedEvidenceEvaluation.cjs"
  ),
  legacyRunner: path.join(
    REPOSITORY_ROOT,
    "server/scripts/qa/pdfProvenanceLiveRun.cjs"
  ),
});

function fail(message) {
  console.error(`[vs-pilot-ab] ${message}`);
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

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function ensurePrivateDirectory(directory, mustBeEmpty = false) {
  if (
    mustBeEmpty &&
    fs.existsSync(directory) &&
    fs.readdirSync(directory).length
  )
    fail(`Ausgabeordner ist nicht leer: ${directory}`);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function writePrivate(file, value) {
  ensurePrivateDirectory(path.dirname(file));
  fs.writeFileSync(
    file,
    typeof value === "string" ? value : JSON.stringify(value, null, 2),
    { encoding: "utf8", mode: 0o600 }
  );
  fs.chmodSync(file, 0o600);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function git(args) {
  try {
    return execFileSync("git", ["-C", REPOSITORY_ROOT, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function runNode(script, args, environment) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: REPOSITORY_ROOT,
    env: environment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 20 * 60 * 1000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0)
    throw new Error(
      `CHILD_RUN_FAILED:${path.basename(script)}:${
        result.error?.message || result.status
      }`
    );
}

function selectedLegacyRows(answer) {
  const rows = new Map();
  for (const line of String(answer || "").split(/\r?\n/u)) {
    const cells = splitMarkdownRow(line);
    if (!cells || cells.length !== 8 || !PILOT_IDS.includes(cells[0])) continue;
    if (rows.has(cells[0])) throw new Error(`LEGACY_ROW_DUPLICATE:${cells[0]}`);
    rows.set(cells[0], {
      categoryId: cells[0],
      stage: cells[1],
      categoryName: cells[2],
      documentedContent: cells[3],
      coverage: cells[4],
      coverageAmount: cells[5],
      source: cells[6],
      reviewStatus: cells[7],
    });
  }
  return PILOT_IDS.map(
    (id) =>
      rows.get(id) || {
        categoryId: id,
        missing: true,
        coverage: "FEHLT",
        reviewStatus: "FEHLT",
        documentedContent: "Zeile fehlt im Legacy-Ergebnis",
      }
  );
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

function sourceDocumentsFromPages(pages) {
  return pages.map((page, index) => ({
    pageNumber: index + 1,
    text: String(page.pageContent || ""),
  }));
}

function semanticSnapshot(result) {
  return JSON.stringify({
    rows: result.adaptedRows.map(
      ({ categoryId, coverage, coverageAmount, reviewStatus }) => ({
        categoryId,
        coverage,
        coverageAmount,
        reviewStatus,
      })
    ),
    requestedFields: result.requestedFields.requirements.map((requirement) => ({
      requirementId: requirement.requirementId,
      requestedFieldStatus: requirement.requestedFieldStatus,
      values: requirement.fields.flatMap(({ facts }) =>
        facts.map(({ normalizedValue }) => normalizedValue)
      ),
    })),
    selectedSources: result.selectedSources.map(
      ({ requirementId, componentId, candidateId, physicalPageNumber }) => ({
        requirementId,
        componentId,
        candidateId,
        physicalPageNumber,
      })
    ),
  });
}

function legacySemanticSnapshot(result) {
  return JSON.stringify(
    result.legacyRows.map(
      ({
        categoryId,
        coverage,
        coverageAmount,
        documentedContent,
        reviewStatus,
        source,
      }) => ({
        categoryId,
        coverage,
        coverageAmount,
        documentedContent,
        reviewStatus,
        source,
      })
    )
  );
}

function comparisonMarkdown(results) {
  const lines = [
    "# VS-Pilot A/B-Vergleich",
    "",
    "Dieser Bericht vergleicht den bisherigen monolithischen VS-Lauf (A) mit der servergebundenen Pilotpipeline (B).",
    "",
    "| Dokument | Legacy A: semantische Treffer (informativ) | Pilot B: Oracle-Treffer | Einordnung |",
    "|---|---:|---:|---|",
    ...results.map((result) => {
      const comparison = result.comparison;
      const advantage =
        {
          IMPROVED: "Ja",
          EQUIVALENT: "Gleichstand",
          REGRESSED: "Regression",
          PILOT_NOT_READY: "Pilot nicht bereit",
        }[comparison?.outcome] || "Nicht bewertet";
      return `| ${result.documentKey} | ${result.legacyEvaluation.passedRows}/${result.legacyEvaluation.totalRows} | ${result.report.gates.oracle.passedRows}/${result.report.gates.oracle.totalRows} | ${advantage} |`;
    }),
    "",
    "| Dokument | ID | Legacy Deckung / Status | Pilot Deckung / Status | Pilotinhalt |",
    "|---|---|---|---|---|",
  ];
  for (const result of results) {
    const legacyById = new Map(
      result.legacyRows.map((row) => [row.categoryId, row])
    );
    for (const adapted of result.adaptedRows) {
      const legacy = legacyById.get(adapted.categoryId);
      const escape = (value) =>
        String(value || "")
          .replace(/\|/gu, "\\|")
          .replace(/\r?\n/gu, " ");
      lines.push(
        `| ${result.documentKey} | ${adapted.categoryId} | ${escape(
          `${legacy.coverage} / ${legacy.reviewStatus}`
        )} | ${escape(`${adapted.coverage} / ${adapted.reviewStatus}`)} | ${escape(
          adapted.documentedContent
        )} |`
      );
    }
  }
  return lines.join("\n");
}

async function modelSnapshot(
  basePath,
  requestedModel,
  requestedEmbeddingModel
) {
  const apiRoot = basePath.replace(/\/v1\/?$/u, "");
  const endpoints = [`${apiRoot}/api/v0/models`, `${apiRoot}/v1/models`];
  const snapshots = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(5000),
      });
      snapshots.push({
        endpoint,
        status: response.status,
        body: response.ok ? await response.json() : await response.text(),
      });
    } catch (error) {
      snapshots.push({ endpoint, error: error.message });
    }
  }
  const exactRecords = snapshots.flatMap(({ endpoint, body }) => {
    const records = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.models)
        ? body.models
        : [];
    return records
      .filter(({ id }) => id === requestedModel)
      .map((record) => ({ endpoint, ...record }));
  });
  const exactEmbeddingRecords = snapshots.flatMap(({ endpoint, body }) => {
    const records = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.models)
        ? body.models
        : [];
    return records
      .filter(({ id }) => id === requestedEmbeddingModel)
      .map((record) => ({ endpoint, ...record }));
  });
  return {
    requestedModel,
    requestedModelListed: exactRecords.length > 0,
    requestedModelLoaded: exactRecords.some(
      (record) =>
        record.state === "loaded" ||
        record.status === "loaded" ||
        record.loaded === true
    ),
    exactRecords,
    requestedEmbeddingModel,
    requestedEmbeddingModelListed: exactEmbeddingRecords.length > 0,
    exactEmbeddingRecords,
    snapshots,
  };
}

async function runDocument({
  documentOracle,
  pdf,
  runDirectory,
  environment,
  definitions,
  requiredNotice,
  model,
  modelTokenLimit,
  topN,
  skipLegacy,
}) {
  const documentKey = documentOracle.documentKey;
  const documentDirectory = path.join(runDirectory, documentKey);
  const legacyDirectory = path.join(documentDirectory, "legacy");
  const triageDirectory = path.join(documentDirectory, "triage");
  const effectDirectory = path.join(documentDirectory, "effects");
  const adaptedDirectory = path.join(documentDirectory, "adapted");
  const worksheetFile = path.join(documentDirectory, "worksheet.private.json");
  for (const directory of [
    documentDirectory,
    legacyDirectory,
    triageDirectory,
    effectDirectory,
    adaptedDirectory,
  ])
    ensurePrivateDirectory(directory);

  const actualSha256 = sha256File(pdf);
  if (actualSha256 !== documentOracle.pdfSha256)
    throw new Error(`PDF_SHA256_MISMATCH:${documentKey}:${actualSha256}`);

  const userPrompt = LEGACY_VS_USER_PROMPT;
  if (!skipLegacy)
    runNode(
      PATHS.legacyRunner,
      [
        "--pdf",
        pdf,
        "--output",
        legacyDirectory,
        "--systemPromptFile",
        PATHS.categoryPrompt,
        "--userPrompt",
        userPrompt,
        "--retrievalQuery",
        userPrompt,
        "--chunkSize",
        "3000",
        "--chunkOverlap",
        "250",
        "--topN",
        String(topN),
        "--modelTokenLimit",
        String(modelTokenLimit),
        "--maxCompletionTokens",
        "8192",
      ],
      environment
    );

  runNode(
    PATHS.worksheetRunner,
    [
      "--pdfFile",
      pdf,
      "--catalogFile",
      PATHS.catalog,
      "--output",
      worksheetFile,
    ],
    environment
  );
  const triageControl = path.join(
    REPOSITORY_ROOT,
    `server/resources/policyAnalysis/vs-candidate-triage-controls${
      documentKey === "WEVIG" ? "-wevig" : ""
    }.v0.1.json`
  );
  runNode(
    PATHS.triageRunner,
    [
      "--worksheet",
      worksheetFile,
      "--systemPromptFile",
      PATHS.triagePrompt,
      "--controlFile",
      triageControl,
      "--output",
      triageDirectory,
      "--model",
      model,
      "--modelTokenLimit",
      String(modelTokenLimit),
    ],
    environment
  );

  const effectControl = path.join(
    REPOSITORY_ROOT,
    `server/resources/policyAnalysis/vs-prepared-controls-${
      documentKey === "WEVIG" ? "wevig" : "lf"
    }-v0.1.json`
  );
  const triageMaterializedFile = path.join(
    triageDirectory,
    "materialized-triage.private.json"
  );
  runNode(
    PATHS.effectRunner,
    [
      "--worksheet",
      worksheetFile,
      "--triageFile",
      triageMaterializedFile,
      "--systemPromptFile",
      PATHS.effectPrompt,
      "--controlFile",
      effectControl,
      "--documentStatus",
      documentOracle.documentStatus,
      "--output",
      effectDirectory,
      "--model",
      model,
      "--modelTokenLimit",
      String(modelTokenLimit),
    ],
    environment
  );

  const worksheet = readJson(worksheetFile);
  if (worksheet.document?.physicalPages !== documentOracle.physicalPages)
    throw new Error(`PHYSICAL_PAGE_COUNT_MISMATCH:${documentKey}`);
  const materializedTriage = readJson(triageMaterializedFile);
  const materializedEvidence = readJson(
    path.join(effectDirectory, "materialized.private.json")
  );
  const selectedSources = readJson(
    path.join(effectDirectory, "selected-sources.private.json")
  );
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
    documentStatus: documentOracle.documentStatus,
  });
  const adaptedAnswer = `${renderCategoryTableMarkdown({
    definitions,
    worksheet,
    materializedEvidence,
    requestedFieldMaterialization: requestedFields,
    documentStatus: documentOracle.documentStatus,
  })}\n\n${requiredNotice}`;
  const pages = await new PDFLoader(pdf, { splitPages: true }).load();
  const tableContract = validateCategoryOutput({
    answer: adaptedAnswer,
    categoryDefinitions: definitions,
    requiredNotice,
    sourceDocuments: sourceDocumentsFromPages(pages),
  });
  const oracle = evaluateVsPilotOracle({
    oracleDocument: documentOracle,
    pdfSha256: actualSha256,
    physicalPages: worksheet.document.physicalPages,
    documentStatus: documentOracle.documentStatus,
    rows: adaptedRows,
    requestedFieldEvidence: requestedFields,
    selectedSources,
  });
  const legacyRows = skipLegacy
    ? PILOT_IDS.map((categoryId) => ({
        categoryId,
        coverage: "ÜBERSPRUNGEN",
        reviewStatus: "ÜBERSPRUNGEN",
        documentedContent: "Legacy-Lauf für diesen Test übersprungen",
      }))
    : selectedLegacyRows(
        fs.readFileSync(path.join(legacyDirectory, "answer.md"), "utf8")
      );
  const triageReport = readJson(path.join(triageDirectory, "report.json"));
  const effectReport = readJson(path.join(effectDirectory, "report.json"));
  const legacyReport = skipLegacy
    ? { status: "SKIPPED" }
    : readJson(path.join(legacyDirectory, "report.json"));
  const legacyEvaluation = skipLegacy
    ? { passedRows: 0, totalRows: PILOT_IDS.length, results: [], skipped: true }
    : evaluateLegacyRows({ legacyRows, oracleDocument: documentOracle });
  const comparison = skipLegacy
    ? null
    : evaluatePilotComparison({
        pilotEvaluation: oracle,
        legacyEvaluation,
      });
  const responseModelPass = Boolean(
    triageReport.completion?.responseModelComplete === true &&
      triageReport.completion?.responseModel === model &&
      effectReport.completion?.responseModelComplete === true &&
      effectReport.completion?.responseModel === model &&
      (skipLegacy || legacyReport.completion?.responseModel === model)
  );
  const pass = Boolean(
    triageReport.status === "PASS" &&
      triageReport.validation?.formalPass &&
      triageReport.controls?.pass &&
      triageReport.controls?.reviewStatus === "APPROVED" &&
      effectReport.validation?.pass &&
      effectReport.controls?.pass &&
      effectReport.controls?.reviewStatus === "APPROVED" &&
      tableContract.pass &&
      oracle.pass &&
      responseModelPass
  );
  const report = {
    status: pass ? "PASS" : "REVISE",
    documentKey,
    pdf: {
      path: pdf,
      sha256: actualSha256,
      physicalPages: worksheet.document.physicalPages,
    },
    documentStatus: documentOracle.documentStatus,
    model,
    gates: {
      triage: {
        pass: Boolean(
          triageReport.status === "PASS" &&
            triageReport.validation?.formalPass &&
            triageReport.controls?.pass &&
            triageReport.controls?.reviewStatus === "APPROVED"
        ),
        reportStatus: triageReport.status,
      },
      effects: {
        pass: Boolean(
          effectReport.validation?.pass &&
            effectReport.controls?.pass &&
            effectReport.controls?.reviewStatus === "APPROVED"
        ),
        reportStatus: effectReport.status,
      },
      requestedFields: {
        pass: requestedFields.requirements.every(({ requestedFieldStatus }) =>
          ["NOT_REQUIRED", "COMPLETE"].includes(requestedFieldStatus)
        ),
      },
      tableContract,
      oracle,
      responseModel: {
        pass: responseModelPass,
        requested: model,
        legacy: legacyReport.completion?.responseModel || null,
        triage: triageReport.completion?.responseModel || null,
        effects: effectReport.completion?.responseModel || null,
      },
      legacyOracle: legacyEvaluation,
      legacyFormalStatus: legacyReport.status,
    },
    contracts: {
      worksheetSha256: sha256File(worksheetFile),
      triagePromptSha256: sha256File(PATHS.triagePrompt),
      effectPromptSha256: sha256File(PATHS.effectPrompt),
      categoryPromptSha256: sha256File(PATHS.categoryPrompt),
      catalogSha256: sha256File(PATHS.catalog),
      triageControlSha256: sha256File(triageControl),
      effectControlSha256: sha256File(effectControl),
      oracleSha256: sha256File(PATHS.oracle),
    },
  };
  writePrivate(
    path.join(adaptedDirectory, "requested-fields.private.json"),
    requestedFields
  );
  writePrivate(path.join(adaptedDirectory, "rows.private.json"), adaptedRows);
  writePrivate(path.join(adaptedDirectory, "answer.md"), adaptedAnswer);
  writePrivate(path.join(adaptedDirectory, "oracle-result.json"), oracle);
  writePrivate(path.join(adaptedDirectory, "report.json"), report);
  return {
    documentKey,
    pass,
    legacyRows,
    adaptedRows,
    requestedFields,
    selectedSources,
    legacyEvaluation,
    comparison,
    report,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const lfPdf = path.resolve(args.lfPdf || "");
  const wevigPdf = path.resolve(args.wevigPdf || "");
  const output = path.resolve(args.output || "");
  for (const [label, file] of [
    ["LF-PDF", lfPdf],
    ["WEVIG-PDF", wevigPdf],
  ])
    if (!file || !fs.existsSync(file)) fail(`${label} fehlt: ${file}`);
  if (!args.output) fail("--output ist erforderlich");
  ensurePrivateDirectory(output, true);

  const repetitions = Number(args.repetitions || 1);
  const topN = Number(args.topN || 55);
  const modelTokenLimit = Number(args.modelTokenLimit || 42496);
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 3)
    fail("--repetitions muss zwischen 1 und 3 liegen");
  const model =
    args.model || process.env.LMSTUDIO_MODEL_PREF || "qwen/qwen3.6-35b-a3b";
  const embeddingModel =
    args.embeddingModel || process.env.EMBEDDING_MODEL_PREF;
  if (!embeddingModel)
    fail(
      "--embeddingModel ist nur für den ausdrücklich angeforderten historischen Legacy-A/B-Lauf erforderlich"
    );
  const skipLegacy = String(args.skipLegacy || "false") === "true";
  const lmStudioBasePath =
    process.env.LMSTUDIO_BASE_PATH || "http://127.0.0.1:1234/v1";
  const environment = {
    ...process.env,
    LMSTUDIO_BASE_PATH: lmStudioBasePath,
    LMSTUDIO_MODEL_PREF: model,
    LMSTUDIO_MODEL_TOKEN_LIMIT: String(modelTokenLimit),
    EMBEDDING_BASE_PATH:
      process.env.EMBEDDING_BASE_PATH || "http://127.0.0.1:1234/v1",
    EMBEDDING_MODEL_PREF: embeddingModel,
    EMBEDDING_MODEL_MAX_CHUNK_LENGTH:
      process.env.EMBEDDING_MODEL_MAX_CHUNK_LENGTH || "8192",
  };

  const categoryPrompt = fs.readFileSync(PATHS.categoryPrompt, "utf8");
  const definitions = extractCategoryDefinitions(categoryPrompt).filter(
    ({ id }) => PILOT_IDS.includes(id)
  );
  if (
    definitions.length !== PILOT_IDS.length ||
    definitions.some(({ id }, index) => id !== PILOT_IDS[index])
  )
    fail(
      "VS-Pilotdefinitionen fehlen oder sind nicht in der erwarteten Reihenfolge"
    );
  const requiredNotice = extractRequiredNotice(categoryPrompt);
  if (!requiredNotice) fail("Verbindlicher Tabellenhinweis fehlt im VS-Prompt");
  const oracleSet = readJson(PATHS.oracle);
  const oracleByKey = new Map(
    oracleSet.documents.map((document) => [document.documentKey, document])
  );
  const modelBefore = await modelSnapshot(
    lmStudioBasePath,
    model,
    embeddingModel
  );
  if (!modelBefore.requestedModelListed)
    fail(`Angefordertes LM-Studio-Modell ist nicht gelistet: ${model}`);
  if (!modelBefore.requestedEmbeddingModelListed)
    fail(
      `Angefordertes LM-Studio-Embeddingmodell ist nicht gelistet: ${embeddingModel}`
    );

  const allResults = [];
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    const runDirectory = path.join(
      output,
      `run-${String(repetition).padStart(2, "0")}`
    );
    ensurePrivateDirectory(runDirectory);
    console.log(`[vs-pilot-ab] Wiederholung ${repetition}/${repetitions}`);
    for (const [documentKey, pdf] of [
      ["LF", lfPdf],
      ["WEVIG", wevigPdf],
    ]) {
      console.log(`[vs-pilot-ab] ${documentKey}: Legacy A → Pilot B`);
      allResults.push(
        await runDocument({
          documentOracle: oracleByKey.get(documentKey),
          pdf,
          runDirectory,
          environment,
          definitions,
          requiredNotice,
          model,
          modelTokenLimit,
          topN,
          skipLegacy,
        })
      );
    }
  }

  const stability = [];
  for (const documentKey of ["LF", "WEVIG"]) {
    const results = allResults.filter(
      (result) => result.documentKey === documentKey
    );
    const adaptedSnapshots = results.map(semanticSnapshot);
    const legacySnapshots = skipLegacy
      ? []
      : results.map(legacySemanticSnapshot);
    const adaptedPass = adaptedSnapshots.every(
      (snapshot) => snapshot === adaptedSnapshots[0]
    );
    const legacyPass = skipLegacy
      ? null
      : legacySnapshots.every((snapshot) => snapshot === legacySnapshots[0]);
    stability.push({
      documentKey,
      repetitions: results.length,
      pass: adaptedPass && (skipLegacy || legacyPass === true),
      adaptedPass,
      legacyPass,
      adaptedSemanticSnapshotSha256: adaptedSnapshots.map(sha256),
      legacySemanticSnapshotSha256: legacySnapshots.map(sha256),
    });
  }
  const modelAfter = await modelSnapshot(
    lmStudioBasePath,
    model,
    embeddingModel
  );
  const positiveEffectObserved = skipLegacy
    ? null
    : allResults.every(({ comparison }) =>
        Boolean(comparison?.pilotAbsolutePass && comparison.pilotNonRegression)
      ) &&
      allResults.some(({ comparison }) =>
        Boolean(comparison?.pilotStrictImprovement)
      );
  const overallPass = Boolean(
    allResults.every(({ pass }) => pass) &&
      stability.every(({ pass }) => pass) &&
      modelAfter.requestedModelLoaded &&
      modelAfter.requestedEmbeddingModelListed
  );
  const dirty = git(["status", "--porcelain=v1", "--untracked-files=normal"]);
  const manifest = {
    schemaVersion: 1,
    runId: path.basename(output),
    startedFrom: {
      repository: REPOSITORY_ROOT,
      branch: git(["branch", "--show-current"]),
      head: git(["rev-parse", "HEAD"]),
      dirty: Boolean(dirty),
      dirtyStateSha256: sha256(dirty || ""),
    },
    runtime: {
      node: process.version,
      nodeExecutable: process.execPath,
      platform: process.platform,
      architecture: process.arch,
      osRelease: os.release(),
      cpu: os.cpus()[0]?.model || null,
      memoryBytes: os.totalmem(),
    },
    configuration: {
      model,
      embeddingModel,
      modelTokenLimit,
      topN,
      repetitions,
      skipLegacy,
      userPrompt: LEGACY_VS_USER_PROMPT,
      userPromptSha256: sha256(LEGACY_VS_USER_PROMPT),
      temperature: 0,
      seed: null,
    },
    modelBefore,
    modelAfter,
    contracts: Object.fromEntries(
      Object.entries(PATHS)
        .filter(([, file]) => fs.existsSync(file))
        .map(([key, file]) => [key, { path: file, sha256: sha256File(file) }])
    ),
  };
  const report = {
    status: overallPass ? "PASS" : "REVISE",
    scope: oracleSet.scope,
    configuration: manifest.configuration,
    runs: allResults.map(({ documentKey, pass, report: runReport }) => ({
      documentKey,
      pass,
      gates: runReport.gates,
      contracts: runReport.contracts,
    })),
    stability,
    comparison: {
      evaluated: !skipLegacy,
      gateApplied: false,
      positiveEffectObserved,
      outcomes: skipLegacy
        ? []
        : allResults.map(({ documentKey, comparison }) => ({
            documentKey,
            ...comparison,
          })),
      rule: "Nur der absolute Pilot-B-Oracle ist ein Release-Gate. Legacy A wird semantisch und ausschließlich informativ verglichen; ein Gleichstand ist releasefähig, aber kein positiver Effekt.",
    },
    modelGate: {
      pass:
        modelAfter.requestedModelLoaded &&
        modelAfter.requestedEmbeddingModelListed,
      requestedModel: model,
      exactLoadedRecords: modelAfter.exactRecords,
      requestedEmbeddingModel: embeddingModel,
      exactEmbeddingRecords: modelAfter.exactEmbeddingRecords,
    },
  };
  writePrivate(path.join(output, "manifest.private.json"), manifest);
  writePrivate(
    path.join(output, "comparison.md"),
    comparisonMarkdown(allResults)
  );
  writePrivate(path.join(output, "report.json"), report);
  console.log(
    `[vs-pilot-ab] ${report.status}: ${allResults.filter(({ pass }) => pass).length}/${allResults.length} Dokumentläufe, Stabilität ${stability.filter(({ pass }) => pass).length}/${stability.length}`
  );
  if (!overallPass) process.exitCode = 2;
}

main().catch((error) => fail(error.stack || error.message));
