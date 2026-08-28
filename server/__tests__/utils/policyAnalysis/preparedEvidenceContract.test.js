const {
  CONFLICT_STATE,
  COVERAGE_EFFECT,
  COVERAGE_PICTURE,
} = require("../../../utils/policyAnalysis/categoryResultContract");
const {
  DOCUMENT_APPLICABILITY,
  DOCUMENT_STATUS,
  REQUESTED_FIELD_STATUS,
  buildDeterministicPreparedEvidenceJudgement,
  buildPreparedEvidenceTargets,
  materializePreparedEvidence,
  parseAndValidatePreparedEvidenceResponse,
} = require("../../../utils/policyAnalysis/preparedEvidenceContract");

const WORKSHEET = {
  candidateOnly: true,
  requirements: [
    {
      id: "EL-16",
      label: "Wintergärten und Vitrinen",
      requestedFields: ["limit", "condition"],
      components: [
        {
          id: "winter_garden",
          label: "Wintergärten",
          factRole: "INSURED_OBJECT",
          occurrences: [
            {
              candidateId: "candidate:winter",
              pageNumber: 15,
              physicalPageNumber: 15,
              printedPageLabel: "Seite 15 von 31",
              exactText: "Wintergärten",
              context: {
                unitType: "PARAGRAPH",
                text: "Wintergärten sind eingeschlossen.",
              },
              scopeLead: { text: "Versichert sind:" },
              pageScopeHints: [
                { scopeKey: "GLAS_INSURANCE", text: "Die Glasversicherung" },
              ],
            },
          ],
        },
        {
          id: "display_case",
          label: "Vitrinen",
          factRole: "INSURED_OBJECT",
          occurrences: [
            {
              candidateId: "candidate:vitrine",
              pageNumber: 15,
              exactText: "Vitrinen",
              context: {
                unitType: "PARAGRAPH",
                text: "Vitrinen sind ausgeschlossen.",
              },
            },
          ],
        },
      ],
    },
  ],
};

function response(componentId, selectedCandidateIds, coverageEffect) {
  return JSON.stringify({
    schemaVersion: 1,
    componentId,
    selectedCandidateIds,
    coverageEffect,
    conflictState: CONFLICT_STATE.NONE,
  });
}

