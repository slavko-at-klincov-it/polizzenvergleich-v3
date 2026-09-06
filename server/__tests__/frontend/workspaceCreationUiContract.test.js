const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");

function source(relativePath) {
  return fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
}

describe("workspace creation UI contract", () => {
  test.each([
    "frontend/src/components/Modals/NewWorkspace.jsx",
    "frontend/src/pages/Admin/Workspaces/NewWorkspaceModal/index.jsx",
  ])(
    "%s requires a selected analysis mode and blocks duplicate submits",
    (file) => {
      const contents = source(file);
      expect(contents).toContain("analysisMode");
      expect(contents).toContain("saving");
      expect(contents).toContain("if (savingRef.current) return;");
      expect(contents).toContain("savingRef.current = true;");
      expect(contents).toMatch(
        /disabled=\{[^}]*saving[^}]*templatesLoading/u
      );
    }
  );
});
