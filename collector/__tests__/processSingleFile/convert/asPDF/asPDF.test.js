const fs = require("fs");
const os = require("os");
const path = require("path");

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
  createdDate: jest.fn().mockReturnValue("2026-08-23"),
  trashFile: jest.fn(),
  writeToServerDocuments: mockWriteToServerDocuments,
}));
jest.mock("../../../../utils/tokenizer", () => ({
  tokenizeString: jest.fn().mockReturnValue(42),
}));

const asPDF = require("../../../../processSingleFile/convert/asPDF");

function nativePage(pageNumber, pageContent, needsOcr) {
  return {
    pageContent,
    metadata: {
      pdf: {
        totalPages: 2,
        info: { Creator: "Test", Title: "Policy" },
      },
      loc: { pageNumber },
      extraction: {
        quality: { needsOcr, reason: needsOcr ? "empty_text_layer" : null },
      },
    },
  };
}

describe("asPDF selective extraction", () => {
  let pdfPath;

  beforeEach(() => {
    jest.clearAllMocks();
    pdfPath = path.join(os.tmpdir(), `anythingllm-ocr-${Date.now()}.pdf`);
    fs.writeFileSync(pdfPath, "synthetic pdf bytes");
    mockLoad.mockResolvedValue([
      nativePage(
        1,
        "Die Versicherung enthält einen Selbstbehalt von EUR 500.",
        false
      ),
      nativePage(2, "", true),
    ]);
  });

  afterEach(() => {
    if (fs.existsSync(pdfPath)) fs.rmSync(pdfPath);
  });

  test("OCRs only a problematic page and preserves provenance", async () => {
    mockOcrPDF.mockResolvedValue([
      {
        pageContent: "English deductible EUR 250.",
        status: "ok",
        confidence: 93,
        metadata: { loc: { pageNumber: 2 } },
      },
    ]);

    const result = await asPDF({
      fullFilePath: pdfPath,
      filename: "policy.pdf",
      options: { absolutePath: true, parseOnly: true },
    });

    expect(result.success).toBe(true);
    expect(mockOcrPDF).toHaveBeenCalledWith(
      pdfPath,
      expect.objectContaining({ pageNumbers: [2], maxWorkers: 2 })
    );
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].pageContent).toContain(
      "Selbstbehalt von EUR 500.\n\n"
    );
    expect(result.documents[0].pdfExtraction).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        totalPages: 2,
        processedPages: 2,
        complete: true,
      })
    );
    expect(result.documents[0].pdfExtraction.pages[1]).toEqual(
      expect.objectContaining({
        pageNumber: 2,
        method: "ocr",
        status: "ok",
        ocrConfidence: 93,
      })
    );
  });

  test("fails the complete import when required OCR fails", async () => {
    mockOcrPDF.mockResolvedValue([
      {
        pageContent: "",
        status: "failed",
        error: "renderer failed",
        metadata: { loc: { pageNumber: 2 } },
      },
    ]);

    const result = await asPDF({
      fullFilePath: pdfPath,
      filename: "policy.pdf",
      options: { absolutePath: true, parseOnly: true },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        documents: [],
        reason: expect.stringContaining("page 2"),
      })
    );
    expect(mockWriteToServerDocuments).not.toHaveBeenCalled();
  });

  test("fails closed when OCR text is nonempty but still low quality", async () => {
    mockOcrPDF.mockResolvedValue([
      {
        pageContent: "??",
        status: "ok",
        confidence: 12,
        metadata: { loc: { pageNumber: 2 } },
      },
    ]);

    const result = await asPDF({
      fullFilePath: pdfPath,
      filename: "policy.pdf",
      options: { absolutePath: true, parseOnly: true },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        documents: [],
        reason: expect.stringContaining("quality is insufficient"),
      })
    );
    expect(mockWriteToServerDocuments).not.toHaveBeenCalled();
  });

  test("never falls back to a native text layer that already failed quality", async () => {
    mockLoad.mockResolvedValue([
      nativePage(
        1,
        "Die Versicherung enthält einen Selbstbehalt von EUR 500.",
        false
      ),
      nativePage(2, "kaputte Textschicht", true),
    ]);
    mockOcrPDF.mockResolvedValue([
      {
        pageContent: "",
        status: "empty",
        confidence: 0,
        metadata: { loc: { pageNumber: 2 } },
      },
    ]);

    const result = await asPDF({
      fullFilePath: pdfPath,
      filename: "policy.pdf",
      options: { absolutePath: true, parseOnly: true },
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain("native text layer failed quality checks");
    expect(mockWriteToServerDocuments).not.toHaveBeenCalled();
  });
});
