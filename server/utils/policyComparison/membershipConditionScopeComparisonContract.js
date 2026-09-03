const crypto = require("crypto");
const {
  COMPLETE_SOURCE_CHAIN_TYPED_CONDITIONS,
  buildPackageActivatedObjectMembershipAudit,
  validatePackageActivatedObjectMembershipAudit,
} = require("../policyAnalysis/packageActivatedObjectMembershipAuditContract");
const {
  SATISFACTION,
  SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_CONTRACT_ID,
} = require("../policyAnalysis/coverageConditionFormulaEvidenceContract");
const { derivePackageReviewAudit } = require("./packageReviewAudit");

const MEMBERSHIP_CONDITION_SCOPE_COMPARISON_CONTRACT_ID =
  "MEMBERSHIP_CONDITION_SCOPE_COMPARISON_V1";
const MEMBERSHIP_CONDITION_SCOPE_COMPARISON_AUDIT_CONTRACT_ID =
  "MEMBERSHIP_CONDITION_SCOPE_COMPARISON_AUDIT_V1";
const MEMBERSHIP_CONDITION_SCOPE_SOURCE_ATOM_REPLAY_CONTRACT_ID =
  "MEMBERSHIP_CONDITION_SCOPE_SOURCE_ATOM_REPLAY_V1";
const COMPARISON_POLICY = "BOOLEAN_IMPLICATION_ALL_VALID_ASSIGNMENTS_V1";
const SATISFACTION_POLICY =
  "CONTRACT_SCOPE_ONLY_NOT_REAL_WORLD_SATISFACTION_V1";
const DOCUMENT_RESOLUTION_POLICY =
  "UNIQUE_COMPLEMENTARY_REFERENCE_IDENTITY_NO_CONTENT_CONFLICT_V1";
const WINNER_POLICY = "LESS_RESTRICTIVE_PREREQUISITE_FORMULA_WINS_V1";
const DIRECT_MODE = "DIRECT_INCLUDED_SOURCE_FORMULA";
const MEMBERSHIP_MODE = "MEMBERSHIP_DEFINED_TYPED_CONDITIONS";
const MAX_PREDICATES = 12;

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

function exactKeys(value, keys, code) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !sameJson(Object.keys(value).sort(), [...keys].sort())
  )
    throw new Error(code);
}

function conceptKey(value, code) {
  const key = String(value || "").trim();
  if (!/^[A-Z][A-Z0-9_]*$/u.test(key)) throw new Error(code);
  return key;
}

function componentKey(value) {
  const key = String(value || "").trim();
  if (!/^[a-z][a-z0-9_]*$/u.test(key))
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_COMPONENT_INVALID");
  return key;
}

function canonicalStrings(values) {
  return [...new Set((values || []).map(String).filter(Boolean))].sort();
}

