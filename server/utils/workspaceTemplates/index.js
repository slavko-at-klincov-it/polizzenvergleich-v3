const fs = require("fs");
const path = require("path");

const TEMPLATE_DIRECTORY = path.resolve(
  __dirname,
  "../../resources/workspaceTemplates"
);

const WORKSPACE_TEMPLATES = Object.freeze([
  {
    id: "VS",
    name: "Versicherungssumme und versicherte Sachen",
    filename: "VS_versicherungssumme_und_versicherte_sachen.md",
  },
  { id: "FE", name: "Feuer", filename: "FE_feuer.md" },
  {
    id: "LW",
    name: "Leitungswasser",
    filename: "LW_leitungswasser.md",
  },
  { id: "ST", name: "Sturm", filename: "ST_sturm.md" },
  {
    id: "EL",
    name: "Elementar und Zusatzdeckungen",
    filename: "EL_elementar_und_zusatzdeckungen.md",
  },
  {
    id: "HP",
    name: "Haus- und Grundbesitzhaftpflicht",
    filename: "HP_haus_und_grundbesitzhaftpflicht.md",
  },
  {
    id: "VB",
    name: "Vertragsbestimmungen",
    filename: "VB_vertragsbestimmungen.md",
  },
  {
    id: "WE",
    name: "Wohnungseigentum",
    filename: "WE_wohnungseigentum.md",
  },
]);

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

class WorkspaceTemplateError extends Error {
  constructor(message) {
    super(message);
    this.name = "WorkspaceTemplateError";
  }
}

function normalizeTemplateId(templateId) {
  if (templateId === null || templateId === undefined) return null;
  if (typeof templateId !== "string")
    throw new WorkspaceTemplateError("Ungültige Fachvorlagen-ID.");
  const normalized = templateId.trim().toUpperCase();
  return normalized || null;
}

function workspaceTemplate(templateId) {
  const normalized = normalizeTemplateId(templateId);
  if (!normalized) return null;
  const template = WORKSPACE_TEMPLATES.find(({ id }) => id === normalized);
  if (!template)
    throw new WorkspaceTemplateError(`Unbekannte Fachvorlage '${normalized}'.`);
  return template;
}

function readTemplatePrompt(template) {
  const promptPath = path.join(TEMPLATE_DIRECTORY, template.filename);
  let prompt;
  try {
    prompt = fs.readFileSync(promptPath, "utf8");
  } catch {
    throw new WorkspaceTemplateError(
      `Fachvorlage '${template.id}' ist nicht verfügbar.`
    );
  }
  if (!prompt.trim())
    throw new WorkspaceTemplateError(`Fachvorlage '${template.id}' ist leer.`);
  if (Buffer.byteLength(prompt, "utf8") > 1024 * 1024)
    throw new WorkspaceTemplateError(
      `Fachvorlage '${template.id}' ist zu groß.`
    );
  return prompt;
}

function listWorkspaceTemplates() {
  return WORKSPACE_TEMPLATES.map(({ id, name }) => ({ id, name }));
}

function buildWorkspaceCreationFields(templateId = null) {
  const template = workspaceTemplate(templateId);
  const fields = { ...WORKSPACE_CREATION_DEFAULTS };
  if (template) fields.openAiPrompt = readTemplatePrompt(template);
  return {
    fields,
    template: template ? { id: template.id, name: template.name } : null,
  };
}

module.exports = {
  WORKSPACE_CREATION_DEFAULTS,
  WORKSPACE_TEMPLATES,
  WorkspaceTemplateError,
  buildWorkspaceCreationFields,
  listWorkspaceTemplates,
  workspaceTemplate,
};
