jest.mock("../../../utils/PolicyComparison/PolicyInferenceQueue", () => ({
  PolicyInferenceQueue: {
    run: jest.fn(),
    runOperation: jest.fn(),
  },
}));

const {
  PolicyInferenceQueue,
} = require("../../../utils/PolicyComparison/PolicyInferenceQueue");
const {
  ComparisonDeductibleCandidateResolver,
} = require("../../../utils/PolicyComparison/ComparisonDeductibleCandidateResolver");

describe("ComparisonDeductibleCandidateResolver", () => {
  beforeEach(() => jest.clearAllMocks());

  test("accepts only an exact source-grounded semantic deductible", async () => {
    PolicyInferenceQueue.run.mockResolvedValue({
      textResponse: JSON.stringify({
        candidates: [
          {
            key: "c1",
            deductible: true,
            evidenceText: "Der Versicherungsnehmer trägt je Schaden 500 EUR.",
          },
          { key: "c2", deductible: false, evidenceText: null },
        ],
      }),
    });
    const units = [
      {
        id: 1,
        blockKey: "implicit-deductible",
        pageNumber: 4,
        sourceStart: 100,
        text: "Der Versicherungsnehmer trägt je Schaden 500 EUR.",
        headingPath: ["Sturm"],
      },
      {
        id: 2,
        blockKey: "premium",
        pageNumber: 5,
        sourceStart: 200,
        text: "Die Jahresprämie beträgt 500 EUR.",
        headingPath: ["Prämie"],
      },
    ];

    const result = await ComparisonDeductibleCandidateResolver.resolve({
      candidates: units,
      Connector: { getChatCompletion: jest.fn() },
    });

    expect(result.modelCalls).toBe(1);
    expect(result.factsByBlock.get(1)).toEqual([
      expect.objectContaining({
        factType: "deductible",
        pageNumber: 4,
        evidenceStart: 100,
        value: { kind: "money", amount: 500, currency: "EUR" },
      }),
    ]);
    expect(result.factsByBlock.has(2)).toBe(false);
  });

  test("fails closed when the model quote is not present in the candidate", async () => {
    PolicyInferenceQueue.run.mockResolvedValue({
      textResponse: JSON.stringify({
        candidates: [
          {
            key: "c1",
            deductible: true,
            evidenceText: "Selbstbehalt 500 EUR",
          },
        ],
      }),
    });

    const result = await ComparisonDeductibleCandidateResolver.resolve({
      candidates: [
        {
          id: 1,
          blockKey: "premium",
          pageNumber: 5,
          sourceStart: 0,
          text: "Die Jahresprämie beträgt 500 EUR.",
          headingPath: [],
        },
      ],
      Connector: { getChatCompletion: jest.fn() },
    });

    expect(result.factsByBlock.size).toBe(0);
    expect(result.unresolved).toBe(1);
  });
});
