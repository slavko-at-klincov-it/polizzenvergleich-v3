const hooks = new Set();

/**
 * Retrieval extensions (for example FTS indexing) can register an idempotent
 * lifecycle hook without coupling comparison ingestion to a specific index.
 * A hook that throws during `afterEmbedded` causes the embed operation to roll
 * back and keeps the parsed file available for retry.
 */
function registerComparisonDocumentLifecycleHook(hook) {
  if (!hook || typeof hook !== "object")
    throw new Error("Comparison document lifecycle hook must be an object.");
  hooks.add(hook);
  return () => hooks.delete(hook);
}

async function runComparisonDocumentLifecycleHooks(event, payload) {
  for (const hook of hooks) {
    if (typeof hook[event] !== "function") continue;
    await hook[event](payload);
  }
}

function clearComparisonDocumentLifecycleHooks() {
  hooks.clear();
}

module.exports = {
  registerComparisonDocumentLifecycleHook,
  runComparisonDocumentLifecycleHooks,
  clearComparisonDocumentLifecycleHooks,
};
