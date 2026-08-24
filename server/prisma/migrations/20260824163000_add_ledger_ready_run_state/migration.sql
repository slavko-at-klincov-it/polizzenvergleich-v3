-- A deterministic clause ledger is a completed prerequisite, not an
-- interrupted full inventory. Keep exactly one reusable staged run for the
-- same document/source/pipeline while allowing immutable published snapshots.
DROP INDEX IF EXISTS "comparison_document_analysis_runs_active_identity";
CREATE UNIQUE INDEX "comparison_document_analysis_runs_active_identity"
ON "comparison_document_analysis_runs"("comparisonDocumentId", "pipelineVersion", "sourceSha256")
WHERE "status" IN ('building', 'ledger_ready', 'retryable_failed');
