#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function fail(message) {
  console.error(`[all-category-manifest] ${message}`);
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

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function git(repository, args, encoding = "utf8") {
  const result = spawnSync("git", ["-C", repository, ...args], {
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0)
    fail(
      `Release-Identität konnte nicht ermittelt werden: ${String(result.stderr || "git fehlgeschlagen").trim()}`
    );
  return result.stdout;
}

function releaseIdentity(repository) {
  const head = git(repository, ["rev-parse", "HEAD"]).trim();
  const dirtyState = git(repository, [
    "status",
    "--porcelain=v1",
    "--untracked-files=normal",
  ]);
  if (!dirtyState) return head;

  const digest = crypto.createHash("sha256");
  digest.update(dirtyState);
  digest.update(git(repository, ["diff", "--binary", "HEAD"], null));
  const untracked = git(repository, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ])
    .split("\0")
    .filter(Boolean)
    .sort();
  for (const relativeFile of untracked) {
    const absoluteFile = path.join(repository, relativeFile);
    digest.update(relativeFile);
    if (fs.existsSync(absoluteFile) && fs.statSync(absoluteFile).isFile())
      digest.update(fs.readFileSync(absoluteFile));
  }
  return `${head}-dirty-${digest.digest("hex")}`;
}

function writeAtomic(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set([
    "manifest",
    "output",
    "repository",
    "releaseId",
    "pdfFile",
    "model",
    "modelTokenLimit",
    "documentStatus",
  ]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of [
    "manifest",
    "output",
    "repository",
    "pdfFile",
    "model",
    "modelTokenLimit",
    "documentStatus",
  ]) {
    if (!args[required]) fail(`--${required} ist erforderlich`);
  }

  const manifestFile = path.resolve(args.manifest);
  const output = path.resolve(args.output);
  const pdfFile = path.resolve(args.pdfFile);
  const repository = path.resolve(args.repository);
  const releaseId = args.releaseId || releaseIdentity(repository);
  const expected = {
    schemaVersion: 1,
    runKind: "ALL_CATEGORIES_QUALITY",
    releaseId,
    configuration: {
      model: args.model,
      modelTokenLimit: Number(args.modelTokenLimit),
      documentStatus: args.documentStatus,
    },
    document: {
      sourcePath: pdfFile,
      sha256: sha256File(pdfFile),
      sizeBytes: fs.statSync(pdfFile).size,
    },
  };

  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(manifestFile)) {
    const existingEntries = fs.readdirSync(output);
    if (existingEntries.length)
      fail(
        `Unsicherer Resume abgelehnt: Ausgabeordner enthält Daten, aber kein Manifest: ${output}`
      );
    writeAtomic(manifestFile, {
      ...expected,
      createdAt: new Date().toISOString(),
    });
    console.log(`[all-category-manifest] Neu angelegt: ${manifestFile}`);
    return;
  }

  let existing;
  try {
    existing = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  } catch (error) {
    fail(`Manifest ist nicht lesbar: ${error.message}`);
  }
  const mismatches = [];
  if (existing.schemaVersion !== expected.schemaVersion)
    mismatches.push("schemaVersion");
  if (existing.runKind !== expected.runKind) mismatches.push("runKind");
  if (existing.releaseId !== expected.releaseId) mismatches.push("releaseId");
  if (existing.configuration?.model !== expected.configuration.model)
    mismatches.push("model");
  if (
    existing.configuration?.modelTokenLimit !==
    expected.configuration.modelTokenLimit
  )
    mismatches.push("modelTokenLimit");
  if (
    existing.configuration?.documentStatus !==
    expected.configuration.documentStatus
  )
    mismatches.push("documentStatus");
  if (existing.document?.sha256 !== expected.document.sha256)
    mismatches.push("pdfSha256");
  if (mismatches.length)
    fail(
      `Unsicherer Resume abgelehnt; Laufkontext weicht ab: ${mismatches.join(", ")}`
    );
  console.log(
    `[all-category-manifest] Resume-Kontext bestätigt: ${manifestFile}`
  );
}

run();
