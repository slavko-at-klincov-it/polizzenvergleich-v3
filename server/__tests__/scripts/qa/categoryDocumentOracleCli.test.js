const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const SCRIPT = path.join(
  REPOSITORY_ROOT,
  "server/scripts/qa/evaluateCategoryDocumentOracle.cjs"
);

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

describe("category document oracle CLI", () => {
  let root;

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  test("evaluates supplied labels without changing QA source artifacts", () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "category-oracle-cli-"));
    const runRoot = path.join(root, "run");
    const oracleFile = path.join(root, "oracle.json");
    writeJson(path.join(runRoot, "manifest.private.json"), {
      releaseId: "fixture-release",
      configuration: {
        model: "fixture-model",
        documentStatus: "PROPOSAL",
      },
      document: { sha256: "fixture-pdf" },
    });
    writeJson(path.join(runRoot, "document.private.json"), {
      document: {
        pdfExtraction: { totalPages: 1 },
        pageMap: [{ pageNumber: 1 }],
      },
    });
    writeJson(path.join(runRoot, "VS/result/rows.private.json"), [
      {
        categoryId: "VS-16",
        coverage: "Nicht feststellbar",
        coverageAmount: "Nicht feststellbar",
        reviewStatus: "UNGEKLÄRT",
        documentedContent: "keine belegte Fundstelle gefunden",
      },
    ]);
    writeJson(path.join(runRoot, "VS/result/requested-fields.private.json"), {
      requirements: [
        {
          requirementId: "VS-16",
          requestedFieldStatus: "NOT_REQUIRED",
          fields: [],
        },
      ],
    });
    writeJson(path.join(runRoot, "VS/effects/materialized.private.json"), {
      judgements: [
        {
          requirementId: "VS-16",
          componentId: "garage",
          evidencePresence: "NOT_FOUND",
          coverageEffect: "UNKNOWN",
          documentApplicability: "UNKNOWN",
          conflictState: "NONE",
          selectedScopePicture: "UNKNOWN",
        },
      ],
    });
    writeJson(
      path.join(runRoot, "VS/effects/selected-sources.private.json"),
      []
    );
    writeJson(path.join(runRoot, "VS/worksheet.private.json"), {
      requirements: [
        {
          id: "VS-16",
          components: [{ id: "garage", factRole: "INSURED_OBJECT" }],
        },
      ],
    });
    writeJson(oracleFile, {
      schemaVersion: 1,
      oracleId: "fixture-oracle",
      approvalStatus: "APPROVED",
      documents: [
        {
          pdfSha256: "fixture-pdf",
          physicalPages: 1,
          documentStatus: "PROPOSAL",
          rows: [
            {
              categoryId: "VS-16",
              row: {
                coverage: "Nicht feststellbar",
                reviewStatus: "UNGEKLÄRT",
              },
              requestedFieldStatus: "NOT_REQUIRED",
              components: [
                {
                  componentId: "garage",
                  evidencePresence: "NOT_FOUND",
                  coverageEffect: "UNKNOWN",
                  documentApplicability: "UNKNOWN",
                },
              ],
              sources: {
                allowedCandidateIds: [],
                allowedPhysicalPages: [],
              },
            },
          ],
        },
      ],
    });
    const rowsFile = path.join(runRoot, "VS/result/rows.private.json");
    const before = fs.readFileSync(rowsFile, "utf8");

    const result = spawnSync(
      process.execPath,
      [SCRIPT, "--root", runRoot, "--oracle", oracleFile],
      { encoding: "utf8", cwd: REPOSITORY_ROOT }
    );

    expect(result.status).toBe(0);
    expect(fs.readFileSync(rowsFile, "utf8")).toBe(before);
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(runRoot, "quality-oracle-report.json"),
          "utf8"
        )
      )
    ).toMatchObject({
      oracleId: "fixture-oracle",
      status: "APPROVED_ORACLE_PASS",
      pass: true,
      run: { releaseId: "fixture-release", physicalPages: 1 },
    });
  });
});
