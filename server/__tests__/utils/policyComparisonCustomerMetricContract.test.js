const {
  METRIC_CONTRACT_ID,
  customerSafeComparisonReadView,
  deriveCustomerMetrics,
  validateCustomerComparison,
} = require("../../utils/policyComparison/customerMetricContract");
const {
  NARROW_ALIAS_PRODUCT_PROFILE_IDENTITY,
  PREVIOUS_PRODUCT_PROFILE_IDENTITY,
  PRODUCT_PROFILE,
  SOURCE_BOUND_TRIAGE_PRODUCT_PROFILE_IDENTITY,
  STRUCTURAL_CONCEPT_CONTEXT_PRODUCT_PROFILE_IDENTITY,
} = require("../../utils/policyComparison/productContract");
const {
  derivePackageReviewAudit,
} = require("../../utils/policyComparison/packageReviewAudit");
const {
  CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT,
} = require("../../utils/policyComparison/customerResultRuleOutcomeContract");
const {
  buildPackageActivatedObjectMembershipAudit,
} = require("../../utils/policyAnalysis/packageActivatedObjectMembershipAuditContract");

function row(
  categoryId,
  outcome,
  legacyOutcome = "UNTERSCHIED_FACHLICH_PRÜFEN",
  reasonCode = outcome === "UNKLAR" ? "MISSING_ONE_SIDE" : "TEST_DECISION"
) {
  return {
    categoryId,
    outcome: legacyOutcome,
    pointDecision: {
      outcome,
      reasonCode,
      reviewRequired: outcome === "UNKLAR",
    },
  };
}

function resultFor(rows) {
  const categories = [{ categoryView: "VS", rows }];
  return {
    schemaVersion: 6,
    status: "COMPARISON_RESULT_MATERIALIZED",
    categories,
    totals: deriveCustomerMetrics(categories),
  };
}

function schema15SimpleResult() {
  const result = resultFor([
    row("VS-03", "GLEICHWERTIG", "INHALTLICH_GLEICH", "EQUAL_COVERAGE"),
  ]);
  result.schemaVersion = 15;
  result.productProfile = PRODUCT_PROFILE;
  result.customerResultRuleOutcomeContract = {
    schemaVersion: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.schemaVersion,
    contractId: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.contractId,
  };
  result.categories[0].rows[0].pointDecision.ruleId =
    "ATOMIC_COVERAGE_EQUALITY_V1";
  return result;
}

function packageAuditBlocker(code, documentUuid = "document-a") {
  return {
    code,
    side: "A",
    level: "PACKAGE",
    requirementId: "VS-01",
    componentId: null,
    factRole: null,
    documentUuids: [documentUuid],
    observed: null,
  };
}

function schema7PackageResult() {
  const reviewRow = row(
    "VS-01",
    "UNKLAR",
    "UNTERSCHIED_FACHLICH_PRÜFEN",
    "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION"
  );
  reviewRow.packageA = { reviewStatus: "TEILBELEGT" };
  reviewRow.packageB = { reviewStatus: "BELEGT" };
  reviewRow.pointDecision.packageReviewAudit = {
    schemaVersion: 1,
    contractId: "PACKAGE_REVIEW_BLOCKERS_V1",
    packageStatuses: { A: "TEILBELEGT", B: "BELEGT" },
    blockers: [packageAuditBlocker("UNCLASSIFIED_DOCUMENT_REVIEW_BLOCKER")],
    signals: [],
  };
  const result = resultFor([reviewRow]);
  result.schemaVersion = 7;
  result.productProfile = {
    id: "CUSTOMER_CORE_5_V8_OPTIONALITY_GUARD",
    comparisonContractId: "OPTIONALITY_GUARDED_TYPED_V1",
  };
  result.documents = [
    { uuid: "document-a", side: "A" },
    { uuid: "document-b", side: "B" },
  ];
  return result;
}

