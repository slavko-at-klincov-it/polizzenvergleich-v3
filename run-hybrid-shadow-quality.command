#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$SCRIPT_DIR/.runtime/node-v22.23.2/bin/node"

if [ "$#" -ne 3 ]; then
  printf '%s\n' "Verwendung: $0 '/ABSOLUTER/PRIMÄRLAUF' '/ABSOLUTER/SHADOW-VERTRAG.json' '/ABSOLUTER/SHADOW-AUSGABEORDNER'" >&2
  exit 1
fi

PRIMARY_OUTPUT="$1"
SHADOW_CONTRACT_FILE="$2"
OUTPUT_DIR="$3"
MODEL="${POLICY_FULL_MODEL:-qwen/qwen3.6-35b-a3b}"
MODEL_TOKEN_LIMIT="${POLICY_FULL_MODEL_TOKEN_LIMIT:-42496}"
DOCUMENT_ARTIFACT="$PRIMARY_OUTPUT/document.private.json"
SHADOW_MANIFEST="$OUTPUT_DIR/manifest.private.json"
PRIVATE_QA_ROOT="$HOME/Library/Application Support/at.klincov.polizzenvergleich-v3/QA"
GLOBAL_LOCK_DIR="$PRIVATE_QA_ROOT/.all-categories-quality.lock"
LOCK_ACQUIRED=0

cleanup_global_lock() {
  if [ "$LOCK_ACQUIRED" -eq 1 ]; then
    rm -f "$GLOBAL_LOCK_DIR/owner.private.txt"
    rmdir "$GLOBAL_LOCK_DIR" 2>/dev/null || true
  fi
}

trap cleanup_global_lock EXIT
trap 'exit 130' HUP INT TERM

