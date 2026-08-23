const {
  PolicyInferenceQueue,
} = require("../../../utils/PolicyComparison/PolicyInferenceQueue");

describe("PolicyInferenceQueue", () => {
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
      getChatCompletion: jest.fn(async () => ({ textResponse: "must not run" })),
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
});
