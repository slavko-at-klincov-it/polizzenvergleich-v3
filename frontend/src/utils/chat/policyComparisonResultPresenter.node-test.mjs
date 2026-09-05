import test from "node:test";
import assert from "node:assert/strict";
import presenter from "./policyComparisonResultPresenter.cjs";

const {
  presentComparisonCoverage,
  presentComparisonManifest,
  presentComparisonProgress,
  presentComparisonError,
} = presenter;

test("sorts manifest documents by position and preserves documents without positions", () => {
  const documents = [
    { uuid: "third", position: 2 },
    { uuid: "unknown" },
    { uuid: "first", position: 0 },
  ];

  assert.deepEqual(
    presenter.sortDocumentsByPosition(documents).map(({ uuid }) => uuid),
    ["first", "third", "unknown"]
  );
});

test("presents uploaded and result manifest coverage without inventing a queue manifest", () => {
  const manifest = presentComparisonManifest({
    sessionDocuments: [
      { uuid: "a", side: "A", position: 0 },
      { uuid: "b", side: "B", position: 1 },
    ],
  });

  assert.equal(manifest.status, "UPLOADED");
  assert.equal(manifest.hasResultManifest, false);
  assert.deepEqual(
    manifest.documentsBySide.A.map(({ uuid }) => uuid),
    ["a"]
  );

  const completed = presentComparisonManifest({
    sessionDocuments: [
      { uuid: "a", side: "A", position: 0 },
      { uuid: "b", side: "B", position: 1 },
    ],
    resultDocuments: [{ uuid: "a" }, { uuid: "b" }],
  });

  assert.equal(completed.status, "MATCHED");
  assert.equal(completed.resultCount, 2);
  assert.deepEqual(completed.missingFromResult, []);
});

test("derives profile coverage and requests a new LF profile only on a proven mismatch", () => {
  const matching = presentComparisonCoverage({
    result: {
      comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
      productProfile: {
        id: "LF_PROFILE_A",
        categoryCount: 2,
        rowCount: 3,
      },
      categories: [{ rows: [{}, {}] }, { rows: [{}] }],
    },
  });
  assert.deepEqual(matching.profile, {
    status: "MATCHED",
    profileId: "LF_PROFILE_A",
    expectedCategoryCount: 2,
    expectedRowCount: 3,
    observedCategoryCount: 2,
    observedRowCount: 3,
    requiresNewLfProfile: false,
  });

  const mismatch = presentComparisonCoverage({
    result: {
      comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
      productProfile: {
        id: "LF_PROFILE_A",
        categoryCount: 2,
        rowCount: 3,
      },
      categories: [{ rows: [{}] }],
    },
  });
  assert.equal(mismatch.profile.status, "MISMATCH");
  assert.equal(mismatch.profile.requiresNewLfProfile, true);

  const unavailable = presentComparisonCoverage({
    result: { comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1" },
  });
  assert.equal(unavailable.profile.status, "UNAVAILABLE");
  assert.equal(unavailable.profile.requiresNewLfProfile, false);
});

test("uses category progress when available and clamps malformed progress", () => {
  assert.deepEqual(
    presentComparisonProgress({
      phase: "ANALYZING_DOCUMENTS",
      completedDocuments: 1,
      totalDocuments: 2,
      completedCategories: 3,
      totalCategories: 4,
    }),
    {
      phase: "ANALYZING_DOCUMENTS",
      completedDocuments: 1,
      totalDocuments: 2,
      completedCategories: 3,
      totalCategories: 4,
      completed: 3,
      total: 4,
      percent: 75,
      hasCategoryProgress: true,
      currentDocument: null,
      currentCategory: null,
    }
  );
  assert.equal(
    presentComparisonProgress({
      completedDocuments: -1,
      totalDocuments: "unknown",
    }).percent,
    null
  );
});

test("marks result documents with changed identity fields as a manifest mismatch", () => {
  const coverage = presentComparisonManifest({
    sessionDocuments: [
      { uuid: "a", side: "A", sha256: "source-a", role: "MAIN_POLICY" },
    ],
    resultDocuments: [
      { uuid: "a", side: "B", sha256: "source-a", role: "MAIN_POLICY" },
    ],
  });
  assert.equal(coverage.status, "MISMATCH");
  assert.equal(coverage.missingFromResult[0].uuid, "a");
  assert.equal(coverage.unexpectedInResult[0].uuid, "a");
});

test("maps structural LF failures to a customer-safe message", () => {
  assert.match(
    presentComparisonError(
      "LF_REFERENCE_NEW_PROFILE_REQUIRED:neues LF-Profil erforderlich"
    ),
    /neues LF-Profil erforderlich/
  );
});
