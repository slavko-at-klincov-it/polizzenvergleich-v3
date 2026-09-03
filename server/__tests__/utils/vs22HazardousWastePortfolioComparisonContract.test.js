const {
  VS22_HAZARDOUS_WASTE_PORTFOLIO_RULE_ID,
  VS22_REQUIREMENT_CONTRACT_DIGEST,
  buildVs22HazardousWastePortfolioAudit,
  validateVs22HazardousWastePortfolioAudit,
  vs22HazardousWastePortfolioDecision,
} = require("../../utils/policyComparison/vs22HazardousWastePortfolioComparisonContract");

const components = [
  { id: "disposal_costs", factRole: "COST" },
  { id: "hazardous_waste", factRole: "INSURED_OBJECT" },
  { id: "hazardous_waste_cost_limit", factRole: "LIMIT" },
];
const contract = {
  digest: VS22_REQUIREMENT_CONTRACT_DIGEST,
  componentSatisfactionPolicy: "ALL",
  components,
};

function document(uuid, side) {
  return { uuid, side, sha256: uuid.repeat(64).slice(0, 64) };
}

function searchCell({ documentUuid, componentId, found }) {
  return {
    disposition: found
      ? "RELEVANT_FOUND"
      : "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
    comparisonTreatment: found ? null : "DOCUMENTATION_ONLY_V1",
    negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
    absenceMeaning: "COVERAGE_MIXED",
    comparisonPolicy: null,
    absenceCertification: null,
    requirementContract: contract,
    searchPlanId: `vs-occurrence-full-draft-v0.15/VS-22/${componentId}`,
    documentUuid,
    catalogId: "vs-occurrence-full-draft-v0.15",
    physicalPagesChecked: 5,
    totalPhysicalPages: 5,
    aliases: [componentId],
    conceptSearchIds: [],
    gates: {
      negativeSearchApproved: true,
      certifiedNegativeSearch: false,
      completeTextExtraction: true,
      completeCategoryTechnicalContract: true,
      zeroOccurrenceTerminal: !found,
      zeroCandidateTerminal: !found,
      serverNegativeTerminal: !found,
    },
  };
}

function atomFor({ side, documentUuid, component, mode, index }) {
  const found = mode === "INCLUDED" || component.id === "disposal_costs";
  const candidateId = `candidate:${side}:${documentUuid}:${component.id}`;
  const searchAudit = searchCell({
    documentUuid,
    componentId: component.id,
    found,
  });
  const isLimit = component.id === "hazardous_waste_cost_limit";
  const fields = isLimit && mode === "INCLUDED"
    ? [
        {
          field: "limit",
          status: "FOUND",
          facts: [
            {
              normalizedValue: "EUR 7.300",
              valueType: "MONEY",
              unit: "EUR",
              limitKind: "CAPPED",
              source: {
                candidateId,
                physicalPageNumber: 5,
                exactText: "EUR 7.300",
              },
            },
          ],
        },
      ]
    : [{ field: "limit", status: "NOT_FOUND", facts: [] }];
  return {
    requirementId: "VS-22",
    componentId: component.id,
    componentLabel: component.id,
    factRole: component.factRole,
    documentUuids: [documentUuid],
    documentRole: index === 0 ? "MAIN_POLICY" : "SUPPLEMENT",
    documentStatus: index === 0 ? "PROPOSAL" : "FRAMEWORK_TERMS",
    evidencePresence: found ? "FOUND" : "NOT_FOUND",
    coverageEffect: found
      ? isLimit
        ? "DEFINED"
        : "INCLUDED"
      : "UNKNOWN",
    conflictState: "NONE",
    selectedScopePicture: found ? "GENERAL" : "UNKNOWN",
    scopePolicy: "GENERAL_REQUIRED",
    documentApplicability: found
      ? index === 0
        ? "PROPOSED_ONLY"
        : "CONDITIONAL"
      : "UNKNOWN",
    selectedCandidateIds: found ? [candidateId] : [],
    unresolvedCandidateIds: [],
    requestedFieldStatus:
      isLimit && mode === "INCLUDED" ? "COMPLETE" : "NOT_FOUND",
    requestedFields: ["limit"],
    optionalFields: [],
    fields,
    sources: found
      ? [
          {
            candidateId,
            physicalPageNumber: 5,
            exactText:
              component.id === "disposal_costs"
                ? "Entsorgungskosten sind mitversichert"
                : component.id === "hazardous_waste"
                  ? "Gefährlicher Abfall ist mitversichert"
                  : "Sondermüll bis EUR 7.300",
          },
        ]
      : [],
    componentSatisfactionPolicy: "ALL",
    coverageAggregationPolicy: "ALL_COMPONENT_EFFECTS",
    requirementContractDigest: contract.digest,
    declaredComponents: components,
    searchAudit,
  };
}

