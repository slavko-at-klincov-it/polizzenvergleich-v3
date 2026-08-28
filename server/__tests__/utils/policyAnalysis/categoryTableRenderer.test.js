const {
  COVERAGE_EFFECT,
  COVERAGE_PICTURE,
  EVIDENCE_COMPLETENESS,
  EVIDENCE_PRESENCE,
  CONFLICT_STATE,
  REVIEW_STATUS,
  rollupCategoryResult,
} = require("../../../utils/policyAnalysis/categoryResultContract");
const {
  DOCUMENT_STATUS,
} = require("../../../utils/policyAnalysis/preparedEvidenceContract");
const {
  MISSING_EVIDENCE,
  buildCategoryTableRows,
  renderCategoryTableMarkdown,
} = require("../../../utils/policyAnalysis/categoryTableRenderer");
const {
  materializeRequestedFieldEvidence,
} = require("../../../utils/policyAnalysis/requestedFieldEvidenceContract");

function fixture({
  id = "VS-21",
  label = "Aufräum- und Abbruchkosten, Höhe des Limits",
  requestedFields = ["limit"],
  componentEffects = [COVERAGE_EFFECT.INCLUDED, COVERAGE_EFFECT.INCLUDED],
  selected = [true, true],
  fieldResult,
  candidateContext = "Aufräum- und Abbruchkosten sind bis 10 % versichert.",
  scopePolicy = "GENERAL_REQUIRED",
} = {}) {
  const componentIds = componentEffects.map((_, index) => `component-${index}`);
  const components = componentIds.map((componentId, index) => {
    const contextText = `${candidateContext} ${index + 1}`;
    const contextStart = index * 1_000;
    const exactText = "Aufräum";
    const exactStart = contextText.indexOf(exactText);
    return {
      id: componentId,
      label: `Bestandteil ${index + 1}`,
      occurrences: [
        {
          candidateId: `candidate:${index}`,
          pageNumber: index + 3,
          physicalPageNumber: index + 3,
          exactText,
          documentStart: contextStart + exactStart,
          documentEnd: contextStart + exactStart + exactText.length,
          context: {
            text: contextText,
            documentStart: contextStart,
            documentEnd: contextStart + contextText.length,
          },
        },
      ],
    };
  });
  const judgements = componentIds.map((componentId, index) => ({
    requirementId: id,
    componentId,
    selectedCandidateIds: selected[index] ? [`candidate:${index}`] : [],
    evidencePresence: selected[index]
      ? EVIDENCE_PRESENCE.FOUND
      : EVIDENCE_PRESENCE.NOT_FOUND,
    coverageEffect: selected[index]
      ? componentEffects[index]
      : COVERAGE_EFFECT.UNKNOWN,
    conflictState: CONFLICT_STATE.NONE,
  }));
  const rollup = rollupCategoryResult({
    categoryId: id,
    requiredComponentIds: componentIds,
    componentResults: judgements,
  });
  const requestedFieldMaterialization = fieldResult
    ? { requirements: [fieldResult] }
    : { requirements: [] };

  return {
    definitions: [{ id, stage: "K", label }],
    worksheet: {
      candidateOnly: true,
      requirements: [{ id, label, requestedFields, scopePolicy, components }],
    },
    materializedEvidence: {
      judgements,
      rollups: [{ ...rollup, requestedFields }],
    },
    requestedFieldMaterialization,
    documentStatus: DOCUMENT_STATUS.ACTIVE,
  };
}

function completeLimit() {
  return {
    requirementId: "VS-21",
    requestedFieldStatus: "COMPLETE",
    fields: [
      {
        field: "limit",
        status: "FOUND",
        facts: [
          {
            normalizedValue: "10 %",
            source: {
              candidateId: "candidate:0",
              physicalPageNumber: 999,
              exactText: "vom Werteobjekt erfunden",
            },
          },
        ],
      },
    ],
  };
}

