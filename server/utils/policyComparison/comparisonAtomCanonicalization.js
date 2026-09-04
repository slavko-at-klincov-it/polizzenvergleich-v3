const {
  hasConditionalOrOptionalCoverageSource,
  operationalEventMode,
} = require("./comparisonAtomSemantics");
const {
  applicabilityFor,
} = require("../policyAnalysis/preparedEvidenceContract");
const {
  projectedFieldFactAppliesToAtom,
} = require("../policyAnalysis/requestedFieldBindingGroupContract");

const PACKAGE_MEMBER = "PACKAGE_MEMBER";
const CANONICAL_COMPARISON_ATOM_CONTRACT_ID =
  "PACKAGE_MEMBER_CANONICAL_ATOM_V2";
const VALID_COMPARISON_SCOPES = new Set([
  "GENERAL",
  "NARROW_ONLY",
  "GENERAL_AND_NARROW",
]);
const VALID_SCOPE_POLICIES = new Set([
  "GENERAL_REQUIRED",
  "MATCHING_SCOPE_DEFINITIVE_SUFFICIENT",
  "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
]);
const NON_COVERAGE_FACT_ROLES = new Set([
  "CONDITION",
  "DEFINITION",
  "LIMIT",
  "DEDUCTIBLE",
  "DOCUMENT_STATUS",
]);
const DEFINITIVE_NARROW_SCOPE_EFFECTS = new Set([
  "INCLUDED",
  "EXCLUDED",
  "DEFINED",
  "CONDITIONAL",
]);

function normalized(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function decimalHundredths(value) {
  const compact = String(value || "")
    .replace(/[^0-9.,]/gu, "")
    .trim();
  if (!/^\d[\d.,]*$/u.test(compact)) return null;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let separator = null;
  if (lastComma >= 0 && lastDot >= 0)
    separator = lastComma > lastDot ? "," : ".";
  else if (lastComma >= 0 && compact.length - lastComma - 1 <= 2)
    separator = ",";
  else if (lastDot >= 0 && compact.length - lastDot - 1 <= 2) separator = ".";
  const [integerPart, decimalPart = ""] = separator
    ? compact.split(separator)
    : [compact, ""];
  const integerDigits = integerPart.replace(/[.,]/gu, "");
  const decimalDigits = decimalPart.replace(/[.,]/gu, "");
  if (!integerDigits || decimalDigits.length > 2) return null;
  return BigInt(integerDigits) * 100n + BigInt(decimalDigits.padEnd(2, "0"));
}

function canonicalFieldFact(field, fieldStatus, fact) {
  const valueType = String(fact?.valueType || "UNKNOWN");
  const numeric = ["MONEY", "PERCENT"].includes(valueType)
    ? decimalHundredths(fact?.normalizedValue || fact?.rawValue)
    : null;
  return {
    field: String(field || ""),
    fieldStatus: String(fieldStatus || ""),
    value:
      numeric === null
        ? normalized(fact?.normalizedValue || fact?.rawValue)
        : numeric.toString(),
    displayValue: String(fact?.normalizedValue || fact?.rawValue || ""),
    valueType,
    unit: String(fact?.unit || ""),
    limitKind: String(fact?.limitKind || ""),
    qualifier: normalized(fact?.qualifier),
    variantScopeKey: String(fact?.variantScope?.key || ""),
    componentScopeKey: String(
      fact?.componentScope?.key || fact?.componentScope?.id || ""
    ),
  };
}

function semanticFieldKey(fact) {
  const { displayValue: _displayValue, ...semantic } = fact;
  return JSON.stringify(semantic);
}

function semanticFieldSignature(fields) {
  const facts = (fields || []).flatMap(({ field, status, facts: fieldFacts }) =>
    (fieldFacts || []).map((fact) => canonicalFieldFact(field, status, fact))
  );
  const unique = new Map();
  for (const fact of facts) {
    const key = semanticFieldKey(fact);
    const existing = unique.get(key);
    if (
      !existing ||
      fact.displayValue.localeCompare(existing.displayValue, "de-AT") < 0
    )
      unique.set(key, fact);
  }
  return [...unique.values()].sort((left, right) =>
    semanticFieldKey(left).localeCompare(semanticFieldKey(right), "de-AT")
  );
}

function comparisonFieldSignature(atom) {
  return Array.isArray(atom?.comparisonFieldFacts)
    ? atom.comparisonFieldFacts
    : semanticFieldSignature(atom?.fields);
}

function strings(values) {
  return [...new Set((values || []).map(String).filter(Boolean))].sort();
}

function stableValue(value) {
  if (Array.isArray(value)) {
    const values = value.map(stableValue);
    const unique = new Map(values.map((item) => [JSON.stringify(item), item]));
    return [...unique.values()].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right), "de-AT")
    );
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function stableKey(value) {
  return JSON.stringify(stableValue(value));
}

