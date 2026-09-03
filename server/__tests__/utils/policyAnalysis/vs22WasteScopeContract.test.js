const {
  isVs22LiabilityOrStorageOccurrence,
  localOccurrenceSentence,
} = require("../../../utils/policyAnalysis/vs22WasteScopeContract");

function occurrenceFor(text, exactText, overrides = {}) {
  const documentStart = text.indexOf(exactText);
  return {
    exactText,
    documentStart,
    documentEnd: documentStart + exactText.length,
    context: {
      text,
      documentStart: 0,
      documentEnd: text.length,
    },
    ...overrides,
  };
}

describe("VS-22 waste scope contract", () => {
  test("binds the DOC-07-like storage carveback to the occurrence sentence", () => {
    const text =
      "Kein Versicherungsschutz besteht für die Endlagerung von Abfällen jeder Art. Nicht unter diesem Ausschluss fallen die kurzfristige Zwischenlagerung von gefährlichen Abfall- und Problemstoffen.";
    const occurrence = occurrenceFor(text, "gefährlichen Abfall");

    expect(localOccurrenceSentence(occurrence)).toContain(
      "Nicht unter diesem Ausschluss"
    );
    expect(isVs22LiabilityOrStorageOccurrence(occurrence)).toBe(true);
  });

  test.each(["Umwelthaftpflicht", "AHVB", "Schadenersatzverpflichtungen"])(
    "rejects a local explicit liability marker: %s",
    (marker) => {
      const text = `${marker} umfasst die Zwischenlagerung gefährlicher Abfälle.`;
      expect(
        isVs22LiabilityOrStorageOccurrence(
          occurrenceFor(text, "gefährlicher Abfälle")
        )
      ).toBe(true);
    }
  );

  test("rejects a structurally identified liability section", () => {
    const text = "Zwischenlagerung gefährlicher Abfälle ist mitversichert.";
    expect(
      isVs22LiabilityOrStorageOccurrence(
        occurrenceFor(text, "gefährlicher Abfälle", {
          sectionScopeHint: { scopeKey: "HAFTPFLICHT_INSURANCE" },
        })
      )
    ).toBe(true);
  });

  test("preserves a later property-cost sentence after a liability sentence", () => {
    const text =
      "Schadenersatzverpflichtungen sind ausgeschlossen. Mitversichert sind jedoch Behandlungskosten für gefährliche Abfälle bis 10 %.";
    const occurrence = occurrenceFor(text, "gefährliche Abfälle", {
      sectionScopeHint: { scopeKey: "GENERAL_CONTRACT_TERMS" },
    });

    expect(localOccurrenceSentence(occurrence)).toBe(
      " Mitversichert sind jedoch Behandlungskosten für gefährliche Abfälle bis 10 %."
    );
    expect(isVs22LiabilityOrStorageOccurrence(occurrence)).toBe(false);
  });

  test("does not scan a broad context when exact offsets are unavailable", () => {
    const occurrence = {
      exactText: "gefährliche Abfälle",
      context: {
        text: "Umwelthaftpflicht. Mitversichert sind gefährliche Abfälle.",
      },
    };

    expect(localOccurrenceSentence(occurrence)).toBe("gefährliche Abfälle");
    expect(isVs22LiabilityOrStorageOccurrence(occurrence)).toBe(false);
  });

  test("does not treat a property-policy reference to the building owner as liability scope", () => {
    const text =
      "Mehrkosten, die dem Versicherungsnehmer als Bauherr für die Behandlung gefährlicher Abfälle entstehen, sind mitversichert.";

    expect(
      isVs22LiabilityOrStorageOccurrence(
        occurrenceFor(text, "gefährlicher Abfälle")
      )
    ).toBe(false);
  });
});
