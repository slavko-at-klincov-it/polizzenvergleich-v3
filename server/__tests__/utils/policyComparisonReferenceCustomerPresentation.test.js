const {
  LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
  LF_CUSTOMER_SEARCH_STATUS,
  presentReferenceCustomerResult,
  referenceCustomerSearchStatus,
  validateReferenceCustomerResult,
} = require("../../utils/policyComparison/referenceCustomerPresentation");

function row({ id, outcome, contributors = [], content = "", source = "" }) {
  return {
    categoryId: id,
    analysisRowId: `internal-${id}`,
    categoryName: id,
    packageA: {
      documentedContent: `LF ${id}`,
      source: "Seite 1: LF",
      reviewStatus: "BELEGT",
      searchPlanStatus: "EXPLORATORY_INCOMPLETE",
    },
    packageB: {
      documentedContent: content,
      source,
      coverage: "Nicht feststellbar",
      coverageAmount: "Nicht feststellbar",
      reviewStatus:
        outcome === "GEGENSTUECK_UNKLAR" ? "WIDERSPRÜCHLICH" : "TEILBELEGT",
      contributors,
    },
    outcome,
    pointDecision: {
      outcome,
      reasonCode: "INTERNAL_REASON",
      reason: "Fachlicher Hinweis bleibt sichtbar.",
      ruleId: "INTERNAL_RULE",
      reviewRequired: true,
    },
  };
}

