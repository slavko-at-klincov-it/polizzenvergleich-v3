const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  POLICY_COMPARISON_ARTIFACT_FILES,
  POLICY_COMPARISON_ARTIFACT_SET_CONTRACT_ID,
  POLICY_COMPARISON_ARTIFACT_SET_MANIFEST,
  publishComparisonArtifactSet,
  validatePublishedComparisonArtifactSet,
} = require("../../utils/policyComparison/artifactSetPublisher");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function writeFixtureArtifacts(directory) {
  const contents = {
    "comparison.private.json": Buffer.from('{"private":true}\n'),
    "comparison.md": Buffer.from("# Vergleich\n"),
    "polizzenvergleich.xlsx": Buffer.from("xlsx-fixture"),
  };
  for (const [filename, bytes] of Object.entries(contents))
    fs.writeFileSync(path.join(directory, filename), bytes);
  return contents;
}

describe("policy comparison artifact set publisher", () => {
  let root;
  let outputDirectory;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "comparison-artifact-set-"));
    outputDirectory = path.join(root, "PACKAGE-COMPARISON");
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test("validates and atomically publishes a complete sibling-staged set", async () => {
    const calls = [];
    let contents;
    const result = await publishComparisonArtifactSet({
      outputDirectory,
      writeArtifacts: async (staging) => {
        calls.push("write");
        expect(path.dirname(staging)).toBe(root);
        expect(path.basename(staging)).toMatch(
          /^\.PACKAGE-COMPARISON\.staging-/u
        );
        expect(fs.existsSync(outputDirectory)).toBe(false);
        contents = writeFixtureArtifacts(staging);
        return { resultId: "written" };
      },
      validateArtifacts: async ({ directory, files, writeResult }) => {
        calls.push("validate");
        expect(directory).not.toBe(outputDirectory);
        expect(Object.keys(files)).toEqual(POLICY_COMPARISON_ARTIFACT_FILES);
        expect(writeResult).toEqual({ resultId: "written" });
        expect(fs.existsSync(outputDirectory)).toBe(false);
        await Promise.resolve();
        return { valid: true };
      },
    });

    expect(calls).toEqual(["write", "validate"]);
    expect(result.outputDirectory).toBe(outputDirectory);
    expect(result.writeResult).toEqual({ resultId: "written" });
    expect(result.validationResult).toEqual({ valid: true });
    expect(fs.existsSync(outputDirectory)).toBe(true);
    expect(
      fs.readdirSync(root).filter((entry) => entry.includes(".staging-"))
    ).toEqual([]);

    const manifest = JSON.parse(fs.readFileSync(result.manifestFile, "utf8"));
    expect(path.basename(result.manifestFile)).toBe(
      POLICY_COMPARISON_ARTIFACT_SET_MANIFEST
    );
    expect(manifest.contractId).toBe(
      POLICY_COMPARISON_ARTIFACT_SET_CONTRACT_ID
    );
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.artifacts).toEqual(
      POLICY_COMPARISON_ARTIFACT_FILES.map((filename) => ({
        filename,
        bytes: contents[filename].length,
        sha256: sha256(contents[filename]),
      }))
    );
    expect(manifest.manifestDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
    for (const file of [result.manifestFile, ...Object.values(result.files)])
      expect(fs.statSync(file).mode & 0o077).toBe(0);
  });

  test("removes staging and leaves no final directory when validation fails", async () => {
    await expect(
      publishComparisonArtifactSet({
        outputDirectory,
        writeArtifacts: async (staging) => writeFixtureArtifacts(staging),
        validateArtifacts: async () => {
          await Promise.resolve();
          throw new Error("VALIDATION_FAILED");
        },
      })
    ).rejects.toThrow("VALIDATION_FAILED");

    expect(fs.existsSync(outputDirectory)).toBe(false);
    expect(fs.readdirSync(root)).toEqual([]);
  });

  test("removes staging and leaves no final directory when the writer fails", async () => {
    await expect(
      publishComparisonArtifactSet({
        outputDirectory,
        writeArtifacts: async (staging) => {
          fs.writeFileSync(path.join(staging, "comparison.private.json"), "{}");
          throw new Error("WRITER_FAILED");
        },
      })
    ).rejects.toThrow("WRITER_FAILED");

    expect(fs.existsSync(outputDirectory)).toBe(false);
    expect(fs.readdirSync(root)).toEqual([]);
  });

  test("rejects and cleans up an incomplete artifact set", async () => {
    await expect(
      publishComparisonArtifactSet({
        outputDirectory,
        writeArtifacts: async (staging) => {
          fs.writeFileSync(path.join(staging, "comparison.private.json"), "{}");
          fs.writeFileSync(path.join(staging, "comparison.md"), "# result");
        },
      })
    ).rejects.toThrow("COMPARISON_ARTIFACT_SET_FILES_INVALID");

    expect(fs.existsSync(outputDirectory)).toBe(false);
    expect(fs.readdirSync(root)).toEqual([]);
  });

  test("never calls the writer or overwrites an existing final directory", async () => {
    fs.mkdirSync(outputDirectory);
    const sentinel = path.join(outputDirectory, "keep.txt");
    fs.writeFileSync(sentinel, "unchanged");
    const writeArtifacts = jest.fn();

    await expect(
      publishComparisonArtifactSet({ outputDirectory, writeArtifacts })
    ).rejects.toThrow("COMPARISON_ARTIFACT_SET_OUTPUT_ALREADY_EXISTS");

    expect(writeArtifacts).not.toHaveBeenCalled();
    expect(fs.readFileSync(sentinel, "utf8")).toBe("unchanged");
  });

  test("does not remove another publisher's existing claim", async () => {
    const claim = `${outputDirectory}.publish-claim`;
    fs.writeFileSync(claim, "other-publisher", { flag: "wx" });

    await expect(
      publishComparisonArtifactSet({
        outputDirectory,
        writeArtifacts: async (staging) => writeFixtureArtifacts(staging),
      })
    ).rejects.toMatchObject({
      code: "COMPARISON_ARTIFACT_SET_PUBLISH_CLAIM_INVALID",
    });

    expect(fs.existsSync(outputDirectory)).toBe(false);
    expect(fs.readFileSync(claim, "utf8")).toBe("other-publisher");
    expect(
      fs.readdirSync(root).filter((entry) => entry.includes(".staging-"))
    ).toEqual([]);
  });

  test("does not publish files added outside the three-file contract", async () => {
    await expect(
      publishComparisonArtifactSet({
        outputDirectory,
        writeArtifacts: async (staging) => {
          writeFixtureArtifacts(staging);
          fs.writeFileSync(path.join(staging, "unexpected.txt"), "unexpected");
        },
      })
    ).rejects.toThrow("COMPARISON_ARTIFACT_SET_FILES_INVALID");

    expect(fs.existsSync(outputDirectory)).toBe(false);
    expect(fs.readdirSync(root)).toEqual([]);
  });

  test("revalidates a published set before an interrupted finalization resumes", async () => {
    const published = await publishComparisonArtifactSet({
      outputDirectory,
      writeArtifacts: async (staging) => writeFixtureArtifacts(staging),
    });
    fs.writeFileSync(
      path.join(outputDirectory, "export.private.json"),
      JSON.stringify({ schemaVersion: 2 })
    );

    expect(validatePublishedComparisonArtifactSet(outputDirectory)).toMatchObject({
      outputDirectory,
      files: published.files,
      manifest: published.manifest,
      reused: true,
    });
  });

  test("fails closed instead of reusing a modified or incomplete published set", async () => {
    await publishComparisonArtifactSet({
      outputDirectory,
      writeArtifacts: async (staging) => writeFixtureArtifacts(staging),
    });
    fs.appendFileSync(
      path.join(outputDirectory, "comparison.private.json"),
      "tampered"
    );
    expect(() =>
      validatePublishedComparisonArtifactSet(outputDirectory)
    ).toThrow("COMPARISON_ARTIFACT_SET_MANIFEST_MISMATCH");

    fs.rmSync(outputDirectory, { recursive: true, force: true });
    fs.mkdirSync(outputDirectory);
    expect(() =>
      validatePublishedComparisonArtifactSet(outputDirectory)
    ).toThrow("COMPARISON_ARTIFACT_SET_FILE_MISSING");
  });

  test("recovers a valid claim only when its owning process no longer exists", async () => {
    const claim = `${outputDirectory}.publish-claim`;
    fs.writeFileSync(
      claim,
      JSON.stringify({
        schemaVersion: 1,
        contractId: "POLICY_COMPARISON_PUBLISH_CLAIM_V1",
        pid: 777,
        nonce: "stale-publisher-nonce",
      })
    );
    const processImpl = {
      pid: 888,
      kill: () => {
        const error = new Error("missing");
        error.code = "ESRCH";
        throw error;
      },
    };

    await expect(
      publishComparisonArtifactSet(
        {
          outputDirectory,
          writeArtifacts: async (staging) => writeFixtureArtifacts(staging),
        },
        { processImpl }
      )
    ).resolves.toMatchObject({ outputDirectory });
    expect(fs.existsSync(claim)).toBe(false);
  });

  test("preserves and rejects a valid claim whose owner is still alive", async () => {
    const claim = `${outputDirectory}.publish-claim`;
    const contents = JSON.stringify({
      schemaVersion: 1,
      contractId: "POLICY_COMPARISON_PUBLISH_CLAIM_V1",
      pid: 777,
      nonce: "active-publisher-nonce",
    });
    fs.writeFileSync(claim, contents);

    await expect(
      publishComparisonArtifactSet(
        {
          outputDirectory,
          writeArtifacts: async (staging) => writeFixtureArtifacts(staging),
        },
        { processImpl: { pid: 888, kill: () => {} } }
      )
    ).rejects.toThrow("COMPARISON_ARTIFACT_SET_PUBLISH_CLAIM_ACTIVE");
    expect(fs.readFileSync(claim, "utf8")).toBe(contents);
  });
});
