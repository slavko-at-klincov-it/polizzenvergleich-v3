const fs = require("fs");
const os = require("os");
const path = require("path");
const { sha256 } = require("../../../utils/policyAnalysis/runIdentity");
const {
  selectionDigest,
} = require("../../../utils/policyAnalysis/targetRequirementSelection");
const {
  CATEGORY_ORDER,
  fixedSourcePaths,
} = require("../../../scripts/qa/ensureTargetedQaManifest.cjs");
const {
  EXPECTED_PAIR_COUNT,
  SUMMARY_FILENAME,
  parseArguments,
  run,
  verifyRuntime,
} = require("../../../scripts/qa/runTargetedQaAll50.cjs");

const SOURCE_REPOSITORY = path.resolve(__dirname, "../../../..");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 });
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, fs.readFileSync(source));
}

function argMap(args) {
  return Object.fromEntries(
    Array.from({ length: args.length / 2 }, (_, index) => [
      args[index * 2].slice(2),
      args[index * 2 + 1],
    ])
  );
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "targeted-all50-"));
  const repositoryRoot = path.join(root, "repo");
  const sourcePaths = fixedSourcePaths(SOURCE_REPOSITORY);
  const repoPaths = fixedSourcePaths(repositoryRoot);
  for (const categoryView of CATEGORY_ORDER) {
    copyFile(
      sourcePaths.catalogs[categoryView],
      repoPaths.catalogs[categoryView]
    );
    for (const role of ["category", "triage", "effects", "hybridAddon"])
      copyFile(
        sourcePaths.prompts[categoryView][role],
        repoPaths.prompts[categoryView][role]
      );
  }
  for (const script of [
    "runVsCandidateTriage.cjs",
    "runPreparedEvidenceEvaluation.cjs",
    "materializeTargetedQaCategory.cjs",
  ]) {
    const file = path.join(repositoryRoot, "server/scripts/qa", script);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "// fixture");
  }
  const baselineRoot = path.join(root, "QA", "baseline");
  const preparedRoot = path.join(root, "prepared");
  fs.mkdirSync(baselineRoot, { recursive: true });
  fs.mkdirSync(preparedRoot);
  const documents = Array.from({ length: 10 }, (_, index) => {
    const document = {
      uuid: `document-${String(index + 1).padStart(2, "0")}`,
      sha256: String(index).padStart(64, "0"),
      side: index === 0 ? "A" : "B",
      position: index === 0 ? 0 : index - 1,
      documentStatus: index === 0 ? "FRAMEWORK_TERMS" : "PROPOSAL",
    };
    const directory = path.join(
      baselineRoot,
      `DOC-${String(index + 1).padStart(2, "0")}-${document.uuid}`
    );
    const artifact = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        fingerprint: document.sha256,
        document: { sourceDocumentId: document.sha256 },
      })
    );
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "document.private.json"), artifact, {
      mode: 0o600,
    });
    return { ...document, documentArtifactSha256: sha256(artifact) };
  });
  const categoryTargets = CATEGORY_ORDER.map((categoryView, index) => ({
    categoryView,
    requirementIds: [`${categoryView}-01`],
    expectedTargetSelectionDigestSha256: ["a", "b", "c", "d", "e"][
      index
    ].repeat(64),
  }));
  const manifest = {
    schemaVersion: 3,
    contractId: "TARGETED_QA_MANIFEST_V3",
    manifestDigestSha256: "f".repeat(64),
    documentMatrix: { documents },
    categoryTargets,
  };
  const manifestFile = path.join(root, "manifest.private.json");
  writeJson(manifestFile, manifest);
  const execution = {
    releaseId: "fixture-release",
    model: "qa/qwen",
    modelTokenLimit: 42496,
    nodeVersion: "22.23.2",
    promptSha256ByCategory: Object.fromEntries(
      CATEGORY_ORDER.map((categoryView) => [
        categoryView,
        Object.fromEntries(
          ["category", "triage", "effects", "hybridAddon"].map((role) => [
            role,
            sha256(fs.readFileSync(repoPaths.prompts[categoryView][role])),
          ])
        ),
      ])
    ),
    hybridShadowEnabled: false,
  };
  const pairs = [];
  documents.forEach((document, documentIndex) => {
    for (const categoryView of CATEGORY_ORDER) {
      const relative = path.join(
        `DOC-${String(documentIndex + 1).padStart(2, "0")}-${document.uuid}`,
        categoryView
      );
      const worksheet = Buffer.from(
        JSON.stringify({ document: document.uuid, categoryView })
      );
      const provenance = Buffer.from(JSON.stringify({ categoryView }));
      const directory = path.join(preparedRoot, relative);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, "worksheet.private.json"),
        worksheet
      );
      fs.writeFileSync(
        path.join(directory, "provenance.private.json"),
        provenance
      );
      pairs.push({
        documentUuid: document.uuid,
        categoryView,
        worksheetSha256: sha256(worksheet),
        provenanceSha256: sha256(provenance),
      });
    }
  });
  writeJson(path.join(preparedRoot, "summary.private.json"), {
    pairCount: 50,
    manifestDigestSha256: manifest.manifestDigestSha256,
    manifestFileSha256: sha256(fs.readFileSync(manifestFile)),
    execution,
    pairs,
  });
  return {
    root,
    repositoryRoot,
    baselineRoot,
    preparedRoot,
    output: path.join(root, "run"),
    manifest,
    manifestFile,
    execution,
    documents,
  };
}

