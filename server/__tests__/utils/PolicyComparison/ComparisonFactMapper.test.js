const {
  ComparisonFactMapper,
  DEFAULT_MAP_OUTPUT_TOKEN_LIMIT,
  DEFAULT_MAP_INPUT_TOKEN_BUDGET,
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

  test("rejects a Vandalismus label grounded only by unrelated Einbruch evidence", async () => {
    const text = "Schäden durch Einbruchdiebstahl sind versichert.";
    const Connector = connector([
      {
        units: [
          {
            unitKey: "u1",
            facts: [
              {
                topic: "Vandalismus",
                factType: "coverage",
                claim: "Vandalismus ist versichert",
                evidenceText: text,
              },
            ],
          },
        ],
      },
    ]);

    await expect(
      ComparisonFactMapper.extract({ units: [unit(text)], Connector })
    ).rejects.toThrow("not grounded");
  });
});
