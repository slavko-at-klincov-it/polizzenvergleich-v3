#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$SCRIPT_DIR/.runtime/node-v22.23.2/bin/node"

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  printf '%s\n' "Verwendung: $0 '/ABSOLUTER/PFAD/LF.pdf' '/ABSOLUTER/PFAD/WEVIG.pdf' [AUSGABEORDNER]" >&2
  exit 1
fi

LF_PDF="$1"
WEVIG_PDF="$2"
PRIVATE_QA_ROOT="$HOME/Library/Application Support/at.klincov.polizzenvergleich-v3/QA"
OUTPUT_DIR="${3:-$PRIVATE_QA_ROOT/VS-FULL-QUALITY-AB-$(date +%Y%m%d-%H%M%S)}"
MODEL="${VS_FULL_MODEL:-qwen/qwen3.8-27b}"
EMBEDDING_MODEL="${VS_FULL_EMBEDDING_MODEL:-dinghy-embed}"
MODEL_TOKEN_LIMIT="${VS_FULL_MODEL_TOKEN_LIMIT:-42496}"
USER_PROMPT="Analysiere die vollständig im Kontext bereitgestellten Vertragsdokumente gemäß dem Systemprompt. Gib ausschließlich die definierte Tabelle für VS-01 bis VS-36 und anschließend den vorgeschriebenen Hinweis aus."

[ -x "$NODE_BIN" ] || {
  printf '%s\n' "Lokale Node-22-Laufzeit fehlt. Bitte zuerst install.command ausführen." >&2
  exit 1
}
[ -f "$LF_PDF" ] || { printf '%s\n' "LF-PDF fehlt: $LF_PDF" >&2; exit 1; }
[ -f "$WEVIG_PDF" ] || { printf '%s\n' "WEVIG-PDF fehlt: $WEVIG_PDF" >&2; exit 1; }
[ ! -e "$OUTPUT_DIR" ] || {
  printf '%s\n' "Ausgabeordner existiert bereits: $OUTPUT_DIR" >&2
  exit 1
}

umask 077
mkdir -p "$OUTPUT_DIR"

export LMSTUDIO_MODEL_PREF="$MODEL"
export LMSTUDIO_MODEL_TOKEN_LIMIT="$MODEL_TOKEN_LIMIT"
export EMBEDDING_MODEL_PREF="$EMBEDDING_MODEL"
export EMBEDDING_MODEL_MAX_CHUNK_LENGTH="${EMBEDDING_MODEL_MAX_CHUNK_LENGTH:-8192}"
# Dieser Runner verarbeitet vertrauliche Vertragsdokumente ausschließlich über
# das lokale LM-Studio. Geerbte Remote-Endpunkte dürfen den Zielort nicht
# unbemerkt verändern.
export LMSTUDIO_BASE_PATH="http://127.0.0.1:1234/v1"
export EMBEDDING_BASE_PATH="http://127.0.0.1:1234/v1"

run_document() {
  local document_key="$1"
  local pdf_file="$2"
  local document_status="$3"
  local document_dir="$OUTPUT_DIR/$document_key"
  local baseline_dir="$document_dir/A-v3.2.1-compatible-replay"
  local adapted_dir="$document_dir/B-v3.3.0-full"
  local worksheet="$adapted_dir/worksheet.private.json"
  local triage_dir="$adapted_dir/triage"
  local effects_dir="$adapted_dir/effects"
  local result_dir="$adapted_dir/result"

  mkdir -p "$baseline_dir" "$triage_dir" "$effects_dir" "$result_dir"

  printf '%s\n' "[vs-full-quality-ab] $document_key: A – v3.2.1-kompatibles Legacy-Replay (aktueller QA-Harness)"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/pdfProvenanceLiveRun.cjs" \
    --pdf "$pdf_file" \
    --output "$baseline_dir" \
    --systemPromptFile "$SCRIPT_DIR/server/resources/workspaceTemplates/VS_versicherungssumme_und_versicherte_sachen.md" \
    --userPrompt "$USER_PROMPT" \
    --retrievalQuery "$USER_PROMPT" \
    --chunkSize 3000 \
    --chunkOverlap 250 \
    --topN 55 \
    --modelTokenLimit "$MODEL_TOKEN_LIMIT" \
    --maxCompletionTokens provider-default

  printf '%s\n' "[vs-full-quality-ab] $document_key: B – 36er-Worksheet"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/buildVsOccurrenceWorksheet.cjs" \
    --pdfFile "$pdf_file" \
    --catalogFile "$SCRIPT_DIR/server/resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json" \
    --output "$worksheet"

  printf '%s\n' "[vs-full-quality-ab] $document_key: B – Candidate-Triage"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runVsCandidateTriage.cjs" \
    --worksheet "$worksheet" \
    --systemPromptFile "$SCRIPT_DIR/server/resources/policyAnalysis/vs-candidate-triage-system.v0.1.md" \
    --controlMode technical-review \
    --output "$triage_dir" \
    --model "$MODEL" \
    --modelTokenLimit "$MODEL_TOKEN_LIMIT" \
    --maxAttemptsPerTarget 2

  printf '%s\n' "[vs-full-quality-ab] $document_key: B – atomare Wirkungsprüfung"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runPreparedEvidenceEvaluation.cjs" \
    --worksheet "$worksheet" \
    --triageFile "$triage_dir/materialized-triage.private.json" \
    --systemPromptFile "$SCRIPT_DIR/server/resources/policyAnalysis/vs-prepared-evidence-system.v0.1.md" \
    --controlMode technical-review \
    --documentStatus "$document_status" \
    --output "$effects_dir" \
    --model "$MODEL" \
    --modelTokenLimit "$MODEL_TOKEN_LIMIT" \
    --maxAttemptsPerTarget 2 \
    --allowUniqueCandidateIdRepair true

  printf '%s\n' "[vs-full-quality-ab] $document_key: 36-Zeilen-Deltabericht"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/materializeVsFullResult.cjs" \
    --documentKey "$document_key" \
    --pdf "$pdf_file" \
    --worksheet "$worksheet" \
    --triage "$triage_dir/materialized-triage.private.json" \
    --triageReport "$triage_dir/report.json" \
    --effects "$effects_dir/materialized.private.json" \
    --effectsReport "$effects_dir/report.json" \
    --sources "$effects_dir/selected-sources.private.json" \
    --legacyAnswer "$baseline_dir/answer.md" \
    --legacyReport "$baseline_dir/report.json" \
    --documentStatus "$document_status" \
    --model "$MODEL" \
    --embeddingModel "$EMBEDDING_MODEL" \
    --output "$result_dir"
}

run_document \
  "LF" \
  "$LF_PDF" \
  "FRAMEWORK_TERMS"

run_document \
  "WEVIG" \
  "$WEVIG_PDF" \
  "PROPOSAL"

printf '%s\n' "[vs-full-quality-ab] FERTIG: $OUTPUT_DIR"
printf '%s\n' "[vs-full-quality-ab] Vergleich LF: $OUTPUT_DIR/LF/B-v3.3.0-full/result/comparison.md"
printf '%s\n' "[vs-full-quality-ab] Vergleich WEVIG: $OUTPUT_DIR/WEVIG/B-v3.3.0-full/result/comparison.md"
