class PDFPageRenderer {
  constructor({
    scale = 2,
    maxPixels = 20_000_000,
    createCanvasFn = null,
  } = {}) {
    this.scale = scale;
    this.maxPixels = maxPixels;
    this.createCanvasFn = createCanvasFn;
  }

  async getCreateCanvas() {
    if (this.createCanvasFn) return this.createCanvasFn;
    const { createCanvas } = require("@napi-rs/canvas");
    return createCanvas;
  }

  /**
   * Renders the complete composited PDF page, not merely the first image object.
   * The pixel cap prevents a malformed or oversized page from exhausting RAM.
   *
   * @param {object} page PDF.js page proxy
   * @returns {Promise<Buffer>}
   */
  async renderPage(page) {
    if (!page || typeof page.getViewport !== "function")
      throw new Error("Cannot render an invalid PDF page.");

    let viewport = page.getViewport({ scale: this.scale });
    const initialPixels =
      Math.ceil(viewport.width) * Math.ceil(viewport.height);
    if (initialPixels > this.maxPixels) {
      const reduction = Math.sqrt(this.maxPixels / initialPixels);
      viewport = page.getViewport({ scale: this.scale * reduction });
    }

    const width = Math.max(1, Math.ceil(viewport.width));
    const height = Math.max(1, Math.ceil(viewport.height));
    const createCanvas = await this.getCreateCanvas();
    const canvas = createCanvas(width, height);
    const canvasContext = canvas.getContext("2d");
    canvasContext.save();
    canvasContext.fillStyle = "#ffffff";
    canvasContext.fillRect(0, 0, width, height);
    canvasContext.restore();

    const renderTask = page.render({
      canvasContext,
      viewport,
      intent: "print",
    });
    await (renderTask?.promise || renderTask);
    return canvas.toBuffer("image/png");
  }
}

module.exports = PDFPageRenderer;
