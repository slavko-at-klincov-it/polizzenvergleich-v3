const {
  FIELD_EVIDENCE_STATUS,
  REQUESTED_FIELD_STATUS,
  materializeRequestedFieldEvidence,
} = require("../../../utils/policyAnalysis/requestedFieldEvidenceContract");

function occurrence({
  candidateId,
  requirementId,
  text,
  contextStart,
  pageNumber = 7,
  physicalPageNumber = pageNumber,
  printedPageLabel = null,
  bindingGroupId = null,
}) {
  const matched =
    requirementId === "VS-21" ? "Aufräumkosten" : "Mietzinsentgang";
  const matchedStart = text.indexOf(matched);
  return {
    candidateId,
    pageNumber,
    physicalPageNumber,
    printedPageLabel,
    bindingGroupId,
    exactText: matched,
    documentStart: contextStart + matchedStart,
    documentEnd: contextStart + matchedStart + matched.length,
    context: {
      unitType: "PARAGRAPH",
      text,
      documentStart: contextStart,
      documentEnd: contextStart + text.length,
    },
  };
}

function worksheet({ limitOccurrences = [], durationOccurrences = [] } = {}) {
  return {
    candidateOnly: true,
    requirements: [
      {
        id: "VS-16",
        label: "Garagen und Tiefgarage mitversichert",
        requestedFields: [],
        components: [],
      },
      {
        id: "VS-21",
        label: "Aufräum- und Abbruchkosten, Höhe des Limits",
        requestedFields: ["limit"],
        components: [
          {
            id: "cleanup_costs",
            label: "Aufräumkosten",
            factRole: "COST",
            occurrences: limitOccurrences,
          },
        ],
      },
      {
        id: "VS-28",
        label: "Mietzinsentgang, Dauer der Leistung",
        requestedFields: ["duration"],
        components: [
          {
            id: "rent_loss",
            label: "Mietzinsentgang",
            factRole: "BENEFIT",
            occurrences: durationOccurrences,
          },
        ],
      },
    ],
  };
}

function selections(...entries) {
  return entries.map(([candidateId, binding]) => ({ candidateId, binding }));
}

function textualOccurrence({ candidateId, text, exactText, contextStart = 0 }) {
  const matchStart = text.indexOf(exactText);
  return {
    candidateId,
    pageNumber: 8,
    physicalPageNumber: 8,
    exactText,
    documentStart: contextStart + matchStart,
    documentEnd: contextStart + matchStart + exactText.length,
    context: {
      unitType: "CLAUSE_SECTION",
      text,
      documentStart: contextStart,
      documentEnd: contextStart + text.length,
    },
  };
}

function textualWorksheet(requirement) {
  return { candidateOnly: true, requirements: [requirement] };
}

function variantOccurrence({
  candidateId,
  variantKey,
  variantLabel,
  text,
  exactText,
  contextStart,
  fieldGovernorText,
  fieldGovernorStart,
}) {
  const base = textualOccurrence({
    candidateId,
    text,
    exactText,
    contextStart,
  });
  return {
    ...base,
    context: { ...base.context, unitType: "LIST_ITEM" },
    coverageGovernorHint: {
      text: `Zusätzlich sind in der ${variantLabel} versichert`,
    },
    variantScopeHint: {
      key: variantKey,
      label: variantLabel,
      source: "CURRENT_PAGE_HEADING",
    },
    ...(fieldGovernorText
      ? {
          fieldGovernorHint: {
            text: fieldGovernorText,
            documentStart: fieldGovernorStart,
            documentEnd: fieldGovernorStart + fieldGovernorText.length,
            source: "CURRENT_PAGE_FIELD_GOVERNOR",
          },
        }
      : {}),
  };
}

