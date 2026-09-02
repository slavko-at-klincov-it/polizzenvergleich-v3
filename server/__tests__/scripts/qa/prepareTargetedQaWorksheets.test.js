const fs = require("fs");
const os = require("os");
const path = require("path");
const { sha256 } = require("../../../utils/policyAnalysis/runIdentity");
const {
  CATEGORY_ORDER,
  fixedSourcePaths,
} = require("../../../scripts/qa/ensureTargetedQaManifest.cjs");
const {
  EXPECTED_PAIR_COUNT,
  SUMMARY_FILENAME,
  parseArguments,
  run,
} = require("../../../scripts/qa/prepareTargetedQaWorksheets.cjs");

const SOURCE_REPOSITORY = path.resolve(__dirname, "../../../..");
const BASELINE_RUN_ID = "PAV8-03D-VS14-2D964B45-20260902-073000";

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, fs.readFileSync(source));
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "targeted-worksheets-"));
  const repositoryRoot = path.join(root, "repo");
  const sourcePaths = fixedSourcePaths(SOURCE_REPOSITORY);
  const fixturePaths = fixedSourcePaths(repositoryRoot);
  for (const categoryView of CATEGORY_ORDER) {
    copyFile(
      sourcePaths.catalogs[categoryView],
      fixturePaths.catalogs[categoryView]
    );
    for (const promptRole of ["category", "triage", "effects", "hybridAddon"])
      copyFile(
        sourcePaths.prompts[categoryView][promptRole],
        fixturePaths.prompts[categoryView][promptRole]
      );
  }

  const baselineRoot = path.join(root, BASELINE_RUN_ID);
  const packageDirectory = path.join(baselineRoot, "PACKAGE-COMPARISON");
  fs.mkdirSync(packageDirectory, { recursive: true });
  const releaseId = "fixture-baseline-release";
  const documents = Array.from({ length: 10 }, (_, index) => ({
    uuid: `fixture-uuid-${String(index + 1).padStart(2, "0")}`,
    side: index === 0 ? "A" : "B",
    position: index === 0 ? 0 : index - 1,
    documentStatus: index === 0 ? "FRAMEWORK_TERMS" : "PROPOSAL",
    sha256: sha256(Buffer.from(`document-${index + 1}`)),
  }));
  const matrixDocuments = [];
  documents.forEach((document, index) => {
    const directoryName = `DOC-${String(index + 1).padStart(2, "0")}-${document.uuid}`;
    const directory = path.join(baselineRoot, directoryName);
    fs.mkdirSync(directory);
    const artifactBytes = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        fingerprint: document.sha256,
        document: { sourceDocumentId: document.sha256 },
      })
    );
    fs.writeFileSync(
      path.join(directory, "document.private.json"),
      artifactBytes
    );
    const primaryManifestBytes = Buffer.from(
      JSON.stringify({
        releaseId,
        configuration: { documentStatus: document.documentStatus },
        document: { sha256: document.sha256 },
      })
    );
    fs.writeFileSync(
      path.join(directory, "manifest.private.json"),
      primaryManifestBytes
    );
    document.primaryManifestSha256 = sha256(primaryManifestBytes);
    matrixDocuments.push({
      ...document,
      primaryManifestSha256: document.primaryManifestSha256,
      documentArtifactSha256: sha256(artifactBytes),
    });
    for (const categoryView of CATEGORY_ORDER) {
      const categoryDirectory = path.join(directory, categoryView);
      fs.mkdirSync(categoryDirectory);
      fs.writeFileSync(
        path.join(categoryDirectory, "worksheet.private.json"),
        JSON.stringify({
          documentUuid: document.uuid,
          categoryView,
          full: true,
        })
      );
    }
  });
  const packageContract = { releaseId, documents };
  const packageContractBytes = Buffer.from(JSON.stringify(packageContract));
  fs.writeFileSync(
    path.join(packageDirectory, "package-contract.private.json"),
    packageContractBytes
  );

  const manifest = {
    schemaVersion: 3,
    contractId: "TARGETED_QA_MANIFEST_V3",
    manifestDigestSha256: "d".repeat(64),
    trustAnchor: {
      packageContractFileSha256: sha256(packageContractBytes),
    },
    documentMatrix: { documents: matrixDocuments },
  };
  const manifestFile = path.join(root, "targeted-qa-manifest.private.json");
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  return {
    root,
    repositoryRoot,
    baselineRoot,
    manifest,
    manifestFile,
    output: path.join(root, "prepared"),
    documents,
  };
}

function args(value) {
  return {
    baselineRoot: value.baselineRoot,
    manifest: value.manifestFile,
    expectedManifestDigestSha256: value.manifest.manifestDigestSha256,
    output: value.output,
    model: "qa/model",
    modelTokenLimit: 42496,
  };
}

function dependencies(value, calls) {
  return {
    repositoryRoot: value.repositoryRoot,
    releaseIdentityFn: () => "fixture-current-release",
    nodeVersion: "22.23.2",
    assertManifestFn: (
      manifest,
      { expectedManifestDigestSha256, expectedExecution }
    ) => {
      if (
        manifest.schemaVersion !== 3 ||
        manifest.contractId !== "TARGETED_QA_MANIFEST_V3" ||
        manifest.manifestDigestSha256 !== expectedManifestDigestSha256
      )
        throw new Error("FIXTURE_MANIFEST_ASSERTION_FAILED");
      if (
        expectedExecution.releaseId !== "fixture-current-release" ||
        expectedExecution.model !== "qa/model" ||
        expectedExecution.modelTokenLimit !== 42496 ||
        expectedExecution.nodeVersion !== "22.23.2" ||
        Object.keys(expectedExecution.promptSha256ByCategory).length !== 5
      )
        throw new Error("FIXTURE_EXECUTION_ASSERTION_FAILED");
    },
    buildTargetedWorksheetFn: (input) => {
      calls.push(input);
      return {
        worksheet: {
          schemaVersion: 3,
          documentUuid: input.documentUuid,
          categoryView: input.categoryView,
          targetRequirementSelection: { fixture: true },
        },
        provenance: {
          contractId: "TARGETED_QA_WORKSHEET_BUILD_V1",
          documentUuid: input.documentUuid,
          categoryView: input.categoryView,
        },
      };
    },
  };
}

