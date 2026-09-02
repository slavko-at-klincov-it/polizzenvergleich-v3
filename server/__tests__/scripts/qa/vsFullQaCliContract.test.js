const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawnSync } = require("child_process");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

function run(script, args) {
  return spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, script), ...args],
    {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    }
  );
}

describe("VS full QA CLI contracts", () => {
  test("rejects target worksheets at both full materializer boundaries", () => {
    for (const script of [
      "server/scripts/qa/materializeCategoryFullResult.cjs",
      "server/scripts/qa/materializeVsFullResult.cjs",
    ]) {
      const source = fs.readFileSync(
        path.join(REPOSITORY_ROOT, script),
        "utf8"
      );
      expect(source).toContain(
        "TARGET_REQUIREMENT_WORKSHEET_FORBIDDEN_IN_FULL_MATERIALIZER"
      );
    }
  });

  test.each([
    "server/scripts/qa/buildVsOccurrenceWorksheet.cjs",
    "server/scripts/qa/runVsCandidateTriage.cjs",
    "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
    "server/scripts/qa/materializeVsFullResult.cjs",
    "server/scripts/qa/extractPolicyDocument.cjs",
    "server/scripts/qa/buildCategoryOccurrenceWorksheet.cjs",
    "server/scripts/qa/materializeCategoryFullResult.cjs",
    "server/scripts/qa/summarizeAllCategoryRun.cjs",
  ])("rejects unknown arguments in %s", (script) => {
    const result = run(script, ["--unknownArgument", "true"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unbekannte Argumente: unknownArgument");
  });

  test("candidate triage materializes a valid server-only result for an empty category", () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "policy-empty-candidate-triage-")
    );
    const worksheet = path.join(directory, "worksheet.private.json");
    const systemPrompt = path.join(directory, "system.md");
    const hybridPrompt = path.join(directory, "hybrid.md");
    const output = path.join(directory, "output");
    fs.writeFileSync(
      worksheet,
      JSON.stringify({
        schemaVersion: 1,
        candidateOnly: true,
        catalog: { categoryView: "VS" },
        requirements: [],
      })
    );
    fs.writeFileSync(systemPrompt, "System prompt");
    fs.writeFileSync(hybridPrompt, "Hybrid prompt");

    const result = run("server/scripts/qa/runVsCandidateTriage.cjs", [
      "--worksheet",
      worksheet,
      "--systemPromptFile",
      systemPrompt,
      "--hybridSystemPromptFile",
      hybridPrompt,
      "--controlMode",
      "technical-review",
      "--output",
      output,
      "--model",
      "qwen/qwen3.6-35b-a3b",
      "--modelTokenLimit",
      "42496",
    ]);

    expect(result.status).toBe(0);
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(output, "materialized-triage.private.json"),
          "utf8"
        )
      )
    ).toEqual([]);
    expect(
      JSON.parse(fs.readFileSync(path.join(output, "report.json"), "utf8"))
    ).toMatchObject({
      status: "TECHNICAL_PASS_REVIEW_REQUIRED",
      input: { candidateCount: 0, modelAttemptCount: 0 },
      validation: { formalPass: true, error: null },
      controls: { pass: true, results: [] },
    });
  });
});
