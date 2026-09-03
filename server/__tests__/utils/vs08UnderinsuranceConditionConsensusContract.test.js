const {
  VS08_CONDITION_CONSENSUS_RULE_ID,
  VS08_REQUIREMENT_CONTRACT_DIGEST,
  buildVs08ConditionConsensusAudit,
  validateVs08ConditionConsensusAudit,
  vs08ConditionConsensusDecision,
} = require("../../utils/policyComparison/vs08UnderinsuranceConditionConsensusContract");
const { decidePoint } = require("../../utils/policyComparison/pointDecision");

const CATALOG_ID = "vs-occurrence-full-draft-v0.15";
const CATEGORY_ID = "VS-08";
const COMPONENT_ID = "underinsurance_waiver_condition";
const COMPONENTS = [{ id: COMPONENT_ID, factRole: "CONDITION" }];
const ALIASES = [
  "Unterversicherungsverzicht gilt",
  "Unterversicherungsverzicht besteht",
  "Einwand der Unterversicherung verzichtet",
  "für die Dauer von ca. 3 Jahren",
  "im Schadenfall nur Anwendung, wenn",
  "bezieht sich der Verzicht auf den Einwand der Unterversicherung nur",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requirementContract() {
  return {
    digest: VS08_REQUIREMENT_CONTRACT_DIGEST,
    componentSatisfactionPolicy: "ALL",
    components: clone(COMPONENTS),
  };
}

function document(side, index) {
  return {
    uuid: `${side.toLowerCase()}-document-${index}`,
    side,
    sha256: `${side === "A" ? "a" : "b"}`.repeat(63) + index,
  };
}

function searchCell(documentUuid, found, pages) {
  return {
    disposition: found
      ? "RELEVANT_FOUND"
      : "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
    comparisonTreatment: found ? null : "DOCUMENTATION_ONLY_V1",
    negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
    absenceMeaning: "CONDITION_ONLY",
    comparisonPolicy: null,
    absenceCertification: null,
    requirementContract: requirementContract(),
    searchPlanId: `${CATALOG_ID}/${CATEGORY_ID}/${COMPONENT_ID}`,
    documentUuid,
    catalogId: CATALOG_ID,
    physicalPagesChecked: pages,
    totalPhysicalPages: pages,
    aliases: clone(ALIASES),
    conceptSearchIds: ["underinsurance-waiver-deviation-condition"],
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

function atom({ documentUuid, found, pages, conditionText }) {
  const candidateId = `candidate:${documentUuid}`;
  const cell = searchCell(documentUuid, found, pages);
  return {
    requirementId: CATEGORY_ID,
    componentId: COMPONENT_ID,
    componentLabel: "Bedingung des Unterversicherungsverzichts",
    factRole: "CONDITION",
    documentUuids: [documentUuid],
    documentRole: "MAIN_POLICY",
    documentStatus: "ACTIVE",
    evidencePresence: found ? "FOUND" : "NOT_FOUND",
    coverageEffect: found ? "CONDITIONAL" : "UNKNOWN",
    conflictState: "NONE",
    selectedScopePicture: found ? "GENERAL" : "UNKNOWN",
    scopePolicy: "GENERAL_REQUIRED",
    documentApplicability: found ? "ACTIVE" : "UNKNOWN",
    selectedCandidateIds: found ? [candidateId] : [],
    unresolvedCandidateIds: [],
    requestedFieldStatus: found ? "COMPLETE" : "NOT_FOUND",
    requestedFields: ["condition"],
    optionalFields: [],
    fields: [
      {
        field: "condition",
        status: found ? "FOUND" : "NOT_FOUND",
        facts: found
          ? [
              {
                rawValue: "bedingt",
                normalizedValue: "bedingt",
                valueType: "TEXT",
                unit: null,
                binding: "DIRECT",
                source: {
                  candidateId,
                  physicalPageNumber: 2,
                  documentStart: 10,
                  documentEnd: 17,
                  exactText: "bedingt",
                },
              },
            ]
          : [],
      },
    ],
    sources: found
      ? [
          {
            candidateId,
            physicalPageNumber: 2,
            exactText: "Unterversicherungsverzicht",
            conditionCheckText:
              conditionText ||
              "Der Versicherer verzichtet unter den genannten Bedingungen auf den Einwand der Unterversicherung.",
          },
        ]
      : [],
    componentSatisfactionPolicy: "ALL",
    coverageAggregationPolicy: "ALL_COMPONENT_EFFECTS",
    requirementContractDigest: VS08_REQUIREMENT_CONTRACT_DIGEST,
    declaredComponents: clone(COMPONENTS),
    searchAudit: cell,
  };
}

function sideFixture(side, count, foundIndexes = [0]) {
  const documents = Array.from({ length: count }, (_value, index) =>
    document(side, index + 1)
  );
  const atoms = documents.map(({ uuid }, index) =>
    atom({
      documentUuid: uuid,
      found: foundIndexes.includes(index),
      pages: index + 2,
      conditionText:
        index === 1
          ? "Der Versicherer verzichtet auf den Einwand einer Unterversicherung, soweit die Versicherungssumme um nicht mehr als 25 % vom Versicherungswert abweicht."
          : undefined,
    })
  );
  const physicalPagesChecked = atoms.reduce(
    (sum, item) => sum + item.searchAudit.physicalPagesChecked,
    0
  );
  return {
    documents,
    atoms,
    packageSummary: {
      evidenceFound: true,
      coverage: "Ja",
      coverageAmount: "Nicht feststellbar",
      reviewStatus: "BELEGT",
      searchDisposition: "RELEVANT_FOUND",
      comparisonTreatment: null,
      searchAudit: {
        disposition: "SEARCH_INCOMPLETE",
        comparisonTreatment: null,
        documentCount: documents.length,
        documentUuids: documents.map(({ uuid }) => uuid).sort(),
        physicalPagesChecked,
        searchPlanIds: [`${CATALOG_ID}/${CATEGORY_ID}/${COMPONENT_ID}`],
        requirementContract: requirementContract(),
        components: atoms.map(({ searchAudit }) => clone(searchAudit)),
      },
    },
  };
}

function fixture() {
  const sideA = sideFixture("A", 1);
  const sideB = sideFixture("B", 3, [0, 1]);
  return {
    categoryId: CATEGORY_ID,
    packageA: sideA.packageSummary,
    packageB: sideB.packageSummary,
    atomsA: sideA.atoms,
    atomsB: sideB.atoms,
    expectedDocumentsA: sideA.documents,
    expectedDocumentsB: sideB.documents,
  };
}

describe("VS-08 package condition consensus contract", () => {
  test("resolves multiple condition sources when every source says bedingt", () => {
    const input = fixture();
    const audit = buildVs08ConditionConsensusAudit(input);

    expect(audit).toMatchObject({
      categoryId: CATEGORY_ID,
      conditionValues: ["bedingt"],
      sides: [
        { side: "A", foundAtomCount: 1, controlledZeroCount: 0 },
        { side: "B", foundAtomCount: 2, controlledZeroCount: 1 },
      ],
    });
    expect(vs08ConditionConsensusDecision(audit)).toMatchObject({
      outcome: "GLEICHWERTIG",
      reviewRequired: false,
      ruleId: VS08_CONDITION_CONSENSUS_RULE_ID,
    });
  });

  test("integrates before the generic multi-document rank blocker", () => {
    expect(decidePoint(fixture())).toMatchObject({
      outcome: "GLEICHWERTIG",
      reasonCode: "EQUAL_VS08_PACKAGE_CONDITION_CONSENSUS",
      reviewRequired: false,
      ruleId: VS08_CONDITION_CONSENSUS_RULE_ID,
      vs08ConditionConsensusAudit: expect.objectContaining({
        conditionValues: ["bedingt"],
      }),
    });
  });

  test("reconstructs the immutable audit and rejects tampering", () => {
    const input = fixture();
    const audit = buildVs08ConditionConsensusAudit(input);

    expect(validateVs08ConditionConsensusAudit(audit, input)).toBe(true);
    audit.sides[1].controlledZeroCount += 1;
    expect(() => validateVs08ConditionConsensusAudit(audit, input)).toThrow(
      "VS08_CONDITION_CONSENSUS_AUDIT_MISMATCH"
    );
  });

  test.each([
    ["wrong category", (input) => (input.categoryId = "VS-09")],
    [
      "old requirement digest",
      (input) => {
        input.atomsB[0].requirementContractDigest = "0".repeat(64);
      },
    ],
    ["missing document inventory", (input) => input.expectedDocumentsB.pop()],
    [
      "unresolved candidate",
      (input) => input.atomsB[0].unresolvedCandidateIds.push("candidate:open"),
    ],
    [
      "mixed unconditional effect",
      (input) => (input.atomsB[0].coverageEffect = "INCLUDED"),
    ],
    [
      "different condition value",
      (input) =>
        (input.atomsB[0].fields[0].facts[0].normalizedValue = "unbedingt"),
    ],
    [
      "negated source",
      (input) =>
        (input.atomsB[0].sources[0].conditionCheckText =
          "Der Verzicht gilt nicht bei Unterversicherung."),
    ],
    [
      "incomplete page audit",
      (input) => (input.atomsB[2].searchAudit.totalPhysicalPages += 1),
    ],
  ])("fails closed for %s", (_label, mutate) => {
    const input = fixture();
    mutate(input);
    expect(buildVs08ConditionConsensusAudit(input)).toBeNull();
  });

  test("keeps source contributors and document roles in the immutable audit", () => {
    const input = fixture();
    input.atomsB[1].documentRole = "SUPPLEMENT";
    const audit = buildVs08ConditionConsensusAudit(input);

    expect(audit.sides[1].projectedAtoms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentRole: "SUPPLEMENT",
          coverageEffect: "CONDITIONAL",
          sources: expect.arrayContaining([
            expect.objectContaining({
              conditionCheckText: expect.stringContaining("25 %"),
            }),
          ]),
        }),
      ])
    );
  });
});
