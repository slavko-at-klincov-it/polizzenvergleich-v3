#!/usr/bin/env node

// LM Studio boundary: acquire exact artifacts, load them with stable API IDs,
// and validate runtime context plus chat/embedding contracts.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");

const repo = path.resolve(
  process.env.POLICY_REPO_DIR || path.resolve(__dirname, "../..")
);
const lock = JSON.parse(
  fs.readFileSync(path.join(__dirname, "models.lock.json"), "utf8")
);
const runtimeDir =
  process.env.POLICY_RUNTIME_DIR || path.join(repo, ".runtime");
const wrapperPath = path.join(runtimeDir, "bin/lms-embed");
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

function fail(message) {
  throw new Error(message);
}

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
  return models.find(
    (model) =>
      model.indexedModelIdentifier === config.indexedModelIdentifier &&
      model.path === config.indexedModelIdentifier
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
  if (!findModel(models, lock.chat)) {
    if (!shouldDownload)
      fail(
        "Gemma 4 fehlt. Installer erneut ohne --skip-model-download starten."
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
  const chat = findModel(models, lock.chat);
  const embedding = findModel(models, lock.embedding);
  if (!chat || !embedding)
    fail(
      "Modelle wurden nach dem Download nicht eindeutig in LM Studio gefunden."
    );
  if (verifyArtifacts) {
    verifyModelArtifacts(chat, lock.chat);
    verifyModelArtifacts(embedding, lock.embedding);
  }
  return { chat, embedding };
}

async function loadModels() {
  ensureLmsServer({ repair: true });
  const models = acquireModels({
    verifyArtifacts: !skipArtifactVerification,
  });
  if (unloadOther)
    run(lmsCommand, ["unload", "--all"], {
      allowFailure: true,
      capture: false,
    });
  const loaded = lmsJson(["ps", "--json"]);
  const activeChat = loaded.find(
    (item) =>
      item.identifier === lock.chat.identifier &&
      item.indexedModelIdentifier === lock.chat.indexedModelIdentifier &&
      item.type === "llm" &&
      Number(item.contextLength) >= lock.chat.contextLength
  );
  if (!activeChat) {
    run(
      lmsCommand,
      [
        "load",
        models.chat.modelKey,
        "--identifier",
        lock.chat.identifier,
        "--context-length",
        String(lock.chat.contextLength),
        "--parallel",
        String(lock.chat.parallel),
        "-y",
      ],
      { capture: false }
    );
  }

  await ensureWrapper();
  const activeEmbedding = loaded.find(
    (item) =>
      item.identifier === lock.embedding.identifier &&
      item.type === "embedding" &&
      item.indexedModelIdentifier === lock.embedding.indexedModelIdentifier
  );
  if (!activeEmbedding) {
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

  const tokenizerCandidate = path.join(
    process.env.HOME,
    ".lmstudio/models",
    models.chat.path || `${lock.chat.publisher}/${lock.chat.repository}`,
    "tokenizer.json"
  );
  fs.writeFileSync(
    path.join(runtimeDir, "models.json"),
    JSON.stringify(
      {
        chatModelKey: models.chat.modelKey,
        chatIdentifier: lock.chat.identifier,
        embeddingIdentifier: lock.embedding.identifier,
        tokenizerPath: fs.existsSync(tokenizerCandidate)
          ? path.dirname(tokenizerCandidate)
          : null,
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
}

async function validate() {
  ensureLmsServer({ repair: false });
  const loaded = lmsJson(["ps", "--json"]);
  const chat = loaded.find(
    (item) =>
      item.identifier === lock.chat.identifier &&
      item.type === "llm" &&
      item.indexedModelIdentifier === lock.chat.indexedModelIdentifier
  );
  const embedding = loaded.find(
    (item) =>
      item.identifier === lock.embedding.identifier &&
      item.type === "embedding" &&
      item.indexedModelIdentifier === lock.embedding.indexedModelIdentifier
  );
  if (!chat) fail(`Chatmodell '${lock.chat.identifier}' ist nicht geladen.`);
  if (!embedding)
    fail(`Embeddingmodell '${lock.embedding.identifier}' ist nicht geladen.`);
  if (Number(chat.contextLength) < lock.chat.contextLength) {
    fail(
      `Chatmodell hat nur ${chat.contextLength} statt ${lock.chat.contextLength} Runtime-Tokens.`
    );
  }

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
      model: lock.chat.identifier,
      messages: [{ role: "user", content: "Antworte nur mit: bereit" }],
      max_tokens: 12,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(inferenceTimeoutMs),
  });
  if (!chatResponse.ok)
    fail(`Chatmodell-Test fehlgeschlagen: ${chatResponse.status}`);
  const answer = (await chatResponse.json())?.choices?.[0]?.message?.content;
  if (!String(answer || "").trim())
    fail("Chatmodell-Test lieferte keine Antwort.");
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
