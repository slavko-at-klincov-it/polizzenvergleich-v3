const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const RUNNER = path.join(REPOSITORY_ROOT, "run-hybrid-shadow-quality.command");

describe("hybrid-shadow shell runner", () => {
  test("passes the primary document artifact into prepared-evidence replay", () => {
    const source = fs.readFileSync(RUNNER, "utf8");

    expect(source).toMatch(
      /runPreparedEvidenceEvaluation\.cjs" \\\n\s+--worksheet "\$SHADOW_WORKSHEET" \\\n\s+--documentArtifact "\$DOCUMENT_ARTIFACT"/u
    );
  });
});
