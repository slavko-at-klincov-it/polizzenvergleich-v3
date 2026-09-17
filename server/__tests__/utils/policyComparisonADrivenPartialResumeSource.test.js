const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  selectADrivenPartialResumeSource,
} = require("../../utils/policyComparison/aDrivenPartialResumeSource");

function contract(releaseId = "release-a", modelContext = 42_496) {
  return {
    schemaVersion: 6,
    releaseId,
    comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
    productProfile: { id: "LF_REFERENCE_A_DRIVEN_V2" },
    configuration: {
      model: "qwen/qwen3.6-35b-a3b",
      modelTokenLimit: modelContext,
      embeddingContract: { contractSha256: "a".repeat(64) },
    },
    documents: [
      {
        uuid: "a-1",
        side: "A",
        position: 0,
        role: "MAIN_POLICY",
        documentStatus: "FRAMEWORK_TERMS",
        originalName: "a.pdf",
        sha256: "b".repeat(64),
      },
    ],
  };
}

function candidate(root, name, value, batches, attempts = 0) {
  const runRoot = path.join(root, name);
  const planRoot = path.join(runRoot, "a-driven-v2", "a-plan");
  const outputRoot = path.join(runRoot, "a-driven-v2", "a-classification");
  fs.mkdirSync(path.join(outputRoot, "batches"), { recursive: true });
  fs.mkdirSync(path.join(outputRoot, "attempts", "0000-AUB-a"), {
    recursive: true,
  });
  fs.mkdirSync(planRoot, { recursive: true });
  fs.writeFileSync(
    path.join(runRoot, "run-contract.private.json"),
    JSON.stringify(value)
  );
  fs.writeFileSync(
    path.join(planRoot, "source-unit-plan.private.json"),
    JSON.stringify({ planSha256: "plan" })
  );
  fs.writeFileSync(
    path.join(planRoot, "classification-batches.private.json"),
    JSON.stringify({ batches: [] })
  );
  for (let index = 0; index < batches; index += 1)
    fs.writeFileSync(
      path.join(
        outputRoot,
        "batches",
        `${String(index).padStart(4, "0")}-AUB-${index}.private.json`
      ),
      "{}"
    );
  for (let index = 0; index < attempts; index += 1)
    fs.writeFileSync(
      path.join(
        outputRoot,
        "attempts",
        "0000-AUB-a",
        `cycle-0001-attempt-${String(index + 1).padStart(2, "0")}.private.json`
      ),
      "{}"
    );
  return { runRoot, planRoot, outputRoot };
}

describe("A-driven partial resume source", () => {
  let temporary;

  beforeEach(() => {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), "lf-a-partial-resume-"));
  });

  afterEach(() => fs.rmSync(temporary, { recursive: true, force: true }));

  test("selects the compatible predecessor with the most completed batches", () => {
    const current = candidate(
      temporary,
      `resume-${"1".repeat(24)}`,
      contract("release-current"),
      0,
      3
    );
    const strongest = candidate(
      temporary,
      `resume-${"2".repeat(24)}`,
      contract("release-old"),
      4,
      6
    );
    candidate(
      temporary,
      `resume-${"3".repeat(24)}`,
      contract("release-newer"),
      1,
      20
    );

    expect(
      selectADrivenPartialResumeSource({
        sessionRunsRoot: temporary,
        currentRunRoot: current.runRoot,
        currentContract: contract("release-current"),
      })
    ).toMatchObject({
      runRoot: strongest.runRoot,
      completedBatchArtifacts: 4,
      attemptArtifacts: 6,
    });
  });

  test("rejects mismatched model contracts and symlink candidates", () => {
    const current = candidate(
      temporary,
      `resume-${"4".repeat(24)}`,
      contract("release-current"),
      0,
      1
    );
    candidate(
      temporary,
      `resume-${"5".repeat(24)}`,
      contract("release-old", 16_384),
      9,
      9
    );
    const outside = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-partial-resume-outside-")
    );
    fs.symlinkSync(outside, path.join(temporary, `resume-${"6".repeat(24)}`));

    expect(
      selectADrivenPartialResumeSource({
        sessionRunsRoot: temporary,
        currentRunRoot: current.runRoot,
        currentContract: contract("release-current"),
      })
    ).toBeNull();
    fs.rmSync(outside, { recursive: true, force: true });
  });
});
