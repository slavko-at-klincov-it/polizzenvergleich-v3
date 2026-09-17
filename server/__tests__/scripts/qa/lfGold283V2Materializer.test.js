const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  publishImmutableDirectory,
} = require("../../../scripts/qa/materializeLfKnownFixtureGold283V2.cjs");

describe("LF Gold-283-V2 materializer", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "lf-gold-283-v2-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("publishes correction set and V2 Gold together without overwrite", () => {
    const outputDir = path.join(root, "frozen");
    const published = publishImmutableDirectory(outputDir, {
      correctionSet: { contractId: "CORRECTION_SET" },
      gold: { contractId: "GOLD_V2" },
    });

    expect(fs.existsSync(published.correctionSet)).toBe(true);
    expect(fs.existsSync(published.gold)).toBe(true);
    expect(fs.statSync(published.correctionSet).mode & 0o777).toBe(0o600);
    expect(fs.statSync(published.gold).mode & 0o777).toBe(0o600);
    expect(() =>
      publishImmutableDirectory(outputDir, {
        correctionSet: { contractId: "OTHER" },
        gold: { contractId: "OTHER" },
      })
    ).toThrow("LF_GOLD_283_V2_OUTPUT_EXISTS");
  });
});
