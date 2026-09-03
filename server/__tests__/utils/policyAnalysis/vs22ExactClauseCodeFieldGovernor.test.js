const crypto = require("crypto");
const fullCatalog = require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");
const {
  EXACT_CLAUSE_CODE_FIELD_GOVERNOR_CONTRACT_ID,
  EXACT_CLAUSE_CODE_FIELD_GOVERNOR_POLICY,
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  FIELD_EVIDENCE_STATUS,
  materializeRequestedFieldEvidence,
} = require("../../../utils/policyAnalysis/requestedFieldEvidenceContract");

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
    id: "synthetic-vs22",
    sourceDocumentId: "synthetic-vs22",
    title: "synthetic-vs22.pdf",
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

function vs22Catalog({ optIn = true } = {}) {
  const requirement = structuredClone(
    fullCatalog.requirements.find(({ id }) => id === "VS-22")
  );
  if (!optIn)
    delete requirement.components.find(({ id }) => id === "disposal_costs")
      .fieldGovernorPolicy;
  return { ...fullCatalog, requirements: [requirement] };
}

function build(pages, options) {
  const document = documentFromPages(pages);
  const fingerprint = crypto
    .createHash("sha256")
    .update(document.pageContent)
    .digest("hex");
  return buildControlledOccurrenceWorksheet({
    document,
    documentFingerprint: fingerprint,
    catalog: vs22Catalog(options),
  });
}

function component(worksheet, id) {
  return worksheet.requirements[0].components.find(
    (candidate) => candidate.id === id
  );
}

function materialize(worksheet) {
  const disposal = component(worksheet, "disposal_costs");
  return materializeRequestedFieldEvidence({
    worksheet,
    materializedCandidates: disposal.occurrences.map(({ candidateId }) => ({
      candidateId,
      binding: "DIRECT",
    })),
  }).requirements[0].fields[0];
}

const BODY = [
  "Seite 8 von 14",
  "Aufräum-, Abbruch- und Feuerlöschkosten12PA0130",
  "Entsorgungskosten sind Kosten für Untersuchung, Abfuhr, Behandlung, Vernichtung und Deponierung versicherter Sachen.",
].join("\n");

