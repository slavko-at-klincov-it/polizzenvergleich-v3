const {
  mapTargetsWithBoundedConcurrency,
  normalizeTargetConcurrency,
} = require("../../../utils/policyAnalysis/boundedTargetConcurrency");

describe("bounded target concurrency", () => {
  test.each([
    [undefined, 1],
    ["", 1],
    ["1", 1],
    [2, 2],
  ])("normalizes %p to %i", (value, expected) => {
    expect(normalizeTargetConcurrency(value)).toBe(expected);
  });

  test.each([0, 3, 1.5, "invalid"])("rejects %p", (value) => {
    expect(() => normalizeTargetConcurrency(value)).toThrow(
      "TARGET_CONCURRENCY_INVALID"
    );
  });

  test("runs at most two isolated targets and preserves input order", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapTargetsWithBoundedConcurrency(
      [30, 5, 20, 1],
      2,
      async (delay, index) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, delay));
        active -= 1;
        return `target-${index}`;
      }
    );

    expect(peak).toBe(2);
    expect(results).toEqual([
      "target-0",
      "target-1",
      "target-2",
      "target-3",
    ]);
  });

  test("stops scheduling new targets after a terminal result", async () => {
    const started = [];
    const results = await mapTargetsWithBoundedConcurrency(
      [0, 1, 2, 3, 4],
      2,
      async (target) => {
        started.push(target);
        if (target === 1) return { target, failed: true };
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { target, failed: false };
      },
      { stopWhen: ({ failed }) => failed }
    );

    expect(started).toEqual([0, 1]);
    expect(results.filter(Boolean)).toEqual([
      { target: 0, failed: false },
      { target: 1, failed: true },
    ]);
  });
});
