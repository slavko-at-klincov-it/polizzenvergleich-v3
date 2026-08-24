const DEFAULT_TIMEOUT_MS = 180_000;
let inferenceTail = Promise.resolve();

function timeoutError() {
  const error = new Error("Policy model call timed out.");
  error.code = "POLICY_INFERENCE_TIMEOUT";
  return error;
}

/**
 * Serializes all auxiliary policy-model calls. A timed-out caller fails
 * promptly, but the queue remains locked until the underlying connector call
 * really settles, so a non-cancellable LM Studio request can never overlap its
 * retry or the next PDF job.
 */
const PolicyInferenceQueue = {
  runOperation({
    operation,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    timeoutStartedOperation = true,
  }) {
    if (typeof operation !== "function")
      throw new Error("Policy inference operation is required.");
    const previous = inferenceTail;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    inferenceTail = previous.then(
      () => gate,
      () => gate
    );

    let waitTimedOut = false;
    let waitTimer = null;
    const queuedOperation = previous.then(async () => {
      if (waitTimedOut) {
        release();
        throw timeoutError();
      }
      if (waitTimer) {
        clearTimeout(waitTimer);
        waitTimer = null;
      }
      const running = Promise.resolve().then(operation);
      running.then(release, release);
      if (timeoutMs == null || !timeoutStartedOperation) return running;
      let operationTimer = null;
      const operationTimeout = new Promise((_resolve, reject) => {
        operationTimer = setTimeout(() => reject(timeoutError()), timeoutMs);
        operationTimer.unref?.();
      });
      return Promise.race([running, operationTimeout]).finally(() => {
        if (operationTimer) clearTimeout(operationTimer);
      });
    });
    if (timeoutMs == null || timeoutStartedOperation) return queuedOperation;
    const waitTimeout = new Promise((_resolve, reject) => {
      waitTimer = setTimeout(() => {
        waitTimedOut = true;
        reject(timeoutError());
      }, timeoutMs);
      waitTimer.unref?.();
    });
    return Promise.race([queuedOperation, waitTimeout]).finally(() => {
      if (waitTimer) clearTimeout(waitTimer);
    });
  },

  run({
    Connector,
    messages,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    completionOptions = { temperature: 0 },
  }) {
    return this.runOperation({
      timeoutMs,
      operation: async () => {
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            return await Connector.getChatCompletion(
              messages,
              completionOptions
            );
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      },
    });
  },
};

module.exports = { PolicyInferenceQueue, DEFAULT_TIMEOUT_MS };
