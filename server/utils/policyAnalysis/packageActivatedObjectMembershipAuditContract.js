const crypto = require("crypto");

const PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_CONTRACT_ID =
  "PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_V1";
const PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_SCHEMA_VERSION = 1;
const CONDITION_POLICY = "PRESERVE_SOURCE_CONDITIONS_V1";
const CONFLICT_POLICY = "FAIL_CLOSED_SAME_EDGE_EXCLUSION_V1";
const COMPLETE_SOURCE_CHAIN =
  "COMPLETE_SOURCE_CHAIN_REQUIRES_TYPED_CONDITION_AND_PRECEDENCE";
const INCOMPLETE_SOURCE_CHAIN = "INCOMPLETE_SOURCE_CHAIN";
const AMBIGUOUS_SOURCE_CHAIN = "AMBIGUOUS_SOURCE_CHAIN";
const REFERENCE_KEY_MISMATCH = "REFERENCE_KEY_MISMATCH";
const CONFLICTING_MEMBERSHIP = "CONFLICTING_MEMBERSHIP";

function auditError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])])
  );
}

function digest(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

function requiredConceptKey(value, detail) {
  const key = String(value || "").trim();
  if (!/^[A-Z][A-Z0-9_]*$/u.test(key))
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_CONCEPT_KEY_INVALID", detail);
  return key;
}

function validatePackageActivatedObjectMembershipAuditContract(
  contract,
  detail = "requirement"
) {
  const keys = [
    "contractId",
    "targetObjectKey",
    "coveredObjectKey",
    "membershipPath",
    "perilScopeKey",
    "referenceFamilyKey",
    "conditionPolicy",
    "conflictPolicy",
  ];
  if (
    !contract ||
    typeof contract !== "object" ||
    Array.isArray(contract) ||
    JSON.stringify(Object.keys(contract).sort()) !== JSON.stringify(keys.sort())
  )
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_CONTRACT_INVALID", detail);
  if (contract.contractId !== PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_CONTRACT_ID)
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_CONTRACT_ID_INVALID", detail);
  if (contract.conditionPolicy !== CONDITION_POLICY)
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_CONDITION_POLICY_INVALID", detail);
  if (contract.conflictPolicy !== CONFLICT_POLICY)
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_CONFLICT_POLICY_INVALID", detail);
  if (!Array.isArray(contract.membershipPath) || contract.membershipPath.length < 2)
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_PATH_INVALID", detail);
  const membershipPath = contract.membershipPath.map((key, index) =>
    requiredConceptKey(key, `${detail}:membershipPath[${index}]`)
  );
  if (
    new Set(membershipPath).size !== membershipPath.length ||
    membershipPath[0] !== contract.targetObjectKey ||
    membershipPath.at(-1) !== contract.coveredObjectKey
  )
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_PATH_INVALID", detail);
  const perilScopeKey = requiredConceptKey(
    contract.perilScopeKey,
    `${detail}:perilScopeKey`
  );
  if (!perilScopeKey.endsWith("_INSURANCE"))
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_SCOPE_INVALID", detail);
  return {
    contractId: PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_CONTRACT_ID,
    targetObjectKey: requiredConceptKey(
      contract.targetObjectKey,
      `${detail}:targetObjectKey`
    ),
    coveredObjectKey: requiredConceptKey(
      contract.coveredObjectKey,
      `${detail}:coveredObjectKey`
    ),
    membershipPath,
    perilScopeKey,
    referenceFamilyKey: requiredConceptKey(
      contract.referenceFamilyKey,
      `${detail}:referenceFamilyKey`
    ),
    conditionPolicy: CONDITION_POLICY,
    conflictPolicy: CONFLICT_POLICY,
  };
}

function uniqueProofEntries(atoms, field) {
  const byDigest = new Map();
  for (const atom of atoms) {
    for (const proof of atom?.[field] || []) {
      if (!/^[a-f0-9]{64}$/u.test(String(proof?.proofDigest || ""))) continue;
      const entry = {
        documentUuids: [...new Set(atom.documentUuids || [])].sort(),
        documentRole: atom.documentRole || null,
        documentStatus: atom.documentStatus || null,
        proof,
      };
      const existing = byDigest.get(proof.proofDigest);
      if (!existing) byDigest.set(proof.proofDigest, entry);
      else
        existing.documentUuids = [
          ...new Set([...existing.documentUuids, ...entry.documentUuids]),
        ].sort();
    }
  }
  return [...byDigest.values()].sort((left, right) =>
    left.proof.proofDigest.localeCompare(right.proof.proofDigest)
  );
}

function membershipEntries(atoms) {
  const entries = [];
  for (const atom of atoms) {
    const atomSafe =
      atom?.conflictState === "NONE" &&
      Array.isArray(atom?.unresolvedCandidateIds) &&
      atom.unresolvedCandidateIds.length === 0;
    for (const source of atom?.sources || []) {
      const proof = source?.objectMembershipProof;
      if (!proof?.proofDigest) continue;
      entries.push({
        documentUuids: [...new Set(atom.documentUuids || [])].sort(),
        atomSafe,
        proof,
      });
    }
    for (const proof of atom?.supportingObjectMembershipProofs || []) {
      if (!proof?.proofDigest) continue;
      entries.push({
        documentUuids: [...new Set(atom.documentUuids || [])].sort(),
        atomSafe,
        proof,
      });
    }
  }
  return [
    ...new Map(
      entries.map((entry) => [entry.proof.proofDigest, entry])
    ).values(),
  ].sort((left, right) =>
    left.proof.proofDigest.localeCompare(right.proof.proofDigest)
  );
}

function edgeMatches(proof, relation, memberObjectKey, classObjectKey) {
  return (
    proof?.edge?.relation === relation &&
    proof.edge.memberObjectKey === memberObjectKey &&
    proof.edge.classObjectKey === classObjectKey
  );
}

function projectedEntry(entry) {
  return {
    documentUuids: entry.documentUuids,
    documentRole: entry.documentRole || null,
    documentStatus: entry.documentStatus || null,
    proofDigest: entry.proof.proofDigest,
  };
}

function buildPackageActivatedObjectMembershipAudit({
  categoryId,
  atoms,
}) {
  const scopedAtoms = (atoms || []).filter(
    ({ requirementId }) => requirementId === categoryId
  );
  const contracts = [
    ...new Map(
      scopedAtoms
        .map((atom) => atom.packageActivatedObjectMembershipAuditContract)
        .filter(Boolean)
        .map((contract) => [JSON.stringify(canonical(contract)), contract])
    ).values(),
  ];
  if (contracts.length === 0) return null;
  const base = {
    schemaVersion: PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_SCHEMA_VERSION,
    contractId: PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_CONTRACT_ID,
    categoryId,
    readyForDecision: false,
  };
  if (contracts.length !== 1) {
    const ambiguous = {
      ...base,
      status: AMBIGUOUS_SOURCE_CHAIN,
      reasonCode: "AUDIT_CONTRACT_AMBIGUOUS",
      remainingGates: ["CONTRACT_IDENTITY"],
    };
    return { ...ambiguous, auditDigest: digest(ambiguous) };
  }
  const contract = validatePackageActivatedObjectMembershipAuditContract(
    contracts[0],
    categoryId
  );
  const references = uniqueProofEntries(
    scopedAtoms,
    "supportingScopedPackageReferenceProofs"
  ).filter(
    ({ proof }) =>
      proof.perilScopeKey === contract.perilScopeKey &&
      proof.coveredObjectKey === contract.coveredObjectKey &&
      proof.reference?.familyKey === contract.referenceFamilyKey
  );
  const identities = uniqueProofEntries(
    scopedAtoms,
    "supportingReferencedTermsIdentityProofs"
  ).filter(
    ({ proof }) => proof.reference?.familyKey === contract.referenceFamilyKey
  );
  const memberships = membershipEntries(scopedAtoms);
  const requiredEdges = contract.membershipPath.slice(0, -1).map(
    (memberObjectKey, index) => ({
      memberObjectKey,
      classObjectKey: contract.membershipPath[index + 1],
    })
  );
  const pathEntries = requiredEdges.map(({ memberObjectKey, classObjectKey }) =>
    memberships.filter(({ proof }) =>
      edgeMatches(
        proof,
        "MEMBER_OF_CLASS",
        memberObjectKey,
        classObjectKey
      )
    )
  );
  const conflicts = requiredEdges.flatMap(({ memberObjectKey, classObjectKey }) =>
    memberships.filter(({ proof }) =>
      edgeMatches(
        proof,
        "EXCLUDED_FROM_CLASS",
        memberObjectKey,
        classObjectKey
      )
    )
  );
  const missing = [];
  if (references.length === 0) missing.push("SCOPED_PACKAGE_REFERENCE");
  if (identities.length === 0) missing.push("REFERENCED_TERMS_IDENTITY");
  requiredEdges.forEach((edge, index) => {
    if (pathEntries[index].length === 0)
      missing.push(`MEMBERSHIP:${edge.memberObjectKey}->${edge.classObjectKey}`);
  });
  const ambiguous =
    references.length > 1 ||
    identities.length > 1 ||
    pathEntries.some((entries) => entries.length > 1);
  const unsafeMembership = pathEntries.flat().some(({ atomSafe }) => !atomSafe);
  const referenceKeys = [...new Set(references.map(({ proof }) => proof.reference.referenceKey))];
  const identityKeys = [...new Set(identities.map(({ proof }) => proof.reference.referenceKey))];
  let status = COMPLETE_SOURCE_CHAIN;
  let reasonCode = "SOURCE_CHAIN_COMPLETE_OUTCOME_LOCKED";
  let remainingGates = ["TYPED_CONDITIONS", "DOCUMENT_PRECEDENCE"];
  if (conflicts.length > 0 || unsafeMembership) {
    status = CONFLICTING_MEMBERSHIP;
    reasonCode = "MEMBERSHIP_CONFLICT_OR_UNRESOLVED_SOURCE";
    remainingGates = ["CONFLICT_RESOLUTION"];
  } else if (ambiguous) {
    status = AMBIGUOUS_SOURCE_CHAIN;
    reasonCode = "MULTIPLE_SOURCE_PATHS";
    remainingGates = ["SOURCE_DISAMBIGUATION"];
  } else if (missing.length > 0) {
    status = INCOMPLETE_SOURCE_CHAIN;
    reasonCode = "SOURCE_CHAIN_COMPONENT_MISSING";
    remainingGates = missing;
  } else if (
    referenceKeys.length !== 1 ||
    identityKeys.length !== 1 ||
    referenceKeys[0] !== identityKeys[0]
  ) {
    status = REFERENCE_KEY_MISMATCH;
    reasonCode = "REFERENCE_AND_IDENTITY_KEY_DIFFER";
    remainingGates = ["REFERENCE_IDENTITY_MATCH"];
  }
  const evidence = {
    references: references.map(projectedEntry),
    identities: identities.map(projectedEntry),
    membershipPath: pathEntries.map((entries, index) => ({
      ...requiredEdges[index],
      entries: entries.map((entry) => ({
        documentUuids: entry.documentUuids,
        proofDigest: entry.proof.proofDigest,
        memberContextSpan: entry.proof.edge.memberContextSpan || null,
      })),
    })),
    conflicts: conflicts.map((entry) => ({
      documentUuids: entry.documentUuids,
      proofDigest: entry.proof.proofDigest,
      edge: entry.proof.edge,
    })),
  };
  const payload = {
    ...base,
    status,
    reasonCode,
    contract,
    referenceKey:
      referenceKeys.length === 1 &&
      identityKeys.length === 1 &&
      referenceKeys[0] === identityKeys[0]
        ? referenceKeys[0]
        : null,
    evidence,
    remainingGates,
  };
  return { ...payload, auditDigest: digest(payload) };
}

module.exports = {
  AMBIGUOUS_SOURCE_CHAIN,
  COMPLETE_SOURCE_CHAIN,
  CONDITION_POLICY,
  CONFLICTING_MEMBERSHIP,
  CONFLICT_POLICY,
  INCOMPLETE_SOURCE_CHAIN,
  PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_CONTRACT_ID,
  PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_SCHEMA_VERSION,
  REFERENCE_KEY_MISMATCH,
  buildPackageActivatedObjectMembershipAudit,
  validatePackageActivatedObjectMembershipAuditContract,
};
