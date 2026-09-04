const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const POLICY_COMPARISON_ARTIFACT_SET_CONTRACT_ID =
  "POLICY_COMPARISON_ARTIFACT_SET_V1";
const POLICY_COMPARISON_ARTIFACT_SET_SCHEMA_VERSION = 1;
const POLICY_COMPARISON_PUBLISH_CLAIM_CONTRACT_ID =
  "POLICY_COMPARISON_PUBLISH_CLAIM_V1";
const POLICY_COMPARISON_ARTIFACT_SET_MANIFEST =
  "artifact-set-manifest.private.json";
const POLICY_COMPARISON_ARTIFACT_FILES = Object.freeze([
  "comparison.private.json",
  "comparison.md",
  "polizzenvergleich.xlsx",
]);

function artifactSetError(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertOutputTarget(outputDirectory, fsImpl) {
  if (!path.isAbsolute(outputDirectory))
    throw artifactSetError("COMPARISON_ARTIFACT_SET_OUTPUT_MUST_BE_ABSOLUTE");

  const resolvedOutput = path.resolve(outputDirectory);
  if (fsImpl.existsSync(resolvedOutput))
    throw artifactSetError("COMPARISON_ARTIFACT_SET_OUTPUT_ALREADY_EXISTS");

  const parent = path.dirname(resolvedOutput);
  if (
    !fsImpl.existsSync(parent) ||
    fsImpl.lstatSync(parent).isSymbolicLink() ||
    !fsImpl.statSync(parent).isDirectory()
  )
    throw artifactSetError("COMPARISON_ARTIFACT_SET_PARENT_INVALID");

  return { parent, resolvedOutput };
}

function assertCompleteArtifactSet(directory, fsImpl) {
  const entries = fsImpl.readdirSync(directory).sort();
  const expected = [...POLICY_COMPARISON_ARTIFACT_FILES].sort();
  if (
    entries.length !== expected.length ||
    entries.some((entry, index) => entry !== expected[index])
  )
    throw artifactSetError("COMPARISON_ARTIFACT_SET_FILES_INVALID");

  return Object.fromEntries(
    POLICY_COMPARISON_ARTIFACT_FILES.map((filename) => {
      const file = path.join(directory, filename);
      const stat = fsImpl.lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile())
        throw artifactSetError(
          "COMPARISON_ARTIFACT_SET_FILE_INVALID",
          filename
        );
      return [filename, file];
    })
  );
}

function buildArtifactSetManifest(files, fsImpl) {
  const artifacts = POLICY_COMPARISON_ARTIFACT_FILES.map((filename) => {
    const bytes = fsImpl.readFileSync(files[filename]);
    return {
      filename,
      bytes: bytes.length,
      sha256: sha256(bytes),
    };
  });
  const digestBasis = {
    schemaVersion: POLICY_COMPARISON_ARTIFACT_SET_SCHEMA_VERSION,
    contractId: POLICY_COMPARISON_ARTIFACT_SET_CONTRACT_ID,
    artifacts,
  };
  return {
    ...digestBasis,
    manifestDigestSha256: sha256(
      Buffer.from(JSON.stringify(digestBasis), "utf8")
    ),
  };
}

function writeManifest(file, manifest, fsImpl) {
  const descriptor = fsImpl.openSync(file, "wx", 0o600);
  try {
    fsImpl.writeFileSync(descriptor, JSON.stringify(manifest, null, 2), "utf8");
    fsImpl.fsyncSync(descriptor);
  } finally {
    fsImpl.closeSync(descriptor);
  }
  fsImpl.chmodSync(file, 0o600);
}

function fsyncArtifactSet(directory, files, fsImpl) {
  for (const file of Object.values(files)) {
    fsImpl.chmodSync(file, 0o600);
    const descriptor = fsImpl.openSync(file, "r");
    try {
      fsImpl.fsyncSync(descriptor);
    } finally {
      fsImpl.closeSync(descriptor);
    }
  }
  const descriptor = fsImpl.openSync(directory, "r");
  try {
    fsImpl.fsyncSync(descriptor);
  } finally {
    fsImpl.closeSync(descriptor);
  }
}

function fsyncDirectory(directory, fsImpl) {
  const descriptor = fsImpl.openSync(directory, "r");
  try {
    fsImpl.fsyncSync(descriptor);
  } finally {
    fsImpl.closeSync(descriptor);
  }
}

function processIsAlive(pid, processImpl) {
  try {
    processImpl.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    return true;
  }
}

