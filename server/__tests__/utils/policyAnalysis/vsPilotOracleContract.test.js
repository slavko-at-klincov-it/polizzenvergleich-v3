const {
  evaluateVsPilotOracle,
} = require("../../../utils/policyAnalysis/vsPilotOracleContract");

const ORACLE = {
  pdfSha256: "abc",
  physicalPages: 2,
  documentStatus: "PROPOSAL",
  rows: [
    {
      categoryId: "VS-16",
      coverage: "Nicht feststellbar",
      coverageAmount: "Nicht feststellbar",
      documentedContentIncludes: ["keine belegte Fundstelle gefunden"],
      reviewStatus: "UNGEKLÄRT",
      requestedFieldStatus: "NOT_REQUIRED",
      normalizedValues: [],
      requiredCandidateIds: [],
      requiredSourcePages: [],
      forbiddenSourcePages: [],
    },
    {
      categoryId: "VS-21",
      coverage: "Ja",
      coverageAmount: "EUR 10.000,00",
      documentedContentIncludes: ["Vorschlag (PROPOSED_ONLY)"],
      reviewStatus: "BELEGT",
      requestedFieldStatus: "COMPLETE",
      normalizedValues: ["EUR 10.000,00"],
      requiredValueCandidateIds: ["candidate:limit"],
      allowedValueCandidateIds: ["candidate:limit"],
      requiredValueSourcePages: [1],
      allowedValueSourcePages: [1],
      requiredCandidateIds: ["candidate:limit"],
      allowedCandidateIds: ["candidate:limit", "candidate:d553-approved"],
      requiredSourcePages: [1],
      allowedSourcePages: [1],
      forbiddenSourcePages: [2],
    },
  ],
};

