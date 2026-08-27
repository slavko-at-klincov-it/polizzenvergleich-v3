const {
  extractCategoryDefinitions,
  extractRequiredNotice,
  validateCategoryOutput,
} = require("../../../scripts/qa/categoryOutputContract.cjs");

const SYSTEM_PROMPT = `
| ID | Stufe | Kategorie-Name |
|---|---|---|
| \`EL-01\` | K | Erstes Thema |
| \`EL-02\` | S | Zweites Thema |

Schließe unmittelbar nach der Tabelle mit genau diesem Hinweis:

„Hinweis: Fachprüfung bleibt erforderlich.“
`;

const HEADER =
  "| Kategorie-ID | Stufe | Kategorie-Name | Belegter Vertragsinhalt | Deckung | Deckungssumme | Quelle | Prüfstatus |";
const SEPARATOR = "|---|---|---|---|---|---|---|---|";
const ROW_1 =
  "| EL-01 | K | Erstes Thema | Inhalt | Ja | EUR 1.000 | PDF-Seite 3: „Belegendes Zitat“ | BELEGT |";
const ROW_2 =
  "| EL-02 | S | Zweites Thema | keine belegte Fundstelle gefunden | Nicht feststellbar | Nicht feststellbar | keine belegte Fundstelle gefunden | UNGEKLÄRT |";
const NOTICE = "„Hinweis: Fachprüfung bleibt erforderlich.“";

function validate(answer) {
  return validateCategoryOutput({
    answer,
    categoryDefinitions: extractCategoryDefinitions(SYSTEM_PROMPT),
    requiredNotice: extractRequiredNotice(SYSTEM_PROMPT),
    sourceDocuments: [
      { pageNumber: 3, text: "Vorwort. Belegendes Zitat. Nachsatz." },
    ],
  });
}

describe("category output acceptance contract", () => {
  test("extracts the category catalog and required notice", () => {
    expect(extractCategoryDefinitions(SYSTEM_PROMPT)).toEqual([
      { id: "EL-01", stage: "K", label: "Erstes Thema" },
      { id: "EL-02", stage: "S", label: "Zweites Thema" },
    ]);
    expect(extractRequiredNotice(SYSTEM_PROMPT)).toBe(
      "Hinweis: Fachprüfung bleibt erforderlich."
    );
  });

  test("extracts the shipped fire catalog IDs with a lettered section", () => {
    const firePrompt = `
| ID | Stufe | Kategorie-Name |
|---|---|---|
| \`FE-A01\` | K | Brandbegriff |
| \`FE-F10\` | S | Leerstand |
`;

    expect(extractCategoryDefinitions(firePrompt)).toEqual([
      { id: "FE-A01", stage: "K", label: "Brandbegriff" },
      { id: "FE-F10", stage: "S", label: "Leerstand" },
    ]);
  });

  test("accepts an exact table and notice", () => {
    expect(
      validate([HEADER, SEPARATOR, ROW_1, ROW_2, NOTICE].join("\n"))
    ).toMatchObject({
      pass: true,
      rowCount: 2,
      observedIds: ["EL-01", "EL-02"],
    });
  });

  test("accepts Markdown data rows without an optional trailing pipe", () => {
    const answer = [
      HEADER,
      SEPARATOR,
      ROW_1.slice(0, -1).trimEnd(),
      ROW_2.slice(0, -1).trimEnd(),
      NOTICE,
    ].join("\n");

    expect(validate(answer).pass).toBe(true);
  });

  test.each([
    [
      "intro",
      ["Hier ist die Tabelle:", HEADER, SEPARATOR, ROW_1, ROW_2, NOTICE],
    ],
    ["missing id", [HEADER, SEPARATOR, ROW_1, NOTICE]],
    ["wrong order", [HEADER, SEPARATOR, ROW_2, ROW_1, NOTICE]],
    [
      "wrong columns",
      [HEADER, SEPARATOR, ROW_1.replace(" | BELEGT |", " |"), ROW_2, NOTICE],
    ],
    ["missing notice", [HEADER, SEPARATOR, ROW_1, ROW_2]],
  ])("rejects %s", (_label, lines) => {
    expect(validate(lines.join("\n")).pass).toBe(false);
  });

  test("rejects invalid status coverage and malformed evidence cells", () => {
    const invalidEvidence = ROW_2.replace(
      "keine belegte Fundstelle gefunden | Nicht feststellbar | Nicht feststellbar | keine belegte Fundstelle gefunden | UNGEKLÄRT",
      "Vielleicht enthalten | Ja | 5 % | Seite 2 | UNGEKLÄRT"
    );
    const result = validate(
      [HEADER, SEPARATOR, ROW_1, invalidEvidence, NOTICE].join("\n")
    );

    expect(result.pass).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "INVALID_STATUS_COVERAGE:EL-02",
        "INVALID_MISSING_CONTENT:EL-02",
        "INVALID_MISSING_AMOUNT:EL-02",
        "INVALID_MISSING_SOURCE:EL-02",
      ])
    );
  });

  test("rejects a quote that is absent from the claimed physical page", () => {
    const wrongQuote = ROW_1.replace("Belegendes Zitat", "Erfundenes Zitat");
    const result = validate(
      [HEADER, SEPARATOR, wrongQuote, ROW_2, NOTICE].join("\n")
    );

    expect(result.reasons).toContain("QUOTE_NOT_FOUND_ON_PAGE:EL-01:3");
  });

  test("still audits a source when the model omits only the final status cell", () => {
    const sevenColumnRow = ROW_1.replace(
      "PDF-Seite 3: „Belegendes Zitat“ | BELEGT |",
      "PDF-Seite 3: „Erfundenes Zitat“ |"
    );
    const result = validate(
      [HEADER, SEPARATOR, sevenColumnRow, ROW_2, NOTICE].join("\n")
    );

    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "INVALID_COLUMN_COUNT",
        "QUOTE_NOT_FOUND_ON_PAGE:EL-01:3",
      ])
    );
  });
});
