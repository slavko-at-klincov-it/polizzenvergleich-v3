const {
  hasConditionalOrOptionalCoverageSource,
} = require("./comparisonAtomSemantics");
const {
  comparisonFieldSignature,
} = require("./comparisonAtomCanonicalization");

const STORM_DEFINITION_THRESHOLD_EQUALITY_RULE_ID =
  "STORM_DEFINITION_THRESHOLD_EQUALITY_V1";

function normalized(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function speedThreshold(value) {
  const match = normalized(value).match(/^(\d+(?:[.,]\d+)?)\s*km\s*\/\s*h$/u);
  if (!match) return null;
  return `${match[1].replace(",", ".")}:KM_H`;
}

function semanticField(atom) {
  const fields = comparisonFieldSignature(atom);
  if (fields.length !== 1) return null;
  const [field] = fields;
  if (
    field.field !== "threshold" ||
    field.fieldStatus !== "FOUND" ||
    field.valueType !== "TEXT" ||
    field.unit !== "" ||
    field.limitKind !== "" ||
    field.qualifier !== "" ||
    field.variantScopeKey !== "" ||
    field.componentScopeKey !== ""
  )
    return null;
  const threshold = speedThreshold(field.value);
  return threshold ? { threshold } : null;
}

function sourceDefinitionSignature(source, threshold) {
  const text = normalized(source?.conditionCheckText || source?.exactText);
  const [number] = threshold.split(":");
  const escapedNumber = number.replace(".", "[.,]");
  if (
    !text ||
    !/\bsturm\b/u.test(text) ||
    !/\bwind\b/u.test(text) ||
    !/\bspitzengeschwindigkeit(?:en)?\b/u.test(text) ||
    new RegExp(
      `(?:mehr\\s+als|über|>)\\s*${escapedNumber}\\s*km\\s*\\/\\s*h`,
      "u"
    ).test(text) !== true ||
    /\b(?:mindestens|wenigstens|ab|höchstens|circa|rund|ungefähr|mittlere|durchschnittliche|dauerwind)\b/u.test(
      text
    ) ||
    /\bnicht\s+als\s+sturm\b|\bsturm\s+gilt\s+nicht\b/u.test(text)
  )
    return null;
  return `PEAK_WIND:GT:${threshold}`;
}

function stormDefinitionSignature(atom) {
  if (
    atom?.requirementId !== "ST-01" ||
    atom?.componentId !== "storm_wind_speed_definition" ||
    atom?.factRole !== "DEFINITION" ||
    atom?.coverageEffect !== "DEFINED" ||
    hasConditionalOrOptionalCoverageSource(atom)
  )
    return null;
  const field = semanticField(atom);
  if (!field || !Array.isArray(atom.sources) || atom.sources.length === 0)
    return null;
  const sourceSignatures = atom.sources.map((source) =>
    sourceDefinitionSignature(source, field.threshold)
  );
  if (
    sourceSignatures.some((signature) => !signature) ||
    new Set(sourceSignatures).size !== 1
  )
    return null;
  return sourceSignatures[0];
}

/**
 * Compares only a complete, source-bound ST-01 peak-wind definition. The
 * versioned contract recognizes GT thresholds in km/h; different operators,
 * units, measurement bases, conditions or values remain fail-closed.
 * Role: compare. Side effects: none.
 */
function compareStormDefinitionThreshold(left, right) {
  const leftSignature = stormDefinitionSignature(left);
  const rightSignature = stormDefinitionSignature(right);
  if (!leftSignature || leftSignature !== rightSignature) return null;
  return {
    equivalent: true,
    ruleId: STORM_DEFINITION_THRESHOLD_EQUALITY_RULE_ID,
  };
}

module.exports = {
  STORM_DEFINITION_THRESHOLD_EQUALITY_RULE_ID,
  compareStormDefinitionThreshold,
};
