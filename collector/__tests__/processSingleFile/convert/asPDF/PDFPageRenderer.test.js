const PDFPageRenderer = require("../../../../processSingleFile/convert/asPDF/PDFPageRenderer");

describe("PDFPageRenderer", () => {
  test("renders the full composited page through the PDF.js render task", async () => {
    const canvasContext = {
      save: jest.fn(),
      restore: jest.fn(),
      fillRect: jest.fn(),
      fillStyle: null,
    };
    const canvas = {
      getContext: jest.fn().mockReturnValue(canvasContext),
      toBuffer: jest.fn().mockReturnValue(Buffer.from("png")),
    };
    const createCanvasFn = jest.fn().mockReturnValue(canvas);
    const page = {
      getViewport: jest.fn().mockReturnValue({ width: 100, height: 200 }),
      render: jest.fn().mockReturnValue({ promise: Promise.resolve() }),
    };
    const renderer = new PDFPageRenderer({ createCanvasFn });

    const result = await renderer.renderPage(page);
    expect(createCanvasFn).toHaveBeenCalledWith(100, 200);
    expect(page.render).toHaveBeenCalledWith(
      expect.objectContaining({ canvasContext, intent: "print" })
    );
    expect(result.equals(Buffer.from("png"))).toBe(true);
  });

  test("reduces render scale when the page exceeds its pixel budget", async () => {
    const canvas = {
      getContext: () => ({
        save: jest.fn(),
        restore: jest.fn(),
        fillRect: jest.fn(),
      }),
      toBuffer: () => Buffer.from("png"),
    };
    const page = {
      getViewport: jest.fn().mockImplementation(({ scale }) => ({
        width: 1000 * scale,
        height: 1000 * scale,
      })),
      render: () => ({ promise: Promise.resolve() }),
    };
    const renderer = new PDFPageRenderer({
      scale: 2,
      maxPixels: 1_000_000,
      createCanvasFn: () => canvas,
    });
    await renderer.renderPage(page);
    expect(page.getViewport).toHaveBeenCalledTimes(2);
    expect(page.getViewport.mock.calls[1][0].scale).toBeCloseTo(1);
  });
});
