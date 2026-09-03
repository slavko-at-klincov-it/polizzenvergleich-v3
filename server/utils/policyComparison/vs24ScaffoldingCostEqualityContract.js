const crypto = require("crypto");
const {
  PACKAGE_MEMBER,
  atomHasConditionalOrOptionalSource,
  comparisonApplicability,
  completeRawComparisonAtom,
} = require("./comparisonAtomCanonicalization");

const VS24_CATEGORY_ID = "VS-24";
const VS24_COMPONENT_ID = "scaffolding_costs";
const VS24_SCOPE_KEY = "GLASBRUCH_INSURANCE";
const VS24_REQUIREMENT_CONTRACT_DIGEST_SHA256 =
  "2ccf74464a4dbc28c3855e771ba3ae9918f73da28dd5181235941a5c2ee0495d";
const VS24_SCAFFOLDING_COST_EQUALITY_AUDIT_CONTRACT_ID =
  "VS24_GLASS_LOSS_SCAFFOLDING_COST_EQUALITY_AUDIT_V1";
const VS24_SCAFFOLDING_COST_EQUALITY_RULE_ID =
  "VS24_EQUIVALENT_GLASS_LOSS_SCAFFOLDING_COST_WITHOUT_LOCAL_LIMIT_V1";
const VS24_SCAFFOLDING_COST_EQUALITY_REASON_CODE =
  "EQUIVALENT_GLASS_LOSS_SCAFFOLDING_COST_WITHOUT_LOCAL_LIMIT";

const LOCAL_LIMIT_MARKER =
  /(?:\b(?:eur|euro|sublimit|höchstentschädigung)\b|€|\d(?:[\d.,\s]*\d)?\s*%|\bbis\s+(?:zu\s+)?(?:\d|eur|euro|€)|\bhöchstens\b|\bmaximal\b|\bbetraglich(?:e|en|er|es)?\s+(?:beschränkt|unbeschränkt|begrenzung|beschränkung)\b)/iu;
const VS24_SOURCE_ATOM_DIGEST_REPLAY_CONTRACT_ID =
  "VS24_SOURCE_ATOM_DIGEST_REPLAY_V1";

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
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function strings(values) {
  return [...new Set((values || []).map(String).filter(Boolean))].sort();
}

