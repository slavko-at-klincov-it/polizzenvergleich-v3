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
      policy_comparison_installation_state: "pending:2",
    });
  });

  test("accepts only the known topology of an interrupted v1 install", async () => {
    const settings = {
      policy_comparison_installation_version: null,
      policy_comparison_installation_state: "pending:1",
    };
    const prisma = {
      system_settings: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve({ value: settings[where.label] })
        ),
      },
      users: { count: jest.fn().mockResolvedValue(0) },
      workspaces: { count: jest.fn().mockResolvedValue(0) },
      workspace_documents: { count: jest.fn().mockResolvedValue(0) },
      workspace_chats: { count: jest.fn().mockResolvedValue(0) },
      workspace_threads: { count: jest.fn().mockResolvedValue(0) },
    };
    const { guardFirstProvisioning } = loadWithMocks(prisma);

    await expect(guardFirstProvisioning()).resolves.toBeUndefined();
  });

  test("ready requires local no-login mode, workspace, and provider env", async () => {
    Object.assign(process.env, {
      LLM_PROVIDER: "lmstudio",
      LMSTUDIO_BASE_PATH: "http://127.0.0.1:1234/v1",
      LMSTUDIO_MODEL_PREF: "qwen/qwen3.8-27b",
      LMSTUDIO_MODEL_TOKEN_LIMIT: "42496",
      EMBEDDING_ENGINE: "lmstudio",
      EMBEDDING_BASE_PATH: "http://127.0.0.1:1234/v1",
      EMBEDDING_MODEL_PREF: "dinghy-embed",
      EMBEDDING_MODEL_MAX_CHUNK_LENGTH: "8192",
      EMBEDDING_QUERY_PREFIX:
        "Instruct: Retrieve all relevant passages from German and Austrian insurance contracts for exact clause comparison, including deductibles, exclusions, limits, monetary amounts, percentages, conditions, and synonymous wording.",
      VECTOR_DB: "lancedb",
      POLICY_MANAGED_EMBEDDING: "true",
      TARGET_OCR_LANG: "deu,eng",
      POLICY_SINGLE_USER_NO_AUTH: "true",
      AUTH_TOKEN: "",
    });
    const prompt = fs
      .readFileSync(
        path.join(repo, "scripts/macos/policy-system-prompt.txt"),
        "utf8"
      )
      .trim();
    const workspace = {
      id: 3,
      slug: "polizzenvergleich",
      chatMode: "chat",
      chatProvider: "lmstudio",
      chatModel: null,
      topN: 8,
      similarityThreshold: 0.2,
      vectorSearchMode: "default",
      openAiPrompt: prompt,
    };
    const prisma = {
      workspaces: { findUnique: jest.fn().mockResolvedValue(workspace) },
      system_settings: {
        findUnique: jest.fn(({ where }) => {
          const values = {
            policy_comparison_installation_version: "2",
            policy_comparison_installation_state: "complete:2",
            multi_user_mode: "false",
            onboarding_complete: "true",
            policy_no_auth_mode: "true",
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

  test("migrates managed ownership to single-user without deleting records", async () => {
    const delegates = {
      workspace_threads: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      workspace_chats: {
        updateMany: jest.fn().mockResolvedValue({ count: 4 }),
      },
      workspace_agent_invocations: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      workspace_parsed_files: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      comparison_documents: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      memories: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
      browser_extension_api_keys: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      desktop_mobile_devices: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      system_prompt_variables: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      slash_command_presets: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 11, command: "/polizze", prompt: "Text", description: "D" },
          ]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(delegates)),
    };
    const { migrateManagedWorkspaceToSingleUser } = loadWithMocks(prisma);

    await migrateManagedWorkspaceToSingleUser(7, 2);

    expect(delegates.workspace_threads.updateMany).toHaveBeenCalledWith({
      where: { workspace_id: 7 },
      data: { user_id: null },
    });
    expect(delegates.workspace_chats.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: 7 },
      data: { user_id: null },
    });
    expect(delegates.comparison_documents.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: 7 },
      data: { userId: null },
    });
    expect(delegates.memories.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: null, userId: 2 },
      data: { userId: null },
    });
    expect(
      delegates.browser_extension_api_keys.updateMany
    ).toHaveBeenCalledWith({
      where: { user_id: 2 },
      data: { user_id: null },
    });
    expect(delegates.slash_command_presets.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { uid: 0, userId: null },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test("Doctor never consumes the first-login recovery-code flow", () => {
    const doctor = fs.readFileSync(
      path.join(repo, "scripts/macos/doctor.sh"),
      "utf8"
    );
    expect(doctor).not.toContain("request-token");
    expect(doctor).not.toContain("POLICY_BROKER_PASSWORD");
  });

  test("installer does not request or print application credentials", () => {
    const installer = fs.readFileSync(
      path.join(repo, "scripts/macos/install.sh"),
      "utf8"
    );
    expect(installer).not.toContain("read_new_password");
    expect(installer).not.toContain("POLICY_ADMIN_PASSWORD");
    expect(installer).not.toContain("Makler-Benutzer:");
    expect(installer).toContain("Login: deaktiviert");
  });
});
