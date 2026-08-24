const {
  ComparisonInventoryExtractor,
  DEFAULT_BATCH_TOKEN_BUDGET,
  DEFAULT_INVENTORY_OUTPUT_TOKEN_LIMIT,
  estimateInventoryTokens,
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
  test("uses a connector's dedicated policy inventory completion when available", async () => {
    const text = "Vandalismus ist bis EUR 25.000 versichert.";
    const Connector = {
      getChatCompletion: jest.fn(async () => {
        throw new Error("generic chat completion must not be used");
      }),
      getPolicyInventoryCompletion: jest.fn(async () => ({
        textResponse: JSON.stringify({
          topics: [
            {
              label: "Vandalismus",
              aliases: ["mutwillige Beschädigung"],
              page: 1,
              evidence: text,
            },
          ],
        }),
      })),
    };

    const result = await ComparisonInventoryExtractor.extract({
      documentData: pageAwareDocument([text]),
      Connector,
      fallbackTopics: [],
    });

    expect(result.inventoryItems).toEqual([
      expect.objectContaining({ label: "Vandalismus", pageNumber: 1 }),
    ]);
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledWith(
      expect.any(Array),
      {
        temperature: 0,
        maxOutputTokens: DEFAULT_INVENTORY_OUTPUT_TOKEN_LIMIT,
      }
    );
    expect(Connector.getChatCompletion).not.toHaveBeenCalled();
  });

  test("accepts the compact grounded tuple format used to reduce generation time", async () => {
    const text = "Vandalismus ist bis EUR 25.000 versichert.";
    const compactResponse = JSON.stringify({
      topics: [["Vandalismus", 1, text]],
    });
    const verboseResponse = JSON.stringify({
      topics: [
        {
          label: "Vandalismus",
          aliases: ["mutwillige Beschädigung"],
          page: 1,
          evidence: text,
        },
      ],
    });
    expect(compactResponse.length).toBeLessThan(verboseResponse.length);
    const Connector = {
      getChatCompletion: jest.fn(async () => ({
        textResponse: compactResponse,
      })),
    };

    const result = await ComparisonInventoryExtractor.extract({
      documentData: pageAwareDocument([text]),
      Connector,
      fallbackTopics: [],
    });

    expect(result.inventoryItems).toEqual([
      expect.objectContaining({
        label: "Vandalismus",
        pageNumber: 1,
        evidenceText: text,
      }),
    ]);
  });

  test("reserves enough output for dense grounded JSON without widening the input batch", async () => {
    const clauses = Array.from(
      { length: 24 },
      (_, index) =>
        `Klausel ${index + 1}: Deckung mit Sublimit EUR ${(index + 1) * 1000} und besonderem Selbstbehalt.`
    );
    const text = clauses.join("\n");
    const verboseResponse = JSON.stringify({
      topics: clauses.map((evidence, index) => ({
        label: `Dichte Klausel ${index + 1}`,
        aliases: [`Sonderregelung ${index + 1}`],
        page: 1,
        evidence,
      })),
    });
    const compactResponse = JSON.stringify({
      topics: clauses.map((evidence, index) => [
        `Dichte Klausel ${index + 1}`,
        1,
        evidence,
      ]),
    });
    // The compact transport keeps the same grounded topics while materially
    // reducing generation work and retaining the 1,536-token safety ceiling.
    expect(estimateInventoryTokens(verboseResponse)).toBeGreaterThan(1_024);
    expect(estimateInventoryTokens(compactResponse)).toBeLessThan(
      estimateInventoryTokens(verboseResponse) * 0.7
    );
    expect(estimateInventoryTokens(compactResponse)).toBeLessThanOrEqual(
      DEFAULT_INVENTORY_OUTPUT_TOKEN_LIMIT
    );

    const Connector = {
      getChatCompletion: jest.fn(),
      getPolicyInventoryCompletion: jest.fn(async () => ({
        textResponse: compactResponse,
      })),
    };
    const result = await ComparisonInventoryExtractor.extract({
      documentData: pageAwareDocument([text]),
      Connector,
      fallbackTopics: [],
    });

    expect(result.validatedTopicCount).toBe(24);
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        maxOutputTokens: 1_536,
      })
    );
  });

  test("extracts a grounded page-less inventory without inventing a page", async () => {
    const text = "Vandalismus ist bis EUR 25.000 versichert.";
    const Connector = {
      getChatCompletion: jest.fn(async () => ({
        textResponse: JSON.stringify({
          topics: [
            {
              label: "Vandalismus",
              aliases: ["mutwillige Beschädigung"],
              page: null,
              evidence: text,
            },
          ],
        }),
      })),
    };

    const result = await ComparisonInventoryExtractor.extract({
      documentData: {
        pageContent: text,
        documentExtraction: {
          schemaVersion: 1,
          complete: true,
          kind: "docx",
          sourceSha256: "d".repeat(64),
        },
      },
      Connector,
      fallbackTopics: [],
    });

    expect(result.complete).toBe(true);
    expect(result.pageCount).toBe(1);
    expect(result.inventoryItems).toEqual([
      expect.objectContaining({
        label: "Vandalismus",
        pageNumber: null,
        evidenceText: text,
      }),
    ]);
    expect(Connector.getChatCompletion.mock.calls[0][0][1].content).toContain(
      '<document part="1/1">'
    );
  });

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

  test("keeps every page fragment inside the default token budget without omissions", () => {
    const pageTexts = Array.from({ length: 198 }, (_, index) => {
      const sentinel = `SEITENMARKER-${String(index + 1).padStart(3, "0")}`;
      return `${sentinel} ${"Versicherungsbedingung mit Umlauten äöü. ".repeat(
        index === 97 ? 420 : 14
      )}`;
    });
    const { pages, batches, batchTokenBudget } =
      ComparisonInventoryExtractor.buildPageBatches({
        documentData: pageAwareDocument(pageTexts),
      });

    expect(batchTokenBudget).toBe(DEFAULT_BATCH_TOKEN_BUDGET);
    expect(batches.length).toBeGreaterThan(3);
    expect(
      batches.every((batch) => batch.tokenCount <= DEFAULT_BATCH_TOKEN_BUDGET)
    ).toBe(true);
    expect(
      [...new Set(batches.flatMap((batch) => batch.pageNumbers))].sort(
        (a, b) => a - b
      )
    ).toEqual(Array.from({ length: 198 }, (_, index) => index + 1));

    for (const page of pages) {
      const fragments = batches
        .flatMap((batch) => batch.fragments)
        .filter((fragment) => fragment.pageNumber === page.pageNumber)
        .sort((left, right) => left.start - right.start);
      expect(fragments[0].start).toBe(0);
      expect(fragments.at(-1).end).toBe(page.text.length);
      for (let index = 1; index < fragments.length; index++)
        expect(fragments[index].start).toBeLessThanOrEqual(
          fragments[index - 1].end
        );
    }
  });

  test("keeps an 88k-character 21-page policy within six complete model batches", () => {
    const pageTexts = Array.from({ length: 21 }, (_, index) => {
      const header = `Physische Seite ${index + 1}; gedruckte Seite ${(index % 7) + 1} von 7. `;
      return `${header}${"Versicherungsbedingungen, Sublimit, Selbstbehalt, Ausschluss und Obliegenheit. ".repeat(60)}`;
    });
    const documentData = pageAwareDocument(pageTexts);
    expect(documentData.pageContent.length).toBeGreaterThan(88_000);
    const { batches } = ComparisonInventoryExtractor.buildPageBatches({
      documentData,
    });

    expect(DEFAULT_BATCH_TOKEN_BUDGET).toBe(7_168);
    expect(batches.length).toBeLessThanOrEqual(6);
    expect([
      ...new Set(batches.flatMap((batch) => batch.pageNumbers)),
    ]).toHaveLength(21);
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

  test("fails closed for incomplete JSON output and missing or duplicate page maps", async () => {
    const Connector = {
      getChatCompletion: jest.fn(async () => ({
        textResponse:
          '```json\n{"topics":[{"label":"Inhalt","aliases":[],"page":1',
      })),
    };
    await expect(
      ComparisonInventoryExtractor.extract({
        documentData: pageAwareDocument(["Inhalt"]),
        Connector,
        fallbackTopics: [],
      })
    ).rejects.toThrow("incomplete JSON");

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
      getChatCompletion: jest.fn(async (messages) => {
        const isCorrection = messages.some((message) =>
          message.content.includes("nur die verworfenen Themen")
        );
        if (!isCorrection)
          return {
            textResponse: JSON.stringify({
              topics: [
                {
                  label: "Vandalismus",
                  aliases: [],
                  page: 1,
                  evidence: "Vandalismus ist vollständig mitversichert.",
                },
              ],
            }),
          };
        return {
          textResponse: `Hier ist das korrigierte Inventar:
\`\`\`json
{"topics":[{"label":"Vandalismus","aliases":[],"page":1,"evidence":"Vandalismus ist versichert.",}],}
\`\`\``,
        };
      }),
    };

    const result = await ComparisonInventoryExtractor.extract({
      documentData: pageAwareDocument(["Vandalismus ist versichert."]),
      Connector,
      fallbackTopics: [],
    });

    expect(Connector.getChatCompletion).toHaveBeenCalledTimes(2);
    expect(Connector.getChatCompletion.mock.calls[1][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining(
            "Kopiere jedes evidence-Zitat wortgetreu"
          ),
        }),
      ])
    );
    expect(result.inventoryItems).toEqual([
      expect.objectContaining({ label: "Vandalismus", pageNumber: 1 }),
    ]);
  });

  test("keeps valid first-pass evidence and asks only for rejected corrections", async () => {
    const documentText = [
      "Selbstbehalt EUR 350 je Schadenfall.",
      "Vandalismus ist bis EUR 25.000 versichert.",
    ].join("\n");
    const Connector = {
      getChatCompletion: jest.fn(async (messages) => {
        const correction = messages.some((message) =>
          message.content.includes("nur die verworfenen Themen")
        );
        if (!correction)
          return {
            textResponse: JSON.stringify({
              topics: [
                ["Selbstbehalt", 1, "Selbstbehalt EUR 350 je Schadenfall."],
                ["Vandalismus", 1, "Vandalismus ist vollständig versichert."],
              ],
            }),
          };
        return {
          textResponse: JSON.stringify({
            topics: [
              ["Vandalismus", 1, "Vandalismus ist bis EUR 25.000 versichert."],
            ],
          }),
        };
      }),
    };

    const result = await ComparisonInventoryExtractor.extract({
      documentData: pageAwareDocument([documentText]),
      Connector,
      fallbackTopics: [],
    });

    expect(Connector.getChatCompletion).toHaveBeenCalledTimes(2);
    expect(result.inventoryItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Selbstbehalt", pageNumber: 1 }),
        expect.objectContaining({ label: "Vandalismus", pageNumber: 1 }),
      ])
    );
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