function validateMembershipConditionScopeComparisonContract(contract) {
  exactKeys(
    contract,
    [
      "contractId",
      "componentId",
      "targetObjectKey",
      "perilScopeKey",
      "directFormulaKey",
      "membershipConditionSetKey",
      "membershipSectionPredicateKey",
      "membershipRequiredPredicateKeys",
      "predicateImplications",
      "comparisonPolicy",
      "satisfactionPolicy",
      "documentResolutionPolicy",
      "winnerPolicy",
    ],
    "MEMBERSHIP_CONDITION_SCOPE_CONTRACT_INVALID"
  );
  if (
    contract.contractId !==
      MEMBERSHIP_CONDITION_SCOPE_COMPARISON_CONTRACT_ID ||
    contract.comparisonPolicy !== COMPARISON_POLICY ||
    contract.satisfactionPolicy !== SATISFACTION_POLICY ||
    contract.documentResolutionPolicy !== DOCUMENT_RESOLUTION_POLICY ||
    contract.winnerPolicy !== WINNER_POLICY
  )
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_CONTRACT_POLICY_INVALID");

  const membershipSectionPredicateKey = conceptKey(
    contract.membershipSectionPredicateKey,
    "MEMBERSHIP_CONDITION_SCOPE_SECTION_PREDICATE_INVALID"
  );
  if (
    !Array.isArray(contract.membershipRequiredPredicateKeys) ||
    contract.membershipRequiredPredicateKeys.length === 0 ||
    contract.membershipRequiredPredicateKeys.length > MAX_PREDICATES
  )
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_PREDICATES_INVALID");
  const membershipRequiredPredicateKeys = contract.membershipRequiredPredicateKeys
    .map((key) =>
      conceptKey(key, "MEMBERSHIP_CONDITION_SCOPE_PREDICATE_INVALID")
    )
    .sort();
  if (
    new Set(membershipRequiredPredicateKeys).size !==
      membershipRequiredPredicateKeys.length ||
    membershipRequiredPredicateKeys.includes(membershipSectionPredicateKey) ||
    !sameJson(
      membershipRequiredPredicateKeys,
      contract.membershipRequiredPredicateKeys
    )
  )
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_PREDICATES_INVALID");

  if (
    !Array.isArray(contract.predicateImplications) ||
    contract.predicateImplications.length === 0 ||
    contract.predicateImplications.length > MAX_PREDICATES
  )
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_IMPLICATIONS_INVALID");
  const predicateImplications = contract.predicateImplications
    .map((implication) => {
      exactKeys(
        implication,
        ["antecedentPredicateKey", "consequentPredicateKey"],
        "MEMBERSHIP_CONDITION_SCOPE_IMPLICATION_INVALID"
      );
      const antecedentPredicateKey = conceptKey(
        implication.antecedentPredicateKey,
        "MEMBERSHIP_CONDITION_SCOPE_IMPLICATION_INVALID"
      );
      const consequentPredicateKey = conceptKey(
        implication.consequentPredicateKey,
        "MEMBERSHIP_CONDITION_SCOPE_IMPLICATION_INVALID"
      );
      if (antecedentPredicateKey === consequentPredicateKey)
        throw new Error("MEMBERSHIP_CONDITION_SCOPE_IMPLICATION_INVALID");
      return { antecedentPredicateKey, consequentPredicateKey };
    })
    .sort((left, right) =>
      `${left.antecedentPredicateKey}->${left.consequentPredicateKey}`.localeCompare(
        `${right.antecedentPredicateKey}->${right.consequentPredicateKey}`
      )
    );
  if (
    new Set(
      predicateImplications.map(
        ({ antecedentPredicateKey, consequentPredicateKey }) =>
          `${antecedentPredicateKey}->${consequentPredicateKey}`
      )
    ).size !== predicateImplications.length ||
    !sameJson(predicateImplications, contract.predicateImplications)
  )
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_IMPLICATIONS_INVALID");

  return {
    contractId: MEMBERSHIP_CONDITION_SCOPE_COMPARISON_CONTRACT_ID,
    componentId: componentKey(contract.componentId),
    targetObjectKey: conceptKey(
      contract.targetObjectKey,
      "MEMBERSHIP_CONDITION_SCOPE_TARGET_OBJECT_INVALID"
    ),
    perilScopeKey: conceptKey(
      contract.perilScopeKey,
      "MEMBERSHIP_CONDITION_SCOPE_PERIL_INVALID"
    ),
    directFormulaKey: conceptKey(
      contract.directFormulaKey,
      "MEMBERSHIP_CONDITION_SCOPE_DIRECT_FORMULA_INVALID"
    ),
    membershipConditionSetKey: conceptKey(
      contract.membershipConditionSetKey,
      "MEMBERSHIP_CONDITION_SCOPE_CONDITION_SET_INVALID"
    ),
    membershipSectionPredicateKey,
    membershipRequiredPredicateKeys,
    predicateImplications,
    comparisonPolicy: COMPARISON_POLICY,
    satisfactionPolicy: SATISFACTION_POLICY,
    documentResolutionPolicy: DOCUMENT_RESOLUTION_POLICY,
    winnerPolicy: WINNER_POLICY,
  };
}

function normalizeBooleanFormula(node) {
  if (node?.kind === "PREDICATE")
    return {
      kind: "PREDICATE",
      predicateKey: conceptKey(
        node.predicateKey,
        "MEMBERSHIP_CONDITION_SCOPE_FORMULA_PREDICATE_INVALID"
      ),
    };
  if (
    node?.kind !== "OPERATOR" ||
    !["AND", "OR"].includes(node.operator) ||
    !Array.isArray(node.operands) ||
    node.operands.length < 2
  )
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_FORMULA_INVALID");
  const operands = node.operands.map(normalizeBooleanFormula);
  const predicateKeys = operands.flatMap(formulaPredicateKeys);
  if (new Set(predicateKeys).size !== predicateKeys.length)
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_FORMULA_DUPLICATE_PREDICATE");
  return { kind: "OPERATOR", operator: node.operator, operands };
}

