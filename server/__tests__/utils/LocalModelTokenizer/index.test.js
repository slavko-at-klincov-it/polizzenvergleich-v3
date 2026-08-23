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

  test("prefers the generic model tokenizer configuration", () => {
    process.env.MODEL_TOKENIZER_PATH = "/models/gemma";
    process.env.QWEN_TOKENIZER_PATH = "/models/qwen";
    process.env.MODEL_TOKENIZER_LABEL = "Gemma";

    expect(tokenizerDirectory()).toBe(path.resolve("/models/gemma"));
    expect(tokenizerLabel()).toBe("Gemma");
  });

  test("keeps the old Qwen path as a backward-compatible alias", () => {
    delete process.env.MODEL_TOKENIZER_PATH;
    delete process.env.MODEL_TOKENIZER_LABEL;
    process.env.QWEN_TOKENIZER_PATH = "/models/qwen";

    expect(tokenizerDirectory()).toBe(path.resolve("/models/qwen"));
    expect(tokenizerLabel()).toBe("Qwen");
  });

  test("fails clearly when local tokenizer files are unavailable", async () => {
    process.env.MODEL_TOKENIZER_PATH = "/definitely/missing/model";
    await expect(getTokenizer()).rejects.toThrow("MODEL_TOKENIZER_PATH");
  });
});
