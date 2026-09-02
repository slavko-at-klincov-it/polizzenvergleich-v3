#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  releaseIdentity,
  sha256,
} = require("../../utils/policyAnalysis/runIdentity");
const {
  assertTargetedQaManifest,
  buildTargetedQaManifest,
} = require("../../utils/policyAnalysis/targetedQaManifestContract");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const EXPECTED_QA_REGISTRY_SHA256 =
  "1499605578113e9d287ea83861dc567694046c7482ce380fe23d92ee075bad1e";
const CATEGORY_ORDER = Object.freeze(["VS", "FE", "LW", "ST", "EL"]);
const CATALOG_FILES = Object.freeze({
  VS: "server/resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json",
  FE: "server/resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json",
  LW: "server/resources/policyAnalysis/lw-occurrence-full-draft.v0.1.json",
  ST: "server/resources/policyAnalysis/st-occurrence-full-draft.v0.1.json",
  EL: "server/resources/policyAnalysis/el-occurrence-full-draft.v0.1.json",
});
const CATEGORY_PROMPT_FILES = Object.freeze({
  VS: "server/resources/workspaceTemplates/VS_versicherungssumme_und_versicherte_sachen.md",
  FE: "server/resources/workspaceTemplates/FE_feuer.md",
  LW: "server/resources/workspaceTemplates/LW_leitungswasser.md",
  ST: "server/resources/workspaceTemplates/ST_sturm.md",
  EL: "server/resources/workspaceTemplates/EL_elementar_und_zusatzdeckungen.md",
});
const GENERIC_TRIAGE_PROMPT =
  "server/resources/policyAnalysis/candidate-triage-system.v0.1.md";
const VS_TRIAGE_PROMPT =
  "server/resources/policyAnalysis/vs-candidate-triage-system.v0.1.md";
const GENERIC_EFFECTS_PROMPT =
  "server/resources/policyAnalysis/prepared-evidence-system.v0.1.md";
const VS_EFFECTS_PROMPT =
  "server/resources/policyAnalysis/vs-prepared-evidence-system.v0.1.md";
const HYBRID_ADDON_PROMPT =
  "server/resources/policyAnalysis/hybrid-candidate-triage-addon.v0.1.md";
const REGISTRY_FILE =
  "server/resources/policyAnalysis/pav8-review-69-targets.qa-only.v0.1.json";
const MANIFEST_FILENAME = "targeted-qa-manifest.private.json";

function cliError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function parseArguments(argv) {
  if (argv.length % 2 !== 0) throw cliError("TARGETED_QA_ARGUMENT_INVALID");
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw cliError("TARGETED_QA_ARGUMENT_INVALID", key);
    const name = key.slice(2);
    if (Object.hasOwn(values, name))
      throw cliError("TARGETED_QA_ARGUMENT_DUPLICATE", name);
    values[name] = value;
  }
  const expected = ["baselineRoot", "output", "model", "modelTokenLimit"];
  const unknown = Object.keys(values).filter((key) => !expected.includes(key));
  if (unknown.length)
    throw cliError("TARGETED_QA_ARGUMENT_UNKNOWN", unknown.join(","));
  for (const required of expected)
    if (!values[required])
      throw cliError("TARGETED_QA_ARGUMENT_REQUIRED", required);
  const modelTokenLimit = Number(values.modelTokenLimit);
  if (!Number.isInteger(modelTokenLimit) || modelTokenLimit < 1)
    throw cliError("TARGETED_QA_MODEL_TOKEN_LIMIT_INVALID");
  if (!path.isAbsolute(values.baselineRoot) || !path.isAbsolute(values.output))
    throw cliError("TARGETED_QA_ABSOLUTE_PATH_REQUIRED");
  return { ...values, modelTokenLimit };
}

function isWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== "..")
  );
}

