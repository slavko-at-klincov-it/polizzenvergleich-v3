const fs = require("fs");
const path = require("path");

let tokenizerPromise = null;
let tokenizerCacheKey = null;

function tokenizerDirectory() {
  const configuredPath = process.env.MODEL_TOKENIZER_PATH;
  if (!configuredPath) return null;
  const resolvedPath = path.resolve(configuredPath);
  return path.extname(resolvedPath) === ".json"
    ? path.dirname(resolvedPath)
    : resolvedPath;
}

function tokenizerLabel() {
  if (process.env.MODEL_TOKENIZER_LABEL)
    return String(process.env.MODEL_TOKENIZER_LABEL);
  if (process.env.LMSTUDIO_MODEL_PREF)
    return String(process.env.LMSTUDIO_MODEL_PREF);
  return "model";
}

async function getTokenizer() {
  const directory = tokenizerDirectory();
  if (!directory)
    throw new Error(
      "MODEL_TOKENIZER_PATH is not configured; using the collector token estimate."
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
 * Counts only extracted document text. Chat templates, prompts, history and
 * generated output are intentionally outside this metric.
 */
async function countModelTokens(text = "") {
  const tokenizer = await getTokenizer();
  return {
    count: tokenizer.encode(String(text), { add_special_tokens: false }).ids
      .length,
    label: tokenizerLabel(),
  };
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
