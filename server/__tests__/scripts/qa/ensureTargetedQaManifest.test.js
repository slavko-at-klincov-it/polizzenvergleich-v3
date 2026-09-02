const fs = require("fs");
const os = require("os");
const path = require("path");
const { sha256 } = require("../../../utils/policyAnalysis/runIdentity");
const {
  CATEGORY_ORDER,
  EXPECTED_QA_REGISTRY_SHA256,
  MANIFEST_FILENAME,
  fixedSourcePaths,
  parseArguments,
  run,
} = require("../../../scripts/qa/ensureTargetedQaManifest.cjs");

const SOURCE_REPOSITORY = path.resolve(__dirname, "../../../..");
const BASELINE_RUN_ID = "PAV8-03D-VS14-2D964B45-20260902-073000";

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, fs.readFileSync(source));
}

function packageDocuments() {
  return Array.from({ length: 10 }, (_, index) => ({
    uuid: `fixture-uuid-${String(index + 1).padStart(2, "0")}`,
    sha256: ["a", "b", "c", "d", "e"][index % 5].repeat(64),
    documentStatus: index === 0 ? "FRAMEWORK_TERMS" : "PROPOSAL",
  }));
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "targeted-qa-cli-"));
  const repositoryRoot = path.join(root, "repo");
  const sourcePaths = fixedSourcePaths(SOURCE_REPOSITORY);
  const fixturePaths = fixedSourcePaths(repositoryRoot);
  copyFile(sourcePaths.registry, fixturePaths.registry);
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
  const documents = packageDocuments();
  const documentArtifactBytesByUuid = {};
  const releaseId = "fixture-baseline-release";
  documents.forEach((document, index) => {
    const directory = path.join(
      baselineRoot,
      `DOC-${String(index + 1).padStart(2, "0")}-${document.uuid}`
    );
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
    documentArtifactBytesByUuid[document.uuid] = artifactBytes;
  });
  fs.writeFileSync(
    path.join(packageDirectory, "package-contract.private.json"),
    JSON.stringify({ releaseId, documents })
  );
  fs.writeFileSync(
    path.join(packageDirectory, "comparison.private.json"),
    "comparison-bytes"
  );
  return {
    root,
    repositoryRoot,
    baselineRoot,
    output: path.join(root, "output"),
    fixturePaths,
    documents,
    documentArtifactBytesByUuid,
  };
}

function runArguments(value) {
  return {
    baselineRoot: value.baselineRoot,
    output: value.output,
    model: "qa/model",
    modelTokenLimit: 42496,
  };
}

function dependencies(value, capture) {
  const buildManifestFn = (inputs) => {
    capture.push(inputs);
    const contract = {
      execution: inputs.execution,
      registrySha256: sha256(inputs.qaRegistryBytes),
      packageSha256: sha256(inputs.packageContractBytes),
      comparisonSha256: sha256(inputs.baselineComparisonBytes),
      documentArtifactSha256ByUuid: Object.fromEntries(
        Object.entries(inputs.documentArtifactBytesByUuid).map(
          ([uuid, artifactBytes]) => [uuid, sha256(artifactBytes)]
        )
      ),
      catalogSha256ByCategory: Object.fromEntries(
        CATEGORY_ORDER.map((categoryView) => [
          categoryView,
          sha256(inputs.catalogBytesByCategory[categoryView]),
        ])
      ),
    };
    return {
      ...contract,
      manifestDigestSha256: sha256(JSON.stringify(contract)),
    };
  };
  const assertManifestFn = (
    manifest,
    { expectedManifestDigestSha256, expectedExecution }
  ) => {
    if (manifest.manifestDigestSha256 !== expectedManifestDigestSha256)
      throw new Error("EXPECTED_MANIFEST_MISMATCH");
    if (
      JSON.stringify(manifest.execution) !== JSON.stringify(expectedExecution)
    )
      throw new Error("EXPECTED_EXECUTION_MISMATCH");
  };
  return {
    repositoryRoot: value.repositoryRoot,
    buildManifestFn,
    assertManifestFn,
    releaseIdentityFn: () => "fixture-release",
    nodeVersion: "22.23.2",
  };
}

