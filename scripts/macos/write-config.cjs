#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const repo = path.resolve(
  process.env.V3_REPO_DIR || path.resolve(__dirname, "../..")
);
const serverEnv = path.join(repo, "server/.env");
const collectorEnv = path.join(repo, "collector/.env");
const frontendEnv = path.join(repo, "frontend/.env");
const storage = path.join(repo, "server/storage");

function existingValue(content, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`^\\s*${escaped}\\s*=\\s*['\"]?([^'\"\\r\\n#]*)`, "m")
  );
  return match?.[1]?.trim() || null;
}

function mergeManagedBlock(file, values) {
  let current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  for (const key of ["JWT_SECRET", "SIG_KEY", "SIG_SALT"]) {
    const old = existingValue(current, key);
    if (old && Object.hasOwn(values, key)) values[key] = old;
  }

  const begin = "# BEGIN POLIZZENVERGLEICH V3 MANAGED CONFIG";
  const end = "# END POLIZZENVERGLEICH V3 MANAGED CONFIG";
  current = current
    .replace(new RegExp(`${begin}[\\s\\S]*?${end}\\n?`, "g"), "")
    .trimEnd();
  const managed = new Set(Object.keys(values));
  current = current
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
      return !match || !managed.has(match[1]);
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
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, current ? `${current}\n\n${block}` : block, {
    mode: 0o600,
  });
  fs.chmodSync(temp, 0o600);
  fs.renameSync(temp, file);
}

for (const dir of [
  storage,
  path.join(storage, "logs"),
  path.join(storage, "backups"),
  path.join(storage, "direct-uploads"),
  path.join(storage, "documents"),
  path.join(repo, "collector/hotdir"),
]) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
}

mergeManagedBlock(serverEnv, {
  SERVER_PORT: process.env.V3_SERVER_PORT || "3004",
  SERVER_HOST: "127.0.0.1",
  COLLECTOR_PORT: process.env.V3_COLLECTOR_PORT || "8890",
  COLLECTOR_API_HOST: "127.0.0.1",
  STORAGE_DIR: storage,
  SIG_KEY: process.env.V3_SIG_KEY || crypto.randomBytes(32).toString("hex"),
  SIG_SALT: process.env.V3_SIG_SALT || crypto.randomBytes(32).toString("hex"),
  LOCAL_ONLY_MODE: "true",
  TARGET_OCR_LANG: "deu,eng",
  DISABLE_TELEMETRY: "true",
});

mergeManagedBlock(collectorEnv, {
  STORAGE_DIR: storage,
  COLLECTOR_PORT: process.env.V3_COLLECTOR_PORT || "8890",
  COLLECTOR_HOST: "127.0.0.1",
  TARGET_OCR_LANG: "deu,eng",
});

mergeManagedBlock(frontendEnv, { VITE_API_BASE: "/api" });
console.log(
  JSON.stringify({
    success: true,
    serverPort: process.env.V3_SERVER_PORT || "3004",
    collectorPort: process.env.V3_COLLECTOR_PORT || "8890",
  })
);
