const {
  buildHybridShadowTargets,
  buildHybridShadowWorksheet,
  calculateHybridShadowMetrics,
  exactSourceSpansFromNavigationChunk,
  loadHybridShadowContract,
  validateHybridShadowContract,
  verifyRankedChunk,
  zeroPrimaryComponents,
} = require("../../../utils/policyAnalysis/hybridShadowSearch");
const {
  buildCandidateTriagePayload,
} = require("../../../utils/policyAnalysis/candidateTriageContract");

function contract(enabled = true) {
  return validateHybridShadowContract({
    schemaVersion: 1,
    contractId: "shadow-test-v1",
    enabled,
    mode: "SHADOW_ONLY",
    failurePolicy: "FAIL_SHADOW_RUN",
    provider: {
      kind: "OPENAI_COMPATIBLE_EMBEDDINGS",
      baseUrl: "http://127.0.0.1:1234/v1",
      model: "embedding-test-model",
      dimensions: 2,
      apiKeyEnv: null,
      requestTimeoutMs: 5000,
      modelArtifactPath: "/tmp/embedding-test-model",
      modelArtifactSha256: "a".repeat(64),
      runtimeRevision: "test-runtime-revision",
      runtimeArtifactPath: "/tmp/embedding-test-runtime",
      runtimeArtifactSha256: "b".repeat(64),
      inputNormalization: "NONE_V1",
    },
    retrieval: {
      chunkSize: 500,
      chunkOverlap: 50,
      topK: 1,
      batchSize: 8,
      minimumScore: 0.2,
    },
  });
}

function fixture() {
  const text = "Deckung für Rückstau ist ausdrücklich vereinbart.";
  const document = {
    id: "fingerprint",
    sourceDocumentId: "fingerprint",
    title: "fixture.pdf",
    documentType: "pdf",
    pageContent: text,
    pageMap: [{ pageNumber: 1, start: 0, end: text.length }],
    pdfExtraction: {
      schemaVersion: 1,
      totalPages: 1,
      processedPages: 1,
      pagesWithText: 1,
      complete: true,
    },
  };
  const worksheet = {
    schemaVersion: 2,
    candidateOnly: true,
    catalog: { id: "el-test", categoryView: "EL", schemaVersion: 1 },
    document: {
      sourceDocumentId: "fingerprint",
      title: "fixture.pdf",
      fingerprint: "fingerprint",
      physicalPages: 1,
      pageContentSha256: "test",
    },
    summary: {
      requirementCount: 1,
      componentCount: 2,
      componentsWithCandidates: 1,
      componentsWithoutCandidates: 1,
      occurrenceCount: 1,
    },
    bindingGroups: [],
    requirements: [
      {
        id: "EL-01",
        label: "Rückstau",
        requestedFields: [],
        scopeRules: { narrowAliases: [], narrowScopeKeys: [] },
        scopePolicy: "GENERAL_REQUIRED",
        componentSatisfactionPolicy: "ALL",
        coverageAggregationPolicy: "ALL_COMPONENT_EFFECTS",
        componentCount: 2,
        components: [
          {
            id: "coverage",
            label: "Deckung",
            factRole: "COVERAGE",
            contextMode: "STRUCTURAL",
            aliases: ["Rückstau"],
            terminalState: "NO_CONTROLLED_CANDIDATE",
            occurrenceCount: 0,
            occurrences: [],
          },
          {
            id: "existing",
            label: "Bestehender Treffer",
            factRole: "COVERAGE",
            contextMode: "STRUCTURAL",
            aliases: ["Deckung"],
            terminalState: "CONTROLLED_CANDIDATES_FOUND",
            occurrenceCount: 1,
            occurrences: [{ candidateId: "candidate:primary" }],
          },
        ],
      },
    ],
  };
  return { document, worksheet, text };
}