function formulaPredicateKeys(formula) {
  return formula.kind === "PREDICATE"
    ? [formula.predicateKey]
    : formula.operands.flatMap(formulaPredicateKeys);
}

function formulaValue(formula, valuation) {
  if (formula.kind === "PREDICATE") return valuation[formula.predicateKey];
  return formula.operator === "AND"
    ? formula.operands.every((operand) => formulaValue(operand, valuation))
    : formula.operands.some((operand) => formulaValue(operand, valuation));
}

function implicationSatisfied(valuation, implication) {
  return !valuation[implication.antecedentPredicateKey] ||
    valuation[implication.consequentPredicateKey];
}

/**
 * Compares contractual Boolean prerequisites only. It does not evaluate
 * whether a concrete risk satisfies any predicate and cannot create a result.
 */
function compareBooleanConditionFormulas({
  leftFormula,
  rightFormula,
  predicateImplications,
}) {
  const left = normalizeBooleanFormula(leftFormula);
  const right = normalizeBooleanFormula(rightFormula);
  const implications = (predicateImplications || []).map((implication) => ({
    antecedentPredicateKey: conceptKey(
      implication?.antecedentPredicateKey,
      "MEMBERSHIP_CONDITION_SCOPE_IMPLICATION_INVALID"
    ),
    consequentPredicateKey: conceptKey(
      implication?.consequentPredicateKey,
      "MEMBERSHIP_CONDITION_SCOPE_IMPLICATION_INVALID"
    ),
  }));
  const formulaKeys = new Set([
    ...formulaPredicateKeys(left),
    ...formulaPredicateKeys(right),
  ]);
  if (
    implications.some(
      ({ antecedentPredicateKey, consequentPredicateKey }) =>
        !formulaKeys.has(antecedentPredicateKey) ||
        !formulaKeys.has(consequentPredicateKey)
    )
  )
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_IMPLICATION_UNUSED");
  const predicateKeys = canonicalStrings([
    ...formulaPredicateKeys(left),
    ...formulaPredicateKeys(right),
    ...implications.flatMap(
      ({ antecedentPredicateKey, consequentPredicateKey }) => [
        antecedentPredicateKey,
        consequentPredicateKey,
      ]
    ),
  ]);
  if (predicateKeys.length > MAX_PREDICATES)
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_FORMULA_TOO_LARGE");

  let validValuationCount = 0;
  let leftImpliesRight = true;
  let rightImpliesLeft = true;
  let leftNotRightWitness = null;
  let rightNotLeftWitness = null;
  for (let mask = 0; mask < 2 ** predicateKeys.length; mask += 1) {
    const valuation = Object.fromEntries(
      predicateKeys.map((key, index) => [key, Boolean(mask & 2 ** index)])
    );
    if (!implications.every((rule) => implicationSatisfied(valuation, rule)))
      continue;
    validValuationCount += 1;
    const leftValue = formulaValue(left, valuation);
    const rightValue = formulaValue(right, valuation);
    if (leftValue && !rightValue) {
      leftImpliesRight = false;
      if (!leftNotRightWitness) leftNotRightWitness = valuation;
    }
    if (rightValue && !leftValue) {
      rightImpliesLeft = false;
      if (!rightNotLeftWitness) rightNotLeftWitness = valuation;
    }
  }
  let relationship = "INCOMPARABLE";
  if (leftImpliesRight && rightImpliesLeft) relationship = "EQUIVALENT";
  else if (!leftImpliesRight && rightImpliesLeft)
    relationship = "LEFT_STRICTLY_BROADER";
  else if (leftImpliesRight && !rightImpliesLeft)
    relationship = "RIGHT_STRICTLY_BROADER";
  return {
    comparisonPolicy: COMPARISON_POLICY,
    predicateKeys,
    predicateImplications: implications,
    validValuationCount,
    leftImpliesRight,
    rightImpliesLeft,
    leftNotRightWitness,
    rightNotLeftWitness,
    relationship,
  };
}

