const {
  claimPendingHandoff,
  detachedGenerationHistory,
  generationEventMatches,
  generationPollDecision,
  hasHydratedPendingGeneration,
  loadGenerationSnapshot,
} = require("../../../frontend/src/components/WorkspaceChat/ChatContainer/chatGenerationState.cjs");

describe("thread generation reconciliation", () => {
  test("keeps polling when returning before the pending chat row exists", () => {
    expect(
      generationPollDecision([], {
        active: true,
        generationId: "generation-new",
      })
    ).toMatchObject({ keepWaiting: true, pending: false, terminal: false });
  });

  test("passive detach before the first token preserves every older message", () => {
    const oldHistory = [
      { role: "user", content: "Alte Frage" },
      {
        role: "assistant",
        content: "Alte Antwort",
        closed: true,
        chatId: 1,
      },
      { role: "user", content: "Neue Frage", userMessage: "Neue Frage" },
    ];
    const detached = detachedGenerationHistory(oldHistory, "generation-new");
    expect(detached).toHaveLength(4);
    expect(detached[1]).toMatchObject({ content: "Alte Antwort", chatId: 1 });
    expect(detached.at(-1)).toMatchObject({
      content: "Antwort wird erstellt …",
      pending: true,
      generationId: "generation-new",
    });
    expect(
      generationPollDecision(detached, { active: true }, "generation-new")
        .keepWaiting
    ).toBe(true);
  });

  test("passive detach preserves partial output from the current generation", () => {
    const detached = detachedGenerationHistory(
      [
        { role: "user", content: "Neue Frage" },
        {
          role: "assistant",
          content: "Bisheriger Teil",
          closed: false,
          uuid: "stream-id",
        },
      ],
      "generation-new"
    );
    expect(detached).toHaveLength(2);
    expect(detached[1]).toMatchObject({
      content: "Bisheriger Teil",
      pending: true,
      generationId: "generation-new",
    });
  });

  test("stop events match the exact workspace, thread and generation", () => {
    const scope = {
      workspaceSlug: "polizzen",
      threadSlug: "thread-a",
      generationId: "generation-a",
    };
    expect(generationEventMatches(scope, scope)).toBe(true);
    expect(
      generationEventMatches({ ...scope, threadSlug: "thread-b" }, scope)
    ).toBe(false);
    expect(
      generationEventMatches({ ...scope, generationId: "generation-b" }, scope)
    ).toBe(false);
  });

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
