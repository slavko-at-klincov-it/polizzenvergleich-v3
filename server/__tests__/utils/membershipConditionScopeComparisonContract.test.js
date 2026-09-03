const crypto = require("crypto");
const {
  MEMBERSHIP_CONDITION_SCOPE_COMPARISON_REASON_CODE,
  MEMBERSHIP_CONDITION_SCOPE_COMPARISON_RULE_ID,
  MEMBERSHIP_CONDITION_SCOPE_COMPARISON_CONTRACT_ID,
  buildMembershipConditionScopeAuditFromQualificationReplay,
  buildMembershipConditionScopeComparisonAudit,
  buildMembershipConditionScopeQualificationReplay,
  buildMembershipConditionScopeSourceAtomDigestReplay,
  compareBooleanConditionFormulas,
  membershipConditionScopeComparisonDecision,
  validateMembershipConditionScopeComparisonAudit,
  validateMembershipConditionScopeComparisonContract,
} = require("../../utils/policyComparison/membershipConditionScopeComparisonContract");
const { decidePoint } = require("../../utils/policyComparison/pointDecision");
const {
  customerSafeComparisonReadView,
  deriveCustomerMetrics,
  validateCustomerComparison,
} = require("../../utils/policyComparison/customerMetricContract");
const {
  customerResultText,
} = require("../../utils/policyComparison/customerResultPresenter");
const {
  FE_C02_REQUIREMENT_CONTRACT_DIGEST,
  PRODUCT_PROFILE,
} = require("../../utils/policyComparison/productContract");
const {
  PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_CONTRACT_ID,
} = require("../../utils/policyAnalysis/packageActivatedObjectMembershipAuditContract");
const {
  SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_CONTRACT_ID,
  validateCoverageConditionFormulaContract,
} = require("../../utils/policyAnalysis/coverageConditionFormulaEvidenceContract");
const {
  buildMembershipConditionEvidence,
} = require("../../utils/policyAnalysis/objectMembershipEvidenceContract");
const feCatalog = require("../../resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json");

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function formulaEvidenceContract() {
  return JSON.parse(
    JSON.stringify(
      feCatalog.requirements.find(({ id }) => id === "FE-C02")
        .supportingCoverageConditionFormulaEvidenceContracts[0]
    )
  );
}

function contract() {
  return {
    contractId: MEMBERSHIP_CONDITION_SCOPE_COMPARISON_CONTRACT_ID,
    componentId: "photovoltaic_as_damaged_object",
    targetObjectKey: "PHOTOVOLTAIC_INSTALLATION",
    perilScopeKey: "FEUER_INSURANCE",
    directFormulaKey: "GLOBAL_OBJECT_ELIGIBILITY_FOR_SELECTED_SECTION_V1",
    membershipConditionSetKey:
      "BUILDING_MEMBERSHIP_OWNERSHIP_REINSTATEMENT_VALUE_V1",
    membershipSectionPredicateKey: "SECTION_INSURED",
    membershipRequiredPredicateKeys: [
      "BUILDING_OWNER_HAS_PROVABLE_REINSTATEMENT_OBLIGATION",
      "OBJECT_INCLUDED_IN_BUILDING_REPLACEMENT_VALUE",
      "OBJECT_OWNED_BY_BUILDING_OWNER",
    ],
    predicateImplications: [
      {
        antecedentPredicateKey: "OBJECT_OWNED_BY_BUILDING_OWNER",
        consequentPredicateKey:
          "OBJECT_OWNED_BY_POLICYHOLDER_OR_BUILDING_OWNER",
      },
    ],
    comparisonPolicy: "BOOLEAN_IMPLICATION_ALL_VALID_ASSIGNMENTS_V1",
    satisfactionPolicy: "CONTRACT_SCOPE_ONLY_NOT_REAL_WORLD_SATISFACTION_V1",
    documentResolutionPolicy:
      "UNIQUE_COMPLEMENTARY_REFERENCE_IDENTITY_NO_CONTENT_CONFLICT_V1",
    winnerPolicy: "LESS_RESTRICTIVE_PREREQUISITE_FORMULA_WINS_V1",
  };
}

