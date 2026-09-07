const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

function source(file) {
  return fs.readFileSync(path.join(REPOSITORY_ROOT, file), "utf8");
}

describe("isolated target batch CLI contract", () => {
  test.each([
    "server/scripts/qa/runVsCandidateTriage.cjs",
    "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
  ])("%s keeps batching explicit and falls back to isolated calls", (file) => {
    const script = source(file);
    expect(script).toContain('"maxTargetsPerCall"');
    expect(script).toContain('"batchSystemPromptAddonFile"');
    expect(script).toContain("buildIsolatedTargetBatches");
    expect(script).toContain("parseAndValidateIsolatedTargetBatch");
    expect(script).toContain('executionMode: "ISOLATED_BATCH"');
    expect(script).toContain('"SINGLE_FALLBACK"');
    expect(script).toContain("await runSingleTarget(item, batchId)");
    expect(script).toContain("batchFallbackCount");
  });
});
