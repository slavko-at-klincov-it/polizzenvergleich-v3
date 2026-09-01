const {
  calculateHybridShadowPilotRetrievalMetrics,
  validateHybridShadowPilot,
} = require("../../../utils/policyAnalysis/hybridShadowPilot");

function pilotFixture() {
  return {
    schemaVersion: 1,
    pilotId: "shadow-pilot-test-v1",
    approvalStatus: "DRAFT",
    oracleVersion: "oracle-test-v1",
    reviewerId: "test-reviewer",
    documents: [
      {
        primaryOutput: "/tmp/primary-test",
        primaryReleaseId: "1".repeat(40),
        documentFingerprint: "a".repeat(64),
        documentArtifactSha256: "b".repeat(64),
        cases: Array.from({ length: 10 }, (_, index) => {
          const positive = index < 4;
          const adversarial = index >= 4 && index < 7;
          return {
            caseId: `case-${index + 1}`,
            categoryView: "EL",
            requirementId: `EL-${String(index + 1).padStart(2, "0")}`,
            componentId: "coverage",
            primaryWorksheetSha256: "c".repeat(64),
            controlClass: positive
              ? "POSITIVE"
              : adversarial
                ? "ADVERSARIAL"
                : "TRUE_NULL",
            groundTruth: positive
              ? "RELEVANT_EVIDENCE_EXISTS"
              : "NO_RELEVANT_EVIDENCE_EXISTS",
            acceptedSourceRanges: positive
              ? [
                  {
                    physicalPageNumber: 1,
                    documentStart: index * 100,
                    documentEnd: index * 100 + 50,
                    exactQuoteSha256: String(index).repeat(64),
                  },
                ]
              : [],
            knownAdversarialSourceRanges: adversarial
              ? [
                  {
                    physicalPageNumber: 1,
                    documentStart: index * 100,
                    documentEnd: index * 100 + 50,
                    exactQuoteSha256: String(index).repeat(64),
                  },
                ]
              : [],
            expectedCandidateDisposition: positive
              ? "SUFFICIENT"
              : adversarial
                ? "RELATED_NOT_SUFFICIENT"
                : "IRRELEVANT",
            downstreamExpectation: positive
              ? "MUST_SELECT"
              : adversarial
                ? "MUST_REJECT"
                : "MUST_RETURN_NO_SELECTED_CANDIDATE",
            note: positive ? "bestätigter Primär-Miss" : "harte Negativkontrolle",
          };
        }),
      },
    ],
  };
}

describe("hybridShadowPilot", () => {
  test("accepts a balanced immutable 10-case oracle", () => {
    expect(validateHybridShadowPilot(pilotFixture())).toMatchObject({
      schemaVersion: 1,
      caseCount: 10,
      documents: [
        expect.objectContaining({
          primaryOutput: "/tmp/primary-test",
          cases: expect.arrayContaining([
            expect.objectContaining({
              caseId: "case-1",
              controlClass: "POSITIVE",
            }),
          ]),
        }),
      ],
    });
  });

  test("rejects an unbalanced or undersized pilot", () => {
    const raw = pilotFixture();
    raw.documents[0].cases = raw.documents[0].cases.slice(0, 9);
    expect(() => validateHybridShadowPilot(raw)).toThrow(
      "HYBRID_SHADOW_PILOT_CASE_COUNT_INVALID"
    );
  });

  test("measures retrieval recall at one and three separately from adversarial FPR", () => {
    const pilot = validateHybridShadowPilot(pilotFixture());
    const rankings = pilot.documents[0].cases.map((pilotCase, index) => {
      const oracleRange = pilotCase.acceptedSourceRanges[0];
      let spans = [];
      if (pilotCase.controlClass === "POSITIVE") {
        spans = index === 0
          ? [{
              accepted: true,
              physicalPageNumber: 1,
              documentStart: oracleRange.documentStart,
              documentEnd: oracleRange.documentEnd,
              exactQuoteSha256: oracleRange.exactQuoteSha256,
            }]
          : [
              {
                accepted: true,
                physicalPageNumber: 2,
                documentStart: 1,
                documentEnd: 2,
                exactQuoteSha256: "e".repeat(64),
              },
              {
                accepted: true,
                physicalPageNumber: 1,
                documentStart: oracleRange.documentStart + 1,
                documentEnd: oracleRange.documentEnd - 1,
                exactQuoteSha256: oracleRange.exactQuoteSha256,
              },
            ];
      } else if (pilotCase.controlClass === "ADVERSARIAL") {
        const range = pilotCase.knownAdversarialSourceRanges[0];
        spans = [
          {
            accepted: true,
            physicalPageNumber: 1,
            documentStart: range.documentStart,
            documentEnd: range.documentEnd,
            exactQuoteSha256: range.exactQuoteSha256,
          },
        ];
      } else if (index === 7) {
        spans = [{
          accepted: true,
          physicalPageNumber: 1,
          documentStart: 1,
          documentEnd: 2,
          exactQuoteSha256: "f".repeat(64),
        }];
      }
      return { caseId: pilotCase.caseId, spans };
    });
    const metrics = calculateHybridShadowPilotRetrievalMetrics({
      pilot,
      searchReports: [
        {
          artifactKind: "HYBRID_SHADOW_PILOT_SEARCH_REPORT",
          shadowOnly: true,
          exactSpanRankings: rankings,
        },
      ],
    });

    expect(metrics).toMatchObject({
      positiveCaseCount: 4,
      adversarialCaseCount: 3,
      trueNullCaseCount: 3,
      recallAt1: 0.25,
      recallAt3: 1,
      rawRecallAt1: 0.25,
      rawRecallAt3: 1,
      retrievalFalsePositiveRate: 1 / 3,
      knownAdversarialRetrievalAt3: 1,
    });
  });
});
