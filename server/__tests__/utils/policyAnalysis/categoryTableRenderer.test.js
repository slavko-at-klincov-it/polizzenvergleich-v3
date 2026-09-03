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
  componentSatisfactionPolicy = "ALL",
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
    componentSatisfactionPolicy,
  });
  const requestedFieldMaterialization = fieldResult
    ? { requirements: [fieldResult] }
    : { requirements: [] };

  return {
    definitions: [{ id, stage: "K", label }],
    worksheet: {
      candidateOnly: true,
      requirements: [
        {
          id,
          label,
          requestedFields,
          scopePolicy,
          componentSatisfactionPolicy,
          components,
        },
      ],
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
  test("quotes the server-bound clause when structural context is only a coverage heading", () => {
    const input = fixture({
      id: "ST-08",
      label: "Dachlawine auf eigene Anlagen",
      requestedFields: [],
      componentEffects: [COVERAGE_EFFECT.INCLUDED],
    });
    const occurrence =
      input.worksheet.requirements[0].components[0].occurrences[0];
    const heading = "Zusätzlich versichert sind Schäden durch";
    const exactText = `${heading}\n• Schnee- und Eisrutsch an den versicherten Gebäuden`;
    occurrence.exactText = exactText;
    occurrence.documentStart = 1_000;
    occurrence.documentEnd = 1_000 + exactText.length;
    occurrence.context = {
      text: heading,
      documentStart: 1_000,
      documentEnd: 1_000 + heading.length,
    };

    const [row] = buildCategoryTableRows(input);

    expect(row.source).toContain("Schnee- und Eisrutsch");
  });

  test("keeps a bounded list-item quote instead of leaking into the next item", () => {
    const input = fixture({
      id: "VS-32",
      label: "Umzugs- und Zwischenlagerungskosten",
      requestedFields: [],
      componentEffects: [COVERAGE_EFFECT.INCLUDED],
    });
    const occurrence =
      input.worksheet.requirements[0].components[0].occurrences[0];
    const contextText =
      "- Die Kosten einer sechsmonatigen Zwischenlagerung sind versichert;";
    const leakedText = "Kosten der Wiederauffüllung der Aushubgrube";
    const exactText = `${contextText}\n- ${leakedText}`;
    occurrence.exactText = exactText;
    occurrence.documentStart = 2_000;
    occurrence.documentEnd = 2_000 + exactText.length;
    occurrence.context = {
      unitType: "LIST_ITEM",
      text: contextText,
      documentStart: 2_000,
      documentEnd: 2_000 + contextText.length,
    };

    const [row] = buildCategoryTableRows(input);

    expect(row.source).toContain("sechsmonatigen Zwischenlagerung");
    expect(row.source).not.toContain(leakedText);
  });

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
    ).toMatchObject({
      documentedContent:
        "Rahmenbedingung (FRAMEWORK_TERMS): Indexart: geregelt",
      coverage: "Ja",
      reviewStatus: "BELEGT",
    });
  });

  test("renders a complete limit-only category as BELEGT instead of partial", () => {
    const input = fixture({
      id: "FE-A06",
      label: "Betragsgrenze für Überspannungsschäden",
      requestedFields: ["limit"],
      componentEffects: [COVERAGE_EFFECT.DEFINED],
      selected: [true],
      fieldResult: {
        requirementId: "FE-A06",
        requestedFieldStatus: "COMPLETE",
        fields: [
          {
            field: "limit",
            status: "FOUND",
            facts: [
              {
                normalizedValue: "EUR 10.000",
                source: { candidateId: "candidate:0" },
              },
            ],
          },
        ],
      },
    });
    input.worksheet.requirements[0].components[0].factRole = "LIMIT";

    expect(buildCategoryTableRows(input)[0]).toMatchObject({
      coverage: "Ja",
      coverageAmount: "EUR 10.000",
      reviewStatus: "BELEGT",
    });
  });

  test("renders a complete defined value in its declared host scope as BELEGT", () => {
    const input = fixture({
      id: "EL-01",
      label: "Elementar-Sublimit pro Schadenereignis",
      requestedFields: ["limit"],
      componentEffects: [COVERAGE_EFFECT.DEFINED],
      selected: [true],
      scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
      fieldResult: {
        requirementId: "EL-01",
        requestedFieldStatus: "COMPLETE",
        fields: [
          {
            field: "limit",
            status: "FOUND",
            facts: [
              {
                normalizedValue: "EUR 20.000 auf Erstes Risiko",
                source: { candidateId: "candidate:0" },
              },
            ],
          },
        ],
      },
    });
    input.worksheet.requirements[0].components[0].factRole = "LIMIT";
    input.materializedEvidence.judgements[0].selectedScopePicture =
      "NARROW_ONLY";

    expect(buildCategoryTableRows(input)[0]).toMatchObject({
      coverage: "Ja",
      coverageAmount: "EUR 20.000 auf Erstes Risiko",
      reviewStatus: "BELEGT",
    });
  });

  test("renders one evidenced LW-08 wording as complete without inventing its alternative", () => {
    const input = fixture({
      id: "LW-08",
      label: "Leckortungs- und Suchkosten, Höhe des Limits",
      requestedFields: ["limit"],
      componentEffects: [COVERAGE_EFFECT.UNKNOWN, COVERAGE_EFFECT.INCLUDED],
      selected: [false, true],
      componentSatisfactionPolicy: "ANY",
      fieldResult: {
        requirementId: "LW-08",
        requestedFieldStatus: "COMPLETE",
        fields: [
          {
            field: "limit",
            status: "FOUND",
            facts: [
              {
                normalizedValue: "EUR 2.500",
                source: { candidateId: "candidate:1" },
              },
            ],
          },
        ],
      },
      candidateContext:
        "Suchkosten zur Auffindung der Schadensstelle bis EUR 2.500",
    });

    const [row] = buildCategoryTableRows(input);

    expect(row).toMatchObject({
      documentedContent: expect.stringContaining(
        "Bestandteil 2: eingeschlossen"
      ),
      coverage: "Ja",
      coverageAmount: "EUR 2.500",
      reviewStatus: "BELEGT",
    });
    expect(row.documentedContent).not.toContain("Bestandteil 1");
  });

  test("renders variant-qualified values and quotes a preceding list governor", () => {
    const governor =
      "Folgende Erweiterungen gelten mit einer Versicherungssumme von € 7.500 auf Erstes Risiko mitversichert:";
    const input = fixture({
      id: "LW-27",
      label: "Wasserverlustkosten",
      requestedFields: ["limit"],
      fieldResult: {
        requirementId: "LW-27",
        requestedFieldStatus: "COMPLETE",
        fields: [
          {
            field: "limit",
            status: "FOUND",
            facts: [
              {
                rawValue: "€ 7.500",
                normalizedValue: "EUR 7.500",
                qualifier: "auf Erstes Risiko",
                variantScope: { key: "C_DECKUNG", label: "C-Deckung" },
                source: {
                  candidateId: "candidate:0",
                  documentStart: 50,
                  documentEnd: 57,
                },
              },
              {
                rawValue: "EUR 10.000",
                normalizedValue: "EUR 10.000",
                qualifier: "je Schadenfall",
                variantScope: { key: "D_DECKUNG", label: "D-Deckung" },
                source: { candidateId: "candidate:1" },
              },
            ],
          },
        ],
      },
    });
    const first = input.worksheet.requirements[0].components[0].occurrences[0];
    const amountOffset = governor.indexOf("€ 7.500");
    first.fieldGovernorHint = {
      text: governor,
      documentStart: 0,
      documentEnd: governor.length,
    };
    input.requestedFieldMaterialization.requirements[0].fields[0].facts[0].source.documentStart =
      amountOffset;
    input.requestedFieldMaterialization.requirements[0].fields[0].facts[0].source.documentEnd =
      amountOffset + "€ 7.500".length;

    const [row] = buildCategoryTableRows(input);
    expect(row).toMatchObject({
      coverage: "Ja",
      coverageAmount:
        "C-Deckung: EUR 7.500 auf Erstes Risiko; D-Deckung: EUR 10.000 je Schadenfall",
      reviewStatus: "BELEGT",
    });
    expect(row.source).toContain("€ 7.500");
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
      coverage: "Gemischt",
      reviewStatus: "BELEGT",
    });
  });

  test.each([
    ["LW-03", "Zuleitungsrohre außerhalb des Gebäudes auf dem Grundstück"],
    ["LW-04", "Ableitungsrohre außerhalb des Gebäudes auf dem Grundstück"],
  ])(
    "renders %s covered pipe subject to a complete scope condition as BELEGT plus Ja",
    (id, label) => {
      const scopeField = {
        requirementId: id,
        requestedFieldStatus: "COMPLETE",
        fields: [
          {
            field: "scope",
            status: "FOUND",
            facts: [
              {
                normalizedValue: "außerhalb des Gebäudes auf dem Grundstück",
                source: { candidateId: "candidate:0" },
              },
            ],
          },
        ],
      };
      const input = fixture({
        id,
        label,
        requestedFields: ["scope"],
        componentEffects: [
          COVERAGE_EFFECT.INCLUDED,
          COVERAGE_EFFECT.CONDITIONAL,
        ],
        selected: [true, true],
        fieldResult: scopeField,
      });
      const [coveredObject, condition] =
        input.worksheet.requirements[0].components;
      coveredObject.factRole = "INSURED_OBJECT";
      condition.factRole = "CONDITION";
      input.materializedEvidence.judgements.forEach((judgement) => {
        judgement.selectedScopePicture = "GENERAL";
      });
      input.materializedEvidence.rollups[0] = {
        ...rollupCategoryResult({
          categoryId: id,
          requiredComponentIds: [coveredObject.id, condition.id],
          coverageComponentIds: [coveredObject.id],
          componentResults: input.materializedEvidence.judgements,
        }),
        requestedFields: ["scope"],
      };

      expect(buildCategoryTableRows(input)[0]).toMatchObject({
        documentedContent:
          "Bestandteil 1: eingeschlossen; Bestandteil 2: bedingt geregelt; Geltungsbereich: außerhalb des Gebäudes auf dem Grundstück",
        coverage: "Ja",
        reviewStatus: "BELEGT",
      });
    }
  );

  test("keeps mixed component effects partial when a requested value is missing", () => {
    const [row] = buildCategoryTableRows(
      fixture({
        requestedFields: ["limit"],
        componentEffects: [COVERAGE_EFFECT.INCLUDED, COVERAGE_EFFECT.EXCLUDED],
        fieldResult: {
          requirementId: "VS-21",
          requestedFieldStatus: "NOT_FOUND",
          fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
        },
      })
    );

    expect(row).toMatchObject({
      coverage: "Nicht feststellbar",
      coverageAmount: "Nicht feststellbar",
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

  test("renders definitive included and excluded effects in an allowed host scope as complete mixed coverage", () => {
    const input = fixture({
      id: "EL-15",
      label: "Sonderverglasung wie Isolier- oder Sicherheitsglas",
      requestedFields: [],
      componentEffects: [COVERAGE_EFFECT.INCLUDED, COVERAGE_EFFECT.EXCLUDED],
      selected: [true, true],
      scopePolicy: "MATCHING_SCOPE_DEFINITIVE_SUFFICIENT",
    });
    input.worksheet.requirements[0].components.forEach((component) => {
      component.factRole = "INSURED_OBJECT";
    });
    input.materializedEvidence.judgements.forEach((judgement) => {
      judgement.selectedScopePicture = "NARROW_ONLY";
    });

    expect(buildCategoryTableRows(input)[0]).toMatchObject({
      coverage: "Gemischt",
      reviewStatus: "BELEGT",
    });
  });

  test("keeps an optional supporting condition in narrow scope partial", () => {
    const input = fixture({
      id: "EL-05",
      label: "Starkregen und Oberflächenwasser",
      requestedFields: [],
      componentEffects: [COVERAGE_EFFECT.INCLUDED, COVERAGE_EFFECT.OPTION_ONLY],
      selected: [true, true],
      scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
    });
    const [peril, condition] = input.worksheet.requirements[0].components;
    peril.factRole = "PERIL";
    condition.factRole = "CONDITION";
    input.materializedEvidence.judgements.forEach((judgement) => {
      judgement.selectedScopePicture = "NARROW_ONLY";
    });

    expect(buildCategoryTableRows(input)[0]).toMatchObject({
      coverage: "Nicht feststellbar",
      reviewStatus: "TEILBELEGT",
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

  test("renders a verified cross-page clause governor beside its body source", () => {
    const fieldResult = completeLimit();
    const input = fixture({ fieldResult });
    const occurrence =
      input.worksheet.requirements[0].components[0].occurrences[0];
    const governorText =
      "- Aufräumkosten auf Erstes Risiko (Besondere Bedingung 12PA0130) EUR6.121.600,00";
    const governorStart = 5_000;
    const amountStart = governorStart + governorText.indexOf("EUR6.121.600,00");
    const fingerprint = "f".repeat(64);
    input.worksheet.document = {
      fingerprint,
      physicalPages: 10,
      pageContentLength: 10_000,
    };
    occurrence.exactClauseCodeFieldGovernorHints = [
      {
        contractId: "SAME_DOCUMENT_EXACT_CLAUSE_CODE_FIELD_GOVERNOR_V1",
        clauseCode: "12PA0130",
        documentFingerprint: fingerprint,
        scopeKey: "FEUER_INSURANCE",
        physicalPageNumber: 1,
        documentStart: governorStart,
        documentEnd: governorStart + governorText.length,
        text: governorText,
        amountDocumentStart: amountStart,
        amountDocumentEnd: amountStart + "EUR6.121.600,00".length,
        amountText: "EUR6.121.600,00",
      },
    ];
    fieldResult.fields[0].facts[0] = {
      rawValue: "EUR6.121.600,00",
      normalizedValue: "EUR 6.121.600,00",
      exactClauseCodeFieldGovernor: {
        contractId: "SAME_DOCUMENT_EXACT_CLAUSE_CODE_FIELD_GOVERNOR_V1",
        clauseCode: "12PA0130",
        documentFingerprint: fingerprint,
        scopeKey: "FEUER_INSURANCE",
      },
      source: {
        candidateId: "candidate:0",
        physicalPageNumber: 1,
        documentStart: amountStart,
        documentEnd: amountStart + "EUR6.121.600,00".length,
        exactText: "EUR6.121.600,00",
      },
    };

    const [row] = buildCategoryTableRows(input);
    expect(row.source).toContain("PDF-Seite 3");
    expect(row.source).toContain("PDF-Seite 1");
    expect(row.source).toContain("EUR6.121.600,00");
  });

  test("rejects a tampered cross-page clause-governor fact", () => {
    const fieldResult = completeLimit();
    const input = fixture({ fieldResult });
    const occurrence =
      input.worksheet.requirements[0].components[0].occurrences[0];
    const governorText =
      "- Aufräumkosten auf Erstes Risiko (Besondere Bedingung 12PA0130) EUR6.121.600,00";
    const governorStart = 5_000;
    const amountStart = governorStart + governorText.indexOf("EUR6.121.600,00");
    const fingerprint = "f".repeat(64);
    input.worksheet.document = {
      fingerprint,
      physicalPages: 10,
      pageContentLength: 10_000,
    };
    occurrence.exactClauseCodeFieldGovernorHints = [
      {
        contractId: "SAME_DOCUMENT_EXACT_CLAUSE_CODE_FIELD_GOVERNOR_V1",
        clauseCode: "12PA0130",
        documentFingerprint: fingerprint,
        scopeKey: "FEUER_INSURANCE",
        physicalPageNumber: 1,
        documentStart: governorStart,
        documentEnd: governorStart + governorText.length,
        text: governorText,
        amountDocumentStart: amountStart,
        amountDocumentEnd: amountStart + "EUR6.121.600,00".length,
        amountText: "EUR6.121.600,00",
      },
    ];
    fieldResult.fields[0].facts[0] = {
      rawValue: "EUR6.121.600,00",
      normalizedValue: "EUR 6.121.600,00",
      exactClauseCodeFieldGovernor: {
        contractId: "SAME_DOCUMENT_EXACT_CLAUSE_CODE_FIELD_GOVERNOR_V1",
        clauseCode: "12PA0130",
        documentFingerprint: fingerprint,
        scopeKey: "FEUER_INSURANCE",
      },
      source: {
        candidateId: "candidate:0",
        physicalPageNumber: 999,
        documentStart: amountStart,
        documentEnd: amountStart + "EUR6.121.600,00".length,
        exactText: "EUR6.121.600,00",
      },
    };

    const [row] = buildCategoryTableRows(input);
    expect(row.coverageAmount).toBe("Nicht feststellbar");
    expect(row.reviewStatus).toBe("TEILBELEGT");
    expect(row.source).not.toContain("PDF-Seite 999");
    expect(row.source).not.toContain("EUR6.121.600,00");
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
