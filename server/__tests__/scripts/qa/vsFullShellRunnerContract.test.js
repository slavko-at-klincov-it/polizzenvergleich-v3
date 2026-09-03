const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const RUNNER = path.join(REPOSITORY_ROOT, "run-vs-full-quality-ab.command");
const SCRIPT_PATHS = [
  "server/scripts/qa/pdfProvenanceLiveRun.cjs",
  "server/scripts/qa/buildVsOccurrenceWorksheet.cjs",
  "server/scripts/qa/runVsCandidateTriage.cjs",
  "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
  "server/scripts/qa/materializeVsFullResult.cjs",
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
if (script === "pdfProvenanceLiveRun.cjs") {
  write(path.join(output, "answer.md"), "legacy");
  write(path.join(output, "report.json"), JSON.stringify({ status: "REVISE" }));
} else if (script === "buildVsOccurrenceWorksheet.cjs") {
  write(output, "{}");
} else if (script === "runVsCandidateTriage.cjs") {
  write(path.join(output, "materialized-triage.private.json"), "{}");
  write(path.join(output, "report.json"), "{}");
} else if (script === "runPreparedEvidenceEvaluation.cjs") {
  write(path.join(output, "materialized.private.json"), "{}");
  write(path.join(output, "selected-sources.private.json"), "[]");
  write(path.join(output, "report.json"), "{}");
} else if (script === "materializeVsFullResult.cjs") {
  const documentKey = argument("--documentKey");
  const status =
    process.env.FAKE_REVISE_DOCUMENT === documentKey
      ? "REVISE"
      : "TECHNICAL_PASS_REVIEW_REQUIRED";
  write(path.join(output, "answer.md"), documentKey);
  write(path.join(output, "comparison.md"), documentKey);
  write(path.join(output, "report.json"), JSON.stringify({ status }));
  if (status === "REVISE") process.exitCode = 2;
}
`;

function createHarness() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "vs-full-shell-runner-test-")
  );
  const runtimeBin = path.join(root, ".runtime/node-v22.23.2/bin");
  fs.mkdirSync(runtimeBin, { recursive: true });
  fs.symlinkSync(process.execPath, path.join(runtimeBin, "node"));
  fs.copyFileSync(RUNNER, path.join(root, "run-vs-full-quality-ab.command"));
  for (const relativePath of SCRIPT_PATHS) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, STUB_SCRIPT);
  }
  const lfPdf = path.join(root, "lf.pdf");
  const wevigPdf = path.join(root, "wevig.pdf");
  fs.writeFileSync(lfPdf, "lf");
  fs.writeFileSync(wevigPdf, "wevig");
  const home = path.join(root, "home");
  const output = path.join(
    home,
    "Library/Application Support/at.klincov.polizzenvergleich-v3/QA",
    "VS-FULL-QUALITY-AB-TEST"
  );
  return { root, home, output, lfPdf, wevigPdf };
}

function runHarness(harness, extraEnvironment = {}) {
  return spawnSync(
    "/bin/bash",
    [
      path.join(harness.root, "run-vs-full-quality-ab.command"),
      harness.lfPdf,
      harness.wevigPdf,
      harness.output,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: harness.home,
        VS_FULL_EMBEDDING_MODEL: "fixture/embedding-model",
        ...extraEnvironment,
      },
    }
  );
}

describe("VS full shell runner", () => {
  let harness;

  afterEach(() => {
    if (harness) fs.rmSync(harness.root, { recursive: true, force: true });
  });

  test("finishes WEVIG after an LF materialization review exit", () => {
    harness = createHarness();

    const result = runHarness(harness, { FAKE_REVISE_DOCUMENT: "LF" });

    expect(result.status).toBe(2);
    expect(
      fs.existsSync(
        path.join(harness.output, "LF/B-v3.3.0-full/result/report.json")
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(harness.output, "WEVIG/B-v3.3.0-full/result/report.json")
      )
    ).toBe(true);
    expect(result.stdout).toContain("WEVIG: 36-Zeilen-Deltabericht");
    expect(result.stderr).toContain("FERTIG MIT REVIEW_REQUIRED");
  });

  test("reuses a complete LF result and calculates only missing WEVIG", () => {
    harness = createHarness();
    const lfResult = path.join(harness.output, "LF/B-v3.3.0-full/result");
    fs.mkdirSync(lfResult, { recursive: true });
    fs.writeFileSync(
      path.join(lfResult, "report.json"),
      JSON.stringify({ status: "REVISE" })
    );
    fs.writeFileSync(path.join(lfResult, "answer.md"), "existing LF");

    const result = runHarness(harness);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain(
      "LF: bereits vollständig – übersprungen (REVISE)"
    );
    expect(result.stdout).toContain(
      "WEVIG: A – v3.2.1-kompatibles Legacy-Replay"
    );
    expect(
      fs.existsSync(
        path.join(harness.output, "WEVIG/B-v3.3.0-full/result/report.json")
      )
    ).toBe(true);
  });
});
