const {
  ComparisonHybridRetriever,
} = require("../../../utils/PolicyComparison/ComparisonHybridRetriever");
const {
  ComparisonChunkIndex,
} = require("../../../utils/PolicyComparison/ComparisonChunkIndex");

const documents = [
  {
    id: 1,
    workspaceId: 10,
    threadId: 20,
    workspaceDocumentId: 100,
    docId: "doc-a",
    slot: "A",
    status: "ready",
    originalFilename: "A.pdf",
  },
  {
    id: 2,
    workspaceId: 10,
    threadId: 20,
    workspaceDocumentId: 101,
    docId: "doc-b",
    slot: "B",
    status: "ready",
    originalFilename: "B.pdf",
  },
];

describe("ComparisonHybridRetriever", () => {
  test("keeps prompt rules topic-neutral and distinguishes missing evidence", () => {
    expect(ComparisonHybridRetriever.systemPrompt).toContain(
      "Eine fehlende Fundstelle bedeutet niemals automatisch"
    );
    expect(ComparisonHybridRetriever.systemPrompt).not.toContain(
      "Selbstbehalte, Deckungsgrenzen"
    );
  });

  test("packs complete A/B topic blocks inside the comparison context budget", () => {
    const evidenceGroups = Array.from({ length: 24 }, (_, index) => ({
      topic: {
        id: `topic-${index}`,
        label: `Dynamisches Thema ${index}`,
        terms: [`thema ${index}`],
      },
      documentResults: documents.map((document) => ({
        document,
        hits: [
          {
            pageNumber: index + 1,
            text: `${`Langer Vertragsbeleg ${index}. `.repeat(80)}`,
          },
        ],
      })),
    }));
    const packed = ComparisonHybridRetriever.packTopicContexts(evidenceGroups);
    expect(packed.maxBatchCharacters).toBeLessThanOrEqual(12_000);
    expect(packed.budgetLimited).toBe(true);
    const completePack = packed.batches.join("\n\n");
    for (let index = 0; index < evidenceGroups.length; index += 1) {
      expect(completePack).toContain(`topicId=topic-${index}`);
      expect(completePack).toContain(
        `[DOKUMENT A | A.pdf | Seite ${index + 1}]`
      );
      expect(completePack).toContain(
        `[DOKUMENT B | B.pdf | Seite ${index + 1}]`
      );
    }
  });

  test("splits one large multi-clause topic without losing evidence", () => {
    const longDocuments = documents.map((document) => ({
      ...document,
      originalFilename: `${document.slot}-${"x".repeat(220)}.pdf`,
    }));
    const evidenceGroups = [
      {
        topic: { id: "ausschluss", label: "Ausschluss", terms: ["ausschluss"] },
        documentResults: longDocuments.map((document) => ({
          document,
          hits: Array.from({ length: 30 }, (_, index) => ({
            pageNumber: index + 1,
            text: `Ausschlussbeleg ${document.slot}-${index + 1}. ${"z".repeat(180)}`,
          })),
        })),
      },
    ];

    const packed = ComparisonHybridRetriever.packTopicContexts(evidenceGroups);
    expect(packed.maxBatchCharacters).toBeLessThanOrEqual(12_000);
    const complete = packed.batches.join("\n");
    for (const slot of ["A", "B"])
      for (let page = 1; page <= 30; page++)
        expect(complete).toContain(`Ausschlussbeleg ${slot}-${page}`);
  });

  test("does not invent missing evidence in unequal continuation slices", () => {
    const packed = ComparisonHybridRetriever.packTopicContexts([
      {
        topic: { id: "ausschluss", label: "Ausschluss", terms: ["ausschluss"] },
        documentResults: [
          {
            document: documents[0],
            hits: Array.from({ length: 45 }, (_, index) => ({
              pageNumber: index + 1,
              text: `Ausschluss A-${index + 1}.`,
            })),
          },
          {
            document: documents[1],
            hits: [{ pageNumber: 7, text: "Ausschluss B-1." }],
          },
        ],
      },
    ]);
    const complete = packed.batches.join("\n");
    expect(complete).toContain("Ausschluss B-1.");
    expect(complete).not.toContain(
      "[DOKUMENT B | B.pdf] keine belegte Fundstelle gefunden"
    );
  });

  test("centers compact evidence on a late line-hyphenated clause", () => {
    const compact = ComparisonHybridRetriever.compactEvidence(
      {
        text: `${"Unwichtiger Vorspann. ".repeat(80)}Der Selbst-\nbehalt beträgt EUR 500.`,
      },
      { terms: ["selbstbehalt"] },
      180
    );
    expect(compact).toContain("Selbstbehalt beträgt EUR 500");
  });

  test("never invents a page label for a page-less source", () => {
    expect(
      ComparisonHybridRetriever.evidenceContext(
        { text: "Vandalismus ist versichert.", pageNumber: null },
        { slot: "A", originalFilename: "Bedingungen.docx" }
      )
    ).toBe("[DOKUMENT A | Bedingungen.docx]\nVandalismus ist versichert.");
  });

  test("searches and returns evidence separately for both documents", async () => {
    const index = {
      searchDocument: jest.fn(({ comparisonDocumentId }) => [
        {
          docId: comparisonDocumentId === 1 ? "doc-a" : "doc-b",
          pageNumber: comparisonDocumentId === 1 ? 4 : 9,
          text: `Lexical evidence ${comparisonDocumentId}`,
          exactMatch: true,
        },
      ]),
    };
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(({ includeDocIds }) => ({
        message: false,
        sources: [
          {
            title: includeDocIds[0] === "doc-a" ? "A.pdf" : "B.pdf",
            pageNumber: includeDocIds[0] === "doc-a" ? 4 : 9,
            text: `Semantic evidence ${includeDocIds[0]}`,
          },
        ],
      })),
    };
    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare", topN: 4 },
      thread: { id: 20 },
      query: "Selbstbehalt",
      LLMConnector: {},
      VectorDb,
      documents,
      index,
    });

    expect(result.ready).toBe(true);
    expect(result.mode).toBe("comparison");
    expect(result.systemPrompt).toContain("zwei Dokumente");
    expect(index.searchDocument).toHaveBeenCalledTimes(2);
    expect(VectorDb.performSimilaritySearch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ includeDocIds: ["doc-a"] })
    );
    expect(VectorDb.performSimilaritySearch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ includeDocIds: ["doc-b"] })
    );
    expect(result.contextTexts.join("\n")).toContain("DOKUMENT A");
    expect(result.contextTexts.join("\n")).toContain("DOKUMENT B");
    expect(result.sources.map((source) => source.documentSlot)).toEqual(
      expect.arrayContaining(["A", "B"])
    );
  });

  test("does not activate document retrieval when the thread has no documents", async () => {
    const VectorDb = { performSimilaritySearch: jest.fn() };
    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare" },
      thread: { id: 20 },
      query: "Erkläre mir den Unterschied zwischen Prämie und Beitrag.",
      LLMConnector: {},
      VectorDb,
      documents: [],
    });
    expect(result).toEqual({ active: false });
    expect(VectorDb.performSimilaritySearch).not.toHaveBeenCalled();
  });

  test("analyzes one ready document without requiring a second policy", async () => {
    const oneDocument = documents.slice(0, 1);
    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare" },
      thread: { id: 20 },
      query: "Deckung",
      LLMConnector: {},
      VectorDb: {
        name: "LanceDb",
        performSimilaritySearch: jest.fn(() => ({
          message: false,
          sources: [],
        })),
      },
      documents: oneDocument,
      index: {
        listThreadTopics: () => [
          { id: "deckung", label: "Deckung", terms: ["deckung"] },
        ],
        searchTopic: jest.fn(() => [
          {
            pageNumber: 3,
            text: "Die Deckung umfasst Feuer und Sturm.",
            exactMatch: true,
          },
        ]),
      },
    });
    expect(result).toMatchObject({ active: true, ready: true, mode: "single" });
    expect(result.systemPrompt).toContain("das eine Dokument");
    expect(result.systemPrompt).not.toContain("zwei Dokumente");
    expect(result.sources).toEqual([
      expect.objectContaining({ documentSlot: "A", pageNumber: 3 }),
    ]);
  });

  test("waits when any attached document is still processing", async () => {
    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare" },
      thread: { id: 20 },
      query: "Vergleiche",
      LLMConnector: {},
      VectorDb: {},
      documents: [documents[0], { ...documents[1], status: "indexing" }],
    });
    expect(result).toMatchObject({ active: true, ready: false });
    expect(result.message).toContain("Alle angehängten Dokumente");
    expect(result.message).not.toContain("genau zwei");
  });

  test("uses the A/B inventory union and independent topic-document quotas", async () => {
    const topics = [
      { id: "selbstbehalt", label: "Selbstbehalt", terms: ["selbstbehalt"] },
      {
        id: "deckungssumme",
        label: "Deckungsgrenze",
        terms: ["deckungssumme", "deckungsgrenze"],
      },
      { id: "ausschluss", label: "Ausschluss", terms: ["ausschluss"] },
      { id: "vandalismus", label: "Vandalismus", terms: ["vandalismus"] },
    ];
    const index = {
      searchDocument: jest.fn(),
      listThreadTopics: jest.fn(() => topics),
      searchTopic: jest.fn(({ comparisonDocumentId, topic }) => [
        {
          docId: comparisonDocumentId === 1 ? "doc-a" : "doc-b",
          pageNumber:
            topic.id === "vandalismus"
              ? comparisonDocumentId === 1
                ? 187
                : 17
              : comparisonDocumentId,
          text: `${topic.label} evidence in ${comparisonDocumentId}`,
          exactMatch: true,
          topicId: topic.id,
          topicLabel: topic.label,
        },
      ]),
    };
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(({ input, includeDocIds }) => ({
        message: false,
        sources: [
          {
            pageNumber: input.includes("Vandalismus")
              ? includeDocIds[0] === "doc-a"
                ? 187
                : 17
              : 1,
            text: `Semantic ${input}`,
          },
        ],
      })),
    };

    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare", topN: 4 },
      thread: { id: 20 },
      query: "Vergleiche die beiden Policen vollständig",
      LLMConnector: {},
      VectorDb,
      documents,
      index,
    });

    expect(index.listThreadTopics).toHaveBeenCalledTimes(1);
    expect(index.searchTopic).toHaveBeenCalledTimes(topics.length * 2);
    expect(index.searchDocument).not.toHaveBeenCalled();
    expect(VectorDb.performSimilaritySearch).toHaveBeenCalledTimes(
      topics.length * 2
    );
    for (const documentSlot of ["A", "B"]) {
      expect(result.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            documentSlot,
            topicId: "vandalismus",
            pageNumber: documentSlot === "A" ? 187 : 17,
          }),
          expect.objectContaining({ documentSlot, topicId: "selbstbehalt" }),
          expect.objectContaining({ documentSlot, topicId: "ausschluss" }),
          expect.objectContaining({ documentSlot, topicId: "deckungssumme" }),
        ])
      );
    }
    expect(result.coverage).toMatchObject({
      plannedTopics: 4,
      topicDocumentCells: 8,
      noEvidence: [],
    });
  });

  test("uses the production inventory path for Vandalismus in A and B", async () => {
    const searchTopic = jest
      .spyOn(ComparisonChunkIndex, "searchTopic")
      .mockResolvedValue([]);
    const inventoryService = {
      readyForDocuments: jest.fn(async () => [
        { document: documents[0], manifest: { items: [] } },
        { document: documents[1], manifest: { items: [] } },
      ]),
      unionTopics: jest.fn(() => [
        {
          id: "vandalismus",
          label: "Vandalismus",
          terms: ["vandalismus", "mutwillige beschädigung"],
          anchors: [
            {
              slot: "A",
              pageNumber: 187,
              evidenceText: "Vandalismus ist in Dokument A versichert.",
            },
            {
              slot: "B",
              pageNumber: 17,
              evidenceText: "Vandalismus ist in Dokument B versichert.",
            },
          ],
        },
      ]),
    };
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(() => ({
        message: false,
        sources: [],
      })),
    };

    try {
      const result = await ComparisonHybridRetriever.retrieve({
        workspace: { id: 10, slug: "compare", topN: 4 },
        thread: { id: 20 },
        query: "Vergleiche die beiden Policen vollständig",
        LLMConnector: {},
        VectorDb,
        documents,
        inventoryService,
      });

      expect(inventoryService.readyForDocuments).toHaveBeenCalledTimes(1);
      expect(searchTopic).toHaveBeenCalledTimes(2);
      expect(result.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ documentSlot: "A", pageNumber: 187 }),
          expect.objectContaining({ documentSlot: "B", pageNumber: 17 }),
        ])
      );
    } finally {
      searchTopic.mockRestore();
    }
  });

  test("keeps comparison closed while a ready base index has no ready inventory", async () => {
    const inventoryService = {
      readyForDocuments: jest.fn(async () => null),
      fallbackTopics: jest.fn(() => []),
      ensureForDocuments: jest.fn(),
    };
    const searchTopic = jest.spyOn(ComparisonChunkIndex, "searchTopic");

    try {
      const result = await ComparisonHybridRetriever.retrieve({
        workspace: { id: 10, slug: "compare", topN: 4 },
        thread: { id: 20 },
        query: "Vergleiche die beiden Policen vollständig",
        LLMConnector: {},
        VectorDb: { name: "LanceDb" },
        documents,
        inventoryService,
      });

      expect(result).toMatchObject({
        active: true,
        ready: false,
        deepAnalysisRequired: true,
        contextTexts: [],
        sources: [],
      });
      expect(result.message).toContain("optionale Tiefenanalyse");
      expect(inventoryService.ensureForDocuments).not.toHaveBeenCalled();
      expect(searchTopic).not.toHaveBeenCalled();
    } finally {
      searchTopic.mockRestore();
    }
  });

  test.each([
    "Vergleiche alle Klauseln",
    "Welche Unterschiede gibt es in den Versicherungsbedingungen?",
    "Fasse alle Regelungen zusammen",
    "Vergleiche bitte die wichtigsten Punkte der beiden Polizzen vollständig",
    "Stelle die beiden Policen gegenüber",
  ])("keeps broad container query fail-closed: %s", async (query) => {
    const inventoryService = {
      readyForDocuments: jest.fn(async () => null),
      fallbackTopics: jest.fn(() => []),
    };
    const searchTopic = jest.spyOn(ComparisonChunkIndex, "searchTopic");
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(),
    };

    try {
      const result = await ComparisonHybridRetriever.retrieve({
        workspace: { id: 10, slug: "compare", topN: 4 },
        thread: { id: 20 },
        query,
        LLMConnector: {},
        VectorDb,
        documents,
        inventoryService,
      });

      expect(result).toMatchObject({
        active: true,
        ready: false,
        deepAnalysisRequired: true,
      });
      expect(searchTopic).not.toHaveBeenCalled();
      expect(VectorDb.performSimilaritySearch).not.toHaveBeenCalled();
    } finally {
      searchTopic.mockRestore();
    }
  });

  test("answers a targeted Vandalismus question without inventory using an A/B pivot", async () => {
    const searchTopic = jest
      .spyOn(ComparisonChunkIndex, "searchTopic")
      .mockImplementation(async ({ comparisonDocumentId }) =>
        comparisonDocumentId === 2
          ? [
              {
                docId: "doc-b",
                pageNumber: 17,
                text: "Vandalismus: mutwillige Beschädigung durch Dritte.",
                exactMatch: true,
              },
            ]
          : []
      );
    const inventoryService = {
      readyForDocuments: jest.fn(async () => null),
      fallbackTopics: jest.fn(() => []),
      ensureForDocuments: jest.fn(),
    };
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(({ input, includeDocIds }) => ({
        message: false,
        sources:
          includeDocIds[0] === "doc-a" &&
          input.includes("mutwillige Beschädigung")
            ? [
                {
                  score: 0.91,
                  pageNumber: 187,
                  text: "Böswillige Beschädigungen an versicherten Sachen werden ersetzt.",
                },
              ]
            : [],
      })),
    };
    const LLMConnector = {
      getChatCompletion: jest.fn(async (messages) => {
        const candidates = JSON.parse(messages[1].content).candidates;
        return {
          textResponse: JSON.stringify({
            relevantIds: candidates.map(({ id }) => id),
          }),
        };
      }),
    };

    try {
      const result = await ComparisonHybridRetriever.retrieve({
        workspace: { id: 10, slug: "compare", topN: 4 },
        thread: { id: 20 },
        query: "Sind alle Vandalismusschäden versichert?",
        LLMConnector,
        VectorDb,
        documents,
        inventoryService,
      });

      expect(result).toMatchObject({ active: true, ready: true });
      expect(inventoryService.ensureForDocuments).not.toHaveBeenCalled();
      expect(searchTopic).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: expect.objectContaining({
            terms: expect.arrayContaining(["vandalismus"]),
          }),
        })
      );
      expect(result.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ documentSlot: "A", pageNumber: 187 }),
          expect.objectContaining({ documentSlot: "B", pageNumber: 17 }),
        ])
      );
      expect(VectorDb.performSimilaritySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          includeDocIds: ["doc-a"],
          input: expect.stringContaining("mutwillige Beschädigung"),
          topN: 8,
        })
      );
    } finally {
      searchTopic.mockRestore();
    }
  });

  test("requires deep analysis when an unknown query has no lexical topic seed", async () => {
    const searchTopic = jest
      .spyOn(ComparisonChunkIndex, "searchTopic")
      .mockResolvedValue([]);
    const inventoryService = {
      readyForDocuments: jest.fn(async () => null),
      fallbackTopics: jest.fn(() => []),
    };
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(),
    };

    try {
      const result = await ComparisonHybridRetriever.retrieve({
        workspace: { id: 10, slug: "compare", topN: 4 },
        thread: { id: 20 },
        query: "Spezialbetrachtung der beiden Policen",
        LLMConnector: {},
        VectorDb,
        documents,
        inventoryService,
      });

      expect(result).toMatchObject({
        active: true,
        ready: false,
        deepAnalysisRequired: true,
        contextTexts: [],
        sources: [],
      });
      expect(searchTopic).toHaveBeenCalledTimes(2);
      expect(VectorDb.performSimilaritySearch).not.toHaveBeenCalled();
    } finally {
      searchTopic.mockRestore();
    }
  });

  test("does not turn an unrelated high-score vector into topic evidence", async () => {
    const index = {
      listThreadTopics: () => [
        {
          id: "vandalismus",
          label: "Vandalismus",
          terms: ["vandalismus", "mutwillige beschädigung"],
        },
      ],
      searchTopic: jest.fn(({ comparisonDocumentId }) =>
        comparisonDocumentId === 1
          ? [
              {
                docId: "doc-a",
                pageNumber: 187,
                text: "Vandalismus ist versichert.",
                exactMatch: true,
              },
            ]
          : []
      ),
    };
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(() => ({
        message: false,
        sources: [
          {
            score: 0.99,
            pageNumber: 1,
            text: "Allgemeine Vertragsinformationen ohne Risikoklausel.",
          },
        ],
      })),
    };

    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare", topN: 4 },
      thread: { id: 20 },
      query: "Vergleiche Vandalismus",
      LLMConnector: {},
      VectorDb,
      documents,
      index,
    });

    expect(result.coverage.noEvidence).toContainEqual({
      topicId: "vandalismus",
      documentSlot: "B",
    });
    expect(result.contextTexts.join("\n")).toContain(
      "[DOKUMENT B | B.pdf] keine belegte Fundstelle gefunden"
    );
  });

  test("keeps a validated semantic paraphrase without requiring the literal topic term", async () => {
    const index = {
      listThreadTopics: () => [
        {
          id: "einbruchdiebstahl",
          label: "Einbruchdiebstahl",
          terms: ["einbruchdiebstahl"],
        },
      ],
      searchTopic: jest.fn(() => []),
    };
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(({ includeDocIds }) => ({
        message: false,
        sources: [
          {
            score: 0.91,
            pageNumber: includeDocIds[0] === "doc-a" ? 12 : 19,
            text: "Versichert ist gewaltsames Eindringen durch unbefugte Dritte.",
          },
        ],
      })),
    };
    const LLMConnector = {
      getChatCompletion: jest.fn(async (messages) => {
        const { candidates } = JSON.parse(messages[1].content);
        return {
          textResponse: JSON.stringify({
            relevantIds: candidates.map((candidate) => candidate.id),
          }),
        };
      }),
    };

    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare", topN: 4 },
      thread: { id: 20 },
      query: "Vergleiche Einbruchdiebstahl",
      LLMConnector,
      VectorDb,
      documents,
      index,
    });

    expect(result.coverage.noEvidence).toEqual([]);
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentSlot: "A", pageNumber: 12 }),
        expect.objectContaining({ documentSlot: "B", pageNumber: 19 }),
      ])
    );
    expect(LLMConnector.getChatCompletion).toHaveBeenCalledTimes(1);
  });

  test.each([
    "Vergleiche Vorteile und Nachteile",
    "Welche Deckungen sind enthalten?",
    "Welche Police ist besser?",
  ])("uses the complete inventory for broad broker question: %s", (query) => {
    const topics = [
      { id: "selbstbehalt", label: "Selbstbehalt", terms: ["selbstbehalt"] },
      { id: "vandalismus", label: "Vandalismus", terms: ["vandalismus"] },
    ];
    expect(ComparisonHybridRetriever.planTopics({ query, topics })).toEqual(
      topics
    );
  });

  test("keeps targeted query qualifiers inside the selected topic cell", () => {
    const [topic] = ComparisonHybridRetriever.planTopics({
      query: "Vergleiche den Selbstbehalt bei Leitungswasser",
      topics: [
        {
          id: "selbstbehalt",
          label: "Selbstbehalt",
          terms: ["selbstbehalt", "franchise"],
        },
      ],
    });
    expect(topic.id).toBe("selbstbehalt");
    expect(topic.qualifierTerms).toContain("leitungswasser");
  });

  test.each([
    ["Welche Leistungen gelten beim Selbstbehalt?", []],
    ["Welche Deckungen hat der Selbstbehalt?", []],
    ["Gibt es einen Selbstbehalt bei Leitungswasser?", ["leitungswasser"]],
    ["Wo gilt der Selbstbehalt bei Leitungswasser?", ["leitungswasser"]],
  ])("keeps only domain conditions as qualifiers: %s", (query, expected) => {
    const [topic] = ComparisonHybridRetriever.planTopics({
      query,
      topics: [
        {
          id: "selbstbehalt",
          label: "Selbstbehalt",
          terms: ["selbstbehalt", "franchise"],
        },
      ],
    });
    expect(topic.qualifierTerms).toEqual(expected);
  });

  test("does not use an unrelated clause when a targeted qualifier is absent", async () => {
    const index = {
      listThreadTopics: () => [
        {
          id: "selbstbehalt",
          label: "Selbstbehalt",
          terms: ["selbstbehalt"],
          anchors: documents.map((document) => ({
            slot: document.slot,
            pageNumber: 8,
            evidenceText: "Bei Sturm gilt ein Selbstbehalt von EUR 500.",
          })),
        },
      ],
      searchTopic: jest.fn(() => [
        {
          pageNumber: 8,
          text: "Bei Sturm gilt ein Selbstbehalt von EUR 500.",
          exactMatch: true,
        },
      ]),
    };
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(() => ({ message: false, sources: [] })),
    };

    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare" },
      thread: { id: 20 },
      query: "Wie hoch ist der Selbstbehalt bei Leitungswasser?",
      LLMConnector: {},
      VectorDb,
      documents,
      index,
    });

    expect(result.sources).toHaveLength(0);
    expect(result.coverage.noEvidence).toEqual([
      { topicId: "selbstbehalt", documentSlot: "A" },
      { topicId: "selbstbehalt", documentSlot: "B" },
    ]);
  });

  test("keeps a concrete topic targeted even when the question asks which policy is better", () => {
    const topics = [
      { id: "vandalismus", label: "Vandalismus", terms: ["vandalismus"] },
      { id: "glasbruch", label: "Glasbruch", terms: ["glasbruch"] },
    ];
    expect(
      ComparisonHybridRetriever.planTopics({
        query: "Vergleiche Vandalismus: Welche Police ist besser?",
        topics,
      }).map(({ id }) => id)
    ).toEqual(["vandalismus"]);
  });

  test.each([
    "Welche Deckungen hat Vandalismus?",
    "Welche Leistungen gelten beim Vandalismus?",
    "Vorteile und Nachteile der Vandalismusdeckung",
    "Ist Vandalismus vollständig gedeckt?",
    "Sind alle Vandalismusschäden versichert?",
  ])("keeps expansive wording scoped to an explicit topic: %s", (query) => {
    const topics = [
      {
        id: "vandalismus",
        label: "Vandalismus",
        terms: ["vandalismus", "vandalismusdeckung"],
      },
      { id: "glasbruch", label: "Glasbruch", terms: ["glasbruch"] },
    ];
    expect(
      ComparisonHybridRetriever.planTopics({ query, topics }).map(
        ({ id }) => id
      )
    ).toEqual(["vandalismus"]);
  });

  test("returns grounded sources for a normally worded targeted question", async () => {
    const topics = [
      {
        id: "vandalismus",
        label: "Vandalismus",
        terms: ["vandalismus"],
        anchors: documents.map((document, index) => ({
          slot: document.slot,
          pageNumber: 20 + index,
          evidenceText: "Vandalismus ist bis EUR 25.000 versichert.",
        })),
      },
    ];
    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare" },
      thread: { id: 20 },
      query: "Welche Deckungen hat Vandalismus?",
      LLMConnector: {},
      VectorDb: {
        name: "LanceDb",
        performSimilaritySearch: jest.fn(() => ({
          message: false,
          sources: [],
        })),
      },
      documents,
      index: {
        listThreadTopics: () => topics,
        searchTopic: jest.fn(() => []),
      },
    });
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentSlot: "A", pageNumber: 20 }),
        expect.objectContaining({ documentSlot: "B", pageNumber: 21 }),
      ])
    );
  });

  test("requires all compound qualifiers before accepting lexical evidence", async () => {
    const index = {
      listThreadTopics: () => [
        {
          id: "selbstbehalt",
          label: "Selbstbehalt",
          terms: ["selbstbehalt"],
          anchors: documents.map((document) => ({
            slot: document.slot,
            pageNumber: 12,
            evidenceText:
              "Bei Leitungswasser gilt ein Selbstbehalt von EUR 500.",
          })),
        },
      ],
      searchTopic: jest.fn(() => [
        {
          pageNumber: 12,
          text: "Bei Leitungswasser gilt ein Selbstbehalt von EUR 500.",
          exactMatch: true,
        },
      ]),
    };
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(() => ({ message: false, sources: [] })),
    };

    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare" },
      thread: { id: 20 },
      query:
        "Wie hoch ist der Selbstbehalt bei Leitungswasser in leerstehenden Gebäuden?",
      LLMConnector: {},
      VectorDb,
      documents,
      index,
    });

    expect(result.sources).toHaveLength(0);
    expect(result.coverage.noEvidence).toEqual([
      { topicId: "selbstbehalt", documentSlot: "A" },
      { topicId: "selbstbehalt", documentSlot: "B" },
    ]);
  });

  test("keeps every grounded clause occurrence of one open topic", async () => {
    const topics = [
      {
        id: "ausschluss",
        label: "Ausschluss",
        terms: ["ausschluss"],
        anchors: [
          ...[10, 20, 30].map((pageNumber) => ({
            slot: "A",
            pageNumber,
            evidenceText: `Ausschluss auf Seite ${pageNumber}.`,
          })),
          {
            slot: "B",
            pageNumber: 11,
            evidenceText: "Ausschluss auf Seite 11.",
          },
        ],
      },
    ];
    const index = {
      listThreadTopics: () => topics,
      searchTopic: jest.fn(() => [
        {
          pageNumber: 99,
          text: "Ausschluss auf Seite 99.",
          exactMatch: true,
        },
      ]),
    };
    const VectorDb = {
      name: "LanceDb",
      performSimilaritySearch: jest.fn(() => ({
        message: false,
        sources: [
          {
            score: 0.99,
            pageNumber: 99,
            text: "Ausschluss auf Seite 99.",
          },
        ],
      })),
    };

    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare", topN: 4 },
      thread: { id: 20 },
      query: "Vergleiche Ausschluss",
      LLMConnector: {},
      VectorDb,
      documents,
      index,
    });

    for (const pageNumber of [10, 20, 30]) {
      expect(result.sources).toContainEqual(
        expect.objectContaining({ documentSlot: "A", pageNumber })
      );
      expect(result.contextTexts.join("\n")).toContain(
        `[DOKUMENT A | A.pdf | Seite ${pageNumber}]`
      );
    }
  });

  test("fails closed when the vector database cannot enforce document scope", async () => {
    const result = await ComparisonHybridRetriever.retrieve({
      workspace: { id: 10, slug: "compare" },
      thread: { id: 20 },
      query: "Vergleiche",
      LLMConnector: {},
      VectorDb: { name: "Qdrant" },
      documents,
    });
    expect(result).toMatchObject({ active: true, ready: false });
    expect(result.message).toContain("LanceDB");
  });
});
