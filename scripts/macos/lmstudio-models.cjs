#!/usr/bin/env node

// LM Studio boundary: acquire exact artifacts, load them with stable API IDs,
// and validate runtime context plus chat/embedding contracts.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");
const {
  pendingChatIdentifiers,
  readChatModelState,
  writeChatModelState,
} = require("../../shared/lmStudioChatModelState.cjs");

const repo = path.resolve(
  process.env.POLICY_REPO_DIR || path.resolve(__dirname, "../..")
);
const serverEnvPath = path.join(repo, "server/.env");
const serverEnv = fs.existsSync(serverEnvPath)
  ? fs.readFileSync(serverEnvPath, "utf8")
  : "";
function envFileValue(key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = serverEnv.match(
    new RegExp(`^\\s*${escaped}\\s*=\\s*['\"]?([^'\"\\r\\n#]*)`, "m")
  );
  return match?.[1]?.trim() || null;
}
const lock = JSON.parse(
  fs.readFileSync(path.join(__dirname, "models.lock.json"), "utf8")
);
const runtimeDir =
  process.env.POLICY_RUNTIME_DIR || path.join(repo, ".runtime");
// The repository declares `type: module`. Keep the downloaded CommonJS helper
// on an explicit `.cjs` path so Node never interprets it as an ES module.
const wrapperPath = path.join(runtimeDir, "bin/lms-embed.cjs");
const command = process.argv[2] || "check";
const shouldDownload = process.argv.includes("--download");
const unloadOther = process.argv.includes("--unload-other");
const skipArtifactVerification = process.argv.includes(
  "--skip-artifact-verification"
);
const lmsCommand = process.env.POLICY_LMS_COMMAND || "lms";
const lmStudioBaseUrl = (
  process.env.POLICY_LMSTUDIO_BASE_URL || "http://127.0.0.1:1234"
).replace(/\/$/, "");
const inferenceTimeoutMs = 60_000;
const legacyManagedChatIdentifiers = new Set(["policy-chat"]);
function normalizeConfiguredChatIdentifier(value) {
  const configured = String(value || "").trim();
  return !configured || legacyManagedChatIdentifiers.has(configured)
    ? lock.chat.identifier
    : configured;
}
const configuredChatIdentifier = normalizeConfiguredChatIdentifier(
  process.env.POLICY_CHAT_MODEL_ID ||
    process.env.LMSTUDIO_MODEL_PREF ||
    envFileValue("LMSTUDIO_MODEL_PREF") ||
    lock.chat.identifier
);
const configuredChatContextLength = Number(
  process.env.POLICY_CONTEXT_LENGTH ||
    process.env.LMSTUDIO_MODEL_TOKEN_LIMIT ||
    envFileValue("LMSTUDIO_MODEL_TOKEN_LIMIT") ||
    lock.chat.contextLength
);
const previousModelState = readChatModelState(repo);
const pendingPreviousChatIdentifiers = pendingChatIdentifiers(
  previousModelState
).filter((identifier) => identifier !== configuredChatIdentifier);

function fail(message) {
  throw new Error(message);
}

if (!configuredChatIdentifier)
  fail("LMSTUDIO_MODEL_PREF enthält kein Chatmodell.");
if (
  !Number.isInteger(configuredChatContextLength) ||
  configuredChatContextLength < 4096
)
  fail("LMSTUDIO_MODEL_TOKEN_LIMIT ist für das Chatmodell ungültig.");

function run(executable, args, { allowFailure = false, capture = true } = {}) {
  const result = spawnSync(executable, args, {
    ...(capture ? { encoding: "utf8" } : { stdio: "inherit" }),
    env: process.env,
  });
  if (result.error)
    fail(
      `${executable} konnte nicht ausgeführt werden: ${result.error.message}`
    );
  if (result.status !== 0 && !allowFailure) {
    fail(
      (
        result.stderr ||
        result.stdout ||
        `${executable} ${args.join(" ")} fehlgeschlagen`
      ).trim()
    );
  }
  return result;
}