function predicate(predicateKey) {
  return { kind: "PREDICATE", predicateKey };
}

function operator(operatorKey, ...operands) {
  return { kind: "OPERATOR", operator: operatorKey, operands };
}

function directFormulaEvidence() {
  return operator(
    "AND",
    predicate("SECTION_INSURED"),
    operator(
      "OR",
      predicate("OBJECT_OWNED_BY_POLICYHOLDER_OR_BUILDING_OWNER"),
      predicate("ANAPHORIC_CONTRACTUAL_REPLACEMENT_OR_REINSTATEMENT_OBLIGATION")
    )
  );
}

function membershipFormula() {
  return operator(
    "AND",
    predicate("SECTION_INSURED"),
    predicate("BUILDING_OWNER_HAS_PROVABLE_REINSTATEMENT_OBLIGATION"),
    predicate("OBJECT_INCLUDED_IN_BUILDING_REPLACEMENT_VALUE"),
    predicate("OBJECT_OWNED_BY_BUILDING_OWNER")
  );
}

function formulaProof() {
  const evidenceContract = formulaEvidenceContract();
  const body = {
    schemaVersion: 1,
    contractId: SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_CONTRACT_ID,
    evidenceContractDigest: sha256(
      validateCoverageConditionFormulaContract(evidenceContract)
    ),
    documentFingerprint: "2".repeat(64),
    formulaKey: "GLOBAL_OBJECT_ELIGIBILITY_FOR_SELECTED_SECTION_V1",
    sourcePolicy: "GLOBAL_GOVERNOR_BEFORE_TARGETS_V1",
    targetScopePolicy: "GENERAL_DIRECT_TARGET_V1",
    governorSpan: {
      source: "GLOBAL_GOVERNOR_BEFORE_TARGETS_V1",
      physicalPageNumber: 1,
      documentStart: 0,
      documentEnd: 12,
      exactText: "Bedingungen.",
      sha256: "3".repeat(64),
    },
    formula: directFormulaEvidence(),
    targets: [
      {
        candidateId: "candidate-direct",
        physicalPageNumber: 2,
        documentStart: 50,
        documentEnd: 76,
        exactText: "Solar- und Fotovoltaikanlage",
        sha256: "4".repeat(64),
        coverageGovernorSpan: {
          source: "TARGET_COVERAGE_GOVERNOR",
          physicalPageNumber: 2,
          documentStart: 35,
          documentEnd: 49,
          exactText: "Versichert sind",
          sha256: "5".repeat(64),
        },
      },
    ],
    satisfaction: "NOT_EVALUATED",
    readyForDecision: false,
  };
  return { ...body, proofDigest: sha256(body) };
}

function packageMembershipContract() {
  return {
    contractId: PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_CONTRACT_ID,
    targetObjectKey: "PHOTOVOLTAIC_INSTALLATION",
    coveredObjectKey: "BUILDING",
    membershipPath: [
      "PHOTOVOLTAIC_INSTALLATION",
      "BUILDING_TECHNICAL_INSTALLATION",
      "BUILDING",
    ],
    perilScopeKey: "FEUER_INSURANCE",
    referenceFamilyKey: "EABS",
    conditionPolicy: "PRESERVE_SOURCE_CONDITIONS_V1",
    conflictPolicy: "FAIL_CLOSED_SAME_EDGE_EXCLUSION_V1",
    requiredConditionSetKeys: [
      "BUILDING_MEMBERSHIP_OWNERSHIP_REINSTATEMENT_VALUE_V1",
    ],
  };
}

