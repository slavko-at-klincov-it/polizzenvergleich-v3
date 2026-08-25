const scope = require("../../../frontend/src/utils/chat/conversationScope.cjs");

describe("conversation event scope", () => {
  test("matches only the selected workspace and thread", () => {
    const detail = scope.eventDetail("workspace", "thread-a");
    expect(scope.matchesEventScope(detail, "workspace", "thread-a")).toBe(true);
    expect(scope.matchesEventScope(detail, "workspace", "thread-b")).toBe(
      false
    );
    expect(scope.matchesEventScope(detail, "other", "thread-a")).toBe(false);
  });

  test("keeps default chat distinct from a named default thread", () => {
    expect(
      scope.matchesEventScope(
        scope.eventDetail("workspace", null),
        "workspace",
        "default"
      )
    ).toBe(false);
  });

  test("optionally narrows an event to one authenticated session", () => {
    const detail = scope.eventDetail("workspace", "thread-a", "session-a");
    expect(
      scope.matchesEventScope(detail, "workspace", "thread-a", "session-a")
    ).toBe(true);
    expect(
      scope.matchesEventScope(detail, "workspace", "thread-a", "session-b")
    ).toBe(false);
  });
});
