const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const WORKER = path.join(
  REPOSITORY_ROOT,
  "server/scripts/policyComparisonWorker.cjs"
);

describe("policy comparison worker contract", () => {
  const source = fs.readFileSync(WORKER, "utf8");

  test("binds every private source to its persisted hash before analysis", () => {
    expect(source).toContain("COMPARISON_SOURCE_IDENTITY_MISMATCH");
    expect(source).toContain("await sha256File(sourceFile)");
  });

  test("uses argument arrays and the existing all-category runner", () => {
    expect(source).toContain('const RUNNER = path.join(REPOSITORY_ROOT, "run-all-categories-quality.command")');
    expect(source).toContain('[RUNNER, file, documentStatus, outputDirectory]');
    expect(source).not.toContain("shell: true");
  });

  test("writes a review-required comparison rather than an automatic advantage", () => {
    const builder = fs.readFileSync(
      path.join(
        REPOSITORY_ROOT,
        "server/utils/policyComparison/resultBuilder.js"
      ),
      "utf8"
    );
    expect(builder).toContain("TECHNICAL_RESULT_REVIEW_REQUIRED");
    expect(builder).toContain("Ein automatischer Vorteilsschluss ist nicht zulässig");
  });

  test("uses a release-bound resumable run and counts completed categories", () => {
    expect(source).toContain("resumableRun({ sessionUuid, manifest })");
    expect(source).toContain("run-contract.private.json");
    expect(source).toContain("completedCategoryViews(documentOutput)");
    expect(source).toContain("initialCompletedCategories");
    expect(source).toContain("resumedCategories");
    expect(source).not.toContain("const timestamp = new Date()");
  });
});
