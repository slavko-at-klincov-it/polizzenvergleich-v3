const { TextSplitter } = require("../../../utils/TextSplitter");
const {
  PageAwareTextSplitter,
} = require("../../../utils/PageAwareTextSplitter");

function pdfDocument() {
  const first = "Brand ist ein Feuer.";
  const third = "Selbstbehalt EUR 350.";
  const pageContent = `[DOCUMENT_PAGE 1]\n${first}\n\n[DOCUMENT_PAGE 2]\n\n[DOCUMENT_PAGE 3]\n${third}`;
  const firstStart = pageContent.indexOf(first);
  const emptyStart =
    pageContent.indexOf("[DOCUMENT_PAGE 2]") + "[DOCUMENT_PAGE 2]\n".length;
  const thirdStart = pageContent.indexOf(third);
  return {
    id: "source-policy",
    docId: "workspace-policy",
    documentType: "pdf",
    title: "policy.pdf",
    pageContent,
    pageMap: [
      { pageNumber: 1, start: firstStart, end: firstStart + first.length },
      { pageNumber: 2, start: emptyStart, end: emptyStart },
      { pageNumber: 3, start: thirdStart, end: thirdStart + third.length },
    ],
    pdfExtraction: {
      schemaVersion: 1,
      totalPages: 3,
      processedPages: 3,
      pagesWithText: 2,
      complete: true,
    },
  };
}

describe("PageAwareTextSplitter", () => {
  test("never crosses a physical page and preserves global/local indices", async () => {
    const chunks = await PageAwareTextSplitter.splitDocument({
      documentData: pdfDocument(),
      chunkSize: 1_000,
      chunkOverlap: 0,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toContain("Brand ist ein Feuer.");
    expect(chunks[0].text).not.toContain("Selbstbehalt");
    expect(chunks[0].text).toContain("sourceDocument: policy.pdf");
    expect(chunks[0].text).toContain("documentId: workspace-policy");
    expect(chunks[0].text).toContain("physicalPdfPage: 1");
    expect(chunks[0].text).toContain(
      "citationLabel: policy.pdf — physische PDF-Seite 1"
    );
    expect(chunks[0].metadata).toMatchObject({
      title: "policy.pdf",
      sourceDocumentId: "source-policy",
      pageNumber: 1,
      chunkIndex: 0,
      pageChunkIndex: 0,
    });
    expect(chunks[1].metadata).toMatchObject({
      pageNumber: 3,
      chunkIndex: 1,
      pageChunkIndex: 0,
    });
  });

  test("rejects a recognizable legacy PDF without canonical PageMap", async () => {
    await expect(
      PageAwareTextSplitter.splitDocument({
        documentData: {
          id: "legacy",
          docId: "legacy-workspace",
          title: "legacy.pdf",
          pageContent: "flat legacy PDF text",
        },
      })
    ).rejects.toThrow("PDF_PAGEMAP_REQUIRED");
  });

  test("rejects invalid offsets and incomplete extraction metadata", async () => {
    const document = pdfDocument();
    document.pageMap[2].end = document.pageContent.length + 1;
    await expect(
      PageAwareTextSplitter.splitDocument({ documentData: document })
    ).rejects.toThrow("PDF_PAGEMAP_INVALID");
  });

  test("keeps ordinary non-PDF chunk text identical to TextSplitter", async () => {
    const documentData = {
      id: "source-notes",
      docId: "workspace-notes",
      title: "notes.txt",
      pageContent: "Ordinary text document with enough words for chunking.",
    };
    const expected = await new TextSplitter({
      chunkSize: 24,
      chunkOverlap: 0,
      chunkHeaderMeta: TextSplitter.buildHeaderMeta({ title: "notes.txt" }),
    }).splitText(documentData.pageContent);
    const actual = await PageAwareTextSplitter.splitDocument({
      documentData,
      chunkSize: 24,
      chunkOverlap: 0,
    });

    expect(actual.map(({ text }) => text)).toEqual(expected);
    expect(actual.every(({ metadata }) => metadata.pageNumber === 0)).toBe(
      true
    );
  });
});
