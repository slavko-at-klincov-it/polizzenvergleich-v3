const { LMStudioLLM } = require("../../../../utils/AiProviders/lmStudio");

describe("LMStudioLLM policy inventory completion", () => {
  const originalEnvironment = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.LMSTUDIO_BASE_PATH = "http://127.0.0.1:1234/v1";
    process.env.LMSTUDIO_MODEL_PREF = "gemma";
    delete process.env.LMSTUDIO_AUTH_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    global.fetch = originalFetch;
    LMStudioLLM.modelContextWindows = {};
  });

  test("uses the native endpoint with reasoning off without changing normal chat", async () => {
    const requests = [];
    global.fetch = jest.fn(async (url, options = {}) => {
      if (String(url).endsWith("/api/v0/models"))
        return { ok: true, json: async () => ({ data: [] }) };
      if (String(url).endsWith("/api/v1/models"))
        return {
          ok: true,
          json: async () => ({
            models: [
              {
                type: "llm",
                key: "google/gemma-4-26b-a4b",
                capabilities: {
                  reasoning: {
                    allowed_options: ["off", "on"],
                    default: "on",
                  },
                },
                loaded_instances: [{ id: "gemma" }],
              },
            ],
          }),
        };
      requests.push({ url: String(url), body: JSON.parse(options.body) });
      return {
        ok: true,
        json: async () => ({
          model_instance_id: "gemma",
          output: [
            { type: "reasoning", content: "must not be returned" },
            {
              type: "message",
              content: '{"topics":[{"label":"Vandalismus"}]}',
            },
          ],
          stats: {
            input_tokens: 22,
            total_output_tokens: 8,
            reasoning_output_tokens: 0,
            tokens_per_second: 100,
          },
        }),
      };
    });
    const connector = new LMStudioLLM({}, "gemma");
    connector.getChatCompletion = jest.fn();

    const result = await connector.getPolicyInventoryCompletion(
      [
        { role: "system", content: "Nur JSON." },
        { role: "user", content: "Analysiere den Vertrag." },
      ],
      { temperature: 0 }
    );

    expect(requests).toEqual([
      {
        url: "http://127.0.0.1:1234/api/v1/chat",
        body: expect.objectContaining({
          model: "gemma",
          system_prompt: "Nur JSON.",
          input: "Analysiere den Vertrag.",
          reasoning: "off",
          temperature: 0,
          stream: false,
        }),
      },
    ]);
    expect(result.textResponse).toBe('{"topics":[{"label":"Vandalismus"}]}');
    expect(result.metrics).toMatchObject({
      prompt_tokens: 22,
      completion_tokens: 8,
      reasoning_tokens: 0,
      model: "gemma",
    });
    expect(connector.getChatCompletion).not.toHaveBeenCalled();
  });

  test("fails closed when the native endpoint returns no visible inventory", async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).endsWith("/api/v0/models"))
        return { ok: true, json: async () => ({ data: [] }) };
      if (String(url).endsWith("/api/v1/models"))
        return {
          ok: true,
          json: async () => ({
            models: [
              {
                key: "google/gemma-4-26b-a4b",
                capabilities: {
                  reasoning: {
                    allowed_options: ["off", "on"],
                    default: "on",
                  },
                },
                loaded_instances: [{ id: "gemma" }],
              },
            ],
          }),
        };
      return {
        ok: true,
        json: async () => ({
          output: [{ type: "reasoning", content: "hidden work only" }],
          stats: { reasoning_output_tokens: 20 },
        }),
      };
    });
    const connector = new LMStudioLLM({}, "gemma");

    await expect(
      connector.getPolicyInventoryCompletion([
        { role: "user", content: "Analysiere." },
      ])
    ).rejects.toThrow("no visible JSON response");
  });

  test("omits the reasoning field for a model without reasoning support", async () => {
    let chatBody = null;
    global.fetch = jest.fn(async (url, options = {}) => {
      if (String(url).endsWith("/api/v0/models"))
        return { ok: true, json: async () => ({ data: [] }) };
      if (String(url).endsWith("/api/v1/models"))
        return {
          ok: true,
          json: async () => ({
            models: [
              {
                type: "llm",
                key: "example/non-reasoning-model",
                capabilities: {},
                loaded_instances: [{ id: "plain-model" }],
              },
            ],
          }),
        };
      chatBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          output: [{ type: "message", content: '{"topics":[]}' }],
          stats: {},
        }),
      };
    });
    const connector = new LMStudioLLM({}, "plain-model");

    await connector.getPolicyInventoryCompletion([
      { role: "user", content: "Analysiere." },
    ]);

    expect(chatBody).not.toHaveProperty("reasoning");
  });

  test("fails closed when a reasoning model cannot disable reasoning", async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).endsWith("/api/v0/models"))
        return { ok: true, json: async () => ({ data: [] }) };
      return {
        ok: true,
        json: async () => ({
          models: [
            {
              type: "llm",
              key: "example/reasoning-only-model",
              capabilities: {
                reasoning: { allowed_options: ["on"], default: "on" },
              },
              loaded_instances: [{ id: "reasoning-only" }],
            },
          ],
        }),
      };
    });
    const connector = new LMStudioLLM({}, "reasoning-only");

    await expect(
      connector.getPolicyInventoryCompletion([
        { role: "user", content: "Analysiere." },
      ])
    ).rejects.toThrow("cannot disable reasoning");
  });

  test("leaves normal chat on the configured model default reasoning mode", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    }));
    const connector = new LMStudioLLM({}, "gemma");
    connector.lmstudio.chat.completions.create = jest.fn(async () => ({
      choices: [{ message: { content: "Normale Antwort" } }],
      usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
    }));

    await expect(
      connector.getChatCompletion([{ role: "user", content: "Hallo" }], {})
    ).resolves.toMatchObject({ textResponse: "Normale Antwort" });

    expect(connector.lmstudio.chat.completions.create).toHaveBeenCalledWith({
      model: "gemma",
      messages: [{ role: "user", content: "Hallo" }],
      temperature: 0.7,
    });
  });
});
