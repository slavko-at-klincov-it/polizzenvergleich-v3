const {
  evaluateCategoryDocumentOracle,
} = require("../../../utils/policyAnalysis/categoryDocumentOracleContract");

function fixture(overrides = {}) {
  return {
    oracleApprovalStatus: "APPROVED",
    oracleDocument: {
      documentKey: "fixture",
      pdfSha256: "pdf-1",
      physicalPages: 2,
      documentStatus: "FRAMEWORK_TERMS",
      rows: [
        {
          categoryId: "EL-16",
          row: {
            coverage: "Gemischt",
            coverageAmount: "Nicht feststellbar",
            reviewStatus: "BELEGT",
            documentedContentIncludes: [
              "Wintergarten: eingeschlossen",
              "Vitrine: ausgeschlossen",
            ],
          },
          requestedFieldStatus: "COMPLETE",
          components: [
            {
              componentId: "winter_garden",
              evidencePresence: "FOUND",
              coverageEffect: "INCLUDED",
              documentApplicability: "CONDITIONAL",
              conflictState: "NONE",
              selectedScopePicture: "GENERAL_ONLY",
              sources: {
                requiredCandidateIds: ["candidate:winter"],
                allowedCandidateIds: ["candidate:winter"],
                requiredPhysicalPages: [1],
                allowedPhysicalPages: [1],
                forbiddenPhysicalPages: [2],
              },
            },
            {
              componentId: "display_case",
              evidencePresence: "FOUND",
              coverageEffect: "EXCLUDED",
              documentApplicability: "CONDITIONAL",
            },
          ],
          sources: {
            requiredCandidateIds: ["candidate:winter", "candidate:vitrine"],
            allowedCandidateIds: ["candidate:winter", "candidate:vitrine"],
            forbiddenCandidateIds: ["candidate:foreign"],
            requiredPhysicalPages: [1],
            allowedPhysicalPages: [1],
          },
          valueExpectations: {
            required: [
              {
                field: "limit",
                normalizedValue: "10 m²",
                componentId: "winter_garden",
                factRole: "INSURED_OBJECT",
                candidateId: "candidate:winter",
                physicalPageNumber: 1,
              },
            ],
            allowed: [
              {
                field: "limit",
                normalizedValue: "10 m²",
                componentId: "winter_garden",
                factRole: "INSURED_OBJECT",
              },
            ],
            forbidden: [
              {
                field: "limit",
                componentId: "display_case",
              },
            ],
          },
        },
      ],
    },
    pdfSha256: "pdf-1",
    physicalPages: 2,
    documentStatus: "FRAMEWORK_TERMS",
    rows: [
      {
        categoryId: "EL-16",
        coverage: "Gemischt",
        coverageAmount: "Nicht feststellbar",
        reviewStatus: "BELEGT",
        documentedContent:
          "Wintergarten: eingeschlossen; Vitrine: ausgeschlossen",
      },
    ],
    materializedEvidence: {
      judgements: [
        {
          requirementId: "EL-16",
          componentId: "winter_garden",
          evidencePresence: "FOUND",
          coverageEffect: "INCLUDED",
          documentApplicability: "CONDITIONAL",
          conflictState: "NONE",
          selectedScopePicture: "GENERAL_ONLY",
        },
        {
          requirementId: "EL-16",
          componentId: "display_case",
          evidencePresence: "FOUND",
          coverageEffect: "EXCLUDED",
          documentApplicability: "CONDITIONAL",
          conflictState: "NONE",
          selectedScopePicture: "GENERAL_ONLY",
        },
      ],
    },
    requestedFieldEvidence: {
      requirements: [
        {
          requirementId: "EL-16",
          requestedFieldStatus: "COMPLETE",
          fields: [
            {
              field: "limit",
              facts: [
                {
                  normalizedValue: "10 m²",
                  valueType: "DIMENSION",
                  unit: "m²",
                  source: {
                    candidateId: "candidate:winter",
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
        requirementId: "EL-16",
        componentId: "winter_garden",
        candidateId: "candidate:winter",
        physicalPageNumber: 1,
      },
      {
        requirementId: "EL-16",
        componentId: "display_case",
        candidateId: "candidate:vitrine",
        physicalPageNumber: 1,
      },
    ],
    worksheet: {
      requirements: [
        {
          id: "EL-16",
          components: [
            { id: "winter_garden", factRole: "INSURED_OBJECT" },
            { id: "display_case", factRole: "INSURED_OBJECT" },
          ],
        },
      ],
    },
    ...overrides,
  };
}

describe("categoryDocumentOracleContract", () => {
  test("passes an approved sparse row across output, effects, values, roles and provenance", () => {
    const result = evaluateCategoryDocumentOracle(fixture());

    expect(result).toMatchObject({
      status: "APPROVED_ORACLE_PASS",
      pass: true,
      approved: { pass: true, rowCount: 1 },
      draft: { rowCount: 0 },
    });
    expect(result.results[0]).toMatchObject({
      categoryId: "EL-16",
      approvalStatus: "APPROVED",
      pass: true,
    });
  });

  test("keeps a failing draft diagnostic out of the approved release decision", () => {
    const input = fixture({ oracleApprovalStatus: "DRAFT" });
    input.oracleDocument.rows[0].row.coverage = "Ja";

    const result = evaluateCategoryDocumentOracle(input);

    expect(result).toMatchObject({
      status: "DRAFT_REVIEW_REQUIRED",
      pass: false,
      approved: { assertionCount: 0, rowCount: 0 },
      draft: { pass: false, rowCount: 1 },
    });
  });

  test("detects a correct value bound to the wrong component role and source", () => {
    const input = fixture();
    input.selectedSources[0] = {
      ...input.selectedSources[0],
      componentId: "display_case",
      candidateId: "candidate:foreign",
      physicalPageNumber: 2,
    };
    input.requestedFieldEvidence.requirements[0].fields[0].facts[0].source = {
      candidateId: "candidate:foreign",
      physicalPageNumber: 2,
    };

    const result = evaluateCategoryDocumentOracle(input);
    const failedIds = result.results[0].checks
      .filter(({ pass }) => !pass)
      .map(({ id }) => id);

    expect(result.status).toBe("REVISE");
    expect(failedIds).toEqual(
      expect.arrayContaining([
        "EL-16:winter_garden:sources:requiredCandidateIds",
        "EL-16:sources:forbiddenCandidateIds",
        "EL-16:value:required:0",
      ])
    );
  });

  test("reports document identity failures independently", () => {
    const result = evaluateCategoryDocumentOracle(
      fixture({ pdfSha256: "wrong", physicalPages: 3 })
    );

    expect(result.status).toBe("REVISE");
    expect(result.identity.checks.filter(({ pass }) => !pass)).toMatchObject([
      { id: "document:pdfSha256" },
      { id: "document:physicalPages" },
    ]);
  });

  test("allows row-level APPROVED entries inside a DRAFT oracle", () => {
    const input = fixture({ oracleApprovalStatus: "DRAFT" });
    input.oracleDocument.rows[0].approvalStatus = "APPROVED";

    expect(evaluateCategoryDocumentOracle(input)).toMatchObject({
      status: "APPROVED_ORACLE_PASS",
      approved: { pass: true, rowCount: 1 },
      draft: { pass: false, rowCount: 0, assertionCount: 0 },
    });
  });

  test("rejects duplicate rows and unknown oracle fields", () => {
    const duplicate = fixture();
    duplicate.oracleDocument.rows.push(duplicate.oracleDocument.rows[0]);
    expect(() => evaluateCategoryDocumentOracle(duplicate)).toThrow(
      "CATEGORY_ORACLE_ROW_ID_DUPLICATE"
    );

    const unknown = fixture();
    unknown.oracleDocument.rows[0].sources.unknown = [];
    expect(() => evaluateCategoryDocumentOracle(unknown)).toThrow(
      "CATEGORY_ORACLE_SOURCE_RULE_KEY_UNKNOWN"
    );

    const rowTypo = fixture();
    rowTypo.oracleDocument.rows[0].row.coverge = "Ja";
    expect(() => evaluateCategoryDocumentOracle(rowTypo)).toThrow(
      "CATEGORY_ORACLE_FINAL_ROW_KEY_UNKNOWN"
    );

    const componentTypo = fixture();
    componentTypo.oracleDocument.rows[0].components[0].applicabilty =
      "CONDITIONAL";
    expect(() => evaluateCategoryDocumentOracle(componentTypo)).toThrow(
      "CATEGORY_ORACLE_COMPONENT_KEY_UNKNOWN"
    );
  });
});
