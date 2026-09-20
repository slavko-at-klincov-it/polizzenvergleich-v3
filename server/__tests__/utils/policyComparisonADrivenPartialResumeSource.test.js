const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  selectADrivenBDecisionResumeSource,
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

function bCandidate(root, name, value, batchIndices, attempts = 0) {
  const runRoot = path.join(root, name);
  const outputRoot = path.join(
    runRoot,
    "a-driven-v2",
    "b-requirement-decisions"
  );
  fs.mkdirSync(path.join(outputRoot, "batches"), { recursive: true });
  fs.mkdirSync(path.join(outputRoot, "attempts", "00000-ADRB-a"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(runRoot, "run-contract.private.json"),
    JSON.stringify(value)
  );
  fs.writeFileSync(
    path.join(outputRoot, "decision-plan.private.json"),
    JSON.stringify({ planSha256: "b-plan" })
  );
  for (const index of batchIndices)
    fs.writeFileSync(
      path.join(
        outputRoot,
        "batches",
        `${String(index).padStart(5, "0")}-ADRB-${index}.private.json`
      ),
      "{}"
    );
  for (let index = 0; index < attempts; index += 1)
    fs.writeFileSync(
      path.join(
        outputRoot,
        "attempts",
        "00000-ADRB-a",
        `cycle-001-attempt-${String(index + 1).padStart(3, "0")}.private.json`
      ),
      "{}"
    );
  return { runRoot, outputRoot };
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

  test("selects B resume independently from the strongest A predecessor", () => {
    const current = candidate(
      temporary,
      `resume-${"7".repeat(24)}`,
      contract("release-current"),
      0
    );
    const strongestA = candidate(
      temporary,
      `resume-${"8".repeat(24)}`,
      contract("release-a"),
      58
    );
    bCandidate(
      temporary,
      path.basename(strongestA.runRoot),
      contract("release-a"),
      Array.from({ length: 35 }, (_value, index) => index),
      20
    );
    const strongestB = bCandidate(
      temporary,
      `resume-${"9".repeat(24)}`,
      contract("release-b"),
      Array.from({ length: 71 }, (_value, index) => index),
      3
    );

    expect(
      selectADrivenPartialResumeSource({
        sessionRunsRoot: temporary,
        currentRunRoot: current.runRoot,
        currentContract: contract("release-current"),
      }).runRoot
    ).toBe(strongestA.runRoot);
    expect(
      selectADrivenBDecisionResumeSource({
        sessionRunsRoot: temporary,
        currentRunRoot: current.runRoot,
        currentContract: contract("release-current"),
      })
    ).toMatchObject({
      runRoot: strongestB.runRoot,
      contiguousCompletedBatchArtifacts: 71,
      attemptArtifacts: 3,
    });
  });

  test("scores only the contiguous B prefix and rejects incompatible candidates", () => {
    const current = bCandidate(
      temporary,
      `resume-${"a".repeat(24)}`,
      contract("release-current"),
      []
    );
    bCandidate(
      temporary,
      `resume-${"b".repeat(24)}`,
      contract("release-gap"),
      [0, 2, 3, 4],
      20
    );
    const contiguous = bCandidate(
      temporary,
      `resume-${"c".repeat(24)}`,
      contract("release-contiguous"),
      [0, 1],
      1
    );
    bCandidate(
      temporary,
      `resume-${"d".repeat(24)}`,
      contract("release-mismatch", 16_384),
      [0, 1, 2, 3, 4]
    );
    const outside = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-b-partial-resume-outside-")
    );
    fs.symlinkSync(outside, path.join(temporary, `resume-${"e".repeat(24)}`));

    expect(
      selectADrivenBDecisionResumeSource({
        sessionRunsRoot: temporary,
        currentRunRoot: current.runRoot,
        currentContract: contract("release-current"),
      })
    ).toMatchObject({
      runRoot: contiguous.runRoot,
      contiguousCompletedBatchArtifacts: 2,
    });
    fs.rmSync(outside, { recursive: true, force: true });
  });
});
