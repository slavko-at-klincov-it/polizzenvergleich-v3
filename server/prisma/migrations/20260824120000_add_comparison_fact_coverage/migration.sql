-- Every analysis is staged in an immutable run. The comparison document points
-- only at the last completely published run; building or failed runs never
-- replace or delete that published snapshot.
CREATE TABLE "comparison_document_analysis_runs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "comparisonDocumentId" INTEGER NOT NULL,
    "pipelineVersion" INTEGER NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'building',
    "expectedBlockCount" INTEGER NOT NULL DEFAULT 0,
    "terminalBlockCount" INTEGER NOT NULL DEFAULT 0,
    "factCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "comparison_document_analysis_runs_document_fkey"
      FOREIGN KEY ("comparisonDocumentId") REFERENCES "comparison_documents" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "comparison_document_analysis_runs_identity_idx"
ON "comparison_document_analysis_runs"("comparisonDocumentId", "pipelineVersion", "sourceSha256");
-- One resumable staging run per exact input contract. Published/ready runs are
-- immutable snapshots and deliberately do not participate in this index.
CREATE UNIQUE INDEX "comparison_document_analysis_runs_active_identity"
ON "comparison_document_analysis_runs"("comparisonDocumentId", "pipelineVersion", "sourceSha256")
WHERE "status" IN ('building', 'retryable_failed');
CREATE INDEX "comparison_document_analysis_runs_document_status_idx"
ON "comparison_document_analysis_runs"("comparisonDocumentId", "status");

ALTER TABLE "comparison_documents" ADD COLUMN "publishedAnalysisRunId" INTEGER
  REFERENCES "comparison_document_analysis_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "comparison_documents_publishedAnalysisRunId_key"
ON "comparison_documents"("publishedAnalysisRunId");

CREATE TABLE "comparison_document_clause_blocks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "analysisRunId" INTEGER NOT NULL,
    "blockKey" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "printedPageLabel" TEXT,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,
    "sourceStart" INTEGER NOT NULL,
    "sourceEnd" INTEGER NOT NULL,
    "textHash" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sourceMethod" TEXT,
    "structureKind" TEXT NOT NULL DEFAULT 'unknown',
    "headingPathJson" TEXT NOT NULL DEFAULT '[]',
    "layoutQuality" TEXT NOT NULL DEFAULT 'text_only',
    "ftsStatus" TEXT NOT NULL DEFAULT 'pending',
    "embeddingStatus" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "factCount" INTEGER NOT NULL DEFAULT 0,
    "reasonCode" TEXT,
    "error" TEXT,
    "leaseToken" TEXT,
    "leaseExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comparison_document_clause_blocks_run_fkey"
      FOREIGN KEY ("analysisRunId") REFERENCES "comparison_document_analysis_runs" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "comparison_document_clause_blocks_run_block_key"
ON "comparison_document_clause_blocks"("analysisRunId", "blockKey");
CREATE UNIQUE INDEX "comparison_document_clause_blocks_run_ordinal"
ON "comparison_document_clause_blocks"("analysisRunId", "ordinal");
CREATE INDEX "comparison_document_clause_blocks_resume_idx"
ON "comparison_document_clause_blocks"("analysisRunId", "status", "ordinal");

CREATE TABLE "comparison_document_block_signals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "analysisRunId" INTEGER NOT NULL,
    "blockId" INTEGER NOT NULL,
    "signalKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "valueJson" TEXT,
    "sourceStart" INTEGER NOT NULL,
    "sourceEnd" INTEGER NOT NULL,
    "evidenceText" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comparison_document_block_signals_run_fkey"
      FOREIGN KEY ("analysisRunId") REFERENCES "comparison_document_analysis_runs" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comparison_document_block_signals_block_fkey"
      FOREIGN KEY ("blockId") REFERENCES "comparison_document_clause_blocks" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "comparison_document_block_signals_run_block_signal_key"
ON "comparison_document_block_signals"("analysisRunId", "blockId", "signalKey");
CREATE INDEX "comparison_document_block_signals_run_kind_idx"
ON "comparison_document_block_signals"("analysisRunId", "kind");
CREATE INDEX "comparison_document_block_signals_block_kind_idx"
ON "comparison_document_block_signals"("blockId", "kind");