function validInput() {
  return {
    oracleDocument: ORACLE,
    pdfSha256: "abc",
    physicalPages: 2,
    documentStatus: "PROPOSAL",
    rows: [
      {
        categoryId: "VS-16",
        coverage: "Nicht feststellbar",
        coverageAmount: "Nicht feststellbar",
        documentedContent: "keine belegte Fundstelle gefunden",
        source: "keine belegte Fundstelle gefunden",
        reviewStatus: "UNGEKLÄRT",
      },
      {
        categoryId: "VS-21",
        coverage: "Ja",
        coverageAmount: "EUR 10.000,00",
        documentedContent: "Vorschlag (PROPOSED_ONLY): Kosten eingeschlossen",
        source: "PDF-Seite 1: „Kosten bis EUR 10.000,00“",
        reviewStatus: "BELEGT",
      },
    ],
    requestedFieldEvidence: {
      requirements: [
        {
          requirementId: "VS-16",
          requestedFieldStatus: "NOT_REQUIRED",
          fields: [],
        },
        {
          requirementId: "VS-21",
          requestedFieldStatus: "COMPLETE",
          fields: [
            {
              field: "limit",
              facts: [
                {
                  normalizedValue: "EUR 10.000,00",
                  source: {
                    candidateId: "candidate:limit",
                    physicalPageNumber: 1,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    selectedSources: [
      {
        requirementId: "VS-21",
        candidateId: "candidate:limit",
        physicalPageNumber: 1,
      },
    ],
  };
}

describe("vsPilotOracleContract", () => {
  test("passes only the frozen identity, row, value and page result", () => {
    expect(evaluateVsPilotOracle(validInput())).toMatchObject({
      pass: true,
      identityReasons: [],
      passedRows: 2,
      totalRows: 2,
    });
  });

  test("reports identity and semantic failures independently", () => {
    const input = validInput();
    input.pdfSha256 = "wrong";
    input.rows[1].coverage = "Nein";
    input.selectedSources.push({
      requirementId: "VS-21",
      candidateId: "candidate:forbidden",
      physicalPageNumber: 2,
    });
    const result = evaluateVsPilotOracle(input);

    expect(result.pass).toBe(false);
    expect(result.identityReasons).toContain("PDF_SHA256_MISMATCH");
    expect(result.results[1]).toMatchObject({ pass: false });
    expect(result.results[1].reasons).toEqual(
      expect.arrayContaining([
        "COVERAGE_MISMATCH",
        "FORBIDDEN_SOURCE_PAGE_SELECTED:2",
      ])
    );
  });

  test("fails when the final rendered amount, content or source loses the bound result", () => {
    const input = validInput();
    input.rows[1].coverageAmount = "Nicht feststellbar";
    input.rows[1].documentedContent = "Kosten eingeschlossen";
    input.rows[1].source = "PDF-Seite 2: „falscher Scope“";

    const result = evaluateVsPilotOracle(input);
    expect(result.results[1].reasons).toEqual(
      expect.arrayContaining([
        "COVERAGE_AMOUNT_MISMATCH",
        "DOCUMENTED_CONTENT_MISSING:Vorschlag (PROPOSED_ONLY)",
        "RENDERED_SOURCE_PAGES_MISMATCH",
        "FORBIDDEN_SOURCE_PAGE_SELECTED:2",
      ])
    );
  });

  test("fails when a required server-owned candidate is missing", () => {
    const input = validInput();
    input.selectedSources[0].candidateId = "candidate:other";

    expect(evaluateVsPilotOracle(input).results[1].reasons).toContain(
      "SELECTED_CANDIDATES_MISMATCH"
    );
  });

  test("fails when the normalized value is right but its source is wrong", () => {
    const input = validInput();
    input.requestedFieldEvidence.requirements[1].fields[0].facts[0].source = {
      candidateId: "candidate:wrong-value-source",
      physicalPageNumber: 2,
    };

    expect(evaluateVsPilotOracle(input).results[1].reasons).toEqual(
      expect.arrayContaining([
        "VALUE_CANDIDATES_MISMATCH",
        "VALUE_SOURCE_PAGES_MISMATCH",
      ])
    );
  });

  test("accepts an additional candidate explicitly approved by the oracle", () => {
    const input = validInput();
    input.selectedSources.push({
      requirementId: "VS-21",
      candidateId: "candidate:d553-approved",
      physicalPageNumber: 1,
    });

    expect(evaluateVsPilotOracle(input).results[1]).toMatchObject({
      pass: true,
      reasons: [],
    });
  });

  test("rejects an additional candidate and source page not explicitly allowed", () => {
    const input = validInput();
    input.selectedSources.push({
      requirementId: "VS-21",
      candidateId: "candidate:unexpected-narrow-scope",
      physicalPageNumber: 3,
    });
    input.rows[1].source += "<br>PDF-Seite 3: „zusätzlicher falscher Scope“";

    expect(evaluateVsPilotOracle(input).results[1].reasons).toEqual(
      expect.arrayContaining([
        "SELECTED_CANDIDATE_NOT_ALLOWED:candidate:unexpected-narrow-scope",
        "SELECTED_SOURCE_PAGE_NOT_ALLOWED:3",
        "RENDERED_SOURCE_PAGE_NOT_ALLOWED:3",
      ])
    );
  });

  test("rejects explicitly forbidden candidates", () => {
    const input = validInput();
    input.oracleDocument = JSON.parse(JSON.stringify(ORACLE));
    input.oracleDocument.rows[1].forbiddenCandidateIds = [
      "candidate:known-wrong-scope",
    ];
    input.selectedSources.push({
      requirementId: "VS-21",
      candidateId: "candidate:known-wrong-scope",
      physicalPageNumber: 1,
    });

    expect(evaluateVsPilotOracle(input).results[1].reasons).toContain(
      "FORBIDDEN_CANDIDATE_SELECTED:candidate:known-wrong-scope"
    );
  });

  test("rejects an internally contradictory allowed/forbidden oracle", () => {
    const input = validInput();
    input.oracleDocument = JSON.parse(JSON.stringify(ORACLE));
    input.oracleDocument.rows[1].forbiddenCandidateIds = [
      "candidate:d553-approved",
    ];

    expect(() => evaluateVsPilotOracle(input)).toThrow(
      "VS_ORACLE_FORBIDDEN_SET_INVALID"
    );
  });

  test("rejects missing or duplicate result rows fail-closed", () => {
    const missing = validInput();
    missing.rows.pop();
    expect(() => evaluateVsPilotOracle(missing)).toThrow(
      "VS_ORACLE_ROW_COVERAGE_INVALID"
    );

    const duplicate = validInput();
    duplicate.rows[1].categoryId = "VS-16";
    expect(() => evaluateVsPilotOracle(duplicate)).toThrow(
      "VS_ORACLE_ROW_ID_INVALID"
    );
  });
});
