const PDFLoader = require("../../../../processSingleFile/convert/asPDF/PDFLoader");

jest.mock("fs", () => ({
  promises: { readFile: jest.fn().mockResolvedValue(Buffer.from("pdf")) },
}));

function textItem(str, y = 100, x = 10, width = 80) {
  return { str, transform: [1, 0, 0, 10, x, y], width, height: 10 };
}

describe("PDFLoader", () => {
  test("returns one page record for every physical page including empty pages", async () => {
    const pages = [
      {
        getTextContent: jest
          .fn()
          .mockResolvedValue({
            items: [textItem("A sufficiently long first policy page")],
          }),
      },
      { getTextContent: jest.fn().mockResolvedValue({ items: [] }) },
      {
        getTextContent: jest
          .fn()
          .mockResolvedValue({
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
});