CREATE TABLE "comparison_document_block_embeddings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "analysisRunId" INTEGER NOT NULL,
    "blockId" INTEGER NOT NULL,
    "vectorId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "textHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comparison_document_block_embeddings_run_fkey"
      FOREIGN KEY ("analysisRunId") REFERENCES "comparison_document_analysis_runs" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comparison_document_block_embeddings_block_fkey"
      FOREIGN KEY ("blockId") REFERENCES "comparison_document_clause_blocks" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "comparison_document_block_embeddings_run_block_key"
ON "comparison_document_block_embeddings"("analysisRunId", "blockId");
CREATE UNIQUE INDEX "comparison_document_block_embeddings_blockId_key"
ON "comparison_document_block_embeddings"("blockId");
CREATE INDEX "comparison_document_block_embeddings_run_status_idx"
ON "comparison_document_block_embeddings"("analysisRunId", "status");
CREATE UNIQUE INDEX "comparison_document_block_embeddings_vectorId_key"
ON "comparison_document_block_embeddings"("vectorId");

-- Facts are staged inside their run. Legacy rows remain nullable and readable,
-- but new uniqueness is run-scoped so identical facts can coexist across runs.
ALTER TABLE "comparison_document_inventory_items" ADD COLUMN "analysisRunId" INTEGER
  REFERENCES "comparison_document_analysis_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comparison_document_inventory_items" ADD COLUMN "primaryBlockId" INTEGER
  REFERENCES "comparison_document_clause_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comparison_document_inventory_items" ADD COLUMN "unitKey" TEXT;
ALTER TABLE "comparison_document_inventory_items" ADD COLUMN "factType" TEXT;
ALTER TABLE "comparison_document_inventory_items" ADD COLUMN "claimText" TEXT;
ALTER TABLE "comparison_document_inventory_items" ADD COLUMN "evidenceStart" INTEGER;
ALTER TABLE "comparison_document_inventory_items" ADD COLUMN "evidenceEnd" INTEGER;

DROP INDEX "comparison_document_inventory_items_document_fact_key";
CREATE UNIQUE INDEX "comparison_document_inventory_items_run_fact_key"
ON "comparison_document_inventory_items"("analysisRunId", "factKey");
CREATE UNIQUE INDEX "comparison_document_inventory_items_legacy_document_fact_key"
ON "comparison_document_inventory_items"("comparisonDocumentId", "factKey")
WHERE "analysisRunId" IS NULL;
CREATE INDEX "comparison_document_inventory_items_run_block_idx"
ON "comparison_document_inventory_items"("analysisRunId", "primaryBlockId");

CREATE TABLE "comparison_document_fact_evidence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "analysisRunId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "blockId" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "sourceStart" INTEGER NOT NULL,
    "sourceEnd" INTEGER NOT NULL,
    "evidenceText" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comparison_document_fact_evidence_run_fkey"
      FOREIGN KEY ("analysisRunId") REFERENCES "comparison_document_analysis_runs" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comparison_document_fact_evidence_item_fkey"
      FOREIGN KEY ("inventoryItemId") REFERENCES "comparison_document_inventory_items" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comparison_document_fact_evidence_block_fkey"
      FOREIGN KEY ("blockId") REFERENCES "comparison_document_clause_blocks" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "comparison_document_fact_evidence_run_item_ordinal"
ON "comparison_document_fact_evidence"("analysisRunId", "inventoryItemId", "ordinal");
CREATE INDEX "comparison_document_fact_evidence_run_block_idx"
ON "comparison_document_fact_evidence"("analysisRunId", "blockId");
CREATE INDEX "comparison_document_fact_evidence_block_idx"
ON "comparison_document_fact_evidence"("blockId");

CREATE TABLE "comparison_document_term_aliases" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "catalogVersion" INTEGER NOT NULL,
    "groupKey" TEXT NOT NULL,
    "canonicalTerm" TEXT NOT NULL,
    "aliasTerm" TEXT NOT NULL,
    "aliasKind" TEXT NOT NULL DEFAULT 'alias',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "comparison_document_term_aliases_version_group_alias"
ON "comparison_document_term_aliases"("catalogVersion", "groupKey", "aliasTerm");
CREATE INDEX "comparison_document_term_aliases_version_canonical_idx"
ON "comparison_document_term_aliases"("catalogVersion", "canonicalTerm");

-- FTS is exact/prefix retrieval only. Synonyms live in a versioned alias table
-- and unknown semantic relations in Dinghy embeddings.
CREATE VIRTUAL TABLE "comparison_document_clause_blocks_fts" USING fts5(
  analysisRunId UNINDEXED,
  blockId UNINDEXED,
  comparisonDocumentId UNINDEXED,
  pageNumber UNINDEXED,
  ordinal UNINDEXED,
  text,
  tokenize='unicode61 remove_diacritics 2'
);

