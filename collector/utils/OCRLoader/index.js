const fs = require("fs");
const os = require("os");
const path = require("path");
const PDFPageRenderer = require("../../processSingleFile/convert/asPDF/PDFPageRenderer");
const { VALID_LANGUAGE_CODES } = require("./validLangs");

class OCRLoader {
  language;
  cacheDir;

  constructor({ targetLanguages = "deu,eng" } = {}) {
    this.language = this.parseLanguages(targetLanguages);
    this.cacheDir = path.resolve(
      process.env.STORAGE_DIR
        ? path.resolve(process.env.STORAGE_DIR, "models", "tesseract")
        : path.resolve(__dirname, "../../../server/storage/models/tesseract")
    );
    if (!fs.existsSync(this.cacheDir))
      fs.mkdirSync(this.cacheDir, { recursive: true });
    this.log(
      "OCRLoader initialized with language support for:",
      this.language.map((lang) => VALID_LANGUAGE_CODES[lang]).join(", ")
    );
  }

  parseLanguages(language = null) {
    try {
      if (!language || typeof language !== "string") return ["deu", "eng"];
      const langList = language
        .split(",")
        .map((lang) => (lang.trim() !== "" ? lang.trim() : null))
        .filter(Boolean)
        .filter((lang) => VALID_LANGUAGE_CODES.hasOwnProperty(lang));
      if (langList.length === 0) return ["deu", "eng"];
      return langList;
    } catch (error) {
      this.log(`Error parsing languages: ${error.message}`, error.stack);
      return ["deu", "eng"];
    }
  }

  log(text, ...args) {
    console.log(`\x1b[36m[OCRLoader]\x1b[0m ${text}`, ...args);
  }

  /**
   * OCRs only the requested pages and always returns one terminal result for
   * every requested page. Page failures are data, not silently dropped rows.
   *
   * @returns {Promise<Array<object>>}
   */
  async ocrPDF(
    filePath,
    {
      maxExecutionTime = 900_000,
      batchSize = 10,
      maxWorkers = 2,
      pageNumbers = null,
      renderer = null,
    } = {}
  ) {
    if (
      !filePath ||
      !fs.existsSync(filePath) ||
      !fs.statSync(filePath).isFile()
    ) {
      this.log(`File ${filePath} does not exist. Skipping OCR.`);
      return [];
    }

    const documentTitle = path.basename(filePath);
    this.log(`Starting OCR of ${documentTitle}`);
    const pdfjs = await import("pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js");
    const buffer = fs.readFileSync(filePath);
    const pdfDocument = await pdfjs.getDocument({ data: buffer });
    const totalPages = pdfDocument.numPages;
    const requestedPages = this.normalizePageNumbers(pageNumbers, totalPages);
    const meta = await pdfDocument.getMetadata().catch(() => null);
    const metadata = {
      source: filePath,
      pdf: {
        version: "v2.0.550",
        info: meta?.info,
        metadata: meta?.metadata,
        totalPages,
      },
    };
    const pageRenderer = renderer || new PDFPageRenderer();
    const workerCount = Math.max(
      1,
      Math.min(Number(maxWorkers) || 2, os.cpus().length, requestedPages.length)
    );
    const workerPool = [];
    const documents = [];
    const startTime = Date.now();

    try {
      const { createWorker, OEM } = require("tesseract.js");
      for (let index = 0; index < workerCount; index += 1) {
        workerPool.push(
          await createWorker(this.language, OEM.LSTM_ONLY, {
            cachePath: this.cacheDir,
          })
        );
      }
      this.log("Bootstrapping OCR completed successfully!", {
        MAX_EXECUTION_TIME_MS: maxExecutionTime,
        BATCH_SIZE: batchSize,
        MAX_CONCURRENT_WORKERS: workerCount,
        TOTAL_PAGES: totalPages,
        REQUESTED_PAGES: requestedPages.length,
      });

      for (
        let offset = 0;
        offset < requestedPages.length;
        offset += batchSize
      ) {
        const batch = requestedPages.slice(offset, offset + batchSize);
        const pageQueue = [...batch];
        const results = [];
        await Promise.all(
          workerPool.map(async (worker, workerIndex) => {
            while (pageQueue.length > 0) {
              const pageNumber = pageQueue.shift();
              const remainingTime = maxExecutionTime - (Date.now() - startTime);
              if (remainingTime <= 0) {
                results.push(
                  this.failedPageResult(
                    pageNumber,
                    metadata,
                    "OCR job exceeded its execution time."
                  )
                );
                continue;
              }

              this.log(
                `\x1b[34m[Worker ${
                  workerIndex + 1
                }]\x1b[0m assigned pg${pageNumber}`
              );
              try {
                const page = await pdfDocument.getPage(pageNumber);
                const imageBuffer = await pageRenderer.renderPage(page);
                const { data } = await this.withTimeout(
                  worker.recognize(imageBuffer, {}, "text"),
                  remainingTime,
                  `OCR timed out on page ${pageNumber}.`
                );
                const pageContent = String(data?.text || "").trim();
                results.push({
                  pageContent,
                  status: pageContent ? "ok" : "empty",
                  confidence:
                    typeof data?.confidence === "number"
                      ? data.confidence
                      : null,
                  metadata: {
                    ...metadata,
                    loc: { pageNumber },
                    extraction: { method: "ocr" },
                  },
                });
              } catch (error) {
                results.push(
                  this.failedPageResult(pageNumber, metadata, error.message)
                );
              }
            }
          })
        );
        documents.push(
          ...results.sort(
            (left, right) =>
              left.metadata.loc.pageNumber - right.metadata.loc.pageNumber
          )
        );
      }
    } catch (error) {
      this.log(`Error: ${error.message}`, error.stack);
      const completedPages = new Set(
        documents.map((document) => document.metadata.loc.pageNumber)
      );
      for (const pageNumber of requestedPages) {
        if (completedPages.has(pageNumber)) continue;
        documents.push(
          this.failedPageResult(pageNumber, metadata, error.message)
        );
      }
    } finally {
      await Promise.all(
        workerPool.map((worker) => worker.terminate().catch(() => null))
      );
      await pdfDocument.destroy().catch(() => null);
    }

    documents.sort(
      (left, right) =>
        left.metadata.loc.pageNumber - right.metadata.loc.pageNumber
    );
    this.log(`Completed OCR of ${documentTitle}!`, {
      documentsParsed: documents.length,
      requestedPages: requestedPages.length,
      executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
    });
    return documents;
  }

