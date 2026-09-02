#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  CATEGORY_ORDER,
  fixedSourcePaths,
  resolveDocumentArtifactBytes,
} = require("./ensureTargetedQaManifest.cjs");
const {
  releaseIdentity,
  sha256,
} = require("../../utils/policyAnalysis/runIdentity");
const {
  assertTargetedQaManifest,
} = require("../../utils/policyAnalysis/targetedQaManifestContract");
const {
  buildTargetedWorksheet,
} = require("../../utils/policyAnalysis/targetedWorksheetBuildContract");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const SUMMARY_FILENAME = "summary.private.json";
const EXPECTED_PAIR_COUNT = 50;

function cliError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function parseArguments(argv) {
  if (argv.length % 2 !== 0)
    throw cliError("TARGETED_WORKSHEET_ARGUMENT_INVALID");
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw cliError("TARGETED_WORKSHEET_ARGUMENT_INVALID", key);
    const name = key.slice(2);
    if (Object.hasOwn(values, name))
      throw cliError("TARGETED_WORKSHEET_ARGUMENT_DUPLICATE", name);
    values[name] = value;
  }
  const expected = [
    "baselineRoot",
    "manifest",
    "expectedManifestDigestSha256",
    "output",
    "model",
    "modelTokenLimit",
  ];
  const unknown = Object.keys(values).filter((key) => !expected.includes(key));
  if (unknown.length)
    throw cliError("TARGETED_WORKSHEET_ARGUMENT_UNKNOWN", unknown.join(","));
  for (const required of expected)
    if (!values[required])
      throw cliError("TARGETED_WORKSHEET_ARGUMENT_REQUIRED", required);
  if (
    !path.isAbsolute(values.baselineRoot) ||
    !path.isAbsolute(values.manifest) ||
    !path.isAbsolute(values.output)
  )
    throw cliError("TARGETED_WORKSHEET_ABSOLUTE_PATH_REQUIRED");
  if (!/^[a-f0-9]{64}$/u.test(values.expectedManifestDigestSha256))
    throw cliError("TARGETED_WORKSHEET_MANIFEST_DIGEST_INVALID");
  const modelTokenLimit = Number(values.modelTokenLimit);
  if (!Number.isInteger(modelTokenLimit) || modelTokenLimit < 1)
    throw cliError("TARGETED_WORKSHEET_MODEL_TOKEN_LIMIT_INVALID");
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

function requiredFileBytes(file, code, fsImpl) {
  if (
    !fsImpl.existsSync(file) ||
    fsImpl.lstatSync(file).isSymbolicLink() ||
    !fsImpl.statSync(file).isFile()
  )
    throw cliError(code, file);
  return fsImpl.readFileSync(file);
}

function parseJsonBytes(bytes, code) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw cliError(code);
  }
}

function derivedExecution({
  repository,
  model,
  modelTokenLimit,
  fsImpl,
  releaseIdentityFn,
  nodeVersion,
}) {
  const sources = fixedSourcePaths(repository);
  const promptSha256ByCategory = Object.fromEntries(
    CATEGORY_ORDER.map((categoryView) => [
      categoryView,
      Object.fromEntries(
        ["category", "triage", "effects", "hybridAddon"].map((promptRole) => [
          promptRole,
          sha256(
            requiredFileBytes(
              sources.prompts[categoryView][promptRole],
              "TARGETED_WORKSHEET_PROMPT_MISSING",
              fsImpl
            )
          ),
        ])
      ),
    ])
  );
  return {
    releaseId: releaseIdentityFn(repository),
    model,
    modelTokenLimit,
    nodeVersion,
    promptSha256ByCategory,
    hybridShadowEnabled: false,
  };
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

function fsyncDirectoryTree(directory, fsImpl) {
  for (const name of fsImpl.readdirSync(directory)) {
    const entry = path.join(directory, name);
    if (fsImpl.lstatSync(entry).isDirectory())
      fsyncDirectoryTree(entry, fsImpl);
  }
  const descriptor = fsImpl.openSync(directory, "r");
  try {
    fsImpl.fsyncSync(descriptor);
  } finally {
    fsImpl.closeSync(descriptor);
  }
}

function privateJson(value) {
  return Buffer.from(JSON.stringify(value, null, 2), "utf8");
}

function allFiles(directory, fsImpl, prefix = "") {
  const files = [];
  for (const name of fsImpl.readdirSync(directory).sort()) {
    const absolute = path.join(directory, name);
    const relative = prefix ? path.join(prefix, name) : name;
    const stat = fsImpl.lstatSync(absolute);
    if (stat.isSymbolicLink())
      throw cliError("TARGETED_WORKSHEET_OUTPUT_SYMLINK_FORBIDDEN", relative);
    if (stat.isDirectory()) files.push(...allFiles(absolute, fsImpl, relative));
    else if (stat.isFile()) files.push(relative);
    else throw cliError("TARGETED_WORKSHEET_OUTPUT_ENTRY_INVALID", relative);
  }
  return files;
}

function assertExactExistingOutput(output, filesByRelativePath, fsImpl) {
  if (
    fsImpl.lstatSync(output).isSymbolicLink() ||
    !fsImpl.statSync(output).isDirectory() ||
    (fsImpl.statSync(output).mode & 0o777) !== 0o700
  )
    throw cliError("TARGETED_WORKSHEET_EXISTING_OUTPUT_INVALID");
  const expected = [...filesByRelativePath.keys()].sort();
  const observed = allFiles(output, fsImpl).sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected))
    throw cliError("TARGETED_WORKSHEET_EXISTING_OUTPUT_MISMATCH");
  for (const relative of expected) {
    const file = path.join(output, relative);
    if (
      (fsImpl.statSync(file).mode & 0o777) !== 0o600 ||
      !fsImpl.readFileSync(file).equals(filesByRelativePath.get(relative))
    )
      throw cliError("TARGETED_WORKSHEET_EXISTING_OUTPUT_MISMATCH", relative);
  }
}

