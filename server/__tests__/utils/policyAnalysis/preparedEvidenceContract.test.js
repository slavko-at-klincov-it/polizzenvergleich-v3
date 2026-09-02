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
  test("server-certifies only the exact FE-B13 occurrence from a current foreign section", () => {
    const occurrence = {
      candidateId: "candidate:pre-inception-water",
      matchedAlias: "vor Beginn des Versicherungsschutzes",
      pageNumber: 2,
      physicalPageNumber: 2,
      documentStart: 1835,
      documentEnd: 1871,
      exactText: "vor Beginn des Versicherungsschutzes",
      context: {
        unitType: "WORD_WINDOW_FALLBACK",
        text: "Nicht versichert sind Leitungswasserschäden, die vor Beginn des Versicherungsschutzes ursprünglich entstanden sind.",
      },
      scopeLead: {
        text: "Allgemeine Bedingungen für die Leitungswasserversicherung. Nicht versichert sind Schäden:",
      },
      pageScopeHints: [
        {
          scopeKey: "LEITUNGSWASSER_INSURANCE",
          text: "die Leitungswasserversicherung",
        },
      ],
      sectionScopeHint: {
        scopeKey: "LEITUNGSWASSER_INSURANCE",
        text: "Allgemeine Bedingungen für die Leitungswasserversicherung",
        physicalPageNumber: 2,
        source: "CURRENT_PAGE_HEADING",
      },
    };
    const worksheetFor = (candidate, overrides = {}) => ({
      candidateOnly: true,
      catalog: { categoryView: overrides.categoryView || "FE" },
      requirements: [
        {
          id: overrides.requirementId || "FE-B13",
          label: "Ausschluss vorvertraglicher Schäden",
          requestedFields: [],
          negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: "EXCLUSION",
          components: [
            {
              id: overrides.componentId || "pre_inception_damage_exclusion",
              label: "Ausschluss vorvertraglicher Schäden",
              factRole: "EXCLUSION",
              occurrences: [candidate],
            },
          ],
        },
      ],
    });
    const targetFor = (candidate, overrides) =>
      buildPreparedEvidenceTargets({
        worksheet: worksheetFor(candidate, overrides),
        documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
        candidateTriage: [
          {
            requirementId: overrides?.requirementId || "FE-B13",
            componentId:
              overrides?.componentId || "pre_inception_damage_exclusion",
            candidateId: candidate.candidateId,
            binding: "DIRECT",
          },
        ],
      })[0];

    const target = targetFor(occurrence);
    expect(target.candidates).toEqual([]);
    expect(target.unresolvedCandidateIds).toEqual([]);
    expect(target.serverRejectedCandidates).toEqual([
      expect.objectContaining({
        candidateId: occurrence.candidateId,
        reason: "TRIAGE_MENTION_ONLY",
        terminalRejectionContractId: "DETERMINISTIC_OTHER_CATEGORY_TERMINAL_V1",
        decisionOwner: "SERVER",
        decisionBasis: "EXPLICIT_OTHER_CATEGORY_SECTION",
        physicalPageNumber: 2,
        sectionScopeSource: "CURRENT_PAGE_HEADING",
        observedScopeKeys: ["LEITUNGSWASSER_INSURANCE"],
        occurrenceDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    ]);

    const adversarial = [
      {
        ...occurrence,
        sectionScopeHint: {
          ...occurrence.sectionScopeHint,
          source: "PRECEDING_PAGE_HEADING",
        },
      },
      {
        ...occurrence,
        pageScopeHints: [
          ...occurrence.pageScopeHints,
          { scopeKey: "FEUER_INSURANCE", text: "Feuerversicherung" },
        ],
      },
      {
        ...occurrence,
        context: {
          ...occurrence.context,
          text: "Die Regel gilt auch für die Feuerversicherung: Schäden vor Beginn des Versicherungsschutzes sind nicht versichert.",
        },
      },
    ];
    for (const candidate of adversarial) {
      const rejected = targetFor(candidate);
      expect(rejected.candidates).toHaveLength(1);
      expect(rejected.serverRejectedCandidates).toEqual([]);
    }

    const elementarCrossReference = {
      ...occurrence,
      exactText: "Kanalrückstau",
      matchedAlias: "Kanalrückstau",
      context: {
        ...occurrence.context,
        text: "Schäden aus einem Kanalrückstau nach einer Überschwemmung sind im Rahmen der Versicherungssumme für Hochwasser mitversichert.",
      },
    };
    const elTarget = targetFor(elementarCrossReference, {
      categoryView: "EL",
      requirementId: "EL-06",
      componentId: "sewer_backflow",
    });
    expect(elTarget.candidates).toHaveLength(1);
    expect(elTarget.serverRejectedCandidates).toEqual([]);
  });

  test("server-certifies ST-14 light domes only inside a locally governed current glass section", () => {
    const occurrence = {
      candidateId: "candidate:glass-light-dome",
      matchedAlias: "Lichtkuppeln",
      pageNumber: 15,
      physicalPageNumber: 15,
      documentStart: 29442,
      documentEnd: 29454,
      exactText: "Lichtkuppeln",
      context: {
        unitType: "LIST_ITEM",
        text: "Firmenschilder, Reklameanlagen, Lichtkuppeln und dergleichen.",
      },
      scopeLead: {
        text: "7. Glasbruch. Versichert sind die Sachen im Rahmen der Gebäude-Glaspauschale:",
      },
      pageScopeHints: [],
      sectionScopeHint: {
        scopeKey: "GLASBRUCH_INSURANCE",
        text: "7. Glasbruch",
        physicalPageNumber: 15,
        source: "CURRENT_PAGE_HEADING",
      },
    };
    const worksheetFor = (candidate, overrides = {}) => ({
      candidateOnly: true,
      catalog: { categoryView: overrides.categoryView || "ST" },
      requirements: [
        {
          id: overrides.requirementId || "ST-14",
          label: "Dachfenster und Lichtkuppeln",
          requestedFields: [],
          negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: overrides.absenceMeaning || "COVERAGE_ONLY",
          components: [
            {
              id: overrides.componentId || "skylight_dome",
              label: "Lichtkuppeln",
              factRole: overrides.factRole || "INSURED_OBJECT",
              occurrences: [candidate],
            },
          ],
        },
      ],
    });
    const targetFor = (candidate, overrides = {}) =>
      buildPreparedEvidenceTargets({
        worksheet: worksheetFor(candidate, overrides),
        documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
        candidateTriage: [
          {
            requirementId: overrides.requirementId || "ST-14",
            componentId: overrides.componentId || "skylight_dome",
            candidateId: candidate.candidateId,
            binding: "MENTION_ONLY",
          },
        ],
      })[0];

    expect(targetFor(occurrence)).toMatchObject({
      candidates: [],
      unresolvedCandidateIds: [],
      serverRejectedCandidates: [
        {
          candidateId: occurrence.candidateId,
          reason: "TRIAGE_MENTION_ONLY",
          terminalRejectionContractId:
            "DETERMINISTIC_OTHER_CATEGORY_TERMINAL_V1",
          decisionOwner: "SERVER",
          decisionBasis: "EXPLICIT_OTHER_CATEGORY_SECTION",
          physicalPageNumber: 15,
          sectionScopeSource: "CURRENT_PAGE_HEADING",
          observedScopeKeys: ["GLASBRUCH_INSURANCE"],
          scopeProofMode: "CURRENT_SECTION_PLUS_LOCAL_FOREIGN_COVERAGE_V1",
          occurrenceDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        },
      ],
    });

    const adversarial = [
      {
        candidate: {
          ...occurrence,
          sectionScopeHint: {
            ...occurrence.sectionScopeHint,
            source: "PRECEDING_PAGE_HEADING",
          },
        },
      },
      {
        candidate: {
          ...occurrence,
          context: {
            ...occurrence.context,
            text: "Lichtkuppeln sind auch gegen Sturm und Hagel versichert.",
          },
        },
      },
      {
        candidate: {
          ...occurrence,
          scopeLead: { text: "Bauteile: Glasdächer und Lichtkuppeln." },
        },
      },
      {
        candidate: {
          ...occurrence,
          pageScopeHints: [
            { scopeKey: "STURM_INSURANCE", text: "Sturmversicherung" },
          ],
        },
      },
      { overrides: { requirementId: "ST-13" } },
      { overrides: { factRole: "DEFINITION" } },
      { overrides: { absenceMeaning: "EXCLUSION" } },
    ];
    for (const { candidate = occurrence, overrides = {} } of adversarial) {
      const target = targetFor(candidate, overrides);
      expect(target.candidates).toHaveLength(0);
      expect(target.serverRejectedCandidates).toEqual([
        {
          candidateId: candidate.candidateId,
          reason: "TRIAGE_MENTION_ONLY",
        },
      ]);
    }
  });

  test("server-certifies only locally proven LW-25 mentions inherited from the liability section", () => {
    const inheritedLiabilitySection = {
      scopeKey: "HAFTPFLICHT_INSURANCE",
      text: "8. Gebäude- und Grundstückshaftpflichtversicherung",
      physicalPageNumber: 17,
      source: "PRECEDING_PAGE_HEADING",
    };
    const gradualMoistureExclusion = {
      candidateId: "candidate:liability-gradual-moisture-exclusion",
      matchedAlias: "allmähliche Einwirkung von Feuchtigkeit",
      pageNumber: 20,
      physicalPageNumber: 20,
      documentStart: 40742,
      documentEnd: 40780,
      exactText: "allmähliche Einwirkung von Feuchtigkeit",
      context: {
        unitType: "PARAGRAPH",
        text: "Kein Ersatz wird geleistet für Schäden an der Außenseite des Gebäudes wie am Dach, an Fassaden, Fenstern und Türen und durch allmähliche Einwirkung von Feuchtigkeit.",
      },
      scopeLead: {
        text: "Kein Ersatz wird geleistet für Schäden an der Außenseite des Gebäudes.",
      },
      pageScopeHints: [],
      sectionScopeHint: inheritedLiabilitySection,
    };
    const gradualLiabilityInclusion = {
      candidateId: "candidate:liability-gradual-damage-inclusion",
      matchedAlias: "Allmählichkeitsschäden",
      pageNumber: 20,
      physicalPageNumber: 20,
      documentStart: 41440,
      documentEnd: 41464,
      exactText: "Allmählichkeitsschäden",
      context: {
        unitType: "LIST_ITEM",
        text: "Allmählichkeitsschäden. Der Versicherungsschutz bezieht sich in Abänderung von Art. 7.11 AHVB auch auf Schadenersatzverpflichtungen wegen Schäden an Sachen.",
      },
      scopeLead: { text: "Allmählichkeitsschäden" },
      pageScopeHints: [],
      sectionScopeHint: {
        scopeKey: "HAFTPFLICHT_INSURANCE",
        text: "Entschädigung aus der Haftpflichtversicherung",
        physicalPageNumber: 20,
        source: "CURRENT_PAGE_HEADING",
      },
    };
    const worksheetFor = (occurrences, overrides = {}) => ({
      candidateOnly: true,
      catalog: { categoryView: overrides.categoryView || "LW" },
      requirements: [
        {
          id: overrides.requirementId || "LW-25",
          label: "Ausschluss allmählicher oder schleichender Einwirkung",
          requestedFields: [],
          negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: overrides.absenceMeaning || "COVERAGE_ONLY",
          components: [
            {
              id: overrides.componentId || "gradual_or_creeping_exclusion",
              label: "Ausschluss allmählicher oder schleichender Einwirkung",
              factRole: overrides.factRole || "DAMAGE",
              occurrences,
            },
          ],
        },
      ],
    });
    const targetFor = (occurrences, overrides = {}) =>
      buildPreparedEvidenceTargets({
        worksheet: worksheetFor(occurrences, overrides),
        documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
        candidateTriage: occurrences.map((occurrence) => ({
          requirementId: overrides.requirementId || "LW-25",
          componentId: overrides.componentId || "gradual_or_creeping_exclusion",
          candidateId: occurrence.candidateId,
          binding: "MENTION_ONLY",
        })),
      })[0];

    const target = targetFor([
      gradualMoistureExclusion,
      gradualLiabilityInclusion,
    ]);
    expect(target.candidates).toEqual([]);
    expect(target.unresolvedCandidateIds).toEqual([]);
    expect(target.serverRejectedCandidates).toEqual(
      expect.arrayContaining(
        [gradualMoistureExclusion, gradualLiabilityInclusion].map(
          (occurrence) =>
            expect.objectContaining({
              candidateId: occurrence.candidateId,
              reason: "TRIAGE_MENTION_ONLY",
              terminalRejectionContractId:
                "DETERMINISTIC_OTHER_CATEGORY_TERMINAL_V1",
              decisionOwner: "SERVER",
              decisionBasis: "EXPLICIT_OTHER_CATEGORY_SECTION",
              physicalPageNumber: 20,
              sectionScopeSource: occurrence.sectionScopeHint.source,
              observedScopeKeys: ["HAFTPFLICHT_INSURANCE"],
              scopeProofMode:
                "INHERITED_LIABILITY_SECTION_PLUS_LOCAL_FOREIGN_CLAUSE_V1",
              occurrenceDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
            })
        )
      )
    );

    const adversarial = [
      {
        ...gradualMoistureExclusion,
        sectionScopeHint: {
          ...inheritedLiabilitySection,
          source: "CURRENT_PAGE_HEADING",
        },
      },
      {
        ...gradualLiabilityInclusion,
        sectionScopeHint: {
          ...gradualLiabilityInclusion.sectionScopeHint,
          text: "Allgemeine Bedingungen für die Haftpflichtversicherung",
        },
      },
      {
        ...gradualLiabilityInclusion,
        sectionScopeHint: {
          ...gradualLiabilityInclusion.sectionScopeHint,
          physicalPageNumber: 19,
        },
      },
      {
        ...gradualMoistureExclusion,
        sectionScopeHint: {
          ...inheritedLiabilitySection,
          text: "Allgemeine Bedingungen für die Haftpflichtversicherung",
        },
      },
      {
        ...gradualMoistureExclusion,
        sectionScopeHint: {
          ...inheritedLiabilitySection,
          physicalPageNumber: 16,
        },
      },
      {
        ...gradualMoistureExclusion,
        context: {
          ...gradualMoistureExclusion.context,
          text: `${gradualMoistureExclusion.context.text} Dies gilt auch für Leitungswasserschäden.`,
        },
      },
      {
        ...gradualMoistureExclusion,
        context: {
          unitType: "PARAGRAPH",
          text: "Kein Ersatz wird für allmähliche Einwirkung von Feuchtigkeit geleistet.",
        },
        scopeLead: { text: "Kein Ersatz wird geleistet." },
      },
      {
        ...gradualLiabilityInclusion,
        context: {
          unitType: "LIST_ITEM",
          text: "Allmählichkeitsschäden sind allgemein beschrieben.",
        },
      },
      {
        ...gradualMoistureExclusion,
        pageScopeHints: [
          {
            scopeKey: "LEITUNGSWASSER_INSURANCE",
            text: "Leitungswasserversicherung",
          },
        ],
      },
    ];
    for (const occurrence of adversarial) {
      const rejected = targetFor([occurrence]);
      expect(rejected.candidates).toEqual([]);
      expect(rejected.serverRejectedCandidates).toEqual([
        {
          candidateId: occurrence.candidateId,
          reason: "TRIAGE_MENTION_ONLY",
        },
      ]);
    }

    for (const overrides of [
      { requirementId: "LW-24" },
      { componentId: "other_component" },
      { factRole: "EXCLUSION" },
      { absenceMeaning: "EXCLUSION" },
    ]) {
      const rejected = targetFor([gradualMoistureExclusion], overrides);
      expect(rejected.serverRejectedCandidates).toEqual([
        {
          candidateId: gradualMoistureExclusion.candidateId,
          reason: "TRIAGE_MENTION_ONLY",
        },
      ]);
    }
  });

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

  test("materializes a pure object-classification list as a neutral definition", () => {
    const worksheet = {
      candidateOnly: true,
      catalog: { categoryView: "ST" },
      requirements: [
        {
          id: "ST-16",
          label: "Jalousien und Rollläden",
          requestedFields: [],
          components: [
            {
              id: "shading_system",
              label: "Beschattungssysteme",
              factRole: "INSURED_OBJECT",
              occurrences: ["Jalousien", "Rollläden"].map((exactText) => ({
                candidateId: `candidate:${exactText}`,
                exactText,
                objectClassificationGovernorHint: {
                  contractId: "CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1",
                },
                context: {
                  unitType: "LIST_ITEM",
                  text: "·Jalousien und Rollläden (nicht Sonnensegel und nicht Markisen);",
                },
              })),
            },
          ],
        },
      ],
    };
    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
      candidateTriage: ["Jalousien", "Rollläden"].map((exactText) => ({
        requirementId: "ST-16",
        componentId: "shading_system",
        candidateId: `candidate:${exactText}`,
        binding: "DIRECT",
      })),
    });

    expect(target.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectClassificationContractId:
            "CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1",
        }),
      ])
    );
    expect(buildDeterministicPreparedEvidenceJudgement(target)).toMatchObject({
      selectedCandidateIds: ["candidate:Jalousien", "candidate:Rollläden"],
      coverageEffect: COVERAGE_EFFECT.DEFINED,
      evidencePresence: "FOUND",
      decisionOwner: "SERVER_OBJECT_CLASSIFICATION_IS_NOT_GLOBAL_COVERAGE_V1",
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

  test("uses an explicit coverage-role aggregation policy without dropping a required condition", () => {
    const worksheet = JSON.parse(JSON.stringify(WORKSHEET));
    const requirement = worksheet.requirements[0];
    requirement.requestedFields = [];
    requirement.coverageAggregationPolicy = "COVERAGE_ROLES_ONLY";
    requirement.components[0].factRole = "INSURED_OBJECT";
    requirement.components[1].factRole = "CONDITION";
    const targets = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.PROPOSAL,
    });
    const judgements = targets.map((target) =>
      parseAndValidatePreparedEvidenceResponse({
        target,
        responseText: response(
          target.componentId,
          [target.candidates[0].candidateId],
          target.factRole === "CONDITION"
            ? COVERAGE_EFFECT.CONDITIONAL
            : COVERAGE_EFFECT.INCLUDED
        ),
      })
    );

    const result = materializePreparedEvidence({
      worksheet,
      targets,
      judgements,
    });

    expect(result.rollups[0]).toMatchObject({
      coverageComponentIds: [requirement.components[0].id],
      evidenceCompleteness: "COMPLETE",
      coveragePicture: COVERAGE_PICTURE.INCLUDED,
      reviewStatus: "BELEGT",
    });
    expect(result.judgements[1]).toMatchObject({
      evidencePresence: "FOUND",
      coverageEffect: COVERAGE_EFFECT.CONDITIONAL,
    });
  });
});
