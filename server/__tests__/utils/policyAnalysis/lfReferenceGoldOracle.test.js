const {
  LF_REFERENCE_BENCHMARK_CANDIDATES_CONTRACT_ID,
  buildLfReferenceGoldOracleSkeleton,
  calculateLfReferenceGoldOracleMetrics,
  sha256,
  validateLfReferenceGoldOracle,
} = require("../../../utils/policyAnalysis/lfReferenceGoldOracle");

function fixture() {
  const requirements = Array.from({ length: 283 }, (_, index) => ({
    requirementId: `REQ-${String(index + 1).padStart(3, "0")}`,
    sourceOrder: index,
    components: Array.from(
      { length: index < 65 ? 3 : 2 },
      (_unused, componentIndex) => ({
        id: `component-${componentIndex + 1}`,
        label: `Komponente ${componentIndex + 1}`,
        factRole: "INSURED_OBJECT",
        aliases: [],
      })
    ),
  }));
  const rows = requirements.map((requirement, index) => ({
    analysisRowId: `LR-${String(index + 1).padStart(3, "0")}`,
    categoryId: requirement.requirementId,
    sourceOrder: index,
    categoryName: `Zeile ${index + 1}`,
    subcategoryId: "SUB",
    subcategoryName: "Unterkategorie",
    outcome: "GEGENSTUECK_UNKLAR",
    packageB: {
      documentedContent: "Fundlage nicht entscheidbar",
      source: "kein entscheidungsfähiger Nullfund",
      contributors: [],
    },
  }));
  const bFingerprint = "b".repeat(64);
  const result = {
    comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
    contractId: "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1",
    sessionUuid: "session-test",
    runSignature: "c".repeat(64),
    template: {
      semanticRequirementManifestSha256: "e".repeat(64),
    },
    documents: [
      {
        uuid: "document-a",
        side: "A",
        role: "MAIN_POLICY",
        documentStatus: "FRAMEWORK_TERMS",
        originalName: "A.pdf",
        sha256: "a".repeat(64),
      },
      {
        uuid: "document-b",
        side: "B",
        role: "TERMS",
        documentStatus: "FRAMEWORK_TERMS",
        originalName: "B.pdf",
        sha256: bFingerprint,
      },
    ],
    categories: [{ categoryView: "LR01", rows }],
  };
  const semanticManifest = {
    semanticOracleId: "semantic-test-v1",
    manifestSha256: "e".repeat(64),
    requirements,
  };
  const quote = "Gebäude am Versicherungsort laut Polizze.";
  const benchmark = {
    schemaVersion: 1,
    contractId: LF_REFERENCE_BENCHMARK_CANDIDATES_CONTRACT_ID,
    artifactKind: "LF_COUNTERPART_BENCHMARK_CANDIDATES",
    status: "SEARCH_COMPLETE_REVIEW_REQUIRED",
    shadowOnly: true,
    primaryMutationAllowed: false,
    qwenExecuted: false,
    candidateKind: "NAVIGATION_EXACT_ORIGINAL_SPAN",
    candidates: [
      {
        candidateId: "candidate:test",
        analysisRowId: "LR-001",
        requirementId: "REQ-001",
        componentId: "component-1",
        channel: "EMBEDDING",
        rank: 1,
        score: 0.9,
        candidateKind: "NAVIGATION_EXACT_ORIGINAL_SPAN",
        navigationOnly: true,
        semanticDecision: null,
        channelProvenance: {},
        source: {
          documentUuid: "document-b",
          documentFingerprint: bFingerprint,
          physicalPageNumber: 1,
          documentStart: 0,
          documentEnd: quote.length,
          exactQuote: quote,
          exactQuoteSha256: sha256(quote),
        },
      },
    ],
  };
  return {
    result,
    semanticManifest,
    benchmark,
    bFingerprint,
    quote,
  };
}

function skeleton() {
  const input = fixture();
  return {
    input,
    oracle: buildLfReferenceGoldOracleSkeleton({
      oracleId: "lf-known-packet-v1",
      sourceCommit: "d".repeat(40),
      result: input.result,
      resultSha256: "1".repeat(64),
      semanticManifest: input.semanticManifest,
      semanticManifestSha256: "2".repeat(64),
      benchmark: input.benchmark,
      benchmarkSha256: "3".repeat(64),
      createdAt: "2026-09-10T00:00:00.000Z",
    }),
  };
}

