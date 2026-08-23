#!/usr/bin/env node
const fs = require("fs");

const statePath = process.env.POLICY_MOCK_LMS_STATE;
if (!statePath) process.exit(2);

const initialState = {
  models: [
    {
      type: "llm",
      modelKey: "qwen/qwen3.8-27b",
      indexedModelIdentifier: "qwen/qwen3.8-27b@4bit",
      path: "qwen/qwen3.8-27b@4bit",
    },
    {
      type: "llm",
      modelKey: "google/gemma-4-26b-a4b",
      indexedModelIdentifier: "google/gemma-4-26b-a4b",
      path: "google/gemma-4-26b-a4b",
    },
    {
      type: "embedding",
      modelKey: "text-embedding-dinghy-law-4b-v1",
      indexedModelIdentifier:
        "Hanno-Labs/dinghy-law-4b-v1-gguf/dinghy-law-4b-v1-Q6_K.gguf",
      path: "Hanno-Labs/dinghy-law-4b-v1-gguf/dinghy-law-4b-v1-Q6_K.gguf",
    },
  ],
  loaded: [
    {
      type: "llm",
      modelKey: "qwen/qwen3.8-27b",
      indexedModelIdentifier: "qwen/qwen3.8-27b@4bit",
      identifier: "qwen/qwen3.8-27b",
      contextLength: 42496,
      parallel: 1,
    },
    {
      type: "embedding",
      modelKey: "text-embedding-dinghy-law-4b-v1",
      indexedModelIdentifier:
        "Hanno-Labs/dinghy-law-4b-v1-gguf/dinghy-law-4b-v1-Q6_K.gguf",
      identifier: "dinghy-embed",
      contextLength: 8192,
    },
  ],
  calls: [],
};

function readState() {
  if (!fs.existsSync(statePath)) return structuredClone(initialState);
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function writeState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

const args = process.argv.slice(2);
const command = args.slice(0, 2).join(" ");
const state = readState();
state.calls.push(args);

if (command === "daemon up") {
  writeState(state);
  process.exit(0);
}
if (command === "server status") {
  writeState(state);
  console.log("Server is running on port 1234");
  process.exit(0);
}
if (command === "ls --json") {
  writeState(state);
  console.log(JSON.stringify(state.models));
  process.exit(0);
}
if (command === "ps --json") {
  writeState(state);
  console.log(JSON.stringify(state.loaded));
  process.exit(0);
}
if (args[0] === "load") {
  const modelKey = args[1];
  const identifier = args[args.indexOf("--identifier") + 1];
  const contextLength = Number(args[args.indexOf("--context-length") + 1]);
  const parallel = Number(args[args.indexOf("--parallel") + 1]);
  const installed = state.models.find((model) => model.modelKey === modelKey);
  state.loaded = state.loaded.filter(
    (model) => model.identifier !== identifier
  );
  state.loaded.push({
    type: "llm",
    modelKey,
    indexedModelIdentifier: installed?.indexedModelIdentifier,
    identifier,
    contextLength,
    parallel,
  });
  writeState(state);
  console.log("Model loaded successfully.");
  process.exit(0);
}
if (args[0] === "unload") {
  const identifier = args[1];
  if (process.env.POLICY_MOCK_LMS_UNLOAD_FAIL === identifier) {
    writeState(state);
    console.error(`mock unload failed for ${identifier}`);
    process.exit(1);
  }
  state.loaded = state.loaded.filter(
    (model) => model.identifier !== identifier
  );
  writeState(state);
  process.exit(0);
}

writeState(state);
console.error(`unexpected mock lms call: ${args.join(" ")}`);
process.exit(1);
