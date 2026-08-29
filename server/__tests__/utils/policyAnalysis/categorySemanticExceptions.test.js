const {
  deterministicCategoryCandidateBinding,
  deterministicCategoryPreparedDecision,
} = require("../../../utils/policyAnalysis/deterministicCategoryEvidenceRules");
const {
  CONFLICT_STATE,
  COVERAGE_EFFECT,
  COVERAGE_PICTURE,
  REVIEW_STATUS,
} = require("../../../utils/policyAnalysis/categoryResultContract");
const {
  buildCandidateTriagePayload,
} = require("../../../utils/policyAnalysis/candidateTriageContract");
const {
  DOCUMENT_STATUS,
  buildDeterministicPreparedEvidenceJudgement,
  buildPreparedEvidenceTargets,
  materializePreparedEvidence,
} = require("../../../utils/policyAnalysis/preparedEvidenceContract");

function occurrence({
  candidateId,
  exactText,
  contextText,
  scopeLeadText,
  sectionScopeKey,
  pageNumber,
}) {
  const contextDocumentStart = 1_000 * pageNumber;
  const relativeStart = contextText.indexOf(exactText);
  return {
    candidateId,
    exactText,
    pageNumber,
    physicalPageNumber: pageNumber,
    documentStart: contextDocumentStart + Math.max(relativeStart, 0),
    documentEnd:
      contextDocumentStart + Math.max(relativeStart, 0) + exactText.length,
    context: {
      unitType: "LIST_ITEM",
      text: contextText,
      documentStart: contextDocumentStart,
      documentEnd: contextDocumentStart + contextText.length,
    },
    scopeLead: { text: scopeLeadText },
    sectionScopeHint: {
      scopeKey: sectionScopeKey,
      text: sectionScopeKey,
    },
    pageScopeHints: [],
  };
}

