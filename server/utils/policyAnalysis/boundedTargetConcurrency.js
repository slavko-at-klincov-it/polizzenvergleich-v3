const MAX_TARGET_CONCURRENCY = 2;

function normalizeTargetConcurrency(value, fallback = 1) {
  const resolved =
    value === undefined || value === null || value === ""
      ? fallback
      : Number(value);
  if (
    !Number.isInteger(resolved) ||
    resolved < 1 ||
    resolved > MAX_TARGET_CONCURRENCY
  )
    throw new Error(
      `TARGET_CONCURRENCY_INVALID:${String(value)}:expected=1..${MAX_TARGET_CONCURRENCY}`
    );
  return resolved;
}

async function mapTargetsWithBoundedConcurrency(
  targets,
  concurrency,
  mapper,
  { stopWhen = () => false } = {}
) {
  if (!Array.isArray(targets)) throw new Error("TARGETS_ARRAY_REQUIRED");
  if (typeof mapper !== "function") throw new Error("TARGET_MAPPER_REQUIRED");
  if (typeof stopWhen !== "function")
    throw new Error("TARGET_STOP_PREDICATE_REQUIRED");
  const limit = normalizeTargetConcurrency(concurrency);
  const results = new Array(targets.length);
  let nextIndex = 0;
  let stopped = false;

  async function worker() {
    while (!stopped) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= targets.length) return;
      const result = await mapper(targets[index], index);
      results[index] = result;
      if (stopWhen(result)) stopped = true;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, targets.length) }, () => worker())
  );
  return results;
}

module.exports = {
  MAX_TARGET_CONCURRENCY,
  mapTargetsWithBoundedConcurrency,
  normalizeTargetConcurrency,
};