function lmsJson(args) {
  const output = run(lmsCommand, args).stdout;
  try {
    return JSON.parse(output);
  } catch (error) {
    fail(`Ungültige JSON-Antwort von lms ${args.join(" ")}: ${error.message}`);
  }
}

function findModel(models, config) {
  if (!config.indexedModelIdentifier) return null;
  return models.find(
    (model) =>
      model.indexedModelIdentifier === config.indexedModelIdentifier &&
      model.path === config.indexedModelIdentifier
  );
}

function modelMatchesKey(model, expectedKey) {
  return [
    model?.identifier,
    model?.key,
    model?.modelKey,
    model?.indexedModelIdentifier,
    model?.path,
  ].includes(expectedKey);
}

async function fetchNativeModels() {
  const endpoint = new URL(lmStudioBaseUrl);
  endpoint.pathname = "/api/v1/models";
  const apiKey =
    process.env.LMSTUDIO_AUTH_TOKEN || envFileValue("LMSTUDIO_AUTH_TOKEN");
  const response = await fetch(endpoint, {
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    signal: AbortSignal.timeout(inferenceTimeoutMs),
  });
  if (!response.ok)
    fail(`LM-Studio-Modellmetadaten sind nicht verfügbar: ${response.status}`);
  const data = await response.json();
  return Array.isArray(data?.models) ? data.models : [];
}

function recommendedMetadataProblems(model) {
  if (!model) return [`Modell-Key '${lock.chat.modelKey}' fehlt.`];
  const problems = [];
  if (model.key !== lock.chat.modelKey) problems.push("Modell-Key");
  if (model.selected_variant !== lock.chat.selectedVariant)
    problems.push("4-bit-Variante");
  if (String(model.format || "").toLowerCase() !== lock.chat.format)
    problems.push("MLX-Format");
  if (Number(model.size_bytes) !== lock.chat.sizeBytes)
    problems.push("Modellgröße");
  if (Number(model.max_context_length) !== lock.chat.maxContextLength)
    problems.push("theoretisches Kontextfenster");
  const reasoning = model.capabilities?.reasoning;
  if (
    reasoning?.default !== lock.chat.reasoningDefault ||
    !reasoning?.allowed_options?.includes(lock.chat.reasoningDefault)
  )
    problems.push("Reasoning-Standard (in LM Studio auf 'off' setzen)");
  return problems;
}

function loadedRuntimeProblems(instance) {
  if (!instance) return ["geladene Instanz"];
  const problems = [];
  // Current MLX engines can auto-fit an explicitly requested context upward.
  // AnythingLLM remains capped at configuredChatContextLength, so a larger
  // effective runtime is compatible; a smaller one is not.
  const effectiveContextLength = Number(instance.contextLength);
  if (
    !Number.isFinite(effectiveContextLength) ||
    effectiveContextLength < configuredChatContextLength
  )
    problems.push("Runtime-Kontext");
  if (Number(instance.parallel) !== lock.chat.parallel)
    problems.push("Parallelität");
  return problems;
}

function loadConfiguredChat(model) {
  run(
    lmsCommand,
    [
      "load",
      model.modelKey,
      "--identifier",
      configuredChatIdentifier,
      "--context-length",
      String(configuredChatContextLength),
      "--parallel",
      String(lock.chat.parallel),
      "-y",
    ],
    { capture: false }
  );
}

function ensureConfiguredChatRuntime(model) {
  const loaded = lmsJson(["ps", "--json"]);
  const existing = loaded.find(
    (item) =>
      item.identifier === configuredChatIdentifier && item.type === "llm"
  );
  const problems = loadedRuntimeProblems(existing);
  if (existing && problems.length === 0) return;
  if (existing) {
    run(lmsCommand, ["unload", existing.identifier], {
      capture: false,
    });
  }
  loadConfiguredChat(model);
}

async function recommendedNativeModel() {
  const models = await fetchNativeModels();
  return models.find((model) => model.key === lock.chat.modelKey) || null;
}

