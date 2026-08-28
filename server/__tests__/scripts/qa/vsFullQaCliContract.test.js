const path = require("path");
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
  test.each([
    "server/scripts/qa/buildVsOccurrenceWorksheet.cjs",
    "server/scripts/qa/runVsCandidateTriage.cjs",
    "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
    "server/scripts/qa/materializeVsFullResult.cjs",
  ])("rejects unknown arguments in %s", (script) => {
    const result = run(script, ["--unknownArgument", "true"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unbekannte Argumente: unknownArgument");
  });
});
