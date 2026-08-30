const fs = require("fs");
const path = require("path");
const prisma = require("../utils/prisma");
const { isWithin, policyComparisonsPath } = require("../utils/files");
const { log, conclude } = require("./helpers/index.js");

function removeUnknownSessionDirectories(parent, knownSessionUuids) {
  if (!fs.existsSync(parent)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory() || knownSessionUuids.has(entry.name)) continue;
    const target = path.resolve(parent, entry.name);
    if (!isWithin(parent, target)) continue;
    fs.rmSync(target, { recursive: true });
    removed++;
  }
  return removed;
}

(async () => {
  try {
    const sessions = await prisma.policy_comparison_sessions.findMany({
      select: { uuid: true },
    });
    const knownSessionUuids = new Set(sessions.map(({ uuid }) => uuid));
    const removedUploads = removeUnknownSessionDirectories(
      path.join(policyComparisonsPath, "uploads"),
      knownSessionUuids
    );
    const removedRuns = removeUnknownSessionDirectories(
      path.join(policyComparisonsPath, "runs"),
      knownSessionUuids
    );
    if (removedUploads + removedRuns > 0)
      log(
        `Removed ${removedUploads} orphaned upload directories and ${removedRuns} orphaned run directories`
      );
  } catch (error) {
    console.error(error);
    log(`errored with ${error.message}`);
  } finally {
    await prisma.$disconnect();
    conclude();
  }
})();
