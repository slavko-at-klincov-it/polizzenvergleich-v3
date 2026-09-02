const {
  VS15_QUALIFIER_ABSENCE_AUDIT_CONTRACT_ID,
  VS15_QUALIFIER_ABSENCE_REASON_CODE,
  VS15_QUALIFIER_ABSENCE_RULE_ID,
  VS15_REQUIREMENT_CONTRACT_DIGEST,
  buildVs15QualifierAbsenceAudit,
  validateVs15QualifierAbsenceAudit,
  vs15QualifierAbsenceDecision,
} = require("../../utils/policyComparison/vs15NamedOutbuildingQualifierAbsenceContract");

const CATALOG_ID = "vs-occurrence-full-draft-v0.9";
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
    coverageAggregationPolicy: null,
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
