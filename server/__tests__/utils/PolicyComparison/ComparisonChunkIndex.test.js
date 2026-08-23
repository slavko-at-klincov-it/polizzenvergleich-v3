const {
  ComparisonChunkIndex,
} = require("../../../utils/PolicyComparison/ComparisonChunkIndex");

describe("ComparisonChunkIndex query preparation", () => {
  test("normalizes soft hyphens, whitespace, and line-break hyphenation", () => {
    expect(
      ComparisonChunkIndex.normalize("Selbst-\nbehalt\u00ad   EUR 350")
    ).toBe("selbstbehalt eur 350");
  });

  test("expands German deductible synonyms", () => {
    const terms = ComparisonChunkIndex.queryTerms("Wo steht der Selbstbehalt?");
    expect(terms).toEqual(
      expect.arrayContaining([
        "selbstbehalt",
        "selbstbeteiligung",
        "franchise",
        "eigenanteil",
      ])
    );
  });

  test("uses insurance comparison terms for a generic comparison request", () => {
    const terms = ComparisonChunkIndex.queryTerms(
      "Vergleiche bitte die beiden Policen"
    );
    expect(terms).toEqual(
      expect.arrayContaining(["selbstbehalt", "deckungssumme", "ausschluss"])
    );
  });

  test("keeps a comparison about one concrete topic targeted", () => {
    expect(
      ComparisonChunkIndex.isGenericComparison(
        "Vergleiche den Selbstbehalt der beiden Policen"
      )
    ).toBe(false);
    expect(
      ComparisonChunkIndex.queryTerms(
        "Vergleiche den Selbstbehalt der beiden Policen"
      )
    ).toEqual(expect.arrayContaining(["selbstbehalt", "franchise"]));
  });
});
