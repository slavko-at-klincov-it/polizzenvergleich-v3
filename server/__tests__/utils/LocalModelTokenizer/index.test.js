const path = require("path");
const {
  getTokenizer,
  resetTokenizerCache,
  tokenizerDirectory,
  tokenizerLabel,
} = require("../../../utils/LocalModelTokenizer");

describe("LocalModelTokenizer configuration", () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
    resetTokenizerCache();
  });

  test("is opt-in and prefers the generic model configuration", () => {
    delete process.env.MODEL_TOKENIZER_PATH;
    expect(tokenizerDirectory()).toBeNull();

    process.env.MODEL_TOKENIZER_PATH = "/models/gemma/tokenizer.json";
    process.env.MODEL_TOKENIZER_LABEL = "Gemma";
    expect(tokenizerDirectory()).toBe(path.resolve("/models/gemma"));
    expect(tokenizerLabel()).toBe("Gemma");
  });

  test("can derive a provider-neutral label from the LM Studio preference", () => {
    delete process.env.MODEL_TOKENIZER_LABEL;
    process.env.LMSTUDIO_MODEL_PREF = "local-policy-model";
    expect(tokenizerLabel()).toBe("local-policy-model");
  });

  test("fails clearly when configured tokenizer files are unavailable", async () => {
    process.env.MODEL_TOKENIZER_PATH = "/definitely/missing/model";
    await expect(getTokenizer()).rejects.toThrow("MODEL_TOKENIZER_PATH");
  });
});