  normalizePageNumbers(pageNumbers, totalPages) {
    const candidates = Array.isArray(pageNumbers)
      ? pageNumbers
      : Array.from({ length: totalPages }, (_, index) => index + 1);
    const normalized = [...new Set(candidates.map(Number))].sort(
      (left, right) => left - right
    );
    if (
      normalized.length === 0 ||
      normalized.some(
        (pageNumber) =>
          !Number.isInteger(pageNumber) ||
          pageNumber < 1 ||
          pageNumber > totalPages
      )
    )
      throw new Error("OCR page selection contains an invalid page number.");
    return normalized;
  }

  failedPageResult(pageNumber, metadata, error) {
    return {
      pageContent: "",
      status: "failed",
      confidence: null,
      error,
      metadata: {
        ...metadata,
        loc: { pageNumber },
        extraction: { method: "ocr" },
      },
    };
  }

  withTimeout(promise, timeout, message) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeout);
    });
    return Promise.race([promise, timeoutPromise]).finally(() =>
      clearTimeout(timeoutId)
    );
  }

  async ocrImage(filePath, { maxExecutionTime = 300_000 } = {}) {
    let worker = null;
    if (
      !filePath ||
      !fs.existsSync(filePath) ||
      !fs.statSync(filePath).isFile()
    ) {
      this.log(`File ${filePath} does not exist. Skipping OCR.`);
      return null;
    }

    const documentTitle = path.basename(filePath);
    try {
      this.log(`Starting OCR of ${documentTitle}`);
      const startTime = Date.now();
      const { createWorker, OEM } = require("tesseract.js");
      worker = await createWorker(this.language, OEM.LSTM_ONLY, {
        cachePath: this.cacheDir,
      });
      const { data } = await this.withTimeout(
        worker.recognize(filePath, {}, "text"),
        maxExecutionTime,
        `OCR job took too long to complete (${maxExecutionTime / 1000} seconds)`
      );
      this.log(`Completed OCR of ${documentTitle}!`, {
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      });
      return data.text;
    } catch (error) {
      this.log(`Error: ${error.message}`);
      return null;
    } finally {
      if (worker) await worker.terminate().catch(() => null);
    }
  }
}

module.exports = OCRLoader;
