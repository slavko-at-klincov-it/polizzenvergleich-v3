const {
  DECISIONS_CONTRACT_ID,
  OUTPUT_CONTRACT_ID,
  buildLfKnownFixtureGold30,
} = require("../../../utils/policyAnalysis/lfKnownFixtureGold30");

const digest = (character) => character.repeat(64);

function fixture() {
  const requirements = Array.from({ length: 30 }, (_, index) => `REQ-${index}`);
  const pending = new Set(requirements.slice(21));
  const packetRows = requirements.map((requirementId, index) => ({
    requirementId,
    globalReferenceARebind: [
      {
        candidateId: `candidate-${index}`,
        documentFingerprint: digest("1"),
        documentName: "B-0.pdf",
        documentRole: "MAIN_POLICY",
        documentStatus: "PROPOSAL",
        physicalPageNumber: 1,
        documentStart: index * 10,
        documentEnd: index * 10 + 9,
        exactQuote: `Quelle ${index}`,
        exactQuoteSha256: digest("a"),
        oracleExactQuoteSha256: digest("b"),
      },
    ],
    components: [],
  }));
  const documents = Array.from({ length: 9 }, (_, index) => ({
    originalName: `B-${index}.pdf`,
    fingerprint: digest(String(index + 1)),
    role: index ? "TERMS" : "MAIN_POLICY",
    documentStatus: index ? "FRAMEWORK_TERMS" : "PROPOSAL",
    pageCount: index === 0 ? 69 : 1,
  }));
  return {
    packet: {
      contractId: "LF_1PLUS9_SOURCE_REVIEW_PACKET_V6",
      status: "READY_FOR_SOURCE_REVIEW",
      packetSha256: digest("c"),
      rows: packetRows,
    },
    adjudication: {
      contractId: "LF_1PLUS9_SOURCE_ADJUDICATION_DRAFT_V1",
      adjudicationSha256: digest("d"),
      bindings: { qwenSummarySha256: digest("e"), qwenModel: { id: "qwen" } },
      rows: requirements.map((requirementId, index) => ({
        requirementId,
        claudeFoundStatus: "Nein",
        systemSearchStatus: "Nicht gefunden",
        qwenOutcome: "NO_COUNTERPART_ESTABLISHED",
        qwenCustomerFound: false,
        codexDecision: {
          outcome: pending.has(requirementId)
            ? "NO_COUNTERPART_ESTABLISHED"
            : "PARTIAL_COUNTERPART",
          customerFound: !pending.has(requirementId),
          rationale: `Basis ${index}`,
          selectedSources: pending.has(requirementId)
            ? []
            : [{ exactQuote: `Quelle ${index}` }],
        },
      })),
    },
    fullCorpusAudit: {
      contractId: "LF_1PLUS9_FULL_CORPUS_AUDIT_V1",
      status: "FULL_PDF_TEXT_CORPUS_SEARCH_COMPLETE_SEMANTIC_REVIEW_REQUIRED",
      auditSha256: digest("f"),
      summary: { documents: 9, pages: 77 },
      documents,
      rows: requirements.slice(21).map((requirementId, index) => ({
        requirementId,
        sourceSearchComplete: true,
        documentsSearched: 9,
        pagesSearched: 77,
        routesExecuted: 1,
        matches:
          index === 0
            ? [
                {
                  routeId: "route",
                  documentFingerprint: digest("1"),
                  documentName: "B-0.pdf",
                  documentRole: "MAIN_POLICY",
                  documentStatus: "PROPOSAL",
                  physicalPageNumber: 1,
                  pageTextStart: 0,
                  pageTextEnd: 10,
                  exactQuote: "Vollkorpusquelle",
                  exactQuoteSha256: digest("9"),
                },
              ]
            : [],
      })),
    },
    decisions: {
      contractId: DECISIONS_CONTRACT_ID,
      positiveRationaleOverrides: {},
      rows: requirements.slice(21).map((requirementId, index) => ({
        requirementId,
        outcome:
          index === 0 ? "PARTIAL_COUNTERPART" : "NO_COUNTERPART_ESTABLISHED",
        rationale: `Vollkorpusentscheidung ${index}`,
        selectedPacketCandidateIds:
          index === 0 ? [`candidate-${index + 21}`] : [],
        selectedFullCorpusMatches:
          index === 0
            ? [
                {
                  routeId: "route",
                  documentFingerprint: digest("1"),
                  physicalPageNumber: 1,
                },
              ]
            : [],
        rejectAllOtherFullCorpusMatches: true,
      })),
    },
  };
}

describe("LF known fixture Gold 30", () => {
  it("freezes twenty-two found and eight full-corpus negative rows", () => {
    const gold = buildLfKnownFixtureGold30({
      ...fixture(),
      packetFileSha256: digest("1"),
      adjudicationFileSha256: digest("2"),
      fullCorpusAuditFileSha256: digest("3"),
      decisionsFileSha256: digest("4"),
      createdAt: "2026-09-13T00:00:00.000Z",
    });
    expect(gold.contractId).toBe(OUTPUT_CONTRACT_ID);
    expect(gold.goldAuthority).toBe(true);
    expect(gold.productionRule).toBe(false);
    expect(gold.summary).toMatchObject({
      rows: 30,
      customerFound: 22,
      customerNotFound: 8,
      knownFixtureAbsenceCertified: 8,
    });
    expect(gold.rows[21].goldDecision.sources).toHaveLength(2);
    expect(gold.rows[0].goldDecision.reviewStatus).toBe(
      "SOURCE_BOUND_FINAL_FOR_KNOWN_FIXTURE"
    );
    expect(gold.rows[0].priorCodexDraft).toBeDefined();
    expect(gold.rows[22].goldDecision.absenceSearch).toMatchObject({
      certifiedForKnownFixture: true,
      documentsSearched: 9,
      pagesSearched: 77,
    });
  });

  it("rejects an invented packet candidate and an incomplete PDF audit", () => {
    const invented = fixture();
    invented.decisions.rows[0].selectedPacketCandidateIds = ["invented"];
    expect(() =>
      buildLfKnownFixtureGold30({
        ...invented,
        packetFileSha256: digest("1"),
        adjudicationFileSha256: digest("2"),
        fullCorpusAuditFileSha256: digest("3"),
        decisionsFileSha256: digest("4"),
      })
    ).toThrow("LF_GOLD_30_PACKET_CANDIDATE_INVALID");

    const incomplete = fixture();
    incomplete.fullCorpusAudit.rows[0].pagesSearched = 76;
    expect(() =>
      buildLfKnownFixtureGold30({
        ...incomplete,
        packetFileSha256: digest("1"),
        adjudicationFileSha256: digest("2"),
        fullCorpusAuditFileSha256: digest("3"),
        decisionsFileSha256: digest("4"),
      })
    ).toThrow("LF_GOLD_30_DECISION_INVALID:REQ-21");
  });
});
