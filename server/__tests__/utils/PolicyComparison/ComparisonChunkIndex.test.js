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

  test("distinguishes concrete insurance topics from broad comparison wording", () => {
    expect(
      ComparisonChunkIndex.significantQueryTerms(
        "Vergleiche beide Policen vollständig"
      )
    ).toEqual([]);
    for (const broadQuery of [
      "Erstelle mir einen vollständigen Vergleich",
      "Mach eine komplette Gegenüberstellung",
      "Gib mir eine Übersicht",
      "Was ist alles versichert?",
      "Fasse den Versicherungsschutz zusammen",
      "Zeige sämtliche Unterschiede",
      "Schau dir beide genau an",
      "Was fällt dir bei den Unterlagen auf?",
      "Prüfe alles genau",
      "Vergleiche alle Klauseln",
      "Welche Unterschiede gibt es in den Versicherungsbedingungen?",
      "Fasse alle Regelungen zusammen",
      "Vergleiche bitte die wichtigsten Punkte der beiden Polizzen vollständig",
      "Stelle die beiden Policen gegenüber",
    ])
      expect(ComparisonChunkIndex.significantQueryTerms(broadQuery)).toEqual(
        []
      );
    expect(
      ComparisonChunkIndex.isExplicitBroadRequest(
        "Vergleiche bitte die wichtigsten Punkte der beiden Polizzen vollständig"
      )
    ).toBe(true);
    expect(
      ComparisonChunkIndex.isExplicitBroadRequest(
        "Welche Deckungen hat Vandalismus?"
      )
    ).toBe(false);
    expect(
      ComparisonChunkIndex.targetedQueryTerms(
        "Sind alle Vandalismusschäden versichert?"
      )
    ).toEqual(expect.arrayContaining(["vandalismusschäden", "vandalismus"]));
    expect(
      ComparisonChunkIndex.significantQueryTerms(
        "Welche Deckungen hat Vandalismus?"
      )
    ).toEqual(["vandalismus"]);
    expect(
      ComparisonChunkIndex.significantQueryTerms(
        "Wie hoch ist der Selbstbehalt?"
      )
    ).toEqual(["selbstbehalt"]);
    expect(
      ComparisonChunkIndex.targetedQueryTerms(
        "Welche Deckungen hat Vandalismus?"
      )
    ).toEqual(["vandalismus"]);
    expect(
      ComparisonChunkIndex.targetedQueryTerms("Wie hoch ist der Selbstbehalt?")
    ).toEqual(
      expect.arrayContaining(["selbstbehalt", "selbstbeteiligung", "franchise"])
    );
    expect(
      ComparisonChunkIndex.significantQueryTerms(
        "Ermittle alle Selbstbehalte im Dokument. Nenne jeweils Betrag, Bedingung und physische PDF-Seite."
      )
    ).toEqual(["selbstbehalte"]);
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

  test("removes output instructions from domain terms and qualifiers", () => {
    const limits =
      "Welche Deckungsgrenzen, Sublimits oder Höchstentschädigungen sind genannt? Nenne Betrag, Bedingung und physische PDF-Seite.";
    expect(
      ComparisonChunkIndex.qualifierTerms(limits, ["deckungsgrenze"])
    ).not.toEqual(
      expect.arrayContaining(["genannt", "betrag", "physische", "pdf", "seite"])
    );

    const vandalism =
      "Suche gezielt nach Vandalismus, mutwilliger oder böswilliger Beschädigung, Sachbeschädigung durch Dritte und Graffiti. Nenne nur belegte Fundstellen mit physischer PDF-Seite.";
    const terms = ComparisonChunkIndex.targetedQueryTerms(vandalism);
    expect(terms).toEqual(
      expect.arrayContaining([
        "vandalismus",
        "beschädigung",
        "sachbeschädigung",
        "graffiti",
      ])
    );
    expect(terms).not.toEqual(
      expect.arrayContaining([
        "suche",
        "gezielt",
        "nach",
        "durch",
        "belegte",
        "fundstellen",
        "physischer",
        "pdf",
        "seite",
      ])
    );
  });
});
