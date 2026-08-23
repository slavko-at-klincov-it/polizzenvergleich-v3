const {
  assessPageText,
} = require("../../../../processSingleFile/convert/asPDF/PageTextQuality");

describe("PageTextQuality", () => {
  test("accepts meaningful German policy text", () => {
    const result = assessPageText(
      "Der Selbstbehalt beträgt EUR 500 je Versicherungsfall."
    );
    expect(result.needsOcr).toBe(false);
    expect(result.reason).toBeNull();
  });

  test.each([
    ["", "empty_text_layer"],
    ["Seite 1", "too_little_text"],
    ["������", "replacement_characters"],
  ])("routes an unusable text layer to OCR", (text, reason) => {
    const result = assessPageText(text);
    expect(result.needsOcr).toBe(true);
    expect(result.reason).toBe(reason);
  });
});
