const fs = require("fs").promises;
const { assessPageText } = require("../PageTextQuality");

class PDFLoader {
  constructor(filePath, { splitPages = true } = {}) {
    this.filePath = filePath;
    this.splitPages = splitPages;
  }

  async load() {
    const buffer = await fs.readFile(this.filePath);
    const { getDocument, version } = await this.getPdfJS();

    const pdf = await getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    const meta = await pdf.getMetadata().catch(() => null);
    const documents = [];

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = this.textFromItems(content.items);
      const quality = assessPageText(text);
      documents.push({
        pageContent: text.trim(),
        metadata: {
          source: this.filePath,
          pdf: {
            version,
            info: meta?.info,
            metadata: meta?.metadata,
            totalPages: pdf.numPages,
          },
          loc: { pageNumber: i },
          extraction: {
            method: "native",
            status: quality.needsOcr ? "needs_ocr" : "ok",
            quality,
          },
        },
      });
    }

    if (this.splitPages) {
      return documents;
    }

    if (documents.length === 0) {
      return [];
    }

    return [
      {
        pageContent: documents.map((doc) => doc.pageContent).join("\n\n"),
        metadata: {
          source: this.filePath,
          pdf: {
            version,
            info: meta?.info,
            metadata: meta?.metadata,
            totalPages: pdf.numPages,
          },
        },
      },
    ];
  }

  textFromItems(items = []) {
    let previous = null;
    let text = "";

    for (const item of items) {
      if (!("str" in item) || !item.str) continue;
      const x = item.transform?.[4];
      const y = item.transform?.[5];
      const height = Math.abs(item.height || item.transform?.[3] || 0);

      if (previous) {
        const lineTolerance = Math.max(1, height * 0.25);
        const changedLine =
          Number.isFinite(y) &&
          Number.isFinite(previous.y) &&
          Math.abs(y - previous.y) > lineTolerance;
        if (changedLine || previous.hasEOL) {
          text += "\n";
        } else {
          const previousEnd = previous.x + previous.width;
          const gap = Number.isFinite(x) ? x - previousEnd : 0;
          const wordGap = Math.max(1, height * 0.12);
          if (gap > wordGap && !text.endsWith(" ") && !item.str.startsWith(" "))
            text += " ";
        }
      }

      text += item.str;
      previous = {
        x: Number.isFinite(x) ? x : 0,
        y,
        width: Number.isFinite(item.width) ? item.width : 0,
        hasEOL: item.hasEOL === true,
      };
    }

    return text;
  }

  async getPdfJS() {
    try {
      const pdfjs = await import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
      return { getDocument: pdfjs.getDocument, version: pdfjs.version };
    } catch (e) {
      console.error(e);
      throw new Error(
        "Failed to load pdf-parse. Please install it with eg. `npm install pdf-parse`."
      );
    }
  }
}

module.exports = PDFLoader;