function sortedCopies(values) {
  return stableValue(values || []);
}

function comparisonApplicability(atom) {
  if (atom?.evidencePresence !== "FOUND") return null;
  try {
    return atom?.documentApplicability ===
      applicabilityFor(atom?.documentStatus, atom.evidencePresence)
      ? PACKAGE_MEMBER
      : null;
  } catch {
    return null;
  }
}

function validSourceBinding(atom) {
  return (
    Array.isArray(atom?.selectedCandidateIds) &&
    atom.selectedCandidateIds.length > 0 &&
    atom.selectedCandidateIds.every((candidateId) =>
      atom.sources?.some(
        (source) =>
          source.candidateId === candidateId &&
          Number.isInteger(source.physicalPageNumber) &&
          source.physicalPageNumber > 0 &&
          String(source.exactText || "").trim().length > 0
      )
    )
  );
}

function validComparisonScope(atom) {
  if (
    !VALID_COMPARISON_SCOPES.has(atom?.selectedScopePicture) ||
    !VALID_SCOPE_POLICIES.has(atom?.scopePolicy)
  )
    return false;
  if (atom.selectedScopePicture !== "NARROW_ONLY") return true;
  if (strings(atom.comparisonScopeKeys).length === 0) return false;
  if (atom.requirementId === "VS-24") {
    const scopeKeys = strings(atom.comparisonScopeKeys);
    const selectedIds = new Set(atom.selectedCandidateIds || []);
    const selectedSources = (atom.sources || []).filter(({ candidateId }) =>
      selectedIds.has(candidateId)
    );
    if (
      scopeKeys.length !== 1 ||
      selectedSources.length === 0 ||
      selectedSources.some(
        ({ candidateBinding, comparisonScopeKey }) =>
          candidateBinding !== "NARROW_SCOPE" ||
          comparisonScopeKey !== scopeKeys[0]
      )
    )
      return false;
  }
  if (atom.scopePolicy === "MATCHING_SCOPE_DEFINITIVE_SUFFICIENT")
    return DEFINITIVE_NARROW_SCOPE_EFFECTS.has(atom.coverageEffect);
  if (atom.scopePolicy !== "MATCHING_SCOPE_INCLUDED_SUFFICIENT") return false;
  return NON_COVERAGE_FACT_ROLES.has(atom.factRole)
    ? ["DEFINED", "CONDITIONAL"].includes(atom.coverageEffect)
    : atom.coverageEffect === "INCLUDED";
}

function validRequestedFields(atom) {
  if (
    !Array.isArray(atom?.requestedFields) ||
    !Array.isArray(atom?.optionalFields) ||
    !Array.isArray(atom?.fields)
  )
    return false;
  const requestedFields = strings(atom?.requestedFields);
  const optionalFields = strings(atom?.optionalFields);
  const observedFields = strings(atom.fields.map(({ field }) => field));
  if (
    requestedFields.length !== (atom.requestedFields || []).length ||
    optionalFields.length !== (atom.optionalFields || []).length ||
    requestedFields.some((field) => optionalFields.includes(field)) ||
    observedFields.length !== atom.fields.length ||
    JSON.stringify(strings([...requestedFields, ...optionalFields])) !==
      JSON.stringify(observedFields)
  )
    return false;
  if (
    atom?.requestedFieldStatus === "NOT_REQUIRED" &&
    requestedFields.length !== 0
  )
    return false;
  if (atom?.requestedFieldStatus === "COMPLETE" && requestedFields.length === 0)
    return false;
  if (!["COMPLETE", "NOT_REQUIRED"].includes(atom?.requestedFieldStatus))
    return false;
  return atom.fields.every(({ field, status, facts }) => {
    const required = requestedFields.includes(field);
    if (!Array.isArray(facts)) return false;
    if (!required && facts.length === 0) return status === "NOT_FOUND";
    return (
      status === "FOUND" &&
      facts.length > 0 &&
      facts.every((fact) => {
        const { source } = fact;
        return (
          projectedFieldFactAppliesToAtom({
            fact,
            requirementId: atom.requirementId,
            componentId: atom.componentId,
            selectedCandidateIds: atom.selectedCandidateIds,
          }) &&
          Number.isInteger(source?.physicalPageNumber) &&
          source.physicalPageNumber > 0 &&
          String(source?.exactText || "").trim().length > 0
        );
      })
    );
  });
}

