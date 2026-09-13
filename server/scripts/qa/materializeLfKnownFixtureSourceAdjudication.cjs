#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  buildLfKnownFixtureSourceAdjudication,
  sha256,
} = require("../../utils/policyAnalysis/lfKnownFixtureSourceAdjudication");

function fail(message) {
  console.error(`[lf-source-adjudication] ${message}`);
  process.exit(1);
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) fail(`Ungültiges Argument: ${key}`);
    values[key.slice(2)] = value;
  }
  for (const required of ["packet", "qwenOutput", "decisions", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, path.resolve(value)])
  );
}

function regularFile(file, code) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(code);
}

function readJson(file, code) {
  regularFile(file, `${code}_INVALID`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function resultFile(directory, row) {
  return path.join(
    directory,
    "rows",
    `${String(row.reviewIndex + 1).padStart(2, "0")}-${row.requirementId}.private.json`
  );
}

function writePrivateJson(file, value) {
  if (fs.existsSync(file)) throw new Error(`OUTPUT_EXISTS:${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function run() {
  const args = argumentsFrom(process.argv.slice(2));
  const packet = readJson(args.packet, "LF_SOURCE_REVIEW_PACKET");
  const summaryFile = path.join(args.qwenOutput, "summary.private.json");
  const qwenSummary = readJson(summaryFile, "LF_SOURCE_REVIEW_SUMMARY");
  const input = readJson(args.decisions, "LF_SOURCE_ADJUDICATION_DECISIONS");
  const qwenResponses = packet.rows.map(
    (row) =>
      readJson(resultFile(args.qwenOutput, row), "LF_SOURCE_REVIEW_RESULT")
        .response
  );
  const artifact = buildLfKnownFixtureSourceAdjudication({
    packet,
    qwenSummary,
    qwenResponses,
    input,
    inputSha256: sha256(fs.readFileSync(args.decisions)),
    qwenSummarySha256: sha256(fs.readFileSync(summaryFile)),
  });
  writePrivateJson(args.output, artifact);
  console.log(JSON.stringify(artifact.summary));
  console.log(`[lf-source-adjudication] ${artifact.adjudicationSha256}`);
}

if (require.main === module)
  try {
    run();
  } catch (error) {
    fail(error.stack || error.message);
  }

module.exports = { argumentsFrom, resultFile };
