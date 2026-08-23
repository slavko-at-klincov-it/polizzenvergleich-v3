const { EventEmitter } = require("events");
const { v4: uuidv4 } = require("uuid");
const { WorkspaceChats } = require("../../../models/workspaceChats");
const { safeJSONStringify } = require("../../helpers/chat/responses");

/**
 * Owns normal chat generations independently of the HTTP/SSE subscriber.
 * The application is a single local server, so an in-process registry is the
 * narrowest reliable boundary for preventing two concurrent generations in
 * the same user/thread while still allowing navigation to detach the UI.
 */
class ChatGenerationManager {
  constructor() {
    this.active = new Map();
  }

  scopeKey({ workspaceId, threadId = null, userId = null }) {
    return `${workspaceId}:${threadId ?? "default"}:${userId ?? "single-user"}`;
  }

  begin(scope, requestedId = null) {
    const key = this.scopeKey(scope);
    const existing = this.active.get(key);
    if (existing) return { created: false, generation: existing };

    const generation = {
      id: requestedId || uuidv4(),
      key,
      scope,
      controller: new AbortController(),
      output: new EventEmitter(),
      cancelled: false,
      settled: false,
    };
    this.active.set(key, generation);
    return { created: true, generation };
  }

  get(scope) {
    return this.active.get(this.scopeKey(scope)) ?? null;
  }

  isActive(scope, generationId = null) {
    const generation = this.get(scope);
    return Boolean(
      generation && (!generationId || generation.id === generationId)
    );
  }

  cancel(scope, generationId = null) {
    const generation = this.get(scope);
    if (
      !generationId ||
      !generation ||
      generation.settled ||
      generation.id !== generationId
    )
      return false;
    if (generation.cancelled) return true;
    generation.cancelled = true;
    generation.controller.abort();
    // Modern connectors settle their iterator from the job-owned signal. Keep
    // the scope locked until that happens. The delayed close is only a bounded
    // fallback for legacy handlers that do not propagate AbortSignal.
    generation.cancelTimer = setTimeout(
      () => generation.output.emit("close"),
      10_000
    );
    generation.cancelTimer.unref?.();
    return true;
  }

  finish(generation) {
    if (!generation) return;
    generation.settled = true;
    if (generation.cancelTimer) clearTimeout(generation.cancelTimer);
    if (this.active.get(generation.key) === generation)
      this.active.delete(generation.key);
    generation.output.removeAllListeners();
  }

  resetForTests() {
    for (const generation of this.active.values()) {
      generation.controller.abort();
      generation.output.emit("close");
    }
    this.active.clear();
  }
}

/**
 * Response facade used by provider stream handlers. Writes are forwarded while
 * the SSE client is connected. A client close only detaches the forwarding;
 * the provider sees a close event exclusively when the user explicitly stops.
 */
function detachedStreamResponse(httpResponse, generation) {
  let connected = true;
  const detach = () => {
    connected = false;
  };
  httpResponse?.once?.("close", detach);

  return {
    on(event, listener) {
      if (event === "close" && generation.cancelled) queueMicrotask(listener);
      else generation.output.on(event, listener);
      return this;
    },
    once(event, listener) {
      if (event === "close" && generation.cancelled) queueMicrotask(listener);
      else generation.output.once(event, listener);
      return this;
    },
    removeListener: generation.output.removeListener.bind(generation.output),
    get writableEnded() {
      return generation.cancelled;
    },
    get destroyed() {
      return generation.cancelled;
    },
    write(chunk) {
      if (
        !connected ||
        generation.cancelled ||
        httpResponse?.writableEnded ||
        httpResponse?.destroyed
      )
        return false;
      return httpResponse.write(chunk);
    },
    detach() {
      detach();
      httpResponse?.removeListener?.("close", detach);
    },
  };
}

const chatGenerationManager = new ChatGenerationManager();

async function reconcileOrphanedPendingChats(history, scope) {
  for (const record of history) {
    let data;
    try {
      data = JSON.parse(record.response);
    } catch {
      continue;
    }
    if (data?.pending !== true) continue;
    if (chatGenerationManager.isActive(scope, data.generationId)) continue;

    // The history query and this reconciliation are not atomic. A generation
    // may have persisted its final answer and finished after the snapshot was
    // read. Re-read the row before repairing so stale polling can never
    // overwrite a completed answer.
    const current = await WorkspaceChats.get({ id: record.id });
    if (!current) continue;
    let currentData;
    try {
      currentData = JSON.parse(current.response);
    } catch {
      continue;
    }
    if (
      currentData?.pending !== true ||
      currentData?.generationId !== data.generationId
    )
      continue;

    const terminal = {
      ...currentData,
      text: "Antwort wurde durch einen Neustart unterbrochen.",
      pending: false,
      interrupted: true,
    };
    const updated = await WorkspaceChats._update(record.id, {
      response: safeJSONStringify(terminal),
    });
    if (updated) record.response = safeJSONStringify(terminal);
  }
  return history;
}

async function reconcileAllOrphanedPendingChats() {
  const candidates = await WorkspaceChats.where({
    OR: [
      { generationId: { not: null } },
      { response: { contains: '"pending":true' } },
    ],
  });
  let repaired = 0;
  for (const record of candidates) {
    let data;
    try {
      data = JSON.parse(record.response);
    } catch {
      continue;
    }
    if (data?.pending !== true) continue;
    const generationId = record.generationId ?? data.generationId ?? null;
    const scope = {
      workspaceId: record.workspaceId,
      threadId: record.thread_id ?? null,
      userId: record.user_id ?? null,
    };
    if (chatGenerationManager.isActive(scope, generationId)) continue;
    const updated = await WorkspaceChats._update(record.id, {
      response: safeJSONStringify({
        ...data,
        text: "Antwort wurde durch einen Neustart unterbrochen.",
        pending: false,
        interrupted: true,
      }),
    });
    if (updated) repaired += 1;
  }
  return repaired;
}

module.exports = {
  ChatGenerationManager,
  chatGenerationManager,
  detachedStreamResponse,
  reconcileOrphanedPendingChats,
  reconcileAllOrphanedPendingChats,
};
