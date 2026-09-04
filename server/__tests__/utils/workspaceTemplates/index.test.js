const {
  WORKSPACE_TEMPLATES,
  WORKSPACE_CREATION_DEFAULTS,
  WorkspaceTemplateError,
  buildWorkspaceCreationFields,
  listWorkspaceTemplates,
  resolveWorkspaceCreationMode,
} = require("../../../utils/workspaceTemplates");
const {
  POLICY_COMPARISON_MODE,
} = require("../../../utils/policyComparison/modes");

describe("workspaceTemplates", () => {
  test("lists only the two customer-visible comparison workflows", () => {
    expect(listWorkspaceTemplates()).toEqual([
      expect.objectContaining({
        id: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
        direction: "A_TO_B",
        discoversSideBOnly: false,
      }),
      expect.objectContaining({
        id: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
        direction: "SYMMETRIC",
        discoversSideBOnly: true,
      }),
    ]);
    expect(WORKSPACE_TEMPLATES).toHaveLength(2);
  });

  test("keeps the symmetric workflow as the API compatibility default", () => {
    const result = buildWorkspaceCreationFields();
    expect(result.template.id).toBe(POLICY_COMPARISON_MODE.SYMMETRIC_A_B);
    expect(result.fields).toEqual({
      ...WORKSPACE_CREATION_DEFAULTS,
      policyComparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
    });
    expect(result.fields).not.toHaveProperty("openAiPrompt");
  });

  test.each(listWorkspaceTemplates())(
    "persists the selected workflow $id without replacing the system prompt",
    ({ id }) => {
      const result = buildWorkspaceCreationFields(id.toLowerCase());
      expect(result.template.id).toBe(id);
      expect(result.fields.policyComparisonMode).toBe(id);
      expect(result.fields).not.toHaveProperty("openAiPrompt");
    }
  );

  test("removes former category templates from the creation contract", () => {
    for (const removed of ["VS", "FE", "LW", "ST", "EL", "HP", "VB", "WE"])
      expect(() => buildWorkspaceCreationFields(removed)).toThrow(
        WorkspaceTemplateError
      );
    expect(() => buildWorkspaceCreationFields({ id: "VS" })).toThrow(
      WorkspaceTemplateError
    );
  });

  test("accepts the public API mode name and its legacy alias consistently", () => {
    expect(
      resolveWorkspaceCreationMode({
        analysisMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
      })
    ).toBe(POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B);
    expect(
      resolveWorkspaceCreationMode({
        policyComparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
      })
    ).toBe(POLICY_COMPARISON_MODE.SYMMETRIC_A_B);
    expect(
      resolveWorkspaceCreationMode({
        analysisMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
        policyComparisonMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
      })
    ).toBe(POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B);
  });

  test("rejects contradictory public and legacy API mode fields", () => {
    expect(() =>
      resolveWorkspaceCreationMode({
        analysisMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
        policyComparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
      })
    ).toThrow(WorkspaceTemplateError);
  });
});
