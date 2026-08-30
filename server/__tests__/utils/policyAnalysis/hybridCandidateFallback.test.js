const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  buildCandidateTriagePayload,
} = require("../../../utils/policyAnalysis/candidateTriageContract");
const {
  buildPageAwareRetrievalChunks,
  mergeHybridSelections,
  parseAndValidateHybridSelection,
  rankChunksForTargets,
  validateHybridFallbackCatalog,
} = require("../../../utils/policyAnalysis/hybridCandidateFallback");

function documentFromPages(pages) {
  let pageContent = "";
  const pageMap = pages.map((text, index) => {
    const start = pageContent.length;
    pageContent += text;
    const end = pageContent.length;
    if (index < pages.length - 1) pageContent += "\n";
    return { pageNumber: index + 1, start, end };
  });
  return {
    id: "hybrid-document",
    sourceDocumentId: "hybrid-document",
    title: "hybrid-document.pdf",
    documentType: "pdf",
    pageContent,
    pageMap,
    pdfExtraction: {
      schemaVersion: 1,
      totalPages: pages.length,
      processedPages: pages.length,
      pagesWithText: pages.filter(Boolean).length,
      complete: true,
    },
  };
}

function baseCatalog() {
  return {
    schemaVersion: 1,
    catalogId: "hybrid-hp-test",
    categoryView: "HP",
    requirements: [
      {
        id: "HP-12",
        label: "Umweltschäden nach dem Bundes-Umwelthaftungsgesetz",
        requestedFields: [],
        components: [
          {
            id: "environmental_damage",
            label: "Umweltschäden",
            factRole: "DAMAGE",
            aliases: ["Umweltschäden"],
          },
        ],
      },
    ],
  };
}

function fallbackCatalog(mode = "NO_CONTROLLED_CANDIDATE") {
  return {
    schemaVersion: 1,
    catalogId: "hybrid-hp-fallback-test",
    categoryView: "HP",
    targets: [
      {
        id: "HP-12:environmental-damage",
        requirementId: "HP-12",
        componentId: "environmental_damage",
        query:
          "Umwelthaftpflicht und Sanierungskosten nach Bundes-Umwelthaftungsgesetz",
        semanticContract:
          "Die Klausel regelt ausdrücklich Versicherungsschutz für Umweltschäden.",
        requiredQuotePrefixes: ["Umweltschad", "Sanierungsverpflicht"],
        mode,
        topK: 2,
      },
    ],
  };
}

