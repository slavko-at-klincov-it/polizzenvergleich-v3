const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { analysisPrompt, categoryCatalogs } = require("./lfReferenceProfile");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const SCRIPT_ROOT = path.join(REPOSITORY_ROOT, "server", "scripts", "qa");
const RESOURCE_ROOT = path.join(
  REPOSITORY_ROOT,
  "server",
  "resources",
  "policyAnalysis"
);

function privateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function writePrivate(file, value) {
  privateDirectory(path.dirname(file));
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(
    temporary,
    typeof value === "string" ? value : JSON.stringify(value, null, 2),
    { encoding: "utf8", mode: 0o600 }
  );
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function prepareReferenceContracts(runRoot) {
  const contractRoot = path.join(runRoot, "reference-contracts");
  privateDirectory(contractRoot);
  return categoryCatalogs().map((definition) => {
    const catalogFile = path.join(
      contractRoot,
      `${definition.categoryView}.catalog.private.json`
    );
    const promptFile = path.join(
      contractRoot,
      `${definition.categoryView}.prompt.private.md`
    );
    const catalogBytes = `${JSON.stringify(definition.catalog, null, 2)}\n`;
    const promptBytes = `${analysisPrompt(definition)}\n`;
    if (!fs.existsSync(catalogFile)) writePrivate(catalogFile, catalogBytes);
    else if (fs.readFileSync(catalogFile, "utf8") !== catalogBytes)
      throw new Error(
        `REFERENCE_RESUME_CATALOG_MISMATCH:${definition.categoryView}`
      );
    if (!fs.existsSync(promptFile)) writePrivate(promptFile, promptBytes);
    else if (fs.readFileSync(promptFile, "utf8") !== promptBytes)
      throw new Error(
        `REFERENCE_RESUME_PROMPT_MISMATCH:${definition.categoryView}`
      );
    return { ...definition, catalogFile, promptFile };
  });
}

function categoryComplete(outputDirectory, categoryView) {
  const result = path.join(outputDirectory, categoryView, "result");
  return ["report.json", "answer.md", "rows.private.json"].every((name) =>
    fs.existsSync(path.join(result, name))
  );
}

function completedReferenceCategoryViews(outputDirectory, contracts) {
  return contracts
    .filter(({ categoryView }) =>
      categoryComplete(outputDirectory, categoryView)
    )
    .map(({ categoryView }) => categoryView);
}

function runCommand(args, logFile) {
  return new Promise((resolve, reject) => {
    const log = fs.openSync(logFile, "a", 0o600);
    let logClosed = false;
    const closeLog = () => {
      if (logClosed) return;
      fs.closeSync(log);
      logClosed = true;
    };
    const child = spawn(process.execPath, args, {
      cwd: REPOSITORY_ROOT,
      env: process.env,
      stdio: ["ignore", log, log],
    });
    child.once("error", (error) => {
      closeLog();
      reject(error);
    });
    child.once("close", (code, signal) => {
      closeLog();
      if (code === 0) return resolve();
      reject(
        new Error(
          `REFERENCE_ANALYSIS_COMMAND_FAILED:exit=${code ?? "null"}:signal=${signal || "none"}:script=${path.basename(args[0])}:log=${logFile}`
        )
      );
    });
  });
}

async function analyzeReferenceDocument({
  file,
  documentStatus,
  outputDirectory,
  logFile,
  contracts,
  model,
  modelTokenLimit,
  onCategoryComplete = () => {},
}) {
  privateDirectory(outputDirectory);
  const documentArtifact = path.join(outputDirectory, "document.private.json");
  if (!fs.existsSync(documentArtifact))
    await runCommand(
      [
        path.join(SCRIPT_ROOT, "extractPolicyDocument.cjs"),
        "--pdfFile",
        file,
        "--output",
        documentArtifact,
      ],
      logFile
    );
  for (const contract of contracts) {
    if (categoryComplete(outputDirectory, contract.categoryView)) {
      onCategoryComplete(contract.categoryView);
      continue;
    }
    const categoryRoot = path.join(outputDirectory, contract.categoryView);
    const worksheet = path.join(categoryRoot, "worksheet.private.json");
    const triageRoot = path.join(categoryRoot, "triage");
    const effectsRoot = path.join(categoryRoot, "effects");
    const resultRoot = path.join(categoryRoot, "result");
    privateDirectory(triageRoot);
    privateDirectory(effectsRoot);
    privateDirectory(resultRoot);
    if (!fs.existsSync(worksheet))
      await runCommand(
        [
          path.join(SCRIPT_ROOT, "buildCategoryOccurrenceWorksheet.cjs"),
          "--documentArtifact",
          documentArtifact,
          "--catalogFile",
          contract.catalogFile,
          "--output",
          worksheet,
        ],
        logFile
      );
    const triage = path.join(triageRoot, "materialized-triage.private.json");
    if (!fs.existsSync(triage))
      await runCommand(
        [
          path.join(SCRIPT_ROOT, "runVsCandidateTriage.cjs"),
          "--worksheet",
          worksheet,
          "--systemPromptFile",
          path.join(RESOURCE_ROOT, "candidate-triage-system.v0.1.md"),
          "--hybridSystemPromptFile",
          path.join(RESOURCE_ROOT, "hybrid-candidate-triage-addon.v0.1.md"),
          "--controlMode",
          "technical-review",
          "--output",
          triageRoot,
          "--model",
          model,
          "--modelTokenLimit",
          String(modelTokenLimit),
          "--maxAttemptsPerTarget",
          "2",
        ],
        logFile
      );
    const effects = path.join(effectsRoot, "materialized.private.json");
    if (!fs.existsSync(effects))
      await runCommand(
        [
          path.join(SCRIPT_ROOT, "runPreparedEvidenceEvaluation.cjs"),
          "--worksheet",
          worksheet,
          "--documentArtifact",
          documentArtifact,
          "--triageFile",
          triage,
          "--systemPromptFile",
          path.join(RESOURCE_ROOT, "prepared-evidence-system.v0.1.md"),
          "--controlMode",
          "technical-review",
          "--documentStatus",
          documentStatus,
          "--output",
          effectsRoot,
          "--model",
          model,
          "--modelTokenLimit",
          String(modelTokenLimit),
          "--maxAttemptsPerTarget",
          "2",
          "--allowUniqueCandidateIdRepair",
          "true",
        ],
        logFile
      );
    await runCommand(
      [
        path.join(SCRIPT_ROOT, "materializeCategoryFullResult.cjs"),
        "--categoryView",
        contract.categoryView,
        "--documentKey",
        path.basename(file, path.extname(file)),
        "--pdf",
        file,
        "--documentArtifact",
        documentArtifact,
        "--promptFile",
        contract.promptFile,
        "--catalogFile",
        contract.catalogFile,
        "--worksheet",
        worksheet,
        "--triage",
        triage,
        "--triageReport",
        path.join(triageRoot, "report.json"),
        "--effects",
        effects,
        "--effectsReport",
        path.join(effectsRoot, "report.json"),
        "--sources",
        path.join(effectsRoot, "selected-sources.private.json"),
        "--documentStatus",
        documentStatus,
        "--model",
        model,
        "--output",
        resultRoot,
      ],
      logFile
    );
    onCategoryComplete(contract.categoryView);
  }
}

module.exports = {
  analyzeReferenceDocument,
  completedReferenceCategoryViews,
  prepareReferenceContracts,
};