describe("preparedEvidenceContract", () => {
  test("does not treat a Pauschalversicherungssumme label as the VS-04 building-sum calculation method", () => {
    const worksheet = {
      candidateOnly: true,
      catalog: { categoryView: "VS" },
      requirements: [
        {
          id: "VS-04",
          label: "Methode der Summenermittlung",
          requestedFields: ["calculation_method"],
          components: [
            {
              id: "sum_calculation_method",
              label: "Methode der Summenermittlung",
              factRole: "DEFINITION",
              occurrences: [
                {
                  candidateId: "candidate:liability-sum",
                  exactText: "Pauschalversicherungssumme",
                  context: {
                    unitType: "PARAGRAPH",
                    text: "Im Rahmen der Pauschalversicherungssumme gilt ein Sublimit.",
                  },
                },
                {
                  candidateId: "candidate:claim-adjustment-report",
                  exactText: "Sachverständigengutachten",
                  context: {
                    unitType: "PARAGRAPH",
                    text: "Liegt noch kein Sachverständigengutachten vor, kann eine Akontozahlung vereinbart werden.",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.PROPOSAL,
      candidateTriage: [
        {
          requirementId: "VS-04",
          componentId: "sum_calculation_method",
          candidateId: "candidate:liability-sum",
          binding: "DIRECT",
        },
        {
          requirementId: "VS-04",
          componentId: "sum_calculation_method",
          candidateId: "candidate:claim-adjustment-report",
          binding: "DIRECT",
        },
      ],
    });

    expect(target.candidates).toEqual([]);
    expect(target.serverRejectedCandidates).toEqual([
      {
        candidateId: "candidate:liability-sum",
        reason: "VS_04_SUM_LABEL_NOT_BUILDING_SUM_METHOD",
      },
      {
        candidateId: "candidate:claim-adjustment-report",
        reason: "VS_04_SUM_LABEL_NOT_BUILDING_SUM_METHOD",
      },
    ]);
  });

  test("materializes explicit VS evidence without asking the model to select or classify it", () => {
    const worksheet = {
      candidateOnly: true,
      requirements: [
        {
          id: "VS-10",
          label: "Automatische Indexanpassung",
          requestedFields: [],
          components: [
            {
              id: "automatic_index_adjustment",
              label: "Automatische Indexanpassung",
              factRole: "CONDITION",
              occurrences: [
                {
                  candidateId: "candidate:automatic-index",
                  pageNumber: 4,
                  documentStart: 20,
                  documentEnd: 75,
                  exactText:
                    "Versicherungssumme erhöht oder vermindert sich jährlich",
                  context: {
                    unitType: "CLAUSE_SECTION",
                    documentStart: 0,
                    documentEnd: 98,
                    text: "Die Versicherungssumme erhöht oder vermindert sich jährlich bei Hauptfälligkeit der Prämie.",
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
      candidateTriage: [
        {
          requirementId: "VS-10",
          componentId: "automatic_index_adjustment",
          candidateId: "candidate:automatic-index",
          binding: "DIRECT",
        },
      ],
    });

    expect(target.candidates[0].deterministicBindingBasis).toBe(
      "EXPLICIT_AUTOMATIC_INDEX_ADJUSTMENT"
    );
    expect(buildDeterministicPreparedEvidenceJudgement(target)).toMatchObject({
      selectedCandidateIds: ["candidate:automatic-index"],
      evidencePresence: "FOUND",
      coverageEffect: "INCLUDED",
      conflictState: "NONE",
      selectedScopePicture: "GENERAL",
      decisionOwner: "SERVER_EXPLICIT_VS_RULE:VS-10",
    });
  });

  test("exposes server-owned candidate IDs and both page identities", () => {
    const [target] = buildPreparedEvidenceTargets({
      worksheet: WORKSHEET,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
    });

    expect(target.candidates[0]).toMatchObject({
      candidateId: "candidate:winter",
      physicalPageNumber: 15,
      printedPageLabel: "Seite 15 von 31",
      scopeLeadText: "Versichert sind:",
      pageScopeHints: [
        { scopeKey: "GLAS_INSURANCE", text: "Die Glasversicherung" },
      ],
    });
  });

  test("uses complete candidate triage to keep only direct and narrow effect candidates", () => {
    const triage = [
      {
        requirementId: "EL-16",
        componentId: "winter_garden",
        candidateId: "candidate:winter",
        binding: "DIRECT",
      },
      {
        requirementId: "EL-16",
        componentId: "display_case",
        candidateId: "candidate:vitrine",
        binding: "MENTION_ONLY",
      },
    ];
    const targets = buildPreparedEvidenceTargets({
      worksheet: WORKSHEET,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
      candidateTriage: triage,
    });

    expect(targets[0].candidates[0]).toMatchObject({
      candidateId: "candidate:winter",
      candidateBinding: "DIRECT",
    });
    expect(targets[1].candidates).toEqual([]);
    expect(targets[1].serverRejectedCandidates).toEqual([
      {
        candidateId: "candidate:vitrine",
        reason: "TRIAGE_MENTION_ONLY",
      },
    ]);
  });

  test("fails closed when candidate triage is missing, duplicated or identity-mismatched", () => {
    const direct = {
      requirementId: "EL-16",
      componentId: "winter_garden",
      candidateId: "candidate:winter",
      binding: "DIRECT",
    };
    const mention = {
      requirementId: "EL-16",
      componentId: "display_case",
      candidateId: "candidate:vitrine",
      binding: "MENTION_ONLY",
    };

    expect(() =>
      buildPreparedEvidenceTargets({
        worksheet: WORKSHEET,
        documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
        candidateTriage: [direct],
      })
    ).toThrow("PREPARED_TRIAGE_COVERAGE_INCOMPLETE");
    expect(() =>
      buildPreparedEvidenceTargets({
        worksheet: WORKSHEET,
        documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
        candidateTriage: [direct, direct, mention],
      })
    ).toThrow("PREPARED_TRIAGE_CANDIDATE_DUPLICATE");
    expect(() =>
      buildPreparedEvidenceTargets({
        worksheet: WORKSHEET,
        documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
        candidateTriage: [{ ...direct, requirementId: "VS-16" }, mention],
      })
    ).toThrow("PREPARED_TRIAGE_IDENTITY_MISMATCH");
  });

  test("keeps unresolved occurrences terminal FOUND and UNKNOWN instead of turning them into missing evidence", () => {
    const targets = buildPreparedEvidenceTargets({
      worksheet: WORKSHEET,
      documentStatus: DOCUMENT_STATUS.PROPOSAL,
      candidateTriage: [
        {
          requirementId: "EL-16",
          componentId: "winter_garden",
          candidateId: "candidate:winter",
          binding: "UNRESOLVED",
        },
        {
          requirementId: "EL-16",
          componentId: "display_case",
          candidateId: "candidate:vitrine",
          binding: "MENTION_ONLY",
        },
      ],
    });

    expect(targets[0]).toMatchObject({
      candidates: [],
      unresolvedCandidateIds: ["candidate:winter"],
    });
    const result = materializePreparedEvidence({
      worksheet: WORKSHEET,
      targets,
      judgements: [],
    });
    expect(result.judgements[0]).toMatchObject({
      evidencePresence: "FOUND",
      coverageEffect: "UNKNOWN",
      selectedScopePicture: "UNKNOWN",
      documentApplicability: "PROPOSED_ONLY",
      decisionOwner: "SERVER_TRIAGE_UNRESOLVED",
    });
    expect(result.judgements[1]).toMatchObject({
      evidencePresence: "NOT_FOUND",
      coverageEffect: "UNKNOWN",
    });
  });

  test("derives selected scope picture from server-owned triage bindings", () => {
    const targets = buildPreparedEvidenceTargets({
      worksheet: WORKSHEET,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
      candidateTriage: [
        {
          requirementId: "EL-16",
          componentId: "winter_garden",
          candidateId: "candidate:winter",
          binding: "NARROW_SCOPE",
        },
        {
          requirementId: "EL-16",
          componentId: "display_case",
          candidateId: "candidate:vitrine",
          binding: "DIRECT",
        },
      ],
    });
    const narrow = parseAndValidatePreparedEvidenceResponse({
      target: targets[0],
      responseText: response(
        "winter_garden",
        ["candidate:winter"],
        COVERAGE_EFFECT.INCLUDED
      ),
    });
    const direct = parseAndValidatePreparedEvidenceResponse({
      target: targets[1],
      responseText: response(
        "display_case",
        ["candidate:vitrine"],
        COVERAGE_EFFECT.EXCLUDED
      ),
    });

    expect(narrow.selectedScopePicture).toBe("NARROW_ONLY");
    expect(direct.selectedScopePicture).toBe("GENERAL");
  });

  test("unions positive narrow-scope candidates after an INCLUDED model decision", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    const component = worksheet.requirements[0].components[0];
    component.occurrences.push({
      ...JSON.parse(JSON.stringify(component.occurrences[0])),
      candidateId: "candidate:winter-narrow",
      exactText: "Mietverlust",
      context: {
        ...component.occurrences[0].context,
        text: "Mitversichert gelten Mietverlust auf Erstes Risiko",
      },
    });
    const targets = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.PROPOSAL,
      candidateTriage: [
        {
          requirementId: "EL-16",
          componentId: "winter_garden",
          candidateId: "candidate:winter",
          binding: "DIRECT",
        },
        {
          requirementId: "EL-16",
          componentId: "winter_garden",
          candidateId: "candidate:winter-narrow",
          binding: "NARROW_SCOPE",
        },
        {
          requirementId: "EL-16",
          componentId: "display_case",
          candidateId: "candidate:vitrine",
          binding: "MENTION_ONLY",
        },
      ],
    });

    const judgement = parseAndValidatePreparedEvidenceResponse({
      target: targets[0],
      responseText: response(
        "winter_garden",
        ["candidate:winter"],
        COVERAGE_EFFECT.INCLUDED
      ),
    });

    expect(judgement).toMatchObject({
      selectedCandidateIds: ["candidate:winter", "candidate:winter-narrow"],
      selectedScopePicture: "GENERAL_AND_NARROW",
      decisionOwner: "MODEL_EFFECT_SERVER_POSITIVE_SCOPE_UNION",
    });
  });

  test("does not union a narrow-scope exclusion into a positive decision", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    const component = worksheet.requirements[0].components[0];
    component.occurrences.push({
      ...JSON.parse(JSON.stringify(component.occurrences[0])),
      candidateId: "candidate:winter-negative-narrow",
      context: {
        ...component.occurrences[0].context,
        text: "Nicht versichert sind Wintergärten.",
      },
    });
    const targets = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.PROPOSAL,
      candidateTriage: [
        {
          requirementId: "EL-16",
          componentId: "winter_garden",
          candidateId: "candidate:winter",
          binding: "DIRECT",
        },
        {
          requirementId: "EL-16",
          componentId: "winter_garden",
          candidateId: "candidate:winter-negative-narrow",
          binding: "NARROW_SCOPE",
        },
        {
          requirementId: "EL-16",
          componentId: "display_case",
          candidateId: "candidate:vitrine",
          binding: "MENTION_ONLY",
        },
      ],
    });

    const judgement = parseAndValidatePreparedEvidenceResponse({
      target: targets[0],
      responseText: response(
        "winter_garden",
        ["candidate:winter"],
        COVERAGE_EFFECT.INCLUDED
      ),
    });

    expect(judgement.selectedCandidateIds).toEqual(["candidate:winter"]);
    expect(judgement.decisionOwner).toBe("MODEL");
  });

  test("preserves the negative governing marker instead of matching its positive substring", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    worksheet.requirements[0].components[0].occurrences[0].scopeLead.text =
      "Versichert sind Fassaden. Nicht versichert sind Innenverglasungen:";
    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
    });

    expect(target.candidates[0].scopeLeadText).toBe(
      "Nicht versichert sind Innenverglasungen:"
    );
  });

  test("keeps an EL liability occurrence auditable but out of the model candidate set", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    worksheet.catalog = { categoryView: "EL" };
    const occurrence = worksheet.requirements[0].components[0].occurrences[0];
    occurrence.context.text =
      "Die Versicherung erstreckt sich auf Schadenersatzverpflichtungen des Bauherrn durch Erdrutschungen.";
    occurrence.scopeLead.text = "Bauherrenhaftpflicht";
    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.PROPOSAL,
    });

    expect(target.candidates).toEqual([]);
    expect(target.serverRejectedCandidates).toEqual([
      {
        candidateId: "candidate:winter",
        reason: "EL_OTHER_SCOPE_LIABILITY",
      },
    ]);
  });

  test("keeps a narrow FE-D01 waste-cost occurrence out of the generic cost decision", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    worksheet.catalog = { categoryView: "FE" };
    const requirement = worksheet.requirements[0];
    requirement.id = "FE-D01";
    const component = requirement.components[0];
    component.id = "firefighting_costs";
    component.factRole = "COST";
    component.occurrences[0].context.text =
      "Feuerlöschkosten für Sondermüll und gefährlichen Abfall sind zusätzlich versichert.";
    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
    });

    expect(target.candidates).toEqual([]);
    expect(target.serverRejectedCandidates[0]).toMatchObject({
      candidateId: "candidate:winter",
      reason: "FE_D01_NARROW_WASTE_SCOPE",
    });
  });

  test("rejects a model-invented candidate ID", () => {
    const [target] = buildPreparedEvidenceTargets({
      worksheet: WORKSHEET,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
    });

    expect(() =>
      parseAndValidatePreparedEvidenceResponse({
        target,
        responseText: response(
          "winter_garden",
          ["candidate:invented"],
          COVERAGE_EFFECT.INCLUDED
        ),
      })
    ).toThrow("PREPARED_SELECTED_ID_UNKNOWN");
  });

  test("repairs one uniquely attributable opaque-ID transcription error only when enabled", () => {
    const [target] = buildPreparedEvidenceTargets({
      worksheet: WORKSHEET,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
    });

    const judgement = parseAndValidatePreparedEvidenceResponse({
      target,
      allowUniqueCandidateIdRepair: true,
      responseText: response(
        "winter_garden",
        ["candidate:winterr"],
        COVERAGE_EFFECT.INCLUDED
      ),
    });

    expect(judgement.selectedCandidateIds).toEqual(["candidate:winter"]);
    expect(judgement.candidateIdCorrections).toEqual([
      {
        observed: "candidate:winterr",
        repaired: "candidate:winter",
      },
    ]);
  });

  test("rejects an ambiguous one-edit candidate repair", () => {
    const [target] = buildPreparedEvidenceTargets({
      worksheet: WORKSHEET,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
    });
    target.candidates.push({
      ...target.candidates[0],
      candidateId: "candidate:winterx",
    });

    expect(() =>
      parseAndValidatePreparedEvidenceResponse({
        target,
        allowUniqueCandidateIdRepair: true,
        responseText: response(
          "winter_garden",
          ["candidate:wintery"],
          COVERAGE_EFFECT.INCLUDED
        ),
      })
    ).toThrow("PREPARED_SELECTED_ID_UNKNOWN");
  });

  test("normalizes DEFINED to INCLUDED only for a selected explicit COST rule", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    const component = worksheet.requirements[0].components[0];
    component.factRole = "COST";
    component.occurrences[0].context.text =
      "Feuerlöschkosten sind bis maximal 15 % mitversichert.";
    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
    });
    const judgement = parseAndValidatePreparedEvidenceResponse({
      target,
      responseText: response(
        "winter_garden",
        ["candidate:winter"],
        COVERAGE_EFFECT.DEFINED
      ),
    });

    expect(judgement).toMatchObject({
      coverageEffect: COVERAGE_EFFECT.INCLUDED,
      decisionOwner: "MODEL_SELECTION_SERVER_EFFECT_RULE",
    });
  });

  test("normalizes DEFINED for a selected PERIL under an explicit insured-perils heading", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    const component = worksheet.requirements[0].components[0];
    component.factRole = "PERIL";
    component.occurrences[0].context.text =
      "1. Versicherte Gefahren. Hochwasser ist das unregelmäßige Ausufern von Gewässern.";
    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.PROPOSAL,
    });
    const judgement = parseAndValidatePreparedEvidenceResponse({
      target,
      responseText: response(
        "winter_garden",
        ["candidate:winter"],
        COVERAGE_EFFECT.DEFINED
      ),
    });

    expect(judgement).toMatchObject({
      coverageEffect: COVERAGE_EFFECT.INCLUDED,
      decisionOwner: "MODEL_SELECTION_SERVER_EFFECT_RULE",
    });
  });

  test("rolls two different object effects into complete MIXED without conflict", () => {
    const targets = buildPreparedEvidenceTargets({
      worksheet: WORKSHEET,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
    });
    const judgements = [
      parseAndValidatePreparedEvidenceResponse({
        target: targets[0],
        responseText: response(
          "winter_garden",
          ["candidate:winter"],
          COVERAGE_EFFECT.INCLUDED
        ),
      }),
      parseAndValidatePreparedEvidenceResponse({
        target: targets[1],
        responseText: response(
          "display_case",
          ["candidate:vitrine"],
          COVERAGE_EFFECT.EXCLUDED
        ),
      }),
    ];

    const result = materializePreparedEvidence({
      worksheet: WORKSHEET,
      targets,
      judgements,
    });

    expect(result.rollups[0]).toMatchObject({
      coveragePicture: COVERAGE_PICTURE.MIXED,
      conflictState: CONFLICT_STATE.NONE,
      requestedFields: ["limit", "condition"],
      requestedFieldStatus: REQUESTED_FIELD_STATUS.NOT_EVALUATED,
    });
    expect(result.judgements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentApplicability: DOCUMENT_APPLICABILITY.CONDITIONAL,
        }),
      ])
    );
  });

  test("materializes a missing component server-side without a model result", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    worksheet.requirements[0].components[1].occurrences = [];
    const targets = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.PROPOSAL,
    });
    const winter = parseAndValidatePreparedEvidenceResponse({
      target: targets[0],
      responseText: response(
        "winter_garden",
        ["candidate:winter"],
        COVERAGE_EFFECT.INCLUDED
      ),
    });

    const result = materializePreparedEvidence({
      worksheet,
      targets,
      judgements: [winter],
    });

    expect(result.judgements[0].documentApplicability).toBe(
      DOCUMENT_APPLICABILITY.PROPOSED_ONLY
    );
    expect(result.judgements[1]).toMatchObject({
      evidencePresence: "NOT_FOUND",
      coverageEffect: "UNKNOWN",
      decisionOwner: "SERVER",
    });
  });

  test("marks rows without requested fields as not requiring value evaluation", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    worksheet.requirements[0].requestedFields = [];
    const targets = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
    });
    const judgements = targets.map((target) =>
      parseAndValidatePreparedEvidenceResponse({
        target,
        responseText: response(
          target.componentId,
          [target.candidates[0].candidateId],
          target.componentId === "winter_garden"
            ? COVERAGE_EFFECT.INCLUDED
            : COVERAGE_EFFECT.EXCLUDED
        ),
      })
    );

    const result = materializePreparedEvidence({
      worksheet,
      targets,
      judgements,
    });

    expect(result.rollups[0].requestedFieldStatus).toBe(
      REQUESTED_FIELD_STATUS.NOT_REQUIRED
    );
  });
});
