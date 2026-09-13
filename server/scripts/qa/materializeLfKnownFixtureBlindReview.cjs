#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  buildLfKnownFixtureBlindReviewPacket,
} = require("../../utils/policyAnalysis/lfKnownFixtureSourceReview");

function fail(message) {
  console.error(`[lf-blind-review-packet] ${message}`);
  process.exit(1);
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      fail(`Ungültiges Argument: ${key || "-"}`);
    values[key.slice(2)] = value;
  }
  for (const required of ["goldCandidate", "oracle", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return {
    goldCandidate: path.resolve(values.goldCandidate),
    oracle: path.resolve(values.oracle),
    output: path.resolve(values.output),
    maximumPerComponent: Number(values.maximumPerComponent || 4),
    maximumQuoteCharacters: Number(values.maximumQuoteCharacters || 1_200),
  };
}

function readJson(file, label) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} ist ungültig`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writePrivateJson(file, value) {
  if (fs.existsSync(file)) fail(`Ausgabe existiert bereits: ${file}`);
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
  const packet = buildLfKnownFixtureBlindReviewPacket({
    goldCandidate: readJson(args.goldCandidate, "Gold-Kandidat"),
    oracle: readJson(args.oracle, "Oracle"),
    maximumPerComponent: args.maximumPerComponent,
    maximumQuoteCharacters: args.maximumQuoteCharacters,
  });
  writePrivateJson(args.output, packet);
  console.log(
    `[lf-blind-review-packet] READY: ${packet.summary.rows} Zeilen, ${packet.summary.actualComponents} Komponenten, ${packet.summary.exactCandidatesSelected}/${packet.summary.exactCandidatesAvailable} exakte Kandidaten`
  );
  console.log(JSON.stringify(packet.summary));
}

try {
  run();
} catch (error) {
  fail(error.stack || error.message);
}