function findConfiguredChatModel(models, loaded = []) {
  const active = loaded.find(
    (model) =>
      model.type === "llm" && model.identifier === configuredChatIdentifier
  );
  const rememberedIndexedIdentifier =
    previousModelState.chatIdentifier === configuredChatIdentifier
      ? previousModelState.chatIndexedModelIdentifier
      : null;
  const indexedIdentifier =
    active?.indexedModelIdentifier || rememberedIndexedIdentifier;
  if (indexedIdentifier) {
    const remembered = models.find(
      (model) =>
        model.indexedModelIdentifier === indexedIdentifier ||
        model.path === indexedIdentifier
    );
    if (remembered) return remembered;
  }

  const acceptableKeys = [
    configuredChatIdentifier,
    ...(active?.modelKey ? [active.modelKey] : []),
    ...(previousModelState.chatIdentifier === configuredChatIdentifier &&
    previousModelState.chatModelKey
      ? [previousModelState.chatModelKey]
      : []),
    ...(configuredChatIdentifier === lock.chat.identifier
      ? [lock.chat.selectedVariant]
      : []),
  ];
  const configured = models.find((model) =>
    acceptableKeys.some((key) => modelMatchesKey(model, key))
  );
  if (configured) return configured;
  if (configuredChatIdentifier === lock.chat.identifier)
    return findModel(models, lock.chat);
  return null;
}

function tokenizerPathForModel(model) {
  const modelDirectory = path.join(
    process.env.HOME,
    ".lmstudio/models",
    model.path ||
      model.indexedModelIdentifier ||
      `${lock.chat.publisher}/${lock.chat.repository}`
  );
  return fs.existsSync(path.join(modelDirectory, "tokenizer.json")) &&
    fs.existsSync(path.join(modelDirectory, "tokenizer_config.json"))
    ? modelDirectory
    : null;
}

function persistConfiguredChatState(model, extra = {}) {
  return writeChatModelState(
    {
      chatModelKey: model.modelKey,
      chatIdentifier: configuredChatIdentifier,
      chatIndexedModelIdentifier: model.indexedModelIdentifier || null,
      embeddingIdentifier: lock.embedding.identifier,
      tokenizerPath: tokenizerPathForModel(model),
      previousChatIdentifiers: [],
      previousChatIdentifier: null,
      ...extra,
    },
    repo
  );
}

function verifyModelArtifacts(model, config) {
  const modelPath = path.join(process.env.HOME, ".lmstudio/models", model.path);
  const artifactDirectory = config.pathIsFile
    ? path.dirname(modelPath)
    : modelPath;
  for (const [filename, expected] of Object.entries(config.artifacts || {})) {
    const artifact = path.join(artifactDirectory, filename);
    if (!fs.existsSync(artifact))
      fail(`Geprüftes Modellartefakt fehlt: ${filename}`);
    const output = run("/usr/bin/shasum", ["-a", "256", artifact]).stdout;
    const actual = output.trim().split(/\s+/)[0];
    if (actual !== expected)
      fail(`Prüfsumme des Modellartefakts '${filename}' stimmt nicht.`);
  }
}

async function downloadFile(url, destination) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body)
    fail(`Download fehlgeschlagen: ${response.status} ${url}`);
  await pipeline(
    Readable.fromWeb(response.body),
    fs.createWriteStream(destination, { mode: 0o700 })
  );
}

async function ensureWrapper() {
  const crypto = require("crypto");
  if (fs.existsSync(wrapperPath)) {
    const existingDigest = crypto
      .createHash("sha256")
      .update(fs.readFileSync(wrapperPath))
      .digest("hex");
    if (existingDigest === lock.lmsEmbed.sha256) return;
    fs.rmSync(wrapperPath, { force: true });
  }
  fs.mkdirSync(path.dirname(wrapperPath), { recursive: true, mode: 0o700 });
  const temp = `${wrapperPath}.tmp-${process.pid}`;
  await downloadFile(lock.lmsEmbed.downloadUrl, temp);
  const digest = crypto
    .createHash("sha256")
    .update(fs.readFileSync(temp))
    .digest("hex");
  if (digest !== lock.lmsEmbed.sha256) {
    fs.rmSync(temp, { force: true });
    fail("Prüfsumme des lms-embed-Hilfswerkzeugs stimmt nicht.");
  }
  fs.chmodSync(temp, 0o700);
  fs.renameSync(temp, wrapperPath);
}

