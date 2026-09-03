#!/usr/bin/env node

function fail(message) {
  console.error(`[lmstudio-model-state] ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) fail(`Ungültiges Argument: ${key}`);
    values[key.slice(2)] = value;
  }
  return values;
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set(["baseUrl", "model", "type", "state", "context"]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of ["baseUrl", "model", "type", "state"])
    if (!args[required]) fail(`--${required} ist erforderlich`);
  if (!new Set(["llm", "embeddings"]).has(args.type))
    fail("--type muss llm oder embeddings sein");
  if (!new Set(["loaded", "not-loaded"]).has(args.state))
    fail("--state muss loaded oder not-loaded sein");
  const apiRoot = args.baseUrl.replace(/\/v1\/?$/u, "");
  const response = await fetch(`${apiRoot}/api/v0/models`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    fail(`LM-Studio-Modellliste fehlgeschlagen: ${response.status}`);
  const body = await response.json();
  const entry = body?.data?.find(
    ({ id, type }) => id === args.model && type === args.type
  );
  if (
    (args.state === "loaded" && (!entry || entry.state !== "loaded")) ||
    (args.state === "not-loaded" && entry?.state === "loaded")
  )
    fail(
      `${args.model} hat Zustand ${entry?.state || "NICHT_GEFUNDEN"}; erwartet ${args.state}`
    );
  if (
    args.state === "loaded" &&
    args.context &&
    Number(entry.loaded_context_length) !== Number(args.context)
  )
    fail(
      `${args.model} hat Kontext ${entry.loaded_context_length || "NICHT_GEMELDET"}; erwartet ${args.context}`
    );
  console.log(
    `[lmstudio-model-state] ${args.model}: ${args.state}${args.context ? `, Kontext ${args.context}` : ""}.`
  );
}

run().catch((error) => fail(error.stack || error.message));
