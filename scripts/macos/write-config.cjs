#!/usr/bin/env node

// Generates product-owned configuration atomically while preserving unrelated
// existing settings. Inputs are environment variables; secrets are never logged.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  MANAGED_EMBEDDING_ENV,
} = require("../../shared/managedEmbeddingContract.cjs");

const repo = path.resolve(
  process.env.POLICY_REPO_DIR || path.resolve(__dirname, "../..")
);
const serverEnvPath = path.join(repo, "server/.env");
const collectorEnvPath = path.join(repo, "collector/.env");
const frontendEnvPath = path.join(repo, "frontend/.env");
const storageDir = path.join(repo, "server/storage");
const hotdirPath = path.join(repo, "collector/hotdir");
const modelLock = require("./models.lock.json");

function existingValue(content, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`^\\s*${escaped}\\s*=\\s*['\"]?([^'\"\\r\\n#]*)`, "m")
  );
  return match?.[1]?.trim() || null;
}

const existingServerConfig = fs.existsSync(serverEnvPath)
  ? fs.readFileSync(serverEnvPath, "utf8")
  : "";
let modelState = {};
const modelStatePath = path.join(repo, ".runtime/models.json");
if (fs.existsSync(modelStatePath)) {
  try {
    modelState = JSON.parse(fs.readFileSync(modelStatePath, "utf8"));
  } catch {}
}
const legacyManagedChatIdentifiers = new Set(["policy-chat"]);
function normalizeConfiguredChatModel(value) {
  const configured = String(value || "").trim();
  return !configured || legacyManagedChatIdentifiers.has(configured)
    ? modelLock.chat.identifier
    : configured;
}
const configuredChatModel = normalizeConfiguredChatModel(
  process.env.POLICY_CHAT_MODEL_ID ||
    existingValue(existingServerConfig, "LMSTUDIO_MODEL_PREF") ||
    modelState.chatIdentifier ||
    modelLock.chat.identifier
);
const configuredContextLength =
  process.env.POLICY_CONTEXT_LENGTH ||
  existingValue(existingServerConfig, "LMSTUDIO_MODEL_TOKEN_LIMIT") ||
  String(modelLock.chat.contextLength);

const managedServer = {
  SERVER_PORT: process.env.POLICY_SERVER_PORT || "3002",
  SERVER_HOST: "127.0.0.1",
  COLLECTOR_PORT: process.env.POLICY_COLLECTOR_PORT || "8888",
  COLLECTOR_HOST: "127.0.0.1",
  COLLECTOR_API_HOST: "127.0.0.1",
  COLLECTOR_HOTDIR_PATH: hotdirPath,
  STORAGE_DIR: storageDir,
  JWT_SECRET:
    process.env.POLICY_JWT_SECRET || crypto.randomBytes(32).toString("hex"),
  SIG_KEY: process.env.POLICY_SIG_KEY || crypto.randomBytes(32).toString("hex"),
  SIG_SALT:
    process.env.POLICY_SIG_SALT || crypto.randomBytes(32).toString("hex"),
  AUTH_TOKEN: "",
  POLICY_SINGLE_USER_NO_AUTH: "true",
  LLM_PROVIDER: "lmstudio",
  LMSTUDIO_BASE_PATH: "http://127.0.0.1:1234/v1",
  LMSTUDIO_MODEL_PREF: configuredChatModel,
  LMSTUDIO_MODEL_TOKEN_LIMIT: configuredContextLength,
  ...MANAGED_EMBEDDING_ENV,
  TARGET_OCR_LANG: "deu,eng",
  DISABLE_TELEMETRY: "true",
  DISABLE_SWAGGER_DOCS: "true",
};

let tokenizerPath = process.env.POLICY_TOKENIZER_PATH || null;
if (!tokenizerPath && fs.existsSync(modelStatePath)) {
  try {
    tokenizerPath = modelState.tokenizerPath || null;
  } catch {}
}
// Keep tokenizer metadata aligned with the selected chat model. Empty values
// deliberately remove stale Qwen paths when an alternative model has no local
// Hugging Face tokenizer files; token display then falls back harmlessly.
managedServer.MODEL_TOKENIZER_PATH = tokenizerPath || "";
managedServer.MODEL_TOKENIZER_LABEL = tokenizerPath ? configuredChatModel : "";

const managedCollector = {
  STORAGE_DIR: storageDir,
  COLLECTOR_PORT: managedServer.COLLECTOR_PORT,
  COLLECTOR_HOST: "127.0.0.1",
  COLLECTOR_HOTDIR_PATH: hotdirPath,
  TARGET_OCR_LANG: "deu,eng",
};

function mergeManagedBlock(filePath, values) {
  let current = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";
  for (const secretKey of ["JWT_SECRET", "SIG_KEY", "SIG_SALT"]) {
    const found = existingValue(current, secretKey);
    if (found && Object.prototype.hasOwnProperty.call(values, secretKey))
      values[secretKey] = found;
  }

  const begin = "# BEGIN POLIZZENVERGLEICH MANAGED CONFIG";
  const end = "# END POLIZZENVERGLEICH MANAGED CONFIG";
  const blockPattern = new RegExp(`${begin}[\\s\\S]*?${end}\\n?`, "g");
  current = current.replace(blockPattern, "").trimEnd();
  const managedKeys = new Set(Object.keys(values));
  current = current
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
      return !match || !managedKeys.has(match[1]);
    })
    .join("\n")
    .trimEnd();
  const block = [
    begin,
    ...Object.entries(values).map(
      ([key, value]) => `${key}=${JSON.stringify(String(value))}`
    ),
    end,
    "",
  ].join("\n");
  const next = current ? `${current}\n\n${block}` : block;
  const tempPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, next, { mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, filePath);
}

for (const directory of [
  storageDir,
  hotdirPath,
  path.join(storageDir, "logs"),
  path.join(storageDir, "direct-uploads"),
  path.join(storageDir, "documents"),
]) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

mergeManagedBlock(serverEnvPath, managedServer);
mergeManagedBlock(collectorEnvPath, managedCollector);
mergeManagedBlock(frontendEnvPath, { VITE_API_BASE: "/api" });
console.log(
  JSON.stringify({ success: true, serverPort: managedServer.SERVER_PORT })
);
