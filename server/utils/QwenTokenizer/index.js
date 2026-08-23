const { countModelTokens } = require("../LocalModelTokenizer");

/**
 * Counts extracted document text with the local Qwen tokenizer. This excludes
 * chat-template, system-prompt, conversation, and generated-answer tokens.
 * @param {string} text
 * @returns {Promise<number>}
 */
async function countQwenTokens(text = "") {
  const { count } = await countModelTokens(text);
  return count;
}

module.exports = { countQwenTokens };
