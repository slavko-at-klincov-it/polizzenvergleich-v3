const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildPreparedEvidenceArguments,
  resolveDocumentArtifactBinding,
  verifyEffectsReportBindings,
} = require("../../../scripts/qa/runHybridShadowPilotQwenPhase.cjs");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fixture() {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "hybrid-shadow-qwen-binding-")
  );
  const documentFingerprint = "a".repeat(64);
  const documentArtifactPath = path.join(
    directory,
    "document.private.json"
  );
  const documentArtifact = {
    schemaVersion: 1,
    fingerprint: documentFingerprint,
    document: { sourceDocumentId: documentFingerprint },
  };
  const documentArtifactBytes = Buffer.from(JSON.stringify(documentArtifact));
  fs.writeFileSync(documentArtifactPath, documentArtifactBytes);
  const category = {
    documentIndex: 1,
    documentFingerprint,
    documentStatus: "FRAMEWORK_TERMS",
    categoryView: "FE",
    shadowWorksheetPath: path.join(directory, "worksheet.shadow.private.json"),
    shadowWorksheetSha256: "b".repeat(64),
  };
  const manifestDocument = {
    documentIndex: category.documentIndex,
    documentFingerprint,
    documentArtifactPath,
    documentArtifactSha256: sha256(documentArtifactBytes),
  };
  return {
    category,
    directory,
    documentArtifact,
    documentArtifactPath,
    manifest: {
      documents: [
        {
          ...manifestDocument,
          documentIndex: 9,
        },
        {
          ...manifestDocument,
          documentFingerprint: "c".repeat(64),
        },
        manifestDocument,
      ],
      qwen: { model: "qwen/test", modelTokenLimit: 42496 },
    },
  };
}

function writeEffectsArtifacts({
  category,
  directory,
  documentArtifactBinding,
}) {
  const effectsOutput = path.join(directory, "effects");
  fs.mkdirSync(effectsOutput);
  const targetsPath = path.join(effectsOutput, "targets.private.json");
  const targetsBytes = Buffer.from(JSON.stringify([{ targetId: "FE:C02" }]));
  fs.writeFileSync(targetsPath, targetsBytes);
  const report = {
    contracts: {
      worksheetSha256: category.shadowWorksheetSha256,
      documentArtifactPath: documentArtifactBinding.documentArtifactPath,
      documentArtifactSha256: documentArtifactBinding.documentArtifactSha256,
      documentFingerprint: documentArtifactBinding.documentFingerprint,
      targetsSha256: sha256(targetsBytes),
    },
  };
  fs.writeFileSync(
    path.join(effectsOutput, "report.json"),
    JSON.stringify(report)
  );
  return { effectsOutput, report };
}