function listenerIsLoopbackOnly(port) {
  if (process.env.POLICY_SKIP_LMSTUDIO_BINDING_CHECK === "1") return true;
  const result = run(
    "/usr/sbin/lsof",
    ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"],
    { allowFailure: true }
  );
  if (result.status !== 0 || !result.stdout.trim()) return false;
  return result.stdout
    .trim()
    .split("\n")
    .slice(1)
    .every((line) => /TCP (127\.0\.0\.1|\[::1\]):/.test(line));
}

function ensureLmsServer({ repair }) {
  if (repair) run(lmsCommand, ["daemon", "up"], { capture: false });
  const status = run(lmsCommand, ["server", "status"], { allowFailure: true });
  if (
    status.status !== 0 ||
    !/running/i.test(`${status.stdout} ${status.stderr}`)
  ) {
    if (!repair) fail("LM-Studio-Server läuft nicht.");
    run(
      lmsCommand,
      ["server", "start", "--port", "1234", "--bind", "127.0.0.1"],
      { capture: false }
    );
  }
  if (!listenerIsLoopbackOnly(new URL(lmStudioBaseUrl).port || "1234")) {
    if (!repair) fail("LM Studio lauscht nicht ausschließlich auf 127.0.0.1.");
    run(lmsCommand, ["server", "stop"], { allowFailure: true, capture: false });
    run(
      lmsCommand,
      [
        "server",
        "start",
        "--port",
        new URL(lmStudioBaseUrl).port || "1234",
        "--bind",
        "127.0.0.1",
      ],
      { capture: false }
    );
    if (!listenerIsLoopbackOnly(new URL(lmStudioBaseUrl).port || "1234"))
      fail(
        "LM-Studio-Server konnte nicht sicher auf Loopback begrenzt werden."
      );
  }
}

function acquireModels({ verifyArtifacts = true } = {}) {
  let models = lmsJson(["ls", "--json"]);
  let loaded = lmsJson(["ps", "--json"]);
  if (!findConfiguredChatModel(models, loaded)) {
    if (configuredChatIdentifier !== lock.chat.identifier)
      fail(
        `Das in AnythingLLM konfigurierte Chatmodell '${configuredChatIdentifier}' ist in LM Studio nicht installiert. Bitte das Modell lokal installieren oder LMSTUDIO_MODEL_PREF ändern.`
      );
    if (!shouldDownload)
      fail(
        "Das empfohlene Qwen-Chatmodell fehlt. Installer erneut ohne --skip-model-download starten."
      );
    run(lmsCommand, ["get", lock.chat.downloadUrl, "--mlx", "-y"], {
      capture: false,
    });
  }
  models = lmsJson(["ls", "--json"]);
  if (!findModel(models, lock.embedding)) {
    if (!shouldDownload)
      fail(
        "Dinghy Law 4B Q6 fehlt. Installer erneut ohne --skip-model-download starten."
      );
    run(lmsCommand, ["get", lock.embedding.downloadUrl, "--gguf", "-y"], {
      capture: false,
    });
  }
  models = lmsJson(["ls", "--json"]);
  loaded = lmsJson(["ps", "--json"]);
  const chat = findConfiguredChatModel(models, loaded);
  const embedding = findModel(models, lock.embedding);
  if (!chat || !embedding)
    fail(
      "Modelle wurden nach dem Download nicht eindeutig in LM Studio gefunden."
    );
  if (verifyArtifacts) {
    if (Object.keys(lock.chat.artifacts || {}).length > 0)
      verifyModelArtifacts(chat, lock.chat);
    verifyModelArtifacts(embedding, lock.embedding);
  }
  return { chat, embedding };
}

