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
  parseArguments,
  run,
} = require("../../../scripts/qa/materializeTargetedQaOverlay.cjs");

const CATEGORY_COUNTS = { VS: 36, FE: 80, LW: 36, ST: 36, EL: 36 };
const TARGET_COUNTS = { VS: 19, FE: 14, LW: 10, ST: 13, EL: 13 };

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 });
}

function rowIds(categoryView) {
  return Array.from(
    { length: CATEGORY_COUNTS[categoryView] },
    (_, index) => `${categoryView}-${String(index + 1).padStart(2, "0")}`
  );
}

function rows(categoryView) {
  return rowIds(categoryView).map((categoryId) => ({
    categoryId,
    stage: "fixture",
    categoryName: categoryId,
  }));
}

function comparison() {
  return {
    schemaVersion: 11,
    runSignature: "b".repeat(64),
    categories: CATEGORY_ORDER.map((categoryView) => ({
      categoryView,
      rows: rows(categoryView).map((row) => ({
        ...row,
        pointDecision: { outcome: "UNKLAR" },
      })),
    })),
    totals: { rows: 224 },
  };
}

function artifacts(categoryView) {
  const categoryRows = rows(categoryView);
  const requirements = categoryRows.map(({ categoryId }) => ({
    id: categoryId,
    components: [],
  }));
  return {
    worksheet: {
      catalog: { categoryView },
      summary: { componentCount: 0 },
      requirements,
      bindingGroups: [],
    },
    materializedEvidence: { judgements: [], rollups: [] },
    targets: [],
    rows: categoryRows,
    requestedFields: {
      requirements: categoryRows.map(({ categoryId }) => ({
        requirementId: categoryId,
      })),
    },
    report: { status: "PASS" },
  };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "targeted-overlay-"));
  const repositoryRoot = path.join(root, "repo");
  const baselineRoot = path.join(root, "baseline");
  const targetRoot = path.join(root, "target");
  const output = path.join(root, "overlay");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(baselineRoot);
  fs.mkdirSync(targetRoot);
  const sources = fixedSourcePaths(repositoryRoot);
  for (const categoryView of CATEGORY_ORDER) {
    fs.mkdirSync(path.dirname(sources.catalogs[categoryView]), {
      recursive: true,
    });
    fs.writeFileSync(sources.catalogs[categoryView], "fixture");
  }

  const documents = Array.from({ length: 10 }, (_, index) => ({
    uuid: `document-${index + 1}`,
    side: index === 0 ? "A" : "B",
    position: index === 0 ? 0 : index - 1,
    role: index === 0 ? "TERMS" : "MAIN_POLICY",
    documentStatus: index === 0 ? "FRAMEWORK_TERMS" : "PROPOSAL",
    originalName: `document-${index + 1}.pdf`,
    sha256: String(index + 1).padStart(64, "0"),
    primaryManifestSha256: "a".repeat(64),
  }));
  const packageContract = {
    schemaVersion: 1,
    runKind: "ISOLATED_PACKAGE_QA",
    releaseId: "baseline-release",
    productProfile: {
      categoryViews: CATEGORY_ORDER,
      categoryRowCounts: CATEGORY_COUNTS,
    },
    documents,
    runSignature: "b".repeat(64),
  };
  const baselineComparison = comparison();
  const packageFile = path.join(
    baselineRoot,
    "PACKAGE-COMPARISON",
    "package-contract.private.json"
  );
  const comparisonFile = path.join(
    baselineRoot,
    "PACKAGE-COMPARISON",
    "comparison.private.json"
  );
  writeJson(packageFile, packageContract);
  writeJson(comparisonFile, baselineComparison);

  const categoryTargets = CATEGORY_ORDER.map((categoryView) => ({
    categoryView,
    requirementIds: rowIds(categoryView).slice(0, TARGET_COUNTS[categoryView]),
    expectedTargetSelectionDigestSha256: categoryView
      .charCodeAt(0)
      .toString(16)
      .padStart(2, "0")
      .repeat(32),
  }));
  const manifest = {
    manifestDigestSha256: "f".repeat(64),
    trustAnchor: {
      packageContractFileSha256: sha256(fs.readFileSync(packageFile)),
      baselineComparisonFileSha256: sha256(fs.readFileSync(comparisonFile)),
      baselineRunSignature: packageContract.runSignature,
    },
    baseline: {
      packageContract,
      comparisonProjection: {
        totals: {
          reviewRowKeys: categoryTargets.flatMap(
            ({ categoryView, requirementIds }) =>
              requirementIds.map(
                (requirementId) => `${categoryView}:${requirementId}`
              )
          ),
        },
      },
    },
    execution: { releaseId: "target-release" },
    documentMatrix: { documents: [] },
    categoryTargets,
  };
  const pairs = [];
  const matrixDocuments = [];
  documents.forEach((document, documentIndex) => {
    const documentDirectory = `DOC-${String(documentIndex + 1).padStart(2, "0")}-${document.uuid}`;
    const artifact = Buffer.from(
      JSON.stringify({ schemaVersion: 1, fingerprint: document.sha256 })
    );
    matrixDocuments.push({
      ...document,
      documentArtifactSha256: sha256(artifact),
    });
    const baselineDocument = path.join(baselineRoot, documentDirectory);
    fs.mkdirSync(baselineDocument);
    fs.writeFileSync(
      path.join(baselineDocument, "document.private.json"),
      artifact,
      { mode: 0o600 }
    );
    fs.mkdirSync(path.join(targetRoot, documentDirectory));
    for (const categoryTarget of categoryTargets) {
      const { categoryView, requirementIds } = categoryTarget;
      const baselineArtifacts = artifacts(categoryView);
      const baselineCategory = path.join(baselineDocument, categoryView);
      writeJson(
        path.join(baselineCategory, "worksheet.private.json"),
        baselineArtifacts.worksheet
      );
      writeJson(
        path.join(baselineCategory, "effects", "materialized.private.json"),
        baselineArtifacts.materializedEvidence
      );
      writeJson(
        path.join(baselineCategory, "effects", "targets.private.json"),
        baselineArtifacts.targets
      );
      writeJson(
        path.join(baselineCategory, "result", "rows.private.json"),
        baselineArtifacts.rows
      );
      writeJson(
        path.join(baselineCategory, "result", "requested-fields.private.json"),
        baselineArtifacts.requestedFields
      );
      writeJson(
        path.join(baselineCategory, "result", "report.json"),
        baselineArtifacts.report
      );

      const targetCategory = path.join(
        targetRoot,
        documentDirectory,
        categoryView
      );
      const targetArtifacts = {
        ...baselineArtifacts,
        worksheet: {
          ...baselineArtifacts.worksheet,
          requirements: baselineArtifacts.worksheet.requirements.slice(
            0,
            requirementIds.length
          ),
          targetRequirementSelection: { requirementIds },
        },
        rows: baselineArtifacts.rows.slice(0, requirementIds.length),
        requestedFields: {
          requirements: baselineArtifacts.requestedFields.requirements.slice(
            0,
            requirementIds.length
          ),
        },
      };
      const worksheetFile = path.join(targetCategory, "worksheet.private.json");
      const evidenceFile = path.join(
        targetCategory,
        "effects",
        "materialized.private.json"
      );
      const triageFile = path.join(
        targetCategory,
        "triage",
        "materialized-triage.private.json"
      );
      const effectsReportFile = path.join(
        targetCategory,
        "effects",
        "report.json"
      );
      const resultReportFile = path.join(
        targetCategory,
        "result",
        "report.private.json"
      );
      writeJson(worksheetFile, targetArtifacts.worksheet);
      writeJson(triageFile, []);
      writeJson(evidenceFile, targetArtifacts.materializedEvidence);
      writeJson(
        path.join(targetCategory, "effects", "targets.private.json"),
        targetArtifacts.targets
      );
      writeJson(
        path.join(targetCategory, "result", "rows.private.json"),
        targetArtifacts.rows
      );
      writeJson(
        path.join(targetCategory, "result", "requested-fields.private.json"),
        targetArtifacts.requestedFields
      );
      writeJson(effectsReportFile, {
        contracts: {
          worksheetSha256: sha256(fs.readFileSync(worksheetFile)),
          triageSha256: sha256(fs.readFileSync(triageFile)),
          materializedEvidenceSha256: sha256(fs.readFileSync(evidenceFile)),
          expectedTargetSelectionDigestSha256:
            categoryTarget.expectedTargetSelectionDigestSha256,
          targetSelectionDigestSha256:
            categoryTarget.expectedTargetSelectionDigestSha256,
        },
      });
      writeJson(resultReportFile, {
        contractId: "TARGETED_QA_CATEGORY_RESULT_V1",
        runKind: "TARGETED_QA_ONLY",
        customerMaterializationAllowed: false,
        publishable: false,
        deployable: false,
        manifestDigestSha256: manifest.manifestDigestSha256,
        document: { uuid: document.uuid, sha256: document.sha256 },
        categoryView,
        requirementIds,
        rowCount: requirementIds.length,
        inputArtifactHashes: {
          worksheetSha256: sha256(fs.readFileSync(worksheetFile)),
          materializedTriageSha256: sha256(fs.readFileSync(triageFile)),
          materializedEvidenceSha256: sha256(fs.readFileSync(evidenceFile)),
        },
        outputSemanticDigests: {
          rowsSha256: selectionDigest(targetArtifacts.rows),
          requestedFieldsSha256: selectionDigest(
            targetArtifacts.requestedFields
          ),
        },
      });
      pairs.push({
        documentUuid: document.uuid,
        categoryView,
        effects: {
          reportSha256: sha256(fs.readFileSync(effectsReportFile)),
        },
        result: {
          reportSha256: sha256(fs.readFileSync(resultReportFile)),
        },
      });
    }
  });
  manifest.documentMatrix.documents = matrixDocuments;
  const manifestFile = path.join(root, "manifest.private.json");
  writeJson(manifestFile, manifest);
  writeJson(path.join(targetRoot, "run-summary.private.json"), {
    contractId: "TARGETED_QA_ALL_50_RUN_V1",
    runKind: "TARGETED_QA_ONLY",
    customerMaterializationAllowed: false,
    publishable: false,
    deployable: false,
    manifestDigestSha256: manifest.manifestDigestSha256,
    manifestFileSha256: sha256(fs.readFileSync(manifestFile)),
    execution: manifest.execution,
    pairCount: 50,
    pairs,
  });
  return {
    root,
    repositoryRoot,
    baselineRoot,
    targetRoot,
    output,
    manifest,
    manifestFile,
    baselineComparison,
  };
}

