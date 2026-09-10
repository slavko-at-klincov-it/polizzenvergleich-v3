const {
  comparisonOptions,
  comparisonResultForCustomer,
} = require("../../endpoints/policyComparisons");
const {
  LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
} = require("../../utils/policyComparison/referenceCustomerPresentation");

describe("policy comparison endpoint options", () => {
  test("keeps an existing session mode authoritative for all UI options", () => {
    const options = comparisonOptions(
      { policyComparisonMode: "SYMMETRIC_A_B_CORE5_V1" },
      { comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1" }
    );

    expect(options.mode).toMatchObject({
      id: "LF_IMMO_REFERENCE_A_TO_B_V1",
      direction: "A_TO_B",
      maxDocumentsA: 1,
    });
  });

  test("projects only LF results into the binary public customer contract", () => {
    const lfResult = {
      schemaVersion: 3,
      contractId: "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1",
      customerPresentationContractId: LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
      comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
      categories: [
        {
          categoryView: "LR01",
          rows: [
            {
              categoryId: "PR-01",
              packageA: { documentedContent: "LF", source: "Seite 1" },
              packageB: {
                documentedContent: "B",
                source: "B.pdf: Seite 2",
                contributors: [{ documentUuid: "b-1", source: "Seite 2" }],
              },
              outcome: "TEILWEISES_GEGENSTUECK",
              pointDecision: { reason: "Teilbeleg" },
            },
          ],
        },
      ],
      totals: { outcomes: { TEILWEISES_GEGENSTUECK: 1 } },
    };
    const symmetricResult = {
      comparisonMode: "SYMMETRIC_A_B_CORE5_V1",
      categories: [],
    };

    expect(
      comparisonResultForCustomer(lfResult, lfResult.comparisonMode)
        .categories[0].rows[0]
    ).toMatchObject({
      customerSearchStatus: "GEFUNDEN",
      customerSearchStatusLabel: "Gefunden",
    });
    expect(
      comparisonResultForCustomer(lfResult, lfResult.comparisonMode)
        .categories[0].rows[0].outcome
    ).toBeUndefined();
    expect(
      comparisonResultForCustomer(lfResult, lfResult.comparisonMode)
    ).toMatchObject({
      schemaVersion: 1,
      contractId: LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
      sourceResultContract: {
        schemaVersion: 3,
        contractId: "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1",
      },
    });
    expect(
      comparisonResultForCustomer(
        symmetricResult,
        symmetricResult.comparisonMode
      )
    ).toBe(symmetricResult);
  });

  test("leaves stored LF results without the V3.7.4 presentation marker unchanged", () => {
    const oldLfResult = {
      schemaVersion: 3,
      contractId: "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1",
      comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
      categories: [],
      totals: { outcomes: { GEGENSTUECK_UNKLAR: 172 } },
    };

    expect(
      comparisonResultForCustomer(oldLfResult, oldLfResult.comparisonMode)
    ).toBe(oldLfResult);
  });
});
