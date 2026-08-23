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

  test("recognizes natural generic broker wording without using filler terms", () => {
    expect(
      ComparisonChunkIndex.isGenericComparison(
        "Was sind die Unterschiede in den beiden Versicherungen?"
      )
    ).toBe(true);
    expect(
      ComparisonChunkIndex.isGenericComparison(
        "Analysiere beide Verträge vollständig"
      )
    ).toBe(true);
    expect(
      ComparisonChunkIndex.isGenericComparison(
        "Vergleiche beide Policen und nenne Vor- und Nachteile"
      )
    ).toBe(true);
  });

  test("does not treat short query fragments as exact substring matches", () => {
    expect(
      ComparisonChunkIndex.exactTermMatches(
        "Die Versicherung leistet bei Feuer.",
        "in"
      )
    ).toBe(false);
    expect(
      ComparisonChunkIndex.exactTermMatches(
        "Vandalismus ist bis EUR 25.000 versichert.",
        "vandalismus"
      )
    ).toBe(true);
    expect(
      ComparisonChunkIndex.exactTermMatches(
        "Der Betrag ist vom Kunden selbst zu tragen.",
        "selbst zu tragen"
      )
    ).toBe(true);
  });
});
