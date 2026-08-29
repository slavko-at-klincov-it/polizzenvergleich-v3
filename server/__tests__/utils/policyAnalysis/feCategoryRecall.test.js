const catalog = require("../../../resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function documentFromPages(pages) {
  let pageContent = "";
  const pageMap = pages.map((text, index) => {
    const start = pageContent.length;
    pageContent += text;
    const end = pageContent.length;
    if (index < pages.length - 1) pageContent += "\n";
    return { pageNumber: index + 1, start, end };
  });
  return {
    id: "synthetic-fe-recall",
    sourceDocumentId: "synthetic-fe-recall",
    title: "synthetic-fe-recall.pdf",
    documentType: "pdf",
    pageContent,
    pageMap,
    pdfExtraction: {
      schemaVersion: 1,
      totalPages: pages.length,
      processedPages: pages.length,
      pagesWithText: pages.length,
      complete: true,
    },
  };
}

function component(worksheet, requirementId, componentId) {
  return worksheet.requirements
    .find(({ id }) => id === requirementId)
    .components.find(({ id }) => id === componentId);
}

describe("FE category recall", () => {
  const worksheet = buildControlledOccurrenceWorksheet({
    document: documentFromPages([
      [
        "B. ALLGEMEINER TEIL",
        "Die Verletzung dieser Verpflichtungen führt nach Maßgabe des Gesetzes zur Leistungsfreiheit des Versicherers.",
      ].join("\n"),
      [
        "FEUERVERSICHERUNG",
        "Versichert gelten Verletzungen von vereinbarten Obliegenheiten gemäß Allgemeinen und Besonderen Bedingungen.",
        "Diese Deckungserweiterung gilt nicht für sonstige Fälle der Leistungsfreiheit.",
      ].join("\n"),
    ]),
    documentFingerprint: "synthetic-fe-recall-fingerprint",
    catalog,
  });

  test("FE-E16 recalls causal and coverage-extension obligation wording", () => {
    expect(
      component(
        worksheet,
        "FE-E16",
        "obligation_breach_consequences"
      ).occurrences
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          physicalPageNumber: 1,
          exactText: "Verletzung dieser Verpflichtungen",
        }),
        expect.objectContaining({
          physicalPageNumber: 2,
          exactText: "Verletzungen von vereinbarten Obliegenheiten",
        }),
      ])
    );
  });

  test("FE-E16 keeps the resulting release from liability as a separate fact", () => {
    expect(
      component(
        worksheet,
        "FE-E16",
        "benefit_reduction_or_release"
      ).occurrences
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          physicalPageNumber: 1,
          exactText: "Leistungsfreiheit",
        }),
        expect.objectContaining({
          physicalPageNumber: 2,
          exactText: "Leistungsfreiheit",
        }),
      ])
    );
  });
});
