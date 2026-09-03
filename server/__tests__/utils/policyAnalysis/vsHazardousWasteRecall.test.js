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
  DOCUMENT_STATUS,
  buildPreparedEvidenceTargets,
} = require("../../../utils/policyAnalysis/preparedEvidenceContract");

function worksheetFor(text) {
  const fingerprint = crypto.createHash("sha256").update(text).digest("hex");
  const catalog = {
    ...fullCatalog,
    requirements: fullCatalog.requirements.filter(({ id }) => id === "VS-22"),
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

describe("VS-22 hazardous-waste inflection recall", () => {
  test.each([
    "Die Mehrkosten für die Behandlung von gefährlichem Abfall sind mitversichert.",
    "Die Behandlung von gefährlichem Abfall ist gedeckt.",
    "Die Behandlung von gefährlichen Abfällen erfolgt nach einem versicherten Schaden.",
    "Kosten zur Beseitigung gefährlicher Abfälle werden ersetzt.",
    "Die Zwischenlagerung von gefährlichen Abfällen ist geregelt.",
  ])("finds the controlled hazardous-waste word form: %s", (text) => {
    const worksheet = worksheetFor(text);

    expect(
      component(worksheet, "hazardous_waste").occurrenceCount
    ).toBeGreaterThan(0);
    expect(
      component(worksheet, "hazardous_waste_cost_limit").occurrenceCount
    ).toBeGreaterThan(0);
  });

  test("keeps generic disposal and radioactive-earth wording separate from general hazardous waste", () => {
    const worksheet = worksheetFor(
      "Entsorgungskosten umfassen Untersuchung, Abfuhr, Behandlung, Vernichtung und Deponierung. Radioaktiv kontaminiertes Erdreich ist nach einem versicherten Schaden mitumfasst."
    );

    expect(
      component(worksheet, "disposal_costs").occurrenceCount
    ).toBeGreaterThan(0);
    expect(component(worksheet, "hazardous_waste").occurrenceCount).toBe(0);
    expect(
      component(worksheet, "hazardous_waste_cost_limit").occurrenceCount
    ).toBe(0);
  });

  test("carries a DOC-07-like inflection from recall through terminal scope rejection", () => {
    const worksheet = worksheetFor(
      "Kein Versicherungsschutz besteht für die Endlagerung von Abfällen jeder Art. Nicht unter diesem Ausschluss fallen die kurzfristige Zwischenlagerung von gefährlichen Abfall- und Problemstoffen."
    );
    const triageTargets = buildCandidateTriagePayload(worksheet).bindingTargets;
    const exposedComponents = triageTargets.map(
      ({ componentId }) => componentId
    );

    expect(exposedComponents).toEqual([
      "hazardous_waste",
      "hazardous_waste_cost_limit",
    ]);
    expect(triageTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roleResolution: expect.objectContaining({
            roleMatch: "MISMATCH",
            basis: "VS22_LIABILITY_OR_STORAGE_NOT_DISPOSAL_COST",
          }),
          scopeResolution: expect.objectContaining({
            scopeMatch: "OTHER_SCOPE",
          }),
          modelDecisionFields: [],
        }),
      ])
    );

    const candidateTriage = triageTargets.flatMap((target) =>
      target.candidateIds.map((candidateId) => ({
        requirementId: target.requirementId,
        componentId: target.componentId,
        candidateId,
        binding: deriveCandidateBinding({
          roleMatch: target.roleResolution.roleMatch,
          scopeMatch: target.scopeResolution.scopeMatch,
        }),
      }))
    );
    const preparedTargets = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
      candidateTriage,
    });

    expect(
      preparedTargets
        .filter(({ componentId }) => exposedComponents.includes(componentId))
        .map(({ candidates, serverRejectedCandidates }) => ({
          candidateCount: candidates.length,
          reasons: serverRejectedCandidates.map(({ reason }) => reason),
        }))
    ).toEqual([
      {
        candidateCount: 0,
        reasons: ["TRIAGE_MENTION_ONLY"],
      },
      {
        candidateCount: 0,
        reasons: ["TRIAGE_MENTION_ONLY"],
      },
    ]);
  });

  test.each([
    "Die gewöhnlichen Entsorgungskosten sind mitversichert.",
    "Abfälle werden getrennt gesammelt.",
    "Problemstoffe sind im Lagerverzeichnis genannt.",
  ])(
    "does not infer hazardous waste from an adjacent generic term: %s",
    (text) => {
      const worksheet = worksheetFor(text);

      expect(component(worksheet, "hazardous_waste").occurrenceCount).toBe(0);
      expect(
        component(worksheet, "hazardous_waste_cost_limit").occurrenceCount
      ).toBe(0);
    }
  );
});
