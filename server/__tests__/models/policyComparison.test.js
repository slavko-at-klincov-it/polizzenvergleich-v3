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

  test("does not expose internal worker paths in session errors", () => {
    expect(
      PolicyComparison.publicSession({
        uuid: "session-1",
        status: "FAILED",
        comparisonMode: "SYMMETRIC_A_B_CORE5_V1",
        error:
          "DOCUMENT_ANALYSIS_FAILED: log=/Users/private/server/storage/worker.log",
        documents: [],
      }).error
    ).toBe("DOCUMENT_ANALYSIS_FAILED");
    expect(
      PolicyComparison.publicSession({
        uuid: "session-2",
        status: "FAILED",
        comparisonMode: "SYMMETRIC_A_B_CORE5_V1",
        error: "UNKNOWN_INTERNAL:/private/path",
        documents: [],
      }).error
    ).toBe("COMPARISON_TECHNICAL_FAILURE");
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
