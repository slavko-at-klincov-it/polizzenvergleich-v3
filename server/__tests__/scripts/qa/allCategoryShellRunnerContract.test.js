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
const SUPPORT_SCRIPT_PATHS = [
  "server/scripts/qa/ensureAllCategoryRunManifest.cjs",
  "server/utils/policyAnalysis/runIdentity.js",
  "server/utils/policyComparison/productContract.js",
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

function createHarness() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "all-category-runner-test-")
  );
  const runtimeBin = path.join(root, ".runtime/node-v22.23.2/bin");
  fs.mkdirSync(runtimeBin, { recursive: true });
  fs.symlinkSync(process.execPath, path.join(runtimeBin, "node"));
  fs.copyFileSync(RUNNER, path.join(root, path.basename(RUNNER)));
  for (const relativePath of SCRIPT_PATHS) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, STUB_SCRIPT);
  }
  for (const relativePath of SUPPORT_SCRIPT_PATHS) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(REPOSITORY_ROOT, relativePath), target);
  }
  const fakeBin = path.join(root, "bin");
  fs.mkdirSync(fakeBin, { recursive: true });
  const fakeCurl = path.join(fakeBin, "curl");
  fs.writeFileSync(
    fakeCurl,
    '#!/bin/sh\nprintf \'{"data":[{"id":"%s"}]}\' "${FAKE_LOADED_MODEL:-qwen/qwen3.6-35b-a3b}"\n'
  );
  fs.chmodSync(fakeCurl, 0o755);
  const pdf = path.join(root, "lf.pdf");
  const output = path.join(root, "output");
  const home = path.join(root, "home");
  fs.writeFileSync(pdf, "fixture");
  return { root, pdf, output, home, fakeBin };
}

function runHarness(harness, overrides = {}) {
  const model = overrides.model || "qwen/qwen3.6-35b-a3b";
  const documentStatus = overrides.documentStatus || "FRAMEWORK_TERMS";
  return spawnSync(
    "/bin/bash",
    [
      path.join(harness.root, path.basename(RUNNER)),
      overrides.pdf || harness.pdf,
      documentStatus,
      harness.output,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: harness.home,
        PATH: `${harness.fakeBin}:${process.env.PATH}`,
        POLICY_FULL_MODEL: model,
        POLICY_FULL_MODEL_TOKEN_LIMIT: overrides.modelTokenLimit || "42496",
        NODE_ENV: overrides.nodeEnv || "test",
        POLICY_RUN_RELEASE_ID: overrides.releaseId || "fixture-release",
        FAKE_LOADED_MODEL: overrides.loadedModel || model,
      },
    }
  );
}