-- SQLite cannot add composite foreign keys to the two legacy tables via
-- ALTER TABLE. These triggers enforce the same-run ownership contract for the
-- additive run columns and for every newly created child row.
CREATE TRIGGER "comparison_documents_publish_ready_run_insert"
BEFORE INSERT ON "comparison_documents"
WHEN NEW."publishedAnalysisRunId" IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "comparison_document_analysis_runs" AS run
    WHERE run."id" = NEW."publishedAnalysisRunId"
      AND run."comparisonDocumentId" = NEW."id"
      AND run."status" = 'ready'
  ) THEN RAISE(ABORT, 'published analysis run must be ready and belong to the document') END;
END;

CREATE TRIGGER "comparison_documents_publish_ready_run_update"
BEFORE UPDATE OF "publishedAnalysisRunId" ON "comparison_documents"
WHEN NEW."publishedAnalysisRunId" IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "comparison_document_analysis_runs" AS run
    WHERE run."id" = NEW."publishedAnalysisRunId"
      AND run."comparisonDocumentId" = NEW."id"
      AND run."status" = 'ready'
  ) THEN RAISE(ABORT, 'published analysis run must be ready and belong to the document') END;
END;

CREATE TRIGGER "comparison_document_analysis_runs_published_immutable"
BEFORE UPDATE ON "comparison_document_analysis_runs"
WHEN OLD."status" = 'ready' AND EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" = OLD."id"
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis run is immutable');
END;

CREATE TRIGGER "comparison_document_analysis_runs_published_delete_guard"
BEFORE DELETE ON "comparison_document_analysis_runs"
WHEN EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" = OLD."id"
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis run cannot be deleted');
END;

CREATE TRIGGER "comparison_document_clause_blocks_published_insert_guard"
BEFORE INSERT ON "comparison_document_clause_blocks"
WHEN EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" = NEW."analysisRunId"
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis blocks are immutable');
END;

CREATE TRIGGER "comparison_document_clause_blocks_published_update_guard"
BEFORE UPDATE ON "comparison_document_clause_blocks"
WHEN EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" IN (OLD."analysisRunId", NEW."analysisRunId")
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis blocks are immutable');
END;

CREATE TRIGGER "comparison_document_clause_blocks_published_delete_guard"
BEFORE DELETE ON "comparison_document_clause_blocks"
WHEN EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" = OLD."analysisRunId"
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis blocks are immutable');
END;

CREATE TRIGGER "comparison_document_inventory_items_run_insert"
BEFORE INSERT ON "comparison_document_inventory_items"
WHEN NEW."analysisRunId" IS NOT NULL
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM "comparison_documents" AS document
    WHERE document."publishedAnalysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'published analysis facts are immutable') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "comparison_document_analysis_runs" AS run
    WHERE run."id" = NEW."analysisRunId"
      AND run."comparisonDocumentId" = NEW."comparisonDocumentId"
  ) THEN RAISE(ABORT, 'fact analysis run does not belong to the document') END;
  SELECT CASE WHEN NEW."primaryBlockId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "comparison_document_clause_blocks" AS block
    WHERE block."id" = NEW."primaryBlockId"
      AND block."analysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'fact primary block does not belong to the analysis run') END;
END;

CREATE TRIGGER "comparison_document_inventory_items_published_update_guard"
BEFORE UPDATE ON "comparison_document_inventory_items"
WHEN EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" IN (OLD."analysisRunId", NEW."analysisRunId")
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis facts are immutable');
END;

CREATE TRIGGER "comparison_document_inventory_items_published_delete_guard"
BEFORE DELETE ON "comparison_document_inventory_items"
WHEN OLD."analysisRunId" IS NOT NULL AND EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" = OLD."analysisRunId"
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis facts are immutable');
END;

CREATE TRIGGER "comparison_document_inventory_items_run_update"
BEFORE UPDATE OF "analysisRunId", "comparisonDocumentId", "primaryBlockId"
ON "comparison_document_inventory_items"
WHEN NEW."analysisRunId" IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "comparison_document_analysis_runs" AS run
    WHERE run."id" = NEW."analysisRunId"
      AND run."comparisonDocumentId" = NEW."comparisonDocumentId"
  ) THEN RAISE(ABORT, 'fact analysis run does not belong to the document') END;
  SELECT CASE WHEN NEW."primaryBlockId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "comparison_document_clause_blocks" AS block
    WHERE block."id" = NEW."primaryBlockId"
      AND block."analysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'fact primary block does not belong to the analysis run') END;
