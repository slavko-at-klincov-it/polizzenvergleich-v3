const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

function source(relativePath) {
  return fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
}

describe("targeted QA phase digest CLI boundary", () => {
  test.each([
    [
      "candidate triage",
      "server/scripts/qa/runVsCandidateTriage.cjs",
      "buildCandidateTriagePayload(worksheet, {",
    ],
    [
      "prepared evidence",
      "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
      "expectedTargetSelectionDigestSha256,",
    ],
  ])(
    "%s requires and forwards the external selection digest",
    (_label, relativePath, forwardingMarker) => {
      const script = source(relativePath);

      expect(script).toContain('"expectedTargetSelectionDigestSha256"');
      expect(script).toContain(
        "Target-Worksheet erfordert --expectedTargetSelectionDigestSha256"
      );
      expect(script).toContain(
        "--expectedTargetSelectionDigestSha256 ist nur für Target-Worksheets zulässig"
      );
      expect(script).toContain(forwardingMarker);
      expect(script).toContain(
        "expectedTargetSelectionDigestSha256,\n      targetSelectionDigestSha256:"
      );
      expect(script).toContain(
        "declaredTokenLimit: Number(process.env.LMSTUDIO_MODEL_TOKEN_LIMIT)"
      );
      expect(script).toContain("releaseId: releaseIdentity(REPOSITORY_ROOT)");
      expect(script).toContain("nodeVersion: process.versions.node");
    }
  );
});
