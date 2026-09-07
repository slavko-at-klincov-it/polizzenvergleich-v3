const {
  buildIsolatedTargetBatchPayload,
  buildIsolatedTargetBatches,
  normalizedBatchSize,
  parseAndValidateIsolatedTargetBatch,
} = require("../../../utils/policyAnalysis/isolatedTargetBatchContract");

const items = ["a", "b", "c"].map((itemId) => ({
  itemId,
  payload: { task: "ONE", value: itemId },
}));

describe("isolated target batch contract", () => {
  it("bounds batch size and serialized payload size without reordering", () => {
    expect(buildIsolatedTargetBatches({ items, maxTargetsPerCall: 2 })).toEqual([
      items.slice(0, 2),
      items.slice(2),
    ]);
    expect(
      buildIsolatedTargetBatches({
        items: [
          { itemId: "large-a", payload: { value: "x".repeat(700) } },
          { itemId: "large-b", payload: { value: "x".repeat(700) } },
        ],
        maxTargetsPerCall: 2,
        maxSerializedPayloadChars: 1_000,
      })
    ).toHaveLength(2);
  });

  it("rejects unsafe batch sizes", () => {
    expect(normalizedBatchSize("4")).toBe(4);
    expect(() => normalizedBatchSize("0")).toThrow(
      "ISOLATED_BATCH_SIZE_INVALID"
    );
    expect(() => normalizedBatchSize("5")).toThrow(
      "ISOLATED_BATCH_SIZE_INVALID"
    );
  });

  it("builds and validates an exact ordered wrapper", () => {
    const payload = buildIsolatedTargetBatchPayload({
      task: "CLASSIFY_BATCH",
      items: items.slice(0, 2),
      exampleResponse: { answer: "YES" },
    });
    expect(payload.isolationContract.noCrossItemEvidence).toBe(true);
    const result = parseAndValidateIsolatedTargetBatch({
      responseText: JSON.stringify({
        batchSchemaVersion: 1,
        results: [
          { itemId: "a", response: { answer: "YES" } },
          { itemId: "b", response: { answer: "NO" } },
        ],
      }),
      items: items.slice(0, 2),
      parseItemResponse: ({ item, responseText }) => ({
        itemId: item.itemId,
        answer: JSON.parse(responseText).answer,
      }),
    });
    expect(result).toEqual([
      { itemId: "a", answer: "YES" },
      { itemId: "b", answer: "NO" },
    ]);
  });

  it("fails closed on reordered or extra results", () => {
    expect(() =>
      parseAndValidateIsolatedTargetBatch({
        responseText: JSON.stringify({
          batchSchemaVersion: 1,
          results: [
            { itemId: "b", response: { answer: "NO" } },
            { itemId: "a", response: { answer: "YES" } },
          ],
        }),
        items: items.slice(0, 2),
        parseItemResponse: () => true,
      })
    ).toThrow("ISOLATED_BATCH_RESULT_ORDER_INVALID");
    expect(() =>
      parseAndValidateIsolatedTargetBatch({
        responseText: JSON.stringify({
          batchSchemaVersion: 1,
          results: [
            {
              itemId: "a",
              response: { answer: "YES" },
              note: "not allowed",
            },
            { itemId: "b", response: { answer: "NO" } },
          ],
        }),
        items: items.slice(0, 2),
        parseItemResponse: () => true,
      })
    ).toThrow("ISOLATED_BATCH_RESULT_KEYS_INVALID");
  });
});
