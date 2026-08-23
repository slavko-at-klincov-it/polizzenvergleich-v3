const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const dotenv = require("../../../server/node_modules/dotenv");

const repo = path.resolve(__dirname, "../../..");
const {
  MANAGED_EMBEDDING_ENV,
  EXPECTED_EMBEDDING_DIMENSIONS,
  assertManagedEmbeddingEnvironment,
  assertManagedEmbeddingVector,
} = require(path.join(repo, "shared/managedEmbeddingContract.cjs"));

describe("managed Dinghy embedding contract", () => {
  test("write-config is restart-stable and ignores model alias overrides", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "policy-config-"));
    for (const directory of ["server", "collector", "frontend"])
      fs.mkdirSync(path.join(temp, directory), { recursive: true });
    fs.writeFileSync(
      path.join(temp, "server/.env"),
      'JWT_SECRET="keep-secret"\nUNRELATED="keep"\n'
    );
    const lanceSentinel = path.join(temp, "server/storage/lancedb/sentinel");
    fs.mkdirSync(path.dirname(lanceSentinel), { recursive: true });
    fs.writeFileSync(lanceSentinel, "keep-index");

    try {
      for (let run = 0; run < 2; run += 1) {
        const result = spawnSync(
          process.execPath,
          [path.join(repo, "scripts/macos/write-config.cjs")],
          {
            env: {
              ...process.env,
              POLICY_REPO_DIR: temp,
              POLICY_EMBED_MODEL_ID: "Xenova/all-MiniLM-L6-v2",
            },
            encoding: "utf8",
          }
        );
        expect(result.status).toBe(0);
      }
      const environment = dotenv.parse(
        fs.readFileSync(path.join(temp, "server/.env"), "utf8")
      );
      expect(() => assertManagedEmbeddingEnvironment(environment)).not.toThrow();
      expect(environment.EMBEDDING_MODEL_PREF).toBe("dinghy-embed");
      expect(environment.UNRELATED).toBe("keep");
      expect(fs.readFileSync(lanceSentinel, "utf8")).toBe("keep-index");
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });

  test.each(Object.keys(MANAGED_EMBEDDING_ENV))(
    "fails closed when %s drifts after restart",
    (key) => {
      expect(() =>
        assertManagedEmbeddingEnvironment({
          ...MANAGED_EMBEDDING_ENV,
          [key]: "tampered",
        })
      ).toThrow(key);
    }
  );

  test("accepts only 2560-dimensional vectors in managed mode", () => {
    const previous = process.env.POLICY_MANAGED_EMBEDDING;
    process.env.POLICY_MANAGED_EMBEDDING = "true";
    try {
      expect(EXPECTED_EMBEDDING_DIMENSIONS).toBe(2560);
      expect(() => assertManagedEmbeddingVector(Array(2560).fill(0))).not.toThrow();
      expect(() => assertManagedEmbeddingVector(Array(384).fill(0))).toThrow(
        "LanceDB was not opened"
      );
    } finally {
      if (previous == null) delete process.env.POLICY_MANAGED_EMBEDDING;
      else process.env.POLICY_MANAGED_EMBEDDING = previous;
    }
  });
});
