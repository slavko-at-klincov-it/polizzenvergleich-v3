const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  bm25Index,
  buildStructuralSpans,
  componentQuery,
  fuseCandidateChannels,
  inventoryLfReferenceRun,
  rankEmbeddingCandidates,
  rankLexicalCandidates,
  sha256,
} = require("../../../utils/policyAnalysis/lfReferenceDiscoveryBenchmark");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function documentArtifact(fingerprint, text) {
  return {
    schemaVersion: 1,
    fingerprint,
    document: {
      id: fingerprint,
      sourceDocumentId: fingerprint,
      title: `${fingerprint}.pdf`,
      pageContent: text,
      pageMap: [{ pageNumber: 1, start: 0, end: text.length }],
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

function component(id, occurrences = []) {
  return {
    id,
    label: id === "coverage" ? "Feuerschäden" : "Gebäude",
    factRole: "COVERAGE",
    contextMode: "STRUCTURAL",
    aliases: id === "coverage" ? ["Brand"] : ["Bauwerk"],
    terminalState:
      occurrences.length > 0
        ? "CONTROLLED_CANDIDATES_FOUND"
        : "NO_CONTROLLED_CANDIDATE",
    occurrenceCount: occurrences.length,
    occurrences,
  };
}

function worksheet(fingerprint, coverageOccurrences = []) {
  return {
    schemaVersion: 2,
    candidateOnly: true,
    catalog: { schemaVersion: 1, id: "lr01", categoryView: "LR01" },
    document: { fingerprint, title: `${fingerprint}.pdf` },
    summary: {},
    bindingGroups: [],
    requirements: [
      {
        id: "LR01-001",
        label: "Feuer am Gebäude",
        components: [component("coverage")],
      },
      {
        id: "LR01-002",
        label: "Feuer und Objekt",
        components: [
          component("coverage", coverageOccurrences),
          component("object"),
        ],
      },
      {
        id: "LR01-003",
        label: "Unklare Referenz",
        components: [component("reference")],
      },
      {
        id: "LR01-004",
        label: "Bestehender öffentlicher Fund",
        components: [component("coverage", coverageOccurrences)],
      },
    ],
  };
}

function buildRunFixture(root) {
  const mode = "LF_IMMO_REFERENCE_A_TO_B_V1";
  const semanticHash = "d".repeat(64);
  const a = { uuid: "a", side: "A", position: 0, sha256: "a".repeat(64) };
  const b1 = {
    uuid: "b1",
    side: "B",
    position: 0,
    originalName: "b1.pdf",
    sha256: "b".repeat(64),
  };
  const b2 = {
    uuid: "b2",
    side: "B",
    position: 1,
    originalName: "b2.pdf",
    sha256: "c".repeat(64),
  };
  const text1 = "Feuerschäden am Gebäude sind versichert.";
  const text2 = "Leitungswasser ist versichert.";
  const occurrence = {
    candidateId: "candidate:current",
    discoveryMethod: "EXACT_ALIAS",
    pageNumber: 1,
    physicalPageNumber: 1,
    pageStart: 0,
    pageEnd: 12,
    documentStart: 0,
    documentEnd: 12,
    exactText: text1.slice(0, 12),
  };
  const rows = [
    {
      categoryId: "PR-01",
      analysisRowId: "LR01-001",
      categoryName: "Feuer",
      subcategoryName: "Gebäude",
      sourceOrder: 0,
      packageA: { documentedContent: "Feuer am Gebäude" },
      packageB: { documentedContent: "", source: "", contributors: [] },
      outcome: "GEGENSTUECK_UNKLAR",
      pointDecision: { outcome: "GEGENSTUECK_UNKLAR" },
    },
    {
      categoryId: "PR-02",
      analysisRowId: "LR01-002",
      categoryName: "Feuer",
      subcategoryName: "Gebäude",
      sourceOrder: 1,
      packageA: { documentedContent: "Feuer und Objekt" },
      packageB: { documentedContent: "", source: "", contributors: [] },
      outcome: "GEGENSTUECK_UNKLAR",
      pointDecision: { outcome: "GEGENSTUECK_UNKLAR" },
    },
    {
      categoryId: "PR-03",
      analysisRowId: "LR01-003",
      categoryName: "Referenz",
      subcategoryName: "Unklar",
      sourceOrder: 2,
      packageA: { documentedContent: "" },
      packageB: { documentedContent: "", source: "", contributors: [] },
      outcome: "REFERENZZEILE_UNKLAR",
      pointDecision: { outcome: "REFERENZZEILE_UNKLAR" },
    },
    {
      categoryId: "PR-04",
      analysisRowId: "LR01-004",
      categoryName: "Bestehender Fund",
      subcategoryName: "Kontrolle",
      sourceOrder: 3,
      packageA: { documentedContent: "Feuer am Gebäude" },
      packageB: {
        documentedContent: "Feuerschäden sind versichert",
        source: "PDF-Seite 1",
        contributors: [
          {
            documentUuid: b1.uuid,
            source: "PDF-Seite 1: Feuerschäden",
          },
        ],
      },
      outcome: "GEGENSTUECK_GEFUNDEN",
      pointDecision: { outcome: "GEGENSTUECK_GEFUNDEN" },
    },
  ];
  const comparison = {
    schemaVersion: 1,
    contractId: "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1",
    comparisonMode: mode,
    runSignature: "fixture-run",
    template: { semanticRequirementManifestSha256: semanticHash },
    documents: [a, b1, b2],
    categories: [{ categoryView: "PR", categoryName: "Präambel", rows }],
  };
  const comparisonFile = path.join(root, "result", "comparison.private.json");
  writeJson(comparisonFile, comparison);
  writeJson(path.join(root, "input-manifest.private.json"), {
    comparisonMode: mode,
    documents: [a, b1, b2],
  });
  writeJson(path.join(root, "run-contract.private.json"), {
    releaseId: "fixture-release",
    comparisonMode: mode,
    productProfile: { noEmbeddings: true },
    documents: [a, b1, b2],
  });
  writeJson(
    path.join(
      root,
      "reference-template",
      "semantic-requirement-manifest.private.json"
    ),
    { manifestSha256: semanticHash }
  );
  writeJson(
    path.join(root, "reference-template", "artifact-set-manifest.private.json"),
    { semanticRequirementManifestSha256: semanticHash }
  );
  writeJson(path.join(root, "result", "artifact-set-manifest.private.json"), {
    artifacts: [
      {
        filename: "comparison.private.json",
        sha256: sha256(fs.readFileSync(comparisonFile)),
      },
    ],
  });
  for (const [document, text, current] of [
    [b1, text1, [occurrence]],
    [b2, text2, []],
  ]) {
    const directory = path.join(
      root,
      "documents",
      `B-${String(document.position + 1).padStart(2, "0")}-${document.uuid}`
    );
    writeJson(
      path.join(directory, "document.private.json"),
      documentArtifact(document.sha256, text)
    );
    writeJson(
      path.join(directory, "LR01", "worksheet.private.json"),
      worksheet(document.sha256, current)
    );
  }
}

describe("lfReferenceDiscoveryBenchmark", () => {
  test("inventories the binary not-found package at row, component and document-cell level", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lf-discovery-run-"));
    try {
      buildRunFixture(root);
      const inventory = inventoryLfReferenceRun({ runRoot: root });

      expect(inventory.summary).toMatchObject({
        allReferenceRows: 4,
        publicFoundRows: 1,
        publicNotFoundRows: 3,
        referenceUnclearRows: 1,
        notFoundSideBRows: 2,
        pureNullRows: 1,
        rowsWithCurrentCandidates: 1,
        allPureNullRows: 2,
        allRowsWithCurrentCandidates: 2,
        bDocumentCount: 2,
        uniqueComponentTargets: 5,
        componentDocumentCells: 10,
        currentNullCells: 8,
        currentPositiveCells: 2,
        currentOccurrenceCount: 2,
      });
      expect(inventory.rowSets.publicFound).toEqual(["PR-04"]);
      expect(inventory.rowSets.pureNull).toEqual(["PR-01"]);
      expect(inventory.rowSets.withCurrentCandidates).toEqual(["PR-02"]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("builds one deterministic component query without source-answer leakage", () => {
    const query = componentQuery({
      row: { categoryName: "Feuer", subcategoryName: "Gebäude" },
      requirement: { label: "Feuer am Gebäude" },
      component: component("coverage"),
    });

    expect(query.query).toContain("Feuerschäden");
    expect(query.query).toContain("Brand");
    expect(query.querySha256).toHaveLength(64);
    expect(query.queryTokens).toEqual(
      expect.arrayContaining(["feuer", "gebaude", "brand"])
    );
  });

  test("ranks lexical candidates with BM25-like term and phrase evidence", () => {
    const target = {
      query: "Feuerschäden am Gebäude",
      queryTokens: ["feuerschaden", "gebaude"],
      phrases: ["feuerschaden am gebaude"],
    };
    const candidates = [
      {
        id: "unrelated",
        documentStart: 50,
        documentEnd: 80,
        text: "Leitungswasserschäden an Rohren",
        exactText: "Leitungswasserschäden an Rohren",
      },
      {
        id: "match",
        documentStart: 0,
        documentEnd: 40,
        text: "Feuerschäden am Gebäude sind versichert",
        exactText: "Feuerschäden am Gebäude sind versichert",
      },
    ];

    expect(
      rankLexicalCandidates({
        target,
        candidates,
        index: bm25Index(candidates),
      })[0].id
    ).toBe("match");
  });

  test("ranks Dinghy candidates independently per component-document cell", () => {
    const candidates = [
      { id: "semantic", documentStart: 0, documentEnd: 10 },
      { id: "other", documentStart: 20, documentEnd: 30 },
    ];
    const ranked = rankEmbeddingCandidates({
      target: { querySha256: "a".repeat(64) },
      targetVector: [1, 0],
      candidates,
      candidateVectors: [
        [0.9, 0.1],
        [0, 1],
      ],
      topK: 1,
      minimumScore: 0,
    });

    expect(ranked).toEqual([
      expect.objectContaining({
        id: "semantic",
        rank: 1,
        targetQuerySha256: "a".repeat(64),
      }),
    ]);
  });

  test("keeps structural units exact and unions identical spans with channel provenance", () => {
    const text = "Feuerversicherung\n- Gebäude sind versichert\n- Inhalt folgt";
    const document = documentArtifact("f".repeat(64), text).document;
    const structural = buildStructuralSpans(document);
    expect(structural.length).toBeGreaterThan(3);
    for (const span of structural)
      expect(
        document.pageContent.slice(span.documentStart, span.documentEnd)
      ).toBe(span.exactText);

    const shared = structural[0];
    const union = fuseCandidateChannels(
      {
        CURRENT: [{ ...shared, rank: null, score: null }],
        STRUCTURAL: [{ ...shared, rank: 1, score: 2 }],
        DINGHY: [],
      },
      {
        analysisRowId: "LR01-001",
        componentId: "coverage",
        documentUuid: "document-1",
        documentPosition: 0,
        documentFingerprint: "f".repeat(64),
      }
    );
    expect(union).toHaveLength(1);
    expect(union[0].channelTraces.map(({ channel }) => channel)).toEqual([
      "CURRENT",
      "STRUCTURAL",
    ]);
    expect(union[0]).toMatchObject({
      unionRank: 1,
      fusion: {
        method: "CHANNEL_RECIPROCAL_RANK_SUM_K60",
        channelCount: 2,
        bestRank: 1,
      },
    });
  });
});
