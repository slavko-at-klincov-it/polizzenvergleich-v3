const { EventEmitter } = require("events");

const mockWorkspaceChats = {
  new: jest.fn(),
  _update: jest.fn(),
};
const mockVectorDb = {
  hasNamespace: jest.fn(),
  namespaceCount: jest.fn(),
  performSimilaritySearch: jest.fn(),
};
const mockConnector = {
  promptWindowLimit: jest.fn(() => 32_768),
  streamingEnabled: jest.fn(() => true),
  compressMessages: jest.fn(),
  streamGetChatCompletion: jest.fn(),
  handleStream: jest.fn(),
};

jest.mock("../../../models/workspaceChats", () => ({
  WorkspaceChats: mockWorkspaceChats,
}));
jest.mock("../../../models/workspaceParsedFiles", () => ({
  WorkspaceParsedFiles: { getContextFiles: jest.fn(() => []) },
}));
jest.mock("../../../models/comparisonDocument", () => ({
  ComparisonDocument: { where: jest.fn(() => []) },
}));
jest.mock("../../../utils/DocumentManager", () => ({
  DocumentManager: class {
    async pinnedDocs() {
      return [];
    }
  },
}));
jest.mock("../../../utils/helpers", () => ({
  getVectorDbClass: jest.fn(() => mockVectorDb),
  resolveProviderConnector: jest.fn(async () => ({
    connector: mockConnector,
    routingMetadata: null,
    prefetchedContext: null,
  })),
}));
jest.mock("../../../utils/PolicyComparison/ComparisonHybridRetriever", () => ({
  ComparisonHybridRetriever: { retrieve: jest.fn(() => ({ active: false })) },
}));
jest.mock("../../../utils/chats/agents", () => ({
  grepAgents: jest.fn(() => false),
}));
jest.mock("../../../utils/chats/index", () => ({
  grepCommand: jest.fn(async (message) => message),
  VALID_COMMANDS: {},
  chatPrompt: jest.fn(() => "system"),
  recentChatHistory: jest.fn(() => ({
    rawHistory: [],
    chatHistory: [],
    pinnedDocs: [],
    parsedFiles: [],
  })),
  sourceIdentifier: jest.fn((doc) => doc?.id),
}));

const {
  ChatGenerationManager,
  detachedStreamResponse,
} = require("../../../utils/chats/ChatGenerationManager");
const {
  handleDefaultStreamResponseV2,
} = require("../../../utils/helpers/chat/responses");
const { streamChatWithWorkspace } = require("../../../utils/chats/stream");

function fakeHttpResponse() {
  const response = new EventEmitter();
  response.writableEnded = false;
  response.destroyed = false;
  response.write = jest.fn(() => true);
  return response;
}

describe("thread-independent streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkspaceChats.new.mockResolvedValue({ chat: { id: 77 } });
    mockWorkspaceChats._update.mockResolvedValue(true);
    mockVectorDb.hasNamespace.mockResolvedValue(false);
    mockVectorDb.namespaceCount.mockResolvedValue(0);
    mockConnector.compressMessages.mockResolvedValue([]);
  });

  test("A continues after navigation, B is separate, and duplicate A is rejected", async () => {
    const manager = new ChatGenerationManager();
    const scopeA = { workspaceId: 1, threadId: 10, userId: 5 };
    const scopeB = { workspaceId: 1, threadId: 11, userId: 5 };
    const claimedA = manager.begin(scopeA, "generation-a");
    expect(manager.begin(scopeA, "generation-a-duplicate").created).toBe(false);
    expect(manager.begin(scopeB, "generation-b").created).toBe(true);

    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const providerStream = (async function* () {
      yield { choices: [{ delta: { content: "Teil " } }] };
      await gate;
      yield {
        choices: [{ delta: { content: "fertig" }, finish_reason: "stop" }],
      };
    })();
    providerStream.metrics = { outputTps: 10 };
    providerStream.endMeasurement = jest.fn();
    mockConnector.streamGetChatCompletion.mockResolvedValue(providerStream);
    mockConnector.handleStream.mockImplementation((response, stream, props) =>
      handleDefaultStreamResponseV2(response, stream, props)
    );

    const httpResponse = fakeHttpResponse();
    const detached = detachedStreamResponse(httpResponse, claimedA.generation);
    const run = streamChatWithWorkspace(
      detached,
      { id: 1, slug: "polizzen", chatMode: "chat", topN: 4 },
      "Vergleiche die Selbstbehalte",
      "chat",
      { id: 5 },
      { id: 10, slug: "a" },
      [],
      claimedA.generation
    );

    await new Promise((resolve) => setImmediate(resolve));
    httpResponse.emit("close");
    expect(claimedA.generation.controller.signal.aborted).toBe(false);
    release();
    await run;

    expect(mockConnector.streamGetChatCompletion).toHaveBeenCalledTimes(1);
    expect(mockWorkspaceChats.new).toHaveBeenCalledTimes(1);
    expect(mockWorkspaceChats._update).toHaveBeenCalledTimes(1);
    expect(mockWorkspaceChats._update).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        response: expect.stringContaining("Teil fertig"),
      })
    );
    const persisted = JSON.parse(
      mockWorkspaceChats._update.mock.calls[0][1].response
    );
    expect(persisted).toMatchObject({
      generationId: "generation-a",
      text: "Teil fertig",
    });
    expect(persisted.pending).not.toBe(true);
    manager.finish(claimedA.generation);
  });
});
