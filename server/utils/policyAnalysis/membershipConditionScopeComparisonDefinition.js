const MEMBERSHIP_CONDITION_SCOPE_COMPARISON_CONTRACT_ID =
  "MEMBERSHIP_CONDITION_SCOPE_COMPARISON_V1";
const COMPARISON_POLICY = "BOOLEAN_IMPLICATION_ALL_VALID_ASSIGNMENTS_V1";
const SATISFACTION_POLICY =
  "CONTRACT_SCOPE_ONLY_NOT_REAL_WORLD_SATISFACTION_V1";
const DOCUMENT_RESOLUTION_POLICY =
  "UNIQUE_COMPLEMENTARY_REFERENCE_IDENTITY_NO_CONTENT_CONFLICT_V1";
const WINNER_POLICY = "LESS_RESTRICTIVE_PREREQUISITE_FORMULA_WINS_V1";
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

module.exports = {
  COMPARISON_POLICY,
  DOCUMENT_RESOLUTION_POLICY,
  MEMBERSHIP_CONDITION_SCOPE_COMPARISON_CONTRACT_ID,
  SATISFACTION_POLICY,
  WINNER_POLICY,
  validateMembershipConditionScopeComparisonContract,
};