describe("hybridShadowSearch", () => {
  test("is disabled without an explicit contract path", () => {
    expect(loadHybridShadowContract()).toEqual({
      contract: null,
      identity: expect.objectContaining({
        enabled: false,
        mode: "SHADOW_ONLY",
        contractSha256: null,
      }),
    });
  });

  test("rejects implicit or insecure provider configuration", () => {
    expect(() =>
      validateHybridShadowContract({
        ...contract(),
        provider: { ...contract().provider, baseUrl: "http://example.com/v1" },
      })
    ).toThrow("HYBRID_SHADOW_BASE_URL_INSECURE");
  });

  test("targets only components with a consistent primary null result", () => {
    const { worksheet } = fixture();
    expect(zeroPrimaryComponents(worksheet)).toHaveLength(1);
    expect(
      buildHybridShadowTargets({ worksheet, contract: contract() })
    ).toEqual([
      expect.objectContaining({
        requirementId: "EL-01",
        componentId: "coverage",
        topK: 1,
      }),
    ]);
  });

  test("targets only the explicit pilot allowlist without leaking oracle labels", () => {
    const { worksheet } = fixture();
    const oracleHash = "d".repeat(64);
    const targets = buildHybridShadowTargets({
      worksheet,
      contract: contract(),
      allowedTargets: [
        {
          caseId: "pilot-positive-01",
          requirementId: "EL-01",
          componentId: "coverage",
          controlClass: "POSITIVE",
          groundTruth: "RELEVANT_EVIDENCE_EXISTS",
          acceptedExactQuoteSha256: [oracleHash],
          note: "Dieser Text darf die Suche nicht beeinflussen.",
        },
      ],
    });

    expect(targets).toHaveLength(1);
    expect(targets[0].pilotCaseId).toBe("pilot-positive-01");
    expect(JSON.stringify(targets)).not.toContain(oracleHash);
    expect(JSON.stringify(targets)).not.toContain("groundTruth");
    expect(JSON.stringify(targets)).not.toContain("controlClass");
    expect(JSON.stringify(targets)).not.toContain("Dieser Text");
  });

  test("rejects an allowlisted component that is not a primary null", () => {
    const { worksheet } = fixture();
    expect(() =>
      buildHybridShadowTargets({
        worksheet,
        contract: contract(),
        allowedTargets: [
          {
            caseId: "not-null",
            requirementId: "EL-01",
            componentId: "existing",
          },
        ],
      })
    ).toThrow("HYBRID_SHADOW_ALLOWED_TARGET_NOT_PRIMARY_NULL");
  });

  test("builds an exact-offset shadow worksheet without mutating primary", () => {
    const { document, worksheet, text } = fixture();
    const before = JSON.parse(JSON.stringify(worksheet));
    const validatedContract = contract();
    const identity = {
      schemaVersion: 1,
      contractId: validatedContract.contractId,
      enabled: true,
      mode: "SHADOW_ONLY",
      contractSha256: "a".repeat(64),
      provider: validatedContract.provider,
      retrieval: validatedContract.retrieval,
    };
    const targets = buildHybridShadowTargets({
      worksheet,
      contract: validatedContract,
    });
    const shadow = buildHybridShadowWorksheet({
      primaryWorksheet: worksheet,
      document,
      contractIdentity: identity,
      primaryWorksheetSha256: "b".repeat(64),
      documentArtifactSha256: "c".repeat(64),
      rankedTargets: [
        {
          ...targets[0],
          spans: [
            {
              id: "hybrid-exact-span:test",
              navigationChunkId: "hybrid-chunk:test",
              navigationScore: 0.8,
              pageNumber: 1,
              physicalPageNumber: 1,
              pageStart: 0,
              pageEnd: text.length,
              documentStart: 0,
              documentEnd: text.length,
              text,
              score: 0.9,
            },
          ],
        },
      ],
    });

    expect(worksheet).toEqual(before);
    expect(shadow.shadowSearch).toMatchObject({
      shadowOnly: true,
      mode: "SHADOW_ONLY",
    });
    expect(shadow.summary).toMatchObject({
      componentCount: 1,
      occurrenceCount: 1,
    });
    expect(shadow.requirements[0].components).toHaveLength(1);
    expect(shadow.requirements[0].components[0].occurrences[0]).toMatchObject({
      discoveryMethod: "HYBRID_EXACT_SPAN_SEMANTIC",
      physicalPageNumber: 1,
      documentStart: 0,
      documentEnd: text.length,
      exactText: text,
    });
    expect(
      buildCandidateTriagePayload(shadow).bindingTargets[0].modelDecisionFields
    ).toEqual(["roleMatch", "scopeMatch"]);
  });

  test("derives exact source spans from navigation chunks", () => {
    const { document, text } = fixture();
    const spans = exactSourceSpansFromNavigationChunk({
      document,
      navigationChunk: {
        id: "hybrid-chunk:test",
        pageNumber: 1,
        physicalPageNumber: 1,
        pageStart: 0,
        pageEnd: text.length,
        documentStart: 0,
        documentEnd: text.length,
        text,
        score: 0.8,
      },
    });
    expect(spans).toEqual([
      expect.objectContaining({
        navigationChunkId: "hybrid-chunk:test",
        documentStart: 0,
        documentEnd: text.length,
        text,
      }),
    ]);
  });

  test("fails closed when page and document offsets do not reproduce quote", () => {
    const { document, text } = fixture();
    expect(() =>
      verifyRankedChunk({
        document,
        chunk: {
          id: "hybrid-chunk:bad",
          pageNumber: 1,
          physicalPageNumber: 1,
          pageStart: 0,
          pageEnd: text.length,
          documentStart: 0,
          documentEnd: text.length,
          text: `${text}!`,
          score: 0.8,
        },
      })
    ).toThrow("HYBRID_SHADOW_EXACT_SOURCE_MISMATCH");
  });

  test("measures reviewed shadow recall separately from false-positive rate", () => {
    const metrics = calculateHybridShadowMetrics({
      artifactKind: "HYBRID_SHADOW_RECALL_FPR_REVIEW",
      shadowOnly: true,
      targetReviews: [
        {
          requirementId: "EL-01",
          componentId: "one",
          primaryCandidateCount: 0,
          shadowCandidateCount: 1,
          shadowSelectedCandidateCount: 1,
          labels: {
            groundTruth: "RELEVANT_EVIDENCE_EXISTS",
            primaryRecall: "PRIMARY_MISS",
            confusionClass: "TRUE_POSITIVE",
          },
        },
        {
          requirementId: "EL-02",
          componentId: "two",
          primaryCandidateCount: 0,
          shadowCandidateCount: 0,
          shadowSelectedCandidateCount: 0,
          labels: {
            groundTruth: "RELEVANT_EVIDENCE_EXISTS",
            primaryRecall: "PRIMARY_MISS",
            confusionClass: "FALSE_NEGATIVE",
          },
        },
        {
          requirementId: "EL-03",
          componentId: "three",
          primaryCandidateCount: 0,
          shadowCandidateCount: 1,
          shadowSelectedCandidateCount: 1,
          labels: {
            groundTruth: "NO_RELEVANT_EVIDENCE_EXISTS",
            primaryRecall: "PRIMARY_CORRECT_NULL",
            confusionClass: "FALSE_POSITIVE",
          },
        },
        {
          requirementId: "EL-04",
          componentId: "four",
          primaryCandidateCount: 0,
          shadowCandidateCount: 0,
          shadowSelectedCandidateCount: 0,
          labels: {
            groundTruth: "NO_RELEVANT_EVIDENCE_EXISTS",
            primaryRecall: "PRIMARY_CORRECT_NULL",
            confusionClass: "TRUE_NEGATIVE",
          },
        },
      ],
      candidates: [
        {
          requirementId: "EL-01",
          componentId: "one",
          candidateId: "candidate:one",
          evidence: { selected: true },
          reviewLabels: { relevance: "TRUE_POSITIVE" },
        },
        {
          requirementId: "EL-03",
          componentId: "three",
          candidateId: "candidate:three",
          evidence: { selected: true },
          reviewLabels: { relevance: "FALSE_POSITIVE" },
        },
      ],
    });

    expect(metrics).toMatchObject({
      recoveredPrimaryMissCount: 1,
      reviewedCandidatePrecision: 0.5,
      shadowRecall: 0.5,
      falsePositiveRate: 0.5,
    });
  });

  test("rejects a reviewed candidate that is not bound to its target", () => {
    expect(() =>
      calculateHybridShadowMetrics({
        artifactKind: "HYBRID_SHADOW_RECALL_FPR_REVIEW",
        shadowOnly: true,
        targetReviews: [
          {
            requirementId: "EL-01",
            componentId: "coverage",
            primaryCandidateCount: 0,
            shadowCandidateCount: 0,
            shadowSelectedCandidateCount: 0,
            labels: {
              groundTruth: "NO_RELEVANT_EVIDENCE_EXISTS",
              primaryRecall: "PRIMARY_CORRECT_NULL",
              confusionClass: "TRUE_NEGATIVE",
            },
          },
        ],
        candidates: [
          {
            requirementId: "EL-99",
            componentId: "other",
            candidateId: "candidate:foreign",
            evidence: { selected: true },
            reviewLabels: { relevance: "FALSE_POSITIVE" },
          },
        ],
      })
    ).toThrow("HYBRID_SHADOW_REVIEW_CANDIDATE_INVALID");
  });
});
