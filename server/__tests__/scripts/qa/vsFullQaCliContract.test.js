const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

function run(script, args) {
  return spawnSync(
    process.execPath,
    [path.join(REPOSITORY_ROOT, script), ...args],
    {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    }
  );
}

function preparedEvidenceFixture({
  objectScopeEvidence = false,
  orphanProofField = null,
} = {}) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "prepared-evidence-artifact-")
  );
  const worksheetFile = path.join(directory, "worksheet.private.json");
  const documentArtifactFile = path.join(directory, "document.private.json");
  const systemPromptFile = path.join(directory, "system.md");
  const output = path.join(directory, "output");
  const pageContent = "prefixx";
  const pageStart = "prefix".length;
  const fingerprint = "fixture-document-fingerprint";
  const pageContentSha256 = crypto
    .createHash("sha256")
    .update(pageContent)
    .digest("hex");
  const worksheet = {
    schemaVersion: 1,
    candidateOnly: true,
    catalog: { categoryView: "FE" },
    document: {
      fingerprint,
      sourceDocumentId: fingerprint,
      physicalPages: 1,
      pageContentLength: pageContent.length,
      pageContentSha256,
      pageBoundaries: [
        {
          physicalPageNumber: 1,
          documentStart: pageStart,
          documentEnd: pageContent.length,
        },
      ],
    },
    requirements: [
      {
        id: "FE-TEST",
        label: "Test",
        components: [
          {
            id: "coverage",
            label: "Deckung",
            factRole: "COVERAGE",
            occurrences: orphanProofField
              ? [
                  {
                    candidateId: "candidate:orphan-proof",
                    [orphanProofField]: {},
                  },
                ]
              : [],
            ...(objectScopeEvidence
              ? { objectScopeEvidenceContract: { contractId: "fixture" } }
              : {}),
          },
        ],
      },
    ],
  };
  const documentArtifact = {
    schemaVersion: 1,
    fingerprint,
    document: {
      sourceDocumentId: fingerprint,
      pageContent,
      pageMap: [{ pageNumber: 1, start: pageStart, end: pageContent.length }],
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 1,
        processedPages: 1,
        complete: true,
      },
    },
  };
  fs.writeFileSync(worksheetFile, JSON.stringify(worksheet));
  fs.writeFileSync(documentArtifactFile, JSON.stringify(documentArtifact));
  fs.writeFileSync(systemPromptFile, "System prompt");
  return {
    directory,
    worksheetFile,
    documentArtifactFile,
    systemPromptFile,
    output,
    documentArtifact,
  };
}

function preparedEvidenceArguments(fixture, { documentArtifact = true } = {}) {
  return [
    "--worksheet",
    fixture.worksheetFile,
    ...(documentArtifact
      ? ["--documentArtifact", fixture.documentArtifactFile]
      : []),
    "--systemPromptFile",
    fixture.systemPromptFile,
    "--controlMode",
    "technical-review",
    "--documentStatus",
    "FRAMEWORK_TERMS",
    "--output",
    fixture.output,
    "--model",
    "qwen/qwen3.6-35b-a3b",
    "--modelTokenLimit",
    "42496",
  ];
}