function completeRawComparisonAtom(atom) {
  return Boolean(
    atom?.evidencePresence === "FOUND" &&
      comparisonApplicability(atom) === PACKAGE_MEMBER &&
      strings(atom.documentUuids).length > 0 &&
      String(atom.documentRole || "").trim().length > 0 &&
      atom.conflictState === "NONE" &&
      (atom.unresolvedCandidateIds || []).length === 0 &&
      validComparisonScope(atom) &&
      validSourceBinding(atom) &&
      validRequestedFields(atom)
  );
}

function comparisonAtomComplete(atom) {
  if (
    atom?.comparisonProjectionContractId ===
      CANONICAL_COMPARISON_ATOM_CONTRACT_ID &&
    Array.isArray(atom?.comparisonContributors)
  )
    return (
      atom.comparisonApplicability === PACKAGE_MEMBER &&
      atom.comparisonContributors.length > 0 &&
      atom.comparisonContributors.every(({ complete }) => complete === true)
    );
  return completeRawComparisonAtom(atom);
}

function atomEventMode(atom) {
  return atom?.comparisonOperationalEventMode || operationalEventMode(atom);
}

function atomHasConditionalOrOptionalSource(atom) {
  return typeof atom?.comparisonConditionalOrOptional === "boolean"
    ? atom.comparisonConditionalOrOptional
    : hasConditionalOrOptionalCoverageSource(atom);
}

function semanticComparisonAtomKey(atom) {
  return JSON.stringify({
    requirementId: atom?.requirementId,
    requirementContractDigest: atom?.requirementContractDigest,
    componentId: atom?.componentId,
    componentLabel: String(atom?.componentLabel || ""),
    factRole: atom?.factRole,
    componentSatisfactionPolicy: atom?.componentSatisfactionPolicy,
    coverageAggregationPolicy: atom?.coverageAggregationPolicy,
    declaredComponents: stableValue(atom?.declaredComponents || []),
    evidencePresence: atom?.evidencePresence,
    coverageEffect: atom?.coverageEffect,
    conflictState: atom?.conflictState,
    requestedFieldStatus: atom?.requestedFieldStatus,
    requestedFields: strings(atom?.requestedFields),
    optionalFields: strings(atom?.optionalFields),
    selectedScopePicture: atom?.selectedScopePicture,
    comparisonScopeKeys: strings(atom?.comparisonScopeKeys),
    objectScopeEvidenceContract: stableValue(
      atom?.objectScopeEvidenceContract || null
    ),
    objectScopeIdentityComparisonContract: stableValue(
      atom?.objectScopeIdentityComparisonContract || null
    ),
    scopePolicy: atom?.scopePolicy,
    comparisonApplicability: comparisonApplicability(atom),
    operationalEventMode: operationalEventMode(atom),
    conditionalOrOptional: hasConditionalOrOptionalCoverageSource(atom),
    sourceBindingValid: validSourceBinding(atom),
    complete: completeRawComparisonAtom(atom),
    unresolvedCandidateIds: strings(atom?.unresolvedCandidateIds),
    fields: semanticFieldSignature(atom?.fields).map(
      ({ displayValue: _displayValue, ...fact }) => fact
    ),
  });
}

