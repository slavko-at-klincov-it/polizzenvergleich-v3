#!/usr/bin/env node

const fs = require("fs");

const statePath = process.env.POLICY_MODEL_MANAGER_STATE;
if (!statePath) throw new Error("POLICY_MODEL_MANAGER_STATE fehlt.");
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : { ensureServer: 0, verifyArtifacts: 0, prepare: 0 };
const command = process.argv[2];

if (command === "ensure-server") {
  state.ensureServer += 1;
  fs.writeFileSync(statePath, JSON.stringify(state));
  if (state.ensureServer < 3) process.exit(1);
  process.exit(0);
}

if (command === "verify-artifacts") state.verifyArtifacts += 1;
else if (command === "prepare") state.prepare += 1;
else throw new Error(`Unerwarteter Testbefehl: ${command}`);

fs.writeFileSync(statePath, JSON.stringify(state));
