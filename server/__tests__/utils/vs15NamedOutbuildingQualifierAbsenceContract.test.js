const {
  VS15_QUALIFIER_ABSENCE_AUDIT_CONTRACT_ID,
  VS15_QUALIFIER_ABSENCE_REASON_CODE,
  VS15_QUALIFIER_ABSENCE_RULE_ID,
  VS15_REQUIREMENT_CONTRACT_DIGEST,
  buildVs15QualifierAbsenceAudit,
  validateVs15QualifierAbsenceAudit,
  vs15QualifierAbsenceDecision,
} = require("../../utils/policyComparison/vs15NamedOutbuildingQualifierAbsenceContract");
const { decidePoint } = require("../../utils/policyComparison/pointDecision");
const {
  deriveCustomerMetrics,
  validateCustomerComparison,
} = require("../../utils/policyComparison/customerMetricContract");
const {
  PRODUCT_PROFILE,
} = require("../../utils/policyComparison/productContract");
const {
  requirementSearchContractDigest,
} = require("../../utils/policyAnalysis/coverageOnlyCertificationContract");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const fullVsCatalog = require("../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");

const CATALOG_ID = "vs-occurrence-full-draft-v0.14";
const CATEGORY_ID = "VS-15";
const COVER_COMPONENT_ID = "outbuilding_cover";
const QUALIFIER_COMPONENT_ID = "named_outbuilding_designation";
const COMPONENTS = [
  { id: COVER_COMPONENT_ID, factRole: "INSURED_OBJECT" },
  { id: QUALIFIER_COMPONENT_ID, factRole: "DEFINITION" },
];
const ALIASES = {
  [COVER_COMPONENT_ID]: ["Nebengebäude", "Nebengebäuden"],
  [QUALIFIER_COMPONENT_ID]: [
    "namentlich angeführtes Nebengebäude",
    "namentlich angeführte Nebengebäude",
    "Nebengebäude namentlich in der Polizze angeführt",
  ],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requirementContract() {
  return {
    digest: VS15_REQUIREMENT_CONTRACT_DIGEST,
    componentSatisfactionPolicy: "ALL",
    components: clone(COMPONENTS),
  };
}

function document(side, suffix) {
  return {
    uuid: `${side.toLowerCase()}-document-${suffix}`,
    side,
    sha256: (side === "A" ? "a" : "b").repeat(63) + String(suffix),
  };
}

function searchCell({ documentUuid, componentId, found = false, pages = 3 }) {
  const contract = requirementContract();
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
    searchPlanId: `${CATALOG_ID}/${CATEGORY_ID}/${componentId}`,
    documentUuid,
    catalogId: CATALOG_ID,
    physicalPagesChecked: pages,
    totalPhysicalPages: pages,
    aliases: clone(ALIASES[componentId]),
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

function atom({ documentUuid, componentId, found = false, pages = 3 }) {
  const cell = searchCell({ documentUuid, componentId, found, pages });
  const candidateId = `candidate:${documentUuid}`;
  return {
    requirementId: CATEGORY_ID,
    componentId,
    componentLabel:
      componentId === COVER_COMPONENT_ID
        ? "Nebengebäude allgemein"
        : "Namentliche Anführung in der Polizze",
    factRole:
      componentId === COVER_COMPONENT_ID ? "INSURED_OBJECT" : "DEFINITION",
    documentUuids: [documentUuid],
    documentRole: "MAIN_POLICY",
    documentStatus: "ACTIVE",
    evidencePresence: found ? "FOUND" : "NOT_FOUND",
    coverageEffect: found ? "INCLUDED" : "UNKNOWN",
    conflictState: "NONE",
    selectedScopePicture: found ? "GENERAL" : "UNKNOWN",
    scopePolicy: "GENERAL_REQUIRED",
    documentApplicability: found ? "ACTIVE" : "UNKNOWN",
    selectedCandidateIds: found ? [candidateId] : [],
    unresolvedCandidateIds: [],
    requestedFieldStatus: "NOT_REQUIRED",
    requestedFields: [],
    optionalFields: ["limit"],
    fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
    sources: found
      ? [
          {
            candidateId,
            physicalPageNumber: 2,
            exactText: "Versicherungsschutz für Nebengebäude",
          },
        ]
      : [],
    componentSatisfactionPolicy: "ALL",
    coverageAggregationPolicy: "ALL_COMPONENT_EFFECTS",
    requirementContractDigest: VS15_REQUIREMENT_CONTRACT_DIGEST,
    declaredComponents: clone(COMPONENTS),
    searchAudit: cell,
  };
}

function sideFixture(side, documentCount) {
  const documents = Array.from({ length: documentCount }, (_value, index) =>
    document(side, index + 1)
  );
  const atoms = documents.flatMap(({ uuid }, index) => [
    atom({
      documentUuid: uuid,
      componentId: COVER_COMPONENT_ID,
      found: index === 0,
      pages: index + 2,
    }),
    atom({
      documentUuid: uuid,
      componentId: QUALIFIER_COMPONENT_ID,
      pages: index + 2,
    }),
  ]);
  const components = atoms.map(({ searchAudit }) => clone(searchAudit));
  const physicalPagesChecked = documents.reduce(
    (sum, _document, index) => sum + index + 2,
    0
  );
  const packageSummary = {
    evidenceFound: true,
    documentedContent:
      "Nebengebäude allgemein: eingeschlossen; Namentliche Anführung: nicht feststellbar",
    coverage: "Nicht feststellbar",
    coverageAmount: "Nicht feststellbar",
    source: "PDF-Seite 2",
    reviewStatus: "TEILBELEGT",
    searchDisposition: "RELEVANT_FOUND",
    comparisonTreatment: null,
    facts: [
      {
        documentUuid: documents[0].uuid,
        coverage: "Nicht feststellbar",
        coverageAmount: "Nicht feststellbar",
        reviewStatus: "TEILBELEGT",
      },
    ],
    searchAudit: {
      disposition: "SEARCH_INCOMPLETE",
      comparisonTreatment: null,
      documentCount: documents.length,
      documentUuids: documents.map(({ uuid }) => uuid).sort(),
      physicalPagesChecked,
      searchPlanIds: [
        `${CATALOG_ID}/${CATEGORY_ID}/${QUALIFIER_COMPONENT_ID}`,
        `${CATALOG_ID}/${CATEGORY_ID}/${COVER_COMPONENT_ID}`,
      ],
      requirementContract: requirementContract(),
      components,
    },
  };
  return { documents, atoms, packageSummary };
}

function fixture() {
  const sideA = sideFixture("A", 1);
  const sideB = sideFixture("B", 3);
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

describe("VS-15 bilateral controlled qualifier absence contract", () => {
  test("binds the production contract to the current catalog requirement", () => {
    const text = "Nebengebäude";
    const worksheet = buildControlledOccurrenceWorksheet({
      documentFingerprint: "a".repeat(64),
      catalog: {
        ...fullVsCatalog,
        requirements: fullVsCatalog.requirements.filter(
          ({ id }) => id === CATEGORY_ID
        ),
      },
      document: {
        sourceDocumentId: "a".repeat(64),
        title: "vs15-contract-fixture.pdf",
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
    const requirement = worksheet.requirements[0];

    expect(worksheet.catalog.id).toBe(CATALOG_ID);
    expect(
      requirementSearchContractDigest({
        catalogId: worksheet.catalog.id,
        requirement,
      })
    ).toBe(VS15_REQUIREMENT_CONTRACT_DIGEST);
  });

  test("binds complete package searches and returns equality without inventing an exclusion", () => {
    const input = fixture();
    const audit = buildVs15QualifierAbsenceAudit(input);

    expect(audit).toMatchObject({
      schemaVersion: 1,
      contractId: VS15_QUALIFIER_ABSENCE_AUDIT_CONTRACT_ID,
      categoryId: CATEGORY_ID,
      qualifierComponentId: QUALIFIER_COMPONENT_ID,
      coverComponentId: COVER_COMPONENT_ID,
      sides: [
        {
          side: "A",
          foundCoverAtomCount: 1,
          qualifierControlledZeroCount: 1,
        },
        {
          side: "B",
          foundCoverAtomCount: 1,
          qualifierControlledZeroCount: 3,
        },
      ],
    });
    expect(
      validateVs15QualifierAbsenceAudit(audit, {
        categoryId: CATEGORY_ID,
        packageA: input.packageA,
        packageB: input.packageB,
        expectedDocumentsA: input.expectedDocumentsA,
        expectedDocumentsB: input.expectedDocumentsB,
      })
    ).toBe(true);
    expect(vs15QualifierAbsenceDecision(audit)).toMatchObject({
      schemaVersion: 7,
      outcome: "GLEICHWERTIG",
      reasonCode: VS15_QUALIFIER_ABSENCE_REASON_CODE,
      reviewRequired: false,
      ruleId: VS15_QUALIFIER_ABSENCE_RULE_ID,
    });
    expect(vs15QualifierAbsenceDecision(audit).reason).toContain(
      "nicht als ausdrücklicher Ausschluss"
    );
  });

  test("consumes only the qualified VS-15 package-review blocker", () => {
    const input = fixture();
    expect(decidePoint(input)).toMatchObject({
      schemaVersion: 7,
      outcome: "GLEICHWERTIG",
      reasonCode: VS15_QUALIFIER_ABSENCE_REASON_CODE,
      ruleId: VS15_QUALIFIER_ABSENCE_RULE_ID,
      reviewRequired: false,
      comparisonTreatment:
        "EQUAL_VS15_CONTROLLED_NAMED_OUTBUILDING_QUALIFIER_ABSENCE_BOTH_V1",
      vs15QualifierAbsenceAudit: {
        contractId: VS15_QUALIFIER_ABSENCE_AUDIT_CONTRACT_ID,
      },
    });

    const blocked = fixture();
    blocked.expectedDocumentsB.pop();
    expect(decidePoint(blocked)).toMatchObject({
      outcome: "UNKLAR",
      reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
      reviewRequired: true,
    });
  });

  test("revalidates the exact VS-15 decision before customer delivery", () => {
    const input = fixture();
    const pointDecision = decidePoint(input);
    const categories = [
      {
        categoryView: "VS",
        rows: [
          {
            categoryId: CATEGORY_ID,
            outcome: "UNTERSCHIED_FACHLICH_PRÜFEN",
            packageA: input.packageA,
            packageB: input.packageB,
            pointDecision,
          },
        ],
      },
    ];
    const result = {
      schemaVersion: 11,
      status: "COMPARISON_RESULT_MATERIALIZED",
      productProfile: PRODUCT_PROFILE,
      documents: [...input.expectedDocumentsA, ...input.expectedDocumentsB],
      categories,
      totals: deriveCustomerMetrics(categories),
    };

    expect(validateCustomerComparison(result)).toMatchObject({
      rows: 1,
      customerReviewRequired: 0,
      pointDecisions: { GLEICHWERTIG: 1 },
    });

    for (const mutate of [
      (tampered) =>
        (tampered.categories[0].rows[0].pointDecision.reason = "Gleichwertig."),
      (tampered) =>
        (tampered.categories[0].rows[0].pointDecision.vs15QualifierAbsenceAudit.sides[0].qualifierControlledZeroCount += 1),
      (tampered) => (tampered.documents[0].sha256 = "f".repeat(64)),
      (tampered) =>
        (tampered.categories[0].rows[0].pointDecision.ruleId =
          "ATOMIC_COVERAGE_EQUALITY_V1"),
    ]) {
      const tampered = clone(result);
      mutate(tampered);
      expect(() => validateCustomerComparison(tampered)).toThrow(
        /^COMPARISON_VS15_QUALIFIER_/u
      );
    }
  });

  test.each([
    ["wrong category", (input) => (input.categoryId = "VS-16")],
    [
      "ANY component policy",
      (input) => {
        input.packageA.searchAudit.requirementContract.componentSatisfactionPolicy =
          "ANY";
      },
    ],
    [
      "catalog contract digest drift",
      (input) => {
        input.packageA.searchAudit.requirementContract.digest = "0".repeat(64);
      },
    ],
    [
      "missing expected package document",
      (input) => input.expectedDocumentsB.pop(),
    ],
    [
      "duplicated expected document UUID",
      (input) => {
        input.expectedDocumentsB[1].uuid = input.expectedDocumentsB[0].uuid;
      },
    ],
    [
      "wrong manifest side",
      (input) => (input.expectedDocumentsB[0].side = "A"),
    ],
    [
      "invalid manifest digest",
      (input) => (input.expectedDocumentsB[0].sha256 = "not-a-digest"),
    ],
    [
      "missing qualifier search cell",
      (input) => {
        input.packageB.searchAudit.components.pop();
      },
    ],
    [
      "tampered qualifier aliases",
      (input) => {
        const cell = input.packageB.searchAudit.components.find(
          ({ searchPlanId }) =>
            searchPlanId.endsWith(`/${QUALIFIER_COMPONENT_ID}`)
        );
        cell.aliases.push("Nebengebäude");
      },
    ],
    [
      "incomplete qualifier extraction",
      (input) => {
        const cell = input.packageB.searchAudit.components.find(
          ({ searchPlanId }) =>
            searchPlanId.endsWith(`/${QUALIFIER_COMPONENT_ID}`)
        );
        cell.gates.completeTextExtraction = false;
      },
    ],
    [
      "non-terminal qualifier zero",
      (input) => {
        const atom = input.atomsB.find(
          ({ componentId }) => componentId === QUALIFIER_COMPONENT_ID
        );
        atom.searchAudit.gates.zeroCandidateTerminal = false;
        const cell = input.packageB.searchAudit.components.find(
          ({ documentUuid, searchPlanId }) =>
            documentUuid === atom.documentUuids[0] &&
            searchPlanId.endsWith(`/${QUALIFIER_COMPONENT_ID}`)
        );
        cell.gates.zeroCandidateTerminal = false;
      },
    ],
    [
      "named designation found on one side",
      (input) => {
        const named = input.atomsA.find(
          ({ componentId }) => componentId === QUALIFIER_COMPONENT_ID
        );
        named.evidencePresence = "FOUND";
        named.coverageEffect = "DEFINED";
      },
    ],
    [
      "base cover excluded",
      (input) => {
        input.atomsA.find(
          ({ componentId }) => componentId === COVER_COMPONENT_ID
        ).coverageEffect = "EXCLUDED";
      },
    ],
    [
      "missing aggregation policy",
      (input) => {
        input.atomsA[0].coverageAggregationPolicy = null;
      },
    ],
    [
      "base cover unresolved",
      (input) => {
        input.atomsA.find(
          ({ componentId }) => componentId === COVER_COMPONENT_ID
        ).unresolvedCandidateIds = ["candidate:unresolved"];
      },
    ],
    [
      "base cover candidate source mismatch",
      (input) => {
        input.atomsA.find(
          ({ componentId }) => componentId === COVER_COMPONENT_ID
        ).sources[0].candidateId = "candidate:other";
      },
    ],
    [
      "narrow base scope",
      (input) => {
        input.atomsA.find(
          ({ componentId }) => componentId === COVER_COMPONENT_ID
        ).selectedScopePicture = "NARROW_ONLY";
      },
    ],
    [
      "package page count drift",
      (input) => {
        input.packageB.searchAudit.physicalPagesChecked += 1;
      },
    ],
    [
      "atom/package search cell mismatch",
      (input) => {
        input.atomsB[0].searchAudit.totalPhysicalPages += 1;
      },
    ],
    [
      "unbound extra search gate",
      (input) => {
        const cell = input.packageA.searchAudit.components[0];
        cell.gates.deterministicOutOfCategoryTerminal = true;
      },
    ],
  ])("fails closed for %s", (_label, mutate) => {
    const input = fixture();
    mutate(input);
    expect(buildVs15QualifierAbsenceAudit(input)).toBeNull();
  });

  test("rejects persisted audit tampering during reconstruction", () => {
    const input = fixture();
    const audit = buildVs15QualifierAbsenceAudit(input);
    const tampered = clone(audit);
    tampered.sides[1].projectedAtoms[0].documentStatus = "PROPOSAL";

    expect(() =>
      validateVs15QualifierAbsenceAudit(tampered, {
        categoryId: CATEGORY_ID,
        packageA: input.packageA,
        packageB: input.packageB,
        expectedDocumentsA: input.expectedDocumentsA,
        expectedDocumentsB: input.expectedDocumentsB,
      })
    ).toThrow("VS15_QUALIFIER_ABSENCE_AUDIT_MISMATCH");
  });

  test("does not turn an arbitrary object into a customer decision", () => {
    expect(vs15QualifierAbsenceDecision({ contractId: "wrong" })).toBeNull();
  });
});
