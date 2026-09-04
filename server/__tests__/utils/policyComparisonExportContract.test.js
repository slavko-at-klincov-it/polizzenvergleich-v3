const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  POLICY_COMPARISON_ARTIFACT_FILES,
  POLICY_COMPARISON_ARTIFACT_SET_MANIFEST,
  buildArtifactSetManifest,
} = require("../../utils/policyComparison/artifactSetPublisher");
const {
  POLICY_COMPARISON_EXPORT_CONTRACT_ID,
  POLICY_COMPARISON_EXPORT_POLICY,
  buildComparisonExportContract,
  comparisonExportContractPolicy,
  validateComparisonExportContract,
} = require("../../utils/policyComparison/comparisonExportContract");
const {
  CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT,
} = require("../../utils/policyComparison/customerResultRuleOutcomeContract");
const {
  POLICY_COMPARISON_MODE,
} = require("../../utils/policyComparison/modes");

function writeArtifactSet({
  root,
  name,
  comparisonMode,
  sessionUuid,
  runSignature,
}) {
  const directory = path.join(root, name);
  fs.mkdirSync(directory, { mode: 0o700 });
  const customerMode = comparisonMode === POLICY_COMPARISON_MODE.SYMMETRIC_A_B;
  const result = {
    schemaVersion: customerMode ? 15 : 2,
    ...(customerMode ? {} : { comparisonMode }),
    sessionUuid,
    runSignature,
    ...(customerMode
      ? {
          customerResultRuleOutcomeContract: {
            schemaVersion: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.schemaVersion,
            contractId: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.contractId,
          },
        }
      : {}),
  };
  const contents = {
    "comparison.private.json": Buffer.from(
      JSON.stringify(result, null, 2),
      "utf8"
    ),
    "comparison.md": Buffer.from(`# ${name}\n`, "utf8"),
    "polizzenvergleich.xlsx": Buffer.from(`xlsx:${name}`, "utf8"),
  };
  const files = Object.fromEntries(
    POLICY_COMPARISON_ARTIFACT_FILES.map((filename) => {
      const file = path.join(directory, filename);
      fs.writeFileSync(file, contents[filename], { mode: 0o600 });
      return [filename, file];
    })
  );
  const manifest = buildArtifactSetManifest(files, fs);
  const manifestFile = path.join(
    directory,
    POLICY_COMPARISON_ARTIFACT_SET_MANIFEST
  );
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), {
    mode: 0o600,
  });
  const archivedFile = path.join(root, `${name}-archived.xlsx`);
  fs.copyFileSync(files["polizzenvergleich.xlsx"], archivedFile);
  const workbookArtifact = manifest.artifacts.find(
    ({ filename }) => filename === "polizzenvergleich.xlsx"
  );
  return {
    archivedWorkbook: {
      file: archivedFile,
      sha256: workbookArtifact.sha256,
      reused: false,
      comparisonMode,
    },
    directory,
    files,
    manifest,
    manifestFile,
    result,
  };
}

