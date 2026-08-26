const fs = require("fs");
const path = require("path");
const {
  WORKSPACE_TEMPLATES,
  WORKSPACE_CREATION_DEFAULTS,
  WorkspaceTemplateError,
  buildWorkspaceCreationFields,
  listWorkspaceTemplates,
} = require("../../../utils/workspaceTemplates");

describe("workspaceTemplates", () => {
  test("lists the eight domain templates in the product order", () => {
    expect(listWorkspaceTemplates()).toEqual([
      { id: "VS", name: "Versicherungssumme und versicherte Sachen" },
      { id: "FE", name: "Feuer" },
      { id: "LW", name: "Leitungswasser" },
      { id: "ST", name: "Sturm" },
      { id: "EL", name: "Elementar und Zusatzdeckungen" },
      { id: "HP", name: "Haus- und Grundbesitzhaftpflicht" },
      { id: "VB", name: "Vertragsbestimmungen" },
      { id: "WE", name: "Wohnungseigentum" },
    ]);
  });

  test("uses product defaults without overriding the default system prompt", () => {
    const result = buildWorkspaceCreationFields();
    expect(result).toEqual({
      fields: { ...WORKSPACE_CREATION_DEFAULTS },
      template: null,
    });
    expect(result.fields).not.toHaveProperty("openAiPrompt");
  });

  test.each(listWorkspaceTemplates())(
    "loads the packaged $id prompt",
    ({ id, name }) => {
      const result = buildWorkspaceCreationFields(id.toLowerCase());
      expect(result.template).toEqual({ id, name });
      expect(result.fields.openAiPrompt).toContain(
        "Du unterstützt einen österreichischen Versicherungsmakler"
      );
      expect(result.fields.openAiPrompt.length).toBeGreaterThan(9_000);
      const template = WORKSPACE_TEMPLATES.find((item) => item.id === id);
      const packagedPrompt = fs.readFileSync(
        path.resolve(
          __dirname,
          `../../../resources/workspaceTemplates/${template.filename}`
        ),
        "utf8"
      );
      expect(result.fields.openAiPrompt).toBe(packagedPrompt);
      expect(result.fields).toMatchObject(WORKSPACE_CREATION_DEFAULTS);
    }
  );

  test("rejects unknown and non-string template identifiers", () => {
    expect(() => buildWorkspaceCreationFields("XX")).toThrow(
      WorkspaceTemplateError
    );
    expect(() => buildWorkspaceCreationFields({ id: "VS" })).toThrow(
      WorkspaceTemplateError
    );
  });
});
