const prisma = require("../prisma");
const { PageAwareTextSplitter } = require("../PageAwareTextSplitter");

const STOP_WORDS = new Set([
  "aber",
  "alle",
  "auch",
  "aus",
  "bei",
  "bitte",
  "das",
  "dem",
  "den",
  "der",
  "die",
  "ein",
  "eine",
  "einer",
  "eines",
  "für",
  "ist",
  "mit",
  "oder",
  "sind",
  "und",
  "vergleiche",
  "vergleichen",
  "vergleich",
  "von",
  "was",
  "welche",
  "wie",
  "zu",
  "zwischen",
]);

const SYNONYM_GROUPS = [
  [
    "selbstbehalt",
    "selbstbeteiligung",
    "franchise",
    "eigenanteil",
    "selbst zu tragen",
  ],
  ["prämie", "praemie", "beitrag", "jahresbeitrag", "versicherungsentgelt"],
  ["deckungssumme", "versicherungssumme", "höchstleistung", "limit"],
  ["ausschluss", "ausgeschlossen", "keine deckung", "nicht versichert"],
  ["obliegenheit", "pflicht", "anzeigepflicht", "meldepflicht"],
  ["wartezeit", "karenz", "beginn", "ablauf", "laufzeit", "kündigung"],
  ["schaden", "schadenfall", "versicherungsfall", "leistung"],
];

const DEFAULT_COMPARISON_TERMS = [
  "selbstbehalt",
  "prämie",
  "deckungssumme",
  "ausschluss",
  "obliegenheit",
  "wartezeit",
  "kündigung",
  "schadenfall",
];

const GENERIC_COMPARISON_WORDS = new Set([
  "beide",
  "beiden",
  "dokumente",
  "policen",
  "polizzen",
  "verträge",
  "vertraege",
  "vollständig",
  "vollstaendig",
  "komplett",
  "ausführlich",
  "ausfuehrlich",
  "miteinander",
]);

/**
 * Persistent local FTS5 index for page-bound policy chunks.
 *
 * Role: exact/lexical retrieval boundary. It stores only locally extracted
 * text and identifiers. It never calls an external model or service.
 */
