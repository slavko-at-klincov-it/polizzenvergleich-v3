const {
  POINT_OUTCOME,
  decidePoint,
} = require("../../utils/policyComparison/pointDecision");

const FIXTURE_REQUIREMENT_DIGEST = "a".repeat(64);
const SOLE_SCOPE_REQUIREMENT_DIGEST = "f".repeat(64);
const SOLE_SCOPE_COMPONENTS = Object.freeze([
  { id: "indirect_lightning_limit", factRole: "LIMIT" },
]);
const FIXTURE_COMPONENTS = Object.freeze([
  { id: "fungus_damage", factRole: "DAMAGE" },
  { id: "rot_damage", factRole: "DAMAGE" },
  { id: "coverage_limit", factRole: "LIMIT" },
  { id: "policy_deductible", factRole: "DEDUCTIBLE" },
  { id: "garage", factRole: "DAMAGE" },
  { id: "carport", factRole: "DAMAGE" },
]);

function packageSummary(overrides = {}) {
  return {
    evidenceFound: true,
    reviewStatus: "BELEGT",
    requirementContract: {
      digest: FIXTURE_REQUIREMENT_DIGEST,
      componentSatisfactionPolicy: "ALL",
      components: FIXTURE_COMPONENTS,
    },
    ...overrides,
  };
}

function atom(side, overrides = {}) {
  const candidateId = `candidate-${side}`;
  return {
    requirementId: "LW-22",
    componentId: "fungus_damage",
    componentLabel: "Pilzschäden",
    factRole: "DAMAGE",
    documentUuids: [`document-${side}`],
    evidencePresence: "FOUND",
    coverageEffect: "INCLUDED",
    conflictState: "NONE",
    selectedScopePicture: "GENERAL",
    scopePolicy: "GENERAL_REQUIRED",
    documentApplicability: "ACTIVE",
    documentRole: "MAIN_POLICY",
    documentStatus: "ACTIVE",
    selectedCandidateIds: [candidateId],
    unresolvedCandidateIds: [],
    requestedFieldStatus: "NOT_REQUIRED",
    requestedFields: [],
    optionalFields: [],
    componentSatisfactionPolicy: "ALL",
    requirementContractDigest: FIXTURE_REQUIREMENT_DIGEST,
    declaredComponents: FIXTURE_COMPONENTS,
    fields: [],
    sources: [
      {
        candidateId,
        physicalPageNumber: 2,
        exactText: "Vertragsbeleg",
      },
    ],
    ...overrides,
  };
}

function controlledAbsence(side, overrides = {}) {
  const documentUuids = overrides.documentUuids || [`absence-document-${side}`];
  const searchPlanIds = FIXTURE_COMPONENTS.map(
    ({ id }) => `fixture/LW-22/${id}`
  );
  const audits = documentUuids.flatMap((documentUuid) =>
    FIXTURE_COMPONENTS.map(({ id }) => ({
      disposition: "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
      comparisonTreatment: "DOCUMENTATION_ONLY_V1",
      negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
      absenceMeaning: "COVERAGE_ONLY",
      comparisonPolicy: null,
      absenceCertification: null,
      requirementContract: {
        digest: FIXTURE_REQUIREMENT_DIGEST,
        componentSatisfactionPolicy: "ALL",
        components: FIXTURE_COMPONENTS,
      },
      searchPlanId: `fixture/LW-22/${id}`,
      documentUuid,
      catalogId: "fixture",
      physicalPagesChecked: 12,
      totalPhysicalPages: 12,
      aliases: [id],
      conceptSearchIds: [],
      gates: {
        negativeSearchApproved: true,
        certifiedNegativeSearch: false,
        completeTextExtraction: true,
        completeCategoryTechnicalContract: true,
        zeroOccurrenceTerminal: true,
        zeroCandidateTerminal: true,
        serverNegativeTerminal: true,
      },
    }))
  );
  const summary = packageSummary({
    evidenceFound: false,
    facts: [],
    reviewStatus: "KEIN_TREFFER_NACH_VOLLSTÄNDIGER_KONTROLLIERTER_SUCHE",
    searchDisposition: "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
    comparisonTreatment: "DOCUMENTATION_ONLY_V1",
    searchAudit: {
      disposition: "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
      comparisonTreatment: "DOCUMENTATION_ONLY_V1",
      documentCount: documentUuids.length,
      documentUuids,
      physicalPagesChecked: 12 * documentUuids.length,
      searchPlanIds,
      requirementContract: {
        digest: FIXTURE_REQUIREMENT_DIGEST,
        componentSatisfactionPolicy: "ALL",
        components: FIXTURE_COMPONENTS,
      },
      components: audits,
    },
    ...overrides.packageSummary,
  });
  const atoms = audits.map((searchAudit) => {
    const component = FIXTURE_COMPONENTS.find(({ id }) =>
      searchAudit.searchPlanId.endsWith(`/${id}`)
    );
    return atom(side, {
      componentId: component.id,
      componentLabel: component.id,
      factRole: component.factRole,
      documentUuids: [searchAudit.documentUuid],
      evidencePresence: "NOT_FOUND",
      coverageEffect: "UNKNOWN",
      selectedScopePicture: "UNKNOWN",
      documentApplicability: "UNKNOWN",
      selectedCandidateIds: [],
      unresolvedCandidateIds: [],
      sources: [],
      searchAudit,
    });
  });
  return { summary, atoms };
}

function qualifiedOneSidedFixture({ evidencedSide = "A" } = {}) {
  const component = { id: "insured_subject", factRole: "INSURED_OBJECT" };
  const requirementContract = {
    digest: "c".repeat(64),
    componentSatisfactionPolicy: "ALL",
    components: [component],
  };
  const categoryId = "VS-13";
  const foundDocumentUuid = `found-${evidencedSide.toLowerCase()}`;
  const absentSide = evidencedSide === "A" ? "B" : "A";
  const absentDocumentUuid = `absent-${absentSide.toLowerCase()}`;
  const searchPlanId = `fixture/${categoryId}/${component.id}`;
  const searchCell = ({ documentUuid, found }) => ({
    disposition: found
      ? "RELEVANT_FOUND"
      : "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
    comparisonTreatment: found ? null : "DOCUMENTATION_ONLY_V1",
    negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
    absenceMeaning: "COVERAGE_ONLY",
    comparisonPolicy: null,
    absenceCertification: null,
    requirementContract,
    searchPlanId,
    documentUuid,
    catalogId: "fixture",
    physicalPagesChecked: 12,
    totalPhysicalPages: 12,
    aliases: ["Versicherter Gegenstand"],
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
  });
  const foundAudit = searchCell({
    documentUuid: foundDocumentUuid,
    found: true,
  });
  const absentAudit = searchCell({
    documentUuid: absentDocumentUuid,
    found: false,
  });
  const summary = ({ documentUuid, found, audit }) =>
    packageSummary({
      evidenceFound: found,
      coverage: found ? "Ja" : "Nicht feststellbar",
      facts: found
        ? [
            {
              documentUuid,
              coverage: "Ja",
              reviewStatus: "BELEGT",
            },
          ]
        : [],
      reviewStatus: found
        ? "BELEGT"
        : "KEIN_TREFFER_NACH_VOLLSTÄNDIGER_KONTROLLIERTER_SUCHE",
      searchDisposition: found
        ? "RELEVANT_FOUND"
        : "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
      comparisonTreatment: found ? null : "DOCUMENTATION_ONLY_V1",
      requirementContract,
      searchAudit: {
        disposition: found
          ? "SEARCH_INCOMPLETE"
          : "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
        comparisonTreatment: found ? null : "DOCUMENTATION_ONLY_V1",
        documentCount: 1,
        documentUuids: [documentUuid],
        physicalPagesChecked: 12,
        searchPlanIds: [searchPlanId],
        requirementContract,
        components: [audit],
      },
    });
  const foundAtom = atom("qualified-found", {
    requirementId: categoryId,
    componentId: component.id,
    componentLabel: "Versicherter Gegenstand",
    factRole: component.factRole,
    documentUuids: [foundDocumentUuid],
    requirementContractDigest: requirementContract.digest,
    declaredComponents: requirementContract.components,
    selectedCandidateIds: ["candidate-qualified-found"],
    sources: [
      {
        candidateId: "candidate-qualified-found",
        physicalPageNumber: 2,
        exactText: "Der Versicherte Gegenstand ist eingeschlossen.",
      },
    ],
    searchAudit: foundAudit,
  });
  const absentAtom = atom("qualified-absent", {
    requirementId: categoryId,
    componentId: component.id,
    componentLabel: "Versicherter Gegenstand",
    factRole: component.factRole,
    documentUuids: [absentDocumentUuid],
    evidencePresence: "NOT_FOUND",
    coverageEffect: "UNKNOWN",
    conflictState: "NONE",
    selectedScopePicture: "UNKNOWN",
    documentApplicability: "UNKNOWN",
    requirementContractDigest: requirementContract.digest,
    declaredComponents: requirementContract.components,
    selectedCandidateIds: [],
    unresolvedCandidateIds: [],
    sources: [],
    searchAudit: absentAudit,
  });
  const foundPackage = summary({
    documentUuid: foundDocumentUuid,
    found: true,
    audit: foundAudit,
  });
  const absentPackage = summary({
    documentUuid: absentDocumentUuid,
    found: false,
    audit: absentAudit,
  });
  return {
    categoryId,
    packageA: evidencedSide === "A" ? foundPackage : absentPackage,
    packageB: evidencedSide === "B" ? foundPackage : absentPackage,
    atomsA: evidencedSide === "A" ? [foundAtom] : [absentAtom],
    atomsB: evidencedSide === "B" ? [foundAtom] : [absentAtom],
  };
}

