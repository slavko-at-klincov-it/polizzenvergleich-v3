const {
  buildSourceBlockLedger,
} = require("../../utils/policyAnalysis/sourceBlockLedger");
const {
  buildLfSemanticRequirementManifest,
  validateLfSemanticRequirementManifest,
} = require("../../utils/policyComparison/lfSemanticRequirementManifest");

function artifact(pages) {
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
  const fingerprint = "a".repeat(64);
  return {
    schemaVersion: 1,
    fingerprint,
    document: {
      sourceDocumentId: fingerprint,
      pageContent: chunks.join(""),
      pageMap,
      pdfExtraction: {
        schemaVersion: 1,
        complete: true,
        totalPages: pages.length,
        processedPages: pages.length,
        pagesWithText: pages.length,
      },
    },
  };
}

function fixture() {
  const documentArtifact = artifact([
    "Seite 1\nFeuerversicherung\nNeubauwert mit Limit 15 % der Versicherungssumme\nUnkartierter Fließtext\n",
  ]);
  const ledger = buildSourceBlockLedger(documentArtifact);
  const oracle = {
    oracleId: "TEST_ORACLE_V1",
    requirements: [
      {
        id: "FE-01",
        categoryId: "FE",
        categoryLabel: "Feuerversicherung",
        subcategoryId: "FE-WERT",
        subcategoryLabel: "Wert",
        label: "Neubauwert und Prozentlimit",
        pages: [1],
        anchors: ["Neubauwert", "15 % der Versicherungssumme"],
        components: [
          {
            id: "valuation",
            label: "Neubauwert",
            factRole: "VALUATION",
            aliases: ["Neuwert"],
          },
          {
            id: "limit",
            label: "Prozentlimit",
            factRole: "LIMIT",
            aliases: ["Prozentlimit"],
            requestedFields: ["limit"],
            valueBinding: {
              type: "PERCENT",
              basisLabel: "Versicherungssumme",
            },
          },
        ],
        searchPlanStatus: "EXPLORATORY",
      },
    ],
  };
  const familyContract = {
    schemaVersion: 1,
    contractId: "TEST_FAMILY_V1",
    familyId: "TEST",
    semanticOracleId: oracle.oracleId,
    expectedPhysicalPages: 1,
    expectedStructureDigestSha256: ledger.structureDigestSha256,
    requiredNormalizedAnchors: ["feuerversicherung"],
  };
  return { documentArtifact, oracle, familyContract };
}

describe("LF SemanticRequirementManifest V1", () => {
  test("materializes ordered source-bound requirements without turning raw lines into rows", () => {
    const input = fixture();
    const manifest = buildLfSemanticRequirementManifest(input);
    expect(manifest.requirements).toHaveLength(1);
    expect(manifest.categories[0].subcategories[0].requirementIds).toEqual([
      "FE-01",
    ]);
    expect(manifest.requirements[0]).toMatchObject({
      sourceOrder: 0,
      searchPlanStatus: "EXPLORATORY_INCOMPLETE",
      atomizationStatus: "SOURCE_BOUND_TYPED",
    });
    expect(manifest.requirements[0].components[0].factRole).toBe("CONDITION");
    expect(manifest.summary.sourceBlocks).toBe(4);
    expect(manifest.summary.semanticRequirements).toBe(1);
    expect(manifest.summary.reviewRequiredBlocks).toBe(1);
    expect(manifest.blockCrosswalk).toHaveLength(manifest.summary.sourceBlocks);
    expect(new Set(manifest.blockCrosswalk.map(({ blockId }) => blockId)).size).toBe(
      manifest.summary.sourceBlocks
    );
  });

  test("binds percentages and their declared basis but never invents an amount", () => {
    const manifest = buildLfSemanticRequirementManifest(fixture());
    const percent = manifest.requirements[0].values.find(
      ({ type }) => type === "PERCENT"
    );
    expect(percent).toMatchObject({
      rawValue: "15 %",
      basis: {
        status: "SEMANTIC_ORACLE_DECLARED",
        label: "Versicherungssumme",
      },
      calculatedAmount: null,
    });
  });

  test("regenerates on readback and rejects a rehashed semantic mutation", () => {
    const input = fixture();
    const manifest = buildLfSemanticRequirementManifest(input);
    expect(validateLfSemanticRequirementManifest(manifest, input)).toBe(
      manifest
    );
    const tampered = JSON.parse(JSON.stringify(manifest));
    tampered.requirements[0].displayLabel = "Andere Aussage";
    tampered.manifestSha256 = "b".repeat(64);
    expect(() =>
      validateLfSemanticRequirementManifest(tampered, input)
    ).toThrow("LF_SEMANTIC_REQUIREMENT_MANIFEST_REBUILD_MISMATCH");
  });

  test("fails closed when an operative anchor is missing", () => {
    const input = fixture();
    input.oracle.requirements[0].anchors = ["Nicht vorhandene Deckung"];
    expect(() => buildLfSemanticRequirementManifest(input)).toThrow(
      "NEUES_LF_PROFIL_ERFORDERLICH:ANCHOR_NOT_FOUND"
    );
  });
});