async function loadModels() {
  ensureLmsServer({ repair: true });
  let recommendedModel = null;
  if (configuredChatIdentifier === lock.chat.identifier) {
    recommendedModel = await recommendedNativeModel();
    const metadataProblems = recommendedMetadataProblems(recommendedModel);
    if (metadataProblems.length > 0) {
      if (!shouldDownload)
        fail(`Qwen-Modellvertrag verletzt: ${metadataProblems.join(", ")}.`);
      run(lmsCommand, ["get", lock.chat.downloadUrl, "--mlx", "-y"], {
        capture: false,
      });
      recommendedModel = await recommendedNativeModel();
      const remainingProblems = recommendedMetadataProblems(recommendedModel);
      if (remainingProblems.length > 0)
        fail(`Qwen-Modellvertrag verletzt: ${remainingProblems.join(", ")}.`);
    }
  }
  const models = acquireModels({
    verifyArtifacts: !skipArtifactVerification,
  });
  if (unloadOther)
    run(lmsCommand, ["unload", "--all"], {
      allowFailure: true,
      capture: false,
    });
  // Resolve the replacement artifact first, then remove only chat models that
  // were previously managed by this product before loading the replacement.
  // This avoids a transient Qwen + Gemma + Dinghy allocation on a 32-GB Mac.
  for (const previousChatIdentifier of pendingPreviousChatIdentifiers) {
    const previouslyLoaded = lmsJson(["ps", "--json"]).find(
      (item) =>
        item.type === "llm" && item.identifier === previousChatIdentifier
    );
    if (!previouslyLoaded) continue;
    run(lmsCommand, ["unload", previousChatIdentifier], {
      capture: false,
    });
    const stillLoaded = lmsJson(["ps", "--json"]).some(
      (item) =>
        item.type === "llm" && item.identifier === previousChatIdentifier
    );
    if (stillLoaded)
      fail(
        `Das vorherige Chatmodell '${previousChatIdentifier}' konnte nicht entladen werden.`
      );
  }
  ensureConfiguredChatRuntime(models.chat);

  const loadedBeforeEmbedding = lmsJson(["ps", "--json"]);
  const activeEmbedding = loadedBeforeEmbedding.find(
    (item) =>
      item.identifier === lock.embedding.identifier &&
      item.type === "embedding" &&
      item.indexedModelIdentifier === lock.embedding.indexedModelIdentifier
  );
  if (!activeEmbedding) {
    await ensureWrapper();
    run(
      process.execPath,
      [
        wrapperPath,
        "load",
        models.embedding.modelKey,
        "--identifier",
        lock.embedding.identifier,
      ],
      { capture: false }
    );
  }
  // The first Dinghy classification can restart llmster. Re-assert the chat
  // runtime afterwards because older `lms ps --json` payloads do not always
  // preserve every load option while lms-embed restores prior models.
  ensureConfiguredChatRuntime(models.chat);
  persistConfiguredChatState(models.chat);
}

