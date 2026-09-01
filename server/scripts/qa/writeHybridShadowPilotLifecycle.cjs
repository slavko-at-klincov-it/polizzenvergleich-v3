#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(`[hybrid-shadow-pilot-lifecycle] ${message}`);
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

function numberOrNull(value) {
  if (value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) fail(`Ungültige Zeit: ${value}`);
  return number;
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

function run() {
  const args = parseArguments(process.argv.slice(2));
  for (const required of [
    "output",
    "status",
    "startedAtMs",
    "finishedAtMs",
    "qwenRestored",
  ])
    if (!args[required]) fail(`--${required} ist erforderlich`);
  if (!new Set(["COMPLETE", "FAILED"]).has(args.status))
    fail("Lifecycle-Status ist ungültig");
  if (!new Set(["true", "false"]).has(args.qwenRestored))
    fail("qwenRestored ist ungültig");
  const startedAtMs = numberOrNull(args.startedAtMs);
  const finishedAtMs = numberOrNull(args.finishedAtMs);
  const report = {
    schemaVersion: 1,
    artifactKind: "HYBRID_SHADOW_PILOT_MODEL_LIFECYCLE",
    status: args.status,
    shadowOnly: true,
    customerResultChanged: false,
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    timing: {
      totalWallDurationMs: finishedAtMs - startedAtMs,
      qwenUnloadDurationMs: numberOrNull(args.qwenUnloadMs),
      dinghyLoadDurationMs: numberOrNull(args.dinghyLoadMs),
      dinghyUnloadDurationMs: numberOrNull(args.dinghyUnloadMs),
      qwenLoadDurationMs: numberOrNull(args.qwenLoadMs),
    },
    modelState: {
      qwenRestored: args.qwenRestored === "true",
    },
    failure: args.detail || null,
  };
  writePrivateJson(path.resolve(args.output), report);
  console.log(`[hybrid-shadow-pilot-lifecycle] ${report.status}`);
}

try {
  run();
} catch (error) {
  fail(error.stack || error.message);
}
