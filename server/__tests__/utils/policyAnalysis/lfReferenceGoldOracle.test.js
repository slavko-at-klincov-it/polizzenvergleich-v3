const {
  LF_REFERENCE_ABSENCE_COMPLETENESS_CONTRACT_ID,
  LF_REFERENCE_BENCHMARK_CANDIDATES_CONTRACT_ID,
  REQUIRED_ABSENCE_CHANNELS,
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
  const quote = "Gebäude am Versicherungsort laut Polizze.";
  const documentArtifact = {
    schemaVersion: 1,
    fingerprint: bFingerprint,
    document: {
      sourceDocumentId: bFingerprint,
      pageContent: quote,
      pageMap: [{ pageNumber: 1, start: 0, end: quote.length }],
    },
  };
  const artifactBytes = Buffer.from(JSON.stringify(documentArtifact));
  const artifactSha256 = sha256(artifactBytes);
  const pageMapSha256 = sha256(
    JSON.stringify([{ end: quote.length, pageNumber: 1, start: 0 }])
  );
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
  const input = {
    comparisonMode: result.comparisonMode,
    sessionUuid: result.sessionUuid,
    documents: result.documents.map((document, position) => ({
      ...document,
      position: document.side === "B" ? position - 1 : 0,
    })),
  };
  const runContract = {
    comparisonMode: result.comparisonMode,
    releaseId: "d".repeat(40),
  };
  const semanticManifest = {
    semanticOracleId: "semantic-test-v1",
    manifestSha256: "e".repeat(64),
    requirements,
  };
  const benchmark = {
    schemaVersion: 1,
    contractId: LF_REFERENCE_BENCHMARK_CANDIDATES_CONTRACT_ID,
    artifactKind: "LF_COUNTERPART_BENCHMARK_CANDIDATES",
    status: "CHANNELS_COMPLETE_REVIEW_REQUIRED",
    shadowOnly: true,
    primaryMutationAllowed: false,
    qwenExecuted: false,
    candidateKind: "NAVIGATION_EXACT_ORIGINAL_SPAN",
    source: {
      runSignature: result.runSignature,
      semanticRequirementManifestSha256: semanticManifest.manifestSha256,
      inventorySha256: "5".repeat(64),
      candidatesSha256: "3".repeat(64),
    },
    runSignature: result.runSignature,
    sourceResultSha256: "1".repeat(64),
    sourceSemanticManifestSha256: "2".repeat(64),
    sourceInventorySha256: "5".repeat(64),
    candidates: [
      {
        candidateId: "candidate:test",
        analysisRowId: "LR-001",
        requirementId: "REQ-001",
        componentId: "component-1",
        channel: "UNION",
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
  const inventory = {
    sourceBindings: {
      runReleaseId: runContract.releaseId,
      runSignature: result.runSignature,
      semanticRequirementManifestSha256: semanticManifest.manifestSha256,
    },
  };
  const benchmarkManifest = {
    status: benchmark.status,
    implementation: { releaseId: "f".repeat(40) },
    source: {
      runSignature: result.runSignature,
      semanticRequirementManifestSha256: semanticManifest.manifestSha256,
      inventorySha256: "5".repeat(64),
      candidatesSha256: "3".repeat(64),
    },
  };
  const documentArtifactsByUuid = new Map([
    [
      "document-b",
      {
        artifact: documentArtifact,
        artifactBytes,
        artifactSha256,
        pageMapSha256,
      },
    ],
  ]);
  return {
    input,
    runContract,
    result,
    semanticManifest,
    benchmark,
    benchmarkManifest,
    inventory,
    hashes: {
      inputSha256: "6".repeat(64),
      runContractSha256: "7".repeat(64),
      resultSha256: "1".repeat(64),
      resultArtifactManifestSha256: "8".repeat(64),
      semanticManifestSha256: "2".repeat(64),
      templateArtifactManifestSha256: "9".repeat(64),
      inventorySha256: "5".repeat(64),
      benchmarkSha256: "3".repeat(64),
      benchmarkManifestSha256: "0".repeat(64),
    },
    documentArtifactsByUuid,
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
      ...input,
      createdAt: "2026-09-10T00:00:00.000Z",
    }),
  };
}

function approveAsAbsent(oracle) {
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
        schemaVersion: 1,
        contractId: LF_REFERENCE_ABSENCE_COMPLETENESS_CONTRACT_ID,
        status: "CERTIFIED_ABSENT",
        reviewerIds: ["expert-a", "expert-b"],
        requiredChannels: REQUIRED_ABSENCE_CHANNELS,
        reviewedDocuments: approved.documents
          .filter(({ side }) => side === "B")
          .map(({ uuid, fingerprint, artifactSha256, pageMapSha256 }) => ({
            uuid,
            fingerprint,
            artifactSha256,
            pageMapSha256,
          })),
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

  test("allows the same PDF fingerprint under distinct document UUIDs", () => {
    const { oracle, input } = skeleton();
    const duplicate = {
      ...oracle.documents.find(({ side }) => side === "B"),
      uuid: "document-b-duplicate",
      originalName: "B duplicate.pdf",
    };
    oracle.documents.push(duplicate);
    input.documentArtifactsByUuid.set(
      duplicate.uuid,
      input.documentArtifactsByUuid.get("document-b")
    );

    expect(
      validateLfReferenceGoldOracle(oracle, {
        documentArtifactsByUuid: input.documentArtifactsByUuid,
      })
    ).toBe(oracle);
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
    const approved = approveAsAbsent(oracle);
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
        documentArtifactsByUuid: input.documentArtifactsByUuid,
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

  test("requires every B artifact before an approved oracle can be evaluated", () => {
    const { oracle } = skeleton();
    const approved = approveAsAbsent(oracle);

    expect(() => validateLfReferenceGoldOracle(approved)).toThrow(
      "LF_GOLD_ORACLE_DOCUMENT_ARTIFACTS_REQUIRED"
    );
  });

  test("does not count narrower support as full when equality is required", () => {
    const { oracle, input } = skeleton();
    const approved = approveAsAbsent(oracle);
    const row = approved.rows[0];
    row.rowTruth = "FULL_COUNTERPART";
    for (const component of row.components) {
      component.truth = "DIRECT_SUPPORT";
      component.coverageEffect = "INCLUDED";
      component.scopeRelation = "SAME_OR_BROADER";
      component.acceptedSourceRanges = [approved.benchmarkCandidates[0].range];
      component.absenceCertification = null;
    }
    row.components[0].truth = "NARROWER_SUPPORT";
    row.components[0].scopeRelation = "NARROWER";

    expect(() =>
      validateLfReferenceGoldOracle(approved, {
        documentArtifactsByUuid: input.documentArtifactsByUuid,
      })
    ).toThrow("LF_GOLD_ORACLE_ROW_TRUTH_INCONSISTENT");
  });
});
