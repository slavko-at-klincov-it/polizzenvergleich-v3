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
const {
  COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_DECISION_BASIS,
  COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_SCOPE_PROOF_MODE,
  COVERAGE_ONLY_OBJECT_CLASSIFICATION_DECISION_BASIS,
  COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID,
  COVERAGE_ONLY_OBJECT_CLASSIFICATION_SCOPE_PROOF_MODE,
  DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASSIFICATION_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID,
  FE_C12_POST_LOSS_SCAFFOLDING_COST_DECISION_BASIS,
  FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE,
  OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
  LW20_NON_TARGET_OCCURRENCE_DECISION_BASIS,
  LW20_NON_TARGET_OCCURRENCE_SCOPE_PROOF_MODE,
  TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
  terminalOccurrenceDigest,
} = require("../../../utils/policyAnalysis/deterministicTerminalRejectionContract");
const {
  FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

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
              factRole: overrides.factRole || "EXCLUSION",
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
            binding: overrides?.triageBinding || "DIRECT",
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
        occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
        decisionOwner: "SERVER",
        decisionBasis: "EXPLICIT_OTHER_CATEGORY_SECTION",
        physicalPageNumber: 2,
        sectionScopeSource: "CURRENT_PAGE_HEADING",
        observedScopeKeys: ["LEITUNGSWASSER_INSURANCE"],
        occurrenceDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    ]);
    const certifiedOccurrenceDigest =
      target.serverRejectedCandidates[0].occurrenceDigestSha256;
    expect(
      terminalOccurrenceDigest({
        ...occurrence,
        context: {
          ...occurrence.context,
          text: `${occurrence.context.text} Diese Regel gilt ebenso für Feuerschäden.`,
        },
      })
    ).not.toBe(certifiedOccurrenceDigest);
    expect(
      terminalOccurrenceDigest({
        ...occurrence,
        scopeLead: {
          text: `${occurrence.scopeLead.text} Feuerversicherung`,
        },
      })
    ).not.toBe(certifiedOccurrenceDigest);

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

    const elementarContext =
      "LW06 Kanalrückstau\nSchäden aus einem Kanalrückstau nach einer Überschwemmung sind im Rahmen der VS für Hochwasser/Überschwemmung mitversichert";
    const elementarContextStart = 38_950;
    const elementarOccurrenceStart =
      elementarContextStart + elementarContext.indexOf("Kanalrückstau");
    const elementarCrossReference = {
      ...occurrence,
      exactText: "Kanalrückstau",
      matchedAlias: "Kanalrückstau",
      documentStart: elementarOccurrenceStart,
      documentEnd: elementarOccurrenceStart + "Kanalrückstau".length,
      context: {
        ...occurrence.context,
        unitType: "PARAGRAPH",
        text: elementarContext,
        documentStart: elementarContextStart,
        documentEnd: elementarContextStart + elementarContext.length,
      },
      sectionScopeHint: {
        ...occurrence.sectionScopeHint,
        source: "PRECEDING_PAGE_HEADING",
        physicalPageNumber: 1,
      },
      pageScopeHints: [
        {
          scopeKey: "LEITUNGSWASSER_INSURANCE",
          text: "Leitungswasserversicherung",
        },
      ],
    };
    const elTarget = targetFor(elementarCrossReference, {
      categoryView: "EL",
      requirementId: "EL-06",
      componentId: "sewer_backflow",
      factRole: "PERIL",
      triageBinding: "MENTION_ONLY",
    });
    expect(elTarget.candidates).toEqual([
      expect.objectContaining({
        candidateId: elementarCrossReference.candidateId,
        candidateBinding: "NARROW_SCOPE",
        deterministicBindingBasis: "EL_06_LOCAL_TARGET_SCOPE_REBINDING_V2",
      }),
    ]);
    expect(elTarget.serverRejectedCandidates).toEqual([]);
    expect(buildDeterministicPreparedEvidenceJudgement(elTarget)).toMatchObject(
      {
        selectedCandidateIds: [elementarCrossReference.candidateId],
        coverageEffect: COVERAGE_EFFECT.INCLUDED,
        selectedScopePicture: "NARROW_ONLY",
        decisionOwner: "SERVER_EL06_EXPLICIT_LOCAL_FLOOD_COVERAGE_V2:EL:EL-06",
      }
    );

    const existingNarrowTarget = {
      ...elTarget,
      candidates: elTarget.candidates.map((candidate) => ({
        ...candidate,
        deterministicBindingBasis: "EXPLICIT_NARROW_SECTION_SCOPE",
        contextText:
          "Versichert sind Schäden durch Überschwemmungen sowie durch in diesem Zusammenhang auftretenden Rückstau.",
      })),
    };
    expect(
      buildDeterministicPreparedEvidenceJudgement(existingNarrowTarget)
    ).toMatchObject({
      coverageEffect: COVERAGE_EFFECT.INCLUDED,
      selectedScopePicture: "NARROW_ONLY",
      decisionOwner: "SERVER_EXPLICIT_CATEGORY_CLAUSE:EL:EL-06",
    });
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

  test("server-certifies only occurrence-local FE-C12 post-loss scaffolding costs", () => {
    const glassSection = {
      scopeKey: "GLASBRUCH_INSURANCE",
      text: "7. Glasbruch",
      physicalPageNumber: 15,
      source: "CURRENT_PAGE_HEADING",
    };
    const occurrenceFrom = ({
      candidateId,
      text,
      exactText,
      unitType = "PARAGRAPH",
      sectionScopeHint = null,
      pageScopeHints = [],
      physicalPageNumber = 15,
    }) => {
      const contextDocumentStart = 30_000;
      const relativeStart = text.indexOf(exactText);
      if (relativeStart < 0) throw new Error("FIXTURE_EXACT_TEXT_MISSING");
      return {
        candidateId,
        matchedAlias: exactText,
        pageNumber: physicalPageNumber,
        physicalPageNumber,
        documentStart: contextDocumentStart + relativeStart,
        documentEnd: contextDocumentStart + relativeStart + exactText.length,
        exactText,
        context: {
          unitType,
          documentStart: contextDocumentStart,
          documentEnd: contextDocumentStart + text.length,
          text,
        },
        scopeLead: { text: "Zusätzlich versichert sind" },
        pageScopeHints,
        sectionScopeHint,
      };
    };
    const worksheetFor = (candidate, overrides = {}) => ({
      candidateOnly: true,
      catalog: { categoryView: overrides.categoryView || "FE" },
      requirements: [
        {
          id: overrides.requirementId || "FE-C12",
          label: "Gerüst und Baustelleneinrichtung während Sanierungen",
          requestedFields: [],
          negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: overrides.absenceMeaning || "COVERAGE_MIXED",
          components: [
            {
              id: overrides.componentId || "scaffolding",
              label: "Gerüst",
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
            requirementId: overrides.requirementId || "FE-C12",
            componentId: overrides.componentId || "scaffolding",
            candidateId: candidate.candidateId,
            binding: "DIRECT",
          },
        ],
      })[0];

    const realForms = [
      {
        occurrence: occurrenceFrom({
          candidateId: "candidate:fe-c12:replacement-scaffold-cost",
          text: "Kosten für Gerüste, die zur Ersatzausführung erforderlich sind;",
          exactText: "Gerüste",
          unitType: "LIST_ITEM",
          sectionScopeHint: glassSection,
        }),
        sectionScopeSource: "CURRENT_PAGE_HEADING",
        observedScopeKeys: ["GLASBRUCH_INSURANCE"],
      },
      {
        occurrence: occurrenceFrom({
          candidateId: "candidate:fe-c12:glass-loss-scaffold-cost",
          text: "GL04 Gerüstkosten\nMitversichert sind Gerüst- und Krankosten nach einem ersatzpflichtigen Glasschaden.",
          exactText: "Gerüst",
          sectionScopeHint: {
            ...glassSection,
            text: "GL03 Folgeschäden aus Glasbruch",
            physicalPageNumber: 14,
          },
          physicalPageNumber: 14,
        }),
        sectionScopeSource: "CURRENT_PAGE_HEADING",
        observedScopeKeys: ["GLASBRUCH_INSURANCE"],
      },
      {
        occurrence: occurrenceFrom({
          candidateId: "candidate:fe-c12:insured-glass-repair-cost",
          text: [
            "9.1.9 Für andere Sachen wird der Versicherungswert ersetzt.",
            "9.1.10für versicherte Gläser",
            "werden die ortsüblichen Reparaturkosten inklusive erforderlicher Notverglasung oder Notverschalung, Kosten für notwendige Gerüste sowie Entfernung von Hindernissen ersetzt.",
            "9.1.11für besonders vereinbarte Sachen wird Ersatz geleistet.",
          ].join("\n"),
          exactText: "Gerüste",
          unitType: "WORD_WINDOW_FALLBACK",
          physicalPageNumber: 7,
        }),
        sectionScopeSource: OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
        observedScopeKeys: [],
      },
    ];

    for (const {
      occurrence,
      sectionScopeSource,
      observedScopeKeys,
    } of realForms)
      expect(targetFor(occurrence)).toMatchObject({
        candidates: [],
        unresolvedCandidateIds: [],
        serverRejectedCandidates: [
          {
            candidateId: occurrence.candidateId,
            reason: "TRIAGE_MENTION_ONLY",
            terminalRejectionContractId:
              DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID,
            occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
            decisionOwner: "SERVER",
            decisionBasis: FE_C12_POST_LOSS_SCAFFOLDING_COST_DECISION_BASIS,
            physicalPageNumber: occurrence.physicalPageNumber,
            sectionScopeSource,
            observedScopeKeys,
            scopeProofMode: FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE,
            occurrenceDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          },
        ],
      });

    const failClosed = [
      occurrenceFrom({
        candidateId: "candidate:fe-c12:positive-renovation-object",
        text: "Während Sanierungsarbeiten sind Gerüste und Baustelleneinrichtungen mitversichert.",
        exactText: "Gerüste",
        sectionScopeHint: {
          ...glassSection,
          scopeKey: "FEUER_INSURANCE",
          text: "FEUERVERSICHERUNG",
        },
      }),
      occurrenceFrom({
        candidateId: "candidate:fe-c12:excluded-renovation-object",
        text: "Gerüste und Baustelleneinrichtungen sind während Sanierungen nicht versichert.",
        exactText: "Gerüste",
        sectionScopeHint: {
          ...glassSection,
          scopeKey: "FEUER_INSURANCE",
          text: "FEUERVERSICHERUNG",
        },
      }),
      occurrenceFrom({
        candidateId: "candidate:fe-c12:optional-scaffold",
        text: "Gerüstkosten können gegen Mehrprämie eingeschlossen werden.",
        exactText: "Gerüst",
        sectionScopeHint: glassSection,
      }),
      occurrenceFrom({
        candidateId: "candidate:fe-c12:mixed-glass-and-renovation",
        text: "Während Sanierungen sind Gerüste versichert; Kosten für Gerüste nach einem Glasschaden werden ebenfalls ersetzt.",
        exactText: "Gerüste",
        sectionScopeHint: glassSection,
      }),
      occurrenceFrom({
        candidateId: "candidate:fe-c12:ambiguous-cost",
        text: "Gerüstkosten werden ersetzt.",
        exactText: "Gerüst",
        sectionScopeHint: null,
      }),
      occurrenceFrom({
        candidateId: "candidate:fe-c12:inherited-glass-scope",
        text: "Kosten für Gerüste zur Ersatzausführung werden ersetzt.",
        exactText: "Gerüste",
        sectionScopeHint: {
          ...glassSection,
          source: "PRECEDING_PAGE_HEADING",
        },
      }),
      occurrenceFrom({
        candidateId: "candidate:fe-c12:mixed-page-scope",
        text: "Kosten für Gerüste zur Ersatzausführung werden ersetzt.",
        exactText: "Gerüste",
        sectionScopeHint: glassSection,
        pageScopeHints: [
          { scopeKey: "STURM_INSURANCE", text: "Sturmversicherung" },
        ],
      }),
    ];
    for (const occurrence of failClosed) {
      const target = targetFor(occurrence);
      expect(target.serverRejectedCandidates).not.toEqual([
        expect.objectContaining({
          terminalRejectionContractId:
            DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID,
        }),
      ]);
      expect(target.candidates).toHaveLength(1);
    }

    for (const overrides of [
      { requirementId: "FE-C11" },
      { componentId: "site_equipment" },
      { factRole: "COST" },
      { absenceMeaning: "COVERAGE_ONLY" },
    ]) {
      const target = targetFor(realForms[0].occurrence, overrides);
      expect(target.candidates).toHaveLength(1);
      expect(target.serverRejectedCandidates).toEqual([]);
    }

    const offsetTampered = {
      ...realForms[2].occurrence,
      documentStart: realForms[2].occurrence.documentStart + 1,
      documentEnd: realForms[2].occurrence.documentEnd + 1,
    };
    expect(targetFor(offsetTampered).candidates).toHaveLength(1);
  });

  test("server-certifies only the four real LW-20 non-target occurrence forms", () => {
    const occurrenceFrom = ({
      candidateId,
      text,
      exactText = "Grundwasser",
      unitType = "LIST_ITEM",
      physicalPageNumber,
      sectionScopeHint = null,
      pageScopeHints = [],
    }) => {
      const contextDocumentStart = physicalPageNumber * 10_000;
      const relativeStart = text.indexOf(exactText);
      if (relativeStart < 0) throw new Error("FIXTURE_EXACT_TEXT_MISSING");
      return {
        candidateId,
        matchedAlias: exactText,
        pageNumber: physicalPageNumber,
        physicalPageNumber,
        documentStart: contextDocumentStart + relativeStart,
        documentEnd: contextDocumentStart + relativeStart + exactText.length,
        exactText,
        context: {
          unitType,
          documentStart: contextDocumentStart,
          documentEnd: contextDocumentStart + text.length,
          text,
        },
        scopeLead: { text },
        pageScopeHints,
        sectionScopeHint,
      };
    };
    const worksheetFor = (occurrences, overrides = {}) => ({
      candidateOnly: true,
      catalog: { categoryView: overrides.categoryView || "LW" },
      requirements: [
        {
          id: overrides.requirementId || "LW-20",
          label: "Grundwasser, Sickerwasser oder Stauwasser",
          requestedFields: [],
          negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: overrides.absenceMeaning || "COVERAGE_ONLY",
          components: [
            {
              id: overrides.componentId || "ground_seepage_or_retained_water",
              label: "Grundwasser, Sickerwasser oder Stauwasser",
              factRole: overrides.factRole || "PERIL",
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
          requirementId: overrides.requirementId || "LW-20",
          componentId:
            overrides.componentId || "ground_seepage_or_retained_water",
          candidateId: occurrence.candidateId,
          binding: overrides.triageBinding || "DIRECT",
        })),
      })[0];

    const currentStormSection = (text, physicalPageNumber) => ({
      scopeKey: "STURM_INSURANCE",
      text,
      source: "CURRENT_PAGE_HEADING",
      physicalPageNumber,
    });
    const realForms = [
      occurrenceFrom({
        candidateId: "candidate:lw20:treatment-cost",
        physicalPageNumber: 22,
        unitType: "PARAGRAPH",
        text: "Die Kosten für die Behandlung von nicht versicherten Sachen, z.B. Wasser (inkl. Grundwasser), Luft und Erdreich, werden nicht ersetzt, auch dann nicht, wenn sie mit versicherten Sachen vermischt werden.",
      }),
      occurrenceFrom({
        candidateId: "candidate:lw20:storm-inherited",
        physicalPageNumber: 20,
        text: "an den versicherten Sachen durch Grundwasser und Grundfeuchte;",
        sectionScopeHint: {
          scopeKey: "STURM_INSURANCE",
          text: "Niederschlags- und Schmelzwasser 64PA0051",
          source: "PRECEDING_PAGE_HEADING",
          physicalPageNumber: 19,
        },
      }),
      occurrenceFrom({
        candidateId: "candidate:lw20:storm-current-proposal",
        physicalPageNumber: 20,
        text: "Schäden an den versicherten Sachen durch Grundwasser, Grundfeuchte, Sturmflut und dauernde Witterungseinflüsse;",
        sectionScopeHint: currentStormSection(
          "Hochwasser, Überschwemmung, Lawinen und Muren 64PA0061",
          20
        ),
      }),
      occurrenceFrom({
        candidateId: "candidate:lw20:storm-current-terms",
        physicalPageNumber: 2,
        text: "Nicht versichert sind Schäden durch Grundwasser, Sturmflut, Rückstau aus diesen Ereignissen sowie Grundfeuchtigkeit.",
        sectionScopeHint: currentStormSection(
          "Allgemeine Bedingungen für die Sturmversicherung",
          2
        ),
        pageScopeHints: [
          { scopeKey: "STURM_INSURANCE", text: "die Sturmversicherung" },
        ],
      }),
    ];
    const target = targetFor(realForms);
    expect(target.candidates).toEqual([]);
    expect(target.unresolvedCandidateIds).toEqual([]);
    expect(target.serverRejectedCandidates).toHaveLength(4);
    expect(target.serverRejectedCandidates).toEqual(
      expect.arrayContaining(
        realForms.map((occurrence) =>
          expect.objectContaining({
            candidateId: occurrence.candidateId,
            reason: "TRIAGE_MENTION_ONLY",
            terminalRejectionContractId:
              DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID,
            occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
            decisionOwner: "SERVER",
            decisionBasis: LW20_NON_TARGET_OCCURRENCE_DECISION_BASIS,
            physicalPageNumber: occurrence.physicalPageNumber,
            scopeProofMode: LW20_NON_TARGET_OCCURRENCE_SCOPE_PROOF_MODE,
            occurrenceDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          })
        )
      )
    );
    expect(target.serverRejectedCandidates[0]).toMatchObject({
      sectionScopeSource: OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
      observedScopeKeys: [],
    });

    const relevant = [
      "Versichert sind Schäden durch Grundwasser.",
      "Nicht versichert sind Schäden durch Grundwasser.",
      "Schäden durch Grundwasser sind optional mitversichert.",
      "Schäden durch Grundwasser sind mitversichert, Behandlungskosten für Erdreich jedoch nicht.",
    ];
    for (const [index, text] of relevant.entries()) {
      const occurrence = occurrenceFrom({
        candidateId: `candidate:lw20:relevant:${index}`,
        physicalPageNumber: 2,
        text,
        sectionScopeHint: {
          scopeKey: "LEITUNGSWASSER_INSURANCE",
          text: "Allgemeine Bedingungen für die Leitungswasserversicherung",
          source: "CURRENT_PAGE_HEADING",
          physicalPageNumber: 2,
        },
      });
      expect(targetFor([occurrence]).serverRejectedCandidates).not.toEqual([
        expect.objectContaining({
          terminalRejectionContractId:
            DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID,
        }),
      ]);
    }

    for (const occurrence of [
      {
        ...realForms[1],
        sectionScopeHint: {
          ...realForms[1].sectionScopeHint,
          physicalPageNumber: 18,
        },
      },
      {
        ...realForms[2],
        sectionScopeHint: {
          ...realForms[2].sectionScopeHint,
          scopeKey: "LEITUNGSWASSER_INSURANCE",
        },
      },
      {
        ...realForms[2],
        physicalPageNumber: 21,
        pageNumber: 21,
      },
      {
        ...realForms[0],
        documentStart: realForms[0].documentStart + 1,
        documentEnd: realForms[0].documentEnd + 1,
      },
    ]) {
      const adversarialTarget = targetFor([occurrence]);
      expect(adversarialTarget.serverRejectedCandidates).not.toEqual([
        expect.objectContaining({
          terminalRejectionContractId:
            DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID,
        }),
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

  test("server-certifies only non-contractual EL-12 risk information without a contractual consequence", () => {
    const boundaryText = "Mitversichert gelten";
    const riskInformation = {
      candidateId: "candidate:el12-risk-information",
      matchedAlias: "CONCEPT_SEARCH:flood-risk-zone",
      pageNumber: 3,
      physicalPageNumber: 3,
      documentStart: 4_120,
      documentEnd: 4_154,
      exactText: "Hochwasser-Risiko-Zone: unbekannt",
      context: {
        unitType: "LIST_ITEM",
        documentStart: 4_000,
        documentEnd: 4_200,
        text: "- Risikoinformation zum Versicherungsort\nAnzahl Vorschäden Hochwasser, Überschwemmungen, Lawinen oder Muren: keine Vorschäden\nHochwasser-Risiko-Zone: unbekannt",
        followingStructuralBoundaryProof: {
          contractId: FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID,
          origin: {
            physicalPageNumber: 3,
            documentStart: 4_000,
            documentEnd: 4_200,
          },
          kind: "COVERAGE_GOVERNOR",
          physicalPageNumber: 4,
          documentStart: 4_201,
          documentEnd: 4_201 + boundaryText.length,
          text: boundaryText,
          skippedRaw: {
            documentStart: 4_200,
            documentEnd: 4_201,
            complete: true,
            text: "\n",
          },
        },
      },
      scopeLead: {
        text: "STURMVERSICHERUNG\nVersicherte Variante: Premiumschutz",
      },
      pageScopeHints: [
        {
          scopeKey: "LEITUNGSWASSER_INSURANCE",
          text: "Die Leitungswasserversicherung",
        },
      ],
      sectionScopeHint: {
        scopeKey: "STURM_INSURANCE",
        text: "STURMVERSICHERUNG",
        physicalPageNumber: 3,
        source: "CURRENT_PAGE_HEADING",
      },
    };
    const worksheetFor = (occurrences, overrides = {}) => ({
      candidateOnly: true,
      catalog: { categoryView: overrides.categoryView || "EL" },
      requirements: [
        {
          id: overrides.requirementId || "EL-12",
          label: "Hochwasserzone: Ausschluss oder Zuschlag",
          requestedFields: [],
          negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: overrides.absenceMeaning || "CONDITION_ONLY",
          components: [
            {
              id: overrides.componentId || "flood_zone_exclusion_or_surcharge",
              label: "Hochwasserzone: Ausschluss oder Zuschlag",
              factRole: overrides.factRole || "CONDITION",
              followingStructuralBoundaryProofContractId:
                FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_CONTRACT_ID,
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
          requirementId: overrides.requirementId || "EL-12",
          componentId:
            overrides.componentId || "flood_zone_exclusion_or_surcharge",
          candidateId: occurrence.candidateId,
          binding: "NARROW_SCOPE",
        })),
      })[0];

    expect(targetFor([riskInformation])).toMatchObject({
      candidates: [],
      unresolvedCandidateIds: [],
      serverRejectedCandidates: [
        {
          candidateId: riskInformation.candidateId,
          reason: "TRIAGE_MENTION_ONLY",
          terminalRejectionContractId:
            "DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_V2",
          decisionOwner: "SERVER",
          decisionBasis: "EXPLICIT_NON_CONTRACTUAL_RISK_INFORMATION",
          physicalPageNumber: 3,
          sectionScopeSource: "CURRENT_PAGE_HEADING",
          observedScopeKeys: ["LEITUNGSWASSER_INSURANCE", "STURM_INSURANCE"],
          scopeProofMode:
            "CURRENT_RISK_INFORMATION_WITH_STRUCTURAL_BOUNDARY_V2",
          occurrenceDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        },
      ],
    });

    const contractualOccurrences = [
      {
        exactText:
          "Schäden durch Hochwasser HQ30 sind bis maximal EUR 10.000 versichert.",
        matchedAlias: "CONCEPT_SEARCH:hq-flood-zone",
      },
      {
        exactText:
          "In der HORA-Zone Rot besteht kein Versicherungsschutz gegen Hochwasser.",
        matchedAlias: "CONCEPT_SEARCH:flood-risk-zone",
      },
      {
        exactText:
          "Für die Hochwasser-Risiko-Zone wird ein Prämienzuschlag vereinbart.",
        matchedAlias: "CONCEPT_SEARCH:flood-risk-zone",
      },
      {
        exactText:
          "Für die Hochwasser-Risiko-Zone gilt ein Selbstbehalt von EUR 5.000.",
        matchedAlias: "CONCEPT_SEARCH:flood-risk-zone",
      },
      {
        exactText: "Die Hochwasser-Risiko-Zone ist in der Deckung versichert.",
        matchedAlias: "CONCEPT_SEARCH:flood-risk-zone",
      },
      {
        exactText:
          "Bedingung: Wenn die Hochwasser-Risiko-Zone unbekannt ist, gilt ein Zuschlag.",
        matchedAlias: "CONCEPT_SEARCH:flood-risk-zone",
      },
    ].map((values, index) => ({
      ...riskInformation,
      ...values,
      candidateId: `candidate:el12-contractual-${index}`,
      context: {
        unitType: "LIST_ITEM",
        text: `Risikoinformation zum Versicherungsort\n${values.exactText}`,
      },
    }));
    for (const occurrence of contractualOccurrences) {
      const target = targetFor([occurrence]);
      expect(target.candidates).toHaveLength(1);
      expect(target.serverRejectedCandidates).toEqual([]);
    }

    const mixedRiskInformation = {
      ...riskInformation,
      candidateId: "candidate:el12-mixed-risk-information",
      context: {
        ...riskInformation.context,
        text: `${riskInformation.context.text}\nBei unbekannter Zone gilt ein Zuschlag.`,
      },
    };
    expect(targetFor([mixedRiskInformation])).toMatchObject({
      candidates: [
        expect.objectContaining({
          candidateId: mixedRiskInformation.candidateId,
        }),
      ],
      serverRejectedCandidates: [],
    });

    for (const [index, followingText] of [
      "Nach Einzelprüfung ist eine Annahme möglich.",
      "Bei unbekannter Zone gilt ein Prämienzuschlag.",
    ].entries()) {
      const followingConsequence = {
        ...riskInformation,
        candidateId: `candidate:el12-following-consequence-${index}`,
        context: {
          ...riskInformation.context,
          followingStructuralBoundaryProof: {
            ...riskInformation.context.followingStructuralBoundaryProof,
            kind: "PARAGRAPH",
            physicalPageNumber: 3,
            documentEnd: 4_201 + followingText.length,
            text: followingText,
          },
        },
      };
      expect(targetFor([followingConsequence])).toMatchObject({
        candidates: [
          expect.objectContaining({
            candidateId: followingConsequence.candidateId,
          }),
        ],
        serverRejectedCandidates: [],
      });
    }

    const actualClause = contractualOccurrences[0];
    expect(targetFor([riskInformation, actualClause])).toMatchObject({
      candidates: [
        expect.objectContaining({ candidateId: actualClause.candidateId }),
      ],
      serverRejectedCandidates: [
        expect.objectContaining({ candidateId: riskInformation.candidateId }),
      ],
    });

    const adversarial = [
      {
        candidate: {
          ...riskInformation,
          sectionScopeHint: {
            ...riskInformation.sectionScopeHint,
            source: "PRECEDING_PAGE_HEADING",
          },
        },
      },
      {
        candidate: {
          ...riskInformation,
          sectionScopeHint: {
            ...riskInformation.sectionScopeHint,
            scopeKey: "ELEMENTAR_INSURANCE",
          },
        },
      },
      {
        candidate: {
          ...riskInformation,
          sectionScopeHint: {
            ...riskInformation.sectionScopeHint,
            text: "LEITUNGSWASSERVERSICHERUNG",
          },
        },
      },
      {
        candidate: {
          ...riskInformation,
          sectionScopeHint: {
            ...riskInformation.sectionScopeHint,
            physicalPageNumber: 2,
          },
        },
      },
      {
        candidate: {
          ...riskInformation,
          exactText: "Hochwasser-Risiko-Zone: offen",
          context: {
            ...riskInformation.context,
            text: riskInformation.context.text.replace("unbekannt", "offen"),
          },
        },
      },
      {
        candidate: {
          ...riskInformation,
          pageScopeHints: [
            ...riskInformation.pageScopeHints,
            { scopeKey: "GLASBRUCH_INSURANCE", text: "Glasbruch" },
          ],
        },
      },
      { overrides: { requirementId: "EL-11" } },
      { overrides: { componentId: "other_component" } },
      { overrides: { factRole: "DEFINITION" } },
      { overrides: { absenceMeaning: "COVERAGE_ONLY" } },
    ];
    for (const { candidate = riskInformation, overrides = {} } of adversarial) {
      const target = targetFor([candidate], overrides);
      expect(target.candidates).toHaveLength(1);
      expect(target.serverRejectedCandidates).toEqual([]);
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

  test("terminally rejects only the certified LW-12 pure object classification", () => {
    const contextText =
      "·Fußbodenheizung/Kühlung, Wandheizung/Kühlung ist ein Rohr- und Schlauchsystem innerhalb eines Gebäudes, das der Raumheizung oder Kühlung dient und mit Wasser betrieben wird;";
    const contextStart = 8_060;
    const exactText = "Fußbodenheizung";
    const occurrenceStart = contextStart + contextText.indexOf(exactText);
    const occurrence = {
      candidateId: "candidate:lw12:pure-definition",
      matchedAlias: exactText,
      pageNumber: 3,
      physicalPageNumber: 3,
      documentStart: occurrenceStart,
      documentEnd: occurrenceStart + exactText.length,
      exactText,
      pageScopeHints: [],
      sectionScopeHint: null,
      coverageGovernorHint: null,
      objectClassificationGovernorHint: {
        text: "1.3 Haustechnische Anlagen und Adaptierungen\ndas sind:",
        subject: "1.3 Haustechnische Anlagen und Adaptierungen",
        kind: "OBJECT_CLASSIFICATION_BOUNDARY",
        classificationKind: "OBJECT",
        membership: "MEMBER_OF_CLASS",
        contractId: "CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1",
        physicalPageNumber: 3,
        documentStart: 7_278,
        documentEnd: 7_331,
        source: "CURRENT_PAGE_OBJECT_CLASSIFICATION",
      },
      context: {
        unitType: "LIST_ITEM",
        documentStart: contextStart,
        documentEnd: contextStart + contextText.length,
        text: contextText,
      },
      scopeLead: { text: "" },
    };
    const targetFor = (candidate, overrides = {}) => {
      const requirementId = overrides.requirementId || "LW-12";
      const componentId = overrides.componentId || "underfloor_heating";
      return buildPreparedEvidenceTargets({
        worksheet: {
          candidateOnly: true,
          catalog: { categoryView: overrides.categoryView || "LW" },
          requirements: [
            {
              id: requirementId,
              label: "Fußbodenheizung mitversichert",
              requestedFields: [],
              negativeSearchPolicy:
                overrides.negativeSearchPolicy ||
                "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
              absenceMeaning: overrides.absenceMeaning || "COVERAGE_ONLY",
              components: [
                {
                  id: componentId,
                  label: "Fußbodenheizung",
                  factRole: overrides.factRole || "INSURED_OBJECT",
                  occurrences: [candidate],
                },
              ],
            },
          ],
        },
        documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
        candidateTriage: [
          {
            requirementId,
            componentId,
            candidateId: candidate.candidateId,
            binding: "DIRECT",
          },
        ],
      })[0];
    };

    const target = targetFor(occurrence);
    expect(target.candidates).toEqual([]);
    expect(target.unresolvedCandidateIds).toEqual([]);
    expect(target.serverRejectedCandidates).toEqual([
      expect.objectContaining({
        candidateId: occurrence.candidateId,
        reason: "TRIAGE_MENTION_ONLY",
        terminalRejectionContractId:
          DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASSIFICATION_TERMINAL_CONTRACT_ID,
        occurrenceDigestContractId:
          COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID,
        decisionOwner: "SERVER",
        decisionBasis: COVERAGE_ONLY_OBJECT_CLASSIFICATION_DECISION_BASIS,
        physicalPageNumber: 3,
        sectionScopeSource: "CURRENT_PAGE_OBJECT_CLASSIFICATION",
        observedScopeKeys: [],
        scopeProofMode: COVERAGE_ONLY_OBJECT_CLASSIFICATION_SCOPE_PROOF_MODE,
        occurrenceDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    ]);
    const certifiedDigest =
      target.serverRejectedCandidates[0].occurrenceDigestSha256;
    expect(
      terminalOccurrenceDigest(
        {
          ...occurrence,
          objectClassificationGovernorHint: {
            ...occurrence.objectClassificationGovernorHint,
            documentEnd: 7_332,
          },
          scopeProofMode: COVERAGE_ONLY_OBJECT_CLASSIFICATION_SCOPE_PROOF_MODE,
        },
        COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID
      )
    ).not.toBe(certifiedDigest);
    expect(
      terminalOccurrenceDigest(
        {
          ...occurrence,
          coverageGovernorHint: { text: "Versichert sind:" },
          scopeProofMode: COVERAGE_ONLY_OBJECT_CLASSIFICATION_SCOPE_PROOF_MODE,
        },
        COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID
      )
    ).not.toBe(certifiedDigest);

    const adversarial = [
      {
        candidate: {
          ...occurrence,
          objectClassificationGovernorHint: {
            ...occurrence.objectClassificationGovernorHint,
            membership: "EXCLUDED_FROM_CLASS",
          },
        },
      },
      {
        candidate: {
          ...occurrence,
          objectClassificationGovernorHint: {
            ...occurrence.objectClassificationGovernorHint,
            source: "PRECEDING_PAGE_OBJECT_CLASSIFICATION",
            physicalPageNumber: 2,
          },
        },
      },
      {
        candidate: {
          ...occurrence,
          coverageGovernorHint: { text: "Versicherte Sachen, das sind:" },
        },
      },
      {
        candidate: {
          ...occurrence,
          context: {
            ...occurrence.context,
            text: contextText.replace("ist ein", "ist mitversichert und ein"),
            documentEnd:
              occurrence.context.documentEnd + " mitversichert und".length,
          },
        },
      },
      {
        candidate: {
          ...occurrence,
          context: {
            ...occurrence.context,
            text: contextText.replace(
              "ist ein",
              "ist bei einer Gefahrenerhöhung zu melden und ein"
            ),
            documentEnd:
              occurrence.context.documentEnd +
              " bei einer Gefahrenerhöhung zu melden und".length,
          },
        },
      },
      { candidate: occurrence, overrides: { requirementId: "LW-11" } },
      { candidate: occurrence, overrides: { factRole: "CONDITION" } },
      {
        candidate: occurrence,
        overrides: { absenceMeaning: "CONDITION_ONLY" },
      },
    ];
    for (const { candidate, overrides } of adversarial) {
      const unresolved = targetFor(candidate, overrides);
      expect(unresolved.serverRejectedCandidates).toEqual([]);
      expect(unresolved.candidates).toHaveLength(1);
    }
  });

  test("terminally rejects only certified VS-19 local object-class exclusions", () => {
    const occurrenceFor = ({
      subject = "Gebäude oder Gebäudebestandteile",
      membership = "EXCLUDED_FROM_CLASS",
      source = "CURRENT_PAGE_OBJECT_CLASSIFICATION",
      boundaryText = null,
      contextText = "·Außenanlagen am Gebäude oder freistehend auf dem Versicherungsgrundstück (Firmenschilder, Beleuchtungsanlagen, Taubengitter);",
      exactText = "Beleuchtungsanlagen",
      scopeLead = {
        documentStart: 1_311,
        documentEnd: 1_756,
        text: "1.1 Gebäude, das sind Bauwerke und konstruktive Bestandteile.",
      },
      candidateId = "candidate:vs19:object-class-exclusion",
    } = {}) => {
      const contextStart = 2_172;
      const occurrenceStart = contextStart + contextText.indexOf(exactText);
      return {
        candidateId,
        matchedAlias: exactText,
        pageNumber: 2,
        physicalPageNumber: 2,
        documentStart: occurrenceStart,
        documentEnd: occurrenceStart + exactText.length,
        exactText,
        pageScopeHints: [],
        sectionScopeHint: null,
        coverageGovernorHint: null,
        objectClassificationGovernorHint: {
          text: boundaryText || `Nicht als ${subject} zählen:`,
          subject,
          kind: "OBJECT_CLASSIFICATION_BOUNDARY",
          classificationKind: "OBJECT",
          membership,
          contractId: "CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1",
          physicalPageNumber: 2,
          documentStart: 2_121,
          documentEnd: 2_171,
          source,
        },
        context: {
          unitType: "LIST_ITEM",
          documentStart: contextStart,
          documentEnd: contextStart + contextText.length,
          text: contextText,
        },
        scopeLead,
      };
    };
    const targetFor = (candidate, overrides = {}) => {
      const requirementId = overrides.requirementId || "VS-19";
      const componentId = overrides.componentId || "outdoor_lighting";
      return buildPreparedEvidenceTargets({
        worksheet: {
          candidateOnly: true,
          catalog: { categoryView: overrides.categoryView || "VS" },
          requirements: [
            {
              id: requirementId,
              label: "Außenanlagen wie Wege, Beleuchtung, Bepflanzung",
              requestedFields: [],
              negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
              absenceMeaning: overrides.absenceMeaning || "COVERAGE_ONLY",
              components: [
                {
                  id: componentId,
                  label: "Außenbeleuchtung",
                  factRole: overrides.factRole || "INSURED_OBJECT",
                  occurrences: [candidate],
                },
              ],
            },
          ],
        },
        documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
        candidateTriage: [
          {
            requirementId,
            componentId,
            candidateId: candidate.candidateId,
            binding: "DIRECT",
          },
        ],
      })[0];
    };

    for (const occurrence of [
      occurrenceFor(),
      occurrenceFor({
        subject: "Betriebsinhalt",
        boundaryText: "Nicht als Betriebsinhalt gelten:",
        scopeLead: { documentStart: 1_758, documentEnd: 1_758, text: "" },
        candidateId: "candidate:vs19:business-contents-exclusion",
      }),
      occurrenceFor({
        contextText:
          "·Außenanlagen am Gebäude oder freistehend auf dem Versicherungsgrundstück (Firmenschilder, Beleuchtungsanlagen, befestigte Flächen);",
        exactText: "Außenanlagen",
        candidateId: "candidate:vs19:outdoor-path-class-exclusion",
      }),
      occurrenceFor({
        subject: "Betriebsinhalt",
        boundaryText: "Nicht als Betriebsinhalt gelten:",
        contextText:
          "·Außenanlagen (Firmenschilder, Beleuchtungsanlagen und befestigte Flächen);",
        exactText: "Außenanlagen",
        scopeLead: { documentStart: 1_758, documentEnd: 1_758, text: "" },
        candidateId: "candidate:vs19:business-path-class-exclusion",
      }),
    ]) {
      const target = targetFor(
        occurrence,
        occurrence.exactText === "Außenanlagen"
          ? { componentId: "outdoor_paths" }
          : {}
      );
      expect(target.candidates).toEqual([]);
      expect(target.unresolvedCandidateIds).toEqual([]);
      expect(target.serverRejectedCandidates).toEqual([
        expect.objectContaining({
          candidateId: occurrence.candidateId,
          reason: "TRIAGE_MENTION_ONLY",
          terminalRejectionContractId:
            DETERMINISTIC_COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_TERMINAL_CONTRACT_ID,
          occurrenceDigestContractId:
            COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID,
          decisionOwner: "SERVER",
          decisionBasis: COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_DECISION_BASIS,
          physicalPageNumber: 2,
          sectionScopeSource: "CURRENT_PAGE_OBJECT_CLASSIFICATION",
          observedScopeKeys: [],
          scopeProofMode: COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_SCOPE_PROOF_MODE,
          occurrenceDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
      ]);
    }

    const valid = occurrenceFor();
    const certifiedDigest =
      targetFor(valid).serverRejectedCandidates[0].occurrenceDigestSha256;
    for (const tamperedOccurrence of [
      {
        ...valid,
        objectClassificationGovernorHint: {
          ...valid.objectClassificationGovernorHint,
          membership: "MEMBER_OF_CLASS",
        },
      },
      {
        ...valid,
        scopeLead: { ...valid.scopeLead, documentEnd: 1_755 },
      },
    ]) {
      expect(
        terminalOccurrenceDigest(
          {
            ...tamperedOccurrence,
            scopeProofMode:
              COVERAGE_ONLY_OBJECT_CLASS_EXCLUSION_SCOPE_PROOF_MODE,
          },
          COVERAGE_ONLY_OBJECT_CLASSIFICATION_OCCURRENCE_DIGEST_CONTRACT_ID
        )
      ).not.toBe(certifiedDigest);
    }
    const adversarial = [
      occurrenceFor({ membership: "MEMBER_OF_CLASS" }),
      occurrenceFor({ subject: "Gebäude" }),
      occurrenceFor({ source: "PRECEDING_PAGE_OBJECT_CLASSIFICATION" }),
      occurrenceFor({ boundaryText: "Sonstige Objektliste:" }),
      occurrenceFor({
        contextText: "·Beleuchtungskörper im Freien;",
        exactText: "Beleuchtungskörper",
      }),
      occurrenceFor({
        contextText: "·Beleuchtungsanlagen sind mitversichert.",
      }),
      occurrenceFor({
        contextText: "·Beleuchtungsanlagen, sofern besonders vereinbart.",
      }),
      occurrenceFor({
        contextText: "·Beleuchtungsanlagen bis EUR 10.000.",
      }),
      occurrenceFor({
        scopeLead: {
          documentStart: 2_100,
          documentEnd: 2_150,
          text: "Versicherte Gebäude",
        },
      }),
      occurrenceFor({
        scopeLead: { documentStart: 0, documentEnd: 0, text: "Versichert" },
      }),
      occurrenceFor({
        scopeLead: {
          documentStart: 1_311,
          documentEnd: 1_756,
          text: "Beleuchtungsanlagen sind nicht versichert.",
        },
      }),
    ];
    for (const candidate of adversarial) {
      const unresolved = targetFor(candidate);
      expect(unresolved.serverRejectedCandidates).toEqual([]);
      expect(unresolved.candidates).toHaveLength(1);
    }
    for (const candidate of [
      occurrenceFor({
        contextText: "·Gehwege und befestigte Flächen;",
        exactText: "Gehwege",
      }),
      occurrenceFor({
        contextText: "·Bodenbefestigungen des Versicherungsgrundstücks;",
        exactText: "Bodenbefestigungen",
      }),
      occurrenceFor({
        contextText: "·Außenanlagen sind mitversichert;",
        exactText: "Außenanlagen",
      }),
      occurrenceFor({
        contextText: "·Außenanlagen, sofern besonders vereinbart;",
        exactText: "Außenanlagen",
      }),
      occurrenceFor({
        contextText: "·Außenanlagen bis EUR 10.000;",
        exactText: "Außenanlagen",
      }),
      {
        ...occurrenceFor({
          contextText: "·Außenanlagen;",
          exactText: "Außenanlagen",
        }),
        context: {
          ...occurrenceFor({
            contextText: "·Außenanlagen;",
            exactText: "Außenanlagen",
          }).context,
          documentStart: 2_200,
          documentEnd: 2_216,
        },
        documentStart: 2_201,
        documentEnd: 2_213,
      },
    ]) {
      const unresolved = targetFor(candidate, { componentId: "outdoor_paths" });
      expect(unresolved.serverRejectedCandidates).toEqual([]);
      expect(unresolved.candidates).toHaveLength(1);
    }
    for (const overrides of [
      { requirementId: "VS-18" },
      { factRole: "CONDITION" },
      { absenceMeaning: "CONDITION_ONLY" },
    ]) {
      const unresolved = targetFor(valid, overrides);
      expect(unresolved.serverRejectedCandidates).toEqual([]);
      expect(unresolved.candidates).toHaveLength(1);
    }
    const otherComponent = targetFor(valid, { componentId: "outdoor_paths" });
    expect(otherComponent.serverRejectedCandidates).toEqual([]);
    expect(otherComponent.candidates).toHaveLength(1);
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
