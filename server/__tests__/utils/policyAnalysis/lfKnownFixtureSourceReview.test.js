const {
  SOURCE_REVIEW_RESPONSE_CONTRACT_ID,
  buildLfKnownFixtureSourceReviewPacket,
  factRoleDimension,
  validateSourceReviewResponse,
} = require("../../../utils/policyAnalysis/lfKnownFixtureSourceReview");

const digest = (character) => character.repeat(64);

function fixture() {
  const documents = Array.from({ length: 9 }, (_, index) => ({
    uuid: `doc-${index}`,
    side: "B",
    fingerprint: digest(String((index % 9) + 1)),
    originalName: `B-${index}.pdf`,
    role: index ? "TERMS" : "MAIN_POLICY",
    documentStatus: index ? "FRAMEWORK_TERMS" : "PROPOSAL",
  }));
  const benchmarkCandidates = Array.from({ length: 30 }, (_, index) => ({
    candidateId: `candidate-${index}`,
    componentId: `component-${index}`,
    rank: 1,
    score: 1,
    range: {
      documentUuid: documents[index % documents.length].uuid,
      documentFingerprint: documents[index % documents.length].fingerprint,
      physicalPageNumber: 1,
      documentStart: index * 20,
      documentEnd: index * 20 + 19,
      exactQuote: `Versicherter Gegenstand ${index}`,
      exactQuoteSha256: digest("a"),
    },
  }));
  const rows = Array.from({ length: 30 }, (_, index) => ({
    analysisRowId: `row-${index}`,
    requirementId: `requirement-${index}`,
    point: `Gegenstand ${index}`,
    category: "Kategorie",
    subcategory: "Unterkategorie",
    claude: { sourceQuote: `Gegenstand ${index}` },
    system: { aContent: `Gegenstand ${index}`, aValues: null, aSource: "A" },
    components: [
      {
        componentId: `component-${index}`,
        label: `Gegenstand ${index}`,
        factRole: "INSURED_OBJECT",
      },
    ],
  }));
  return {
    goldCandidate: {
      contractId: "LF_1PLUS9_GOLD_CANDIDATE_V1",
      status: "SOURCE_REVIEW_REQUIRED",
      candidateSha256: digest("b"),
      bindings: { oracleSha256: digest("c") },
      representativeReview: rows.map((row, index) => ({
        analysisRowId: row.analysisRowId,
        requirementId: row.requirementId,
        relation: index
          ? "CLAUDE_FULL__SYSTEM_FOUND"
          : "CLAUDE_FULL__SYSTEM_MISS",
      })),
      rows,
    },
    oracle: {
      contractId: "LF_COUNTERPART_GOLD_ORACLE_V1",
      oracleId: "oracle",
      documents,
      benchmarkCandidates,
      rows: rows.map((row, index) => ({
        analysisRowId: row.analysisRowId,
        requirementId: row.requirementId,
        benchmarkCandidateIds: [`candidate-${index}`],
      })),
    },
  };
}

describe("LF known fixture source review", () => {
  it("maps every known fact role to an explicit semantic dimension", () => {
    expect(factRoleDimension("INSURED_OBJECT")).toBe("OBJECT");
    expect(factRoleDimension("EXCLUSION")).toBe("COVERAGE_EFFECT");
    expect(() => factRoleDimension("UNKNOWN")).toThrow(
      "LF_SOURCE_REVIEW_FACT_ROLE_UNKNOWN"
    );
  });

  it("materializes all thirty review rows without certifying absence", () => {
    const packet = buildLfKnownFixtureSourceReviewPacket({
      ...fixture(),
      createdAt: "2026-09-13T00:00:00.000Z",
    });
    expect(packet.summary.rows).toBe(30);
    expect(packet.summary.actualComponents).toBe(30);
    expect(packet.summary.semanticChecks).toBe(60);
    expect(packet.summary.searchedDocumentsPerRow).toBe(9);
    expect(packet.summary.absenceCertifiedRows).toBe(0);
    expect(packet.rows[0].components[0].contextOnly).toBe(true);
    expect(packet.rows[0].components[1].candidates).toHaveLength(1);
  });

  it("turns long navigation spans into hash-bound exact excerpts", () => {
    const input = fixture();
    input.oracle.benchmarkCandidates[0].range.exactQuote = `${"Vorlauf ".repeat(
      80
    )}Versicherter Gegenstand 0${" Nachlauf".repeat(80)}`;
    const packet = buildLfKnownFixtureSourceReviewPacket({
      ...input,
      maximumQuoteCharacters: 240,
    });
    const evidence = packet.rows[0].components[1].candidates[0];
    expect(evidence.excerpted).toBe(true);
    expect(evidence.exactQuote.length).toBeLessThanOrEqual(240);
    expect(evidence.exactQuote).toContain("Gegenstand 0");
  });

  it("accepts only source-bound component findings and derives row truth", () => {
    const packet = buildLfKnownFixtureSourceReviewPacket({ ...fixture() });
    const row = packet.rows[0];
    const response = {
      contractId: SOURCE_REVIEW_RESPONSE_CONTRACT_ID,
      requirementId: row.requirementId,
      outcome: "FULL_COUNTERPART",
      componentFindings: row.components.map((component) => ({
        componentId: component.componentId,
        dimension: component.dimension,
        outcome: "MATCH",
        candidateIds: [component.candidates[0].candidateId],
      })),
      rationale: "Die Originalstelle nennt den Gegenstand ausdrücklich.",
    };
    expect(validateSourceReviewResponse(row, response)).toEqual(response);
    expect(() =>
      validateSourceReviewResponse(row, {
        ...response,
        outcome: "NO_COUNTERPART_ESTABLISHED",
      })
    ).toThrow("LF_SOURCE_REVIEW_ROW_OUTCOME_INVALID");
    expect(() =>
      validateSourceReviewResponse(row, {
        ...response,
        componentFindings: response.componentFindings.map((finding, index) =>
          index ? finding : { ...finding, candidateIds: ["invented"] }
        ),
      })
    ).toThrow("LF_SOURCE_REVIEW_COMPONENT_EVIDENCE_INVALID");
  });
});
