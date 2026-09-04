const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  publishComparisonArtifactSet,
} = require("../../utils/policyComparison/artifactSetPublisher");
const {
  buildComparisonExportContract,
} = require("../../utils/policyComparison/comparisonExportContract");
const {
  CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT,
} = require("../../utils/policyComparison/customerResultRuleOutcomeContract");
const {
  LF_REFERENCE_PROFILE,
} = require("../../utils/policyComparison/lfReferenceProfile");
const {
  POLICY_COMPARISON_MODE,
} = require("../../utils/policyComparison/modes");
const {
  readValidatedStoredComparisonArtifacts,
} = require("../../utils/policyComparison/storedArtifactAccess");

const sessionUuid = "6c3a1a8c-9e58-4965-8720-0545aabbf889";
const runSignature = "a".repeat(64);

function readResult(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function currentFixture(root) {
  const resultDirectory = path.join(root, "runs", sessionUuid, "result");
  fs.mkdirSync(path.dirname(resultDirectory), { recursive: true });
  const result = {
    schemaVersion: 15,
    sessionUuid,
    runSignature,
    customerResultRuleOutcomeContract: {
      schemaVersion: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.schemaVersion,
      contractId: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.contractId,
    },
  };
  const published = await publishComparisonArtifactSet({
    outputDirectory: resultDirectory,
    writeArtifacts: async (staging) => {
      fs.writeFileSync(
        path.join(staging, "comparison.private.json"),
        JSON.stringify(result)
      );
      fs.writeFileSync(path.join(staging, "comparison.md"), "# result\n");
      fs.writeFileSync(
        path.join(staging, "polizzenvergleich.xlsx"),
        "workbook"
      );
    },
  });
  const archivedFile = path.join(root, "archived.xlsx");
  fs.copyFileSync(published.files["polizzenvergleich.xlsx"], archivedFile);
  const workbookSha256 = published.manifest.artifacts.find(
    ({ filename }) => filename === "polizzenvergleich.xlsx"
  ).sha256;
  const exportContract = buildComparisonExportContract({
    comparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
    sessionUuid,
    runSignature,
    artifactSetManifestFile: published.manifestFile,
    archivedWorkbook: {
      file: archivedFile,
      sha256: workbookSha256,
      reused: false,
      comparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
    },
  });
  fs.writeFileSync(
    path.join(resultDirectory, "export.private.json"),
    JSON.stringify(exportContract)
  );
  return { archivedFile, resultDirectory };
}

describe("stored policy comparison artifact access", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "stored-comparison-access-"));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test("validates current result and workbook bytes without depending on the Downloads copy", async () => {
    const fixture = await currentFixture(root);
    fs.unlinkSync(fixture.archivedFile);

    const access = readValidatedStoredComparisonArtifacts(
      {
        policyComparisonsRoot: root,
        resultPath: path.relative(root, fixture.resultDirectory),
        expectedComparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
        expectedSessionUuid: sessionUuid,
      },
      { readResult }
    );
    expect(access.legacy).toBe(false);
    expect(access.result.runSignature).toBe(runSignature);
    expect(access.workbookBytes).toEqual(Buffer.from("workbook"));
  });

  test("rejects a current result when the manifest or export contract is missing", async () => {
    const fixture = await currentFixture(root);
    fs.unlinkSync(
      path.join(fixture.resultDirectory, "artifact-set-manifest.private.json")
    );
    expect(() =>
      readValidatedStoredComparisonArtifacts(
        {
          policyComparisonsRoot: root,
          resultPath: path.relative(root, fixture.resultDirectory),
          expectedComparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
          expectedSessionUuid: sessionUuid,
        },
        { readResult }
      )
    ).toThrow("COMPARISON_EXPORT_CONTRACT_MISSING");
  });

  test("rejects a same-mode artifact set belonging to another session", async () => {
    const fixture = await currentFixture(root);
    expect(() =>
      readValidatedStoredComparisonArtifacts(
        {
          policyComparisonsRoot: root,
          resultPath: path.relative(root, fixture.resultDirectory),
          expectedComparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
          expectedSessionUuid: "7d4b2b9d-0f69-4b04-9f75-bd16c4d5bc0f",
        },
        { readResult }
      )
    ).toThrow("COMPARISON_EXPORT_RESULT_SESSION_MISMATCH");
  });

  test("keeps a manifest-free schema-14 artifact on the explicit legacy path", () => {
    const resultDirectory = path.join(root, "legacy", "result");
    fs.mkdirSync(resultDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(resultDirectory, "comparison.private.json"),
      JSON.stringify({ schemaVersion: 14, sessionUuid })
    );
    fs.writeFileSync(
      path.join(resultDirectory, "polizzenvergleich.xlsx"),
      "old"
    );
    fs.writeFileSync(
      path.join(resultDirectory, "export.private.json"),
      JSON.stringify({ schemaVersion: 1, archivedWorkbook: {} })
    );

    expect(
      readValidatedStoredComparisonArtifacts(
        {
          policyComparisonsRoot: root,
          resultPath: path.relative(root, resultDirectory),
          expectedComparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
          expectedSessionUuid: sessionUuid,
        },
        { readResult }
      )
    ).toMatchObject({ legacy: true, workbookBytes: Buffer.from("old") });
  });

  test("requires the hash chain for the current LF reference profile", () => {
    const resultDirectory = path.join(root, "lf-current", "result");
    fs.mkdirSync(resultDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(resultDirectory, "comparison.private.json"),
      JSON.stringify({ schemaVersion: 2, productProfile: LF_REFERENCE_PROFILE })
    );
    fs.writeFileSync(
      path.join(resultDirectory, "polizzenvergleich.xlsx"),
      "lf"
    );

    expect(() =>
      readValidatedStoredComparisonArtifacts(
        {
          policyComparisonsRoot: root,
          resultPath: path.relative(root, resultDirectory),
          expectedComparisonMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
          expectedSessionUuid: sessionUuid,
        },
        { readResult }
      )
    ).toThrow("COMPARISON_EXPORT_CONTRACT_MISSING");
  });
});
