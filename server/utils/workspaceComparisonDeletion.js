const fs = require("fs");
const path = require("path");
const prisma = require("./prisma");
const { isWithin, policyComparisonsPath } = require("./files");
const {
  configuredExportDirectory,
} = require("./policyComparison/workbookArchive");
const {
  policyComparisonWorkerSupervisor,
} = require("./policyComparison/workerSupervisor");

const LOCKED_COMPARISON_STATUSES = Object.freeze(["QUEUED", "RUNNING"]);
const ARCHIVE_PREFIXES = Object.freeze([
  "LF-IMMO-Referenzvergleich",
  "Gesamtvergleich",
]);

function workerLeaseNonce(inputManifest) {
  try {
    return JSON.parse(inputManifest || "null")?.workerLeaseNonce || null;
  } catch {
    return null;
  }
}

function removeSessionDirectory({
  comparisonRoot,
  directory,
  sessionUuid,
  fsImpl,
}) {
  const parent = path.resolve(comparisonRoot, directory);
  const target = path.resolve(parent, sessionUuid);
  if (!isWithin(parent, target))
    throw new Error("COMPARISON_STORAGE_PATH_INVALID");
  if (!fsImpl.existsSync(target)) return false;
  fsImpl.rmSync(target, { recursive: true, force: true });
  return true;
}

function archiveFilenamePattern(sessionUuid) {
  const escapedUuid = String(sessionUuid).replace(
    /[.*+?^${}()|[\]\\]/gu,
    "\\$&"
  );
  return new RegExp(
    `^(?:${ARCHIVE_PREFIXES.join("|")})-${escapedUuid}-[0-9a-f]{12}\\.xlsx$`,
    "iu"
  );
}

function removeArchivedWorkbooks({ sessionUuids, exportDirectory, fsImpl }) {
  if (!exportDirectory || !fsImpl.existsSync(exportDirectory)) return 0;
  const exportRoot = path.resolve(exportDirectory);
  const exportStat = fsImpl.lstatSync(exportRoot);
  if (!exportStat.isDirectory() || exportStat.isSymbolicLink())
    throw new Error("COMPARISON_EXPORT_DIRECTORY_INVALID");
  const patterns = sessionUuids.map(archiveFilenamePattern);
  let removed = 0;
  for (const filename of fsImpl.readdirSync(exportRoot)) {
    if (!patterns.some((pattern) => pattern.test(filename))) continue;
    const target = path.resolve(exportRoot, filename);
    if (!isWithin(exportRoot, target))
      throw new Error("COMPARISON_EXPORT_PATH_INVALID");
    const stat = fsImpl.lstatSync(target);
    if (stat.isDirectory()) throw new Error("COMPARISON_EXPORT_FILE_INVALID");
    fsImpl.unlinkSync(target);
    removed += 1;
  }
  return removed;
}

async function prepareWorkspaceComparisonDeletion(
  workspaceId,
  {
    prismaImpl = prisma,
    fsImpl = fs,
    workerSupervisor = policyComparisonWorkerSupervisor,
    comparisonRoot = policyComparisonsPath,
    exportDirectory = configuredExportDirectory(),
  } = {}
) {
  const normalizedWorkspaceId = Number(workspaceId);
  if (!Number.isInteger(normalizedWorkspaceId) || normalizedWorkspaceId <= 0)
    throw new Error("WORKSPACE_ID_INVALID");

  const sessions = await prismaImpl.policy_comparison_sessions.findMany({
    where: { workspaceId: normalizedWorkspaceId },
    select: {
      id: true,
      uuid: true,
      status: true,
      inputManifest: true,
      workerPid: true,
    },
  });
  const unsettledSessions = sessions.filter(
    ({ status, workerPid }) =>
      LOCKED_COMPARISON_STATUSES.includes(status) ||
      (status === "CANCELLED" && Number.isInteger(workerPid) && workerPid > 1)
  );
  let cancelledSessions = 0;
  let terminatedWorkers = 0;
  for (const session of unsettledSessions) {
    if (LOCKED_COMPARISON_STATUSES.includes(session.status)) {
      const cancelled = await prismaImpl.policy_comparison_sessions.updateMany({
        where: {
          id: session.id,
          status: session.status,
          inputManifest: session.inputManifest,
        },
        data: {
          status: "CANCELLED",
          cancelRequested: true,
          error: null,
          completedAt: new Date(),
          lastUpdatedAt: new Date(),
        },
      });
      if (cancelled.count !== 1)
        throw new Error(`COMPARISON_SESSION_CHANGED:${session.uuid}`);
      cancelledSessions += 1;
    }

    const leaseNonce = workerLeaseNonce(session.inputManifest);
    const supervisorCancelled = leaseNonce
      ? await workerSupervisor.cancel({
          sessionUuid: session.uuid,
          leaseNonce,
          waitForExit: true,
          timeoutMs: 2_000,
        })
      : false;
    if (supervisorCancelled) {
      terminatedWorkers += 1;
      if (Number.isInteger(session.workerPid) && session.workerPid > 1) {
        const released = await prismaImpl.policy_comparison_sessions.updateMany(
          {
            where: {
              id: session.id,
              status: "CANCELLED",
              inputManifest: session.inputManifest,
              workerPid: session.workerPid,
            },
            data: { workerPid: null, lastUpdatedAt: new Date() },
          }
        );
        if (released.count !== 1)
          throw new Error(`COMPARISON_SESSION_CHANGED:${session.uuid}`);
      }
      continue;
    }
    if (
      session.status === "RUNNING" ||
      (Number.isInteger(session.workerPid) && session.workerPid > 1)
    )
      throw new Error(
        `COMPARISON_WORKER_TERMINATION_UNCONFIRMED:${session.uuid}`
      );
  }

  let removedSessionDirectories = 0;
  for (const { uuid } of sessions) {
    for (const directory of ["uploads", "runs"])
      if (
        removeSessionDirectory({
          comparisonRoot,
          directory,
          sessionUuid: uuid,
          fsImpl,
        })
      )
        removedSessionDirectories += 1;
  }
  const removedArchivedWorkbooks = removeArchivedWorkbooks({
    sessionUuids: sessions.map(({ uuid }) => uuid),
    exportDirectory,
    fsImpl,
  });

  return {
    sessions: sessions.length,
    cancelledSessions,
    terminatedWorkers,
    removedSessionDirectories,
    removedArchivedWorkbooks,
  };
}

module.exports = {
  LOCKED_COMPARISON_STATUSES,
  prepareWorkspaceComparisonDeletion,
};
