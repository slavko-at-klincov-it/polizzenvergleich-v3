const PDFLoader = require("../../../../processSingleFile/convert/asPDF/PDFLoader");

function textItem(str, y = 1) {
  return { str, transform: [1, 0, 0, 1, 0, y] };
}

describe("PDFLoader physical pages", () => {
  test("returns one record for every physical page including empty pages", async () => {
    const loader = new PDFLoader("/tmp/policy.pdf");
    loader.getPdfJS = jest.fn().mockResolvedValue({
      version: "test",
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 3,
          getMetadata: jest
            .fn()
            .mockResolvedValue({ info: {}, metadata: null }),
          getPage: jest.fn(async (pageNumber) => ({
            getTextContent: jest.fn().mockResolvedValue({
              items:
                pageNumber === 2 ? [] : [textItem(`Physical ${pageNumber}`)],
            }),
          })),
        }),
      }),
    });
    jest
      .spyOn(require("fs").promises, "readFile")
      .mockResolvedValue(Buffer.from("pdf"));

    const pages = await loader.load();

    expect(pages).toHaveLength(3);
    expect(pages.map((page) => page.metadata.loc.pageNumber)).toEqual([
      1, 2, 3,
    ]);
    expect(pages.map((page) => page.pageContent)).toEqual([
      "Physical 1",
      "",
      "Physical 3",
    ]);

    require("fs").promises.readFile.mockRestore();
  });
});
