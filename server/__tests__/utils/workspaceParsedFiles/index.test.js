const fs = require("fs");
const os = require("os");
const path = require("path");

const testRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "workspace-parsed-files-")
);
const mockDirectUploadsPath = path.join(testRoot, "direct-uploads");
const mockDocumentsPath = path.join(testRoot, "documents");

jest.mock("../../../utils/prisma", () => ({
  workspace_parsed_files: {
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
  },
}));
jest.mock("../../../models/eventLogs", () => ({
  EventLogs: { logEvent: jest.fn() },
}));
jest.mock("../../../models/documents", () => ({
  Document: { addDocuments: jest.fn(), get: jest.fn() },
}));
jest.mock("../../../utils/files", () => ({
  directUploadsPath: mockDirectUploadsPath,
  documentsPath: mockDocumentsPath,
}));
jest.mock("../../../utils/http", () => ({
  safeJsonParse: (value, fallback) => {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  },
}));

const prisma = require("../../../utils/prisma");
const { Document } = require("../../../models/documents");
const {
  WorkspaceParsedFiles,
} = require("../../../models/workspaceParsedFiles");

describe("WorkspaceParsedFiles.moveToDocumentsAndEmbed", () => {
  const workspace = { id: 7, slug: "policies" };
  const user = { id: 11 };
  const location = "upload.json";
  const sourceFile = path.join(mockDirectUploadsPath, location);
  const embeddedPath = `custom-documents/${location}`;

  beforeEach(() => {
    jest.clearAllMocks();
    fs.mkdirSync(mockDirectUploadsPath, { recursive: true });
    fs.mkdirSync(mockDocumentsPath, { recursive: true });
    fs.writeFileSync(sourceFile, JSON.stringify({ pageContent: "policy" }));
    prisma.workspace_parsed_files.findFirst.mockResolvedValue({
      id: 5,
      workspaceId: workspace.id,
      userId: user.id,
      metadata: JSON.stringify({ location }),
    });
    prisma.workspace_parsed_files.deleteMany.mockResolvedValue({ count: 1 });
  });

  afterAll(() => fs.rmSync(testRoot, { recursive: true, force: true }));

  test("returns ready only after vector and document record commit", async () => {
    const document = { id: 99, docpath: embeddedPath };
    Document.addDocuments.mockResolvedValue({
      embedded: [embeddedPath],
      failedToEmbed: [],
      errors: [],
    });
    Document.get.mockResolvedValue(document);

    await expect(
      WorkspaceParsedFiles.moveToDocumentsAndEmbed(user, 5, workspace)
    ).resolves.toEqual({ success: true, error: null, document });
    expect(prisma.workspace_parsed_files.deleteMany).toHaveBeenCalled();
    expect(fs.existsSync(sourceFile)).toBe(false);
  });

  test("treats source cleanup as best-effort after a successful commit", async () => {
    const document = { id: 99, docpath: embeddedPath };
    Document.addDocuments.mockResolvedValue({
      embedded: [embeddedPath],
      failedToEmbed: [],
      errors: [],
    });
    Document.get.mockResolvedValue(document);
    const unlink = jest.spyOn(fs, "unlinkSync").mockImplementationOnce(() => {
      throw new Error("source busy");
    });
    jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      WorkspaceParsedFiles.moveToDocumentsAndEmbed(user, 5, workspace)
    ).resolves.toEqual({ success: true, error: null, document });
    expect(prisma.workspace_parsed_files.deleteMany).toHaveBeenCalled();

    unlink.mockRestore();
    console.warn.mockRestore();
  });

  test("keeps parsed source retryable when no vector commit is reported", async () => {
    Document.addDocuments.mockResolvedValue({
      embedded: [],
      failedToEmbed: [],
      errors: [],
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await WorkspaceParsedFiles.moveToDocumentsAndEmbed(
      user,
      5,
      workspace
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Document vector commit did not complete");
    expect(prisma.workspace_parsed_files.deleteMany).not.toHaveBeenCalled();
    expect(fs.existsSync(sourceFile)).toBe(true);
    expect(fs.existsSync(path.join(mockDocumentsPath, embeddedPath))).toBe(
      false
    );

    console.error.mockRestore();
  });
});
