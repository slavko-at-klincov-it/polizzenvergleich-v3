const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  archiveComparisonWorkbook,
} = require("../../utils/policyComparison/workbookArchive");
const {
  POLICY_COMPARISON_MODE,
} = require("../../utils/policyComparison/modes");

describe("policy comparison workbook archive", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "comparison-archive-"));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test("archives a workbook once under a run-bound name with private permissions", () => {
    const workbookFile = path.join(root, "polizzenvergleich.xlsx");
    const exportDirectory = path.join(root, "exports");
    fs.writeFileSync(workbookFile, "xlsx-one");

    const first = archiveComparisonWorkbook({
      workbookFile,
      exportDirectory,
      sessionUuid: "6c3a1a8c-9e58-4965-8720-0545aabbf889",
      runSignature: "a".repeat(64),
      comparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
    });
    const second = archiveComparisonWorkbook({
      workbookFile,
      exportDirectory,
      sessionUuid: "6c3a1a8c-9e58-4965-8720-0545aabbf889",
      runSignature: "a".repeat(64),
      comparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
    });

    expect(path.basename(first.file)).toBe(
      "Gesamtvergleich-6c3a1a8c-9e58-4965-8720-0545aabbf889-aaaaaaaaaaaa.xlsx"
    );
    expect(fs.readFileSync(first.file, "utf8")).toBe("xlsx-one");
    expect(fs.statSync(first.file).mode & 0o077).toBe(0);
    expect(first.reused).toBe(false);
    expect(second).toMatchObject({ file: first.file, reused: true });
  });

  test("uses an LF-specific archive name and records its mode", () => {
    const workbookFile = path.join(root, "polizzenvergleich.xlsx");
    const exportDirectory = path.join(root, "exports");
    fs.writeFileSync(workbookFile, "xlsx-lf");

    const archived = archiveComparisonWorkbook({
      workbookFile,
      exportDirectory,
      sessionUuid: "6c3a1a8c-9e58-4965-8720-0545aabbf889",
      runSignature: "d".repeat(64),
      comparisonMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
    });

    expect(path.basename(archived.file)).toBe(
      "LF-IMMO-Referenzvergleich-6c3a1a8c-9e58-4965-8720-0545aabbf889-dddddddddddd.xlsx"
    );
    expect(archived.comparisonMode).toBe(
      POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B
    );
  });

  test("never overwrites a different workbook for the same run identity", () => {
    const workbookFile = path.join(root, "polizzenvergleich.xlsx");
    const exportDirectory = path.join(root, "exports");
    fs.writeFileSync(workbookFile, "xlsx-one");
    const input = {
      workbookFile,
      exportDirectory,
      sessionUuid: "6c3a1a8c-9e58-4965-8720-0545aabbf889",
      runSignature: "b".repeat(64),
      comparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
    };
    const archived = archiveComparisonWorkbook(input);
    fs.writeFileSync(workbookFile, "xlsx-two");

    expect(() => archiveComparisonWorkbook(input)).toThrow(
      "COMPARISON_EXPORT_CONFLICT"
    );
    expect(fs.readFileSync(archived.file, "utf8")).toBe("xlsx-one");
  });

  test("rejects relative export directories", () => {
    const workbookFile = path.join(root, "polizzenvergleich.xlsx");
    fs.writeFileSync(workbookFile, "xlsx");
    expect(() =>
      archiveComparisonWorkbook({
        workbookFile,
        exportDirectory: "relative/exports",
        sessionUuid: "6c3a1a8c-9e58-4965-8720-0545aabbf889",
        runSignature: "c".repeat(64),
        comparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
      })
    ).toThrow("COMPARISON_EXPORT_DIRECTORY_MUST_BE_ABSOLUTE");
  });
});
