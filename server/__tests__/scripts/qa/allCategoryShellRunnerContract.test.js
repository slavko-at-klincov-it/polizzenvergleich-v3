const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const RUNNER = path.join(REPOSITORY_ROOT, "run-all-categories-quality.command");
const SCRIPT_PATHS = [
  "server/scripts/qa/extractPolicyDocument.cjs",
  "server/scripts/qa/buildCategoryOccurrenceWorksheet.cjs",
  "server/scripts/qa/runVsCandidateTriage.cjs",
  "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
  "server/scripts/qa/materializeCategoryFullResult.cjs",
  "server/scripts/qa/summarizeAllCategoryRun.cjs",
];

const STUB_SCRIPT = `
const fs = require("fs");
const path = require("path");
function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}
const script = path.basename(__filename);
const output = argument("--output");
if (script === "extractPolicyDocument.cjs") {
  write(output, "{}");
} else if (script === "buildCategoryOccurrenceWorksheet.cjs") {
  write(output, "{}");
} else if (script === "runVsCandidateTriage.cjs") {
  write(path.join(output, "materialized-triage.private.json"), "[]");
  write(path.join(output, "report.json"), "{}");
} else if (script === "runPreparedEvidenceEvaluation.cjs") {
  write(path.join(output, "materialized.private.json"), "{}");
  write(path.join(output, "selected-sources.private.json"), "[]");
  write(path.join(output, "report.json"), "{}");
} else if (script === "materializeCategoryFullResult.cjs") {
  write(path.join(output, "answer.md"), argument("--categoryView"));
  write(path.join(output, "rows.private.json"), "[]");
  write(path.join(output, "report.json"), "{}");
} else if (script === "summarizeAllCategoryRun.cjs") {
  const root = argument("--root");
  write(path.join(root, "summary.md"), "complete");
  write(path.join(root, "report.json"), "{}");
}
`;

describe("all-category shell runner", () => {
  let root;

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  test("extracts once and materializes every configured category", () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "all-category-runner-test-"));
    const runtimeBin = path.join(root, ".runtime/node-v22.23.2/bin");
    fs.mkdirSync(runtimeBin, { recursive: true });
    fs.symlinkSync(process.execPath, path.join(runtimeBin, "node"));
    fs.copyFileSync(RUNNER, path.join(root, path.basename(RUNNER)));
    for (const relativePath of SCRIPT_PATHS) {
      const target = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, STUB_SCRIPT);
    }
    const pdf = path.join(root, "lf.pdf");
    const output = path.join(root, "output");
    fs.writeFileSync(pdf, "fixture");

    const result = spawnSync(
      "/bin/bash",
      [path.join(root, path.basename(RUNNER)), pdf, "FRAMEWORK_TERMS", output],
      { encoding: "utf8", env: { ...process.env, HOME: root } }
    );

    expect(result.status).toBe(0);
    expect(
      result.stdout.match(/Dokument einmalig vorbereiten/gu) || []
    ).toHaveLength(1);
    for (const category of ["VS", "FE", "LW", "ST", "EL", "HP", "VB", "WE"])
      expect(
        fs.existsSync(path.join(output, category, "result", "answer.md"))
      ).toBe(true);
    expect(fs.existsSync(path.join(output, "summary.md"))).toBe(true);

    const resumed = spawnSync(
      "/bin/bash",
      [path.join(root, path.basename(RUNNER)), pdf, "FRAMEWORK_TERMS", output],
      { encoding: "utf8", env: { ...process.env, HOME: root } }
    );
    expect(resumed.status).toBe(0);
    expect(resumed.stdout).toContain("ST – bereits vollständig, übersprungen");
  });
});
