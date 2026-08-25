jest.mock("../../../utils/LocalModelTokenizer", () => ({
  tokenizerDirectory: jest.fn(),
  countModelTokens: jest.fn(),
}));

const LocalModelTokenizer = require("../../../utils/LocalModelTokenizer");
const {
  collectorEstimate,
  countDocumentTokens,
} = require("../../../utils/documentTokenCount");

describe("documentTokenCount", () => {
  beforeEach(() => jest.clearAllMocks());

  test("uses a clearly typed collector estimate when no tokenizer is configured", async () => {
    LocalModelTokenizer.tokenizerDirectory.mockReturnValue(null);
    await expect(countDocumentTokens("text", 12.4)).resolves.toEqual({
      count: 12,
      kind: "estimated",
      label: null,
    });
    expect(LocalModelTokenizer.countModelTokens).not.toHaveBeenCalled();
  });

  test("uses the configured local tokenizer for an exact document-text count", async () => {
    LocalModelTokenizer.tokenizerDirectory.mockReturnValue("/models/local");
    LocalModelTokenizer.countModelTokens.mockResolvedValue({
      count: 42,
      label: "PolicyModel",
    });
    await expect(countDocumentTokens("document text", 12)).resolves.toEqual({
      count: 42,
      kind: "exact_model",
      label: "PolicyModel",
    });
  });

  test("falls back without presenting tokenizer failures as exact", async () => {
    LocalModelTokenizer.tokenizerDirectory.mockReturnValue("/models/broken");
    LocalModelTokenizer.countModelTokens.mockRejectedValue(
      new Error("invalid tokenizer")
    );
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(countDocumentTokens("document text", 21)).resolves.toEqual({
      count: 21,
      kind: "estimated",
      label: null,
    });
    console.warn.mockRestore();
  });

  test("normalizes invalid estimates", () => {
    expect(collectorEstimate(undefined)).toBe(0);
    expect(collectorEstimate(-5)).toBe(0);
  });
});