function approveAsAbsent(oracle, bFingerprint) {
  const approved = JSON.parse(JSON.stringify(oracle));
  const reviewedAt = "2026-09-10T01:00:00.000Z";
  approved.approval = {
    status: "APPROVED",
    reviewerIds: ["expert-a", "expert-b"],
    adjudicatorId: "expert-c",
    approvedAt: reviewedAt,
  };
  approved.summary.unreviewedRowCount = 0;
  approved.summary.unreviewedComponentCount = 0;
  for (const row of approved.rows) {
    row.referenceValidity = "VALID";
    row.rowTruth = "ABSENT_CERTIFIED";
    row.review = {
      status: "APPROVED",
      reviewerIds: ["expert-a", "expert-b"],
      adjudicatorId: "expert-c",
      reviewedAt,
      note: null,
    };
    for (const component of row.components) {
      component.truth = "ABSENT_CERTIFIED";
      component.coverageEffect = "NOT_APPLICABLE";
      component.scopeRelation = "NOT_APPLICABLE";
      component.absenceCertification = {
        status: "CERTIFIED_ABSENT",
        protocolId: "FULL_PACKET_DOUBLE_REVIEW_V1",
        reviewerIds: ["expert-a", "expert-b"],
        reviewedDocumentFingerprints: [bFingerprint],
        completedAt: reviewedAt,
      };
      component.review = {
        status: "APPROVED",
        reviewerIds: ["expert-a", "expert-b"],
        adjudicatorId: "expert-c",
        reviewedAt,
        note: null,
      };
    }
  }
  return approved;
}

describe("lfReferenceGoldOracle", () => {
  test("materializes all 283 rows and 631 components as unreviewed", () => {
    const { oracle } = skeleton();

    expect(oracle.summary).toEqual({
      rowCount: 283,
      componentCount: 631,
      benchmarkCandidateCount: 1,
      unreviewedRowCount: 283,
      unreviewedComponentCount: 631,
    });
    expect(oracle.rows[0]).toMatchObject({
      analysisRowId: "LR-001",
      requirementId: "REQ-001",
      referenceValidity: "UNREVIEWED",
      rowTruth: "UNREVIEWED",
      benchmarkCandidateIds: ["candidate:test"],
    });
    expect(oracle.rows[0].components[0]).toMatchObject({
      truth: "UNREVIEWED",
      benchmarkCandidateIds: ["candidate:test"],
    });
  });

  test("rejects a tampered exact quote hash", () => {
    const { oracle } = skeleton();
    oracle.benchmarkCandidates[0].range.exactQuote = "verändert";

    expect(() => validateLfReferenceGoldOracle(oracle)).toThrow(
      "LF_GOLD_ORACLE_EVIDENCE_RANGE_INVALID"
    );
  });

  test("does not emit quality metrics for an unapproved skeleton", () => {
    const { oracle } = skeleton();

    expect(
      calculateLfReferenceGoldOracleMetrics({ oracle, predictions: null })
    ).toMatchObject({
      status: "NOT_EVALUABLE",
      reasons: ["ORACLE_NOT_APPROVED", "ORACLE_LABELS_INCOMPLETE"],
      qualityMetrics: null,
    });
  });

  test("evaluates only a fully approved and completely predicted oracle", () => {
    const { oracle, input } = skeleton();
    const approved = approveAsAbsent(oracle, input.bFingerprint);
    const predictions = {
      rows: approved.rows.map((row) => ({
        analysisRowId: row.analysisRowId,
        rowTruth: row.rowTruth,
        components: row.components.map((component) => ({
          componentId: component.componentId,
          truth: component.truth,
          coverageEffect: component.coverageEffect,
          scopeRelation: component.scopeRelation,
          normalizedValues: component.normalizedValues,
          selectedSourceRanges: [],
        })),
      })),
    };

    expect(
      calculateLfReferenceGoldOracleMetrics({
        oracle: approved,
        predictions,
      })
    ).toMatchObject({
      status: "EVALUATED",
      qualityMetrics: {
        exactRowAccuracy: 1,
        exactComponentAccuracy: 1,
        componentEvidenceFalsePositiveRate: 0,
      },
    });
  });
});
