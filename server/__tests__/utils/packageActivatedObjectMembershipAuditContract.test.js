const crypto = require("crypto");
const {
  COMPLETE_SOURCE_CHAIN_TYPED_CONDITIONS,
  CONFLICTING_MEMBERSHIP,
  INCOMPLETE_SOURCE_CHAIN,
  PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_CONTRACT_ID,
  REFERENCE_KEY_MISMATCH,
  buildPackageActivatedObjectMembershipAudit,
  validatePackageActivatedObjectMembershipAudit,
  validatePackageActivatedObjectMembershipAuditContract,
} = require("../../utils/policyAnalysis/packageActivatedObjectMembershipAuditContract");
const {
  buildMembershipConditionEvidence,
} = require("../../utils/policyAnalysis/objectMembershipEvidenceContract");
const feCatalog = require("../../resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json");

function contract() {
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
  const conditionedParent =
    relation === "MEMBER_OF_CLASS" &&
    memberObjectKey === "BUILDING_TECHNICAL_INSTALLATION" &&
    classObjectKey === "BUILDING";
  const exactText = conditionedParent
    ? "·Haustechnische Anlagen und Adaptierungen sofern sie sich im Eigentum des Gebäudeeigentümers befinden und soweit der Gebäudeeigentümer für die Wiederherstellung nachweislich aufzukommen hat und im Gebäudeneuwert enthalten sind."
    : `${memberObjectKey} unter allen Quellbedingungen`;
  const memberExactText = conditionedParent
    ? "Haustechnische Anlagen und Adaptierungen"
    : memberObjectKey;
  const memberContextSpan = {
    source: "STRUCTURAL_LIST_ITEM",
    physicalPageNumber: 2,
    documentStart: 100,
    documentEnd: 100 + exactText.length,
    exactText,
    sha256: crypto.createHash("sha256").update(exactText).digest("hex"),
  };
  const memberSpan = {
    documentStart: 100 + exactText.indexOf(memberExactText),
    documentEnd:
      100 + exactText.indexOf(memberExactText) + memberExactText.length,
  };
  const conditionContract =
    feCatalog.requirements.find(({ id }) => id === "FE-C02")
      .supportingObjectMembershipEvidenceContracts[0]
      .conditionEvidenceContract;
  return {
    proofDigest: digestCharacter.repeat(64),
    edge: {
      relation,
      memberObjectKey,
      classObjectKey,
      memberContextSpan,
      ...(conditionedParent
        ? {
            conditionEvidence: buildMembershipConditionEvidence({
              contract: conditionContract,
              memberContextSpan,
              memberSpan,
            }),
          }
        : {}),
    },
  };
}

function atoms({ identityKey = "EABS@2023", conflicts = [] } = {}) {
  const shared = {
    requirementId: "FE-C02",
    packageActivatedObjectMembershipAuditContract: contract(),
    conflictState: "NONE",
    unresolvedCandidateIds: [],
  };
  return [
    {
      ...shared,
      documentUuids: ["proposal"],
      documentRole: "PROPOSAL",
      documentStatus: "PROPOSAL",
      supportingScopedPackageReferenceProofs: [
        {
          proofDigest: "a".repeat(64),
          perilScopeKey: "FEUER_INSURANCE",
          coveredObjectKey: "BUILDING",
          reference: { familyKey: "EABS", referenceKey: "EABS@2023" },
        },
      ],
      sources: [],
    },
    {
      ...shared,
      documentUuids: ["terms"],
      documentRole: "TERMS",
      documentStatus: "FRAMEWORK_TERMS",
      supportingReferencedTermsIdentityProofs: [
        {
          proofDigest: "b".repeat(64),
          reference: { familyKey: "EABS", referenceKey: identityKey },
        },
      ],
      sources: [
        {
          objectMembershipProof: membershipProof(
            "c",
            "PHOTOVOLTAIC_INSTALLATION",
            "BUILDING_TECHNICAL_INSTALLATION"
          ),
        },
        ...conflicts.map((proof) => ({ objectMembershipProof: proof })),
      ],
      supportingObjectMembershipProofs: [
        membershipProof("d", "BUILDING_TECHNICAL_INSTALLATION", "BUILDING"),
      ],
    },
  ];
}

