const fs = require("fs");
const path = require("path");
const {
  PAV8_BASELINE_COMMIT,
  PAV8_BASELINE_PRODUCT_PROFILE,
  pav8BaselineCatalogBytes,
} = require("../../../testFixtures/policyAnalysis/pav8BaselineFixture");
const {
  BASELINE_WORKSHEET_REBUILD_CONTRACT_ID,
  assertBaselineWorksheetRebuild,
} = require("../../../utils/policyAnalysis/baselineWorksheetRebuildContract");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const { sha256 } = require("../../../utils/policyAnalysis/runIdentity");
const {
  selectionDigest,
} = require("../../../utils/policyAnalysis/targetRequirementSelection");
const {
  buildTargetedQaManifest,
} = require("../../../utils/policyAnalysis/targetedQaManifestContract");

const RESOURCES = path.resolve(__dirname, "../../../resources/policyAnalysis");
const REGISTRY_FILE = path.join(
  RESOURCES,
  "pav8-review-69-targets.qa-only.v0.1.json"
);
const RUN_SIGNATURE =
  "e3fa86164b0a027dbc219681bd308a1f7e027e0e5297f70b122feebf4e18d55e";

function raw(value) {
  return Buffer.from(JSON.stringify(value, null, 2));
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
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
      Buffer.from(`primary:${side}:${position}:${ordinal}`)
    ),
  };
}

