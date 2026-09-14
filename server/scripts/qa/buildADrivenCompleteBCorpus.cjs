#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  buildADrivenCompleteBCorpus,
  validateADrivenCompleteBCorpus,
} = require("../../utils/policyAnalysis/aDrivenCompleteBCorpus");
const {
  validateADrivenCounterpartSearchPlan,
} = require("../../utils/policyAnalysis/aDrivenCounterpartSearchPlan");

function fail(message) {
  console.error(`[lf-a-driven-complete-b-corpus] ${message}`);
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
    values[name] = value;
  }
  const allowed = new Set(["runRoot", "searchPlan", "output"]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, path.resolve(value)])
  );
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
    throw new Error(`LF_A_DRIVEN_COMPLETE_B_OUTPUT_EXISTS:${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function documentDirectory(runRoot, document) {
  return path.join(
    runRoot,
    "documents",
    `${document.side}-${String(document.position + 1).padStart(2, "0")}-${document.uuid}`
  );
}

function loadDocuments(runRoot) {
  const manifest = readJson(
    path.join(runRoot, "input-manifest.private.json"),
    "LF_A_DRIVEN_COMPLETE_B_INPUT_MANIFEST"
  );
  const documents = manifest.documents
    .filter(({ side }) => side === "B")
    .sort((left, right) => left.position - right.position)
    .map((document) => ({
      document,
      artifact: readJson(
        path.join(
          documentDirectory(runRoot, document),
          "document.private.json"
        ),
        "LF_A_DRIVEN_COMPLETE_B_DOCUMENT_ARTIFACT"
      ),
    }));
  if (!documents.length)
    throw new Error("LF_A_DRIVEN_COMPLETE_B_DOCUMENTS_MISSING");
  return documents;
}

try {
  const args = argumentsFrom(process.argv.slice(2));
  const searchPlan = readJson(
    args.searchPlan,
    "LF_A_DRIVEN_COMPLETE_B_SEARCH_PLAN"
  );
  validateADrivenCounterpartSearchPlan(searchPlan);
  const corpus = buildADrivenCompleteBCorpus({
    documents: loadDocuments(args.runRoot),
  });
  validateADrivenCompleteBCorpus(corpus, { searchPlan });
  writePrivateJson(args.output, corpus);
  console.log(
    `[lf-a-driven-complete-b-corpus] FERTIG: ${corpus.summary.documents} Dokumente, ${corpus.summary.clauses} Klauseln, ${corpus.corpusSha256}`
  );
} catch (error) {
  fail(error.stack || error.message);
}
