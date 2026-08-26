const PDF_EXTRACTION_SCHEMA_VERSION = 1;

function normalizedPageText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

/**
 * Build canonical text whose offsets map exactly to physical PDF pages.
 * Empty physical pages remain represented by an empty range so following
 * page numbers can never shift.
 */
function assemblePageMap(documents = []) {
  if (!Array.isArray(documents) || documents.length === 0)
    throw new Error("PDF has no extracted physical pages.");

  const declaredTotals = new Set();
  const pages = new Map();
  for (const document of documents) {
    const totalPages = Number(document?.metadata?.pdf?.totalPages);
    const pageNumber = Number(document?.metadata?.loc?.pageNumber);
    if (!Number.isInteger(totalPages) || totalPages < 1)
      throw new Error("PDF has no valid physical page count.");
    if (!Number.isInteger(pageNumber) || pageNumber < 1)
      throw new Error("PDF contains an invalid physical page number.");
    if (pageNumber > totalPages)
      throw new Error(
        `PDF page ${pageNumber} exceeds its declared page count.`
      );
    if (pages.has(pageNumber))
      throw new Error(`PDF contains duplicate physical page ${pageNumber}.`);

    declaredTotals.add(totalPages);
    pages.set(pageNumber, document);
  }

  if (declaredTotals.size !== 1)
    throw new Error("PDF pages disagree about the physical page count.");
  const [totalPages] = declaredTotals;
  if (pages.size !== totalPages)
    throw new Error(
      `PDF extraction is incomplete: expected ${totalPages} physical pages, received ${pages.size}.`
    );

  let pageContent = "";
  const pageMap = [];
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    if (!pages.has(pageNumber))
      throw new Error(`PDF extraction is missing physical page ${pageNumber}.`);

    if (pageContent.length) pageContent += "\n\n";
    pageContent += `[DOCUMENT_PAGE ${pageNumber}]\n`;
    const start = pageContent.length;
    pageContent += normalizedPageText(pages.get(pageNumber)?.pageContent);
    pageMap.push({ pageNumber, start, end: pageContent.length });
  }

  const pagesWithText = pageMap.filter(({ start, end }) => end > start).length;
  if (pagesWithText === 0)
    throw new Error("No text content found in any PDF page.");

  return {
    pageContent,
    pageMap,
    pdfExtraction: {
      schemaVersion: PDF_EXTRACTION_SCHEMA_VERSION,
      totalPages,
      processedPages: totalPages,
      pagesWithText,
      complete: true,
    },
  };
}

module.exports = {
  assemblePageMap,
  normalizedPageText,
  PDF_EXTRACTION_SCHEMA_VERSION,
};
