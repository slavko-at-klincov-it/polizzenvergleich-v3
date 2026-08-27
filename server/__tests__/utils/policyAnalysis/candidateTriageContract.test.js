const {
  CANDIDATE_BINDING,
  buildCandidateTriagePayload,
  buildSingleBindingTargetPayload,
  deriveCandidateBinding,
  evaluateCandidateTriageControls,
  materializeCandidateTriage,
  parseAndValidateCandidateTriage,
  parseAndValidateSingleBindingTarget,
} = require("../../../utils/policyAnalysis/candidateTriageContract");

const WORKSHEET = {
  candidateOnly: true,
  requirements: [
    {
      id: "VS-21",
      label: "Aufräum- und Abbruchkosten, Höhe des Limits",
      requestedFields: ["limit"],
      components: [
        {
          id: "demolition_costs",
          label: "Abbruchkosten",
          factRole: "COST",
          terminalState: "CONTROLLED_CANDIDATES_FOUND",
          occurrences: [
            {
              candidateId: "candidate:direct",
              matchedAlias: "Abbruchkosten",
              pageNumber: 5,
              exactText: "Abbruchkosten",
              documentStart: 0,
              documentEnd: 13,
              context: {
                unitType: "LIST_ITEM",
                text: "Abbruchkosten sind mitversichert.",
                documentStart: 0,
                documentEnd: 34,
              },
              scopeLead: {
                text: "Versicherte Kosten:",
              },
            },
            {
              candidateId: "candidate:liability",
              matchedAlias: "Abbruch",
              pageNumber: 18,
              exactText: "Abbruch",
              documentStart: 100,
              documentEnd: 107,
              context: {
                unitType: "PARAGRAPH",
                text: "Haftpflicht als Bauherr bei Abbrucharbeiten.",
                documentStart: 80,
                documentEnd: 124,
              },
              scopeLead: {
                text: "Im Rahmen der Haftpflichtversicherung:",
              },
            },
          ],
        },
      ],
    },
  ],
};

const GROUPED_WORKSHEET = JSON.parse(JSON.stringify(WORKSHEET));
GROUPED_WORKSHEET.requirements[0].components[0].occurrences[0].bindingGroupId =
  "binding-group:shared-costs";
GROUPED_WORKSHEET.requirements[0].components[0].occurrences[0].context = {
  unitType: "LIST_ITEM",
  text: "Kosten für Aufräumung und Abbruch sind mitversichert.",
  documentStart: 0,
  documentEnd: 55,
};
GROUPED_WORKSHEET.requirements[0].components.push({
  id: "cleanup_costs",
  label: "Aufräumkosten",
  factRole: "COST",
  terminalState: "CONTROLLED_CANDIDATES_FOUND",
  occurrences: [
    {
      candidateId: "candidate:cleanup",
      matchedAlias: "Aufräumung",
      pageNumber: 5,
      exactText: "Aufräumung",
      documentStart: 0,
      documentEnd: 10,
      context: {
        unitType: "LIST_ITEM",
        text: "Kosten für Aufräumung und Abbruch sind mitversichert.",
        documentStart: 0,
        documentEnd: 55,
      },
      scopeLead: { text: "" },
      bindingGroupId: "binding-group:shared-costs",
    },
  ],
});
GROUPED_WORKSHEET.bindingGroups = [
  {
    id: "binding-group:shared-costs",
    requirementId: "VS-21",
    type: "SHARED_GOVERNOR",
    constraint: "SAME_CANDIDATE_BINDING",
    governorText: "Kosten für",
    candidateIds: ["candidate:direct", "candidate:cleanup"],
  },
];

function response(judgements) {
  return JSON.stringify({ schemaVersion: 6, judgements });
}

