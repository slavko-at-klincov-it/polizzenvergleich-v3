#!/usr/bin/env node

const path = require("path");

function fail(message) {
  console.error(`[lmstudio-targeted-unload] ${message}`);
  process.exit(1);
}

const [sdkArgument, identifier] = process.argv.slice(2);
if (!sdkArgument || !identifier)
  fail("SDK-Pfad und exakter Identifier sind erforderlich.");

const { LMStudioClient } = require(path.resolve(sdkArgument));

async function run() {
  const client = new LMStudioClient();
  const loaded = [
    ...(await client.llm.listLoaded()),
    ...(await client.embedding.listLoaded()),
  ];
  const matches = [];
  for (const model of loaded) {
    const info = await model.getModelInfo();
    if (info.identifier === identifier) matches.push(model);
  }
  if (matches.length > 1)
    throw new Error(`LMSTUDIO_IDENTIFIER_NOT_UNIQUE: ${identifier}`);
  if (matches.length === 1) await matches[0].unload();
  console.log(
    `[lmstudio-targeted-unload] ${identifier}: ${matches.length ? "entladen" : "bereits nicht geladen"}.`
  );
}

run().catch((error) => fail(error.stack || error.message));
