const path = require("path");

const {
  availableComparisonSlots,
  comparisonDocumentAttachment,
  deleteParsedComparisonSource,
  mergeHydratedComparisonDocuments,
} = require(
  path.resolve(
    __dirname,
    "../../../frontend/src/components/WorkspaceChat/ChatContainer/DnDWrapper/comparisonDocumentMerge.cjs"
  )
);

function localIndexing(uid, fileId, name = "Polizze.pdf") {
  return {
    uid,
    file: { name, type: "application/pdf" },
    status: "indexing",
    document: null,
    parsedFileId: fileId,
    fileId,
    type: "comparison_document",
  };
}

describe("comparison upload chip reconciliation", () => {
  test("replaces the local indexing chip when the same file becomes ready", () => {
    const local = localIndexing("local-upload-1", "41");
    const remote = comparisonDocumentAttachment({
      id: 9,
      parsedFileId: 41,
      originalFilename: "Polizze.pdf",
      status: "ready",
    });

    const result = mergeHydratedComparisonDocuments([local], [remote]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      uid: "local-upload-1",
      status: "ready",
      comparisonDocumentId: 9,
      fileId: 41,
    });
  });

  test("keeps the base-ready chip usable while optional inventory changes", () => {
    const building = comparisonDocumentAttachment({
      id: 9,
      parsedFileId: 41,
      originalFilename: "Polizze.pdf",
      status: "ready",
      inventoryStatus: "building",
    });
    const failed = comparisonDocumentAttachment({
      id: 10,
      parsedFileId: 42,
      originalFilename: "Fehler.pdf",
      status: "ready",
      inventoryStatus: "failed",
      inventoryError: "Inventar-Timeout",
    });

    expect(building).toMatchObject({
      status: "ready",
      inventoryStatus: "building",
    });
    expect(failed).toMatchObject({
      status: "ready",
      error: null,
      inventoryStatus: "failed",
    });
  });

  test("replaces a local indexing chip with the persisted failure", () => {
    const local = localIndexing("local-upload-failed", "43");
    const remote = comparisonDocumentAttachment({
      id: 10,
      parsedFileId: 43,
      originalFilename: "Polizze.pdf",
      status: "failed",
      error: "Inventar konnte nicht erstellt werden.",
    });

    const result = mergeHydratedComparisonDocuments([local], [remote]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      uid: "local-upload-failed",
      status: "failed",
      comparisonDocumentId: 10,
      fileId: 43,
      error: "Inventar konnte nicht erstellt werden.",
    });
  });

  test("removes an existing duplicate chip by comparison-document id", () => {
    const local = localIndexing("local-upload-2", 51);
    const staleServerChip = comparisonDocumentAttachment(
      { id: "12", parsedFileId: 51, status: "indexing" },
      "stale-server-chip"
    );
    const ready = comparisonDocumentAttachment({
      id: 12,
      parsedFileId: "51",
      status: "ready",
    });

    const result = mergeHydratedComparisonDocuments(
      [local, staleServerChip],
      [ready]
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("ready");
    expect(result[0].uid).toBe("local-upload-2");
  });

  test("does not merge different uploads merely because filenames match", () => {
    const first = localIndexing("first", 61, "Polizze.pdf");
    const second = comparisonDocumentAttachment({
      id: 14,
      parsedFileId: 62,
      originalFilename: "Polizze.pdf",
      status: "ready",
    });

    const result = mergeHydratedComparisonDocuments([first], [second]);
    expect(result).toHaveLength(2);
    expect(result.map((item) => String(item.fileId)).sort()).toEqual([
      "61",
      "62",
    ]);
  });

  test("deduplicates repeated hydrated records by file id", () => {
    const first = comparisonDocumentAttachment({
      id: 20,
      parsedFileId: 70,
      status: "ready",
    });
    const duplicate = comparisonDocumentAttachment({
      id: 21,
      parsedFileId: "70",
      status: "ready",
    });
    expect(
      mergeHydratedComparisonDocuments([], [first, duplicate])
    ).toHaveLength(1);
  });

  test("never renders more than two comparison chips during hydration races", () => {
    const locals = [
      localIndexing("local-a", 41, "A.pdf"),
      localIndexing("local-b", 42, "B.pdf"),
    ];
    const remote = [
      comparisonDocumentAttachment({
        id: 51,
        parsedFileId: 51,
        status: "ready",
      }),
      comparisonDocumentAttachment({
        id: 52,
        parsedFileId: 52,
        status: "ready",
      }),
    ];

    const result = mergeHydratedComparisonDocuments(locals, remote);
    expect(result).toHaveLength(2);
    expect(result.every((item) => item.status === "ready")).toBe(true);
  });

  test("caps even malformed hydrated input at two server documents", () => {
    const remote = [81, 82, 83].map((id) =>
      comparisonDocumentAttachment({
        id,
        parsedFileId: id,
        status: "ready",
      })
    );
    expect(mergeHydratedComparisonDocuments([], remote)).toHaveLength(2);
  });

  test("reserved uploads consume slots before asynchronous file reading finishes", () => {
    expect(availableComparisonSlots([], 0)).toBe(2);
    expect(availableComparisonSlots([], 2)).toBe(0);
    expect(availableComparisonSlots([localIndexing("local", 1)], 1)).toBe(0);
  });

  test("a visible failed chip keeps one slot until it is explicitly removed", () => {
    const failed = {
      ...localIndexing("failed", 91),
      status: "failed",
      document: null,
    };
    const newUploads = [
      localIndexing("new-a", null, "A.pdf"),
      localIndexing("new-b", null, "B.pdf"),
    ].slice(0, availableComparisonSlots([failed]));

    expect([failed, ...newUploads]).toHaveLength(2);
    expect(availableComparisonSlots([failed])).toBe(1);
  });

  test("a ready duplicate wins over an indexing record regardless of order", () => {
    const indexing = comparisonDocumentAttachment({
      id: 61,
      parsedFileId: 71,
      status: "indexing",
    });
    const ready = comparisonDocumentAttachment({
      id: 61,
      parsedFileId: 71,
      status: "ready",
    });

    for (const hydrated of [
      [indexing, ready],
      [ready, indexing],
    ]) {
      const result = mergeHydratedComparisonDocuments([], hydrated);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("ready");
    }
  });

  test("keeps a parsed-file chip when backend cleanup is not confirmed", async () => {
    const result = await deleteParsedComparisonSource({
      workspaceSlug: "polizzenvergleich",
      threadSlug: "thread-a",
      parsedFileId: 91,
      deleteParsedComparisonFile: jest.fn().mockResolvedValue(false),
    });
    expect(result).toEqual({
      success: false,
      error:
        "Die temporären Dokumentdaten konnten nicht entfernt werden. Bitte erneut versuchen.",
    });
  });

  test("keeps a parsed-file chip when backend cleanup rejects", async () => {
    const result = await deleteParsedComparisonSource({
      workspaceSlug: "polizzenvergleich",
      threadSlug: "thread-a",
      parsedFileId: 92,
      deleteParsedComparisonFile: jest
        .fn()
        .mockRejectedValue(new Error("offline")),
    });
    expect(result).toEqual({ success: false, error: "offline" });
  });
});
