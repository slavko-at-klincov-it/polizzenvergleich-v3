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
           inventoryError
    FROM comparison_documents
    LIMIT 1
  `);
  await prisma.$queryRawUnsafe(`
    SELECT comparisonDocumentId, factKey, facetKey, aliasesJson,
           pageNumber, evidenceHash
    FROM comparison_document_inventory_items
    LIMIT 1
  `);
  process.stdout.write(
    `${JSON.stringify({ ready: true, schema: "comparison-inventory-v1" })}\n`
  );
}

main()
  .catch((error) => {
    console.error(`Inventory schema check failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
