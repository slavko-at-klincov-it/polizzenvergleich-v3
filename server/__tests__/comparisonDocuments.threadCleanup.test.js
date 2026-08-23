const prisma = require("../utils/prisma");
const {
  ComparisonDocumentService,
} = require("../utils/comparisonDocuments");
const { WorkspaceChats } = require("../models/workspaceChats");

jest.mock("../utils/prisma", () => ({
  workspace_threads: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
}));
jest.mock("../utils/comparisonDocuments", () => ({
  ComparisonDocumentService: { cleanupThreads: jest.fn() },
}));
jest.mock("../models/workspaceChats", () => ({
  WorkspaceChats: { delete: jest.fn() },
}));

const { WorkspaceThread } = require("../models/workspaceThread");

describe("WorkspaceThread comparison cleanup", () => {
  beforeEach(() => jest.clearAllMocks());

  it("cleans external comparison artifacts before deleting chats and thread", async () => {
    const threads = [{ id: 2, workspace_id: 1, user_id: 3 }];
    prisma.workspace_threads.findMany.mockResolvedValue(threads);
    ComparisonDocumentService.cleanupThreads.mockResolvedValue(true);
    WorkspaceChats.delete.mockResolvedValue(true);
    prisma.workspace_threads.deleteMany.mockResolvedValue({ count: 1 });

    await expect(WorkspaceThread.delete({ id: 2 })).resolves.toBe(true);

    expect(ComparisonDocumentService.cleanupThreads).toHaveBeenCalledWith(
      threads
    );
    expect(
      ComparisonDocumentService.cleanupThreads.mock.invocationCallOrder[0]
    ).toBeLessThan(WorkspaceChats.delete.mock.invocationCallOrder[0]);
    expect(WorkspaceChats.delete.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.workspace_threads.deleteMany.mock.invocationCallOrder[0]
    );
  });

  it("keeps the thread when external cleanup fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    prisma.workspace_threads.findMany.mockResolvedValue([
      { id: 2, workspace_id: 1, user_id: 3 },
    ]);
    ComparisonDocumentService.cleanupThreads.mockRejectedValue(
      new Error("vector cleanup failed")
    );

    await expect(WorkspaceThread.delete({ id: 2 })).resolves.toBe(false);
    expect(WorkspaceChats.delete).not.toHaveBeenCalled();
    expect(prisma.workspace_threads.deleteMany).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
