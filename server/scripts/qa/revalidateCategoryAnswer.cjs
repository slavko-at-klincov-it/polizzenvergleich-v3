#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  extractCategoryDefinitions,
  extractRequiredNotice,
  validateCategoryOutput,
} = require("./categoryOutputContract.cjs");

function fail(message) {
  console.error(`[category-answer-validation] ${message}`);
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

const cliArguments = parseArguments(process.argv.slice(2));
const answerPath = path.resolve(cliArguments.answer || "");
const systemPromptPath = path.resolve(cliArguments.systemPromptFile || "");
const sourceDocumentsPath = path.resolve(cliArguments.sourceDocuments || "");
const outputPath = path.resolve(cliArguments.output || "");

for (const [label, filePath] of [
  ["Antwort", answerPath],
  ["Systemprompt", systemPromptPath],
  ["Quelldokumente", sourceDocumentsPath],
]) {
  if (!filePath || !fs.existsSync(filePath))
    fail(`${label} fehlt: ${filePath}`);
}
if (!cliArguments.output) fail("--output ist erforderlich");

const systemPrompt = fs.readFileSync(systemPromptPath, "utf8");
const result = validateCategoryOutput({
  answer: fs.readFileSync(answerPath, "utf8"),
  categoryDefinitions: extractCategoryDefinitions(systemPrompt),
  requiredNotice: extractRequiredNotice(systemPrompt),
  sourceDocuments: JSON.parse(fs.readFileSync(sourceDocumentsPath, "utf8")),
});

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(
  `[category-answer-validation] ${result.pass ? "PASS" : "REVISE"}: ${outputPath}`
);
if (!result.pass)
  console.log(`[category-answer-validation] ${result.reasons.join(", ")}`);
