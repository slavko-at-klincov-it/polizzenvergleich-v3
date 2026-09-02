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
  matchedAlias,
}) {
  const contextDocumentStart = 1_000 * pageNumber;
  const relativeStart = contextText.indexOf(exactText);
  return {
    candidateId,
    ...(matchedAlias ? { matchedAlias } : {}),
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
  test("rebinds EL-06 only through an explicit local flood-coverage clause", () => {
    const bindingFor = (contextText, exactText = "Kanalrückstau") => {
      const candidate = occurrence({
        candidateId: "candidate:el06:local-target-scope",
        exactText,
        contextText,
        scopeLeadText: "LW06",
        sectionScopeKey: "LEITUNGSWASSER_INSURANCE",
        pageNumber: 13,
      });
      candidate.context.unitType = "PARAGRAPH";
      candidate.sectionScopeHint.source = "PRECEDING_PAGE_HEADING";
      return deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "EL" } },
        requirement: {
          id: "EL-06",
          scopeRules: { narrowAliases: [], narrowScopeKeys: [] },
        },
        component: { id: "sewer_backflow", factRole: "PERIL" },
        occurrence: candidate,
      });
    };

    for (const contextText of [
      "LW06 Kanalrückstau\nSchäden aus einem Kanalrückstau nach einer Überschwemmung sind im Rahmen der VS für Hochwasser/Überschwemmung mitversichert",
      "Kanalrückstau nach einer Überschwemmung ist im Rahmen der Versicherung für Überschwemmung und Hochwasser mitversichert.",
    ]) {
      expect(bindingFor(contextText)).toEqual({
        binding: "NARROW_SCOPE",
        basis: "EL_06_LOCAL_TARGET_SCOPE_REBINDING_V1",
        authoritative: true,
      });
    }

    for (const contextText of [
      "LW06 Kanalrückstau nach einer Überschwemmung ist im Rahmen der VS für Hochwasser/Überschwemmung nicht mitversichert.",
      "LW06 Kanalrückstau nach einer Überschwemmung ist im Rahmen der VS für Hochwasser/Überschwemmung wahlweise mitversichert.",
      "LW06 Kanalrückstau nach einer Überschwemmung; siehe Versicherung für Hochwasser/Überschwemmung.",
      "LW06 Kanalrückstau nach einer Überschwemmung.\n\nIm Rahmen der VS für Hochwasser/Überschwemmung sind Schäden mitversichert.",
      "LW06 Kanalrückstau ist mitversichert.",
    ]) {
      expect(bindingFor(contextText)).toEqual({
        binding: "MENTION_ONLY",
        basis: "EXPLICIT_OTHER_CATEGORY_SECTION",
      });
    }

    const currentHeading = occurrence({
      candidateId: "candidate:el06:current-heading",
      exactText: "Kanalrückstau",
      contextText:
        "Kanalrückstau nach einer Überschwemmung ist im Rahmen der VS für Hochwasser/Überschwemmung mitversichert.",
      scopeLeadText: "Leitungswasserversicherung",
      sectionScopeKey: "LEITUNGSWASSER_INSURANCE",
      pageNumber: 13,
    });
    currentHeading.context.unitType = "PARAGRAPH";
    currentHeading.sectionScopeHint.source = "CURRENT_PAGE_HEADING";
    expect(
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "EL" } },
        requirement: {
          id: "EL-06",
          scopeRules: { narrowAliases: [], narrowScopeKeys: [] },
        },
        component: { id: "sewer_backflow", factRole: "PERIL" },
        occurrence: currentHeading,
      })
    ).toEqual({
      binding: "MENTION_ONLY",
      basis: "EXPLICIT_OTHER_CATEGORY_SECTION",
    });
  });

  test("binds only explicit contractual consequences of a flood zone", () => {
    const bindingFor = ({ contextText, exactText, sectionScopeKey }) =>
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "EL" } },
        requirement: { id: "EL-12" },
        component: {
          id: "flood_zone_exclusion_or_surcharge",
          factRole: "CONDITION",
        },
        occurrence: occurrence({
          candidateId: "candidate:el-12",
          exactText,
          contextText,
          scopeLeadText: "Katastrophendeckung",
          sectionScopeKey,
          pageNumber: 10,
        }),
      });

    expect(
      bindingFor({
        contextText:
          "Befindet sich das versicherte Objekt innerhalb der HQ30-Zone, beträgt die Versicherungssumme bei Schäden durch Hochwasser maximal EUR 10.000.",
        exactText:
          "Befindet sich das versicherte Objekt innerhalb der HQ30-Zone, beträgt die Versicherungssumme bei Schäden durch Hochwasser maximal EUR 10.000",
        sectionScopeKey: "STURM_INSURANCE",
      })
    ).toEqual({
      binding: "NARROW_SCOPE",
      basis: "EL_12_EXPLICIT_FLOOD_ZONE_CONSEQUENCE",
      authoritative: true,
    });
    expect(
      bindingFor({
        contextText:
          "Für Hochwasser in der HORA-Zone gilt ein Prämienzuschlag.",
        exactText: "Für Hochwasser in der HORA-Zone gilt ein Prämienzuschlag",
        sectionScopeKey: "ELEMENTAR_INSURANCE",
      })
    ).toMatchObject({ binding: "DIRECT" });
    for (const contextText of [
      "HQ30 ist ein statistischer Kennwert für Hochwasser.",
      "Für die Sturmzone gilt ein Zuschlag.",
    ]) {
      const decision = bindingFor({
        contextText,
        exactText: contextText.slice(0, -1),
        sectionScopeKey: "STURM_INSURANCE",
      });
      expect(decision?.basis).not.toBe("EL_12_EXPLICIT_FLOOD_ZONE_CONSEQUENCE");
      expect(decision?.binding).not.toBe("DIRECT");
    }

    expect(
      deterministicCategoryPreparedDecision({
        categoryView: "EL",
        requirementId: "EL-12",
        componentId: "flood_zone_exclusion_or_surcharge",
        candidates: [
          {
            candidateId: "candidate:el-12",
            candidateBinding: "NARROW_SCOPE",
            deterministicBindingBasis: "EL_12_EXPLICIT_FLOOD_ZONE_CONSEQUENCE",
          },
        ],
      })
    ).toEqual({
      selectedCandidateIds: ["candidate:el-12"],
      coverageEffect: COVERAGE_EFFECT.DEFINED,
      basis: "EXPLICIT_EL12_FLOOD_ZONE_CONSEQUENCE:EL:EL-12",
    });
  });

  test("keeps generic storm-thrown objects non-evidentiary for tree impact", () => {
    const bindingFor = ({ contextText, exactText, matchedAlias }) =>
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "ST" } },
        requirement: { id: "ST-23" },
        component: {
          id: "foreign_tree_or_branch_impact",
          factRole: "PERIL",
        },
        occurrence: occurrence({
          candidateId: "candidate:st-23",
          exactText,
          contextText,
          scopeLeadText: "Versichert sind Schäden durch",
          sectionScopeKey: "STURM_INSURANCE",
          pageNumber: 2,
          matchedAlias,
        }),
      });

    expect(
      bindingFor({
        contextText:
          "Andere Gegenstände werden durch eine versicherte Sturmgefahr auf die versicherten Sachen geworfen.",
        exactText:
          "Andere Gegenstände werden durch eine versicherte Sturmgefahr auf die versicherten Sachen geworfen",
        matchedAlias: "CONCEPT_SEARCH:storm-thrown-object-impact",
      })
    ).toEqual({
      binding: "MENTION_ONLY",
      basis: "ST_23_GENERIC_THROWN_OBJECT_WITHOUT_REQUIRED_TREE_OR_BRANCH",
      authoritative: true,
    });
    expect(
      bindingFor({
        contextText:
          "Versichert sind Schäden durch stürzende Bäume des Nachbargrundstücks.",
        exactText: "stürzende Bäume des Nachbargrundstücks",
        matchedAlias: "CONCEPT_SEARCH:foreign-tree-or-branch-impact",
      })
    ).toEqual({
      binding: "DIRECT",
      basis: "EXPLICIT_POSITIVE_CLAUSE_GOVERNOR",
    });
    expect(
      bindingFor({
        contextText:
          "Bäume stehen am Nachbargrundstück. Andere Gegenstände werden durch eine versicherte Sturmgefahr auf die versicherten Sachen geworfen.",
        exactText:
          "Andere Gegenstände werden durch eine versicherte Sturmgefahr auf die versicherten Sachen geworfen",
        matchedAlias: "CONCEPT_SEARCH:storm-thrown-object-impact",
      })
    ).toMatchObject({ binding: "MENTION_ONLY" });
  });

  test("keeps vehicle impact on named damaged objects narrow", () => {
    const bindingFor = ({ contextText, exactText }) =>
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "FE" } },
        requirement: { id: "FE-A10" },
        component: { id: "foreign_vehicle_impact", factRole: "PERIL" },
        occurrence: occurrence({
          candidateId: "candidate:fe-a10",
          exactText,
          contextText,
          scopeLeadText: "B2 Feuerversicherung",
          sectionScopeKey: "FEUER_INSURANCE",
          pageNumber: 10,
        }),
      });

    expect(
      bindingFor({
        contextText:
          "Schäden an Einfriedungen und Kulturen sind versichert. Bei Schäden durch unbekannte Fahrzeuge gilt ein Selbstbehalt.",
        exactText: "Schäden durch unbekannte Fahrzeuge",
      })
    ).toEqual({
      binding: "NARROW_SCOPE",
      basis: "FE_A10_NAMED_DAMAGED_OBJECT_SCOPE",
      authoritative: true,
    });
    expect(
      bindingFor({
        contextText:
          "Versichert sind Schäden an allen versicherten Sachen durch unbekannte Fahrzeuge.",
        exactText:
          "Schäden an allen versicherten Sachen durch unbekannte Fahrzeuge",
      })
    ).toEqual({
      binding: "DIRECT",
      basis: "EXPLICIT_POSITIVE_CLAUSE_GOVERNOR",
    });
    expect(
      bindingFor({
        contextText:
          "Schäden an Einfriedungen sind begrenzt. Versichert sind Schäden an allen versicherten Sachen durch unbekannte Fahrzeuge.",
        exactText:
          "Schäden an allen versicherten Sachen durch unbekannte Fahrzeuge",
      })
    ).toEqual({
      binding: "DIRECT",
      basis: "EXPLICIT_POSITIVE_CLAUSE_GOVERNOR",
    });
  });

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
            exactText: componentId === "tenants" ? "Mieter" : "Regressanspruch",
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

  test("binds all VB-16 tenant and household beneficiaries without inventing unit owners", () => {
    const contextText =
      "Richtet sich der Ersatzanspruch gegen einen Mieter des versicherten Gebäudes, dessen Hausangestellten oder einen mit ihm in häuslicher Gemeinschaft lebenden Familienangehörigen, verzichtet der Versicherer auf seinen Regressanspruch, soweit der Mieter den Schaden weder vorsätzlich noch grob fahrlässig verursacht hat.";
    const components = [
      ["residents_recourse_waiver", "Regressverzicht"],
      [
        "residents",
        "mit ihm in häuslicher Gemeinschaft lebenden Familienangehörigen",
      ],
      ["tenants", "gegen einen Mieter des versicherten Gebäudes"],
    ];

    for (const [componentId, exactText] of components)
      expect(
        deterministicCategoryCandidateBinding({
          worksheet: { catalog: { categoryView: "VB" } },
          requirement: { id: "VB-16" },
          component: { id: componentId, factRole: "INSURED_OBJECT" },
          occurrence: occurrence({
            candidateId: `candidate:vb16:${componentId}`,
            exactText,
            contextText,
            scopeLeadText: "5. Regressverzicht",
            sectionScopeKey: "GENERAL_CONTRACT_TERMS",
            pageNumber: 26,
          }),
        })
      ).toEqual({
        binding: "DIRECT",
        basis: "VB_16_EXPLICIT_TENANT_RECOURSE_WAIVER",
        authoritative: true,
      });

    for (const [componentId, exactText] of components)
      expect(
        deterministicCategoryPreparedDecision({
          categoryView: "VB",
          requirementId: "VB-16",
          componentId,
          factRole:
            componentId === "residents_recourse_waiver"
              ? "BENEFIT"
              : "INSURED_OBJECT",
          candidates: [
            {
              candidateId: `candidate:vb16:${componentId}`,
              candidateBinding: "DIRECT",
              deterministicBindingBasis:
                "VB_16_EXPLICIT_TENANT_RECOURSE_WAIVER",
              exactText,
              contextText,
            },
          ],
        })
      ).toEqual({
        selectedCandidateIds: [`candidate:vb16:${componentId}`],
        coverageEffect: COVERAGE_EFFECT.INCLUDED,
        basis: "EXPLICIT_VB16_TENANT_RECOURSE_WAIVER:VB:VB-16",
      });

    expect(
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "VB" } },
        requirement: { id: "VB-15" },
        component: { id: "unit_owners", factRole: "INSURED_OBJECT" },
        occurrence: occurrence({
          candidateId: "candidate:vb15:unit-owners",
          exactText: "Mieter",
          contextText,
          scopeLeadText: "5. Regressverzicht",
          sectionScopeKey: "GENERAL_CONTRACT_TERMS",
          pageNumber: 26,
        }),
      })
    ).toEqual({
      binding: "MENTION_ONLY",
      basis: "TENANT_RECOURSE_NOT_UNIT_OWNER_RECOURSE",
      authoritative: true,
    });

    expect(
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "VB" } },
        requirement: { id: "VB-16" },
        component: { id: "residents", factRole: "INSURED_OBJECT" },
        occurrence: occurrence({
          candidateId: "candidate:vb16:tenant-only",
          exactText: "Mieter",
          contextText:
            "Richtet sich der Ersatzanspruch gegen einen Mieter des versicherten Gebäudes, verzichtet der Versicherer auf seinen Regressanspruch.",
          scopeLeadText: "5. Regressverzicht",
          sectionScopeKey: "GENERAL_CONTRACT_TERMS",
          pageNumber: 26,
        }),
      })
    ).toBeNull();
  });

  test("a technical control component neither includes nor excludes the whole object", () => {
    const bindingFor = ({ candidateId, contextText, scopeLeadText }) =>
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "VS" } },
        requirement: { id: "VS-18" },
        component: { id: "gates", factRole: "INSURED_OBJECT" },
        occurrence: occurrence({
          candidateId,
          exactText: "Tore",
          contextText,
          scopeLeadText,
          sectionScopeKey: "FEUER_INSURANCE",
          pageNumber: 11,
        }),
      });

    expect(
      bindingFor({
        candidateId: "candidate:gate-controls",
        contextText:
          "Sachen außerhalb von Gebäuden sind Betätigungselemente für Tore, Beleuchtungsanlagen und Alarmanlagen.",
        scopeLeadText:
          "Nicht mitversichert sind Sachen eines Haushalts. Sachen außerhalb von Gebäuden sind Betätigungselemente für",
      })
    ).toEqual({
      binding: "MENTION_ONLY",
      basis: "TECHNICAL_SUBCOMPONENT_NOT_WHOLE_OBJECT",
      authoritative: true,
    });

    expect(
      bindingFor({
        candidateId: "candidate:gates-included",
        contextText: "Versichert sind Sachen und Objekte: Tore.",
        scopeLeadText: "Versichert sind Sachen und Objekte:",
      })
    ).toMatchObject({ binding: "DIRECT" });
    expect(
      bindingFor({
        candidateId: "candidate:gates-excluded",
        contextText: "Nicht versichert sind Sachen und Objekte: Tore.",
        scopeLeadText: "Nicht versichert sind Sachen und Objekte:",
      })
    ).toMatchObject({ binding: "DIRECT" });
  });

  test("a prior clause exclusion does not cross a newer coded clause boundary", () => {
    const contextText = [
      "Nicht mitversichert sind Sachen eines Haushalts.",
      "Indirekter Blitzschlag an Sachen außerhalb von Gebäuden12PA0160",
      "Sachen außerhalb von Gebäuden sind Betätigungselemente für Tore.",
      "Anprall unbekannter Landfahrzeuge12PA0141",
      "Anprall liegt vor, wenn unbekannte Fahrzeuge versicherte Einfriedungen beschädigen.",
    ].join("\n");

    expect(
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "VS" } },
        requirement: { id: "VS-18" },
        component: { id: "enclosures", factRole: "INSURED_OBJECT" },
        occurrence: occurrence({
          candidateId: "candidate:new-clause-enclosures",
          exactText: "Einfriedungen",
          contextText,
          scopeLeadText:
            "Anprall unbekannter Landfahrzeuge12PA0141\nAnprall liegt vor, wenn unbekannte Fahrzeuge versicherte",
          sectionScopeKey: "FEUER_INSURANCE",
          pageNumber: 11,
        }),
      })
    ).toBeNull();
  });

  test("the phrase non-insured perils cannot reopen a negative exclusion list", () => {
    const contextText = [
      "Nicht versichert sind Schäden, sofern nicht anders vereinbart:",
      "a) durch nicht versicherte Gefahren;",
      "g) durch Unterdruck (Implosion).",
    ].join("\n");
    const scopeLeadText =
      "Nicht versichert sind Schäden, sofern nicht anders vereinbart:\na) durch nicht versicherte Gefahren;\ng) durch Unterdruck (";
    const decision = deterministicCategoryCandidateBinding({
      worksheet: { catalog: { categoryView: "FE" } },
      requirement: { id: "FE-A08" },
      component: { id: "implosion", factRole: "PERIL" },
      occurrence: occurrence({
        candidateId: "candidate:excluded-implosion",
        exactText: "Implosion",
        contextText,
        scopeLeadText,
        sectionScopeKey: "FEUER_INSURANCE",
        pageNumber: 2,
      }),
    });

    expect(decision).toMatchObject({
      binding: "DIRECT",
      basis: "EXPLICIT_NEGATIVE_CLAUSE_GOVERNOR",
    });
    expect(
      deterministicCategoryPreparedDecision({
        categoryView: "FE",
        requirementId: "FE-A08",
        componentId: "implosion",
        factRole: "PERIL",
        candidates: [
          {
            candidateId: "candidate:excluded-implosion",
            candidateBinding: "DIRECT",
            exactText: "Implosion",
            contextText,
            contextDocumentStart: 2_000,
            documentStart: 2_000 + contextText.indexOf("Implosion"),
            scopeLeadText,
          },
        ],
      })
    ).toMatchObject({ coverageEffect: COVERAGE_EFFECT.EXCLUDED });
  });

  test("a condition requiring damage not to be intentional proves the intentional-damage exclusion", () => {
    const excludedContext =
      "Versicherungsschutz besteht für Schäden, soweit der Versicherungsnehmer oder die für ihn handelnden Personen den Schaden nicht grob fahrlässig oder vorsätzlich herbeigeführt haben.";
    const excluded = occurrence({
      candidateId: "candidate:intentional-damage-excluded",
      exactText: "vorsätzlich herbeigeführt",
      contextText: excludedContext,
      scopeLeadText: excludedContext,
      sectionScopeKey: "HAFTPFLICHT_INSURANCE",
      pageNumber: 16,
    });
    const binding = deterministicCategoryCandidateBinding({
      worksheet: { catalog: { categoryView: "HP" } },
      requirement: { id: "HP-36" },
      component: {
        id: "intentional_damage_exclusion",
        factRole: "EXCLUSION",
      },
      occurrence: excluded,
    });

    expect(binding).toMatchObject({
      binding: "DIRECT",
      basis: "EXPLICIT_NEGATIVE_CLAUSE_GOVERNOR",
    });
    expect(
      deterministicCategoryPreparedDecision({
        categoryView: "HP",
        requirementId: "HP-36",
        componentId: "intentional_damage_exclusion",
        factRole: "EXCLUSION",
        candidates: [
          {
            candidateId: excluded.candidateId,
            candidateBinding: "DIRECT",
            exactText: excluded.exactText,
            contextText: excluded.context.text,
            contextDocumentStart: excluded.context.documentStart,
            documentStart: excluded.documentStart,
            scopeLeadText: excluded.scopeLead.text,
          },
        ],
      })
    ).toMatchObject({ coverageEffect: COVERAGE_EFFECT.EXCLUDED });

    const includedContext =
      "Abweichend von den Bedingungen sind vorsätzlich verursachte Schäden ausdrücklich mitversichert.";
    expect(
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "HP" } },
        requirement: { id: "HP-36" },
        component: {
          id: "intentional_damage_exclusion",
          factRole: "EXCLUSION",
        },
        occurrence: occurrence({
          candidateId: "candidate:intentional-damage-included",
          exactText: "vorsätzlich verursachte Schäden",
          contextText: includedContext,
          scopeLeadText: includedContext,
          sectionScopeKey: "HAFTPFLICHT_INSURANCE",
          pageNumber: 3,
        }),
      })
    ).toMatchObject({
      binding: "DIRECT",
      basis: "EXPLICIT_POSITIVE_OPERATIVE_COVERAGE_CLAUSE",
    });
  });

  test("the multiline environmental-liability condition remains an intentional-damage exclusion", () => {
    const contextText = [
      "1.2. Abweichend von Art. 7, Pkt. 6 AHVB-W besteht Versicherungsschutz auch für Schäden an geschützten Arten, natürlichen",
      "Lebensräumen, an Gewässern und am Boden, soweit diese in Eigentum, Besitz oder bloßer Innehabung des Versicherungsnehmers",
      "oder dessen Angehörigen stehen und der Versicherungsnehmer oder die für ihn handelnden Personen den Schaden nicht grob",
      "fahrlässig oder vorsätzlich herbeigeführt haben.",
      "Diese Deckungserweiterung findet außerhalb Österreichs keine Anwendung.",
    ].join("\n");
    const candidate = occurrence({
      candidateId: "candidate:hp36:real-multiline-condition",
      exactText: "vorsätzlich herbeigeführt",
      contextText,
      scopeLeadText: contextText.slice(
        0,
        contextText.indexOf("vorsätzlich herbeigeführt")
      ),
      sectionScopeKey: "HAFTPFLICHT_INSURANCE",
      pageNumber: 16,
    });
    const binding = deterministicCategoryCandidateBinding({
      worksheet: { catalog: { categoryView: "HP" } },
      requirement: { id: "HP-36" },
      component: {
        id: "intentional_damage_exclusion",
        factRole: "EXCLUSION",
      },
      occurrence: candidate,
    });

    expect(binding).toMatchObject({
      binding: "DIRECT",
      basis: "EXPLICIT_NEGATIVE_CLAUSE_GOVERNOR",
    });
    expect(
      deterministicCategoryPreparedDecision({
        categoryView: "HP",
        requirementId: "HP-36",
        componentId: "intentional_damage_exclusion",
        factRole: "EXCLUSION",
        candidates: [
          {
            candidateId: candidate.candidateId,
            candidateBinding: binding.binding,
            deterministicBindingBasis: binding.basis,
            exactText: candidate.exactText,
            contextText: candidate.context.text,
            contextDocumentStart: candidate.context.documentStart,
            documentStart: candidate.documentStart,
            scopeLeadText: candidate.scopeLead.text,
          },
        ],
      })
    ).toMatchObject({ coverageEffect: COVERAGE_EFFECT.EXCLUDED });
  });

  test("LW-20 keeps a water exclusion negative and rejects a storm-section occurrence", () => {
    const waterContext = [
      "Nicht versichert sind Schäden, sofern nicht anders vereinbart:",
      "a) durch Gefahren und an Sachen, die nicht als versichert angeführt sind;",
      "c) durch Grundwasser, Überschwemmung, Hochwasser, Muren, Wasser aus Witterungsniederschlägen und Rückstau daraus;",
    ].join("\n");
    const waterOccurrence = occurrence({
      candidateId: "candidate:lw20:water-exclusion",
      exactText: "Grundwasser",
      contextText: waterContext,
      scopeLeadText:
        "Nicht versichert sind Schäden, sofern nicht anders vereinbart:",
      sectionScopeKey: "LEITUNGSWASSER_INSURANCE",
      pageNumber: 2,
    });
    const waterBinding = deterministicCategoryCandidateBinding({
      worksheet: { catalog: { categoryView: "LW" } },
      requirement: { id: "LW-20" },
      component: {
        id: "ground_seepage_or_retained_water",
        factRole: "PERIL",
      },
      occurrence: waterOccurrence,
    });

    expect(waterBinding).toMatchObject({
      binding: "DIRECT",
      basis: "EXPLICIT_NEGATIVE_CLAUSE_GOVERNOR",
    });
    expect(
      deterministicCategoryPreparedDecision({
        categoryView: "LW",
        requirementId: "LW-20",
        componentId: "ground_seepage_or_retained_water",
        factRole: "PERIL",
        candidates: [
          {
            candidateId: waterOccurrence.candidateId,
            candidateBinding: waterBinding.binding,
            deterministicBindingBasis: waterBinding.basis,
            exactText: waterOccurrence.exactText,
            contextText: waterOccurrence.context.text,
            contextDocumentStart: waterOccurrence.context.documentStart,
            documentStart: waterOccurrence.documentStart,
            scopeLeadText: waterOccurrence.scopeLead.text,
          },
        ],
      })
    ).toMatchObject({ coverageEffect: COVERAGE_EFFECT.EXCLUDED });

    const stormOccurrence = occurrence({
      candidateId: "candidate:lw20:storm-reference",
      exactText: "Grundwasser",
      contextText:
        "Nicht versichert sind Schäden durch Grundwasser, Sturmflut und Rückstau aus diesen Ereignissen.",
      scopeLeadText: "Nicht versichert sind Schäden durch",
      sectionScopeKey: null,
      pageNumber: 2,
    });
    stormOccurrence.pageScopeHints = [
      {
        scopeKey: "STURM_INSURANCE",
        text: "die Sturmversicherung",
        pageStart: 49,
        pageEnd: 70,
      },
    ];
    expect(
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "LW" } },
        requirement: { id: "LW-20" },
        component: {
          id: "ground_seepage_or_retained_water",
          factRole: "PERIL",
        },
        occurrence: stormOccurrence,
      })
    ).toEqual({
      binding: "MENTION_ONLY",
      basis: "EXPLICIT_OTHER_CATEGORY_SECTION",
    });

    const lateCrossReference = {
      ...stormOccurrence,
      candidateId: "candidate:lw20:late-cross-reference",
      pageScopeHints: [
        {
          scopeKey: "STURM_INSURANCE",
          text: "Hinweis zur Sturmversicherung",
          pageStart: 900,
          pageEnd: 930,
        },
      ],
    };
    expect(
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "LW" } },
        requirement: { id: "LW-20" },
        component: {
          id: "ground_seepage_or_retained_water",
          factRole: "PERIL",
        },
        occurrence: lateCrossReference,
      })
    ).toMatchObject({
      binding: "DIRECT",
      basis: "EXPLICIT_NEGATIVE_CLAUSE_GOVERNOR",
    });
  });

  test("costs beyond necessary rescue costs do not exclude the rescue costs used as reference", () => {
    const referenceOnly =
      "Kein Versicherungsschutz besteht für Aufwendungen zur Sanierung von Anlagen, die über die notwendigen Rettungskosten gemäß Art. 5 hinausgehen.";
    const bindingFor = (contextText) =>
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "VB" } },
        requirement: { id: "VB-23" },
        component: { id: "rescue_costs", factRole: "COST" },
        occurrence: occurrence({
          candidateId: "candidate:rescue-costs",
          exactText: "Rettungskosten",
          contextText,
          scopeLeadText: contextText,
          sectionScopeKey: "GENERAL_CONTRACT_TERMS",
          pageNumber: 17,
        }),
      });

    expect(bindingFor(referenceOnly)).toEqual({
      binding: "MENTION_ONLY",
      basis: "EXCESS_COST_REFERENCE_NOT_RESCUE_COST_COVERAGE",
      authoritative: true,
    });
    expect(
      bindingFor("Rettungskosten sind ausdrücklich mitversichert.")
    ).toMatchObject({
      binding: "DIRECT",
      basis: "EXPLICIT_POSITIVE_OPERATIVE_COVERAGE_CLAUSE",
    });
    expect(
      bindingFor("Rettungskosten sind nicht mitversichert.")
    ).toMatchObject({
      binding: "DIRECT",
      basis: "EXPLICIT_NEGATIVE_OPERATIVE_COVERAGE_CLAUSE",
    });
  });

  test("binds an indirect-lightning amount across PDF line breaks without accepting an amount-less mention", () => {
    const bindingFor = (contextText) =>
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "FE" } },
        requirement: {
          id: "FE-A06",
          scopeRules: { narrowAliases: ["Erdkabel"] },
        },
        component: { id: "indirect_lightning_limit", factRole: "LIMIT" },
        occurrence: occurrence({
          candidateId: "candidate:indirect-lightning-limit",
          exactText: "indirekter Blitzschlag",
          contextText,
          scopeLeadText: contextText,
          sectionScopeKey: "FEUER_INSURANCE",
          pageNumber: 11,
        }),
      });

    expect(
      bindingFor(
        "Mitversichert ist der indirekter Blitzschlag an Erdkabel, sofern der Versicherungsnehmer dafür aufzukommen hat inklusive\nSuch-, Austausch- und Nebenkosten bis insgesamt EUR 5.000 je Schadenfall."
      )
    ).toMatchObject({
      binding: "NARROW_SCOPE",
      basis: "EXPLICIT_NARROW_CLAUSE_SCOPE",
    });
    expect(
      bindingFor(
        "Mitversichert ist der indirekter Blitzschlag an Erdkabel ohne näher bezeichnete Betragsgrenze."
      )
    ).toEqual({
      binding: "MENTION_ONLY",
      basis: "LIMIT_TERM_WITHOUT_LOCAL_LIMIT",
    });
  });

  test("binds the complete VB-24 expert procedure right without accepting headings or cost clauses", () => {
    const contextText =
      "Ist der Versicherungsnehmer mit dem Gutachten des vom Versicherer bestellten Sachverständigen nicht einverstanden, so steht es dem Versicherungsnehmer auch frei, einen Sachverständigen des jeweiligen Sachgebietes namhaft zu machen. Dieses Gutachten tritt an Stelle des Schiedsgutachterverfahrens.";
    const inputFor = (text, exactText) => ({
      worksheet: { catalog: { categoryView: "VB" } },
      requirement: { id: "VB-24" },
      component: { id: "expert_procedure", factRole: "BENEFIT" },
      occurrence: occurrence({
        candidateId: `candidate:vb24:${exactText}`,
        exactText,
        contextText: text,
        scopeLeadText: "25. Auswahl des Sachverständigen",
        sectionScopeKey: "GENERAL_CONTRACT_TERMS",
        pageNumber: 30,
      }),
    });

    expect(
      deterministicCategoryCandidateBinding(
        inputFor(
          contextText,
          "Gutachten tritt an Stelle des Schiedsgutachterverfahrens"
        )
      )
    ).toEqual({
      binding: "DIRECT",
      basis: "VB_24_EXPLICIT_EXPERT_PROCEDURE_RIGHT",
      authoritative: true,
    });

    const unclassifiedSection = inputFor(
      contextText,
      "Gutachten tritt an Stelle des Schiedsgutachterverfahrens"
    );
    unclassifiedSection.occurrence.sectionScopeHint = null;
    expect(
      deterministicCategoryCandidateBinding(unclassifiedSection)
    ).toMatchObject({
      binding: "DIRECT",
      basis: "VB_24_EXPLICIT_EXPERT_PROCEDURE_RIGHT",
    });

    expect(
      deterministicCategoryPreparedDecision({
        categoryView: "VB",
        requirementId: "VB-24",
        componentId: "expert_procedure",
        factRole: "BENEFIT",
        candidates: [
          {
            candidateId: "candidate:vb24:procedure",
            candidateBinding: "DIRECT",
            deterministicBindingBasis: "VB_24_EXPLICIT_EXPERT_PROCEDURE_RIGHT",
          },
        ],
      })
    ).toEqual({
      selectedCandidateIds: ["candidate:vb24:procedure"],
      coverageEffect: COVERAGE_EFFECT.INCLUDED,
      basis: "EXPLICIT_VB24_EXPERT_PROCEDURE_RIGHT:VB:VB-24",
    });

    expect(
      deterministicCategoryCandidateBinding(
        inputFor(
          "25. Auswahl des Sachverständigen",
          "Auswahl des Sachverständigen"
        )
      )
    ).toBeNull();
    expect(
      deterministicCategoryCandidateBinding(
        inputFor(
          "Der Versicherer ersetzt 80 % der Kosten des Sachverständigen.",
          "Sachverständigen"
        )
      )
    ).toBeNull();

    const wrongSection = inputFor(
      contextText,
      "Gutachten tritt an Stelle des Schiedsgutachterverfahrens"
    );
    wrongSection.occurrence.sectionScopeHint.scopeKey = "HAFTPFLICHT_INSURANCE";
    expect(deterministicCategoryCandidateBinding(wrongSection)).toBeNull();
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

  test("binds an explicit roof avalanche clause to both ST-27 peril roles", () => {
    const contextText =
      "Dachlawinen (Schnee und Eis) auf Erstes Risiko EUR 7.500,00.";
    for (const componentId of ["avalanche", "snow_slide"]) {
      const candidate = occurrence({
        candidateId: `candidate:st27:${componentId}`,
        exactText: "Dachlawinen (Schnee und Eis)",
        contextText,
        scopeLeadText: "Mitversichert gelten",
        sectionScopeKey: "STURM_INSURANCE",
        pageNumber: 4,
      });
      expect(
        deterministicCategoryCandidateBinding({
          worksheet: { catalog: { categoryView: "ST" } },
          requirement: { id: "ST-27" },
          component: { id: componentId, factRole: "PERIL" },
          occurrence: candidate,
        })
      ).toEqual({
        binding: "DIRECT",
        basis: "ST_27_EXPLICIT_ROOF_AVALANCHE_SNOW_SLIDE",
        authoritative: true,
      });
      expect(
        deterministicCategoryPreparedDecision({
          categoryView: "ST",
          requirementId: "ST-27",
          componentId,
          factRole: "PERIL",
          candidates: [
            {
              candidateId: candidate.candidateId,
              candidateBinding: "DIRECT",
              deterministicBindingBasis:
                "ST_27_EXPLICIT_ROOF_AVALANCHE_SNOW_SLIDE",
            },
          ],
        })
      ).toEqual({
        selectedCandidateIds: [candidate.candidateId],
        coverageEffect: COVERAGE_EFFECT.INCLUDED,
        basis: "EXPLICIT_ST27_ROOF_AVALANCHE_SNOW_SLIDE:ST:ST-27",
      });
    }

    const incomplete = occurrence({
      candidateId: "candidate:st27:bare-heading",
      exactText: "Dachlawinen",
      contextText: "Dachlawinen",
      scopeLeadText: "Besondere Bedingungen",
      sectionScopeKey: "STURM_INSURANCE",
      pageNumber: 4,
    });
    expect(
      deterministicCategoryCandidateBinding({
        worksheet: { catalog: { categoryView: "ST" } },
        requirement: { id: "ST-27" },
        component: { id: "snow_slide", factRole: "PERIL" },
        occurrence: incomplete,
      })
    ).toBeNull();
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

  test("an explicit category list keeps covered pipe replacement when triage says unresolved", () => {
    const pipeReplacement = occurrence({
      candidateId: "candidate:lw05:pipe-replacement",
      exactText: "Rohrersatz bei Rohrbruch bei allen versicherten Rohren",
      contextText:
        "- Rohrersatz bei Rohrbruch bei allen versicherten Rohren bis zu 15 lfm",
      scopeLeadText: "Mitversichert gelten",
      sectionScopeKey: "LEITUNGSWASSER_INSURANCE",
      pageNumber: 2,
    });
    pipeReplacement.coverageGovernorHint = {
      text: "Mitversichert gelten",
      source: "CURRENT_PAGE_GOVERNOR",
    };
    const worksheet = {
      candidateOnly: true,
      catalog: { categoryView: "LW" },
      requirements: [
        {
          id: "LW-05",
          label: "Rohrbruchschaden am Rohr selbst",
          requestedFields: [],
          scopeRules: { narrowAliases: [], narrowScopeKeys: [] },
          components: [
            {
              id: "pipe_itself",
              label: "Schaden am Rohr selbst",
              factRole: "INSURED_OBJECT",
              occurrences: [pipeReplacement],
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
        occurrence: pipeReplacement,
      })
    ).toEqual({
      binding: "DIRECT",
      basis: "EXPLICIT_POSITIVE_CLAUSE_GOVERNOR",
      authoritative: true,
    });

    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.PROPOSAL,
      candidateTriage: [
        {
          requirementId: "LW-05",
          componentId: "pipe_itself",
          candidateId: pipeReplacement.candidateId,
          binding: "UNRESOLVED",
        },
      ],
    });
    expect(target.candidates).toMatchObject([
      {
        candidateId: pipeReplacement.candidateId,
        candidateBinding: "DIRECT",
      },
    ]);
    expect(buildDeterministicPreparedEvidenceJudgement(target)).toMatchObject({
      coverageEffect: COVERAGE_EFFECT.INCLUDED,
      conflictState: CONFLICT_STATE.NONE,
    });
  });

  test("an operative replacement sentence is authoritative, while denial, bare mention, and foreign scope stay distinct", () => {
    const exactText =
      "Kosten für die Beseitigung von Verstopfungen an den versicherten wasserführenden Rohren";
    const operative = occurrence({
      candidateId: "candidate:lw26:operative",
      exactText,
      contextText: `Verstopfungsbehebung62PA0070\nEs werden die ${exactText} ersetzt.`,
      scopeLeadText: "",
      sectionScopeKey: "LEITUNGSWASSER_INSURANCE",
      pageNumber: 14,
    });
    operative.context.unitType = "WORD_WINDOW_FALLBACK";
    const worksheet = {
      candidateOnly: true,
      catalog: { categoryView: "LW" },
      requirements: [
        {
          id: "LW-26",
          label: "Rohrverstopfung und Reinigungskosten",
          requestedFields: [],
          scopeRules: { narrowAliases: [], narrowScopeKeys: [] },
          components: [
            {
              id: "cleaning_costs",
              label: "Reinigungskosten",
              factRole: "COST",
              occurrences: [operative],
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
        occurrence: operative,
      })
    ).toEqual({
      binding: "DIRECT",
      basis: "EXPLICIT_POSITIVE_OPERATIVE_COVERAGE_CLAUSE",
      authoritative: true,
    });

    const [target] = buildPreparedEvidenceTargets({
      worksheet,
      documentStatus: DOCUMENT_STATUS.PROPOSAL,
      candidateTriage: [
        {
          requirementId: "LW-26",
          componentId: "cleaning_costs",
          candidateId: operative.candidateId,
          binding: "MENTION_ONLY",
        },
      ],
    });
    expect(target.candidates).toHaveLength(1);
    expect(buildDeterministicPreparedEvidenceJudgement(target)).toMatchObject({
      coverageEffect: COVERAGE_EFFECT.INCLUDED,
    });

    const denial = {
      ...operative,
      candidateId: "candidate:lw26:denial",
      context: {
        ...operative.context,
        text: `Die ${exactText} werden nicht ersetzt.`,
      },
    };
    denial.documentStart =
      denial.context.documentStart + denial.context.text.indexOf(exactText);
    denial.documentEnd = denial.documentStart + exactText.length;
    expect(
      deterministicCategoryCandidateBinding({
        worksheet,
        requirement: worksheet.requirements[0],
        component: worksheet.requirements[0].components[0],
        occurrence: denial,
      })
    ).toEqual({
      binding: "DIRECT",
      basis: "EXPLICIT_NEGATIVE_OPERATIVE_COVERAGE_CLAUSE",
      authoritative: true,
    });

    const bareMention = {
      ...operative,
      candidateId: "candidate:lw26:bare",
      context: { ...operative.context, text: exactText },
    };
    bareMention.documentStart = bareMention.context.documentStart;
    bareMention.documentEnd = bareMention.documentStart + exactText.length;
    expect(
      deterministicCategoryCandidateBinding({
        worksheet,
        requirement: worksheet.requirements[0],
        component: worksheet.requirements[0].components[0],
        occurrence: bareMention,
      })
    ).toBeNull();

    const foreignScope = {
      ...operative,
      sectionScopeHint: {
        scopeKey: "HAFTPFLICHT_INSURANCE",
        text: "Haftpflichtversicherung",
      },
    };
    expect(
      deterministicCategoryCandidateBinding({
        worksheet,
        requirement: worksheet.requirements[0],
        component: worksheet.requirements[0].components[0],
        occurrence: foreignScope,
      })
    ).toEqual({
      binding: "MENTION_ONLY",
      basis: "EXPLICIT_OTHER_CATEGORY_SECTION",
    });
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
