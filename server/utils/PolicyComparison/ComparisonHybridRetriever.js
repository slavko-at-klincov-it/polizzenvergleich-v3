const { ComparisonChunkIndex } = require("./ComparisonChunkIndex");

const RRF_K = 60;
const LANCEDB_NAME = "LanceDb";

/**
 * Retrieves evidence independently from both documents in a comparison thread.
 * It combines local FTS/BM25 and scoped vector retrieval while explicitly
 * preventing workspace-global documents from entering the prompt.
 */
const ComparisonHybridRetriever = {
  systemPrompt: `
Du vergleichst ausschließlich die zwei Policen des aktuellen Vergleichs.
Stütze jede konkrete Aussage auf die bereitgestellten Belegstellen und nenne
Dokument sowie Seite. Erfinde keine Vertragsinhalte. Wenn für einen Punkt in
einem Dokument keine belegte Fundstelle vorliegt, kennzeichne das ausdrücklich
als "keine belegte Fundstelle gefunden" und nicht als sicheren Ausschluss.
Vergleiche Beträge, Prozentsätze, Selbstbehalte, Deckungsgrenzen, Ausschlüsse,
Obliegenheiten und Bedingungen exakt. Antworte auf Deutsch.
  `.trim(),

  key(result = {}) {
    const normalizedText = ComparisonChunkIndex.normalize(result.text).slice(
      0,
      180
    );
    return `${result.docId}:${result.pageNumber ?? "?"}:${normalizedText}`;
  },

  mergeForDocument({ document, lexical = [], semantic = [], limit = 6 }) {
    const merged = new Map();
    const add = (result, rank, kind) => {
      const key = this.key({
        ...result,
        docId: result.docId || document.docId,
      });
      const previous = merged.get(key) || {
        ...result,
        docId: result.docId || document.docId,
        slot: document.slot,
        title: result.title || document.originalFilename,
        fusionScore: 0,
        retrievalMethods: [],
      };
      previous.fusionScore += 1 / (RRF_K + rank + 1);
      if (kind === "lexical" && result.exactMatch) previous.fusionScore += 0.05;
      if (!previous.retrievalMethods.includes(kind))
        previous.retrievalMethods.push(kind);
      if (previous.pageNumber == null && result.pageNumber != null)
        previous.pageNumber = result.pageNumber;
      merged.set(key, previous);
    };

    lexical.forEach((result, rank) => add(result, rank, "lexical"));
    semantic.forEach((result, rank) => add(result, rank, "semantic"));

    return [...merged.values()]
      .sort((a, b) => b.fusionScore - a.fusionScore)
      .slice(0, limit);
  },

  semanticSource(source = {}, document) {
    const metadata = source?.metadata || source;
    return {
      ...metadata,
      docId: document.docId,
      slot: document.slot,
      title: metadata.title || document.originalFilename,
      text: metadata.text || source.text || "",
      pageNumber:
        metadata.pageNumber == null ? null : Number(metadata.pageNumber),
      retrieval: "semantic",
    };
  },

  evidenceContext(result, document) {
    const page = result.pageNumber == null ? "unbekannt" : result.pageNumber;
    return `[DOKUMENT ${document.slot} | ${document.originalFilename} | Seite ${page}]\n${result.text}`;
  },

  async threadDocuments({ workspace, thread, user, documents = null }) {
    if (documents) return documents;
    const { ComparisonDocument } = require("../../models/comparisonDocument");
    return ComparisonDocument.forThread({
      workspaceId: workspace.id,
      threadId: thread.id,
      userId: user?.id ?? null,
    });
  },

  async retrieve({
    workspace,
    thread,
    user = null,
    query,
    LLMConnector,
    VectorDb,
    documents = null,
    topNPerDocument = 6,
    index = ComparisonChunkIndex,
  }) {
    if (!workspace || !thread) return { active: false };
    const threadDocuments = await this.threadDocuments({
      workspace,
      thread,
      user,
      documents,
    });
    if (threadDocuments.length === 0) return { active: false };
    const ready = threadDocuments.filter(
      (document) => document.status === "ready"
    );
    if (ready.length !== 2) {
      return {
        active: true,
        ready: false,
        message:
          "Für den Vergleich müssen genau zwei vollständig verarbeitete PDFs bereit sein.",
        contextTexts: [],
        sources: [],
      };
    }
    if (VectorDb?.name !== LANCEDB_NAME) {
      return {
        active: true,
        ready: false,
        message:
          "Der sichere Polizzenvergleich benötigt LanceDB, damit Treffer strikt auf die zwei PDFs dieses Threads begrenzt bleiben.",
        contextTexts: [],
        sources: [],
      };
    }

    const ordered = [...ready].sort((a, b) =>
      String(a.slot).localeCompare(String(b.slot))
    );
    const contextTexts = [];
    const sources = [];
    const genericComparison = ComparisonChunkIndex.isGenericComparison(query);
    const resultLimit = genericComparison
      ? Math.max(12, topNPerDocument)
      : topNPerDocument;
    const retrievalTerms = ComparisonChunkIndex.queryTerms(query).join(", ");
    const semanticQuery = `${query}\nRelevante Vertragsmerkmale: ${retrievalTerms}`;

    for (const document of ordered) {
      const lexical = genericComparison
        ? await index.searchComparisonCatalog({
            threadId: thread.id,
            comparisonDocumentId: document.id,
            limitPerCategory: 2,
          })
        : await index.searchDocument({
            threadId: thread.id,
            comparisonDocumentId: document.id,
            query,
            limit: resultLimit * 2,
          });
      const vectorResult = await VectorDb.performSimilaritySearch({
        namespace: workspace.slug,
        input: semanticQuery,
        LLMConnector,
        similarityThreshold: workspace?.similarityThreshold,
        topN: resultLimit * 2,
        includeDocIds: [document.docId],
        rerank: workspace?.vectorSearchMode === "rerank",
      });
      if (vectorResult.message) throw new Error(vectorResult.message);
      const semantic = (vectorResult.sources || []).map((source) =>
        this.semanticSource(source, document)
      );
      const merged = this.mergeForDocument({
        document,
        lexical,
        semantic,
        limit: resultLimit,
      });

      if (merged.length === 0) {
        contextTexts.push(
          `[DOKUMENT ${document.slot} | ${document.originalFilename}]\nKeine belegte Fundstelle für diese Anfrage gefunden.`
        );
        continue;
      }

      merged.forEach((result) => {
        contextTexts.push(this.evidenceContext(result, document));
        sources.push({
          ...result,
          title: document.originalFilename,
          documentSlot: document.slot,
          score: result.fusionScore,
        });
      });
    }

    return {
      active: true,
      ready: true,
      documents: ordered,
      contextTexts,
      sources,
      systemPrompt: this.systemPrompt,
    };
  },
};

module.exports = { ComparisonHybridRetriever };
