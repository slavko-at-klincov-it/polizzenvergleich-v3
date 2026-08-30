const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function git(repository, args, encoding = "utf8") {
  const result = spawnSync("git", ["-C", repository, ...args], {
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(
      `Release-Identität konnte nicht ermittelt werden: ${String(result.stderr || "git fehlgeschlagen").trim()}`
    );
  return result.stdout;
}

function releaseIdentity(repository) {
  const root = path.resolve(repository);
  const head = git(root, ["rev-parse", "HEAD"]).trim();
  const dirtyState = git(root, [
    "status",
    "--porcelain=v1",
    "--untracked-files=normal",
  ]);
  if (!dirtyState) return head;

  const digest = crypto.createHash("sha256");
  digest.update(dirtyState);
  digest.update(git(root, ["diff", "--binary", "HEAD"], null));
  const untracked = git(root, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ])
    .split("\0")
    .filter(Boolean)
    .sort();
  for (const relativeFile of untracked) {
    const absoluteFile = path.join(root, relativeFile);
    digest.update(relativeFile);
    if (fs.existsSync(absoluteFile) && fs.statSync(absoluteFile).isFile())
      digest.update(fs.readFileSync(absoluteFile));
  }
  return `${head}-dirty-${digest.digest("hex")}`;
}

module.exports = { releaseIdentity, sha256 };
