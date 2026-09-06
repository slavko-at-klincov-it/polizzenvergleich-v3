const fs = require("fs");
const path = require("path");
const {
  POLICY_COMPARISON_MODE,
  policyComparisonMode,
} = require("../../utils/policyComparison/modes");

const PANEL = path.resolve(
  __dirname,
  "../../../frontend/src/components/WorkspaceChat/ChatContainer/PolicyComparisonPanel/index.jsx"
);

describe("LF comparison UI truth contract", () => {
  const source = fs.readFileSync(PANEL, "utf8");

  test("describes the curated topology and the runtime binding to source A", () => {
    const mode = policyComparisonMode(
      POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B
    );

    expect(mode.description).toContain("kuratierte LF-Fachprofil");
    expect(source).toContain("283 Zeilen, 13 Kategorien");
    expect(source).toContain("Abweichende oder fehlende Struktur stoppt den Lauf");
    expect(source).toContain("LF-Profil an A binden und B prüfen");
  });

  test("does not claim that source A freely discovers the result topology", () => {
    expect(source).not.toContain(
      "Dokument A bestimmt Kategorien, Unterkategorien, fachliche Zeilen"
    );
    expect(source).not.toContain("LF-Vorlage aus Dokument A wird erstellt");
  });
});
