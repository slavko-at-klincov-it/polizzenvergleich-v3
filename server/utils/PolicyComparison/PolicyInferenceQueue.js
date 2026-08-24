const DEFAULT_TIMEOUT_MS = 180_000;
const crypto = require("crypto");
const { PolicyComparisonMetrics } = require("./PolicyComparisonMetrics");
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
    metricContext = {},
    metricSink = PolicyComparisonMetrics.emit,
  }) {
    if (typeof operation !== "function")
      throw new Error("Policy inference operation is required.");
    const previous = inferenceTail;
    const enqueuedAt = Date.now();
    const operationId = crypto.randomUUID();
    let acquiredAt = null;
    const emit = (event) => {
      try {
        metricSink?.({
          operationId,
          kind: metricContext.kind || "policy_operation",
          analysisRunId: metricContext.analysisRunId,
          batchSize: metricContext.batchSize,
          pass: metricContext.pass,
          ...event,
        });
      } catch {
        // Observability is deliberately fail-open for product behavior.
      }
    };
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
      acquiredAt = Date.now();
      const providerStartedAt = acquiredAt;
      const running = Promise.resolve().then(operation);
      running.then(
        () => {
          emit({
            event: "provider_settled",
            providerDurationMs: Date.now() - providerStartedAt,
            outcome: "resolved",
          });
          release();
        },
        () => {
          emit({
            event: "provider_settled",
            providerDurationMs: Date.now() - providerStartedAt,
            outcome: "rejected",
          });
          release();
        }
      );
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
    let callerPromise = queuedOperation;
    if (timeoutMs != null && !timeoutStartedOperation) {
      const waitTimeout = new Promise((_resolve, reject) => {
        waitTimer = setTimeout(() => {
          waitTimedOut = true;
          reject(timeoutError());
        }, timeoutMs);
        waitTimer.unref?.();
      });
      callerPromise = Promise.race([queuedOperation, waitTimeout]).finally(
        () => {
          if (waitTimer) clearTimeout(waitTimer);
        }
      );
    }
    return callerPromise.then(
      (value) => {
        emit({
          event: "caller_settled",
          queueWaitMs: Math.max(0, (acquiredAt || Date.now()) - enqueuedAt),
          callerTotalMs: Date.now() - enqueuedAt,
          outcome: "resolved",
        });
        return value;
      },
      (error) => {
        emit({
          event: "caller_settled",
          queueWaitMs: Math.max(0, (acquiredAt || Date.now()) - enqueuedAt),
          callerTotalMs: Date.now() - enqueuedAt,
          outcome:
            error?.code === "POLICY_INFERENCE_TIMEOUT" ? "timeout" : "rejected",
          timeoutPhase:
            error?.code === "POLICY_INFERENCE_TIMEOUT"
              ? acquiredAt == null
                ? "queue_wait"
                : "provider"
              : null,
        });
        throw error;
      }
    );
  },

  run({
    Connector,
    messages,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    completionOptions = { temperature: 0 },
    metricContext = {},
    metricSink,
  }) {
    return this.runOperation({
      timeoutMs,
      metricContext,
      metricSink,
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