function acquirePublishClaim({
  claimFile,
  parent,
  nonce,
  resolvedOutput,
  fsImpl,
  processImpl,
}) {
  const owner = JSON.stringify({
    schemaVersion: 1,
    contractId: POLICY_COMPARISON_PUBLISH_CLAIM_CONTRACT_ID,
    pid: processImpl.pid,
    nonce,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const candidate = `${claimFile}.candidate-${processImpl.pid}-${nonce}`;
    let candidateCreated = false;
    try {
      const descriptor = fsImpl.openSync(candidate, "wx", 0o600);
      candidateCreated = true;
      try {
        fsImpl.writeFileSync(descriptor, owner, "utf8");
        fsImpl.fsyncSync(descriptor);
      } finally {
        fsImpl.closeSync(descriptor);
      }
      fsImpl.linkSync(candidate, claimFile);
      fsyncDirectory(parent, fsImpl);
      return owner;
    } catch (error) {
      if (error?.code !== "EEXIST" || attempt > 0) throw error;
      const claimStat = fsImpl.lstatSync(claimFile);
      if (claimStat.isSymbolicLink() || !claimStat.isFile())
        throw artifactSetError("COMPARISON_ARTIFACT_SET_PUBLISH_CLAIM_INVALID");
      const observed = fsImpl.readFileSync(claimFile, "utf8");
      let claim;
      try {
        claim = JSON.parse(observed);
      } catch {
        throw artifactSetError("COMPARISON_ARTIFACT_SET_PUBLISH_CLAIM_INVALID");
      }
      if (
        claim?.schemaVersion !== 1 ||
        claim?.contractId !== POLICY_COMPARISON_PUBLISH_CLAIM_CONTRACT_ID ||
        !Number.isInteger(claim?.pid) ||
        claim.pid < 1 ||
        typeof claim?.nonce !== "string" ||
        claim.nonce.length < 12
      )
        throw artifactSetError("COMPARISON_ARTIFACT_SET_PUBLISH_CLAIM_INVALID");
      if (processIsAlive(claim.pid, processImpl))
        throw artifactSetError("COMPARISON_ARTIFACT_SET_PUBLISH_CLAIM_ACTIVE");
      if (fsImpl.existsSync(resolvedOutput))
        throw artifactSetError("COMPARISON_ARTIFACT_SET_OUTPUT_ALREADY_EXISTS");
      if (fsImpl.readFileSync(claimFile, "utf8") !== observed)
        throw artifactSetError("COMPARISON_ARTIFACT_SET_PUBLISH_CLAIM_CHANGED");
      fsImpl.unlinkSync(claimFile);
      fsyncDirectory(parent, fsImpl);
    } finally {
      if (candidateCreated && fsImpl.existsSync(candidate))
        fsImpl.unlinkSync(candidate);
    }
  }
  throw artifactSetError("COMPARISON_ARTIFACT_SET_PUBLISH_CLAIM_UNAVAILABLE");
}

function finalArtifactFiles(outputDirectory) {
  return Object.fromEntries(
    POLICY_COMPARISON_ARTIFACT_FILES.map((filename) => [
      filename,
      path.join(outputDirectory, filename),
    ])
  );
}

function validatePublishedComparisonArtifactSet(
  outputDirectory,
  { fsImpl = fs } = {}
) {
  const resolvedOutput = path.resolve(String(outputDirectory || ""));
  if (!path.isAbsolute(String(outputDirectory || "")))
    throw artifactSetError("COMPARISON_ARTIFACT_SET_OUTPUT_MUST_BE_ABSOLUTE");
  if (!fsImpl.existsSync(resolvedOutput))
    throw artifactSetError("COMPARISON_ARTIFACT_SET_OUTPUT_MISSING");
  const outputStat = fsImpl.lstatSync(resolvedOutput);
  if (outputStat.isSymbolicLink() || !outputStat.isDirectory())
    throw artifactSetError("COMPARISON_ARTIFACT_SET_OUTPUT_INVALID");

  const allowedEntries = new Set([
    ...POLICY_COMPARISON_ARTIFACT_FILES,
    POLICY_COMPARISON_ARTIFACT_SET_MANIFEST,
    "export.private.json",
  ]);
  if (
    fsImpl
      .readdirSync(resolvedOutput)
      .some((entry) => !allowedEntries.has(entry))
  )
    throw artifactSetError("COMPARISON_ARTIFACT_SET_FILES_INVALID");

  const files = finalArtifactFiles(resolvedOutput);
  for (const [filename, file] of Object.entries(files)) {
    if (!fsImpl.existsSync(file))
      throw artifactSetError("COMPARISON_ARTIFACT_SET_FILE_MISSING", filename);
    const stat = fsImpl.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile())
      throw artifactSetError("COMPARISON_ARTIFACT_SET_FILE_INVALID", filename);
  }
  const manifestFile = path.join(
    resolvedOutput,
    POLICY_COMPARISON_ARTIFACT_SET_MANIFEST
  );
  if (!fsImpl.existsSync(manifestFile))
    throw artifactSetError("COMPARISON_ARTIFACT_SET_MANIFEST_MISSING");
  const manifestStat = fsImpl.lstatSync(manifestFile);
  if (manifestStat.isSymbolicLink() || !manifestStat.isFile())
    throw artifactSetError("COMPARISON_ARTIFACT_SET_MANIFEST_INVALID");
  let manifest;
  try {
    manifest = JSON.parse(fsImpl.readFileSync(manifestFile, "utf8"));
  } catch (error) {
    throw artifactSetError(
      "COMPARISON_ARTIFACT_SET_MANIFEST_INVALID",
      error.message
    );
  }
  const expectedManifest = buildArtifactSetManifest(files, fsImpl);
  if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest))
    throw artifactSetError("COMPARISON_ARTIFACT_SET_MANIFEST_MISMATCH");
  return {
    outputDirectory: resolvedOutput,
    files,
    manifest,
    manifestFile,
    reused: true,
  };
}

