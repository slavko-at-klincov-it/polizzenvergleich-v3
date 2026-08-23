const {
  convertToChatHistory,
} = require("../../../utils/helpers/chat/responses");

describe("pending generation history", () => {
  test("surfaces pending and generation identity for navigation reconciliation", () => {
    const history = convertToChatHistory([
      {
        id: 12,
        prompt: "Vergleiche die Selbstbehalte",
        response: JSON.stringify({
          text: "Antwort wird erstellt …",
          pending: true,
          generationId: "generation-a",
          sources: [],
        }),
        createdAt: new Date("2026-08-23T10:00:00Z"),
      },
    ]);

    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({
      role: "assistant",
      pending: true,
      closed: false,
      animate: false,
      generationId: "generation-a",
      content: "Antwort wird erstellt …",
    });
  });
});
