const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  buildPreparedEvidenceTargets,
  materializePreparedEvidence,
} = require("../../../utils/policyAnalysis/preparedEvidenceContract");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const SCRIPT = path.join(
  REPOSITORY_ROOT,
  "server/scripts/qa/materializeCategoryFullResult.cjs"
);
const CATALOG_FILE = path.join(
  REPOSITORY_ROOT,
  "server/resources/policyAnalysis/st-occurrence-full-draft.v0.1.json"
);
const PROMPT_FILE = path.join(
  REPOSITORY_ROOT,
  "server/resources/workspaceTemplates/ST_sturm.md"
);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

describe("generic category full materializer", () => {
  let root;

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  test("renders the complete ST table from identity-bound empty evidence artifacts", () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "category-materializer-"));
    const pdfFile = path.join(root, "policy.pdf");
    fs.writeFileSync(pdfFile, "synthetic-pdf-identity");
    const fingerprint = sha256File(pdfFile);
    const text = "xyz";
    const document = {
      id: fingerprint,
      sourceDocumentId: fingerprint,
      title: "policy.pdf",
      documentType: "pdf",
      pageContent: text,
      pageMap: [{ pageNumber: 1, start: 0, end: text.length }],
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
        complete: true,
      },
    };
    const artifactFile = path.join(root, "document.private.json");
    writeJson(artifactFile, { schemaVersion: 1, fingerprint, document });
    const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
    const worksheet = buildControlledOccurrenceWorksheet({
      document,
      documentFingerprint: fingerprint,
      catalog,
    });
    const worksheetFile = path.join(root, "worksheet.private.json");
    writeJson(worksheetFile, worksheet);
    const triageFile = path.join(root, "triage.private.json");
    writeJson(triageFile, []);
    const targets = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: "FRAMEWORK_TERMS",
      candidateTriage: [],
    });
    const effects = materializePreparedEvidence({
      worksheet,
      targets,
      judgements: [],
    });
    const effectsFile = path.join(root, "effects.private.json");
    writeJson(effectsFile, effects);
    const sourcesFile = path.join(root, "sources.private.json");
    writeJson(sourcesFile, []);
    const model = "fixture-model";
    const commonCompletion = { responseModelComplete: true };
    const triageReportFile = path.join(root, "triage-report.json");
    writeJson(triageReportFile, {
      status: "TECHNICAL_PASS_REVIEW_REQUIRED",
      validation: { formalPass: true },
      controls: { pass: true },
      completion: commonCompletion,
      model: { id: model },
      contracts: {
        worksheetSha256: sha256File(worksheetFile),
        materializedTriageSha256: sha256File(triageFile),
      },
    });
    const effectsReportFile = path.join(root, "effects-report.json");
    writeJson(effectsReportFile, {
      status: "TECHNICAL_PASS_REVIEW_REQUIRED",
      validation: { pass: true },
      controls: { pass: true },
      completion: commonCompletion,
      model: { id: model },
      contracts: {
        worksheetSha256: sha256File(worksheetFile),
        triageSha256: sha256File(triageFile),
        materializedEvidenceSha256: sha256File(effectsFile),
        selectedSourcesSha256: sha256File(sourcesFile),
        documentStatus: "FRAMEWORK_TERMS",
      },
    });
    const output = path.join(root, "result");

    const result = spawnSync(
      process.execPath,
      [
        SCRIPT,
        "--categoryView",
        "ST",
        "--documentKey",
        "fixture",
        "--pdf",
        pdfFile,
        "--documentArtifact",
        artifactFile,
        "--promptFile",
        PROMPT_FILE,
        "--catalogFile",
        CATALOG_FILE,
        "--worksheet",
        worksheetFile,
        "--triage",
        triageFile,
        "--triageReport",
        triageReportFile,
        "--effects",
        effectsFile,
        "--effectsReport",
        effectsReportFile,
        "--sources",
        sourcesFile,
        "--documentStatus",
        "FRAMEWORK_TERMS",
        "--model",
        model,
        "--output",
        output,
      ],
      { encoding: "utf8", cwd: REPOSITORY_ROOT }
    );

    expect(result.status).toBe(0);
    const report = JSON.parse(
      fs.readFileSync(path.join(output, "report.json"), "utf8")
    );
    expect(report).toMatchObject({
      status: "TECHNICAL_PASS_REVIEW_REQUIRED",
      categoryView: "ST",
      rowCount: 36,
      expectedRowCount: 36,
      gates: {
        documentArtifact: true,
        worksheetCatalog: true,
        triage: true,
        effects: true,
        artifactIdentity: true,
        tableContract: true,
      },
    });
  });
});