describe("VS full QA CLI contracts", () => {
  test("rejects target worksheets at both full materializer boundaries", () => {
    for (const script of [
      "server/scripts/qa/materializeCategoryFullResult.cjs",
      "server/scripts/qa/materializeVsFullResult.cjs",
    ]) {
      const source = fs.readFileSync(
        path.join(REPOSITORY_ROOT, script),
        "utf8"
      );
      expect(source).toContain(
        "TARGET_REQUIREMENT_WORKSHEET_FORBIDDEN_IN_FULL_MATERIALIZER"
      );
    }
  });

  test.each([
    "server/scripts/qa/buildVsOccurrenceWorksheet.cjs",
    "server/scripts/qa/runVsCandidateTriage.cjs",
    "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
    "server/scripts/qa/materializeVsFullResult.cjs",
    "server/scripts/qa/extractPolicyDocument.cjs",
    "server/scripts/qa/buildCategoryOccurrenceWorksheet.cjs",
    "server/scripts/qa/materializeCategoryFullResult.cjs",
    "server/scripts/qa/summarizeAllCategoryRun.cjs",
  ])("rejects unknown arguments in %s", (script) => {
    const result = run(script, ["--unknownArgument", "true"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unbekannte Argumente: unknownArgument");
  });

  test("candidate triage materializes a valid server-only result for an empty category", () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "policy-empty-candidate-triage-")
    );
    const worksheet = path.join(directory, "worksheet.private.json");
    const systemPrompt = path.join(directory, "system.md");
    const hybridPrompt = path.join(directory, "hybrid.md");
    const output = path.join(directory, "output");
    fs.writeFileSync(
      worksheet,
      JSON.stringify({
        schemaVersion: 1,
        candidateOnly: true,
        catalog: { categoryView: "VS" },
        requirements: [],
      })
    );
    fs.writeFileSync(systemPrompt, "System prompt");
    fs.writeFileSync(hybridPrompt, "Hybrid prompt");

    const result = run("server/scripts/qa/runVsCandidateTriage.cjs", [
      "--worksheet",
      worksheet,
      "--systemPromptFile",
      systemPrompt,
      "--hybridSystemPromptFile",
      hybridPrompt,
      "--controlMode",
      "technical-review",
      "--output",
      output,
      "--model",
      "qwen/qwen3.6-35b-a3b",
      "--modelTokenLimit",
      "42496",
    ]);

    expect(result.status).toBe(0);
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(output, "materialized-triage.private.json"),
          "utf8"
        )
      )
    ).toEqual([]);
    expect(
      JSON.parse(fs.readFileSync(path.join(output, "report.json"), "utf8"))
    ).toMatchObject({
      status: "TECHNICAL_PASS_REVIEW_REQUIRED",
      input: { candidateCount: 0, modelAttemptCount: 0 },
      validation: { formalPass: true, error: null },
      controls: { pass: true, results: [] },
    });
  });

  test("keeps a proof-free worksheet without object-scope contract legacy-compatible", () => {
    const fixture = preparedEvidenceFixture();
    const result = run(
      "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
      preparedEvidenceArguments(fixture, { documentArtifact: false })
    );
    expect(result.status).toBe(0);
    expect(
      JSON.parse(
        fs.readFileSync(path.join(fixture.output, "report.json"), "utf8")
      ).contracts
    ).toMatchObject({
      documentArtifactPath: null,
      documentArtifactSha256: null,
      documentFingerprint: null,
    });
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });

  test("requires a document artifact for an object-scope contract", () => {
    const fixture = preparedEvidenceFixture({ objectScopeEvidence: true });
    const result = run(
      "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
      preparedEvidenceArguments(fixture, { documentArtifact: false })
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Worksheet mit objectScopeEvidenceContract erfordert --documentArtifact"
    );
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });

  test.each(["objectScopeProof", "nestedListContinuationProof"])(
    "rejects orphaned %s even when a document artifact is present",
    (orphanProofField) => {
      const fixture = preparedEvidenceFixture({ orphanProofField });
      const result = run(
        "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
        preparedEvidenceArguments(fixture)
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Worksheet-Provenienz ohne passenden Komponentenvertrag ist unzulässig"
      );
      fs.rmSync(fixture.directory, { recursive: true, force: true });
    }
  );

  test("rejects a foreign document artifact for an object-scope contract", () => {
    const foreign = preparedEvidenceFixture({ objectScopeEvidence: true });

    foreign.documentArtifact.fingerprint = "foreign-fingerprint";
    fs.writeFileSync(
      foreign.documentArtifactFile,
      JSON.stringify(foreign.documentArtifact)
    );
    const foreignResult = run(
      "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
      preparedEvidenceArguments(foreign)
    );
    expect(foreignResult.status).toBe(1);
    expect(foreignResult.stderr).toContain(
      "Dokumentartefakt ist nicht fail-closed an das Worksheet gebunden"
    );

    fs.rmSync(foreign.directory, { recursive: true, force: true });
  });

  test("rejects a document artifact symlink before reading its bytes", () => {
    const fixture = preparedEvidenceFixture();
    const symlink = path.join(fixture.directory, "document-link.private.json");
    fs.symlinkSync(fixture.documentArtifactFile, symlink);
    fixture.documentArtifactFile = symlink;

    const result = run(
      "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
      preparedEvidenceArguments(fixture)
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Dokumentartefakt muss eine reguläre Nicht-Symlink-Datei sein"
    );
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });

  test("binds the document artifact and prepared targets in the effects report", () => {
    const fixture = preparedEvidenceFixture({ objectScopeEvidence: true });

    const result = run(
      "server/scripts/qa/runPreparedEvidenceEvaluation.cjs",
      preparedEvidenceArguments(fixture)
    );

    expect(result.status).toBe(0);
    const report = JSON.parse(
      fs.readFileSync(path.join(fixture.output, "report.json"), "utf8")
    );
    expect(report.contracts).toMatchObject({
      documentArtifactPath: fixture.documentArtifactFile,
      documentFingerprint: fixture.documentArtifact.fingerprint,
      documentArtifactSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      targetsSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(report.contracts.targetsSha256).toBe(
      crypto
        .createHash("sha256")
        .update(
          fs.readFileSync(path.join(fixture.output, "targets.private.json"))
        )
        .digest("hex")
    );

    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
});
