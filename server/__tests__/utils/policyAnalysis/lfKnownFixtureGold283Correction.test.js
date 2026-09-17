const {
  CORRECTION_DECISIONS_CONTRACT_ID,
  CORRECTION_SET_CONTRACT_ID,
  OUTPUT_GOLD_CONTRACT_ID,
  OUTPUT_GOLD_STATUS,
  buildLfKnownFixtureGold283V2,
  sha256,
  stableStringify,
} = require("../../../utils/policyAnalysis/lfKnownFixtureGold283Correction");

const digest = (character) => character.repeat(64);

const corrections = [
  {
    requirementId: "VS-15",
    dynamicRequirementId: "AR-vs15",
    expectedBaseOutcome: "FULL_COUNTERPART",
    expectedBaseSourceRefs: ["Ebuilding", "Etech"],
    correctedOutcome: "NO_COUNTERPART_ESTABLISHED",
    reviewedAndRejectedBaseSourceRefs: ["Ebuilding", "Etech"],
    rationale: "Allgemeine Gebäudedefinitionen sind kein Kellerabteil.",
  },
  {
    requirementId: "AV-06",
    dynamicRequirementId: "AR-av06",
    expectedBaseOutcome: "FULL_COUNTERPART",
    expectedBaseSourceRefs: ["RAK16", "RAK34"],
    correctedOutcome: "NO_COUNTERPART_ESTABLISHED",
    reviewedAndRejectedBaseSourceRefs: ["RAK16", "RAK34"],
    rationale: "Eine Günstigkeitsklausel ist keine Bestklausel.",
  },
  {
    requirementId: "AV-22",
    dynamicRequirementId: "AR-av22",
    expectedBaseOutcome: "PARTIAL_COUNTERPART",
    expectedBaseSourceRefs: ["RAK17", "Enew", "Ecostpay"],
    correctedOutcome: "NO_COUNTERPART_ESTABLISHED",
    reviewedAndRejectedBaseSourceRefs: ["RAK17", "Enew", "Ecostpay"],
    rationale: "Eine Arbeitserlaubnis belegt keine Eigenpersonalkosten.",
  },
];

function source(referenceId) {
  return {
    referenceId,
    file: `${referenceId}.pdf`,
    location: "PDF-Seite 1",
    exactText: `Quelle ${referenceId}`,
    exactTextSha256: sha256(`Quelle ${referenceId}`),
    sourceRecordSha256: digest("a"),
  };
}

function baseRow(requirementId, outcome, sourceRefs = []) {
  const customerFound = outcome !== "NO_COUNTERPART_ESTABLISHED";
  const sources = sourceRefs.map(source);
  return {
    analysisRowId: `LR-${requirementId}`,
    requirementId,
    referenceA: { sourceSpans: [{ blockIds: [`block-${requirementId}`] }] },
    components: [],
    goldDecision: {
      reviewStatus: "SOURCE_BOUND_FINAL_FOR_KNOWN_FIXTURE",
      reviewMethod: "TEST",
      outcome,
      customerFound,
      rationale: `Basis ${requirementId}`,
      sources,
      reviewedSources: sources,
      absenceSearch: customerFound ? null : { certifiedForKnownFixture: true },
    },
    evidenceHistory: {},
  };
}