function exactStrings(value, expected) {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

function exactRequirementContract(contract) {
  return Boolean(
    contract?.digest === VS24_REQUIREMENT_CONTRACT_DIGEST_SHA256 &&
      contract?.componentSatisfactionPolicy === "ALL" &&
      Array.isArray(contract?.components) &&
      contract.components.length === 1 &&
      contract.components[0]?.id === VS24_COMPONENT_ID &&
      contract.components[0]?.factRole === "COST"
  );
}

function expectedDocumentsForSide(expectedDocuments, side) {
  if (!Array.isArray(expectedDocuments) || expectedDocuments.length === 0)
    return null;
  const normalized = expectedDocuments.map(
    ({ uuid, side: documentSide, role, documentStatus }) => ({
      uuid: String(uuid || ""),
      side: String(documentSide || ""),
      role: String(role || ""),
      documentStatus: String(documentStatus || ""),
    })
  );
  if (
    normalized.some(
      (document) =>
        !document.uuid ||
        document.side !== side ||
        !document.role ||
        !document.documentStatus
    ) ||
    strings(normalized.map(({ uuid }) => uuid)).length !== normalized.length
  )
    return null;
  return normalized.sort((left, right) => left.uuid.localeCompare(right.uuid));
}

function exactOptionalLimitAbsent(atom) {
  return Boolean(
    atom?.requestedFieldStatus === "NOT_REQUIRED" &&
      exactStrings(atom?.requestedFields, []) &&
      exactStrings(atom?.optionalFields, ["limit"]) &&
      Array.isArray(atom?.fields) &&
      atom.fields.length === 1 &&
      atom.fields[0]?.field === "limit" &&
      atom.fields[0]?.status === "NOT_FOUND" &&
      Array.isArray(atom.fields[0]?.facts) &&
      atom.fields[0].facts.length === 0
  );
}

function exactFoundAtom(atom, expectedDocument) {
  if (
    atom?.requirementId !== VS24_CATEGORY_ID ||
    atom?.componentId !== VS24_COMPONENT_ID ||
    atom?.factRole !== "COST" ||
    atom?.evidencePresence !== "FOUND" ||
    atom?.coverageEffect !== "INCLUDED" ||
    atom?.conflictState !== "NONE" ||
    (atom?.unresolvedCandidateIds || []).length !== 0 ||
    atom?.componentSatisfactionPolicy !== "ALL" ||
    !exactRequirementContract({
      digest: atom?.requirementContractDigest,
      componentSatisfactionPolicy: atom?.componentSatisfactionPolicy,
      components: atom?.declaredComponents,
    }) ||
    atom?.selectedScopePicture !== "NARROW_ONLY" ||
    atom?.scopePolicy !== "MATCHING_SCOPE_INCLUDED_SUFFICIENT" ||
    !exactStrings(atom?.comparisonScopeKeys, [VS24_SCOPE_KEY]) ||
    !exactOptionalLimitAbsent(atom) ||
    comparisonApplicability(atom) !== PACKAGE_MEMBER ||
    !completeRawComparisonAtom(atom) ||
    atomHasConditionalOrOptionalSource(atom) ||
    !exactStrings(atom?.documentUuids, [expectedDocument.uuid]) ||
    atom?.documentRole !== expectedDocument.role ||
    atom?.documentStatus !== expectedDocument.documentStatus ||
    !Array.isArray(atom?.selectedCandidateIds) ||
    atom.selectedCandidateIds.length !== 1 ||
    !Array.isArray(atom?.sources) ||
    atom.sources.length !== 1
  )
    return false;

  const source = atom.sources[0];
  return Boolean(
    source?.candidateId === atom.selectedCandidateIds[0] &&
      source?.candidateBinding === "NARROW_SCOPE" &&
      source?.deterministicBindingBasis === "EXPLICIT_NARROW_SECTION_SCOPE" &&
      source?.comparisonScopeKey === VS24_SCOPE_KEY &&
      Number.isInteger(source?.physicalPageNumber) &&
      source.physicalPageNumber > 0 &&
      /gerüst/iu.test(source?.exactText || "") &&
      String(source?.conditionCheckText || "").trim().length > 0 &&
      !LOCAL_LIMIT_MARKER.test(source.conditionCheckText)
  );
}

function exactAbsentAtom(atom, expectedDocument) {
  return Boolean(
    atom?.requirementId === VS24_CATEGORY_ID &&
      atom?.componentId === VS24_COMPONENT_ID &&
      atom?.factRole === "COST" &&
      exactRequirementContract({
        digest: atom?.requirementContractDigest,
        componentSatisfactionPolicy: atom?.componentSatisfactionPolicy,
        components: atom?.declaredComponents,
      }) &&
      atom?.evidencePresence === "NOT_FOUND" &&
      atom?.coverageEffect === "UNKNOWN" &&
      atom?.conflictState === "NONE" &&
      (atom?.selectedCandidateIds || []).length === 0 &&
      (atom?.unresolvedCandidateIds || []).length === 0 &&
      (atom?.sources || []).length === 0 &&
      atom?.requestedFieldStatus === "NOT_REQUIRED" &&
      exactStrings(atom?.requestedFields, []) &&
      exactStrings(atom?.optionalFields, ["limit"]) &&
      Array.isArray(atom?.fields) &&
      atom.fields.length === 1 &&
      atom.fields[0]?.field === "limit" &&
      atom.fields[0]?.status === "NOT_FOUND" &&
      Array.isArray(atom.fields[0]?.facts) &&
      atom.fields[0].facts.length === 0 &&
      exactStrings(atom?.documentUuids, [expectedDocument.uuid]) &&
      atom?.documentRole === expectedDocument.role &&
      atom?.documentStatus === expectedDocument.documentStatus
  );
}

function sourceProof(atom) {
  const source = atom.sources[0];
  return {
    documentUuid: atom.documentUuids[0],
    documentRole: atom.documentRole,
    documentStatus: atom.documentStatus,
    documentApplicability: atom.documentApplicability,
    candidateId: source.candidateId,
    physicalPageNumber: source.physicalPageNumber,
    exactText: source.exactText,
    conditionCheckText: source.conditionCheckText,
    comparisonScopeKey: source.comparisonScopeKey,
    localLimitStatus: "NOT_FOUND",
  };
}

function projectedAtoms(atoms) {
  return stableValue(
    (atoms || [])
      .filter(({ requirementId }) => requirementId === VS24_CATEGORY_ID)
      .sort((left, right) =>
        JSON.stringify(stableValue(left)).localeCompare(
          JSON.stringify(stableValue(right)),
          "de-AT"
        )
      )
  );
}

function buildVs24SourceAtomDigestReplay({ categoryId, atomsA, atomsB }) {
  if (categoryId !== VS24_CATEGORY_ID) return null;
  const projections = {
    A: projectedAtoms(atomsA),
    B: projectedAtoms(atomsB),
  };
  if (projections.A.length === 0 || projections.B.length === 0) return null;
  return {
    schemaVersion: 1,
    contractId: VS24_SOURCE_ATOM_DIGEST_REPLAY_CONTRACT_ID,
    categoryId: VS24_CATEGORY_ID,
    sourceAtomDigestsSha256: {
      A: sha256(projections.A),
      B: sha256(projections.B),
    },
  };
}

function sideProof({ side, packageSummary, atoms, expectedDocuments }) {
  if (
    packageSummary?.reviewStatus !== "BELEGT" ||
    packageSummary?.evidenceFound !== true
  )
    return null;
  const documents = expectedDocumentsForSide(expectedDocuments, side);
  if (!documents) return null;
  const relevant = (atoms || []).filter(
    ({ requirementId }) => requirementId === VS24_CATEGORY_ID
  );
  if (relevant.length !== documents.length) return null;
  const byDocument = new Map();
  for (const atom of relevant) {
    const documentUuids = strings(atom?.documentUuids);
    if (documentUuids.length !== 1 || byDocument.has(documentUuids[0]))
      return null;
    byDocument.set(documentUuids[0], atom);
  }
  if (documents.some(({ uuid }) => !byDocument.has(uuid))) return null;

  const found = [];
  for (const document of documents) {
    const atom = byDocument.get(document.uuid);
    if (atom.evidencePresence === "FOUND") {
      if (!exactFoundAtom(atom, document)) return null;
      found.push(atom);
    } else if (!exactAbsentAtom(atom, document)) return null;
  }
  if (found.length !== 1) return null;
  const projection = projectedAtoms(relevant);
  return {
    side,
    expectedDocumentUuids: documents.map(({ uuid }) => uuid).sort(),
    scopeKey: VS24_SCOPE_KEY,
    coverageEffect: "INCLUDED",
    localLimitStatus: "NOT_FOUND",
    source: sourceProof(found[0]),
    projectedAtoms: projection,
    projectedAtomsDigestSha256: sha256(projection),
  };
}

function buildVs24ScaffoldingCostEqualityAudit({
  categoryId,
  packageA,
  packageB,
  atomsA,
  atomsB,
  requirementContractA,
  requirementContractB,
  expectedDocumentsA,
  expectedDocumentsB,
}) {
  if (
    categoryId !== VS24_CATEGORY_ID ||
    !exactRequirementContract(requirementContractA) ||
    JSON.stringify(requirementContractA) !==
      JSON.stringify(requirementContractB)
  )
    return null;
  const sideA = sideProof({
    side: "A",
    packageSummary: packageA,
    atoms: atomsA,
    expectedDocuments: expectedDocumentsA,
  });
  const sideB = sideProof({
    side: "B",
    packageSummary: packageB,
    atoms: atomsB,
    expectedDocuments: expectedDocumentsB,
  });
  if (!sideA || !sideB) return null;
  return {
    schemaVersion: 1,
    contractId: VS24_SCAFFOLDING_COST_EQUALITY_AUDIT_CONTRACT_ID,
    categoryId: VS24_CATEGORY_ID,
    requirementContractDigestSha256: VS24_REQUIREMENT_CONTRACT_DIGEST_SHA256,
    sides: { A: sideA, B: sideB },
  };
}

function vs24ScaffoldingCostEqualityDecision(audit) {
  return {
    schemaVersion: 4,
    outcome: "GLEICHWERTIG",
    reasonCode: VS24_SCAFFOLDING_COST_EQUALITY_REASON_CODE,
    reason:
      "Gleichwertig: Beide Polizzen dokumentieren Gerüstkosten nach einem ersatzpflichtigen Glasschaden. Für diese Leistung ist auf keiner Seite ein eigenes lokales Limit dokumentiert.",
    reviewRequired: false,
    ruleId: VS24_SCAFFOLDING_COST_EQUALITY_RULE_ID,
    vs24ScaffoldingCostEqualityAudit: audit,
    dimensions: [],
  };
}

function validateVs24ScaffoldingCostEqualityAudit(audit, options) {
  const replay = options?.sourceAtomDigestReplay;
  if (
    replay?.schemaVersion !== 1 ||
    replay?.contractId !== VS24_SOURCE_ATOM_DIGEST_REPLAY_CONTRACT_ID ||
    replay?.categoryId !== VS24_CATEGORY_ID ||
    !/^[a-f0-9]{64}$/u.test(replay?.sourceAtomDigestsSha256?.A || "") ||
    !/^[a-f0-9]{64}$/u.test(replay?.sourceAtomDigestsSha256?.B || "")
  )
    throw new Error("VS24_SOURCE_ATOM_DIGEST_REPLAY_REQUIRED");
  for (const side of ["A", "B"])
    if (
      audit?.sides?.[side]?.projectedAtomsDigestSha256 !==
        replay.sourceAtomDigestsSha256[side] ||
      sha256(audit?.sides?.[side]?.projectedAtoms) !==
        replay.sourceAtomDigestsSha256[side]
    )
      throw new Error("VS24_SOURCE_ATOM_DIGEST_REPLAY_MISMATCH");
  const expected = buildVs24ScaffoldingCostEqualityAudit({
    ...options,
    atomsA: audit?.sides?.A?.projectedAtoms,
    atomsB: audit?.sides?.B?.projectedAtoms,
  });
  if (!expected) throw new Error("VS24_SCAFFOLDING_COST_EQUALITY_NOT_QUALIFIED");
  if (!sameJson(audit, expected))
    throw new Error("VS24_SCAFFOLDING_COST_EQUALITY_AUDIT_MISMATCH");
  return true;
}

module.exports = {
  VS24_REQUIREMENT_CONTRACT_DIGEST_SHA256,
  VS24_SOURCE_ATOM_DIGEST_REPLAY_CONTRACT_ID,
  VS24_SCAFFOLDING_COST_EQUALITY_AUDIT_CONTRACT_ID,
  VS24_SCAFFOLDING_COST_EQUALITY_REASON_CODE,
  VS24_SCAFFOLDING_COST_EQUALITY_RULE_ID,
  buildVs24SourceAtomDigestReplay,
  buildVs24ScaffoldingCostEqualityAudit,
  validateVs24ScaffoldingCostEqualityAudit,
  vs24ScaffoldingCostEqualityDecision,
};
