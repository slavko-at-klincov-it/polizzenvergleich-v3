const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  CATEGORY_ORDER,
  fixedSourcePaths,
} = require("../../../scripts/qa/ensureTargetedQaManifest.cjs");
const {
  OUTPUT_FILES,
  parseArguments,
  run,
} = require("../../../scripts/qa/materializeTargetedQaCategory.cjs");

const SOURCE_REPOSITORY = path.resolve(__dirname, "../../../..");

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "targeted-result-cli-"));
  const repositoryRoot = path.join(root, "repo");
  const sourcePaths = fixedSourcePaths(SOURCE_REPOSITORY);
  const fixturePaths = fixedSourcePaths(repositoryRoot);
  for (const categoryView of CATEGORY_ORDER) {
    copyFile(
      sourcePaths.catalogs[categoryView],
      fixturePaths.catalogs[categoryView]
    );
    for (const role of ["category", "triage", "effects", "hybridAddon"])
      copyFile(
        sourcePaths.prompts[categoryView][role],
        fixturePaths.prompts[categoryView][role]
      );
  }

  const documentUuid = "fixture-document-01";
  const categoryView = "ST";
  const baselineRoot = path.join(root, "baseline");
  const phaseRoot = path.join(root, "phase");
  const documentDirectory = path.join(baselineRoot, `DOC-01-${documentUuid}`);
  const phasePair = path.join(
    phaseRoot,
    `DOC-01-${documentUuid}`,
    categoryView
  );
  fs.mkdirSync(documentDirectory, { recursive: true });
  fs.mkdirSync(path.join(phasePair, "triage"), { recursive: true });
  fs.mkdirSync(path.join(phasePair, "effects"), { recursive: true });
  fs.writeFileSync(
    path.join(documentDirectory, "document.private.json"),
    '{"document":"artifact"}'
  );
  fs.writeFileSync(path.join(phasePair, "worksheet.private.json"), "{}\n");
  fs.writeFileSync(path.join(phasePair, "triage", "report.json"), "{}\n");
  fs.writeFileSync(
    path.join(phasePair, "triage", "materialized-triage.private.json"),
    "[]\n"
  );
  fs.writeFileSync(path.join(phasePair, "effects", "report.json"), "{}\n");
  fs.writeFileSync(
    path.join(phasePair, "effects", "materialized.private.json"),
    "{}\n"
  );
  fs.writeFileSync(
    path.join(phasePair, "effects", "selected-sources.private.json"),
    "[]\n"
  );
  const manifest = {
    documentMatrix: {
      documents: [{ uuid: documentUuid }],
    },
  };
  const manifestFile = path.join(root, "targeted-qa-manifest.private.json");
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  return {
    root,
    repositoryRoot,
    baselineRoot,
    phaseRoot,
    manifestFile,
    documentUuid,
    categoryView,
    output: path.join(root, "result"),
  };
}

function args(value) {
  return {
    baselineRoot: value.baselineRoot,
    phaseRoot: value.phaseRoot,
    manifest: value.manifestFile,
    expectedManifestDigestSha256: "d".repeat(64),
    documentUuid: value.documentUuid,
    categoryView: value.categoryView,
    output: value.output,
    model: "qa/model",
    modelTokenLimit: 42496,
  };
}

function expectedResult(value) {
  return {
    rows: [{ categoryId: "ST-01", reviewStatus: "BELEGT" }],
    requestedFields: { requirements: [{ requirementId: "ST-01" }] },
    answer: "| private targeted answer |\n",
    report: {
      contractId: "TARGETED_QA_CATEGORY_RESULT_V1",
      runKind: "TARGETED_QA_ONLY",
      categoryView: value.categoryView,
      document: { uuid: value.documentUuid },
      customerMaterializationAllowed: false,
    },
  };
}

function dependencies(value, calls) {
  return {
    repositoryRoot: value.repositoryRoot,
    releaseIdentityFn: () => "fixture-release",
    nodeVersion: "22.23.2",
    materializeResultFn: (input) => {
      calls.push(input);
      return expectedResult(value);
    },
  };
}

