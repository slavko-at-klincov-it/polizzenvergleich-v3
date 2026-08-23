const {
  ComparisonInventoryExtractor,
} = require("../../../utils/PolicyComparison/ComparisonInventoryExtractor");

function pageAwareDocument(pageTexts) {
  const separator = "\n\n";
  let offset = 0;
  const pages = pageTexts.map((text, index) => {
    const start = offset;
    offset += text.length;
    const page = {
      pageNumber: index + 1,
      start,
      end: offset,
      method: "native",
      status: "ok",
    };
    if (index < pageTexts.length - 1) offset += separator.length;
    return page;
  });
  return {
    pageContent: pageTexts.join(separator),
    pdfExtraction: {
      complete: true,
      sourceSha256: "f".repeat(64),
      totalPages: pages.length,
      pages,
    },
  };
}

describe("ComparisonInventoryExtractor", () => {
  test("batches every canonical page without a Top-N cutoff", () => {
    const pageTexts = Array.from(
      { length: 14 },
      (_, index) =>
        `Klausel ${index + 1}: ${"x".repeat(index === 6 ? 700 : 45)}`
    );
    const { pages, batches } = ComparisonInventoryExtractor.buildPageBatches({
      documentData: pageAwareDocument(pageTexts),
      batchCharBudget: 300,
    });

    expect(pages).toHaveLength(14);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every((batch) => batch.charCount <= 300)).toBe(true);
    expect(
      [...new Set(batches.flatMap((batch) => batch.pageNumbers))].sort(
        (a, b) => a - b
      )
    ).toEqual(Array.from({ length: 14 }, (_, index) => index + 1));
    expect(
      batches
        .flatMap((batch) => batch.fragments)
        .filter((fragment) => fragment.pageNumber === 7).length
    ).toBeGreaterThan(1);
  });

  test("maps all batches with strict JSON at temperature zero and adds fallbacks transparently", async () => {
    const documentData = pageAwareDocument(
      Array.from(
        { length: 12 },
        (_, index) => `Klausel ${index + 1} ist auf dieser Seite geregelt.`
      )
    );
    const Connector = {
      getChatCompletion: jest.fn(async (messages) => {
        const content = messages.find(
          (message) => message.role === "user"
        ).content;
        const pageNumbers = [...content.matchAll(/<page number="(\d+)"/gu)].map(
          (match) => Number(match[1])
        );
        return {
          textResponse: JSON.stringify({
            topics: pageNumbers.map((page) => ({
              label: `Thema ${page}`,
              aliases: [`Klauselthema ${page}`],
              page,
              evidence: `Klausel ${page} ist auf dieser Seite geregelt.`,
            })),
          }),
        };
      }),
    };

    const result = await ComparisonInventoryExtractor.extract({
      documentData,
      Connector,
      batchCharBudget: 300,
      fallbackTopics: [
        { id: "selbstbehalt", label: "Selbstbehalt", aliases: ["Franchise"] },
      ],
    });

    expect(result.processedPages).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1)
    );
    expect(result.complete).toBe(true);
    expect(
      result.topics.filter((topic) => topic.origin === "model")
    ).toHaveLength(12);
    expect(result.fallbackTopics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "selbstbehalt",
          facetKey: "selbstbehalt",
          origin: "fallback",
          pageNumber: null,
          evidenceText: null,
          sourceMethod: "fallback",
          confidence: null,
        }),
      ])
    );
    expect(result.topics).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ origin: "fallback" })])
    );
    expect(result.fallbackTopicsAdded).toEqual(["selbstbehalt"]);
    expect(Connector.getChatCompletion).toHaveBeenCalledTimes(
      result.batchCount
    );
    for (const [, options] of Connector.getChatCompletion.mock.calls)
      expect(options).toEqual({ temperature: 0 });
  });

  test("validates evidence against the declared canonical page and rejects hallucinations", async () => {
    const Connector = {
      getChatCompletion: jest.fn(async () => ({
        textResponse: JSON.stringify({
          topics: [
            {
              label: "Selbstbehalt",
              aliases: ["Franchise"],
              page: 1,
              evidence: "Der Selbstbehalt beträgt EUR 350.",
            },
            {
              label: "Falsche Seite",
              aliases: [],
              page: 2,
              evidence: "Der Selbstbehalt beträgt EUR 350.",
            },
            {
              label: "Halluzination",
              aliases: [],
              page: 1,
              evidence: "Vandalismus ist versichert.",
            },
          ],
        }),
      })),
    };
    await expect(
      ComparisonInventoryExtractor.extract({
        documentData: pageAwareDocument([
          "Der Selbstbehalt beträgt EUR 350.",
          "Auf dieser Seite steht nur die Laufzeit.",
        ]),
        Connector,
        batchCharBudget: 500,
        fallbackTopics: [],
      })
    ).rejects.toThrow("evidence validation rejected 2");
  });

  test("accepts only normalization-equivalent page evidence, not fuzzy text", () => {
    const canonicalPages = new Map([
      [1, "Die Höhe des Selbst-\nbehalts beträgt EUR 500."],
    ]);
    expect(
      ComparisonInventoryExtractor.validateMappedTopic(
        {
          label: "Selbstbehalt",
          aliases: [],
          page: 1,
          evidence: "Die Höhe des Selbstbehalts beträgt EUR 500.",
        },
        canonicalPages
      )
    ).toMatchObject({
      valid: true,
      topic: { evidenceValidation: "normalized" },
    });
    expect(
      ComparisonInventoryExtractor.validateMappedTopic(
        {
          label: "Selbstbehalt",
          aliases: [],
          page: 1,
          evidence: "Die Höhe des Selbstbehalts beträgt EUR 900.",
        },
        canonicalPages
      )
    ).toMatchObject({ valid: false, reason: "evidence_not_on_page" });
  });

  test("rejects evidence from a canonical page that was not visible in the current batch", async () => {
    const Connector = {
      getChatCompletion: jest.fn(async () => {
        return {
          textResponse: JSON.stringify({
            topics: [
              {
                label: "Vandalismus",
                aliases: [],
                page: 2,
                evidence: "Vandalismus ist auf Seite zwei versichert.",
              },
            ],
          }),
        };
      }),
    };
    await expect(
      ComparisonInventoryExtractor.extract({
        documentData: pageAwareDocument([
          `Seite eins ${"a".repeat(210)}`,
          `Vandalismus ist auf Seite zwei versichert. ${"b".repeat(210)}`,
        ]),
        Connector,
        batchCharBudget: 256,
        fallbackTopics: [],
      })
    ).rejects.toThrow("evidence validation rejected 1");
    expect(Connector.getChatCompletion).toHaveBeenCalledTimes(2);
  });

  test("reduces duplicate aliases and does not duplicate a grounded fallback", () => {
    const reduced = ComparisonInventoryExtractor.reduceTopics(
      [
        {
          label: "Selbstbeteiligung",
          aliases: ["Franchise"],
          page: 2,
          evidence: "Selbstbeteiligung EUR 300",
          evidenceValidation: "exact",
        },
        {
          label: "Franchise",
          aliases: ["Selbstbeteiligung"],
          page: 9,
          evidence: "Franchise EUR 500",
          evidenceValidation: "exact",
        },
      ],
      [
        {
          id: "selbstbehalt",
          label: "Selbstbehalt",
          aliases: ["Selbstbeteiligung", "Franchise"],
        },
        {
          id: "vandalismus",
          label: "Vandalismus",
          aliases: [],
        },
      ]
    );

    expect(reduced.topics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "selbstbehalt",
          facetKey: "selbstbehalt",
          label: "Selbstbehalt",
          origin: "model+fallback",
          pageNumber: 2,
          evidenceText: "Selbstbeteiligung EUR 300",
          sourceMethod: "llm-map",
          confidence: 1,
          fallbackMatched: true,
          occurrences: [
            expect.objectContaining({ page: 2 }),
            expect.objectContaining({ page: 9 }),
          ],
        }),
      ])
    );
    expect(reduced.fallbackTopics).toEqual([
      expect.objectContaining({
        id: "vandalismus",
        facetKey: "vandalismus",
        origin: "fallback",
        pageNumber: null,
        evidenceText: null,
      }),
    ]);
    expect(reduced.fallbackTopicsAdded).toEqual(["vandalismus"]);
  });

  test("fails closed for non-JSON output and missing or duplicate page maps", async () => {
    const Connector = {
      getChatCompletion: jest.fn(async () => ({
        textResponse: '```json\n{"topics":[]}\n```',
      })),
    };
    await expect(
      ComparisonInventoryExtractor.extract({
        documentData: pageAwareDocument(["Inhalt"]),
        Connector,
        fallbackTopics: [],
      })
    ).rejects.toThrow("invalid strict JSON");

    expect(() =>
      ComparisonInventoryExtractor.buildPageBatches({
        documentData: { pageContent: "ohne map" },
      })
    ).toThrow("complete and source-hashed");

    const duplicateMap = pageAwareDocument(["Seite eins", "Seite zwei"]);
    duplicateMap.pdfExtraction.pages[1].pageNumber = 1;
    expect(() =>
      ComparisonInventoryExtractor.buildPageBatches({
        documentData: duplicateMap,
      })
    ).toThrow("Duplicate canonical page number 1");
  });

  test("retries one invalid model mapping before publishing the batch", async () => {
    const Connector = {
      getChatCompletion: jest
        .fn()
        .mockResolvedValueOnce({ textResponse: "not-json" })
        .mockResolvedValueOnce({
          textResponse: JSON.stringify({
            topics: [
              {
                label: "Vandalismus",
                aliases: [],
                page: 1,
                evidence: "Vandalismus ist versichert.",
              },
            ],
          }),
        }),
    };

    const result = await ComparisonInventoryExtractor.extract({
      documentData: pageAwareDocument(["Vandalismus ist versichert."]),
      Connector,
      fallbackTopics: [],
    });

    expect(Connector.getChatCompletion).toHaveBeenCalledTimes(2);
    expect(result.inventoryItems).toEqual([
      expect.objectContaining({ label: "Vandalismus", pageNumber: 1 }),
    ]);
  });

  test("serializes inventory inference across concurrent PDF jobs", async () => {
    let active = 0;
    let maxActive = 0;
    const Connector = {
      getChatCompletion: jest.fn(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return {
          textResponse: JSON.stringify({
            topics: [
              {
                label: "Selbstbehalt",
                aliases: [],
                page: 1,
                evidence: "Selbstbehalt EUR 350.",
              },
            ],
          }),
        };
      }),
    };
    const documentData = pageAwareDocument(["Selbstbehalt EUR 350."]);

    await Promise.all([
      ComparisonInventoryExtractor.extract({
        documentData,
        Connector,
        fallbackTopics: [],
      }),
      ComparisonInventoryExtractor.extract({
        documentData,
        Connector,
        fallbackTopics: [],
      }),
    ]);

    expect(Connector.getChatCompletion).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
  });
});
