/**
 * Resolves the narrow-scope contract for one atomic component. A component
 * contract intentionally overrides the requirement default; otherwise all
 * existing requirement-wide contracts keep their behavior.
 * Side effects: none. Role: transform.
 */
function componentScopeContract(requirement, component) {
  if (component?.scopePolicy && component?.scopeRules)
    return {
      scopePolicy: component.scopePolicy,
      scopeRules: component.scopeRules,
    };
  return {
    scopePolicy: requirement?.scopePolicy || "GENERAL_REQUIRED",
    scopeRules: requirement?.scopeRules || {
      narrowAliases: [],
      narrowScopeKeys: [],
    },
  };
}

function catalogNarrowAliasComparisonScopeKey(requirement, component) {
  const narrowAliases = [
    ...new Set(
      (
        componentScopeContract(requirement, component).scopeRules
          ?.narrowAliases || []
      )
        .map((alias) =>
          String(alias || "")
            .normalize("NFKC")
            .replace(/\s+/gu, " ")
            .trim()
            .toLocaleLowerCase("de-AT")
        )
        .filter(Boolean)
    ),
  ].sort();
  if (
    !String(requirement?.id || "").trim() ||
    !String(component?.id || "").trim() ||
    narrowAliases.length === 0
  )
    return null;
  const digest = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        contractId: CATALOG_NARROW_ALIAS_SCOPE_CONTRACT_ID,
        requirementId: requirement.id,
        componentId: component.id,
        narrowAliases,
      })
    )
    .digest("hex");
  return `${CATALOG_NARROW_ALIAS_SCOPE_CONTRACT_ID}:${digest}`;
}

module.exports = {
  CATALOG_NARROW_ALIAS_SCOPE_CONTRACT_ID,
  catalogNarrowAliasComparisonScopeKey,
  componentScopeContract,
};
const crypto = require("crypto");

const CATALOG_NARROW_ALIAS_SCOPE_CONTRACT_ID =
  "CATALOG_NARROW_ALIAS_SCOPE_FAMILY_V1";
