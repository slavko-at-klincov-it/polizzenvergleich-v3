const {
  ComparisonAnalysisUnitBuilder,
} = require("../../../utils/PolicyComparison/ComparisonAnalysisUnitBuilder");

function documentData(pageTexts) {
  let pageContent = "";
  const pages = pageTexts.map((text, index) => {
    const start = pageContent.length;
    pageContent += text;
    return {
      pageNumber: index + 1,
      start,
      end: pageContent.length,
      method: "native",
      status: "ok",
    };
  });
  return {
    pageContent,
    pdfExtraction: {
      complete: true,
      sourceSha256: "a".repeat(64),
      totalPages: pages.length,
      pages,
    },
  };
}

describe("ComparisonAnalysisUnitBuilder", () => {
  test("covers every character of 21 physical pages without gaps or overlaps", () => {
    const pages = Array.from(
      { length: 21 },
      (_, index) =>
        `Gedruckte Seite ${(index % 7) + 1} von 7\n${"Deckung, Limit EUR 10.000 und Bedingung. ".repeat(120)}`
    );
    const first = ComparisonAnalysisUnitBuilder.build({
      documentData: documentData(pages),
      characterLimit: 1_200,
    });
    const second = ComparisonAnalysisUnitBuilder.build({
      documentData: documentData(pages),
      characterLimit: 1_200,
    });

    expect(first.pageCount).toBe(21);
    expect(first.units.map((unit) => unit.unitKey)).toEqual(
      second.units.map((unit) => unit.unitKey)
    );
    for (let pageNumber = 1; pageNumber <= 21; pageNumber++) {
      const units = first.units.filter(
        (unit) => unit.pageNumber === pageNumber
      );
      expect(units.map((unit) => unit.text).join("")).toBe(
        pages[pageNumber - 1]
      );
      expect(units[0].pageStart).toBe(0);
      expect(units.at(-1).pageEnd).toBe(pages[pageNumber - 1].length);
      for (const [index, unit] of units.entries()) {
        expect(unit.contextBefore).toBe(
          index === 0 ? "" : units[index - 1].text.slice(-240)
        );
        expect(unit.contextAfter).toBe(
          index === units.length - 1 ? "" : units[index + 1].text.slice(0, 240)
        );
      }
    }
  });

  test("never invents a page for a non-PDF document", () => {
    const result = ComparisonAnalysisUnitBuilder.build({
      documentData: {
        pageContent: "Versicherungssumme EUR 5.000",
        documentExtraction: {
          complete: true,
          sourceSha256: "b".repeat(64),
        },
      },
    });
    expect(result.units).toEqual([
      expect.objectContaining({ pageNumber: null, pageStart: 0 }),
    ]);
  });

  test("uses preserved native span geometry but keeps text-only tables ambiguous", () => {
    const text = "VARIANTE C\nLeistung  EUR 7.500";
    const data = documentData([text]);
    data.pdfExtraction.pages[0].layoutQuality = "native_spans";
    data.pdfExtraction.pages[0].layout = {
      quality: "native_spans",
      spans: [
        {
          text: "VARIANTE C",
          charStart: 0,
          charEnd: 10,
          x: 10,
          y: 100,
          width: 70,
          height: 14,
          boldHint: true,
        },
        {
          text: "Leistung",
          charStart: 11,
          charEnd: 19,
          x: 10,
          y: 80,
          width: 50,
          height: 10,
          boldHint: false,
        },
        {
          text: "EUR 7.500",
          charStart: 21,
          charEnd: 30,
          x: 160,
          y: 80,
          width: 55,
          height: 10,
          boldHint: false,
        },
      ],
    };
    const result = ComparisonAnalysisUnitBuilder.build({ documentData: data });
    expect(result.units).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          structureKind: "heading",
          layoutQuality: "native_spans",
        }),
        expect.objectContaining({
          structureKind: "table_row",
          headingPath: ["VARIANTE C"],
        }),
      ])
    );
  });

  test("uses a title-case bold layout line as a real block boundary", () => {
    const text =
      "Erweiterter Vandalismus\nVandalismusschäden sind versichert.\nGraffiti ist ausgeschlossen.";
    const data = documentData([text]);
    data.pdfExtraction.pages[0].layoutQuality = "native_spans";
    data.pdfExtraction.pages[0].layout = {
      quality: "native_spans",
      spans: [
        {
          text: "Erweiterter Vandalismus",
          charStart: 0,
          charEnd: 23,
          x: 10,
          y: 100,
          width: 160,
          height: 15,
          boldHint: true,
        },
        {
          text: "Vandalismusschäden sind versichert.",
          charStart: 24,
          charEnd: 61,
          x: 10,
          y: 80,
          width: 230,
          height: 10,
          boldHint: false,
        },
        {
          text: "Graffiti ist ausgeschlossen.",
          charStart: 62,
          charEnd: text.length,
          x: 10,
          y: 65,
          width: 180,
          height: 10,
          boldHint: false,
        },
      ],
    };

    const result = ComparisonAnalysisUnitBuilder.build({ documentData: data });

    expect(result.units[0]).toEqual(
      expect.objectContaining({
        structureKind: "heading",
        headingPath: ["Erweiterter Vandalismus"],
      })
    );
    expect(result.units[1]).toEqual(
      expect.objectContaining({
        structureKind: "paragraph",
        headingPath: ["Erweiterter Vandalismus"],
      })
    );
    expect(result.units.map((unit) => unit.text).join("")).toBe(text);
  });
});
