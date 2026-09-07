const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

function source(file) {
  return fs.readFileSync(path.join(REPOSITORY_ROOT, file), "utf8");
}

describe("validated model response cache CLI contract", () => {
  test.each([
    "server/scripts/qa/runVsCandidateTriage.cjs",
    "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
  ])("%s revalidates hits and only publishes accepted responses", (file) => {
    const script = source(file);
    expect(script).toContain('"responseCacheDirectory"');
    expect(script).toContain("readValidatedCachedResponse({");
    expect(script).toContain("validateResponse,");
    expect(script).toContain("const judgement = validateResponse(");
    expect(script.indexOf("const judgement = validateResponse(")).toBeLessThan(
      script.indexOf("publishCachedResponse({")
    );
    expect(script).toContain('"cache-hits.private.json"');
    expect(script).toContain("responseCacheHitCount");
  });
});
