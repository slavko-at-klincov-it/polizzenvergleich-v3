const {
  validFeC07ConditionAbsenceAudit,
} = require("../policyAnalysis/feC07ConditionAbsenceAudit");
const {
  atomEventMode,
  comparisonAtomComplete,
} = require("./comparisonAtomCanonicalization");
const {
  hasOptionalCoverageSource,
} = require("./comparisonAtomSemantics");

const FE_C07_LIMIT_DOMINANCE_RULE_ID =
  "FE_C07_HIGHER_UNCONDITIONED_PERCENT_LIMIT_V1";
const FE_C07_LIMIT_DOMINANCE_AUDIT_CONTRACT_ID =
  "FE_C07_HIGHER_UNCONDITIONED_PERCENT_LIMIT_AUDIT_V1";
const FE_C07_COMPONENT_ID = "sauna_or_infrared_cabin_in_common_room";
const FE_C07_LIMIT_QUALIFIER =
  "jeweils; auf erstes risiko; bezugsgröße gebäudeversicherungssumme";
const FE_C07_KNOWN_RESTRICTION =
  "der versicherungsnehmer und/oder gebäudeeigentümer für den eingetretenen schaden ersatzpflichtig ist und das gebäude gegen die angeführte gefahr versichert ist";

function normalized(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function exactStrings(value, expected) {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

function exactDeclaredComponent(atom) {
  return (
    Array.isArray(atom?.declaredComponents) &&
    atom.declaredComponents.length === 1 &&
    atom.declaredComponents[0]?.id === FE_C07_COMPONENT_ID &&
    atom.declaredComponents[0]?.factRole === "INSURED_OBJECT"
  );
}

function exactAtomShape(atom) {
  return Boolean(
    atom?.requirementId === "FE-C07" &&
      atom?.componentId === FE_C07_COMPONENT_ID &&
      atom?.factRole === "INSURED_OBJECT" &&
      atom?.evidencePresence === "FOUND" &&
      atom?.coverageEffect === "INCLUDED" &&
      atom?.conflictState === "NONE" &&
      (atom?.unresolvedCandidateIds || []).length === 0 &&
      atom?.componentSatisfactionPolicy === "ALL" &&
      exactDeclaredComponent(atom) &&
      atom?.requestedFieldStatus === "COMPLETE" &&
      exactStrings(atom?.requestedFields, ["limit"]) &&
      exactStrings(atom?.optionalFields, ["condition"]) &&
      /^[a-f0-9]{64}$/u.test(String(atom?.requirementContractDigest || "")) &&
      comparisonAtomComplete(atom)
  );
}

function contributors(atom) {
  return Array.isArray(atom?.comparisonContributors)
    ? atom.comparisonContributors
    : [atom];
}

function fieldMap(contributor) {
  if (!Array.isArray(contributor?.fields) || contributor.fields.length !== 2)
    return null;
  const map = new Map();
  for (const field of contributor.fields) {
    if (!field?.field || map.has(field.field)) return null;
    map.set(field.field, field);
  }
  return map.size === 2 && map.has("limit") && map.has("condition")
    ? map
    : null;
}

function percentHundredths(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,3})(?:[.,](\d{1,2}))?\s*%$/u);
  if (!match) return null;
  const amount = BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
  return amount > 0n && amount <= 10_000n ? amount : null;
}

function exactLimit(contributor, fields) {
  const limit = fields.get("limit");
  if (
    limit?.status !== "FOUND" ||
    !Array.isArray(limit?.facts) ||
    limit.facts.length !== 1
  )
    return null;
  const [fact] = limit.facts;
  const value = percentHundredths(fact?.normalizedValue || fact?.rawValue);
  if (
    value === null ||
    fact?.valueType !== "PERCENT" ||
    fact?.unit !== "%" ||
    fact?.limitKind !== "CAPPED" ||
    normalized(fact?.qualifier) !== FE_C07_LIMIT_QUALIFIER ||
    fact?.variantScope?.key ||
    fact?.componentScope?.key ||
    fact?.componentScope?.id ||
    !contributor.selectedCandidateIds?.includes(fact?.source?.candidateId)
  )
    return null;
  return {
    value,
    displayValue: String(fact.normalizedValue || fact.rawValue),
  };
}

function exactCondition(contributor, fields, { higher }) {
  const condition = fields.get("condition");
  if (!condition || !Array.isArray(condition.facts)) return null;
  if (condition.status === "NOT_FOUND" && condition.facts.length === 0) {
    const audit = condition.absenceAudit;
    if (
      !validFeC07ConditionAbsenceAudit(audit) ||
      !contributor.selectedCandidateIds?.includes(audit.source.candidateId)
    )
      return null;
    return {
      mode: "CERTIFIED_LOCAL_ABSENCE",
      auditDigest: audit.source.exactTextSha256,
      auditRange: [audit.source.documentStart, audit.source.documentEnd],
    };
  }
  if (
    higher ||
    condition.status !== "FOUND" ||
    condition.facts.length !== 1 ||
    hasOptionalCoverageSource(contributor)
  )
    return null;
  const [fact] = condition.facts;
  if (
    fact?.valueType !== "TEXT" ||
    ![null, undefined].includes(fact?.unit) ||
    normalized(fact?.normalizedValue || fact?.rawValue) !==
      FE_C07_KNOWN_RESTRICTION ||
    !contributor.selectedCandidateIds?.includes(fact?.source?.candidateId)
  )
    return null;
  return { mode: "KNOWN_LIABILITY_AND_PERIL_RESTRICTION" };
}

