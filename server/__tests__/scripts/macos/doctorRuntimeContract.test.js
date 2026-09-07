const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

describe("macOS doctor runtime contract", () => {
  test("runs Prisma with the pinned Node runtime in a standalone shell", () => {
    const doctor = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "scripts/macos/doctor.sh"),
      "utf8"
    );

    expect(doctor).toContain(
      '"$V3_NODE_BIN" "$V3_REPO_DIR/server/node_modules/.bin/prisma" migrate status'
    );
    expect(doctor).not.toMatch(
      /&&\s*"\$V3_REPO_DIR\/server\/node_modules\/\.bin\/prisma"\s+migrate\s+status/u
    );
  });

  test("requires the two-lane Qwen runtime used by isolated LF target calls", () => {
    const doctor = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "scripts/macos/doctor.sh"),
      "utf8"
    );
    const loader = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "scripts/macos/load-qwen36.cjs"),
      "utf8"
    );

    expect(loader).toContain("maxParallelPredictions: 2");
    expect(doctor).toContain("Qwen 3.6: Kontext 42.496, Parallelität 2");
    expect(doctor).toContain("42496[[:space:]]+2[[:space:]]");
  });
});