function expectedDocuments(expectedDocuments, side) {
  if (!Array.isArray(expectedDocuments) || expectedDocuments.length === 0)
    return null;
  const documents = expectedDocuments
    .map((document) => ({
      uuid: String(document?.uuid || ""),
      side: String(document?.side || ""),
      role: String(document?.role || ""),
      documentStatus: String(document?.documentStatus || ""),
    }))
    .sort((left, right) => left.uuid.localeCompare(right.uuid));
  if (
    documents.some(
      (document) =>
        !document.uuid ||
        document.side !== side ||
        !document.role ||
        !document.documentStatus
    ) ||
    new Set(documents.map(({ uuid }) => uuid)).size !== documents.length
  )
    return null;
  return documents;
}

function atomMetadataMatches(atom, document) {
  return (
    sameJson(canonicalStrings(atom?.documentUuids), [document.uuid]) &&
    atom?.documentRole === document.role &&
    atom?.documentStatus === document.documentStatus
  );
}

function cleanNonFinding(atom) {
  return (
    atom?.evidencePresence === "NOT_FOUND" &&
    atom?.coverageEffect === "UNKNOWN" &&
    atom?.conflictState === "NONE" &&
    (atom?.selectedCandidateIds || []).length === 0 &&
    (atom?.unresolvedCandidateIds || []).length === 0 &&
    (atom?.sources || []).length === 0
  );
}

function relevantAtoms({ categoryId, componentId, atoms, documents }) {
  const relevant = (atoms || []).filter(
    (atom) =>
      atom?.requirementId === categoryId && atom?.componentId === componentId
  );
  if (relevant.length !== documents.length) return null;
  const byDocument = new Map();
  for (const atom of relevant) {
    const uuids = canonicalStrings(atom?.documentUuids);
    if (uuids.length !== 1 || byDocument.has(uuids[0])) return null;
    byDocument.set(uuids[0], atom);
  }
  if (
    documents.some(
      (document) =>
        !byDocument.has(document.uuid) ||
        !atomMetadataMatches(byDocument.get(document.uuid), document)
    )
  )
    return null;
  return relevant;
}

function exactRequirementContractBinding(atoms, contract) {
  const rawRequirementContractDigests = (atoms || []).map(
    ({ requirementContractDigest }) => String(requirementContractDigest || "")
  );
  const requirementContractDigests = canonicalStrings(
    rawRequirementContractDigests
  );
  if (
    rawRequirementContractDigests.some(
      (value) => !/^[a-f0-9]{64}$/u.test(value)
    ) ||
    requirementContractDigests.length !== 1 ||
    !(atoms || []).every(
      (atom) =>
        atom?.factRole === "INSURED_OBJECT" &&
        atom?.componentSatisfactionPolicy === "ALL" &&
        sameJson(atom?.declaredComponents, [
          { id: contract.componentId, factRole: "INSURED_OBJECT" },
        ]) &&
        sameJson(atom.membershipConditionScopeComparisonContract, contract)
    )
  )
    return null;
  return requirementContractDigests[0];
}

function exactFormulaProof(proof, atom, contract) {
  const expectedKeys = [
    "schemaVersion",
    "contractId",
    "evidenceContractDigest",
    "documentFingerprint",
    "formulaKey",
    "sourcePolicy",
    "targetScopePolicy",
    "governorSpan",
    "formula",
    "targets",
    "satisfaction",
    "readyForDecision",
    "proofDigest",
  ];
  try {
    exactKeys(
      proof,
      expectedKeys,
      "MEMBERSHIP_CONDITION_SCOPE_DIRECT_PROOF_INVALID"
    );
    const { proofDigest, ...body } = proof;
    const matchingEvidenceContracts = (
      atom.supportingCoverageConditionFormulaEvidenceContracts || []
    ).filter(({ formulaKey }) => formulaKey === contract.directFormulaKey);
    if (
      proof.schemaVersion !== 1 ||
      proof.contractId !==
        SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_CONTRACT_ID ||
      proof.formulaKey !== contract.directFormulaKey ||
      proof.satisfaction !== SATISFACTION ||
      proof.readyForDecision !== false ||
      matchingEvidenceContracts.length !== 1 ||
      proof.evidenceContractDigest !== sha256(matchingEvidenceContracts[0]) ||
      !/^[a-f0-9]{64}$/u.test(proof.evidenceContractDigest) ||
      !/^[a-f0-9]{64}$/u.test(proof.documentFingerprint) ||
      proofDigest !== sha256(body) ||
      !Array.isArray(proof.targets) ||
      proof.targets.length === 0
    )
      return false;
    normalizeBooleanFormula(proof.formula);
    const selected = new Set(atom.selectedCandidateIds || []);
    const sourceByCandidate = new Map(
      (atom.sources || []).map((source) => [source.candidateId, source])
    );
    return proof.targets.every((target) => {
      const source = sourceByCandidate.get(target?.candidateId);
      return Boolean(
        selected.has(target?.candidateId) &&
          source?.candidateBinding === "DIRECT" &&
          source.physicalPageNumber === target.physicalPageNumber &&
          source.exactText === target.exactText
      );
    });
  } catch {
    return false;
  }
}