case "$PRIMARY_OUTPUT:$SHADOW_CONTRACT_FILE:$OUTPUT_DIR" in
  /*:/*:/*) ;;
  *)
    printf '%s\n' "Primärlauf, Shadow-Vertrag und Ausgabeordner müssen absolute Pfade sein." >&2
    exit 1
    ;;
esac
[ -x "$NODE_BIN" ] || {
  printf '%s\n' "Lokale Node-22-Laufzeit fehlt. Bitte zuerst install.command ausführen." >&2
  exit 1
}
DOCUMENT_STATUS="$("$NODE_BIN" -e '
  const fs = require("fs");
  const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const status = manifest?.configuration?.documentStatus;
  if (!["FRAMEWORK_TERMS", "PROPOSAL", "ACTIVE"].includes(status)) process.exit(2);
  process.stdout.write(status);
' "$PRIMARY_OUTPUT/manifest.private.json")"

umask 077
mkdir -p "$PRIVATE_QA_ROOT"
if ! mkdir "$GLOBAL_LOCK_DIR" 2>/dev/null; then
  printf '%s\n' "Primär- oder Shadow-Lauf hält bereits die globale Modellsperre: $GLOBAL_LOCK_DIR" >&2
  exit 1
fi
LOCK_ACQUIRED=1
printf 'pid=%s kind=hybrid-shadow output=%s\n' "$$" "$OUTPUT_DIR" > "$GLOBAL_LOCK_DIR/owner.private.txt"
export LMSTUDIO_MODEL_PREF="$MODEL"
export LMSTUDIO_MODEL_TOKEN_LIMIT="$MODEL_TOKEN_LIMIT"

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/ensureHybridShadowRunManifest.cjs" \
  --primaryOutput "$PRIMARY_OUTPUT" \
  --contractFile "$SHADOW_CONTRACT_FILE" \
  --output "$OUTPUT_DIR" \
  --documentStatus "$DOCUMENT_STATUS" \
  --model "$MODEL" \
  --modelTokenLimit "$MODEL_TOKEN_LIMIT"

read -r -a CATEGORY_VIEWS <<< "$("$NODE_BIN" -e 'process.stdout.write(require(process.argv[1]).CATEGORY_ORDER.join(" "))' "$SCRIPT_DIR/server/utils/policyComparison/productContract.js")"
SHADOW_CONTRACT_SHA256="$("$NODE_BIN" -e '
  const fs = require("fs");
  const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(manifest.contract.contractSha256);
' "$SHADOW_MANIFEST")"

for CATEGORY in "${CATEGORY_VIEWS[@]}"; do
  PRIMARY_WORKSHEET="$PRIMARY_OUTPUT/$CATEGORY/worksheet.private.json"
  CATEGORY_DIR="$OUTPUT_DIR/$CATEGORY"
  SEARCH_DIR="$CATEGORY_DIR/search"
  SHADOW_WORKSHEET="$SEARCH_DIR/worksheet.shadow.private.json"
  SEARCH_REPORT="$SEARCH_DIR/search-report.json"
  TRIAGE_DIR="$CATEGORY_DIR/triage"
  EFFECTS_DIR="$CATEGORY_DIR/effects"
  REVIEW_FILE="$CATEGORY_DIR/review.private.json"
  mkdir -p "$SEARCH_DIR" "$TRIAGE_DIR" "$EFFECTS_DIR"

  if [ "$CATEGORY" = "VS" ]; then
    TRIAGE_PROMPT="$SCRIPT_DIR/server/resources/policyAnalysis/vs-candidate-triage-system.v0.1.md"
    EFFECTS_PROMPT="$SCRIPT_DIR/server/resources/policyAnalysis/vs-prepared-evidence-system.v0.1.md"
  else
    TRIAGE_PROMPT="$SCRIPT_DIR/server/resources/policyAnalysis/candidate-triage-system.v0.1.md"
    EFFECTS_PROMPT="$SCRIPT_DIR/server/resources/policyAnalysis/prepared-evidence-system.v0.1.md"
  fi

  printf '%s\n' "[hybrid-shadow] $CATEGORY – isolierte Nulltreffer-Suche"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runHybridShadowSearch.cjs" \
    --worksheet "$PRIMARY_WORKSHEET" \
    --documentArtifact "$DOCUMENT_ARTIFACT" \
    --contractFile "$SHADOW_CONTRACT_FILE" \
    --runManifest "$SHADOW_MANIFEST" \
    --expectedContractSha256 "$SHADOW_CONTRACT_SHA256" \
    --output "$SEARCH_DIR"

  ELIGIBLE_COUNT="$("$NODE_BIN" -e '
    const fs = require("fs");
    const report = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const count = report?.input?.eligibleZeroPrimaryComponentCount;
    if (!Number.isInteger(count) || count < 0) process.exit(2);
    process.stdout.write(String(count));
  ' "$SEARCH_REPORT")"
  if [ "$ELIGIBLE_COUNT" -eq 0 ]; then
    printf '%s\n' "[hybrid-shadow] $CATEGORY – keine kontrollierte Primär-Nullkomponente"
    continue
  fi

  printf '%s\n' "[hybrid-shadow] $CATEGORY – normale Candidate-Triage"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runVsCandidateTriage.cjs" \
    --worksheet "$SHADOW_WORKSHEET" \
    --systemPromptFile "$TRIAGE_PROMPT" \
    --hybridSystemPromptFile "$SCRIPT_DIR/server/resources/policyAnalysis/hybrid-candidate-triage-addon.v0.1.md" \
    --controlMode technical-review \
    --output "$TRIAGE_DIR" \
    --model "$MODEL" \
    --modelTokenLimit "$MODEL_TOKEN_LIMIT" \
    --maxAttemptsPerTarget 2

  printf '%s\n' "[hybrid-shadow] $CATEGORY – normale Evidenz-/Wirkungsprüfung"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runPreparedEvidenceEvaluation.cjs" \
    --worksheet "$SHADOW_WORKSHEET" \
    --triageFile "$TRIAGE_DIR/materialized-triage.private.json" \
    --systemPromptFile "$EFFECTS_PROMPT" \
    --controlMode technical-review \
    --documentStatus "$DOCUMENT_STATUS" \
    --output "$EFFECTS_DIR" \
    --model "$MODEL" \
    --modelTokenLimit "$MODEL_TOKEN_LIMIT" \
    --maxAttemptsPerTarget 2 \
    --allowUniqueCandidateIdRepair true

  printf '%s\n' "[hybrid-shadow] $CATEGORY – ungelabeltes Recall/FPR-Reviewartefakt"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/materializeHybridShadowReview.cjs" \
    --searchReport "$SEARCH_REPORT" \
    --runManifest "$SHADOW_MANIFEST" \
    --primaryWorksheet "$PRIMARY_WORKSHEET" \
    --documentArtifact "$DOCUMENT_ARTIFACT" \
    --contractFile "$SHADOW_CONTRACT_FILE" \
    --worksheet "$SHADOW_WORKSHEET" \
    --triage "$TRIAGE_DIR/materialized-triage.private.json" \
    --triageReport "$TRIAGE_DIR/report.json" \
    --effects "$EFFECTS_DIR/materialized.private.json" \
    --effectsReport "$EFFECTS_DIR/report.json" \
    --output "$REVIEW_FILE"
done

printf '%s\n' "[hybrid-shadow] FERTIG: $OUTPUT_DIR"
printf '%s\n' "[hybrid-shadow] Kundenergebnisse wurden nicht verändert."
