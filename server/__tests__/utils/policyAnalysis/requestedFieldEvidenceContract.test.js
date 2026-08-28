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

describe("requestedFieldEvidenceContract", () => {
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
});
