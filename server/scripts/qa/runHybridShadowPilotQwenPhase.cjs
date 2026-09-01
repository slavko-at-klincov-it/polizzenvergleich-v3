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
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
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
  const allowed = new Set([
    "manifest",
    "pilotFile",
    "searchGate",
    "output",
  ]);
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
      [
        "--worksheet",
        category.shadowWorksheetPath,
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
      ],
      environment
    );
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

run().catch((error) => fail(error.stack || error.message));