describe("hybridCandidateFallback", () => {
  test("reuses page-aware 3000/250 chunks with exact source offsets", async () => {
    const document = documentFromPages([
      `HAFTPFLICHTVERSICHERUNG\n${"A".repeat(2_700)}\nUmwelthaftpflicht inklusive Sanierungskosten ist versichert.\n${"B".repeat(900)}`,
      "Zweite Seite ohne Treffer.",
    ]);
    const chunks = await buildPageAwareRetrievalChunks({ document });

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.some(({ text }) => text.includes("Umwelthaftpflicht"))).toBe(
      true
    );
    for (const chunk of chunks)
      expect(
        document.pageContent.slice(chunk.documentStart, chunk.documentEnd)
      ).toBe(chunk.text);
  });

  test("validates configured targets and only activates no-candidate mode when empty", () => {
    const document = documentFromPages([
      "HAFTPFLICHTVERSICHERUNG\nUmwelthaftpflicht ist vereinbart.",
    ]);
    const emptyWorksheet = buildControlledOccurrenceWorksheet({
      document,
      documentFingerprint: "hybrid-empty",
      catalog: baseCatalog(),
    });
    const emptyTarget = validateHybridFallbackCatalog({
      catalog: fallbackCatalog(),
      worksheet: emptyWorksheet,
    }).targets[0];
    expect(emptyTarget.eligible).toBe(true);

    const matchingWorksheet = buildControlledOccurrenceWorksheet({
      document: documentFromPages([
        "HAFTPFLICHTVERSICHERUNG\nUmweltschäden sind versichert.",
      ]),
      documentFingerprint: "hybrid-existing",
      catalog: baseCatalog(),
    });
    const existingTarget = validateHybridFallbackCatalog({
      catalog: fallbackCatalog(),
      worksheet: matchingWorksheet,
    }).targets[0];
    expect(existingTarget.eligible).toBe(false);
    expect(
      validateHybridFallbackCatalog({
        catalog: fallbackCatalog("ADDITIVE"),
        worksheet: matchingWorksheet,
      }).targets[0].eligible
    ).toBe(true);
  });

  test("ranks chunks only as a bounded candidate budget", () => {
    const targets = [{ id: "T1", topK: 2 }];
    const chunks = [
      { id: "C1", pageNumber: 1, pageStart: 0 },
      { id: "C2", pageNumber: 2, pageStart: 0 },
      { id: "C3", pageNumber: 3, pageStart: 0 },
    ];
    const [ranked] = rankChunksForTargets({
      targets,
      chunks,
      targetVectors: [[1, 0]],
      chunkVectors: [
        [0.5, 0.5],
        [1, 0],
        [0, 1],
      ],
    });

    expect(ranked.chunks.map(({ id }) => id)).toEqual(["C2", "C1"]);
    expect(ranked.chunks).toHaveLength(2);
  });

  test("accepts only exact unique spans and fails closed on invented quotes", () => {
    const target = {
      id: "T1",
      requirementId: "HP-12",
      componentId: "environmental_damage",
      chunks: [
        {
          id: "C1",
          text: "Versichert sind die Kosten der Sanierung von Umweltschäden.",
          score: 0.8,
          pageNumber: 1,
          documentStart: 100,
        },
      ],
    };
    const parsed = parseAndValidateHybridSelection({
      target,
      responseText: JSON.stringify({
        schemaVersion: 1,
        selections: [
          {
            chunkId: "C1",
            relation: "DIRECT_EXPLICIT",
            quote:
              "Versichert sind die Kosten der Sanierung von Umweltschäden.",
          },
        ],
      }),
    });
    expect(parsed.selections[0]).toMatchObject({
      documentStart: 100,
      documentEnd: 159,
      relation: "DIRECT_EXPLICIT",
    });

    expect(() =>
      parseAndValidateHybridSelection({
        target,
        responseText: JSON.stringify({
          schemaVersion: 1,
          selections: [
            {
              chunkId: "C1",
              relation: "DIRECT_EXPLICIT",
              quote: "Umweltschäden sind immer versichert.",
            },
          ],
        }),
      })
    ).toThrow("HYBRID_SELECTION_QUOTE_NOT_EXACT");

    const downgraded = parseAndValidateHybridSelection({
      target,
      invalidEvidencePolicy: "downgrade",
      responseText: JSON.stringify({
        schemaVersion: 1,
        selections: [
          {
            chunkId: "C1",
            relation: "DIRECT_EXPLICIT",
            quote: "Umweltschäden sind immer versichert.",
          },
        ],
      }),
    });
    expect(downgraded.selections[0]).toMatchObject({
      relation: "UNRESOLVED",
      quote: null,
      rejectedRelation: "DIRECT_EXPLICIT",
      rejectionCode: "HYBRID_SELECTION_QUOTE_NOT_EXACT",
    });
  });

  test("accepts complete unique chunk selections independent of model order", () => {
    const target = {
      id: "T1",
      requirementId: "HP-12",
      componentId: "environmental_damage",
      chunks: [
        {
          id: "C1",
          text: "Sanierungskosten sind versichert.",
          score: 0.8,
          pageNumber: 1,
          documentStart: 0,
        },
        {
          id: "C2",
          text: "Nur ein anderes Thema.",
          score: 0.7,
          pageNumber: 2,
          documentStart: 100,
        },
      ],
    };
    const parsed = parseAndValidateHybridSelection({
      target,
      responseText: JSON.stringify({
        schemaVersion: 1,
        selections: [
          { chunkId: "C2", relation: "RELATED_ONLY", quote: null },
          {
            chunkId: "C1",
            relation: "DIRECT_EXPLICIT",
            quote: "Sanierungskosten sind versichert.",
          },
        ],
      }),
    });

    expect(parsed.selections.map(({ chunkId }) => chunkId)).toEqual([
      "C1",
      "C2",
    ]);
  });

  test("downgrades an exact but target-unanchored model quote", () => {
    const target = {
      id: "T1",
      requirementId: "HP-12",
      componentId: "environmental_damage",
      requiredQuotePrefixes: ["umweltschad"],
      chunks: [
        {
          id: "C1",
          text: "Schäden aus Holzfäule und Baumängeln sind ausgeschlossen.",
          score: 0.9,
          pageNumber: 1,
          documentStart: 0,
        },
      ],
    };
    const parsed = parseAndValidateHybridSelection({
      target,
      invalidEvidencePolicy: "downgrade",
      responseText: JSON.stringify({
        schemaVersion: 1,
        selections: [
          {
            chunkId: "C1",
            relation: "DIRECT_EXPLICIT",
            quote: "Schäden aus Holzfäule und Baumängeln sind ausgeschlossen.",
          },
        ],
      }),
    });

    expect(parsed.selections[0]).toMatchObject({
      relation: "UNRESOLVED",
      quote: null,
      rejectionCode: "HYBRID_SELECTION_TARGET_ANCHOR_MISSING",
    });
  });

  test("merges an exact span but keeps it model-owned in normal triage", () => {
    const document = documentFromPages([
      [
        "HAFTPFLICHTVERSICHERUNG",
        "Umwelthaftpflicht inklusive Sanierungskostenversicherung ist mitversichert.",
      ].join("\n"),
    ]);
    const worksheet = buildControlledOccurrenceWorksheet({
      document,
      documentFingerprint: "hybrid-merge",
      catalog: baseCatalog(),
    });
    const quote =
      "Umwelthaftpflicht inklusive Sanierungskostenversicherung ist mitversichert.";
    const start = document.pageContent.indexOf(quote);
    const merged = mergeHybridSelections({
      worksheet,
      document,
      selections: [
        {
          targetId: "HP-12:environmental-damage",
          requirementId: "HP-12",
          componentId: "environmental_damage",
          semanticContract:
            "Die Klausel regelt Versicherungsschutz für Umweltschäden.",
          chunkId: "C1",
          relation: "DIRECT_EXPLICIT",
          quote,
          score: 0.82,
          pageNumber: 1,
          documentStart: start,
          documentEnd: start + quote.length,
        },
      ],
    });
    const occurrence =
      merged.worksheet.requirements[0].components[0].occurrences[0];
    expect(occurrence).toMatchObject({
      discoveryMethod: "HYBRID_CHUNK_SEMANTIC",
      hybridSemanticContract:
        "Die Klausel regelt Versicherungsschutz für Umweltschäden.",
      hybridRelation: "DIRECT_EXPLICIT",
      exactText: quote,
    });
    expect(
      document.pageContent.slice(
        occurrence.documentStart,
        occurrence.documentEnd
      )
    ).toBe(quote);

    const payload = buildCandidateTriagePayload(merged.worksheet);
    expect(payload.bindingTargets).toHaveLength(1);
    expect(payload.bindingTargets[0].modelDecisionFields).toEqual([
      "roleMatch",
      "scopeMatch",
    ]);
    expect(payload.bindingTargets[0].deterministicBindingBasis).toBeNull();
    expect(payload.bindingTargets[0].hybridSemanticContract).toBe(
      "Die Klausel regelt Versicherungsschutz für Umweltschäden."
    );
  });

  test("does not merge related-only or other-scope selections", () => {
    const document = documentFromPages([
      "HAFTPFLICHTVERSICHERUNG\nNicht versichert sind Schäden an Heizungsrohren.",
    ]);
    const worksheet = buildControlledOccurrenceWorksheet({
      document,
      documentFingerprint: "hybrid-negative",
      catalog: baseCatalog(),
    });
    const merged = mergeHybridSelections({
      worksheet,
      document,
      selections: [
        {
          targetId: "HP-12:environmental-damage",
          requirementId: "HP-12",
          componentId: "environmental_damage",
          chunkId: "C1",
          relation: "RELATED_ONLY",
          quote: null,
          score: 0.9,
          pageNumber: 1,
          documentStart: null,
          documentEnd: null,
        },
      ],
    });
    expect(merged.added).toEqual([]);
    expect(merged.worksheet.summary.occurrenceCount).toBe(0);
  });
});
