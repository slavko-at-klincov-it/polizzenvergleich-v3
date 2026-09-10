#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  buildLfReferenceGoldOracleSkeleton,
  loadLfReferenceGoldOracleInputs,
} = require("../../utils/policyAnalysis/lfReferenceGoldOracle");

function fail(message) {
  console.error(`[lf-reference-gold-oracle] ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      fail(`Ungültiges Argument: ${key || "-"}`);
    const name = key.slice(2);
    if (Object.hasOwn(values, name)) fail(`Doppeltes Argument: ${name}`);
    values[name] = value;
  }
  const allowed = new Set([
    "runRoot",
    "benchmarkCandidates",
    "output",
    "oracleId",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return values;
}

function writePrivateJson(file, value) {
  if (!path.isAbsolute(file)) fail("--output muss absolut sein");
  if (fs.existsSync(file)) fail(`Ausgabe existiert bereits: ${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

try {
  const args = parseArguments(process.argv.slice(2));
  if (!path.isAbsolute(args.runRoot)) fail("--runRoot muss absolut sein");
  if (!path.isAbsolute(args.benchmarkCandidates))
    fail("--benchmarkCandidates muss absolut sein");
  const inputs = loadLfReferenceGoldOracleInputs({
    runRoot: args.runRoot,
    benchmarkCandidatesFile: args.benchmarkCandidates,
  });
  const oracle = buildLfReferenceGoldOracleSkeleton({
    oracleId: args.oracleId,
    ...inputs,
  });
  writePrivateJson(args.output, oracle);
  console.log(
    `[lf-reference-gold-oracle] DRAFT: ${oracle.summary.rowCount} Zeilen, ${oracle.summary.componentCount} Komponenten, ${oracle.summary.benchmarkCandidateCount} Kandidaten`
  );
} catch (error) {
  fail(error.stack || error.message);
}