function membershipProof(
  digestCharacter,
  memberObjectKey,
  classObjectKey,
  relation = "MEMBER_OF_CLASS"
) {
  const parent = memberObjectKey === "BUILDING_TECHNICAL_INSTALLATION";
  const exactText = parent
    ? "Haustechnische Anlagen und Adaptierungen sofern sie sich im Eigentum des Gebäudeeigentümers befinden und soweit der Gebäudeeigentümer für die Wiederherstellung nachweislich aufzukommen hat und im Gebäudeneuwert enthalten sind."
    : "Photovoltaikanlagen sind haustechnische Anlagen.";
  const memberText = parent
    ? "Haustechnische Anlagen und Adaptierungen"
    : "Photovoltaikanlagen";
  const memberContextSpan = {
    source: "STRUCTURAL_LIST_ITEM",
    physicalPageNumber: 2,
    documentStart: 100,
    documentEnd: 100 + exactText.length,
    exactText,
    sha256: crypto.createHash("sha256").update(exactText).digest("hex"),
  };
  const memberStart = 100 + exactText.indexOf(memberText);
  const conditionEvidenceContract = feCatalog.requirements.find(
    ({ id }) => id === "FE-C02"
  ).supportingObjectMembershipEvidenceContracts[0].conditionEvidenceContract;
  return {
    proofDigest: digestCharacter.repeat(64),
    documentFingerprint: "7".repeat(64),
    edge: {
      relation,
      memberObjectKey,
      classObjectKey,
      memberContextSpan,
      ...(parent && relation === "MEMBER_OF_CLASS"
        ? {
            conditionEvidence: buildMembershipConditionEvidence({
              contract: conditionEvidenceContract,
              memberContextSpan,
              memberSpan: {
                documentStart: memberStart,
                documentEnd: memberStart + memberText.length,
              },
            }),
          }
        : {}),
    },
  };
}

function commonAtom(document, overrides = {}) {
  return {
    requirementId: "FE-C02",
    componentId: "photovoltaic_as_damaged_object",
    factRole: "INSURED_OBJECT",
    componentSatisfactionPolicy: "ALL",
    evidencePresence: "NOT_FOUND",
    coverageEffect: "UNKNOWN",
    conflictState: "NONE",
    requestedFieldStatus: "NOT_REQUIRED",
    selectedScopePicture: "UNKNOWN",
    scopePolicy: "GENERAL_REQUIRED",
    documentApplicability: "UNKNOWN",
    selectedCandidateIds: [],
    unresolvedCandidateIds: [],
    sources: [],
    documentUuids: [document.uuid],
    documentRole: document.role,
    documentStatus: document.documentStatus,
    declaredComponents: [
      {
        id: "photovoltaic_as_damaged_object",
        factRole: "INSURED_OBJECT",
      },
    ],
    packageActivatedObjectMembershipAuditContract: packageMembershipContract(),
    supportingCoverageConditionFormulaEvidenceContracts: [
      formulaEvidenceContract(),
    ],
    membershipConditionScopeComparisonContract: contract(),
    requirementContractDigest: FE_C02_REQUIREMENT_CONTRACT_DIGEST,
    ...overrides,
  };
}

function directAtom(document) {
  return commonAtom(document, {
    evidencePresence: "FOUND",
    coverageEffect: "INCLUDED",
    selectedScopePicture: "GENERAL",
    documentApplicability: "ACTIVE",
    selectedCandidateIds: ["candidate-direct"],
    sources: [
      {
        candidateId: "candidate-direct",
        candidateBinding: "DIRECT",
        physicalPageNumber: 2,
        exactText: "Solar- und Fotovoltaikanlage",
      },
    ],
    supportingCoverageConditionFormulaProofs: [formulaProof()],
  });
}

function membershipAtoms(referenceDocument, termsDocument) {
  return [
    commonAtom(referenceDocument, {
      supportingScopedPackageReferenceProofs: [
        {
          proofDigest: "a".repeat(64),
          documentFingerprint: "6".repeat(64),
          perilScopeKey: "FEUER_INSURANCE",
          coveredObjectKey: "BUILDING",
          reference: { familyKey: "EABS", referenceKey: "EABS@2023" },
        },
      ],
    }),
    commonAtom(termsDocument, {
      evidencePresence: "FOUND",
      coverageEffect: "DEFINED",
      selectedScopePicture: "GENERAL",
      documentApplicability: "CONDITIONAL",
      selectedCandidateIds: ["candidate-membership"],
      sources: [
        {
          candidateId: "candidate-membership",
          candidateBinding: "DIRECT",
          physicalPageNumber: 2,
          exactText: "Photovoltaikanlagen sind haustechnische Anlagen.",
          objectMembershipProof: membershipProof(
            "c",
            "PHOTOVOLTAIC_INSTALLATION",
            "BUILDING_TECHNICAL_INSTALLATION"
          ),
        },
      ],
      supportingObjectMembershipProofs: [
        membershipProof("d", "BUILDING_TECHNICAL_INSTALLATION", "BUILDING"),
      ],
      supportingReferencedTermsIdentityProofs: [
        {
          proofDigest: "b".repeat(64),
          documentFingerprint: "7".repeat(64),
          reference: { familyKey: "EABS", referenceKey: "EABS@2023" },
        },
      ],
    }),
  ];
}