function directSideAssessment({
  side,
  categoryId,
  packageSummary,
  atoms,
  contract,
  documents,
}) {
  if (packageSummary?.reviewStatus !== "BELEGT") return null;
  const relevant = relevantAtoms({
    categoryId,
    componentId: contract.componentId,
    atoms,
    documents,
  });
  if (!relevant) return null;
  const requirementContractDigest = exactRequirementContractBinding(
    relevant,
    contract
  );
  if (!requirementContractDigest) return null;
  const found = relevant.filter(({ evidencePresence }) => evidencePresence === "FOUND");
  if (found.length !== 1 || relevant.some((atom) => atom !== found[0] && !cleanNonFinding(atom)))
    return null;
  const atom = found[0];
  if (
    atom.coverageEffect !== "INCLUDED" ||
    atom.factRole !== "INSURED_OBJECT" ||
    atom.conflictState !== "NONE" ||
    atom.selectedScopePicture !== "GENERAL" ||
    (atom.unresolvedCandidateIds || []).length !== 0 ||
    !Array.isArray(atom.supportingCoverageConditionFormulaProofs) ||
    atom.supportingCoverageConditionFormulaProofs.length !== 1
  )
    return null;
  const [proof] = atom.supportingCoverageConditionFormulaProofs;
  if (!exactFormulaProof(proof, atom, contract)) return null;
  const projection = projectedAtoms(categoryId, relevant);
  return {
    side,
    mode: DIRECT_MODE,
    packageReviewStatus: packageSummary.reviewStatus,
    documentManifest: documents,
    sourceDocumentUuids: canonicalStrings(atom.documentUuids),
    formulaProofDigest: proof.proofDigest,
    formulaKey: proof.formulaKey,
    requirementContractDigest,
    satisfaction: proof.satisfaction,
    normalizedFormula: normalizeBooleanFormula(proof.formula),
    projectedAtoms: projection,
    projectedAtomsDigestSha256: sha256(projection),
  };
}

function membershipConditionEvidence(audit, contract) {
  const evidence = audit.evidence.membershipPath
    .flatMap(({ entries }) => entries)
    .map(({ conditionEvidence: value }) => value)
    .filter(Boolean);
  if (evidence.length !== 1) return null;
  const [condition] = evidence;
  const keys = canonicalStrings(
    condition.predicates?.map(({ predicateKey }) => predicateKey)
  );
  if (
    condition.conditionSetKey !== contract.membershipConditionSetKey ||
    condition.typingStatus !== "COMPLETE" ||
    condition.conjunctionValid !== true ||
    condition.satisfaction !== SATISFACTION ||
    condition.readyForDecision !== false ||
    !sameJson(keys, contract.membershipRequiredPredicateKeys) ||
    (condition.missingPredicateKeys || []).length !== 0 ||
    (condition.ambiguousPredicateKeys || []).length !== 0 ||
    (condition.negatedPredicateKeys || []).length !== 0
  )
    return null;
  return condition;
}