function run(
  {
    baselineRoot,
    manifest: manifestFile,
    expectedManifestDigestSha256,
    output,
    model,
    modelTokenLimit,
  },
  {
    fsImpl = fs,
    repositoryRoot = REPOSITORY_ROOT,
    releaseIdentityFn = releaseIdentity,
    nodeVersion = process.versions.node,
    assertManifestFn = assertTargetedQaManifest,
    buildTargetedWorksheetFn = buildTargetedWorksheet,
  } = {}
) {
  for (const absolute of [baselineRoot, manifestFile, output])
    if (!path.isAbsolute(absolute))
      throw cliError("TARGETED_WORKSHEET_ABSOLUTE_PATH_REQUIRED");
  const repository = realDirectory(
    path.resolve(repositoryRoot),
    "TARGETED_WORKSHEET_REPOSITORY_INVALID",
    fsImpl
  );
  const baseline = realDirectory(
    path.resolve(baselineRoot),
    "TARGETED_WORKSHEET_BASELINE_INVALID",
    fsImpl
  );
  const requestedOutput = path.resolve(output);
  const outputParent = realDirectory(
    path.dirname(requestedOutput),
    "TARGETED_WORKSHEET_OUTPUT_PARENT_INVALID",
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
    throw cliError("TARGETED_WORKSHEET_OUTPUT_SCOPE_INVALID");

  const manifestBytes = requiredFileBytes(
    path.resolve(manifestFile),
    "TARGETED_WORKSHEET_MANIFEST_INVALID",
    fsImpl
  );
  const manifest = parseJsonBytes(
    manifestBytes,
    "TARGETED_WORKSHEET_MANIFEST_JSON_INVALID"
  );
  const execution = derivedExecution({
    repository,
    model,
    modelTokenLimit,
    fsImpl,
    releaseIdentityFn,
    nodeVersion,
  });
  assertManifestFn(manifest, {
    expectedManifestDigestSha256,
    expectedExecution: execution,
  });

  const packageFile = path.join(
    baseline,
    "PACKAGE-COMPARISON",
    "package-contract.private.json"
  );
  const packageContractBytes = requiredFileBytes(
    packageFile,
    "TARGETED_WORKSHEET_PACKAGE_INVALID",
    fsImpl
  );
  if (
    sha256(packageContractBytes) !==
    manifest.trustAnchor.packageContractFileSha256
  )
    throw cliError("TARGETED_WORKSHEET_PACKAGE_SHA_MISMATCH");
  const documentArtifactBytesByUuid = resolveDocumentArtifactBytes({
    baseline,
    packageContractBytes,
    fsImpl,
  });
  const sources = fixedSourcePaths(repository);
  const catalogBytesByCategory = Object.fromEntries(
    CATEGORY_ORDER.map((categoryView) => [
      categoryView,
      requiredFileBytes(
        sources.catalogs[categoryView],
        "TARGETED_WORKSHEET_CATALOG_MISSING",
        fsImpl
      ),
    ])
  );

  const pairOutputs = [];
  for (const [
    documentIndex,
    document,
  ] of manifest.documentMatrix.documents.entries()) {
    const documentDirectory = path.join(
      baseline,
      `DOC-${String(documentIndex + 1).padStart(2, "0")}-${document.uuid}`
    );
    for (const categoryView of CATEGORY_ORDER) {
      const categoryDirectory = realDirectory(
        path.join(documentDirectory, categoryView),
        "TARGETED_WORKSHEET_BASELINE_CATEGORY_INVALID",
        fsImpl
      );
      if (!isWithin(documentDirectory, categoryDirectory))
        throw cliError("TARGETED_WORKSHEET_BASELINE_CATEGORY_SCOPE_INVALID");
      const fullWorksheetBytes = requiredFileBytes(
        path.join(categoryDirectory, "worksheet.private.json"),
        "TARGETED_WORKSHEET_FULL_WORKSHEET_INVALID",
        fsImpl
      );
      const result = buildTargetedWorksheetFn({
        manifest,
        expectedManifestDigestSha256,
        expectedExecution: execution,
        categoryView,
        documentUuid: document.uuid,
        catalogBytes: catalogBytesByCategory[categoryView],
        documentArtifactBytes: documentArtifactBytesByUuid[document.uuid],
        fullWorksheetBytes,
      });
      const relativeDirectory = path.join(
        `DOC-${String(documentIndex + 1).padStart(2, "0")}-${document.uuid}`,
        categoryView
      );
      const worksheetBytes = privateJson(result.worksheet);
      const provenanceBytes = privateJson(result.provenance);
      pairOutputs.push({
        documentUuid: document.uuid,
        side: document.side,
        position: document.position,
        categoryView,
        relativeDirectory,
        worksheetBytes,
        provenanceBytes,
      });
    }
  }
  if (pairOutputs.length !== EXPECTED_PAIR_COUNT)
    throw cliError("TARGETED_WORKSHEET_PAIR_COUNT_INVALID");

  const filesByRelativePath = new Map();
  for (const pair of pairOutputs) {
    filesByRelativePath.set(
      path.join(pair.relativeDirectory, "worksheet.private.json"),
      pair.worksheetBytes
    );
    filesByRelativePath.set(
      path.join(pair.relativeDirectory, "provenance.private.json"),
      pair.provenanceBytes
    );
  }
  const summary = {
    schemaVersion: 1,
    contractId: "TARGETED_QA_WORKSHEET_PREPARATION_V1",
    runKind: "TARGETED_QA_ONLY",
    manifestDigestSha256: manifest.manifestDigestSha256,
    manifestFileSha256: sha256(manifestBytes),
    execution,
    documentCount: manifest.documentMatrix.documents.length,
    categoryCount: CATEGORY_ORDER.length,
    pairCount: pairOutputs.length,
    pairs: pairOutputs.map((pair) => ({
      documentUuid: pair.documentUuid,
      side: pair.side,
      position: pair.position,
      categoryView: pair.categoryView,
      worksheetSha256: sha256(pair.worksheetBytes),
      provenanceSha256: sha256(pair.provenanceBytes),
    })),
  };
  filesByRelativePath.set(SUMMARY_FILENAME, privateJson(summary));

  if (fsImpl.existsSync(resolvedOutput)) {
    assertExactExistingOutput(resolvedOutput, filesByRelativePath, fsImpl);
    return { output: resolvedOutput, summary, reused: true };
  }
  const staging = path.join(
    outputParent,
    `.${path.basename(resolvedOutput)}.staging-${process.pid}-${crypto
      .randomBytes(12)
      .toString("hex")}`
  );
  fsImpl.mkdirSync(staging, { recursive: false, mode: 0o700 });
  fsImpl.chmodSync(staging, 0o700);
  for (const [relative, bytes] of filesByRelativePath) {
    const file = path.join(staging, relative);
    fsImpl.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fsImpl.chmodSync(path.dirname(file), 0o700);
    writeAtomicPrivate(file, bytes, fsImpl);
  }
  fsyncDirectoryTree(staging, fsImpl);
  const publishClaim = `${resolvedOutput}.publish-claim`;
  let claimDescriptor = null;
  try {
    claimDescriptor = fsImpl.openSync(publishClaim, "wx", 0o600);
    fsImpl.fsyncSync(claimDescriptor);
    if (fsImpl.existsSync(resolvedOutput))
      throw cliError("TARGETED_WORKSHEET_OUTPUT_ALREADY_EXISTS");
    fsImpl.renameSync(staging, resolvedOutput);
    const parentDescriptor = fsImpl.openSync(outputParent, "r");
    try {
      fsImpl.fsyncSync(parentDescriptor);
    } finally {
      fsImpl.closeSync(parentDescriptor);
    }
  } finally {
    if (claimDescriptor !== null) fsImpl.closeSync(claimDescriptor);
    if (fsImpl.existsSync(publishClaim)) fsImpl.unlinkSync(publishClaim);
  }
  return { output: resolvedOutput, summary, reused: false };
}

function main(argv = process.argv.slice(2)) {
  return run(parseArguments(argv));
}

if (require.main === module) {
  try {
    const result = main();
    console.log(
      `[targeted-qa-worksheets] ${
        result.reused ? "Unverändert wiederverwendet" : "Neu angelegt"
      }: ${result.summary.pairCount} Paare in ${result.output}`
    );
  } catch (error) {
    console.error(`[targeted-qa-worksheets] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  EXPECTED_PAIR_COUNT,
  SUMMARY_FILENAME,
  derivedExecution,
  main,
  parseArguments,
  run,
};
