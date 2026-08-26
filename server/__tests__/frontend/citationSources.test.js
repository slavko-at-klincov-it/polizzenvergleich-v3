const citationSources = require("../../../frontend/src/utils/chat/citationSources.cjs");

describe("citation source provenance", () => {
  test("keeps same-title documents separate by docId", () => {
    const combined = citationSources.combineLikeSources([
      {
        id: "a",
        docId: "doc-a",
        sourceDocumentId: "source-a",
        title: "policy.pdf",
        pageNumber: 5,
        text: "A amount EUR 10,000.",
      },
      {
        id: "b",
        docId: "doc-b",
        sourceDocumentId: "source-b",
        title: "policy.pdf",
        pageNumber: 5,
        text: "B amount EUR 20,000.",
      },
    ]);

    expect(combined).toHaveLength(2);
    expect(combined.map(({ groupKey }) => groupKey)).toEqual([
      "doc:doc-a",
      "doc:doc-b",
    ]);
    expect(combined[0].chunks[0]).toMatchObject({
      pageNumber: 5,
      text: "A amount EUR 10,000.",
    });
    expect(combined[1].chunks[0].text).toBe("B amount EUR 20,000.");
  });

  test("groups pages of one document without merging their chunk provenance", () => {
    const combined = citationSources.combineLikeSources([
      { docId: "doc", title: "policy.pdf", pageNumber: 5, text: "Five" },
      { docId: "doc", title: "policy.pdf", pageNumber: 8, text: "Eight" },
    ]);

    expect(combined).toHaveLength(1);
    expect(
      combined[0].chunks.map(({ pageNumber, text }) => [pageNumber, text])
    ).toEqual([
      [5, "Five"],
      [8, "Eight"],
    ]);
    expect(citationSources.sourcePageNumbers(combined[0])).toEqual([5, 8]);
  });

  test("removes only the transport header from displayed original text", () => {
    expect(
      citationSources.omitChunkHeader(
        "<document_metadata>\nphysicalPdfPage: 5\n</document_metadata>\n\nOriginal clause."
      )
    ).toBe("Original clause.");
  });
});
