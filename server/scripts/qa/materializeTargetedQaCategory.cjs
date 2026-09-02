#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  CATEGORY_ORDER,
  fixedSourcePaths,
} = require("./ensureTargetedQaManifest.cjs");
const { derivedExecution } = require("./prepareTargetedQaWorksheets.cjs");
const { releaseIdentity } = require("../../utils/policyAnalysis/runIdentity");
const {
  materializeTargetedCategoryResult,
} = require("../../utils/policyAnalysis/targetedCategoryResultContract");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_FILES = Object.freeze({
  rows: "rows.private.json",
  requestedFields: "requested-fields.private.json",
  answer: "answer.private.md",
  report: "report.private.json",
});

function cliError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function parseArguments(argv) {
  if (argv.length % 2 !== 0)
    throw cliError("TARGETED_RESULT_CLI_ARGUMENT_INVALID");
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw cliError("TARGETED_RESULT_CLI_ARGUMENT_INVALID", key);
    const name = key.slice(2);
    if (Object.hasOwn(values, name))
      throw cliError("TARGETED_RESULT_CLI_ARGUMENT_DUPLICATE", name);
    values[name] = value;
  }
  const expected = [
    "baselineRoot",
    "phaseRoot",
    "manifest",
    "expectedManifestDigestSha256",
    "documentUuid",
    "categoryView",
    "output",
    "model",
    "modelTokenLimit",
  ];
  const unknown = Object.keys(values).filter((key) => !expected.includes(key));
  if (unknown.length)
    throw cliError("TARGETED_RESULT_CLI_ARGUMENT_UNKNOWN", unknown.join(","));
  for (const required of expected)
    if (!values[required])
      throw cliError("TARGETED_RESULT_CLI_ARGUMENT_REQUIRED", required);
  for (const absolute of [
    values.baselineRoot,
    values.phaseRoot,
    values.manifest,
    values.output,
  ])
    if (!path.isAbsolute(absolute))
      throw cliError("TARGETED_RESULT_CLI_ABSOLUTE_PATH_REQUIRED");
  if (!/^[a-f0-9]{64}$/u.test(values.expectedManifestDigestSha256))
    throw cliError("TARGETED_RESULT_CLI_MANIFEST_DIGEST_INVALID");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(values.documentUuid))
    throw cliError("TARGETED_RESULT_CLI_DOCUMENT_UUID_INVALID");
  if (!CATEGORY_ORDER.includes(values.categoryView))
    throw cliError("TARGETED_RESULT_CLI_CATEGORY_INVALID");
  const modelTokenLimit = Number(values.modelTokenLimit);
  if (!Number.isInteger(modelTokenLimit) || modelTokenLimit < 1)
    throw cliError("TARGETED_RESULT_CLI_MODEL_TOKEN_LIMIT_INVALID");
  return { ...values, modelTokenLimit };
}

function isWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== "..")
  );
}

function realDirectory(directory, code, fsImpl) {
  if (
    !fsImpl.existsSync(directory) ||
    fsImpl.lstatSync(directory).isSymbolicLink() ||
    !fsImpl.statSync(directory).isDirectory()
  )
    throw cliError(code, directory);
  return fsImpl.realpathSync(directory);
}

function requiredFileBytes(file, code, fsImpl, scope = null) {
  if (
    !fsImpl.existsSync(file) ||
    fsImpl.lstatSync(file).isSymbolicLink() ||
    !fsImpl.statSync(file).isFile()
  )
    throw cliError(code, file);
  const resolved = fsImpl.realpathSync(file);
  if (scope && !isWithin(scope, resolved)) throw cliError(code, file);
  return fsImpl.readFileSync(resolved);
}

function parseJson(bytes, code) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw cliError(code);
  }
}

function privateJson(value) {
  return Buffer.from(JSON.stringify(value, null, 2), "utf8");
}