describe("requestedFieldEvidenceContract", () => {
  test("keeps legal abbreviations inside one textual condition sentence", () => {
    const candidateId = "candidate:FE-E16:legal-condition";
    const text =
      "Die Verletzung dieser Verpflichtungen führt nach Maßgabe des § 6 Abs. 3 und Art. 11 Abs. 2 lit. c VersVG zur\nLeistungsfreiheit des Versicherers. Ein anderer Satz folgt.";
    const source = textualOccurrence({
      candidateId,
      text,
      exactText: "Verletzung dieser Verpflichtungen",
    });
    source.context.unitType = "PARAGRAPH";
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "FE-E16",
        label:
          "Rechtsfolgen einer Obliegenheitsverletzung, Kürzung oder Leistungsfreiheit",
        requestedFields: ["condition"],
        components: [
          {
            id: "obligation_breach_consequences",
            factRole: "CONDITION",
            occurrences: [source],
          },
        ],
      }),
      materializedCandidates: selections([candidateId, "DIRECT"]),
    });

    expect(result.requirements[0].fields[0].facts).toEqual([
      expect.objectContaining({
        normalizedValue:
          "Die Verletzung dieser Verpflichtungen führt nach Maßgabe des § 6 Abs. 3 und Art. 11 Abs. 2 lit. c VersVG zur Leistungsfreiheit des Versicherers",
      }),
    ]);
  });

  test("keeps a fallback-window condition together across connector line wraps", () => {
    const candidateId = "candidate:FE-E16:wrapped-condition";
    const text =
      "Versichert gelten Verletzungen von vereinbarten Obliegenheiten gemäß Allgemeinen und\nBesonderen Bedingungen. Eine andere Regel folgt.";
    const source = textualOccurrence({
      candidateId,
      text,
      exactText: "Verletzungen von vereinbarten Obliegenheiten",
    });
    source.context.unitType = "WORD_WINDOW_FALLBACK";
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "FE-E16",
        label: "Rechtsfolgen einer Obliegenheitsverletzung",
        requestedFields: ["condition"],
        components: [
          {
            id: "obligation_breach_consequences",
            factRole: "CONDITION",
            occurrences: [source],
          },
        ],
      }),
      materializedCandidates: selections([candidateId, "DIRECT"]),
    });

    expect(result.requirements[0].fields[0].facts).toEqual([
      expect.objectContaining({
        normalizedValue:
          "Versichert gelten Verletzungen von vereinbarten Obliegenheiten gemäß Allgemeinen und Besonderen Bedingungen",
      }),
    ]);
  });

  test("keeps capped and explicitly unbounded limits separate by variant", () => {
    const cId = "candidate:LW-26:C";
    const dId = "candidate:LW-26:D";
    const c = variantOccurrence({
      candidateId: cId,
      variantKey: "C_DECKUNG",
      variantLabel: "C-Deckung",
      text: "Kosten der Rohrreinigung bis höchstens € 2.000,- je Schadenfall.",
      exactText: "Kosten der Rohrreinigung",
      contextStart: 1000,
    });
    const d = variantOccurrence({
      candidateId: dId,
      variantKey: "D_DECKUNG",
      variantLabel: "D-Deckung",
      text: "Kosten der Rohrreinigung ohne betragliche Beschränkung pro Schadenfall.",
      exactText: "Kosten der Rohrreinigung",
      contextStart: 2000,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "LW-26",
        label: "Rohrreinigung",
        requestedFields: ["limit"],
        components: [{ id: "cleaning", factRole: "COST", occurrences: [c, d] }],
      }),
      materializedCandidates: selections([cId, "DIRECT"], [dId, "DIRECT"]),
    });

    expect(result.requirements[0].requestedFieldStatus).toBe(
      REQUESTED_FIELD_STATUS.COMPLETE
    );
    expect(result.requirements[0].fields[0].facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedValue: "EUR 2.000",
          limitKind: "CAPPED",
          qualifier: "je Schadenfall",
          variantScope: expect.objectContaining({ key: "C_DECKUNG" }),
        }),
        expect.objectContaining({
          normalizedValue: "ohne betragliche Beschränkung",
          limitKind: "UNBOUNDED",
          qualifier: "je Schadenfall",
          variantScope: expect.objectContaining({ key: "D_DECKUNG" }),
        }),
      ])
    );
  });

  test("uses a server-authoritative variant binding for values after unresolved model triage", () => {
    const candidateId = "candidate:LW-26:D:unresolved";
    const occurrence = variantOccurrence({
      candidateId,
      variantKey: "D_DECKUNG",
      variantLabel: "D-Deckung",
      text: "Kosten der Rohrreinigung ohne betragliche Beschränkung pro Schadenfall.",
      exactText: "Kosten der Rohrreinigung",
      contextStart: 3_000,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "LW-26",
        label: "Rohrverstopfung und Reinigungskosten",
        requestedFields: ["limit"],
        components: [
          {
            id: "cleaning_costs",
            label: "Reinigungskosten",
            factRole: "COST",
            occurrences: [occurrence],
          },
        ],
      }),
      materializedCandidates: selections([candidateId, "UNRESOLVED"]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.COMPLETE,
      fields: [
        {
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: [
            {
              normalizedValue: "ohne betragliche Beschränkung",
              limitKind: "UNBOUNDED",
              qualifier: "je Schadenfall",
              variantScope: { key: "D_DECKUNG", label: "D-Deckung" },
              binding: "DIRECT",
            },
          ],
        },
      ],
    });
  });

  test("binds a preceding list governor and stays partial until every selected variant has a value", () => {
    const cId = "candidate:LW-27:C";
    const dId = "candidate:LW-27:D";
    const governor =
      "Folgende Haftungserweiterungen gelten mit einer Versicherungssumme von € 7.500 auf „Erstes Risiko“ mitversichert:";
    const c = variantOccurrence({
      candidateId: cId,
      variantKey: "C_DECKUNG",
      variantLabel: "C-Deckung",
      text: "Kosten für den Wasserverlust nach einem ersatzpflichtigen Schaden.",
      exactText: "Kosten für den Wasserverlust",
      contextStart: 1200,
      fieldGovernorText: governor,
      fieldGovernorStart: 1000,
    });
    const d = variantOccurrence({
      candidateId: dId,
      variantKey: "D_DECKUNG",
      variantLabel: "D-Deckung",
      text: "Kosten für den Wasserverlust bis höchstens € 10.000,00 je Schadenfall.",
      exactText: "Kosten für den Wasserverlust",
      contextStart: 2200,
    });
    const requirement = {
      id: "LW-27",
      label: "Wasserverlustkosten",
      requestedFields: ["limit"],
      components: [{ id: "water_loss", factRole: "COST", occurrences: [c, d] }],
    };
    const complete = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet(requirement),
      materializedCandidates: selections([cId, "DIRECT"], [dId, "DIRECT"]),
    });

    expect(complete.requirements[0].requestedFieldStatus).toBe(
      REQUESTED_FIELD_STATUS.COMPLETE
    );
    expect(complete.requirements[0].fields[0].facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedValue: "EUR 7.500",
          qualifier: "auf Erstes Risiko",
          variantScope: expect.objectContaining({ key: "C_DECKUNG" }),
        }),
        expect.objectContaining({
          normalizedValue: "EUR 10.000,00",
          qualifier: "je Schadenfall",
          variantScope: expect.objectContaining({ key: "D_DECKUNG" }),
        }),
      ])
    );

    const dWithoutValue = {
      ...d,
      context: {
        ...d.context,
        text: "Kosten für den Wasserverlust sind versichert.",
        documentEnd:
          d.context.documentStart +
          "Kosten für den Wasserverlust sind versichert.".length,
      },
    };
    dWithoutValue.documentEnd =
      dWithoutValue.documentStart + dWithoutValue.exactText.length;
    const partial = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        ...requirement,
        components: [
          {
            id: "water_loss",
            factRole: "COST",
            occurrences: [c, dWithoutValue],
          },
        ],
      }),
      materializedCandidates: selections([cId, "DIRECT"], [dId, "DIRECT"]),
    });
    expect(partial.requirements[0].fields[0].status).toBe(
      FIELD_EVIDENCE_STATUS.PARTIAL
    );
    expect(partial.requirements[0].requestedFieldStatus).toBe(
      REQUESTED_FIELD_STATUS.PARTIAL
    );
  });

  test.each([
    {
      id: "ST-01",
      field: "threshold",
      factRole: "DEFINITION",
      text: "Sturm ist Wind mit Spitzengeschwindigkeiten von mehr als 60 km/h.",
      exactText: "Wind mit Spitzengeschwindigkeiten von mehr als",
      expected: "60 km/h",
    },
    {
      id: "ST-11",
      field: "limit",
      factRole: "LIMIT",
      text: "Dachrinnen und Außenablaufrohre sind bis EUR 15.000 versichert.",
      exactText: "Dachrinnen und Außenablaufrohre",
      expected: "EUR 15.000",
    },
    {
      id: "HP-01",
      field: "limit",
      factRole: "LIMIT",
      text: "Die Pauschaldeckungssumme beträgt € 2.000.000,-.",
      exactText: "Pauschaldeckungssumme",
      expected: "EUR 2.000.000",
    },
    {
      id: "EL-16",
      field: "limit",
      factRole: "INSURED_OBJECT",
      text: "Wintergärten sind bis zu einer Einzelscheibengröße von 10m² versichert.",
      exactText: "Wintergärten",
      expected: "Einzelscheibengröße bis 10 m²",
    },
    {
      id: "ST-02",
      field: "condition",
      factRole: "CONDITION",
      text: "Der Nachweis der Windstärke ist durch die maßgebliche Messstelle zu erbringen.",
      exactText: "Nachweis der Windstärke",
      expected:
        "Der Nachweis der Windstärke ist durch die maßgebliche Messstelle zu erbringen",
    },
  ])(
    "extracts the generic $field field for $id with source-bound text",
    ({ id, field, factRole, text, exactText, expected }) => {
      const candidateId = `candidate:${id}:${field}`;
      const source = textualOccurrence({
        candidateId,
        text,
        exactText,
        contextStart: 700,
      });
      const result = materializeRequestedFieldEvidence({
        worksheet: textualWorksheet({
          id,
          label: id,
          requestedFields: [field],
          components: [
            {
              id: `${field}-component`,
              factRole,
              occurrences: [source],
            },
          ],
        }),
        materializedCandidates: selections([candidateId, "DIRECT"]),
      });
      const extracted = result.requirements[0].fields[0];

      expect(extracted.status).toBe(FIELD_EVIDENCE_STATUS.FOUND);
      expect(extracted.facts[0]).toMatchObject({
        normalizedValue: expected,
        source: {
          candidateId,
          documentStart: expect.any(Number),
          documentEnd: expect.any(Number),
        },
      });
      expect(
        text.slice(
          extracted.facts[0].source.documentStart - 700,
          extracted.facts[0].source.documentEnd - 700
        )
      ).toBe(extracted.facts[0].rawValue);
    }
  );

  test("does not bind an unrelated date from a neighboring sentence", () => {
    const candidateId = "candidate:VB-03:date";
    const source = textualOccurrence({
      candidateId,
      text: "Vertragsbeginn ist der 01.01.2026. Die ordentliche Kündigung ist möglich.",
      exactText: "ordentliche Kündigung",
      contextStart: 900,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VB-03",
        label: "Kündigungstermin",
        requestedFields: ["date"],
        components: [
          {
            id: "termination_date",
            factRole: "CONDITION",
            occurrences: [source],
          },
        ],
      }),
      materializedCandidates: selections([candidateId, "DIRECT"]),
    });

    expect(result.requirements[0].fields[0]).toMatchObject({
      field: "date",
      status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
      facts: [],
    });
  });

  test("materializes the conditional nature and exact prerequisites of the WEVIG waiver clause", () => {
    const text = [
      "Wertanpassung nach dem Baukostenindex10PA0400",
      "3.Die Vorschriften über Unterversicherung finden im Schadenfall nur Anwendung, wenn",
      "a) zum Zeitpunkt der Vereinbarung dieser Wertanpassungsklausel die Versicherungssumme nicht dem tatsächlichen Wert entsprochen hat;",
      "b) die nach dem Zeitpunkt der Vereinbarung dieser Wertanpassungsklausel geänderte Versicherungssumme nicht dem tatsächlichen Wert entsprochen hat;",
      "c) die infolge von Veränderungen der versicherten Sachen entstandene Wertsteigerung nicht durch entsprechende Erhöhung der Versicherungssumme Berücksichtigung fand.",
      "4.Bei Bestehen mehrfacher Versicherungen für dasselbe Interesse bezieht sich der Verzicht nur auf jenen Teil, der dem damaligen Versicherungswert entspricht.",
    ].join("\n");
    const conditionOccurrence = textualOccurrence({
      candidateId: "candidate:vs08-condition",
      text,
      exactText: "im Schadenfall nur Anwendung, wenn",
    });
    const prerequisiteOccurrence = textualOccurrence({
      candidateId: "candidate:vs09-prerequisites",
      text,
      exactText: "zum Zeitpunkt der Vereinbarung dieser Wertanpassungsklausel",
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VS-08",
        label: "Bedingter Unterversicherungsverzicht",
        requestedFields: ["condition"],
        components: [
          {
            id: "underinsurance_waiver_condition",
            occurrences: [conditionOccurrence],
          },
        ],
      }),
      materializedCandidates: selections([
        "candidate:vs08-condition",
        "DIRECT",
      ]),
    });
    const prerequisites = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VS-09",
        label: "Voraussetzungen",
        requestedFields: ["condition"],
        components: [
          {
            id: "underinsurance_waiver_prerequisites",
            occurrences: [prerequisiteOccurrence],
          },
        ],
      }),
      materializedCandidates: selections([
        "candidate:vs09-prerequisites",
        "DIRECT",
      ]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.COMPLETE,
      fields: [
        {
          field: "condition",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: [expect.objectContaining({ normalizedValue: "bedingt" })],
        },
      ],
    });
    expect(
      prerequisites.requirements[0].fields[0].facts.map(
        ({ normalizedValue }) => normalizedValue
      )
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("zum Zeitpunkt der Vereinbarung"),
        expect.stringContaining("nach dem Zeitpunkt der Vereinbarung"),
        expect.stringContaining("infolge von Veränderungen"),
        expect.stringContaining("mehrfacher Versicherungen"),
      ])
    );
  });

  test.each([
    [
      "Die Aufwertung erfolgt nach dem Baukostenindex für den Wohnungs- und Siedlungsbau.",
      "Baukostenindex für den Wohnungs- und Siedlungsbau",
    ],
    [
      "Statistik Austria veröffentlicht den Baukostenindex (Baumeisterarbeiten).",
      "Baukostenindex (Baumeisterarbeiten)",
    ],
  ])("binds the index type from %s", (text, normalizedValue) => {
    const source = textualOccurrence({
      candidateId: `candidate:index:${normalizedValue}`,
      text,
      exactText: "Baukostenindex",
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VS-11",
        label: "Indexart",
        requestedFields: ["index_type"],
        components: [{ id: "index_type", occurrences: [source] }],
      }),
      materializedCandidates: selections([
        `candidate:index:${normalizedValue}`,
        "DIRECT",
      ]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.COMPLETE,
      fields: [
        {
          field: "index_type",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: [expect.objectContaining({ normalizedValue })],
        },
      ],
    });
  });
  test("normalizes OCR l0% while preserving raw text and exact server-owned source", () => {
    const text = "Aufräumkosten sind bis l0% der Versicherungssumme gedeckt.";
    const source = occurrence({
      candidateId: "candidate:limit-ocr",
      requirementId: "VS-21",
      text,
      contextStart: 500,
      pageNumber: 9,
      physicalPageNumber: 11,
      printedPageLabel: "Seite 9",
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: worksheet({ limitOccurrences: [source] }),
      materializedCandidates: selections(["candidate:limit-ocr", "DIRECT"]),
    });

    const limit = result.requirements.find(
      ({ requirementId }) => requirementId === "VS-21"
    );
    const valueStart = text.indexOf("l0%");
    expect(limit).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.COMPLETE,
      fields: [
        {
          field: "limit",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: [
            {
              rawValue: "l0%",
              normalizedValue: "10 %",
              valueType: "PERCENT",
              unit: "%",
              binding: "DIRECT",
              source: {
                candidateId: "candidate:limit-ocr",
                pageNumber: 9,
                physicalPageNumber: 11,
                printedPageLabel: "Seite 9",
                documentStart: 500 + valueStart,
                documentEnd: 500 + valueStart + 3,
                exactText: "l0%",
              },
            },
          ],
        },
      ],
    });
  });

  test("extracts a compact EUR amount without allowing the model to author its source", () => {
    const text = "Aufräumkosten: Versicherungssumme EUR6.121.600,00.";
    const source = occurrence({
      candidateId: "candidate:limit-eur",
      requirementId: "VS-21",
      text,
      contextStart: 1_200,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: worksheet({ limitOccurrences: [source] }),
      materializedCandidates: [
        {
          candidateId: "candidate:limit-eur",
          binding: "DIRECT",
          context: {
            text: "Aufräumkosten: EUR999.999.999,00",
            documentStart: 0,
          },
          pageNumber: 999,
        },
      ],
    });

    expect(result.requirements[1].fields[0].facts[0]).toMatchObject({
      rawValue: "EUR6.121.600,00",
      normalizedValue: "EUR 6.121.600,00",
      valueType: "MONEY",
      unit: "EUR",
      source: {
        candidateId: "candidate:limit-eur",
        pageNumber: 7,
        documentStart: 1_200 + text.indexOf("EUR"),
        documentEnd: 1_200 + text.indexOf("EUR") + "EUR6.121.600,00".length,
        exactText: "EUR6.121.600,00",
      },
    });
  });

  test("preserves a decimal percentage instead of dropping its integer part", () => {
    const source = occurrence({
      candidateId: "candidate:decimal-percent",
      requirementId: "VS-21",
      text: "Aufräumkosten bis 1,5 % der Versicherungssumme.",
      contextStart: 40,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: worksheet({ limitOccurrences: [source] }),
      materializedCandidates: selections([
        "candidate:decimal-percent",
        "DIRECT",
      ]),
    });

    expect(
      result.requirements.find(({ requirementId }) => requirementId === "VS-21")
        .fields[0].facts[0]
    ).toMatchObject({ rawValue: "1,5 %", normalizedValue: "1,5 %" });
  });

  test.each([
    ["sechs Monaten", "6 Monate"],
    ["6 Monaten", "6 Monate"],
  ])("normalizes duration %s with exact offsets", (rawDuration, normalized) => {
    const text = `Mietzinsentgang wird während ${rawDuration} ersetzt.`;
    const source = occurrence({
      candidateId: `candidate:duration:${rawDuration}`,
      requirementId: "VS-28",
      text,
      contextStart: 2_000,
      pageNumber: 14,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: worksheet({ durationOccurrences: [source] }),
      materializedCandidates: selections([
        `candidate:duration:${rawDuration}`,
        "DIRECT",
      ]),
    });
    const fact = result.requirements[2].fields[0].facts[0];

    expect(fact).toMatchObject({
      rawValue: rawDuration,
      normalizedValue: normalized,
      valueType: "DURATION",
      unit: "MONTH",
      source: {
        documentStart: 2_000 + text.indexOf(rawDuration),
        documentEnd: 2_000 + text.indexOf(rawDuration) + rawDuration.length,
        exactText: rawDuration,
      },
    });
  });

  test.each([
    ["maximal dreimal", "dreimal", "3-fach"],
    ["höchstens 4-mal", "4-mal", "4-fach"],
  ])(
    "binds the annual aggregate %s as an exact multiple",
    (wording, rawValue, normalizedValue) => {
      const text = `Die maßgebende Pauschalversicherungssumme steht für alle Versicherungsfälle eines Jahres zusammen ${wording} zur Verfügung.`;
      const source = textualOccurrence({
        candidateId: `candidate:HP-02:${wording}`,
        text,
        exactText:
          "Pauschalversicherungssumme steht für alle Versicherungsfälle eines Jahres",
        contextStart: 5_000,
      });
      const result = materializeRequestedFieldEvidence({
        worksheet: textualWorksheet({
          id: "HP-02",
          label: "Jahreshöchstleistung als Vielfaches der Deckungssumme",
          requestedFields: ["limit", "condition"],
          components: [
            {
              id: "annual_aggregate_multiple",
              factRole: "LIMIT",
              occurrences: [source],
            },
          ],
        }),
        materializedCandidates: selections([
          `candidate:HP-02:${wording}`,
          "DIRECT",
        ]),
      });
      const requirement = result.requirements[0];
      const fact = requirement.fields.find(({ field }) => field === "limit")
        .facts[0];

      expect(requirement.requestedFieldStatus).toBe(
        REQUESTED_FIELD_STATUS.COMPLETE
      );
      expect(fact).toMatchObject({
        rawValue,
        normalizedValue,
        valueType: "MULTIPLE",
        unit: "MULTIPLE",
        limitKind: "CAPPED",
        source: {
          candidateId: `candidate:HP-02:${wording}`,
          documentStart: 5_000 + text.indexOf(rawValue),
          documentEnd: 5_000 + text.indexOf(rawValue) + rawValue.length,
          exactText: rawValue,
        },
      });
    }
  );

  test("keeps a dotted coverage-start date and the complete period condition", () => {
    const text = [
      "Der Versicherungsschutz beginnt erst mit Zugang der Polizze.",
      "Versicherungsbeginn 19.01.2026, 0:00 Uhr, Versicherungsablauf 01.01.2037, 0:00 Uhr",
    ].join("\n");
    const coverageStart = textualOccurrence({
      candidateId: "candidate:FE-F05:coverage-start",
      text,
      exactText: "Versicherungsbeginn",
      contextStart: 8_000,
    });
    const temporalValidity = textualOccurrence({
      candidateId: "candidate:FE-F05:temporal-validity",
      text,
      exactText: "Versicherungsablauf",
      contextStart: 8_000,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "FE-F05",
        label: "Zeitliche Geltung und Beginn des Versicherungsschutzes",
        requestedFields: ["condition", "date"],
        components: [
          {
            id: "temporal_validity",
            factRole: "CONDITION",
            occurrences: [temporalValidity],
          },
          {
            id: "coverage_start",
            factRole: "CONDITION",
            occurrences: [coverageStart],
          },
        ],
      }),
      materializedCandidates: selections(
        ["candidate:FE-F05:temporal-validity", "DIRECT"],
        ["candidate:FE-F05:coverage-start", "DIRECT"]
      ),
    });
    const requirement = result.requirements[0];
    const condition = requirement.fields.find(
      ({ field }) => field === "condition"
    );
    const date = requirement.fields.find(({ field }) => field === "date");

    expect(requirement.requestedFieldStatus).toBe(
      REQUESTED_FIELD_STATUS.COMPLETE
    );
    expect(
      condition.facts.map(({ normalizedValue }) => normalizedValue)
    ).toEqual([
      "Der Versicherungsschutz beginnt erst mit Zugang der Polizze",
      "Versicherungsbeginn 19.01.2026, 0:00 Uhr, Versicherungsablauf 01.01.2037, 0:00 Uhr",
    ]);
    expect(date).toMatchObject({
      status: FIELD_EVIDENCE_STATUS.FOUND,
      facts: [
        {
          rawValue: "19.01.2026",
          normalizedValue: "19.01.2026",
          valueType: "DATE",
          unit: null,
          source: {
            candidateId: "candidate:FE-F05:coverage-start",
            documentStart: 8_000 + text.indexOf("19.01.2026"),
            documentEnd:
              8_000 + text.indexOf("19.01.2026") + "19.01.2026".length,
            exactText: "19.01.2026",
          },
        },
      ],
    });
  });

  test.each([
    "Seite 1, gedruckt am 29.06.2026. Versicherungsbeginn wird separat bekanntgegeben.",
    "Versicherungsbeginn 19. Der vollständige Termin fehlt.",
  ])("does not bind an unrelated or incomplete start date: %s", (text) => {
    const exactText = "Versicherungsbeginn";
    const source = textualOccurrence({
      candidateId: `candidate:FE-F05:negative:${text}`,
      text,
      exactText,
      contextStart: 9_000,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "FE-F05",
        label: "Zeitliche Geltung und Beginn des Versicherungsschutzes",
        requestedFields: ["date"],
        components: [
          {
            id: "coverage_start",
            factRole: "CONDITION",
            occurrences: [source],
          },
        ],
      }),
      materializedCandidates: selections([
        `candidate:FE-F05:negative:${text}`,
        "DIRECT",
      ]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_FOUND,
      fields: [
        {
          field: "date",
          status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
          facts: [],
        },
      ],
    });
  });

  test.each([
    "Die Prämie wird dreimal jährlich bezahlt.",
    "Die Pauschalversicherungssumme steht maximal dreimal zur Verfügung.",
    "Für alle Versicherungsfälle eines Jahres sind maximal drei Meldungen zulässig.",
  ])("does not turn an unrelated count into an HP-02 multiple: %s", (text) => {
    const exactText = text.includes("Pauschalversicherungssumme")
      ? "Pauschalversicherungssumme"
      : text.includes("Versicherungsfälle")
        ? "Versicherungsfälle eines Jahres"
        : "dreimal jährlich";
    const source = textualOccurrence({
      candidateId: `candidate:HP-02:negative:${exactText}`,
      text,
      exactText,
      contextStart: 7_000,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "HP-02",
        label: "Jahreshöchstleistung als Vielfaches der Deckungssumme",
        requestedFields: ["limit"],
        components: [
          {
            id: "annual_aggregate_multiple",
            factRole: "LIMIT",
            occurrences: [source],
          },
        ],
      }),
      materializedCandidates: selections([
        `candidate:HP-02:negative:${exactText}`,
        "DIRECT",
      ]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_FOUND,
      fields: [
        {
          field: "limit",
          status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
          facts: [],
        },
      ],
    });
  });

  test("binds only total construction cost, not the adjacent HP-08 liability sublimit", () => {
    const candidateId = "candidate:HP-08:construction-sum";
    const text =
      "Bauherr - Umbau-, Neubau- und Sanierungshaftpflichtrisiko (Gesamtbaukosten EUR\n1.000.000) Sublimit EUR 3.000.000,00";
    const source = textualOccurrence({
      candidateId,
      text,
      exactText: "Gesamtbaukosten",
      contextStart: 8_000,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "HP-08",
        label: "Bauherrenhaftpflicht und bis zu welcher Bausumme",
        requestedFields: ["limit"],
        components: [
          {
            id: "construction_sum_limit",
            factRole: "LIMIT",
            occurrences: [source],
          },
        ],
      }),
      materializedCandidates: selections([candidateId, "DIRECT"]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.COMPLETE,
      fields: [
        {
          field: "limit",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: [
            expect.objectContaining({
              normalizedValue: "EUR 1.000.000",
              source: expect.objectContaining({
                exactText: "EUR\n1.000.000",
              }),
            }),
          ],
        },
      ],
    });
  });

  test("keeps both alternatives of a governed HP-08 construction-cost limit", () => {
    const candidateId = "candidate:HP-08:alternative-construction-sum";
    const text =
      "Bauvorhaben an der versicherten Liegenschaft mit Gesamtbaukosten des Bauvorhabens bis EUR 440.000,- oder 20% des Gebäudeneuwerts, wobei der jeweils höhere Wert gilt (Bauherrenhaftpflicht).";
    const source = textualOccurrence({
      candidateId,
      text,
      exactText: "Gesamtbaukosten des Bauvorhabens bis",
      contextStart: 9_000,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "HP-08",
        label: "Bauherrenhaftpflicht und bis zu welcher Bausumme",
        requestedFields: ["limit"],
        components: [
          {
            id: "construction_sum_limit",
            factRole: "LIMIT",
            occurrences: [source],
          },
        ],
      }),
      materializedCandidates: selections([candidateId, "DIRECT"]),
    });

    expect(
      result.requirements[0].fields[0].facts.map(
        ({ normalizedValue }) => normalizedValue
      )
    ).toEqual(["EUR 440.000", "20 %"]);
  });

  test("never binds values from mention-only or unresolved candidates", () => {
    const mention = occurrence({
      candidateId: "candidate:mention",
      requirementId: "VS-21",
      text: "Aufräumkosten in der Haftpflicht bis 50 %.",
      contextStart: 0,
    });
    const unresolved = occurrence({
      candidateId: "candidate:unresolved",
      requirementId: "VS-21",
      text: "Aufräumkosten möglicherweise bis EUR900.000,00.",
      contextStart: 100,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: worksheet({ limitOccurrences: [mention, unresolved] }),
      materializedCandidates: selections(
        ["candidate:mention", "MENTION_ONLY"],
        ["candidate:unresolved", "UNRESOLVED"]
      ),
    });

    expect(result.requirements[1]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_FOUND,
      fields: [
        {
          field: "limit",
          status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
          facts: [],
        },
      ],
    });
  });

  test("keeps DIRECT and NARROW_SCOPE facts with their independent sources", () => {
    const direct = occurrence({
      candidateId: "candidate:direct",
      requirementId: "VS-21",
      text: "Aufräumkosten sind bis 10 % gedeckt.",
      contextStart: 0,
    });
    const narrow = occurrence({
      candidateId: "candidate:narrow",
      requirementId: "VS-21",
      text: "Aufräumkosten für Sondermüll sind bis 5 % gedeckt.",
      contextStart: 100,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: worksheet({ limitOccurrences: [narrow, direct] }),
      materializedCandidates: selections(
        ["candidate:narrow", "NARROW_SCOPE"],
        ["candidate:direct", "DIRECT"]
      ),
    });

    expect(result.requirements[1].fields[0].facts).toEqual([
      expect.objectContaining({
        normalizedValue: "10 %",
        binding: "DIRECT",
        source: expect.objectContaining({ candidateId: "candidate:direct" }),
      }),
      expect.objectContaining({
        normalizedValue: "5 %",
        binding: "NARROW_SCOPE",
        source: expect.objectContaining({ candidateId: "candidate:narrow" }),
      }),
    ]);
  });

  test("keeps equal 27B values from direct and narrow sources on different pages", () => {
    const direct = occurrence({
      candidateId: "candidate:wevig-direct-page1",
      requirementId: "VS-21",
      text: "Aufräumkosten auf Erstes Risiko EUR6.121.600,00.",
      contextStart: 0,
      pageNumber: 1,
    });
    const narrow = occurrence({
      candidateId: "candidate:wevig-narrow-page4",
      requirementId: "VS-21",
      text: "Aufräumkosten in der Sturmsparte EUR6.121.600,00.",
      contextStart: 100,
      pageNumber: 4,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: worksheet({ limitOccurrences: [direct, narrow] }),
      materializedCandidates: selections(
        ["candidate:wevig-direct-page1", "DIRECT"],
        ["candidate:wevig-narrow-page4", "NARROW_SCOPE"]
      ),
    });

    expect(result.requirements[1].fields[0].facts).toEqual([
      expect.objectContaining({
        normalizedValue: "EUR 6.121.600,00",
        binding: "DIRECT",
        source: expect.objectContaining({
          candidateId: "candidate:wevig-direct-page1",
          physicalPageNumber: 1,
        }),
      }),
      expect.objectContaining({
        normalizedValue: "EUR 6.121.600,00",
        binding: "NARROW_SCOPE",
        source: expect.objectContaining({
          candidateId: "candidate:wevig-narrow-page4",
          physicalPageNumber: 4,
        }),
      }),
    ]);
  });

  test.each(["DIRECT", "NARROW_SCOPE"])(
    "does not promote a %s singleton value to a compound category limit",
    (binding) => {
      const cleanupOnly = occurrence({
        candidateId: "candidate:eco-cleanup-only",
        requirementId: "VS-21",
        text: "Aufräumkosten für Problemstoffe bis EUR 7.300,00.",
        contextStart: 0,
        pageNumber: 22,
        bindingGroupId: "binding-group:cleanup-and-demolition",
      });
      const input = worksheet({ limitOccurrences: [cleanupOnly] });
      input.requirements[1].components.push({
        id: "demolition_costs",
        label: "Abbruchkosten",
        factRole: "COST",
        occurrences: [],
      });

      const result = materializeRequestedFieldEvidence({
        worksheet: input,
        materializedCandidates: selections([
          "candidate:eco-cleanup-only",
          binding,
        ]),
      });

      expect(result.requirements[1]).toMatchObject({
        requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_FOUND,
        fields: [{ field: "limit", facts: [] }],
      });
    }
  );

  test("does not combine mixed bindings to complete a compound value group", () => {
    const cleanup = occurrence({
      candidateId: "candidate:mixed-cleanup",
      requirementId: "VS-21",
      text: "Aufräumkosten bis 10 %.",
      contextStart: 0,
      bindingGroupId: "binding-group:mixed",
    });
    const demolition = occurrence({
      candidateId: "candidate:mixed-demolition",
      requirementId: "VS-21",
      text: "Aufräumkosten und Abbruchkosten bis 10 %.",
      contextStart: 100,
      bindingGroupId: "binding-group:mixed",
    });
    const input = worksheet({ limitOccurrences: [cleanup] });
    input.requirements[1].components.push({
      id: "demolition_costs",
      label: "Abbruchkosten",
      factRole: "COST",
      occurrences: [demolition],
    });

    const result = materializeRequestedFieldEvidence({
      worksheet: input,
      materializedCandidates: selections(
        ["candidate:mixed-cleanup", "NARROW_SCOPE"],
        ["candidate:mixed-demolition", "DIRECT"]
      ),
    });

    expect(result.requirements[1]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_FOUND,
      fields: [{ field: "limit", facts: [] }],
    });
  });

  test("uses NARROW_SCOPE values only when no direct value is available", () => {
    const directWithoutValue = occurrence({
      candidateId: "candidate:direct-empty",
      requirementId: "VS-21",
      text: "Aufräumkosten sind mitversichert.",
      contextStart: 0,
    });
    const narrow = occurrence({
      candidateId: "candidate:narrow-value",
      requirementId: "VS-21",
      text: "Aufräumkosten für Sondermüll bis 5 %.",
      contextStart: 100,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: worksheet({ limitOccurrences: [directWithoutValue, narrow] }),
      materializedCandidates: selections(
        ["candidate:direct-empty", "DIRECT"],
        ["candidate:narrow-value", "NARROW_SCOPE"]
      ),
    });

    expect(result.requirements[1].fields[0].facts).toEqual([
      expect.objectContaining({
        normalizedValue: "5 %",
        binding: "NARROW_SCOPE",
      }),
    ]);
  });

  test("does not bind a duration that belongs to the preceding clause", () => {
    const contaminatedDirect = occurrence({
      candidateId: "candidate:direct-next-heading",
      requirementId: "VS-28",
      text: "Ersatzunterkunft bis 6 Monaten. Mietzinsentgang beginnt danach.",
      contextStart: 10_000,
      pageNumber: 9,
    });
    const narrowWithBoundDuration = occurrence({
      candidateId: "candidate:narrow-bound-duration",
      requirementId: "VS-28",
      text: "Mietzinsentgang mit einer Haftungszeit von 6 Monaten.",
      contextStart: 20_000,
      pageNumber: 1,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: worksheet({
        durationOccurrences: [contaminatedDirect, narrowWithBoundDuration],
      }),
      materializedCandidates: selections(
        ["candidate:direct-next-heading", "DIRECT"],
        ["candidate:narrow-bound-duration", "NARROW_SCOPE"]
      ),
    });

    expect(result.requirements[2].fields[0].facts).toEqual([
      expect.objectContaining({
        normalizedValue: "6 Monate",
        binding: "NARROW_SCOPE",
        source: expect.objectContaining({
          candidateId: "candidate:narrow-bound-duration",
          physicalPageNumber: 1,
        }),
      }),
    ]);
  });

  test("marks COMPLETE only when every requested field has source-bound evidence", () => {
    const customWorksheet = worksheet();
    customWorksheet.requirements[1].requestedFields = ["limit", "duration"];
    const limit = occurrence({
      candidateId: "candidate:only-limit",
      requirementId: "VS-21",
      text: "Aufräumkosten bis 10 %.",
      contextStart: 0,
    });
    customWorksheet.requirements[1].components[0].occurrences = [limit];
    const result = materializeRequestedFieldEvidence({
      worksheet: customWorksheet,
      materializedCandidates: selections(["candidate:only-limit", "DIRECT"]),
    });

    expect(result.requirements[1]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.PARTIAL,
      fields: [
        { field: "limit", status: FIELD_EVIDENCE_STATUS.FOUND },
        {
          field: "duration",
          status: FIELD_EVIDENCE_STATUS.NOT_EVALUATED,
        },
      ],
    });
    expect(result.requirements[0]).toMatchObject({
      requirementId: "VS-16",
      requestedFields: [],
      requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_REQUIRED,
      fields: [],
    });
  });

  test("binds both the three-year trigger and the 30-percent threshold for VS-02", () => {
    const clauseText =
      "Wird eine versicherte Sache nicht innerhalb dreier Jahre ab dem Schadentag wiederhergestellt bzw. wiederbeschafft, erfolgt die Entschädigung nach dem Zeitwert.";
    const thresholdText =
      "Für instandgehaltene Gebäude gilt ein Zeitwert von mindestens 30 % und damit die volle Neuwertentschädigung.";
    const clause = textualOccurrence({
      candidateId: "candidate:vs02-clause",
      text: clauseText,
      exactText: "Entschädigung nach dem Zeitwert",
      contextStart: 100,
    });
    const threshold = textualOccurrence({
      candidateId: "candidate:vs02-threshold",
      text: thresholdText,
      exactText: "Zeitwert von mindestens 30 %",
      contextStart: 500,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VS-02",
        label: "Zeitwertklausel",
        requestedFields: ["condition"],
        components: [
          {
            id: "current_value_clause",
            label: "Zeitwertklausel",
            factRole: "BENEFIT",
            occurrences: [clause],
          },
          {
            id: "residual_value_threshold",
            label: "Restwertverhältnis",
            factRole: "CONDITION",
            occurrences: [threshold],
          },
        ],
      }),
      materializedCandidates: selections(
        ["candidate:vs02-clause", "DIRECT"],
        ["candidate:vs02-threshold", "DIRECT"]
      ),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.COMPLETE,
      fields: [
        {
          field: "condition",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: [
            {
              normalizedValue:
                "Wiederherstellung oder Wiederbeschaffung nicht innerhalb von 3 Jahren: Entschädigung zum Zeitwert",
              source: { candidateId: "candidate:vs02-clause" },
            },
            {
              normalizedValue: "Zeitwert mindestens 30 %",
              source: { candidateId: "candidate:vs02-threshold" },
            },
          ],
        },
      ],
    });
  });

  test("materializes an optional VS-01 insured value without making it mandatory", () => {
    const text = "Wohngebäude zum NeuwertEUR30.000.000,00";
    const source = textualOccurrence({
      candidateId: "candidate:vs01-value",
      text,
      exactText: "Wohngebäude zum Neuwert",
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VS-01",
        label: "Neuwert",
        requestedFields: [],
        optionalFields: ["limit"],
        components: [
          {
            id: "replacement_new_value",
            label: "Ersatzleistung zum Neuwert",
            factRole: "BENEFIT",
            occurrences: [source],
          },
        ],
      }),
      materializedCandidates: selections(["candidate:vs01-value", "DIRECT"]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFields: [],
      optionalFields: ["limit"],
      requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_REQUIRED,
      fields: [
        {
          field: "limit",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: [
            {
              normalizedValue: "EUR 30.000.000,00",
              source: { candidateId: "candidate:vs01-value" },
            },
          ],
        },
      ],
    });
  });

  test("recovers the WEVIG outbuilding amount concatenated after Erstes Risiko", () => {
    const text =
      "Gemeinschaftlich genutzte Nebengebäude am Versicherungsgrundstück auf Erstes RisikoEUR1.530.400,00";
    const source = textualOccurrence({
      candidateId: "candidate:vs15-outbuilding",
      text,
      exactText: "Nebengebäude",
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VS-15",
        label: "Nebengebäude namentlich in der Polizze angeführt",
        requestedFields: [],
        optionalFields: ["limit"],
        components: [
          {
            id: "outbuilding_cover",
            label: "Nebengebäude allgemein",
            factRole: "INSURED_OBJECT",
            occurrences: [source],
          },
          {
            id: "named_outbuilding_designation",
            label: "Namentliche Anführung in der Polizze",
            factRole: "DEFINITION",
            occurrences: [],
          },
        ],
      }),
      materializedCandidates: selections([
        "candidate:vs15-outbuilding",
        "DIRECT",
      ]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_REQUIRED,
      fields: [
        {
          field: "limit",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: [
            expect.objectContaining({
              normalizedValue: "EUR 1.530.400,00",
              source: expect.objectContaining({
                exactText: "EUR1.530.400,00",
              }),
            }),
          ],
        },
      ],
    });
  });

  test("does not bind later percentages as an optional VS-01 insured value", () => {
    const source = textualOccurrence({
      candidateId: "candidate:vs01-no-adjacent-value",
      text: "Neuwertentschädigung gilt bei einem Zeitwert von mindestens 30 % und 33 % gewerblicher Nutzung.",
      exactText: "Neuwertentschädigung",
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VS-01",
        label: "Neuwert",
        requestedFields: [],
        optionalFields: ["limit"],
        components: [
          {
            id: "replacement_new_value",
            label: "Ersatzleistung zum Neuwert",
            factRole: "BENEFIT",
            occurrences: [source],
          },
        ],
      }),
      materializedCandidates: selections([
        "candidate:vs01-no-adjacent-value",
        "DIRECT",
      ]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_REQUIRED,
      fields: [
        {
          field: "limit",
          status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
          facts: [],
        },
      ],
    });
  });

  test("binds a controlled section governor to the later VS-33 list item", () => {
    const source = textualOccurrence({
      candidateId: "candidate:vs33-governor",
      text: [
        "Zusätzlich sind mitversichert bis zu jeweils l0% der Gebäudeversicherungssumme auf „Erstes Risiko“:",
        "- Kosten für Entsorgungsmaßnahmen;",
        "- Vorsorge für Neu-, Zu- und Umbauten, Instandsetzungen und Neuanschaffungen;",
      ].join("\n"),
      exactText: "Vorsorge für Neu-, Zu- und Umbauten",
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VS-33",
        label: "Vorsorgedeckung",
        requestedFields: ["limit"],
        components: [
          {
            id: "contingency_cover_or_automatic_increase_limit",
            label: "Limit",
            factRole: "LIMIT",
            occurrences: [source],
          },
        ],
      }),
      materializedCandidates: selections(["candidate:vs33-governor", "DIRECT"]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.COMPLETE,
      fields: [
        {
          field: "limit",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: [
            expect.objectContaining({
              normalizedValue: "10 %",
              source: expect.objectContaining({
                candidateId: "candidate:vs33-governor",
              }),
            }),
          ],
        },
      ],
    });
  });

  test("binds a local list-item limit directly to a non-VS peril", () => {
    const source = textualOccurrence({
      candidateId: "candidate:el04-flood-limit",
      text: [
        "- Hochwasser, Überschwemmung, Lawinen und Muren Jahreshöchstentschädigung",
        "(Besondere Bedingung 64PA0061)",
        "(EUR20.000,00)",
      ].join("\n"),
      exactText: "Hochwasser",
    });
    source.context.unitType = "LIST_ITEM";
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "EL-04",
        label: "Hochwasser und Überschwemmung",
        requestedFields: ["limit"],
        components: [
          {
            id: "flood",
            label: "Hochwasser",
            factRole: "PERIL",
            occurrences: [source],
          },
          {
            id: "inundation",
            label: "Überschwemmung",
            factRole: "PERIL",
            occurrences: [],
          },
        ],
      }),
      materializedCandidates: selections([
        "candidate:el04-flood-limit",
        "NARROW_SCOPE",
      ]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.COMPLETE,
      fields: [
        {
          field: "limit",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: [
            expect.objectContaining({
              normalizedValue: "EUR 20.000,00",
              source: expect.objectContaining({
                candidateId: "candidate:el04-flood-limit",
              }),
            }),
          ],
        },
      ],
    });
  });

  test("distinguishes an unsupported requested field from a searched but missing value", () => {
    const customWorksheet = worksheet();
    customWorksheet.requirements[0].requestedFields = ["condition"];
    const result = materializeRequestedFieldEvidence({
      worksheet: customWorksheet,
      materializedCandidates: [],
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_EVALUATED,
      fields: [
        {
          field: "condition",
          status: FIELD_EVIDENCE_STATUS.NOT_EVALUATED,
          facts: [],
        },
      ],
    });
  });

  test("binds the LF three-year restoration period and its legal conditions", () => {
    const text =
      "Der Anspruch besteht, wenn die Verwendung der Entschädigung zur Wiederbeschaffung oder Wiederherstellung innerhalb dreier Jahre nach dem Schadenfall sichergestellt ist. Wird eine versicherte Sache nicht innerhalb dreier Jahre ab dem Schadentag wiederhergestellt bzw. wiederbeschafft, erfolgt die Entschädigung nach dem Zeitwert. Im Falle eines Deckungsprozesses wird die Frist für die Wiederherstellung um die Dauer des Deckungsprozesses erstreckt.";
    const source = textualOccurrence({
      candidateId: "candidate:vs35-period",
      text,
      exactText: "innerhalb dreier Jahre",
      contextStart: 100,
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VS-35",
        label: "Wiederherstellungsklausel und Frist für den Wiederaufbau",
        requestedFields: ["duration", "condition"],
        components: [
          {
            id: "restoration_clause",
            label: "Wiederherstellungsklausel",
            factRole: "CONDITION",
            occurrences: [],
          },
          {
            id: "reconstruction_period",
            label: "Frist für den Wiederaufbau",
            factRole: "CONDITION",
            occurrences: [source],
          },
        ],
      }),
      materializedCandidates: selections(["candidate:vs35-period", "DIRECT"]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.COMPLETE,
      fields: [
        {
          field: "duration",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: expect.arrayContaining([
            expect.objectContaining({
              normalizedValue: "3 Jahre",
              valueType: "DURATION",
              unit: "YEAR",
            }),
          ]),
        },
        {
          field: "condition",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: expect.arrayContaining([
            expect.objectContaining({
              normalizedValue:
                "Keine Wiederherstellung oder Wiederbeschaffung innerhalb von 3 Jahren: Entschädigung zum Zeitwert",
            }),
            expect.objectContaining({
              normalizedValue:
                "Wiederherstellungsfrist verlängert sich um die Dauer eines Deckungsprozesses",
            }),
          ]),
        },
      ],
    });
  });

  test("rejects unknown or duplicate candidate selections fail-closed", () => {
    const source = occurrence({
      candidateId: "candidate:known",
      requirementId: "VS-21",
      text: "Aufräumkosten bis 10 %.",
      contextStart: 0,
    });
    const input = worksheet({ limitOccurrences: [source] });

    expect(() =>
      materializeRequestedFieldEvidence({
        worksheet: input,
        materializedCandidates: selections(["candidate:unknown", "DIRECT"]),
      })
    ).toThrow("REQUESTED_FIELD_CANDIDATE_UNKNOWN");
    expect(() =>
      materializeRequestedFieldEvidence({
        worksheet: input,
        materializedCandidates: selections(
          ["candidate:known", "DIRECT"],
          ["candidate:known", "NARROW_SCOPE"]
        ),
      })
    ).toThrow("REQUESTED_FIELD_CANDIDATE_DUPLICATE");
  });

  test("binds a declared total premium amount in a multi-component tax-inclusive row", () => {
    const text =
      "Die Gesamtprämie inkl. Steuern (Bruttoprämie) beträgt vierteljährlich EUR 14.747,66. Dauerrabatt 20 %; eine andere Prämie beträgt EUR 99.999,99.";
    const totalPremium = textualOccurrence({
      candidateId: "candidate:total-premium",
      text,
      exactText: "Gesamtprämie",
    });
    const taxIncluded = textualOccurrence({
      candidateId: "candidate:tax-included",
      text,
      exactText: "inkl. Steuern",
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VB-27",
        label: "Gesamtprämie inklusive Steuer",
        requestedFields: ["amount"],
        components: [
          {
            id: "total_premium",
            label: "Gesamtprämie",
            factRole: "CONDITION",
            occurrences: [totalPremium],
          },
          {
            id: "tax_included",
            label: "Steuer inklusive",
            factRole: "CONDITION",
            occurrences: [taxIncluded],
          },
        ],
      }),
      materializedCandidates: selections(
        ["candidate:total-premium", "DIRECT"],
        ["candidate:tax-included", "DIRECT"]
      ),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.COMPLETE,
      fields: [
        {
          field: "amount",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: [
            expect.objectContaining({
              normalizedValue: "EUR 14.747,66",
              valueType: "MONEY",
              unit: "EUR",
              qualifier: "vierteljährlich",
              source: expect.objectContaining({
                candidateId: "candidate:total-premium",
              }),
            }),
          ],
        },
      ],
    });
    expect(result.requirements[0].fields[0].facts).toHaveLength(1);
  });

  test("preserves the minimum qualifier of a contractual term", () => {
    const text =
      "Dauerrabatt 20 % - Laufzeit mind. 10 Jahre. Bei vorzeitiger Beendigung gelten weitere Regeln.";
    const contractTerm = textualOccurrence({
      candidateId: "candidate:minimum-contract-term",
      text,
      exactText: "Laufzeit mind.",
    });
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VB-01",
        label: "Vertragslaufzeit in Jahren",
        requestedFields: ["duration"],
        components: [
          {
            id: "contract_term",
            label: "Vertragslaufzeit",
            factRole: "CONDITION",
            occurrences: [contractTerm],
          },
        ],
      }),
      materializedCandidates: selections([
        "candidate:minimum-contract-term",
        "DIRECT",
      ]),
    });

    expect(result.requirements[0]).toMatchObject({
      requestedFieldStatus: REQUESTED_FIELD_STATUS.COMPLETE,
      fields: [
        {
          field: "duration",
          status: FIELD_EVIDENCE_STATUS.FOUND,
          facts: [
            expect.objectContaining({
              normalizedValue: "mindestens 10 Jahre",
              valueType: "DURATION",
              unit: "YEAR",
            }),
          ],
        },
      ],
    });
  });

  test("does not mistake the statutory maximum for the agreed extension period", () => {
    const statutoryText =
      "Eine Vereinbarung, nach welcher ein Versicherungsverhältnis als stillschweigend verlängert gilt, ist insoweit nichtig, als sich die Verlängerung auf mehr als ein Jahr erstreckt.";
    const agreedText =
      "Der Vertrag verlängert sich stillschweigend jeweils um ein weiteres Jahr.";
    const statutoryCandidate = textualOccurrence({
      candidateId: "candidate:statutory-extension-limit",
      text: statutoryText,
      exactText: "stillschweigend verlängert",
    });
    const agreedCandidate = textualOccurrence({
      candidateId: "candidate:agreed-extension-period",
      text: agreedText,
      exactText: "jeweils um ein weiteres Jahr",
      contextStart: 1_000,
    });
    const input = textualWorksheet({
      id: "VB-04",
      label: "Stillschweigende Verlängerung und Verlängerungszeitraum",
      requestedFields: ["duration"],
      components: [
        {
          id: "automatic_extension",
          label: "Stillschweigende Verlängerung",
          factRole: "CONDITION",
          occurrences: [statutoryCandidate],
        },
        {
          id: "extension_period",
          label: "Verlängerungszeitraum",
          factRole: "CONDITION",
          occurrences: [agreedCandidate],
        },
      ],
    });

    expect(
      materializeRequestedFieldEvidence({
        worksheet: input,
        materializedCandidates: selections([
          "candidate:statutory-extension-limit",
          "DIRECT",
        ]),
      }).requirements[0].fields[0]
    ).toMatchObject({
      status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
      facts: [],
    });
    expect(
      materializeRequestedFieldEvidence({
        worksheet: input,
        materializedCandidates: selections([
          "candidate:agreed-extension-period",
          "DIRECT",
        ]),
      }).requirements[0].fields[0]
    ).toMatchObject({
      status: FIELD_EVIDENCE_STATUS.FOUND,
      facts: [
        expect.objectContaining({
          normalizedValue: "1 Jahr",
          source: expect.objectContaining({
            candidateId: "candidate:agreed-extension-period",
          }),
        }),
      ],
    });
  });

  test.each([
    ["Laufzeit bis zu 10 Jahre", "Laufzeit"],
    ["Kündigungsfrist 10 Jahre", "Kündigungsfrist"],
    ["während der Vertragslaufzeit", "Vertragslaufzeit"],
  ])(
    "does not bind a non-minimum contractual term from %s",
    (text, exactText) => {
      const result = materializeRequestedFieldEvidence({
        worksheet: textualWorksheet({
          id: "VB-01",
          label: "Vertragslaufzeit in Jahren",
          requestedFields: ["duration"],
          components: [
            {
              id: "contract_term",
              label: "Vertragslaufzeit",
              factRole: "CONDITION",
              occurrences: [
                textualOccurrence({
                  candidateId: "candidate:non-minimum-term",
                  text,
                  exactText,
                }),
              ],
            },
          ],
        }),
        materializedCandidates: selections([
          "candidate:non-minimum-term",
          "DIRECT",
        ]),
      });

      expect(result.requirements[0].fields[0]).toMatchObject({
        field: "duration",
        status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
        facts: [],
      });
    }
  );

  test.each([
    [
      "Die Wiederherstellung muss innerhalb dreier Jahre nach dem Schadenfall erfolgen.",
      "Wiederherstellung",
      "dreier Jahre",
      "3 Jahre",
      "YEAR",
    ],
    [
      "Die versicherte Sache muss innerhalb 18 Monaten wiederhergestellt werden.",
      "innerhalb 18 Monaten wiederhergestellt",
      "18 Monaten",
      "18 Monate",
      "MONTH",
    ],
  ])(
    "binds a source-local reinstatement deadline from %s",
    (text, exactText, rawValue, normalizedValue, unit) => {
      const result = materializeRequestedFieldEvidence({
        worksheet: textualWorksheet({
          id: "VB-26",
          label: "Frist für die Wiederherstellung",
          requestedFields: ["duration"],
          components: [
            {
              id: "reinstatement_deadline",
              label: "Wiederherstellungsfrist",
              factRole: "CONDITION",
              occurrences: [
                textualOccurrence({
                  candidateId: "candidate:reinstatement-deadline",
                  text,
                  exactText,
                  contextStart: 8_000,
                }),
              ],
            },
          ],
        }),
        materializedCandidates: selections([
          "candidate:reinstatement-deadline",
          "DIRECT",
        ]),
      });

      expect(result.requirements[0]).toMatchObject({
        requestedFieldStatus: REQUESTED_FIELD_STATUS.COMPLETE,
        fields: [
          {
            field: "duration",
            status: FIELD_EVIDENCE_STATUS.FOUND,
            facts: [
              expect.objectContaining({
                rawValue,
                normalizedValue,
                valueType: "DURATION",
                unit,
                source: expect.objectContaining({ exactText: rawValue }),
              }),
            ],
          },
        ],
      });
    }
  );

  test("does not transfer an unrelated duration into VB-26", () => {
    const text =
      "Die Wiederherstellung wird beschrieben. Die Kündigungsfrist beträgt drei Jahre.";
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VB-26",
        label: "Frist für die Wiederherstellung",
        requestedFields: ["duration"],
        components: [
          {
            id: "reinstatement_deadline",
            label: "Wiederherstellungsfrist",
            factRole: "CONDITION",
            occurrences: [
              textualOccurrence({
                candidateId: "candidate:unrelated-duration",
                text,
                exactText: "Wiederherstellung",
              }),
            ],
          },
        ],
      }),
      materializedCandidates: selections([
        "candidate:unrelated-duration",
        "DIRECT",
      ]),
    });

    expect(result.requirements[0].fields[0]).toMatchObject({
      field: "duration",
      status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
      facts: [],
    });
  });

  test("does not bind an unrelated periodic amount after a premium reference", () => {
    const text =
      "Die Gesamtprämie wird separat ausgewiesen. Vierteljährlich EUR 500 Bearbeitungskosten.";
    const result = materializeRequestedFieldEvidence({
      worksheet: textualWorksheet({
        id: "VB-27",
        label: "Gesamtprämie inklusive Steuer",
        requestedFields: ["amount"],
        components: [
          {
            id: "total_premium",
            label: "Gesamtprämie",
            factRole: "CONDITION",
            occurrences: [
              textualOccurrence({
                candidateId: "candidate:unrelated-periodic-amount",
                text,
                exactText: "Gesamtprämie",
              }),
            ],
          },
        ],
      }),
      materializedCandidates: selections([
        "candidate:unrelated-periodic-amount",
        "DIRECT",
      ]),
    });

    expect(result.requirements[0].fields[0]).toMatchObject({
      field: "amount",
      status: FIELD_EVIDENCE_STATUS.NOT_FOUND,
      facts: [],
    });
  });
});
