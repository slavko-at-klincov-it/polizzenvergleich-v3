const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const RUNNER = path.join(
  REPOSITORY_ROOT,
  "run-a-driven-reference-product-v2.command"
);

describe("LF_REFERENCE_A_DRIVEN_V2 product runner contract", () => {
  const source = fs.readFileSync(RUNNER, "utf8");

  test("executes the existing V2 stages in the required fail-closed order", () => {
    const stages = [
      "buildADrivenReferenceShadow.cjs",
      "runADrivenReferenceClassification.cjs",
      "buildADrivenReferenceShadow.cjs",
      "runADrivenReferenceDinghyRetrieval.cjs",
      "buildADrivenCompleteBCorpus.cjs",
      "runADrivenRequirementCounterpartDecisions.cjs",
      "runADrivenRequirementAbsenceDecisions.cjs",
      "materializeADrivenRequirementRescueReviewPlan.cjs",
      "materializeADrivenRequirementFinalDecisions.cjs",
      "materializeADrivenRequirementBinaryResult.cjs",
      "materializeADrivenReferenceProductResult.cjs",
    ];
    let offset = -1;
    for (const stage of stages) {
      offset = source.indexOf(stage, offset + 1);
      expect(offset).toBeGreaterThan(-1);
    }
    expect(source).toContain('--artifactOutputDirectory "$RESULT_ROOT"');
    expect(source).toContain(
      '--sourceInputManifest "$RUN_ROOT/input-manifest.private.json"'
    );
    expect(source).not.toContain("gold-regression");
    expect(source).not.toContain("Gold-283");
  });

  test("loads Qwen and Dinghy exclusively and restores Qwen after interruption", () => {
    const restoreGuard = source.indexOf("RESTORE_QWEN=1");
    const unloadQwen = source.indexOf(
      "unload-lmstudio-model.cjs",
      restoreGuard
    );
    const loadDinghy = source.indexOf('"$LMS_BIN" load "$DINGHY_MODEL_KEY"');
    const retrieval = source.indexOf(
      "runADrivenReferenceDinghyRetrieval.cjs",
      loadDinghy
    );
    const unloadDinghy = source.indexOf(
      "unload-lmstudio-model.cjs",
      retrieval
    );
    expect(source).toContain("ensure_qwen");
    expect(source).toContain("if [ \"$DINGHY_LOADED\" -eq 1 ]");
    expect(restoreGuard).toBeGreaterThan(-1);
    expect(unloadQwen).toBeGreaterThan(restoreGuard);
    expect(loadDinghy).toBeGreaterThan(unloadQwen);
    expect(retrieval).toBeGreaterThan(loadDinghy);
    expect(unloadDinghy).toBeGreaterThan(retrieval);
    expect(source.indexOf("load_qwen", unloadDinghy)).toBeGreaterThan(
      unloadDinghy
    );
  });

  test("keeps completed model phases resumable without overwriting them", () => {
    expect(source).toContain(
      'if [ ! -f "$B_DECISION_ROOT/summary.private.json" ]'
    );
    expect(source).toContain(
      'if [ ! -f "$B_ABSENCE_ROOT/summary.private.json" ]'
    );
    expect(source).toContain(
      'if [ ! -f "$B_RESCUE_DECISION_ROOT/summary.private.json" ]'
    );
    expect(source).not.toContain("rm -rf");

    const aBuilder = fs.readFileSync(
      path.join(
        REPOSITORY_ROOT,
        "server/scripts/qa/buildADrivenReferenceShadow.cjs"
      ),
      "utf8"
    );
    const bBuilder = fs.readFileSync(
      path.join(
        REPOSITORY_ROOT,
        "server/scripts/qa/buildADrivenCompleteBCorpus.cjs"
      ),
      "utf8"
    );
    expect(aBuilder).toContain("LF_A_SHADOW_RESUME_MISMATCH");
    expect(bBuilder).toContain("LF_A_DRIVEN_COMPLETE_B_RESUME_MISMATCH");
  });
});
