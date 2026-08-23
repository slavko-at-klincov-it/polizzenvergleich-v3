#!/usr/bin/env node

// Generates product-owned configuration atomically while preserving unrelated
// existing settings. Inputs are environment variables; secrets are never logged.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const repo = path.resolve(
  process.env.POLICY_REPO_DIR || path.resolve(__dirname, "../..")
);
const serverEnvPath = path.join(repo, "server/.env");
const collectorEnvPath = path.join(repo, "collector/.env");
const frontendEnvPath = path.join(repo, "frontend/.env");
const storageDir = path.join(repo, "server/storage");
const hotdirPath = path.join(repo, "collector/hotdir");

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
  LLM_PROVIDER: "lmstudio",
  LMSTUDIO_BASE_PATH: "http://127.0.0.1:1234/v1",
  LMSTUDIO_MODEL_PREF: process.env.POLICY_CHAT_MODEL_ID || "policy-chat",
  LMSTUDIO_MODEL_TOKEN_LIMIT: process.env.POLICY_CONTEXT_LENGTH || "32768",
  EMBEDDING_ENGINE: "lmstudio",
  EMBEDDING_BASE_PATH: "http://127.0.0.1:1234/v1",
  EMBEDDING_MODEL_PREF: process.env.POLICY_EMBED_MODEL_ID || "dinghy-law",
  EMBEDDING_MODEL_MAX_CHUNK_LENGTH: "8192",
  EMBEDDING_QUERY_PREFIX:
    "Instruct: Retrieve all relevant passages from German and Austrian insurance contracts for exact clause comparison, including deductibles, exclusions, limits, monetary amounts, percentages, conditions, and synonymous wording.",
  VECTOR_DB: "lancedb",
  TARGET_OCR_LANG: "deu,eng",
  DISABLE_TELEMETRY: "true",
  DISABLE_SWAGGER_DOCS: "true",
};

let tokenizerPath = process.env.POLICY_TOKENIZER_PATH || null;
const modelStatePath = path.join(repo, ".runtime/models.json");
if (!tokenizerPath && fs.existsSync(modelStatePath)) {
  try {
    tokenizerPath =
      JSON.parse(fs.readFileSync(modelStatePath, "utf8")).tokenizerPath || null;
  } catch {}
}
if (tokenizerPath) {
  managedServer.MODEL_TOKENIZER_PATH = tokenizerPath;
  managedServer.MODEL_TOKENIZER_LABEL = "Gemma 4";
}

const managedCollector = {
  STORAGE_DIR: storageDir,
  COLLECTOR_PORT: managedServer.COLLECTOR_PORT,
  COLLECTOR_HOST: "127.0.0.1",
  COLLECTOR_HOTDIR_PATH: hotdirPath,
  TARGET_OCR_LANG: "deu,eng",
};

function existingValue(content, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`^\\s*${escaped}\\s*=\\s*['\"]?([^'\"\\r\\n#]*)`, "m")
  );
  return match?.[1]?.trim() || null;
}

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
