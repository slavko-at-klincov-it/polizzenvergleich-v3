const {
  PolicyInferenceQueue,
} = require("../../../utils/PolicyComparison/PolicyInferenceQueue");

describe("PolicyInferenceQueue", () => {
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    console.info.mockRestore();
  });

  test("does not overlap the next model call after a visible timeout", async () => {
    let releaseFirst;
    const firstConnector = {
      getChatCompletion: jest.fn(
        () =>
          new Promise((resolve) => {
            releaseFirst = () => resolve({ textResponse: "late" });
          })
      ),
    };
    const secondConnector = {
      getChatCompletion: jest.fn(async () => ({ textResponse: "next" })),
    };
    const first = PolicyInferenceQueue.run({
      Connector: firstConnector,
      messages: [],
      timeoutMs: 5,
    });
    await expect(first).rejects.toMatchObject({
      code: "POLICY_INFERENCE_TIMEOUT",
    });

    const second = PolicyInferenceQueue.run({
      Connector: secondConnector,
      messages: [],
      timeoutMs: 100,
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(secondConnector.getChatCompletion).not.toHaveBeenCalled();

    releaseFirst();
    await expect(second).resolves.toEqual({ textResponse: "next" });
    expect(secondConnector.getChatCompletion).toHaveBeenCalledTimes(1);
  });

  test("times out while waiting for a stuck predecessor without starting", async () => {
    let releaseFirst;
    const firstConnector = {
      getChatCompletion: jest.fn(
        () =>
          new Promise((resolve) => {
            releaseFirst = () => resolve({ textResponse: "released" });
          })
      ),
    };
    const waitingConnector = {
      getChatCompletion: jest.fn(async () => ({
        textResponse: "must not run",
      })),
    };
    await expect(
      PolicyInferenceQueue.run({
        Connector: firstConnector,
        messages: [],
        timeoutMs: 5,
      })
    ).rejects.toMatchObject({ code: "POLICY_INFERENCE_TIMEOUT" });

    await expect(
      PolicyInferenceQueue.runOperation({
        operation: () => waitingConnector.getChatCompletion([]),
        timeoutMs: 10,
        timeoutStartedOperation: false,
      })
    ).rejects.toMatchObject({ code: "POLICY_INFERENCE_TIMEOUT" });
    expect(waitingConnector.getChatCompletion).not.toHaveBeenCalled();

    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(
      PolicyInferenceQueue.run({
        Connector: waitingConnector,
        messages: [],
        timeoutMs: 100,
      })
    ).resolves.toEqual({ textResponse: "must not run" });
  });

  test("starts the operation timeout only after the queue lease is acquired", async () => {
    let releaseFirst;
    const first = PolicyInferenceQueue.runOperation({
      operation: () =>
        new Promise((resolve) => {
          releaseFirst = resolve;
        }),
      timeoutMs: 5,
    });
    await expect(first).rejects.toMatchObject({
      code: "POLICY_INFERENCE_TIMEOUT",
    });

    const secondOperation = jest.fn(async () => "second-finished");
    const second = PolicyInferenceQueue.runOperation({
      operation: secondOperation,
      timeoutMs: 10,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(secondOperation).not.toHaveBeenCalled();
    releaseFirst("first-finished");
    await expect(second).resolves.toBe("second-finished");
  });

  test("reports caller timeout separately from the real provider settlement", async () => {
    const metrics = [];
    let releaseProvider;
    const operation = PolicyInferenceQueue.runOperation({
      operation: () =>
        new Promise((resolve) => {
          releaseProvider = resolve;
        }),
      timeoutMs: 5,
      metricContext: {
        kind: "comparison_fact_map",
        analysisRunId: 17,
        batchSize: 4,
        pass: "first",
      },
      metricSink: (event) => metrics.push(event),
    });

    await expect(operation).rejects.toMatchObject({
      code: "POLICY_INFERENCE_TIMEOUT",
    });
    expect(metrics).toEqual([
      expect.objectContaining({
        event: "caller_settled",
        kind: "comparison_fact_map",
        analysisRunId: 17,
        batchSize: 4,
        pass: "first",
        outcome: "timeout",
        timeoutPhase: "provider",
      }),
    ]);

    releaseProvider("late-result");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "provider_settled",
          outcome: "resolved",
        }),
      ])
    );
  });

  test("never lets a failing metrics sink change inference behavior", async () => {
    await expect(
      PolicyInferenceQueue.runOperation({
        operation: async () => "ready",
        metricSink: () => {
          throw new Error("metrics unavailable");
        },
      })
    ).resolves.toBe("ready");
  });
});