describe("all-category shell runner", () => {
  let harness;

  afterEach(() => {
    if (harness) fs.rmSync(harness.root, { recursive: true, force: true });
  });

  test("extracts once and materializes the five customer categories", () => {
    harness = createHarness();

    const result = runHarness(harness);

    expect(result.status).toBe(0);
    expect(
      result.stdout.match(/Dokument einmalig vorbereiten/gu) || []
    ).toHaveLength(1);
    for (const category of ["VS", "FE", "LW", "ST", "EL"])
      expect(
        fs.existsSync(
          path.join(harness.output, category, "result", "answer.md")
        )
      ).toBe(true);
    for (const category of ["HP", "VB", "WE"])
      expect(fs.existsSync(path.join(harness.output, category))).toBe(false);
    expect(fs.existsSync(path.join(harness.output, "summary.md"))).toBe(true);
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(harness.output, "manifest.private.json"),
        "utf8"
      )
    );
    expect(manifest).toMatchObject({
      runKind: "ALL_CATEGORIES_QUALITY",
      releaseId: "fixture-release",
      productProfile: {
        id: "CUSTOMER_CORE_5_V1",
        categoryViews: ["VS", "FE", "LW", "ST", "EL"],
        expectedRowCount: 224,
      },
      configuration: {
        model: "qwen/qwen3.6-35b-a3b",
        documentStatus: "FRAMEWORK_TERMS",
      },
    });

    const resumed = runHarness(harness);
    expect(resumed.status).toBe(0);
    expect(resumed.stdout).toContain("ST – bereits vollständig, übersprungen");
    expect(resumed.stdout).toContain("Resume-Kontext bestätigt");
  });

  test.each([
    ["release", { releaseId: "other-release" }, "releaseId"],
    ["model", { model: "other-model", loadedModel: "other-model" }, "model"],
    ["model token limit", { modelTokenLimit: "32000" }, "modelTokenLimit"],
    ["document status", { documentStatus: "ACTIVE" }, "documentStatus"],
  ])("rejects resume when %s differs", (_label, overrides, mismatch) => {
    harness = createHarness();
    expect(runHarness(harness).status).toBe(0);

    const resumed = runHarness(harness, overrides);

    expect(resumed.status).toBe(1);
    expect(resumed.stderr).toContain("Unsicherer Resume abgelehnt");
    expect(resumed.stderr).toContain(mismatch);
  });

  test("rejects resume when PDF contents differ", () => {
    harness = createHarness();
    expect(runHarness(harness).status).toBe(0);
    fs.writeFileSync(harness.pdf, "changed fixture");

    const resumed = runHarness(harness);

    expect(resumed.status).toBe(1);
    expect(resumed.stderr).toContain("pdfSha256");
  });

  test("rejects resume when the persisted product profile differs", () => {
    harness = createHarness();
    expect(runHarness(harness).status).toBe(0);
    const manifestFile = path.join(
      harness.output,
      "manifest.private.json"
    );
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    manifest.productProfile.categoryViews.push("HP");
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));

    const resumed = runHarness(harness);

    expect(resumed.status).toBe(1);
    expect(resumed.stderr).toContain("productProfile");
  });

  test("does not skip a category when its rows artifact is missing", () => {
    harness = createHarness();
    expect(runHarness(harness).status).toBe(0);
    fs.rmSync(path.join(harness.output, "ST/result/rows.private.json"));

    const resumed = runHarness(harness);

    expect(resumed.status).toBe(0);
    expect(resumed.stdout).not.toContain(
      "ST – bereits vollständig, übersprungen"
    );
    expect(
      fs.existsSync(path.join(harness.output, "ST/result/rows.private.json"))
    ).toBe(true);
  });

  test("rejects an existing output without a run manifest", () => {
    harness = createHarness();
    fs.mkdirSync(harness.output, { recursive: true });
    fs.writeFileSync(path.join(harness.output, "partial.txt"), "legacy data");

    const result = runHarness(harness);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("enthält Daten, aber kein Manifest");
  });

  test("fails before a run when the requested model is not loaded", () => {
    harness = createHarness();

    const result = runHarness(harness, { loadedModel: "different-model" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Angeforderte Modelle sind nicht geladen");
    expect(result.stderr).toContain("qwen/qwen3.6-35b-a3b");
    expect(fs.existsSync(harness.output)).toBe(false);
  });

  test("rejects a forged release identity outside the test harness", () => {
    harness = createHarness();

    const result = runHarness(harness, { nodeEnv: "production" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "POLICY_RUN_RELEASE_ID ist ausschließlich im Test-Harness zulässig"
    );
  });

  test("rejects a concurrent run through the global atomic lock", () => {
    harness = createHarness();
    const lock = path.join(
      harness.home,
      "Library/Application Support/at.klincov.polizzenvergleich-v3/QA/.all-categories-quality.lock"
    );
    fs.mkdirSync(lock, { recursive: true });
    fs.writeFileSync(path.join(lock, "owner.private.txt"), "pid=123 output=x");

    const result = runHarness(harness);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("globale Modellsperre");
    expect(fs.existsSync(harness.output)).toBe(false);
  });
});
