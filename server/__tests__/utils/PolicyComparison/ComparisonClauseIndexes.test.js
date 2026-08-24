jest.mock("../../../utils/prisma", () => ({
  comparison_document_term_aliases: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
}));

const prisma = require("../../../utils/prisma");
const {
  ComparisonTermAliasCatalog,
} = require("../../../utils/PolicyComparison/ComparisonTermAliasCatalog");
const {
  ComparisonClauseBlockIndex,
  ftsExpression,
} = require("../../../utils/PolicyComparison/ComparisonClauseBlockIndex");

describe("clause exact/alias retrieval boundaries", () => {
  beforeEach(() => jest.clearAllMocks());

  test("persists a versioned additive alias catalog and expands only known groups", async () => {
    prisma.comparison_document_term_aliases.upsert.mockResolvedValue({});
    prisma.comparison_document_term_aliases.findMany
      .mockResolvedValueOnce([{ groupKey: "vandalismus" }])
      .mockResolvedValueOnce([
        {
          groupKey: "vandalismus",
          canonicalTerm: "vandalismus",
          aliasTerm: "böswillige beschädigung",
        },
        {
          groupKey: "vandalismus",
          canonicalTerm: "vandalismus",
          aliasTerm: "graffiti",
        },
      ]);

    await expect(
      ComparisonTermAliasCatalog.expand(["Vandalismus"])
    ).resolves.toEqual(["vandalismus", "böswillige beschädigung", "graffiti"]);
    expect(prisma.comparison_document_term_aliases.upsert).toHaveBeenCalledWith(
      {
        where: {
          catalogVersion_groupKey_aliasTerm: {
            catalogVersion: ComparisonTermAliasCatalog.version,
            groupKey: "vandalismus",
            aliasTerm: "graffiti",
          },
        },
        create: expect.objectContaining({
          catalogVersion: ComparisonTermAliasCatalog.version,
          groupKey: "vandalismus",
          aliasTerm: "graffiti",
        }),
        update: {
          canonicalTerm: "vandalismus",
          aliasKind: "alias",
        },
      }
    );
  });

  test("FTS expressions contain exact phrases or explicit prefixes, never implicit stemming", () => {
    expect(ftsExpression(["böswillige Beschädigung", "Brand"])).toBe(
      '"böswillige beschädigung" OR "brand"'
    );
    expect(ftsExpression(["brand"], { prefix: true })).toBe('"brand"*');
  });

  test("enumerates every exact clause hit across FTS pages without a Top-K cap", async () => {
    const pages = [
      Array.from({ length: 100 }, (_, index) => ({ blockId: index + 1 })),
      Array.from({ length: 100 }, (_, index) => ({ blockId: index + 101 })),
      Array.from({ length: 37 }, (_, index) => ({ blockId: index + 201 })),
    ];
    const db = {
      $executeRawUnsafe: jest.fn(async () => true),
      $queryRawUnsafe: jest.fn(async () => pages.shift()),
    };
    ComparisonClauseBlockIndex._schemaPromise = null;

    const results = await ComparisonClauseBlockIndex.searchAllRun({
      analysisRunId: 41,
      terms: ["Selbstbehalt"],
      expandAliases: false,
      pageSize: 100,
      db,
    });

    expect(results).toHaveLength(237);
    expect(results[0].blockId).toBe(1);
    expect(results.at(-1).blockId).toBe(237);
    expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(3);
  });
});