function writeAtomicPrivate(file, bytes, fsImpl) {
  const temporary = `${file}.tmp-${process.pid}-${crypto
    .randomBytes(12)
    .toString("hex")}`;
  let descriptor = null;
  let temporaryExists = false;
  try {
    descriptor = fsImpl.openSync(temporary, "wx", 0o600);
    temporaryExists = true;
    fsImpl.writeFileSync(descriptor, bytes);
    fsImpl.fsyncSync(descriptor);
    fsImpl.closeSync(descriptor);
    descriptor = null;
    fsImpl.linkSync(temporary, file);
    fsImpl.chmodSync(file, 0o600);
    fsImpl.unlinkSync(temporary);
    temporaryExists = false;
  } finally {
    if (descriptor !== null) fsImpl.closeSync(descriptor);
    if (temporaryExists && fsImpl.existsSync(temporary))
      fsImpl.unlinkSync(temporary);
  }
}

function assertExactResume(output, expectedFiles, fsImpl) {
  if (
    fsImpl.lstatSync(output).isSymbolicLink() ||
    !fsImpl.statSync(output).isDirectory() ||
    (fsImpl.statSync(output).mode & 0o777) !== 0o700
  )
    throw cliError("TARGETED_RESULT_CLI_EXISTING_OUTPUT_INVALID");
  const expectedNames = [...expectedFiles.keys()].sort();
  const observedNames = fsImpl.readdirSync(output).sort();
  if (JSON.stringify(observedNames) !== JSON.stringify(expectedNames))
    throw cliError("TARGETED_RESULT_CLI_EXISTING_OUTPUT_MISMATCH");
  for (const name of expectedNames) {
    const file = path.join(output, name);
    if (
      fsImpl.lstatSync(file).isSymbolicLink() ||
      !fsImpl.statSync(file).isFile() ||
      (fsImpl.statSync(file).mode & 0o777) !== 0o600 ||
      !fsImpl.readFileSync(file).equals(expectedFiles.get(name))
    )
      throw cliError("TARGETED_RESULT_CLI_EXISTING_OUTPUT_MISMATCH", name);
  }
}

function pairDirectory({ root, documentIndex, documentUuid, categoryView }) {
  return path.join(
    root,
    `DOC-${String(documentIndex + 1).padStart(2, "0")}-${documentUuid}`,
    categoryView
  );
}