function sideEvidence(atom, { higher }) {
  const parts = contributors(atom);
  if (parts.length === 0) return null;
  const evidence = [];
  for (const part of parts) {
    if (
      part?.requirementId !== "FE-C07" ||
      part?.componentId !== FE_C07_COMPONENT_ID ||
      part?.factRole !== "INSURED_OBJECT" ||
      part?.coverageEffect !== "INCLUDED" ||
      part?.conflictState !== "NONE" ||
      part?.requestedFieldStatus !== "COMPLETE" ||
      !exactStrings(part?.requestedFields, ["limit"]) ||
      !exactStrings(part?.optionalFields, ["condition"]) ||
      !Array.isArray(part?.selectedCandidateIds) ||
      part.selectedCandidateIds.length === 0 ||
      part?.complete === false
    )
      return null;
    const fields = fieldMap(part);
    const limit = fields ? exactLimit(part, fields) : null;
    const condition = fields
      ? exactCondition(part, fields, { higher })
      : null;
    if (!limit || !condition) return null;
    evidence.push({ limit, condition });
  }
  const valueKeys = new Set(evidence.map(({ limit }) => limit.value.toString()));
  const conditionModes = new Set(
    evidence.map(({ condition }) => condition.mode)
  );
  if (valueKeys.size !== 1 || conditionModes.size !== 1) return null;
  return {
    value: evidence[0].limit.value,
    displayValue: evidence[0].limit.displayValue,
    conditionMode: evidence[0].condition.mode,
    clauseAudits: evidence
      .map(({ condition }) =>
        condition.auditDigest
          ? {
              digestSha256: condition.auditDigest,
              range: condition.auditRange,
            }
          : null
      )
      .filter(Boolean),
  };
}

function sameComparisonPlane(left, right) {
  const applicability = (atom) =>
    atom?.comparisonApplicability || atom?.documentApplicability;
  return (
    left.requirementContractDigest === right.requirementContractDigest &&
    left.selectedScopePicture === right.selectedScopePicture &&
    left.scopePolicy === right.scopePolicy &&
    applicability(left) === applicability(right) &&
    atomEventMode(left) === atomEventMode(right)
  );
}

/**
 * Orders only the narrowly certified FE-C07 percentage-limit shape. The
 * higher side must prove a complete affirmative local governing clause with
 * no additional condition. The lower side may have that same certificate or
 * the one typed liability/peril restriction. Equality and every ambiguous
 * shape remain on the generic fail-closed path.
 * Role: compare. Side effects: none.
 */
function compareFeC07LimitDominance(left, right) {
  if (
    !exactAtomShape(left) ||
    !exactAtomShape(right) ||
    !sameComparisonPlane(left, right)
  )
    return null;

  const unrestrictedA = sideEvidence(left, { higher: true });
  const unrestrictedB = sideEvidence(right, { higher: true });
  const lowerA = sideEvidence(left, { higher: false });
  const lowerB = sideEvidence(right, { higher: false });
  const candidates = [];
  if (unrestrictedA && lowerB && unrestrictedA.value > lowerB.value)
    candidates.push({ side: "A", higher: unrestrictedA, lower: lowerB });
  if (unrestrictedB && lowerA && unrestrictedB.value > lowerA.value)
    candidates.push({ side: "B", higher: unrestrictedB, lower: lowerA });
  if (candidates.length !== 1) return null;
  const [winner] = candidates;
  return {
    winnerSide: winner.side,
    ruleId: FE_C07_LIMIT_DOMINANCE_RULE_ID,
    audit: {
      schemaVersion: 1,
      contractId: FE_C07_LIMIT_DOMINANCE_AUDIT_CONTRACT_ID,
      winnerSide: winner.side,
      higherValue: winner.higher.displayValue,
      lowerValue: winner.lower.displayValue,
      qualifier: FE_C07_LIMIT_QUALIFIER,
      higherConditionMode: winner.higher.conditionMode,
      lowerConditionMode: winner.lower.conditionMode,
      higherClauseAudits: winner.higher.clauseAudits,
    },
  };
}

module.exports = {
  FE_C07_LIMIT_DOMINANCE_AUDIT_CONTRACT_ID,
  FE_C07_LIMIT_DOMINANCE_RULE_ID,
  compareFeC07LimitDominance,
};
