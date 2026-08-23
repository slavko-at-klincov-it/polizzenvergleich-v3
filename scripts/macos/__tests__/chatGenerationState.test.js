const {
  claimPendingHandoff,
  generationPollDecision,
  hasHydratedPendingGeneration,
  loadGenerationSnapshot,
} = require("../../../frontend/src/components/WorkspaceChat/ChatContainer/chatGenerationState.cjs");

describe("thread generation reconciliation", () => {
  test("keeps polling when old history exists before the new pending row", () => {
    const oldHistory = [
      { role: "user", content: "Alt" },
      { role: "assistant", content: "Alte Antwort", pending: false },
    ];
    expect(
      generationPollDecision(oldHistory, { active: true }, "generation-new")
    ).toMatchObject({ keepWaiting: true, pending: false, terminal: false });
  });

  test("keeps polling hydrated pending and stops on matching terminal row", () => {
    const pending = [
      {
        role: "assistant",
        pending: true,
        generationId: "generation-new",
      },
    ];
    expect(hasHydratedPendingGeneration(pending)).toBe(true);
    expect(
      generationPollDecision(pending, { active: true }, "generation-new")
        .keepWaiting
    ).toBe(true);

    const completed = [
      {
        role: "assistant",
        pending: false,
        generationId: "generation-new",
      },
    ];
    expect(
      generationPollDecision(
        completed,
        { active: false, unavailable: true },
        "generation-new"
      )
    ).toMatchObject({ keepWaiting: false, terminal: true });
  });

  test("claims a new-thread handoff exactly once across remounts", () => {
    const values = new Map([
      [
        "pending",
        JSON.stringify({
          workspaceSlug: "polizzen",
          threadSlug: "thread-a",
          message: "Vergleiche",
        }),
      ],
    ]);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
    };

    expect(
      claimPendingHandoff(storage, "pending", "polizzen", "thread-a")
    ).toMatchObject({ message: "Vergleiche" });
    expect(
      claimPendingHandoff(storage, "pending", "polizzen", "thread-a")
    ).toBeNull();
  });

  test("reads status before history so fast completion cannot be missed", async () => {
    let releaseStatus;
    const statusGate = new Promise((resolve) => {
      releaseStatus = resolve;
    });
    const loadStatus = jest.fn(async () => {
      await statusGate;
      return { active: false, generationId: "generation-new" };
    });
    const loadHistory = jest.fn(async () => [
      {
        role: "assistant",
        pending: false,
        generationId: "generation-new",
        content: "Fertig",
      },
    ]);

    const snapshotPromise = loadGenerationSnapshot(loadStatus, loadHistory);
    await Promise.resolve();
    expect(loadHistory).not.toHaveBeenCalled();
    releaseStatus();
    const snapshot = await snapshotPromise;
    expect(loadHistory).toHaveBeenCalledTimes(1);
    expect(snapshot.history[0].content).toBe("Fertig");
  });
});
