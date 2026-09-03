const fs = require("fs");
const path = require("path");
const {
  PAV8_BASELINE_CATALOG_SHA256,
  PAV8_BASELINE_COMMIT,
  PAV8_BASELINE_PRODUCT_PROFILE,
  pav8BaselineCatalogBytes,
} = require("../../fixtures/policyAnalysis/pav8BaselineFixture");
const { sha256 } = require("../../../utils/policyAnalysis/runIdentity");
const {
  EXPECTED_DOCUMENT_COUNT,
  EXPECTED_REQUIREMENT_COUNT,
  TARGETED_QA_MANIFEST_CONTRACT_ID,
  TARGETED_QA_MANIFEST_SCHEMA_VERSION,
  TARGETED_QA_RUN_KIND,
  assertTargetedQaManifest,
  buildTargetedQaManifest,
} = require("../../../utils/policyAnalysis/targetedQaManifestContract");

const REGISTRY_FILE = path.join(
  path.resolve(__dirname, "../../../resources/policyAnalysis"),
  "pav8-review-69-targets.qa-only.v0.1.json"
);
const RUN_SIGNATURE =
  "e3fa86164b0a027dbc219681bd308a1f7e027e0e5297f70b122feebf4e18d55e";

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value));
}

function sourceRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
}

function packageDocument(side, position, ordinal) {
  const shaCharacter = ["a", "b", "c", "d", "e", "f"][ordinal % 6];
  const manifestCharacter = ["f", "e", "d", "c", "b", "a"][ordinal % 6];
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
    sha256: shaCharacter.repeat(64),
    primaryManifestSha256: manifestCharacter.repeat(64),
  };
}

