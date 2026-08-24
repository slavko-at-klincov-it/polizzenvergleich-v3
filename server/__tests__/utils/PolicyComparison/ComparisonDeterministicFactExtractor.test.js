const {
  ComparisonFactRiskSignals,
} = require("../../../utils/PolicyComparison/ComparisonFactRiskSignals");
const {
  ComparisonDeterministicFactExtractor,
} = require("../../../utils/PolicyComparison/ComparisonDeterministicFactExtractor");

function block(text, overrides = {}) {
  return {
    blockKey: "block-1",
    pageNumber: 4,
    sourceStart: 100,
    sourceEnd: 100 + text.length,
    text,
    structureKind: "paragraph",
    headingPath: ["Erweiterter Vandalismus"],
    layoutQuality: "native_spans",
    ...overrides,
  };
}

describe("deterministic policy facts", () => {
  test("stores positioned signals and separates Vandalismus roles", () => {
    const text =
      "Vandalismusschäden sind versichert. Höchstentschädigung 1 %, maximal EUR 10.000 auf Erstes Risiko. Selbstbehalt EUR 500. Graffiti ist ausgeschlossen.";
    const source = block(text);
    const signals = ComparisonFactRiskSignals.detect(text, {
      sourceStart: 100,
    });
    const result = ComparisonDeterministicFactExtractor.extract(
      source,
      signals
    );

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "percentage", evidenceText: "1 %" }),
        expect.objectContaining({ kind: "money", evidenceText: "EUR 10.000" }),
        expect.objectContaining({ kind: "deductible" }),
        expect.objectContaining({
          kind: "exclusion",
          evidenceText: "ausgeschlossen",
        }),
      ])
    );
    expect(result.facts.map((fact) => fact.factType)).toEqual(
      expect.arrayContaining(["coverage", "limit", "deductible", "exclusion"])
    );
    expect(new Set(result.facts.map((fact) => fact.factKey)).size).toBe(
      result.facts.length
    );
  });

  test("routes a rare unknown content block without known signals to model review", () => {
    const source = block(
      "Mikrobiologische Dekontamination der tragenden Bauteile nach einem atypischen Ereignis.",
      { headingPath: ["Sondervereinbarung XZ-17"] }
    );
    const result = ComparisonDeterministicFactExtractor.extract(source, []);
    expect(result).toEqual(
      expect.objectContaining({
        facts: [],
        terminalStatus: "ambiguous_pending",
        requiresReview: true,
        ambiguityReasons: expect.arrayContaining([
          "unclassified_contract_content",
        ]),
      })
    );
  });

  test("does not hide a rare clause beside a deterministically recognized fact", () => {
    const source = block(
      "Selbstbehalt EUR 350. Mikrobiologische Dekontamination tragender Bauteile nach XZ-17."
    );
    const result = ComparisonDeterministicFactExtractor.extract(
      source,
      ComparisonFactRiskSignals.detect(source.text, { sourceStart: 100 })
    );
    expect(result.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factType: "deductible" }),
      ])
    );
    expect(result.requiresReview).toBe(true);
    expect(result.ambiguityReasons).toContain(
      "partially_unclassified_contract_content"
    );
  });

  test("only a provable page marker terminates without facts or model review", () => {
    const result = ComparisonDeterministicFactExtractor.extract(
      block("Seite 4 von 21", { structureKind: "paragraph" }),
      []
    );
    expect(result).toEqual(
      expect.objectContaining({
        facts: [],
        terminalStatus: "technical_non_content",
        reasonCode: "technical_page_marker",
        requiresReview: false,
      })
    );
  });

  test("does not guess table value ownership from text-only layout", () => {
    const text = "Variante C  EUR 7.500  Variante D  EUR 10.000";
    const source = block(text, {
      structureKind: "table_row",
      layoutQuality: "text_only",
      headingPath: ["Leitungswasser"],
    });
    const result = ComparisonDeterministicFactExtractor.extract(
      source,
      ComparisonFactRiskSignals.detect(text, { sourceStart: 100 })
    );
    expect(result.requiresReview).toBe(true);
    expect(result.ambiguityReasons).toContain(
      "layout_dependent_value_assignment"
    );
  });

  test("keeps the anonymized Vandalismus gold roles separate without inventing a page", () => {
    const text = [
      "Böswillige Beschädigung bestimmter Gebäudeteile ist versichert.",
      "Die Höchstentschädigung beträgt 1 % der Gebäudesumme, maximal EUR 10.000 auf Erstes Risiko.",
      "Der Selbstbehalt beträgt EUR 500 je Schadenfall.",
      "Nur ohne versuchten Einbruch oder Raub; Graffiti ist ausgeschlossen.",
      "Der Schaden ist unverzüglich polizeilich anzuzeigen.",
    ].join("\n");
    const source = block(text, {
      pageNumber: null,
      headingPath: ["Erweiterte Sachbeschädigung"],
    });
    const result = ComparisonDeterministicFactExtractor.extract(
      source,
      ComparisonFactRiskSignals.detect(text, { sourceStart: 100 })
    );
    const factsByType = (factType) =>
      result.facts.filter((fact) => fact.factType === factType);

    expect(factsByType("coverage")).not.toHaveLength(0);
    expect(factsByType("limit")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pageNumber: null,
          value: expect.objectContaining({ kind: "percentage", percent: 1 }),
        }),
        expect.objectContaining({
          pageNumber: null,
          value: expect.objectContaining({
            kind: "money",
            amount: 10000,
            currency: "EUR",
          }),
        }),
      ])
    );
    expect(factsByType("deductible")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: expect.objectContaining({
            kind: "money",
            amount: 500,
            currency: "EUR",
          }),
        }),
      ])
    );
    expect(factsByType("condition")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pageNumber: null,
          evidenceText: "Nur ohne versuchten Einbruch oder Raub;",
        }),
      ])
    );
    expect(factsByType("exclusion")).not.toHaveLength(0);
    expect(factsByType("obligation")).not.toHaveLength(0);
    expect(new Set(result.facts.map((fact) => fact.factKey)).size).toBe(
      result.facts.length
    );
  });

  test("keeps the anonymized A/B Vandalismus oracle asymmetric", () => {
    const aText =
      "Gebäudebestandteile sind versichert, wenn sie im Zuge eines Einbruchdiebstahls zerstört oder beschädigt werden.";
    const documentA = block(aText, {
      blockKey: "a-einbruch",
      pageNumber: 12,
      headingPath: ["Einbruchdiebstahl"],
    });
    const aResult = ComparisonDeterministicFactExtractor.extract(
      documentA,
      ComparisonFactRiskSignals.detect(aText, { sourceStart: 100 })
    );

    expect(
      aResult.facts.some((fact) =>
        /vandalismus|graffiti/iu.test(`${fact.label} ${fact.evidenceText}`)
      )
    ).toBe(false);
    expect(aResult.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pageNumber: 12, factType: "coverage" }),
      ])
    );
  });
});
