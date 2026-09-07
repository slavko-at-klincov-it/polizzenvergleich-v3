const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  build,
} = require("../../../scripts/qa/buildLfReferencePartialAuditCases.cjs");
const {
  correctionInstruction,
} = require("../../../scripts/qa/runLfReferencePartialAudit.cjs");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lf-partial-audit-"));
  const runRoot = path.join(root, "run");
  const output = path.join(root, "audit");
  const sourceCommit = "a".repeat(40);
  const semanticManifestHash = "b".repeat(64);
  const sourceLedgerHash = "c".repeat(64);
  const document = {
    uuid: "document-b",
    side: "B",
    position: 0,
    role: "TERMS",
    documentStatus: "FRAMEWORK_TERMS",
    originalName: "B.pdf",
    sha256: "d".repeat(64),
  };
  const sourceDocument = {
    uuid: "document-a",
    side: "A",
    position: 0,
    role: "MAIN_POLICY",
    documentStatus: "FRAMEWORK_TERMS",
    originalName: "A.pdf",
    sha256: "1".repeat(64),
  };
  const comparison = {
    schemaVersion: 3,
    contractId: "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1",
    comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
    runSignature: "e".repeat(64),
    productProfile: { id: "LF_PROFILE" },
    template: {
      semanticRequirementManifestSha256: semanticManifestHash,
      sourceBlockLedgerSha256: sourceLedgerHash,
    },
    documents: [sourceDocument, document],
    categories: [
      {
        categoryView: "LR01",
        rows: [
          {
            categoryId: "PR-01",
            analysisRowId: "LR01-001",
            sourceOrder: 0,
            categoryName: "Versicherungsort",
            subcategoryId: "PR-00",
            subcategoryName: "Grundvertrag",
            packageA: {
              documentedContent: "Versicherungsort laut Polizze",
              source: "Seite 1",
            },
            packageB: {
              reviewStatus: "TEILBELEGT",
              documentedContent: "Versicherungsort Wien",
              coverage: "Nicht feststellbar",
              coverageAmount: "Nicht feststellbar",
              contributors: [
                {
                  documentUuid: document.uuid,
                  documentName: document.originalName,
                  documentStatus: document.documentStatus,
                  reviewStatus: "TEILBELEGT",
                  source: "PDF-Seite 1: „Versicherungsort Wien“",
                },
              ],
            },
            outcome: "TEILWEISES_GEGENSTUECK",
            pointDecision: {
              outcome: "TEILWEISES_GEGENSTUECK",
              reasonCode: "ONLY_PART_OF_REFERENCE_COMPONENTS_EVIDENCED_IN_B",
            },
          },
        ],
      },
    ],
    totals: {
      rows: 1,
      outcomes: {
        GEGENSTUECK_GEFUNDEN: 0,
        TEILWEISES_GEGENSTUECK: 1,
        KEIN_GEGENSTUECK_NACH_KONTROLLIERTER_SUCHE: 0,
        REFERENZZEILE_UNKLAR: 0,
        GEGENSTUECK_UNKLAR: 0,
      },
    },
  };
  const manifest = {
    manifestSha256: semanticManifestHash,
    requirements: [
      {
        requirementId: "PR-01",
        components: [
          {
            id: "location",
            label: "Versicherungsort",
            factRole: "CONDITION",
            aliases: ["Risikoort"],
          },
        ],
        values: [],
      },
    ],
  };
  writeJson(path.join(runRoot, "result", "comparison.private.json"), comparison);
  writeJson(
    path.join(runRoot, "result", "artifact-set-manifest.private.json"),
    { contractId: "fixture" }
  );
  writeJson(path.join(runRoot, "input-manifest.private.json"), {
    comparisonMode: comparison.comparisonMode,
    documents: [sourceDocument, document],
  });
  writeJson(
    path.join(
      runRoot,
      "reference-template",
      "artifact-set-manifest.private.json"
    ),
    { contractId: "fixture" }
  );
  writeJson(
    path.join(
      runRoot,
      "reference-template",
      "semantic-requirement-manifest.private.json"
    ),
    manifest
  );
  writeJson(
    path.join(
      runRoot,
      "reference-template",
      "source-block-ledger.private.json"
    ),
    { ledgerSha256: sourceLedgerHash }
  );
  const documentRoot = path.join(runRoot, "documents", "B-01-document-b");
  writeJson(path.join(documentRoot, "document.private.json"), {
    fingerprint: document.sha256,
    document: {
      sourceDocumentId: document.sha256,
      pageContent: "[DOCUMENT_PAGE 1]\nDer Versicherungsort ist Wien.",
      pageMap: [{ pageNumber: 1 }],
    },
  });
  writeJson(path.join(documentRoot, "LR01", "result", "rows.private.json"), [
    {
      categoryId: "LR01-001",
      reviewStatus: "TEILBELEGT",
      source: "PDF-Seite 1",
    },
  ]);
  writeJson(
    path.join(
      documentRoot,
      "LR01",
      "effects",
      "materialized.private.json"
    ),
    {
      judgements: [
        {
          requirementId: "LR01-001",
          componentId: "location",
          evidencePresence: "FOUND",
          coverageEffect: "DEFINED",
          conflictState: "NONE",
        },
      ],
    }
  );
  writeJson(
    path.join(
      documentRoot,
      "LR01",
      "effects",
      "selected-sources.private.json"
    ),
    []
  );
  writeJson(
    path.join(
      documentRoot,
      "LR01",
      "result",
      "requested-fields.private.json"
    ),
    { requirements: [{ requirementId: "LR01-001", fields: [] }] }
  );
  return { root, runRoot, output, sourceCommit };
}

