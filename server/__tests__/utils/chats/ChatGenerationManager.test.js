const { EventEmitter } = require("events");
const {
  ChatGenerationManager,
  chatGenerationManager,
  detachedStreamResponse,
  reconcileAllOrphanedPendingChats,
  reconcileOrphanedPendingChats,
} = require("../../../utils/chats/ChatGenerationManager");
const { WorkspaceChats } = require("../../../models/workspaceChats");
const {
  handleDefaultStreamResponseV2,
} = require("../../../utils/helpers/chat/responses");

const scope = { workspaceId: 1, threadId: 2, userId: 3 };

function fakeHttpResponse() {
  const response = new EventEmitter();
  response.writableEnded = false;
  response.destroyed = false;
  response.write = jest.fn(() => true);
  return response;
}

describe("ChatGenerationManager", () => {
  test("claims one generation per user/thread and matches cancellation by id", () => {
    jest.useFakeTimers();
    const manager = new ChatGenerationManager();
    const first = manager.begin(scope, "generation-a");
    const duplicate = manager.begin(scope, "generation-b");

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.generation).toBe(first.generation);
    expect(manager.cancel(scope, "generation-b")).toBe(false);
    expect(first.generation.controller.signal.aborted).toBe(false);
    expect(manager.cancel(scope, "generation-a")).toBe(true);
    expect(first.generation.controller.signal.aborted).toBe(true);
    expect(manager.cancel(scope, "generation-a")).toBe(true);
    expect(jest.getTimerCount()).toBe(1);

    manager.finish(first.generation);
    expect(jest.getTimerCount()).toBe(0);
    expect(manager.get(scope)).toBeNull();
    jest.useRealTimers();
  });

  test("passive subscriber close does not truncate the provider stream", async () => {
    const manager = new ChatGenerationManager();
    const { generation } = manager.begin(scope, "generation-a");
    const httpResponse = fakeHttpResponse();
    const response = detachedStreamResponse(httpResponse, generation);
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const stream = (async function* () {
      yield { choices: [{ delta: { content: "Teil " } }] };
      await gate;
      yield {
        choices: [{ delta: { content: "fertig" }, finish_reason: "stop" }],
      };
    })();
    stream.endMeasurement = jest.fn();

    const resultPromise = handleDefaultStreamResponseV2(response, stream, {
      uuid: "test",
      sources: [],
    });
    await new Promise((resolve) => setImmediate(resolve));
    httpResponse.emit("close");
    expect(generation.controller.signal.aborted).toBe(false);

    release();
    await expect(resultPromise).resolves.toBe("Teil fertig");
    manager.finish(generation);
  });

  test("stopping A cannot cancel a different thread or generation", () => {
    const manager = new ChatGenerationManager();
    const scopeB = { ...scope, threadId: 99 };
    const a = manager.begin(scope, "generation-a").generation;
    const b = manager.begin(scopeB, "generation-b").generation;

    expect(manager.cancel(scope, "generation-b")).toBe(false);
    expect(a.controller.signal.aborted).toBe(false);
    expect(b.controller.signal.aborted).toBe(false);
    expect(manager.cancel(scope, "generation-a")).toBe(true);
    expect(a.controller.signal.aborted).toBe(true);
    expect(b.controller.signal.aborted).toBe(false);

    manager.finish(a);
    manager.finish(b);
  });

  test("stale pending snapshot never overwrites an already completed row", async () => {
    const pending = JSON.stringify({
      text: "Antwort wird erstellt …",
      pending: true,
      generationId: "generation-a",
    });
    const completed = JSON.stringify({
      text: "Fertige Antwort",
      pending: false,
      generationId: "generation-a",
    });
    const get = jest.spyOn(WorkspaceChats, "get").mockResolvedValue({
      id: 77,
      response: completed,
    });
    const update = jest
      .spyOn(WorkspaceChats, "_update")
      .mockResolvedValue(true);

    await reconcileOrphanedPendingChats([{ id: 77, response: pending }], scope);

    expect(get).toHaveBeenCalledWith({ id: 77 });
    expect(update).not.toHaveBeenCalled();
    get.mockRestore();
    update.mockRestore();
    chatGenerationManager.resetForTests();
  });

  test("repairs every durable pending row during server startup", async () => {
    const where = jest.spyOn(WorkspaceChats, "where").mockResolvedValue([
      {
        id: 88,
        workspaceId: 1,
        thread_id: 2,
        user_id: 3,
        generationId: null,
        response: JSON.stringify({
          text: "Antwort wird erstellt …",
          pending: true,
          generationId: "generation-restart",
        }),
      },
    ]);
    const update = jest
      .spyOn(WorkspaceChats, "_update")
      .mockResolvedValue(true);

    await expect(reconcileAllOrphanedPendingChats()).resolves.toBe(1);
    expect(update).toHaveBeenCalledWith(
      88,
      expect.objectContaining({
        response: expect.stringContaining('"pending":false'),
      })
    );
    expect(JSON.parse(update.mock.calls[0][1].response)).toMatchObject({
      interrupted: true,
      generationId: "generation-restart",
    });
    where.mockRestore();
    update.mockRestore();
  });
});
