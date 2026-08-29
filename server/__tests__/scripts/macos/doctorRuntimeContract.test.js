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
});
