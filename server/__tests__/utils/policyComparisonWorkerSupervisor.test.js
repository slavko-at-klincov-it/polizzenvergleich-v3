const { EventEmitter } = require("events");
const {
  configuredConcurrency,
  createPolicyComparisonWorkerSupervisor,
} = require("../../utils/policyComparison/workerSupervisor");

function childProcess(pid) {
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  child.signalCode = null;
  child.unref = jest.fn();
  child.kill = jest.fn(() => true);
  return child;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function enqueue(supervisor, sessionUuid, leaseNonce, onFailure = null) {
  return supervisor.enqueue({
    sessionUuid,
    leaseNonce,
    workerFile: "/repo/server/scripts/policyComparisonWorker.cjs",
    cwd: "/repo",
    env: {},
    onFailure,
  });
}

describe("policy comparison worker supervisor", () => {
  test("bounds all comparison workers in one FIFO", async () => {
    const children = [childProcess(101), childProcess(102)];
    let spawnIndex = 0;
    const spawnImpl = jest.fn(() => children[spawnIndex++]);
    const supervisor = createPolicyComparisonWorkerSupervisor({
      maxConcurrent: 1,
      spawnImpl,
    });

    enqueue(supervisor, "session-1", "lease-1");
    enqueue(supervisor, "session-2", "lease-2");
    await flushMicrotasks();

    expect(spawnImpl).toHaveBeenCalledTimes(1);
    expect(supervisor.snapshot()).toEqual({
      maxConcurrent: 1,
      running: 1,
      queued: 1,
    });

    children[0].exitCode = 0;
    children[0].emit("exit", 0, null);
    await flushMicrotasks();

    expect(spawnImpl).toHaveBeenCalledTimes(2);
    expect(spawnImpl.mock.calls[1][1]).toEqual([
      "/repo/server/scripts/policyComparisonWorker.cjs",
      "session-2",
      "lease-2",
    ]);
  });

  test("cancels only the exact registered child and waits for its exit", async () => {
    const child = childProcess(201);
    child.kill.mockImplementation(() => {
      queueMicrotask(() => {
        child.signalCode = "SIGKILL";
        child.emit("exit", null, "SIGKILL");
      });
      return true;
    });
    const supervisor = createPolicyComparisonWorkerSupervisor({
      spawnImpl: () => child,
    });
    enqueue(supervisor, "session-1", "lease-current");
    await flushMicrotasks();

    await expect(
      supervisor.cancel({
        sessionUuid: "session-1",
        leaseNonce: "lease-stale",
        waitForExit: true,
      })
    ).resolves.toBe(false);
    expect(child.kill).not.toHaveBeenCalled();

    await expect(
      supervisor.cancel({
        sessionUuid: "session-1",
        leaseNonce: "lease-current",
        waitForExit: true,
      })
    ).resolves.toBe(true);
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(supervisor.snapshot().running).toBe(0);
  });

  test("removes a queued lease without spawning or signalling it", async () => {
    const first = childProcess(301);
    const spawnImpl = jest.fn(() => first);
    const supervisor = createPolicyComparisonWorkerSupervisor({
      maxConcurrent: 1,
      spawnImpl,
    });
    enqueue(supervisor, "session-1", "lease-1");
    enqueue(supervisor, "session-2", "lease-2");
    await flushMicrotasks();

    await expect(
      supervisor.cancel({
        sessionUuid: "session-2",
        leaseNonce: "lease-2",
      })
    ).resolves.toBe(true);
    first.exitCode = 0;
    first.emit("exit", 0, null);
    await flushMicrotasks();

    expect(spawnImpl).toHaveBeenCalledTimes(1);
    expect(supervisor.snapshot()).toEqual({
      maxConcurrent: 1,
      running: 0,
      queued: 0,
    });
  });

  test("reports an unexpected child exit with the owned pid", async () => {
    const child = childProcess(401);
    const onFailure = jest.fn();
    const supervisor = createPolicyComparisonWorkerSupervisor({
      spawnImpl: () => child,
    });
    enqueue(supervisor, "session-1", "lease-1", onFailure);
    await flushMicrotasks();

    child.exitCode = 2;
    child.emit("exit", 2, null);
    await flushMicrotasks();

    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "COMPARISON_WORKER_EXITED:session-1:exit=2:signal=none",
      }),
      { workerPid: 401 }
    );
  });

  test("keeps concurrency configuration bounded and fail-safe", () => {
    expect(configuredConcurrency(undefined)).toBe(1);
    expect(configuredConcurrency("0")).toBe(1);
    expect(configuredConcurrency("3")).toBe(3);
    expect(configuredConcurrency("99")).toBe(8);
  });
});
