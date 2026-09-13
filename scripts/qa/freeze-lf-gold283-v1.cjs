#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  buildLfKnownFixtureGold283,
  sha256,
} = require("./lib/lf-gold283.cjs");

function fail(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) fail("ARGUMENT_MISSING", name);
  return path.resolve(process.argv[index + 1]);
}

function readJson(file) {
  const bytes = fs.readFileSync(file);
  return {
    file,
    fileSha256: sha256(bytes),
    value: JSON.parse(bytes.toString()),
  };
}

function writePrivateImmutable(file, value) {
  if (fs.existsSync(file)) fail("OUTPUT_ALREADY_EXISTS", file);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o400);
}

function main() {
  const files = {
    matrix: getArg("matrix"),
    validation: getArg("validation"),
    comparisons: getArg("row-comparison"),
    astraDecisions: getArg("astra-decisions"),
    evidenceBank: getArg("evidence-bank"),
    sourceRowMap: getArg("source-row-map"),
    technicalValidation: getArg("technical-validation"),
    runManifest: getArg("run-manifest"),
    packet: getArg("packet"),
    goldCandidate: getArg("gold-candidate"),
    gold30: getArg("gold30"),
    adjudication: getArg("adjudication"),
  };
  const output = getArg("output");
  const inputs = Object.fromEntries(
    Object.entries(files).map(([name, file]) => [name, readJson(file)])
  );
  const gold = buildLfKnownFixtureGold283({
    ...Object.fromEntries(
      Object.entries(inputs).map(([name, input]) => [name, input.value])
    ),
    fileBindings: Object.fromEntries(
      Object.entries(inputs).map(([name, input]) => [
        name,
        { file: input.file, fileSha256: input.fileSha256 },
      ])
    ),
  });
  writePrivateImmutable(output, gold);
  process.stdout.write(
    `${JSON.stringify({
      output,
      fileSha256: sha256(fs.readFileSync(output)),
      goldSha256: gold.goldSha256,
      status: gold.status,
      summary: gold.summary,
    })}\n`
  );
}

if (require.main === module) main();

module.exports = { main, readJson, writePrivateImmutable };
