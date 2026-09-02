const fs = require("fs");
const path = require("path");
const {
  PRODUCT_PROFILE,
} = require("../../../utils/policyComparison/productContract");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const { sha256 } = require("../../../utils/policyAnalysis/runIdentity");
const {
  selectTargetRequirements,
} = require("../../../utils/policyAnalysis/targetRequirementSelection");
const {
  buildTargetedQaManifest,
} = require("../../../utils/policyAnalysis/targetedQaManifestContract");
const {
  TARGETED_CATEGORY_INPUT_CONTRACT_ID,
  assertTargetedCategoryMaterializationInputs,
} = require("../../../utils/policyAnalysis/targetedCategoryMaterializationContract");

const RESOURCES = path.resolve(__dirname, "../../../resources/policyAnalysis");
const REGISTRY_FILE = path.join(
  RESOURCES,
  "pav8-review-69-targets.qa-only.v0.1.json"
);
const CATALOG_FILES = {
  VS: "vs-occurrence-full-draft.v0.2.json",
  FE: "fe-occurrence-full-draft.v0.1.json",
  LW: "lw-occurrence-full-draft.v0.1.json",
  ST: "st-occurrence-full-draft.v0.1.json",
  EL: "el-occurrence-full-draft.v0.1.json",
};
const PROMPT_BYTES = fs.readFileSync(
  path.resolve(__dirname, "../../../resources/workspaceTemplates/ST_sturm.md")
);
const RUN_SIGNATURE =
  "e3fa86164b0a027dbc219681bd308a1f7e027e0e5297f70b122feebf4e18d55e";

function raw(value) {
  return Buffer.from(JSON.stringify(value, null, 2));
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function catalogBytesByCategory() {
  return Object.fromEntries(
    Object.entries(CATALOG_FILES).map(([categoryView, file]) => [
      categoryView,
      fs.readFileSync(path.join(RESOURCES, file)),
    ])
  );
}

function packageDocument(side, position, ordinal) {
  return {
    uuid: `${side.toLowerCase()}-document-${position}`,
    side,
    position,
    role:
      side === "A" || position === 0
        ? "MAIN_POLICY"
        : position === 1
          ? "SUPPLEMENT"
          : "TERMS",
    documentStatus:
      side === "B" && position === 0 ? "PROPOSAL" : "FRAMEWORK_TERMS",
    originalName: `${side}-${position}.pdf`,
    sha256: sha256(Buffer.from(`document:${side}:${position}:${ordinal}`)),
    primaryManifestSha256: sha256(
      Buffer.from(`primary-manifest:${side}:${position}:${ordinal}`)
    ),
  };
}

function sourcePackage() {
  return {
    schemaVersion: 1,
    runKind: "ISOLATED_PACKAGE_QA",
    releaseId: "2d964b45d6bbf8a1ca0769ad25bc3b59d3a7c42b",
    productProfile: copy(PRODUCT_PROFILE),
    sourceInputManifest: {
      file: "/private/qa/input-manifest.private.json",
      sha256: "1".repeat(64),
    },
    documents: [
      packageDocument("A", 0, 0),
      ...Array.from({ length: 9 }, (_, index) =>
        packageDocument("B", index, index + 1)
      ),
    ],
    runSignature: RUN_SIGNATURE,
  };
}

function reviewKeys(registry) {
  return registry.categoryTargets.flatMap(({ categoryView, requirementIds }) =>
    requirementIds.map((requirementId) => `${categoryView}:${requirementId}`)
  );
}

function baselineComparison(packageContract, registry) {
  const keys = reviewKeys(registry);
  return {
    schemaVersion: 11,
    runSignature: RUN_SIGNATURE,
    productProfile: copy(packageContract.productProfile),
    documents: packageContract.documents.map(
      ({
        uuid,
        side,
        role,
        documentStatus,
        originalName,
        sha256: documentSha,
      }) => ({
        uuid,
        side,
        role,
        documentStatus,
        originalName,
        sha256: documentSha,
      })
    ),
    categories: packageContract.productProfile.categoryViews.map(
      (categoryView) => ({
        categoryView,
        rows: Array(
          packageContract.productProfile.categoryRowCounts[categoryView]
        ).fill(null),
      })
    ),
    totals: {
      rows: 224,
      customerReviewRequired: 69,
      noCustomerReviewRequired: 155,
      customerReviewRowKeysByReasonCode: { TARGETED_REVIEW: keys },
      pointDecisionRowKeysByOutcome: { UNKLAR: keys },
    },
  };
}

function execution() {
  return {
    releaseId: "fixture-target-release",
    model: "fixture-model",
    modelTokenLimit: 42496,
    nodeVersion: "22.23.2",
    promptSha256ByCategory: Object.fromEntries(
      PRODUCT_PROFILE.categoryViews.map((categoryView, index) => [
        categoryView,
        {
          category:
            categoryView === "ST"
              ? sha256(PROMPT_BYTES)
              : ["1", "2", "3", "4", "5"][index].repeat(64),
          triage: ["a", "b", "c", "d", "e"][index].repeat(64),
          effects: ["f", "e", "d", "c", "b"][index].repeat(64),
          hybridAddon: ["5", "4", "3", "2", "1"][index].repeat(64),
        },
      ])
    ),
    hybridShadowEnabled: false,
  };
}

function realManifest() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
  const packageContract = sourcePackage();
  const comparison = baselineComparison(packageContract, registry);
  const packageContractBytes = raw(packageContract);
  const baselineComparisonBytes = raw(comparison);
  registry.baseline.packageContractSha256 = sha256(packageContractBytes);
  registry.baseline.comparisonSha256 = sha256(baselineComparisonBytes);
  registry.baseline.runSignatureSha256 = RUN_SIGNATURE;
  return buildTargetedQaManifest({
    qaRegistryBytes: raw(registry),
    packageContractBytes,
    baselineComparisonBytes,
    catalogBytesByCategory: catalogBytesByCategory(),
    execution: execution(),
  });
}