function packageContract() {
  return {
    schemaVersion: 1,
    runKind: "ISOLATED_PACKAGE_QA",
    releaseId: PAV8_BASELINE_COMMIT,
    productProfile: copy(PAV8_BASELINE_PRODUCT_PROFILE),
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

function comparison(packageValue, registry) {
  return {
    schemaVersion: 11,
    runSignature: RUN_SIGNATURE,
    productProfile: copy(packageValue.productProfile),
    documents: packageValue.documents.map(
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
      customerReviewRowKeysByReasonCode: {
        TARGETED_REVIEW: reviewKeys(registry),
      },
      pointDecisionRowKeysByOutcome: {
        UNKLAR: reviewKeys(registry),
      },
    },
  };
}

function execution() {
  return {
    releaseId: "targeted-working-tree",
    model: "qwen/qwen3.6-35b-a3b",
    modelTokenLimit: 42496,
    nodeVersion: "22.23.2",
    promptSha256ByCategory: Object.fromEntries(
      PAV8_BASELINE_PRODUCT_PROFILE.categoryViews.map((categoryView, index) => [
        categoryView,
        {
          category: ["a", "b", "c", "d", "e"][index].repeat(64),
          triage: ["f", "e", "d", "c", "b"][index].repeat(64),
          effects: ["1", "2", "3", "4", "5"][index].repeat(64),
          hybridAddon: ["5", "4", "3", "2", "1"][index].repeat(64),
        },
      ])
    ),
    hybridShadowEnabled: false,
  };
}

function documentArtifactBytes(packageValue) {
  return Object.fromEntries(
    packageValue.documents.map((document) => [
      document.uuid,
      jsonBytes({
        schemaVersion: 1,
        fingerprint: document.sha256,
        document: {
          sourceDocumentId: document.sha256,
          pageContent: "fixture",
          pageMap: [{ pageNumber: 1, start: 0, end: 7 }],
          pdfExtraction: { complete: true },
        },
      }),
    ])
  );
}

function inputs({
  mutatePackage = () => {},
  mutateComparison = () => {},
  mutateRegistry = () => {},
  mutateCatalogs = () => {},
  executionValue = execution(),
} = {}) {
  const registry = sourceRegistry();
  const packageValue = packageContract();
  mutatePackage(packageValue);
  const comparisonValue = comparison(packageValue, registry);
  mutateComparison(comparisonValue);
  const packageContractBytes = jsonBytes(packageValue);
  const baselineComparisonBytes = jsonBytes(comparisonValue);
  registry.baseline.packageContractSha256 = sha256(packageContractBytes);
  registry.baseline.comparisonSha256 = sha256(baselineComparisonBytes);
  registry.baseline.runSignatureSha256 = RUN_SIGNATURE;
  mutateRegistry(registry);
  const catalogBytesByCategory = pav8BaselineCatalogBytes();
  mutateCatalogs(catalogBytesByCategory);
  return {
    qaRegistryBytes: jsonBytes(registry),
    packageContractBytes,
    baselineComparisonBytes,
    catalogBytesByCategory,
    documentArtifactBytesByUuid: documentArtifactBytes(packageValue),
    execution: executionValue,
  };
}

describe("targeted QA manifest raw trust boundary", () => {
  test("keeps the historical PAV8 catalog snapshots byte-bound", () => {
    const catalogs = pav8BaselineCatalogBytes();
    for (const [categoryView, bytes] of Object.entries(catalogs)) {
      expect(sha256(bytes)).toBe(PAV8_BASELINE_CATALOG_SHA256[categoryView]);
      expect(JSON.parse(bytes.toString("utf8")).catalogId).toBe(
        PAV8_BASELINE_PRODUCT_PROFILE.categoryCatalogIds[categoryView]
      );
    }
  });

  test("accepts the exact A:0 plus B:0..8 and 69-target baseline", () => {
    const manifest = buildTargetedQaManifest(inputs());

    expect(manifest).toMatchObject({
      schemaVersion: TARGETED_QA_MANIFEST_SCHEMA_VERSION,
      contractId: TARGETED_QA_MANIFEST_CONTRACT_ID,
      runKind: TARGETED_QA_RUN_KIND,
      executionPolicy: {
        productMutationAllowed: false,
        fullMaterializerAllowed: false,
      },
      documentMatrix: {
        expectedDocumentCount: EXPECTED_DOCUMENT_COUNT,
        sideCounts: { A: 1, B: 9 },
      },
      execution: execution(),
    });
    expect(manifest.categoryTargets).toHaveLength(5);
    expect(
      manifest.categoryTargets.reduce(
        (sum, target) => sum + target.requirementIds.length,
        0
      )
    ).toBe(EXPECTED_REQUIREMENT_COUNT);
    expect(
      manifest.documentMatrix.documents.map(
        ({ side, position }) => `${side}:${position}`
      )
    ).toEqual([
      "A:0",
      "B:0",
      "B:1",
      "B:2",
      "B:3",
      "B:4",
      "B:5",
      "B:6",
      "B:7",
      "B:8",
    ]);
    expect(
      manifest.documentMatrix.documents.every(({ documentArtifactSha256 }) =>
        /^[a-f0-9]{64}$/u.test(documentArtifactSha256)
      )
    ).toBe(true);
    expect(assertTargetedQaManifest(copy(manifest))).toEqual(manifest);
  });

  test("binds all ten exact document artifact byte hashes and identities", () => {
    const source = inputs();
    const manifest = buildTargetedQaManifest(source);
    for (const document of manifest.documentMatrix.documents)
      expect(document.documentArtifactSha256).toBe(
        sha256(source.documentArtifactBytesByUuid[document.uuid])
      );

    const byteTamper = inputs();
    const uuid = Object.keys(byteTamper.documentArtifactBytesByUuid)[0];
    byteTamper.documentArtifactBytesByUuid[uuid] = Buffer.concat([
      byteTamper.documentArtifactBytesByUuid[uuid],
      Buffer.from(" "),
    ]);
    const tamperedManifest = buildTargetedQaManifest(byteTamper);
    expect(
      tamperedManifest.documentMatrix.documents.find(
        (document) => document.uuid === uuid
      ).documentArtifactSha256
    ).toBe(sha256(byteTamper.documentArtifactBytesByUuid[uuid]));
    const manifestFieldTamper = copy(manifest);
    manifestFieldTamper.documentMatrix.documents[0].documentArtifactSha256 =
      "0".repeat(64);
    expect(() => assertTargetedQaManifest(manifestFieldTamper)).toThrow(
      /^TARGETED_QA_/u
    );

    const missing = inputs();
    delete missing.documentArtifactBytesByUuid[
      Object.keys(missing.documentArtifactBytesByUuid)[0]
    ];
    expect(() => buildTargetedQaManifest(missing)).toThrow(
      "TARGETED_QA_DOCUMENT_ARTIFACT_MATRIX_INVALID"
    );

    const extra = inputs();
    extra.documentArtifactBytesByUuid.extra = jsonBytes({});
    expect(() => buildTargetedQaManifest(extra)).toThrow(
      "TARGETED_QA_DOCUMENT_ARTIFACT_MATRIX_INVALID"
    );

    const identity = inputs();
    const identityUuid = Object.keys(identity.documentArtifactBytesByUuid)[0];
    const artifact = JSON.parse(
      identity.documentArtifactBytesByUuid[identityUuid].toString("utf8")
    );
    artifact.fingerprint = "0".repeat(64);
    identity.documentArtifactBytesByUuid[identityUuid] = jsonBytes(artifact);
    expect(() => buildTargetedQaManifest(identity)).toThrow(
      `TARGETED_QA_DOCUMENT_ARTIFACT_IDENTITY_MISMATCH: ${identityUuid}`
    );
  });

  test("rejects package and comparison byte tampering before JSON parsing", () => {
    const packageTamper = inputs();
    packageTamper.packageContractBytes = Buffer.concat([
      packageTamper.packageContractBytes,
      Buffer.from(" "),
    ]);
    expect(() => buildTargetedQaManifest(packageTamper)).toThrow(
      "TARGETED_QA_PACKAGE_BYTES_SHA_MISMATCH"
    );

    const comparisonTamper = inputs();
    comparisonTamper.baselineComparisonBytes = Buffer.concat([
      comparisonTamper.baselineComparisonBytes,
      Buffer.from(" "),
    ]);
    expect(() => buildTargetedQaManifest(comparisonTamper)).toThrow(
      "TARGETED_QA_COMPARISON_BYTES_SHA_MISMATCH"
    );
  });

  test("rejects 9/11 and every A/B matrix drift", () => {
    const mutations = [
      (value) => value.documents.pop(),
      (value) =>
        value.documents.push(packageDocument("B", 9, value.documents.length)),
      (value) => {
        value.documents[0].side = "B";
      },
      (value) => {
        value.documents[1].position = 1;
      },
      (value) => value.documents.reverse(),
      (value) => {
        value.documents[1].role = "UNKNOWN";
      },
      (value) => {
        value.documents[1].documentStatus = "UNKNOWN";
      },
      (value) => {
        value.documents[1].sha256 = "invalid";
      },
      (value) => {
        value.documents[1].primaryManifestSha256 = "invalid";
      },
    ];
    for (const mutatePackage of mutations)
      expect(() => buildTargetedQaManifest(inputs({ mutatePackage }))).toThrow(
        /^TARGETED_QA_/u
      );
  });

  test("rejects baseline release and package profile drift", () => {
    expect(() =>
      buildTargetedQaManifest(
        inputs({
          mutatePackage: (value) => {
            value.releaseId = "different-release";
          },
        })
      )
    ).toThrow("TARGETED_QA_BASELINE_RELEASE_MISMATCH");

    expect(() =>
      buildTargetedQaManifest(
        inputs({
          mutatePackage: (value) => {
            value.productProfile.trustAnchors = {
              feC02ValidatedWorksheetRequirementV1: "0".repeat(64),
            };
          },
        })
      )
    ).toThrow("TARGETED_QA_PRODUCT_PROFILE_INVALID");

    expect(() =>
      buildTargetedQaManifest(
        inputs({
          mutatePackage: (value) => {
            value.productProfile.categoryViews.reverse();
          },
        })
      )
    ).toThrow("TARGETED_QA_PROFILE_CATEGORY_ORDER_MISMATCH");

    expect(() =>
      buildTargetedQaManifest(
        inputs({
          mutatePackage: (value) => {
            value.productProfile.categoryCatalogIds.ST =
              "st-occurrence-full-draft-other";
          },
        })
      )
    ).toThrow("TARGETED_QA_PROFILE_CATALOG_MISMATCH: ST");
  });

  test("rejects registry target and distribution tampering", () => {
    expect(() =>
      buildTargetedQaManifest(
        inputs({
          mutateRegistry: (registry) => {
            registry.categoryTargets[0].requirementIds[0] = "VS-03";
          },
        })
      )
    ).toThrow("TARGETED_QA_COMPARISON_REVIEW_MEMBERSHIP_MISMATCH");
    expect(() =>
      buildTargetedQaManifest(
        inputs({
          mutateRegistry: (registry) => {
            registry.expectedDistribution.VS = 18;
          },
        })
      )
    ).toThrow("TARGETED_QA_REGISTRY_DISTRIBUTION_INVALID");
  });

  test("rejects canonical catalog raw and semantic contract tampering", () => {
    expect(() =>
      buildTargetedQaManifest(
        inputs({
          mutateCatalogs: (catalogs) => {
            catalogs.VS = Buffer.concat([catalogs.VS, Buffer.from(" ")]);
          },
        })
      )
    ).toThrow("TARGETED_QA_CATALOG_SHA_MISMATCH: VS");
    expect(() =>
      buildTargetedQaManifest(
        inputs({
          mutateCatalogs: (catalogs) => {
            const parsed = JSON.parse(catalogs.ST.toString("utf8"));
            parsed.requirements[0].components[0].aliases.push("tampered");
            catalogs.ST = jsonBytes(parsed);
          },
        })
      )
    ).toThrow("TARGETED_QA_CATALOG_SHA_MISMATCH: ST");
  });

  test("rejects comparison projection, totals and review membership drift", () => {
    const comparisonMutations = [
      (value) => {
        value.documents[0].uuid = "other";
      },
      (value) => {
        value.documents[0].role = "SUPPLEMENT";
      },
      (value) => value.documents.reverse(),
      (value) => {
        value.totals.rows = 223;
      },
      (value) => {
        value.totals.customerReviewRequired = 68;
      },
      (value) => {
        value.totals.noCustomerReviewRequired = 156;
      },
      (value) => {
        value.totals.customerReviewRowKeysByReasonCode.TARGETED_REVIEW.pop();
      },
      (value) => {
        value.totals.pointDecisionRowKeysByOutcome.UNKLAR.pop();
      },
    ];
    for (const mutateComparison of comparisonMutations)
      expect(() =>
        buildTargetedQaManifest(inputs({ mutateComparison }))
      ).toThrow(/^TARGETED_QA_/u);
  });

  test("binds node and per-category prompts through expected execution gates", () => {
    const manifest = buildTargetedQaManifest(inputs());
    expect(() =>
      assertTargetedQaManifest(manifest, {
        expectedManifestDigestSha256: manifest.manifestDigestSha256,
        expectedExecution: execution(),
      })
    ).not.toThrow();
    const wrongNode = execution();
    wrongNode.nodeVersion = "22.0.0";
    expect(() =>
      assertTargetedQaManifest(manifest, { expectedExecution: wrongNode })
    ).toThrow("TARGETED_QA_EXPECTED_EXECUTION_MISMATCH");
    const missingPrompt = execution();
    delete missingPrompt.promptSha256ByCategory.EL.hybridAddon;
    expect(() =>
      buildTargetedQaManifest(inputs({ executionValue: missingPrompt }))
    ).toThrow("TARGETED_QA_EXECUTION_PROMPTS_INVALID");
  });
});
