/* global module */

function normalizeThreadSlug(threadSlug) {
  return threadSlug ?? null;
}

function eventDetail(workspaceSlug, threadSlug, sessionKey = null) {
  return {
    workspaceSlug,
    threadSlug: normalizeThreadSlug(threadSlug),
    ...(sessionKey ? { sessionKey } : {}),
  };
}

function matchesEventScope(
  detail,
  workspaceSlug,
  threadSlug,
  sessionKey = null
) {
  return (
    detail?.workspaceSlug === workspaceSlug &&
    normalizeThreadSlug(detail?.threadSlug) ===
      normalizeThreadSlug(threadSlug) &&
    (!detail?.sessionKey || !sessionKey || detail.sessionKey === sessionKey)
  );
}

module.exports = { eventDetail, matchesEventScope, normalizeThreadSlug };