function certifyAbsence(absence) {
  absence.summary.reviewStatus = "NICHT_GEFUNDEN_NACH_VOLLSTÄNDIGER_PRÜFUNG";
  absence.summary.searchDisposition = "NOT_FOUND_AFTER_COMPLETE_SEARCH";
  absence.summary.comparisonTreatment = "ASSUMED_NOT_INCLUDED_V1";
  absence.summary.searchAudit.disposition = "NOT_FOUND_AFTER_COMPLETE_SEARCH";
  absence.summary.searchAudit.comparisonTreatment = "ASSUMED_NOT_INCLUDED_V1";
  for (const component of absence.summary.searchAudit.components) {
    component.disposition = "NOT_FOUND_AFTER_COMPLETE_SEARCH";
    component.comparisonTreatment = "ASSUMED_NOT_INCLUDED_V1";
    component.gates.certifiedNegativeSearch = true;
  }
  return absence;
}

function replaceAbsenceRequirementContract(absence, requirementContract) {
  absence.summary.requirementContract = requirementContract;
  absence.summary.searchAudit.requirementContract = requirementContract;
  for (const component of absence.summary.searchAudit.components)
    component.requirementContract = requirementContract;
  for (const atomValue of absence.atoms) {
    atomValue.requirementContractDigest = requirementContract.digest;
    atomValue.componentSatisfactionPolicy =
      requirementContract.componentSatisfactionPolicy;
    atomValue.declaredComponents = requirementContract.components;
  }
  return absence;
}

function decide(atomsA, atomsB, overrides = {}) {
  return decidePoint({
    categoryId: "LW-22",
    packageA: packageSummary(overrides.packageA),
    packageB: packageSummary(overrides.packageB),
    atomsA,
    atomsB,
  });
}

function scopeLimitPackage(side, reviewStatus, overrides = {}) {
  return packageSummary({
    reviewStatus,
    searchDisposition: "RELEVANT_FOUND",
    comparisonTreatment: null,
    requirementContract: {
      digest: SOLE_SCOPE_REQUIREMENT_DIGEST,
      componentSatisfactionPolicy: "ALL",
      components: SOLE_SCOPE_COMPONENTS,
    },
    facts: [
      {
        documentUuid: `scope-document-${side}`,
        reviewStatus,
      },
    ],
    ...overrides,
  });
}

function scopeLimitAtom(side, selectedScopePicture, overrides = {}) {
  const candidateIds =
    side === "a" ? [`scope-${side}-1`, `scope-${side}-2`] : [`scope-${side}-1`];
  const values = side === "a" ? ["1 %", "EUR 10.000"] : ["EUR 5.000"];
  return atom(side, {
    requirementId: "FE-A06",
    componentId: "indirect_lightning_limit",
    componentLabel: "Limit indirekter Blitzschlag",
    factRole: "LIMIT",
    documentUuids: [`scope-document-${side}`],
    coverageEffect: "DEFINED",
    selectedScopePicture,
    scopePolicy: "GENERAL_REQUIRED",
    documentApplicability: "CONDITIONAL",
    documentStatus: "FRAMEWORK_TERMS",
    selectedCandidateIds: candidateIds,
    requestedFieldStatus: "COMPLETE",
    requestedFields: ["limit"],
    requirementContractDigest: SOLE_SCOPE_REQUIREMENT_DIGEST,
    declaredComponents: SOLE_SCOPE_COMPONENTS,
    fields: [
      {
        field: "limit",
        status: "FOUND",
        facts: values.map((value, index) => ({
          normalizedValue: value,
          valueType: value.includes("%") ? "PERCENT" : "MONEY",
          unit: value.includes("%") ? "%" : "EUR",
          limitKind: "CAPPED",
          qualifier: "je Schadenfall",
          source: {
            candidateId: candidateIds[Math.min(index, candidateIds.length - 1)],
            physicalPageNumber: 7,
            exactText: value,
          },
        })),
      },
    ],
    sources: candidateIds.map((candidateId) => ({
      candidateId,
      physicalPageNumber: 7,
      exactText: "Betragsgrenze für indirekten Blitzschlag",
    })),
    ...overrides,
  });
}

function cleanScopeNotFoundAtom(side, documentUuid, overrides = {}) {
  return scopeLimitAtom(side, "UNKNOWN", {
    documentUuids: [documentUuid],
    evidencePresence: "NOT_FOUND",
    coverageEffect: "UNKNOWN",
    selectedScopePicture: "UNKNOWN",
    documentApplicability: "UNKNOWN",
    selectedCandidateIds: [],
    unresolvedCandidateIds: [],
    requestedFieldStatus: "NOT_FOUND",
    fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
    sources: [],
    ...overrides,
  });
}

function decideScopeFixture(overrides = {}) {
  const atomsA = overrides.atomsA || [scopeLimitAtom("a", "GENERAL")];
  const atomsB = overrides.atomsB || [
    scopeLimitAtom("b", "NARROW_ONLY"),
    ...Array.from({ length: 8 }, (_, index) =>
      cleanScopeNotFoundAtom("b", `scope-zero-b-${index + 1}`)
    ),
  ];
  return decidePoint({
    categoryId: "FE-A06",
    packageA: overrides.packageA || scopeLimitPackage("a", "BELEGT"),
    packageB: overrides.packageB || scopeLimitPackage("b", "TEILBELEGT"),
    atomsA,
    atomsB,
  });
}

