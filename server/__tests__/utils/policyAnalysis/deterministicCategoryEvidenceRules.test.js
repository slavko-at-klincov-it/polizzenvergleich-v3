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
});
