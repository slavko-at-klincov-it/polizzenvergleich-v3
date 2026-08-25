const store = require("../../../frontend/src/utils/chat/chatSessionStore.cjs");

describe("chat session store", () => {
  beforeEach(() => store.resetForTests());

  test("keeps an active conversation alive without a UI subscriber", () => {
    const key = store.conversationKey("user:1", "workspace", "thread-a");
    const unsubscribe = store.subscribe(key, jest.fn());
    store.setField(key, "loadingResponse", true);
    store.setField(key, "streamActive", true);
    store.setField(key, "history", [{ role: "assistant", content: "partial" }]);
    unsubscribe();

    expect(store.getSnapshot(key)).toMatchObject({
      loadingResponse: true,
      streamActive: true,
      history: [{ role: "assistant", content: "partial" }],
    });
  });

  test("isolates sessions by user, workspace and typed thread", () => {
    const a = store.conversationKey("user:1", "workspace", "thread-a");
    const b = store.conversationKey("user:1", "workspace", "thread-b");
    const defaultChat = store.conversationKey("user:1", "workspace", null);
    const namedDefault = store.conversationKey(
      "user:1",
      "workspace",
      "default"
    );
    store.setField(a, "history", [{ content: "A" }]);

    expect(store.getSnapshot(b).history).toEqual([]);
    expect(defaultChat).not.toBe(namedDefault);
  });

  test("claims a pending request only once across remounts", () => {
    const key = store.conversationKey("user:1", "workspace", "thread-a");
    store.ensureSession(key, [{ userMessage: "hello", role: "user" }]);

    expect(store.claimPendingRequest(key, "request-1")).not.toBeNull();
    expect(store.claimPendingRequest(key, "request-2")).toBeNull();
  });

  test("rejects stale history while a stream is active", () => {
    const key = store.conversationKey("user:1", "workspace", "thread-a");
    store.ensureSession(key, [{ content: "local" }]);
    const revision = store.getSnapshot(key).revision;
    store.setField(key, "streamActive", true);

    expect(store.hydrateHistory(key, [{ content: "remote" }], revision)).toBe(
      false
    );
    expect(store.getSnapshot(key).history[0].content).toBe("local");
  });

  test("rejects a history response captured before a local revision", () => {
    const key = store.conversationKey("user:1", "workspace", "thread-a");
    store.ensureSession(key, []);
    const revision = store.getSnapshot(key).revision;
    store.setField(key, "history", [{ content: "new local message" }]);

    expect(store.hydrateHistory(key, [], revision)).toBe(false);
  });

  test("accepts authoritative history for an unchanged idle session", () => {
    const key = store.conversationKey("user:1", "workspace", "thread-a");
    store.ensureSession(key, []);
    const revision = store.getSnapshot(key).revision;

    expect(
      store.hydrateHistory(key, [{ chatId: 1, content: "persisted" }], revision)
    ).toBe(true);
    expect(store.getSnapshot(key).history[0].content).toBe("persisted");
  });

  test("terminalizes a claimed request when the transport fails", () => {
    const key = store.conversationKey("user:1", "workspace", "thread-a");
    store.ensureSession(key, [{ userMessage: "hello", role: "user" }]);
    store.claimPendingRequest(key, "request-1");
    store.setField(key, "loadingResponse", true);

    expect(store.failPendingRequest(key, "request-1", "offline")).toBe(true);
    expect(store.getSnapshot(key)).toMatchObject({
      loadingResponse: false,
      streamActive: false,
    });
    expect(store.getSnapshot(key).history[0]).toMatchObject({
      type: "abort",
      error: "offline",
    });
  });

  test("does not recreate a deleted session from a late callback", () => {
    const key = store.conversationKey("user:1", "workspace", "thread-a");
    store.ensureSession(key, []);
    store.deleteSession(key);

    expect(store.setExistingField(key, "history", [{ content: "late" }])).toBe(
      null
    );
    expect(store.hasSession(key)).toBe(false);
  });
});