describe("policy comparison point decision", () => {
  test("keeps active facts raw and compares framework and proposal facts as package members", () => {
    const statusAtoms = [
      atom("active"),
      atom("framework", {
        documentStatus: "FRAMEWORK_TERMS",
        documentApplicability: "CONDITIONAL",
      }),
      atom("proposal", {
        documentStatus: "PROPOSAL",
        documentApplicability: "PROPOSED_ONLY",
      }),
    ];
    const activeResult = decide([atom("left")], [statusAtoms[0]]);
    expect(activeResult).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      dimensions: [
        {
          a: { documentApplicability: "ACTIVE" },
          b: { documentApplicability: "ACTIVE" },
        },
      ],
    });
    expect(activeResult.dimensions[0].a).not.toHaveProperty(
      "comparisonApplicability"
    );
    for (const right of statusAtoms.slice(1)) {
      const result = decide([atom("left")], [right]);
      expect(result).toMatchObject({
        outcome: POINT_OUTCOME.EQUIVALENT,
        reviewRequired: false,
        dimensions: [
          {
            a: { comparisonApplicability: "PACKAGE_MEMBER" },
            b: {
              comparisonApplicability: "PACKAGE_MEMBER",
              documentApplicability: "PACKAGE_MEMBER",
              contributors: [
                expect.objectContaining({
                  documentStatus: right.documentStatus,
                  documentApplicability: right.documentApplicability,
                }),
              ],
            },
          },
        ],
      });
    }
  });

  test("fails closed for equal invalid status pairs and never bypasses TEILBELEGT", () => {
    const invalidA = atom("invalid-a", {
      documentStatus: "PROPOSAL",
      documentApplicability: "ACTIVE",
    });
    const invalidB = atom("invalid-b", {
      documentStatus: "PROPOSAL",
      documentApplicability: "ACTIVE",
    });
    expect(decide([invalidA], [invalidB])).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "ATOMIC_EVIDENCE_INCOMPLETE",
    });
    expect(
      decide(
        [atom("active-unknown-a", { documentApplicability: "UNKNOWN" })],
        [atom("active-unknown-b", { documentApplicability: "UNKNOWN" })]
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "ATOMIC_EVIDENCE_INCOMPLETE",
    });
    expect(
      decide([atom("partial-a")], [atom("partial-b")], {
        packageA: { reviewStatus: "TEILBELEGT" },
      })
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
    });
  });

  test("keeps the three-contributor decision permutation-stable", () => {
    const contributors = [
      atom("active"),
      atom("framework", {
        documentStatus: "FRAMEWORK_TERMS",
        documentApplicability: "CONDITIONAL",
      }),
      atom("proposal", {
        documentStatus: "PROPOSAL",
        documentApplicability: "PROPOSED_ONLY",
      }),
    ];
    const permutations = contributors.flatMap((first, firstIndex) =>
      contributors
        .filter((_, index) => index !== firstIndex)
        .flatMap((second, secondIndex, remaining) => [
          [first, second, remaining[1 - secondIndex]],
        ])
    );
    const decisions = permutations.map((atomsB) =>
      decide([atom("left")], atomsB)
    );
    expect(new Set(decisions.map(JSON.stringify)).size).toBe(1);
    expect(decisions[0].outcome).toBe(POINT_OUTCOME.EQUIVALENT);
    expect(decisions[0].dimensions[0].b.contributors).toHaveLength(3);
  });

  test("prefers explicit inclusion over explicit exclusion in the same atomic scope", () => {
    const result = decide(
      [atom("a", { coverageEffect: "EXCLUDED" })],
      [atom("b", { coverageEffect: "INCLUDED" })]
    );

    expect(result).toMatchObject({
      outcome: POINT_OUTCOME.ADVANTAGE_B,
      ruleId: "INCLUDED_OVER_EXCLUDED_V1",
      reviewRequired: false,
    });
    expect(result.reason).toContain("A ausdrücklich ausgeschlossen");
    expect(result.reason).toContain("B eingeschlossen");
  });

  test("does not turn one-sided or missing evidence into an advantage", () => {
    expect(
      decide([atom("a")], [], {
        packageB: { evidenceFound: false, reviewStatus: "UNGEKLÄRT" },
      })
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "MISSING_ONE_SIDE",
    });
    expect(
      decide([], [], {
        packageA: { evidenceFound: false, reviewStatus: "UNGEKLÄRT" },
        packageB: { evidenceFound: false, reviewStatus: "UNGEKLÄRT" },
      })
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "MISSING_BOTH",
    });
  });

  test.each(["A", "B"])(
    "prefers a fully audited pure inclusion on side %s over qualified absence",
    (evidencedSide) => {
      const fixture = qualifiedOneSidedFixture({ evidencedSide });
      const result = decidePoint(fixture);

      expect(result).toMatchObject({
        schemaVersion: 5,
        outcome:
          evidencedSide === "A"
            ? POINT_OUTCOME.ADVANTAGE_A
            : POINT_OUTCOME.ADVANTAGE_B,
        reasonCode: "INCLUDED_OVER_QUALIFIED_ABSENCE",
        ruleId: "INCLUDED_OVER_QUALIFIED_ABSENCE_V1",
        reviewRequired: false,
        unilateralCoverageAbsenceAudit: {
          schemaVersion: 1,
          contractId: "QUALIFIED_COVERAGE_OVER_ABSENCE_AUDIT_V1",
          eligible: true,
          evidencedSide,
        },
      });
      expect(result.reason).toContain("keine entsprechende Regelung gefunden");
      expect(result.reason).toContain("ausdrücklicher Ausschluss");
    }
  );

  test("keeps ANY requirements blocked in the first directional contract", () => {
    const fixture = qualifiedOneSidedFixture();
    for (const packageValue of [fixture.packageA, fixture.packageB]) {
      packageValue.requirementContract.componentSatisfactionPolicy = "ANY";
      packageValue.searchAudit.requirementContract.componentSatisfactionPolicy =
        "ANY";
      packageValue.searchAudit.components[0].requirementContract.componentSatisfactionPolicy =
        "ANY";
    }
    fixture.atomsA[0].componentSatisfactionPolicy = "ANY";
    fixture.atomsA[0].declaredComponents =
      fixture.packageA.requirementContract.components;
    fixture.atomsB[0].componentSatisfactionPolicy = "ANY";
    fixture.atomsB[0].declaredComponents =
      fixture.packageB.requirementContract.components;
    const result = decidePoint(fixture);
    expect(result).toMatchObject({
      schemaVersion: 5,
      outcome: POINT_OUTCOME.DOCUMENTATION_DIFFERENCE,
      ruleId: "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V2",
      unilateralCoverageAbsenceAudit: {
        eligible: false,
        blockerCodes: expect.arrayContaining([
          "REQUIREMENT_NOT_PURE_ALL_COVERAGE",
        ]),
      },
    });
  });

  test("states the exact narrow scope in a directional customer reason", () => {
    const fixture = qualifiedOneSidedFixture();
    fixture.atomsA[0].selectedScopePicture = "NARROW_ONLY";
    fixture.atomsA[0].scopePolicy = "MATCHING_SCOPE_INCLUDED_SUFFICIENT";
    const result = decidePoint(fixture);
    expect(result.outcome).toBe(POINT_OUTCOME.ADVANTAGE_A);
    expect(result.reason).toContain(
      "für den im Beleg ausgewiesenen engeren Deckungsumfang"
    );
    expect(result.reason).toContain("Für genau diesen engeren Deckungsumfang");
  });

  test("renders multiple required winner components as grammatical Teilpunkte", () => {
    const fixture = qualifiedOneSidedFixture();
    const secondComponent = { id: "hail", factRole: "PERIL" };
    const contract = fixture.packageA.requirementContract;
    contract.components.push(secondComponent);
    const addComponent = ({ packageValue, atoms, found }) => {
      const baseAtom = atoms[0];
      const secondAtom = JSON.parse(JSON.stringify(baseAtom));
      secondAtom.componentId = secondComponent.id;
      secondAtom.componentLabel = "durch Hagel";
      secondAtom.factRole = secondComponent.factRole;
      secondAtom.declaredComponents = contract.components;
      secondAtom.searchAudit.requirementContract = contract;
      secondAtom.searchAudit.searchPlanId = "fixture/VS-13/hail";
      if (found) {
        secondAtom.selectedCandidateIds = ["candidate-qualified-hail"];
        secondAtom.sources = [
          {
            candidateId: "candidate-qualified-hail",
            physicalPageNumber: 2,
            exactText: "Optische Schäden durch Hagel sind eingeschlossen.",
          },
        ];
      }
      baseAtom.declaredComponents = contract.components;
      baseAtom.searchAudit.requirementContract = contract;
      packageValue.searchAudit.searchPlanIds.push("fixture/VS-13/hail");
      packageValue.searchAudit.components.push(secondAtom.searchAudit);
      atoms.push(secondAtom);
    };
    addComponent({
      packageValue: fixture.packageA,
      atoms: fixture.atomsA,
      found: true,
    });
    addComponent({
      packageValue: fixture.packageB,
      atoms: fixture.atomsB,
      found: false,
    });
    const result = decidePoint(fixture);
    expect(result.outcome).toBe(POINT_OUTCOME.ADVANTAGE_A);
    expect(result.reason).toContain(
      "Die Teilpunkte „durch Hagel“ und „Versicherter Gegenstand“ sind"
    );
  });

  test("reports comparison equality when both packages have the same fully audited absence", () => {
    const absenceA = controlledAbsence("a");
    const absenceB = controlledAbsence("b", {
      documentUuids: ["absence-document-b-1", "absence-document-b-2"],
    });
    const result = decide(absenceA.atoms, absenceB.atoms, {
      packageA: absenceA.summary,
      packageB: absenceB.summary,
    });

    expect(result).toMatchObject({
      schemaVersion: 4,
      outcome: POINT_OUTCOME.EQUIVALENT,
      reasonCode: "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH",
      ruleId: "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1",
      reviewRequired: false,
    });
    expect(result.reason).toContain(
      "weder einen ausdrücklichen Ausschluss noch eine inhaltlich identische Deckung"
    );
    expect(result.bilateralAbsenceAudit.sides).toHaveLength(2);
  });

  test("keeps a multi-document bilateral absence audit stable under input permutations", () => {
    const absenceA = controlledAbsence("a", {
      documentUuids: ["absence-document-a-1", "absence-document-a-2"],
    });
    const absenceB = controlledAbsence("b", {
      documentUuids: ["absence-document-b-1", "absence-document-b-2"],
    });
    const original = decide(absenceA.atoms, absenceB.atoms, {
      packageA: absenceA.summary,
      packageB: absenceB.summary,
    });
    absenceA.atoms.reverse();
    absenceB.atoms.reverse();
    absenceA.summary.searchAudit.components.reverse();
    absenceB.summary.searchAudit.components.reverse();
    const permuted = decide(absenceA.atoms, absenceB.atoms, {
      packageA: absenceA.summary,
      packageB: absenceB.summary,
    });
    expect(permuted).toEqual(original);
  });

  test("accepts matching certified bilateral absence and rejects mixed dispositions", () => {
    const certifiedA = certifyAbsence(controlledAbsence("a"));
    const certifiedB = certifyAbsence(controlledAbsence("b"));
    expect(
      decide(certifiedA.atoms, certifiedB.atoms, {
        packageA: certifiedA.summary,
        packageB: certifiedB.summary,
      })
    ).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      ruleId: "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1",
    });

    const controlled = controlledAbsence("b-controlled");
    expect(
      decide(certifiedA.atoms, controlled.atoms, {
        packageA: certifiedA.summary,
        packageB: controlled.summary,
      })
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "MISSING_BOTH",
    });
  });

  test("requires every declared ANY alternative in every package document", () => {
    const anyContract = {
      digest: "b".repeat(64),
      componentSatisfactionPolicy: "ANY",
      components: FIXTURE_COMPONENTS,
    };
    const absenceA = replaceAbsenceRequirementContract(
      controlledAbsence("a-any"),
      anyContract
    );
    const absenceB = replaceAbsenceRequirementContract(
      controlledAbsence("b-any", {
        documentUuids: ["absence-document-b-any-1", "absence-document-b-any-2"],
      }),
      anyContract
    );
    expect(
      decide(absenceA.atoms, absenceB.atoms, {
        packageA: absenceA.summary,
        packageB: absenceB.summary,
      })
    ).toMatchObject({ outcome: POINT_OUTCOME.EQUIVALENT });

    absenceB.atoms.pop();
    absenceB.summary.searchAudit.components.pop();
    expect(
      decide(absenceA.atoms, absenceB.atoms, {
        packageA: absenceA.summary,
        packageB: absenceB.summary,
      })
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "MISSING_BOTH",
    });
  });

  test.each([
    [
      "optional-only field",
      {
        requestedFields: [],
        optionalFields: ["limit"],
        requestedFieldStatus: "NOT_REQUIRED",
        fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
      },
    ],
    [
      "required and optional fields",
      {
        requestedFields: ["condition"],
        optionalFields: ["limit"],
        requestedFieldStatus: "NOT_FOUND",
        fields: [
          { field: "condition", status: "NOT_FOUND", facts: [] },
          { field: "limit", status: "NOT_FOUND", facts: [] },
        ],
      },
    ],
    [
      "complete-zero search with not-evaluated required field aggregate",
      {
        requestedFields: ["condition"],
        optionalFields: [],
        requestedFieldStatus: "NOT_EVALUATED",
        fields: [{ field: "condition", status: "NOT_FOUND", facts: [] }],
      },
    ],
  ])("accepts clean bilateral absence with %s", (_label, fieldState) => {
    const absenceA = controlledAbsence("a");
    const absenceB = controlledAbsence("b");
    Object.assign(absenceA.atoms[0], fieldState);
    Object.assign(absenceB.atoms[0], fieldState);
    expect(
      decide(absenceA.atoms, absenceB.atoms, {
        packageA: absenceA.summary,
        packageB: absenceB.summary,
      })
    ).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      ruleId: "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1",
    });
  });

  test.each([
    ["optional field marked found", { status: "FOUND", facts: [] }],
    [
      "optional field with a fact",
      { status: "NOT_FOUND", facts: [{ rawValue: "EUR 1.000" }] },
    ],
  ])("rejects bilateral absence with %s", (_label, fieldOverride) => {
    const absenceA = controlledAbsence("a");
    const absenceB = controlledAbsence("b");
    for (const absence of [absenceA, absenceB]) {
      Object.assign(absence.atoms[0], {
        optionalFields: ["limit"],
        requestedFieldStatus: "NOT_REQUIRED",
        fields: [{ field: "limit", ...fieldOverride }],
      });
    }
    expect(
      decide(absenceA.atoms, absenceB.atoms, {
        packageA: absenceA.summary,
        packageB: absenceB.summary,
      })
    ).toMatchObject({ outcome: POINT_OUTCOME.UNCLEAR });
  });

  test.each([
    ["missing audit", (absence) => delete absence.summary.searchAudit],
    [
      "incomplete extraction",
      (absence) =>
        (absence.summary.searchAudit.components[0].gates.completeTextExtraction =
          false),
    ],
    [
      "different search plan",
      (absence) => {
        absence.summary.searchAudit.searchPlanIds[0] =
          "fixture/LW-22/different";
        absence.summary.searchAudit.components[0].searchPlanId =
          "fixture/LW-22/different";
        absence.atoms[0].searchAudit.searchPlanId = "fixture/LW-22/different";
      },
    ],
    [
      "hidden found atom",
      (absence) => {
        absence.atoms[0].evidencePresence = "FOUND";
        absence.atoms[0].coverageEffect = "INCLUDED";
      },
    ],
  ])("fails closed for bilateral absence with %s", (_label, mutate) => {
    const absenceA = controlledAbsence("a");
    const absenceB = controlledAbsence("b");
    mutate(absenceB);
    expect(
      decide(absenceA.atoms, absenceB.atoms, {
        packageA: absenceA.summary,
        packageB: absenceB.summary,
      })
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "MISSING_BOTH",
      reviewRequired: true,
    });
  });

  test("fails closed when absence faces evidence without a reconstructable joint audit", () => {
    const completeAbsence = {
      evidenceFound: false,
      reviewStatus: "NICHT_GEFUNDEN_NACH_VOLLSTÄNDIGER_PRÜFUNG",
      searchDisposition: "NOT_FOUND_AFTER_COMPLETE_SEARCH",
      comparisonTreatment: "ASSUMED_NOT_INCLUDED_V1",
    };
    for (const coverageEffect of ["EXCLUDED", "CONDITIONAL", "UNKNOWN"]) {
      expect(
        decide([atom("a", { coverageEffect })], [], {
          packageB: completeAbsence,
        })
      ).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        reasonCode: "QUALIFIED_DIRECTIONAL_AUDIT_INCOMPLETE",
      });
    }
  });

  test("does not award inclusion over absence from inactive document states", () => {
    const completeAbsence = {
      evidenceFound: false,
      reviewStatus: "NICHT_GEFUNDEN_NACH_VOLLSTÄNDIGER_PRÜFUNG",
      searchDisposition: "NOT_FOUND_AFTER_COMPLETE_SEARCH",
      comparisonTreatment: "ASSUMED_NOT_INCLUDED_V1",
    };
    for (const [documentStatus, documentApplicability] of [
      ["FRAMEWORK_TERMS", "CONDITIONAL"],
      ["PROPOSAL", "PROPOSED_ONLY"],
      ["ACTIVE", "UNKNOWN"],
    ]) {
      expect(
        decide([atom("a", { documentStatus, documentApplicability })], [], {
          packageB: completeAbsence,
        })
      ).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        ruleId: "FAIL_CLOSED_V1",
      });
    }
  });

  test("validates every raw contributor before deduplicating against absence", () => {
    const completeAbsence = {
      evidenceFound: false,
      reviewStatus: "NICHT_GEFUNDEN_NACH_VOLLSTÄNDIGER_PRÜFUNG",
      searchDisposition: "NOT_FOUND_AFTER_COMPLETE_SEARCH",
      comparisonTreatment: "ASSUMED_NOT_INCLUDED_V1",
    };
    const unsafeContributors = [
      atom("a-option", {
        sources: [
          {
            candidateId: "candidate-a-option",
            physicalPageNumber: 2,
            exactText: "Der Baustein ist optional eingeschlossen.",
          },
        ],
      }),
      atom("a-condition", {
        sources: [
          {
            candidateId: "candidate-a-condition",
            physicalPageNumber: 2,
            exactText: "Der Schutz gilt, sofern die Anlage gewartet wird.",
          },
        ],
      }),
      atom("a-conflict", { conflictState: "ACTIVE_SAME_SCOPE" }),
      atom("a-unresolved", {
        unresolvedCandidateIds: ["candidate-unresolved"],
      }),
      atom("a-source", { sources: [] }),
    ];

    for (const unsafe of unsafeContributors) {
      for (const evidencedAtoms of [
        [atom("a-safe"), unsafe],
        [unsafe, atom("a-safe")],
      ]) {
        expect(
          decide(evidencedAtoms, [], { packageB: completeAbsence })
        ).toMatchObject({
          outcome: POINT_OUTCOME.UNCLEAR,
          ruleId: "FAIL_CLOSED_V1",
        });
      }
    }
  });

  test("fails closed for a controlled zero match without its joint audit", () => {
    const result = decide([atom("a")], [], {
      packageB: {
        evidenceFound: false,
        reviewStatus: "KEIN_TREFFER_NACH_VOLLSTÄNDIGER_KONTROLLIERTER_SUCHE",
        searchDisposition: "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
        comparisonTreatment: "DOCUMENTATION_ONLY_V1",
      },
    });

    expect(result).toMatchObject({
      schemaVersion: 3,
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "QUALIFIED_DIRECTIONAL_AUDIT_INCOMPLETE",
      reviewRequired: true,
    });
  });

  test("blocks partial, contradictory and unresolved package states", () => {
    for (const reviewStatus of [
      "TEILBELEGT",
      "WIDERSPRÜCHLICH",
      "RANGFOLGE_PRÜFEN",
      "UNGEKLÄRT",
    ]) {
      expect(
        decide([atom("a")], [atom("b")], {
          packageA: { reviewStatus },
        })
      ).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
        packageReviewAudit: {
          schemaVersion: 2,
          contractId: "PACKAGE_REVIEW_BLOCKERS_V2",
        },
      });
    }
  });

  test("resolves the sole general-versus-narrow scope blocker as not comparable", () => {
    const result = decideScopeFixture();

    expect(result).toMatchObject({
      outcome: POINT_OUTCOME.NOT_COMPARABLE,
      reasonCode: "COMPARABILITY_GATE_FAILED",
      ruleId: "SOLE_SCOPE_REVIEW_BLOCKER_TO_ATOMIC_NONCOMPARABLE_V1",
      reviewRequired: false,
    });
    expect(result.dimensions).toHaveLength(1);
    expect(result).not.toHaveProperty("packageReviewAudit");
    expect(result.reason).toContain("Polizze A");
    expect(result.reason).toContain("Polizze B");
    expect(result.reason).not.toMatch(/GENERAL|NARROW_ONLY/u);
    expect(result.outcome).not.toBe(POINT_OUTCOME.ADVANTAGE_A);
    expect(result.outcome).not.toBe(POINT_OUTCOME.ADVANTAGE_B);
    expect(result.outcome).not.toBe(POINT_OUTCOME.EQUIVALENT);
  });

  test("applies the sole scope contract symmetrically and to active facts", () => {
    const narrowA = scopeLimitAtom("a", "NARROW_ONLY");
    const generalB = scopeLimitAtom("b", "GENERAL");
    const symmetric = decideScopeFixture({
      packageA: scopeLimitPackage("a", "TEILBELEGT"),
      packageB: scopeLimitPackage("b", "BELEGT"),
      atomsA: [narrowA],
      atomsB: [generalB],
    });
    expect(symmetric).toMatchObject({
      outcome: POINT_OUTCOME.NOT_COMPARABLE,
      ruleId: "SOLE_SCOPE_REVIEW_BLOCKER_TO_ATOMIC_NONCOMPARABLE_V1",
    });
    expect(symmetric.reason).toContain(
      "Polizze B für einen allgemeinen Deckungsumfang"
    );

    const active = decideScopeFixture({
      atomsA: [
        scopeLimitAtom("a", "GENERAL", {
          documentApplicability: "ACTIVE",
          documentStatus: "ACTIVE",
        }),
      ],
      atomsB: [
        scopeLimitAtom("b", "NARROW_ONLY", {
          documentApplicability: "ACTIVE",
          documentStatus: "ACTIVE",
        }),
      ],
    });
    expect(active).toMatchObject({
      outcome: POINT_OUTCOME.NOT_COMPARABLE,
      reviewRequired: false,
    });
  });

  test("keeps other package statuses, contracts and scope pictures fail-closed", () => {
    const cases = [
      {
        packageA: scopeLimitPackage("a", "TEILBELEGT"),
        packageB: scopeLimitPackage("b", "TEILBELEGT"),
      },
      { packageB: scopeLimitPackage("b", "RANGFOLGE_PRÜFEN") },
      {
        packageB: scopeLimitPackage("b", "TEILBELEGT", {
          searchDisposition: "SEARCH_INCOMPLETE",
        }),
      },
      {
        packageB: scopeLimitPackage("b", "TEILBELEGT", {
          comparisonTreatment: "DOCUMENTATION_ONLY_V1",
        }),
      },
      { atomsB: [scopeLimitAtom("b", "GENERAL")] },
      { atomsB: [scopeLimitAtom("b", "UNKNOWN")] },
      {
        atomsB: [
          scopeLimitAtom("b", "NARROW_ONLY", {
            scopePolicy: "MATCHING_SCOPE_DEFINITIVE_SUFFICIENT",
          }),
        ],
      },
      {
        atomsB: [
          scopeLimitAtom("b", "NARROW_ONLY", {
            documentApplicability: "PROPOSED_ONLY",
          }),
        ],
      },
      {
        atomsB: [
          scopeLimitAtom("b", "NARROW_ONLY", {
            coverageEffect: "CONDITIONAL",
          }),
        ],
      },
    ];

    for (const fixture of cases)
      expect(decideScopeFixture(fixture)).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
        reviewRequired: true,
      });
  });

  test("rejects hidden extra evidence and dirty null atoms", () => {
    const extraFound = scopeLimitAtom("b-extra", "NARROW_ONLY", {
      documentUuids: ["scope-extra-document"],
    });
    const dirtyNullVariants = [
      { selectedCandidateIds: ["hidden-candidate"] },
      {
        sources: [
          {
            candidateId: "hidden-candidate",
            physicalPageNumber: 1,
            exactText: "verborgene Quelle",
          },
        ],
      },
      { coverageEffect: "DEFINED" },
      { conflictState: "ACTIVE_SAME_SCOPE" },
      { unresolvedCandidateIds: ["hidden-candidate"] },
      { selectedScopePicture: "NARROW_ONLY" },
      { documentApplicability: "CONDITIONAL" },
      { requestedFieldStatus: "COMPLETE", fields: [] },
      { requestedFields: [] },
      { requestedFields: ["other_limit"] },
      { requestedFields: ["limit", "limit"] },
      {
        requestedFieldStatus: "NOT_REQUIRED",
        requestedFields: ["limit"],
        fields: [],
      },
    ];

    expect(
      decideScopeFixture({
        atomsB: [scopeLimitAtom("b", "NARROW_ONLY"), extraFound],
      })
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
    });

    for (const dirty of dirtyNullVariants)
      expect(
        decideScopeFixture({
          atomsB: [
            scopeLimitAtom("b", "NARROW_ONLY"),
            cleanScopeNotFoundAtom("b", "scope-dirty-zero", dirty),
          ],
        })
      ).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
      });
  });

  test("rejects incomplete sources, contract atoms and contributing facts", () => {
    const cases = [
      {
        atomsB: [
          scopeLimitAtom("b", "NARROW_ONLY", {
            sources: [],
          }),
        ],
      },
      {
        packageB: scopeLimitPackage("b", "TEILBELEGT", {
          facts: [
            {
              documentUuid: "different-document",
              reviewStatus: "TEILBELEGT",
            },
          ],
        }),
      },
      {
        packageB: scopeLimitPackage("b", "TEILBELEGT", {
          facts: [
            {
              documentUuid: "scope-document-b",
              reviewStatus: "BELEGT",
            },
          ],
        }),
      },
      {
        packageB: scopeLimitPackage("b", "TEILBELEGT", {
          facts: [
            {
              documentUuid: "scope-document-b",
              reviewStatus: "TEILBELEGT",
            },
            {
              documentUuid: "second-document",
              reviewStatus: "TEILBELEGT",
            },
          ],
        }),
      },
      {
        atomsB: [
          scopeLimitAtom("b", "NARROW_ONLY", {
            requestedFields: ["limit", "duration"],
          }),
        ],
      },
      {
        atomsB: [
          scopeLimitAtom("b", "NARROW_ONLY", {
            requestedFields: ["limit", "limit"],
          }),
        ],
      },
      {
        atomsB: [
          scopeLimitAtom("b", "NARROW_ONLY", {
            requestedFieldStatus: "NOT_REQUIRED",
            fields: [],
          }),
        ],
      },
    ];

    for (const fixture of cases)
      expect(decideScopeFixture(fixture)).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
      });

    expect(
      decideScopeFixture({
        atomsB: [
          scopeLimitAtom("b", "NARROW_ONLY", {
            requirementContractDigest: "e".repeat(64),
          }),
        ],
      })
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "REQUIREMENT_CONTRACT_MISMATCH",
    });
  });

  test("persists typed package blockers without changing the outer decision", () => {
    const missing = atom("a", {
      evidencePresence: "NOT_FOUND",
      coverageEffect: "UNKNOWN",
      selectedScopePicture: "UNKNOWN",
      documentApplicability: "UNKNOWN",
      selectedCandidateIds: [],
      sources: [],
    });
    const result = decide([missing], [atom("b")], {
      packageA: {
        reviewStatus: "TEILBELEGT",
        facts: [
          {
            documentUuid: "document-a",
            reviewStatus: "TEILBELEGT",
          },
        ],
      },
    });

    expect(result).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
      reviewRequired: true,
      ruleId: "FAIL_CLOSED_V1",
      packageReviewAudit: {
        schemaVersion: 2,
        contractId: "PACKAGE_REVIEW_BLOCKERS_V2",
        packageStatuses: { A: "TEILBELEGT", B: "BELEGT" },
      },
    });
    expect(result.packageReviewAudit.blockers).toHaveLength(1);
    expect(result.packageReviewAudit.blockers[0]).toMatchObject({
      code: "MISSING_REQUIRED_COMPONENT",
      side: "A",
      level: "COMPONENT",
      requirementId: "LW-22",
      componentId: "fungus_damage",
      documentUuids: ["document-a"],
    });
    expect(
      result.packageReviewAudit.blockers.map(({ code }) => code)
    ).not.toContain("UNKNOWN_COVERAGE_EFFECT");
  });

  test("keeps applicability as a signal and requirement fields as one blocker", () => {
    const proposed = atom("a", {
      documentApplicability: "PROPOSED_ONLY",
      documentStatus: "PROPOSAL",
      requestedFieldStatus: "NOT_FOUND",
    });
    const result = decide([proposed], [atom("b")], {
      packageA: {
        reviewStatus: "TEILBELEGT",
        facts: [
          {
            documentUuid: "document-a",
            reviewStatus: "TEILBELEGT",
          },
        ],
      },
    });

    expect(result.packageReviewAudit.blockers).toEqual([
      expect.objectContaining({
        code: "FIELD_INCOMPLETE",
        side: "A",
        level: "REQUIREMENT",
        componentId: null,
      }),
    ]);
    expect(result.packageReviewAudit.signals).toEqual([
      expect.objectContaining({
        code: "PROPOSED_ONLY",
        side: "A",
        level: "COMPONENT",
      }),
    ]);
  });

  test("does not turn package-member status variants into a multiple-atom blocker", () => {
    const active = atom("status-active");
    const proposal = atom("status-proposal", {
      documentStatus: "PROPOSAL",
      documentApplicability: "PROPOSED_ONLY",
    });
    const result = decide([proposal, active], [atom("b")], {
      packageA: {
        reviewStatus: "TEILBELEGT",
        facts: [
          {
            documentUuid: "document-status-active",
            reviewStatus: "TEILBELEGT",
          },
          {
            documentUuid: "document-status-proposal",
            reviewStatus: "TEILBELEGT",
          },
        ],
      },
    });

    expect(result).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
      packageReviewAudit: {
        schemaVersion: 2,
        contractId: "PACKAGE_REVIEW_BLOCKERS_V2",
      },
    });
    expect(result.packageReviewAudit.blockers.map(({ code }) => code)).toEqual([
      "UNCLASSIFIED_DOCUMENT_REVIEW_BLOCKER",
    ]);
    expect(result.packageReviewAudit.signals.map(({ code }) => code)).toEqual([
      "PROPOSED_ONLY",
    ]);
  });

  test("does not call an absent ANY alternative a missing required component", () => {
    const anyContract = {
      digest: FIXTURE_REQUIREMENT_DIGEST,
      componentSatisfactionPolicy: "ANY",
      components: FIXTURE_COMPONENTS,
    };
    const found = atom("a", {
      componentSatisfactionPolicy: "ANY",
    });
    const absentAlternative = atom("a", {
      componentId: "rot_damage",
      componentLabel: "Fäulnisschäden",
      componentSatisfactionPolicy: "ANY",
      evidencePresence: "NOT_FOUND",
      coverageEffect: "UNKNOWN",
      selectedScopePicture: "UNKNOWN",
      documentApplicability: "UNKNOWN",
      selectedCandidateIds: [],
      sources: [],
    });
    const result = decide(
      [found, absentAlternative],
      [atom("b", { componentSatisfactionPolicy: "ANY" })],
      {
        packageA: {
          reviewStatus: "TEILBELEGT",
          requirementContract: anyContract,
        },
        packageB: { requirementContract: anyContract },
      }
    );

    expect(
      result.packageReviewAudit.blockers.map(({ code }) => code)
    ).not.toContain("MISSING_REQUIRED_COMPONENT");
  });

  test("keeps conditional coverage effects and options fail-closed", () => {
    for (const coverageEffect of ["CONDITIONAL", "DEFINED", "UNKNOWN"]) {
      expect(
        decide([atom("a", { coverageEffect })], [atom("b", { coverageEffect })])
      ).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        reasonCode: "NO_APPROVED_RULE_FOR_ALL_DIMENSIONS",
      });
    }
  });

  test("keeps coverage clauses with conditions or exceptions fail-closed", () => {
    for (const exactText of [
      "Schäden durch Holzfäule sind ausgeschlossen, außer sie sind auf ein versichertes Ereignis zurückzuführen.",
      "Schäden sind eingeschlossen, sofern die Leitung ordnungsgemäß gewartet wurde.",
      "Schäden sind versichert, wenn die Anlage dauerhaft bewohnt ist.",
      "Schäden sind gedeckt, soweit keine andere Versicherung leistet.",
      "Schäden sind ausgenommen, vorausgesetzt der Versicherungsnehmer weist die Ursache nach.",
    ]) {
      const result = decide(
        [atom("a", { coverageEffect: "EXCLUDED" })],
        [
          atom("b", {
            coverageEffect: "INCLUDED",
            sources: [
              {
                candidateId: "candidate-b",
                physicalPageNumber: 2,
                exactText: "Holzfäule",
                conditionCheckText: exactText,
              },
            ],
          }),
        ]
      );
      expect(result).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        reasonCode: "CONDITIONAL_OR_EXCEPTION_SCOPE",
        ruleId: "FAIL_CLOSED_CONDITIONAL_SOURCE_V1",
        reviewRequired: true,
      });
      expect(result.reason).toContain("Bedingung, Ausnahme oder Optionalität");
    }
  });

  test("keeps explicit coverage options fail-closed without matching negated controls", () => {
    for (const exactText of [
      "Der Deckungsbaustein ist optional eingeschlossen.",
      "Die Erweiterung ist wahlweise mitversichert.",
      "Der Schutz gilt gegen Mehrprämie.",
      "Die Gefahr ist auf ausdrücklichen Wunsch mitversichert.",
      "Die Gefahr kann eingeschlossen werden.",
      "Der Schutz besteht nur bei gesonderter Vereinbarung.",
    ]) {
      expect(
        decide(
          [atom("a")],
          [
            atom("b", {
              sources: [
                {
                  candidateId: "candidate-b",
                  physicalPageNumber: 2,
                  exactText,
                },
              ],
            }),
          ]
        )
      ).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        reasonCode: "CONDITIONAL_OR_EXCEPTION_SCOPE",
        ruleId: "FAIL_CLOSED_CONDITIONAL_SOURCE_V1",
      });
    }

    for (const exactText of [
      "Der Deckungsbaustein ist nicht optional, sondern eingeschlossen.",
      "Der Schutz ist ohne Mehrprämie eingeschlossen.",
      "Keine gesonderte Vereinbarung ist erforderlich.",
    ]) {
      expect(
        decide(
          [atom("a")],
          [
            atom("b", {
              sources: [
                {
                  candidateId: "candidate-b",
                  physicalPageNumber: 2,
                  exactText,
                },
              ],
            }),
          ]
        )
      ).toMatchObject({
        outcome: POINT_OUTCOME.EQUIVALENT,
        ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
      });
    }
  });

  test("keeps waiting and karenz periods fail-closed without matching neighbouring words", () => {
    for (const conditionCheckText of [
      "Der Versicherungsschutz beginnt erst nach Ablauf der Karenzfrist.",
      "Für diese Deckung gilt eine Wartezeit von 72 Stunden.",
    ]) {
      const result = decide(
        [atom("a")],
        [
          atom("b", {
            sources: [
              {
                candidateId: "candidate-b",
                physicalPageNumber: 2,
                exactText: "Versicherte Gefahr",
                conditionCheckText,
              },
            ],
          }),
        ]
      );
      expect(result).toMatchObject({
        outcome: POINT_OUTCOME.UNCLEAR,
        reasonCode: "CONDITIONAL_OR_EXCEPTION_SCOPE",
        ruleId: "FAIL_CLOSED_CONDITIONAL_SOURCE_V1",
      });
    }

    for (const exactText of [
      "Das Wartezimmer ist kein versichertes Objekt.",
      "Für diese Deckung besteht keine Karenzfrist.",
      "Der Versicherungsschutz gilt ohne Wartezeit.",
      "Die Wartefrist entfällt.",
    ]) {
      expect(
        decide(
          [atom("a")],
          [
            atom("b", {
              sources: [
                {
                  candidateId: "candidate-b",
                  physicalPageNumber: 2,
                  exactText,
                },
              ],
            }),
          ]
        )
      ).toMatchObject({
        outcome: POINT_OUTCOME.EQUIVALENT,
        ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
      });
    }
  });

  test("separates intended operation from unintended events in bound source text", () => {
    const sourcedAtom = (side, exactText) =>
      atom(side, {
        sources: [
          {
            candidateId: `candidate-${side}`,
            physicalPageNumber: 2,
            exactText,
          },
        ],
      });

    const differentModes = decide(
      [
        sourcedAtom(
          "a",
          "Schäden infolge einer bestimmungsgemäßen Auslösung der Sprinkleranlage."
        ),
      ],
      [
        sourcedAtom(
          "b",
          "Löschmittel kann aus der Anlage bestimmungswidrig austreten."
        ),
      ]
    );
    expect(differentModes).toMatchObject({
      outcome: POINT_OUTCOME.NOT_COMPARABLE,
      reasonCode: "COMPARABILITY_GATE_FAILED",
      ruleId: "ATOMIC_COMPARABILITY_GATE_V1",
    });
    expect(differentModes.dimensions[0]).toMatchObject({
      a: { operationalEventMode: "INTENDED_OPERATION" },
      b: { operationalEventMode: "UNINTENDED_EVENT" },
    });
    expect(differentModes.reason).toContain(
      "bestimmungsgemäßer Betrieb oder Auslösung"
    );
    expect(differentModes.reason).not.toContain("INTENDED_OPERATION");

    const sameMode = decide(
      [sourcedAtom("a", "Bestimmungsgemäße Auslösung der Sprinkleranlage.")],
      [sourcedAtom("b", "Die Sprinkleranlage löst bestimmungsgemäß aus.")]
    );
    expect(sameMode).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
    });
    expect(sameMode.dimensions[0]).toMatchObject({
      a: { operationalEventMode: "INTENDED_OPERATION" },
      b: { operationalEventMode: "INTENDED_OPERATION" },
    });

    const deduplicatedSameMode = decide(
      [
        sourcedAtom("a", "Bestimmungsgemäße Auslösung der Sprinkleranlage."),
        sourcedAtom("a", "Die Sprinkleranlage löst bestimmungsgemäß aus."),
      ],
      [sourcedAtom("b", "Bestimmungsgemäße Aktivierung der Sprinkleranlage.")]
    );
    expect(deduplicatedSameMode).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
    });

    for (const exactText of [
      "Die Sprinkleranlage löst bestimmungsgemäß nicht aus.",
      "Löschmittel tritt nicht bestimmungswidrig aus der Anlage aus.",
      "Bestimmungsgemäß. Die Auslösung wird separat beschrieben.",
    ]) {
      const negatedOrSeparated = decide(
        [atom("a")],
        [sourcedAtom("b", exactText)]
      );
      expect(negatedOrSeparated).toMatchObject({
        outcome: POINT_OUTCOME.EQUIVALENT,
        ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
      });
      expect(negatedOrSeparated.dimensions[0]).toMatchObject({
        b: { operationalEventMode: "UNSPECIFIED" },
      });
    }

    expect(
      decide(
        [atom("a")],
        [
          sourcedAtom(
            "b",
            "Die Bestimmung gemäß Paragraph 4 definiert den Versicherungsort."
          ),
        ]
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
    });
  });

  test("does not mistake a peril definition for a conditional coverage promise", () => {
    const definition =
      "Direkter Blitzschlag ist die schädigende Kraft oder Wärmewirkung des Blitzes, wenn er unmittelbar in die versicherten Sachen einschlägt.";
    const result = decide(
      [atom("a")],
      [
        atom("b", {
          sources: [
            {
              candidateId: "candidate-b",
              physicalPageNumber: 2,
              exactText: "Direkter Blitzschlag",
              conditionCheckText: definition,
            },
          ],
        }),
      ]
    );
    expect(result).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
    });
  });
  test("treats different scope and qualifier as not comparable", () => {
    const limit = (side, qualifier) =>
      atom(side, {
        componentId: "coverage_limit",
        componentLabel: "Deckungslimit",
        factRole: "LIMIT",
        coverageEffect: "DEFINED",
        requestedFieldStatus: "COMPLETE",
        requestedFields: ["limit"],
        fields: [
          {
            field: "limit",
            status: "FOUND",
            facts: [
              {
                normalizedValue: "EUR 5.000.000",
                valueType: "MONEY",
                unit: "EUR",
                limitKind: "CAPPED",
                qualifier,
                source: {
                  candidateId: `candidate-${side}`,
                  physicalPageNumber: 2,
                  exactText: "EUR 5.000.000",
                },
              },
            ],
          },
        ],
      });
    expect(
      decide([limit("a", "je Ereignis")], [limit("b", "Jahreshöchstlimit")])
    ).toMatchObject({ outcome: POINT_OUTCOME.NOT_COMPARABLE });
  });

  test("orders only typed comparable limits and deductibles", () => {
    const valuedAtom = (side, factRole, amount) =>
      atom(side, {
        componentId:
          factRole === "LIMIT" ? "coverage_limit" : "policy_deductible",
        componentLabel: factRole === "LIMIT" ? "Deckungslimit" : "Selbstbehalt",
        factRole,
        coverageEffect: "DEFINED",
        requestedFieldStatus: "COMPLETE",
        requestedFields: ["limit"],
        fields: [
          {
            field: "limit",
            status: "FOUND",
            facts: [
              {
                normalizedValue: amount,
                valueType: "MONEY",
                unit: "EUR",
                limitKind: "CAPPED",
                qualifier: "je Schadenfall",
                source: {
                  candidateId: `candidate-${side}`,
                  physicalPageNumber: 2,
                  exactText: amount,
                },
              },
            ],
          },
        ],
      });

    const higherLimit = decide(
      [valuedAtom("a", "LIMIT", "EUR 5.000.000")],
      [valuedAtom("b", "LIMIT", "EUR 3.000.000")]
    );
    expect(higherLimit).toMatchObject({
      outcome: POINT_OUTCOME.ADVANTAGE_A,
      ruleId: "HIGHER_COVERAGE_LIMIT_V1",
    });
    expect(higherLimit.reason).toContain("A EUR 5.000.000");
    expect(higherLimit.reason).toContain("B EUR 3.000.000");
    expect(
      decide(
        [valuedAtom("a", "DEDUCTIBLE", "EUR 1.000")],
        [valuedAtom("b", "DEDUCTIBLE", "EUR 500")]
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.ADVANTAGE_B,
      ruleId: "LOWER_DEDUCTIBLE_V1",
    });

    const conditionalLimit = valuedAtom("conditional", "LIMIT", "EUR 6.000");
    conditionalLimit.documentStatus = "FRAMEWORK_TERMS";
    conditionalLimit.documentApplicability = "CONDITIONAL";
    conditionalLimit.sources = [
      {
        candidateId: "candidate-conditional",
        physicalPageNumber: 2,
        exactText: "Das Limit gilt gegen eine Mehrprämie.",
      },
    ];
    expect(
      decide([conditionalLimit], [valuedAtom("plain", "LIMIT", "EUR 5.000")])
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "CONDITIONAL_OR_EXCEPTION_SCOPE",
      ruleId: "FAIL_CLOSED_CONDITIONAL_SOURCE_V1",
    });

    const conditionalDeductible = valuedAtom(
      "conditional-deductible",
      "DEDUCTIBLE",
      "EUR 1.000"
    );
    conditionalDeductible.documentStatus = "PROPOSAL";
    conditionalDeductible.documentApplicability = "PROPOSED_ONLY";
    conditionalDeductible.sources = [
      {
        candidateId: "candidate-conditional-deductible",
        physicalPageNumber: 2,
        exactText: "Der Selbstbehalt gilt gegen eine Mehrprämie.",
      },
    ];
    expect(
      decide(
        [conditionalDeductible],
        [valuedAtom("plain-deductible", "DEDUCTIBLE", "EUR 500")]
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "CONDITIONAL_OR_EXCEPTION_SCOPE",
    });
  });

  test("compares only active, fieldless VS-10 index-adjustment presence as equal", () => {
    const component = {
      id: "automatic_index_adjustment",
      factRole: "CONDITION",
    };
    const contract = {
      digest: "8".repeat(64),
      componentSatisfactionPolicy: "ALL",
      components: [component],
    };
    const indexAtom = (side, conditionCheckText, overrides = {}) =>
      atom(side, {
        requirementId: "VS-10",
        componentId: component.id,
        componentLabel: "Automatische Indexanpassung der Versicherungssumme",
        factRole: component.factRole,
        coverageEffect: "INCLUDED",
        selectedScopePicture: "GENERAL",
        scopePolicy: "GENERAL_REQUIRED",
        requestedFieldStatus: "NOT_REQUIRED",
        requestedFields: [],
        optionalFields: [],
        requirementContractDigest: contract.digest,
        componentSatisfactionPolicy: contract.componentSatisfactionPolicy,
        declaredComponents: contract.components,
        fields: [],
        sources: [
          {
            candidateId: `candidate-${side}`,
            physicalPageNumber: 2,
            exactText: "Indexvereinbarung",
            conditionCheckText,
          },
        ],
        ...overrides,
      });
    const decideIndex = (left, right) =>
      decidePoint({
        categoryId: "VS-10",
        packageA: packageSummary({ requirementContract: contract }),
        packageB: packageSummary({ requirementContract: contract }),
        atomsA: [left],
        atomsB: [right],
      });
    const activeA =
      "Die Aufwertung der Gebäudeversicherungssummen und Prämien erfolgt nach dem Baukostenindex für den Wohnungs- und Siedlungsbau.";
    const activeB =
      "Wertanpassung nach dem Baukostenindex. Die Versicherungssumme erhöht oder vermindert sich jährlich bei Hauptfälligkeit der Prämie, frühestens jedoch zwei Monate nach Abschluss.";

    expect(
      decideIndex(
        indexAtom("index-a", activeA, {
          documentStatus: "FRAMEWORK_TERMS",
          documentApplicability: "CONDITIONAL",
        }),
        indexAtom("index-b", activeB, {
          documentStatus: "FRAMEWORK_TERMS",
          documentApplicability: "CONDITIONAL",
        })
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      reasonCode: "ALL_ATOMIC_DIMENSIONS_EQUIVALENT",
      ruleId: "AUTOMATIC_INDEX_ADJUSTMENT_PRESENCE_EQUALITY_V1",
      reviewRequired: false,
    });

    for (const [label, rightText] of [
      [
        "trailing negation",
        "Die Versicherungssumme erhöht oder vermindert sich jährlich nicht nach dem Baukostenindex.",
      ],
      [
        "optional",
        "Die Versicherungssumme kann auf Antrag jährlich nach dem Baukostenindex angepasst werden.",
      ],
      [
        "premium only",
        "Die Prämie wird jährlich automatisch nach dem Baukostenindex angepasst.",
      ],
      [
        "manual",
        "Die Versicherungssumme wird nach einer manuellen Neubewertung anhand des Baukostenindex neu festgesetzt.",
      ],
      [
        "historical",
        "Historisch wurde die Versicherungssumme jährlich nach dem Baukostenindex angepasst.",
      ],
      [
        "wrong object",
        "Die Hausratversicherungssumme wird jährlich automatisch nach dem Baukostenindex angepasst.",
      ],
      ["heading only", "Indexvereinbarung zur Versicherungssumme"],
    ]) {
      expect(
        decideIndex(
          indexAtom("control-a", activeA),
          indexAtom(label, rightText)
        ).outcome
      ).not.toBe(POINT_OUTCOME.EQUIVALENT);
    }

    expect(
      decideIndex(
        indexAtom("effect-a", activeA),
        indexAtom("effect-b", activeB, { coverageEffect: "CONDITIONAL" })
      ).outcome
    ).not.toBe(POINT_OUTCOME.EQUIVALENT);
    expect(
      decideIndex(
        indexAtom("component-a", activeA),
        indexAtom("component-b", activeB, {
          componentId: "other_condition",
        })
      ).outcome
    ).not.toBe(POINT_OUTCOME.EQUIVALENT);
  });

  test("rejects mixed active and inactive VS-10 comparison contributors", () => {
    const component = {
      id: "automatic_index_adjustment",
      factRole: "CONDITION",
    };
    const contract = {
      digest: "9".repeat(64),
      componentSatisfactionPolicy: "ALL",
      components: [component],
    };
    const indexAtom = (side, text, documentUuid) =>
      atom(side, {
        requirementId: "VS-10",
        componentId: component.id,
        componentLabel: "Automatische Indexanpassung der Versicherungssumme",
        factRole: component.factRole,
        coverageEffect: "INCLUDED",
        documentUuids: [documentUuid],
        documentStatus: "FRAMEWORK_TERMS",
        documentApplicability: "CONDITIONAL",
        selectedScopePicture: "GENERAL",
        scopePolicy: "GENERAL_REQUIRED",
        requestedFieldStatus: "NOT_REQUIRED",
        requestedFields: [],
        optionalFields: [],
        requirementContractDigest: contract.digest,
        componentSatisfactionPolicy: contract.componentSatisfactionPolicy,
        declaredComponents: contract.components,
        fields: [],
        sources: [
          {
            candidateId: `candidate-${side}`,
            physicalPageNumber: 2,
            exactText: "Indexvereinbarung",
            conditionCheckText: text,
          },
        ],
      });
    const active =
      "Die Versicherungssumme erhöht oder vermindert sich jährlich nach dem Baukostenindex.";
    const inactive =
      "Die Versicherungssumme erhöht oder vermindert sich jährlich nicht nach dem Baukostenindex.";
    const result = decidePoint({
      categoryId: "VS-10",
      packageA: packageSummary({ requirementContract: contract }),
      packageB: packageSummary({ requirementContract: contract }),
      atomsA: [indexAtom("active-a", active, "document-a")],
      atomsB: [
        indexAtom("active-b", active, "document-b"),
        indexAtom("inactive-b", inactive, "document-c"),
      ],
    });

    expect(result.outcome).toBe(POINT_OUTCOME.UNCLEAR);
  });

  test("compares only fully typed ST-01 peak-wind definitions as equal", () => {
    const component = {
      id: "storm_wind_speed_definition",
      factRole: "DEFINITION",
    };
    const contract = {
      digest: "7".repeat(64),
      componentSatisfactionPolicy: "ALL",
      components: [component],
    };
    const definitionAtom = (side, value, conditionCheckText) =>
      atom(side, {
        requirementId: "ST-01",
        componentId: component.id,
        componentLabel: "Sturmdefinition anhand der Windgeschwindigkeit",
        factRole: component.factRole,
        coverageEffect: "DEFINED",
        documentStatus: "FRAMEWORK_TERMS",
        documentApplicability: "CONDITIONAL",
        requestedFieldStatus: "COMPLETE",
        requestedFields: ["threshold"],
        requirementContractDigest: contract.digest,
        declaredComponents: contract.components,
        fields: [
          {
            field: "threshold",
            status: "FOUND",
            facts: [
              {
                normalizedValue: value,
                valueType: "TEXT",
                unit: null,
                source: {
                  candidateId: `candidate-${side}`,
                  physicalPageNumber: 2,
                  exactText: value,
                },
              },
            ],
          },
        ],
        sources: [
          {
            candidateId: `candidate-${side}`,
            physicalPageNumber: 2,
            exactText: "Sturmdefinition",
            conditionCheckText,
          },
        ],
      });
    const decideDefinition = (left, right) =>
      decidePoint({
        categoryId: "ST-01",
        packageA: packageSummary({ requirementContract: contract }),
        packageB: packageSummary({ requirementContract: contract }),
        atomsA: [left],
        atomsB: [right],
      });

    expect(
      decideDefinition(
        definitionAtom(
          "storm-a",
          "60 km/h",
          "Sturm ist Wind mit Spitzengeschwindigkeiten von mehr als 60 km/h."
        ),
        definitionAtom(
          "storm-b",
          "60 km/h",
          "Als Sturm gilt Wind mit einer Spitzengeschwindigkeit von mehr als 60 km/h."
        )
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      reasonCode: "ALL_ATOMIC_DIMENSIONS_EQUIVALENT",
      ruleId: "STORM_DEFINITION_THRESHOLD_EQUALITY_V1",
      reviewRequired: false,
    });

    for (const [rightValue, rightText] of [
      [
        "75 km/h",
        "Als Sturm gilt Wind mit einer Spitzengeschwindigkeit von mehr als 75 km/h.",
      ],
      [
        "60 km/h",
        "Als Sturm gilt Wind mit einer Spitzengeschwindigkeit von mindestens 60 km/h.",
      ],
      [
        "60 m/s",
        "Als Sturm gilt Wind mit einer Spitzengeschwindigkeit von mehr als 60 m/s.",
      ],
      [
        "60 km/h",
        "Als Sturm gilt mittlere Windgeschwindigkeit von mehr als 60 km/h.",
      ],
      [
        "60 km/h",
        "Sofern bestätigt, gilt Wind mit einer Spitzengeschwindigkeit von mehr als 60 km/h als Sturm.",
      ],
    ]) {
      expect(
        decideDefinition(
          definitionAtom(
            "control-a",
            "60 km/h",
            "Sturm ist Wind mit Spitzengeschwindigkeiten von mehr als 60 km/h."
          ),
          definitionAtom("control-b", rightValue, rightText)
        ).outcome
      ).not.toBe(POINT_OUTCOME.EQUIVALENT);
    }
  });

  test("recognizes equivalent inclusions and explicit exclusions", () => {
    expect(decide([atom("a")], [atom("b")])).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
    });
    expect(
      decide(
        [atom("a", { coverageEffect: "EXCLUDED" })],
        [atom("b", { coverageEffect: "EXCLUDED" })]
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.EQUIVALENT,
      ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
    });
  });

  test("blocks mixed winners and invalid server-bound sources", () => {
    const second = (side, effect) =>
      atom(side, {
        componentId: "rot_damage",
        componentLabel: "Fäulnisschäden",
        coverageEffect: effect,
      });
    expect(
      decide(
        [atom("a"), second("a", "EXCLUDED")],
        [atom("b", { coverageEffect: "EXCLUDED" }), second("b", "INCLUDED")]
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "MIXED_DIMENSION_WINNERS",
    });
    expect(decide([atom("a", { sources: [] })], [atom("b")])).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "ATOMIC_EVIDENCE_INCOMPLETE",
    });
    const invalidFieldSource = atom("a", {
      factRole: "LIMIT",
      coverageEffect: "DEFINED",
      requestedFieldStatus: "COMPLETE",
      requestedFields: ["limit"],
      fields: [
        {
          field: "limit",
          status: "FOUND",
          facts: [
            {
              normalizedValue: "EUR 5.000.000",
              valueType: "MONEY",
              unit: "EUR",
              limitKind: "CAPPED",
            },
          ],
        },
      ],
    });
    expect(
      decide([invalidFieldSource], [{ ...invalidFieldSource }])
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "ATOMIC_EVIDENCE_INCOMPLETE",
    });
  });

  test("is symmetric and insensitive to duplicate document facts and ordering", () => {
    const a = atom("a", { coverageEffect: "EXCLUDED" });
    const b = atom("b", { coverageEffect: "INCLUDED" });
    expect(decide([a, { ...a }], [b]).outcome).toBe(POINT_OUTCOME.ADVANTAGE_B);
    expect(decide([b], [a]).outcome).toBe(POINT_OUTCOME.ADVANTAGE_A);
  });

  test("compares an ANY row only through the same evidenced alternative", () => {
    const alternative = (side, componentId, coverageEffect = "INCLUDED") =>
      atom(side, {
        requirementId: "LW-22",
        componentId,
        componentLabel: componentId,
        componentSatisfactionPolicy: "ANY",
        declaredComponents: FIXTURE_COMPONENTS,
        coverageEffect,
      });

    expect(
      decide(
        [alternative("a", "garage")],
        [alternative("b", "garage", "EXCLUDED")]
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.ADVANTAGE_A,
      ruleId: "INCLUDED_OVER_EXCLUDED_V1",
    });

    expect(
      decide([alternative("a", "garage")], [alternative("b", "carport")])
    ).toMatchObject({
      outcome: POINT_OUTCOME.NOT_COMPARABLE,
      reasonCode: "ANY_ALTERNATIVE_SCOPE_DIFFERS",
      ruleId: "ANY_COMPONENT_IDENTITY_GATE_V1",
    });
  });

  test("rejects mixed ALL and ANY component contracts", () => {
    expect(
      decide(
        [atom("a", { componentSatisfactionPolicy: "ANY" })],
        [atom("b", { componentSatisfactionPolicy: "ALL" })]
      )
    ).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "REQUIREMENT_CONTRACT_MISMATCH",
    });
  });

  test("rejects different ANY component universes even when both find garage", () => {
    const universeA = [
      { id: "garage", factRole: "DAMAGE" },
      { id: "carport", factRole: "DAMAGE" },
    ];
    const universeB = [
      { id: "garage", factRole: "DAMAGE" },
      { id: "underground_garage", factRole: "DAMAGE" },
    ];
    const a = atom("a", {
      componentId: "garage",
      componentSatisfactionPolicy: "ANY",
      requirementContractDigest: "b".repeat(64),
      declaredComponents: universeA,
    });
    const b = atom("b", {
      componentId: "garage",
      componentSatisfactionPolicy: "ANY",
      requirementContractDigest: "c".repeat(64),
      declaredComponents: universeB,
    });

    expect(decide([a], [b])).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "REQUIREMENT_CONTRACT_MISMATCH",
    });
  });

  test("keeps an incomplete additional ANY alternative review-required", () => {
    const garage = (side) =>
      atom(side, {
        componentId: "garage",
        componentSatisfactionPolicy: "ANY",
      });
    const unsafeCarport = atom("a-carport", {
      componentId: "carport",
      componentSatisfactionPolicy: "ANY",
      sources: [],
    });

    expect(decide([garage("a"), unsafeCarport], [garage("b")])).toMatchObject({
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "ANY_COMPONENT_EVIDENCE_INCOMPLETE",
      reviewRequired: true,
    });
  });
});