describe("policy comparison export contract", () => {
  let root;
  const sessionUuid = "6c3a1a8c-9e58-4965-8720-0545aabbf889";
  const runSignature = "a".repeat(64);

  beforeEach(() => {
    root = fs.mkdtempSync(
      path.join(os.tmpdir(), "comparison-export-contract-")
    );
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  function customerFixture(overrides = {}) {
    return writeArtifactSet({
      root,
      name: overrides.name || "customer-result",
      comparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
      sessionUuid: overrides.sessionUuid || sessionUuid,
      runSignature: overrides.runSignature || runSignature,
    });
  }

  function build(fixture, overrides = {}) {
    return buildComparisonExportContract({
      comparisonMode:
        overrides.comparisonMode || fixture.archivedWorkbook.comparisonMode,
      sessionUuid: overrides.sessionUuid || sessionUuid,
      runSignature: overrides.runSignature || runSignature,
      artifactSetManifestFile: fixture.manifestFile,
      archivedWorkbook: overrides.archivedWorkbook || fixture.archivedWorkbook,
    });
  }

  function validate(value, fixture, overrides = {}) {
    return validateComparisonExportContract(value, {
      expectedComparisonMode:
        overrides.comparisonMode || fixture.archivedWorkbook.comparisonMode,
      expectedSessionUuid: overrides.sessionUuid || sessionUuid,
      expectedRunSignature: overrides.runSignature || runSignature,
      artifactSetManifestFile: fixture.manifestFile,
    });
  }

  test("builds and validates a current customer export with the exact rule contract", () => {
    const fixture = customerFixture();
    const value = build(fixture);

    expect(value).toMatchObject({
      schemaVersion: 2,
      contractId: POLICY_COMPARISON_EXPORT_CONTRACT_ID,
      comparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
      sessionUuid,
      runSignature,
      artifactSet: {
        schemaVersion: 1,
        contractId: "POLICY_COMPARISON_ARTIFACT_SET_V1",
        manifestDigestSha256: fixture.manifest.manifestDigestSha256,
      },
      customerResultRuleOutcomeContract: {
        schemaVersion: 1,
        contractId: "CUSTOMER_RESULT_RULE_OUTCOME_V1",
      },
      archivedWorkbook: fixture.archivedWorkbook,
    });
    expect(value.artifactSet.comparisonSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(value.artifactSet.workbookSha256).toBe(
      fixture.archivedWorkbook.sha256
    );
    expect(validate(value, fixture)).toMatchObject({
      schemaVersion: 2,
      comparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
      sessionUuid,
      runSignature,
    });
  });

  test("keeps LF exports free of the customer rule-outcome contract", () => {
    const fixture = writeArtifactSet({
      root,
      name: "lf-result",
      comparisonMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
      sessionUuid,
      runSignature,
    });
    const value = build(fixture, {
      comparisonMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
    });

    expect(value).not.toHaveProperty("customerResultRuleOutcomeContract");
    expect(validate(value, fixture)).toMatchObject({
      comparisonMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
      customerResultRuleOutcomeContract: null,
    });

    value.customerResultRuleOutcomeContract = {
      schemaVersion: 1,
      contractId: "CUSTOMER_RESULT_RULE_OUTCOME_V1",
    };
    expect(() => validate(value, fixture)).toThrow(
      "COMPARISON_EXPORT_REFERENCE_CUSTOMER_CONTRACT_FORBIDDEN"
    );
  });

  test.each([
    ["comparison JSON", "comparison.private.json"],
    ["workbook", "polizzenvergleich.xlsx"],
  ])(
    "rejects a current artifact set after %s manipulation",
    (_label, filename) => {
      const fixture = customerFixture();
      const value = build(fixture);
      fs.appendFileSync(fixture.files[filename], "tampered");

      expect(() => validate(value, fixture)).toThrow(
        "COMPARISON_EXPORT_ARTIFACT_SET_INVALID"
      );
    }
  );

  test("rejects a manifest digest or bound file hash changed after publication", () => {
    const fixture = customerFixture();
    const value = build(fixture);

    value.artifactSet.manifestDigestSha256 = "b".repeat(64);
    expect(() => validate(value, fixture)).toThrow(
      "COMPARISON_EXPORT_ARTIFACT_BINDING_MISMATCH"
    );

    const second = build(fixture);
    second.artifactSet.workbookSha256 = "c".repeat(64);
    expect(() => validate(second, fixture)).toThrow(
      "COMPARISON_EXPORT_ARTIFACT_BINDING_MISMATCH"
    );
  });

  test("rejects an archived workbook hash or file that diverges from the run workbook", () => {
    const fixture = customerFixture();
    const wrongHash = {
      ...fixture.archivedWorkbook,
      sha256: "d".repeat(64),
    };
    expect(() => build(fixture, { archivedWorkbook: wrongHash })).toThrow(
      "COMPARISON_EXPORT_ARCHIVED_WORKBOOK_INVALID"
    );

    const value = build(fixture);
    fs.appendFileSync(fixture.archivedWorkbook.file, "tampered");
    expect(() => validate(value, fixture)).toThrow(
      "COMPARISON_EXPORT_ARCHIVED_WORKBOOK_HASH_MISMATCH"
    );
  });

  test("rejects a customer result or export carrying another rule contract", () => {
    const fixture = customerFixture();
    fixture.result.customerResultRuleOutcomeContract.contractId =
      "CUSTOMER_RESULT_RULE_OUTCOME_V2";
    fs.writeFileSync(
      fixture.files["comparison.private.json"],
      JSON.stringify(fixture.result, null, 2)
    );
    const files = Object.fromEntries(
      POLICY_COMPARISON_ARTIFACT_FILES.map((filename) => [
        filename,
        fixture.files[filename],
      ])
    );
    const rebuilt = buildArtifactSetManifest(files, fs);
    fs.writeFileSync(fixture.manifestFile, JSON.stringify(rebuilt, null, 2));
    expect(() => build(fixture)).toThrow(
      "COMPARISON_EXPORT_CUSTOMER_RULE_OUTCOME_CONTRACT_INVALID"
    );

    const validFixture = customerFixture({ name: "valid-customer-result" });
    const value = build(validFixture);
    value.customerResultRuleOutcomeContract.contractId =
      "CUSTOMER_RESULT_RULE_OUTCOME_V2";
    expect(() => validate(value, validFixture)).toThrow(
      "COMPARISON_EXPORT_CUSTOMER_RULE_OUTCOME_CONTRACT_MISMATCH"
    );
  });

  test("detects an artifact set or export manifest swapped from another run", () => {
    const first = customerFixture({ name: "first-result" });
    const secondSession = "7d4b2b9d-0f69-4b04-9f75-bd16c4d5bc0f";
    const secondSignature = "e".repeat(64);
    const second = customerFixture({
      name: "second-result",
      sessionUuid: secondSession,
      runSignature: secondSignature,
    });
    const firstExport = build(first);
    const secondExport = build(second, {
      sessionUuid: secondSession,
      runSignature: secondSignature,
    });

    expect(() => validate(firstExport, second)).toThrow(
      "COMPARISON_EXPORT_RESULT_SESSION_MISMATCH"
    );
    expect(() => validate(secondExport, first)).toThrow(
      "COMPARISON_EXPORT_RUN_IDENTITY_MISMATCH"
    );
  });

  test("classifies schema 1 as historical read-only without upgrading it", () => {
    const historical = {
      schemaVersion: 1,
      archivedWorkbook: { sha256: "f".repeat(64) },
    };
    expect(comparisonExportContractPolicy(historical)).toBe(
      POLICY_COMPARISON_EXPORT_POLICY.HISTORICAL_SCHEMA_1_READ_ONLY
    );
    expect(historical).toEqual({
      schemaVersion: 1,
      archivedWorkbook: { sha256: "f".repeat(64) },
    });

    const fixture = customerFixture();
    expect(() => validate(historical, fixture)).toThrow(
      "COMPARISON_EXPORT_CONTRACT_UNSUPPORTED"
    );
    expect(
      comparisonExportContractPolicy({
        schemaVersion: 1,
        contractId: POLICY_COMPARISON_EXPORT_CONTRACT_ID,
      })
    ).toBe(POLICY_COMPARISON_EXPORT_POLICY.UNSUPPORTED);
  });
});
