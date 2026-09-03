const crypto = require("crypto");
const defaultRegistry = require("../../resources/policyAnalysis/coverage-only-certifications.v0.1.json");

const CERTIFIED_NEGATIVE_SEARCH_POLICY = "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1";
const CERTIFIED_COMPARISON_POLICY =
  "ASSUME_NOT_INCLUDED_AFTER_COMPLETE_ZERO_OCCURRENCE_V1";
const ALLOWED_ABSENCE_MEANING = "COVERAGE_ONLY";
const REQUIRED_GATE_IDS = Object.freeze([
  "ALIAS_CONCEPT_FAMILY_COMPLETE",
  "POSITIVE_NEGATIVE_ADVERSARIAL_SCOPE_MATRIX",
  "COMPONENT_SCOPE_REVIEWED",
  "LF_WEVIG_REGRESSION_REVIEWED",
  "UNSEEN_INSURER_DOCUMENT_HOLDOUT",
  "FRESH_MAC_STUDIO_PACKAGE_RUN",
  "INDEPENDENT_ZERO_HIT_AUDIT",
]);
const ALLOWED_FACT_ROLES = new Set([
  "BENEFIT",
  "DAMAGE",
  "INSURED_OBJECT",
  "PERIL",
]);

function certificationError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function requireText(value, code, detail) {
  const text = String(value || "").trim();
  if (!text) throw certificationError(code, detail);
  return text;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  return value;
}

function requirementSearchContractDigest({ catalogId, requirement }) {
  const contract = {
    catalogId: requireText(
      catalogId,
      "COVERAGE_CERTIFICATION_CATALOG_ID_REQUIRED",
      requirement?.id || "requirement"
    ),
    requirement: {
      id: requirement?.id,
      label: requirement?.label,
      requestedFields: requirement?.requestedFields || [],
      optionalFields: requirement?.optionalFields || [],
      scopePolicy: requirement?.scopePolicy || "GENERAL_REQUIRED",
      scopeRules: requirement?.scopeRules || {},
      componentSatisfactionPolicy:
        requirement?.componentSatisfactionPolicy || "ALL",
      negativeSearchPolicy: requirement?.negativeSearchPolicy || null,
      absenceMeaning: requirement?.absenceMeaning || null,
      absenceComparisonPolicy: requirement?.absenceComparisonPolicy || null,
      coverageAggregationPolicy:
        requirement?.coverageAggregationPolicy || "ALL_COMPONENT_EFFECTS",
      ...(requirement?.componentFamilyContract
        ? { componentFamilyContract: requirement.componentFamilyContract }
        : {}),
      ...(requirement?.supportingObjectMembershipEvidenceContracts?.length > 0
        ? {
            supportingObjectMembershipEvidenceContracts:
              requirement.supportingObjectMembershipEvidenceContracts,
          }
        : {}),
      ...(requirement?.supportingScopedPackageReferenceEvidenceContracts
        ?.length > 0
        ? {
            supportingScopedPackageReferenceEvidenceContracts:
              requirement.supportingScopedPackageReferenceEvidenceContracts,
          }
        : {}),
      ...(requirement?.supportingReferencedTermsIdentityEvidenceContracts
        ?.length > 0
        ? {
            supportingReferencedTermsIdentityEvidenceContracts:
              requirement.supportingReferencedTermsIdentityEvidenceContracts,
          }
        : {}),
      bindingStructures: requirement?.bindingStructures || [],
      components: (requirement?.components || []).map((component) => ({
        id: component.id,
        label: component.label,
        factRole: component.factRole,
        contextMode: component.contextMode || "STRUCTURAL",
        aliases: component.aliases || [],
        conceptSearches: component.conceptSearches || [],
        followingStructuralBoundaryProofContractId:
          component.followingStructuralBoundaryProofContractId || null,
        ...(component.nestedListContinuationProofContractId
          ? {
              nestedListContinuationProofContractId:
                component.nestedListContinuationProofContractId,
            }
          : {}),
        ...(component.objectScopeEvidenceContract
          ? {
              objectScopeEvidenceContract:
                component.objectScopeEvidenceContract,
            }
          : {}),
        ...(component.objectMembershipEvidenceContracts?.length > 0
          ? {
              objectMembershipEvidenceContracts:
                component.objectMembershipEvidenceContracts,
            }
          : {}),
        ...(component.fieldGovernorPolicy
          ? { fieldGovernorPolicy: component.fieldGovernorPolicy }
          : {}),
      })),
    },
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(contract)))
    .digest("hex");
}