function exactDocumentResolution(audit, contract, documents) {
  const reference = audit.evidence.references;
  const identity = audit.evidence.identities;
  if (
    audit.contract.perilScopeKey !== contract.perilScopeKey ||
    audit.contract.targetObjectKey !== contract.targetObjectKey ||
    audit.status !== COMPLETE_SOURCE_CHAIN_TYPED_CONDITIONS ||
    audit.referenceKey === null ||
    reference.length !== 1 ||
    identity.length !== 1 ||
    audit.evidence.conflicts.length !== 0 ||
    audit.evidence.membershipPath.some(({ entries }) => entries.length !== 1)
  )
    return null;
  const documentByUuid = new Map(documents.map((document) => [document.uuid, document]));
  for (const entry of [...reference, ...identity]) {
    if (entry.documentUuids.length === 0) return null;
    for (const uuid of entry.documentUuids) {
      const expected = documentByUuid.get(uuid);
      if (
        !expected ||
        expected.role !== entry.documentRole ||
        expected.documentStatus !== entry.documentStatus
      )
        return null;
    }
  }
  if (
    reference[0].documentUuids.some((uuid) =>
      identity[0].documentUuids.includes(uuid)
    )
  )
    return null;
  const knownUuids = new Set(documentByUuid.keys());
  if (
    audit.evidence.membershipPath
      .flatMap(({ entries }) => entries)
      .flatMap(({ documentUuids }) => documentUuids)
      .some((uuid) => !knownUuids.has(uuid))
  )
    return null;
  return {
    policy: DOCUMENT_RESOLUTION_POLICY,
    status: "UNIQUE_COMPLEMENTARY_REFERENCE_IDENTITY_NO_CONTENT_CONFLICT",
    referenceKey: audit.referenceKey,
    referenceDocumentUuids: reference[0].documentUuids,
    identityDocumentUuids: identity[0].documentUuids,
  };
}

function membershipSideAssessment({
  side,
  categoryId,
  packageSummary,
  atoms,
  contract,
  documents,
}) {
  if (packageSummary?.reviewStatus !== "TEILBELEGT") return null;
  const relevant = relevantAtoms({
    categoryId,
    componentId: contract.componentId,
    atoms,
    documents,
  });
  if (!relevant) return null;
  const requirementContractDigest = exactRequirementContractBinding(
    relevant,
    contract
  );
  if (!requirementContractDigest) return null;
  const found = relevant.filter(({ evidencePresence }) => evidencePresence === "FOUND");
  if (found.length !== 1 || relevant.some((atom) => atom !== found[0] && !cleanNonFinding(atom)))
    return null;
  const atom = found[0];
  if (
    atom.coverageEffect !== "DEFINED" ||
    atom.factRole !== "INSURED_OBJECT" ||
    atom.conflictState !== "NONE" ||
    (atom.unresolvedCandidateIds || []).length !== 0 ||
    !Array.isArray(atom.sources) ||
    atom.sources.length === 0 ||
    !atom.sources.every(
      (source) =>
        (atom.selectedCandidateIds || []).includes(source.candidateId) &&
        Number.isInteger(source.physicalPageNumber) &&
        source.physicalPageNumber > 0 &&
        String(source.exactText || "").trim().length > 0
    )
  )
    return null;
  const audit = buildPackageActivatedObjectMembershipAudit({ categoryId, atoms });
  if (!audit) return null;
  try {
    validatePackageActivatedObjectMembershipAudit(audit, {
      categoryId,
      allowedDocumentUuids: new Set(documents.map(({ uuid }) => uuid)),
    });
  } catch {
    return null;
  }
  const condition = membershipConditionEvidence(audit, contract);
  const documentResolution = exactDocumentResolution(audit, contract, documents);
  if (!condition || !documentResolution) return null;
  const normalizedFormula = {
    kind: "OPERATOR",
    operator: "AND",
    operands: [
      {
        kind: "PREDICATE",
        predicateKey: contract.membershipSectionPredicateKey,
      },
      ...contract.membershipRequiredPredicateKeys.map((predicateKey) => ({
        kind: "PREDICATE",
        predicateKey,
      })),
    ],
  };
  const projection = projectedAtoms(categoryId, relevant);
  return {
    side,
    mode: MEMBERSHIP_MODE,
    packageReviewStatus: packageSummary.reviewStatus,
    documentManifest: documents,
    sourceDocumentUuids: canonicalStrings(atom.documentUuids),
    packageMembershipAudit: audit,
    membershipConditionEvidenceDigest: condition.evidenceDigest,
    membershipConditionSetKey: condition.conditionSetKey,
    requirementContractDigest,
    satisfaction: condition.satisfaction,
    documentResolution,
    normalizedFormula,
    projectedAtoms: projection,
    projectedAtomsDigestSha256: sha256(projection),
  };
}

