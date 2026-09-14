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
const PRESENTER = path.resolve(
  __dirname,
  "../../../frontend/src/utils/chat/policyComparisonResultPresenter.cjs"
);

describe("LF comparison UI truth contract", () => {
  const source = fs.readFileSync(PANEL, "utf8");
  const presenterSource = fs.readFileSync(PRESENTER, "utf8");

  test("describes the dynamic topology owned by reference package A", () => {
    const mode = policyComparisonMode(
      POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B
    );

    expect(mode.description).toContain("dynamisch und vollständig");
    expect(source).toContain(
      "Das Referenzpaket A bestimmt bei jedem Lauf dynamisch Kategorien, Reihenfolge und alle fachlich relevanten Ergebniszeilen"
    );
    expect(source).toContain("B-only-Inhalte erzeugen keine Zeile");
    expect(source).toContain("A dynamisch erfassen und B prüfen");
  });

  test("does not expose the historical fixed LF topology as the product contract", () => {
    const mode = policyComparisonMode(
      POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B
    );

    expect(mode.description).not.toContain("kuratierte LF-Fachprofil");
    expect(source).not.toContain("283 Zeilen, 13 Kategorien");
    expect(source).not.toContain(
      "Abweichende oder fehlende Struktur stoppt den Lauf"
    );
  });

  test("shows only binary counterpart search states and keeps technical outcomes out of the LF status cell", () => {
    expect(source).toContain("presentLfSearchStatus");
    expect(presenterSource).toContain('GEFUNDEN: "Gefunden"');
    expect(presenterSource).toContain('NICHT_GEFUNDEN: "Nicht gefunden"');
    expect(source).toContain("Fachlicher Hinweis:");
    expect(source).toContain("binaryReferencePresentation");
    expect(source).toContain("showReviewStatus={!binaryReferencePresentation}");
    expect(source).toContain("!binaryReferencePresentation && (");
    expect(source).toContain("Technisch: {row.outcome}");
  });
});