function fixture() {
  const rows = [
    baseRow("VS-15", "FULL_COUNTERPART", ["Ebuilding", "Etech"]),
    baseRow("AV-06", "FULL_COUNTERPART", ["RAK16", "RAK34"]),
    baseRow("AV-22", "PARTIAL_COUNTERPART", ["RAK17", "Enew", "Ecostpay"]),
    ...Array.from({ length: 149 }, (_, index) =>
      baseRow(`FULL-${index}`, "FULL_COUNTERPART", [`FULL-${index}`])
    ),
    ...Array.from({ length: 113 }, (_, index) =>
      baseRow(`PARTIAL-${index}`, "PARTIAL_COUNTERPART", [`PARTIAL-${index}`])
    ),
    ...Array.from({ length: 8 }, (_, index) =>
      baseRow(`CONTRADICTED-${index}`, "CONTRADICTED", [
        `CONTRADICTED-${index}`,
      ])
    ),
    ...Array.from({ length: 10 }, (_, index) =>
      baseRow(`NONE-${index}`, "NO_COUNTERPART_ESTABLISHED")
    ),
  ];
  const basePayload = {
    schemaVersion: 1,
    contractId: "LF_1PLUS9_GOLD_283_V1",
    status: "FROZEN_SOURCE_BOUND_GOLD_FOR_KNOWN_LF_1PLUS9_283_ROWS",
    goldAuthority: true,
    scope: "KNOWN_LF_1PLUS9_283_ONLY",
    qaOnly: true,
    productionRule: false,
    releaseApproval: false,
    generalizationProof: false,
    createdAt: "2026-09-14T00:00:00.000Z",
    bindings: {},
    sourceDocuments: Array.from({ length: 9 }, (_, index) => ({
      uuid: `document-${index}`,
    })),
    adjudicationScope: { scopeExpansionBeyond76: false },
    summary: {
      rows: 283,
      customerFound: 273,
      customerNotFound: 10,
      outcomeCounts: {
        FULL_COUNTERPART: 151,
        PARTIAL_COUNTERPART: 114,
        CONTRADICTED: 8,
        NO_COUNTERPART_ESTABLISHED: 10,
      },
      sourceBoundFoundRows: 273,
      knownFixtureAbsenceCertified: 10,
      explicitAdjudications: 76,
      validatedAutomaticAcceptances: 207,
    },
    gold30Comparison: { unchanged: true, differences: [] },
    rows,
    limitation: "Test fixture",
  };
  const baseGold = {
    ...basePayload,
    goldSha256: sha256(stableStringify(basePayload)),
  };
  const baseGoldFileSha256 = digest("1");
  const gold30FileSha256 = digest("2");
  const completeBCorpusFileSha256 = digest("3");
  const finalDecisionsFileSha256 = digest("4");
  const baseRegressionFileSha256 = digest("5");
  const correctionDecisionsFileSha256 = digest("6");
  const gold30 = {
    contractId: "LF_1PLUS9_GOLD_30_V1",
    goldSha256: digest("7"),
    rows: rows.slice(0, 30).map((row) => ({
      requirementId: row.requirementId,
      goldDecision: row.goldDecision,
    })),
  };
  const completeBCorpus = {
    contractId: "LF_A_DRIVEN_COMPLETE_B_CORPUS_V1",
    corpusSha256: digest("8"),
    summary: {
      documents: 9,
      clauses: 322,
      pages: 77,
      sourceCoverage: "ALL_EXTRACTED_B_CLAUSE_BOUNDARIES",
    },
  };
  const correctedResults = corrections.map((correction) => ({
    status: "TERMINAL",
    requirementId: correction.dynamicRequirementId,
    customerStatus: "NOT_FOUND",
    customerFound: false,
    absenceCertified: true,
    resolutionPath: "COMPLETE_CORPUS_ABSENCE",
    assessment: {
      contextFinding: { outcome: "NOT_ESTABLISHED", candidateIds: [] },
      componentFindings: [
        { componentId: "component", outcome: "NOT_ESTABLISHED" },
      ],
      selectedCandidateIds: [],
      bEvidence: [],
    },
    decisionProvenance: { absenceDecisionSha256: digest("9") },
  }));
  const finalDecisions = {
    contractId: "LF_A_DRIVEN_REQUIREMENT_FINAL_DECISION_V1",
    finalDecisionSha256: digest("a"),
    summary: { terminalRequirements: 363, unresolvedRequirements: 0 },
    results: [
      ...correctedResults,
      ...Array.from({ length: 360 }, (_, index) => ({
        status: "TERMINAL",
        requirementId: `AR-${index}`,
      })),
    ],
  };
  const baseRegression = {
    contractId: "LF_A_DRIVEN_GOLD_283_REGRESSION_V2",
    goldContractId: baseGold.contractId,
    goldSha256: baseGold.goldSha256,
    goldFileSha256: baseGoldFileSha256,
    regressionSha256: digest("b"),
    resultRegression: {
      records: corrections.map((correction) => ({
        legacyRequirementId: correction.requirementId,
        dynamicRequirementIds: [correction.dynamicRequirementId],
        measurementEligibility: "UNIQUE_SOURCE_MAPPING",
        predictionResolved: true,
        predictedCustomerFound: false,
        goldCustomerFound: true,
        binaryMatch: false,
      })),
    },
  };
  const correctionDecisions = {
    schemaVersion: 1,
    contractId: CORRECTION_DECISIONS_CONTRACT_ID,
    status: "APPROVED_SOURCE_BOUND_CORRECTIONS_FOR_KNOWN_LF_1PLUS9",
    qaOnly: true,
    productionRule: false,
    generalizationProof: false,
    bindings: {
      baseGoldSha256: baseGold.goldSha256,
      baseGoldFileSha256,
      gold30FileSha256,
      completeBCorpusFileSha256,
      finalDecisionsFileSha256,
      baseRegressionFileSha256,
    },
    rows: corrections,
  };
  return {
    baseGold,
    baseGoldFileSha256,
    gold30,
    gold30FileSha256,
    completeBCorpus,
    completeBCorpusFileSha256,
    finalDecisions,
    finalDecisionsFileSha256,
    baseRegression,
    baseRegressionFileSha256,
    correctionDecisions,
    correctionDecisionsFileSha256,
    createdAt: "2026-09-17T00:00:00.000Z",
  };
}

