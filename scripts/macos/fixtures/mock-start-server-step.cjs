#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const statePath = process.env.POLICY_START_GATE_STATE;
if (!statePath) process.exit(2);
fs.appendFileSync(statePath, `${path.basename(process.argv[1])}\n`);
if (process.env.POLICY_START_GATE_FAIL_STEP === path.basename(process.argv[1]))
  process.exit(1);
