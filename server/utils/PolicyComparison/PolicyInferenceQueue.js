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

    let timedOut = false;
    let timer = null;
    const queuedOperation = previous.then(async () => {
      if (timedOut) {
        release();
        throw timeoutError();
      }
      if (!timeoutStartedOperation && timer) {
        clearTimeout(timer);
        timer = null;
      }
      const running = Promise.resolve().then(operation);
      running.then(release, release);
      return running;
    });
    if (timeoutMs == null) return queuedOperation;
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(timeoutError());
      }, timeoutMs);
      timer.unref?.();
    });
    return Promise.race([queuedOperation, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
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