function fixedSourcePaths(repositoryRoot) {
  return {
    registry: path.join(repositoryRoot, REGISTRY_FILE),
    catalogs: Object.fromEntries(
      CATEGORY_ORDER.map((categoryView) => [
        categoryView,
        path.join(repositoryRoot, CATALOG_FILES[categoryView]),
      ])
    ),
    prompts: Object.fromEntries(
      CATEGORY_ORDER.map((categoryView) => [
        categoryView,
        {
          category: path.join(
            repositoryRoot,
            CATEGORY_PROMPT_FILES[categoryView]
          ),
          triage: path.join(
            repositoryRoot,
            categoryView === "VS" ? VS_TRIAGE_PROMPT : GENERIC_TRIAGE_PROMPT
          ),
          effects: path.join(
            repositoryRoot,
            categoryView === "VS" ? VS_EFFECTS_PROMPT : GENERIC_EFFECTS_PROMPT
          ),
          hybridAddon: path.join(repositoryRoot, HYBRID_ADDON_PROMPT),
        },
      ])
    ),
  };
}

function requiredFileBytes(file, fsImpl) {
  if (!fsImpl.existsSync(file) || !fsImpl.statSync(file).isFile())
    throw cliError("TARGETED_QA_SOURCE_FILE_MISSING", file);
  return fsImpl.readFileSync(file);
}

function resolveDocumentArtifactBytes({
  baseline,
  packageContractBytes,
  fsImpl,
}) {
  let packageContract;
  try {
    packageContract = JSON.parse(packageContractBytes.toString("utf8"));
  } catch {
    throw cliError("TARGETED_QA_PACKAGE_JSON_INVALID");
  }
  if (
    !Array.isArray(packageContract?.documents) ||
    packageContract.documents.length !== 10
  )
    throw cliError("TARGETED_QA_DOCUMENT_DIRECTORY_MATRIX_INVALID");
  const uuids = packageContract.documents.map(({ uuid }) => String(uuid || ""));
  if (
    new Set(uuids).size !== uuids.length ||
    uuids.some((uuid) => !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(uuid))
  )
    throw cliError("TARGETED_QA_DOCUMENT_DIRECTORY_UUID_INVALID");
  const expectedDirectoryNames = uuids.map(
    (uuid, index) => `DOC-${String(index + 1).padStart(2, "0")}-${uuid}`
  );
  const observedDirectoryNames = fsImpl
    .readdirSync(baseline)
    .filter((entry) => /^DOC-/u.test(entry));
  if (
    observedDirectoryNames.length !== expectedDirectoryNames.length ||
    [...observedDirectoryNames]
      .sort()
      .some(
        (entry, index) => entry !== [...expectedDirectoryNames].sort()[index]
      )
  )
    throw cliError("TARGETED_QA_DOCUMENT_DIRECTORY_MATRIX_INVALID");

  return Object.fromEntries(
    expectedDirectoryNames.map((directoryName, index) => {
      const uuid = uuids[index];
      const directory = path.join(baseline, directoryName);
      if (
        fsImpl.lstatSync(directory).isSymbolicLink() ||
        !fsImpl.statSync(directory).isDirectory()
      )
        throw cliError("TARGETED_QA_DOCUMENT_DIRECTORY_INVALID", directoryName);
      const realDocumentDirectory = fsImpl.realpathSync(directory);
      if (!isWithin(baseline, realDocumentDirectory))
        throw cliError(
          "TARGETED_QA_DOCUMENT_DIRECTORY_SCOPE_INVALID",
          directoryName
        );
      const artifactFile = path.join(
        realDocumentDirectory,
        "document.private.json"
      );
      if (
        !fsImpl.existsSync(artifactFile) ||
        fsImpl.lstatSync(artifactFile).isSymbolicLink() ||
        !fsImpl.statSync(artifactFile).isFile()
      )
        throw cliError("TARGETED_QA_DOCUMENT_ARTIFACT_INVALID", directoryName);
      const realArtifactFile = fsImpl.realpathSync(artifactFile);
      if (!isWithin(realDocumentDirectory, realArtifactFile))
        throw cliError(
          "TARGETED_QA_DOCUMENT_ARTIFACT_SCOPE_INVALID",
          directoryName
        );
      return [uuid, fsImpl.readFileSync(realArtifactFile)];
    })
  );
}

