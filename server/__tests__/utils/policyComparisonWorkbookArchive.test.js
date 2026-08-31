const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  archiveComparisonWorkbook,
} = require("../../utils/policyComparison/workbookArchive");

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
    });
    const second = archiveComparisonWorkbook({
      workbookFile,
      exportDirectory,
      sessionUuid: "6c3a1a8c-9e58-4965-8720-0545aabbf889",
      runSignature: "a".repeat(64),
    });

    expect(path.basename(first.file)).toBe(
      "Gesamtvergleich-6c3a1a8c-9e58-4965-8720-0545aabbf889-aaaaaaaaaaaa.xlsx"
    );
    expect(fs.readFileSync(first.file, "utf8")).toBe("xlsx-one");
    expect(fs.statSync(first.file).mode & 0o077).toBe(0);
    expect(first.reused).toBe(false);
    expect(second).toMatchObject({ file: first.file, reused: true });
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
      })
    ).toThrow("COMPARISON_EXPORT_DIRECTORY_MUST_BE_ABSOLUTE");
  });
});
