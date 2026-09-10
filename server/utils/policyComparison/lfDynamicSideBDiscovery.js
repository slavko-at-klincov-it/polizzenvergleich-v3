const plan = require("../../resources/policyAnalysis/lf-dynamic-side-b-discovery.v2.json");
const { sha256 } = require("../policyAnalysis/runIdentity");

const ALLOWED_TARGET_KEYS = new Set([
  "requirementId",
  "componentId",
  "additionalAliases",
  "suppressedAliases",
  "conceptSearches",
]);
const ALLOWED_SEARCH_KEYS = new Set([
  "id",
  "requiredGroups",
  "maxLines",
  "maxChars",
]);

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validatedDiscoveryPlan(oracle) {
  if (
    !plan ||
    typeof plan !== "object" ||
    !nonEmptyString(plan.planId) ||
    plan.semanticOracleId !== oracle?.oracleId ||
    !Array.isArray(plan.targets)
  )
    throw new Error("LF_DYNAMIC_DISCOVERY_PLAN_INVALID");

  const requirements = new Map(
    oracle.requirements.map((requirement) => [requirement.id, requirement])
  );
  const targetKeys = new Set();
  const searchIds = new Set();
  for (const target of plan.targets) {
    if (
      !target ||
      typeof target !== "object" ||
      Array.isArray(target) ||
      Object.keys(target).some((key) => !ALLOWED_TARGET_KEYS.has(key)) ||
      !nonEmptyString(target.requirementId) ||
      !nonEmptyString(target.componentId)
    )
      throw new Error("LF_DYNAMIC_DISCOVERY_TARGET_INVALID");
    const requirement = requirements.get(target.requirementId);
    if (
      !requirement?.components.some(
        (component) => component.id === target.componentId
      )
    )
      throw new Error(
        `LF_DYNAMIC_DISCOVERY_TARGET_UNKNOWN:${target.requirementId}:${target.componentId}`
      );
    const targetKey = `${target.requirementId}:${target.componentId}`;
    if (targetKeys.has(targetKey))
      throw new Error(`LF_DYNAMIC_DISCOVERY_TARGET_DUPLICATE:${targetKey}`);
    targetKeys.add(targetKey);

    if (
      target.additionalAliases !== undefined &&
      (!Array.isArray(target.additionalAliases) ||
        target.additionalAliases.length === 0 ||
        target.additionalAliases.some((alias) => !nonEmptyString(alias)))
    )
      throw new Error(`LF_DYNAMIC_DISCOVERY_ALIASES_INVALID:${targetKey}`);
    if (
      target.suppressedAliases !== undefined &&
      (!Array.isArray(target.suppressedAliases) ||
        target.suppressedAliases.length === 0 ||
        target.suppressedAliases.some((alias) => !nonEmptyString(alias)) ||
        target.suppressedAliases.some(
          (alias) =>
            !(
              requirement.components.find(({ id }) => id === target.componentId)
                ?.aliases || []
            ).includes(alias)
        ))
    )
      throw new Error(
        `LF_DYNAMIC_DISCOVERY_SUPPRESSED_ALIASES_INVALID:${targetKey}`
      );
    if (
      target.conceptSearches !== undefined &&
      (!Array.isArray(target.conceptSearches) ||
        target.conceptSearches.length === 0)
    )
      throw new Error(`LF_DYNAMIC_DISCOVERY_SEARCHES_INVALID:${targetKey}`);
    for (const search of target.conceptSearches || []) {
      if (
        !search ||
        typeof search !== "object" ||
        Array.isArray(search) ||
        Object.keys(search).some((key) => !ALLOWED_SEARCH_KEYS.has(key)) ||
        !nonEmptyString(search.id) ||
        !Array.isArray(search.requiredGroups) ||
        search.requiredGroups.length === 0 ||
        !Number.isInteger(search.maxLines) ||
        search.maxLines < 1 ||
        search.maxLines > 3 ||
        !Number.isInteger(search.maxChars) ||
        search.maxChars < 80 ||
        search.maxChars > 900 ||
        search.requiredGroups.some(
          (group) =>
            !group ||
            typeof group !== "object" ||
            Array.isArray(group) ||
            Object.keys(group).some((key) => key !== "prefixes") ||
            !Array.isArray(group.prefixes) ||
            group.prefixes.length === 0 ||
            group.prefixes.some(
              (prefix) =>
                !nonEmptyString(prefix) ||
                prefix.trim().length < 4 ||
                /\s/u.test(prefix)
            )
        )
      )
        throw new Error(`LF_DYNAMIC_DISCOVERY_SEARCH_INVALID:${targetKey}`);
      if (searchIds.has(search.id))
        throw new Error(`LF_DYNAMIC_DISCOVERY_SEARCH_DUPLICATE:${search.id}`);
      searchIds.add(search.id);
    }
  }
  return plan;
}

function discoveryPlanIdentity(oracle) {
  const validated = validatedDiscoveryPlan(oracle);
  return `${validated.planId}:${sha256(JSON.stringify(validated))}`;
}

function applySideBDiscovery({ oracle, requirementId, component }) {
  const validated = validatedDiscoveryPlan(oracle);
  const target = validated.targets.find(
    (entry) =>
      entry.requirementId === requirementId &&
      entry.componentId === component.id
  );
  if (!target) return { ...component };
  const conceptSearches = [
    ...(component.conceptSearches || []),
    ...(target.conceptSearches || []),
  ];
  if (
    new Set(conceptSearches.map(({ id }) => id)).size !== conceptSearches.length
  )
    throw new Error(
      `LF_DYNAMIC_DISCOVERY_COMPONENT_SEARCH_DUPLICATE:${requirementId}:${component.id}`
    );
  return {
    ...component,
    aliases: [
      ...new Set([
        ...(component.aliases || []).filter(
          (alias) => !(target.suppressedAliases || []).includes(alias)
        ),
        ...(target.additionalAliases || []),
      ]),
    ],
    ...(conceptSearches.length > 0 ? { conceptSearches } : {}),
  };
}

module.exports = {
  applySideBDiscovery,
  discoveryPlanIdentity,
  plan,
  validatedDiscoveryPlan,
};
