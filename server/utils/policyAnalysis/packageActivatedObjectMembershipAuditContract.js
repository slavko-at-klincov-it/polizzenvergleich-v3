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

function exactObjectKeys(value, expected, code) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify([...expected].sort())
  )
    throw auditError(code);
}

function validateDocumentUuids(values, allowedDocumentUuids) {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.some((value) => !String(value || "").trim()) ||
    JSON.stringify(values) !== JSON.stringify([...new Set(values)].sort())
  )
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_DOCUMENT_UUIDS_INVALID");
  if (
    allowedDocumentUuids &&
    values.some((value) => !allowedDocumentUuids.has(value))
  )
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_DOCUMENT_UUID_UNKNOWN");
}

function validateProofDigest(value) {
  if (!/^[a-f0-9]{64}$/u.test(String(value || "")))
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_PROOF_DIGEST_INVALID");
}

function validateMemberContextSpan(span) {
  exactObjectKeys(
    span,
    [
      "source",
      "physicalPageNumber",
      "documentStart",
      "documentEnd",
      "exactText",
      "sha256",
    ],
    "PACKAGE_MEMBERSHIP_AUDIT_CONTEXT_SPAN_INVALID"
  );
  if (
    span.source !== "STRUCTURAL_LIST_ITEM" ||
    !Number.isInteger(span.physicalPageNumber) ||
    span.physicalPageNumber < 1 ||
    !Number.isInteger(span.documentStart) ||
    !Number.isInteger(span.documentEnd) ||
    span.documentEnd <= span.documentStart ||
    typeof span.exactText !== "string" ||
    span.exactText.length !== span.documentEnd - span.documentStart ||
    digestText(span.exactText) !== span.sha256
  )
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_CONTEXT_SPAN_INVALID");
}

