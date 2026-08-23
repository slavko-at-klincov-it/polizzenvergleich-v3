const { userFromSession } = require("../utils/http");
const { CollectorApi } = require("../utils/collectorApi");
const { WorkspaceThread } = require("../models/workspaceThread");
const { WorkspaceParsedFiles } = require("../models/workspaceParsedFiles");
const {
  ComparisonDocumentService,
} = require("../utils/comparisonDocuments");

jest.mock("../utils/http", () => ({
  reqBody: jest.fn((request) => request.body || {}),
  multiUserMode: jest.fn(() => true),
  userFromSession: jest.fn(),
}));
jest.mock("../utils/files/multer", () => ({
  handleFileUpload: jest.fn(),
}));
jest.mock("../utils/middleware/validatedRequest", () => ({
  validatedRequest: jest.fn(),
}));
jest.mock("../utils/middleware/validWorkspace", () => ({
  validWorkspaceSlug: jest.fn(),
}));
jest.mock("../utils/middleware/multiUserProtected", () => ({
  ROLES: { all: "<all>", admin: "admin", manager: "manager" },
  flexUserRoleValid: jest.fn(() => jest.fn()),
}));
jest.mock("../models/telemetry", () => ({
  Telemetry: { sendTelemetry: jest.fn() },
}));
jest.mock("../models/eventLogs", () => ({
  EventLogs: { logEvent: jest.fn() },
}));
jest.mock("../utils/collectorApi", () => ({
  CollectorApi: jest.fn(),
}));
jest.mock("../models/workspaceThread", () => ({
  WorkspaceThread: { get: jest.fn() },
}));
jest.mock("../models/workspaceParsedFiles", () => ({
  WorkspaceParsedFiles: {
    create: jest.fn(),
    delete: jest.fn(),
    getContextMetadataAndLimits: jest.fn(),
    moveToDocumentsAndEmbed: jest.fn(),
  },
}));
jest.mock("../utils/LocalModelTokenizer", () => ({
  countModelTokens: jest.fn(async () => ({ count: 42, label: "test" })),
}));
jest.mock("../utils/comparisonDocuments", () => ({
  ComparisonDocumentService: {
    reserveParsedFile: jest.fn(),
    removeParsedFile: jest.fn(),
  },
}));

const {
  workspaceParsedFilesEndpoints,
} = require("../endpoints/workspacesParsedFiles");

function responseDouble() {
  const response = {
    locals: { workspace: { id: 1, slug: "policies" } },
    status: jest.fn(),
    json: jest.fn(),
    sendStatus: jest.fn(),
    end: jest.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  response.sendStatus.mockReturnValue(response);
  response.end.mockReturnValue(response);
  return response;
}

describe("workspace parsed-file comparison reservation", () => {
  const collector = {
    online: jest.fn(),
    parseDocument: jest.fn(),
    log: jest.fn(),
  };
  const app = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    CollectorApi.mockImplementation(() => collector);
    collector.online.mockResolvedValue(true);
    collector.parseDocument.mockResolvedValue({
      success: true,
      documents: [
        {
          id: "collector-1",
          title: "Policy A.pdf",
          location: "policy-a.json",
          pageContent: "Vandalismus ist versichert.",
          pdfExtraction: { totalPages: 1 },
        },
      ],
    });
    userFromSession.mockResolvedValue({ id: 3, role: "default" });
    WorkspaceThread.get.mockResolvedValue({
      id: 2,
      slug: "thread-a",
      workspace_id: 1,
      user_id: 3,
    });
    WorkspaceParsedFiles.create.mockResolvedValue({
      file: {
        id: 4,
        workspaceId: 1,
        threadId: 2,
        userId: 3,
        filename: "Policy A.pdf-collector-1.json",
        tokenCountEstimate: 42,
        metadata: JSON.stringify({
          location: "policy-a.json",
          originalFilename: "Policy A.pdf",
          mimeType: "application/pdf",
          pdfExtraction: { totalPages: 1 },
        }),
      },
      error: null,
    });
    ComparisonDocumentService.reserveParsedFile.mockResolvedValue({
      id: 5,
      slot: "A",
      status: "indexing",
    });
    ComparisonDocumentService.removeParsedFile.mockResolvedValue(true);
    workspaceParsedFilesEndpoints(app);
  });

  function parseHandler() {
    return app.post.mock.calls.find(
      ([route]) => route === "/workspace/:slug/parse"
    )[2];
  }

  function requestDouble() {
    return {
      body: { threadSlug: "thread-a" },
      file: {
        originalname: "Policy A.pdf",
        mimetype: "application/pdf",
        path: "/tmp/policy-a.pdf",
      },
    };
  }

  it("reserves the thread slot before returning a parsed upload", async () => {
    const response = responseDouble();

    await parseHandler()(requestDouble(), response);

    expect(ComparisonDocumentService.reserveParsedFile).toHaveBeenCalledWith({
      workspace: response.locals.workspace,
      thread: expect.objectContaining({ id: 2 }),
      user: { id: 3, role: "default" },
      parsedFile: expect.objectContaining({ id: 4, threadId: 2 }),
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it("cleans the parsed source when the two-slot reservation is rejected", async () => {
    const limitError = Object.assign(new Error("At most two documents."), {
      statusCode: 409,
    });
    ComparisonDocumentService.reserveParsedFile.mockRejectedValue(limitError);
    const response = responseDouble();

    await parseHandler()(requestDouble(), response);

    expect(ComparisonDocumentService.removeParsedFile).toHaveBeenCalledWith({
      workspace: response.locals.workspace,
      thread: expect.objectContaining({ id: 2 }),
      user: { id: 3, role: "default" },
      parsedFileId: 4,
    });
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: "At most two documents.",
    });
  });

  it("rejects an unknown thread before collector parsing", async () => {
    WorkspaceThread.get.mockResolvedValue(null);
    const response = responseDouble();

    await parseHandler()(requestDouble(), response);

    expect(collector.parseDocument).not.toHaveBeenCalled();
    expect(WorkspaceParsedFiles.create).not.toHaveBeenCalled();
    expect(ComparisonDocumentService.reserveParsedFile).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(404);
  });
});
