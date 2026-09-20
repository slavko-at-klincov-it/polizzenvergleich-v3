const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  archivedCompatiblePredecessorManifest,
  compatiblePredecessorShadowSummary,
  compatiblePredecessorUnclassifiedManifest,
  manifestDigest,
  writePrivateJson,
} = require("../../../scripts/qa/buildADrivenReferenceShadow.cjs");
const {
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
  A_DYNAMIC_MANIFEST_CONTRACT_ID_V13,
} = require("../../../utils/policyAnalysis/aDrivenSemanticManifest");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const RUNNER = path.join(
  REPOSITORY_ROOT,
  "run-a-driven-reference-product-v2.command"
);

describe("LF_REFERENCE_A_DRIVEN_V2 product runner contract", () => {
  const source = fs.readFileSync(RUNNER, "utf8");

  test("executes the existing V2 stages in the required fail-closed order", () => {
    expect(source).toContain(
      'NODE_BIN="${V3_NODE_BIN:-$SCRIPT_DIR/.runtime/node-v22.23.2/bin/node}"'
    );
    const stages = [
      "buildADrivenReferenceShadow.cjs",
      "runADrivenReferenceClassification.cjs",
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
    expect(source).toContain('A_FINAL_ROOT="$A_CLASSIFICATION_ROOT"');
    expect(source.match(/buildADrivenReferenceShadow\.cjs/gu)).toHaveLength(1);
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
    const unloadDinghy = source.indexOf("unload-lmstudio-model.cjs", retrieval);
    expect(source).toContain("ensure_qwen");
    expect(source).toContain('if [ "$DINGHY_LOADED" -eq 1 ]');
    expect(restoreGuard).toBeGreaterThan(-1);
    expect(unloadQwen).toBeGreaterThan(restoreGuard);
    expect(loadDinghy).toBeGreaterThan(unloadQwen);
    expect(retrieval).toBeGreaterThan(loadDinghy);
    expect(unloadDinghy).toBeGreaterThan(retrieval);
    expect(source.indexOf("load_qwen", unloadDinghy)).toBeGreaterThan(
      unloadDinghy
    );
    expect(source).toContain('ACTIVE_CHILD_PID=""');
    expect(source).toContain('kill -TERM "$ACTIVE_CHILD_PID"');
    expect(source).toContain("trap stop_active_child HUP INT TERM");
    expect(source).toContain(
      'run_child "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runADrivenRequirementCounterpartDecisions.cjs"'
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
    expect(source).toContain("LF_B_DECISION_RESUME_ROOT");
    expect(source).toContain('--resumeOutputRoot "$LF_B_DECISION_RESUME_ROOT"');

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

  test("passes empty and populated optional argument arrays safely under macOS Bash nounset", () => {
    const runnerLines = source.split("\n").map((line) => line.trim());
    for (const name of [
      "A_CLASSIFICATION_RESUME_ARGS",
      "B_DECISION_RESUME_ARGS",
      "ABSENCE_SEED_ARGS",
    ]) {
      expect(source).toContain(`\"\${${name}[@]+\"\${${name}[@]}\"}\"`);
      expect(runnerLines).not.toContain(`\"\${${name}[@]}\"`);
    }

    const empty = spawnSync(
      "/bin/bash",
      [
        "-c",
        'set -u; optional=(); set -- "${optional[@]+"${optional[@]}"}"; printf "%s" "$#"',
      ],
      { encoding: "utf8" }
    );
    expect(empty.status).toBe(0);
    expect(empty.stdout).toBe("0");

    const populated = spawnSync(
      "/bin/bash",
      [
        "-c",
        'set -u; optional=(--seedOutput "/private/seed path"); set -- "${optional[@]+"${optional[@]}"}"; printf "%s\\n%s\\n%s" "$#" "$1" "$2"',
      ],
      { encoding: "utf8" }
    );
    expect(populated.status).toBe(0);
    expect(populated.stdout).toBe("2\n--seedOutput\n/private/seed path");
  });

  test("archives only an integrity-valid, payload-identical V13 placeholder during the V14 resume upgrade", () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-shadow-resume-upgrade-")
    );
    try {
      const file = path.join(
        temporary,
        "dynamic-semantic-manifest.private.json"
      );
      const archiveDirectory = path.join(temporary, "superseded");
      const payload = {
        schemaVersion: 1,
        sourceUnitPlanSha256: "a".repeat(64),
        requirements: [],
        unitTerminals: [],
        blockTerminals: [],
        summary: {
          semanticRequirements: 0,
          semanticComponents: 0,
          unresolvedUnits: 1,
        },
      };
      const current = {
        contractId: A_DYNAMIC_MANIFEST_CONTRACT_ID,
        ...payload,
      };
      current.manifestSha256 = manifestDigest(current);
      const predecessor = {
        contractId: A_DYNAMIC_MANIFEST_CONTRACT_ID_V13,
        ...payload,
      };
      predecessor.manifestSha256 = manifestDigest(predecessor);
      fs.writeFileSync(file, `${JSON.stringify(predecessor, null, 2)}\n`);

      const manifestWrite = writePrivateJson(file, current, {
        compatibleExisting: compatiblePredecessorUnclassifiedManifest,
        archiveDirectory,
      });
      expect(manifestWrite.predecessor).toEqual(predecessor);
      const archivedPredecessor = archivedCompatiblePredecessorManifest(
        archiveDirectory,
        current
      );
      expect(archivedPredecessor).toEqual(predecessor);

      const summaryFile = path.join(temporary, "summary.private.json");
      const currentSummary = {
        contractId: "LF_REFERENCE_A_DRIVEN_SHADOW_V1",
        sourceUnitPlanSha256: payload.sourceUnitPlanSha256,
        dynamicManifestSha256: current.manifestSha256,
        semanticRequirements: 0,
      };
      const predecessorSummary = {
        ...currentSummary,
        dynamicManifestSha256: predecessor.manifestSha256,
      };
      fs.writeFileSync(
        summaryFile,
        `${JSON.stringify(predecessorSummary, null, 2)}\n`
      );
      writePrivateJson(summaryFile, currentSummary, {
        compatibleExisting: (existing, candidate) =>
          compatiblePredecessorShadowSummary(
            existing,
            candidate,
            archivedPredecessor
          ),
        archiveDirectory,
      });

      expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(current);
      expect(JSON.parse(fs.readFileSync(summaryFile, "utf8"))).toEqual(
        currentSummary
      );
      const archives = fs.readdirSync(archiveDirectory);
      expect(archives).toHaveLength(2);
      const manifestArchive = archives.find((name) =>
        name.startsWith("dynamic-semantic-manifest.")
      );
      expect(
        JSON.parse(
          fs.readFileSync(path.join(archiveDirectory, manifestArchive), "utf8")
        )
      ).toEqual(predecessor);
      for (const archive of archives)
        expect(
          fs.statSync(path.join(archiveDirectory, archive)).mode & 0o777
        ).toBe(0o600);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test("rejects a V13 placeholder whose payload differs from the current plan", () => {
    const current = {
      contractId: A_DYNAMIC_MANIFEST_CONTRACT_ID,
      sourceUnitPlanSha256: "a".repeat(64),
      requirements: [],
    };
    current.manifestSha256 = manifestDigest(current);
    const predecessor = {
      contractId: A_DYNAMIC_MANIFEST_CONTRACT_ID_V13,
      sourceUnitPlanSha256: "b".repeat(64),
      requirements: [],
    };
    predecessor.manifestSha256 = manifestDigest(predecessor);

    expect(
      compatiblePredecessorUnclassifiedManifest(predecessor, current)
    ).toBe(false);
  });

  test("uses the validated bounded V3 evidence defaults for primary B decisions", () => {
    expect(source).toContain(
      "${LF_B_MAXIMUM_CORPUS_CANDIDATES_PER_DOCUMENT:-1}"
    );
    expect(source).toContain("${LF_B_MAXIMUM_REQUIREMENTS_PER_BATCH:-2}");
    expect(source).toContain("${LF_B_MAXIMUM_BATCH_CHARACTERS:-70000}");
    expect(source).not.toContain(
      "${LF_B_MAXIMUM_CORPUS_CANDIDATES_PER_DOCUMENT:-2}"
    );
    expect(source).not.toContain("${LF_B_MAXIMUM_BATCH_CHARACTERS:-120000}");
  });
});
