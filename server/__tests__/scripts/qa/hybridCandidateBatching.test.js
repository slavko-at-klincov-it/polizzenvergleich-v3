const {
  batchTargetChunks,
  restoreFrozenRankings,
} = require("../../../scripts/qa/augmentWorksheetWithHybridCandidates.cjs");

describe("hybrid candidate target batching", () => {
  test("keeps all chunks for one target in stable batches", () => {
    const chunks = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];

    expect(batchTargetChunks(chunks, 1)).toEqual([
      [{ id: "c1" }],
      [{ id: "c2" }],
      [{ id: "c3" }],
    ]);
    expect(batchTargetChunks(chunks, 3)).toEqual([chunks]);
  });

  test("restores the exact frozen target order, chunks, and scores", () => {
    const eligibleTargets = [
      { id: "target-a", topK: 2 },
      { id: "target-b", topK: 1 },
    ];
    const chunks = [
      { id: "c1", text: "one" },
      { id: "c2", text: "two" },
      { id: "c3", text: "three" },
    ];
    const rankingReport = {
      documentFingerprint: "document-sha",
      catalogId: "catalog-v1",
      configuration: { chunkSize: 3_000, chunkOverlap: 250 },
      rankings: [
        {
          targetId: "target-b",
          chunks: [{ chunkId: "c3", score: 0.4 }],
        },
        {
          targetId: "target-a",
          chunks: [
            { chunkId: "c2", score: 0.9 },
            { chunkId: "c1", score: 0.7 },
          ],
        },
      ],
    };

    const restored = restoreFrozenRankings({
      rankingReport,
      documentFingerprint: "document-sha",
      catalogId: "catalog-v1",
      eligibleTargets,
      chunks,
      chunkSize: 3_000,
      chunkOverlap: 250,
    });

    expect(restored.map((target) => target.id)).toEqual([
      "target-a",
      "target-b",
    ]);
    expect(restored[0].chunks).toEqual([
      { id: "c2", text: "two", score: 0.9 },
      { id: "c1", text: "one", score: 0.7 },
    ]);
    expect(restored[1].chunks).toEqual([
      { id: "c3", text: "three", score: 0.4 },
    ]);
  });

  test("rejects rankings from another semantic input", () => {
    expect(() =>
      restoreFrozenRankings({
        rankingReport: {
          documentFingerprint: "other-document",
          catalogId: "catalog-v1",
          configuration: { chunkSize: 3_000, chunkOverlap: 250 },
          rankings: [],
        },
        documentFingerprint: "document-sha",
        catalogId: "catalog-v1",
        eligibleTargets: [],
        chunks: [],
        chunkSize: 3_000,
        chunkOverlap: 250,
      })
    ).toThrow("Frozen-Rankings gehören nicht zu Dokument");
  });
});
