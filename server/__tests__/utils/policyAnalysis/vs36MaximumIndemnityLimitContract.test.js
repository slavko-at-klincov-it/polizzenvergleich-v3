const {
  VS36_SYMBOLIC_LIMIT_CONTRACT_ID,
  vs36MaximumIndemnityLimitForOccurrence,
  vs36SymbolicLimitForOccurrence,
} = require("../../../utils/policyAnalysis/vs36MaximumIndemnityLimitContract");

function occurrence(text, exactText = text, unitType = "PARAGRAPH") {
  const contextStart = 500;
  const relativeStart = text.indexOf(exactText);
  return {
    candidateId: "candidate:vs36",
    exactText,
    documentStart: contextStart + relativeStart,
    documentEnd: contextStart + relativeStart + exactText.length,
    context: {
      unitType,
      text,
      documentStart: contextStart,
      documentEnd: contextStart + text.length,
    },
  };
}

describe("VS-36 symbolic maximum-indemnity limit contract", () => {
  test.each([
    [
      "POSITION_INSURANCE_SUM_INDEX_ADJUSTED",
      "Abweichend von den ABS bildet die in der Polizze ausgewiesene Versicherungssumme der vom Schaden betroffenen Position, unter Berücksichtigung der prozentuellen Indexveränderung bis zum Schadenzeitpunkt, die Grenze der Ersatzleistung.",
      "je betroffene Position",
    ],
    [
      "POLICY_OR_MAXIMUM_LIABILITY_SUM",
      "Die Ersatzleistung ist jedenfalls mit der Versicherungssumme bzw. mit der Höchsthaftungssumme oder dergleichen begrenzt.",
      "allgemeine Ersatzleistungsgrenze",
    ],
    [
      "POSITION_INSURANCE_SUM",
      "Die Versicherungssumme bildet die Grenze für die Entschädigung des Versicherers, wobei die Entschädigung für die unter jeder einzelnen Position der Polizze versicherten Sachen durch die für die betreffende Position angegebene Versicherungssumme begrenzt ist.",
      "je Position",
    ],
    [
      "EVENT_POLICY_SUM_MAXIMIZED_WITH_INSURED_VALUE",
      "Die Entschädigungsleistung ist pro Schadenereignis mit der in der Polizze vereinbarten Versicherungssumme, maximiert mit dem Versicherungswert, begrenzt.",
      "pro Schadenereignis",
    ],
  ])("types %s without inventing a percentage", (type, text, qualifier) => {
    expect(vs36SymbolicLimitForOccurrence(occurrence(text))).toMatchObject({
      value: {
        valueType: "SYMBOLIC_LIMIT",
        symbolicLimitType: type,
        limitKind: "CAPPED",
        unit: "CONTRACTUAL_SUM",
        qualifier,
        semanticContractId: VS36_SYMBOLIC_LIMIT_CONTRACT_ID,
      },
    });
  });

  test("binds the numeric event limit to the building insurance sum", () => {
    const text =
      "Die Höchstentschädigung im Schadensfall beträgt inklusive aller Positionen maximal 150 % der vereinbarten Versicherungssumme für das Gebäude.";
    expect(
      vs36MaximumIndemnityLimitForOccurrence(occurrence(text))
    ).toMatchObject({
      match: expect.objectContaining({ 0: "150 %" }),
      value: {
        normalizedValue: "150 %",
        valueType: "PERCENT",
        unit: "%",
        limitKind: "CAPPED",
        qualifier: "pro Schadenereignis",
        eventScope: "PER_LOSS_EVENT",
        comparisonBasis: "BUILDING_INSURANCE_SUM",
        comparisonBasisEvidence: {
          exactText: "Versicherungssumme für das Gebäude",
        },
        limitSemanticType: "PERCENT_OF_BUILDING_INSURANCE_SUM",
        semanticContractId: VS36_SYMBOLIC_LIMIT_CONTRACT_ID,
      },
    });
  });

  test("prefers the exact symbolic clause over a nearby unrelated percentage", () => {
    const exactText =
      "Die Ersatzleistung ist jedenfalls mit der Versicherungssumme bzw. mit der Höchsthaftungssumme oder dergleichen begrenzt.";
    const text = `Der Unterversicherungsverzicht gilt bei 25 % Abweichung. ${exactText} Selbstbehalt 10 %.`;
    expect(
      vs36MaximumIndemnityLimitForOccurrence(occurrence(text, exactText))
    ).toMatchObject({
      value: {
        valueType: "SYMBOLIC_LIMIT",
        symbolicLimitType: "POLICY_OR_MAXIMUM_LIABILITY_SUM",
      },
    });
  });

  test.each([
    "Die Jahreshöchstentschädigung beträgt maximal die zweifache Versicherungssumme.",
    "Die Versicherungssumme darf um höchstens 25 % vom Versicherungswert abweichen.",
    "Optische Schäden sind mit den Reparaturkosten, höchstens jedoch mit der Versicherungssumme, begrenzt.",
    "Die Versicherungssumme bildet nicht die Grenze für die Entschädigung des Versicherers.",
  ])("rejects non-equivalent or adversarial wording: %s", (text) => {
    expect(vs36SymbolicLimitForOccurrence(occurrence(text))).toBeNull();
  });

  test("requires exact source offsets and an allowed local context", () => {
    const text =
      "Die Versicherungssumme bildet die Grenze für die Entschädigung des Versicherers, wobei die Entschädigung für die unter jeder einzelnen Position der Polizze versicherten Sachen durch die für die betreffende Position angegebene Versicherungssumme begrenzt ist.";
    const drifted = occurrence(text);
    drifted.documentEnd -= 1;
    expect(vs36SymbolicLimitForOccurrence(drifted)).toBeNull();
    expect(
      vs36SymbolicLimitForOccurrence(occurrence(text, text, "CLAUSE_SECTION"))
    ).toBeNull();
  });
});