function projectedAtoms(categoryId, atoms) {
  return stableValue(
    (atoms || [])
      .filter(({ requirementId }) => requirementId === categoryId)
      .sort((left, right) =>
        JSON.stringify(stableValue(left)).localeCompare(
          JSON.stringify(stableValue(right))
        )
      )
  );
}

function buildMembershipConditionScopeSourceAtomDigestReplay({
  categoryId,
  atomsA,
  atomsB,
}) {
  if (!String(categoryId || "").trim()) return null;
  const projections = {
    A: projectedAtoms(categoryId, atomsA),
    B: projectedAtoms(categoryId, atomsB),
  };
  if (projections.A.length === 0 || projections.B.length === 0) return null;
  const body = {
    schemaVersion: 1,
    contractId: MEMBERSHIP_CONDITION_SCOPE_SOURCE_ATOM_REPLAY_CONTRACT_ID,
    categoryId,
    sourceAtomDigestsSha256: {
      A: sha256(projections.A),
      B: sha256(projections.B),
    },
  };
  return { ...body, replayDigestSha256: sha256(body) };
}

function validMembershipConditionScopeSourceAtomDigestReplay(replay) {
  if (
    replay?.schemaVersion !== 1 ||
    replay?.contractId !==
      MEMBERSHIP_CONDITION_SCOPE_SOURCE_ATOM_REPLAY_CONTRACT_ID ||
    !String(replay?.categoryId || "").trim() ||
    !/^[a-f0-9]{64}$/u.test(replay?.sourceAtomDigestsSha256?.A || "") ||
    !/^[a-f0-9]{64}$/u.test(replay?.sourceAtomDigestsSha256?.B || "")
  )
    return false;
  const { replayDigestSha256, ...body } = replay;
  return replayDigestSha256 === sha256(body);
}

function soleMembershipCoverageBlocker(
  packageReviewAudit,
  membershipSide,
  contract,
  categoryId
) {
  return Boolean(
    packageReviewAudit?.blockers?.length === 1 &&
      packageReviewAudit.blockers[0]?.code === "COVERAGE_EFFECT_NOT_DECISIVE" &&
      packageReviewAudit.blockers[0]?.side === membershipSide &&
      packageReviewAudit.blockers[0]?.requirementId === categoryId &&
      packageReviewAudit.blockers[0]?.componentId === contract.componentId
  );
}