function validateCertificationRegistry(registry = defaultRegistry) {
  if (
    registry?.schemaVersion !== 1 ||
    !Array.isArray(registry.requiredGateIds) ||
    !Array.isArray(registry.certifications)
  )
    throw certificationError("COVERAGE_CERTIFICATION_REGISTRY_INVALID");
  requireText(
    registry.registryId,
    "COVERAGE_CERTIFICATION_REGISTRY_ID_REQUIRED",
    "registry"
  );
  const requiredGateIds = [...new Set(registry.requiredGateIds)];
  if (
    requiredGateIds.length !== registry.requiredGateIds.length ||
    JSON.stringify([...requiredGateIds].sort()) !==
      JSON.stringify([...REQUIRED_GATE_IDS].sort())
  )
    throw certificationError("COVERAGE_CERTIFICATION_GATE_IDS_INVALID");

  const ids = new Set();
  const rowKeys = new Set();
  for (const certification of registry.certifications) {
    const certificationId = requireText(
      certification?.certificationId,
      "COVERAGE_CERTIFICATION_ID_REQUIRED",
      "certification"
    );
    if (ids.has(certificationId))
      throw certificationError(
        "COVERAGE_CERTIFICATION_ID_DUPLICATE",
        certificationId
      );
    ids.add(certificationId);
    const categoryView = requireText(
      certification.categoryView,
      "COVERAGE_CERTIFICATION_CATEGORY_REQUIRED",
      certificationId
    );
    const requirementId = requireText(
      certification.requirementId,
      "COVERAGE_CERTIFICATION_REQUIREMENT_REQUIRED",
      certificationId
    );
    requireText(
      certification.catalogId,
      "COVERAGE_CERTIFICATION_CATALOG_ID_REQUIRED",
      certificationId
    );
    if (!/^[a-f0-9]{64}$/u.test(String(certification.requirementDigest || "")))
      throw certificationError(
        "COVERAGE_CERTIFICATION_REQUIREMENT_DIGEST_INVALID",
        certificationId
      );
    const rowKey = `${categoryView}:${requirementId}`;
    if (rowKeys.has(rowKey))
      throw certificationError("COVERAGE_CERTIFICATION_ROW_DUPLICATE", rowKey);
    rowKeys.add(rowKey);
    if (certification.status !== "APPROVED")
      throw certificationError(
        "COVERAGE_CERTIFICATION_STATUS_INVALID",
        certificationId
      );
    const gateEvidence = certification.gateEvidence;
    if (!gateEvidence || typeof gateEvidence !== "object")
      throw certificationError(
        "COVERAGE_CERTIFICATION_GATE_EVIDENCE_REQUIRED",
        certificationId
      );
    for (const gateId of requiredGateIds) {
      const evidence = gateEvidence[gateId];
      if (
        evidence?.passed !== true ||
        !Array.isArray(evidence.artifacts) ||
        evidence.artifacts.length === 0 ||
        evidence.artifacts.some(
          (artifact) =>
            !String(artifact?.artifactId || "").trim() ||
            !/^[a-f0-9]{64}$/u.test(String(artifact?.sha256 || ""))
        )
      )
        throw certificationError(
          "COVERAGE_CERTIFICATION_GATE_INCOMPLETE",
          `${certificationId}:${gateId}`
        );
    }
  }
  return registry;
}

function assertCoverageOnlyCertification({
  categoryView,
  catalogId,
  requirement,
  registry = defaultRegistry,
}) {
  validateCertificationRegistry(registry);
  const detail = `${categoryView}:${requirement?.id || "unknown"}`;
  if (requirement?.absenceMeaning !== ALLOWED_ABSENCE_MEANING)
    throw certificationError("COVERAGE_CERTIFICATION_MEANING_UNSAFE", detail);
  if (
    (requirement.requestedFields || []).length > 0 ||
    (requirement.optionalFields || []).length > 0 ||
    (requirement.components || []).length === 0 ||
    (requirement.components || []).some(
      ({ factRole }) => !ALLOWED_FACT_ROLES.has(factRole)
    )
  )
    throw certificationError("COVERAGE_CERTIFICATION_ROW_TYPE_UNSAFE", detail);
  if (
    requirement.negativeSearchPolicy !== CERTIFIED_NEGATIVE_SEARCH_POLICY ||
    requirement.absenceComparisonPolicy !== CERTIFIED_COMPARISON_POLICY
  )
    throw certificationError(
      "COVERAGE_CERTIFICATION_POLICY_INCOMPLETE",
      detail
    );

  const certificationId = requireText(
    requirement.absenceCertificationId,
    "COVERAGE_CERTIFICATION_REFERENCE_REQUIRED",
    detail
  );
  const certification = registry.certifications.find(
    (entry) => entry.certificationId === certificationId
  );
  if (
    !certification ||
    certification.categoryView !== categoryView ||
    certification.requirementId !== requirement.id ||
    certification.catalogId !== catalogId ||
    certification.requirementDigest !==
      requirementSearchContractDigest({ catalogId, requirement })
  )
    throw certificationError(
      "COVERAGE_CERTIFICATION_REFERENCE_INVALID",
      detail
    );
  return certification;
}

module.exports = {
  ALLOWED_ABSENCE_MEANING,
  ALLOWED_FACT_ROLES,
  CERTIFIED_COMPARISON_POLICY,
  CERTIFIED_NEGATIVE_SEARCH_POLICY,
  REQUIRED_GATE_IDS,
  assertCoverageOnlyCertification,
  requirementSearchContractDigest,
  validateCertificationRegistry,
};