describe("candidateTriageContract", () => {
  test("builds a compact candidate-only payload without coverage or model-owned sources", () => {
    const payload = buildCandidateTriagePayload(WORKSHEET);

    expect(payload).toMatchObject({
      schemaVersion: 6,
      task: "CLASSIFY_BINDING_TARGETS",
      bindingTargets: [
        {
          targetId: "candidate:direct",
          candidateIds: ["candidate:direct"],
          requirementId: "VS-21",
          pageNumber: 5,
          focusText: "Abbruchkosten sind mitversichert.",
          pageScopeHints: [],
          scopeLeadText: "Versicherte Kosten:",
        },
        {
          targetId: "candidate:liability",
          candidateIds: ["candidate:liability"],
          pageNumber: 18,
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /coverageEffect|reviewStatus|conflictState/u
    );
  });

  test("collapses a server-owned binding group to one model target", () => {
    const payload = buildCandidateTriagePayload(GROUPED_WORKSHEET);

    expect(payload.bindingTargets).toHaveLength(2);
    expect(payload.bindingTargets[0]).toMatchObject({
      targetId: "binding-group:shared-costs",
      candidateIds: ["candidate:direct", "candidate:cleanup"],
      structure: {
        type: "SHARED_GOVERNOR",
        governorText: "Kosten für",
      },
      roleResolution: {
        owner: "SERVER",
        roleMatch: "MATCH",
        basis: "SHARED_GOVERNOR",
      },
      scopeResolution: {
        owner: "MODEL",
        scopeMatch: null,
        basis: "MODEL_REQUIRED",
        matchedAlias: null,
      },
      modelDecisionFields: ["scopeMatch"],
      members: [
        {
          candidateId: "candidate:direct",
          componentId: "demolition_costs",
          factRole: "COST",
        },
        {
          candidateId: "candidate:cleanup",
          componentId: "cleanup_costs",
          factRole: "COST",
        },
      ],
    });
    expect(JSON.stringify(payload.bindingTargets)).not.toMatch(
      /INCLUDED|EXCLUDED|coverage/u
    );
  });

  test("accepts a catalog-attested shared-span group as one target", () => {
    const worksheet = JSON.parse(JSON.stringify(GROUPED_WORKSHEET));
    worksheet.bindingGroups[0].type = "SHARED_SPAN";
    worksheet.bindingGroups[0].governorText = "Aufräum- und Abbruchkosten";

    const [target] = buildCandidateTriagePayload(worksheet).bindingTargets;

    expect(target).toMatchObject({
      targetId: "binding-group:shared-costs",
      structure: {
        type: "SHARED_SPAN",
        governorText: "Aufräum- und Abbruchkosten",
      },
      roleResolution: {
        owner: "SERVER",
        roleMatch: "MATCH",
        basis: "SHARED_SPAN",
      },
    });
  });

  test("accepts a server-attested right-headed coordination group", () => {
    const worksheet = JSON.parse(JSON.stringify(GROUPED_WORKSHEET));
    worksheet.bindingGroups[0].type = "RIGHT_HEADED_COORDINATION";
    worksheet.bindingGroups[0].governorText = "Isolierungskosten";
    worksheet.requirements[0].components[0].occurrences[0].context.documentEnd = 48;

    const [target] = buildCandidateTriagePayload(worksheet).bindingTargets;

    expect(target).toMatchObject({
      targetId: "binding-group:shared-costs",
      structure: {
        type: "RIGHT_HEADED_COORDINATION",
        governorText: "Isolierungskosten",
      },
      roleResolution: {
        owner: "SERVER",
        roleMatch: "MATCH",
        basis: "RIGHT_HEADED_COORDINATION",
      },
    });
  });

  test("builds and validates one isolated model target without unrelated IDs", () => {
    const payload = buildCandidateTriagePayload(GROUPED_WORKSHEET);
    const single = buildSingleBindingTargetPayload({
      payload,
      targetId: "binding-group:shared-costs",
    });

    expect(single).toMatchObject({
      schemaVersion: 6,
      task: "CLASSIFY_ONE_BINDING_TARGET",
      bindingTarget: {
        targetId: "binding-group:shared-costs",
        candidateIds: ["candidate:direct", "candidate:cleanup"],
      },
    });
    expect(JSON.stringify(single)).not.toContain("candidate:liability");
    expect(
      parseAndValidateSingleBindingTarget({
        responseText: JSON.stringify({
          schemaVersion: 6,
          roleMatch: "MATCH",
          scopeMatch: "NARROW",
        }),
        target: single.bindingTarget,
      })
    ).toEqual({
      targetId: "binding-group:shared-costs",
      roleMatch: "MATCH",
      scopeMatch: "NARROW",
      binding: "NARROW_SCOPE",
      decisionOwner: "SERVER_AND_MODEL",
    });
  });

  test("rejects IDs or additional fields in a single-target response", () => {
    const target =
      buildCandidateTriagePayload(GROUPED_WORKSHEET).bindingTargets[0];
    expect(() =>
      parseAndValidateSingleBindingTarget({
        responseText: JSON.stringify({
          schemaVersion: 6,
          roleMatch: "MATCH",
          scopeMatch: "GENERAL",
          targetId: "candidate:other",
        }),
        target,
      })
    ).toThrow("TRIAGE_ROOT_KEYS_INVALID");
    expect(() =>
      parseAndValidateSingleBindingTarget({
        responseText: JSON.stringify({
          schemaVersion: 6,
          roleMatch: "MATCH",
          scopeMatch: "GENERAL",
          explanation: "not allowed",
        }),
        target,
      })
    ).toThrow("TRIAGE_ROOT_KEYS_INVALID");
  });

  test("rejects a model value that contradicts a server-owned axis", () => {
    const target =
      buildCandidateTriagePayload(GROUPED_WORKSHEET).bindingTargets[0];

    expect(() =>
      parseAndValidateSingleBindingTarget({
        responseText: JSON.stringify({
          schemaVersion: 6,
          roleMatch: "MISMATCH",
          scopeMatch: "GENERAL",
        }),
        target,
      })
    ).toThrow("TRIAGE_SERVER_ROLE_CONFLICT");
  });

  test("rejects an explicit liability target as another role and scope", () => {
    const payload = buildCandidateTriagePayload(WORKSHEET);
    const liability = payload.bindingTargets.find(
      ({ targetId }) => targetId === "candidate:liability"
    );

    expect(liability.roleResolution).toEqual({
      owner: "SERVER",
      roleMatch: "MISMATCH",
      basis: "LIABILITY_NOT_INSURED_COST",
    });
    expect(liability.scopeResolution).toEqual({
      owner: "SERVER",
      scopeMatch: "OTHER_SCOPE",
      basis: "EXPLICIT_LIABILITY_SCOPE",
      matchedAlias: null,
    });
    expect(liability.modelDecisionFields).toEqual([]);
    expect(() =>
      parseAndValidateSingleBindingTarget({
        responseText: JSON.stringify({
          schemaVersion: 6,
          roleMatch: "MISMATCH",
          scopeMatch: "OTHER_SCOPE",
        }),
        target: liability,
      })
    ).toThrow("TRIAGE_SINGLE_TARGET_SERVER_TERMINAL");
  });

  test("attests a coordinated cost governor even when the exact alias is only Abbruch", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    const occurrence = worksheet.requirements[0].components[0].occurrences[0];
    const text =
      "Aufräum- und Abbruchkosten sind Kosten für den nötigen Abbruch stehen gebliebener Teile.";
    const start = text.lastIndexOf("Abbruch");
    occurrence.exactText = "Abbruch";
    occurrence.context = {
      unitType: "PARAGRAPH",
      text,
      documentStart: 0,
      documentEnd: text.length,
    };
    occurrence.documentStart = start;
    occurrence.documentEnd = start + "Abbruch".length;

    expect(
      buildCandidateTriagePayload(worksheet).bindingTargets[0].roleResolution
    ).toEqual({
      owner: "SERVER",
      roleMatch: "MATCH",
      basis: "EXPLICIT_COST_GOVERNOR",
    });
  });

  test("rejects a cleanup work-start threshold as cost evidence", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    const occurrence = worksheet.requirements[0].components[0].occurrences[0];
    const text =
      "Beginn der Aufräumungs- und Reparaturarbeiten. Bis EUR 8.000 darf unverzüglich begonnen werden.";
    const start = text.indexOf("Aufräumungs-");
    occurrence.exactText = "Aufräumungs-";
    occurrence.context = {
      unitType: "PARAGRAPH",
      text,
      documentStart: 0,
      documentEnd: text.length,
    };
    occurrence.documentStart = start;
    occurrence.documentEnd = start + "Aufräumungs-".length;

    expect(
      buildCandidateTriagePayload(worksheet).bindingTargets[0].roleResolution
    ).toEqual({
      owner: "SERVER",
      roleMatch: "MISMATCH",
      basis: "CLEANUP_WORK_START_NOT_COST",
    });
  });

  test("attests a catalog-declared narrow scope without a model call", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    worksheet.requirements[0].scopeRules = {
      narrowAliases: ["Sondermüll"],
    };
    worksheet.requirements[0].components[0].occurrences[0].context.text =
      "Abbruchkosten für kontaminierten Sondermüll sind mitversichert.";
    worksheet.requirements[0].components[0].occurrences[0].documentStart = 0;
    worksheet.requirements[0].components[0].occurrences[0].documentEnd =
      "Abbruchkosten".length;

    const target = buildCandidateTriagePayload(worksheet).bindingTargets[0];

    expect(target.roleResolution).toEqual({
      owner: "SERVER",
      roleMatch: "MATCH",
      basis: "EXPLICIT_COST_TERM",
    });
    expect(target.scopeResolution).toEqual({
      owner: "SERVER",
      scopeMatch: "NARROW",
      basis: "CATALOG_NARROW_ALIAS",
      matchedAlias: "Sondermüll",
    });
    expect(target.modelDecisionFields).toEqual([]);
    expect(() =>
      parseAndValidateSingleBindingTarget({
        responseText: JSON.stringify({
          schemaVersion: 6,
          roleMatch: "MATCH",
          scopeMatch: "NARROW",
        }),
        target,
      })
    ).toThrow("TRIAGE_SINGLE_TARGET_SERVER_TERMINAL");
  });

  test("attests a catalog-declared proposal section scope without model variance", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    worksheet.requirements[0].scopeRules = {
      narrowAliases: [],
      narrowScopeKeys: ["FEUER_INSURANCE"],
    };
    worksheet.requirements[0].components[0].occurrences[0].sectionScopeHint = {
      scopeKey: "FEUER_INSURANCE",
      text: "FEUERVERSICHERUNG",
      source: "CURRENT_PAGE_HEADING",
    };

    const target = buildCandidateTriagePayload(worksheet).bindingTargets[0];

    expect(target.scopeResolution).toEqual({
      owner: "SERVER",
      scopeMatch: "NARROW",
      basis: "CATALOG_NARROW_SECTION",
      matchedAlias: "FEUER_INSURANCE",
    });
    expect(target.modelDecisionFields).toEqual([]);
  });

  test("matches only a catalog-declared inflected narrow phrase", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    worksheet.requirements[0].scopeRules = {
      narrowAliases: ["gefährlicher Abfall", "gefährlichem Abfall"],
    };
    worksheet.requirements[0].components[0].occurrences[0].context.text =
      "Abbruchkosten für gefährlichem Abfall sind mitversichert.";
    worksheet.requirements[0].components[0].occurrences[0].documentStart = 0;
    worksheet.requirements[0].components[0].occurrences[0].documentEnd =
      "Abbruchkosten".length;

    const target = buildCandidateTriagePayload(worksheet).bindingTargets[0];

    expect(target.scopeResolution).toMatchObject({
      owner: "SERVER",
      scopeMatch: "NARROW",
      matchedAlias: "gefährlichem Abfall",
    });
  });

  test("does not overbind a narrow alias from a later sentence in a fallback context", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    const occurrence = worksheet.requirements[0].components[0].occurrences[0];
    const contextText =
      "Abbruchkosten sind allgemein versichert. Abbruchkosten bei radioaktiv verunreinigten Sachen gelten nur unter Auflagen.";
    worksheet.requirements[0].scopeRules = {
      narrowAliases: ["radioaktiv"],
    };
    occurrence.context = {
      unitType: "WORD_WINDOW_FALLBACK",
      text: contextText,
      documentStart: 0,
      documentEnd: contextText.length,
    };
    occurrence.documentStart = 0;
    occurrence.documentEnd = "Abbruchkosten".length;

    const generalTarget =
      buildCandidateTriagePayload(worksheet).bindingTargets[0];
    expect(generalTarget.scopeResolution).toMatchObject({
      owner: "MODEL",
      scopeMatch: null,
      matchedAlias: null,
    });

    const narrowStart = contextText.lastIndexOf("Abbruchkosten");
    occurrence.documentStart = narrowStart;
    occurrence.documentEnd = narrowStart + "Abbruchkosten".length;
    const narrowTarget =
      buildCandidateTriagePayload(worksheet).bindingTargets[0];
    expect(narrowTarget.scopeResolution).toMatchObject({
      owner: "SERVER",
      scopeMatch: "NARROW",
      matchedAlias: "radioaktiv",
    });
  });

  test.each([
    ["MATCH", "GENERAL", "DIRECT"],
    ["MATCH", "GENERAL_WITH_NARROW", "DIRECT"],
    ["MATCH", "NARROW", "NARROW_SCOPE"],
    ["MISMATCH", "GENERAL", "MENTION_ONLY"],
    ["MISMATCH", "UNRESOLVED", "MENTION_ONLY"],
    ["MATCH", "OTHER_SCOPE", "MENTION_ONLY"],
    ["UNRESOLVED", "OTHER_SCOPE", "MENTION_ONLY"],
    ["UNRESOLVED", "GENERAL", "UNRESOLVED"],
    ["MATCH", "UNRESOLVED", "UNRESOLVED"],
  ])("derives %s plus %s as %s", (roleMatch, scopeMatch, expectedBinding) => {
    expect(deriveCandidateBinding({ roleMatch, scopeMatch })).toBe(
      expectedBinding
    );
  });

  test("expands one group target without rewriting the model binding", () => {
    const validated = parseAndValidateCandidateTriage({
      responseText: response([
        {
          targetId: "binding-group:shared-costs",
          binding: "NARROW_SCOPE",
        },
        { targetId: "candidate:liability", binding: "MENTION_ONLY" },
      ]),
      worksheet: GROUPED_WORKSHEET,
    });

    expect(validated.targetJudgements).toEqual([
      {
        targetId: "binding-group:shared-costs",
        binding: "NARROW_SCOPE",
      },
      { targetId: "candidate:liability", binding: "MENTION_ONLY" },
    ]);
    expect(validated.judgements).toEqual([
      { candidateId: "candidate:direct", binding: "NARROW_SCOPE" },
      { candidateId: "candidate:liability", binding: "MENTION_ONLY" },
      { candidateId: "candidate:cleanup", binding: "NARROW_SCOPE" },
    ]);

    expect(() =>
      parseAndValidateCandidateTriage({
        responseText: response([
          { targetId: "candidate:direct", binding: "NARROW_SCOPE" },
          { targetId: "candidate:liability", binding: "MENTION_ONLY" },
        ]),
        worksheet: GROUPED_WORKSHEET,
      })
    ).toThrow("TRIAGE_TARGET_ID_UNKNOWN");
  });

  test("accepts every allowed candidate exactly once and restores worksheet order", () => {
    const validated = parseAndValidateCandidateTriage({
      responseText: response([
        {
          targetId: "candidate:liability",
          binding: CANDIDATE_BINDING.MENTION_ONLY,
        },
        {
          targetId: "candidate:direct",
          binding: CANDIDATE_BINDING.DIRECT,
        },
      ]),
      worksheet: WORKSHEET,
    });

    expect(validated.judgements).toEqual([
      { candidateId: "candidate:direct", binding: "DIRECT" },
      { candidateId: "candidate:liability", binding: "MENTION_ONLY" },
    ]);
  });

  test.each([
    [
      "unknown ID",
      response([
        { targetId: "candidate:direct", binding: "DIRECT" },
        { targetId: "candidate:invented", binding: "MENTION_ONLY" },
      ]),
      "TRIAGE_TARGET_ID_UNKNOWN",
    ],
    [
      "duplicate ID",
      response([
        { targetId: "candidate:direct", binding: "DIRECT" },
        { targetId: "candidate:direct", binding: "MENTION_ONLY" },
      ]),
      "TRIAGE_TARGET_ID_DUPLICATE",
    ],
    [
      "missing ID",
      response([{ targetId: "candidate:direct", binding: "DIRECT" }]),
      "TRIAGE_TARGET_ID_MISSING",
    ],
    [
      "invalid binding",
      response([
        { targetId: "candidate:direct", binding: "COVERED" },
        { targetId: "candidate:liability", binding: "MENTION_ONLY" },
      ]),
      "TRIAGE_BINDING_INVALID",
    ],
  ])("rejects %s fail-closed", (_label, responseText, expectedError) => {
    expect(() =>
      parseAndValidateCandidateTriage({ responseText, worksheet: WORKSHEET })
    ).toThrow(expectedError);
  });

  test("accepts exactly one JSON fence as transport syntax", () => {
    const valid = response([
      { targetId: "candidate:direct", binding: "DIRECT" },
      { targetId: "candidate:liability", binding: "MENTION_ONLY" },
    ]);
    const validated = parseAndValidateCandidateTriage({
      responseText: `\`\`\`json\n${valid}\n\`\`\``,
      worksheet: WORKSHEET,
    });
    expect(validated.targetJudgements).toEqual(JSON.parse(valid).judgements);
    expect(validated.judgements).toHaveLength(2);
  });

  test("rejects prose or multiple fences around otherwise valid JSON", () => {
    const valid = response([
      { targetId: "candidate:direct", binding: "DIRECT" },
      { targetId: "candidate:liability", binding: "MENTION_ONLY" },
    ]);
    for (const responseText of [
      `Antwort:\n\`\`\`json\n${valid}\n\`\`\``,
      `\`\`\`json\n${valid}\n\`\`\`\nDanke`,
      `\`\`\`json\n${valid}\n\`\`\`\n\`\`\`json\n${valid}\n\`\`\``,
    ]) {
      expect(() =>
        parseAndValidateCandidateTriage({ responseText, worksheet: WORKSHEET })
      ).toThrow("TRIAGE_JSON_INVALID");
    }
  });

  test("rejects additional root fields and additional judgement fields", () => {
    const valid = response([
      { targetId: "candidate:direct", binding: "DIRECT" },
      { targetId: "candidate:liability", binding: "MENTION_ONLY" },
    ]);

    expect(() =>
      parseAndValidateCandidateTriage({
        responseText: JSON.stringify({
          schemaVersion: 6,
          judgements: JSON.parse(valid).judgements,
          explanation: "not allowed",
        }),
        worksheet: WORKSHEET,
      })
    ).toThrow("TRIAGE_ROOT_KEYS_INVALID");

    expect(() =>
      parseAndValidateCandidateTriage({
        responseText: response([
          {
            targetId: "candidate:direct",
            binding: "DIRECT",
            quote: "invented",
          },
          { targetId: "candidate:liability", binding: "MENTION_ONLY" },
        ]),
        worksheet: WORKSHEET,
      })
    ).toThrow("TRIAGE_JUDGEMENT_KEYS_INVALID");
  });

  test("materializes only server-owned pages, text and offsets", () => {
    const validatedTriage = parseAndValidateCandidateTriage({
      responseText: response([
        { targetId: "candidate:direct", binding: "DIRECT" },
        { targetId: "candidate:liability", binding: "MENTION_ONLY" },
      ]),
      worksheet: WORKSHEET,
    });
    const materialized = materializeCandidateTriage({
      worksheet: WORKSHEET,
      validatedTriage,
    });

    expect(materialized[1]).toMatchObject({
      requirementId: "VS-21",
      componentId: "demolition_costs",
      candidateId: "candidate:liability",
      binding: "MENTION_ONLY",
      pageNumber: 18,
      exactText: "Abbruch",
      documentStart: 100,
      documentEnd: 107,
    });
  });

  test("evaluates a uniquely selected hard control", () => {
    const validatedTriage = parseAndValidateCandidateTriage({
      responseText: response([
        { targetId: "candidate:direct", binding: "DIRECT" },
        { targetId: "candidate:liability", binding: "MENTION_ONLY" },
      ]),
      worksheet: WORKSHEET,
    });
    const materialized = materializeCandidateTriage({
      worksheet: WORKSHEET,
      validatedTriage,
    });
    const [control] = evaluateCandidateTriageControls({
      materialized,
      controlSet: {
        schemaVersion: 1,
        controls: [
          {
            id: "liability-not-direct",
            selector: {
              requirementId: "VS-21",
              componentId: "demolition_costs",
              pageNumber: 18,
              exactText: "Abbruch",
            },
            allowedBindings: ["MENTION_ONLY", "UNRESOLVED"],
          },
        ],
      },
    });

    expect(control).toMatchObject({
      id: "liability-not-direct",
      pass: true,
      observedBinding: "MENTION_ONLY",
    });
  });

  test("rejects empty, duplicate and incomplete control sets fail-closed", () => {
    expect(() =>
      evaluateCandidateTriageControls({
        materialized: [],
        controlSet: { schemaVersion: 1, controls: [] },
      })
    ).toThrow("TRIAGE_CONTROL_SET_INVALID");

    const duplicate = {
      id: "same-control",
      selector: { candidateId: "candidate:direct" },
      allowedBindings: ["DIRECT"],
    };
    expect(() =>
      evaluateCandidateTriageControls({
        materialized: [],
        controlSet: { schemaVersion: 1, controls: [duplicate, duplicate] },
      })
    ).toThrow("TRIAGE_CONTROL_ID_DUPLICATE: same-control");
    expect(() =>
      evaluateCandidateTriageControls({
        materialized: [],
        controlSet: {
          schemaVersion: 1,
          controls: [{ id: "missing-rule", selector: {} }],
        },
      })
    ).toThrow("TRIAGE_CONTROL_RULE_INVALID: missing-rule");
  });
});
