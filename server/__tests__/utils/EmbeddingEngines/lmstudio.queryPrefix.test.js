const {
  formatQueryInput,
} = require("../../../utils/EmbeddingEngines/lmstudio");

describe("LM Studio embedding query prefix", () => {
  afterEach(() => delete process.env.EMBEDDING_QUERY_PREFIX);

  test("leaves input unchanged when no prefix is configured", () => {
    expect(formatQueryInput("Selbstbehalt")).toBe("Selbstbehalt");
  });

  test("applies the retrieval instruction to queries only", () => {
    process.env.EMBEDDING_QUERY_PREFIX = "Instruct: Vertragsklauseln finden";
    expect(formatQueryInput("Selbstbehalt")).toBe(
      "Instruct: Vertragsklauseln finden\nQuery: Selbstbehalt"
    );
  });
});
