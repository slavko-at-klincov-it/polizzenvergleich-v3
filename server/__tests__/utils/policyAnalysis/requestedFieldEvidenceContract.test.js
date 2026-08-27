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

describe("requestedFieldEvidenceContract", () => {
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
        { field: "duration", status: FIELD_EVIDENCE_STATUS.NOT_FOUND },
      ],
    });
    expect(result.requirements[0]).toMatchObject({
      requirementId: "VS-16",
      requestedFields: [],
      requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_REQUIRED,
      fields: [],
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