function digestText(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
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
  if (
    contract.contractId !==
    PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_CONTRACT_ID
  )
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_CONTRACT_ID_INVALID", detail);
  if (contract.conditionPolicy !== CONDITION_POLICY)
    throw auditError(
      "PACKAGE_MEMBERSHIP_AUDIT_CONDITION_POLICY_INVALID",
      detail
    );
  if (contract.conflictPolicy !== CONFLICT_POLICY)
    throw auditError(
      "PACKAGE_MEMBERSHIP_AUDIT_CONFLICT_POLICY_INVALID",
      detail
    );
  if (
    !Array.isArray(contract.membershipPath) ||
    contract.membershipPath.length < 2
  )
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

function buildPackageActivatedObjectMembershipAudit({ categoryId, atoms }) {
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
  const requiredEdges = contract.membershipPath
    .slice(0, -1)
    .map((memberObjectKey, index) => ({
      memberObjectKey,
      classObjectKey: contract.membershipPath[index + 1],
    }));
  const pathEntries = requiredEdges.map(({ memberObjectKey, classObjectKey }) =>
    memberships.filter(({ proof }) =>
      edgeMatches(proof, "MEMBER_OF_CLASS", memberObjectKey, classObjectKey)
    )
  );
  const conflicts = requiredEdges.flatMap(
    ({ memberObjectKey, classObjectKey }) =>
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
      missing.push(
        `MEMBERSHIP:${edge.memberObjectKey}->${edge.classObjectKey}`
      );
  });
  const ambiguous =
    references.length > 1 ||
    identities.length > 1 ||
    pathEntries.some((entries) => entries.length > 1);
  const unsafeMembership = pathEntries.flat().some(({ atomSafe }) => !atomSafe);
  const referenceKeys = [
    ...new Set(references.map(({ proof }) => proof.reference.referenceKey)),
  ];
  const identityKeys = [
    ...new Set(identities.map(({ proof }) => proof.reference.referenceKey)),
  ];
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

function validateProjectedProofEntries(entries, allowedDocumentUuids) {
  if (!Array.isArray(entries))
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_EVIDENCE_ARRAY_INVALID");
  const digests = [];
  for (const entry of entries) {
    exactObjectKeys(
      entry,
      ["documentUuids", "documentRole", "documentStatus", "proofDigest"],
      "PACKAGE_MEMBERSHIP_AUDIT_EVIDENCE_ENTRY_INVALID"
    );
    validateDocumentUuids(entry.documentUuids, allowedDocumentUuids);
    validateProofDigest(entry.proofDigest);
    if (
      ![entry.documentRole, entry.documentStatus].every(
        (value) => value === null || (typeof value === "string" && value.trim())
      )
    )
      throw auditError("PACKAGE_MEMBERSHIP_AUDIT_DOCUMENT_METADATA_INVALID");
    digests.push(entry.proofDigest);
  }
  if (
    JSON.stringify(digests) !==
    JSON.stringify([...new Set(digests)].sort())
  )
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_EVIDENCE_NOT_CANONICAL");
}

function validateMembershipPathEvidence(
  evidence,
  contract,
  allowedDocumentUuids
) {
  if (
    !Array.isArray(evidence) ||
    evidence.length !== contract.membershipPath.length - 1
  )
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_PATH_EVIDENCE_INVALID");
  evidence.forEach((edge, index) => {
    exactObjectKeys(
      edge,
      ["memberObjectKey", "classObjectKey", "entries"],
      "PACKAGE_MEMBERSHIP_AUDIT_PATH_EDGE_INVALID"
    );
    if (
      edge.memberObjectKey !== contract.membershipPath[index] ||
      edge.classObjectKey !== contract.membershipPath[index + 1] ||
      !Array.isArray(edge.entries)
    )
      throw auditError("PACKAGE_MEMBERSHIP_AUDIT_PATH_EDGE_INVALID");
    const digests = [];
    for (const entry of edge.entries) {
      exactObjectKeys(
        entry,
        ["documentUuids", "proofDigest", "memberContextSpan"],
        "PACKAGE_MEMBERSHIP_AUDIT_PATH_ENTRY_INVALID"
      );
      validateDocumentUuids(entry.documentUuids, allowedDocumentUuids);
      validateProofDigest(entry.proofDigest);
      validateMemberContextSpan(entry.memberContextSpan);
      digests.push(entry.proofDigest);
    }
    if (
      JSON.stringify(digests) !==
      JSON.stringify([...new Set(digests)].sort())
    )
      throw auditError("PACKAGE_MEMBERSHIP_AUDIT_PATH_NOT_CANONICAL");
  });
}

function validateConflicts(conflicts, contract, allowedDocumentUuids) {
  if (!Array.isArray(conflicts))
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_CONFLICTS_INVALID");
  const requiredEdges = new Set(
    contract.membershipPath
      .slice(0, -1)
      .map(
        (memberObjectKey, index) =>
          `${memberObjectKey}->${contract.membershipPath[index + 1]}`
      )
  );
  const digests = [];
  for (const conflict of conflicts) {
    exactObjectKeys(
      conflict,
      ["documentUuids", "proofDigest", "edge"],
      "PACKAGE_MEMBERSHIP_AUDIT_CONFLICT_INVALID"
    );
    validateDocumentUuids(conflict.documentUuids, allowedDocumentUuids);
    validateProofDigest(conflict.proofDigest);
    if (
      conflict.edge?.relation !== "EXCLUDED_FROM_CLASS" ||
      !requiredEdges.has(
        `${conflict.edge?.memberObjectKey}->${conflict.edge?.classObjectKey}`
      )
    )
      throw auditError("PACKAGE_MEMBERSHIP_AUDIT_CONFLICT_EDGE_INVALID");
    digests.push(conflict.proofDigest);
  }
  if (
    JSON.stringify(digests) !==
    JSON.stringify([...new Set(digests)].sort())
  )
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_CONFLICTS_NOT_CANONICAL");
}

function validatePackageActivatedObjectMembershipAudit(
  audit,
  { categoryId, allowedDocumentUuids } = {}
) {
  const ambiguousContract =
    audit?.status === AMBIGUOUS_SOURCE_CHAIN &&
    audit?.reasonCode === "AUDIT_CONTRACT_AMBIGUOUS";
  exactObjectKeys(
    audit,
    ambiguousContract
      ? [
          "schemaVersion",
          "contractId",
          "categoryId",
          "readyForDecision",
          "status",
          "reasonCode",
          "remainingGates",
          "auditDigest",
        ]
      : [
          "schemaVersion",
          "contractId",
          "categoryId",
          "readyForDecision",
          "status",
          "reasonCode",
          "contract",
          "referenceKey",
          "evidence",
          "remainingGates",
          "auditDigest",
        ],
    "PACKAGE_MEMBERSHIP_AUDIT_SHAPE_INVALID"
  );
  if (
    audit.schemaVersion !==
      PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_SCHEMA_VERSION ||
    audit.contractId !==
      PACKAGE_ACTIVATED_OBJECT_MEMBERSHIP_AUDIT_CONTRACT_ID ||
    audit.categoryId !== categoryId ||
    audit.readyForDecision !== false
  )
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_IDENTITY_INVALID");
  validateProofDigest(audit.auditDigest);
  const { auditDigest, ...payload } = audit;
  if (digest(payload) !== auditDigest)
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_DIGEST_MISMATCH");
  if (ambiguousContract) {
    if (
      JSON.stringify(audit.remainingGates) !==
      JSON.stringify(["CONTRACT_IDENTITY"])
    )
      throw auditError("PACKAGE_MEMBERSHIP_AUDIT_GATES_INVALID");
    return audit;
  }

  const contract = validatePackageActivatedObjectMembershipAuditContract(
    audit.contract,
    categoryId
  );
  exactObjectKeys(
    audit.evidence,
    ["references", "identities", "membershipPath", "conflicts"],
    "PACKAGE_MEMBERSHIP_AUDIT_EVIDENCE_INVALID"
  );
  validateProjectedProofEntries(audit.evidence.references, allowedDocumentUuids);
  validateProjectedProofEntries(audit.evidence.identities, allowedDocumentUuids);
  validateMembershipPathEvidence(
    audit.evidence.membershipPath,
    contract,
    allowedDocumentUuids
  );
  validateConflicts(audit.evidence.conflicts, contract, allowedDocumentUuids);

  const missing = [];
  if (audit.evidence.references.length === 0)
    missing.push("SCOPED_PACKAGE_REFERENCE");
  if (audit.evidence.identities.length === 0)
    missing.push("REFERENCED_TERMS_IDENTITY");
  audit.evidence.membershipPath.forEach((edge) => {
    if (edge.entries.length === 0)
      missing.push(
        `MEMBERSHIP:${edge.memberObjectKey}->${edge.classObjectKey}`
      );
  });
  const ambiguous =
    audit.evidence.references.length > 1 ||
    audit.evidence.identities.length > 1 ||
    audit.evidence.membershipPath.some(({ entries }) => entries.length > 1);
  const expectedByStatus = {
    [COMPLETE_SOURCE_CHAIN]: {
      reasonCode: "SOURCE_CHAIN_COMPLETE_OUTCOME_LOCKED",
      gates: ["TYPED_CONDITIONS", "DOCUMENT_PRECEDENCE"],
      valid:
        missing.length === 0 &&
        !ambiguous &&
        audit.evidence.conflicts.length === 0 &&
        typeof audit.referenceKey === "string",
    },
    [INCOMPLETE_SOURCE_CHAIN]: {
      reasonCode: "SOURCE_CHAIN_COMPONENT_MISSING",
      gates: missing,
      valid: missing.length > 0,
    },
    [AMBIGUOUS_SOURCE_CHAIN]: {
      reasonCode: "MULTIPLE_SOURCE_PATHS",
      gates: ["SOURCE_DISAMBIGUATION"],
      valid: ambiguous,
    },
    [REFERENCE_KEY_MISMATCH]: {
      reasonCode: "REFERENCE_AND_IDENTITY_KEY_DIFFER",
      gates: ["REFERENCE_IDENTITY_MATCH"],
      valid: missing.length === 0 && !ambiguous && audit.referenceKey === null,
    },
    [CONFLICTING_MEMBERSHIP]: {
      reasonCode: "MEMBERSHIP_CONFLICT_OR_UNRESOLVED_SOURCE",
      gates: ["CONFLICT_RESOLUTION"],
      valid: missing.length === 0,
    },
  };
  const expected = expectedByStatus[audit.status];
  if (
    !expected ||
    !expected.valid ||
    audit.reasonCode !== expected.reasonCode ||
    JSON.stringify(audit.remainingGates) !== JSON.stringify(expected.gates)
  )
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_STATUS_INVALID");
  if (
    audit.referenceKey !== null &&
    !new RegExp(`^${contract.referenceFamilyKey}@[\\p{L}\\p{N}._/-]+$`, "u").test(
      audit.referenceKey
    )
  )
    throw auditError("PACKAGE_MEMBERSHIP_AUDIT_REFERENCE_KEY_INVALID");
  return audit;
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
  validatePackageActivatedObjectMembershipAudit,
  validatePackageActivatedObjectMembershipAuditContract,
};
