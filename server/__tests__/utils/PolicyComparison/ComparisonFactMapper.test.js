const {
  ComparisonFactMapper,
  DEFAULT_MAP_OUTPUT_TOKEN_LIMIT,
  DEFAULT_MAP_INPUT_TOKEN_BUDGET,
  DEFAULT_MAX_UNITS_PER_BATCH,
  estimateTokens,
} = require("../../../utils/PolicyComparison/ComparisonFactMapper");

function unit(text, unitKey = "u1") {
  return {
    unitKey,
    ordinal: 0,
    pageNumber: 4,
    pageStart: 0,
    pageEnd: text.length,
    sourceStart: 100,
    sourceEnd: 100 + text.length,
    text,
    textHash: "a".repeat(64),
    sourceMethod: "native",
  };
}

function connector(responses) {
  const queue = [...responses];
  return {
    getChatCompletion: jest.fn(),
    getPolicyInventoryCompletion: jest.fn(async () => {
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return { textResponse: JSON.stringify(next) };
    }),
  };
}

describe("ComparisonFactMapper", () => {
  test("retains multiple evidence-bound facts from one block", async () => {
    const text =
      "Vandalismusschäden sind versichert. Höchstentschädigung EUR 10.000. Selbstbehalt EUR 350. Graffiti ist ausgeschlossen.";
    const Connector = connector([
      {
        units: [
          {
            unitKey: "u1",
            facts: [
              [
                "Vandalismus",
                "coverage",
                "Vandalismus ist gedeckt",
                "Vandalismusschäden sind versichert.",
              ],
              [
                "Vandalismus",
                "limit",
                "Limit 10.000 Euro",
                "Höchstentschädigung EUR 10.000.",
              ],
              [
                "Vandalismus",
                "deductible",
                "Selbstbehalt 350 Euro",
                "Selbstbehalt EUR 350.",
              ],
              [
                "Graffiti",
                "exclusion",
                "Graffiti ist ausgeschlossen",
                "Graffiti ist ausgeschlossen.",
              ],
            ].map(([topic, factType, claim, evidenceText]) => ({
              topic,
              factType,
              claim,
              evidenceText,
              polarity: factType === "exclusion" ? "excluded" : "included",
              conditions: [],
            })),
          },
        ],
      },
    ]);

    const result = await ComparisonFactMapper.extract({
      units: [unit(text)],
      Connector,
    });

    expect(result.facts).toHaveLength(4);
    expect(result.facts.map((fact) => fact.factType)).toEqual([
      "coverage",
      "limit",
      "deductible",
      "exclusion",
    ]);
    expect(result.facts[1]).toEqual(
      expect.objectContaining({
        pageNumber: 4,
        evidenceStart: 136,
        evidenceEnd: 167,
      })
    );
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        temperature: 0,
        maxOutputTokens: DEFAULT_MAP_OUTPUT_TOKEN_LIMIT,
      })
    );
  });

  test("second-checks a risk-bearing zero result exactly once", async () => {
    const text = "Höchstentschädigung EUR 50.000 je Versicherungsjahr.";
    const Connector = connector([
      {
        units: [{ unitKey: "u1", facts: [], noFactReason: "nichts" }],
      },
      {
        units: [
          {
            unitKey: "u1",
            facts: [
              {
                topic: "Höchstentschädigung",
                factType: "limit",
                claim: "50.000 Euro je Versicherungsjahr",
                evidenceText: text,
                polarity: "included",
                value: { invented: 999999 },
                conditions: ["je Versicherungsjahr"],
              },
            ],
          },
        ],
      },
    ]);

    const result = await ComparisonFactMapper.extract({
      units: [unit(text)],
      Connector,
    });
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledTimes(2);
    expect(result.units[0]).toEqual(
      expect.objectContaining({ reviewCount: 2, resultKind: "facts" })
    );
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toEqual(
      expect.objectContaining({
        value: {
          values: [
            expect.objectContaining({
              kind: "money",
              normalizedValue: "50000",
              evidenceText: "EUR 50.000",
            }),
          ],
        },
      })
    );
    expect(result.facts[0].value).not.toEqual({ invented: 999999 });
  });

  test("treats an ambiguous zero result as model-reviewed, never deterministic", async () => {
    const Connector = connector([
      {
        units: [
          { unitKey: "u1", facts: [], noFactReason: "Inhaltsverzeichnis" },
        ],
      },
    ]);
    const result = await ComparisonFactMapper.extract({
      units: [unit("Inhaltsverzeichnis")],
      Connector,
    });
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledTimes(1);
    expect(result.units[0]).toEqual(
      expect.objectContaining({
        resultKind: "reviewed_no_fact",
        reviewCount: 1,
      })
    );
  });

  test("repairs an echoed input envelope once without overlapping model calls", async () => {
    const text = "Der Selbstbehalt beträgt EUR 500 je Schadenfall.";
    const Connector = connector([
      {
        units: [
          {
            unitKey: "u1",
            physicalPage: 4,
            riskSignals: [{ kind: "deductible" }],
            text,
          },
        ],
      },
      {
        units: [
          {
            unitKey: "u1",
            facts: [
              {
                topic: "Selbstbehalt",
                factType: "deductible",
                claim: "500 Euro je Schadenfall",
                evidenceText: text,
              },
            ],
          },
        ],
      },
    ]);

    const result = await ComparisonFactMapper.extract({
      units: [unit(text)],
      Connector,
    });

    expect(result.facts).toHaveLength(1);
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledTimes(2);
    const correctionMessages =
      Connector.getPolicyInventoryCompletion.mock.calls[1][0];
    expect(correctionMessages.at(-1).content).toContain("FORMATKORREKTUR");
  });

  test("does not start a second review after an inference timeout", async () => {
    const timeout = new Error("timeout");
    timeout.code = "POLICY_INFERENCE_TIMEOUT";
    const Connector = connector([timeout]);
    await expect(
      ComparisonFactMapper.extract({
        units: [unit("Selbstbehalt EUR 350")],
        Connector,
      })
    ).rejects.toMatchObject({ code: "POLICY_INFERENCE_TIMEOUT" });
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledTimes(1);
  });

  test("keeps a signal-dense single block inside the hard input budget", async () => {
    const dense = unit("Selbstbehalt EUR 10.000; ".repeat(90));
    dense.riskSignals = Array.from({ length: 180 }, (_, index) => ({
      kind: index % 2 ? "money" : "deductible",
      normalizedValue: index % 2 ? "10000" : "selbstbehalt",
      evidenceText: index % 2 ? "EUR 10.000" : "Selbstbehalt",
    }));
    const Connector = connector([
      { units: [{ unitKey: "u1", facts: [], noFactReason: "geprüft" }] },
      { units: [{ unitKey: "u1", facts: [], noFactReason: "zweitgeprüft" }] },
    ]);

    await ComparisonFactMapper.extract({ units: [dense], Connector });

    const messages = Connector.getPolicyInventoryCompletion.mock.calls[0][0];
    const userPayload = messages.find(
      (message) => message.role === "user"
    ).content;
    expect(estimateTokens(userPayload)).toBeLessThanOrEqual(
      DEFAULT_MAP_INPUT_TOKEN_BUDGET
    );
  });

  test("filters administrative metadata without retrying or losing valid siblings", async () => {
    const identityText =
      "WIENER STÄDTISCHE Versicherung AG Vienna Insurance Group";
    const deductibleText = "Selbstbehalt EUR 350 je Schadenfall.";
    const Connector = connector([
      {
        units: [
          {
            unitKey: "identity",
            facts: [
              {
                topic: "Versicherer-Identifikation",
                factType: "other_contract_fact",
                claim: "Der Versicherer wird bezeichnet.",
                evidenceText: identityText,
              },
            ],
          },
          {
            unitKey: "deductible",
            facts: [
              {
                topic: "Selbstbehalt",
                factType: "deductible",
                claim: "350 Euro je Schadenfall",
                evidenceText: deductibleText,
              },
            ],
          },
        ],
      },
    ]);

    const result = await ComparisonFactMapper.extract({
      units: [
        unit(identityText, "identity"),
        unit(deductibleText, "deductible"),
      ],
      Connector,
    });

    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].label).toBe("Selbstbehalt");
    expect(result.units[0]).toEqual(
      expect.objectContaining({
        facts: [],
        noFactReason: "out_of_scope_document_metadata",
      })
    );
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledTimes(1);
  });

  test("filters a Firmenbuchnummer abstraction over an exact FN source", async () => {
    const text = "FN 123456 a";
    const Connector = connector([
      {
        units: [
          {
            unitKey: "u1",
            facts: [
              {
                topic: "Firmenbuchnummer",
                factType: "other_contract_fact",
                claim: "Die Firmenbuchnummer wird genannt.",
                evidenceText: text,
              },
            ],
          },
        ],
      },
    ]);

    const result = await ComparisonFactMapper.extract({
      units: [unit(text)],
      Connector,
    });

    expect(result.facts).toEqual([]);
    expect(result.units[0].noFactReason).toBe("out_of_scope_document_metadata");
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledTimes(1);
  });

  test("filters a literal insurer company name as document metadata", async () => {
    const text = "WIENER STÄDTISCHE Versicherung AG Vienna Insurance Group";
    const Connector = connector([
      {
        units: [
          {
            unitKey: "u1",
            facts: [
              {
                topic: "WIENER STÄDTISCHE Versicherung AG",
                factType: "other_contract_fact",
                claim: "Der Versicherer wird genannt.",
                evidenceText: text,
              },
            ],
          },
        ],
      },
    ]);

    const result = await ComparisonFactMapper.extract({
      units: [unit(text)],
      Connector,
    });

    expect(result.facts).toEqual([]);
    expect(result.units[0].noFactReason).toBe("out_of_scope_document_metadata");
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledTimes(1);
  });

  test.each([
    "Vandalismus",
    "Vandalismusdeckung",
    "Vandalismusschäden",
    "Graffiti",
  ])(
    "never accepts protected topic %s over unrelated Einbruch evidence",
    async (topic) => {
      const text = "Schäden durch Einbruchdiebstahl sind versichert.";
      const Connector = connector([
        {
          units: [
            {
              unitKey: "u1",
              facts: [
                {
                  topic,
                  factType: "coverage",
                  claim: `${topic} ist versichert`,
                  evidenceText: text,
                },
              ],
            },
          ],
        },
      ]);

      const result = await ComparisonFactMapper.extract({
        units: [unit(text)],
        Connector,
      });

      expect(result.facts).toHaveLength(1);
      expect(result.facts[0]).toEqual(
        expect.objectContaining({
          factType: "other_contract_fact",
          claimText: text,
          evidenceText: text,
          sourceMethod: "safe-evidence-fallback",
        })
      );
      expect(result.facts[0].label.toLocaleLowerCase("de-AT")).not.toContain(
        topic.toLocaleLowerCase("de-AT")
      );
      expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledTimes(1);
    }
  );

  test("accepts valid facts individually while dropping metadata in the same block", async () => {
    const text = "Selbstbehalt EUR 350 je Schadenfall. FN 123456 a";
    const Connector = connector([
      {
        units: [
          {
            unitKey: "u1",
            facts: [
              {
                topic: "Selbstbehalt",
                factType: "deductible",
                claim: "350 Euro je Schadenfall",
                evidenceText: "Selbstbehalt EUR 350 je Schadenfall.",
              },
              {
                topic: "Firmenbuchnummer",
                factType: "other_contract_fact",
                claim: "Firmenbuchnummer",
                evidenceText: "FN 123456 a",
              },
            ],
          },
        ],
      },
    ]);

    const result = await ComparisonFactMapper.extract({
      units: [unit(text)],
      Connector,
    });

    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].factType).toBe("deductible");
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledTimes(1);
  });

  test("backs an unknown abstract topic down to exact source evidence", async () => {
    const text = "Schäden durch Einbruchdiebstahl sind versichert.";
    const Connector = connector([
      {
        units: [
          {
            unitKey: "u1",
            facts: [
              {
                topic: "Cyberkrieg",
                factType: "coverage",
                claim: "Cyberkrieg ist versichert",
                evidenceText: text,
              },
            ],
          },
        ],
      },
    ]);

    const result = await ComparisonFactMapper.extract({
      units: [unit(text)],
      Connector,
    });

    expect(result.facts[0]).toEqual(
      expect.objectContaining({
        factType: "other_contract_fact",
        claimText: text,
        evidenceText: text,
        sourceMethod: "safe-evidence-fallback",
      })
    );
    expect(result.facts[0].label).not.toBe("Cyberkrieg");
  });

  test("limits packed model batches to four ambiguous blocks", () => {
    const units = Array.from({ length: 9 }, (_, index) =>
      unit(`Klausel ${index}`, `u${index}`)
    );
    const batches = ComparisonFactMapper.packUnits(units);

    expect(DEFAULT_MAX_UNITS_PER_BATCH).toBe(4);
    expect(batches.map((batch) => batch.length)).toEqual([4, 4, 1]);
  });

  test("includes the persisted heading path in the model payload", async () => {
    const input = unit("Inhaltsverzeichnis");
    input.headingPath = ["Gebäudeversicherung", "Premiumschutz"];
    const Connector = connector([
      {
        units: [{ unitKey: "u1", facts: [], noFactReason: "Navigation" }],
      },
    ]);

    await ComparisonFactMapper.extract({ units: [input], Connector });

    const messages = Connector.getPolicyInventoryCompletion.mock.calls[0][0];
    expect(messages.at(-1).content).toContain(
      '"headingPath":["Gebäudeversicherung","Premiumschutz"]'
    );
    expect(messages.at(-1).content).toContain('"unitKey":"b1"');
    expect(messages.at(-1).content).not.toContain('"unitKey":"u1"');
  });

  test("maps short response IDs back to long persisted block keys", async () => {
    const blockKey = "a".repeat(64);
    const input = unit("Selbstbehalt EUR 350 je Schadenfall.", blockKey);
    const Connector = connector([
      {
        units: [
          {
            unitKey: "b1",
            facts: [
              {
                topic: "Selbstbehalt",
                factType: "deductible",
                claim: "350 Euro je Schadenfall",
                evidenceText: input.text,
              },
            ],
          },
        ],
      },
    ]);

    const result = await ComparisonFactMapper.extract({
      units: [input],
      Connector,
    });

    expect(result.units[0].unit.unitKey).toBe(blockKey);
    expect(result.facts[0].unitKey).toBe(blockKey);
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledTimes(1);
  });

  test("recovers a corrupted unitKey from exact evidence without retrying", async () => {
    const input = unit("Selbstbehalt EUR 500 je Schadenfall.", "b".repeat(64));
    const Connector = connector([
      {
        units: [
          {
            unitKey: "Selbstbehalt",
            facts: [
              {
                topic: "Selbstbehalt",
                factType: "deductible",
                claim: "500 Euro je Schadenfall",
                evidenceText: input.text,
              },
            ],
          },
        ],
      },
    ]);

    const result = await ComparisonFactMapper.extract({
      units: [input],
      Connector,
    });

    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].factType).toBe("deductible");
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledTimes(1);
  });

  test("binds reordered corrupted IDs to the only blocks containing their evidence", async () => {
    const first = unit("Selbstbehalt EUR 350.", "c".repeat(64));
    const second = unit("Höchstentschädigung EUR 10.000.", "d".repeat(64));
    const Connector = connector([
      {
        units: [
          {
            unitKey: "Deckungsgrenze",
            facts: [
              {
                topic: "Höchstentschädigung",
                factType: "limit",
                claim: "Höchstentschädigung 10.000 Euro",
                evidenceText: second.text,
              },
            ],
          },
          {
            unitKey: "Selbstbehalt",
            facts: [
              {
                topic: "Selbstbehalt",
                factType: "deductible",
                claim: "Selbstbehalt 350 Euro",
                evidenceText: first.text,
              },
            ],
          },
        ],
      },
    ]);

    const result = await ComparisonFactMapper.extract({
      units: [first, second],
      Connector,
    });

    expect(result.facts.map((fact) => fact.unitKey)).toEqual([
      first.unitKey,
      second.unitKey,
    ]);
    expect(result.facts.map((fact) => fact.factType)).toEqual([
      "deductible",
      "limit",
    ]);
    expect(Connector.getPolicyInventoryCompletion).toHaveBeenCalledTimes(1);
  });
});