describe("LF partial counterpart audit case builder", () => {
  let value;

  beforeEach(() => {
    value = fixture();
  });

  afterEach(() => {
    fs.rmSync(value.root, { recursive: true, force: true });
  });

  test("binds the exact partial row, source documents and production evidence", () => {
    const { index, cases } = build({
      runRoot: value.runRoot,
      output: value.output,
      sourceCommit: value.sourceCommit,
      expectedCount: 1,
    });
    expect(index).toMatchObject({
      targetOutcome: "TEILWEISES_GEGENSTUECK",
      expectedCaseCount: 1,
      caseCount: 1,
      sourceDocumentCount: 1,
      advisoryOnly: true,
      primaryResultMutationAllowed: false,
    });
    expect(cases[0]).toMatchObject({
      caseId: "LR01-001",
      requirementId: "PR-01",
      originalDecision: { outcome: "TEILWEISES_GEGENSTUECK" },
      productionEvidence: [
        {
          documentUuid: "document-b",
          judgements: [
            {
              componentId: "location",
              evidencePresence: "FOUND",
            },
          ],
        },
      ],
    });
    expect(cases[0].candidates[0]).toMatchObject({
      documentUuid: "document-b",
      pageNumber: 1,
    });
    expect(fs.statSync(path.join(value.output, "index.private.json")).mode & 0o777).toBe(
      0o600
    );
  });

  test("fails closed when the observed partial count differs", () => {
    expect(() =>
      build({
        runRoot: value.runRoot,
        output: value.output,
        sourceCommit: value.sourceCommit,
        expectedCount: 79,
      })
    ).toThrow("LF_REFERENCE_AUDIT_TARGET_COUNT_INVALID:1:79");
  });

  test("rejects a document artifact that is not bound to the input hash", () => {
    const artifactFile = path.join(
      value.runRoot,
      "documents",
      "B-01-document-b",
      "document.private.json"
    );
    const artifact = JSON.parse(fs.readFileSync(artifactFile, "utf8"));
    artifact.fingerprint = "f".repeat(64);
    writeJson(artifactFile, artifact);
    expect(() =>
      build({
        runRoot: value.runRoot,
        output: value.output,
        sourceCommit: value.sourceCommit,
        expectedCount: 1,
      })
    ).toThrow("LF_REFERENCE_AUDIT_DOCUMENT_HASH_MISMATCH:document-b");
  });

  test("gives contract-specific retry guidance without weakening evidence", () => {
    expect(
      correctionInstruction(
        new Error("LF_REFERENCE_AUDIT_OBSERVED_VALUE_INVALID")
      )
    ).toContain("SAME, DIFFERENT, ADDITIONAL oder UNCLEAR");
    expect(
      correctionInstruction(new Error("LF_REFERENCE_AUDIT_QUOTE_INVALID"))
    ).toContain("wörtlich aus sources[].text");
  });
});
