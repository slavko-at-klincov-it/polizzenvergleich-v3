jest.mock("../../utils/prisma", () => {
  const client = {
    policy_comparison_sessions: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    policy_comparison_documents: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  client.$transaction = jest.fn((operation) => operation(client));
  return client;
});

const prisma = require("../../utils/prisma");
const { PolicyComparison } = require("../../models/policyComparison");
const {
  POLICY_COMPARISON_MODE,
} = require("../../utils/policyComparison/modes");

const updatedAt = new Date("2026-09-06T10:00:00.000Z");

function session(overrides = {}) {
  return {
    id: 7,
    uuid: "461e3058-328f-4871-85dc-0db9ee777f29",
    status: "DRAFT",
    comparisonMode: POLICY_COMPARISON_MODE.SYMMETRIC_A_B,
    inputManifest: null,
    lastUpdatedAt: updatedAt,
    documents: [],
    ...overrides,
  };
}

function document(side, position) {
  return {
    uuid: `${side === "A" ? "a" : "b"}61e3058-328f-4871-85dc-0db9ee777f29`,
    side,
    role: "MAIN_POLICY",
    documentStatus: "ACTIVE",
    originalName: `${side}.pdf`,
    storagePath: `uploads/session/${side}.pdf`,
    sha256: side.toLowerCase().repeat(64),
    position,
  };
}

describe("policy comparison lifecycle", () => {
  beforeEach(() => jest.clearAllMocks());

  test("rechecks the authoritative status before updating a document", async () => {
    prisma.policy_comparison_sessions.findUnique.mockResolvedValue(
      session({ status: "RUNNING" })
    );

    await expect(
      PolicyComparison.updateDocument({
        session: session(),
        documentUuid: document("A", 0).uuid,
        role: "SUPPLEMENT",
      })
    ).rejects.toThrow("COMPARISON_SESSION_LOCKED");
    expect(prisma.policy_comparison_documents.update).not.toHaveBeenCalled();
  });

  test("fails a document mutation when its session CAS loses", async () => {
    const current = session();
    prisma.policy_comparison_sessions.findUnique.mockResolvedValue(current);
    prisma.policy_comparison_documents.findFirst.mockResolvedValue(
      document("A", 0)
    );
    prisma.policy_comparison_documents.update.mockResolvedValue(
      document("A", 0)
    );
    prisma.policy_comparison_sessions.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      PolicyComparison.updateDocument({
        session: current,
        documentUuid: document("A", 0).uuid,
        role: "SUPPLEMENT",
      })
    ).rejects.toThrow("COMPARISON_SESSION_CHANGED");
    expect(prisma.policy_comparison_sessions.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: current.id,
          status: current.status,
          lastUpdatedAt: current.lastUpdatedAt,
        },
      })
    );
  });

  test("queues an immutable document snapshot with a fresh worker lease", async () => {
    const current = session({
      documents: [document("A", 0), document("B", 0)],
    });
    const queued = session({ status: "QUEUED" });
    prisma.policy_comparison_sessions.findUnique
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(queued);
    prisma.policy_comparison_sessions.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await PolicyComparison.queue(current);
    const update =
      prisma.policy_comparison_sessions.updateMany.mock.calls[0][0];
    const manifest = JSON.parse(update.data.inputManifest);

    expect(update.where).toEqual({
      id: current.id,
      status: current.status,
      lastUpdatedAt: current.lastUpdatedAt,
    });
    expect(manifest.workerLeaseNonce).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
    );
    expect(manifest.documents).toEqual(current.documents);
    expect(result.workerLeaseNonce).toBe(manifest.workerLeaseNonce);
  });

  test("cancel cannot target a newer lease for the same session", async () => {
    const current = session({
      status: "RUNNING",
      inputManifest: '{"workerLeaseNonce":"old"}',
    });
    prisma.policy_comparison_sessions.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(PolicyComparison.cancel(current)).rejects.toThrow(
      "COMPARISON_SESSION_NOT_RUNNING"
    );
    expect(prisma.policy_comparison_sessions.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: current.id,
          status: current.status,
          inputManifest: current.inputManifest,
        },
      })
    );
    expect(
      prisma.policy_comparison_sessions.updateMany.mock.calls[0][0].data
    ).not.toHaveProperty("workerPid");
  });
});