const ComparisonChunkIndex = {
  _schemaPromise: null,

  normalize(text = "") {
    return String(text)
      .normalize("NFKC")
      .replace(/\u00ad/g, "")
      .replace(/([\p{L}\p{N}])-\s*\n\s*([\p{L}\p{N}])/gu, "$1$2")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("de-AT");
  },

  isGenericComparison(query = "") {
    const normalized = this.normalize(query);
    if (!/\bvergleich(?:e|en)?\b/u.test(normalized)) return false;
    const tokens = normalized.match(/[\p{L}\p{N}€%]+/gu) || [];
    const meaningful = tokens.filter(
      (token) =>
        token.length > 1 &&
        !STOP_WORDS.has(token) &&
        !GENERIC_COMPARISON_WORDS.has(token)
    );
    return meaningful.length === 0;
  },

  queryTerms(query = "") {
    const normalized = this.normalize(query);
    const queryTokens = normalized.match(/[\p{L}\p{N}€%]+/gu) || [];
    const terms = queryTokens.filter(
      (token) => token.length > 1 && !STOP_WORDS.has(token)
    );

    for (const group of SYNONYM_GROUPS) {
      if (group.some((term) => normalized.includes(term))) terms.push(...group);
    }

    // A broker will often start with only "compare these two policies". In
    // that case, search the critical contract categories even when filler
    // words such as "beiden Policen" survived stop-word filtering.
    if (this.isGenericComparison(query) || terms.length === 0)
      terms.push(...DEFAULT_COMPARISON_TERMS);
    return [
      ...new Set(terms.map((term) => this.normalize(term)).filter(Boolean)),
    ];
  },

  ftsQuery(query = "") {
    return this.queryTerms(query)
      .flatMap((term) => term.split(" "))
      .filter(Boolean)
      .map((term) => `"${term.replaceAll('"', '""')}"`)
      .join(" OR ");
  },

  async ensureSchema(db = prisma) {
    if (!this._schemaPromise) {
      this._schemaPromise = db
        .$executeRawUnsafe(
          `
          CREATE VIRTUAL TABLE IF NOT EXISTS comparison_document_chunks_fts
          USING fts5(
            comparisonDocumentId UNINDEXED,
            workspaceId UNINDEXED,
            threadId UNINDEXED,
            workspaceDocumentId UNINDEXED,
            docId UNINDEXED,
            slot UNINDEXED,
            originalFilename UNINDEXED,
            pageNumber UNINDEXED,
            chunkIndex UNINDEXED,
            text,
            normalizedText,
            tokenize = 'unicode61 remove_diacritics 2'
          )
        `
        )
        .catch((error) => {
          this._schemaPromise = null;
          throw new Error(
            `Could not initialize policy full-text index: ${error.message}`
          );
        });
    }
    await this._schemaPromise;
  },

  async indexDocument({ comparisonDocument, documentData, db = prisma }) {
    if (!comparisonDocument?.id || !comparisonDocument?.threadId)
      throw new Error("Comparison document scope is required for indexing.");
    if (!comparisonDocument?.workspaceDocumentId || !comparisonDocument?.docId)
      throw new Error(
        "Embedded document identifiers are required for indexing."
      );

    await this.ensureSchema(db);
    const chunks = await PageAwareTextSplitter.splitDocument({
      documentData,
      chunkSize: 1_500,
      chunkOverlap: 120,
    });

    await db.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        "DELETE FROM comparison_document_chunks_fts WHERE comparisonDocumentId = ?",
        comparisonDocument.id
      );

      for (const chunk of chunks) {
        await transaction.$executeRawUnsafe(
          `INSERT INTO comparison_document_chunks_fts (
            comparisonDocumentId, workspaceId, threadId, workspaceDocumentId,
            docId, slot, originalFilename, pageNumber, chunkIndex, text,
            normalizedText
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          comparisonDocument.id,
          comparisonDocument.workspaceId,
          comparisonDocument.threadId,
          comparisonDocument.workspaceDocumentId,
          comparisonDocument.docId,
          comparisonDocument.slot,
          comparisonDocument.originalFilename,
          chunk.metadata.pageNumber ?? null,
          chunk.metadata.chunkIndex,
          chunk.text,
          this.normalize(chunk.text)
        );
      }
    });

    return { indexed: chunks.length };
  },

  async removeDocument(comparisonDocumentId, db = prisma) {
    if (!comparisonDocumentId) return true;
    await this.ensureSchema(db);
    await db.$executeRawUnsafe(
      "DELETE FROM comparison_document_chunks_fts WHERE comparisonDocumentId = ?",
      comparisonDocumentId
    );
    return true;
  },

  async removeThread(threadId, db = prisma) {
    if (!threadId) return true;
    await this.ensureSchema(db);
    await db.$executeRawUnsafe(
      "DELETE FROM comparison_document_chunks_fts WHERE threadId = ?",
      threadId
    );
    return true;
  },

  async removeWorkspace(workspaceId, db = prisma) {
    if (!workspaceId) return true;
    await this.ensureSchema(db);
    await db.$executeRawUnsafe(
      "DELETE FROM comparison_document_chunks_fts WHERE workspaceId = ?",
      workspaceId
    );
    return true;
  },

  async searchDocument({
    threadId,
    comparisonDocumentId,
    query,
    limit = 8,
    db = prisma,
  }) {
    if (!threadId || !comparisonDocumentId) return [];
    await this.ensureSchema(db);
    const match = this.ftsQuery(query);
    if (!match) return [];

    const rows = await db.$queryRawUnsafe(
      `SELECT
        comparisonDocumentId, workspaceDocumentId, docId, slot,
        originalFilename, pageNumber, chunkIndex, text,
        bm25(comparison_document_chunks_fts) AS rank
      FROM comparison_document_chunks_fts
      WHERE comparison_document_chunks_fts MATCH ?
        AND threadId = ?
        AND comparisonDocumentId = ?
      ORDER BY rank ASC
      LIMIT ?`,
      match,
      threadId,
      comparisonDocumentId,
      Math.max(1, Math.min(Number(limit) || 8, 20))
    );

    const exactTerms = this.queryTerms(query);
    return rows.map((row) => {
      const normalizedText = this.normalize(row.text);
      const exactMatch = exactTerms.some((term) =>
        normalizedText.includes(term)
      );
      return {
        comparisonDocumentId: Number(row.comparisonDocumentId),
        workspaceDocumentId: Number(row.workspaceDocumentId),
        docId: row.docId,
        slot: row.slot,
        title: row.originalFilename,
        pageNumber: row.pageNumber === null ? null : Number(row.pageNumber),
        chunkIndex: Number(row.chunkIndex),
        text: row.text,
        exactMatch,
        lexicalRank: Number(row.rank),
        retrieval: "lexical",
      };
    });
  },

  async searchComparisonCatalog({
    threadId,
    comparisonDocumentId,
    limitPerCategory = 2,
    db = prisma,
  }) {
    const catalogResults = [];
    for (const query of DEFAULT_COMPARISON_TERMS) {
      catalogResults.push(
        ...(await this.searchDocument({
          threadId,
          comparisonDocumentId,
          query,
          limit: limitPerCategory,
          db,
        }))
      );
    }

    const seen = new Set();
    return catalogResults.filter((result) => {
      const key = `${result.comparisonDocumentId}:${result.pageNumber ?? "?"}:${result.chunkIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
};

module.exports = {
  ComparisonChunkIndex,
  DEFAULT_COMPARISON_TERMS,
  SYNONYM_GROUPS,
  GENERIC_COMPARISON_WORDS,
};
