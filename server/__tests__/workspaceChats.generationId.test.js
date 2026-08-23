const prisma = require("../utils/prisma");

jest.mock("../utils/prisma", () => ({
  workspace_chats: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}));

const { WorkspaceChats } = require("../models/workspaceChats");

describe("WorkspaceChats durable generation identity", () => {
  beforeEach(() => jest.clearAllMocks());

  test("replays an existing generation without creating a second chat row", async () => {
    const existing = {
      id: 7,
      generationId: "9c270d79-e60d-4d3e-b84e-a043f9de7a3b",
      prompt: "Vergleiche",
    };
    prisma.workspace_chats.findUnique.mockResolvedValue(existing);

    await expect(
      WorkspaceChats.new({
        workspaceId: 1,
        threadId: 2,
        user: { id: 3 },
        prompt: "Vergleiche",
        generationId: existing.generationId,
      })
    ).resolves.toEqual({ chat: existing, message: null, existing: true });
    expect(prisma.workspace_chats.create).not.toHaveBeenCalled();
  });

  test("recovers an insert race by returning the single durable row", async () => {
    const existing = {
      id: 8,
      generationId: "ad44e068-f7cb-454d-ac49-5dda0488a707",
    };
    prisma.workspace_chats.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    prisma.workspace_chats.create.mockRejectedValue({
      code: "P2002",
      message: "unique",
    });

    await expect(
      WorkspaceChats.new({
        workspaceId: 1,
        threadId: 2,
        user: { id: 3 },
        prompt: "Vergleiche",
        generationId: existing.generationId,
      })
    ).resolves.toEqual({ chat: existing, message: null, existing: true });
    expect(prisma.workspace_chats.create).toHaveBeenCalledTimes(1);
  });
});