function buildMembershipConditionScopeComparisonAudit({
  categoryId,
  packageA,
  packageB,
  atomsA,
  atomsB,
  contract,
  expectedDocumentsA,
  expectedDocumentsB,
}) {
  let validatedContract;
  try {
    validatedContract = validateMembershipConditionScopeComparisonContract(contract);
  } catch {
    return null;
  }
  const inputs = {
    A: {
      side: "A",
      categoryId,
      packageSummary: packageA,
      atoms: atomsA,
      contract: validatedContract,
      documents: expectedDocuments(expectedDocumentsA, "A"),
    },
    B: {
      side: "B",
      categoryId,
      packageSummary: packageB,
      atoms: atomsB,
      contract: validatedContract,
      documents: expectedDocuments(expectedDocumentsB, "B"),
    },
  };
  if (!inputs.A.documents || !inputs.B.documents) return null;

  let directSide;
  let membershipSide;
  let direct;
  let membership;
  for (const [candidateDirect, candidateMembership] of [
    ["A", "B"],
    ["B", "A"],
  ]) {
    const directAssessment = directSideAssessment(inputs[candidateDirect]);
    const membershipAssessment = membershipSideAssessment(
      inputs[candidateMembership]
    );
    if (!directAssessment || !membershipAssessment) continue;
    if (directSide) return null;
    directSide = candidateDirect;
    membershipSide = candidateMembership;
    direct = directAssessment;
    membership = membershipAssessment;
  }
  if (!directSide) return null;
  if (
    direct.requirementContractDigest !== membership.requirementContractDigest
  )
    return null;
  let packageReviewAudit;
  try {
    packageReviewAudit = derivePackageReviewAudit({
      categoryId,
      packageA,
      packageB,
      atomsA,
      atomsB,
    });
  } catch {
    return null;
  }
  if (
    !soleMembershipCoverageBlocker(
      packageReviewAudit,
      membershipSide,
      validatedContract,
      categoryId
    )
  )
    return null;

  let formulaComparison;
  try {
    formulaComparison = compareBooleanConditionFormulas({
      leftFormula: direct.normalizedFormula,
      rightFormula: membership.normalizedFormula,
      predicateImplications: validatedContract.predicateImplications,
    });
  } catch {
    return null;
  }
  if (formulaComparison.relationship !== "LEFT_STRICTLY_BROADER") return null;
  const body = {
    schemaVersion: 1,
    contractId: MEMBERSHIP_CONDITION_SCOPE_COMPARISON_AUDIT_CONTRACT_ID,
    categoryId,
    componentId: validatedContract.componentId,
    comparisonContract: validatedContract,
    comparisonContractDigestSha256: sha256(validatedContract),
    requirementContractDigest: direct.requirementContractDigest,
    comparisonPolicy: COMPARISON_POLICY,
    satisfactionPolicy: SATISFACTION_POLICY,
    winnerPolicy: WINNER_POLICY,
    directSide,
    membershipSide,
    broaderConditionScopeSide: directSide,
    narrowerConditionScopeSide: membershipSide,
    satisfaction: SATISFACTION,
    comparisonComplete: true,
    readyForDecision: true,
    packageReviewAudit,
    formulaComparison,
    sides: { [directSide]: direct, [membershipSide]: membership },
  };
  return { ...body, auditDigestSha256: sha256(body) };
}

function validateMembershipConditionScopeComparisonAudit(audit, options) {
  const externalAtomsProvided = Boolean(
    Array.isArray(options?.atomsA) && Array.isArray(options?.atomsB)
  );
  const replay = externalAtomsProvided
    ? buildMembershipConditionScopeSourceAtomDigestReplay({
        categoryId: options.categoryId,
        atomsA: options.atomsA,
        atomsB: options.atomsB,
      })
    : options?.sourceAtomDigestReplay;
  if (!validMembershipConditionScopeSourceAtomDigestReplay(replay))
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_SOURCE_REPLAY_REQUIRED");
  for (const side of ["A", "B"])
    if (
      audit?.sides?.[side]?.projectedAtomsDigestSha256 !==
        replay.sourceAtomDigestsSha256[side] ||
      sha256(audit?.sides?.[side]?.projectedAtoms) !==
        replay.sourceAtomDigestsSha256[side]
    )
      throw new Error("MEMBERSHIP_CONDITION_SCOPE_SOURCE_REPLAY_MISMATCH");

  const expected = buildMembershipConditionScopeComparisonAudit({
    ...options,
    atomsA: externalAtomsProvided
      ? options.atomsA
      : audit?.sides?.A?.projectedAtoms,
    atomsB: externalAtomsProvided
      ? options.atomsB
      : audit?.sides?.B?.projectedAtoms,
  });
  if (!expected)
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_COMPARISON_NOT_QUALIFIED");
  if (!sameJson(audit, expected))
    throw new Error("MEMBERSHIP_CONDITION_SCOPE_COMPARISON_AUDIT_MISMATCH");
  return true;
}

module.exports = {
  COMPARISON_POLICY,
  DOCUMENT_RESOLUTION_POLICY,
  MEMBERSHIP_CONDITION_SCOPE_COMPARISON_AUDIT_CONTRACT_ID,
  MEMBERSHIP_CONDITION_SCOPE_COMPARISON_CONTRACT_ID,
  MEMBERSHIP_CONDITION_SCOPE_SOURCE_ATOM_REPLAY_CONTRACT_ID,
  SATISFACTION_POLICY,
  WINNER_POLICY,
  buildMembershipConditionScopeComparisonAudit,
  buildMembershipConditionScopeSourceAtomDigestReplay,
  compareBooleanConditionFormulas,
  validMembershipConditionScopeSourceAtomDigestReplay,
  validateMembershipConditionScopeComparisonAudit,
  validateMembershipConditionScopeComparisonContract,
};
