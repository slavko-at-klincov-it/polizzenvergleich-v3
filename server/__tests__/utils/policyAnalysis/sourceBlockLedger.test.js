const {
  buildSourceBlockLedger,
  canonicalSourceBlockLedgerBytes,
  normalizeStructuralText,
  validateSourceBlockLedger,
} = require("../../../utils/policyAnalysis/sourceBlockLedger");

function artifact({ fingerprint = "a".repeat(64), pages } = {}) {
  const chunks = [];
  const pageMap = [];
  for (const [index, page] of pages.entries()) {
    const marker = `[DOCUMENT_PAGE ${index + 1}]\n`;
    chunks.push(marker);
    const start = chunks.join("").length;
    chunks.push(page);
    pageMap.push({ pageNumber: index + 1, start, end: start + page.length });
    if (index < pages.length - 1) chunks.push("\n\n");
  }
  return {
    schemaVersion: 1,
    fingerprint,
    document: {
      id: fingerprint,
      sourceDocumentId: fingerprint,
      pageContent: chunks.join(""),
      pageMap,
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: pages.length,
        processedPages: pages.length,
        pagesWithText: pages.filter((page) => /\S/u.test(page)).length,
        complete: true,
      },
    },
  };
}

describe("SourceBlockLedger V1", () => {
  test("regenerates byte-identically and partitions every non-empty source line", () => {
    const input = artifact({
      pages: [
        "Seite 1\n1. Deckung\n• Versichert sind\n- Objekt A\n",
        "Seite 2\r\nFortsetzung mit 15 % und EUR 500,-\r\n",
      ],
    });
    const first = buildSourceBlockLedger(input);
    const second = buildSourceBlockLedger(JSON.parse(JSON.stringify(input)));
    expect(canonicalSourceBlockLedgerBytes(first)).toBe(
      canonicalSourceBlockLedgerBytes(second)
    );
    expect(first.pages).toHaveLength(2);
    expect(first.blocks.map(({ exactText }) => exactText)).toEqual([
      "Seite 1",
      "1. Deckung",
      "• Versichert sind",
      "- Objekt A",
      "Seite 2",
      "Fortsetzung mit 15 % und EUR 500,-",
    ]);
    expect(first.blocks.every((block, index) => block.ordinal === index)).toBe(
      true
    );
    expect(validateSourceBlockLedger(first, input)).toBe(first);
  });

  test("keeps source inventory separate from semantic and customer contracts", () => {
    const ledger = buildSourceBlockLedger(
      artifact({ pages: ["Seite 1\nDeckungsinhalt\n"] })
    );
    expect(ledger.segmentationContract).toMatchObject({
      semanticAuthority: false,
      customerRows: false,
      absenceDecisions: false,
    });
    const serialized = JSON.stringify(ledger);
    for (const forbidden of [
      "factRole",
      "components",
      "aliases",
      "requestedFields",
      "coverageEffect",
      "negativeSearchPolicy",
      "pointDecision",
    ])
      expect(serialized).not.toContain(forbidden);
  });

  test("normalizes actual value changes but keeps wording changes visible", () => {
    expect(normalizeStructuralText("Limit 15 % und EUR 500,-")).toBe(
      normalizeStructuralText("Limit 20 % und EUR 750,-")
    );
    expect(normalizeStructuralText("Limit 15 % der Summe")).not.toBe(
      normalizeStructuralText("Selbstbehalt 15 % der Summe")
    );
  });

  test("rejects tampering even when an attacker recomputes a self-consistent digest", () => {
    const input = artifact({ pages: ["Seite 1\nErste Zeile\nZweite Zeile\n"] });
    const ledger = buildSourceBlockLedger(input);
    const tampered = JSON.parse(JSON.stringify(ledger));
    tampered.blocks.splice(1, 1);
    tampered.summary.blockCount -= 1;
    tampered.ledgerSha256 = "b".repeat(64);
    expect(() => validateSourceBlockLedger(tampered, input)).toThrow(
      "SOURCE_BLOCK_LEDGER_REBUILD_MISMATCH"
    );
  });

  test.each([
    ["incomplete extraction", (input) => (input.document.pdfExtraction.complete = false)],
    ["overlapping pages", (input) => (input.document.pageMap[1].start = 1)],
    ["missing page", (input) => (input.document.pageMap[1].pageNumber = 3)],
    ["unexplained gap", (input) => (input.document.pageContent = `X${input.document.pageContent}`)],
  ])("fails closed for %s", (_label, mutate) => {
    const input = artifact({ pages: ["Seite 1\nA\n", "Seite 2\nB\n"] });
    mutate(input);
    expect(() => buildSourceBlockLedger(input)).toThrow(
      /SOURCE_BLOCK_LEDGER_/u
    );
  });

  test("changes exact ledger identity while preserving compatible structure for a value edit", () => {
    const first = buildSourceBlockLedger(
      artifact({ fingerprint: "1".repeat(64), pages: ["Seite 1\nLimit 15 %\n"] })
    );
    const second = buildSourceBlockLedger(
      artifact({ fingerprint: "2".repeat(64), pages: ["Seite 1\nLimit 20 %\n"] })
    );
    expect(first.ledgerSha256).not.toBe(second.ledgerSha256);
    expect(first.structureDigestSha256).toBe(second.structureDigestSha256);
  });
});
