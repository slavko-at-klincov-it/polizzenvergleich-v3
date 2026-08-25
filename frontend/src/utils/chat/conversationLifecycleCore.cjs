/* global module */

function createConversationLifecycle({
  chatSessionStore,
  conversationScope,
  eventTarget,
  CustomEventCtor,
  abortEventName,
  stopTimeoutMs = 3_000,
}) {
  function waitForSessionIdle(sessionKey) {
    if (!chatSessionStore.hasSession(sessionKey)) return Promise.resolve();
    if (
      !chatSessionStore.isSnapshotActive(
        chatSessionStore.getSnapshot(sessionKey)
      )
    )
      return Promise.resolve();
    return new Promise((resolve) => {
      let timeoutId;
      const unsubscribe = chatSessionStore.subscribe(sessionKey, () => {
        if (
          chatSessionStore.hasSession(sessionKey) &&
          chatSessionStore.isSnapshotActive(
            chatSessionStore.getSnapshot(sessionKey)
          )
        )
          return;
        clearTimeout(timeoutId);
        unsubscribe();
        resolve();
      });
      timeoutId = setTimeout(() => {
        unsubscribe();
        resolve();
      }, stopTimeoutMs);
    });
  }

  function dispatchStop(workspaceSlug, threadSlug) {
    eventTarget.dispatchEvent(
      new CustomEventCtor(abortEventName, {
        detail: conversationScope.eventDetail(workspaceSlug, threadSlug),
      })
    );
  }

  async function stopConversationSessions(workspaceSlug, threadSlug) {
    const sessionKeys = chatSessionStore.sessionKeysForConversation(
      workspaceSlug,
      threadSlug
    );
    if (sessionKeys.length === 0) return sessionKeys;
    dispatchStop(workspaceSlug, threadSlug);
    await Promise.all(sessionKeys.map(waitForSessionIdle));
    return sessionKeys;
  }

  async function stopWorkspaceSessions(workspaceSlug) {
    const scopes = chatSessionStore
      .sessionScopes()
      .filter((scope) => scope.workspaceSlug === workspaceSlug);
    if (scopes.length === 0) return [];
    [...new Set(scopes.map((scope) => scope.threadSlug))].forEach(
      (threadSlug) => dispatchStop(workspaceSlug, threadSlug)
    );
    await Promise.all(scopes.map(({ key }) => waitForSessionIdle(key)));
    return scopes.map(({ key }) => key);
  }

  function forgetConversationSessions(sessionKeys = []) {
    sessionKeys.forEach((sessionKey) =>
      chatSessionStore.deleteSession(sessionKey)
    );
  }

  return {
    forgetConversationSessions,
    stopConversationSessions,
    stopWorkspaceSessions,
  };
}

module.exports = { createConversationLifecycle };
