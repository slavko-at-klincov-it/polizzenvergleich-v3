const {
  ComparisonBatchSynthesizer,
} = require("../../../utils/PolicyComparison/ComparisonBatchSynthesizer");
const {
  PolicyInferenceQueue,
} = require("../../../utils/PolicyComparison/PolicyInferenceQueue");

describe("ComparisonBatchSynthesizer", () => {
  test("sends every whole evidence batch separately and preserves order", async () => {
    const Connector = {
      compressMessages: jest.fn(async ({ systemPrompt, contextTexts }) => [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextTexts[0] },
      ]),
      getChatCompletion: jest
        .fn()
        .mockResolvedValueOnce({ textResponse: "A/B Thema Eins", metrics: { t: 1 } })
        .mockResolvedValueOnce({ textResponse: "A/B Thema Zwei", metrics: { t: 2 } })
        .mockResolvedValueOnce({
          textResponse: "Police A ist insgesamt stärker; siehe die Vergleichsteile.",
          metrics: { t: 3 },
        }),
    };
    const onBatch = jest.fn();
    const onFinal = jest.fn();
    const result = await ComparisonBatchSynthesizer.run({
      Connector,
      contextBatches: ["[THEMA eins] A B", "[THEMA zwei] A B"],
      systemPrompt: "Belegregeln",
      userPrompt: "Vergleiche vollständig",
      temperature: 0,
      onBatch,
      onFinal,
    });

    expect(Connector.compressMessages).toHaveBeenCalledTimes(3);
    expect(Connector.getChatCompletion).toHaveBeenCalledTimes(3);
    expect(onBatch).toHaveBeenCalledTimes(2);
    expect(onFinal).toHaveBeenCalledWith(
      "## Gesamtbewertung\nPolice A ist insgesamt stärker; siehe die Vergleichsteile."
    );
    expect(result.textResponse).toBe(
      "## Vergleichsteil 1/2\nA/B Thema Eins\n\n## Vergleichsteil 2/2\nA/B Thema Zwei\n\n## Gesamtbewertung\nPolice A ist insgesamt stärker; siehe die Vergleichsteile."
    );
  });

  test("never overlaps synthesis with a timed-out auxiliary model call", async () => {
    let releaseBlocked;
    let active = 0;
    let peak = 0;
    const Connector = {
      compressMessages: jest.fn(async ({ contextTexts }) => [
        { role: "user", content: contextTexts[0] },
      ]),
      getChatCompletion: jest.fn(() => {
        active += 1;
        peak = Math.max(peak, active);
        if (Connector.getChatCompletion.mock.calls.length > 1) {
          active -= 1;
          return Promise.resolve({ textResponse: "synthesized" });
        }
        return new Promise((resolve) => {
          releaseBlocked = () => {
            active -= 1;
            resolve({ textResponse: "released" });
          };
        });
      }),
    };
    await expect(
      PolicyInferenceQueue.run({
        Connector,
        messages: [],
        timeoutMs: 5,
      })
    ).rejects.toMatchObject({ code: "POLICY_INFERENCE_TIMEOUT" });

    const synthesis = ComparisonBatchSynthesizer.run({
      Connector,
      contextBatches: ["A", "B"],
      systemPrompt: "Regeln",
      userPrompt: "Vergleiche",
      inferenceTimeoutMs: 50,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(Connector.getChatCompletion).toHaveBeenCalledTimes(1);
    expect(peak).toBe(1);
    releaseBlocked();
    await expect(synthesis).resolves.toMatchObject({
      textResponse: expect.stringContaining("synthesized"),
    });
    expect(Connector.getChatCompletion).toHaveBeenCalledTimes(4);
    expect(peak).toBe(1);
  });
});
