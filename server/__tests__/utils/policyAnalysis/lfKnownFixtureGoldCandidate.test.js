const {
  buildLfKnownFixtureGoldCandidate,
  validateLfKnownFixtureGoldCandidate,
} = require("../../../utils/policyAnalysis/lfKnownFixtureGoldCandidate");

function fixture() {
  const matrix = [
    ["Ja", "Gefunden", 127],
    ["Ja", "Nicht gefunden", 92],
    ["Teilweise", "Gefunden", 13],
    ["Teilweise", "Nicht gefunden", 28],
    ["Nein", "Gefunden", 8],
    ["Nein", "Nicht gefunden", 15],
  ];
  const statusPairs = matrix.flatMap(([claude, system, count]) =>
    Array.from({ length: count }, () => ({ claude, system }))
  );
  const claudeRows = statusPairs.map(({ claude }, index) => ({
    category: `Kategorie ${Math.floor(index / 30) + 1}`,
    subcategory: `Unterkategorie ${Math.floor(index / 10) + 1}`,
    requirementId: `C${(index % 13) + 1}-${String(index + 1).padStart(3, "0")}`,
    point: `Prüfpunkt ${index + 1}`,
    foundStatus: claude,
    coverageStatus: claude,
    values: "–",
    sourceQuote: claude === "Nein" ? "IN B NICHT GEREGELT" : "Belegtext",
    sourceFiles: claude === "Nein" ? "–" : "B-01.pdf",
    note: "Prüfhinweis",
    manualAssessment: null,
  }));
  const systemRows = statusPairs.map(({ system }, index) => ({
    category: claudeRows[index].category,
    subcategory: claudeRows[index].subcategory,
    requirementId: claudeRows[index].requirementId,
    point: claudeRows[index].point,
    aContent: "A-Inhalt",
    aValues: "Nicht feststellbar",
    aSource: "A-Quelle",
    bCounterpart: "B-Inhalt",
    bCoverage: "Ja",
    bValues: "Nicht feststellbar",
    bSource: "B-Quelle",
    customerSearchStatus: system,
    note: "Systemhinweis",
    manualAssessment: null,
  }));
  const oracleRows = claudeRows.map((row, index) => ({
    analysisRowId: `LR-${String(index + 1).padStart(3, "0")}`,
    requirementId: row.requirementId,
    sourceOrder: index,
    benchmarkCandidateIds: [`candidate-${index}`],
    components: Array.from(
      { length: index < 65 ? 3 : 2 },
      (_unused, componentIndex) => ({
        componentId: `component-${componentIndex + 1}`,
        label: `Komponente ${componentIndex + 1}`,
        factRole: "INSURED_OBJECT",
        benchmarkCandidateIds: [`candidate-${index}-${componentIndex}`],
      })
    ),
  }));
  const oracle = {
    contractId: "LF_COUNTERPART_GOLD_ORACLE_V1",
    summary: { rowCount: 283, componentCount: 631 },
    rows: oracleRows,
  };
  return {
    claudeRows,
    systemRows,
    oracle,
    bindings: {
      claudeWorkbookSha256: "a".repeat(64),
      systemWorkbookSha256: "b".repeat(64),
      oracleSha256: "c".repeat(64),
    },
    sourceDocuments: Array.from({ length: 9 }, (_unused, index) => ({
      name: `B-${String(index + 1).padStart(2, "0")}.pdf`,
      sha256: String((index + 1) % 10).repeat(64),
      sourceRelation: "EXACT_ORIGINAL",
    })),
  };
}

describe("lfKnownFixtureGoldCandidate", () => {
  test("binds the 283-row Claude result to the 283/631 system oracle", () => {
    const candidate = buildLfKnownFixtureGoldCandidate({
      ...fixture(),
      createdAt: "2026-09-13T00:00:00.000Z",
    });

    expect(candidate).toMatchObject({
      contractId: "LF_1PLUS9_GOLD_CANDIDATE_V1",
      status: "SOURCE_REVIEW_REQUIRED",
      qaOnly: true,
      productionRule: false,
      summary: {
        rowCount: 283,
        componentCount: 631,
        claudeStatuses: { Ja: 219, Nein: 23, Teilweise: 41 },
        systemStatuses: { Gefunden: 148, "Nicht gefunden": 135 },
        relations: {
          CLAUDE_ABSENT__SYSTEM_FOUND: 8,
          CLAUDE_ABSENT__SYSTEM_MISS: 15,
          CLAUDE_FULL__SYSTEM_FOUND: 127,
          CLAUDE_FULL__SYSTEM_MISS: 92,
          CLAUDE_PARTIAL__SYSTEM_FOUND: 13,
          CLAUDE_PARTIAL__SYSTEM_MISS: 28,
        },
        sourceAdjudicatedRows: 0,
        sourceAdjudicatedComponents: 0,
        representativeReviewRowCount: 30,
      },
    });
    expect(candidate.rows).toHaveLength(283);
    expect(candidate.representativeReview).toHaveLength(30);
    expect(
      candidate.representativeReview.filter(
        ({ relation }) => relation === "CLAUDE_ABSENT__SYSTEM_FOUND"
      )
    ).toHaveLength(8);
    expect(
      candidate.rows.every(
        (row) =>
          row.adjudication.status === "UNREVIEWED" &&
          row.components.every(
            (component) => component.adjudication.status === "UNREVIEWED"
          )
      )
    ).toBe(true);
  });

  test("rejects a row-order or label mismatch between Claude and the system", () => {
    const input = fixture();
    input.systemRows[17].point = "Anderer Prüfpunkt";

    expect(() => buildLfKnownFixtureGoldCandidate(input)).toThrow(
      "LF_GOLD_CANDIDATE_ROW_ALIGNMENT_INVALID"
    );
  });

  test("rejects a missing Claude source document binding", () => {
    const input = fixture();
    input.sourceDocuments.pop();

    expect(() => buildLfKnownFixtureGoldCandidate(input)).toThrow(
      "LF_GOLD_CANDIDATE_SOURCE_DOCUMENTS_INVALID"
    );
  });

  test("detects a modified candidate after materialization", () => {
    const candidate = buildLfKnownFixtureGoldCandidate({
      ...fixture(),
      createdAt: "2026-09-13T00:00:00.000Z",
    });
    candidate.rows[0].claude.note = "nachträglich verändert";

    expect(() => validateLfKnownFixtureGoldCandidate(candidate)).toThrow(
      "LF_GOLD_CANDIDATE_HASH_INVALID"
    );
  });
});
