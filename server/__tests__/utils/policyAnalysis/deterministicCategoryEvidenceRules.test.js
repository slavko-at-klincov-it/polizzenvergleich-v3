const {
  clausePolarity,
  deterministicCategoryCandidateBinding,
  deterministicCategoryPreparedDecision,
} = require("../../../utils/policyAnalysis/deterministicCategoryEvidenceRules");

function occurrence({ text, exactText, scopeLeadText = "" }) {
  const documentStart = 1_000;
  const relativeStart = text.indexOf(exactText);
  return {
    candidateId: `candidate:${exactText}`,
    exactText,
    documentStart: documentStart + relativeStart,
    documentEnd: documentStart + relativeStart + exactText.length,
    context: {
      text,
      documentStart,
      documentEnd: documentStart + text.length,
    },
    scopeLead: { text: scopeLeadText },
    sectionScopeHint: {
      scopeKey: "STURM_INSURANCE",
      text: "5. Sturmversicherung",
    },
  };
}

function bindingInput({ text, exactText, narrowAliases = [] }) {
  return {
    worksheet: { catalog: { categoryView: "ST" } },
    requirement: {
      id: "ST-04",
      scopeRules: { narrowAliases },
    },
    component: { id: "hail", factRole: "PERIL" },
    occurrence: occurrence({ text, exactText }),
  };
}

