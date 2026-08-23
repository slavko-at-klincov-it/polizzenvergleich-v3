const {
  assemblePdfExtraction,
  validateCompleteness,
} = require("../../../../processSingleFile/convert/asPDF/PdfExtractionAssembler");

describe("PdfExtractionAssembler", () => {
  test("orders pages and exposes exact slice offsets in both page contracts", () => {
    const result = assemblePdfExtraction({
      totalPages: 2,
      sourceSha256: "abc123",
      pages: [
        {
          pageNumber: 2,
          text: "English insurance clause",
          method: "ocr",
          status: "ok",
          quality: { needsOcr: true },
          ocrConfidence: 91,
        },
        {
          pageNumber: 1,
          text: "Selbstbehalt EUR 500",
          method: "native",
          status: "ok",
          quality: { needsOcr: false },
          ocrConfidence: null,
        },
      ],
    });

    expect(result.pageContent).toContain("Selbstbehalt EUR 500\n\n");
    expect(result.pdfExtraction.schemaVersion).toBe(1);
    expect(result.pdfExtraction.sourceSha256).toBe("abc123");
    expect(result.pdfExtraction.pages).toEqual(result.pageMap);
    for (const page of result.pageMap) {
      expect(result.pageContent.slice(page.start, page.end)).toBe(
        page.pageNumber === 1
          ? "Selbstbehalt EUR 500"
          : "English insurance clause"
      );
      expect(page).toEqual(
        expect.objectContaining({
          pageNumber: expect.any(Number),
          start: expect.any(Number),
          end: expect.any(Number),
          method: expect.any(String),
          status: expect.any(String),
          quality: expect.any(Object),
        })
      );
    }
  });

  test("fails closed for missing, duplicate, or failed pages", () => {
    expect(() => validateCompleteness([], 2)).toThrow("incomplete");
    expect(() =>
      validateCompleteness(
        [
          { pageNumber: 1, status: "ok" },
          { pageNumber: 1, status: "ok" },
        ],
        2
      )
    ).toThrow("duplicate");
    expect(() =>
      validateCompleteness([{ pageNumber: 1, status: "failed" }], 1)
    ).toThrow("failed on page 1");
  });

  test("records blank pages but rejects a wholly textless PDF", () => {
    expect(() =>
      assemblePdfExtraction({
        totalPages: 1,
        sourceSha256: "abc123",
        pages: [
          {
            pageNumber: 1,
            text: "",
            method: "ocr",
            status: "blank",
            quality: { needsOcr: true },
          },
        ],
      })
    ).toThrow("No text content");
  });
});
