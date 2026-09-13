const {
  INPUT_CONTRACT_ID,
  OUTPUT_CONTRACT_ID,
  buildLfKnownFixtureSourceAdjudication,
} = require("../../../utils/policyAnalysis/lfKnownFixtureSourceAdjudication");

const digest = (character) => character.repeat(64);

function fixture() {
  const candidate = {
    candidateId: "candidate-1",
    documentFingerprint: digest("e"),
    documentName: "B.pdf",
    documentRole: "TERMS",
    documentStatus: "FRAMEWORK_TERMS",
    physicalPageNumber: 2,
    documentStart: 10,
    documentEnd: 30,
    exactQuote: "Exakter Gegenbeleg",
    exactQuoteSha256: digest("f"),
    oracleExactQuoteSha256: digest("a"),
  };
  const packet = {
    contractId: "LF_1PLUS9_SOURCE_REVIEW_PACKET_V6",
    status: "READY_FOR_SOURCE_REVIEW",
    packetSha256: digest("b"),
    rows: [
      {
        reviewIndex: 0,
        analysisRowId: "row-1",
        requirementId: "REQ-1",
        category: "Kategorie",
        subcategory: "Unterkategorie",
        point: "Punkt",
        claudeClaim: { foundStatus: "Ja" },
        systemClaim: { customerSearchStatus: "Nicht gefunden" },
        globalReferenceARebind: [
          {
            ...candidate,
            documentStart: 31,
            documentEnd: 50,
            exactQuote: "Zweiter Ausschnitt derselben Originalrange",
            exactQuoteSha256: digest("g"),
            evidenceOrigin: "GLOBAL_REFERENCE_A_REBIND",
          },
        ],
        components: [
          { candidates: [{ ...candidate, evidenceOrigin: "ROW_RETRIEVAL" }] },
        ],
      },
      {
        reviewIndex: 1,
        analysisRowId: "row-2",
        requirementId: "REQ-2",
        category: "Kategorie",
        subcategory: "Unterkategorie",
        point: "Fehlender Punkt",
        claudeClaim: { foundStatus: "Nein" },
        systemClaim: { customerSearchStatus: "Gefunden" },
        components: [{ candidates: [] }],
      },
    ],
  };
  return {
    packet,
    qwenSummary: {
      contractId: "LF_1PLUS9_SOURCE_REVIEW_RUN_V10",
      promptContractId: "LF_1PLUS9_SOURCE_REVIEW_PROMPT_V10",
      status: "MODEL_SOURCE_REVIEW_COMPLETE_NOT_GOLD",
      packetSha256: packet.packetSha256,
      model: { id: "qwen", loadedContextLength: 42496 },
    },
    qwenResponses: [
      {
        requirementId: "REQ-1",
        outcome: "NO_COUNTERPART_ESTABLISHED",
        customerFound: false,
        componentFindings: [],
        unmodeledDifferences: [],
      },
      {
        requirementId: "REQ-2",
        outcome: "NO_COUNTERPART_ESTABLISHED",
        customerFound: false,
        componentFindings: [],
        unmodeledDifferences: [],
      },
    ],
    input: {
      contractId: INPUT_CONTRACT_ID,
      packetSha256: packet.packetSha256,
      decisions: [
        {
          requirementId: "REQ-1",
          outcome: "PARTIAL_COUNTERPART",
          confidence: "HIGH",
          expertReviewRequired: false,
          rationale: "Die Originalstelle belegt denselben Punkt.",
          selectedCandidateIds: [candidate.candidateId],
        },
        {
          requirementId: "REQ-2",
          outcome: "NO_COUNTERPART_ESTABLISHED",
          confidence: "MEDIUM",
          expertReviewRequired: true,
          rationale: "Kein positiver Beleg; Vollkorpussuche bleibt offen.",
          selectedCandidateIds: [],
        },
      ],
    },
  };
}

describe("LF known fixture source adjudication", () => {
  it("keeps positive evidence and leaves negative absence pending", () => {
    const artifact = buildLfKnownFixtureSourceAdjudication({
      ...fixture(),
      inputSha256: digest("c"),
      qwenSummarySha256: digest("d"),
      createdAt: "2026-09-13T00:00:00.000Z",
    });
    expect(artifact.contractId).toBe(OUTPUT_CONTRACT_ID);
    expect(artifact.goldAuthority).toBe(false);
    expect(artifact.summary).toMatchObject({
      rows: 2,
      customerFound: 1,
      customerNotFoundPending: 1,
      qwenAgreement: 1,
      qwenDisagreement: 1,
      absenceCertifiedRows: 0,
    });
    expect(artifact.rows[0].codexDecision.selectedSources).toHaveLength(2);
    expect(
      artifact.rows[0].codexDecision.selectedSources.map(
        ({ candidateId }) => candidateId
      )
    ).toEqual(["candidate-1", "candidate-1"]);
    expect(artifact.rows[1].codexDecision.status).toBe(
      "NEGATIVE_FULL_CORPUS_SEARCH_PENDING"
    );
  });

  it("rejects invented evidence and positive decisions without evidence", () => {
    const base = fixture();
    base.input.decisions[0].selectedCandidateIds = ["invented"];
    expect(() =>
      buildLfKnownFixtureSourceAdjudication({
        ...base,
        inputSha256: digest("c"),
        qwenSummarySha256: digest("d"),
      })
    ).toThrow("LF_SOURCE_ADJUDICATION_DECISION_INVALID:REQ-1");

    const empty = fixture();
    empty.input.decisions[0].selectedCandidateIds = [];
    expect(() =>
      buildLfKnownFixtureSourceAdjudication({
        ...empty,
        inputSha256: digest("c"),
        qwenSummarySha256: digest("d"),
      })
    ).toThrow("LF_SOURCE_ADJUDICATION_EVIDENCE_CARDINALITY_INVALID:REQ-1");
  });
});
