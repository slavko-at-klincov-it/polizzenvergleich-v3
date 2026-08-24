const crypto = require("crypto");
const fs = require("fs");

const PDF_EXTRACTION_SCHEMA_VERSION = 2;

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * Enforces that every physical PDF page has exactly one terminal extraction
 * record. A failed or missing page makes the whole import fail closed.
 *
 * @param {Array<object>} pages
 * @param {number} totalPages
 */
function validateCompleteness(pages, totalPages) {
  if (!Number.isInteger(totalPages) || totalPages < 1)
    throw new Error("PDF has no valid page count.");
  if (!Array.isArray(pages) || pages.length !== totalPages)
    throw new Error(
      `PDF extraction incomplete: expected ${totalPages} pages, received ${
        pages?.length || 0
      }.`
    );

  const pageNumbers = pages.map((page) => page.pageNumber);
  const uniquePageNumbers = new Set(pageNumbers);
  if (uniquePageNumbers.size !== totalPages)
    throw new Error("PDF extraction contains duplicate page numbers.");

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const page = pages.find((entry) => entry.pageNumber === pageNumber);
    if (!page) throw new Error(`PDF extraction is missing page ${pageNumber}.`);
    if (page.status === "failed")
      throw new Error(
        `PDF extraction failed on page ${pageNumber}: ${
          page.error || "unknown processing error"
        }`
      );
  }
}

/**
 * Builds one canonical text payload plus an offset map. Offsets use JavaScript
 * UTF-16 string indexes and can therefore be consumed directly with slice().
 *
 * @param {object} input
 * @param {Array<object>} input.pages
 * @param {number} input.totalPages
 * @param {string} input.sourceSha256
 * @returns {{pageContent:string,pageMap:Array<object>,pdfExtraction:object}}
 */
function assemblePdfExtraction({ pages, totalPages, sourceSha256 }) {
  validateCompleteness(pages, totalPages);
  const orderedPages = [...pages].sort(
    (left, right) => left.pageNumber - right.pageNumber
  );
  let pageContent = "";
  const pageMap = [];

  for (const page of orderedPages) {
    const normalizedText = String(page.text || "")
      .replace(/\r\n?/g, "\n")
      .trim();
    const separator = pageContent.length ? "\n\n" : "";
    const marker = `[DOCUMENT_PAGE ${page.pageNumber}]\n`;
    pageContent += separator + marker;
    const start = pageContent.length;
    pageContent += normalizedText;
    const end = pageContent.length;
    pageMap.push({
      pageNumber: page.pageNumber,
      start,
      end,
      method: page.method,
      status: page.status,
      ocrConfidence:
        typeof page.ocrConfidence === "number" ? page.ocrConfidence : null,
      quality: page.quality || null,
      layoutQuality: page.layout?.quality || "text_only",
      layout: page.layout || null,
    });
  }

  const pagesWithText = pageMap.filter(({ start, end }) => end > start).length;
  if (pagesWithText === 0)
    throw new Error("No text content found in any PDF page.");

  const counts = orderedPages.reduce((result, page) => {
    result[page.method] = (result[page.method] || 0) + 1;
    return result;
  }, {});
  const warnings = orderedPages
    .filter((page) => page.status !== "ok")
    .map((page) => ({ pageNumber: page.pageNumber, status: page.status }));

  return {
    pageContent,
    pageMap,
    pdfExtraction: {
      schemaVersion: PDF_EXTRACTION_SCHEMA_VERSION,
      sourceSha256,
      totalPages,
      processedPages: orderedPages.length,
      pagesWithText,
      complete: true,
      counts,
      warnings,
      pages: pageMap,
    },
  };
}

module.exports = {
  PDF_EXTRACTION_SCHEMA_VERSION,
  assemblePdfExtraction,
  sha256File,
  validateCompleteness,
};