describe("materialize one targeted QA category CLI", () => {
  let value;

  beforeEach(() => {
    value = fixture();
  });

  afterEach(() => {
    fs.rmSync(value.root, { recursive: true, force: true });
  });

  test("uses fixed pair inputs and publishes only four private QA files", () => {
    const calls = [];

    const result = run(args(value), dependencies(value, calls));

    expect(result.reused).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      expectedManifestDigestSha256: "d".repeat(64),
      documentUuid: value.documentUuid,
      categoryView: value.categoryView,
      expectedExecution: {
        releaseId: "fixture-release",
        model: "qa/model",
        modelTokenLimit: 42496,
        nodeVersion: "22.23.2",
        hybridShadowEnabled: false,
      },
    });
    expect([...fs.readdirSync(value.output)].sort()).toEqual(
      Object.values(OUTPUT_FILES).sort()
    );
    expect(fs.statSync(value.output).mode & 0o777).toBe(0o700);
    for (const file of Object.values(OUTPUT_FILES))
      expect(fs.statSync(path.join(value.output, file)).mode & 0o777).toBe(
        0o600
      );
    expect(
      JSON.parse(
        fs.readFileSync(path.join(value.output, OUTPUT_FILES.report), "utf8")
      )
    ).toMatchObject({
      runKind: "TARGETED_QA_ONLY",
      customerMaterializationAllowed: false,
    });
  });

  test("resumes only byte-identical output without rewriting it", () => {
    const deps = dependencies(value, []);
    run(args(value), deps);
    const reportFile = path.join(value.output, OUTPUT_FILES.report);
    const before = fs.statSync(reportFile).mtimeMs;

    expect(run(args(value), deps).reused).toBe(true);
    expect(fs.statSync(reportFile).mtimeMs).toBe(before);

    fs.appendFileSync(reportFile, " ");
    expect(() => run(args(value), deps)).toThrow(
      "TARGETED_RESULT_CLI_EXISTING_OUTPUT_MISMATCH"
    );
  });

  test("accepts only the nine strict arguments and absolute filesystem paths", () => {
    expect(
      parseArguments([
        "--baselineRoot",
        value.baselineRoot,
        "--phaseRoot",
        value.phaseRoot,
        "--manifest",
        value.manifestFile,
        "--expectedManifestDigestSha256",
        "d".repeat(64),
        "--documentUuid",
        value.documentUuid,
        "--categoryView",
        value.categoryView,
        "--output",
        value.output,
        "--model",
        "qa/model",
        "--modelTokenLimit",
        "42496",
      ])
    ).toEqual(args(value));
    expect(() =>
      parseArguments([
        "--baselineRoot",
        "relative",
        "--phaseRoot",
        value.phaseRoot,
        "--manifest",
        value.manifestFile,
        "--expectedManifestDigestSha256",
        "d".repeat(64),
        "--documentUuid",
        value.documentUuid,
        "--categoryView",
        value.categoryView,
        "--output",
        value.output,
        "--model",
        "qa/model",
        "--modelTokenLimit",
        "42496",
      ])
    ).toThrow("TARGETED_RESULT_CLI_ABSOLUTE_PATH_REQUIRED");
    expect(() =>
      parseArguments([
        "--baselineRoot",
        value.baselineRoot,
        "--phaseRoot",
        value.phaseRoot,
        "--manifest",
        value.manifestFile,
        "--expectedManifestDigestSha256",
        "d".repeat(64),
        "--documentUuid",
        value.documentUuid,
        "--categoryView",
        value.categoryView,
        "--output",
        value.output,
        "--model",
        "qa/model",
        "--modelTokenLimit",
        "42496",
        "--promptFile",
        "/tmp/forbidden",
      ])
    ).toThrow("TARGETED_RESULT_CLI_ARGUMENT_UNKNOWN: promptFile");
  });
});
