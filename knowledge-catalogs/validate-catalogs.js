#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, filename), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const seed = readJson("building-insurance-claude-seed.v0.1.json");
const targets = readJson("water-target-specs.v0.1.json");
const golden = readJson("water-golden-case-classes.v0.1.json");
const brokerSchema = readJson("broker-rule-contract.v0.1.schema.json");

const points = seed.comparisonPointCandidates || [];
const brokerRules = seed.brokerRuleCandidates || [];
const allIds = [...points, ...brokerRules].map((record) => record.id);
const knownPointIds = new Set(points.map((point) => point.id));

assert(points.length === 190, "Expected 190 comparison-point candidates");
assert(brokerRules.length === 12, "Expected 12 broker-rule candidates");
assert(allIds.length === 202, "Expected 202 source rows in total");
assert(new Set(allIds).size === allIds.length, "Catalog IDs must be unique");
assert(
  brokerRules.every(
    (rule) =>
      rule.autoScoreAllowed === false && rule.status === "candidate_unvalidated"
  ),
  "Unvalidated broker rules must never permit automatic scoring"
);
assert(
  points.every(
    (point) =>
      point.allowAdditionalFindings === true &&
      point.status === "candidate_unvalidated" &&
      Array.isArray(point.requirementBindings)
  ),
  "Seed points must remain unvalidated and allow additional findings"
);

for (const target of targets.targets || []) {
  const refs = target.pointIds || [target.pointId];
  for (const pointId of refs.filter(Boolean)) {
    assert(
      knownPointIds.has(pointId),
      `Unknown target point reference: ${pointId}`
    );
  }
}

assert(
  (targets.targets || []).length === 6,
  "Expected six initial target specs"
);
assert(
  (golden.cases || []).length === 25,
  "Expected 25 water golden-case classes"
);
assert(
  new Set(golden.cases.map((testCase) => testCase.caseId)).size === 25,
  "Golden-case IDs must be unique"
);
assert(
  brokerSchema.properties?.autoScoreAllowed?.const === false,
  "Broker-rule schema must fail closed on automatic scoring"
);

process.stdout.write(
  `catalog validation PASS: ${points.length} points, ${brokerRules.length} broker rules, ` +
    `${targets.targets.length} target specs, ${golden.cases.length} golden classes\n`
);