function args(value) {
  return {
    baselineRoot: value.baselineRoot,
    targetRoot: value.targetRoot,
    manifest: value.manifestFile,
    expectedManifestDigest: value.manifest.manifestDigestSha256,
    output: value.output,
  };
}

function dependencies(
  value,
  buildComparisonFn = () => value.baselineComparison
) {
  return {
    repositoryRoot: value.repositoryRoot,
    assertManifestFn: jest.fn(),
    assertBaselineWorksheetRebuildFn: jest.fn(() => ({
      fullWorksheetSha256: "c".repeat(64),
    })),
    overlayFn: jest.fn(({ baseline }) => ({
      rows: baseline.rows,
      worksheet: baseline.worksheet,
      materializedEvidence: baseline.materializedEvidence,
      targets: baseline.targets,
      requestedFields: baseline.requestedFields,
    })),
    buildTargetsFn: jest.fn(() => []),
    buildComparisonFn,
    releaseIdentityFn: () => "overlay-release",
  };
}

describe("materializeTargetedQaOverlay", () => {
  test("rejects unknown and relative CLI arguments", () => {
    expect(() => parseArguments(["--unknown", "x"])).toThrow(
      "TARGETED_OVERLAY_ARGUMENT_UNKNOWN"
    );
    expect(() =>
      parseArguments([
        "--baselineRoot",
        "relative",
        "--targetRoot",
        "/target",
        "--manifest",
        "/manifest",
        "--expectedManifestDigest",
        "f".repeat(64),
        "--output",
        "/output",
      ])
    ).toThrow("TARGETED_OVERLAY_ABSOLUTE_PATH_REQUIRED");
  });

  test("writes only the private overlay and proves both 155-row guards", () => {
    const value = fixture();
    const result = run(args(value), dependencies(value));

    expect(result.guard.counts).toMatchObject({
      documents: 10,
      pairs: 50,
      targetRequirements: 69,
      nonTargetRequirements: 155,
      targetDocumentRowInstances: 690,
      nonTargetDocumentRowInstances: 1550,
      identicalNonTargetComparisonRows: 155,
    });
    expect(result.guard.changedNonTargetRows).toEqual([]);
    expect(
      fs.existsSync(
        path.join(
          value.output,
          "PACKAGE-COMPARISON",
          "overlay-guard.private.json"
        )
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(value.output, "PACKAGE-COMPARISON", "comparison.md")
      )
    ).toBe(false);
    expect(
      fs.existsSync(
        path.join(value.output, "PACKAGE-COMPARISON", "polizzenvergleich.xlsx")
      )
    ).toBe(false);
  });

  test("aborts atomically when the final comparison changes one non-target row", () => {
    const value = fixture();
    const drifted = JSON.parse(JSON.stringify(value.baselineComparison));
    drifted.categories[0].rows[TARGET_COUNTS.VS].pointDecision.outcome =
      "VORTEIL_A";

    expect(() =>
      run(
        args(value),
        dependencies(value, () => drifted)
      )
    ).toThrow("TARGETED_OVERLAY_FINAL_NON_TARGET_DRIFT");
    expect(fs.existsSync(value.output)).toBe(false);
  });
});