describe("LF reference customer presentation", () => {
  test("treats complete, partial and conflicting accepted sources as found", () => {
    for (const outcome of [
      "GEGENSTUECK_GEFUNDEN",
      "TEILWEISES_GEGENSTUECK",
      "GEGENSTUECK_UNKLAR",
    ])
      expect(
        referenceCustomerSearchStatus(
          row({
            id: outcome,
            outcome,
            content: "Belegter B-Inhalt",
            source: "B-Dokument: Seite 3: Beleg",
            contributors: [
              {
                documentUuid: "b-1",
                documentName: "B.pdf",
                source: "Seite 3: Beleg",
                reviewStatus: "INTERN",
              },
            ],
          })
        )
      ).toBe(LF_CUSTOMER_SEARCH_STATUS.FOUND);
  });

  test("fails closed when accepted source, displayed source or content is missing", () => {
    const base = {
      id: "missing",
      outcome: "TEILWEISES_GEGENSTUECK",
      content: "Belegter B-Inhalt",
      source: "B-Dokument: Seite 3: Beleg",
      contributors: [{ documentUuid: "b-1", source: "Seite 3: Beleg" }],
    };
    expect(
      referenceCustomerSearchStatus(row({ ...base, contributors: [] }))
    ).toBe(LF_CUSTOMER_SEARCH_STATUS.NOT_FOUND);
    expect(referenceCustomerSearchStatus(row({ ...base, content: "" }))).toBe(
      LF_CUSTOMER_SEARCH_STATUS.NOT_FOUND
    );
    expect(referenceCustomerSearchStatus(row({ ...base, source: "" }))).toBe(
      LF_CUSTOMER_SEARCH_STATUS.NOT_FOUND
    );
    expect(
      referenceCustomerSearchStatus(
        row({ ...base, contributors: [{ documentUuid: "b-1", source: "" }] })
      )
    ).toBe(LF_CUSTOMER_SEARCH_STATUS.NOT_FOUND);
  });

  test("creates a binary public result while preserving the private input", () => {
    const found = row({
      id: "A-01",
      outcome: "TEILWEISES_GEGENSTUECK",
      content: "Teilbeleg",
      source: "B.pdf: Seite 2: Teilbeleg",
      contributors: [
        {
          documentUuid: "b-1",
          documentName: "B.pdf",
          documentStatus: "ACTIVE",
          source: "Seite 2: Teilbeleg",
          reviewStatus: "BELEGT",
        },
      ],
    });
    const missing = row({
      id: "A-02",
      outcome: "GEGENSTUECK_UNKLAR",
    });
    const privateResult = {
      schemaVersion: 3,
      contractId: "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1",
      customerPresentationContractId: LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
      comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
      categories: [{ categoryView: "LR01", rows: [found, missing] }],
      totals: {
        rows: 2,
        outcomes: {
          TEILWEISES_GEGENSTUECK: 1,
          GEGENSTUECK_UNKLAR: 1,
        },
        customerReviewRequired: 2,
      },
    };

    const presented = presentReferenceCustomerResult(privateResult);
    const [publicFound, publicMissing] = presented.categories[0].rows;

    expect(presented.totals).toEqual({
      rows: 2,
      categories: 1,
      referenceRowsAnalyzed: 2,
      sideBOnlyRows: 0,
      customerSearchStatuses: { GEFUNDEN: 1, NICHT_GEFUNDEN: 1 },
      customerSearchRowKeysByStatus: {
        GEFUNDEN: ["LR01:A-01"],
        NICHT_GEFUNDEN: ["LR01:A-02"],
      },
    });
    expect(presented).toMatchObject({
      schemaVersion: 1,
      contractId: LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
      status: "LF_REFERENCE_CUSTOMER_RESULT_PRESENTED",
      sourceResultContract: {
        schemaVersion: 3,
        contractId: "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1",
        customerPresentationContractId: LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
      },
    });
    expect(publicFound).toMatchObject({
      categoryId: "A-01",
      customerSearchStatus: "GEFUNDEN",
      customerSearchStatusLabel: "Gefunden",
      customerSearchHint:
        "Im Dokumentpaket B wurde mindestens eine belastbare Fundstelle gefunden. Der gefundene Inhalt und seine Quelle sind in den Spalten B_Gegenstück und B_Quelle dargestellt.",
      packageB: {
        documentedContent: "Teilbeleg",
        source: "B.pdf: Seite 2: Teilbeleg",
      },
    });
    expect(publicMissing.customerSearchStatusLabel).toBe("Nicht gefunden");
    for (const publicRow of [publicFound, publicMissing]) {
      expect(publicRow.outcome).toBeUndefined();
      expect(publicRow.pointDecision).toBeUndefined();
      expect(publicRow.analysisRowId).toBeUndefined();
      expect(publicRow.packageA.reviewStatus).toBeUndefined();
      expect(publicRow.packageA.searchPlanStatus).toBeUndefined();
      expect(publicRow.packageB.reviewStatus).toBeUndefined();
      expect(publicRow.packageB.contributors[0]?.reviewStatus).toBeUndefined();
    }
    expect(privateResult.categories[0].rows[0]).toBe(found);
    expect(found.pointDecision.ruleId).toBe("INTERNAL_RULE");
    expect(privateResult.totals.outcomes.TEILWEISES_GEGENSTUECK).toBe(1);
    expect(validateReferenceCustomerResult(presented)).toBe(presented);
  });

  test("filters non-displayable contributors and fails on a declared status mismatch", () => {
    const privateResult = {
      schemaVersion: 3,
      contractId: "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1",
      customerPresentationContractId: LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
      comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
      categories: [
        {
          categoryView: "LR01",
          rows: [
            row({
              id: "A-01",
              outcome: "TEILWEISES_GEGENSTUECK",
              content: "Teilbeleg",
              source: "B.pdf: Seite 2: Teilbeleg",
              contributors: [
                { documentUuid: "b-1", source: "Seite 2: Teilbeleg" },
                { documentUuid: "b-2", source: "" },
              ],
            }),
          ],
        },
      ],
      totals: {},
    };
    const presented = presentReferenceCustomerResult(privateResult);
    expect(presented.categories[0].rows[0].packageB.contributors).toHaveLength(
      1
    );

    presented.categories[0].rows[0].customerSearchStatus = "NICHT_GEFUNDEN";
    expect(() => validateReferenceCustomerResult(presented)).toThrow(
      "LF_REFERENCE_CUSTOMER_PRESENTATION_ROWS_INVALID"
    );
  });
});
