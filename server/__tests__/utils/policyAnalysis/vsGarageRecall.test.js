const crypto = require("crypto");
const fullCatalog = require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function worksheetFor(text) {
  const fingerprint = crypto.createHash("sha256").update(text).digest("hex");
  const catalog = {
    ...fullCatalog,
    requirements: fullCatalog.requirements.filter(({ id }) => id === "VS-16"),
  };
  return buildControlledOccurrenceWorksheet({
    documentFingerprint: fingerprint,
    catalog,
    document: {
      id: fingerprint,
      sourceDocumentId: fingerprint,
      title: "synthetic.pdf",
      pageContent: text,
      pageMap: [
        {
          pageNumber: 1,
          physicalPageNumber: 1,
          printedPageLabel: null,
          start: 0,
          end: text.length,
        },
      ],
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

function component(worksheet, id) {
  return worksheet.requirements[0].components.find(
    (candidate) => candidate.id === id
  );
}

describe("VS-16 garage and parking search contract", () => {
  test("finds controlled garage and parking vocabulary case-insensitively across PDF line breaks", () => {
    const worksheet = worksheetFor(
      "GARAGIERUNG ist mitversichert. Kfz-\nStellplatz vorhanden. TIEF-\nGARAGE eingeschlossen."
    );

    expect(worksheet.requirements[0]).toMatchObject({
      componentSatisfactionPolicy: "ANY",
      negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
      optionalFields: ["limit"],
    });
    expect(component(worksheet, "garage").occurrenceCount).toBeGreaterThan(0);
    expect(
      component(worksheet, "underground_garage").occurrenceCount
    ).toBeGreaterThan(0);
    expect(
      component(worksheet, "parking_space").occurrenceCount
    ).toBeGreaterThan(0);
  });

  test.each([
    "Garagentor und Garagentorantrieb",
    "Garagenhaftpflicht",
    "Garagengasse 12",
    "Parkverbot vor dem Gebäude",
    "Der Abstellplatz für Mülltonnen ist freizuhalten.",
    "Ein allgemeiner Stellplatz ist im Lageplan markiert.",
  ])("does not turn an adjacent word into a VS-16 object: %s", (text) => {
    const worksheet = worksheetFor(text);
    expect(worksheet.summary.occurrenceCount).toBe(0);
    expect(
      worksheet.requirements[0].components.every(
        ({ terminalState }) => terminalState === "NO_CONTROLLED_CANDIDATE"
      )
    ).toBe(true);
  });
});
