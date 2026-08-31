#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(`[qwen36-prepare] ${message}`);
  process.exit(1);
}

const [sourceArgument, targetArgument] = process.argv.slice(2);
if (!sourceArgument || !targetArgument)
  fail("Quell- und Zielordner sind erforderlich.");

const source = path.resolve(sourceArgument);
const target = path.resolve(targetArgument);
const sourceConfigFile = path.join(source, "config.json");
if (!fs.existsSync(sourceConfigFile))
  fail(`Qwen-3.6-Quellmodell fehlt: ${sourceConfigFile}`);

const sourceConfig = JSON.parse(fs.readFileSync(sourceConfigFile, "utf8"));
if (
  sourceConfig.model_type !== "qwen3_5_moe" ||
  !sourceConfig.text_config ||
  sourceConfig.text_config.model_type !== "qwen3_5_moe_text"
)
  fail("Das Quellmodell besitzt nicht die erwartete Qwen-3.6-MoE-Struktur.");

fs.mkdirSync(target, { recursive: true, mode: 0o700 });
fs.chmodSync(target, 0o700);

function writeAtomic(file, content) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, content, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function linkSourceFile(name) {
  const from = path.join(source, name);
  const to = path.join(target, name);
  if (!fs.existsSync(from)) fail(`Modelldatei fehlt: ${from}`);
  if (fs.lstatSync(from).isDirectory()) fail(`Unerwarteter Ordner: ${from}`);
  const temporary = `${to}.tmp-${process.pid}`;
  try {
    fs.symlinkSync(from, temporary);
    fs.renameSync(temporary, to);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

const weightFiles = fs
  .readdirSync(source)
  .filter((name) => /^model-\d+-of-\d+\.safetensors$/u.test(name))
  .sort();
if (weightFiles.length === 0) fail("Keine MLX-Gewichtsdateien gefunden.");
for (const name of [
  ...weightFiles,
  "model.safetensors.index.json",
  "generation_config.json",
  "tokenizer.json",
  "vocab.json",
])
  linkSourceFile(name);

const derivedConfig = {
  ...sourceConfig.text_config,
  architectures: ["Qwen3_5MoeForCausalLM"],
  model_type: "qwen3_5",
  quantization: sourceConfig.quantization,
  quantization_config: sourceConfig.quantization_config,
};
writeAtomic(
  path.join(target, "config.json"),
  `${JSON.stringify(derivedConfig, null, 2)}\n`
);
writeAtomic(
  path.join(target, "configuration.json"),
  `${JSON.stringify({ model_type: "qwen3_5", task: "text-generation" }, null, 2)}\n`
);

const thinkingEnabledCondition =
  "enable_thinking is defined and enable_thinking is false";
const thinkingDisabledCondition =
  "enable_thinking is not defined or enable_thinking is false";
function disableThinkingByDefault(template, label) {
  const rewritten = template.replaceAll(
    thinkingEnabledCondition,
    thinkingDisabledCondition
  );
  if (!rewritten.includes(thinkingDisabledCondition))
    fail(`Thinking-Schalter im ${label} ist nicht kompatibel.`);
  return rewritten;
}

const chatTemplate = fs.readFileSync(
  path.join(source, "chat_template.jinja"),
  "utf8"
);
writeAtomic(
  path.join(target, "chat_template.jinja"),
  disableThinkingByDefault(chatTemplate, "Chat-Template")
);

const tokenizerConfig = JSON.parse(
  fs.readFileSync(path.join(source, "tokenizer_config.json"), "utf8")
);
if (typeof tokenizerConfig.chat_template !== "string")
  fail("Tokenizer-Konfiguration enthält kein Chat-Template.");
tokenizerConfig.chat_template = disableThinkingByDefault(
  tokenizerConfig.chat_template,
  "Tokenizer-Template"
);
writeAtomic(
  path.join(target, "tokenizer_config.json"),
  `${JSON.stringify(tokenizerConfig, null, 2)}\n`
);

console.log(`[qwen36-prepare] Textmodell vorbereitet: ${target}`);
