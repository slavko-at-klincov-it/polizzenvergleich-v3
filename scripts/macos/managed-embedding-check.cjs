#!/usr/bin/env node

const path = require("path");

const repo = path.resolve(
  process.env.POLICY_REPO_DIR || path.resolve(__dirname, "../..")
);
require(path.join(repo, "server/node_modules/dotenv")).config({
  path: path.join(repo, "server/.env"),
});
const {
  assertManagedEmbeddingEnvironment,
  EXPECTED_EMBEDDING_DIMENSIONS,
} = require(path.join(repo, "shared/managedEmbeddingContract.cjs"));
const lock = require(path.join(repo, "scripts/macos/models.lock.json"));

assertManagedEmbeddingEnvironment(process.env);
if (lock.embedding.identifier !== process.env.EMBEDDING_MODEL_PREF)
  throw new Error("Managed embedding alias differs from the pinned model lock.");
if (lock.embedding.dimensions !== EXPECTED_EMBEDDING_DIMENSIONS)
  throw new Error("Pinned embedding dimensions differ from the LanceDB contract.");
process.stdout.write(
  `${JSON.stringify({ ready: true, model: lock.embedding.identifier, dimensions: EXPECTED_EMBEDDING_DIMENSIONS })}\n`
);
