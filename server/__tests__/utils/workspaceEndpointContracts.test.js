const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");

function source(relativePath) {
  return fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
}

describe("workspace endpoint contracts", () => {
  const endpointFiles = [
    "server/endpoints/workspaces.js",
    "server/endpoints/admin.js",
    "server/endpoints/api/workspace/index.js",
  ];

  test.each(endpointFiles)(
    "%s resolves every supported workspace mode alias",
    (endpointFile) => {
      const contents = source(endpointFile);
      expect(contents).toContain("resolveWorkspaceCreationMode({");
      expect(contents).toContain("analysisMode,");
      expect(contents).toContain("templateId,");
      expect(contents).toContain("policyComparisonMode,");
    }
  );

  test.each(endpointFiles)(
    "%s prepares comparison cleanup before deleting the workspace",
    (endpointFile) => {
      const contents = source(endpointFile);
      expect(contents).toContain("prepareWorkspaceComparisonDeletion(");
      expect(
        contents.indexOf("prepareWorkspaceComparisonDeletion(")
      ).toBeLessThan(contents.indexOf("await Workspace.delete("));
    }
  );

  test("records normal workspace creation only after creation succeeded", () => {
    const contents = source("server/endpoints/workspaces.js");
    const failedCreationGuard = contents.indexOf("if (!workspace)");
    expect(failedCreationGuard).toBeGreaterThan(-1);
    expect(failedCreationGuard).toBeLessThan(
      contents.indexOf("await Telemetry.sendTelemetry(")
    );
    expect(failedCreationGuard).toBeLessThan(
      contents.indexOf("await EventLogs.logEvent(")
    );
  });
});
