#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  buildLfKnownFixtureGold30,
  sha256,
} = require("../../utils/policyAnalysis/lfKnownFixtureGold30");

function fail(message) {
  console.error(`[lf-gold-30] ${message}`);
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
  for (const required of [
    "packet",
    "adjudication",
    "fullCorpusAudit",
    "decisions",
    "output",
  ])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, path.resolve(value)])
  );
}

function readJson(file, code) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(code);
  const buffer = fs.readFileSync(file);
  return { value: JSON.parse(buffer), sha256: sha256(buffer) };
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
  const packet = readJson(args.packet, "PACKET_INVALID");
  const adjudication = readJson(args.adjudication, "ADJUDICATION_INVALID");
  const fullCorpusAudit = readJson(
    args.fullCorpusAudit,
    "FULL_CORPUS_AUDIT_INVALID"
  );
  const decisions = readJson(args.decisions, "DECISIONS_INVALID");
  const gold = buildLfKnownFixtureGold30({
    packet: packet.value,
    packetFileSha256: packet.sha256,
    adjudication: adjudication.value,
    adjudicationFileSha256: adjudication.sha256,
    fullCorpusAudit: fullCorpusAudit.value,
    fullCorpusAuditFileSha256: fullCorpusAudit.sha256,
    decisions: decisions.value,
    decisionsFileSha256: decisions.sha256,
  });
  writePrivateJson(args.output, gold);
  console.log(JSON.stringify(gold.summary));
  console.log(`[lf-gold-30] ${gold.goldSha256}`);
}

try {
  run();
} catch (error) {
  fail(error.stack || error.message);
}