function recursiveFiles(directory, prefix = "") {
  return fs.readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    const relative = prefix ? path.join(prefix, name) : name;
    return fs.statSync(absolute).isDirectory()
      ? recursiveFiles(absolute, relative)
      : [relative];
  });
}

describe("prepare targeted QA worksheets CLI", () => {
  let value;

  beforeEach(() => {
    value = fixture();
  });

  afterEach(() => {
    fs.rmSync(value.root, { recursive: true, force: true });
  });

  test("prepares exactly 50 private worksheet/provenance pairs and summary", () => {
    const calls = [];
    const result = run(args(value), dependencies(value, calls));

    expect(result.reused).toBe(false);
    expect(calls).toHaveLength(EXPECTED_PAIR_COUNT);
    expect(
      calls.map(
        ({ documentUuid, categoryView }) => `${documentUuid}:${categoryView}`
      )
    ).toEqual(
      value.documents.flatMap((document) =>
        CATEGORY_ORDER.map((categoryView) => `${document.uuid}:${categoryView}`)
      )
    );
    expect(result.summary).toMatchObject({
      contractId: "TARGETED_QA_WORKSHEET_PREPARATION_V1",
      runKind: "TARGETED_QA_ONLY",
      documentCount: 10,
      categoryCount: 5,
      pairCount: 50,
      manifestFileSha256: sha256(fs.readFileSync(value.manifestFile)),
    });
    expect(recursiveFiles(value.output)).toHaveLength(101);
    expect(fs.readdirSync(value.output)).toContain(SUMMARY_FILENAME);
    expect(fs.statSync(value.output).mode & 0o777).toBe(0o700);
    for (const relative of recursiveFiles(value.output))
      expect(fs.statSync(path.join(value.output, relative)).mode & 0o777).toBe(
        0o600
      );
  });

  test("reuses byte-identical output without rewrite and rejects drift", () => {
    const deps = dependencies(value, []);
    const first = run(args(value), deps);
    const summaryFile = path.join(first.output, SUMMARY_FILENAME);
    const before = fs.statSync(summaryFile).mtimeMs;
    const second = run(args(value), deps);
    expect(second.reused).toBe(true);
    expect(fs.statSync(summaryFile).mtimeMs).toBe(before);

    fs.appendFileSync(summaryFile, " ");
    expect(() => run(args(value), deps)).toThrow(
      "TARGETED_WORKSHEET_EXISTING_OUTPUT_MISMATCH"
    );
  });

  test("publishes only after the complete staging tree is durable", () => {
    const failingFs = Object.create(fs);
    failingFs.renameSync = () => {
      throw new Error("FIXTURE_PUBLISH_FAILED");
    };

    expect(() =>
      run(args(value), {
        ...dependencies(value, []),
        fsImpl: failingFs,
      })
    ).toThrow("FIXTURE_PUBLISH_FAILED");
    expect(fs.existsSync(value.output)).toBe(false);
    expect(
      fs
        .readdirSync(value.root)
        .filter((name) => name.startsWith(".prepared.staging-"))
    ).toHaveLength(1);
    expect(fs.existsSync(`${value.output}.publish-claim`)).toBe(false);
  });

  test("rejects missing and symlinked full baseline worksheets", () => {
    const documentDirectory = path.join(
      value.baselineRoot,
      `DOC-01-${value.documents[0].uuid}`,
      "VS"
    );
    const worksheet = path.join(documentDirectory, "worksheet.private.json");
    fs.unlinkSync(worksheet);
    expect(() => run(args(value), dependencies(value, []))).toThrow(
      "TARGETED_WORKSHEET_FULL_WORKSHEET_INVALID"
    );

    fs.writeFileSync(worksheet, "{}");
    const external = path.join(value.root, "external-worksheet.json");
    fs.writeFileSync(external, "{}");
    fs.unlinkSync(worksheet);
    fs.symlinkSync(external, worksheet);
    expect(() => run(args(value), dependencies(value, []))).toThrow(
      "TARGETED_WORKSHEET_FULL_WORKSHEET_INVALID"
    );
  });

  test("accepts only the six strict absolute CLI arguments", () => {
    expect(
      parseArguments([
        "--baselineRoot",
        value.baselineRoot,
        "--manifest",
        value.manifestFile,
        "--expectedManifestDigestSha256",
        value.manifest.manifestDigestSha256,
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
        "--manifest",
        value.manifestFile,
        "--expectedManifestDigestSha256",
        value.manifest.manifestDigestSha256,
        "--output",
        value.output,
        "--model",
        "qa/model",
        "--modelTokenLimit",
        "42496",
      ])
    ).toThrow("TARGETED_WORKSHEET_ABSOLUTE_PATH_REQUIRED");
    expect(() =>
      parseArguments([
        "--baselineRoot",
        value.baselineRoot,
        "--manifest",
        value.manifestFile,
        "--expectedManifestDigestSha256",
        value.manifest.manifestDigestSha256,
        "--output",
        value.output,
        "--model",
        "qa/model",
        "--modelTokenLimit",
        "42496",
        "--repository",
        "/tmp/override",
      ])
    ).toThrow("TARGETED_WORKSHEET_ARGUMENT_UNKNOWN: repository");
  });
});