describe("deterministicCategoryEvidenceRules", () => {
  function vbBindingInput({ requirementId, componentId, text, exactText }) {
    const input = bindingInput({ text, exactText });
    input.worksheet.catalog.categoryView = "VB";
    input.requirement.id = requirementId;
    input.component = {
      id: componentId,
      factRole: "CONDITION",
    };
    input.occurrence.sectionScopeHint.scopeKey = "GENERAL_CONTRACT_TERMS";
    return input;
  }

  test("uses the nearest explicit coverage governor", () => {
    const text = [
      "Versichert sind Schäden durch Hagel.",
      "Nicht versichert sind Schäden durch Schnee- und Eisrutsch an Außenmauern.",
    ].join("\n");

    expect(
      clausePolarity({
        contextText: text,
        exactText: "Hagel",
        occurrenceStart: 1_000 + text.indexOf("Hagel"),
        contextDocumentStart: 1_000,
      })
    ).toBe("POSITIVE");
    expect(
      clausePolarity({
        contextText: text,
        exactText: "Außenmauern",
        occurrenceStart: 1_000 + text.indexOf("Außenmauern"),
        contextDocumentStart: 1_000,
      })
    ).toBe("NEGATIVE");
  });

  test.each([
    ["Versicherte Kosten gemäß Art. 3:", "POSITIVE"],
    ["Versicherte Kosten im Rahmen der Versicherungssumme", "POSITIVE"],
    ["7.2 Versicherte Gefahren", "POSITIVE"],
    ["Nicht versicherte Schäden:", "NEGATIVE"],
    ["9. Nicht versicherte Kosten und Gefahren", "NEGATIVE"],
  ])(
    "uses the complete semantic heading %s as a %s governor",
    (heading, expectedPolarity) => {
      const text = "Suchkosten und Hagel werden im folgenden Absatz erläutert.";

      expect(
        clausePolarity({
          scopeLeadText: heading,
          contextText: text,
          exactText: "Suchkosten",
          occurrenceStart: 1_000 + text.indexOf("Suchkosten"),
          contextDocumentStart: 1_000,
        })
      ).toBe(expectedPolarity);
    }
  );

  test.each([
    "Die versicherten Kosten umfassen Suchkosten.",
    "Versicherte Kosten: Suchkosten und Nebenkosten.",
    "Der Abschnitt beschreibt nicht versicherte Schäden und Gefahren.",
  ])(
    "does not use flowing text as a semantic governor: %s",
    (scopeLeadText) => {
      const text = "Suchkosten werden im folgenden Absatz erläutert.";

      expect(
        clausePolarity({
          scopeLeadText,
          contextText: text,
          exactText: "Suchkosten",
          occurrenceStart: 1_000 + text.indexOf("Suchkosten"),
          contextDocumentStart: 1_000,
        })
      ).toBe("UNKNOWN");
    }
  );

  test("lets a local exklusive clause override a carried positive list governor", () => {
    const text =
      "Keller- und andere Abstellabteile samt Türen, jedoch exklusive deren Inhalt.";

    expect(
      clausePolarity({
        scopeLeadText: "Versichert sind",
        contextText: text,
        exactText: "Inhalt",
        occurrenceStart: 1_000 + text.indexOf("Inhalt"),
        contextDocumentStart: 1_000,
      })
    ).toBe("NEGATIVE");
  });

  test("does not carry an inline exklusive clause into the next list item", () => {
    expect(
      clausePolarity({
        scopeLeadText:
          "Versichert sind\n- Kellerabteile, jedoch exklusive deren Inhalt;\n- gemauerte Öfen;",
        contextText:
          "- Gas- und Heizöltanks zum Zweck der Beheizung des Gebäudes;",
        exactText: "Heizöltanks",
        occurrenceStart: 1_010,
        contextDocumentStart: 1_000,
      })
    ).toBe("POSITIVE");
  });

  test("binds a positive hail clause directly in the storm section", () => {
    expect(
      deterministicCategoryCandidateBinding(
        bindingInput({
          text: "Versichert sind Schäden durch Hagel.",
          exactText: "Hagel",
        })
      )
    ).toEqual({
      binding: "DIRECT",
      basis: "EXPLICIT_POSITIVE_CLAUSE_GOVERNOR",
    });
  });

  test("binds paragraph-wrapped costs that are explicitly mitversichert", () => {
    const text = [
      "ST01 Entsorgung von Bäumen",
      "Die Kosten nach einem versicherten Sturmschaden für das Sichern und Entsorgen von",
      "Bäumen, die von einem Sturmschaden betroffen sind, sind bis EUR 3.000.- mitversichert.",
    ].join("\n");
    const input = bindingInput({
      text,
      exactText:
        "ST01 Entsorgung von Bäumen\nDie Kosten nach einem versicherten Sturmschaden für das Sichern und Entsorgen von",
    });
    input.requirement.id = "ST-25";
    input.component = { id: "tree_removal_costs", factRole: "COST" };
    input.occurrence.context.unitType = "PARAGRAPH";

    expect(deterministicCategoryCandidateBinding(input)).toEqual({
      binding: "DIRECT",
      basis: "EXPLICIT_POSITIVE_OPERATIVE_COVERAGE_CLAUSE",
      authoritative: true,
    });
  });

  test("binds paragraph-wrapped costs that are explicitly not mitversichert", () => {
    const text = [
      "Kosten für die Entsorgung von Bäumen",
      "sind nach einem Sturmschaden nicht mitversichert.",
    ].join("\n");
    const input = bindingInput({ text, exactText: "Entsorgung von Bäumen" });
    input.requirement.id = "ST-25";
    input.component = { id: "tree_removal_costs", factRole: "COST" };
    input.occurrence.context.unitType = "PARAGRAPH";

    expect(deterministicCategoryCandidateBinding(input)).toEqual({
      binding: "DIRECT",
      basis: "EXPLICIT_NEGATIVE_OPERATIVE_COVERAGE_CLAUSE",
      authoritative: true,
    });
  });

  test("does not carry mitversichert from the next sentence into tree costs", () => {
    const text = [
      "Die Kosten für die Entsorgung von Bäumen werden gesondert beschrieben.",
      "Andere Sachen sind mitversichert.",
    ].join("\n");
    const input = bindingInput({ text, exactText: "Entsorgung von Bäumen" });
    input.requirement.id = "ST-25";
    input.component = { id: "tree_removal_costs", factRole: "COST" };
    input.occurrence.context.unitType = "PARAGRAPH";

    expect(deterministicCategoryCandidateBinding(input)).toBeNull();
  });

  test("rejects a matching phrase from an explicit different coverage chapter", () => {
    const input = bindingInput({
      text: "Versichert sind Schäden durch Hagel.",
      exactText: "Hagel",
    });
    input.occurrence.sectionScopeHint.scopeKey = "HAFTPFLICHT_INSURANCE";

    expect(deterministicCategoryCandidateBinding(input)).toEqual({
      binding: "MENTION_ONLY",
      basis: "EXPLICIT_OTHER_CATEGORY_SECTION",
    });
  });

  test("leaves a cross-cutting general contract section model-owned", () => {
    const input = bindingInput({
      text: "Versichert sind Schäden durch Hagel.",
      exactText: "Hagel",
    });
    input.occurrence.sectionScopeHint.scopeKey = "GENERAL_CONTRACT_TERMS";

    expect(deterministicCategoryCandidateBinding(input)).toBeNull();
  });

  const generalBranchMaximumClause =
    "Die Höchstentschädigung im Schadensfall beträgt inklusive aller für die jeweilige Sparte vereinbarten Positionen maximal 150 % der vereinbarten Versicherungssumme.";
  const generalBranchMaximumTargets = [
    ["FE", "FE-F02", "fire_maximum_indemnity"],
    ["LW", "LW-31", "water_line_maximum_compensation"],
    ["ST", "ST-34", "storm_maximum_compensation"],
  ];

  function generalBranchMaximumInput({
    categoryView,
    requirementId,
    componentId,
    text = generalBranchMaximumClause,
    scopeKey = "GENERAL_CONTRACT_TERMS",
  }) {
    const input = bindingInput({
      text,
      exactText: "Höchstentschädigung im Schadensfall",
    });
    input.worksheet.catalog.categoryView = categoryView;
    input.requirement.id = requirementId;
    input.component = { id: componentId, factRole: "LIMIT" };
    input.occurrence.sectionScopeHint.scopeKey = scopeKey;
    return input;
  }

  test.each(generalBranchMaximumTargets)(
    "binds the explicit general branch maximum for %s",
    (categoryView, requirementId, componentId) => {
      expect(
        deterministicCategoryCandidateBinding(
          generalBranchMaximumInput({
            categoryView,
            requirementId,
            componentId,
          })
        )
      ).toEqual({
        binding: "DIRECT",
        basis: "GENERAL_BRANCH_MAXIMUM_INDEMNITY",
        authoritative: true,
      });
    }
  );

  test.each(generalBranchMaximumTargets)(
    "materializes the explicit general branch maximum for %s",
    (categoryView, requirementId, componentId) => {
      expect(
        deterministicCategoryPreparedDecision({
          categoryView,
          requirementId,
          componentId,
          candidates: [
            {
              candidateId: `candidate:${categoryView}`,
              candidateBinding: "DIRECT",
              deterministicBindingBasis: "GENERAL_BRANCH_MAXIMUM_INDEMNITY",
            },
          ],
        })
      ).toEqual({
        selectedCandidateIds: [`candidate:${categoryView}`],
        coverageEffect: "DEFINED",
        basis: `EXPLICIT_GENERAL_BRANCH_MAXIMUM:${categoryView}:${requirementId}`,
      });
    }
  );

  test.each([
    [
      "a different insurance section",
      generalBranchMaximumClause,
      "HAFTPFLICHT_INSURANCE",
    ],
    [
      "no respective-branch anchor",
      "Die Höchstentschädigung im Schadensfall beträgt maximal 150 % der vereinbarten Versicherungssumme.",
      "GENERAL_CONTRACT_TERMS",
    ],
    [
      "no numeric maximum anchor",
      "Die Höchstentschädigung im Schadensfall beträgt inklusive aller für die jeweilige Sparte vereinbarten Positionen.",
      "GENERAL_CONTRACT_TERMS",
    ],
  ])("does not bind the general maximum with %s", (_label, text, scopeKey) => {
    const decision = deterministicCategoryCandidateBinding(
      generalBranchMaximumInput({
        categoryView: "ST",
        requirementId: "ST-34",
        componentId: "storm_maximum_compensation",
        text,
        scopeKey,
      })
    );
    expect(decision?.basis).not.toBe("GENERAL_BRANCH_MAXIMUM_INDEMNITY");
  });

  test("does not bind the Feuer annual aggregate from a branch maximum", () => {
    const decision = deterministicCategoryCandidateBinding(
      generalBranchMaximumInput({
        categoryView: "FE",
        requirementId: "FE-F02",
        componentId: "fire_annual_aggregate",
      })
    );
    expect(decision?.basis).not.toBe("GENERAL_BRANCH_MAXIMUM_INDEMNITY");
  });

  test("binds an explicit general contract term authoritatively", () => {
    expect(
      deterministicCategoryCandidateBinding(
        vbBindingInput({
          requirementId: "VB-01",
          componentId: "contract_term",
          text: "Dauerrabatt 20 % - Laufzeit mind. 10 Jahre",
          exactText: "Laufzeit mind.",
        })
      )
    ).toEqual({
      binding: "DIRECT",
      basis: "VB_01_EXPLICIT_CONTRACT_TERM",
      authoritative: true,
    });
  });

  test.each([
    "Laufzeit bis zu 10 Jahre",
    "Kündigungsfrist 10 Jahre",
    "während der Vertragslaufzeit",
  ])(
    "does not authoritatively bind a non-contract duration from %s",
    (text) => {
      const exactText = text.includes("Vertragslaufzeit")
        ? "Vertragslaufzeit"
        : text.split(" ").slice(0, 2).join(" ");
      expect(
        deterministicCategoryCandidateBinding(
          vbBindingInput({
            requirementId: "VB-01",
            componentId: "contract_term",
            text,
            exactText,
          })
        )
      ).toBeNull();
    }
  );

  test.each([
    "Für diese Deckungserweiterung gilt ein Sublimit im Rahmen der Pauschalversicherungssumme.",
    "Diese Kosten werden auf die Pauschalversicherungssumme angerechnet.",
  ])("keeps an HP combined-sum reference non-evidentiary: %s", (text) => {
    const input = bindingInput({
      text,
      exactText: "Pauschalversicherungssumme",
    });
    input.worksheet.catalog.categoryView = "HP";
    input.requirement.id = "HP-01";
    input.component = { id: "combined_liability_limit", factRole: "LIMIT" };
    input.occurrence.sectionScopeHint = {
      scopeKey: "HAFTPFLICHT_INSURANCE",
      text: "HAFTPFLICHTVERSICHERUNG",
    };

    expect(deterministicCategoryCandidateBinding(input)).toEqual({
      binding: "MENTION_ONLY",
      basis: "HP_01_COMBINED_SUM_REFERENCE_WITHOUT_STANDALONE_LIMIT",
      authoritative: true,
    });
  });

  test("binds an operative total premium and its tax statement", () => {
    const total =
      "Die Gesamtprämie inkl. Steuern (Bruttoprämie) beträgt vierteljährlich EUR 14.747,66.";
    expect(
      deterministicCategoryCandidateBinding(
        vbBindingInput({
          requirementId: "VB-27",
          componentId: "total_premium",
          text: total,
          exactText: "Gesamtprämie inkl. Steuern",
        })
      )
    ).toEqual({
      binding: "DIRECT",
      basis: "VB_27_EXPLICIT_TOTAL_PREMIUM",
      authoritative: true,
    });
    expect(
      deterministicCategoryCandidateBinding(
        vbBindingInput({
          requirementId: "VB-27",
          componentId: "tax_included",
          text: total,
          exactText: "inkl. Steuern",
        })
      )
    ).toEqual({
      binding: "DIRECT",
      basis: "VB_27_EXPLICIT_TAX_INCLUSION",
      authoritative: true,
    });
  });

  test("does not bind an unrelated later periodic amount as total premium", () => {
    expect(
      deterministicCategoryCandidateBinding(
        vbBindingInput({
          requirementId: "VB-27",
          componentId: "total_premium",
          text: "Die Gesamtprämie wird separat ausgewiesen. Vierteljährlich EUR 500 Bearbeitungskosten.",
          exactText: "Gesamtprämie",
        })
      )
    ).toBeNull();
  });

  test("materializes only server-bound general contract facts as defined", () => {
    expect(
      deterministicCategoryPreparedDecision({
        categoryView: "VB",
        requirementId: "VB-27",
        componentId: "total_premium",
        candidates: [
          {
            candidateId: "candidate:premium",
            candidateBinding: "DIRECT",
            deterministicBindingBasis: "VB_27_EXPLICIT_TOTAL_PREMIUM",
          },
        ],
      })
    ).toEqual({
      selectedCandidateIds: ["candidate:premium"],
      coverageEffect: "DEFINED",
      basis: "EXPLICIT_GENERAL_CONTRACT_FACT:VB:VB-27",
    });
  });

  test("binds an explicit reinstatement deadline and its extension authoritatively", () => {
    const deadline = vbBindingInput({
      requirementId: "VB-26",
      componentId: "reinstatement_deadline",
      text: "Die Wiederherstellung muss innerhalb dreier Jahre nach dem Schadenfall erfolgen.",
      exactText: "Wiederherstellung",
    });
    const extension = vbBindingInput({
      requirementId: "VB-26",
      componentId: "reinstatement_deadline",
      text: "Im Falle eines Deckungsprozesses wird die Frist für die Wiederherstellung um die Dauer des Deckungsprozesses erstreckt.",
      exactText:
        "Frist für die Wiederherstellung um die Dauer des Deckungsprozesses erstreckt",
    });

    expect(deterministicCategoryCandidateBinding(deadline)).toEqual({
      binding: "DIRECT",
      basis: "VB_26_EXPLICIT_REINSTATEMENT_DEADLINE",
      authoritative: true,
    });
    expect(deterministicCategoryCandidateBinding(extension)).toEqual({
      binding: "DIRECT",
      basis: "VB_26_EXPLICIT_REINSTATEMENT_DEADLINE",
      authoritative: true,
    });
    expect(
      deterministicCategoryPreparedDecision({
        categoryView: "VB",
        requirementId: "VB-26",
        componentId: "reinstatement_deadline",
        candidates: [
          {
            candidateId: "candidate:deadline",
            candidateBinding: "DIRECT",
            deterministicBindingBasis: "VB_26_EXPLICIT_REINSTATEMENT_DEADLINE",
          },
          {
            candidateId: "candidate:extension",
            candidateBinding: "DIRECT",
            deterministicBindingBasis: "VB_26_EXPLICIT_REINSTATEMENT_DEADLINE",
          },
        ],
      })
    ).toEqual({
      selectedCandidateIds: ["candidate:deadline", "candidate:extension"],
      coverageEffect: "DEFINED",
      basis: "EXPLICIT_GENERAL_CONTRACT_FACT:VB:VB-26",
    });
  });

  test.each([
    "Die Wiederherstellung wird beschrieben. Die Kündigungsfrist beträgt drei Jahre.",
    "Eine Wiederherstellung ist möglich, eine konkrete Frist ist nicht vereinbart.",
  ])("does not authoritatively invent a VB-26 deadline from %s", (text) => {
    expect(
      deterministicCategoryCandidateBinding(
        vbBindingInput({
          requirementId: "VB-26",
          componentId: "reinstatement_deadline",
          text,
          exactText: "Wiederherstellung",
        })
      )
    ).toBeNull();
  });

  test("binds an explicit HP annual aggregate multiple authoritatively", () => {
    const input = bindingInput({
      text: "Die maßgebende Pauschalversicherungssumme steht für alle Versicherungsfälle eines Jahres zusammen maximal dreimal zur Verfügung.",
      exactText:
        "Pauschalversicherungssumme steht für alle Versicherungsfälle eines Jahres zusammen maximal dreimal",
    });
    input.worksheet.catalog.categoryView = "HP";
    input.requirement.id = "HP-02";
    input.component = {
      id: "annual_aggregate_multiple",
      factRole: "LIMIT",
    };
    input.occurrence.sectionScopeHint.scopeKey = "HAFTPFLICHT_INSURANCE";

    expect(deterministicCategoryCandidateBinding(input)).toEqual({
      binding: "DIRECT",
      basis: "HP_02_EXPLICIT_ANNUAL_AGGREGATE_MULTIPLE",
      authoritative: true,
    });
    expect(
      deterministicCategoryPreparedDecision({
        categoryView: "HP",
        requirementId: "HP-02",
        componentId: "annual_aggregate_multiple",
        candidates: [
          {
            candidateId: "candidate:annual-aggregate",
            candidateBinding: "DIRECT",
            deterministicBindingBasis:
              "HP_02_EXPLICIT_ANNUAL_AGGREGATE_MULTIPLE",
          },
        ],
      })
    ).toEqual({
      selectedCandidateIds: ["candidate:annual-aggregate"],
      coverageEffect: "DEFINED",
      basis: "EXPLICIT_HP02_ANNUAL_AGGREGATE_MULTIPLE:HP:HP-02",
    });
  });

  test.each(["claims_handling", "claims_contact"])(
    "binds a complete VB-36 claims-service contact block for %s",
    (componentId) => {
      const input = bindingInput({
        text: "Das kostenlose Schadenmanagement: Unter 0800 204 44 00 ermöglichen wir Ihnen rund um die Uhr eine rasche und unbürokratische telefonische Schadenmeldung. Bei Problemen und Notfällen erhalten Sie Beratung und Hilfestellung.",
        exactText: "telefonische Schadenmeldung",
      });
      input.worksheet.catalog.categoryView = "VB";
      input.requirement.id = "VB-36";
      input.component = { id: componentId, factRole: "CONDITION" };
      input.occurrence.sectionScopeHint = {
        scopeKey: "GENERAL_CONTRACT_TERMS",
        text: "Allgemeines",
      };

      expect(deterministicCategoryCandidateBinding(input)).toEqual({
        binding: "DIRECT",
        basis: "VB_36_EXPLICIT_CLAIMS_SERVICE_AND_TELEPHONE_CONTACT",
        authoritative: true,
      });
    }
  );

  test.each([
    "Das kostenlose Schadenmanagement wird näher beschrieben.",
    "Unter 0800 204 44 00 erhalten Sie allgemeine Produktinformationen.",
    "Eine telefonische Schadenmeldung ist rund um die Uhr möglich.",
  ])("does not bind an incomplete VB-36 contact block: %s", (text) => {
    const input = bindingInput({
      text,
      exactText: text.includes("Schadenmanagement")
        ? "Schadenmanagement"
        : text.includes("Schadenmeldung")
          ? "telefonische Schadenmeldung"
          : "0800 204 44 00",
    });
    input.worksheet.catalog.categoryView = "VB";
    input.requirement.id = "VB-36";
    input.component = { id: "claims_contact", factRole: "CONDITION" };
    input.occurrence.sectionScopeHint = {
      scopeKey: "GENERAL_CONTRACT_TERMS",
      text: "Allgemeines",
    };

    expect(
      deterministicCategoryCandidateBinding(input)?.authoritative
    ).not.toBe(true);
  });

  test.each([
    ["combined_liability_limit", "LIMIT"],
    ["personal_injury", "DAMAGE"],
    ["property_damage", "DAMAGE"],
  ])(
    "binds an explicit HP combined liability sum for %s",
    (componentId, factRole) => {
      const input = bindingInput({
        text: "Pauschalversicherungssumme EUR 3.000.000,00",
        exactText: "Pauschalversicherungssumme",
      });
      input.worksheet.catalog.categoryView = "HP";
      input.requirement.id = "HP-01";
      input.component = { id: componentId, factRole };
      input.occurrence.sectionScopeHint = {
        scopeKey: "HAFTPFLICHT_INSURANCE",
        text: "HAFTPFLICHTVERSICHERUNG",
      };

      expect(deterministicCategoryCandidateBinding(input)).toEqual({
        binding: "DIRECT",
        basis: "HP_01_EXPLICIT_COMBINED_LIABILITY_SUM",
        authoritative: true,
      });
    }
  );

  test.each(["builders_liability", "construction_sum_limit"])(
    "binds an explicit HP builders-liability summary for %s",
    (componentId) => {
      const input = bindingInput({
        text: "Bauherr - Umbau-, Neubau- und Sanierungshaftpflichtrisiko (Gesamtbaukosten EUR\n1.000.000) Sublimit EUR 3.000.000,00",
        exactText:
          componentId === "construction_sum_limit"
            ? "Gesamtbaukosten"
            : "Sanierungshaftpflichtrisiko",
      });
      input.worksheet.catalog.categoryView = "HP";
      input.requirement.id = "HP-08";
      input.component = {
        id: componentId,
        factRole:
          componentId === "construction_sum_limit" ? "LIMIT" : "BENEFIT",
      };
      input.occurrence.sectionScopeHint = {
        scopeKey: "HAFTPFLICHT_INSURANCE",
        text: "HAFTPFLICHTVERSICHERUNG",
      };

      expect(deterministicCategoryCandidateBinding(input)).toEqual({
        binding: "DIRECT",
        basis: "HP_08_EXPLICIT_BUILDERS_LIABILITY_AND_CONSTRUCTION_SUM",
        authoritative: true,
      });
    }
  );

  test.each([
    ["HP-01", "Pauschalversicherungssumme EUR 3.000.000,00"],
    [
      "HP-08",
      "Bauherr - Umbau-, Neubau- und Sanierungshaftpflichtrisiko Sublimit EUR 3.000.000,00",
    ],
  ])(
    "does not bind incomplete or foreign-scope HP summary wording for %s",
    (id, text) => {
      const input = bindingInput({ text, exactText: text.split(" ")[0] });
      input.worksheet.catalog.categoryView = "HP";
      input.requirement.id = id;
      input.component = {
        id: id === "HP-01" ? "combined_liability_limit" : "builders_liability",
        factRole: id === "HP-01" ? "LIMIT" : "BENEFIT",
      };
      input.occurrence.sectionScopeHint = {
        scopeKey: id === "HP-01" ? "FEUER_INSURANCE" : "HAFTPFLICHT_INSURANCE",
        text: id === "HP-01" ? "FEUERVERSICHERUNG" : "HAFTPFLICHTVERSICHERUNG",
      };

      expect(
        deterministicCategoryCandidateBinding(input)?.authoritative
      ).not.toBe(true);
    }
  );

  test.each([
    "Die Pauschalversicherungssumme steht maximal dreimal zur Verfügung.",
    "Für alle Versicherungsfälle eines Jahres sind maximal drei Meldungen möglich.",
  ])("does not authoritatively bind an incomplete HP-02 clause: %s", (text) => {
    const input = bindingInput({
      text,
      exactText: text.includes("Pauschalversicherungssumme")
        ? "Pauschalversicherungssumme"
        : "Versicherungsfälle eines Jahres",
    });
    input.worksheet.catalog.categoryView = "HP";
    input.requirement.id = "HP-02";
    input.component = {
      id: "annual_aggregate_multiple",
      factRole: "LIMIT",
    };
    input.occurrence.sectionScopeHint.scopeKey = "HAFTPFLICHT_INSURANCE";

    expect(deterministicCategoryCandidateBinding(input)).toBeNull();
  });

  test("binds a complete labelled insurance period authoritatively", () => {
    const input = bindingInput({
      text: "Versicherungsbeginn 19.01.2026, 0:00 Uhr, Versicherungsablauf 01.01.2037, 0:00 Uhr",
      exactText: "Versicherungsablauf",
    });
    input.worksheet.catalog.categoryView = "FE";
    input.requirement.id = "FE-F05";
    input.component = {
      id: "temporal_validity",
      factRole: "CONDITION",
    };
    input.occurrence.sectionScopeHint = null;

    expect(deterministicCategoryCandidateBinding(input)).toEqual({
      binding: "DIRECT",
      basis: "FE_F05_EXPLICIT_INSURANCE_PERIOD",
      authoritative: true,
    });
    expect(
      deterministicCategoryPreparedDecision({
        categoryView: "FE",
        requirementId: "FE-F05",
        componentId: "temporal_validity",
        candidates: [
          {
            candidateId: "candidate:insurance-period",
            candidateBinding: "DIRECT",
            deterministicBindingBasis: "FE_F05_EXPLICIT_INSURANCE_PERIOD",
          },
        ],
      })
    ).toEqual({
      selectedCandidateIds: ["candidate:insurance-period"],
      coverageEffect: "DEFINED",
      basis: "EXPLICIT_FEF05_INSURANCE_PERIOD:FE:FE-F05",
    });
  });

  test.each([
    "Versicherungsbeginn 19.01.2026, 0:00 Uhr",
    "Versicherungsablauf 01.01.2037, 0:00 Uhr",
  ])("does not bind an incomplete insurance period: %s", (text) => {
    const input = bindingInput({
      text,
      exactText: text.split(" ")[0],
    });
    input.worksheet.catalog.categoryView = "FE";
    input.requirement.id = "FE-F05";
    input.component = {
      id: "temporal_validity",
      factRole: "CONDITION",
    };
    input.occurrence.sectionScopeHint = null;

    expect(deterministicCategoryCandidateBinding(input)).toBeNull();
  });

  test("rejects a clause activated in several other coverage chapters", () => {
    const input = bindingInput({
      text: "Versichert sind Schäden durch Hagel.",
      exactText: "Hagel",
    });
    input.worksheet.catalog.categoryView = "HP";
    input.requirement.id = "HP-01";
    input.occurrence.sectionScopeHint = {
      scopeKey: null,
      scopeKeys: ["FEUER_INSURANCE", "STURM_INSURANCE"],
      text: "Gemeinsame Sachklausel10PA0001",
    };

    expect(deterministicCategoryCandidateBinding(input)).toEqual({
      binding: "MENTION_ONLY",
      basis: "EXPLICIT_OTHER_CATEGORY_SECTION",
    });
  });

  test("keeps a snow-and-ice-slide exclusion narrow instead of making hail generally excluded", () => {
    expect(
      deterministicCategoryCandidateBinding(
        bindingInput({
          text: "Schäden durch Schnee- und Eisrutsch. Nicht versichert sind Schäden an Hausfassade, Außenmauern und Dachbelag.",
          exactText: "Hausfassade",
          narrowAliases: ["Schnee- und Eisrutsch"],
        })
      )
    ).toEqual({
      binding: "NARROW_SCOPE",
      basis: "EXPLICIT_NARROW_CLAUSE_SCOPE",
    });
  });

  test("keeps the broad positive rule decisive while preserving a narrow exception separately", () => {
    const target = {
      categoryView: "ST",
      requirementId: "ST-04",
      factRole: "PERIL",
      candidates: [
        {
          candidateId: "candidate:hail-positive",
          candidateBinding: "DIRECT",
          exactText: "Hagel",
          contextText: "Versichert sind Schäden durch Hagel.",
          contextDocumentStart: 1_000,
          documentStart: 1_029,
          scopeLeadText: "5. Sturmversicherung",
        },
        {
          candidateId: "candidate:snow-slide-negative",
          candidateBinding: "NARROW_SCOPE",
          exactText: "Hausfassade",
          contextText:
            "Schäden durch Schnee- und Eisrutsch. Nicht versichert sind Schäden an Hausfassade.",
          contextDocumentStart: 2_000,
          documentStart:
            2_000 +
            "Schäden durch Schnee- und Eisrutsch. Nicht versichert sind Schäden an Hausfassade.".indexOf(
              "Hausfassade"
            ),
          scopeLeadText: "Schnee- und Eisrutsch",
        },
      ],
    };

    expect(deterministicCategoryPreparedDecision(target)).toEqual({
      selectedCandidateIds: ["candidate:hail-positive"],
      coverageEffect: "INCLUDED",
      basis: "EXPLICIT_GENERAL_RULE_WITH_NARROW_EXCEPTION:ST:ST-04",
    });
  });

  test("rejects a bare object mention as evidence for a requested local limit", () => {
    const input = bindingInput({
      text: "Nicht versichert sind Reparaturen von Dachrinnen.",
      exactText: "Dachrinnen",
    });
    input.requirement.id = "ST-11";
    input.component = { id: "gutter_limit", factRole: "LIMIT" };

    expect(deterministicCategoryCandidateBinding(input)).toEqual({
      binding: "MENTION_ONLY",
      basis: "LIMIT_TERM_WITHOUT_LOCAL_LIMIT",
    });
  });

  test("creates a terminal included result only for agreeing explicit evidence", () => {
    const target = {
      categoryView: "ST",
      requirementId: "ST-04",
      factRole: "PERIL",
      candidates: [
        {
          candidateId: "candidate:hail-positive",
          candidateBinding: "DIRECT",
          exactText: "Hagel",
          contextText: "Versichert sind Schäden durch Hagel.",
          contextDocumentStart: 1_000,
          documentStart: 1_029,
          scopeLeadText: "5. Sturmversicherung",
        },
      ],
    };

    expect(deterministicCategoryPreparedDecision(target)).toEqual({
      selectedCandidateIds: ["candidate:hail-positive"],
      coverageEffect: "INCLUDED",
      basis: "EXPLICIT_CATEGORY_CLAUSE:ST:ST-04",
    });
  });

  test("creates a terminal excluded result for basement contents named after exklusive", () => {
    const contextText =
      "Keller- und andere Abstellabteile oder Boxen samt dazugehörigen Türen, jedoch exklusive deren Inhalt.";
    const exactText = contextText;
    const target = {
      categoryView: "WE",
      requirementId: "WE-14",
      factRole: "INSURED_OBJECT",
      candidates: [
        {
          candidateId: "candidate:we14:basement-contents",
          candidateBinding: "DIRECT",
          exactText,
          contextText,
          contextDocumentStart: 4_000,
          documentStart: 4_000,
          scopeLeadText: "Versichert sind Sachen und Einrichtungen",
        },
      ],
    };

    expect(deterministicCategoryPreparedDecision(target)).toEqual({
      selectedCandidateIds: ["candidate:we14:basement-contents"],
      coverageEffect: "EXCLUDED",
      basis: "EXPLICIT_CATEGORY_CLAUSE:WE:WE-14",
    });
  });

  test("treats a pure object-classification list as defined, not covered", () => {
    const target = {
      categoryView: "ST",
      requirementId: "ST-16",
      componentId: "shading_system",
      factRole: "INSURED_OBJECT",
      unresolvedCandidateIds: [],
      candidates: ["Jalousien", "Rollläden"].map((exactText) => ({
        candidateId: `candidate:${exactText}`,
        candidateBinding: "DIRECT",
        exactText,
        contextUnitType: "LIST_ITEM",
        contextText:
          "·Jalousien und Rollläden inklusive Antriebselemente (nicht Sonnensegel und nicht Markisen);",
        objectClassificationContractId:
          "CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1",
      })),
    };

    expect(deterministicCategoryPreparedDecision(target)).toEqual({
      selectedCandidateIds: ["candidate:Jalousien", "candidate:Rollläden"],
      coverageEffect: "DEFINED",
      basis: "OBJECT_CLASSIFICATION_IS_NOT_GLOBAL_COVERAGE_V1",
    });
  });

  test("keeps mixed object-classification and coverage candidates model-owned", () => {
    const target = {
      categoryView: "ST",
      requirementId: "ST-21",
      componentId: "solar_thermal_system",
      factRole: "INSURED_OBJECT",
      unresolvedCandidateIds: [],
      candidates: [
        {
          candidateId: "candidate:definition",
          candidateBinding: "DIRECT",
          exactText: "Solaranlagen",
          contextUnitType: "LIST_ITEM",
          contextText: "·Solaranlagen;",
          objectClassificationContractId:
            "CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1",
        },
        {
          candidateId: "candidate:coverage",
          candidateBinding: "DIRECT",
          exactText: "Solaranlagen",
          contextUnitType: "PARAGRAPH",
          contextText: "Solaranlagen sind mitversichert.",
          scopeLeadText: "Versicherte Sachen:",
          objectClassificationContractId: null,
        },
      ],
    };

    expect(deterministicCategoryPreparedDecision(target)).toBeNull();
  });

  test("keeps a VS object definition neutral before applying legacy VS coverage rules", () => {
    const candidate = {
      candidateId: "candidate:outdoor-lighting",
      candidateBinding: "DIRECT",
      deterministicBindingBasis: "EXPLICIT_OUTDOOR_LIGHTING",
      exactText: "Beleuchtungsanlagen",
      contextUnitType: "LIST_ITEM",
      contextText:
        "·Außenanlagen, Firmenschilder, Antennenanlagen und Beleuchtungsanlagen;",
      contextDocumentStart: 5_000,
      objectClassificationContractId:
        "CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1",
    };
    const target = {
      categoryView: "VS",
      requirementId: "VS-19",
      componentId: "outdoor_lighting",
      factRole: "INSURED_OBJECT",
      unresolvedCandidateIds: [],
      candidates: [candidate],
    };

    expect(deterministicCategoryPreparedDecision(target)).toEqual({
      selectedCandidateIds: [candidate.candidateId],
      coverageEffect: "DEFINED",
      basis: "OBJECT_CLASSIFICATION_IS_NOT_GLOBAL_COVERAGE_V1",
    });
    const trueCoverageCandidate = {
      ...candidate,
      candidateId: "candidate:insured-outdoor-lighting",
      contextText: "Mitversichert sind Außenbeleuchtungsanlagen.",
      contextDocumentStart: 6_000,
      objectClassificationContractId: null,
    };
    expect(
      deterministicCategoryPreparedDecision({
        ...target,
        candidates: [trueCoverageCandidate],
      })
    ).toEqual({
      selectedCandidateIds: [trueCoverageCandidate.candidateId],
      coverageEffect: "INCLUDED",
      basis: "EXPLICIT_VS_RULE:VS-19",
    });
    expect(
      deterministicCategoryPreparedDecision({
        ...target,
        candidates: [candidate, trueCoverageCandidate],
      })
    ).toEqual({
      selectedCandidateIds: [trueCoverageCandidate.candidateId],
      coverageEffect: "INCLUDED",
      basis: "EXPLICIT_VS_RULE:VS-19",
    });
  });
});
