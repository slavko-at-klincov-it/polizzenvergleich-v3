const { v4 } = require("uuid");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../../utils/files");
const { tokenizeString } = require("../../../utils/tokenizer");
const { default: slugify } = require("slugify");
const PDFLoader = require("./PDFLoader");
const OCRLoader = require("../../../utils/OCRLoader");
const {
  assemblePdfExtraction,
  sha256File,
} = require("./PdfExtractionAssembler");

async function asPdf({
  fullFilePath = "",
  filename = "",
  options = {},
  metadata = {},
}) {
  try {
    const pdfLoader = new PDFLoader(fullFilePath, { splitPages: true });
    console.log(`-- Working ${filename} --`);
    const nativePages = await pdfLoader.load();
    const totalPages = nativePages[0]?.metadata?.pdf?.totalPages || 0;
    const pagesNeedingOcr = nativePages
      .filter((page) => page.metadata?.extraction?.quality?.needsOcr)
      .map((page) => page.metadata.loc.pageNumber);
    let ocrPages = [];

    if (pagesNeedingOcr.length > 0) {
      console.log(
        `[asPDF] Selectively OCR parsing ${pagesNeedingOcr.length} page(s) in ${filename}.`
      );
      ocrPages = await new OCRLoader({
        targetLanguages: options?.ocr?.langList || "deu,eng",
      }).ocrPDF(fullFilePath, {
        pageNumbers: pagesNeedingOcr,
        maxWorkers: options?.ocr?.maxWorkers || 2,
        maxExecutionTime: options?.ocr?.maxExecutionTime || 900_000,
      });
    }

    const ocrByPage = new Map(
      ocrPages.map((page) => [page.metadata.loc.pageNumber, page])
    );
    const pages = nativePages.map((nativePage) => {
      const pageNumber = nativePage.metadata.loc.pageNumber;
      const quality = nativePage.metadata.extraction.quality;
      if (!quality.needsOcr) {
        return {
          pageNumber,
          text: nativePage.pageContent,
          method: "native",
          status: "ok",
          quality,
          ocrConfidence: null,
        };
      }

      const ocrPage = ocrByPage.get(pageNumber);
      if (!ocrPage || ocrPage.status === "failed") {
        return {
          pageNumber,
          text: "",
          method: "ocr",
          status: "failed",
          quality,
          ocrConfidence: null,
          error: ocrPage?.error || "OCR did not return a result for this page.",
        };
      }
      if (ocrPage.pageContent) {
        return {
          pageNumber,
          text: ocrPage.pageContent,
          method: "ocr",
          status: "ok",
          quality,
          ocrConfidence: ocrPage.confidence,
        };
      }
      if (nativePage.pageContent) {
        return {
          pageNumber,
          text: nativePage.pageContent,
          method: "native",
          status: "ocr_empty_native_fallback",
          quality,
          ocrConfidence: ocrPage.confidence,
        };
      }
      return {
        pageNumber,
        text: "",
        method: "ocr",
        status: "blank",
        quality,
        ocrConfidence: ocrPage.confidence,
      };
    });
    const sourceSha256 = await sha256File(fullFilePath);
    const { pageContent, pageMap, pdfExtraction } = assemblePdfExtraction({
      pages,
      totalPages,
      sourceSha256,
    });
    const data = {
      id: v4(),
      url: "file://" + fullFilePath,
      title: metadata.title || filename,
      docAuthor:
        metadata.docAuthor ||
        nativePages[0]?.metadata?.pdf?.info?.Creator ||
        "no author found",
      description:
        metadata.description ||
        nativePages[0]?.metadata?.pdf?.info?.Title ||
        "No description found.",
      docSource: metadata.docSource || "pdf file uploaded by the user.",
      chunkSource: metadata.chunkSource || "",
      published: createdDate(fullFilePath),
      wordCount: pageContent.split(/\s+/).filter(Boolean).length,
      pageContent,
      pageMap,
      pdfExtraction,
      sourceSha256,
      token_count_estimate: tokenizeString(pageContent),
    };
    const document = writeToServerDocuments({
      data,
      filename: `${slugify(filename)}-${data.id}`,
      options: { parseOnly: options.parseOnly },
    });
    if (!options.absolutePath) trashFile(fullFilePath);
    console.log(`[SUCCESS]: ${filename} converted & ready for embedding.\n`);
    return { success: true, reason: null, documents: [document] };
  } catch (error) {
    console.error(`[asPDF] Failed to process ${filename}: ${error.message}`);
    if (!options.absolutePath) trashFile(fullFilePath);
    return { success: false, reason: error.message, documents: [] };
  }
}

module.exports = asPdf;
