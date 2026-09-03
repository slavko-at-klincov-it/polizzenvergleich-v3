const fs = require("fs");
const path = require("path");
const {
  COUNTERPART_STATUS,
  bindReferenceEvidence,
  jsonFromModelText,
  selectCandidates,
  splitPageIntoChunks,
  validateCatalog,
  validateModelResults,
} = require("../../../utils/policyAnalysis/lfReferenceCounterpartPilot");

const CATALOG_FILE = path.join(
  __dirname,
  "../../../resources/policyAnalysis/lf-immo-reference-counterpart-pilot.v0.1.json"
);

function minimalCatalog() {
  return validateCatalog({
    schemaVersion: 1,
    contractId: "LF_IMMO_REFERENCE_COUNTERPART_PILOT_TEST_V1",
    qaOnly: true,
    sourceProduct: {
      productId: "LF_TEST",
      version: "2023",
      documentSha256: "a".repeat(64),
      physicalPages: 1,
      role: "REFERENCE_PRODUCT",
    },
    comparisonPolicy: {
      direction: "REFERENCE_TO_COUNTERPART",
      noMatchMeaning: "NO_COUNTERPART_IN_RETRIEVED_CANDIDATES",
      missingIsExclusion: false,
      allowMultipleDocuments: true,
      requireSourceCandidateIds: true,
      productionRule: false,
    },
    categories: [
      {
        id: "LF-T",
        label: "Testkategorie",
        requirements: [
          {
            id: "LF-T-01",
            label: "Rohrersatz",
            factRole: "LENGTH_LIMIT",
            reference: { page: 1, needle: "Rohrersatz bis zu 3m Länge" },
            query: "Welche Rohrersatzlänge gilt?",
            aliases: ["Rohrersatz", "3m"],
            pilot: true,
          },
        ],
      },
    ],
  });
}

function sourceArtifact(text = "Versichert ist der Rohrersatz bis zu 3m Länge.") {
  return {
    schemaVersion: 1,
    fingerprint: "a".repeat(64),
    document: {
      sourceDocumentId: "a".repeat(64),
      pageContent: text,
      pageMap: [{ pageNumber: 1, start: 0, end: text.length }],
      pdfExtraction: {
        complete: true,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
      },
    },
  };
}

describe("lfReferenceCounterpartPilot", () => {
  test("keeps the checked-in LF catalog QA-only and bound to the exact 31-page source", () => {
    const catalog = validateCatalog(JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8")));
    const requirements = catalog.categories.flatMap(({ requirements }) => requirements);

    expect(catalog).toMatchObject({
      contractId: "LF_IMMO_REFERENCE_COUNTERPART_PILOT_V1",
      qaOnly: true,
      sourceProduct: {
        documentSha256:
          "2f1be7924ccda069a3fe197da30fc15d393dc3efb34d115ca6cad9dcb7ee9d62",
        physicalPages: 31,
      },
      comparisonPolicy: {
        missingIsExclusion: false,
        productionRule: false,
        requireSourceCandidateIds: true,
      },
    });
    expect(catalog.categories).toHaveLength(10);
    expect(requirements).toHaveLength(35);
    expect(requirements.every(({ pilot }) => pilot)).toBe(true);
  });

  test("binds every LF reference point to source-page text and fails on drift", () => {
    const catalog = minimalCatalog();

    expect(bindReferenceEvidence(catalog, sourceArtifact()).get("LF-T-01")).toMatchObject({
      physicalPageNumber: 1,
      exactNeedle: "Rohrersatz bis zu 3m Länge",
    });
    expect(() => bindReferenceEvidence(catalog, sourceArtifact("Anderer Inhalt"))).toThrow(
      "LF_REFERENCE_NEEDLE_NOT_FOUND: LF-T-01"
    );
    const wrongSource = sourceArtifact();
    wrongSource.fingerprint = "b".repeat(64);
    expect(() => bindReferenceEvidence(catalog, wrongSource)).toThrow(
      "LF_REFERENCE_SOURCE_ARTIFACT_MISMATCH"
    );
  });

  test("creates page-bound candidates and combines lexical with semantic retrieval", () => {
    const requirement = minimalCatalog().categories[0].requirements[0];
    const chunks = [
      ...splitPageIntoChunks({
        documentUuid: "11111111-1111-1111-1111-111111111111",
        documentName: "Bedingungen A.pdf",
        pageNumber: 7,
        text: "Der Rohrersatz ist bis zu sechs Metern versichert.",
      }),
      ...splitPageIntoChunks({
        documentUuid: "22222222-2222-2222-2222-222222222222",
        documentName: "Bedingungen B.pdf",
        pageNumber: 3,
        text: "Semantisch passender Text ohne Alias.",
      }),
    ];
    const selected = selectCandidates({
      requirement,
      chunks,
      queryEmbedding: [1, 0],
      chunkEmbeddings: [
        [0.5, 0.5],
        [1, 0],
      ],
      topK: 2,
    });

    expect(selected).toHaveLength(2);
    expect(selected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentName: "Bedingungen A.pdf" }),
        expect.objectContaining({ documentName: "Bedingungen B.pdf" }),
      ])
    );
    expect(selected.every(({ candidateId }) => candidateId.startsWith("B-"))).toBe(true);
  });

  test("accepts only mutually valid status/source combinations", () => {
    const requirement = minimalCatalog().categories[0].requirements[0];
    const candidates = new Map([
      [
        requirement.id,
        [
          {
            candidateId: "B-11111111-P001-00000",
          },
        ],
      ],
    ]);

    expect(
      validateModelResults(
        [
          {
            requirementId: requirement.id,
            status: COUNTERPART_STATUS.NONE,
            candidateIds: [],
            matchSummary: "In den Kandidaten wurde kein Gegenstück gefunden.",
            unresolved: "Das vollständige Paket ist damit nicht negativ bewiesen.",
          },
        ],
        [requirement],
        candidates
      )
    ).toEqual([
      expect.objectContaining({
        requirementId: requirement.id,
        status: "NO_COUNTERPART_IN_CANDIDATES",
        candidateIds: [],
      }),
    ]);

    expect(() =>
      validateModelResults(
        [
          {
            requirementId: requirement.id,
            status: COUNTERPART_STATUS.DIRECT,
            candidateIds: [],
            matchSummary: "Direktes Gegenstück.",
            unresolved: "",
          },
        ],
        [requirement],
        candidates
      )
    ).toThrow("LF_REFERENCE_MODEL_MATCH_WITHOUT_SOURCE: LF-T-01");
    expect(() =>
      validateModelResults(
        [
          {
            requirementId: requirement.id,
            status: COUNTERPART_STATUS.RELATED,
            candidateIds: ["B-erfunden-P999-00000"],
            matchSummary: "Thematisch ähnlich.",
            unresolved: "",
          },
        ],
        [requirement],
        candidates
      )
    ).toThrow("LF_REFERENCE_MODEL_CANDIDATE_ID_UNKNOWN: LF-T-01");
  });

  test("extracts a JSON array from fenced model output", () => {
    expect(jsonFromModelText("<think>intern</think>\n```json\n[{\"ok\":true}]\n```"))
      .toEqual([{ ok: true }]);
  });
});