describe("VS-22 exact clause-code field governor", () => {
  test("binds the schedule value to general disposal costs with exact cross-page provenance", () => {
    const worksheet = build([
      [
        "Seite 1 von 7",
        "FEUERVERSICHERUNG",
        "Mitversichert gelten",
        "- Aufräum-, Abbruch- und Feuerlöschkosten auf Erstes Risiko (Besondere Bedingung 12PA0130)",
        "EUR6.121.600,00",
      ].join("\n"),
      BODY,
    ]);
    const disposal = component(worksheet, "disposal_costs");
    const bodyOccurrence = disposal.occurrences.find(
      ({ physicalPageNumber }) => physicalPageNumber === 2
    );

    expect(disposal.fieldGovernorPolicy).toBe(
      EXACT_CLAUSE_CODE_FIELD_GOVERNOR_POLICY
    );
    expect(bodyOccurrence.exactClauseCodeFieldGovernorHints).toEqual([
      expect.objectContaining({
        contractId: EXACT_CLAUSE_CODE_FIELD_GOVERNOR_CONTRACT_ID,
        clauseCode: "12PA0130",
        scopeKey: "FEUER_INSURANCE",
        physicalPageNumber: 1,
        amountText: "EUR6.121.600,00",
      }),
    ]);
    expect(component(worksheet, "hazardous_waste").occurrences).toHaveLength(0);
    expect(
      component(worksheet, "hazardous_waste_cost_limit").occurrences
    ).toHaveLength(0);

    const field = materialize(worksheet);
    expect(field.status).toBe(FIELD_EVIDENCE_STATUS.FOUND);
    expect(field.facts).toEqual([
      expect.objectContaining({
        normalizedValue: "EUR 6.121.600,00",
        qualifier: "auf Erstes Risiko",
        componentScope: {
          id: "disposal_costs",
          label: "Entsorgungskosten",
        },
        clauseActivationScope: {
          key: "FEUER_INSURANCE",
          label: "Feuer",
        },
        source: expect.objectContaining({
          physicalPageNumber: 1,
          exactText: "EUR6.121.600,00",
        }),
      }),
    ]);
  });

  test("retains equal values for each explicitly activated insurance scope", () => {
    const worksheet = build([
      [
        "Seite 1 von 7",
        "FEUERVERSICHERUNG",
        "Mitversichert gelten",
        "- Aufräumkosten auf Erstes Risiko (Besondere Bedingung 10PA0120)EUR6.121.600,00",
        "LEITUNGSWASSERVERSICHERUNG",
        "Mitversichert gelten",
        "- Aufräumkosten auf Erstes Risiko (Besondere Bedingung 10PA0120)EUR6.121.600,00",
        "STURMVERSICHERUNG",
        "Mitversichert gelten",
        "- Aufräumkosten auf Erstes Risiko (Besondere Bedingung 10PA0120)EUR6.121.600,00",
      ].join("\n"),
      [
        "Seite 13 von 14",
        "Aufräum- und Abbruchkosten10PA0120",
        "Entsorgungskosten umfassen Abfuhr, Behandlung, Vernichtung und Deponierung.",
      ].join("\n"),
    ]);

    const field = materialize(worksheet);
    expect(field.status).toBe(FIELD_EVIDENCE_STATUS.FOUND);
    expect(field.facts).toHaveLength(3);
    expect(
      field.facts.map(({ clauseActivationScope }) => clauseActivationScope.key)
    ).toEqual([
      "FEUER_INSURANCE",
      "LEITUNGSWASSER_INSURANCE",
      "STURM_INSURANCE",
    ]);
    expect(
      new Set(field.facts.map(({ normalizedValue }) => normalizedValue))
    ).toEqual(new Set(["EUR 6.121.600,00"]));
  });

  test.each([
    [
      "a different code",
      [
        "FEUERVERSICHERUNG",
        "Mitversichert gelten",
        "- Aufräumkosten auf Erstes Risiko (Besondere Bedingung 12PA0131) EUR6.121.600,00",
      ].join("\n"),
    ],
    [
      "a neighboring value",
      [
        "FEUERVERSICHERUNG",
        "Mitversichert gelten",
        "- Aufräumkosten auf Erstes Risiko (Besondere Bedingung 12PA0130)",
        "- Andere Leistung auf Erstes Risiko EUR7.300,00",
      ].join("\n"),
    ],
    [
      "a deductible value",
      [
        "FEUERVERSICHERUNG",
        "Mitversichert gelten",
        "- Aufräumkosten auf Erstes Risiko; Selbstbehalt EUR350,00 (Besondere Bedingung 12PA0130)",
      ].join("\n"),
    ],
    [
      "a premium value",
      [
        "FEUERVERSICHERUNG",
        "Mitversichert gelten",
        "- Aufräumkosten auf Erstes Risiko; Prämie EUR350,00 (Besondere Bedingung 12PA0130)",
      ].join("\n"),
    ],
    [
      "no positive activation governor",
      [
        "FEUERVERSICHERUNG",
        "- Aufräumkosten auf Erstes Risiko (Besondere Bedingung 12PA0130) EUR6.121.600,00",
      ].join("\n"),
    ],
  ])("does not bind %s", (_label, schedule) => {
    const worksheet = build([schedule, BODY]);
    expect(materialize(worksheet)).toMatchObject({
      status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
      facts: [],
    });
  });

  test("fails closed when repeated activations disagree", () => {
    const worksheet = build([
      [
        "FEUERVERSICHERUNG",
        "Mitversichert gelten",
        "- Aufräumkosten auf Erstes Risiko (Besondere Bedingung 12PA0130) EUR6.121.600,00",
        "- Aufräumkosten auf Erstes Risiko (Besondere Bedingung 12PA0130) EUR7.300,00",
      ].join("\n"),
      BODY,
    ]);
    expect(materialize(worksheet)).toMatchObject({
      status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
      facts: [],
    });
  });

  test("does not join when the component has not opted in", () => {
    const worksheet = build(
      [
        [
          "FEUERVERSICHERUNG",
          "Mitversichert gelten",
          "- Aufräumkosten auf Erstes Risiko (Besondere Bedingung 12PA0130) EUR6.121.600,00",
        ].join("\n"),
        BODY,
      ],
      { optIn: false }
    );
    expect(
      component(worksheet, "disposal_costs").occurrences.at(-1)
        .exactClauseCodeFieldGovernorHints
    ).toBeUndefined();
    expect(materialize(worksheet)).toMatchObject({
      status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
      facts: [],
    });
  });

  test("does not join through duplicate clause sections", () => {
    const worksheet = build([
      [
        "FEUERVERSICHERUNG",
        "Mitversichert gelten",
        "- Aufräumkosten auf Erstes Risiko (Besondere Bedingung 12PA0130) EUR6.121.600,00",
      ].join("\n"),
      BODY,
      BODY.replace("Seite 8 von 14", "Seite 9 von 14"),
    ]);
    expect(materialize(worksheet)).toMatchObject({
      status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
      facts: [],
    });
  });
});