describe("ensure targeted QA manifest CLI", () => {
  let value;

  beforeEach(() => {
    value = fixture();
  });

  afterEach(() => {
    fs.rmSync(value.root, { recursive: true, force: true });
  });

  test("uses fixed repo sources and binds all four prompt roles", () => {
    const capture = [];
    const result = run(runArguments(value), dependencies(value, capture));

    expect(result.reused).toBe(false);
    expect(sha256(capture[0].qaRegistryBytes)).toBe(
      EXPECTED_QA_REGISTRY_SHA256
    );
    expect(capture[0].execution).toMatchObject({
      releaseId: "fixture-release",
      model: "qa/model",
      modelTokenLimit: 42496,
      nodeVersion: "22.23.2",
      hybridShadowEnabled: false,
    });
    for (const categoryView of CATEGORY_ORDER) {
      expect(capture[0].catalogBytesByCategory[categoryView]).toEqual(
        fs.readFileSync(value.fixturePaths.catalogs[categoryView])
      );
      for (const promptRole of ["category", "triage", "effects", "hybridAddon"])
        expect(
          capture[0].execution.promptSha256ByCategory[categoryView][promptRole]
        ).toBe(
          sha256(
            fs.readFileSync(
              value.fixturePaths.prompts[categoryView][promptRole]
            )
          )
        );
    }
    expect(capture[0].execution.promptSha256ByCategory.VS.triage).not.toBe(
      capture[0].execution.promptSha256ByCategory.FE.triage
    );
    expect(capture[0].execution.promptSha256ByCategory.VS.hybridAddon).toBe(
      capture[0].execution.promptSha256ByCategory.FE.hybridAddon
    );
    expect(Object.keys(capture[0].documentArtifactBytesByUuid)).toEqual(
      value.documents.map(({ uuid }) => uuid)
    );
    for (const document of value.documents)
      expect(capture[0].documentArtifactBytesByUuid[document.uuid]).toEqual(
        value.documentArtifactBytesByUuid[document.uuid]
      );
    expect(fs.statSync(result.manifestFile).mode & 0o777).toBe(0o600);
  });

  test("rejects missing, extra and ambiguously numbered document directories", () => {
    const missing = path.join(
      value.baselineRoot,
      `DOC-01-${value.documents[0].uuid}`
    );
    fs.renameSync(missing, `${missing}.missing`);
    expect(() => run(runArguments(value), dependencies(value, []))).toThrow(
      "TARGETED_QA_DOCUMENT_DIRECTORY_MATRIX_INVALID"
    );
    fs.renameSync(`${missing}.missing`, missing);

    const extra = path.join(value.baselineRoot, "DOC-11-unexpected");
    fs.mkdirSync(extra);
    expect(() => run(runArguments(value), dependencies(value, []))).toThrow(
      "TARGETED_QA_DOCUMENT_DIRECTORY_MATRIX_INVALID"
    );
    fs.rmdirSync(extra);

    const expected = path.join(
      value.baselineRoot,
      `DOC-02-${value.documents[1].uuid}`
    );
    const wrongNumber = path.join(
      value.baselineRoot,
      `DOC-03-${value.documents[1].uuid}`
    );
    fs.renameSync(expected, wrongNumber);
    expect(() => run(runArguments(value), dependencies(value, []))).toThrow(
      "TARGETED_QA_DOCUMENT_DIRECTORY_MATRIX_INVALID"
    );
  });

  test("rejects symlinked document directories and artifacts", () => {
    const directory = path.join(
      value.baselineRoot,
      `DOC-01-${value.documents[0].uuid}`
    );
    const movedDirectory = path.join(value.root, "moved-document-directory");
    fs.renameSync(directory, movedDirectory);
    fs.symlinkSync(movedDirectory, directory, "dir");
    expect(() => run(runArguments(value), dependencies(value, []))).toThrow(
      "TARGETED_QA_DOCUMENT_DIRECTORY_INVALID"
    );
    fs.unlinkSync(directory);
    fs.renameSync(movedDirectory, directory);

    const artifact = path.join(directory, "document.private.json");
    const movedArtifact = path.join(value.root, "moved-document.private.json");
    fs.renameSync(artifact, movedArtifact);
    fs.symlinkSync(movedArtifact, artifact);
    expect(() => run(runArguments(value), dependencies(value, []))).toThrow(
      "TARGETED_QA_DOCUMENT_ARTIFACT_INVALID"
    );
  });

  test("rejects primary manifest hash and identity drift", () => {
    const directory = path.join(
      value.baselineRoot,
      `DOC-01-${value.documents[0].uuid}`
    );
    const primaryManifest = path.join(directory, "manifest.private.json");
    fs.appendFileSync(primaryManifest, " ");
    expect(() => run(runArguments(value), dependencies(value, []))).toThrow(
      "TARGETED_QA_PRIMARY_MANIFEST_SHA_MISMATCH"
    );

    const identityValue = fixture();
    const identityDirectory = path.join(
      identityValue.baselineRoot,
      `DOC-01-${identityValue.documents[0].uuid}`
    );
    const identityManifest = path.join(
      identityDirectory,
      "manifest.private.json"
    );
    const identity = JSON.parse(fs.readFileSync(identityManifest, "utf8"));
    identity.document.sha256 = "0".repeat(64);
    const identityBytes = Buffer.from(JSON.stringify(identity));
    fs.writeFileSync(identityManifest, identityBytes);
    const packageFile = path.join(
      identityValue.baselineRoot,
      "PACKAGE-COMPARISON/package-contract.private.json"
    );
    const packageContract = JSON.parse(fs.readFileSync(packageFile, "utf8"));
    packageContract.documents[0].primaryManifestSha256 = sha256(identityBytes);
    fs.writeFileSync(packageFile, JSON.stringify(packageContract));
    expect(() =>
      run(runArguments(identityValue), dependencies(identityValue, []))
    ).toThrow("TARGETED_QA_PRIMARY_MANIFEST_IDENTITY_MISMATCH");
  });

  test("rejects registry drift before calling the builder", () => {
    fs.appendFileSync(value.fixturePaths.registry, " ");
    const capture = [];

    expect(() =>
      run(runArguments(value), dependencies(value, capture))
    ).toThrow("TARGETED_QA_REGISTRY_SHA_MISMATCH");
    expect(capture).toHaveLength(0);
    expect(fs.existsSync(value.output)).toBe(false);
  });

  test("reuses identically without rewrite and rejects prompt drift", () => {
    const capture = [];
    const deps = dependencies(value, capture);
    const first = run(runArguments(value), deps);
    const original = fs.readFileSync(first.manifestFile);
    const originalMtime = fs.statSync(first.manifestFile).mtimeMs;
    const second = run(runArguments(value), deps);

    expect(second.reused).toBe(true);
    expect(fs.readFileSync(second.manifestFile)).toEqual(original);
    expect(fs.statSync(second.manifestFile).mtimeMs).toBe(originalMtime);

    fs.appendFileSync(value.fixturePaths.prompts.VS.category, "\nTamper");
    expect(() => run(runArguments(value), deps)).toThrow(
      "EXPECTED_MANIFEST_MISMATCH"
    );
  });

  test("rejects an existing output without the fixed manifest", () => {
    fs.mkdirSync(value.output, { recursive: true });

    expect(() => run(runArguments(value), dependencies(value, []))).toThrow(
      "TARGETED_QA_OUTPUT_WITHOUT_MANIFEST"
    );
  });

  test("rejects relative paths and physical output inside trusted inputs", () => {
    expect(() =>
      parseArguments([
        "--baselineRoot",
        "relative-baseline",
        "--output",
        value.output,
        "--model",
        "qa/model",
        "--modelTokenLimit",
        "42496",
      ])
    ).toThrow("TARGETED_QA_ABSOLUTE_PATH_REQUIRED");

    expect(() =>
      run(
        {
          ...runArguments(value),
          output: path.join(value.repositoryRoot, "qa"),
        },
        dependencies(value, [])
      )
    ).toThrow("TARGETED_QA_OUTPUT_SCOPE_INVALID");

    const repositoryLink = path.join(value.root, "repository-link");
    fs.symlinkSync(value.repositoryRoot, repositoryLink, "dir");
    expect(() =>
      run(
        { ...runArguments(value), output: path.join(repositoryLink, "qa") },
        dependencies(value, [])
      )
    ).toThrow("TARGETED_QA_OUTPUT_SCOPE_INVALID");
  });

  test("rejects a baseline directory whose name is not the registry run id", () => {
    const renamedBaseline = path.join(value.root, "wrong-run-id");
    fs.renameSync(value.baselineRoot, renamedBaseline);

    expect(() =>
      run(
        { ...runArguments(value), baselineRoot: renamedBaseline },
        dependencies(value, [])
      )
    ).toThrow("TARGETED_QA_BASELINE_RUN_ID_MISMATCH");
  });

  test("never overwrites a manifest won by a concurrent initializer", () => {
    const racingFs = Object.create(fs);
    racingFs.linkSync = (temporary, manifestFile) => {
      fs.writeFileSync(manifestFile, "concurrent-owner", { flag: "wx" });
      return fs.linkSync(temporary, manifestFile);
    };

    expect(() =>
      run(runArguments(value), {
        ...dependencies(value, []),
        fsImpl: racingFs,
      })
    ).toThrow(/EEXIST/u);
    expect(
      fs.readFileSync(path.join(value.output, MANIFEST_FILENAME), "utf8")
    ).toBe("concurrent-owner");
    expect(fs.readdirSync(value.output)).toEqual([MANIFEST_FILENAME]);
  });

  test("production argv accepts only the four minimal arguments", () => {
    expect(
      parseArguments([
        "--baselineRoot",
        value.baselineRoot,
        "--output",
        value.output,
        "--model",
        "qa/model",
        "--modelTokenLimit",
        "42496",
      ])
    ).toEqual(runArguments(value));
    expect(() =>
      parseArguments([
        "--baselineRoot",
        value.baselineRoot,
        "--output",
        value.output,
        "--model",
        "qa/model",
        "--modelTokenLimit",
        "42496",
        "--repository",
        "/tmp/override",
      ])
    ).toThrow("TARGETED_QA_ARGUMENT_UNKNOWN: repository");
  });

  test("writes only the fixed manifest below the explicit QA output", () => {
    const result = run(runArguments(value), dependencies(value, []));
    expect(fs.realpathSync(result.manifestFile)).toBe(
      fs.realpathSync(path.join(value.output, MANIFEST_FILENAME))
    );
    expect(fs.readdirSync(value.output)).toEqual([MANIFEST_FILENAME]);
    expect(fs.readFileSync(result.manifestFile, "utf8")).not.toContain(
      "michaelmischkot"
    );
  });
});