function rewriteJson(input, mutate) {
  const value = JSON.parse(input.toString("utf8"));
  mutate(value);
  return raw(value);
}

function fixture() {
  const manifest = realManifest();
  const target = manifest.categoryTargets.find(
    ({ categoryView }) => categoryView === "ST"
  );
  const catalogBytes = catalogBytesByCategory().ST;
  const selected = selectTargetRequirements({
    catalog: JSON.parse(catalogBytes.toString("utf8")),
    requirementIds: target.requirementIds,
  });
  const fingerprint = manifest.documentMatrix.documents[0].sha256;
  const pageContent = "Kein kontrollierter Suchbegriff in diesem Dokument.";
  const documentArtifact = {
    schemaVersion: 1,
    fingerprint,
    document: {
      id: fingerprint,
      sourceDocumentId: fingerprint,
      title: "target.pdf",
      documentType: "pdf",
      pageContent,
      pageMap: [{ pageNumber: 1, start: 0, end: pageContent.length }],
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
        complete: true,
      },
    },
  };
  const worksheet = {
    ...buildControlledOccurrenceWorksheet({
      document: documentArtifact.document,
      documentFingerprint: fingerprint,
      catalog: selected.catalog,
    }),
    targetRequirementSelection: selected.selection,
  };
  const worksheetBytes = raw(worksheet);
  const materializedTriageBytes = raw([]);
  const materializedEvidenceBytes = raw({ judgements: [], rollups: [] });
  const selectedSourcesBytes = raw([]);
  const promptHashes = manifest.execution.promptSha256ByCategory.ST;
  const selectionDigestSha256 = target.expectedTargetSelectionDigestSha256;
  const triageReport = {
    status: "TECHNICAL_PASS_REVIEW_REQUIRED",
    model: {
      id: manifest.execution.model,
      declaredTokenLimit: manifest.execution.modelTokenLimit,
    },
    validation: { formalPass: true },
    controls: { pass: true },
    completion: { responseModelComplete: true },
    contracts: {
      worksheetSha256: sha256(worksheetBytes),
      systemPromptSha256: promptHashes.triage,
      materializedTriageSha256: sha256(materializedTriageBytes),
      expectedTargetSelectionDigestSha256: selectionDigestSha256,
      targetSelectionDigestSha256: selectionDigestSha256,
    },
  };
  const effectsReport = {
    status: "TECHNICAL_PASS_REVIEW_REQUIRED",
    model: {
      id: manifest.execution.model,
      declaredTokenLimit: manifest.execution.modelTokenLimit,
    },
    validation: { pass: true },
    controls: { pass: true },
    completion: { responseModelComplete: true },
    contracts: {
      worksheetSha256: sha256(worksheetBytes),
      systemPromptSha256: promptHashes.effects,
      triageSha256: sha256(materializedTriageBytes),
      materializedEvidenceSha256: sha256(materializedEvidenceBytes),
      selectedSourcesSha256: sha256(selectedSourcesBytes),
      documentStatus: manifest.documentMatrix.documents[0].documentStatus,
      expectedTargetSelectionDigestSha256: selectionDigestSha256,
      targetSelectionDigestSha256: selectionDigestSha256,
    },
  };
  return {
    manifest,
    expectedManifestDigestSha256: manifest.manifestDigestSha256,
    expectedExecution: copy(manifest.execution),
    categoryView: "ST",
    catalogBytes,
    categoryPromptBytes: Buffer.from(PROMPT_BYTES),
    documentArtifactBytes: raw(documentArtifact),
    worksheetBytes,
    triageReportBytes: raw(triageReport),
    materializedTriageBytes,
    effectsReportBytes: raw(effectsReport),
    materializedEvidenceBytes,
    selectedSourcesBytes,
  };
}

