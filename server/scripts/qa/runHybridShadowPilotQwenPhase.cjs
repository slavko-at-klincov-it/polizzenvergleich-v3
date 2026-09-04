#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { spawnSync } = require("child_process");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");

function fail(message) {
  console.error(`[hybrid-shadow-pilot-qwen] ${message}`);
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
    fail(`${label} ist kein gültiges JSON: ${error.message}`);
  }
}

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readRegularFile(file, code) {
  let metadata;
  try {
    metadata = fs.lstatSync(file);
  } catch {
    throw new Error(`${code}_MISSING: ${file}`);
  }
  if (!metadata.isFile()) throw new Error(`${code}_NOT_REGULAR_FILE: ${file}`);
  return fs.readFileSync(file);
}

function parseBoundJson(bytes, code) {
  try {
    const value = JSON.parse(bytes.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("JSON root is not an object");
    return value;
  } catch (error) {
    throw new Error(`${code}_JSON_INVALID: ${error.message}`);
  }
}

function resolveDocumentArtifactBinding({ manifest, category }) {
  const documentIndex = category?.documentIndex;
  const documentFingerprint = String(category?.documentFingerprint || "");
  if (
    !Number.isInteger(documentIndex) ||
    documentIndex < 0 ||
    !documentFingerprint ||
    !Array.isArray(manifest?.documents)
  )
    throw new Error("HYBRID_SHADOW_PILOT_DOCUMENT_ARTIFACT_CONTRACT_INVALID");
  const matches = manifest.documents.filter(
    (document) =>
      document?.documentIndex === documentIndex &&
      document?.documentFingerprint === documentFingerprint
  );
  if (matches.length !== 1)
    throw new Error(
      `HYBRID_SHADOW_PILOT_MANIFEST_DOCUMENT_BINDING_NOT_UNIQUE: ${String(
        documentIndex
      )}:${documentFingerprint}`
    );

  const manifestDocument = matches[0];
  if (
    typeof manifestDocument.documentArtifactPath !== "string" ||
    !manifestDocument.documentArtifactPath.trim() ||
    !/^[a-f0-9]{64}$/u.test(
      String(manifestDocument.documentArtifactSha256 || "")
    )
  )
    throw new Error("HYBRID_SHADOW_PILOT_DOCUMENT_ARTIFACT_CONTRACT_INVALID");

  const documentArtifactPath = path.resolve(
    manifestDocument.documentArtifactPath
  );
  const documentArtifactBytes = readRegularFile(
    documentArtifactPath,
    "HYBRID_SHADOW_PILOT_DOCUMENT_ARTIFACT"
  );
  const documentArtifactSha256 = sha256(documentArtifactBytes);
  if (documentArtifactSha256 !== manifestDocument.documentArtifactSha256)
    throw new Error("HYBRID_SHADOW_PILOT_DOCUMENT_ARTIFACT_CHANGED");
  const documentArtifact = parseBoundJson(
    documentArtifactBytes,
    "HYBRID_SHADOW_PILOT_DOCUMENT_ARTIFACT"
  );
  if (
    documentArtifact.schemaVersion !== 1 ||
    documentArtifact.fingerprint !== documentFingerprint ||
    documentArtifact.document?.sourceDocumentId !== documentFingerprint
  )
    throw new Error("HYBRID_SHADOW_PILOT_DOCUMENT_ARTIFACT_IDENTITY_MISMATCH");

  return {
    documentArtifactPath,
    documentArtifactSha256,
    documentFingerprint,
  };
}

function buildPreparedEvidenceArguments({
  category,
  documentArtifactPath,
  effectsPrompt,
  effectsOutput,
  triageOutput,
  manifest,
}) {
  return [
    "--worksheet",
    category.shadowWorksheetPath,
    "--documentArtifact",
    documentArtifactPath,
    "--triageFile",
    path.join(triageOutput, "materialized-triage.private.json"),
    "--systemPromptFile",
    effectsPrompt,
    "--controlMode",
    "technical-review",
    "--documentStatus",
    category.documentStatus,
    "--output",
    effectsOutput,
    "--model",
    manifest.qwen.model,
    "--modelTokenLimit",
    String(manifest.qwen.modelTokenLimit),
    "--maxAttemptsPerTarget",
    "2",
    "--allowUniqueCandidateIdRepair",
    "true",
  ];
}

function verifyEffectsReportBindings({
  category,
  effectsOutput,
  documentArtifactBinding,
}) {
  const reportPath = path.join(effectsOutput, "report.json");
  const targetsPath = path.join(effectsOutput, "targets.private.json");
  const reportBytes = readRegularFile(
    reportPath,
    "HYBRID_SHADOW_PILOT_EFFECTS_REPORT"
  );
  const targetsBytes = readRegularFile(
    targetsPath,
    "HYBRID_SHADOW_PILOT_EFFECTS_TARGETS"
  );
  const report = parseBoundJson(
    reportBytes,
    "HYBRID_SHADOW_PILOT_EFFECTS_REPORT"
  );
  const contracts = report.contracts;
  if (
    !contracts ||
    contracts.worksheetSha256 !== category.shadowWorksheetSha256 ||
    contracts.documentArtifactPath !==
      documentArtifactBinding.documentArtifactPath ||
    contracts.documentArtifactSha256 !==
      documentArtifactBinding.documentArtifactSha256 ||
    contracts.documentFingerprint !==
      documentArtifactBinding.documentFingerprint ||
    contracts.targetsSha256 !== sha256(targetsBytes)
  )
    throw new Error("HYBRID_SHADOW_PILOT_EFFECTS_REPORT_BINDING_INVALID");
  return {
    reportPath,
    reportSha256: sha256(reportBytes),
    targetsPath,
    targetsSha256: sha256(targetsBytes),
  };
}

function writePrivateJson(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function runNode(script, argumentsList, environment) {
  const result = spawnSync(process.execPath, [script, ...argumentsList], {
    cwd: REPOSITORY_ROOT,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `HYBRID_SHADOW_PILOT_CHILD_FAILED: ${path.basename(script)}:${result.status}`
    );
}

async function verifyQwenLoaded({ baseUrl, model, modelTokenLimit }) {
  const apiRoot = baseUrl.replace(/\/v1\/?$/u, "");
  const response = await fetch(`${apiRoot}/api/v0/models`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`HYBRID_SHADOW_QWEN_MODEL_LIST_FAILED: ${response.status}`);
  const body = await response.json();
  const loaded = body?.data?.find(
    ({ id, type, state }) =>
      id === model && type === "llm" && state === "loaded"
  );
  if (
    !loaded ||
    Number(loaded.loaded_context_length) !== Number(modelTokenLimit)
  )
    throw new Error(
      `HYBRID_SHADOW_QWEN_NOT_EXACTLY_LOADED: ${model}:${modelTokenLimit}`
    );
  return {
    id: loaded.id,
    type: loaded.type,
    state: loaded.state,
    loadedContextLength: Number(loaded.loaded_context_length),
  };
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set(["manifest", "pilotFile", "searchGate", "output"]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!args[required]) fail(`--${required} ist erforderlich`);

  const manifestFile = path.resolve(args.manifest);
  const pilotFile = path.resolve(args.pilotFile);
  const searchGateFile = path.resolve(args.searchGate);
  const output = path.resolve(args.output);
  const manifest = readJson(manifestFile, "Pilot-Manifest");
  const gate = readJson(searchGateFile, "Search-Gate");
  if (
    manifest?.runKind !== "HYBRID_SHADOW_TWO_PHASE_PILOT_QA" ||
    gate?.artifactKind !== "HYBRID_SHADOW_PILOT_SEARCH_GATE" ||
    gate.status !== "PASS_QWEN_ALLOWED" ||
    gate.contracts?.manifestSha256 !== sha256File(manifestFile) ||
    output !== path.join(path.dirname(manifestFile), "qwen") ||
    fs.existsSync(output)
  )
    throw new Error("HYBRID_SHADOW_PILOT_QWEN_GATE_INVALID");
  const baseUrl = process.env.LMSTUDIO_BASE_PATH || "http://127.0.0.1:1234/v1";
  const loadedQwen = await verifyQwenLoaded({
    baseUrl,
    model: manifest.qwen.model,
    modelTokenLimit: manifest.qwen.modelTokenLimit,
  });
  fs.mkdirSync(output, { recursive: false, mode: 0o700 });
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const environment = {
    ...process.env,
    LMSTUDIO_BASE_PATH: baseUrl,
    LMSTUDIO_MODEL_PREF: manifest.qwen.model,
    LMSTUDIO_MODEL_TOKEN_LIMIT: String(manifest.qwen.modelTokenLimit),
  };

  for (const category of gate.categories) {
    const documentArtifactBinding = resolveDocumentArtifactBinding({
      manifest,
      category,
    });
    const categoryOutput = path.join(
      output,
      `document-${category.documentIndex + 1}`,
      category.categoryView
    );
    const triageOutput = path.join(categoryOutput, "triage");
    const effectsOutput = path.join(categoryOutput, "effects");
    fs.mkdirSync(triageOutput, { recursive: true, mode: 0o700 });
    fs.mkdirSync(effectsOutput, { recursive: true, mode: 0o700 });
    const vs = category.categoryView === "VS";
    const triagePrompt = path.join(
      REPOSITORY_ROOT,
      "server/resources/policyAnalysis",
      vs
        ? "vs-candidate-triage-system.v0.1.md"
        : "candidate-triage-system.v0.1.md"
    );
    const effectsPrompt = path.join(
      REPOSITORY_ROOT,
      "server/resources/policyAnalysis",
      vs
        ? "vs-prepared-evidence-system.v0.1.md"
        : "prepared-evidence-system.v0.1.md"
    );
    console.log(
      `[hybrid-shadow-pilot-qwen] Dokument ${category.documentIndex + 1} ${category.categoryView} – Triage`
    );
    runNode(
      path.join(REPOSITORY_ROOT, "server/scripts/qa/runVsCandidateTriage.cjs"),
      [
        "--worksheet",
        category.shadowWorksheetPath,
        "--documentArtifact",
        documentArtifactBinding.documentArtifactPath,
        "--systemPromptFile",
        triagePrompt,
        "--hybridSystemPromptFile",
        path.join(
          REPOSITORY_ROOT,
          "server/resources/policyAnalysis/hybrid-candidate-triage-addon.v0.1.md"
        ),
        "--controlMode",
        "technical-review",
        "--output",
        triageOutput,
        "--model",
        manifest.qwen.model,
        "--modelTokenLimit",
        String(manifest.qwen.modelTokenLimit),
        "--maxAttemptsPerTarget",
        "2",
      ],
      environment
    );
    console.log(
      `[hybrid-shadow-pilot-qwen] Dokument ${category.documentIndex + 1} ${category.categoryView} – Evidenzvertrag`
    );
    runNode(
      path.join(
        REPOSITORY_ROOT,
        "server/scripts/qa/runPreparedEvidenceEvaluation.cjs"
      ),
      buildPreparedEvidenceArguments({
        category,
        documentArtifactPath: documentArtifactBinding.documentArtifactPath,
        effectsPrompt,
        effectsOutput,
        triageOutput,
        manifest,
      }),
      environment
    );
    verifyEffectsReportBindings({
      category,
      effectsOutput,
      documentArtifactBinding,
    });
  }

  const evaluationFile = path.join(output, "evaluation.private.json");
  runNode(
    path.join(
      REPOSITORY_ROOT,
      "server/scripts/qa/evaluateHybridShadowPilot.cjs"
    ),
    [
      "--manifest",
      manifestFile,
      "--pilotFile",
      pilotFile,
      "--searchGate",
      searchGateFile,
      "--qwenOutput",
      output,
      "--output",
      evaluationFile,
    ],
    environment
  );
  const completion = {
    schemaVersion: 1,
    artifactKind: "HYBRID_SHADOW_PILOT_QWEN_COMPLETE",
    status: "QWEN_COMPLETE",
    shadowOnly: true,
    primaryMutationAllowed: false,
    startedAt,
    finishedAt: new Date().toISOString(),
    qwenWallDurationMs: performance.now() - started,
    loadedQwen,
    contracts: {
      manifestPath: manifestFile,
      manifestSha256: sha256File(manifestFile),
      searchGatePath: searchGateFile,
      searchGateSha256: sha256File(searchGateFile),
      evaluationPath: evaluationFile,
      evaluationSha256: sha256File(evaluationFile),
    },
  };
  writePrivateJson(path.join(output, "complete.private.json"), completion);
  console.log("[hybrid-shadow-pilot-qwen] QWEN_COMPLETE");
}

if (require.main === module)
  run().catch((error) => fail(error.stack || error.message));

module.exports = {
  buildPreparedEvidenceArguments,
  resolveDocumentArtifactBinding,
  verifyEffectsReportBindings,
};
