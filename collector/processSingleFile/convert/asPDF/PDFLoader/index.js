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
      const layout = this.layoutFromItems(content.items, content.styles);
      const normalizedText = text.trim();
      const leadingTrim = text.length - text.trimStart().length;
      layout.spans = layout.spans
        .map((span) => ({
          ...span,
          charStart: span.charStart - leadingTrim,
          charEnd: span.charEnd - leadingTrim,
        }))
        .filter(
          (span) => span.charEnd > 0 && span.charStart < normalizedText.length
        )
        .map((span) => ({
          ...span,
          charStart: Math.max(0, span.charStart),
          charEnd: Math.min(normalizedText.length, span.charEnd),
        }));
      const quality = assessPageText(normalizedText);
      documents.push({
        pageContent: normalizedText,
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
            layout,
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

  layoutFromItems(items = [], styles = {}) {
    const spans = [];
    let previous = null;
    let textLength = 0;
    for (const [ordinal, item] of items.entries()) {
      if (!("str" in item) || !item.str) continue;
      const x = item.transform?.[4];
      const y = item.transform?.[5];
      const height = Math.abs(item.height || item.transform?.[3] || 0);
      if (previous) {
        const changedLine =
          Number.isFinite(y) &&
          Number.isFinite(previous.y) &&
          Math.abs(y - previous.y) > Math.max(1, height * 0.25);
        if (changedLine || previous.hasEOL) textLength += 1;
        else {
          const gap = Number.isFinite(x)
            ? x - (previous.x + previous.width)
            : 0;
          if (
            gap > Math.max(1, height * 0.12) &&
            !previous.endsWithSpace &&
            !item.str.startsWith(" ")
          )
            textLength += 1;
        }
      }
      const charStart = textLength;
      textLength += item.str.length;
      const fontName = item.fontName || null;
      const fontFamily = fontName
        ? styles?.[fontName]?.fontFamily || null
        : null;
      spans.push({
        ordinal,
        text: item.str,
        charStart,
        charEnd: textLength,
        x: Number.isFinite(item.transform?.[4]) ? item.transform[4] : null,
        y: Number.isFinite(item.transform?.[5]) ? item.transform[5] : null,
        width: Number.isFinite(item.width) ? item.width : null,
        height: Number.isFinite(item.height)
          ? Math.abs(item.height)
          : Number.isFinite(item.transform?.[3])
            ? Math.abs(item.transform[3])
            : null,
        fontName,
        fontFamily,
        boldHint: /(?:bold|semibold|demi|black|heavy)/iu.test(
          `${fontName || ""} ${fontFamily || ""}`
        ),
        hasEOL: item.hasEOL === true,
      });
      previous = {
        x: Number.isFinite(x) ? x : 0,
        y,
        width: Number.isFinite(item.width) ? item.width : 0,
        hasEOL: item.hasEOL === true,
        endsWithSpace: item.str.endsWith(" "),
      };
    }
    return {
      schemaVersion: 1,
      quality: spans.length ? "native_spans" : "text_only",
      spans,
    };
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
