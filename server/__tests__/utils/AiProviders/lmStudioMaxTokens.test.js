const { LMStudioLLM } = require("../../../utils/AiProviders/lmStudio");

describe("LMStudioLLM maxTokens", () => {
  const originalBasePath = process.env.LMSTUDIO_BASE_PATH;

  beforeEach(() => {
    process.env.LMSTUDIO_BASE_PATH = "http://127.0.0.1:1234/v1";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalBasePath === undefined) delete process.env.LMSTUDIO_BASE_PATH;
    else process.env.LMSTUDIO_BASE_PATH = originalBasePath;
  });

  test("forwards an explicit positive completion cap to LM Studio", async () => {
    const llm = new LMStudioLLM({}, "test-model");
    const create = jest.fn().mockResolvedValue({
      model: "test-model",
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    llm.lmstudio = { chat: { completions: { create } } };

    await expect(
      llm.getChatCompletion([{ role: "user", content: "test" }], {
        temperature: 0,
        maxTokens: 128,
      })
    ).resolves.toMatchObject({
      textResponse: "ok",
      metrics: {
        requestedModel: "test-model",
        responseModel: "test-model",
      },
    });
    expect(create).toHaveBeenCalledWith({
      model: "test-model",
      messages: [{ role: "user", content: "test" }],
      temperature: 0,
      max_tokens: 128,
    });
  });

  test("keeps existing callers unchanged when no cap is supplied", async () => {
    const llm = new LMStudioLLM({}, "test-model");
    const create = jest.fn().mockResolvedValue({
      model: "test-model",
      choices: [{ message: { content: "ok" } }],
      usage: {},
    });
    llm.lmstudio = { chat: { completions: { create } } };

    await llm.getChatCompletion([], { temperature: 0 });
    expect(create).toHaveBeenCalledWith({
      model: "test-model",
      messages: [],
      temperature: 0,
    });
  });
});