describe("targeted category materialization input contract", () => {
  test("binds real Manifest V2, execution, rebuilt worksheet and report chain", () => {
    const input = fixture();
    const result = assertTargetedCategoryMaterializationInputs(input);
    const target = input.manifest.categoryTargets.find(
      ({ categoryView }) => categoryView === "ST"
    );

    expect(result).toMatchObject({
      contractId: TARGETED_CATEGORY_INPUT_CONTRACT_ID,
      runKind: "TARGETED_QA_ONLY",
      categoryView: "ST",
      requirementIds: target.requirementIds,
      document: { documentStatus: "FRAMEWORK_TERMS" },
    });
    for (const digest of Object.values(result.artifactHashes))
      expect(digest).toMatch(/^[a-f0-9]{64}$/u);
  });

  test.each([
    [
      "worksheet semantics",
      (input) => {
        input.worksheetBytes = rewriteJson(
          input.worksheetBytes,
          (worksheet) => {
            worksheet.requirements[0].label = "tampered";
          }
        );
      },
      "TARGETED_CATEGORY_WORKSHEET_REBUILD_MISMATCH",
    ],
    [
      "triage bytes",
      (input) => {
        input.materializedTriageBytes = Buffer.concat([
          input.materializedTriageBytes,
          Buffer.from("\n"),
        ]);
      },
      "TARGETED_CATEGORY_TRIAGE_CONTRACT_MISMATCH",
    ],
    [
      "effects bytes",
      (input) => {
        input.materializedEvidenceBytes = Buffer.concat([
          input.materializedEvidenceBytes,
          Buffer.from("\n"),
        ]);
      },
      "TARGETED_CATEGORY_EFFECTS_CONTRACT_MISMATCH",
    ],
    [
      "selection digest",
      (input) => {
        input.effectsReportBytes = rewriteJson(
          input.effectsReportBytes,
          (report) => {
            report.contracts.targetSelectionDigestSha256 = "0".repeat(64);
          }
        );
      },
      "TARGETED_CATEGORY_EFFECTS_CONTRACT_MISMATCH",
    ],
    [
      "triage model context",
      (input) => {
        input.triageReportBytes = rewriteJson(
          input.triageReportBytes,
          (report) => {
            report.model.declaredTokenLimit = 32000;
          }
        );
      },
      "TARGETED_CATEGORY_TRIAGE_EXECUTION_MISMATCH",
    ],
    [
      "effects model context",
      (input) => {
        input.effectsReportBytes = rewriteJson(
          input.effectsReportBytes,
          (report) => {
            report.model.declaredTokenLimit = 32000;
          }
        );
      },
      "TARGETED_CATEGORY_EFFECTS_EXECUTION_MISMATCH",
    ],
  ])("rejects %s tamper", (_label, mutate, expectedCode) => {
    const input = fixture();
    mutate(input);
    expect(() => assertTargetedCategoryMaterializationInputs(input)).toThrow(
      expectedCode
    );
  });

  test("rejects catalog, prompt, document and external execution tamper", () => {
    const catalog = fixture();
    catalog.catalogBytes = Buffer.concat([
      catalog.catalogBytes,
      Buffer.from(" "),
    ]);
    expect(() => assertTargetedCategoryMaterializationInputs(catalog)).toThrow(
      "TARGETED_CATEGORY_CATALOG_SHA_MISMATCH"
    );

    const prompt = fixture();
    prompt.categoryPromptBytes = Buffer.concat([
      prompt.categoryPromptBytes,
      Buffer.from(" "),
    ]);
    expect(() => assertTargetedCategoryMaterializationInputs(prompt)).toThrow(
      "TARGETED_CATEGORY_PROMPT_SHA_MISMATCH"
    );

    const document = fixture();
    document.documentArtifactBytes = rewriteJson(
      document.documentArtifactBytes,
      (artifact) => {
        artifact.fingerprint = "f".repeat(64);
        artifact.document.sourceDocumentId = artifact.fingerprint;
      }
    );
    expect(() => assertTargetedCategoryMaterializationInputs(document)).toThrow(
      "TARGETED_CATEGORY_DOCUMENT_NOT_IN_MANIFEST"
    );

    const executionMismatch = fixture();
    executionMismatch.expectedExecution.modelTokenLimit = 32000;
    expect(() =>
      assertTargetedCategoryMaterializationInputs(executionMismatch)
    ).toThrow("TARGETED_QA_EXPECTED_EXECUTION_MISMATCH");
  });
});
