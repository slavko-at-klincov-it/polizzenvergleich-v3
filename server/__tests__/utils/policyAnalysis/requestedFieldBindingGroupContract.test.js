const {
  buildBindingGroupFieldApplicability,
  projectedFieldFactAppliesToAtom,
} = require("../../../utils/policyAnalysis/requestedFieldBindingGroupContract");

function fixture() {
  const text = "Aufräum- und Abbruchkosten sind bis 10 % versichert.";
  const contextStart = 1_000;
  const fieldStart = contextStart + text.indexOf("10 %");
  const bindingGroupId = `binding-group:${"c".repeat(64)}`;
  const indexed = (candidateId, componentId, physicalPageNumber = 3) => ({
    requirement: { id: "VS-21" },
    component: { id: componentId },
    occurrence: {
      candidateId,
      bindingGroupId,
      physicalPageNumber,
      context: {
        text,
        documentStart: contextStart,
        documentEnd: contextStart + text.length,
      },
    },
  });
  const candidateById = new Map([
    ["candidate:cleanup", indexed("candidate:cleanup", "cleanup_costs")],
    [
      "candidate:demolition",
      indexed("candidate:demolition", "demolition_costs"),
    ],
  ]);
  const group = {
    id: bindingGroupId,
    requirementId: "VS-21",
    type: "SHARED_SPAN",
    constraint: "SAME_CANDIDATE_BINDING",
    candidateIds: ["candidate:cleanup", "candidate:demolition"],
  };
  const fact = {
    normalizedValue: "10 %",
    source: {
      candidateId: "candidate:cleanup",
      physicalPageNumber: 3,
      documentStart: fieldStart,
      documentEnd: fieldStart + "10 %".length,
      exactText: "10 %",
    },
  };
  return { candidateById, fact, group };
}

describe("requested-field binding-group contract", () => {
  test("projects one exact field span to a selected sibling component", () => {
    const { candidateById, fact, group } = fixture();
    fact.bindingGroupFieldApplicability = buildBindingGroupFieldApplicability({
      group,
      candidateById,
      sourceCandidateId: "candidate:cleanup",
      fact,
    });

    expect(
      projectedFieldFactAppliesToAtom({
        fact,
        requirementId: "VS-21",
        componentId: "demolition_costs",
        selectedCandidateIds: ["candidate:demolition"],
      })
    ).toBe(true);
  });

  test.each([
    ["different requirement", { requirementId: "VS-22" }],
    ["different component", { componentId: "other_costs" }],
    ["unselected sibling", { selectedCandidateIds: ["candidate:other"] }],
  ])("fails closed for %s", (_label, overrides) => {
    const { candidateById, fact, group } = fixture();
    fact.bindingGroupFieldApplicability = buildBindingGroupFieldApplicability({
      group,
      candidateById,
      sourceCandidateId: "candidate:cleanup",
      fact,
    });
    expect(
      projectedFieldFactAppliesToAtom({
        fact,
        requirementId: "VS-21",
        componentId: "demolition_costs",
        selectedCandidateIds: ["candidate:demolition"],
        ...overrides,
      })
    ).toBe(false);
  });

  test("does not build a projection across pages or outside a shared context", () => {
    const { candidateById, fact, group } = fixture();
    candidateById.get("candidate:demolition").occurrence.physicalPageNumber = 4;
    expect(
      buildBindingGroupFieldApplicability({
        group,
        candidateById,
        sourceCandidateId: "candidate:cleanup",
        fact,
      })
    ).toBeNull();

    candidateById.get("candidate:demolition").occurrence.physicalPageNumber = 3;
    fact.source.documentStart = 9_000;
    fact.source.documentEnd = 9_004;
    expect(
      buildBindingGroupFieldApplicability({
        group,
        candidateById,
        sourceCandidateId: "candidate:cleanup",
        fact,
      })
    ).toBeNull();
  });
});