describe("LF known fixture Gold-283 V2 correction", () => {
  test("preserves V1 and freezes exactly three source-bound corrections", () => {
    const input = fixture();
    const baseBefore = stableStringify(input.baseGold);
    const first = buildLfKnownFixtureGold283V2(input);
    const second = buildLfKnownFixtureGold283V2(input);

    expect(stableStringify(input.baseGold)).toBe(baseBefore);
    expect(first).toEqual(second);
    expect(first.correctionSet).toMatchObject({
      contractId: CORRECTION_SET_CONTRACT_ID,
      qaOnly: true,
      productionRule: false,
      summary: { correctedRows: 3, unchangedRows: 280 },
    });
    expect(first.gold).toMatchObject({
      contractId: OUTPUT_GOLD_CONTRACT_ID,
      status: OUTPUT_GOLD_STATUS,
      qaOnly: true,
      productionRule: false,
      generalizationProof: false,
      summary: {
        rows: 283,
        customerFound: 270,
        customerNotFound: 13,
        correctionsApplied: 3,
        validatedAutomaticAcceptances: 204,
        sourceBoundCorrections: 3,
        outcomeCounts: {
          FULL_COUNTERPART: 149,
          PARTIAL_COUNTERPART: 113,
          CONTRADICTED: 8,
          NO_COUNTERPART_ESTABLISHED: 13,
        },
      },
    });
    expect(
      first.gold.rows.find(({ requirementId }) => requirementId === "AV-06")
        .goldDecision
    ).toMatchObject({
      reviewStatus: "SOURCE_BOUND_CORRECTED_FOR_KNOWN_FIXTURE",
      outcome: "NO_COUNTERPART_ESTABLISHED",
      customerFound: false,
      sources: [],
      absenceSearch: {
        certifiedForKnownFixture: true,
        documentsSearchedCount: 9,
        clausesSearched: 322,
        pagesSearched: 77,
      },
    });
    const unchanged = input.baseGold.rows.find(
      ({ requirementId }) => requirementId === "FULL-0"
    );
    expect(
      stableStringify(
        first.gold.rows.find(
          ({ requirementId }) => requirementId === unchanged.requirementId
        )
      )
    ).toBe(stableStringify(unchanged));
  });

  test("rejects hash drift and incomplete absence evidence", () => {
    const drifted = fixture();
    drifted.correctionDecisions.bindings.baseGoldFileSha256 = digest("f");
    expect(() => buildLfKnownFixtureGold283V2(drifted)).toThrow(
      "LF_GOLD_283_V2_CORRECTION_BINDING_INVALID"
    );

    const incomplete = fixture();
    incomplete.finalDecisions.results[0].assessment.selectedCandidateIds = [
      "candidate",
    ];
    expect(() => buildLfKnownFixtureGold283V2(incomplete)).toThrow(
      "LF_GOLD_283_V2_ABSENCE_NOT_CERTIFIED:VS-15"
    );
  });

  test("rejects correction scope expansion beyond the three approved IDs", () => {
    const expanded = fixture();
    expanded.correctionDecisions.rows.push({
      ...expanded.correctionDecisions.rows[0],
      requirementId: "FULL-0",
      dynamicRequirementId: "AR-0",
    });
    expect(() => buildLfKnownFixtureGold283V2(expanded)).toThrow(
      "LF_GOLD_283_V2_CORRECTION_BINDING_INVALID"
    );
  });
});
