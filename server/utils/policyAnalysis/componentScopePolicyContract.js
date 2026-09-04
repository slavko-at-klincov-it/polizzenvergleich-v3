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

module.exports = { componentScopeContract };
