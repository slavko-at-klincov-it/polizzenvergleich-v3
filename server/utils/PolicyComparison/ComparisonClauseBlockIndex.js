const prisma = require("../prisma");
const { ComparisonTermAliasCatalog } = require("./ComparisonTermAliasCatalog");

function normalizeTerm(value = "") {
  return String(value)
    .normalize("NFKC")
    .replace(/\u00ad/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function ftsExpression(terms = [], { prefix = false } = {}) {
  const safe = [...new Set(terms.map(normalizeTerm).filter(Boolean))].map(
    (term) => `"${term.replace(/"/gu, '""')}"${prefix ? "*" : ""}`
  );
  return safe.join(" OR ");
}

/**
 * Exact/prefix FTS boundary for the canonical clause blocks of one analysis run.
 * Synonyms and semantic similarity deliberately live outside this module.
 */
const ComparisonClauseBlockIndex = {
  _schemaPromise: null,

  async ensureSchema(db = prisma) {
    if (!this._schemaPromise)
      this._schemaPromise = db
        .$executeRawUnsafe(
          `CREATE VIRTUAL TABLE IF NOT EXISTS comparison_document_clause_blocks_fts
           USING fts5(
             analysisRunId UNINDEXED,
             blockId UNINDEXED,
             comparisonDocumentId UNINDEXED,
             pageNumber UNINDEXED,
             ordinal UNINDEXED,
             text,
             tokenize='unicode61 remove_diacritics 2'
           )`
        )
        .catch((error) => {
          this._schemaPromise = null;
          throw error;
        });
    await this._schemaPromise;
  },

  async indexRun({ analysisRunId, comparisonDocumentId, db = prisma }) {
    await this.ensureSchema(db);
    await ComparisonTermAliasCatalog.sync({ db });
    const blocks = await db.comparison_document_clause_blocks.findMany({
      where: { analysisRunId },
      orderBy: [{ ordinal: "asc" }],
    });
    await db.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        "DELETE FROM comparison_document_clause_blocks_fts WHERE analysisRunId = ?",
        analysisRunId
      );
      for (const block of blocks)
        await transaction.$executeRawUnsafe(
          `INSERT INTO comparison_document_clause_blocks_fts
           (analysisRunId, blockId, comparisonDocumentId, pageNumber, ordinal, text)
           VALUES (?, ?, ?, ?, ?, ?)`,
          analysisRunId,
          block.id,
          comparisonDocumentId,
          block.pageNumber,
          block.ordinal,
          block.text
        );
      await transaction.comparison_document_clause_blocks.updateMany({
        where: { analysisRunId },
        data: { ftsStatus: "ready", lastUpdatedAt: new Date() },
      });
    });
    return blocks.length;
  },

  async removeRun(analysisRunId, db = prisma) {
    await this.ensureSchema(db);
    await db.$executeRawUnsafe(
      "DELETE FROM comparison_document_clause_blocks_fts WHERE analysisRunId = ?",
      analysisRunId
    );
  },

  async searchRun({
    analysisRunId,
    terms = [],
    prefix = false,
    expandAliases = true,
    limit = 50,
    db = prisma,
  }) {
    await this.ensureSchema(db);
    const routedTerms = expandAliases
      ? await ComparisonTermAliasCatalog.expand(terms, { db })
      : terms;
    const match = ftsExpression(routedTerms, { prefix });
    if (!match) return [];
    const boundedLimit = Math.max(1, Math.min(500, Number(limit) || 50));
    return db.$queryRawUnsafe(
      `SELECT analysisRunId, blockId, comparisonDocumentId, pageNumber,
              ordinal, text, bm25(comparison_document_clause_blocks_fts) AS rank
       FROM comparison_document_clause_blocks_fts
       WHERE comparison_document_clause_blocks_fts MATCH ?
         AND analysisRunId = ?
       ORDER BY rank ASC, ordinal ASC
       LIMIT ?`,
      match,
      analysisRunId,
      boundedLimit
    );
  },
};

module.exports = { ComparisonClauseBlockIndex, ftsExpression };
