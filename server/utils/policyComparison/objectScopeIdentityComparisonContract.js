const crypto = require("crypto");
const {
  SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_CONTRACT_ID,
  validateObjectScopeEvidenceContract,
} = require("../policyAnalysis/objectScopeEvidenceContract");

const OBJECT_SCOPE_IDENTITY_COMPARISON_CONTRACT_ID =
  "SOURCE_BOUND_OBJECT_SCOPE_IDENTITY_GATE_V1";
const OBJECT_SCOPE_IDENTITY_COMPARISON_POLICY =
  "EXACT_SOURCE_BOUND_OBJECT_SCOPE_IDENTITY_V1";
const OBJECT_SCOPE_IDENTITY_SATISFACTION_POLICY =
  "EXACTLY_ONE_CONFLICT_FREE_SCOPE_KEY_PER_SIDE";
const OBJECT_SCOPE_IDENTITY_COMPARISON_RULE_ID =
  "SOURCE_BOUND_OBJECT_SCOPE_IDENTITY_GATE_V1";
const OBJECT_SCOPE_IDENTITY_AUDIT_CONTRACT_ID =
  "SOURCE_BOUND_OBJECT_SCOPE_IDENTITY_AUDIT_V1";

const OBJECT_SCOPE_IDENTITY = Object.freeze({
  SAME: "SAME",
  DIFFERENT: "DIFFERENT",
  INCOMPLETE: "INCOMPLETE",
});

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function digest(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function textDigest(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function sameJson(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function exactKeys(value, expected) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      sameJson(Object.keys(value).sort(), [...expected].sort())
  );
}

function validateObjectScopeIdentityComparisonContract(
  contract,
  objectScopeEvidenceContract
) {
  if (
    !exactKeys(contract, [
      "contractId",
      "allowedObjectScopeKeys",
      "comparisonPolicy",
      "satisfactionPolicy",
    ]) ||
    contract.contractId !== OBJECT_SCOPE_IDENTITY_COMPARISON_CONTRACT_ID ||
    contract.comparisonPolicy !== OBJECT_SCOPE_IDENTITY_COMPARISON_POLICY ||
    contract.satisfactionPolicy !== OBJECT_SCOPE_IDENTITY_SATISFACTION_POLICY ||
    !Array.isArray(contract.allowedObjectScopeKeys) ||
    contract.allowedObjectScopeKeys.length < 2 ||
    new Set(contract.allowedObjectScopeKeys).size !==
      contract.allowedObjectScopeKeys.length ||
    contract.allowedObjectScopeKeys.some(
      (key) => !/^[A-Z][A-Z0-9_]*$/u.test(String(key || ""))
    )
  )
    throw new Error("OBJECT_SCOPE_IDENTITY_COMPARISON_CONTRACT_INVALID");

  const evidence = validateObjectScopeEvidenceContract(
    objectScopeEvidenceContract,
    "objectScopeIdentityComparisonContract"
  );
  const evidenceKeys = evidence.families
    .map(({ objectScopeKey }) => objectScopeKey)
    .sort();
  const allowedKeys = [...contract.allowedObjectScopeKeys].sort();
  if (!sameJson(allowedKeys, evidenceKeys))
    throw new Error("OBJECT_SCOPE_IDENTITY_COMPARISON_KEYS_INVALID");
  return {
    contractId: OBJECT_SCOPE_IDENTITY_COMPARISON_CONTRACT_ID,
    allowedObjectScopeKeys: allowedKeys,
    comparisonPolicy: OBJECT_SCOPE_IDENTITY_COMPARISON_POLICY,
    satisfactionPolicy: OBJECT_SCOPE_IDENTITY_SATISFACTION_POLICY,
  };
}

function atomParts(atom) {
  return atom?.comparisonProjectionContractId &&
    Array.isArray(atom.comparisonContributors)
    ? atom.comparisonContributors
    : [atom];
}

function proofMatchesSource({ proof, source, evidenceContract, allowedKeys }) {
  if (
    !exactKeys(proof, [
      "contractId",
      "objectScopeEvidenceContractDigest",
      "assertions",
      "objectScopeKeys",
      "proofDigest",
    ]) ||
    proof.contractId !== SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_CONTRACT_ID ||
    !Array.isArray(proof.assertions) ||
    proof.assertions.length !== 1 ||
    !Array.isArray(proof.objectScopeKeys) ||
    proof.objectScopeKeys.length !== 1 ||
    !allowedKeys.includes(proof.objectScopeKeys[0]) ||
    proof.objectScopeEvidenceContractDigest !== digest(evidenceContract)
  )
    return false;
  const { proofDigest, ...payload } = proof;
  if (proofDigest !== digest(payload)) return false;
  const [assertion] = proof.assertions;
  if (
    !exactKeys(assertion, [
      "objectScopeKey",
      "relation",
      "sourceKind",
      "matches",
    ]) ||
    assertion.objectScopeKey !== proof.objectScopeKeys[0] ||
    assertion.relation !== "CLAUSE_OBJECT_SCOPE" ||
    assertion.sourceKind !== "STRUCTURAL_LOCAL_CONTEXT" ||
    !Array.isArray(assertion.matches) ||
    assertion.matches.length === 0 ||
    !Number.isInteger(source?.conditionCheckDocumentStart) ||
    !Number.isInteger(source?.conditionCheckDocumentEnd) ||
    typeof source?.conditionCheckText !== "string" ||
    source.conditionCheckDocumentEnd !==
      source.conditionCheckDocumentStart + source.conditionCheckText.length
  )
    return false;
  return assertion.matches.every((match) => {
    if (
      !exactKeys(match, [
        "matchedAlias",
        "physicalPageNumber",
        "documentStart",
        "documentEnd",
        "exactText",
        "sha256",
      ]) ||
      match.physicalPageNumber !== source.physicalPageNumber ||
      !Number.isInteger(match.documentStart) ||
      !Number.isInteger(match.documentEnd) ||
      match.documentStart < source.conditionCheckDocumentStart ||
      match.documentEnd > source.conditionCheckDocumentEnd ||
      match.documentEnd <= match.documentStart ||
      match.sha256 !== textDigest(match.exactText)
    )
      return false;
    const start = match.documentStart - source.conditionCheckDocumentStart;
    const end = match.documentEnd - source.conditionCheckDocumentStart;
    return source.conditionCheckText.slice(start, end) === match.exactText;
  });
}

function sideProjection(atom, comparisonContract, evidenceContract) {
  const proofDigests = [];
  const keys = new Set();
  for (const part of atomParts(atom)) {
    let normalizedComparisonContract;
    let normalizedEvidenceContract;
    try {
      normalizedEvidenceContract = validateObjectScopeEvidenceContract(
        part?.objectScopeEvidenceContract,
        "objectScopeIdentityComparisonPart"
      );
      normalizedComparisonContract =
        validateObjectScopeIdentityComparisonContract(
          part?.objectScopeIdentityComparisonContract,
          normalizedEvidenceContract
        );
    } catch {
      return null;
    }
    if (
      !sameJson(normalizedComparisonContract, comparisonContract) ||
      !sameJson(normalizedEvidenceContract, evidenceContract) ||
      part?.conflictState !== "NONE" ||
      !Array.isArray(part?.selectedCandidateIds) ||
      part.selectedCandidateIds.length === 0
    )
      return null;
    const selectedIds = new Set(part.selectedCandidateIds);
    const sources = (part.sources || []).filter(({ candidateId }) =>
      selectedIds.has(candidateId)
    );
    if (sources.length !== selectedIds.size) return null;
    for (const source of sources) {
      if (
        !proofMatchesSource({
          proof: source.objectScopeProof,
          source,
          evidenceContract,
          allowedKeys: comparisonContract.allowedObjectScopeKeys,
        })
      )
        return null;
      keys.add(source.objectScopeProof.objectScopeKeys[0]);
      proofDigests.push(source.objectScopeProof.proofDigest);
    }
  }
  if (keys.size !== 1) return null;
  return {
    objectScopeKey: [...keys][0],
    proofDigests: [...new Set(proofDigests)].sort(),
  };
}

/**
 * Compares only source-bound object-scope identity. It never chooses a winner.
 * Role: pure domain comparison. Side effects: none.
 */
function compareObjectScopeIdentity(left, right) {
  const leftComparisonContract = left?.objectScopeIdentityComparisonContract;
  const rightComparisonContract = right?.objectScopeIdentityComparisonContract;
  if (!leftComparisonContract && !rightComparisonContract) return null;

  let comparisonContract;
  let evidenceContract;
  try {
    if (
      !sameJson(leftComparisonContract, rightComparisonContract) ||
      !sameJson(
        left?.objectScopeEvidenceContract,
        right?.objectScopeEvidenceContract
      )
    )
      throw new Error("OBJECT_SCOPE_IDENTITY_COMPARISON_CONTRACT_MISMATCH");
    evidenceContract = validateObjectScopeEvidenceContract(
      left.objectScopeEvidenceContract,
      "objectScopeIdentityComparison"
    );
    comparisonContract = validateObjectScopeIdentityComparisonContract(
      leftComparisonContract,
      evidenceContract
    );
  } catch {
    return {
      identity: OBJECT_SCOPE_IDENTITY.INCOMPLETE,
      audit: null,
    };
  }

  const sides = {
    A: sideProjection(left, comparisonContract, evidenceContract),
    B: sideProjection(right, comparisonContract, evidenceContract),
  };
  const identity =
    !sides.A || !sides.B
      ? OBJECT_SCOPE_IDENTITY.INCOMPLETE
      : sides.A.objectScopeKey === sides.B.objectScopeKey
        ? OBJECT_SCOPE_IDENTITY.SAME
        : OBJECT_SCOPE_IDENTITY.DIFFERENT;
  const body = {
    contractId: OBJECT_SCOPE_IDENTITY_AUDIT_CONTRACT_ID,
    comparisonContract,
    comparisonContractDigest: digest(comparisonContract),
    objectScopeEvidenceContractDigest: digest(evidenceContract),
    identity,
    sides,
    comparisonComplete: identity !== OBJECT_SCOPE_IDENTITY.INCOMPLETE,
  };
  return { identity, audit: { ...body, auditDigest: digest(body) } };
}

module.exports = {
  OBJECT_SCOPE_IDENTITY,
  OBJECT_SCOPE_IDENTITY_AUDIT_CONTRACT_ID,
  OBJECT_SCOPE_IDENTITY_COMPARISON_CONTRACT_ID,
  OBJECT_SCOPE_IDENTITY_COMPARISON_POLICY,
  OBJECT_SCOPE_IDENTITY_COMPARISON_RULE_ID,
  OBJECT_SCOPE_IDENTITY_SATISFACTION_POLICY,
  compareObjectScopeIdentity,
  validateObjectScopeIdentityComparisonContract,
};
