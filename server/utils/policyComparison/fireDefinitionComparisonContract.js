const {
  atomEventMode,
  atomHasConditionalOrOptionalSource,
  comparisonAtomComplete,
  comparisonFieldSignature,
} = require("./comparisonAtomCanonicalization");

const FIRE_DEFINITION_COMPARISON_RULE_ID =
  "FE_A01_FIRE_DEFINITION_SCOPE_COMPARISON_V1";
const FIRE_DEFINITION_SPREAD_ONLY = "SPREAD_ONLY";
const FIRE_DEFINITION_ARISE_OR_SPREAD = "ARISE_OR_SPREAD";
const FIRE_DEFINITION_COMPONENT_ID = "fire_definition";
const FIRE_DEFINITION_CLAUSE =
  /\bbrand\s+(?:das\s+)?ist\s+ein\s+feuer\s*,\s*das\s+(?<body>[^.;:!?]{1,180})(?:[.;:!?]|$)/gu;
const ADVERSE_DEFINITION_CONTEXT =
  /\b(?:nicht\s+versichert|ausgeschlossen|optional|wahlweise)\b|\bbrand\s+(?:gilt\s+nicht|ist\s+(?:kein|nicht))\b|\bkann\b[^.;:!?]{0,96}\b(?:eingeschlossen|mitversichert|vereinbart)\s+werden\b/u;

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
    atom.declaredComponents[0]?.id === FIRE_DEFINITION_COMPONENT_ID &&
    atom.declaredComponents[0]?.factRole === "DEFINITION"
  );
}

function exactAtomShape(atom) {
  return Boolean(
    atom?.requirementId === "FE-A01" &&
      atom?.componentId === FIRE_DEFINITION_COMPONENT_ID &&
      atom?.factRole === "DEFINITION" &&
      atom?.evidencePresence === "FOUND" &&
      atom?.coverageEffect === "DEFINED" &&
      atom?.conflictState === "NONE" &&
      (atom?.unresolvedCandidateIds || []).length === 0 &&
      atom?.componentSatisfactionPolicy === "ALL" &&
      exactDeclaredComponent(atom) &&
      atom?.requestedFieldStatus === "NOT_REQUIRED" &&
      exactStrings(atom?.requestedFields, []) &&
      exactStrings(atom?.optionalFields, []) &&
      comparisonFieldSignature(atom).length === 0 &&
      atom?.selectedScopePicture === "GENERAL" &&
      atom?.scopePolicy === "GENERAL_REQUIRED" &&
      /^[a-f0-9]{64}$/u.test(String(atom?.requirementContractDigest || "")) &&
      comparisonAtomComplete(atom) &&
      !atomHasConditionalOrOptionalSource(atom)
  );
}

function contributors(atom) {
  return Array.isArray(atom?.comparisonContributors)
    ? atom.comparisonContributors
    : [atom];
}

function sourceDefinitionSignature(source) {
  const text = normalized(source?.conditionCheckText || source?.exactText);
  if (!text || ADVERSE_DEFINITION_CONTEXT.test(text)) return null;
  const matches = [...text.matchAll(FIRE_DEFINITION_CLAUSE)];
  if (matches.length !== 1 || !matches[0].groups?.body) return null;
  const body = matches[0].groups.body
    .replace(/\s*\(\s*schadenfeuer\s*\)\s*$/u, "")
    .trim();
  if (body === "sich bestimmungswidrig ausbreitet")
    return FIRE_DEFINITION_SPREAD_ONLY;
  if (
    /^bestimmungswidrig entsteht (?:und\s*\/\s*oder|oder) sich bestimmungswidrig ausbreitet$/u.test(
      body
    )
  )
    return FIRE_DEFINITION_ARISE_OR_SPREAD;
  return null;
}

function sideSignature(atom) {
  const parts = contributors(atom);
  if (parts.length === 0) return null;
  const signatures = [];
  for (const part of parts) {
    if (
      part?.requirementId !== "FE-A01" ||
      part?.componentId !== FIRE_DEFINITION_COMPONENT_ID ||
      part?.factRole !== "DEFINITION" ||
      part?.evidencePresence !== "FOUND" ||
      part?.coverageEffect !== "DEFINED" ||
      part?.conflictState !== "NONE" ||
      part?.requestedFieldStatus !== "NOT_REQUIRED" ||
      !exactStrings(part?.requestedFields, []) ||
      !exactStrings(part?.optionalFields, []) ||
      !Array.isArray(part?.selectedCandidateIds) ||
      part.selectedCandidateIds.length === 0 ||
      !Array.isArray(part?.sources) ||
      part.sources.length === 0 ||
      part.sources.some(
        (source) =>
          !part.selectedCandidateIds.includes(source?.candidateId) ||
          !Number.isInteger(source?.physicalPageNumber) ||
          source.physicalPageNumber <= 0
      ) ||
      part.selectedCandidateIds.some(
        (candidateId) =>
          !part.sources.some((source) => source?.candidateId === candidateId)
      ) ||
      part?.complete === false ||
      part?.conditionalOrOptional === true
    )
      return null;
    const sourceSignatures = part.sources.map(sourceDefinitionSignature);
    if (
      sourceSignatures.some((signature) => !signature) ||
      new Set(sourceSignatures).size !== 1
    )
      return null;
    signatures.push(sourceSignatures[0]);
  }
  return new Set(signatures).size === 1 ? signatures[0] : null;
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
 * Compares only complete, source-bound FE-A01 Brand definitions. V1 knows the
 * exact spread-only and arise-or-spread forms. Any other grammar, role, scope,
 * condition, optionality or conflicting source remains on the fail-closed path.
 * Role: compare. Side effects: none.
 */
function compareFireDefinition(left, right) {
  if (
    !exactAtomShape(left) ||
    !exactAtomShape(right) ||
    !sameComparisonPlane(left, right)
  )
    return null;
  const leftSignature = sideSignature(left);
  const rightSignature = sideSignature(right);
  if (!leftSignature || !rightSignature) return null;
  if (leftSignature === rightSignature)
    return {
      equivalent: true,
      winnerSide: null,
      ruleId: FIRE_DEFINITION_COMPARISON_RULE_ID,
    };
  if (
    leftSignature === FIRE_DEFINITION_ARISE_OR_SPREAD &&
    rightSignature === FIRE_DEFINITION_SPREAD_ONLY
  )
    return {
      equivalent: false,
      winnerSide: "A",
      ruleId: FIRE_DEFINITION_COMPARISON_RULE_ID,
    };
  if (
    leftSignature === FIRE_DEFINITION_SPREAD_ONLY &&
    rightSignature === FIRE_DEFINITION_ARISE_OR_SPREAD
  )
    return {
      equivalent: false,
      winnerSide: "B",
      ruleId: FIRE_DEFINITION_COMPARISON_RULE_ID,
    };
  return null;
}

module.exports = {
  FIRE_DEFINITION_ARISE_OR_SPREAD,
  FIRE_DEFINITION_COMPARISON_RULE_ID,
  FIRE_DEFINITION_SPREAD_ONLY,
  compareFireDefinition,
};