function fixture({ swap = false } = {}) {
  const directDocument = {
    uuid: "direct-document",
    side: swap ? "B" : "A",
    role: "POLICY",
    documentStatus: "ACTIVE",
    sha256: "2".repeat(64),
  };
  const referenceDocument = {
    uuid: "reference-document",
    side: swap ? "A" : "B",
    role: "PROPOSAL",
    documentStatus: "PROPOSAL",
    sha256: "6".repeat(64),
  };
  const termsDocument = {
    uuid: "terms-document",
    side: swap ? "A" : "B",
    role: "TERMS",
    documentStatus: "FRAMEWORK_TERMS",
    sha256: "7".repeat(64),
  };
  const directAtoms = [directAtom(directDocument)];
  const definedAtoms = membershipAtoms(referenceDocument, termsDocument);
  const directPackage = {
    reviewStatus: "BELEGT",
    evidenceFound: true,
    facts: [{ documentUuid: directDocument.uuid, reviewStatus: "BELEGT" }],
  };
  const definedPackage = {
    reviewStatus: "TEILBELEGT",
    evidenceFound: true,
    facts: [{ documentUuid: termsDocument.uuid, reviewStatus: "TEILBELEGT" }],
  };
  return swap
    ? {
        categoryId: "FE-C02",
        packageA: definedPackage,
        packageB: directPackage,
        atomsA: definedAtoms,
        atomsB: directAtoms,
        contract: contract(),
        expectedDocumentsA: [referenceDocument, termsDocument],
        expectedDocumentsB: [directDocument],
      }
    : {
        categoryId: "FE-C02",
        packageA: directPackage,
        packageB: definedPackage,
        atomsA: directAtoms,
        atomsB: definedAtoms,
        contract: contract(),
        expectedDocumentsA: [directDocument],
        expectedDocumentsB: [referenceDocument, termsDocument],
      };
}

