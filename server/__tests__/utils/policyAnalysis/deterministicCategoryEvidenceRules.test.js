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

  test("leaves a matching phrase in a different category chapter model-owned", () => {
    const input = bindingInput({
      text: "Versichert sind Schäden durch Hagel.",
      exactText: "Hagel",
    });
    input.occurrence.sectionScopeHint.scopeKey = "HAFTPFLICHT_INSURANCE";

    expect(deterministicCategoryCandidateBinding(input)).toBeNull();
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
});
