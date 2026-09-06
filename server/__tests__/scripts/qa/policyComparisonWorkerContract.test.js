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

  test("derives the customer status from row-level point decisions", () => {
    const builder = fs.readFileSync(
      path.join(
        REPOSITORY_ROOT,
        "server/utils/policyComparison/resultBuilder.js"
      ),
      "utf8"
    );
    expect(builder).toContain("COMPARISON_RESULT_MATERIALIZED");
    expect(builder).toContain("validateCustomerComparison");
    expect(source).toContain("validateCustomerComparisonFile");
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
    expect(materializer).toContain(
      "TARGET_REQUIREMENT_WORKSHEET_FORBIDDEN_IN_FULL_MATERIALIZER"
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
    expect(source).not.toContain("TARGETED_QA_ONLY");
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
    expect(source).toContain("resumableRun({");
    expect(source).toContain("comparisonMode,");
    expect(source).toContain("run-contract.private.json");
    expect(source).toContain("completedCategoryViews(documentOutput)");
    expect(source).toContain("initialCompletedCategories");
    expect(source).toContain("resumedCategories");
    expect(source).toContain("productProfile: manifest.productProfile");
    expect(source).toContain("manifest?.schemaVersion !== 3");
    expect(source).toContain("enforceProductProfile: true");
    expect(source).not.toContain("const timestamp = new Date()");
  });

  test("claims a queue-run lease and cannot overwrite a cancelled or newer run", () => {
    const model = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "server/models/policyComparison.js"),
      "utf8"
    );
    const endpoint = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "server/endpoints/policyComparisons.js"),
      "utf8"
    );
    expect(model).toContain("workerLeaseNonce");
    expect(model).toContain("COMPARISON_SESSION_CHANGED");
    expect(model).toContain("markFailedForLease");
    expect(source).toContain("claimWorkerLease");
    expect(source).toContain("COMPARISON_WORKER_LEASE_LOST");
    expect(source).toContain("inputManifest: activeLease.inputManifest");
    expect(source).toContain("workerPid: null");
    expect(source).toContain("releaseOwnedWorkerPid");
    expect(source).toContain("workerPid: activeLease.workerPid");
    expect(source).toContain(
      "await releaseOwnedWorkerPid().catch(console.error)"
    );
    expect(endpoint).toContain("policyComparisonWorkerSupervisor.enqueue");
    expect(endpoint).toContain("policyComparisonWorkerSupervisor.cancel");
    expect(endpoint).toContain("waitForExit: true");
    expect(endpoint).toContain("COMPARISON_WORKER_TERMINATION_UNCONFIRMED");
    expect(endpoint).not.toContain("process.kill(-current.workerPid");
  });

  test("routes the directed LF workflow through the controlled no-embedding path", () => {
    expect(source).toContain("analyzeReferenceDocument");
    expect(source).toContain("prepareDynamicReferenceTemplate");
    expect(source).toContain("writeDynamicReferenceComparisonArtifacts");
    expect(source).toContain(
      'plannedRuns.filter(({ document }) => document.side === "B")'
    );
    const referenceRunner = fs.readFileSync(
      path.join(
        REPOSITORY_ROOT,
        "server/utils/policyComparison/referenceRunner.js"
      ),
      "utf8"
    );
    expect(referenceRunner).toContain("buildCategoryOccurrenceWorksheet.cjs");
    expect(referenceRunner).toContain("runPreparedEvidenceEvaluation.cjs");
    expect(referenceRunner).not.toContain(".embeddings.");
  });

  test("uses the structure-compatible LF source manifest instead of a fixed PDF hash", () => {
    const model = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "server/models/policyComparison.js"),
      "utf8"
    );
    expect(model).toContain("LF_DYNAMIC_REFERENCE_PROFILE");
    expect(model).not.toContain("LF_REFERENCE_PROFILE.sourceProduct.documentSha256");
    expect(model).not.toContain("COMPARISON_REFERENCE_LF_DOCUMENT_REQUIRED");
    const dynamicRunner = fs.readFileSync(
      path.join(
        REPOSITORY_ROOT,
        "server/utils/policyComparison/dynamicReferenceRunner.js"
      ),
      "utf8"
    );
    expect(dynamicRunner).toContain("semanticRequirementManifestSha256");
    expect(source).toContain("templateDigest");
  });

  test("archives the completed workbook before marking the session complete", () => {
    expect(source).toContain("validatePublishedComparisonArtifactSet(");
    expect(source).toContain("COMPARISON_RESULT_SESSION_MISMATCH");
    expect(source).toContain("COMPARISON_RESULT_RUN_SIGNATURE_MISMATCH");
    expect(source).toContain("archiveComparisonWorkbook({");
    expect(source).toContain("buildComparisonExportContract({");
    expect(source).toContain(
      "artifactSetManifestFile: artifacts.artifactSetManifestFile"
    );
    expect(source).toContain('"export.private.json"');
    expect(source.indexOf("archiveComparisonWorkbook({")).toBeLessThan(
      source.indexOf('status: "COMPLETED"')
    );
    expect(source.indexOf("buildComparisonExportContract({")).toBeLessThan(
      source.indexOf('status: "COMPLETED"')
    );
  });

  test("verifies current workbook downloads against the persisted export hash chain", () => {
    const endpoint = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "server/endpoints/policyComparisons.js"),
      "utf8"
    );
    expect(endpoint).toContain("readValidatedStoredComparisonArtifacts({");
    expect(endpoint).toContain("expectedSessionUuid: session.uuid");
    expect(endpoint).toContain("response.send(artifacts.workbookBytes)");
    expect(endpoint).not.toContain("response.download(workbook, filename)");
  });
});