describe("membership condition-scope comparison contract", () => {
  test("proves B implies A but A does not imply B by complete valuation", () => {
    const comparison = compareBooleanConditionFormulas({
      leftFormula: directFormulaEvidence(),
      rightFormula: membershipFormula(),
      predicateImplications: contract().predicateImplications,
    });

    expect(comparison).toMatchObject({
      comparisonPolicy: "BOOLEAN_IMPLICATION_ALL_VALID_ASSIGNMENTS_V1",
      leftImpliesRight: false,
      rightImpliesLeft: true,
      relationship: "LEFT_STRICTLY_BROADER",
    });
    expect(comparison.validValuationCount).toBeGreaterThan(0);
    expect(comparison.leftNotRightWitness).not.toBeNull();
    expect(comparison.rightNotLeftWitness).toBeNull();
  });

  test("builds a complete outcome-neutral audit from direct and membership sources", () => {
    const value = fixture();
    const audit = buildMembershipConditionScopeComparisonAudit(value);

    expect(audit).toMatchObject({
      contractId: "MEMBERSHIP_CONDITION_SCOPE_COMPARISON_AUDIT_V1",
      categoryId: "FE-C02",
      directSide: "A",
      membershipSide: "B",
      broaderConditionScopeSide: "A",
      narrowerConditionScopeSide: "B",
      satisfaction: "NOT_EVALUATED",
      comparisonComplete: true,
      readyForDecision: true,
      packageReviewAudit: {
        blockers: [
          {
            code: "COVERAGE_EFFECT_NOT_DECISIVE",
            side: "B",
            componentId: "photovoltaic_as_damaged_object",
          },
        ],
      },
      formulaComparison: {
        leftImpliesRight: false,
        rightImpliesLeft: true,
        relationship: "LEFT_STRICTLY_BROADER",
      },
      sides: {
        A: { mode: "DIRECT_INCLUDED_SOURCE_FORMULA" },
        B: {
          mode: "MEMBERSHIP_DEFINED_TYPED_CONDITIONS",
          membershipConditionSetKey:
            "BUILDING_MEMBERSHIP_OWNERSHIP_REINSTATEMENT_VALUE_V1",
          documentResolution: {
            status:
              "UNIQUE_COMPLEMENTARY_REFERENCE_IDENTITY_NO_CONTENT_CONFLICT",
            referenceKey: "EABS@2023",
          },
        },
      },
    });
    expect(audit).not.toHaveProperty("outcome");
    expect(audit).not.toHaveProperty("reasonCode");
    expect(audit.auditDigestSha256).toMatch(/^[a-f0-9]{64}$/u);

    const sourceAtomDigestReplay =
      buildMembershipConditionScopeSourceAtomDigestReplay(value);
    expect(
      validateMembershipConditionScopeComparisonAudit(audit, {
        ...value,
        atomsA: undefined,
        atomsB: undefined,
        sourceAtomDigestReplay,
      })
    ).toBe(true);
  });

  test("keeps the comparison symmetric when package A and B are swapped", () => {
    const audit = buildMembershipConditionScopeComparisonAudit(
      fixture({ swap: true })
    );
    expect(audit).toMatchObject({
      directSide: "B",
      membershipSide: "A",
      broaderConditionScopeSide: "B",
      narrowerConditionScopeSide: "A",
      packageReviewAudit: {
        blockers: [{ code: "COVERAGE_EFFECT_NOT_DECISIVE", side: "A" }],
      },
    });
  });

  test("turns only the complete audit into a side-symmetric condition-scope advantage", () => {
    const inputA = fixture();
    const decisionA = decidePoint(inputA);
    expect(decisionA).toMatchObject({
      outcome: "VORTEIL_A",
      reasonCode: MEMBERSHIP_CONDITION_SCOPE_COMPARISON_REASON_CODE,
      ruleId: MEMBERSHIP_CONDITION_SCOPE_COMPARISON_RULE_ID,
      reviewRequired: false,
      membershipConditionScopeComparisonAudit: {
        broaderConditionScopeSide: "A",
      },
    });
    expect(decisionA.reason).not.toMatch(/nicht gedeckt/iu);
    expect(decisionA.reason).toContain(
      "ein ausdrücklicher Ausschluss oder die konkrete Nichterfüllung"
    );

    const inputB = fixture({ swap: true });
    expect(decidePoint(inputB)).toMatchObject({
      outcome: "VORTEIL_B",
      reasonCode: MEMBERSHIP_CONDITION_SCOPE_COMPARISON_REASON_CODE,
      ruleId: MEMBERSHIP_CONDITION_SCOPE_COMPARISON_RULE_ID,
      reviewRequired: false,
      membershipConditionScopeComparisonAudit: {
        broaderConditionScopeSide: "B",
      },
    });
  });

  test("replays the customer decision and removes the private qualification replay", () => {
    const input = fixture();
    const audit = buildMembershipConditionScopeComparisonAudit(input);
    const pointDecision = membershipConditionScopeComparisonDecision(audit);
    const qualificationReplay =
      buildMembershipConditionScopeQualificationReplay({
        ...input,
        categoryView: "FE",
      });
    expect(
      buildMembershipConditionScopeAuditFromQualificationReplay({
        replay: qualificationReplay,
        packageA: input.packageA,
        packageB: input.packageB,
        expectedDocumentsA: input.expectedDocumentsA,
        expectedDocumentsB: input.expectedDocumentsB,
      })
    ).toEqual(audit);
    const categories = [
      {
        categoryView: "FE",
        rows: [
          {
            categoryId: "FE-C02",
            outcome: "UNTERSCHIED_FACHLICH_PRÜFEN",
            packageA: input.packageA,
            packageB: input.packageB,
            pointDecision,
            membershipConditionScopeQualificationReplay: qualificationReplay,
          },
        ],
      },
    ];
    const result = {
      schemaVersion: 13,
      status: "COMPARISON_RESULT_MATERIALIZED",
      productProfile: PRODUCT_PROFILE,
      documents: [...input.expectedDocumentsA, ...input.expectedDocumentsB],
      categories,
      totals: deriveCustomerMetrics(categories),
    };

    expect(validateCustomerComparison(result)).toMatchObject({
      customerReviewRequired: 0,
      pointDecisions: { VORTEIL_A: 1 },
    });
    const customerRow =
      customerSafeComparisonReadView(result).categories[0].rows[0];
    expect(customerRow).not.toHaveProperty(
      "membershipConditionScopeQualificationReplay"
    );
    expect(customerResultText(customerRow)).toContain("Vorteil Polizze A:");
    expect(customerResultText(customerRow)).not.toMatch(/nicht gedeckt/iu);

    const tampered = JSON.parse(JSON.stringify(result));
    tampered.categories[0].rows[0].pointDecision.membershipConditionScopeComparisonAudit.formulaComparison.relationship =
      "EQUIVALENT";
    expect(() => validateCustomerComparison(tampered)).toThrow(
      "COMPARISON_FE_C02_CONDITION_SCOPE_DECISION_OMISSION"
    );

    const omitted = JSON.parse(JSON.stringify(result));
    omitted.categories[0].rows[0].pointDecision = {
      schemaVersion: 3,
      outcome: "UNKLAR",
      reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
      reason: "Unklar: alter generischer Paket-Prüfstatus.",
      reviewRequired: true,
      ruleId: "FAIL_CLOSED_V1",
      dimensions: [],
      packageReviewAudit: audit.packageReviewAudit,
    };
    omitted.totals = deriveCustomerMetrics(omitted.categories);
    expect(() => validateCustomerComparison(omitted)).toThrow(
      "COMPARISON_FE_C02_CONDITION_SCOPE_DECISION_OMISSION"
    );

    const missingReplay = JSON.parse(JSON.stringify(result));
    delete missingReplay.categories[0].rows[0]
      .membershipConditionScopeQualificationReplay;
    expect(() => validateCustomerComparison(missingReplay)).toThrow(
      "COMPARISON_FE_C02_QUALIFICATION_REPLAY_REQUIRED"
    );

    const replayTamper = JSON.parse(JSON.stringify(result));
    replayTamper.categories[0].rows[0].membershipConditionScopeQualificationReplay.projectedAtomsBySide.A[0].coverageEffect =
      "EXCLUDED";
    expect(() => validateCustomerComparison(replayTamper)).toThrow(
      "COMPARISON_FE_C02_QUALIFICATION_REPLAY_INVALID"
    );
  });

  test("persists qualification inputs even when FE-C02 is not decision-ready", () => {
    const input = fixture();
    input.atomsB[1].unresolvedCandidateIds = ["candidate-unresolved"];
    const replay = buildMembershipConditionScopeQualificationReplay({
      ...input,
      categoryView: "FE",
    });

    expect(replay).toMatchObject({
      schemaVersion: 2,
      categoryView: "FE",
      categoryId: "FE-C02",
      projectedAtomsBySide: { A: expect.any(Array), B: expect.any(Array) },
    });
    expect(
      buildMembershipConditionScopeAuditFromQualificationReplay({
        replay,
        packageA: input.packageA,
        packageB: input.packageB,
        expectedDocumentsA: input.expectedDocumentsA,
        expectedDocumentsB: input.expectedDocumentsB,
      })
    ).toBeNull();
  });

  test("rejects a rehashed qualification replay with a non-canonical contract", () => {
    const input = fixture();
    const replay = buildMembershipConditionScopeQualificationReplay({
      ...input,
      categoryView: "FE",
    });
    replay.projectedAtomsBySide.A[0].membershipConditionScopeComparisonContract.winnerPolicy =
      "TAMPERED_POLICY";
    replay.comparisonContractDigestSha256 = sha256(
      replay.projectedAtomsBySide.A[0]
        .membershipConditionScopeComparisonContract
    );
    replay.projectedAtomDigestsSha256.A = sha256(replay.projectedAtomsBySide.A);
    const { replayDigestSha256: _discarded, ...body } = replay;
    replay.replayDigestSha256 = sha256(body);

    expect(() =>
      buildMembershipConditionScopeAuditFromQualificationReplay({
        replay,
        packageA: input.packageA,
        packageB: input.packageB,
        expectedDocumentsA: input.expectedDocumentsA,
        expectedDocumentsB: input.expectedDocumentsB,
      })
    ).toThrow("MEMBERSHIP_CONDITION_SCOPE_QUALIFICATION_REPLAY_INVALID");
  });

  test("rejects the private FE-C02 replay on another category row", () => {
    const input = fixture();
    const qualificationReplay =
      buildMembershipConditionScopeQualificationReplay({
        ...input,
        categoryView: "FE",
      });
    const categories = [
      {
        categoryView: "VS",
        rows: [
          {
            categoryId: "VS-01",
            outcome: "UNTERSCHIED_FACHLICH_PRÜFEN",
            packageA: input.packageA,
            packageB: input.packageB,
            pointDecision: membershipConditionScopeComparisonDecision(
              buildMembershipConditionScopeComparisonAudit(input)
            ),
            membershipConditionScopeQualificationReplay: qualificationReplay,
          },
        ],
      },
    ];
    const result = {
      schemaVersion: 13,
      status: "COMPARISON_RESULT_MATERIALIZED",
      productProfile: PRODUCT_PROFILE,
      documents: [...input.expectedDocumentsA, ...input.expectedDocumentsB],
      categories,
      totals: deriveCustomerMetrics(categories),
    };

    expect(() => validateCustomerComparison(result)).toThrow(
      "COMPARISON_FE_C02_QUALIFICATION_REPLAY_ORPHANED"
    );
  });

  test("uses document role and status only as consistency metadata", () => {
    const value = fixture();
    value.expectedDocumentsA[0].role = "PROPOSAL";
    value.expectedDocumentsA[0].documentStatus = "PROPOSAL";
    value.atomsA[0].documentRole = "PROPOSAL";
    value.atomsA[0].documentStatus = "PROPOSAL";
    value.atomsA[0].documentApplicability = "PROPOSED_ONLY";
    const audit = buildMembershipConditionScopeComparisonAudit(value);
    expect(audit).toMatchObject({
      directSide: "A",
      broaderConditionScopeSide: "A",
      sides: {
        A: {
          documentManifest: [{ role: "PROPOSAL", documentStatus: "PROPOSAL" }],
        },
      },
    });
  });

  test("rejects an additional package blocker", () => {
    const value = fixture();
    value.atomsB[1].unresolvedCandidateIds = ["candidate-unresolved"];
    expect(buildMembershipConditionScopeComparisonAudit(value)).toBeNull();
  });

  test("fails closed for formula, condition and edition tampering", () => {
    const formulaTamper = fixture();
    formulaTamper.atomsA[0].supportingCoverageConditionFormulaProofs[0].formula.operands[1].operator =
      "AND";
    const tamperedFormulaBody = {
      ...formulaTamper.atomsA[0].supportingCoverageConditionFormulaProofs[0],
    };
    delete tamperedFormulaBody.proofDigest;
    formulaTamper.atomsA[0].supportingCoverageConditionFormulaProofs[0].proofDigest =
      sha256(tamperedFormulaBody);
    expect(
      buildMembershipConditionScopeComparisonAudit(formulaTamper)
    ).toBeNull();

    const formulaContractTamper = fixture();
    formulaContractTamper.atomsA[0].supportingCoverageConditionFormulaEvidenceContracts[0].formula.operands[1].operator =
      "AND";
    expect(
      buildMembershipConditionScopeComparisonAudit(formulaContractTamper)
    ).toBeNull();

    const conditionTamper = fixture();
    conditionTamper.atomsB[1].supportingObjectMembershipProofs[0].edge.conditionEvidence.predicates.pop();
    expect(
      buildMembershipConditionScopeComparisonAudit(conditionTamper)
    ).toBeNull();

    const editionTamper = fixture();
    editionTamper.atomsB[1].supportingReferencedTermsIdentityProofs[0].reference.referenceKey =
      "EABS@2024";
    expect(
      buildMembershipConditionScopeComparisonAudit(editionTamper)
    ).toBeNull();
  });

  test("rejects document metadata tamper without using role or status as winner policy", () => {
    const value = fixture();
    value.expectedDocumentsB[1].role = "ENDORSEMENT";
    expect(buildMembershipConditionScopeComparisonAudit(value)).toBeNull();
  });

  test("rejects a proof that is not bound to the expected document fingerprint", () => {
    const value = fixture();
    value.expectedDocumentsA[0].sha256 = "9".repeat(64);
    expect(buildMembershipConditionScopeComparisonAudit(value)).toBeNull();
  });

  test("fails closed when atom contract binding or requirement digest differs", () => {
    const contractTamper = fixture();
    contractTamper.atomsB[0].membershipConditionScopeComparisonContract.winnerPolicy =
      "TAMPERED";
    expect(
      buildMembershipConditionScopeComparisonAudit(contractTamper)
    ).toBeNull();

    const digestTamper = fixture();
    digestTamper.atomsB[0].requirementContractDigest = "e".repeat(64);
    expect(
      buildMembershipConditionScopeComparisonAudit(digestTamper)
    ).toBeNull();

    const missingDigest = fixture();
    delete missingDigest.atomsB[0].requirementContractDigest;
    expect(
      buildMembershipConditionScopeComparisonAudit(missingDigest)
    ).toBeNull();

    const consistentlyForeignDigest = fixture();
    for (const atom of [
      ...consistentlyForeignDigest.atomsA,
      ...consistentlyForeignDigest.atomsB,
    ])
      atom.requirementContractDigest = "e".repeat(64);
    expect(
      buildMembershipConditionScopeComparisonAudit(consistentlyForeignDigest)
    ).toBeNull();
    expect(decidePoint(consistentlyForeignDigest)).not.toMatchObject({
      ruleId: MEMBERSHIP_CONDITION_SCOPE_COMPARISON_RULE_ID,
    });
    expect(
      buildMembershipConditionScopeQualificationReplay({
        ...consistentlyForeignDigest,
        categoryView: "FE",
      })
    ).toBeNull();

    const shapeTamper = fixture();
    shapeTamper.atomsA[0].declaredComponents[0].factRole = "COVERAGE";
    expect(
      buildMembershipConditionScopeComparisonAudit(shapeTamper)
    ).toBeNull();
  });

  test("validates the side-neutral catalog contract and canonical implications", () => {
    expect(
      validateMembershipConditionScopeComparisonContract(contract())
    ).toEqual(contract());
    const nonCanonical = contract();
    nonCanonical.membershipRequiredPredicateKeys.reverse();
    expect(() =>
      validateMembershipConditionScopeComparisonContract(nonCanonical)
    ).toThrow("MEMBERSHIP_CONDITION_SCOPE_PREDICATES_INVALID");
  });

  test("rejects audit and source-atom replay tampering", () => {
    const value = fixture();
    const audit = buildMembershipConditionScopeComparisonAudit(value);
    const sourceAtomDigestReplay =
      buildMembershipConditionScopeSourceAtomDigestReplay(value);
    audit.sides.A.projectedAtoms[0].coverageEffect = "EXCLUDED";
    expect(() =>
      validateMembershipConditionScopeComparisonAudit(audit, {
        ...value,
        atomsA: undefined,
        atomsB: undefined,
        sourceAtomDigestReplay,
      })
    ).toThrow("MEMBERSHIP_CONDITION_SCOPE_SOURCE_REPLAY_MISMATCH");
  });
});