async function validate() {
  ensureLmsServer({ repair: false });
  const loaded = lmsJson(["ps", "--json"]);
  const chat = loaded.find(
    (item) =>
      item.identifier === configuredChatIdentifier && item.type === "llm"
  );
  const embedding = loaded.find(
    (item) =>
      item.identifier === lock.embedding.identifier &&
      item.type === "embedding" &&
      item.indexedModelIdentifier === lock.embedding.indexedModelIdentifier
  );
  if (!chat)
    fail(`Chatmodell '${configuredChatIdentifier}' ist nicht geladen.`);
  const pendingLoadedChatModels = loaded.filter(
    (item) =>
      item.type === "llm" &&
      pendingPreviousChatIdentifiers.includes(item.identifier)
  );
  if (pendingLoadedChatModels.length > 0)
    fail(
      `Vorheriges Chatmodell wird noch bereinigt: ${pendingLoadedChatModels
        .map(({ identifier }) => identifier)
        .join(", ")}. Bitte den Modell-Neustart abwarten.`
    );
  if (
    configuredChatIdentifier === lock.chat.identifier &&
    !modelMatchesKey(chat, lock.chat.modelKey)
  )
    fail(
      `Geladenes Standard-Chatmodell stimmt nicht mit '${lock.chat.modelKey}' überein.`
    );
  if (configuredChatIdentifier === lock.chat.identifier) {
    const nativeModel = await recommendedNativeModel();
    const problems = recommendedMetadataProblems(nativeModel);
    if (problems.length > 0)
      fail(`Qwen-Modellvertrag verletzt: ${problems.join(", ")}.`);
  }
  if (!embedding)
    fail(`Embeddingmodell '${lock.embedding.identifier}' ist nicht geladen.`);
  const runtimeProblems = loadedRuntimeProblems(chat);
  if (runtimeProblems.length > 0)
    fail(
      `Chatmodell-Laufzeit verletzt: ${runtimeProblems.join(", ")} ` +
        `(Kontext ${chat.contextLength ?? "unbekannt"}/mindestens ${configuredChatContextLength}, ` +
        `Parallelität ${chat.parallel ?? "unbekannt"}/${lock.chat.parallel}).`
    );

  const embeddingResponse = await fetch(`${lmStudioBaseUrl}/v1/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: lock.embedding.identifier,
      input: "Selbstbehalt in der Gebäudeversicherung",
    }),
    signal: AbortSignal.timeout(inferenceTimeoutMs),
  });
  if (!embeddingResponse.ok)
    fail(`Embedding-Test fehlgeschlagen: ${embeddingResponse.status}`);
  const vector = (await embeddingResponse.json())?.data?.[0]?.embedding;
  if (
    !Array.isArray(vector) ||
    vector.length !== lock.embedding.dimensions ||
    !vector.every(Number.isFinite)
  ) {
    fail(
      `Embedding-Test lieferte nicht ${lock.embedding.dimensions} numerische Dimensionen.`
    );
  }
  const norm = Math.hypot(...vector);
  if (Math.abs(norm - 1) > 0.01)
    fail(`Embedding-Vektor ist nicht normalisiert (L2 ${norm}).`);

  const chatResponse = await fetch(`${lmStudioBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: configuredChatIdentifier,
      messages: [{ role: "user", content: "Antworte nur mit: bereit" }],
      // Reasoning-capable models can consume dozens of hidden tokens before
      // emitting a one-word visible answer. Keep the probe bounded, but large
      // enough to validate the configured model rather than a Qwen-specific
      // output pattern.
      max_tokens: 256,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(inferenceTimeoutMs),
  });
  if (!chatResponse.ok)
    fail(`Chatmodell-Test fehlgeschlagen: ${chatResponse.status}`);
  const chatPayload = await chatResponse.json();
  const choice = chatPayload?.choices?.[0];
  const content = choice?.message?.content;
  const answer = Array.isArray(content)
    ? content
        .map((part) => (typeof part === "string" ? part : part?.text || ""))
        .join("")
    : content;
  if (!String(answer || "").trim())
    fail("Chatmodell-Test lieferte keine Antwort.");

  const installedChat = findConfiguredChatModel(
    lmsJson(["ls", "--json"]),
    loaded
  );
  if (!installedChat)
    fail(
      `Chatmodell '${configuredChatIdentifier}' konnte keiner installierten Modelldatei zugeordnet werden.`
    );
  persistConfiguredChatState(installedChat, {
    // The independent models launch job owns removal of the former managed
    // chat model. Do not clear this hand-off from the server/Doctor check.
    previousChatIdentifier:
      command === "check"
        ? previousModelState.previousChatIdentifier || null
        : null,
    previousChatIdentifiers:
      command === "check" ? pendingPreviousChatIdentifiers : [],
  });
  console.log(
    JSON.stringify({
      success: true,
      chat: chat.identifier,
      contextLength: chat.contextLength,
      embedding: embedding.identifier,
      dimensions: vector.length,
    })
  );
}

(async () => {
  if (command === "prepare") await loadModels();
  else if (command === "ensure-server") {
    ensureLmsServer({ repair: true });
    console.log(JSON.stringify({ success: true, serverReady: true }));
    return;
  } else if (command === "verify-artifacts") {
    acquireModels({ verifyArtifacts: true });
    console.log(JSON.stringify({ success: true, artifactsVerified: true }));
    return;
  } else if (command !== "check") fail(`Unbekannter Befehl '${command}'.`);
  await validate();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