describe("hybrid shadow Qwen document artifact binding", () => {
  test("resolves exactly one manifest document by documentIndex and fingerprint", () => {
    const input = fixture();

    expect(
      resolveDocumentArtifactBinding({
        manifest: input.manifest,
        category: input.category,
      })
    ).toEqual({
      documentArtifactPath: input.documentArtifactPath,
      documentArtifactSha256:
        input.manifest.documents[2].documentArtifactSha256,
      documentFingerprint: input.category.documentFingerprint,
    });

    fs.rmSync(input.directory, { recursive: true, force: true });
  });

  test("rejects ambiguous manifest document bindings", () => {
    const input = fixture();
    input.manifest.documents.push({ ...input.manifest.documents[2] });

    expect(() =>
      resolveDocumentArtifactBinding({
        manifest: input.manifest,
        category: input.category,
      })
    ).toThrow("HYBRID_SHADOW_PILOT_MANIFEST_DOCUMENT_BINDING_NOT_UNIQUE");

    fs.rmSync(input.directory, { recursive: true, force: true });
  });

  test("rejects a missing manifest document binding", () => {
    const input = fixture();
    input.manifest.documents = input.manifest.documents.slice(0, 2);

    expect(() =>
      resolveDocumentArtifactBinding({
        manifest: input.manifest,
        category: input.category,
      })
    ).toThrow("HYBRID_SHADOW_PILOT_MANIFEST_DOCUMENT_BINDING_NOT_UNIQUE");

    fs.rmSync(input.directory, { recursive: true, force: true });
  });

  test("rejects invalid document artifact JSON after verifying its bytes", () => {
    const input = fixture();
    const bytes = Buffer.from("{invalid-json");
    fs.writeFileSync(input.documentArtifactPath, bytes);
    input.manifest.documents[2].documentArtifactSha256 = sha256(bytes);

    expect(() =>
      resolveDocumentArtifactBinding({
        manifest: input.manifest,
        category: input.category,
      })
    ).toThrow("HYBRID_SHADOW_PILOT_DOCUMENT_ARTIFACT_JSON_INVALID");

    fs.rmSync(input.directory, { recursive: true, force: true });
  });

  test.each([
    ["bytes", (input) => fs.appendFileSync(input.documentArtifactPath, "x")],
    [
      "fingerprint",
      (input) => {
        input.documentArtifact.fingerprint = "d".repeat(64);
        const bytes = Buffer.from(JSON.stringify(input.documentArtifact));
        fs.writeFileSync(input.documentArtifactPath, bytes);
        input.manifest.documents[2].documentArtifactSha256 = sha256(bytes);
      },
    ],
    [
      "source document",
      (input) => {
        input.documentArtifact.document.sourceDocumentId = "e".repeat(64);
        const bytes = Buffer.from(JSON.stringify(input.documentArtifact));
        fs.writeFileSync(input.documentArtifactPath, bytes);
        input.manifest.documents[2].documentArtifactSha256 = sha256(bytes);
      },
    ],
  ])("rejects a %s mismatch", (_label, mutate) => {
    const input = fixture();
    mutate(input);

    expect(() =>
      resolveDocumentArtifactBinding({
        manifest: input.manifest,
        category: input.category,
      })
    ).toThrow(/HYBRID_SHADOW_PILOT_DOCUMENT_ARTIFACT_(?:CHANGED|IDENTITY_MISMATCH)/u);

    fs.rmSync(input.directory, { recursive: true, force: true });
  });

  test("rejects non-regular document artifact paths", () => {
    const input = fixture();
    const artifactDirectory = path.join(input.directory, "artifact-directory");
    fs.mkdirSync(artifactDirectory);
    input.manifest.documents[2].documentArtifactPath = artifactDirectory;

    expect(() =>
      resolveDocumentArtifactBinding({
        manifest: input.manifest,
        category: input.category,
      })
    ).toThrow("HYBRID_SHADOW_PILOT_DOCUMENT_ARTIFACT_NOT_REGULAR_FILE");

    fs.rmSync(input.directory, { recursive: true, force: true });
  });

  test("passes the resolved document artifact to the effects runner", () => {
    const input = fixture();
    const documentArtifactBinding = resolveDocumentArtifactBinding({
      manifest: input.manifest,
      category: input.category,
    });
    const argumentsList = buildPreparedEvidenceArguments({
      category: input.category,
      documentArtifactPath: documentArtifactBinding.documentArtifactPath,
      effectsPrompt: "/tmp/effects.md",
      effectsOutput: "/tmp/effects",
      triageOutput: "/tmp/triage",
      manifest: input.manifest,
    });

    expect(
      argumentsList.slice(
        argumentsList.indexOf("--documentArtifact"),
        argumentsList.indexOf("--documentArtifact") + 2
      )
    ).toEqual(["--documentArtifact", input.documentArtifactPath]);

    fs.rmSync(input.directory, { recursive: true, force: true });
  });

  test("accepts only effects reports bound to worksheet, artifact and targets", () => {
    const input = fixture();
    const documentArtifactBinding = resolveDocumentArtifactBinding({
      manifest: input.manifest,
      category: input.category,
    });
    const { effectsOutput } = writeEffectsArtifacts({
      ...input,
      documentArtifactBinding,
    });

    expect(
      verifyEffectsReportBindings({
        category: input.category,
        effectsOutput,
        documentArtifactBinding,
      })
    ).toMatchObject({
      reportPath: path.join(effectsOutput, "report.json"),
      reportSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      targetsPath: path.join(effectsOutput, "targets.private.json"),
      targetsSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });

    fs.rmSync(input.directory, { recursive: true, force: true });
  });

  test.each([
    ["worksheetSha256", "f".repeat(64)],
    ["documentArtifactPath", "/tmp/foreign-document.private.json"],
    ["documentArtifactSha256", "f".repeat(64)],
    ["documentFingerprint", "f".repeat(64)],
    ["targetsSha256", "f".repeat(64)],
  ])("rejects a changed effects report %s binding", (field, value) => {
    const input = fixture();
    const documentArtifactBinding = resolveDocumentArtifactBinding({
      manifest: input.manifest,
      category: input.category,
    });
    const { effectsOutput, report } = writeEffectsArtifacts({
      ...input,
      documentArtifactBinding,
    });
    report.contracts[field] = value;
    fs.writeFileSync(
      path.join(effectsOutput, "report.json"),
      JSON.stringify(report)
    );

    expect(() =>
      verifyEffectsReportBindings({
        category: input.category,
        effectsOutput,
        documentArtifactBinding,
      })
    ).toThrow("HYBRID_SHADOW_PILOT_EFFECTS_REPORT_BINDING_INVALID");

    fs.rmSync(input.directory, { recursive: true, force: true });
  });
});
