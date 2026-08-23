-- Non-PDF comparison documents have canonical text evidence but no physical
-- PDF page number. Rebuild only the additive inventory child table and retain
-- every existing row and foreign-key relationship.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_comparison_document_inventory_items" (
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
    "pageNumber" INTEGER,
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

INSERT INTO "new_comparison_document_inventory_items" (
  "id", "comparisonDocumentId", "factKey", "facetKey", "label",
  "aliasesJson", "polarity", "valueJson", "unit", "conditionsJson",
  "pageNumber", "evidenceText", "evidenceHash", "sourceMethod",
  "confidence", "createdAt", "lastUpdatedAt"
)
SELECT
  "id", "comparisonDocumentId", "factKey", "facetKey", "label",
  "aliasesJson", "polarity", "valueJson", "unit", "conditionsJson",
  "pageNumber", "evidenceText", "evidenceHash", "sourceMethod",
  "confidence", "createdAt", "lastUpdatedAt"
FROM "comparison_document_inventory_items";

DROP TABLE "comparison_document_inventory_items";
ALTER TABLE "new_comparison_document_inventory_items"
  RENAME TO "comparison_document_inventory_items";

CREATE UNIQUE INDEX "comparison_document_inventory_items_document_fact_key"
ON "comparison_document_inventory_items"("comparisonDocumentId", "factKey");
CREATE INDEX "comparison_document_inventory_items_document_facet_idx"
ON "comparison_document_inventory_items"("comparisonDocumentId", "facetKey");
CREATE INDEX "comparison_document_inventory_items_document_page_idx"
ON "comparison_document_inventory_items"("comparisonDocumentId", "pageNumber");
CREATE INDEX "comparison_document_inventory_items_document_evidence_idx"
ON "comparison_document_inventory_items"("comparisonDocumentId", "evidenceHash");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
