const { TextSplitter } = require("../TextSplitter");

const PDF_EXTRACTION_SCHEMA_VERSION = 1;

function fileValueLooksLikePdf(value) {
  if (typeof value !== "string") return false;
  return /\.pdf(?:$|[?#])/i.test(value.trim());
}

class PageAwareTextSplitter {
  static isPdfDocument(documentData = {}) {
    return (
      documentData.documentType === "pdf" ||
      Array.isArray(documentData.pageMap) ||
      !!documentData.pdfExtraction ||
      fileValueLooksLikePdf(documentData.title) ||
      fileValueLooksLikePdf(documentData.url) ||
      fileValueLooksLikePdf(documentData.filename)
    );
  }

  static sourceDocumentId(documentData = {}) {
    return String(
      documentData.sourceDocumentId ||
        documentData.id ||
        documentData.docId ||
        ""
    );
  }

  static title(documentData = {}) {
    return String(
      documentData.title || documentData.filename || "Unknown document"
    );
  }

  static pages(documentData = {}) {
    const content = String(documentData.pageContent || "");
    const pageMap = documentData.pageMap;
    const extraction = documentData.pdfExtraction;

    if (!this.isPdfDocument(documentData)) return null;
    if (!Array.isArray(pageMap) || pageMap.length === 0)
      throw new Error("PDF_PAGEMAP_REQUIRED");
    if (
      extraction?.schemaVersion !== PDF_EXTRACTION_SCHEMA_VERSION ||
      extraction?.complete !== true ||
      !Number.isInteger(extraction?.totalPages) ||
      extraction.totalPages < 1 ||
      extraction?.processedPages !== extraction.totalPages ||
      pageMap.length !== extraction.totalPages
    )
      throw new Error("PDF_PAGEMAP_INVALID");

    let previousEnd = 0;
    let pagesWithText = 0;
    const pages = pageMap.map((page, index) => {
      const pageNumber = Number(page.pageNumber);
      const start = Number(page.start);
      const end = Number(page.end);
      if (
        !Number.isInteger(pageNumber) ||
        pageNumber !== index + 1 ||
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < previousEnd ||
        end < start ||
        end > content.length
      )
        throw new Error(
          `PDF_PAGEMAP_INVALID: physical page ${page.pageNumber || "unknown"}`
        );

      previousEnd = end;
      const text = content.slice(start, end);
      if (text.length > 0) pagesWithText += 1;
      return { pageNumber, text };
    });

    if (pagesWithText !== extraction.pagesWithText)
      throw new Error("PDF_PAGEMAP_INVALID: text page count mismatch");
    return pages;
  }

  static baseMetadata(documentData = {}) {
    const {
      pageContent: _pageContent,
      pageMap: _pageMap,
      pdfExtraction: _pdfExtraction,
      docId: _docId,
      id: _id,
      sourceDocumentId: _sourceDocumentId,
      ...metadata
    } = documentData;
    return metadata;
  }

  static async splitDocument({
    documentData = {},
    chunkSize = 1_000,
    chunkOverlap = 20,
    chunkPrefix = "",
  }) {
    const baseMetadata = this.baseMetadata(documentData);
    const mappedPages = this.pages(documentData);
    const sourceDocumentId = this.sourceDocumentId(documentData);
    const title = this.title(documentData);
    const isPdf = mappedPages !== null;

    if (!sourceDocumentId) throw new Error("DOCUMENT_ID_REQUIRED");

    if (!isPdf) {
      const splitter = new TextSplitter({
        chunkSize,
        chunkOverlap,
        chunkPrefix,
        chunkHeaderMeta: TextSplitter.buildHeaderMeta(baseMetadata),
      });
      const textChunks = await splitter.splitText(
        String(documentData.pageContent || "")
      );
      return textChunks.map((text, chunkIndex) => ({
        text,
        metadata: {
          ...baseMetadata,
          title,
          sourceDocumentId,
          pageNumber: 0,
          chunkIndex,
          pageChunkIndex: chunkIndex,
        },
      }));
    }

    const chunks = [];
    for (const page of mappedPages) {
      if (!page.text) continue;
      const splitter = new TextSplitter({
        chunkSize,
        chunkOverlap,
        chunkPrefix,
        chunkHeaderMeta: {
          ...TextSplitter.buildHeaderMeta({ ...baseMetadata, title }),
          documentId: String(documentData.docId),
          physicalPdfPage: String(page.pageNumber),
          citationLabel: `${title} — physische PDF-Seite ${page.pageNumber}`,
        },
      });
      const pageChunks = await splitter.splitText(page.text);
      for (const [pageChunkIndex, text] of pageChunks.entries()) {
        chunks.push({
          text,
          metadata: {
            ...baseMetadata,
            title,
            sourceDocumentId,
            pageNumber: page.pageNumber,
            chunkIndex: chunks.length,
            pageChunkIndex,
          },
        });
      }
    }
    return chunks;
  }
}

module.exports = {
  PageAwareTextSplitter,
  PDF_EXTRACTION_SCHEMA_VERSION,
};
