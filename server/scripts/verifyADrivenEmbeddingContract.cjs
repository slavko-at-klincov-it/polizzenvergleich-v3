#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  loadHybridShadowContract,
} = require("../utils/policyAnalysis/hybridShadowSearch");

function regularFile(file, code) {
  if (!path.isAbsolute(file || "") || !fs.existsSync(file))
    throw new Error(`${code}_MISSING`);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`${code}_INVALID`);
  return file;
}

async function sha256File(file) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

async function main() {
  const contractFile = regularFile(
    path.resolve(String(process.argv[2] || "")),
    "LF_A_DRIVEN_EMBEDDING_CONTRACT"
  );
  const { identity } = loadHybridShadowContract(contractFile);
  if (
    identity.enabled !== true ||
    identity.provider?.model !== "text-embedding-dinghy-law-4b-v1" ||
    identity.provider?.dimensions !== 2560 ||
    identity.provider?.runtimeRevision !==
      "llama.cpp-mac-arm64-apple-metal-advsimd@2.28.2"
  )
    throw new Error("LF_A_DRIVEN_EMBEDDING_PRODUCT_PROFILE_INVALID");
  const modelFile = regularFile(
    identity.provider.modelArtifactPath,
    "LF_A_DRIVEN_EMBEDDING_MODEL"
  );
  const runtimeFile = regularFile(
    identity.provider.runtimeArtifactPath,
    "LF_A_DRIVEN_EMBEDDING_RUNTIME"
  );
  const [modelSha256, runtimeSha256] = await Promise.all([
    sha256File(modelFile),
    sha256File(runtimeFile),
  ]);
  if (modelSha256 !== identity.provider.modelArtifactSha256)
    throw new Error("LF_A_DRIVEN_EMBEDDING_MODEL_SHA256_MISMATCH");
  if (runtimeSha256 !== identity.provider.runtimeArtifactSha256)
    throw new Error("LF_A_DRIVEN_EMBEDDING_RUNTIME_SHA256_MISMATCH");
  process.stdout.write(
    `${JSON.stringify({
      contractFile,
      contractSha256: identity.contractSha256,
      model: identity.provider.model,
      modelSha256,
      runtimeRevision: identity.provider.runtimeRevision,
      runtimeSha256,
    })}\n`
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
