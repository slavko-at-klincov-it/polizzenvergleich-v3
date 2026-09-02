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
  fs.writeFileSync(
    path.join(packageDirectory, "package-contract.private.json"),
    "package-bytes"
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
    expect(fs.statSync(result.manifestFile).mode & 0o777).toBe(0o600);
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