END;

CREATE TRIGGER "comparison_document_block_signals_run_insert"
BEFORE INSERT ON "comparison_document_block_signals"
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM "comparison_documents" AS document
    WHERE document."publishedAnalysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'published analysis signals are immutable') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "comparison_document_clause_blocks" AS block
    WHERE block."id" = NEW."blockId"
      AND block."analysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'signal block does not belong to the analysis run') END;
END;

CREATE TRIGGER "comparison_document_block_signals_published_update_guard"
BEFORE UPDATE ON "comparison_document_block_signals"
WHEN EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" IN (OLD."analysisRunId", NEW."analysisRunId")
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis signals are immutable');
END;

CREATE TRIGGER "comparison_document_block_signals_published_delete_guard"
BEFORE DELETE ON "comparison_document_block_signals"
WHEN EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" = OLD."analysisRunId"
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis signals are immutable');
END;

CREATE TRIGGER "comparison_document_block_signals_run_update"
BEFORE UPDATE OF "analysisRunId", "blockId"
ON "comparison_document_block_signals"
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "comparison_document_clause_blocks" AS block
    WHERE block."id" = NEW."blockId"
      AND block."analysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'signal block does not belong to the analysis run') END;
END;

CREATE TRIGGER "comparison_document_block_embeddings_run_insert"
BEFORE INSERT ON "comparison_document_block_embeddings"
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM "comparison_documents" AS document
    WHERE document."publishedAnalysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'published analysis embeddings are immutable') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "comparison_document_clause_blocks" AS block
    WHERE block."id" = NEW."blockId"
      AND block."analysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'embedding block does not belong to the analysis run') END;
END;

CREATE TRIGGER "comparison_document_block_embeddings_published_update_guard"
BEFORE UPDATE ON "comparison_document_block_embeddings"
WHEN EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" IN (OLD."analysisRunId", NEW."analysisRunId")
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis embeddings are immutable');
END;

CREATE TRIGGER "comparison_document_block_embeddings_published_delete_guard"
BEFORE DELETE ON "comparison_document_block_embeddings"
WHEN EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" = OLD."analysisRunId"
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis embeddings are immutable');
END;

CREATE TRIGGER "comparison_document_block_embeddings_run_update"
BEFORE UPDATE OF "analysisRunId", "blockId"
ON "comparison_document_block_embeddings"
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "comparison_document_clause_blocks" AS block
    WHERE block."id" = NEW."blockId"
      AND block."analysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'embedding block does not belong to the analysis run') END;
END;

CREATE TRIGGER "comparison_document_fact_evidence_run_insert"
BEFORE INSERT ON "comparison_document_fact_evidence"
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM "comparison_documents" AS document
    WHERE document."publishedAnalysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'published analysis evidence is immutable') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "comparison_document_inventory_items" AS fact
    WHERE fact."id" = NEW."inventoryItemId"
      AND fact."analysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'evidence fact does not belong to the analysis run') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "comparison_document_clause_blocks" AS block
    WHERE block."id" = NEW."blockId"
      AND block."analysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'evidence block does not belong to the analysis run') END;
END;

CREATE TRIGGER "comparison_document_fact_evidence_published_update_guard"
BEFORE UPDATE ON "comparison_document_fact_evidence"
WHEN EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" IN (OLD."analysisRunId", NEW."analysisRunId")
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis evidence is immutable');
END;

CREATE TRIGGER "comparison_document_fact_evidence_published_delete_guard"
BEFORE DELETE ON "comparison_document_fact_evidence"
WHEN EXISTS (
  SELECT 1 FROM "comparison_documents" AS document
  WHERE document."publishedAnalysisRunId" = OLD."analysisRunId"
)
BEGIN
  SELECT RAISE(ABORT, 'published analysis evidence is immutable');
END;

CREATE TRIGGER "comparison_document_fact_evidence_run_update"
BEFORE UPDATE OF "analysisRunId", "inventoryItemId", "blockId"
ON "comparison_document_fact_evidence"
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "comparison_document_inventory_items" AS fact
    WHERE fact."id" = NEW."inventoryItemId"
      AND fact."analysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'evidence fact does not belong to the analysis run') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "comparison_document_clause_blocks" AS block
    WHERE block."id" = NEW."blockId"
      AND block."analysisRunId" = NEW."analysisRunId"
  ) THEN RAISE(ABORT, 'evidence block does not belong to the analysis run') END;
END;
