const { userFromSession } = require("../utils/http");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const {
  ComparisonDocumentService,
} = require("../utils/comparisonDocuments");

jest.mock("../utils/http", () => ({ userFromSession: jest.fn() }));
jest.mock("../utils/middleware/validatedRequest", () => ({
  validatedRequest: jest.fn(),
}));
jest.mock("../utils/middleware/validWorkspace", () => ({
  validWorkspaceAndThreadSlug: jest.fn(),
}));
jest.mock("../utils/middleware/multiUserProtected", () => ({
  ROLES: { all: "<all>" },
  flexUserRoleValid: jest.fn(() => jest.fn()),
}));
jest.mock("../utils/comparisonDocuments", () => ({
  ComparisonDocumentService: {
    list: jest.fn(),
    embedParsedFile: jest.fn(),
    remove: jest.fn(),
    removeParsedFile: jest.fn(),
  },
}));

const {
  comparisonDocumentEndpoints,
} = require("../endpoints/comparisonDocuments");

function responseDouble() {
  const response = {
    locals: {
      workspace: { id: 1, slug: "policies" },
      thread: { id: 2, slug: "thread-a" },
    },
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

describe("comparisonDocumentEndpoints", () => {
  const app = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(() => {
    app.get.mockClear();
    app.post.mockClear();
    app.delete.mockClear();
    userFromSession.mockReset();
    ComparisonDocumentService.list.mockReset();
    ComparisonDocumentService.embedParsedFile.mockReset();
    ComparisonDocumentService.remove.mockReset();
    ComparisonDocumentService.removeParsedFile.mockReset();
    comparisonDocumentEndpoints(app);
    userFromSession.mockResolvedValue({ id: 3, role: "default" });
  });

  it("uses the all-role middleware while retaining workspace/thread scoping", () => {
    expect(flexUserRoleValid).toHaveBeenCalledWith([ROLES.all]);
    expect(app.get.mock.calls[0][0]).toBe(
      "/workspace/:slug/thread/:threadSlug/comparison-documents"
    );
  });

  it("returns the stable POST embed contract", async () => {
    const document = { id: 5, slot: "A", status: "ready" };
    ComparisonDocumentService.embedParsedFile.mockResolvedValue(document);
    const handler = app.post.mock.calls[0][2];
    const response = responseDouble();

    await handler({ params: { fileId: "4" } }, response);

    expect(ComparisonDocumentService.embedParsedFile).toHaveBeenCalledWith({
      workspace: response.locals.workspace,
      thread: response.locals.thread,
      user: { id: 3, role: "default" },
      parsedFileId: "4",
    });
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      error: null,
      document,
    });
  });

  it("returns the stable GET and DELETE contracts", async () => {
    ComparisonDocumentService.list.mockResolvedValue([{ id: 5 }]);
    ComparisonDocumentService.remove.mockResolvedValue(true);
    const getHandler = app.get.mock.calls[0][2];
    const deleteHandler = app.delete.mock.calls[0][2];
    const getResponse = responseDouble();
    const deleteResponse = responseDouble();

    await getHandler({ params: {} }, getResponse);
    await deleteHandler({ params: { id: "5" } }, deleteResponse);

    expect(getResponse.json).toHaveBeenCalledWith({ documents: [{ id: 5 }] });
    expect(deleteResponse.json).toHaveBeenCalledWith({
      success: true,
      error: null,
    });
  });

  it("deletes a parsed source only through its workspace and thread scope", async () => {
    ComparisonDocumentService.removeParsedFile.mockResolvedValue(true);
    const handler = app.delete.mock.calls[1][2];
    const response = responseDouble();

    await handler({ params: { fileId: "17" } }, response);

    expect(ComparisonDocumentService.removeParsedFile).toHaveBeenCalledWith({
      workspace: response.locals.workspace,
      thread: response.locals.thread,
      user: { id: 3, role: "default" },
      parsedFileId: "17",
    });
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      error: null,
    });
  });
});