function packageFixture(side, mode, documentCount) {
  const documents = Array.from({ length: documentCount }, (_, index) =>
    document(`${side.toLowerCase()}${index + 1}`, side)
  );
  const atoms = documents.flatMap(({ uuid }, index) =>
    components.map((component) =>
      atomFor({ side, documentUuid: uuid, component, mode, index })
    )
  );
  const searchComponents = atoms.map(({ searchAudit }) => searchAudit);
  const summary = {
    evidenceFound: true,
    coverage: mode === "INCLUDED" ? "Ja" : "Nicht feststellbar",
    reviewStatus: mode === "INCLUDED" ? "BELEGT" : "TEILBELEGT",
    searchDisposition: "RELEVANT_FOUND",
    comparisonTreatment: null,
    requirementContract: contract,
    facts: documents.map(({ uuid }) => ({
      documentUuid: uuid,
      coverage: mode === "INCLUDED" ? "Ja" : "Nicht feststellbar",
      reviewStatus: mode === "INCLUDED" ? "BELEGT" : "TEILBELEGT",
    })),
    searchAudit: {
      disposition: "SEARCH_INCOMPLETE",
      comparisonTreatment: null,
      documentCount: documents.length,
      documentUuids: documents.map(({ uuid }) => uuid).sort(),
      physicalPagesChecked: documents.length * 5,
      searchPlanIds: components
        .map(
          ({ id }) => `vs-occurrence-full-draft-v0.15/VS-22/${id}`
        )
        .sort(),
      requirementContract: contract,
      components: searchComponents,
    },
  };
  return { documents, atoms, summary };
}

function fixture(reverse = false) {
  const included = packageFixture(reverse ? "B" : "A", "INCLUDED", 1);
  const absent = packageFixture(reverse ? "A" : "B", "ABSENT", 2);
  return {
    categoryId: "VS-22",
    packageA: reverse ? absent.summary : included.summary,
    packageB: reverse ? included.summary : absent.summary,
    atomsA: reverse ? absent.atoms : included.atoms,
    atomsB: reverse ? included.atoms : absent.atoms,
    requirementContractA: contract,
    requirementContractB: contract,
    expectedDocumentsA: reverse ? absent.documents : included.documents,
    expectedDocumentsB: reverse ? included.documents : absent.documents,
  };
}

describe("VS-22 hazardous-waste portfolio comparison contract", () => {
  test.each([
    [false, "A", "VORTEIL_A"],
    [true, "B", "VORTEIL_B"],
  ])("certifies the complete direction (reverse=%s)", (reverse, winner, outcome) => {
    const input = fixture(reverse);
    const audit = buildVs22HazardousWastePortfolioAudit(input);

    expect(audit).toMatchObject({
      schemaVersion: 1,
      contractId: "VS22_HAZARDOUS_WASTE_PORTFOLIO_AUDIT_V1",
      categoryId: "VS-22",
      winner,
      missingComponentIds: [
        "hazardous_waste",
        "hazardous_waste_cost_limit",
      ],
      assessmentDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(vs22HazardousWastePortfolioDecision(audit)).toMatchObject({
      outcome,
      ruleId: VS22_HAZARDOUS_WASTE_PORTFOLIO_RULE_ID,
      reviewRequired: false,
    });
    expect(() =>
      validateVs22HazardousWastePortfolioAudit(audit, {
        categoryId: input.categoryId,
        packageA: input.packageA,
        packageB: input.packageB,
        requirementContractA: contract,
        requirementContractB: contract,
        expectedDocumentsA: input.expectedDocumentsA,
        expectedDocumentsB: input.expectedDocumentsB,
      })
    ).not.toThrow();
  });

  test.each([
    ["missing search cell", (input) => input.atomsB.pop()],
    [
      "missing hazardous limit",
      (input) => {
        const atom = input.atomsA.find(
          ({ componentId }) => componentId === "hazardous_waste_cost_limit"
        );
        atom.evidencePresence = "NOT_FOUND";
        atom.coverageEffect = "UNKNOWN";
      },
    ],
    [
      "general disposal limit used as special limit",
      (input) => {
        const atom = input.atomsA.find(
          ({ componentId }) => componentId === "hazardous_waste_cost_limit"
        );
        atom.componentId = "disposal_costs";
      },
    ],
    [
      "conflicting disposal contributor",
      (input) => {
        input.atomsB.find(({ componentId }) => componentId === "disposal_costs").conflictState =
          "CONFLICT";
      },
    ],
    [
      "unresolved disposal contributor",
      (input) => {
        input.atomsB.find(({ componentId }) => componentId === "disposal_costs").unresolvedCandidateIds =
          ["candidate:unresolved"];
      },
    ],
    [
      "incomplete manifest",
      (input) => {
        input.expectedDocumentsB.pop();
      },
    ],
  ])("fails closed for %s", (_label, mutate) => {
    const input = fixture();
    mutate(input);
    expect(buildVs22HazardousWastePortfolioAudit(input)).toBeNull();
  });
});
