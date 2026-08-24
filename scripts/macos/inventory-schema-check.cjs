#!/usr/bin/env node

/**
 * Live readiness check for the additive comparison-inventory migration.
 * Even with zero comparison rows, SQLite validates every referenced column
 * and table while the queries are prepared.
 */
const prisma = require("../../server/utils/prisma");

async function main() {
  await prisma.$queryRawUnsafe(`
    SELECT sourceSha256, inventoryStatus, inventoryVersion,
           inventoryItemCount, inventoryPageCount, inventorySourceSha256,
           inventoryError, publishedAnalysisRunId
    FROM comparison_documents
    LIMIT 1
  `);
  await prisma.$queryRawUnsafe(`
    SELECT comparisonDocumentId, analysisRunId, primaryBlockId, factKey,
           facetKey, aliasesJson, pageNumber, evidenceHash,
           evidenceStart, evidenceEnd
    FROM comparison_document_inventory_items
    LIMIT 1
  `);
  await prisma.$queryRawUnsafe(`
    SELECT r.id, r.sourceSha256, r.status, r.expectedBlockCount,
           b.blockKey, b.pageNumber, b.sourceStart, b.sourceEnd,
           b.ftsStatus, b.embeddingStatus, b.status
    FROM comparison_document_analysis_runs r
    LEFT JOIN comparison_document_clause_blocks b ON b.analysisRunId = r.id
    LIMIT 1
  `);
  await prisma.$queryRawUnsafe(`
    SELECT s.analysisRunId, s.blockId, s.kind, s.sourceStart, s.sourceEnd,
           e.analysisRunId AS embeddingRunId, e.blockId AS embeddedBlockId,
           e.model, e.dimensions
    FROM comparison_document_block_signals s
    LEFT JOIN comparison_document_block_embeddings e ON e.blockId = s.blockId
    LIMIT 1
  `);
  await prisma.$queryRawUnsafe(`
    SELECT analysisRunId, inventoryItemId, blockId, pageNumber,
           sourceStart, sourceEnd, evidenceHash
    FROM comparison_document_fact_evidence
    LIMIT 1
  `);
  await prisma.$queryRawUnsafe(`
    SELECT analysisRunId, blockId, comparisonDocumentId, pageNumber, ordinal,
           text
    FROM comparison_document_clause_blocks_fts
    LIMIT 1
  `);
  process.stdout.write(
    `${JSON.stringify({ ready: true, schema: "comparison-facts-v2" })}\n`
  );
}

main()
  .catch((error) => {
    console.error(`Inventory schema check failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
