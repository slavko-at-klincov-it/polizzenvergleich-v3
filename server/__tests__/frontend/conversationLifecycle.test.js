const store = require("../../../frontend/src/utils/chat/chatSessionStore.cjs");
const scope = require("../../../frontend/src/utils/chat/conversationScope.cjs");
const {
  createConversationLifecycle,
} = require("../../../frontend/src/utils/chat/conversationLifecycleCore.cjs");

describe("conversation lifecycle", () => {
  beforeEach(() => store.resetForTests());

  test("stops only the selected conversation and waits until idle", async () => {
    const events = [];
    const eventTarget = { dispatchEvent: (event) => events.push(event) };
    class FakeEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init.detail;
      }
    }
    const lifecycle = createConversationLifecycle({
      chatSessionStore: store,
      conversationScope: scope,
      eventTarget,
      CustomEventCtor: FakeEvent,
      abortEventName: "abort",
      stopTimeoutMs: 100,
    });
    const key = store.conversationKey("user:1", "workspace", "thread-a");
    store.setField(key, "streamActive", true);
    const stopping = lifecycle.stopConversationSessions(
      "workspace",
      "thread-a"
    );
    store.setField(key, "streamActive", false);
    store.setField(key, "loadingResponse", false);

    await expect(stopping).resolves.toEqual([key]);
    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({
      workspaceSlug: "workspace",
      threadSlug: "thread-a",
    });
  });

  test("stops and forgets every session in a deleted workspace", async () => {
    const eventTarget = { dispatchEvent: jest.fn() };
    class FakeEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init.detail;
      }
    }
    const lifecycle = createConversationLifecycle({
      chatSessionStore: store,
      conversationScope: scope,
      eventTarget,
      CustomEventCtor: FakeEvent,
      abortEventName: "abort",
    });
    const a = store.conversationKey("user:1", "workspace", "thread-a");
    const b = store.conversationKey("user:1", "workspace", "thread-b");
    store.ensureSession(a, []);
    store.ensureSession(b, []);

    const keys = await lifecycle.stopWorkspaceSessions("workspace");
    lifecycle.forgetConversationSessions(keys);

    expect(store.hasSession(a)).toBe(false);
    expect(store.hasSession(b)).toBe(false);
    expect(eventTarget.dispatchEvent).toHaveBeenCalledTimes(2);
  });
});
