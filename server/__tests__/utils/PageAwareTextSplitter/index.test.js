const {
  PageAwareTextSplitter,
} = require("../../../utils/PageAwareTextSplitter");

describe("PageAwareTextSplitter", () => {
  test("creates page-bound chunks with page provenance", async () => {
    const first = "Selbstbehalt EUR 350 pro Schadenfall.";
    const separator = "\n\n";
    const second = "Deckungssumme EUR 1.000.000.";
    const pageContent = `${first}${separator}${second}`;
    const chunks = await PageAwareTextSplitter.splitDocument({
      documentData: {
        title: "Polizze A.pdf",
        pageContent,
        pdfExtraction: {
          pages: [
            {
              pageNumber: 1,
              start: 0,
              end: first.length,
              method: "native",
              status: "ok",
            },
            {
              pageNumber: 2,
              start: first.length + separator.length,
              end: pageContent.length,
              method: "ocr",
              status: "ok",
            },
          ],
        },
      },
      chunkSize: 1_000,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toContain("page: 1");
    expect(chunks[0].text).toContain("Selbstbehalt");
    expect(chunks[0].text).not.toContain("Deckungssumme");
    expect(chunks[0].metadata).toMatchObject({
      title: "Polizze A.pdf",
      pageNumber: 1,
      extractionMethod: "native",
      pageChunkIndex: 0,
    });
    expect(chunks[1].text).toContain("page: 2");
    expect(chunks[1].text).toContain("Deckungssumme");
    expect(chunks[1].metadata.extractionMethod).toBe("ocr");
  });

  test("rejects invalid page offsets instead of silently mis-citing", async () => {
    await expect(
      PageAwareTextSplitter.splitDocument({
        documentData: {
          pageContent: "short",
          pdfExtraction: {
            pages: [{ pageNumber: 1, start: 0, end: 99 }],
          },
        },
      })
    ).rejects.toThrow("Invalid PDF page offsets");
  });

  test("falls back to ordinary document chunking for non-PDF documents", async () => {
    const chunks = await PageAwareTextSplitter.splitDocument({
      documentData: {
        title: "notes.txt",
        pageContent: "A normal text attachment.",
      },
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].metadata.pageNumber).toBeUndefined();
    expect(chunks[0].text).toContain("A normal text attachment");
  });
});