async function publishComparisonArtifactSet(
  { outputDirectory, writeArtifacts, validateArtifacts = null },
  { fsImpl = fs, processImpl = process, randomBytes = crypto.randomBytes } = {}
) {
  if (typeof writeArtifacts !== "function")
    throw artifactSetError("COMPARISON_ARTIFACT_SET_WRITER_REQUIRED");
  if (validateArtifacts !== null && typeof validateArtifacts !== "function")
    throw artifactSetError("COMPARISON_ARTIFACT_SET_VALIDATOR_INVALID");

  const { parent, resolvedOutput } = assertOutputTarget(
    String(outputDirectory || ""),
    fsImpl
  );
  const staging = path.join(
    parent,
    `.${path.basename(resolvedOutput)}.staging-${processImpl.pid}-${randomBytes(12).toString("hex")}`
  );
  const publishClaim = `${resolvedOutput}.publish-claim`;
  let claimOwner = null;
  let published = false;
  let stagingCreated = false;

  try {
    fsImpl.mkdirSync(staging, { recursive: false, mode: 0o700 });
    stagingCreated = true;
    fsImpl.chmodSync(staging, 0o700);

    const writeResult = await writeArtifacts(staging);
    let files = assertCompleteArtifactSet(staging, fsImpl);
    const validationResult = validateArtifacts
      ? await validateArtifacts({
          directory: staging,
          files: { ...files },
          writeResult,
        })
      : null;

    files = assertCompleteArtifactSet(staging, fsImpl);
    const manifest = buildArtifactSetManifest(files, fsImpl);
    const manifestFile = path.join(
      staging,
      POLICY_COMPARISON_ARTIFACT_SET_MANIFEST
    );
    writeManifest(manifestFile, manifest, fsImpl);
    fsyncArtifactSet(staging, { ...files, manifest: manifestFile }, fsImpl);

    claimOwner = acquirePublishClaim({
      claimFile: publishClaim,
      parent,
      nonce: randomBytes(12).toString("hex"),
      resolvedOutput,
      fsImpl,
      processImpl,
    });
    if (fsImpl.existsSync(resolvedOutput))
      throw artifactSetError("COMPARISON_ARTIFACT_SET_OUTPUT_ALREADY_EXISTS");
    fsImpl.renameSync(staging, resolvedOutput);
    fsyncDirectory(parent, fsImpl);
    published = true;
    stagingCreated = false;

    return {
      outputDirectory: resolvedOutput,
      files: finalArtifactFiles(resolvedOutput),
      manifest,
      manifestFile: path.join(
        resolvedOutput,
        POLICY_COMPARISON_ARTIFACT_SET_MANIFEST
      ),
      validationResult,
      writeResult,
    };
  } catch (error) {
    if (!published && stagingCreated && fsImpl.existsSync(staging))
      fsImpl.rmSync(staging, { recursive: true, force: true });
    throw error;
  } finally {
    if (claimOwner)
      try {
        if (
          fsImpl.existsSync(publishClaim) &&
          fsImpl.readFileSync(publishClaim, "utf8") === claimOwner
        ) {
          fsImpl.unlinkSync(publishClaim);
          fsyncDirectory(parent, fsImpl);
        }
      } catch {}
  }
}

module.exports = {
  POLICY_COMPARISON_ARTIFACT_FILES,
  POLICY_COMPARISON_ARTIFACT_SET_CONTRACT_ID,
  POLICY_COMPARISON_ARTIFACT_SET_SCHEMA_VERSION,
  POLICY_COMPARISON_ARTIFACT_SET_MANIFEST,
  buildArtifactSetManifest,
  publishComparisonArtifactSet,
  validatePublishedComparisonArtifactSet,
};