function comparisonContributor(atom) {
  return {
    requirementId: String(atom?.requirementId || ""),
    requirementContractDigest: String(atom?.requirementContractDigest || ""),
    componentId: String(atom?.componentId || ""),
    componentLabel: String(atom?.componentLabel || ""),
    factRole: String(atom?.factRole || ""),
    evidencePresence: String(atom?.evidencePresence || ""),
    coverageEffect: String(atom?.coverageEffect || ""),
    conflictState: String(atom?.conflictState || ""),
    selectedScopePicture: String(atom?.selectedScopePicture || ""),
    comparisonScopeKeys: strings(atom?.comparisonScopeKeys),
    objectScopeEvidenceContract: stableValue(
      atom?.objectScopeEvidenceContract || null
    ),
    objectScopeIdentityComparisonContract: stableValue(
      atom?.objectScopeIdentityComparisonContract || null
    ),
    scopePolicy: String(atom?.scopePolicy || ""),
    requestedFieldStatus: String(atom?.requestedFieldStatus || ""),
    requestedFields: strings(atom?.requestedFields),
    optionalFields: strings(atom?.optionalFields),
    documentUuids: strings(atom?.documentUuids),
    documentRole: String(atom?.documentRole || ""),
    documentStatus: String(atom?.documentStatus || ""),
    documentApplicability: String(atom?.documentApplicability || ""),
    comparisonApplicability: comparisonApplicability(atom),
    selectedCandidateIds: strings(atom?.selectedCandidateIds),
    unresolvedCandidateIds: strings(atom?.unresolvedCandidateIds),
    sources: sortedCopies(atom?.sources),
    fields: sortedCopies(atom?.fields),
    sourceBindingValid: validSourceBinding(atom),
    complete: completeRawComparisonAtom(atom),
    conditionalOrOptional: hasConditionalOrOptionalCoverageSource(atom),
    operationalEventMode: operationalEventMode(atom),
  };
}

function canonicalComparisonAtom(atoms, key) {
  const contributors = sortedCopies(atoms.map(comparisonContributor));
  const representative = [...atoms].sort((left, right) =>
    stableKey(comparisonContributor(left)).localeCompare(
      stableKey(comparisonContributor(right)),
      "de-AT"
    )
  )[0];
  const member = atoms.every(
    (atom) => comparisonApplicability(atom) === PACKAGE_MEMBER
  );
  return {
    comparisonProjectionContractId: CANONICAL_COMPARISON_ATOM_CONTRACT_ID,
    requirementId: representative.requirementId,
    componentId: representative.componentId,
    componentLabel: representative.componentLabel,
    factRole: representative.factRole,
    evidencePresence: representative.evidencePresence,
    coverageEffect: representative.coverageEffect,
    conflictState: representative.conflictState,
    selectedScopePicture: representative.selectedScopePicture,
    comparisonScopeKeys: strings(representative.comparisonScopeKeys),
    objectScopeEvidenceContract: stableValue(
      representative.objectScopeEvidenceContract || null
    ),
    objectScopeIdentityComparisonContract: stableValue(
      representative.objectScopeIdentityComparisonContract || null
    ),
    scopePolicy: representative.scopePolicy,
    requestedFieldStatus: representative.requestedFieldStatus,
    requestedFields: strings(representative.requestedFields),
    optionalFields: strings(representative.optionalFields),
    componentSatisfactionPolicy: representative.componentSatisfactionPolicy,
    coverageAggregationPolicy: representative.coverageAggregationPolicy,
    requirementContractDigest: representative.requirementContractDigest,
    declaredComponents: stableValue(representative.declaredComponents || []),
    comparisonApplicability: member ? PACKAGE_MEMBER : null,
    documentApplicability: member ? PACKAGE_MEMBER : "UNKNOWN",
    comparisonOperationalEventMode: operationalEventMode(representative),
    comparisonConditionalOrOptional:
      hasConditionalOrOptionalCoverageSource(representative),
    comparisonFieldFacts: semanticFieldSignature(representative.fields),
    comparisonContributors: contributors,
    documentUuids: strings(
      contributors.flatMap(({ documentUuids }) => documentUuids)
    ),
    sources: sortedCopies(contributors.flatMap(({ sources }) => sources)),
    comparisonCanonicalKey: key,
  };
}

function canonicalComparisonAtoms(atoms) {
  const groups = new Map();
  for (const atom of atoms || []) {
    const key = semanticComparisonAtomKey(atom);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(atom);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "de-AT"))
    .map(([key, group]) => canonicalComparisonAtom(group, key));
}

module.exports = {
  CANONICAL_COMPARISON_ATOM_CONTRACT_ID,
  PACKAGE_MEMBER,
  VALID_COMPARISON_SCOPES,
  atomEventMode,
  atomHasConditionalOrOptionalSource,
  canonicalComparisonAtoms,
  comparisonApplicability,
  comparisonAtomComplete,
  comparisonContributor,
  comparisonFieldSignature,
  completeRawComparisonAtom,
  semanticComparisonAtomKey,
  semanticFieldSignature,
  validSourceBinding,
  validComparisonScope,
};
