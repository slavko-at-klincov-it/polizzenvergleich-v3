const fs = require("fs");
const path = require("path");

const repo = path.resolve(__dirname, "../../..");
const scriptPath = path.join(repo, "scripts/macos/provision.cjs");
const prismaPath = path.join(repo, "server/utils/prisma");
const userPath = path.join(repo, "server/models/user");
const workspacePath = path.join(repo, "server/models/workspace");
const settingsPath = path.join(repo, "server/models/systemSettings");

function loadWithMocks(
  prisma,
  systemSettings = { _updateSettings: jest.fn() }
) {
  jest.resetModules();
  jest.doMock(prismaPath, () => prisma);
  jest.doMock(userPath, () => ({ User: {} }));
  jest.doMock(workspacePath, () => ({ Workspace: {} }));
  jest.doMock(settingsPath, () => ({ SystemSettings: systemSettings }));
  return require(scriptPath);
}

describe("macOS policy provisioning contract", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.POLICY_ADOPT_EXISTING;
  });

  test("rejects any pre-existing database without an installer marker", async () => {
    const prisma = {
      system_settings: { findUnique: jest.fn().mockResolvedValue(null) },
      users: { count: jest.fn().mockResolvedValue(1) },
      workspaces: { count: jest.fn().mockResolvedValue(0) },
      workspace_documents: { count: jest.fn().mockResolvedValue(0) },
      workspace_chats: { count: jest.fn().mockResolvedValue(0) },
      workspace_threads: { count: jest.fn().mockResolvedValue(0) },
    };
    const { guardFirstProvisioning } = loadWithMocks(prisma);
    await expect(guardFirstProvisioning()).rejects.toThrow(
      /Bestehende fremde AnythingLLM-Daten/
    );
  });

  test("marks a clean database pending so an interrupted install can resume", async () => {
    const prisma = {
      system_settings: { findUnique: jest.fn().mockResolvedValue(null) },
      users: { count: jest.fn().mockResolvedValue(0) },
      workspaces: { count: jest.fn().mockResolvedValue(0) },
      workspace_documents: { count: jest.fn().mockResolvedValue(0) },
      workspace_chats: { count: jest.fn().mockResolvedValue(0) },
      workspace_threads: { count: jest.fn().mockResolvedValue(0) },
    };
    const update = jest.fn().mockResolvedValue({ success: true });
    const { guardFirstProvisioning } = loadWithMocks(prisma, {
      _updateSettings: update,
    });
    await guardFirstProvisioning();
    expect(update).toHaveBeenCalledWith({
      policy_comparison_installation_state: "pending:1",
    });
  });

  test("ready requires exact roles, workspace, settings, and provider env", async () => {
    Object.assign(process.env, {
      LLM_PROVIDER: "lmstudio",
      LMSTUDIO_BASE_PATH: "http://127.0.0.1:1234/v1",
      LMSTUDIO_MODEL_PREF: "policy-chat",
      LMSTUDIO_MODEL_TOKEN_LIMIT: "32768",
      EMBEDDING_ENGINE: "lmstudio",
      EMBEDDING_BASE_PATH: "http://127.0.0.1:1234/v1",
      EMBEDDING_MODEL_PREF: "dinghy-law",
      EMBEDDING_MODEL_MAX_CHUNK_LENGTH: "8192",
      EMBEDDING_QUERY_PREFIX:
        "Instruct: Retrieve all relevant passages from German and Austrian insurance contracts for exact clause comparison, including deductibles, exclusions, limits, monetary amounts, percentages, conditions, and synonymous wording.",
      VECTOR_DB: "lancedb",
      TARGET_OCR_LANG: "deu,eng",
    });
    const prompt = fs
      .readFileSync(
        path.join(repo, "scripts/macos/policy-system-prompt.txt"),
        "utf8"
      )
      .trim();
    const admin = { id: 1, username: "admin", role: "admin", suspended: 0 };
    const broker = { id: 2, username: "makler", role: "default", suspended: 0 };
    const workspace = {
      id: 3,
      slug: "polizzenvergleich",
      chatMode: "chat",
      chatProvider: "lmstudio",
      chatModel: "policy-chat",
      topN: 8,
      similarityThreshold: 0.2,
      vectorSearchMode: "default",
      openAiPrompt: prompt,
    };
    const prisma = {
      users: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(where.username === "admin" ? admin : broker)
        ),
      },
      workspaces: { findUnique: jest.fn().mockResolvedValue(workspace) },
      workspace_users: { findFirst: jest.fn().mockResolvedValue({ id: 4 }) },
      system_settings: {
        findUnique: jest.fn(({ where }) => {
          const values = {
            policy_comparison_installation_version: "1",
            policy_comparison_installation_state: "complete:1",
            multi_user_mode: "true",
            onboarding_complete: "true",
          };
          return Promise.resolve({
            label: where.label,
            value: values[where.label],
          });
        }),
      },
    };
    const { status } = loadWithMocks(prisma);
    await expect(status()).resolves.toMatchObject({
      ready: true,
      problems: [],
    });
  });

  test("Doctor never consumes the first-login recovery-code flow", () => {
    const doctor = fs.readFileSync(
      path.join(repo, "scripts/macos/doctor.sh"),
      "utf8"
    );
    expect(doctor).not.toContain("request-token");
    expect(doctor).not.toContain("POLICY_BROKER_PASSWORD");
  });
});
