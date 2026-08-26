const mockLoad = jest.fn();
const mockOcrPDF = jest.fn();
const mockWriteToServerDocuments = jest.fn(({ data }) => ({
  ...data,
  location: "direct-uploads/policy.json",
}));

jest.mock("../../../../processSingleFile/convert/asPDF/PDFLoader", () =>
  jest.fn().mockImplementation(() => ({ load: mockLoad }))
);
jest.mock("../../../../utils/OCRLoader", () =>
  jest.fn().mockImplementation(() => ({ ocrPDF: mockOcrPDF }))
);
jest.mock("../../../../utils/files", () => ({
  createdDate: jest.fn().mockReturnValue("2026-08-26"),
  trashFile: jest.fn(),
  writeToServerDocuments: mockWriteToServerDocuments,
}));
jest.mock("../../../../utils/tokenizer", () => ({
  tokenizeString: jest.fn().mockReturnValue(42),
}));

const asPDF = require("../../../../processSingleFile/convert/asPDF");
const {
  assemblePageMap,
} = require("../../../../processSingleFile/convert/asPDF/PDFPageMap");

function page(pageNumber, pageContent, totalPages = 3) {
  return {
    pageContent,
    metadata: {
      pdf: { totalPages, info: { Creator: "Test", Title: "Policy" } },
      loc: { pageNumber },
    },
  };
}

describe("asPDF canonical physical PageMap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoad.mockResolvedValue([
      page(1, "Brand ist ein Feuer."),
      page(2, ""),
      page(3, "Selbstbehalt EUR 350."),
    ]);
  });

  test("persists all physical pages and slice-safe offsets", async () => {
    const result = await asPDF({
      fullFilePath: "/tmp/policy.pdf",
      filename: "policy.pdf",
      options: { absolutePath: true, parseOnly: true },
    });

    expect(result.success).toBe(true);
    const document = result.documents[0];
    expect(document.documentType).toBe("pdf");
    expect(document.pageMap.map(({ pageNumber }) => pageNumber)).toEqual([
      1, 2, 3,
    ]);
    expect(
      document.pageMap.map(({ start, end }) =>
        document.pageContent.slice(start, end)
      )
    ).toEqual(["Brand ist ein Feuer.", "", "Selbstbehalt EUR 350."]);
    expect(document.pdfExtraction).toEqual({
      schemaVersion: 1,
      totalPages: 3,
      processedPages: 3,
      pagesWithText: 2,
      complete: true,
    });
    expect(mockOcrPDF).not.toHaveBeenCalled();
  });

  test.each([
    ["duplicate", [page(1, "one"), page(1, "duplicate"), page(3, "three")]],
    ["missing", [page(1, "one"), page(3, "three")]],
    ["inconsistent", [page(1, "one", 2), page(2, "two", 3)]],
  ])("rejects %s physical page metadata", (_name, documents) => {
    expect(() => assemblePageMap(documents)).toThrow(/PDF/);
  });
});
