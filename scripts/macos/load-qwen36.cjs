#!/usr/bin/env node

const path = require("path");

function fail(message) {
  console.error(`[qwen36-load] ${message}`);
  process.exit(1);
}

const [sdkArgument, modelKey, identifier] = process.argv.slice(2);
if (!sdkArgument || !modelKey || !identifier)
  fail("SDK-Pfad, Modellschlüssel und Identifier sind erforderlich.");

const sdkPath = path.resolve(sdkArgument);
const { LMStudioClient } = require(sdkPath);

async function unloadAll(namespace) {
  for (const model of await namespace.listLoaded()) await model.unload();
}

async function run() {
  const client = new LMStudioClient();
  await unloadAll(client.llm);
  await unloadAll(client.embedding);

  const model = await client.llm.load(modelKey, {
    identifier,
    verbose: "info",
    config: {
      contextLength: 42496,
      maxParallelPredictions: 1,
      speculativeDraftMtp: false,
      mlxKvCacheQuantization: {
        enabled: true,
        bits: 8,
        groupSize: 64,
        quantizedStart: 0,
      },
    },
  });
  const info = await model.getModelInfo();
  if (info.identifier !== identifier)
    throw new Error(
      `Falscher Modell-Identifier: ${info.identifier || "NICHT_GEMELDET"}`
    );
  if (info.contextLength !== 42496)
    throw new Error(
      `Falsches Kontextfenster: ${info.contextLength || "NICHT_GEMELDET"}`
    );
  console.log(
    `[qwen36-load] ${identifier} geladen: Kontext 42496, Parallelität 1, MLX-KV-Cache 8 Bit, Thinking standardmäßig aus.`
  );
}

run().catch((error) => fail(error.stack || error.message));
