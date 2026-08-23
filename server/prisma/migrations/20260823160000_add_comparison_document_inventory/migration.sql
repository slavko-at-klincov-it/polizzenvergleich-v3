-- AlterTable
-- Nullable manifest fields distinguish legacy/unprocessed comparison documents
-- from completed inventories. Count fields are additive defaults, so existing
-- rows and their comparison lifecycle remain untouched.
ALTER TABLE "comparison_documents" ADD COLUMN "inventoryStatus" TEXT;
ALTER TABLE "comparison_documents" ADD COLUMN "inventoryVersion" INTEGER;
ALTER TABLE "comparison_documents" ADD COLUMN "inventoryItemCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "comparison_documents" ADD COLUMN "inventoryPageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "comparison_documents" ADD COLUMN "sourceSha256" TEXT;
ALTER TABLE "comparison_documents" ADD COLUMN "inventorySourceSha256" TEXT;
ALTER TABLE "comparison_documents" ADD COLUMN "inventoryError" TEXT;

-- CreateTable
CREATE TABLE "comparison_document_inventory_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "comparisonDocumentId" INTEGER NOT NULL,
    "factKey" TEXT NOT NULL,
    "facetKey" TEXT,
    "label" TEXT NOT NULL,
    "aliasesJson" TEXT NOT NULL DEFAULT '[]',
    "polarity" TEXT,
    "valueJson" TEXT,
    "unit" TEXT,
    "conditionsJson" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "evidenceText" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "sourceMethod" TEXT,
    "confidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comparison_document_inventory_items_comparisonDocumentId_fkey"
      FOREIGN KEY ("comparisonDocumentId") REFERENCES "comparison_documents" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "comparison_document_inventory_items_document_fact_key"
ON "comparison_document_inventory_items"("comparisonDocumentId", "factKey");

-- CreateIndex
CREATE INDEX "comparison_document_inventory_items_document_facet_idx"
ON "comparison_document_inventory_items"("comparisonDocumentId", "facetKey");

-- CreateIndex
CREATE INDEX "comparison_document_inventory_items_document_page_idx"
ON "comparison_document_inventory_items"("comparisonDocumentId", "pageNumber");

-- CreateIndex
CREATE INDEX "comparison_document_inventory_items_document_evidence_idx"
ON "comparison_document_inventory_items"("comparisonDocumentId", "evidenceHash");