describe("category semantic exceptions", () => {
  test("a carried liability exclusion governor classifies the continued rented-property list as excluded", () => {
    const decision = deterministicCategoryPreparedDecision({
      categoryView: "HP",
      requirementId: "HP-26",
      componentId: "rented_property_damage",
      factRole: "DAMAGE",
      candidates: [
        {
          candidateId: "candidate:hp26:rented-property",
          candidateBinding: "DIRECT",
          exactText: "gemietet, geleast, gepachtet",
          contextText:
            "d) Schadenersatzverpflichtungen wegen Schäden an Sachen, die gemietet, geleast, gepachtet wurden.",
          contextDocumentStart: 2_000,
          documentStart: 2_065,
          scopeLeadText:
            "8.4. Nicht versichert im Rahmen der Gebäude- und Grundstückshaftpflichtversicherung sind:",
        },
      ],
    });

    expect(decision).toEqual({
      selectedCandidateIds: ["candidate:hp26:rented-property"],
      coverageEffect: COVERAGE_EFFECT.EXCLUDED,
      basis: "EXPLICIT_CATEGORY_CLAUSE:HP:HP-26",
    });
  });

  test("the explicit tenant recourse waiver is not inverted by the condition wording", () => {
    const contextText =
      "Richtet sich der Ersatzanspruch gegen einen Mieter des versicherten Gebäudes, verzichtet der Versicherer auf seinen Regressanspruch, soweit der Mieter den Schaden weder vorsätzlich noch grob fahrlässig verursacht hat.";
    const base = {
      categoryView: "HP",
      requirementId: "HP-16",
      factRole: "CONDITION",
      candidates: [
        {
          candidateId: "candidate:hp16",
          candidateBinding: "DIRECT",
          exactText: "Mieter",
          contextText,
          contextDocumentStart: 3_000,
          documentStart: 3_047,
          scopeLeadText: "5. Regressverzicht",
        },
      ],
    };

    for (const componentId of ["recourse_waiver", "tenants"])
      expect(
        deterministicCategoryCandidateBinding({
          worksheet: { catalog: { categoryView: "HP" } },
          requirement: { id: "HP-16" },
          component: { id: componentId, factRole: "CONDITION" },
          occurrence: occurrence({
            candidateId: `candidate:hp16:${componentId}`,
            exactText:
              componentId === "tenants" ? "Mieter" : "Regressanspruch",
            contextText,
            scopeLeadText: "5. Regressverzicht",
            sectionScopeKey: "GENERAL_CONTRACT_TERMS",
            pageNumber: 3,
          }),
        })
      ).toEqual({
        binding: "DIRECT",
        basis: "HP_16_EXPLICIT_TENANT_RECOURSE_WAIVER",
        authoritative: true,
      });

    expect(
      deterministicCategoryPreparedDecision({
        ...base,
        componentId: "tenants",
      })
    ).toMatchObject({ coverageEffect: COVERAGE_EFFECT.DEFINED });
    expect(
      deterministicCategoryPreparedDecision({
        ...base,
        componentId: "recourse_waiver",
      })
    ).toMatchObject({ coverageEffect: COVERAGE_EFFECT.INCLUDED });
  });

  test("Katastrophen-bis is a positive limit governor even after a preceding narrow exclusion", () => {
    expect(
      deterministicCategoryPreparedDecision({
        categoryView: "EL",
        requirementId: "EL-01",
        componentId: "elemental_per_event_limit",
        factRole: "LIMIT",
        candidates: [
          {
            candidateId: "candidate:el01",
            candidateBinding: "NARROW_SCOPE",
            exactText: "Katastrophen bis",
            contextText:
              "• Katastrophen bis 1 % der Gebäudeversicherungssumme, maximal EUR 100.000.",
            contextDocumentStart: 4_000,
            documentStart: 4_002,
            scopeLeadText:
              "Nicht versichert sind Schäden durch Schnee- und Eisrutsch.",
          },
        ],
      })
    ).toEqual({
      selectedCandidateIds: ["candidate:el01"],
      coverageEffect: COVERAGE_EFFECT.DEFINED,
      basis: "EXPLICIT_CATEGORY_CLAUSE:EL:EL-01",
    });
  });

  test("a local peril limit stays affirmative despite an unrelated negative scope lead", () => {
    const decision = deterministicCategoryPreparedDecision({
      categoryView: "EL",
      requirementId: "EL-04",
      componentId: "flood",
      factRole: "PERIL",
      candidates: [
        {
          candidateId: "candidate:el04:definition",
          candidateBinding: "NARROW_SCOPE",
          exactText: "Hochwasser",
          contextText:
            "- Hochwasser (unvorhersehbares Ansteigen und Überborden von Gewässern);",
          contextDocumentStart: 5_000,
          documentStart: 5_002,
          scopeLeadText:
            "Katastrophen bis 1 % der Gebäudeversicherungssumme auf Erstes Risiko, insbesondere Schäden durch",
        },
        {
          candidateId: "candidate:el04:limit",
          candidateBinding: "NARROW_SCOPE",
          exactText: "Hochwasser",
          contextText:
            "Innerhalb der HQ30-Zone beträgt die Versicherungssumme bei Schäden durch Hochwasser maximal € 10.000.",
          contextDocumentStart: 6_000,
          documentStart: 6_081,
          scopeLeadText: "Nicht versichert sind Schäden durch andere Gefahren.",
        },
      ],
    });

    expect(decision).toEqual({
      selectedCandidateIds: [
        "candidate:el04:definition",
        "candidate:el04:limit",
      ],
      coverageEffect: COVERAGE_EFFECT.INCLUDED,
      basis: "EXPLICIT_CATEGORY_CLAUSE:EL:EL-04",
    });
  });

  test.each([
    ["ST-04", "hail_damage_to_facade", "Hagel", "Hausfassade"],
    [
      "ST-06",
      "snow_pressure_on_supporting_structure",
      "Schneedruck",
      "tragenden Dachkonstruktion",
    ],
  ])(
    "%s keeps its general peril included while the snow-slide object exclusion stays narrow",
    (requirementId, componentId, peril, excludedObject) => {
      const requirement = {
        id: requirementId,
        scopeRules: { narrowAliases: ["Schnee- und Eisrutsch"] },
      };
      const component = { id: componentId, factRole: "PERIL" };
      const worksheet = { catalog: { categoryView: "ST" } };
      const positiveOccurrence = occurrence({
        candidateId: `candidate:${requirementId}:positive`,
        exactText: peril,
        contextText: `• ${peril};`,
        scopeLeadText: `5. Sturmversicherung\nVersichert sind Schäden durch\n• ${peril};`,
        sectionScopeKey: "STURM_INSURANCE",
        pageNumber: 10,
      });
      const exclusionContext = `Nicht versichert sind Schäden an der ${excludedObject}.`;
      const negativeOccurrence = occurrence({
        candidateId: `candidate:${requirementId}:snow-slide-exclusion`,
        exactText: excludedObject,
        contextText: exclusionContext,
        scopeLeadText:
          "Zusätzlich versichert sind Schäden durch Schnee- und Eisrutsch.\n" +
          exclusionContext,
        sectionScopeKey: "STURM_INSURANCE",
        pageNumber: 10,
      });

      expect(
        deterministicCategoryCandidateBinding({
          worksheet,
          requirement,
          component,
          occurrence: negativeOccurrence,
        })
      ).toEqual({
        binding: "NARROW_SCOPE",
        basis: "EXPLICIT_NARROW_CLAUSE_SCOPE",
      });

      expect(
        deterministicCategoryPreparedDecision({
          categoryView: "ST",
          requirementId,
          componentId,
          factRole: "PERIL",
          candidates: [
            {
              candidateId: positiveOccurrence.candidateId,
              candidateBinding: "DIRECT",
              exactText: positiveOccurrence.exactText,
              contextText: positiveOccurrence.context.text,
              contextDocumentStart: positiveOccurrence.context.documentStart,
              documentStart: positiveOccurrence.documentStart,
              scopeLeadText: positiveOccurrence.scopeLead.text,
            },
            {
              candidateId: negativeOccurrence.candidateId,
              candidateBinding: "NARROW_SCOPE",
              exactText: negativeOccurrence.exactText,
              contextText: negativeOccurrence.context.text,
              contextDocumentStart: negativeOccurrence.context.documentStart,
              documentStart: negativeOccurrence.documentStart,
              scopeLeadText: negativeOccurrence.scopeLead.text,
            },
          ],
        })
      ).toEqual({
        selectedCandidateIds: [positiveOccurrence.candidateId],
        coverageEffect: COVERAGE_EFFECT.INCLUDED,
        basis: `EXPLICIT_GENERAL_RULE_WITH_NARROW_EXCEPTION:ST:${requirementId}`,
      });
    }
  );

  test("an explicit variant list clause remains direct when model triage returns unresolved", () => {
    const exactText =
      "Kosten der Rohrreinigung der Ableitungsrohre nach der Beseitigung von Verstopfungen";
    const dVariant = occurrence({
      candidateId: "candidate:lw26:d-cleaning",
      exactText,
      contextText: `• die ${exactText} ohne betragliche Beschränkung pro Schadenfall.`,
      scopeLeadText:
        "Zusätzlich zur Grund- und C-Deckung sind in der D-Deckungsvariante versichert",
      sectionScopeKey: "LEITUNGSWASSER_INSURANCE",
      pageNumber: 14,
    });
    dVariant.context.unitType = "LIST_ITEM";
    dVariant.coverageGovernorHint = {
      text: "Zusätzlich zur Grund- und C-Deckung sind in der D-Deckungsvariante versichert",
    };
    dVariant.variantScopeHint = {
      key: "D_DECKUNG",
      label: "D-Deckung",
      source: "CURRENT_PAGE_HEADING",
    };
    const worksheet = {
      candidateOnly: true,
      catalog: { categoryView: "LW" },
      requirements: [
        {
          id: "LW-26",
          label: "Rohrverstopfung und Reinigungskosten",
          requestedFields: ["limit"],
          scopeRules: { narrowAliases: [], narrowScopeKeys: [] },
          components: [
            {
              id: "cleaning_costs",
              label: "Reinigungskosten",
              factRole: "COST",
              occurrences: [dVariant],
            },
          ],
        },
      ],
    };

    expect(
      deterministicCategoryCandidateBinding({
        worksheet,
        requirement: worksheet.requirements[0],
        component: worksheet.requirements[0].components[0],
        occurrence: dVariant,
      })
    ).toEqual({
      binding: "DIRECT",
      basis: "EXPLICIT_POSITIVE_CLAUSE_GOVERNOR",
      authoritative: true,
    });

    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
      candidateTriage: [
        {
          requirementId: "LW-26",
          componentId: "cleaning_costs",
          candidateId: dVariant.candidateId,
          binding: "UNRESOLVED",
        },
      ],
    });
    expect(target.candidates).toMatchObject([
      {
        candidateId: dVariant.candidateId,
        candidateBinding: "DIRECT",
        deterministicBindingBasis: "EXPLICIT_POSITIVE_CLAUSE_GOVERNOR",
      },
    ]);
    expect(target.unresolvedCandidateIds).toEqual([]);
  });

  test("a tank object outside a liability clause does not prove HP-11", () => {
    const tankObject = occurrence({
      candidateId: "candidate:hp11:building-object",
      exactText: "Heizöltanks",
      contextText:
        "- Gas- und Heizöltanks zum Zweck der Beheizung des Gebäudes;",
      scopeLeadText:
        "Versichert sind Gebäudebestandteile und Einrichtungen; Kellerabteile, jedoch exklusive deren Inhalt;",
      sectionScopeKey: "",
      pageNumber: 4,
    });
    tankObject.context.unitType = "LIST_ITEM";
    tankObject.coverageGovernorHint = { text: "Versichert sind" };
    const worksheet = {
      candidateOnly: true,
      catalog: { categoryView: "HP" },
      requirements: [
        {
          id: "HP-11",
          label: "Öltank oder vergleichbares Anlagenrisiko",
          requestedFields: ["condition"],
          scopeRules: { narrowAliases: [], narrowScopeKeys: [] },
          components: [
            {
              id: "oil_tank_or_installation_risk",
              label: "Öltank oder vergleichbares Anlagenrisiko",
              factRole: "CONDITION",
              occurrences: [tankObject],
            },
          ],
        },
      ],
    };

    expect(
      deterministicCategoryCandidateBinding({
        worksheet,
        requirement: worksheet.requirements[0],
        component: worksheet.requirements[0].components[0],
        occurrence: tankObject,
      })
    ).toEqual({
      binding: "MENTION_ONLY",
      basis: "HP_11_TANK_OBJECT_WITHOUT_LIABILITY_SCOPE",
      authoritative: true,
    });

    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
      candidateTriage: [
        {
          requirementId: "HP-11",
          componentId: "oil_tank_or_installation_risk",
          candidateId: tankObject.candidateId,
          binding: "DIRECT",
        },
      ],
    });
    expect(target.candidates).toEqual([]);
    expect(target.serverRejectedCandidates).toEqual([
      {
        candidateId: tankObject.candidateId,
        reason: "TRIAGE_MENTION_ONLY",
      },
    ]);
  });

  test("EL-16 preserves Wintergarten inclusion and Vitrinen exclusion as separate component facts", () => {
    const winterGarden = occurrence({
      candidateId: "candidate:el16:winter-garden",
      exactText: "Wintergärten",
      contextText:
        "• die Verglasung der versicherten Gebäude, insbesondere Wintergärten bis zu einer Einzelscheibengröße von 10m².",
      scopeLeadText:
        "7. Glasbruch\nVersichert sind im Rahmen der Gebäude-Glaspauschale:",
      // Mirrors the stale heading value from the RC5 artifact. EL-16's exact
      // glass clause must remain authoritative independently of that hint.
      sectionScopeKey: "LEITUNGSWASSER_INSURANCE",
      pageNumber: 15,
    });
    const displayCase = occurrence({
      candidateId: "candidate:el16:display-case",
      exactText: "Vitrinen",
      contextText:
        "• Innenverglasungen wie Wandspiegel, Vitrinen, Pulte und dergleichen;",
      scopeLeadText:
        "7. Glasbruch\nNicht versichert sind\n• Innenverglasungen wie Wandspiegel,",
      sectionScopeKey: "LEITUNGSWASSER_INSURANCE",
      pageNumber: 15,
    });
    const worksheet = {
      candidateOnly: true,
      catalog: { categoryView: "EL" },
      requirements: [
        {
          id: "EL-16",
          label: "Wintergarten und Vitrinen",
          requestedFields: [],
          scopeRules: { narrowAliases: [], narrowScopeKeys: [] },
          components: [
            {
              id: "winter_garden",
              label: "Wintergarten",
              factRole: "INSURED_OBJECT",
              occurrences: [winterGarden],
            },
            {
              id: "display_case",
              label: "Vitrinen",
              factRole: "INSURED_OBJECT",
              occurrences: [displayCase],
            },
          ],
        },
      ],
    };
    const candidateTriage = [winterGarden, displayCase].map((candidate) => ({
      requirementId: "EL-16",
      componentId:
        candidate.candidateId === winterGarden.candidateId
          ? "winter_garden"
          : "display_case",
      candidateId: candidate.candidateId,
      binding: "MENTION_ONLY",
    }));

    const triagePayload = buildCandidateTriagePayload(worksheet);
    expect(
      triagePayload.bindingTargets.map((target) => ({
        candidateIds: target.candidateIds,
        roleResolution: target.roleResolution,
        scopeResolution: target.scopeResolution,
        modelDecisionFields: target.modelDecisionFields,
      }))
    ).toMatchObject([
      {
        candidateIds: [winterGarden.candidateId],
        roleResolution: { owner: "SERVER", roleMatch: "MATCH" },
        scopeResolution: { owner: "SERVER", scopeMatch: "GENERAL" },
        modelDecisionFields: [],
      },
      {
        candidateIds: [displayCase.candidateId],
        roleResolution: { owner: "SERVER", roleMatch: "MATCH" },
        scopeResolution: { owner: "SERVER", scopeMatch: "GENERAL" },
        modelDecisionFields: [],
      },
    ]);

    const targets = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
      candidateTriage,
    });
    expect(
      targets.map((target) => target.candidates[0].candidateBinding)
    ).toEqual(["DIRECT", "DIRECT"]);

    const judgements = targets.map((target) =>
      buildDeterministicPreparedEvidenceJudgement(target)
    );
    expect(judgements).toMatchObject([
      {
        componentId: "winter_garden",
        coverageEffect: COVERAGE_EFFECT.INCLUDED,
        conflictState: CONFLICT_STATE.NONE,
      },
      {
        componentId: "display_case",
        coverageEffect: COVERAGE_EFFECT.EXCLUDED,
        conflictState: CONFLICT_STATE.NONE,
      },
    ]);

    const materialized = materializePreparedEvidence({
      worksheet,
      targets,
      judgements,
    });
    expect(materialized.rollups[0]).toMatchObject({
      categoryId: "EL-16",
      coveragePicture: COVERAGE_PICTURE.MIXED,
      conflictState: CONFLICT_STATE.NONE,
      reviewStatus: REVIEW_STATUS.BELEGT,
    });
  });
});
