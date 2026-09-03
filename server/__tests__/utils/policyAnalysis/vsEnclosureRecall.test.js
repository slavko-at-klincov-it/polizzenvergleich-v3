const catalog = require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function worksheetFor(text) {
  return buildControlledOccurrenceWorksheet({
    documentFingerprint: "synthetic-vs18-recall-fingerprint",
    catalog: {
      ...catalog,
      requirements: catalog.requirements.filter(({ id }) => id === "VS-18"),
    },
    document: {
      id: "synthetic-vs18-recall",
      sourceDocumentId: "synthetic-vs18-recall",
      title: "synthetic-vs18-recall.pdf",
      documentType: "pdf",
      pageContent: text,
      pageMap: [{ pageNumber: 1, start: 0, end: text.length }],
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
        complete: true,
      },
    },
  });
}

function componentOccurrences(worksheet, componentId) {
  return worksheet.requirements[0].components.find(
    ({ id }) => id === componentId
  ).occurrences;
}

describe("VS-18 enclosure family recall", () => {
  test("recalls property boundaries and enclosures for the enclosure and fence components", () => {
    const worksheet = worksheetFor(
      "Zusätzlich sind mitversichert: Grundstücksbegrenzungen sowie Begrenzungen und Umzäunungen wie Mauern und Zäune."
    );

    expect(
      componentOccurrences(worksheet, "enclosures").map(
        ({ matchedAlias }) => matchedAlias
      )
    ).toEqual(
      expect.arrayContaining([
        "Grundstücksbegrenzungen",
        "Begrenzungen und Umzäunungen",
      ])
    );
    expect(
      componentOccurrences(worksheet, "fences").map(
        ({ matchedAlias }) => matchedAlias
      )
    ).toEqual(expect.arrayContaining(["Umzäunungen", "Zäune"]));
  });

  test("recalls a positive general cover clause using Umzäunungen", () => {
    const worksheet = worksheetFor(
      "Versicherungsschutz besteht auch für künstliche wie natürliche Einfriedungen und Umzäunungen."
    );

    expect(componentOccurrences(worksheet, "enclosures")).not.toHaveLength(0);
    expect(componentOccurrences(worksheet, "fences")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ matchedAlias: "Umzäunungen" }),
      ])
    );
  });

  test.each([
    "Die Begrenzung der Versicherungssumme beträgt 15.000 Euro.",
    "Das Mauerwerk ist gegen Feuchtigkeit abzudichten.",
    "Die Toröffnungsanlage und ihre Betätigungselemente werden gewartet.",
  ])(
    "does not create enclosure-family candidates from adjacent wording: %s",
    (text) => {
      expect(worksheetFor(text).summary.occurrenceCount).toBe(0);
    }
  );
});
