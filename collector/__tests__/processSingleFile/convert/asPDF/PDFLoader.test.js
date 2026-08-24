const PDFLoader = require("../../../../processSingleFile/convert/asPDF/PDFLoader");

jest.mock("fs", () => ({
  promises: { readFile: jest.fn().mockResolvedValue(Buffer.from("pdf")) },
}));

function textItem(str, y = 100, x = 10, width = 80) {
  return {
    str,
    transform: [1, 0, 0, 10, x, y],
    width,
    height: 10,
    fontName: "Body",
  };
}

describe("PDFLoader", () => {
  test("returns one page record for every physical page including empty pages", async () => {
    const pages = [
      {
        getTextContent: jest.fn().mockResolvedValue({
          items: [textItem("A sufficiently long first policy page")],
        }),
      },
      { getTextContent: jest.fn().mockResolvedValue({ items: [] }) },
      {
        getTextContent: jest.fn().mockResolvedValue({
          items: [textItem("A sufficiently long third policy page")],
        }),
      },
    ];
    const loader = new PDFLoader("policy.pdf", { splitPages: true });
    jest.spyOn(loader, "getPdfJS").mockResolvedValue({
      version: "test",
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 3,
          getMetadata: jest.fn().mockResolvedValue(null),
          getPage: jest.fn((pageNumber) => pages[pageNumber - 1]),
        }),
      }),
    });

    const result = await loader.load();
    expect(result).toHaveLength(3);
    expect(result.map((page) => page.metadata.loc.pageNumber)).toEqual([
      1, 2, 3,
    ]);
    expect(result[1].pageContent).toBe("");
    expect(result[1].metadata.extraction.quality.needsOcr).toBe(true);
  });

  test("preserves native spans and offsets without claiming real bold metadata", () => {
    const loader = new PDFLoader("policy.pdf");
    const items = [
      { ...textItem("Variante C", 100, 10, 60), fontName: "Policy-Bold" },
      textItem("EUR 7.500", 100, 140, 55),
    ];
    const text = loader.textFromItems(items);
    const layout = loader.layoutFromItems(items, {
      "Policy-Bold": { fontFamily: "Policy Sans Bold" },
      Body: { fontFamily: "Policy Sans" },
    });
    expect(text).toBe("Variante C EUR 7.500");
    expect(layout).toEqual(
      expect.objectContaining({
        quality: "native_spans",
        spans: [
          expect.objectContaining({
            text: "Variante C",
            charStart: 0,
            charEnd: 10,
            x: 10,
            y: 100,
            boldHint: true,
          }),
          expect.objectContaining({
            text: "EUR 7.500",
            charStart: 11,
            charEnd: 20,
            x: 140,
            boldHint: false,
          }),
        ],
      })
    );
  });
});
