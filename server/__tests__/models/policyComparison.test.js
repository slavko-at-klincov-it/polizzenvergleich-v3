const { PolicyComparison } = require("../../models/policyComparison");

describe("PolicyComparison public contract", () => {
  test("does not expose private storage paths or worker manifests", () => {
    const session = PolicyComparison.publicSession({
      uuid: "session-1",
      status: "DRAFT",
      progress: JSON.stringify({ phase: "QUEUED" }),
      inputManifest: "private",
      resultPath: "runs/private",
      error: null,
      documents: [
        {
          uuid: "document-1",
          side: "A",
          role: "MAIN_POLICY",
          documentStatus: "ACTIVE",
          originalName: "Polizze.pdf",
          storedName: "private.pdf",
          storagePath: "uploads/private.pdf",
          mimeType: "application/pdf",
          byteSize: 123,
          sha256: "abc",
          position: 0,
        },
      ],
    });

    expect(session.resultAvailable).toBe(true);
    expect(session.progress).toEqual({ phase: "QUEUED" });
    expect(session.documents[0]).not.toHaveProperty("storagePath");
    expect(session.documents[0]).not.toHaveProperty("storedName");
    expect(session).not.toHaveProperty("inputManifest");
  });

  test("fixes the package limit and accepted semantic roles", () => {
    expect(PolicyComparison.MAX_DOCUMENTS_PER_SIDE).toBe(9);
    expect(PolicyComparison.DOCUMENT_ROLES).toEqual(
      expect.arrayContaining([
        "MAIN_POLICY",
        "SUPPLEMENT",
        "ENDORSEMENT",
        "TERMS",
      ])
    );
  });
});