function currentFeC02PackageResult() {
  const activatedContract = {
    contractId: "PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_V2",
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
  const atomA = {
    requirementId: "FE-C02",
    documentUuids: ["document-a"],
    conflictState: "NONE",
    unresolvedCandidateIds: [],
    packageActivatedObjectMembershipAuditContract: activatedContract,
  };
  const atomB = {
    requirementId: "FE-C02",
    componentId: "photovoltaic_as_damaged_object",
    factRole: "INSURED_OBJECT",
    documentUuids: ["document-b"],
    evidencePresence: "FOUND",
    coverageEffect: "DEFINED",
    conflictState: "NONE",
    requestedFieldStatus: "NOT_REQUIRED",
    selectedScopePicture: "GENERAL",
    scopePolicy: "GENERAL_REQUIRED",
    documentApplicability: "CONDITIONAL",
    documentRole: "TERMS",
    documentStatus: "FRAMEWORK_TERMS",
    selectedCandidateIds: ["candidate-b"],
    unresolvedCandidateIds: [],
    sources: [
      {
        candidateId: "candidate-b",
        physicalPageNumber: 1,
        exactText: "Photovoltaikanlagen",
      },
    ],
    packageActivatedObjectMembershipAuditContract: activatedContract,
  };
  const packageA = { coverage: "Ja", reviewStatus: "BELEGT", facts: [] };
  const packageB = {
    coverage: "Nicht feststellbar",
    reviewStatus: "TEILBELEGT",
    facts: [
      {
        documentUuid: "document-b",
        reviewStatus: "TEILBELEGT",
      },
    ],
  };
  const reviewRow = row(
    "FE-C02",
    "UNKLAR",
    "UNTERSCHIED_FACHLICH_PRÜFEN",
    "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION"
  );
  reviewRow.packageA = packageA;
  reviewRow.packageB = packageB;
  reviewRow.pointDecision = {
    ...reviewRow.pointDecision,
    schemaVersion: 3,
    ruleId: "FAIL_CLOSED_V1",
    dimensions: [],
    packageReviewAudit: derivePackageReviewAudit({
      categoryId: "FE-C02",
      packageA,
      packageB,
      atomsA: [atomA],
      atomsB: [atomB],
    }),
    packageActivatedObjectMembershipAudit: {
      A: buildPackageActivatedObjectMembershipAudit({
        categoryId: "FE-C02",
        atoms: [atomA],
      }),
      B: buildPackageActivatedObjectMembershipAudit({
        categoryId: "FE-C02",
        atoms: [atomB],
      }),
    },
  };
  const categories = [{ categoryView: "FE", rows: [reviewRow] }];
  return {
    schemaVersion: 11,
    status: "COMPARISON_RESULT_MATERIALIZED",
    productProfile: PRODUCT_PROFILE,
    documents: [
      { uuid: "document-a", side: "A", sha256: "a".repeat(64) },
      { uuid: "document-b", side: "B", sha256: "b".repeat(64) },
    ],
    categories,
    totals: deriveCustomerMetrics(categories),
  };
}

describe("policy comparison customer metric contract", () => {
  test("derives customer review only from unclear point decisions", () => {
    const result = resultFor([
      row("VS-01", "UNKLAR"),
      row("VS-02", "DOKUMENTATIONSUNTERSCHIED"),
      row("VS-03", "KEIN_DOKUMENTIERTER_VORTEIL", "BEIDSEITIG_KEIN_BELEG"),
    ]);

    expect(result.totals).toMatchObject({
      metricContractId: METRIC_CONTRACT_ID,
      rows: 3,
      customerReviewRequired: 1,
      noCustomerReviewRequired: 2,
      customerReviewByReasonCode: { MISSING_ONE_SIDE: 1 },
      customerReviewRowKeysByReasonCode: {
        MISSING_ONE_SIDE: ["VS:VS-01"],
      },
      legacyTechnicalDifferences: 2,
      pointDecisionRowKeysByOutcome: {
        VORTEIL_A: [],
        VORTEIL_B: [],
        DOKUMENTATIONSUNTERSCHIED: ["VS:VS-02"],
        GLEICHWERTIG: [],
        KEIN_DOKUMENTIERTER_VORTEIL: ["VS:VS-03"],
        NICHT_VERGLEICHBAR: [],
        UNKLAR: ["VS:VS-01"],
      },
    });
    expect(result.totals).not.toHaveProperty("reviewRequired");
    expect(validateCustomerComparison(result)).toMatchObject({
      rows: 3,
      customerReviewRequired: 1,
    });
  });

  test.each([
    [
      "stored customer review",
      (value) => (value.totals.customerReviewRequired = 2),
    ],
    [
      "stored outcome total",
      (value) => (value.totals.pointDecisions.UNKLAR = 0),
    ],
    [
      "stored outcome membership",
      (value) => value.totals.pointDecisionRowKeysByOutcome.UNKLAR.pop(),
    ],
    [
      "stored review reason count",
      (value) => (value.totals.customerReviewByReasonCode.MISSING_ONE_SIDE = 2),
    ],
    [
      "stored review reason membership",
      (value) =>
        value.totals.customerReviewRowKeysByReasonCode.MISSING_ONE_SIDE.push(
          "VS:VS-99"
        ),
    ],
    [
      "row review flag",
      (value) =>
        (value.categories[0].rows[0].pointDecision.reviewRequired = false),
    ],
    [
      "duplicate row identity",
      (value) =>
        value.categories[0].rows.push({ ...value.categories[0].rows[0] }),
    ],
    [
      "materialization status",
      (value) => (value.status = "CUSTOMER_RESULT_COMPLETE"),
    ],
    [
      "legacy technical outcome",
      (value) => (value.categories[0].rows[0].outcome = "UNKNOWN_VALUE"),
    ],
  ])("rejects a manipulated %s", (_label, mutate) => {
    const result = resultFor([row("VS-01", "UNKLAR")]);
    mutate(result);
    expect(() => validateCustomerComparison(result)).toThrow(/^COMPARISON_/u);
  });

  test("requires every unclear row to have one auditable reason group", () => {
    const result = resultFor([row("VS-01", "UNKLAR")]);
    result.categories[0].rows[0].pointDecision.reasonCode = "";
    result.totals = deriveCustomerMetrics(result.categories);
    expect(() => validateCustomerComparison(result)).toThrow(
      "COMPARISON_CUSTOMER_REVIEW_REASON_MISSING"
    );
  });

  test("requires a canonical package review audit for every schema V7 package blocker", () => {
    const result = schema7PackageResult();
    expect(validateCustomerComparison(result)).toMatchObject({
      rows: 1,
      customerReviewRequired: 1,
    });

    const missing = schema7PackageResult();
    delete missing.categories[0].rows[0].pointDecision.packageReviewAudit;
    expect(() => validateCustomerComparison(missing)).toThrow(
      "PACKAGE_REVIEW_AUDIT_SCHEMA_MISMATCH"
    );

    const foreignDocument = schema7PackageResult();
    foreignDocument.categories[0].rows[0].pointDecision.packageReviewAudit.blockers[0].documentUuids =
      ["foreign-document"];
    expect(() => validateCustomerComparison(foreignDocument)).toThrow(
      "PACKAGE_REVIEW_AUDIT_DOCUMENT_UUID_UNKNOWN"
    );

    const duplicate = schema7PackageResult();
    duplicate.categories[0].rows[0].pointDecision.packageReviewAudit.blockers.push(
      {
        ...duplicate.categories[0].rows[0].pointDecision.packageReviewAudit
          .blockers[0],
      }
    );
    expect(() => validateCustomerComparison(duplicate)).toThrow(
      "PACKAGE_REVIEW_AUDIT_ENTRIES_NOT_CANONICAL"
    );
  });

  test("requires and validates the FE-C02 package-membership audit", () => {
    const result = currentFeC02PackageResult();
    expect(validateCustomerComparison(result)).toMatchObject({
      rows: 1,
      customerReviewRequired: 1,
    });

    const missing = currentFeC02PackageResult();
    delete missing.categories[0].rows[0].pointDecision
      .packageActivatedObjectMembershipAudit;
    expect(() => validateCustomerComparison(missing)).toThrow(
      "COMPARISON_PACKAGE_MEMBERSHIP_AUDIT_REQUIRED"
    );

    const tampered = currentFeC02PackageResult();
    tampered.categories[0].rows[0].pointDecision.packageActivatedObjectMembershipAudit.B.status =
      "COMPLETE_SOURCE_CHAIN_REQUIRES_TYPED_CONDITION_AND_PRECEDENCE";
    expect(() => validateCustomerComparison(tampered)).toThrow(
      "COMPARISON_PACKAGE_MEMBERSHIP_AUDIT_INVALID"
    );
  });

  test("keeps schema V14 results from the previous shipped profile readable", () => {
    const result = resultFor([]);
    result.schemaVersion = 14;
    result.productProfile = PREVIOUS_PRODUCT_PROFILE_IDENTITY;

    expect(validateCustomerComparison(result)).toMatchObject({
      rows: 0,
      customerReviewRequired: 0,
    });
  });

  test("keeps the superseded V104 schema V14 profile readable without treating it as current", () => {
    const result = resultFor([]);
    result.schemaVersion = 14;
    result.productProfile = NARROW_ALIAS_PRODUCT_PROFILE_IDENTITY;

    expect(validateCustomerComparison(result)).toMatchObject({
      rows: 0,
      customerReviewRequired: 0,
    });
    expect(result.productProfile).not.toEqual(PRODUCT_PROFILE);
  });

  test("binds every schema V15 decision to the persisted rule/outcome contract", () => {
    expect(validateCustomerComparison(schema15SimpleResult())).toMatchObject({
      rows: 1,
      customerReviewRequired: 0,
    });

    const missingContract = schema15SimpleResult();
    delete missingContract.customerResultRuleOutcomeContract;
    expect(() => validateCustomerComparison(missingContract)).toThrow(
      "COMPARISON_CUSTOMER_RULE_OUTCOME_CONTRACT_MISMATCH"
    );

    const unknownRule = schema15SimpleResult();
    unknownRule.categories[0].rows[0].pointDecision.ruleId = "UNKNOWN_RULE";
    expect(() => validateCustomerComparison(unknownRule)).toThrow(
      "COMPARISON_CUSTOMER_RULE_OUTCOME_NOT_APPROVED"
    );

    const forbiddenOutcome = schema15SimpleResult();
    forbiddenOutcome.categories[0].rows[0].pointDecision.ruleId =
      "INCLUDED_OVER_EXCLUDED_V1";
    expect(() => validateCustomerComparison(forbiddenOutcome)).toThrow(
      "COMPARISON_CUSTOMER_RULE_OUTCOME_NOT_APPROVED"
    );
  });

  test("keeps the superseded V105 schema V15 profile readable", () => {
    const result = schema15SimpleResult();
    result.productProfile = SOURCE_BOUND_TRIAGE_PRODUCT_PROFILE_IDENTITY;

    expect(validateCustomerComparison(result)).toMatchObject({
      rows: 1,
      customerReviewRequired: 0,
    });
    expect(result.productProfile).not.toEqual(PRODUCT_PROFILE);
  });

  test("keeps the superseded V106 schema V15 profile readable", () => {
    const result = schema15SimpleResult();
    result.productProfile = STRUCTURAL_CONCEPT_CONTEXT_PRODUCT_PROFILE_IDENTITY;

    expect(validateCustomerComparison(result)).toMatchObject({
      rows: 1,
      customerReviewRequired: 0,
    });
    expect(result.productProfile).not.toEqual(PRODUCT_PROFILE);
  });

  test("counts multiple private blockers as one customer review row", () => {
    const result = schema7PackageResult();
    result.categories[0].rows[0].pointDecision.packageReviewAudit.blockers = [
      packageAuditBlocker("CONFLICTING_COVERAGE"),
      packageAuditBlocker("UNCLASSIFIED_DOCUMENT_REVIEW_BLOCKER"),
    ];
    expect(validateCustomerComparison(result)).toMatchObject({
      rows: 1,
      customerReviewRequired: 1,
      pointDecisions: { UNKLAR: 1 },
    });
  });

  test("requires V2 package audits for the current status-metadata profile", () => {
    const current = schema7PackageResult();
    current.schemaVersion = 8;
    current.productProfile = {
      id: "CUSTOMER_CORE_5_V8_STATUS_METADATA",
      comparisonContractId: "PACKAGE_FIRST_STATUS_METADATA_TYPED_V1",
    };
    expect(() => validateCustomerComparison(current)).toThrow(
      "COMPARISON_PACKAGE_REVIEW_AUDIT_VERSION_MISMATCH"
    );

    current.categories[0].rows[0].pointDecision.packageReviewAudit = {
      ...current.categories[0].rows[0].pointDecision.packageReviewAudit,
      schemaVersion: 2,
      contractId: "PACKAGE_REVIEW_BLOCKERS_V2",
    };
    expect(validateCustomerComparison(current)).toMatchObject({
      customerReviewRequired: 1,
    });

    current.categories[0].rows[0].pointDecision.packageReviewAudit.blockers[0].observed =
      {
        evidencePresence: "FOUND",
        documentStatus: "PROPOSAL",
        documentApplicability: "PROPOSED_ONLY",
        comparisonApplicability: null,
      };
    expect(() => validateCustomerComparison(current)).toThrow(
      "PACKAGE_REVIEW_AUDIT_APPLICABILITY_MISMATCH"
    );

    const missingObserved = schema7PackageResult();
    missingObserved.schemaVersion = 8;
    missingObserved.productProfile = {
      id: "CUSTOMER_CORE_5_V8_STATUS_METADATA",
      comparisonContractId: "PACKAGE_FIRST_STATUS_METADATA_TYPED_V1",
    };
    missingObserved.categories[0].rows[0].pointDecision.packageReviewAudit = {
      ...missingObserved.categories[0].rows[0].pointDecision.packageReviewAudit,
      schemaVersion: 2,
      contractId: "PACKAGE_REVIEW_BLOCKERS_V2",
      blockers: [
        {
          ...missingObserved.categories[0].rows[0].pointDecision
            .packageReviewAudit.blockers[0],
          level: "COMPONENT",
          componentId: "component",
          factRole: "BENEFIT",
          observed: null,
        },
      ],
    };
    expect(() => validateCustomerComparison(missingObserved)).toThrow(
      "PACKAGE_REVIEW_AUDIT_OBSERVED_REQUIRED"
    );

    missingObserved.categories[0].rows[0].pointDecision.packageReviewAudit.blockers[0].observed =
      {
        evidencePresence: "FOUND",
        documentStatus: "ACTIVE",
        documentApplicability: "UNKNOWN",
        comparisonApplicability: null,
      };
    expect(() => validateCustomerComparison(missingObserved)).toThrow(
      "PACKAGE_REVIEW_AUDIT_STATUS_PAIR_UNACCOUNTED"
    );
  });

  test("requires the V9 bilateral-absence profile while preserving V8 history", () => {
    const current = schema7PackageResult();
    current.schemaVersion = 9;
    current.productProfile = {
      id: "CUSTOMER_CORE_5_V9_BILATERAL_ABSENCE_EQUALITY",
      comparisonContractId: "PACKAGE_FIRST_BILATERAL_ABSENCE_EQUALITY_V1",
    };
    current.categories[0].rows[0].pointDecision.packageReviewAudit = {
      ...current.categories[0].rows[0].pointDecision.packageReviewAudit,
      schemaVersion: 2,
      contractId: "PACKAGE_REVIEW_BLOCKERS_V2",
    };
    expect(validateCustomerComparison(current)).toMatchObject({
      customerReviewRequired: 1,
    });

    current.productProfile = {
      id: "CUSTOMER_CORE_5_V8_STATUS_METADATA",
      comparisonContractId: "PACKAGE_FIRST_STATUS_METADATA_TYPED_V1",
    };
    expect(() => validateCustomerComparison(current)).toThrow(
      "COMPARISON_PRODUCT_PROFILE_CONTRACT_MISMATCH"
    );
  });

  test("keeps schema 10 bound to its historical profile after the V11 catalog change", () => {
    const historical = schema7PackageResult();
    historical.schemaVersion = 10;
    historical.productProfile = {
      id: "CUSTOMER_CORE_5_V10_QUALIFIED_ONE_SIDED_INCLUSION",
      comparisonContractId: "PACKAGE_FIRST_QUALIFIED_INCLUSION_ABSENCE_V1",
    };
    historical.categories[0].rows[0].pointDecision.packageReviewAudit = {
      ...historical.categories[0].rows[0].pointDecision.packageReviewAudit,
      schemaVersion: 2,
      contractId: "PACKAGE_REVIEW_BLOCKERS_V2",
    };

    expect(validateCustomerComparison(historical)).toMatchObject({
      customerReviewRequired: 1,
    });

    historical.productProfile.id = "CUSTOMER_CORE_5_V16_EL12_SCOPE_PRECISION";
    expect(() => validateCustomerComparison(historical)).toThrow(
      "COMPARISON_PRODUCT_PROFILE_CONTRACT_MISMATCH"
    );
  });

  test.each([
    ["missing profile", null],
    [
      "current id without current contract",
      {
        id: "CUSTOMER_CORE_5_V8_STATUS_METADATA",
        comparisonContractId: "PACKAGE_FIRST_TYPED_V1",
      },
    ],
    [
      "current contract without current id",
      {
        id: "CUSTOMER_CORE_5_V7_PACKAGE_REVIEW_AUDIT",
        comparisonContractId: "PACKAGE_FIRST_STATUS_METADATA_TYPED_V1",
      },
    ],
    [
      "unknown id and contract",
      { id: "UNKNOWN_PROFILE", comparisonContractId: "UNKNOWN_CONTRACT" },
    ],
  ])("rejects %s for schema V8", (_label, productProfile) => {
    const result = schema7PackageResult();
    result.schemaVersion = 8;
    result.productProfile = productProfile;
    expect(() => validateCustomerComparison(result)).toThrow(
      /^COMPARISON_PRODUCT_PROFILE_/u
    );
  });

  test("allows stored V5 results only through the explicit legacy adapter", () => {
    const legacy = { schemaVersion: 5, totals: { reviewRequired: 105 } };
    expect(() => validateCustomerComparison(legacy)).toThrow(
      "COMPARISON_METRIC_SCHEMA_UNSUPPORTED"
    );
    expect(validateCustomerComparison(legacy, { allowLegacy: true })).toEqual({
      legacy: true,
      metricContractId: null,
      rows: null,
      customerReviewRequired: null,
      noCustomerReviewRequired: null,
      pointDecisions: null,
      pointDecisionRowKeysByOutcome: null,
      storedMetricDiscrepancy: null,
    });
  });

  test("recomputes legacy review from rows and treats missing point decisions fail-closed", () => {
    const legacy = {
      schemaVersion: 5,
      categories: [
        {
          categoryView: "VS",
          rows: [
            row("VS-01", "GLEICHWERTIG"),
            { categoryId: "VS-02", outcome: "INHALTLICH_GLEICH" },
          ],
        },
      ],
      totals: { pointDecisionReviewRequired: 0 },
    };
    expect(validateCustomerComparison(legacy, { allowLegacy: true })).toEqual({
      legacy: true,
      metricContractId: null,
      rows: 2,
      customerReviewRequired: 1,
      noCustomerReviewRequired: 1,
      pointDecisions: {
        VORTEIL_A: 0,
        VORTEIL_B: 0,
        DOKUMENTATIONSUNTERSCHIED: 0,
        GLEICHWERTIG: 1,
        KEIN_DOKUMENTIERTER_VORTEIL: 0,
        NICHT_VERGLEICHBAR: 0,
        UNKLAR: 1,
      },
      pointDecisionRowKeysByOutcome: {
        VORTEIL_A: [],
        VORTEIL_B: [],
        DOKUMENTATIONSUNTERSCHIED: [],
        GLEICHWERTIG: ["VS:VS-01"],
        KEIN_DOKUMENTIERTER_VORTEIL: [],
        NICHT_VERGLEICHBAR: [],
        UNKLAR: ["VS:VS-02"],
      },
      storedMetricDiscrepancy: true,
    });
  });

  test("returns a customer-safe legacy read view without the ambiguous total", () => {
    const legacy = {
      schemaVersion: 5,
      categories: [
        {
          categoryView: "VS",
          rows: [{ categoryId: "VS-01", outcome: "INHALTLICH_GLEICH" }],
        },
      ],
      totals: { rows: 1, reviewRequired: 105 },
    };
    const view = customerSafeComparisonReadView(legacy);
    expect(view.totals).not.toHaveProperty("reviewRequired");
    expect(view.customerMetrics).toMatchObject({
      rows: 1,
      customerReviewRequired: 1,
      pointDecisions: { UNKLAR: 1 },
    });
  });

  test("adds a non-mutating customer explanation to a validated V7 read view", () => {
    const result = schema7PackageResult();
    result.categories[0].rows[0].pointDecision.reason =
      "Generischer technischer Text.";
    const original = JSON.parse(JSON.stringify(result));
    const view = customerSafeComparisonReadView(result);
    expect(view.categories[0].rows[0].pointDecision.reason).toContain(
      "Polizze A:"
    );
    expect(view.categories[0].rows[0].pointDecision.reason).toContain(
      "nicht zusätzlich gezählt"
    );
    expect(result).toEqual(original);
    expect(view.customerMetrics).toMatchObject({
      rows: 1,
      customerReviewRequired: 1,
      pointDecisions: { UNKLAR: 1 },
    });
  });
});
