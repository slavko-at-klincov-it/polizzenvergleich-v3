const { TextSplitter } = require("../TextSplitter");

/**
 * Converts an extracted document into page-bound embedding chunks.
 *
 * Inputs: collector document JSON and the configured embedding chunk settings.
 * Outputs: ordered `{ text, metadata }` chunks which never cross PDF pages.
 * Side effects: none. Page provenance is part of every returned chunk.
 */
class PageAwareTextSplitter {
  static extractionPages(documentData = {}) {
    const content = String(documentData.pageContent || "");
    const pages = documentData?.pdfExtraction?.pages;
    if (!Array.isArray(pages) || pages.length === 0) return null;

    return pages.map((page) => {
      const start = Number(page.start);
      const end = Number(page.end);
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end < start ||
        end > content.length
      )
        throw new Error(
          `Invalid PDF page offsets for page ${page.pageNumber || "unknown"}.`
        );

      return {
        pageNumber: Number(page.pageNumber),
        text: content.slice(start, end).trim(),
        extractionMethod: page.method || "native",
        extractionStatus: page.status || "ok",
      };
    });
  }

  static baseVectorMetadata(documentData = {}) {
    const {
      pageContent: _pageContent,
      pdfExtraction: _pdfExtraction,
      docId: _docId,
      ...metadata
    } = documentData;

    // Lance tables infer a stable schema from the first insert. Keep custom
    // chunk metadata scalar and compact; nested page maps belong in the source
    // document JSON, not in every vector row.
    return Object.fromEntries(
      Object.entries(metadata).filter(
        ([, value]) =>
          value === null ||
          ["string", "number", "boolean"].includes(typeof value)
      )
    );
  }

  static async splitDocument({
    documentData = {},
    chunkSize = 1_000,
    chunkOverlap = 20,
    chunkPrefix = "",
  }) {
    const baseMetadata = this.baseVectorMetadata(documentData);
    const extractionPages = this.extractionPages(documentData);
    const pages = extractionPages || [
      {
        pageNumber: null,
        text: String(documentData.pageContent || "").trim(),
        extractionMethod: null,
        extractionStatus: null,
      },
    ];
    const chunks = [];

    for (const page of pages) {
      if (!page.text) continue;
      const header = {
        sourceDocument: baseMetadata.title || "Unbenanntes Dokument",
        ...(Number.isInteger(page.pageNumber)
          ? { page: String(page.pageNumber) }
          : {}),
      };
      const splitter = new TextSplitter({
        chunkSize,
        chunkOverlap,
        chunkPrefix,
        chunkHeaderMeta: header,
      });
      const pageChunks = await splitter.splitText(page.text);

      pageChunks.forEach((text, pageChunkIndex) => {
        chunks.push({
          text,
          metadata: {
            ...baseMetadata,
            ...(Number.isInteger(page.pageNumber)
              ? { pageNumber: page.pageNumber }
              : {}),
            ...(page.extractionMethod
              ? { extractionMethod: page.extractionMethod }
              : {}),
            chunkIndex: chunks.length,
            pageChunkIndex,
          },
        });
      });
    }

    return chunks;
  }
}

module.exports = { PageAwareTextSplitter };
