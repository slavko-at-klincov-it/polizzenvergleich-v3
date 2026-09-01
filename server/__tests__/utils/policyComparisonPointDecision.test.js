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
    documentStatus: "FRAMEWORK_TERMS",
    selectedCandidateIds: [candidateId],
    unresolvedCandidateIds: [],
    requestedFieldStatus: "NOT_REQUIRED",
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
    packageA:
      overrides.packageA || scopeLimitPackage("a", "BELEGT"),
    packageB:
      overrides.packageB || scopeLimitPackage("b", "TEILBELEGT"),
    atomsA,
    atomsB,
  });
}

describe("policy comparison point decision", () => {
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

  test("prefers explicit inclusion over a complete package-wide absence without inventing an exclusion", () => {
    const result = decide([atom("a")], [], {
      packageB: {
        evidenceFound: false,
        reviewStatus: "NICHT_GEFUNDEN_NACH_VOLLSTÄNDIGER_PRÜFUNG",
        searchDisposition: "NOT_FOUND_AFTER_COMPLETE_SEARCH",
        comparisonTreatment: "ASSUMED_NOT_INCLUDED_V1",
        searchAudit: { documentCount: 2, physicalPagesChecked: 80 },
      },
    });

    expect(result).toMatchObject({
      schemaVersion: 3,
      outcome: POINT_OUTCOME.ADVANTAGE_A,
      reasonCode: "EXPLICIT_INCLUDED_OVER_VERIFIED_ABSENCE",
      ruleId: "INCLUDED_OVER_ASSUMED_NOT_INCLUDED_V1",
      reviewRequired: false,
    });
    expect(result.reason).toContain(
      "vollständig geprüften bereitgestellten Paket B"
    );
    expect(result.reason).toContain(
      "ausdrücklicher Ausschluss in Paket B ist damit nicht belegt"
    );
  });

  test("reports no documented advantage when both packages have a complete absence", () => {
    const completeAbsence = {
      evidenceFound: false,
      reviewStatus: "NICHT_GEFUNDEN_NACH_VOLLSTÄNDIGER_PRÜFUNG",
      searchDisposition: "NOT_FOUND_AFTER_COMPLETE_SEARCH",
      comparisonTreatment: "ASSUMED_NOT_INCLUDED_V1",
    };
    const result = decide([], [], {
      packageA: completeAbsence,
      packageB: completeAbsence,
    });

    expect(result).toMatchObject({
      outcome: POINT_OUTCOME.NO_DOCUMENTED_ADVANTAGE,
      ruleId: "COMPLETE_SEARCH_ABSENCE_BOTH_V1",
      reviewRequired: false,
    });
    expect(result.reason).toContain(
      "weder ein Nachweis ausdrücklicher Gleichheit"
    );
  });

  test("reports a documentation difference when complete absence faces evidence without an advantage rule", () => {
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
        outcome: POINT_OUTCOME.DOCUMENTATION_DIFFERENCE,
        reasonCode: "QUALIFIED_SEARCH_DOCUMENTATION_DIFFERENCE",
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
    for (const documentApplicability of [
      "CONDITIONAL",
      "PROPOSED_ONLY",
      "UNKNOWN",
    ]) {
      expect(
        decide([atom("a", { documentApplicability })], [], {
          packageB: completeAbsence,
        })
      ).toMatchObject({
        outcome: POINT_OUTCOME.DOCUMENTATION_DIFFERENCE,
        ruleId: "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V1",
      });
    }
  });

  test("treats a general controlled zero match as documentation-only", () => {
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
      outcome: POINT_OUTCOME.DOCUMENTATION_DIFFERENCE,
      comparisonTreatment: "DOCUMENTATION_ONLY_V1",
      reviewRequired: false,
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
          schemaVersion: 1,
          contractId: "PACKAGE_REVIEW_BLOCKERS_V1",
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
        }),
      ],
      atomsB: [
        scopeLimitAtom("b", "NARROW_ONLY", {
          documentApplicability: "ACTIVE",
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
        schemaVersion: 1,
        contractId: "PACKAGE_REVIEW_BLOCKERS_V1",
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
      expect(result.reason).toContain("Bedingung oder Ausnahme");
    }
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
  test("treats different applicability, scope and qualifier as not comparable", () => {
    expect(
      decide(
        [atom("a")],
        [atom("b", { documentApplicability: "PROPOSED_ONLY" })]
      )
    ).toMatchObject({ outcome: POINT_OUTCOME.NOT_COMPARABLE });

    const limit = (side, qualifier) =>
      atom(side, {
        componentId: "coverage_limit",
        componentLabel: "Deckungslimit",
        factRole: "LIMIT",
        coverageEffect: "DEFINED",
        requestedFieldStatus: "COMPLETE",
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
