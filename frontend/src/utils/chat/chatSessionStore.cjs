/* global module */

const MAX_IDLE_SESSIONS = 32;
const LOCAL_HISTORY_PROTECTION_MS = 10_000;
const sessions = new Map();

function conversationKey(authScope, workspaceSlug, threadSlug = null) {
  return JSON.stringify([
    authScope ?? "single-user",
    workspaceSlug,
    threadSlug === null ? ["default"] : ["thread", String(threadSlug)],
  ]);
}

function createSnapshot(history = []) {
  return {
    history: Array.isArray(history) ? history : [],
    loadingResponse: false,
    streamActive: false,
    unconfirmedChatIds: [],
    historyProtectedUntil: 0,
    revision: 0,
  };
}

function isSnapshotActive(snapshot) {
  return Boolean(snapshot?.loadingResponse || snapshot?.streamActive);
}

function pruneIdleSessions() {
  if (sessions.size <= MAX_IDLE_SESSIONS) return;
  const idle = [...sessions.entries()]
    .filter(
      ([, entry]) =>
        entry.listeners.size === 0 && !isSnapshotActive(entry.snapshot)
    )
    .sort(([, left], [, right]) => left.lastAccess - right.lastAccess);
  while (sessions.size > MAX_IDLE_SESSIONS && idle.length > 0)
    sessions.delete(idle.shift()[0]);
}

function ensureSession(key, initialHistory = []) {
  if (!sessions.has(key)) {
    sessions.set(key, {
      snapshot: createSnapshot(initialHistory),
      listeners: new Set(),
      lastAccess: Date.now(),
    });
    pruneIdleSessions();
  }
  const entry = sessions.get(key);
  entry.lastAccess = Date.now();
  return entry;
}

function getSnapshot(key) {
  return ensureSession(key).snapshot;
}

function update(key, updater) {
  const entry = ensureSession(key);
  const current = entry.snapshot;
  const patch = typeof updater === "function" ? updater(current) : updater;
  if (!patch || typeof patch !== "object") return current;
  if (
    !Object.entries(patch).some(
      ([field, value]) => !Object.is(current[field], value)
    )
  )
    return current;
  entry.snapshot = { ...current, ...patch, revision: current.revision + 1 };
  entry.lastAccess = Date.now();
  entry.listeners.forEach((listener) => listener());
  return entry.snapshot;
}

function setField(key, field, value) {
  return update(key, (snapshot) => {
    const nextValue =
      typeof value === "function" ? value(snapshot[field]) : value;
    if (field !== "history") return { [field]: nextValue };
    const previousChatIds = new Set(
      snapshot.history
        .map((message) => message?.chatId)
        .filter(Boolean)
        .map(String)
    );
    const newlyAddedChatIds = (Array.isArray(nextValue) ? nextValue : [])
      .map((message) => message?.chatId)
      .filter(Boolean)
      .map(String)
      .filter((chatId) => !previousChatIds.has(chatId));
    return {
      history: nextValue,
      unconfirmedChatIds: [
        ...new Set([...snapshot.unconfirmedChatIds, ...newlyAddedChatIds]),
      ],
      historyProtectedUntil: Date.now() + LOCAL_HISTORY_PROTECTION_MS,
    };
  });
}

function setExistingField(key, field, value) {
  if (!sessions.has(key)) return null;
  return setField(key, field, value);
}

function hydrateHistory(key, history, expectedRevision) {
  if (!Array.isArray(history)) return false;
  const entry = ensureSession(key);
  if (entry.snapshot.revision !== expectedRevision) return false;
  if (isSnapshotActive(entry.snapshot)) return false;
  const remoteChatIds = new Set(
    history
      .map((message) => message?.chatId)
      .filter(Boolean)
      .map(String)
  );
  const unconfirmedChatIds = new Set(entry.snapshot.unconfirmedChatIds);
  if (
    unconfirmedChatIds.size > 0 &&
    ![...unconfirmedChatIds].every((chatId) => remoteChatIds.has(chatId))
  )
    return false;
  if (
    unconfirmedChatIds.size === 0 &&
    entry.snapshot.historyProtectedUntil > Date.now()
  )
    return false;
  update(key, {
    history,
    unconfirmedChatIds: [],
    historyProtectedUntil: 0,
  });
  return true;
}

function claimPendingRequest(key, requestId) {
  const entry = ensureSession(key);
  const history = entry.snapshot.history;
  const promptMessage = history.at(-1);
  if (!requestId || !promptMessage?.userMessage || promptMessage.requestStarted)
    return null;
  const claimedMessage = { ...promptMessage, requestStarted: requestId };
  const remHistory = history.slice(0, -1);
  update(key, { history: [...remHistory, claimedMessage] });
  return { promptMessage: claimedMessage, remHistory };
}

function failPendingRequest(key, requestId, errorMessage) {
  const entry = sessions.get(key);
  if (!entry) return false;
  const requestIndex = entry.snapshot.history.findLastIndex(
    (message) => message.requestStarted === requestId
  );
  if (requestIndex === -1) return false;
  const history = [...entry.snapshot.history];
  history[requestIndex] = {
    uuid: requestId,
    type: "abort",
    content: errorMessage || "Chat request failed.",
    role: "assistant",
    sources: [],
    closed: true,
    error: errorMessage || "Chat request failed.",
    animate: false,
    pending: false,
  };
  update(key, {
    history,
    loadingResponse: false,
    streamActive: false,
    historyProtectedUntil: Date.now() + LOCAL_HISTORY_PROTECTION_MS,
  });
  return true;
}

function subscribe(key, listener) {
  const entry = ensureSession(key);
  entry.listeners.add(listener);
  return () => entry.listeners.delete(listener);
}

function hasSession(key) {
  return sessions.has(key);
}

function sessionScopes() {
  return [...sessions.keys()].flatMap((key) => {
    try {
      const [, workspaceSlug, storedThread] = JSON.parse(key);
      const threadSlug =
        storedThread?.[0] === "thread" ? storedThread[1] : null;
      return [{ key, workspaceSlug, threadSlug }];
    } catch {
      return [];
    }
  });
}

function sessionKeysForConversation(workspaceSlug, threadSlug) {
  const normalizedThread = threadSlug ?? null;
  return sessionScopes()
    .filter(
      (scope) =>
        scope.workspaceSlug === workspaceSlug &&
        scope.threadSlug === normalizedThread
    )
    .map((scope) => scope.key);
}

function deleteSession(key) {
  return sessions.delete(key);
}

function resetForTests() {
  sessions.clear();
}

module.exports = {
  claimPendingRequest,
  conversationKey,
  deleteSession,
  ensureSession,
  failPendingRequest,
  getSnapshot,
  hasSession,
  hydrateHistory,
  isSnapshotActive,
  resetForTests,
  sessionKeysForConversation,
  sessionScopes,
  setExistingField,
  setField,
  subscribe,
  update,
};
