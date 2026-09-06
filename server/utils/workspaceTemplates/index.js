const {
  PolicyComparisonModeError,
  normalizePolicyComparisonMode,
  publicPolicyComparisonModes,
} = require("../policyComparison/modes");

const WORKSPACE_TEMPLATES = Object.freeze(publicPolicyComparisonModes());

const WORKSPACE_CREATION_DEFAULTS = Object.freeze({
  chatProvider: null,
  chatModel: null,
  chatMode: "chat",
  openAiHistory: 1,
  openAiTemp: 0,
  vectorSearchMode: "default",
  topN: 55,
  similarityThreshold: 0,
});

const WorkspaceTemplateError = PolicyComparisonModeError;

function workspaceTemplate(templateId) {
  const normalized = normalizePolicyComparisonMode(templateId, {
    allowDefault: true,
  });
  return WORKSPACE_TEMPLATES.find(({ id }) => id === normalized);
}

function listWorkspaceTemplates() {
  return WORKSPACE_TEMPLATES.map((template) => ({ ...template }));
}

function resolveWorkspaceCreationMode({
  analysisMode,
  templateId,
  policyComparisonMode,
} = {}) {
  const suppliedModes = [
    ["analysisMode", analysisMode],
    ["templateId", templateId],
    ["policyComparisonMode", policyComparisonMode],
  ].filter(([, value]) => value !== null && value !== undefined);
  if (suppliedModes.length === 0)
    return normalizePolicyComparisonMode(null, { allowDefault: true });

  const normalizedModes = suppliedModes.map(([field, value]) => [
    field,
    normalizePolicyComparisonMode(value, { allowDefault: false }),
  ]);
  const selectedMode = normalizedModes[0][1];
  const conflictingField = normalizedModes.find(
    ([, mode]) => mode !== selectedMode
  )?.[0];
  if (conflictingField)
    throw new WorkspaceTemplateError(
      `Die Analyseverfahren widersprechen einander (${normalizedModes
        .map(([field]) => field)
        .join(", ")}).`
    );
  return selectedMode;
}

function buildWorkspaceCreationFields(templateId = null) {
  const template = workspaceTemplate(templateId);
  const fields = {
    ...WORKSPACE_CREATION_DEFAULTS,
    policyComparisonMode: template.id,
  };
  return {
    fields,
    template: { ...template },
  };
}

module.exports = {
  WORKSPACE_CREATION_DEFAULTS,
  WORKSPACE_TEMPLATES,
  WorkspaceTemplateError,
  buildWorkspaceCreationFields,
  listWorkspaceTemplates,
  resolveWorkspaceCreationMode,
  workspaceTemplate,
};
