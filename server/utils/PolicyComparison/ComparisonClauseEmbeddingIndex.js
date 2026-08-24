const crypto = require("crypto");
const prisma = require("../prisma");
const { getEmbeddingEngineSelection } = require("../helpers");
const { LanceDb } = require("../vectorDbProviders/lance");
const { PolicyInferenceQueue } = require("./PolicyInferenceQueue");
const {
  assertManagedEmbeddingVector,
  MANAGED_EMBEDDING_ENV,
  EXPECTED_EMBEDDING_DIMENSIONS,
} = require("../../../shared/managedEmbeddingContract.cjs");

const CLAUSE_NAMESPACE = "policy_clause_blocks";
const DEFAULT_EMBEDDING_BATCH_SIZE = 8;

function batches(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size)
    result.push(values.slice(index, index + size));
  return result;
}

function stableVectorId({ analysisRunId, blockId, textHash }) {
  return `policy-clause-${crypto
    .createHash("sha256")
    .update(`${analysisRunId}\u0000${blockId}\u0000${textHash}`)
    .digest("hex")}`;
}

const ComparisonClauseEmbeddingIndex = {
  async indexRun({ analysisRunId, comparisonDocument, db = prisma }) {
    const blocks = await db.comparison_document_clause_blocks.findMany({
      where: { analysisRunId },
      orderBy: [{ ordinal: "asc" }],
    });
    const pending = blocks.filter((block) => block.embeddingStatus !== "ready");
    if (!pending.length) return blocks.length;
    const Embedder = getEmbeddingEngineSelection();
    for (const batch of batches(pending, DEFAULT_EMBEDDING_BATCH_SIZE)) {
      const ledgers = [];
      for (const block of batch) {
        const vectorId = stableVectorId({
          analysisRunId,
          blockId: block.id,
          textHash: block.textHash,
        });
        ledgers.push(
          await db.comparison_document_block_embeddings.upsert({
            where: {
              analysisRunId_blockId: { analysisRunId, blockId: block.id },
            },
            create: {
              analysisRunId,
              blockId: block.id,
              vectorId,
              namespace: CLAUSE_NAMESPACE,
              model: MANAGED_EMBEDDING_ENV.EMBEDDING_MODEL_PREF,
              dimensions: EXPECTED_EMBEDDING_DIMENSIONS,
              textHash: block.textHash,
              status: "pending",
            },
            update: {
              vectorId,
              namespace: CLAUSE_NAMESPACE,
              model: MANAGED_EMBEDDING_ENV.EMBEDDING_MODEL_PREF,
              dimensions: EXPECTED_EMBEDDING_DIMENSIONS,
              textHash: block.textHash,
              status: "pending",
              error: null,
              lastUpdatedAt: new Date(),
            },
          })
        );
      }
      const vectors = await PolicyInferenceQueue.runOperation({
        operation: () => Embedder.embedChunks(batch.map((block) => block.text)),
      });
      if (!Array.isArray(vectors) || vectors.length !== batch.length)
        throw new Error(
          "Dinghy did not return one embedding per clause block."
        );
      vectors.forEach(assertManagedEmbeddingVector);
      const records = batch.map((block, index) => ({
        id: ledgers[index].vectorId,
        vector: vectors[index],
        text: block.text,
        analysisRunId,
        blockId: block.id,
        comparisonDocumentId: comparisonDocument.id,
        workspaceId: comparisonDocument.workspaceId,
        threadId: comparisonDocument.threadId,
        pageNumber: block.pageNumber,
        ordinal: block.ordinal,
      }));
      const lance = new LanceDb();
      const { client } = await lance.connect();
      if (await lance.namespaceExists(client, CLAUSE_NAMESPACE)) {
        const table = await client.openTable(CLAUSE_NAMESPACE);
        await table.delete(
          lance.vectorIdFilter(records.map((record) => record.id))
        );
      }
      await lance.updateOrCreateCollection(client, records, CLAUSE_NAMESPACE);
      await db.$transaction(async (transaction) => {
        for (const [index, block] of batch.entries())
          await transaction.comparison_document_block_embeddings.upsert({
            where: {
              analysisRunId_blockId: { analysisRunId, blockId: block.id },
            },
            create: {
              analysisRunId,
              blockId: block.id,
              vectorId: records[index].id,
              namespace: CLAUSE_NAMESPACE,
              model: MANAGED_EMBEDDING_ENV.EMBEDDING_MODEL_PREF,
              dimensions: EXPECTED_EMBEDDING_DIMENSIONS,
              textHash: block.textHash,
              status: "ready",
            },
            update: {
              status: "ready",
              error: null,
              lastUpdatedAt: new Date(),
            },
          });
        await transaction.comparison_document_clause_blocks.updateMany({
          where: { analysisRunId, id: { in: batch.map((block) => block.id) } },
          data: { embeddingStatus: "ready", lastUpdatedAt: new Date() },
        });
      });
    }
    return blocks.length;
  },

  async semanticLinks({
    analysisRunId,
    text,
    topN = 8,
    similarityThreshold = 0.2,
    db = prisma,
  }) {
    const ledgers = await db.comparison_document_block_embeddings.findMany({
      where: { analysisRunId, status: "ready" },
      select: { vectorId: true },
    });
    if (!ledgers.length) return [];
    const Embedder = getEmbeddingEngineSelection();
    const queryVector = await PolicyInferenceQueue.runOperation({
      operation: () => Embedder.embedTextInput(String(text || "")),
    });
    assertManagedEmbeddingVector(queryVector);
    const lance = new LanceDb();
    const { client } = await lance.connect();
    if (!(await lance.namespaceExists(client, CLAUSE_NAMESPACE))) return [];
    const result = await lance.similarityResponse({
      client,
      namespace: CLAUSE_NAMESPACE,
      queryVector,
      similarityThreshold,
      topN: Math.max(1, Math.min(100, Number(topN) || 8)),
      includeVectorIds: ledgers.map((row) => row.vectorId),
    });
    return result.sourceDocuments.map((source, index) => ({
      ...source,
      text: result.contextTexts[index],
    }));
  },

  async removeVectorIds(vectorIds = []) {
    const ids = [...new Set(vectorIds.map(String).filter(Boolean))];
    if (!ids.length) return true;
    const lance = new LanceDb();
    const { client } = await lance.connect();
    if (!(await lance.namespaceExists(client, CLAUSE_NAMESPACE))) return true;
    const table = await client.openTable(CLAUSE_NAMESPACE);
    await table.delete(lance.vectorIdFilter(ids));
    return true;
  },
};

module.exports = {
  ComparisonClauseEmbeddingIndex,
  CLAUSE_NAMESPACE,
  DEFAULT_EMBEDDING_BATCH_SIZE,
  stableVectorId,
};
