#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  assessADrivenManifestAtomicityRisks,
} = require("../../utils/policyAnalysis/aDrivenAStatusAudit");

function fail(message) {
  console.error(`[lf-a-atomicity-audit] ${message}`);
  process.exit(1);
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      fail(`Ungültiges Argument: ${key || "-"}`);
    const name = key.slice(2);
    if (Object.hasOwn(values, name)) fail(`Doppeltes Argument: ${name}`);
    values[name] = path.resolve(value);
  }
  const allowed = new Set(["sourceUnitPlan", "manifest", "output"]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return values;
}

function readJson(file, code) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    throw new Error(`${code}_MISSING`);
  }
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`${code}_INVALID`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error(`${code}_INVALID`);
  }
}

function writePrivateJson(file, value) {
  if (fs.existsSync(file))
    throw new Error(`LF_A_ATOMICITY_AUDIT_OUTPUT_EXISTS:${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

try {
  const args = argumentsFrom(process.argv.slice(2));
  const audit = assessADrivenManifestAtomicityRisks({
    plan: readJson(args.sourceUnitPlan, "LF_A_ATOMICITY_AUDIT_SOURCE_PLAN"),
    manifest: readJson(args.manifest, "LF_A_ATOMICITY_AUDIT_MANIFEST"),
  });
  writePrivateJson(args.output, audit);
  console.log(JSON.stringify(audit.summary, null, 2));
} catch (error) {
  fail(error.stack || error.message);
}