function packageContract() {
  return {
    schemaVersion: 1,
    runKind: "ISOLATED_PACKAGE_QA",
    releaseId: PAV8_BASELINE_COMMIT,
    productProfile: copy(PAV8_BASELINE_PRODUCT_PROFILE),
    sourceInputManifest: {
      file: "/private/input-manifest.private.json",
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

function comparison(packageValue, registry) {
  const keys = reviewKeys(registry);
  return {
    schemaVersion: 11,
    runSignature: RUN_SIGNATURE,
    productProfile: copy(packageValue.productProfile),
    documents: packageValue.documents.map(
      ({ uuid, side, role, documentStatus, originalName, sha256: hash }) => ({
        uuid,
        side,
        role,
        documentStatus,
        originalName,
        sha256: hash,
      })
    ),
    categories: packageValue.productProfile.categoryViews.map(
      (categoryView) => ({
        categoryView,
        rows: Array(
          packageValue.productProfile.categoryRowCounts[categoryView]
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
      PAV8_BASELINE_PRODUCT_PROFILE.categoryViews.map((categoryView, index) => [
        categoryView,
        {
          category: ["1", "2", "3", "4", "5"][index].repeat(64),
          triage: ["a", "b", "c", "d", "e"][index].repeat(64),
          effects: ["f", "e", "d", "c", "b"][index].repeat(64),
          hybridAddon: ["5", "4", "3", "2", "1"][index].repeat(64),
        },
      ])
    ),
    hybridShadowEnabled: false,
  };
}

function fixture() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
  const packageValue = packageContract();
  const selectedDocument = packageValue.documents[0];
  const pageContent =
    "Sturm ist eine wetterbedingte Luftbewegung mit einer Windgeschwindigkeit von mehr als 60 km/h.";
  const selectedArtifact = {
    schemaVersion: 1,
    fingerprint: selectedDocument.sha256,
    document: {
      id: selectedDocument.sha256,
      sourceDocumentId: selectedDocument.sha256,
      title: selectedDocument.originalName,
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
  const selectedArtifactBytes = raw(selectedArtifact);
  const documentArtifactBytesByUuid = Object.fromEntries(
    packageValue.documents.map((document, index) => [
      document.uuid,
      index === 0
        ? selectedArtifactBytes
        : raw({
            schemaVersion: 1,
            fingerprint: document.sha256,
            document: { sourceDocumentId: document.sha256 },
          }),
    ])
  );
  const packageBytes = raw(packageValue);
  const comparisonBytes = raw(comparison(packageValue, registry));
  registry.baseline.packageContractSha256 = sha256(packageBytes);
  registry.baseline.comparisonSha256 = sha256(comparisonBytes);
  registry.baseline.runSignatureSha256 = RUN_SIGNATURE;
  const catalogBytesByCategory = pav8BaselineCatalogBytes();
  const manifest = buildTargetedQaManifest({
    qaRegistryBytes: raw(registry),
    packageContractBytes: packageBytes,
    baselineComparisonBytes: comparisonBytes,
    catalogBytesByCategory,
    documentArtifactBytesByUuid,
    execution: execution(),
  });
  const catalogBytes = catalogBytesByCategory.ST;
  const catalog = JSON.parse(catalogBytes.toString("utf8"));
  const fullWorksheet = buildControlledOccurrenceWorksheet({
    document: selectedArtifact.document,
    documentFingerprint: selectedArtifact.fingerprint,
    catalog,
  });
  return {
    manifest,
    expectedManifestDigestSha256: manifest.manifestDigestSha256,
    expectedExecution: copy(manifest.execution),
    categoryView: "ST",
    documentUuid: selectedDocument.uuid,
    catalogBytes,
    documentArtifactBytes: selectedArtifactBytes,
    fullWorksheetBytes: raw(fullWorksheet),
  };
}

function rewriteJson(input, mutate) {
  const value = JSON.parse(input.toString("utf8"));
  mutate(value);
  return raw(value);
}

function rehashManifest(manifest) {
  manifest.documentMatrix.documentMatrixDigestSha256 = selectionDigest(
    manifest.documentMatrix.documents
  );
  const { manifestDigestSha256: _digest, ...contract } = manifest;
  manifest.manifestDigestSha256 = selectionDigest(contract);
  return manifest;
}

describe("baseline worksheet rebuild contract", () => {
  test("proves full-catalog semantic parity without producing a target worksheet", () => {
    const input = fixture();
    const result = assertBaselineWorksheetRebuild(input);

    expect(result).toMatchObject({
      contractId: BASELINE_WORKSHEET_REBUILD_CONTRACT_ID,
      runKind: "TARGETED_QA_ONLY",
      categoryView: "ST",
      document: {
        uuid: input.documentUuid,
        side: "A",
        position: 0,
      },
    });
    expect(result.requirementCount).toBe(
      PAV8_BASELINE_PRODUCT_PROFILE.categoryRowCounts.ST
    );
    expect(result.semanticWorksheetDigestSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  test.each([
    [
      "document artifact bytes",
      (input) => {
        input.documentArtifactBytes = Buffer.concat([
          input.documentArtifactBytes,
          Buffer.from("\n"),
        ]);
      },
      "BASELINE_WORKSHEET_DOCUMENT_ARTIFACT_SHA_MISMATCH",
    ],
    [
      "catalog bytes",
      (input) => {
        input.catalogBytes = Buffer.concat([
          input.catalogBytes,
          Buffer.from(" "),
        ]);
      },
      "BASELINE_WORKSHEET_CATALOG_SHA_MISMATCH",
    ],
    [
      "target marker",
      (input) => {
        input.fullWorksheetBytes = rewriteJson(
          input.fullWorksheetBytes,
          (worksheet) => {
            worksheet.targetRequirementSelection = null;
          }
        );
      },
      "BASELINE_WORKSHEET_TARGET_MARKER_FORBIDDEN",
    ],
    [
      "worksheet semantics",
      (input) => {
        input.fullWorksheetBytes = rewriteJson(
          input.fullWorksheetBytes,
          (worksheet) => {
            worksheet.requirements[0].label = "tampered";
          }
        );
      },
      "BASELINE_WORKSHEET_REBUILD_MISMATCH",
    ],
    [
      "document uuid",
      (input) => {
        input.documentUuid = "unknown-document";
      },
      "BASELINE_WORKSHEET_DOCUMENT_UUID_INVALID",
    ],
  ])("rejects %s tamper", (_label, mutate, expectedCode) => {
    const input = fixture();
    mutate(input);
    expect(() => assertBaselineWorksheetRebuild(input)).toThrow(expectedCode);
  });

  test("rejects PDF identity drift even when a self-consistent manifest hash is supplied", () => {
    const input = fixture();
    input.documentArtifactBytes = rewriteJson(
      input.documentArtifactBytes,
      (artifact) => {
        artifact.fingerprint = "0".repeat(64);
      }
    );
    const manifest = copy(input.manifest);
    const document = manifest.documentMatrix.documents.find(
      ({ uuid }) => uuid === input.documentUuid
    );
    document.documentArtifactSha256 = sha256(input.documentArtifactBytes);
    input.manifest = rehashManifest(manifest);
    input.expectedManifestDigestSha256 = input.manifest.manifestDigestSha256;

    expect(() => assertBaselineWorksheetRebuild(input)).toThrow(
      "BASELINE_WORKSHEET_DOCUMENT_ARTIFACT_IDENTITY_INVALID"
    );
  });

  test("requires the externally expected execution", () => {
    const missingDigest = fixture();
    missingDigest.expectedManifestDigestSha256 = null;
    expect(() => assertBaselineWorksheetRebuild(missingDigest)).toThrow(
      "BASELINE_WORKSHEET_EXPECTED_MANIFEST_DIGEST_REQUIRED"
    );

    const input = fixture();
    input.expectedExecution.modelTokenLimit = 32000;
    expect(() => assertBaselineWorksheetRebuild(input)).toThrow(
      "TARGETED_QA_EXPECTED_EXECUTION_MISMATCH"
    );
  });
});