function realDirectory(
  directory,
  code,
  fsImpl,
  { allowSymbolicLink = false } = {}
) {
  if (
    !fsImpl.existsSync(directory) ||
    (!allowSymbolicLink && fsImpl.lstatSync(directory).isSymbolicLink()) ||
    !fsImpl.statSync(directory).isDirectory()
  )
    throw cliError(code, directory);
  return fsImpl.realpathSync(directory);
}

function writeAtomicPrivate(file, value, fsImpl) {
  const nonce = crypto.randomBytes(12).toString("hex");
  const temporary = `${file}.tmp-${process.pid}-${nonce}`;
  let descriptor = null;
  let temporaryExists = false;
  try {
    descriptor = fsImpl.openSync(temporary, "wx", 0o600);
    temporaryExists = true;
    fsImpl.writeFileSync(descriptor, JSON.stringify(value, null, 2), "utf8");
    fsImpl.fsyncSync(descriptor);
    fsImpl.closeSync(descriptor);
    descriptor = null;
    fsImpl.linkSync(temporary, file);
    fsImpl.chmodSync(file, 0o600);
    fsImpl.unlinkSync(temporary);
    temporaryExists = false;
    const directoryDescriptor = fsImpl.openSync(path.dirname(file), "r");
    try {
      fsImpl.fsyncSync(directoryDescriptor);
    } finally {
      fsImpl.closeSync(directoryDescriptor);
    }
  } finally {
    if (descriptor !== null) fsImpl.closeSync(descriptor);
    if (temporaryExists && fsImpl.existsSync(temporary))
      fsImpl.unlinkSync(temporary);
  }
}

