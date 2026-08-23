const OCRLoader = require("../../utils/OCRLoader");

describe("OCRLoader configuration", () => {
  test("defaults to German and English and validates page selection", () => {
    const loader = Object.create(OCRLoader.prototype);
    expect(loader.parseLanguages()).toEqual(["deu", "eng"]);
    expect(loader.parseLanguages("deu,eng,invalid")).toEqual(["deu", "eng"]);
    expect(loader.normalizePageNumbers([3, 1, 3], 3)).toEqual([1, 3]);
    expect(() => loader.normalizePageNumbers([0], 3)).toThrow("invalid");
  });
});
