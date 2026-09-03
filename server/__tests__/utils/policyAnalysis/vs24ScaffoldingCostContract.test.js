const crypto = require("crypto");
const fullCatalog = require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  buildCandidateTriagePayload,
  deriveCandidateBinding,
} = require("../../../utils/policyAnalysis/candidateTriageContract");
const {
  REQUESTED_FIELD_STATUS,
  materializeRequestedFieldEvidence,
} = require("../../../utils/policyAnalysis/requestedFieldEvidenceContract");

const requirement = fullCatalog.requirements.find(({ id }) => id === "VS-24");

function worksheetFor(text) {
  const fingerprint = crypto.createHash("sha256").update(text).digest("hex");
  return buildControlledOccurrenceWorksheet({
    documentFingerprint: fingerprint,
    catalog: { ...fullCatalog, requirements: [requirement] },
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

function selectedCandidates(worksheet) {
  return buildCandidateTriagePayload(worksheet).bindingTargets.flatMap(
    (target) =>
      target.members.map((member) => ({
        requirementId: target.requirementId,
        componentId: member.componentId,
        candidateId: member.candidateId,
        binding: deriveCandidateBinding({
          roleMatch: target.roleResolution.roleMatch,
          scopeMatch: target.scopeResolution.scopeMatch,
        }),
      }))
  );
}

function requestedFieldsFor(text) {
  const worksheet = worksheetFor(text);
  return {
    worksheet,
    result: materializeRequestedFieldEvidence({
      worksheet,
      materializedCandidates: selectedCandidates(worksheet),
    }).requirements[0],
  };
}

describe("VS-24 scaffolding-cost semantic contract", () => {
  test("models coverage as required and a local limit as optional", () => {
    expect(fullCatalog.catalogId).toBe("vs-occurrence-full-draft-v0.16");
    expect(requirement).toMatchObject({
      requestedFields: [],
      optionalFields: ["limit"],
      components: [
        {
          id: "scaffolding_costs",
          factRole: "COST",
        },
      ],
    });
  });

  test("keeps a missing local limit optional without inventing an amount", () => {
    const { result } = requestedFieldsFor(
      "Glasbruchversicherung\nZusätzlich versichert sind Kosten für Gerüste, die zur Ersatzausführung erforderlich sind."
    );

    expect(result).toMatchObject({
      requestedFields: [],
      optionalFields: ["limit"],
      requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_REQUIRED,
      fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
    });
  });

  test("extracts an explicit local scaffolding-cost limit", () => {
    const { result } = requestedFieldsFor(
      "Glasbruchversicherung\nGerüstkosten bis EUR 7.500 je Schadenfall sind mitversichert."
    );

    expect(result.fields[0]).toMatchObject({
      field: "limit",
      status: "FOUND",
      facts: [
        expect.objectContaining({
          normalizedValue: "EUR 7.500",
          valueType: "MONEY",
          unit: "EUR",
        }),
      ],
    });
  });

  test("does not borrow limits from the preceding or following clause", () => {
    const { worksheet, result } = requestedFieldsFor(
      [
        "Glasbruchversicherung",
        "GL03 Folgeschäden aus Glasbruch bis EUR 5.000.",
        "Versichert sind unmittelbare Folgeschäden.",
        "",
        "GL04 Gerüstkosten",
        "Mitversichert sind Gerüst- und Krankosten nach einem ersatzpflichtigen Glasschaden.",
        "",
        "GL05 Notverglasung bis EUR 1.000.",
      ].join("\n")
    );
    const occurrence = worksheet.requirements[0].components[0].occurrences.find(
      ({ exactText }) => exactText === "Gerüstkosten"
    );

    expect(occurrence.context.text).not.toContain("EUR 5.000");
    expect(occurrence.context.text).not.toContain("EUR 1.000");
    expect(result.fields[0]).toMatchObject({ status: "NOT_FOUND", facts: [] });
  });
});
