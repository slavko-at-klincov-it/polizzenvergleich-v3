const registry = require("../../../resources/policyAnalysis/coverage-only-certifications.v0.1.json");
const {
  assertCoverageOnlyCertification,
  requirementSearchContractDigest,
  validateCertificationRegistry,
} = require("../../../utils/policyAnalysis/coverageOnlyCertificationContract");

const CATALOG_ID = "vs-fixture-v1";
const ARTIFACT_SHA = "a".repeat(64);

function approvedRegistry(requirement = coverageOnlyRequirement()) {
  return {
    ...registry,
    certifications: [
      {
        certificationId: "VS-17-v1",
        categoryView: "VS",
        requirementId: "VS-17",
        catalogId: CATALOG_ID,
        requirementDigest: requirementSearchContractDigest({
          catalogId: CATALOG_ID,
          requirement,
        }),
        status: "APPROVED",
        gateEvidence: Object.fromEntries(
          registry.requiredGateIds.map((gateId) => [
            gateId,
            {
              passed: true,
              artifacts: [
                { artifactId: `artifact:${gateId}`, sha256: ARTIFACT_SHA },
              ],
            },
          ])
        ),
      },
    ],
  };
}

function coverageOnlyRequirement(overrides = {}) {
  return {
    id: "VS-17",
    absenceMeaning: "COVERAGE_ONLY",
    requestedFields: [],
    optionalFields: [],
    negativeSearchPolicy: "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1",
    absenceComparisonPolicy:
      "ASSUME_NOT_INCLUDED_AFTER_COMPLETE_ZERO_OCCURRENCE_V1",
    absenceCertificationId: "VS-17-v1",
    components: [{ id: "room", factRole: "INSURED_OBJECT" }],
    ...overrides,
  };
}

describe("coverage-only certification contract", () => {
  test("ships with no automatically certified customer row", () => {
    expect(validateCertificationRegistry(registry)).toBe(registry);
    expect(registry.certifications).toEqual([]);
  });

  test("accepts only a row with evidence for every certification gate", () => {
    expect(
      assertCoverageOnlyCertification({
        categoryView: "VS",
        catalogId: CATALOG_ID,
        requirement: coverageOnlyRequirement(),
        registry: approvedRegistry(),
      })
    ).toMatchObject({ certificationId: "VS-17-v1", status: "APPROVED" });
  });

  test.each([
    ["COVERAGE_MIXED", [], [], "BENEFIT"],
    ["COST_COVERAGE", [], [], "COST"],
    ["COVERAGE_ONLY", ["limit"], [], "LIMIT"],
    ["COVERAGE_ONLY", [], ["deductible"], "DEDUCTIBLE"],
    ["CONDITION_ONLY", [], [], "CONDITION"],
    ["DEFINITION_ONLY", [], [], "DEFINITION"],
  ])(
    "rejects non-coverage and value-bearing automation: %s/%s",
    (absenceMeaning, requestedFields, optionalFields, factRole) => {
      expect(() =>
        assertCoverageOnlyCertification({
          categoryView: "VS",
          catalogId: CATALOG_ID,
          requirement: coverageOnlyRequirement({
            absenceMeaning,
            requestedFields,
            optionalFields,
            components: [{ id: "unsafe", factRole }],
          }),
          registry: approvedRegistry(),
        })
      ).toThrow(/COVERAGE_CERTIFICATION_(?:MEANING|ROW_TYPE)_UNSAFE/u);
    }
  );

  test("rejects an approval with one missing gate artifact", () => {
    const incomplete = approvedRegistry();
    incomplete.certifications[0].gateEvidence[
      registry.requiredGateIds[0]
    ].artifacts = [];
    expect(() => validateCertificationRegistry(incomplete)).toThrow(
      "COVERAGE_CERTIFICATION_GATE_INCOMPLETE"
    );
  });

  test("rejects shortened gate lists and mutations of the certified search plan", () => {
    const shortened = approvedRegistry();
    shortened.requiredGateIds = shortened.requiredGateIds.slice(1);
    expect(() => validateCertificationRegistry(shortened)).toThrow(
      "COVERAGE_CERTIFICATION_GATE_IDS_INVALID"
    );

    const requirement = coverageOnlyRequirement();
    const approved = approvedRegistry(requirement);
    const mutated = {
      ...requirement,
      components: [
        {
          ...requirement.components[0],
          aliases: ["neue nicht geprüfte Aliasform"],
        },
      ],
    };
    expect(() =>
      assertCoverageOnlyCertification({
        categoryView: "VS",
        catalogId: CATALOG_ID,
        requirement: mutated,
        registry: approved,
      })
    ).toThrow("COVERAGE_CERTIFICATION_REFERENCE_INVALID");
  });

  test("binds continuation and object-scope evidence contracts into the requirement digest", () => {
    const requirement = coverageOnlyRequirement();
    const baseDigest = requirementSearchContractDigest({
      catalogId: CATALOG_ID,
      requirement,
    });
    const continuationDigest = requirementSearchContractDigest({
      catalogId: CATALOG_ID,
      requirement: {
        ...requirement,
        components: [
          {
            ...requirement.components[0],
            nestedListContinuationProofContractId:
              "NESTED_LIST_CONTINUATION_PROOF_V1",
          },
        ],
      },
    });
    const objectScopeEvidenceContract = {
      contractId: "SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_V1",
      allowedEvidenceSources: [
        "STRUCTURAL_LOCAL_CONTEXT",
        "NESTED_LIST_CONTINUATION",
      ],
      families: [
        {
          objectScopeKey: "UNDERGROUND_CABLES",
          patterns: [
            {
              sourceKinds: ["STRUCTURAL_LOCAL_CONTEXT"],
              allOf: [["Erdkabel"]],
            },
          ],
        },
      ],
    };
    const objectScopeDigest = requirementSearchContractDigest({
      catalogId: CATALOG_ID,
      requirement: {
        ...requirement,
        components: [
          {
            ...requirement.components[0],
            objectScopeEvidenceContract,
          },
        ],
      },
    });
    const mutatedObjectScopeDigest = requirementSearchContractDigest({
      catalogId: CATALOG_ID,
      requirement: {
        ...requirement,
        components: [
          {
            ...requirement.components[0],
            objectScopeEvidenceContract: {
              ...objectScopeEvidenceContract,
              families: [
                {
                  ...objectScopeEvidenceContract.families[0],
                  patterns: [
                    {
                      sourceKinds: ["STRUCTURAL_LOCAL_CONTEXT"],
                      allOf: [["Erdkabel", "erdverlegte Versorgungskabel"]],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    expect(continuationDigest).not.toBe(baseDigest);
    expect(objectScopeDigest).not.toBe(baseDigest);
    expect(mutatedObjectScopeDigest).not.toBe(objectScopeDigest);
  });
});