function args(value) {
  return {
    baselineRoot: value.baselineRoot,
    manifest: value.manifestFile,
    expectedManifestDigest: value.manifest.manifestDigestSha256,
    preparedRoot: value.preparedRoot,
    output: value.output,
    model: "qa/qwen",
    modelTokenLimit: 42496,
  };
}

function createChildRunner(value, calls) {
  return ({ script, args: childArgs }) => {
    const name = path.basename(script);
    const parsed = argMap(childArgs);
    calls.push({ name, args: childArgs, parsed });
    if (name === "runVsCandidateTriage.cjs") {
      const output = parsed.output;
      writeJson(path.join(output, "materialized-triage.private.json"), []);
      const materialized = path.join(
        output,
        "materialized-triage.private.json"
      );
      writeJson(path.join(output, "report.json"), {
        status: "TECHNICAL_PASS_REVIEW_REQUIRED",
        implementation: {
          releaseId: value.execution.releaseId,
          nodeVersion: value.execution.nodeVersion,
        },
        model: { id: value.execution.model, declaredTokenLimit: 42496 },
        contracts: {
          worksheetSha256: sha256(fs.readFileSync(parsed.worksheet)),
          systemPromptSha256: sha256(fs.readFileSync(parsed.systemPromptFile)),
          hybridSystemPromptPath: null,
          hybridSystemPromptSha256: null,
          expectedTargetSelectionDigestSha256:
            parsed.expectedTargetSelectionDigestSha256,
          targetSelectionDigestSha256:
            parsed.expectedTargetSelectionDigestSha256,
          materializedTriageSha256: sha256(fs.readFileSync(materialized)),
          controlMode: "technical-review",
        },
        input: {
          hybridTargetCount: 0,
          modelAttemptCount: 1,
          maxAttemptsPerTarget: 2,
        },
        completion: {
          responseModelComplete: true,
          callCount: 1,
          prompt_tokens: 10,
          completion_tokens: 2,
          total_tokens: 12,
          duration: 0.5,
        },
        validation: { formalPass: true },
        controls: { pass: true },
      });
      return;
    }
    if (name === "runPreparedEvidenceEvaluation.cjs") {
      const output = parsed.output;
      writeJson(path.join(output, "materialized.private.json"), {
        judgements: [],
        rollups: [],
      });
      writeJson(path.join(output, "selected-sources.private.json"), []);
      writeJson(path.join(output, "targets.private.json"), []);
      const evidence = path.join(output, "materialized.private.json");
      const sources = path.join(output, "selected-sources.private.json");
      const targets = path.join(output, "targets.private.json");
      const documentArtifact = JSON.parse(
        fs.readFileSync(parsed.documentArtifact, "utf8")
      );
      writeJson(path.join(output, "report.json"), {
        status: "TECHNICAL_PASS_REVIEW_REQUIRED",
        implementation: {
          releaseId: value.execution.releaseId,
          nodeVersion: value.execution.nodeVersion,
        },
        model: { id: value.execution.model, declaredTokenLimit: 42496 },
        contracts: {
          worksheetSha256: sha256(fs.readFileSync(parsed.worksheet)),
          systemPromptSha256: sha256(fs.readFileSync(parsed.systemPromptFile)),
          triageSha256: sha256(fs.readFileSync(parsed.triageFile)),
          documentStatus: parsed.documentStatus,
          documentArtifactSha256: sha256(
            fs.readFileSync(parsed.documentArtifact)
          ),
          documentFingerprint: documentArtifact.fingerprint,
          targetsSha256: sha256(fs.readFileSync(targets)),
          expectedTargetSelectionDigestSha256:
            parsed.expectedTargetSelectionDigestSha256,
          targetSelectionDigestSha256:
            parsed.expectedTargetSelectionDigestSha256,
          materializedEvidenceSha256: sha256(fs.readFileSync(evidence)),
          selectedSourcesSha256: sha256(fs.readFileSync(sources)),
          controlMode: "technical-review",
        },
        input: {
          modelAttemptCount: 1,
          maxAttemptsPerTarget: 2,
          allowUniqueCandidateIdRepair: false,
        },
        completion: {
          responseModelComplete: true,
          callCount: 1,
          prompt_tokens: 20,
          completion_tokens: 4,
          total_tokens: 24,
          duration: 1,
        },
        validation: { pass: true },
        controls: { pass: true },
      });
      return;
    }
    if (name === "materializeTargetedQaCategory.cjs") {
      if (fs.existsSync(parsed.output)) return;
      fs.mkdirSync(parsed.output, { mode: 0o700 });
      const pairDirectory = path.dirname(parsed.output);
      const categoryTarget = value.manifest.categoryTargets.find(
        ({ categoryView }) => categoryView === parsed.categoryView
      );
      const rows = [];
      const requested = {};
      const answer = Buffer.from("fixture answer");
      writeJson(path.join(parsed.output, "rows.private.json"), rows);
      writeJson(
        path.join(parsed.output, "requested-fields.private.json"),
        requested
      );
      fs.writeFileSync(path.join(parsed.output, "answer.private.md"), answer);
      writeJson(path.join(parsed.output, "report.private.json"), {
        schemaVersion: 1,
        contractId: "TARGETED_QA_CATEGORY_RESULT_V1",
        status: "TECHNICAL_PASS_REVIEW_REQUIRED",
        runKind: "TARGETED_QA_ONLY",
        customerMaterializationAllowed: false,
        publishable: false,
        deployable: false,
        manifestDigestSha256: value.manifest.manifestDigestSha256,
        document: value.documents.find(
          ({ uuid }) => uuid === parsed.documentUuid
        ),
        categoryView: parsed.categoryView,
        requirementIds: categoryTarget.requirementIds,
        rowCount: categoryTarget.requirementIds.length,
        tableContract: { pass: true },
        inputArtifactHashes: {
          worksheetSha256: sha256(
            fs.readFileSync(path.join(pairDirectory, "worksheet.private.json"))
          ),
          materializedTriageSha256: sha256(
            fs.readFileSync(
              path.join(
                pairDirectory,
                "triage",
                "materialized-triage.private.json"
              )
            )
          ),
          materializedEvidenceSha256: sha256(
            fs.readFileSync(
              path.join(pairDirectory, "effects", "materialized.private.json")
            )
          ),
          selectedSourcesSha256: sha256(
            fs.readFileSync(
              path.join(
                pairDirectory,
                "effects",
                "selected-sources.private.json"
              )
            )
          ),
        },
        outputSemanticDigests: {
          rowsSha256: selectionDigest(rows),
          requestedFieldsSha256: selectionDigest(requested),
          answerSha256: sha256(answer),
        },
        qualityGate: {
          pass: false,
          status: "REVIEW_REQUIRED",
          reason: "TARGETED_QA_ONLY",
        },
      });
    }
  };
}

