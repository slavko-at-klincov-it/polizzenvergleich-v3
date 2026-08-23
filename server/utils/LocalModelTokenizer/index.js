const fs = require("fs");
const path = require("path");

let tokenizerPromise = null;
let tokenizerCacheKey = null;

function tokenizerDirectory() {
  const configuredPath =
    process.env.MODEL_TOKENIZER_PATH || process.env.QWEN_TOKENIZER_PATH;
  if (configuredPath) {
    const resolvedPath = path.resolve(configuredPath);
    return path.extname(resolvedPath) === ".json"
      ? path.dirname(resolvedPath)
      : resolvedPath;
  }

  return null;
}

function tokenizerLabel() {
  if (process.env.MODEL_TOKENIZER_LABEL)
    return String(process.env.MODEL_TOKENIZER_LABEL);
  if (process.env.QWEN_TOKENIZER_PATH) return "Qwen";
  return process.env.LMSTUDIO_MODEL_PREF || "Local LM Studio model";
}

async function getTokenizer() {
  const directory = tokenizerDirectory();
  if (!directory)
    throw new Error(
      "MODEL_TOKENIZER_PATH is not configured for the selected local model."
    );
  if (tokenizerPromise && tokenizerCacheKey === directory)
    return tokenizerPromise;

  tokenizerCacheKey = directory;
  tokenizerPromise = (async () => {
    const tokenizerPath = path.join(directory, "tokenizer.json");
    const configPath = path.join(directory, "tokenizer_config.json");

    if (!fs.existsSync(tokenizerPath) || !fs.existsSync(configPath)) {
      throw new Error(
        `Tokenizer files were not found in ${directory}. Set MODEL_TOKENIZER_PATH to the local model directory.`
      );
    }

    const { Tokenizer } = await import("@huggingface/tokenizers");
    return new Tokenizer(
      JSON.parse(fs.readFileSync(tokenizerPath, "utf8")),
      JSON.parse(fs.readFileSync(configPath, "utf8"))
    );
  })().catch((error) => {
    tokenizerPromise = null;
    tokenizerCacheKey = null;
    throw error;
  });

  return tokenizerPromise;
}

/**
 * Counts extracted document text with the configured local model tokenizer.
 * This excludes chat-template, system-prompt, history, and output tokens.
 */
async function countModelTokens(text = "") {
  const tokenizer = await getTokenizer();
  const count = tokenizer.encode(String(text), {
    add_special_tokens: false,
  }).ids.length;
  return { count, label: tokenizerLabel() };
}

function resetTokenizerCache() {
  tokenizerPromise = null;
  tokenizerCacheKey = null;
}

module.exports = {
  countModelTokens,
  getTokenizer,
  resetTokenizerCache,
  tokenizerDirectory,
  tokenizerLabel,
};