function run(
  {
    baselineRoot,
    phaseRoot,
    manifest: manifestFile,
    expectedManifestDigestSha256,
    documentUuid,
    categoryView,
    output,
    model,
    modelTokenLimit,
  },
  {
    fsImpl = fs,
    repositoryRoot = REPOSITORY_ROOT,
    releaseIdentityFn = releaseIdentity,
    nodeVersion = process.versions.node,
    materializeResultFn = materializeTargetedCategoryResult,
  } = {}
) {
  for (const absolute of [baselineRoot, phaseRoot, manifestFile, output])
    if (!path.isAbsolute(absolute))
      throw cliError("TARGETED_RESULT_CLI_ABSOLUTE_PATH_REQUIRED");
  const repository = realDirectory(
    path.resolve(repositoryRoot),
    "TARGETED_RESULT_CLI_REPOSITORY_INVALID",
    fsImpl
  );
  const baseline = realDirectory(
    path.resolve(baselineRoot),
    "TARGETED_RESULT_CLI_BASELINE_INVALID",
    fsImpl
  );
  const phase = realDirectory(
    path.resolve(phaseRoot),
    "TARGETED_RESULT_CLI_PHASE_INVALID",
    fsImpl
  );
  const requestedOutput = path.resolve(output);
  const outputParent = realDirectory(
    path.dirname(requestedOutput),
    "TARGETED_RESULT_CLI_OUTPUT_PARENT_INVALID",
    fsImpl
  );
  const resolvedOutput = path.join(
    outputParent,
    path.basename(requestedOutput)
  );
  if (
    isWithin(repository, resolvedOutput) ||
    isWithin(baseline, resolvedOutput)
  )
    throw cliError("TARGETED_RESULT_CLI_OUTPUT_SCOPE_INVALID");

  const manifestBytes = requiredFileBytes(
    path.resolve(manifestFile),
    "TARGETED_RESULT_CLI_MANIFEST_INVALID",
    fsImpl
  );
  const manifest = parseJson(
    manifestBytes,
    "TARGETED_RESULT_CLI_MANIFEST_JSON_INVALID"
  );
  const documents = manifest?.documentMatrix?.documents;
  if (!Array.isArray(documents))
    throw cliError("TARGETED_RESULT_CLI_DOCUMENT_MATRIX_INVALID");
  const documentIndex = documents.findIndex(
    (document) => document.uuid === documentUuid
  );
  if (
    documentIndex < 0 ||
    documents.some(
      (document, index) =>
        index !== documentIndex && document.uuid === documentUuid
    )
  )
    throw cliError("TARGETED_RESULT_CLI_DOCUMENT_NOT_UNIQUE", documentUuid);

  const execution = derivedExecution({
    repository,
    model,
    modelTokenLimit,
    fsImpl,
    releaseIdentityFn,
    nodeVersion,
  });
  const sources = fixedSourcePaths(repository);
  const baselineDocumentDirectory = realDirectory(
    path.dirname(
      pairDirectory({
        root: baseline,
        documentIndex,
        documentUuid,
        categoryView,
      })
    ),
    "TARGETED_RESULT_CLI_BASELINE_DOCUMENT_INVALID",
    fsImpl
  );
  if (!isWithin(baseline, baselineDocumentDirectory))
    throw cliError("TARGETED_RESULT_CLI_BASELINE_DOCUMENT_INVALID");
  const phasePair = realDirectory(
    pairDirectory({
      root: phase,
      documentIndex,
      documentUuid,
      categoryView,
    }),
    "TARGETED_RESULT_CLI_PHASE_PAIR_INVALID",
    fsImpl
  );
  if (!isWithin(phase, phasePair))
    throw cliError("TARGETED_RESULT_CLI_PHASE_PAIR_INVALID");
  const pairResultOutput = path.join(phasePair, "result");
  if (
    isWithin(phase, resolvedOutput) &&
    path.resolve(resolvedOutput) !== path.resolve(pairResultOutput)
  )
    throw cliError("TARGETED_RESULT_CLI_OUTPUT_SCOPE_INVALID");

  const result = materializeResultFn({
    manifest,
    expectedManifestDigestSha256,
    expectedExecution: execution,
    categoryView,
    documentUuid,
    catalogBytes: requiredFileBytes(
      sources.catalogs[categoryView],
      "TARGETED_RESULT_CLI_CATALOG_INVALID",
      fsImpl,
      repository
    ),
    categoryPromptBytes: requiredFileBytes(
      sources.prompts[categoryView].category,
      "TARGETED_RESULT_CLI_CATEGORY_PROMPT_INVALID",
      fsImpl,
      repository
    ),
    triagePromptBytes: requiredFileBytes(
      sources.prompts[categoryView].triage,
      "TARGETED_RESULT_CLI_TRIAGE_PROMPT_INVALID",
      fsImpl,
      repository
    ),
    effectsPromptBytes: requiredFileBytes(
      sources.prompts[categoryView].effects,
      "TARGETED_RESULT_CLI_EFFECTS_PROMPT_INVALID",
      fsImpl,
      repository
    ),
    documentArtifactBytes: requiredFileBytes(
      path.join(baselineDocumentDirectory, "document.private.json"),
      "TARGETED_RESULT_CLI_DOCUMENT_ARTIFACT_INVALID",
      fsImpl,
      baselineDocumentDirectory
    ),
    worksheetBytes: requiredFileBytes(
      path.join(phasePair, "worksheet.private.json"),
      "TARGETED_RESULT_CLI_WORKSHEET_INVALID",
      fsImpl,
      phasePair
    ),
    triageReportBytes: requiredFileBytes(
      path.join(phasePair, "triage", "report.json"),
      "TARGETED_RESULT_CLI_TRIAGE_REPORT_INVALID",
      fsImpl,
      phasePair
    ),
    materializedTriageBytes: requiredFileBytes(
      path.join(phasePair, "triage", "materialized-triage.private.json"),
      "TARGETED_RESULT_CLI_TRIAGE_INVALID",
      fsImpl,
      phasePair
    ),
    effectsReportBytes: requiredFileBytes(
      path.join(phasePair, "effects", "report.json"),
      "TARGETED_RESULT_CLI_EFFECTS_REPORT_INVALID",
      fsImpl,
      phasePair
    ),
    materializedEvidenceBytes: requiredFileBytes(
      path.join(phasePair, "effects", "materialized.private.json"),
      "TARGETED_RESULT_CLI_EFFECTS_INVALID",
      fsImpl,
      phasePair
    ),
    selectedSourcesBytes: requiredFileBytes(
      path.join(phasePair, "effects", "selected-sources.private.json"),
      "TARGETED_RESULT_CLI_SOURCES_INVALID",
      fsImpl,
      phasePair
    ),
  });
  const expectedFiles = new Map([
    [OUTPUT_FILES.rows, privateJson(result.rows)],
    [OUTPUT_FILES.requestedFields, privateJson(result.requestedFields)],
    [OUTPUT_FILES.answer, Buffer.from(result.answer, "utf8")],
    [OUTPUT_FILES.report, privateJson(result.report)],
  ]);
  if (fsImpl.existsSync(resolvedOutput)) {
    assertExactResume(resolvedOutput, expectedFiles, fsImpl);
    return { output: resolvedOutput, report: result.report, reused: true };
  }

  const staging = path.join(
    outputParent,
    `.${path.basename(resolvedOutput)}.staging-${process.pid}-${crypto
      .randomBytes(12)
      .toString("hex")}`
  );
  fsImpl.mkdirSync(staging, { recursive: false, mode: 0o700 });
  fsImpl.chmodSync(staging, 0o700);
  for (const [name, bytes] of expectedFiles)
    writeAtomicPrivate(path.join(staging, name), bytes, fsImpl);
  const stagingDescriptor = fsImpl.openSync(staging, "r");
  try {
    fsImpl.fsyncSync(stagingDescriptor);
  } finally {
    fsImpl.closeSync(stagingDescriptor);
  }
  const publishClaim = `${resolvedOutput}.publish-claim`;
  let claimDescriptor = null;
  try {
    claimDescriptor = fsImpl.openSync(publishClaim, "wx", 0o600);
    fsImpl.fsyncSync(claimDescriptor);
    if (fsImpl.existsSync(resolvedOutput))
      throw cliError("TARGETED_RESULT_CLI_OUTPUT_ALREADY_EXISTS");
    fsImpl.renameSync(staging, resolvedOutput);
    const parentDescriptor = fsImpl.openSync(outputParent, "r");
    try {
      fsImpl.fsyncSync(parentDescriptor);
    } finally {
      fsImpl.closeSync(parentDescriptor);
    }
  } finally {
    if (claimDescriptor !== null) {
      fsImpl.closeSync(claimDescriptor);
      if (fsImpl.existsSync(publishClaim)) fsImpl.unlinkSync(publishClaim);
    }
  }
  return { output: resolvedOutput, report: result.report, reused: false };
}

function main(argv = process.argv.slice(2)) {
  return run(parseArguments(argv));
}

if (require.main === module) {
  try {
    const result = main();
    console.log(
      `[targeted-qa-category] ${
        result.reused ? "Unverändert wiederverwendet" : "Neu angelegt"
      }: ${result.report.categoryView}/${result.report.document.uuid} in ${
        result.output
      }`
    );
  } catch (error) {
    console.error(`[targeted-qa-category] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  OUTPUT_FILES,
  main,
  parseArguments,
  run,
};
