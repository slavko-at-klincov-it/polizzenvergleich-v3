const crypto = require("crypto");
const { spawn } = require("child_process");

const DEFAULT_MAX_CONCURRENT_WORKERS = 1;
const MAX_CONFIGURED_CONCURRENT_WORKERS = 8;
const DEFAULT_CANCEL_WAIT_MS = 2_000;

function configuredConcurrency(
  value = process.env.POLICY_COMPARISON_MAX_WORKERS
) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1)
    return DEFAULT_MAX_CONCURRENT_WORKERS;
  return Math.min(parsed, MAX_CONFIGURED_CONCURRENT_WORKERS);
}

function workerExitError({ sessionUuid, code, signal }) {
  return new Error(
    `COMPARISON_WORKER_EXITED:${sessionUuid}:exit=${code ?? "null"}:signal=${signal || "none"}`
  );
}

function jobKey(sessionUuid, leaseNonce) {
  return `${sessionUuid}:${leaseNonce}`;
}

function createPolicyComparisonWorkerSupervisor({
  maxConcurrent = configuredConcurrency(),
  spawnImpl = spawn,
  randomBytes = crypto.randomBytes,
} = {}) {
  const pending = [];
  const jobs = new Map();
  let running = 0;
  let drainScheduled = false;

  function scheduleDrain() {
    if (drainScheduled) return;
    drainScheduled = true;
    queueMicrotask(() => {
      drainScheduled = false;
      drain();
    });
  }

  function finish(job, error = null) {
    if (job.finished) return;
    job.finished = true;
    if (job.state === "RUNNING") running = Math.max(0, running - 1);
    if (jobs.get(job.key) === job) jobs.delete(job.key);
    if (error && !job.cancelRequested)
      Promise.resolve(
        job.onFailure?.(error, {
          workerPid: Number.isInteger(job.child?.pid) ? job.child.pid : null,
        })
      ).catch(console.error);
    job.resolveFinished();
    scheduleDrain();
  }

  function start(job) {
    job.state = "RUNNING";
    running += 1;
    try {
      const child = spawnImpl(
        process.execPath,
        [job.workerFile, job.sessionUuid, job.leaseNonce],
        {
          cwd: job.cwd,
          env: {
            ...job.env,
            POLICY_COMPARISON_WORKER_GROUP_LEADER: "1",
          },
          detached: true,
          stdio: "ignore",
        }
      );
      job.child = child;
      child.once("error", (error) => finish(job, error));
      child.once("exit", (code, signal) =>
        finish(
          job,
          code === 0 || job.cancelRequested
            ? null
            : workerExitError({
                sessionUuid: job.sessionUuid,
                code,
                signal,
              })
        )
      );
      if (!Number.isInteger(child.pid) || child.pid <= 1)
        throw new Error("COMPARISON_WORKER_PID_INVALID");
      child.unref();
    } catch (error) {
      finish(job, error);
    }
  }

  function drain() {
    while (running < maxConcurrent && pending.length > 0) {
      const job = pending.shift();
      if (job.cancelRequested || jobs.get(job.key) !== job) continue;
      start(job);
    }
  }

  function enqueue({
    sessionUuid,
    leaseNonce,
    workerFile,
    cwd,
    env = process.env,
    onFailure = null,
  }) {
    if (!sessionUuid || !leaseNonce || !workerFile || !cwd)
      throw new Error("COMPARISON_WORKER_JOB_INVALID");
    const key = jobKey(sessionUuid, leaseNonce);
    if (jobs.has(key))
      throw new Error("COMPARISON_WORKER_JOB_ALREADY_REGISTERED");
    let resolveFinished;
    const finished = new Promise((resolve) => {
      resolveFinished = resolve;
    });
    const job = {
      id: randomBytes(12).toString("hex"),
      key,
      sessionUuid,
      leaseNonce,
      workerFile,
      cwd,
      env,
      onFailure,
      child: null,
      state: "QUEUED",
      cancelRequested: false,
      finished: false,
      finishedPromise: finished,
      resolveFinished,
    };
    jobs.set(key, job);
    pending.push(job);
    scheduleDrain();
    return { id: job.id, state: job.state };
  }

  async function cancel({
    sessionUuid,
    leaseNonce,
    waitForExit = false,
    timeoutMs = DEFAULT_CANCEL_WAIT_MS,
  }) {
    const job = jobs.get(jobKey(sessionUuid, leaseNonce));
    if (!job) return false;
    job.cancelRequested = true;
    if (job.state === "QUEUED") {
      finish(job);
      return true;
    }
    const child = job.child;
    if (
      child &&
      Number.isInteger(child.pid) &&
      child.pid > 1 &&
      child.exitCode === null &&
      child.signalCode === null
    )
      child.kill("SIGTERM");
    if (waitForExit && !job.finished) {
      let timer;
      const timedOut = new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("COMPARISON_WORKER_CANCEL_TIMEOUT")),
          timeoutMs
        );
      });
      try {
        await Promise.race([job.finishedPromise, timedOut]);
      } finally {
        clearTimeout(timer);
      }
    }
    return true;
  }

  function snapshot() {
    return {
      maxConcurrent,
      running,
      queued: [...jobs.values()].filter(({ state }) => state === "QUEUED")
        .length,
    };
  }

  return { cancel, enqueue, snapshot };
}

const policyComparisonWorkerSupervisor =
  createPolicyComparisonWorkerSupervisor();

module.exports = {
  configuredConcurrency,
  createPolicyComparisonWorkerSupervisor,
  policyComparisonWorkerSupervisor,
};
