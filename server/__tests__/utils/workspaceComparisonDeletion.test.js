const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  prepareWorkspaceComparisonDeletion,
} = require("../../utils/workspaceComparisonDeletion");

describe("workspace comparison deletion preparation", () => {
  let root;
  let comparisonRoot;
  let exportDirectory;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-comparison-delete-"));
    comparisonRoot = path.join(root, "policy-comparisons");
    exportDirectory = path.join(root, "exports");
    fs.mkdirSync(exportDirectory, { recursive: true });
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test("cancels workers and removes only the workspace comparison artifacts", async () => {
    const runningUuid = "6c3a1a8c-9e58-4965-8720-0545aabbf889";
    const completedUuid = "8969a32b-7cd7-4177-be5c-c060ea7a8a5c";
    const unrelatedUuid = "c10d4c3a-4a0b-404c-b8bf-027b41879979";
    const sessions = [
      { id: 11, uuid: runningUuid, status: "RUNNING", workerPid: 4321 },
      {
        id: 12,
        uuid: completedUuid,
        status: "COMPLETED",
        workerPid: null,
      },
    ];
    sessions[0].inputManifest = JSON.stringify({
      workerLeaseNonce: "lease-running",
    });
    sessions[1].inputManifest = JSON.stringify({
      workerLeaseNonce: "lease-completed",
    });
    for (const sessionUuid of [runningUuid, completedUuid, unrelatedUuid]) {
      fs.mkdirSync(path.join(comparisonRoot, "uploads", sessionUuid), {
        recursive: true,
      });
      fs.mkdirSync(path.join(comparisonRoot, "runs", sessionUuid), {
        recursive: true,
      });
    }
    const archive = (sessionUuid) =>
      path.join(
        exportDirectory,
        `Gesamtvergleich-${sessionUuid}-aaaaaaaaaaaa.xlsx`
      );
    for (const sessionUuid of [runningUuid, completedUuid, unrelatedUuid])
      fs.writeFileSync(archive(sessionUuid), sessionUuid);

    const prismaImpl = {
      policy_comparison_sessions: {
        findMany: jest.fn().mockResolvedValue(sessions),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const workerSupervisor = { cancel: jest.fn().mockResolvedValue(true) };

    const result = await prepareWorkspaceComparisonDeletion(7, {
      prismaImpl,
      workerSupervisor,
      comparisonRoot,
      exportDirectory,
    });

    expect(
      prismaImpl.policy_comparison_sessions.updateMany
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          id: 11,
          status: "RUNNING",
          inputManifest: sessions[0].inputManifest,
        },
        data: expect.objectContaining({
          status: "CANCELLED",
          cancelRequested: true,
        }),
      })
    );
    expect(workerSupervisor.cancel).toHaveBeenCalledWith({
      sessionUuid: runningUuid,
      leaseNonce: "lease-running",
      waitForExit: true,
      timeoutMs: 2_000,
    });
    expect(workerSupervisor.cancel).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(comparisonRoot, "uploads", runningUuid))).toBe(
      false
    );
    expect(
      fs.existsSync(path.join(comparisonRoot, "runs", completedUuid))
    ).toBe(false);
    expect(fs.existsSync(archive(runningUuid))).toBe(false);
    expect(fs.existsSync(archive(completedUuid))).toBe(false);
    expect(fs.existsSync(archive(unrelatedUuid))).toBe(true);
    expect(
      fs.existsSync(path.join(comparisonRoot, "uploads", unrelatedUuid))
    ).toBe(true);
    expect(result).toEqual({
      sessions: 2,
      cancelledSessions: 1,
      terminatedWorkers: 1,
      removedSessionDirectories: 4,
      removedArchivedWorkbooks: 2,
    });
  });

  test("never kills a stored PID when its exact worker lease is not registered", async () => {
    const session = {
      id: 11,
      uuid: "6c3a1a8c-9e58-4965-8720-0545aabbf889",
      status: "RUNNING",
      workerPid: 4321,
      inputManifest: JSON.stringify({ workerLeaseNonce: "stale-lease" }),
    };
    const prismaImpl = {
      policy_comparison_sessions: {
        findMany: jest.fn().mockResolvedValue([session]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const workerSupervisor = { cancel: jest.fn().mockResolvedValue(false) };

    await expect(
      prepareWorkspaceComparisonDeletion(7, {
        prismaImpl,
        workerSupervisor,
        comparisonRoot,
        exportDirectory,
      })
    ).rejects.toThrow(
      `COMPARISON_WORKER_TERMINATION_UNCONFIRMED:${session.uuid}`
    );
    expect(workerSupervisor.cancel).toHaveBeenCalledWith({
      sessionUuid: session.uuid,
      leaseNonce: "stale-lease",
      waitForExit: true,
      timeoutMs: 2_000,
    });
    expect(fs.existsSync(comparisonRoot)).toBe(false);
  });

  test("cancels an unowned queued lease in the database without trusting a PID", async () => {
    const session = {
      id: 11,
      uuid: "6c3a1a8c-9e58-4965-8720-0545aabbf889",
      status: "QUEUED",
      workerPid: null,
      inputManifest: JSON.stringify({ workerLeaseNonce: "queued-lease" }),
    };
    const prismaImpl = {
      policy_comparison_sessions: {
        findMany: jest.fn().mockResolvedValue([session]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const workerSupervisor = { cancel: jest.fn().mockResolvedValue(false) };

    await expect(
      prepareWorkspaceComparisonDeletion(7, {
        prismaImpl,
        workerSupervisor,
        comparisonRoot,
        exportDirectory,
      })
    ).resolves.toMatchObject({
      cancelledSessions: 1,
      terminatedWorkers: 0,
    });
  });

  test("contains no raw PID kill path", () => {
    const contents = fs.readFileSync(
      path.join(
        __dirname,
        "../../utils/workspaceComparisonDeletion.js"
      ),
      "utf8"
    );
    expect(contents).not.toContain("process.kill");
  });
});