function dependencies(value, calls, body = null) {
  return {
    repositoryRoot: value.repositoryRoot,
    releaseIdentityFn: () => "fixture-release",
    nodeVersion: "22.23.2",
    assertManifestFn: (_manifest, { expectedExecution }) => {
      expect(expectedExecution).toEqual(value.execution);
    },
    fetchFn: async () => ({
      ok: true,
      json: async () =>
        body || {
          data: [
            {
              id: "qa/qwen",
              type: "llm",
              state: "loaded",
              loaded_context_length: 42496,
            },
          ],
        },
    }),
    childRunnerFn: createChildRunner(value, calls),
  };
}

describe("targeted QA all-50 runner", () => {
  let value;

  beforeEach(() => {
    value = fixture();
  });

  afterEach(() => {
    fs.rmSync(value.root, { recursive: true, force: true });
  });

  test("runs 50 pairs sequentially without hybrid or repair", async () => {
    const calls = [];
    const result = await run(args(value), dependencies(value, calls));

    expect(result.reused).toBe(false);
    expect(result.summary.pairCount).toBe(EXPECTED_PAIR_COUNT);
    expect(result.summary).toMatchObject({
      runKind: "TARGETED_QA_ONLY",
      customerMaterializationAllowed: false,
      publishable: false,
      deployable: false,
      execution: value.execution,
    });
    expect(calls).toHaveLength(150);
    expect(calls.map(({ name }) => name).slice(0, 3)).toEqual([
      "runVsCandidateTriage.cjs",
      "runPreparedEvidenceEvaluation.cjs",
      "materializeTargetedQaCategory.cjs",
    ]);
    for (const call of calls.filter(
      ({ name }) => name === "runVsCandidateTriage.cjs"
    ))
      expect(call.args).not.toContain("--hybridSystemPromptFile");
    const effectsCalls = calls.filter(
      ({ name }) => name === "runPreparedEvidenceEvaluation.cjs"
    );
    effectsCalls.forEach((call, index) => {
      expect(call.parsed.allowUniqueCandidateIdRepair).toBe("false");
      const documentIndex = Math.floor(index / CATEGORY_ORDER.length);
      const document = value.documents[documentIndex];
      expect(call.parsed.documentArtifact).toBe(
        path.join(
          value.baselineRoot,
          `DOC-${String(documentIndex + 1).padStart(2, "0")}-${document.uuid}`,
          "document.private.json"
        )
      );
    });
    expect(result.summary.totals).toMatchObject({
      callCount: 100,
      promptTokens: 1500,
      completionTokens: 300,
      totalTokens: 1800,
    });
    expect(fs.existsSync(path.join(value.output, SUMMARY_FILENAME))).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          path.dirname(value.baselineRoot),
          ".all-categories-quality.lock"
        )
      )
    ).toBe(false);
  });

  test("strictly resumes phases and the existing summary", async () => {
    await run(args(value), dependencies(value, []));
    const calls = [];
    const result = await run(args(value), dependencies(value, calls));

    expect(result.reused).toBe(true);
    expect(calls).toHaveLength(50);
    expect(
      calls.every(({ name }) => name === "materializeTargetedQaCategory.cjs")
    ).toBe(true);
  });

  test("rejects a baseline document artifact that no longer matches the manifest", async () => {
    fs.appendFileSync(
      path.join(
        value.baselineRoot,
        `DOC-01-${value.documents[0].uuid}`,
        "document.private.json"
      ),
      "\n"
    );

    await expect(run(args(value), dependencies(value, []))).rejects.toThrow(
      "TARGETED_RUN_DOCUMENT_ARTIFACT_SHA_MISMATCH"
    );
  });

  test.each([
    ["documentArtifactSha256", "0".repeat(64)],
    ["documentFingerprint", "foreign-document"],
    ["targetsSha256", "0".repeat(64)],
  ])(
    "rejects a resumed effects report with a false %s",
    async (field, falseValue) => {
      await run(args(value), dependencies(value, []));
      const reportFile = path.join(
        value.output,
        `DOC-01-${value.documents[0].uuid}`,
        CATEGORY_ORDER[0],
        "effects",
        "report.json"
      );
      const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
      report.contracts[field] = falseValue;
      writeJson(reportFile, report);

      await expect(run(args(value), dependencies(value, []))).rejects.toThrow(
        "TARGETED_RUN_EFFECTS_RESUME_INVALID"
      );
    }
  );

  test("rejects embeddings and wrong loaded-model multiplicity", async () => {
    await expect(
      verifyRuntime({
        baseUrl: "http://127.0.0.1:1234/v1",
        model: "qa/qwen",
        modelTokenLimit: 42496,
        fetchFn: async () => ({
          ok: true,
          json: async () => ({
            data: [
              {
                id: "qa/qwen",
                type: "llm",
                state: "loaded",
                loaded_context_length: 42496,
              },
              { id: "embedding", type: "embeddings", state: "loaded" },
            ],
          }),
        }),
      })
    ).rejects.toThrow("TARGETED_RUN_EMBEDDING_MODEL_FORBIDDEN");

    await expect(
      verifyRuntime({
        baseUrl: "http://127.0.0.1:1234/v1",
        model: "qa/qwen",
        modelTokenLimit: 42496,
        fetchFn: async () => ({
          ok: true,
          json: async () => ({
            data: [
              {
                id: "qa/qwen",
                type: "llm",
                state: "loaded",
                loaded_context_length: 42496,
              },
              {
                id: "other/llm",
                type: "llm",
                state: "loaded",
                loaded_context_length: 42496,
              },
            ],
          }),
        }),
      })
    ).rejects.toThrow("TARGETED_RUN_MODEL_STATE_INVALID");
  });

  test("accepts only the seven strict arguments", () => {
    const parsed = parseArguments([
      "--baselineRoot",
      value.baselineRoot,
      "--manifest",
      value.manifestFile,
      "--expectedManifestDigest",
      value.manifest.manifestDigestSha256,
      "--preparedRoot",
      value.preparedRoot,
      "--output",
      value.output,
      "--model",
      "qa/qwen",
      "--modelTokenLimit",
      "42496",
    ]);
    expect(parsed).toEqual(args(value));
    expect(() =>
      parseArguments([
        "--baselineRoot",
        value.baselineRoot,
        "--manifest",
        value.manifestFile,
        "--expectedManifestDigest",
        value.manifest.manifestDigestSha256,
        "--preparedRoot",
        value.preparedRoot,
        "--output",
        value.output,
        "--model",
        "qa/qwen",
        "--modelTokenLimit",
        "42496",
        "--hybrid",
        "true",
      ])
    ).toThrow("TARGETED_RUN_ARGUMENT_UNKNOWN: hybrid");
  });
});
