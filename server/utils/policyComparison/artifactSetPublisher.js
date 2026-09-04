const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const POLICY_COMPARISON_ARTIFACT_SET_CONTRACT_ID =
  "POLICY_COMPARISON_ARTIFACT_SET_V1";
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

function finalArtifactFiles(outputDirectory) {
  return Object.fromEntries(
    POLICY_COMPARISON_ARTIFACT_FILES.map((filename) => [
      filename,
      path.join(outputDirectory, filename),
    ])
  );
}

async function publishComparisonArtifactSet(
  { outputDirectory, writeArtifacts, validateArtifacts = null },
  { fsImpl = fs, randomBytes = crypto.randomBytes } = {}
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
    `.${path.basename(resolvedOutput)}.staging-${process.pid}-${randomBytes(12).toString("hex")}`
  );
  const publishClaim = `${resolvedOutput}.publish-claim`;
  let claimDescriptor = null;
  let claimCreated = false;
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

    claimDescriptor = fsImpl.openSync(publishClaim, "wx", 0o600);
    claimCreated = true;
    fsImpl.fsyncSync(claimDescriptor);
    if (fsImpl.existsSync(resolvedOutput))
      throw artifactSetError("COMPARISON_ARTIFACT_SET_OUTPUT_ALREADY_EXISTS");
    fsImpl.renameSync(staging, resolvedOutput);
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
    if (claimDescriptor !== null) {
      try {
        fsImpl.closeSync(claimDescriptor);
      } catch {}
    }
    if (claimCreated)
      try {
        if (fsImpl.existsSync(publishClaim)) fsImpl.unlinkSync(publishClaim);
      } catch {}
  }
}

module.exports = {
  POLICY_COMPARISON_ARTIFACT_FILES,
  POLICY_COMPARISON_ARTIFACT_SET_CONTRACT_ID,
  POLICY_COMPARISON_ARTIFACT_SET_MANIFEST,
  buildArtifactSetManifest,
  publishComparisonArtifactSet,
};
