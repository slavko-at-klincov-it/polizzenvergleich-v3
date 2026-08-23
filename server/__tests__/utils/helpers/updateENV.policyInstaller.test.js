jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  writeFileSync: jest.fn(),
}));

describe("installer-managed environment persistence", () => {
  const managed = {
    SERVER_HOST: "127.0.0.1",
    COLLECTOR_HOST: "127.0.0.1",
    COLLECTOR_API_HOST: "127.0.0.1",
    COLLECTOR_HOTDIR_PATH: "/private/hotdir",
    MODEL_TOKENIZER_PATH: "/private/model",
    MODEL_TOKENIZER_LABEL: "Gemma 4",
    EMBEDDING_QUERY_PREFIX: "Instruct: policy retrieval",
  };

  afterEach(() => {
    for (const key of Object.keys(managed)) delete process.env[key];
    require("fs").writeFileSync.mockClear();
  });

  it("keeps fork-specific settings when AnythingLLM dumps .env", () => {
    Object.assign(process.env, managed);
    const { dumpENV } = require("../../../utils/helpers/updateENV");
    dumpENV();
    const content = require("fs").writeFileSync.mock.calls[0][1];
    for (const [key, value] of Object.entries(managed)) {
      expect(content).toContain(`${key}='${value}'`);
    }
  });
});
