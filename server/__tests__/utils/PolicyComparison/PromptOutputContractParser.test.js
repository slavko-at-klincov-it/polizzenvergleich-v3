const {
  PromptOutputContractParser,
} = require("../../../utils/PolicyComparison/PromptOutputContractParser");

const BROKER_PROMPT = `
Analysiere das beigefügte Dokument vollständig und erstelle eine strukturierte Aufstellung aller Deckungsinhalte.

GLIEDERUNG (in dieser Reihenfolge, keine Position auslassen)
1. Versicherte Sachen
   1.1 Gebäudebegriff – was zählt als Gebäude
   1.2 Versicherte Sachen innerhalb des Gebäudes
   1.3 Versicherte Sachen außerhalb des Gebäudes
   1.4 Was ist spartenübergreifend in allen Sparten mitversichert
2. Sparten – je Sparte ein eigener Abschnitt
3. Erweiterungen, Sonderklauseln und Zusatzbausteine

TABELLE JE ABSCHNITT — exakt diese Spalten
| Deckungsposition | Leistungsversprechen | Versicherungssumme / Sublimit |
Zeitliche Begrenzung | Selbstbehalt | Voraussetzungen und Einschränkungen |
Zusatzbaustein prämienpflichtig? | Quelle |

SPALTENREGELN
- Erfinde nichts.
- Keine Bewertung, keine Empfehlung.
- Keine Zusammenfassung am Ende. Nur die Tabellen.
`;

describe("PromptOutputContractParser", () => {
  test("preserves the broker's section and wrapped table-column order", () => {
    const contract = PromptOutputContractParser.parse({
      userPrompt: BROKER_PROMPT,
    });

    expect(contract.sections.map(({ key }) => key)).toEqual([
      "1",
      "1.1",
      "1.2",
      "1.3",
      "1.4",
      "2",
      "3",
    ]);
    expect(contract.columns.map(({ label }) => label)).toEqual([
      "Deckungsposition",
      "Leistungsversprechen",
      "Versicherungssumme / Sublimit",
      "Zeitliche Begrenzung",
      "Selbstbehalt",
      "Voraussetzungen und Einschränkungen",
      "Zusatzbaustein prämienpflichtig?",
      "Quelle",
    ]);
    expect(contract.columns.map(({ role }) => role)).toEqual([
      "label",
      "coverage",
      "limit",
      "duration",
      "deductible",
      "restriction",
      "premium",
      "source",
    ]);
    expect(contract.constraints).toMatchObject({
      noSummary: true,
      noEvaluation: true,
    });
  });

  test("keeps an unknown requested column without inventing a value", () => {
    const contract = PromptOutputContractParser.parse({
      userPrompt: "TABELLE\n| Deckungsposition | Interne Kategorie | Quelle |",
    });

    expect(contract.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Interne Kategorie",
          role: "unknown",
        }),
      ])
    );
  });

  test("uses the canonical table when no explicit table contract exists", () => {
    const contract = PromptOutputContractParser.parse({
      userPrompt: "Analysiere alle Deckungsinhalte vollständig.",
    });

    expect(contract.columns).toHaveLength(8);
    expect(contract.sections.map(({ key }) => key)).toEqual(["1", "2", "3"]);
  });

  test("distinguishes a full inventory request from a quantified topic question", () => {
    expect(
      PromptOutputContractParser.isCompleteAnalysisRequest(BROKER_PROMPT)
    ).toBe(true);
    expect(
      PromptOutputContractParser.isCompleteAnalysisRequest(
        "Ist Vandalismus vollständig gedeckt?"
      )
    ).toBe(false);
  });
});
