const {
  OUTPUT_CONTRACT_ID,
  QUERY_CONTRACT_ID,
  buildLfKnownFixtureFullCorpusAudit,
  pageRouteMatch,
} = require("../../../utils/policyAnalysis/lfKnownFixtureFullCorpusAudit");

const digest = (character) => character.repeat(64);

function fixture() {
  const documents = Array.from({ length: 9 }, (_, index) => ({
    side: "B",
    originalName: `B-${index}.pdf`,
    fingerprint: digest(String(index + 1)),
    role: index ? "TERMS" : "MAIN_POLICY",
    documentStatus: index ? "FRAMEWORK_TERMS" : "PROPOSAL",
  }));
  return {
    oracle: {
      contractId: "LF_COUNTERPART_GOLD_ORACLE_V1",
      documents,
    },
    querySpec: {
      contractId: QUERY_CONTRACT_ID,
      rows: [
        {
          requirementId: "SP-03",
          routes: [
            {
              routeId: "temporary-storage",
              maximumNormalizedSpan: 120,
              groups: [
                { alternatives: ["Zwischenlagerung", "Einlagerung"] },
                { alternatives: ["sechs Monate", "6 Monate"] },
              ],
            },
          ],
        },
      ],
    },
    extractedDocuments: documents.map((document, index) => ({
      originalName: document.originalName,
      fingerprint: document.fingerprint,
      pdfSha256: document.fingerprint,
      pages: [
        index
          ? "Andere Vertragsklausel"
          : "Kosten einer Zwischenlagerung für höchstens sechs Monate.",
      ],
    })),
  };
}

describe("LF known fixture full PDF corpus audit", () => {
  it("matches normalized synonyms only inside the configured span", () => {
    expect(
      pageRouteMatch("Zwischen-Lagerung: maximal 6 Monate", {
        maximumNormalizedSpan: 80,
        groups: [
          { alternatives: ["Zwischen Lagerung", "Einlagerung"] },
          { alternatives: ["6 Monate"] },
        ],
      })
    ).toMatchObject({ matchedTerms: ["zwischen lagerung", "6 monate"] });
    expect(
      pageRouteMatch(`Einlagerung ${"x".repeat(200)} sechs Monate`, {
        maximumNormalizedSpan: 40,
        groups: [
          { alternatives: ["Einlagerung"] },
          { alternatives: ["sechs Monate"] },
        ],
      })
    ).toBeNull();
  });

  it("binds all nine PDFs and searches every extracted page without certifying absence", () => {
    const artifact = buildLfKnownFixtureFullCorpusAudit({
      ...fixture(),
      oracleSha256: digest("a"),
      querySpecSha256: digest("b"),
      createdAt: "2026-09-13T00:00:00.000Z",
    });
    expect(artifact.contractId).toBe(OUTPUT_CONTRACT_ID);
    expect(artifact.summary).toMatchObject({
      rows: 1,
      documents: 9,
      pages: 9,
      routes: 1,
      matches: 1,
      absenceCertifiedRows: 0,
    });
    expect(artifact.rows[0]).toMatchObject({
      requirementId: "SP-03",
      documentsSearched: 9,
      pagesSearched: 9,
      sourceSearchComplete: true,
      absenceCertified: false,
      semanticDecision: null,
    });
    expect(artifact.rows[0].matches[0]).toMatchObject({
      documentName: "B-0.pdf",
      physicalPageNumber: 1,
      matchedTerms: ["zwischenlagerung", "sechs monate"],
    });
  });

  it("fails closed on a changed PDF or incomplete document set", () => {
    const changed = fixture();
    changed.extractedDocuments[0].pdfSha256 = digest("f");
    expect(() =>
      buildLfKnownFixtureFullCorpusAudit({
        ...changed,
        oracleSha256: digest("a"),
        querySpecSha256: digest("b"),
      })
    ).toThrow("LF_FULL_CORPUS_DOCUMENT_BINDING_INVALID:B-0.pdf");

    const missing = fixture();
    missing.extractedDocuments.pop();
    expect(() =>
      buildLfKnownFixtureFullCorpusAudit({
        ...missing,
        oracleSha256: digest("a"),
        querySpecSha256: digest("b"),
      })
    ).toThrow("LF_FULL_CORPUS_DOCUMENT_SET_INVALID");
  });
});
