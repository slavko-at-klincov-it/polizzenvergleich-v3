const {
  analyzeLegacyAudit,
  normalizeComparable,
  quoteMatch,
} = require("../../../scripts/qa/analyzeLfReferenceDiscoveryAgainstLegacyAudit.cjs");

function candidate({ row = "LR01-001", text, channels }) {
  return {
    candidateId: `${row}:${channels.join("+")}`,
    analysisRowId: row,
    rank: 1,
    source: { exactQuote: text },
    channelProvenance: {
      channelTraces: channels.map((channel) => ({ channel })),
    },
  };
}

describe("analyzeLfReferenceDiscoveryAgainstLegacyAudit", () => {
  test("normalizes punctuation and whitespace without destroying German text", () => {
    expect(normalizeComparable("  Schäden – durch ÖL!  ")).toBe(
      "schäden durch öl"
    );
    expect(
      quoteMatch(
        "Diese Rahmenvereinbarung gilt für Neuverträge.",
        "Abschnitt 1: Diese Rahmenvereinbarung gilt für Neuverträge! Ende."
      )
    ).toBe(true);
  });

  test("attributes exact legacy evidence independently to each retrieval channel", () => {
    const report = analyzeLegacyAudit({
      candidatesArtifact: {
        status: "CHANNELS_COMPLETE_REVIEW_REQUIRED",
        runSignature: "run",
        candidates: [
          candidate({
            text: "Die Rahmenvereinbarung gilt für Neuverträge und Konvertierungen.",
            channels: ["LEXICAL_BM25", "DINGHY"],
          }),
          candidate({
            row: "LR01-002",
            text: "Nur ein nicht passender Text.",
            channels: ["DINGHY"],
          }),
        ],
      },
      comparison: {
        categories: [
          {
            rows: [
              {
                analysisRowId: "LR01-001",
                outcome: "GEGENSTUECK_UNKLAR",
                packageB: {},
              },
            ],
          },
        ],
      },
      legacyCases: [
        {
          caseId: "LR01-001",
          result: {
            decision: "FOUND",
            exactQuotes: [
              {
                candidateId: "B02-P002-C01",
                quote: "Rahmenvereinbarung gilt für Neuverträge",
              },
            ],
          },
        },
        {
          caseId: "LR01-002",
          result: {
            decision: "PARTIAL",
            exactQuotes: [
              { candidateId: "B01-P001-C01", quote: "fehlende Evidenz" },
            ],
          },
        },
      ],
    });

    expect(report.summary.positiveEvidence).toMatchObject({
      rowCount: 2,
      exactEvidenceQuoteCount: 2,
      unionRecoveredQuoteCount: 1,
      unionExactQuoteRecall: 0.5,
      allEvidenceRecoveredRowCount: 1,
      incrementalDinghyOverDeterministicQuoteCount: 0,
      incrementalDeterministicOverDinghyQuoteCount: 0,
    });
    expect(report.summary.positiveEvidence.byStrategy.FULL_UNION).toMatchObject(
      { recoveredQuoteCount: 1, exactQuoteRecall: 0.5 }
    );
    expect(
      report.summary.positiveEvidence.byStrategy.DETERMINISTIC_UNION
    ).toMatchObject({ recoveredQuoteCount: 1, exactQuoteRecall: 0.5 });
    expect(
      report.summary.positiveEvidence.byChannel.DINGHY.recoveredQuoteCount
    ).toBe(1);
    expect(
      report.summary.positiveEvidence.byChannel.LEXICAL_BM25.recoveredQuoteCount
    ).toBe(1);
    expect(report.missedEvidence).toHaveLength(1);
    expect(report.evidence).toHaveLength(2);
  });

  test("fails closed when the embedding channel did not finish", () => {
    expect(() =>
      analyzeLegacyAudit({
        candidatesArtifact: { status: "EMBEDDING_NOT_RUN" },
        comparison: {},
        legacyCases: [],
      })
    ).toThrow("LF_DISCOVERY_LEGACY_AUDIT_REQUIRES_COMPLETE_CHANNELS");
  });
});
