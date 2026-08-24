const prisma = require("../prisma");

const TERM_ALIAS_CATALOG_VERSION = 1;

// Additive routing hints only. Absence from this catalog never means that a
// clause or fact is absent; unknown semantic relations are handled by Dinghy.
const BUILTIN_TERM_GROUPS = Object.freeze([
  {
    groupKey: "feuer",
    canonicalTerm: "Feuer",
    aliases: ["Feuer", "Brand", "Rauch", "Verrußung", "Verrussung"],
  },
  {
    groupKey: "leitungswasser",
    canonicalTerm: "Leitungswasser",
    aliases: ["Leitungswasser", "Rohrbruch", "Wasserverlust", "Frostschaden"],
  },
  {
    groupKey: "vandalismus",
    canonicalTerm: "Vandalismus",
    aliases: [
      "Vandalismus",
      "mutwillige Beschädigung",
      "böswillige Beschädigung",
      "Sachbeschädigung durch Dritte",
      "Graffiti",
    ],
  },
  {
    groupKey: "deckungslimit",
    canonicalTerm: "Deckungsgrenze",
    aliases: [
      "Deckungsgrenze",
      "Versicherungssumme",
      "Sublimit",
      "Höchstentschädigung",
      "auf Erstes Risiko",
    ],
  },
  {
    groupKey: "selbstbehalt",
    canonicalTerm: "Selbstbehalt",
    aliases: ["Selbstbehalt", "Selbstbeteiligung", "Franchise"],
  },
]);

function normalize(value = "") {
  return String(value)
    .normalize("NFKC")
    .replace(/\u00ad/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

const ComparisonTermAliasCatalog = {
  version: TERM_ALIAS_CATALOG_VERSION,

  async sync({ db = prisma, groups = BUILTIN_TERM_GROUPS } = {}) {
    const rows = groups.flatMap((group) =>
      group.aliases.map((alias) => ({
        catalogVersion: TERM_ALIAS_CATALOG_VERSION,
        groupKey: group.groupKey,
        canonicalTerm: normalize(group.canonicalTerm),
        aliasTerm: normalize(alias),
        aliasKind:
          normalize(alias) === normalize(group.canonicalTerm)
            ? "canonical"
            : "alias",
      }))
    );
    // Prisma 5.3's SQLite engine rejects createMany for this model even though
    // the generated client exposes it. Compound upserts keep sync idempotent.
    for (const row of rows)
      await db.comparison_document_term_aliases.upsert({
        where: {
          catalogVersion_groupKey_aliasTerm: {
            catalogVersion: row.catalogVersion,
            groupKey: row.groupKey,
            aliasTerm: row.aliasTerm,
          },
        },
        create: row,
        update: {
          canonicalTerm: row.canonicalTerm,
          aliasKind: row.aliasKind,
        },
      });
    return rows.length;
  },

  async expand(terms = [], { db = prisma } = {}) {
    const normalizedTerms = [...new Set(terms.map(normalize).filter(Boolean))];
    if (!normalizedTerms.length) return [];
    await this.sync({ db });
    const direct = await db.comparison_document_term_aliases.findMany({
      where: {
        catalogVersion: TERM_ALIAS_CATALOG_VERSION,
        OR: [
          { aliasTerm: { in: normalizedTerms } },
          { canonicalTerm: { in: normalizedTerms } },
        ],
      },
      select: { groupKey: true },
    });
    const groupKeys = [...new Set(direct.map((row) => row.groupKey))];
    if (!groupKeys.length) return normalizedTerms;
    const rows = await db.comparison_document_term_aliases.findMany({
      where: {
        catalogVersion: TERM_ALIAS_CATALOG_VERSION,
        groupKey: { in: groupKeys },
      },
      orderBy: [{ groupKey: "asc" }, { aliasTerm: "asc" }],
    });
    return [
      ...new Set([
        ...normalizedTerms,
        ...rows.map((row) => row.aliasTerm),
        ...rows.map((row) => row.canonicalTerm),
      ]),
    ];
  },
};

module.exports = {
  ComparisonTermAliasCatalog,
  TERM_ALIAS_CATALOG_VERSION,
  BUILTIN_TERM_GROUPS,
};
