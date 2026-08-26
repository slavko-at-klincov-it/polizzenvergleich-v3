const {
  alphabeticContextLabel,
  formatContextBlock,
} = require("../../../../utils/AiProviders/lmStudio");

describe("LM Studio context block labels", () => {
  test("uses non-numeric transport labels for page-aware PDF chunks", () => {
    const block = formatContextBlock(
      "physicalPdfPage: 24\ncitationLabel: policy.pdf — physische PDF-Seite 24",
      17
    );

    expect(block).toContain("[PDF SOURCE BLOCK R - TRANSPORT LABEL ONLY]");
    expect(block).toContain("physicalPdfPage: 24");
    expect(block).not.toContain("[CONTEXT 17]");
  });

  test("keeps the existing wrapper for ordinary non-PDF context", () => {
    expect(formatContextBlock("ordinary knowledge", 2)).toBe(
      "[CONTEXT 2]:\nordinary knowledge\n[END CONTEXT 2]\n\n"
    );
  });

  test("creates deterministic alphabetic labels beyond Z", () => {
    expect(alphabeticContextLabel(0)).toBe("A");
    expect(alphabeticContextLabel(25)).toBe("Z");
    expect(alphabeticContextLabel(26)).toBe("AA");
  });
});
