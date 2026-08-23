function isPendingAssistant(message) {
  return message?.role === "assistant" && message?.pending === true;
}

function hasPendingGeneration(history = []) {
  return history.some(isPendingAssistant);
}

function hasHydratedPendingGeneration(history = []) {
  return history.some(
    (message) => isPendingAssistant(message) && !message.userMessage
  );
}

function generationPollDecision(history = [], status = {}, targetId = null) {
  const pending = hasPendingGeneration(history);
  const resolvedTargetId =
    targetId ??
    history.findLast((message) => message?.generationId)?.generationId;
  const terminal = Boolean(
    resolvedTargetId &&
      history.some(
        (message) =>
          message?.role === "assistant" &&
          message?.generationId === resolvedTargetId &&
          message?.pending !== true
      )
  );

  return {
    pending,
    terminal,
    keepWaiting:
      !terminal &&
      (status?.active === true || status?.unavailable === true || pending),
  };
}

function claimPendingHandoff(storage, storageKey, workspaceSlug, threadSlug) {
  let pending = null;
  try {
    pending = JSON.parse(storage.getItem(storageKey));
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
  if (!pending?.workspaceSlug || !pending?.threadSlug || !pending?.message) {
    if (pending) storage.removeItem(storageKey);
    return null;
  }
  if (
    pending.workspaceSlug !== workspaceSlug ||
    pending.threadSlug !== threadSlug
  )
    return null;

  storage.removeItem(storageKey);
  return pending;
}

function detachedGenerationHistory(history = [], generationId) {
  const next = [...history];
  const currentIndex = next.findLastIndex(
    (message) =>
      message?.role === "assistant" &&
      (message?.generationId === generationId ||
        (message?.closed === false && !message?.chatId))
  );
  const current = currentIndex >= 0 ? next[currentIndex] : null;
  const pending = {
    ...(current || {}),
    uuid: current?.uuid || generationId,
    content: current?.content || "Antwort wird erstellt …",
    role: "assistant",
    sources: current?.sources || [],
    closed: false,
    error: null,
    animate: true,
    pending: true,
    generationId,
  };
  if (currentIndex >= 0) next[currentIndex] = pending;
  else next.push(pending);
  return next;
}

function generationEventMatches(
  detail,
  { workspaceSlug, threadSlug = null, generationId }
) {
  return Boolean(
    detail &&
      detail.workspaceSlug === workspaceSlug &&
      (detail.threadSlug ?? null) === (threadSlug ?? null) &&
      detail.generationId === generationId
  );
}

async function loadGenerationSnapshot(loadStatus, loadHistory) {
  const status = await loadStatus();
  const history = await loadHistory();
  return { status, history };
}

// eslint-disable-next-line no-undef
module.exports = {
  claimPendingHandoff,
  detachedGenerationHistory,
  generationEventMatches,
  generationPollDecision,
  hasHydratedPendingGeneration,
  hasPendingGeneration,
  loadGenerationSnapshot,
};