describe("categoryTableRenderer", () => {
  test("renders fully evidenced condition-only categories as BELEGT plus Ja", () => {
    const definitions = [{ id: "VS-11", stage: "S", label: "Art des Index" }];
    const worksheet = {
      requirements: [
        {
          id: "VS-11",
          label: "Art des Index",
          requestedFields: [],
          components: [
            {
              id: "index_type",
              label: "Indexart",
              factRole: "DEFINITION",
              occurrences: [
                {
                  candidateId: "candidate:index",
                  pageNumber: 4,
                  physicalPageNumber: 4,
                  exactText: "Baukostenindex",
                  context: { text: "Wertanpassung nach Baukostenindex." },
                },
              ],
            },
          ],
        },
      ],
    };
    const materializedEvidence = {
      rollups: [
        {
          categoryId: "VS-11",
          requestedFields: [],
          evidenceCompleteness: EVIDENCE_COMPLETENESS.COMPLETE,
          coveragePicture: COVERAGE_PICTURE.NOT_DETERMINABLE,
          conflictState: CONFLICT_STATE.NONE,
          reviewStatus: REVIEW_STATUS.BELEGT,
        },
      ],
      judgements: [
        {
          requirementId: "VS-11",
          componentId: "index_type",
          evidencePresence: EVIDENCE_PRESENCE.FOUND,
          coverageEffect: COVERAGE_EFFECT.DEFINED,
          conflictState: CONFLICT_STATE.NONE,
          selectedScopePicture: "GENERAL",
          unresolvedCandidateIds: [],
          selectedCandidateIds: ["candidate:index"],
        },
      ],
    };

    expect(
      buildCategoryTableRows({
        definitions,
        worksheet,
        materializedEvidence,
        documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
      })[0]
    ).toMatchObject({ coverage: "Ja", reviewStatus: "BELEGT" });
  });

  test("renders the exact existing eight-column table with a complete included limit", () => {
    const input = fixture({ fieldResult: completeLimit() });
    const [row] = buildCategoryTableRows(input);

    expect(row).toMatchObject({
      categoryId: "VS-21",
      coverage: "Ja",
      coverageAmount: "10 %",
      reviewStatus: "BELEGT",
    });
    expect(renderCategoryTableMarkdown(input)).toBe(
      [
        "| Kategorie-ID | Stufe | Kategorie-Name | Belegter Vertragsinhalt | Deckung | Deckungssumme | Quelle | Prüfstatus |",
        "|---|---|---|---|---|---|---|---|",
        "| VS-21 | K | Aufräum- und Abbruchkosten, Höhe des Limits | Bestandteil 1: eingeschlossen; Bestandteil 2: eingeschlossen | Ja | 10 % | PDF-Seite 3: „Aufräum- und Abbruchkosten sind bis 10 % versichert. 1“<br>PDF-Seite 4: „Aufräum- und Abbruchkosten sind bis 10 % versichert. 2“ | BELEGT |",
      ].join("\n")
    );
  });

  test("renders complete exclusions as belegtes Nein", () => {
    const input = fixture({
      requestedFields: [],
      componentEffects: [COVERAGE_EFFECT.EXCLUDED],
      selected: [true],
    });

    expect(buildCategoryTableRows(input)[0]).toMatchObject({
      coverage: "Nein",
      reviewStatus: "BELEGT",
    });
  });

  test("keeps a general outbuilding clause as a sourced partial result without claiming a named building", () => {
    const input = fixture({
      id: "VS-15",
      label: "Nebengebäude namentlich in der Polizze angeführt",
      requestedFields: [],
      componentEffects: [COVERAGE_EFFECT.INCLUDED, COVERAGE_EFFECT.UNKNOWN],
      selected: [true, false],
      candidateContext:
        "Nebengebäude am Versicherungsgrundstück sind auf Erstes Risiko mitversichert.",
      fieldResult: {
        requirementId: "VS-15",
        requestedFieldStatus: "NOT_REQUIRED",
        fields: [
          {
            field: "limit",
            status: "FOUND",
            facts: [
              {
                normalizedValue: "EUR 1.530.400,00",
                source: { candidateId: "candidate:0" },
              },
            ],
          },
        ],
      },
    });
    input.worksheet.requirements[0].components[0].label =
      "Nebengebäude allgemein";
    input.worksheet.requirements[0].components[1].label =
      "Namentliche Anführung in der Polizze";

    expect(buildCategoryTableRows(input)[0]).toMatchObject({
      documentedContent:
        "Nebengebäude allgemein: eingeschlossen; Namentliche Anführung in der Polizze: nicht feststellbar; Limit des Teilbelegs: EUR 1.530.400,00",
      coverage: "Nicht feststellbar",
      coverageAmount: "Nicht feststellbar",
      reviewStatus: "TEILBELEGT",
      source: expect.stringContaining("PDF-Seite 3"),
    });
  });

  test("renders a complete condition answer with the valid BELEGT plus Ja combination", () => {
    const condition = {
      requirementId: "VS-08",
      requestedFieldStatus: "COMPLETE",
      fields: [
        {
          field: "condition",
          status: "FOUND",
          facts: [
            {
              normalizedValue: "bedingt",
              source: { candidateId: "candidate:0" },
            },
          ],
        },
      ],
    };
    const input = fixture({
      id: "VS-08",
      label: "Unterversicherungsverzicht bedingt oder unbedingt",
      requestedFields: ["condition"],
      componentEffects: [COVERAGE_EFFECT.CONDITIONAL],
      selected: [true],
      fieldResult: condition,
    });
    input.worksheet.requirements[0].components[0].factRole = "CONDITION";
    const [row] = buildCategoryTableRows(input);

    expect(row).toMatchObject({
      documentedContent: "Bestandteil 1: bedingt geregelt; Bedingung: bedingt",
      coverage: "Ja",
      reviewStatus: "BELEGT",
    });
  });

  test("accepts the real deterministic requested-field materializer output", () => {
    const input = fixture({
      componentEffects: [COVERAGE_EFFECT.INCLUDED],
      selected: [true],
    });
    input.requestedFieldMaterialization = materializeRequestedFieldEvidence({
      worksheet: input.worksheet,
      materializedCandidates: [
        { candidateId: "candidate:0", binding: "DIRECT" },
      ],
    });

    expect(buildCategoryTableRows(input)[0]).toMatchObject({
      coverage: "Ja",
      coverageAmount: "10 %",
      reviewStatus: "BELEGT",
    });
  });

  test("never turns missing evidence into Nein and uses the fixed unknown cells", () => {
    const [row] = buildCategoryTableRows(
      fixture({
        requestedFields: [],
        componentEffects: [COVERAGE_EFFECT.INCLUDED],
        selected: [false],
      })
    );

    expect(row).toEqual({
      categoryId: "VS-21",
      stage: "K",
      categoryName: "Aufräum- und Abbruchkosten, Höhe des Limits",
      documentedContent: MISSING_EVIDENCE,
      coverage: "Nicht feststellbar",
      coverageAmount: "Nicht feststellbar",
      source: MISSING_EVIDENCE,
      reviewStatus: "UNGEKLÄRT",
    });
  });

  test.each([
    ["partial components", [true, false], completeLimit()],
    [
      "missing requested field",
      [true, true],
      {
        requirementId: "VS-21",
        requestedFieldStatus: "NOT_FOUND",
        fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
      },
    ],
  ])(
    "renders %s as TEILBELEGT without a positive coverage or amount",
    (_name, selected, fieldResult) => {
      const [row] = buildCategoryTableRows(fixture({ selected, fieldResult }));

      expect(row).toMatchObject({
        coverage: "Nicht feststellbar",
        coverageAmount: "Nicht feststellbar",
        reviewStatus: "TEILBELEGT",
      });
      expect(row.source).toContain("PDF-Seite");
    }
  );

  test("keeps independently included and excluded components out of WIDERSPRÜCHLICH", () => {
    const [row] = buildCategoryTableRows(
      fixture({
        requestedFields: [],
        componentEffects: [COVERAGE_EFFECT.INCLUDED, COVERAGE_EFFECT.EXCLUDED],
      })
    );

    expect(row).toMatchObject({
      documentedContent:
        "Bestandteil 1: eingeschlossen; Bestandteil 2: ausgeschlossen",
      coverage: "Nicht feststellbar",
      reviewStatus: "TEILBELEGT",
    });
  });

  test("renders a fully evidenced narrow component without hiding its scope", () => {
    const input = fixture({
      requestedFields: [],
      componentEffects: [COVERAGE_EFFECT.INCLUDED],
      selected: [true],
      scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
    });
    input.materializedEvidence.judgements[0].selectedScopePicture =
      "NARROW_ONLY";

    expect(buildCategoryTableRows(input)[0]).toMatchObject({
      documentedContent:
        "Bestandteil 1: eingeschlossen (engerer Geltungsbereich; Details siehe Quelle)",
      coverage: "Ja",
      reviewStatus: "BELEGT",
    });
  });

  test.each([
    [COVERAGE_EFFECT.EXCLUDED, "TEILBELEGT"],
    [COVERAGE_EFFECT.CONDITIONAL, "TEILBELEGT"],
    [COVERAGE_EFFECT.OPTION_ONLY, "TEILBELEGT"],
    [COVERAGE_EFFECT.UNKNOWN, "UNGEKLÄRT"],
  ])(
    "does not generalize narrow-only %s to the complete category",
    (coverageEffect, reviewStatus) => {
      const input = fixture({
        requestedFields: [],
        componentEffects: [coverageEffect],
        selected: [true],
        scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
      });
      input.materializedEvidence.judgements[0].selectedScopePicture =
        "NARROW_ONLY";

      expect(buildCategoryTableRows(input)[0]).toMatchObject({
        coverage: "Nicht feststellbar",
        reviewStatus,
      });
    }
  );

  test("replays LF VS-16 with narrow garage and general underground garage as complete", () => {
    const input = fixture({
      id: "VS-16",
      label: "Garagen und Tiefgarage mitversichert",
      requestedFields: [],
      componentEffects: [COVERAGE_EFFECT.INCLUDED, COVERAGE_EFFECT.INCLUDED],
      selected: [true, true],
      scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
    });
    input.materializedEvidence.judgements[0].selectedScopePicture =
      "NARROW_ONLY";
    input.materializedEvidence.judgements[1].selectedScopePicture = "GENERAL";

    expect(buildCategoryTableRows(input)[0]).toMatchObject({
      coverage: "Ja",
      reviewStatus: "BELEGT",
    });
    expect(buildCategoryTableRows(input)[0].source).toContain("PDF-Seite 3");
    expect(buildCategoryTableRows(input)[0].source).toContain("PDF-Seite 4");
  });

  test("keeps a row partial while any candidate remains unresolved", () => {
    const input = fixture({
      requestedFields: [],
      componentEffects: [COVERAGE_EFFECT.INCLUDED],
      selected: [true],
    });
    input.materializedEvidence.judgements[0].selectedScopePicture = "GENERAL";
    input.materializedEvidence.judgements[0].unresolvedCandidateIds = [
      "candidate:unresolved",
    ];

    expect(buildCategoryTableRows(input)[0]).toMatchObject({
      coverage: "Nicht feststellbar",
      reviewStatus: "TEILBELEGT",
    });
  });

  test("places duration in content and visibly marks proposal applicability", () => {
    const duration = {
      requirementId: "VS-28",
      requestedFieldStatus: "COMPLETE",
      fields: [
        {
          field: "duration",
          status: "FOUND",
          facts: [
            {
              normalizedValue: "6 Monate",
              source: { candidateId: "candidate:0" },
            },
          ],
        },
      ],
    };
    const input = fixture({
      id: "VS-28",
      label: "Mietzinsentgang, Dauer der Leistung",
      requestedFields: ["duration"],
      componentEffects: [COVERAGE_EFFECT.INCLUDED],
      selected: [true],
      fieldResult: duration,
    });
    input.documentStatus = DOCUMENT_STATUS.PROPOSAL;
    const [row] = buildCategoryTableRows(input);

    expect(row).toMatchObject({
      documentedContent:
        "Vorschlag (PROPOSED_ONLY): Bestandteil 1: eingeschlossen; Dauer: 6 Monate",
      coverage: "Ja",
      coverageAmount: "Nicht feststellbar",
      reviewStatus: "BELEGT",
    });
  });

  test("uses only worksheet-owned page and quote despite conflicting field metadata", () => {
    const [row] = buildCategoryTableRows(
      fixture({ fieldResult: completeLimit() })
    );

    expect(row.source).toContain("PDF-Seite 3");
    expect(row.source).not.toContain("999");
    expect(row.source).not.toContain("erfunden");
  });

  test("uses source-bound field excerpts without repeating the same candidate excerpt", () => {
    const input = fixture({
      id: "VS-11",
      label: "Indexart",
      requestedFields: ["index_type"],
      componentEffects: [COVERAGE_EFFECT.DEFINED],
      selected: [true],
      candidateContext:
        "Indexvereinbarung. Verwendet wird der Baukostenindex (Baumeisterarbeiten) für die jährliche Anpassung.",
      fieldResult: {
        requirementId: "VS-11",
        requestedFieldStatus: "COMPLETE",
        fields: [
          {
            field: "index_type",
            status: "FOUND",
            facts: [
              {
                rawValue: "Baukostenindex (Baumeisterarbeiten)",
                normalizedValue: "Baukostenindex (Baumeisterarbeiten)",
                source: { candidateId: "candidate:0" },
              },
            ],
          },
        ],
      },
    });

    const [row] = buildCategoryTableRows(input);

    expect(row.source.match(/PDF-Seite/gu)).toHaveLength(1);
    expect(row.source).toContain("Baukostenindex (Baumeisterarbeiten)");
  });

  test("fails closed when a non-unknown decision has no server-owned source", () => {
    const input = fixture({
      requestedFields: [],
      componentEffects: [COVERAGE_EFFECT.INCLUDED],
      selected: [true],
    });
    input.materializedEvidence.judgements[0].selectedCandidateIds = [
      "candidate-does-not-exist",
    ];

    expect(buildCategoryTableRows(input)[0]).toMatchObject({
      documentedContent: MISSING_EVIDENCE,
      coverage: "Nicht feststellbar",
      reviewStatus: "UNGEKLÄRT",
    });
  });

  test("does not render an amount whose candidate source is not in the worksheet", () => {
    const fieldResult = completeLimit();
    fieldResult.fields[0].facts[0].source.candidateId = "unknown-candidate";
    const [row] = buildCategoryTableRows(fixture({ fieldResult }));

    expect(row).toMatchObject({
      coverage: "Nicht feststellbar",
      coverageAmount: "Nicht feststellbar",
      reviewStatus: "TEILBELEGT",
    });
    expect(row.source).not.toContain("unknown-candidate");
  });

  test("escapes pipes and line breaks in every Markdown cell", () => {
    const input = fixture({
      label: "Kosten | Dauer",
      requestedFields: [],
      componentEffects: [COVERAGE_EFFECT.INCLUDED],
      selected: [true],
      candidateContext: "Zeile 1 | Teil\nZeile 2",
    });
    input.worksheet.requirements[0].components[0].label = "Teil | eins";

    const markdown = renderCategoryTableMarkdown(input);
    expect(markdown).toContain("Kosten \\| Dauer");
    expect(markdown).toContain("Teil \\| eins: eingeschlossen");
    expect(markdown).toContain("Zeile 1 \\| Teil Zeile 2");
  });
});
