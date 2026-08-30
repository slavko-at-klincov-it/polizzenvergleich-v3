const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  releaseIdentity,
} = require("../../../utils/policyAnalysis/runIdentity");

function git(root, ...args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr);
}

describe("policy analysis run identity", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "run-identity-"));
    git(root, "init", "-q");
    git(root, "config", "user.email", "qa@example.invalid");
    git(root, "config", "user.name", "QA");
    fs.writeFileSync(
      path.join(root, ".gitignore"),
      ".runtime\nserver/storage/policy-comparisons/\n"
    );
    fs.writeFileSync(path.join(root, "tracked.txt"), "stable");
    git(root, "add", ".gitignore", "tracked.txt");
    git(root, "commit", "-qm", "fixture");
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("ignores generated runtime and comparison artifacts", () => {
    const initial = releaseIdentity(root);
    fs.symlinkSync("/tmp/runtime", path.join(root, ".runtime"));
    const storage = path.join(root, "server/storage/policy-comparisons/run");
    fs.mkdirSync(storage, { recursive: true });
    fs.writeFileSync(path.join(storage, "result.private.json"), "generated");

    expect(releaseIdentity(root)).toBe(initial);
  });

  test("changes when untracked source evidence changes", () => {
    const initial = releaseIdentity(root);
    fs.writeFileSync(path.join(root, "new-source.js"), "one");
    const withSource = releaseIdentity(root);
    fs.writeFileSync(path.join(root, "new-source.js"), "two");

    expect(withSource).not.toBe(initial);
    expect(releaseIdentity(root)).not.toBe(withSource);
  });
});
