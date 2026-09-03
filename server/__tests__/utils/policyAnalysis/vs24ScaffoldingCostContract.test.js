const crypto = require("crypto");
const fullCatalog = require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  REQUESTED_FIELD_STATUS,
  materializeRequestedFieldEvidence,
} = require("../../../utils/policyAnalysis/requestedFieldEvidenceContract");
const {
  deterministicCategoryCandidateBinding,
} = require("../../../utils/policyAnalysis/deterministicCategoryEvidenceRules");
const {
  DOCUMENT_STATUS,
  buildPreparedEvidenceTargets,
} = require("../../../utils/policyAnalysis/preparedEvidenceContract");

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
  return worksheet.requirements[0].components.flatMap((component) =>
    component.occurrences.map(({ candidateId }) => ({
      requirementId: "VS-24",
      componentId: component.id,
      candidateId,
      binding: "DIRECT",
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

function occurrenceFor(worksheet, exactText = "Gerüstkosten") {
  const component = worksheet.requirements[0].components[0];
  const occurrence = component.occurrences.find(
    (candidate) => candidate.exactText === exactText
  );
  return {
    requirement: worksheet.requirements[0],
    component,
    occurrence,
  };
}

describe("VS-24 scaffolding-cost semantic contract", () => {
  test("models coverage as required and a local limit as optional", () => {
    expect(fullCatalog.catalogId).toBe("vs-occurrence-full-draft-v0.16");
    expect(requirement).toMatchObject({
      requestedFields: [],
      optionalFields: ["limit"],
      scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
      scopeRules: {
        narrowScopeKeys: expect.arrayContaining([
          "FEUER_INSURANCE",
          "LEITUNGSWASSER_INSURANCE",
          "STURM_INSURANCE",
          "GLASBRUCH_INSURANCE",
        ]),
      },
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

  test.each([
    "Gerüstkosten sind mitversichert; Krankosten bis EUR 10.000.",
    "Gerüstkosten sind mitversichert. Selbstbehalt EUR 500.",
  ])("rejects a local value governed by another subject: %s", (text) => {
    const { result } = requestedFieldsFor(text);

    expect(result.fields[0]).toMatchObject({ status: "NOT_FOUND", facts: [] });
  });

  test.each([
    ["Feuerversicherung", "FEUER_INSURANCE"],
    ["Leitungswasserversicherung", "LEITUNGSWASSER_INSURANCE"],
    ["Sturmversicherung", "STURM_INSURANCE"],
    ["Glasbruchversicherung", "GLASBRUCH_INSURANCE"],
  ])(
    "preserves the exact declared comparison scope under %s",
    (heading, expectedScopeKey) => {
      const worksheet = worksheetFor(
        `${heading}\nMitversichert sind Gerüstkosten.`
      );
      const {
        requirement: selectedRequirement,
        component,
        occurrence,
      } = occurrenceFor(worksheet);

      expect(
        deterministicCategoryCandidateBinding({
          worksheet,
          requirement: selectedRequirement,
          component,
          occurrence,
        })
      ).toMatchObject({
        binding: "NARROW_SCOPE",
        comparisonScopeKey: expectedScopeKey,
      });

      const [target] = buildPreparedEvidenceTargets({
        worksheet,
        documentStatus: DOCUMENT_STATUS.ACTIVE,
        candidateTriage: selectedCandidates(worksheet).map((candidate) => ({
          ...candidate,
          binding: "NARROW_SCOPE",
        })),
      });
      expect(target.candidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            candidateId: occurrence.candidateId,
            candidateBinding: "NARROW_SCOPE",
            comparisonScopeKey: expectedScopeKey,
          }),
        ])
      );
    }
  );

  test("does not expose an undeclared comparison scope key", () => {
    const worksheet = worksheetFor(
      "Glasbruchversicherung\nMitversichert sind Gerüstkosten."
    );
    worksheet.requirements[0].scopeRules.narrowScopeKeys = ["FEUER_INSURANCE"];

    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.ACTIVE,
      candidateTriage: selectedCandidates(worksheet).map((candidate) => ({
        ...candidate,
        binding: "NARROW_SCOPE",
      })),
    });

    expect(target.candidates).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ comparisonScopeKey: "GLASBRUCH_INSURANCE" }),
      ])
    );
  });

  test("keeps multiple declared danger scopes ambiguous", () => {
    const worksheet = worksheetFor(
      "Glasbruchversicherung\nMitversichert sind Gerüstkosten."
    );
    const { requirement: selectedRequirement, component, occurrence } =
      occurrenceFor(worksheet);
    occurrence.sectionScopeHint.scopeKeys = [
      "GLASBRUCH_INSURANCE",
      "FEUER_INSURANCE",
    ];

    expect(
      deterministicCategoryCandidateBinding({
        worksheet,
        requirement: selectedRequirement,
        component,
        occurrence,
      })
    ).toEqual({
      binding: "NARROW_SCOPE",
      basis: "AMBIGUOUS_NARROW_SECTION_SCOPE",
      authoritative: true,
    });

    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.ACTIVE,
      candidateTriage: selectedCandidates(worksheet).map((candidate) => ({
        ...candidate,
        binding: "NARROW_SCOPE",
      })),
    });
    expect(target.candidates[0]).toMatchObject({
      candidateBinding: "NARROW_SCOPE",
      deterministicBindingBasis: "AMBIGUOUS_NARROW_SECTION_SCOPE",
    });
    expect(target.candidates[0]).not.toHaveProperty("comparisonScopeKey");
  });
});
