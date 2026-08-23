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

async function loadGenerationSnapshot(loadStatus, loadHistory) {
  const status = await loadStatus();
  const history = await loadHistory();
  return { status, history };
}

// eslint-disable-next-line no-undef
module.exports = {
  claimPendingHandoff,
  generationPollDecision,
  hasHydratedPendingGeneration,
  hasPendingGeneration,
  loadGenerationSnapshot,
};
