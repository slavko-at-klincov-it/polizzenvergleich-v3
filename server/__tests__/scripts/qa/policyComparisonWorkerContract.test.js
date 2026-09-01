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
    expect(source).toContain(
      'const RUNNER = path.join(REPOSITORY_ROOT, "run-all-categories-quality.command")'
    );
    expect(source).toContain("[RUNNER, file, documentStatus, outputDirectory]");
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
    expect(builder).toContain(
      "Ein automatischer Vorteilsschluss ist nicht zulässig"
    );
  });

  test("rejects shadow worksheets at the customer materialization boundary", () => {
    const materializer = fs.readFileSync(
      path.join(
        REPOSITORY_ROOT,
        "server/scripts/qa/materializeCategoryFullResult.cjs"
      ),
      "utf8"
    );
    expect(materializer).toContain(
      "HYBRID_SHADOW_WORKSHEET_FORBIDDEN_IN_CUSTOMER_MATERIALIZER"
    );
    const primaryRunner = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "run-all-categories-quality.command"),
      "utf8"
    );
    const shadowRunner = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "run-hybrid-shadow-quality.command"),
      "utf8"
    );
    expect(source).not.toContain("hybridShadowSearch");
    expect(primaryRunner).not.toContain("runHybridShadowSearch");
    expect(shadowRunner).toContain("ensureHybridShadowRunManifest.cjs");
    expect(shadowRunner).toContain("runHybridShadowSearch.cjs");
  });

  test("keeps the bounded two-phase pilot outside the primary worker", () => {
    const primaryRunner = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "run-all-categories-quality.command"),
      "utf8"
    );
    const pilotSearch = fs.readFileSync(
      path.join(
        REPOSITORY_ROOT,
        "server/scripts/qa/runHybridShadowPilotSearch.cjs"
      ),
      "utf8"
    );
    expect(source).not.toContain("runHybridShadowPilotSearch");
    expect(pilotSearch).toContain("buildPageAwareRetrievalChunks");
    expect(pilotSearch).toContain("HYBRID_SHADOW_PILOT_SEARCH_COMPLETE");
    expect(pilotSearch).toContain("sharedDocumentChunkCount");
    expect(pilotSearch).not.toContain("groundTruth");
    expect(pilotSearch).not.toContain("acceptedSourceRanges");
    expect(pilotSearch).not.toContain("knownAdversarialSourceRanges");
    const pilotRunner = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "run-hybrid-shadow-pilot.command"),
      "utf8"
    );
    expect(primaryRunner).not.toContain("run-hybrid-shadow-pilot");
    expect(pilotRunner).toContain("verifyHybridShadowPilotSearchGate.cjs");
    expect(pilotRunner.indexOf("runHybridShadowPilotSearch.cjs")).toBeLessThan(
      pilotRunner.indexOf("runHybridShadowPilotQwenPhase.cjs")
    );
    expect(pilotRunner).toContain("RESTORE_QWEN=1");
  });

  test("uses a release-bound resumable run and counts completed categories", () => {
    expect(source).toContain("resumableRun({ sessionUuid, manifest })");
    expect(source).toContain("run-contract.private.json");
    expect(source).toContain("completedCategoryViews(documentOutput)");
    expect(source).toContain("initialCompletedCategories");
    expect(source).toContain("resumedCategories");
    expect(source).toContain("productProfile: PRODUCT_PROFILE");
    expect(source).toContain("manifest?.schemaVersion !== 2");
    expect(source).toContain("enforceProductProfile: true");
    expect(source).not.toContain("const timestamp = new Date()");
  });

  test("archives the completed workbook before marking the session complete", () => {
    expect(source).toContain("archiveComparisonWorkbook({");
    expect(source).toContain('"export.private.json"');
    expect(source.indexOf("archiveComparisonWorkbook({")).toBeLessThan(
      source.indexOf('status: "COMPLETED"')
    );
  });
});