function run(
  { baselineRoot, output, model, modelTokenLimit },
  {
    fsImpl = fs,
    repositoryRoot = REPOSITORY_ROOT,
    releaseIdentityFn = releaseIdentity,
    buildManifestFn = buildTargetedQaManifest,
    assertManifestFn = assertTargetedQaManifest,
    nodeVersion = process.versions.node,
  } = {}
) {
  if (!path.isAbsolute(baselineRoot) || !path.isAbsolute(output))
    throw cliError("TARGETED_QA_ABSOLUTE_PATH_REQUIRED");
  const repository = realDirectory(
    path.resolve(repositoryRoot),
    "TARGETED_QA_REPOSITORY_INVALID",
    fsImpl
  );
  const baseline = realDirectory(
    path.resolve(baselineRoot),
    "TARGETED_QA_BASELINE_INVALID",
    fsImpl
  );
  const requestedOutput = path.resolve(output);
  const outputExists = fsImpl.existsSync(requestedOutput);
  if (outputExists && fsImpl.lstatSync(requestedOutput).isSymbolicLink())
    throw cliError("TARGETED_QA_OUTPUT_SYMLINK_FORBIDDEN");
  const outputParent = realDirectory(
    path.dirname(requestedOutput),
    "TARGETED_QA_OUTPUT_PARENT_MISSING",
    fsImpl,
    { allowSymbolicLink: true }
  );
  const outputDirectory = outputExists
    ? fsImpl.realpathSync(requestedOutput)
    : path.join(outputParent, path.basename(requestedOutput));
  if (
    isWithin(repository, outputDirectory) ||
    isWithin(baseline, outputDirectory)
  )
    throw cliError("TARGETED_QA_OUTPUT_SCOPE_INVALID");
  const packageDirectory = path.join(baseline, "PACKAGE-COMPARISON");
  const packageContractFile = path.join(
    packageDirectory,
    "package-contract.private.json"
  );
  const comparisonFile = path.join(packageDirectory, "comparison.private.json");
  const manifestFile = path.join(outputDirectory, MANIFEST_FILENAME);
  if (fsImpl.existsSync(outputDirectory)) {
    if (!fsImpl.statSync(outputDirectory).isDirectory())
      throw cliError("TARGETED_QA_OUTPUT_INVALID");
    const entries = fsImpl.readdirSync(outputDirectory);
    if (entries.length !== 1 || entries[0] !== MANIFEST_FILENAME)
      throw cliError("TARGETED_QA_OUTPUT_WITHOUT_MANIFEST");
  }

  const sources = fixedSourcePaths(repository);
  const qaRegistryBytes = requiredFileBytes(sources.registry, fsImpl);
  if (sha256(qaRegistryBytes) !== EXPECTED_QA_REGISTRY_SHA256)
    throw cliError("TARGETED_QA_REGISTRY_SHA_MISMATCH");
  let qaRegistry;
  try {
    qaRegistry = JSON.parse(qaRegistryBytes.toString("utf8"));
  } catch {
    throw cliError("TARGETED_QA_REGISTRY_JSON_INVALID");
  }
  if (path.basename(baseline) !== qaRegistry?.baseline?.runId)
    throw cliError("TARGETED_QA_BASELINE_RUN_ID_MISMATCH");
  const catalogBytesByCategory = Object.fromEntries(
    CATEGORY_ORDER.map((categoryView) => [
      categoryView,
      requiredFileBytes(sources.catalogs[categoryView], fsImpl),
    ])
  );
  const promptSha256ByCategory = Object.fromEntries(
    CATEGORY_ORDER.map((categoryView) => [
      categoryView,
      Object.fromEntries(
        ["category", "triage", "effects", "hybridAddon"].map((promptRole) => [
          promptRole,
          sha256(
            requiredFileBytes(sources.prompts[categoryView][promptRole], fsImpl)
          ),
        ])
      ),
    ])
  );
  const execution = {
    releaseId: releaseIdentityFn(repository),
    model,
    modelTokenLimit,
    nodeVersion,
    promptSha256ByCategory,
    hybridShadowEnabled: false,
  };
  const packageContractBytes = requiredFileBytes(packageContractFile, fsImpl);
  const manifest = buildManifestFn({
    qaRegistryBytes,
    packageContractBytes,
    baselineComparisonBytes: requiredFileBytes(comparisonFile, fsImpl),
    catalogBytesByCategory,
    documentArtifactBytesByUuid: resolveDocumentArtifactBytes({
      baseline,
      packageContractBytes,
      fsImpl,
    }),
    execution,
  });
  assertManifestFn(manifest, {
    expectedManifestDigestSha256: manifest.manifestDigestSha256,
    expectedExecution: execution,
  });

  if (fsImpl.existsSync(manifestFile)) {
    if (
      fsImpl.lstatSync(manifestFile).isSymbolicLink() ||
      !fsImpl.statSync(manifestFile).isFile()
    )
      throw cliError("TARGETED_QA_EXISTING_MANIFEST_INVALID");
    let existing;
    try {
      existing = JSON.parse(fsImpl.readFileSync(manifestFile, "utf8"));
    } catch {
      throw cliError("TARGETED_QA_EXISTING_MANIFEST_INVALID");
    }
    assertManifestFn(existing, {
      expectedManifestDigestSha256: manifest.manifestDigestSha256,
      expectedExecution: execution,
    });
    if (JSON.stringify(existing) !== JSON.stringify(manifest))
      throw cliError("TARGETED_QA_EXISTING_MANIFEST_MISMATCH");
    return { manifest, manifestFile, reused: true };
  }
  fsImpl.mkdirSync(outputDirectory, { recursive: false, mode: 0o700 });
  fsImpl.chmodSync(outputDirectory, 0o700);
  writeAtomicPrivate(manifestFile, manifest, fsImpl);
  return { manifest, manifestFile, reused: false };
}

function main(argv = process.argv.slice(2)) {
  return run(parseArguments(argv));
}

if (require.main === module) {
  try {
    const result = main();
    console.log(
      `[targeted-qa-manifest] ${
        result.reused ? "Unverändert wiederverwendet" : "Neu angelegt"
      }: ${result.manifestFile}`
    );
  } catch (error) {
    console.error(`[targeted-qa-manifest] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  CATEGORY_ORDER,
  EXPECTED_QA_REGISTRY_SHA256,
  MANIFEST_FILENAME,
  fixedSourcePaths,
  main,
  parseArguments,
  resolveDocumentArtifactBytes,
  run,
};
