const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const RUNNER = path.join(
  REPOSITORY_ROOT,
  "run-lf-reference-discovery-benchmark.command"
);
const BUILDER = path.join(
  REPOSITORY_ROOT,
  "server/scripts/qa/buildLfReferenceDiscoveryBenchmark.cjs"
);

describe("LF reference discovery benchmark shell runner", () => {
  test("owns the global model lock and restores Qwen from the EXIT trap", () => {
    const source = fs.readFileSync(RUNNER, "utf8");

    expect(source).toContain(
      'GLOBAL_LOCK_DIR="$PRIVATE_QA_ROOT/.all-categories-quality.lock"'
    );
    expect(source).toContain("trap cleanup EXIT");
    expect(source).toContain('if [ "$DINGHY_LOADED" -eq 1 ]');
    expect(source).toContain('if [ "$RESTORE_QWEN" -eq 1 ]');
    expect(source).toContain("load_qwen || exit_code=1");
  });

  test("runs embedding-only discovery between verified model transitions", () => {
    const source = fs.readFileSync(RUNNER, "utf8");
    const unloadQwen = source.indexOf(
      '"$QWEN_MODEL"\nverify_model_state "$QWEN_MODEL" llm not-loaded'
    );
    const loadDinghy = source.indexOf('"$LMS_BIN" load "$DINGHY_MODEL_KEY"');
    const benchmark = source.indexOf("buildLfReferenceDiscoveryBenchmark.cjs");
    const unloadDinghy = source.lastIndexOf(
      '"$DINGHY_IDENTIFIER"\nDINGHY_LOADED=0'
    );
    const restoreQwen = source.lastIndexOf("load_qwen");

    expect(unloadQwen).toBeGreaterThan(-1);
    expect(loadDinghy).toBeGreaterThan(unloadQwen);
    expect(benchmark).toBeGreaterThan(loadDinghy);
    expect(unloadDinghy).toBeGreaterThan(benchmark);
    expect(restoreQwen).toBeGreaterThan(unloadDinghy);
    expect(source).not.toContain("runHybridShadowPilotQwenPhase.cjs");
  });

  test("pins the reviewed 283-row package population", () => {
    const source = fs.readFileSync(RUNNER, "utf8");

    expect(source).toContain("--expectedPublicNotFoundRows 135");
    expect(source).toContain("--expectedPureNullRows 132");
    expect(source).toContain("--expectedComponents 631");
    expect(source).toContain("--expectedCells 5679");
  });

  test("keeps challengers on current-null cells and emits only union candidates", () => {
    const source = fs.readFileSync(BUILDER, "utf8");

    expect(source).toContain("challengerEligible = current.length === 0");
    expect(source).toContain("embedding.enabled && challengerEligible");
    expect(source.match(/flatCandidates\.push/gu)).toHaveLength(1);
    expect(source).toContain('channel: "UNION"');
    expect(source).toContain('candidateKind: "NAVIGATION_EXACT_ORIGINAL_SPAN"');
  });

  test("binds candidates transitively and distinguishes incomplete embeddings", () => {
    const source = fs.readFileSync(BUILDER, "utf8");

    expect(source).toContain('"CHANNELS_COMPLETE_REVIEW_REQUIRED"');
    expect(source).toContain('"EMBEDDING_NOT_RUN"');
    expect(source).toContain("sourceResultSha256");
    expect(source).toContain("sourceSemanticManifestSha256");
    expect(source).toContain("sourceInventorySha256");
    expect(source).toContain("inventory.sourceBindings.runSignature");
  });
});
