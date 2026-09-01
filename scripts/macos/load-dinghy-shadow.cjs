#!/usr/bin/env node

const path = require("path");

function fail(message) {
  console.error(`[dinghy-shadow-load] ${message}`);
  process.exit(1);
}

const [sdkArgument, modelKey, identifier, contextArgument] =
  process.argv.slice(2);
const contextLength = Number(contextArgument);
if (
  !sdkArgument ||
  !modelKey ||
  !identifier ||
  !Number.isInteger(contextLength) ||
  contextLength < 1
)
  fail("SDK-Pfad, Modellschlüssel, Identifier und Kontext sind erforderlich.");

const sdkPath = path.resolve(sdkArgument);
const { LMStudioClient } = require(sdkPath);

async function run() {
  const client = new LMStudioClient();
  if ((await client.llm.listLoaded()).length > 0)
    throw new Error("DINGHY_SHADOW_LLM_STILL_LOADED");
  if ((await client.embedding.listLoaded()).length > 0)
    throw new Error("DINGHY_SHADOW_EMBEDDING_ALREADY_LOADED");
  const model = await client.embedding.load(modelKey, {
    identifier,
    verbose: "info",
    config: { contextLength },
  });
  const info = await model.getModelInfo();
  if (info.identifier !== identifier)
    throw new Error(
      `DINGHY_SHADOW_IDENTIFIER_MISMATCH: ${info.identifier || "NICHT_GEMELDET"}`
    );
  if (Number(info.contextLength) !== contextLength)
    throw new Error(
      `DINGHY_SHADOW_CONTEXT_MISMATCH: ${info.contextLength || "NICHT_GEMELDET"}`
    );
  console.log(
    `[dinghy-shadow-load] ${identifier} mit Kontext ${contextLength} geladen.`
  );
}

run().catch((error) => fail(error.stack || error.message));