describe("package-activated object-membership audit", () => {
  test("joins exact reference keys and both directed membership edges without deciding", () => {
    const audit = buildPackageActivatedObjectMembershipAudit({
      categoryId: "FE-C02",
      atoms: atoms(),
    });

    expect(audit).toMatchObject({
      status: COMPLETE_SOURCE_CHAIN_TYPED_CONDITIONS,
      reasonCode: "SOURCE_CHAIN_AND_CONDITIONS_TYPED_OUTCOME_LOCKED",
      readyForDecision: false,
      referenceKey: "EABS@2023",
      remainingGates: [
        "MEMBERSHIP_CONDITION_SCOPE_COMPARISON",
        "DOCUMENT_PRECEDENCE",
      ],
      evidence: {
        references: [{ documentUuids: ["proposal"] }],
        identities: [{ documentUuids: ["terms"] }],
        membershipPath: [
          {
            memberObjectKey: "PHOTOVOLTAIC_INSTALLATION",
            classObjectKey: "BUILDING_TECHNICAL_INSTALLATION",
          },
          {
            memberObjectKey: "BUILDING_TECHNICAL_INSTALLATION",
            classObjectKey: "BUILDING",
          },
        ],
      },
    });
    expect(
      audit.evidence.membershipPath[1].entries[0].memberContextSpan.exactText
    ).toContain("Quellbedingungen");
    expect(audit.auditDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(audit).not.toHaveProperty("coverageEffect");
    expect(
      validatePackageActivatedObjectMembershipAudit(audit, {
        categoryId: "FE-C02",
        allowedDocumentUuids: new Set(["proposal", "terms"]),
      })
    ).toBe(audit);
  });

  test("rejects changed audit fields and document UUIDs at the customer boundary", () => {
    const audit = buildPackageActivatedObjectMembershipAudit({
      categoryId: "FE-C02",
      atoms: atoms(),
    });
    const tampered = JSON.parse(JSON.stringify(audit));
    tampered.status = INCOMPLETE_SOURCE_CHAIN;
    expect(() =>
      validatePackageActivatedObjectMembershipAudit(tampered, {
        categoryId: "FE-C02",
        allowedDocumentUuids: new Set(["proposal", "terms"]),
      })
    ).toThrow("PACKAGE_MEMBERSHIP_AUDIT_DIGEST_MISMATCH");

    expect(() =>
      validatePackageActivatedObjectMembershipAudit(audit, {
        categoryId: "FE-C02",
        allowedDocumentUuids: new Set(["proposal"]),
      })
    ).toThrow("PACKAGE_MEMBERSHIP_AUDIT_DOCUMENT_UUID_UNKNOWN");
  });

  test("fails closed when reference and identity editions differ", () => {
    expect(
      buildPackageActivatedObjectMembershipAudit({
        categoryId: "FE-C02",
        atoms: atoms({ identityKey: "EABS@2024" }),
      })
    ).toMatchObject({
      status: REFERENCE_KEY_MISMATCH,
      readyForDecision: false,
      referenceKey: null,
      remainingGates: ["REFERENCE_IDENTITY_MATCH"],
    });
  });

  test("blocks only a contrary edge on the same membership path", () => {
    const unrelated = buildPackageActivatedObjectMembershipAudit({
      categoryId: "FE-C02",
      atoms: atoms({
        conflicts: [
          membershipProof(
            "e",
            "PHOTOVOLTAIC_INSTALLATION",
            "BUSINESS_CONTENT",
            "EXCLUDED_FROM_CLASS"
          ),
        ],
      }),
    });
    expect(unrelated.status).toBe(COMPLETE_SOURCE_CHAIN_TYPED_CONDITIONS);

    const sameEdge = buildPackageActivatedObjectMembershipAudit({
      categoryId: "FE-C02",
      atoms: atoms({
        conflicts: [
          membershipProof(
            "e",
            "PHOTOVOLTAIC_INSTALLATION",
            "BUILDING_TECHNICAL_INSTALLATION",
            "EXCLUDED_FROM_CLASS"
          ),
        ],
      }),
    });
    expect(sameEdge).toMatchObject({
      status: CONFLICTING_MEMBERSHIP,
      readyForDecision: false,
      remainingGates: ["CONFLICT_RESOLUTION"],
    });
  });

  test("reports the exact missing edge without manufacturing a chain", () => {
    const incomplete = atoms();
    incomplete[1].supportingObjectMembershipProofs = [];
    expect(
      buildPackageActivatedObjectMembershipAudit({
        categoryId: "FE-C02",
        atoms: incomplete,
      })
    ).toMatchObject({
      status: INCOMPLETE_SOURCE_CHAIN,
      readyForDecision: false,
      remainingGates: ["MEMBERSHIP:BUILDING_TECHNICAL_INSTALLATION->BUILDING"],
    });
  });

  test("rejects a reversed or policy-changing catalog path", () => {
    const reversed = contract();
    reversed.membershipPath.reverse();
    expect(() =>
      validatePackageActivatedObjectMembershipAuditContract(reversed)
    ).toThrow("PACKAGE_MEMBERSHIP_AUDIT_PATH_INVALID");

    const unsafe = { ...contract(), conditionPolicy: "IGNORE_CONDITIONS" };
    expect(() =>
      validatePackageActivatedObjectMembershipAuditContract(unsafe)
    ).toThrow("PACKAGE_MEMBERSHIP_AUDIT_CONDITION_POLICY_INVALID");
  });
});
