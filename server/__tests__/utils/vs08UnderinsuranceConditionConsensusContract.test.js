const crypto = require("crypto");
const {
  VS08_CONDITION_CONSENSUS_RULE_ID,
  VS08_REQUIREMENT_CONTRACT_DIGEST,
  buildVs08ConditionConsensusAudit,
  validateVs08ConditionConsensusAudit,
  vs08ConditionConsensusDecision,
} = require("../../utils/policyComparison/vs08UnderinsuranceConditionConsensusContract");
const { decidePoint } = require("../../utils/policyComparison/pointDecision");
const {
  requirementSearchContractDigest,
} = require("../../utils/policyAnalysis/coverageOnlyCertificationContract");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  PRODUCT_PROFILE,
} = require("../../utils/policyComparison/productContract");
const fullVsCatalog = require("../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");

const CATALOG_ID = "vs-occurrence-full-draft-v0.16";
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

function currentWorksheetRequirement() {
  const text =
    "Der Unterversicherungsverzicht gilt unter den vereinbarten Bedingungen.";
  const fingerprint = crypto.createHash("sha256").update(text).digest("hex");
  const worksheet = buildControlledOccurrenceWorksheet({
    documentFingerprint: fingerprint,
    catalog: {
      ...fullVsCatalog,
      requirements: fullVsCatalog.requirements.filter(
        ({ id }) => id === CATEGORY_ID
      ),
    },
    document: {
      sourceDocumentId: fingerprint,
      title: "vs08-workbook-contract.pdf",
      pageContent: text,
      pageMap: [{ pageNumber: 1, start: 0, end: text.length }],
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
        complete: true,
      },
    },
  });
  return {
    catalogId: worksheet.catalog.id,
    requirement: worksheet.requirements[0],
  };
}

function replaceRequirementDigest(input, digest) {
  for (const side of ["A", "B"]) {
    const packageSummary = input[`package${side}`];
    packageSummary.searchAudit.requirementContract.digest = digest;
    for (const cell of packageSummary.searchAudit.components)
      cell.requirementContract.digest = digest;
    for (const atom of input[`atoms${side}`]) {
      atom.requirementContractDigest = digest;
      atom.searchAudit.requirementContract.digest = digest;
    }
  }
}

function replaceDeclaredComponents(input, components) {
  for (const side of ["A", "B"]) {
    const packageSummary = input[`package${side}`];
    packageSummary.searchAudit.requirementContract.components =
      clone(components);
    for (const cell of packageSummary.searchAudit.components)
      cell.requirementContract.components = clone(components);
    for (const atom of input[`atoms${side}`]) {
      atom.declaredComponents = clone(components);
      atom.searchAudit.requirementContract.components = clone(components);
    }
  }
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
  test("binds the production trust anchor to the current validated worksheet requirement", () => {
    const { catalogId, requirement } = currentWorksheetRequirement();
    expect(catalogId).toBe(CATALOG_ID);
    expect(
      requirementSearchContractDigest({
        catalogId,
        requirement,
      })
    ).toBe(VS08_REQUIREMENT_CONTRACT_DIGEST);
    expect(PRODUCT_PROFILE.trustAnchors).toMatchObject({
      vs08ValidatedWorksheetRequirementV1:
        VS08_REQUIREMENT_CONTRACT_DIGEST,
    });
  });

  test("rejects the stale raw-catalog digest even when every persisted copy agrees", () => {
    const rawRequirement = fullVsCatalog.requirements.find(
      ({ id }) => id === CATEGORY_ID
    );
    const staleDigest = requirementSearchContractDigest({
      catalogId: fullVsCatalog.catalogId,
      requirement: rawRequirement,
    });
    const input = fixture();
    expect(staleDigest).not.toBe(VS08_REQUIREMENT_CONTRACT_DIGEST);

    replaceRequirementDigest(input, staleDigest);

    expect(buildVs08ConditionConsensusAudit(input)).toBeNull();
    expect(decidePoint(input)).toMatchObject({
      outcome: "UNKLAR",
      reviewRequired: true,
    });
  });

  test("rejects an adversarial contract shape despite a copied trusted digest", () => {
    const input = fixture();
    replaceDeclaredComponents(input, [
      { id: COMPONENT_ID, factRole: "BENEFIT" },
    ]);

    expect(buildVs08ConditionConsensusAudit(input)).toBeNull();
    expect(decidePoint(input)).toMatchObject({
      outcome: "UNKLAR",
      reviewRequired: true,
    });
  });

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

  test("keeps the accepted VS-08 target outcome equivalent after an A/B swap", () => {
    const input = fixture();
    const swapped = {
      ...input,
      packageA: input.packageB,
      packageB: input.packageA,
      atomsA: input.atomsB,
      atomsB: input.atomsA,
      expectedDocumentsA: input.expectedDocumentsB.map((item) => ({
        ...item,
        side: "A",
      })),
      expectedDocumentsB: input.expectedDocumentsA.map((item) => ({
        ...item,
        side: "B",
      })),
    };
    expect(decidePoint(swapped)).toMatchObject({
      outcome: "GLEICHWERTIG",
      reviewRequired: false,
      ruleId: VS08_CONDITION_CONSENSUS_RULE_ID,
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
