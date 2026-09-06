const {
  buildSourceBlockLedger,
} = require("../../utils/policyAnalysis/sourceBlockLedger");
const {
  LfReferenceProfileRequiredError,
  validateLfReferenceFamily,
} = require("../../utils/policyComparison/lfReferenceFamilyContract");

function artifact({ fingerprint, text }) {
  return {
    schemaVersion: 1,
    fingerprint,
    document: {
      id: fingerprint,
      sourceDocumentId: fingerprint,
      pageContent: `[DOCUMENT_PAGE 1]\n${text}`,
      pageMap: [{ pageNumber: 1, start: 18, end: 18 + text.length }],
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
        complete: true,
      },
    },
  };
}

function contractFor(ledger, anchors) {
  return {
    schemaVersion: 1,
    contractId: "LF_TEST_FAMILY_V1",
    familyId: "LF_TEST",
    semanticOracleId: "LF_TEST_ORACLE_V1",
    expectedPhysicalPages: 1,
    expectedStructureDigestSha256: ledger.structureDigestSha256,
    requiredNormalizedAnchors: anchors,
  };
}

describe("LF reference family contract", () => {
  test("accepts a real value edit when wording and structure remain compatible", () => {
    const firstArtifact = artifact({
      fingerprint: "1".repeat(64),
      text: "LF IMMO EXKLUSIVSCHUTZ 2023\nLimit 15 % der Summe\n",
    });
    const secondArtifact = artifact({
      fingerprint: "2".repeat(64),
      text: "LF IMMO EXKLUSIVSCHUTZ 2024\nLimit 20 % der Summe\n",
    });
    const firstLedger = buildSourceBlockLedger(firstArtifact);
    const secondLedger = buildSourceBlockLedger(secondArtifact);
    const contract = contractFor(firstLedger, [
      "lf immo exklusivschutz <NUMBER>",
    ]);
    expect(
      validateLfReferenceFamily({
        documentArtifact: secondArtifact,
        ledger: secondLedger,
        contract,
      })
    ).toMatchObject({
      status: "SUPPORTED_LF_FAMILY_STRUCTURE",
      sourceDeclaredVersion: "2024",
      versionStatus: "SOURCE_DECLARED",
    });
  });

  test.each([
    ["changed wording", "LF IMMO EXKLUSIVSCHUTZ 2023\nSelbstbehalt 15 % der Summe\n"],
    ["missing anchor", "Anderes Produkt 2023\nLimit 15 % der Summe\n"],
    ["added operative line", "LF IMMO EXKLUSIVSCHUTZ 2023\nLimit 15 % der Summe\nNeue Klausel\n"],
  ])("requires a new profile for %s", (_label, changedText) => {
    const sourceArtifact = artifact({
      fingerprint: "3".repeat(64),
      text: "LF IMMO EXKLUSIVSCHUTZ 2023\nLimit 15 % der Summe\n",
    });
    const sourceLedger = buildSourceBlockLedger(sourceArtifact);
    const changedArtifact = artifact({
      fingerprint: "4".repeat(64),
      text: changedText,
    });
    expect(() =>
      validateLfReferenceFamily({
        documentArtifact: changedArtifact,
        contract: contractFor(sourceLedger, [
          "lf immo exklusivschutz <NUMBER>",
        ]),
      })
    ).toThrow(LfReferenceProfileRequiredError);
  });

  test("rejects a valid self-consistent ledger from a different document", () => {
    const sourceArtifact = artifact({
      fingerprint: "5".repeat(64),
      text: "LF IMMO EXKLUSIVSCHUTZ 2023\nLimit 15 % der Summe\n",
    });
    const otherArtifact = artifact({
      fingerprint: "6".repeat(64),
      text: "FREMDES PRODUKT 2023\nLimit 15 % der Summe\n",
    });
    const sourceLedger = buildSourceBlockLedger(sourceArtifact);
    expect(() =>
      validateLfReferenceFamily({
        documentArtifact: otherArtifact,
        ledger: buildSourceBlockLedger(otherArtifact),
        contract: contractFor(sourceLedger, [
          "lf immo exklusivschutz <NUMBER>",
        ]),
      })
    ).toThrow("NEUES_LF_PROFIL_ERFORDERLICH");
  });
});
