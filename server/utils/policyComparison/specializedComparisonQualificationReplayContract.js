const crypto = require("crypto");
const { decidePoint } = require("./pointDecision");
const {
  FIRE_DEFINITION_COMPARISON_AUDIT_CONTRACT_ID,
  FIRE_DEFINITION_COMPARISON_RULE_ID,
} = require("./fireDefinitionComparisonContract");
const {
  FE_C07_LIMIT_DOMINANCE_AUDIT_CONTRACT_ID,
  FE_C07_LIMIT_DOMINANCE_RULE_ID,
} = require("./feC07LimitDominanceContract");
const {
  FE_A01_REQUIREMENT_CONTRACT_DIGEST,
  FE_C07_REQUIREMENT_CONTRACT_DIGEST,
} = require("./productContract");

const SPECIALIZED_COMPARISON_QUALIFICATION_REPLAY_CONTRACT_ID =
  "SPECIALIZED_COMPARISON_QUALIFICATION_REPLAY_V1";

const CONTRACTS = Object.freeze({
  "FE-A01": Object.freeze({
    categoryView: "FE",
    categoryId: "FE-A01",
    componentId: "fire_definition",
    factRole: "DEFINITION",
    requirementContractDigest: FE_A01_REQUIREMENT_CONTRACT_DIGEST,
    ruleId: FIRE_DEFINITION_COMPARISON_RULE_ID,
    auditContractId: FIRE_DEFINITION_COMPARISON_AUDIT_CONTRACT_ID,
  }),
  "FE-C07": Object.freeze({
    categoryView: "FE",
    categoryId: "FE-C07",
    componentId: "sauna_or_infrared_cabin_in_common_room",
    factRole: "INSURED_OBJECT",
    requirementContractDigest: FE_C07_REQUIREMENT_CONTRACT_DIGEST,
    ruleId: FE_C07_LIMIT_DOMINANCE_RULE_ID,
    auditContractId: FE_C07_LIMIT_DOMINANCE_AUDIT_CONTRACT_ID,
  }),
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

function sameJson(left, right) {
  return (
    JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
  );
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function canonicalStrings(values) {
  return [...new Set((values || []).map(String).filter(Boolean))].sort();
}

function comparisonContract(categoryView, categoryId) {
  const contract = CONTRACTS[categoryId];
  return contract?.categoryView === categoryView ? contract : null;
}

function expectedDocuments(values, side) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const documents = values
    .map((document) => ({
      uuid: String(document?.uuid || ""),
      side: String(document?.side || ""),
      role: String(document?.role || ""),
      documentStatus: String(document?.documentStatus || ""),
      sha256: String(document?.sha256 || ""),
    }))
    .sort((left, right) => left.uuid.localeCompare(right.uuid));
  if (
    documents.some(
      (document) =>
        !document.uuid ||
        document.side !== side ||
        !document.role ||
        !document.documentStatus ||
        !/^[a-f0-9]{64}$/u.test(document.sha256)
    ) ||
    new Set(documents.map(({ uuid }) => uuid)).size !== documents.length
  )
    return null;
  return documents;
}

function candidateIdentity(atom, source, document) {
  const exactText = String(source?.exactText || "");
  const conditionCheckText = String(source?.conditionCheckText || "");
  const relativeStart =
    source?.documentStart - source?.conditionCheckDocumentStart;
  const relativeEnd = source?.documentEnd - source?.conditionCheckDocumentStart;
  if (
    source?.documentFingerprint !== document.sha256 ||
    !Number.isInteger(source?.candidateIdentityPageNumber) ||
    source.candidateIdentityPageNumber < 1 ||
    !Number.isInteger(source?.physicalPageNumber) ||
    source.physicalPageNumber < 1 ||
    !Number.isInteger(source?.documentStart) ||
    !Number.isInteger(source?.documentEnd) ||
    source.documentStart < 0 ||
    source.documentEnd !== source.documentStart + exactText.length ||
    source.exactTextSha256 !== sha256Text(exactText) ||
    !Number.isInteger(source?.conditionCheckDocumentStart) ||
    !Number.isInteger(source?.conditionCheckDocumentEnd) ||
    source.conditionCheckDocumentStart < 0 ||
    source.conditionCheckDocumentEnd !==
      source.conditionCheckDocumentStart + conditionCheckText.length ||
    source.conditionCheckTextSha256 !== sha256Text(conditionCheckText) ||
    relativeStart < 0 ||
    relativeEnd > conditionCheckText.length ||
    conditionCheckText.slice(relativeStart, relativeEnd) !== exactText
  )
    return null;
  const identity = [
    document.sha256,
    atom.requirementId,
    atom.componentId,
    source.candidateIdentityPageNumber,
    source.documentStart,
    source.documentEnd,
  ].join(":");
  return `candidate:${crypto.createHash("sha256").update(identity).digest("hex")}`;
}

function sourceProofFingerprintsMatch(atom, document) {
  const proofs = [
    ...(atom?.supportingCoverageConditionFormulaProofs || []),
    ...(atom?.supportingScopedPackageReferenceProofs || []),
    ...(atom?.supportingReferencedTermsIdentityProofs || []),
    ...(atom?.supportingObjectMembershipProofs || []),
    ...(atom?.sources || [])
      .map(({ objectMembershipProof }) => objectMembershipProof)
      .filter(Boolean),
  ];
  return proofs.every(
    ({ documentFingerprint }) => documentFingerprint === document.sha256
  );
}

function fieldSourcesMatch(atom, document) {
  const selected = new Set(atom?.selectedCandidateIds || []);
  for (const field of atom?.fields || []) {
    for (const fact of field?.facts || []) {
      const source = fact?.source;
      if (
        !source ||
        !selected.has(source.candidateId) ||
        source.documentFingerprint !== document.sha256 ||
        !Number.isInteger(source.physicalPageNumber) ||
        source.physicalPageNumber < 1 ||
        !Number.isInteger(source.documentStart) ||
        !Number.isInteger(source.documentEnd) ||
        source.documentEnd !==
          source.documentStart + String(source.exactText || "").length ||
        source.exactTextSha256 !== sha256Text(source.exactText)
      )
        return false;
    }
    const absenceSource = field?.absenceAudit?.source;
    if (
      absenceSource &&
      (!selected.has(absenceSource.candidateId) ||
        absenceSource.documentFingerprint !== document.sha256 ||
        absenceSource.exactTextSha256 !== sha256Text(absenceSource.exactText))
    )
      return false;
  }
  return true;
}

function exactAtomBinding(atom, document, contract) {
  if (
    !sameJson(canonicalStrings(atom?.documentUuids), [document.uuid]) ||
    atom?.documentRole !== document.role ||
    atom?.documentStatus !== document.documentStatus ||
    atom?.requirementId !== contract.categoryId ||
    atom?.componentId !== contract.componentId ||
    atom?.factRole !== contract.factRole ||
    atom?.componentSatisfactionPolicy !== "ALL" ||
    !sameJson(atom?.declaredComponents, [
      { id: contract.componentId, factRole: contract.factRole },
    ]) ||
    atom?.requirementContractDigest !== contract.requirementContractDigest ||
    !Array.isArray(atom?.selectedCandidateIds) ||
    !Array.isArray(atom?.unresolvedCandidateIds) ||
    !Array.isArray(atom?.sources) ||
    !Array.isArray(atom?.fields) ||
    !sourceProofFingerprintsMatch(atom, document) ||
    !fieldSourcesMatch(atom, document)
  )
    return false;
  const selected = canonicalStrings(atom.selectedCandidateIds);
  const sourceIds = canonicalStrings(
    atom.sources.map(({ candidateId }) => candidateId)
  );
  if (!sameJson(selected, sourceIds)) return false;
  return atom.sources.every(
    (source) => source.candidateId === candidateIdentity(atom, source, document)
  );
}

function sideProjection({ atoms, documents, contract }) {
  const relevant = (atoms || []).filter(
    (atom) => atom?.requirementId === contract.categoryId
  );
  if (relevant.length !== documents.length) return null;
  const byDocument = new Map();
  for (const atom of relevant) {
    const [documentUuid] = canonicalStrings(atom?.documentUuids);
    if (!documentUuid || byDocument.has(documentUuid)) return null;
    byDocument.set(documentUuid, atom);
  }
  if (
    documents.some(
      (document) =>
        !byDocument.has(document.uuid) ||
        !exactAtomBinding(byDocument.get(document.uuid), document, contract)
    )
  )
    return null;
  return stableValue(
    relevant.sort((left, right) =>
      left.documentUuids[0].localeCompare(right.documentUuids[0])
    )
  );
}

/**
 * Persists the complete, source-bound inputs for narrowly certified bilateral
 * comparators. The replay is outcome-neutral: it contains no winner or point
 * decision. Role: boundary. Side effects: none.
 */
function buildSpecializedComparisonQualificationReplay({
  categoryView,
  categoryId,
  atomsA,
  atomsB,
  expectedDocumentsA,
  expectedDocumentsB,
}) {
  const contract = comparisonContract(categoryView, categoryId);
  if (!contract) return null;
  const documents = {
    A: expectedDocuments(expectedDocumentsA, "A"),
    B: expectedDocuments(expectedDocumentsB, "B"),
  };
  if (!documents.A || !documents.B) return null;
  const projectedAtomsBySide = {
    A: sideProjection({
      atoms: atomsA,
      documents: documents.A,
      contract,
    }),
    B: sideProjection({
      atoms: atomsB,
      documents: documents.B,
      contract,
    }),
  };
  if (!projectedAtomsBySide.A || !projectedAtomsBySide.B) return null;
  const body = {
    schemaVersion: 1,
    contractId: SPECIALIZED_COMPARISON_QUALIFICATION_REPLAY_CONTRACT_ID,
    categoryView,
    categoryId,
    componentId: contract.componentId,
    factRole: contract.factRole,
    requirementContractDigest: contract.requirementContractDigest,
    comparisonRuleId: contract.ruleId,
    comparisonAuditContractId: contract.auditContractId,
    projectedAtomsBySide,
    projectedAtomDigestsSha256: {
      A: sha256(projectedAtomsBySide.A),
      B: sha256(projectedAtomsBySide.B),
    },
    documentManifestBySide: documents,
    documentManifestDigestsSha256: {
      A: sha256(documents.A),
      B: sha256(documents.B),
    },
  };
  return { ...body, replayDigestSha256: sha256(body) };
}

function validateSpecializedComparisonQualificationReplay(replay, options) {
  const expected = buildSpecializedComparisonQualificationReplay({
    categoryView: options?.categoryView,
    categoryId: options?.categoryId,
    atomsA: replay?.projectedAtomsBySide?.A,
    atomsB: replay?.projectedAtomsBySide?.B,
    expectedDocumentsA: options?.expectedDocumentsA,
    expectedDocumentsB: options?.expectedDocumentsB,
  });
  if (!expected)
    throw new Error("SPECIALIZED_COMPARISON_QUALIFICATION_REPLAY_INVALID");
  if (!sameJson(replay, expected))
    throw new Error("SPECIALIZED_COMPARISON_QUALIFICATION_REPLAY_MISMATCH");
  return true;
}

function buildSpecializedPointDecisionFromQualificationReplay({
  replay,
  packageA,
  packageB,
  expectedDocumentsA,
  expectedDocumentsB,
}) {
  validateSpecializedComparisonQualificationReplay(replay, {
    categoryView: replay?.categoryView,
    categoryId: replay?.categoryId,
    expectedDocumentsA,
    expectedDocumentsB,
  });
  return decidePoint({
    categoryId: replay.categoryId,
    packageA,
    packageB,
    atomsA: replay.projectedAtomsBySide.A,
    atomsB: replay.projectedAtomsBySide.B,
    expectedDocumentsA,
    expectedDocumentsB,
  });
}

function specializedComparisonDecisionDetected(pointDecision, contract) {
  if (!contract) return false;
  const ruleIds = String(pointDecision?.ruleId || "").split("+");
  return Boolean(
    ruleIds.includes(contract.ruleId) ||
      (pointDecision?.dimensions || []).some(
        ({ comparisonAudit }) =>
          comparisonAudit?.contractId === contract.auditContractId
      )
  );
}

module.exports = {
  SPECIALIZED_COMPARISON_QUALIFICATION_REPLAY_CONTRACT_ID,
  buildSpecializedComparisonQualificationReplay,
  buildSpecializedPointDecisionFromQualificationReplay,
  comparisonContract,
  specializedComparisonDecisionDetected,
  validateSpecializedComparisonQualificationReplay,
};
