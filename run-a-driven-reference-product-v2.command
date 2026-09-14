#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="${V3_NODE_BIN:-$SCRIPT_DIR/.runtime/node-v22.23.2/bin/node}"
LMS_BIN="${V3_LMS_BIN:-$HOME/.lmstudio/bin/lms}"
LMSTUDIO_SDK="${V3_LMSTUDIO_SDK:-$HOME/.lmstudio/extensions/plugins/lmstudio/js-code-sandbox/node_modules/@lmstudio/sdk/dist/index.cjs}"
BASE_URL="${LMSTUDIO_BASE_PATH:-http://127.0.0.1:1234/v1}"
QWEN_MODEL="${POLICY_FULL_MODEL:-qwen/qwen3.6-35b-a3b}"
QWEN_CONTEXT="${POLICY_FULL_MODEL_TOKEN_LIMIT:-42496}"
QWEN_MODEL_KEY="${V3_QWEN36_MODEL_KEY:-qwen3.6-35b-a3b-mlx-text}"
DINGHY_MODEL_KEY="${HYBRID_SHADOW_DINGHY_MODEL_KEY:-text-embedding-dinghy-law-4b-v1}"
DINGHY_CONTEXT="${HYBRID_SHADOW_DINGHY_CONTEXT:-2048}"
EXPECTED_DINGHY_RUNTIME="${HYBRID_SHADOW_DINGHY_RUNTIME:-llama.cpp-mac-arm64-apple-metal-advsimd@2.28.2}"
PRIVATE_QA_ROOT="$HOME/Library/Application Support/at.klincov.polizzenvergleich-v3/QA"
GLOBAL_LOCK_DIR="$PRIVATE_QA_ROOT/.all-categories-quality.lock"

if [ "$#" -ne 5 ]; then
  printf '%s\n' "Verwendung: $0 '/ABSOLUTER/LAUF' '/ABSOLUTER/EMBEDDING-VERTRAG.json' 'SESSION-UUID' 'RUN-SHA256' 'GENERATED-AT-ISO'" >&2
  exit 1
fi

RUN_ROOT="$1"
CONTRACT_FILE="$2"
SESSION_UUID="$3"
RUN_SIGNATURE="$4"
GENERATED_AT="$5"
OUTPUT_ROOT="$RUN_ROOT/a-driven-v2"
A_PLAN_ROOT="$OUTPUT_ROOT/a-plan"
A_CLASSIFICATION_ROOT="$OUTPUT_ROOT/a-classification"
A_FINAL_ROOT="$A_CLASSIFICATION_ROOT"
B_RETRIEVAL_ROOT="$OUTPUT_ROOT/b-retrieval"
B_COMPLETE_ROOT="$OUTPUT_ROOT/b-complete"
B_COMPLETE_CORPUS="$B_COMPLETE_ROOT/complete-b-corpus.private.json"
B_DECISION_ROOT="$OUTPUT_ROOT/b-requirement-decisions"
B_ABSENCE_ROOT="$OUTPUT_ROOT/b-absence"
B_RESCUE_ROOT="$OUTPUT_ROOT/b-rescue"
B_RESCUE_PLAN="$B_RESCUE_ROOT/decision-plan.private.json"
B_RESCUE_DECISION_ROOT="$B_RESCUE_ROOT/decisions"
FINAL_ROOT="$OUTPUT_ROOT/final"
FINAL_DECISIONS="$FINAL_ROOT/final-requirement-decisions.private.json"
BINARY_ROOT="$OUTPUT_ROOT/binary"
BINARY_RESULT="$BINARY_ROOT/binary-reference-result.private.json"
PRODUCT_SHADOW_ROOT="$OUTPUT_ROOT/product-shadow"
RESULT_ROOT="$RUN_ROOT/result"
LOCK_ACQUIRED=0
RESTORE_QWEN=0
DINGHY_LOADED=0

verify_model_state() {
  local state_args=(
    --baseUrl "$BASE_URL"
    --model "$1"
    --type "$2"
    --state "$3"
  )
  if [ -n "${4:-}" ]; then
    state_args+=(--context "$4")
  fi
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/verifyLmStudioModelState.cjs" \
    "${state_args[@]}"
}

load_qwen() {
  "$NODE_BIN" "$SCRIPT_DIR/scripts/macos/load-qwen36.cjs" \
    "$LMSTUDIO_SDK" \
    "$QWEN_MODEL_KEY" \
    "$QWEN_MODEL"
  verify_model_state "$QWEN_MODEL" llm loaded "$QWEN_CONTEXT"
}

ensure_qwen() {
  if verify_model_state "$QWEN_MODEL" llm loaded "$QWEN_CONTEXT"; then
    printf '%s\n' "[lf-a-driven-product-v2] Qwen bereits exakt geladen; kein Reload."
  else
    load_qwen
  fi
}

cleanup() {
  local exit_code=$?
  trap - EXIT HUP INT TERM
  if [ "$DINGHY_LOADED" -eq 1 ]; then
    "$NODE_BIN" "$SCRIPT_DIR/scripts/macos/unload-lmstudio-model.cjs" \
      "$LMSTUDIO_SDK" \
      "$DINGHY_IDENTIFIER" || exit_code=1
    DINGHY_LOADED=0
  fi
  if [ "$RESTORE_QWEN" -eq 1 ]; then
    load_qwen || exit_code=1
    RESTORE_QWEN=0
  fi
  if [ "$LOCK_ACQUIRED" -eq 1 ]; then
    rm -f "$GLOBAL_LOCK_DIR/owner.private.txt"
    rmdir "$GLOBAL_LOCK_DIR" 2>/dev/null || true
  fi
  exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' HUP INT TERM

case "$RUN_ROOT:$CONTRACT_FILE" in
  /*:/*) ;;
  *)
    printf '%s\n' "Lauf und Embeddingvertrag müssen absolute Pfade sein." >&2
    exit 1
    ;;
esac
[ -x "$NODE_BIN" ] || { printf '%s\n' "Node-22-Laufzeit fehlt." >&2; exit 1; }
[ -x "$LMS_BIN" ] || { printf '%s\n' "LM-Studio-CLI fehlt." >&2; exit 1; }
[ -f "$LMSTUDIO_SDK" ] || { printf '%s\n' "LM-Studio-SDK fehlt." >&2; exit 1; }
[ -d "$RUN_ROOT" ] && [ ! -L "$RUN_ROOT" ] || { printf '%s\n' "Laufordner fehlt oder ist ungültig." >&2; exit 1; }
[ -f "$RUN_ROOT/input-manifest.private.json" ] || { printf '%s\n' "Input-Manifest fehlt." >&2; exit 1; }
[ -f "$CONTRACT_FILE" ] && [ ! -L "$CONTRACT_FILE" ] || { printf '%s\n' "Embeddingvertrag fehlt oder ist ungültig." >&2; exit 1; }
case "$SESSION_UUID:$RUN_SIGNATURE" in
  ????????-????-????-????-????????????:????????????????????????????????????????????????????????????????) ;;
  *)
    printf '%s\n' "Session-UUID oder Run-SHA256 ist ungültig." >&2
    exit 1
    ;;
esac

umask 077
mkdir -p "$PRIVATE_QA_ROOT"
if ! mkdir "$GLOBAL_LOCK_DIR" 2>/dev/null; then
  printf '%s\n' "Ein anderer Qualitäts- oder Produktlauf hält die globale Modellsperre." >&2
  exit 1
fi
LOCK_ACQUIRED=1
mkdir -p "$OUTPUT_ROOT"
"$NODE_BIN" -e '
  const fs = require("fs");
  const [file, pid, output] = process.argv.slice(1);
  fs.writeFileSync(file, `pid=${pid} kind=lf-a-driven-product-v2 output=${output}\n`, {mode: 0o600});
' "$GLOBAL_LOCK_DIR/owner.private.txt" "$$" "$OUTPUT_ROOT"

"$LMS_BIN" daemon up >/dev/null
"$LMS_BIN" server start >/dev/null 2>&1 || true
ensure_qwen

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/buildADrivenReferenceShadow.cjs" \
  --runRoot "$RUN_ROOT" \
  --output "$A_PLAN_ROOT"

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runADrivenReferenceClassification.cjs" \
  --shadowRoot "$A_PLAN_ROOT" \
  --output "$A_CLASSIFICATION_ROOT" \
  --model "$QWEN_MODEL" \
  --modelContext "$QWEN_CONTEXT" \
  --maximumAttempts "${LF_A_QWEN_MAXIMUM_ATTEMPTS:-3}" \
  --requestTimeoutMs "${LF_A_QWEN_REQUEST_TIMEOUT_MS:-180000}" \
  --abortSettlementTimeoutMs "${LF_A_QWEN_ABORT_SETTLEMENT_TIMEOUT_MS:-15000}" \
  --modelRecoveryTimeoutMs "${LF_A_QWEN_MODEL_RECOVERY_TIMEOUT_MS:-180000}" \
  --lmStudioSdk "$LMSTUDIO_SDK" \
  --qwenModelKey "$QWEN_MODEL_KEY"

"$NODE_BIN" -e '
  const fs = require("fs");
  const summary = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (summary.unresolvedBatches !== 0 || summary.unresolvedUnits !== 0) process.exit(2);
' "$A_CLASSIFICATION_ROOT/summary.private.json"

DINGHY_IDENTIFIER="$("$NODE_BIN" -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (contract?.enabled !== true || !contract?.provider?.model) process.exit(2);
  process.stdout.write(contract.provider.model);
' "$CONTRACT_FILE")"
RUNTIME_REVISION="$("$NODE_BIN" -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!contract?.provider?.runtimeRevision) process.exit(2);
  process.stdout.write(contract.provider.runtimeRevision);
' "$CONTRACT_FILE")"
if [ "$RUNTIME_REVISION" != "$EXPECTED_DINGHY_RUNTIME" ]; then
  printf '%s\n' "Embeddingvertrag fordert unerwartete Runtime." >&2
  exit 1
fi
if ! "$LMS_BIN" runtime ls | grep -F "$RUNTIME_REVISION" | grep -F '✓' >/dev/null; then
  printf '%s\n' "Dinghy-Runtime ist nicht ausgewählt." >&2
  exit 1
fi

if [ -f "$B_RETRIEVAL_ROOT/summary.private.json" ]; then
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runADrivenReferenceDinghyRetrieval.cjs" \
    --shadowRoot "$A_FINAL_ROOT" \
    --runRoot "$RUN_ROOT" \
    --contractFile "$CONTRACT_FILE" \
    --output "$B_RETRIEVAL_ROOT"
else
  RESTORE_QWEN=1
  "$NODE_BIN" "$SCRIPT_DIR/scripts/macos/unload-lmstudio-model.cjs" \
    "$LMSTUDIO_SDK" \
    "$QWEN_MODEL"
  verify_model_state "$QWEN_MODEL" llm not-loaded ""
  "$LMS_BIN" load "$DINGHY_MODEL_KEY" \
    --identifier "$DINGHY_IDENTIFIER" \
    --context-length "$DINGHY_CONTEXT" \
    --yes
  DINGHY_LOADED=1
  verify_model_state "$DINGHY_IDENTIFIER" embeddings loaded "$DINGHY_CONTEXT"

  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runADrivenReferenceDinghyRetrieval.cjs" \
    --shadowRoot "$A_FINAL_ROOT" \
    --runRoot "$RUN_ROOT" \
    --contractFile "$CONTRACT_FILE" \
    --output "$B_RETRIEVAL_ROOT"

  "$NODE_BIN" "$SCRIPT_DIR/scripts/macos/unload-lmstudio-model.cjs" \
    "$LMSTUDIO_SDK" \
    "$DINGHY_IDENTIFIER"
  DINGHY_LOADED=0
  verify_model_state "$DINGHY_IDENTIFIER" embeddings not-loaded ""
  load_qwen
  RESTORE_QWEN=0
fi
verify_model_state "$QWEN_MODEL" llm loaded "$QWEN_CONTEXT"

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/buildADrivenCompleteBCorpus.cjs" \
  --runRoot "$RUN_ROOT" \
  --searchPlan "$B_RETRIEVAL_ROOT/search-plan.private.json" \
  --output "$B_COMPLETE_CORPUS"

if [ ! -f "$B_DECISION_ROOT/summary.private.json" ]; then
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runADrivenRequirementCounterpartDecisions.cjs" \
    --manifest "$A_FINAL_ROOT/dynamic-semantic-manifest.private.json" \
    --searchPlan "$B_RETRIEVAL_ROOT/search-plan.private.json" \
    --searchExecution "$B_RETRIEVAL_ROOT/search-execution.private.json" \
    --completeCorpus "$B_COMPLETE_CORPUS" \
    --output "$B_DECISION_ROOT" \
    --model "$QWEN_MODEL" \
    --modelContext "$QWEN_CONTEXT" \
    --maximumAttempts "${LF_B_QWEN_MAXIMUM_ATTEMPTS:-3}" \
    --maximumCandidatesPerComponent "${LF_B_MAXIMUM_CANDIDATES_PER_COMPONENT:-4}" \
    --maximumCompleteCorpusCandidatesPerDocument "${LF_B_MAXIMUM_CORPUS_CANDIDATES_PER_DOCUMENT:-2}" \
    --maximumRequirementsPerBatch "${LF_B_MAXIMUM_REQUIREMENTS_PER_BATCH:-4}" \
    --maximumBatchCharacters "${LF_B_MAXIMUM_BATCH_CHARACTERS:-120000}" \
    --requestTimeoutMs "${LF_B_QWEN_REQUEST_TIMEOUT_MS:-180000}" \
    --abortSettlementTimeoutMs "${LF_B_QWEN_ABORT_SETTLEMENT_TIMEOUT_MS:-15000}" \
    --modelRecoveryTimeoutMs "${LF_B_QWEN_MODEL_RECOVERY_TIMEOUT_MS:-180000}" \
    --lmStudioSdk "$LMSTUDIO_SDK" \
    --qwenModelKey "$QWEN_MODEL_KEY"
fi

if [ ! -f "$B_ABSENCE_ROOT/summary.private.json" ]; then
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runADrivenRequirementAbsenceDecisions.cjs" \
    --decisionPlan "$B_DECISION_ROOT/decision-plan.private.json" \
    --preliminaryDecisions "$B_DECISION_ROOT/requirement-decisions.private.json" \
    --completeCorpus "$B_COMPLETE_CORPUS" \
    --output "$B_ABSENCE_ROOT" \
    --model "$QWEN_MODEL" \
    --modelContext "$QWEN_CONTEXT" \
    --maximumAttempts "${LF_B_ABSENCE_MAXIMUM_ATTEMPTS:-3}" \
    --maximumPartitionCharacters "${LF_B_ABSENCE_MAXIMUM_PARTITION_CHARACTERS:-80000}" \
    --requestTimeoutMs "${LF_B_QWEN_REQUEST_TIMEOUT_MS:-180000}" \
    --abortSettlementTimeoutMs "${LF_B_QWEN_ABORT_SETTLEMENT_TIMEOUT_MS:-15000}" \
    --modelRecoveryTimeoutMs "${LF_B_QWEN_MODEL_RECOVERY_TIMEOUT_MS:-180000}" \
    --lmStudioSdk "$LMSTUDIO_SDK" \
    --qwenModelKey "$QWEN_MODEL_KEY"
fi

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/materializeADrivenRequirementRescueReviewPlan.cjs" \
  --decisionPlan "$B_DECISION_ROOT/decision-plan.private.json" \
  --preliminaryDecisions "$B_DECISION_ROOT/requirement-decisions.private.json" \
  --absencePlan "$B_ABSENCE_ROOT/absence-plan.private.json" \
  --absenceDecisions "$B_ABSENCE_ROOT/absence-decisions.private.json" \
  --completeCorpus "$B_COMPLETE_CORPUS" \
  --output "$B_RESCUE_PLAN" \
  --maximumRequirementsPerBatch 1 \
  --maximumBatchCharacters 160000

if [ ! -f "$B_RESCUE_DECISION_ROOT/summary.private.json" ]; then
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runADrivenRequirementCounterpartDecisions.cjs" \
    --decisionPlan "$B_RESCUE_PLAN" \
    --output "$B_RESCUE_DECISION_ROOT" \
    --model "$QWEN_MODEL" \
    --modelContext "$QWEN_CONTEXT" \
    --maximumAttempts "${LF_B_QWEN_MAXIMUM_ATTEMPTS:-3}" \
    --requestTimeoutMs "${LF_B_QWEN_REQUEST_TIMEOUT_MS:-180000}" \
    --abortSettlementTimeoutMs "${LF_B_QWEN_ABORT_SETTLEMENT_TIMEOUT_MS:-15000}" \
    --modelRecoveryTimeoutMs "${LF_B_QWEN_MODEL_RECOVERY_TIMEOUT_MS:-180000}" \
    --lmStudioSdk "$LMSTUDIO_SDK" \
    --qwenModelKey "$QWEN_MODEL_KEY"
fi

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/materializeADrivenRequirementFinalDecisions.cjs" \
  --decisionPlan "$B_DECISION_ROOT/decision-plan.private.json" \
  --preliminaryDecisions "$B_DECISION_ROOT/requirement-decisions.private.json" \
  --absencePlan "$B_ABSENCE_ROOT/absence-plan.private.json" \
  --absenceDecisions "$B_ABSENCE_ROOT/absence-decisions.private.json" \
  --rescuePlan "$B_RESCUE_PLAN" \
  --rescueDecisions "$B_RESCUE_DECISION_ROOT/requirement-decisions.private.json" \
  --output "$FINAL_DECISIONS"

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/materializeADrivenRequirementBinaryResult.cjs" \
  --manifest "$A_FINAL_ROOT/dynamic-semantic-manifest.private.json" \
  --decisionPlan "$B_DECISION_ROOT/decision-plan.private.json" \
  --preliminaryDecisions "$B_DECISION_ROOT/requirement-decisions.private.json" \
  --absencePlan "$B_ABSENCE_ROOT/absence-plan.private.json" \
  --absenceDecisions "$B_ABSENCE_ROOT/absence-decisions.private.json" \
  --rescuePlan "$B_RESCUE_PLAN" \
  --rescueDecisions "$B_RESCUE_DECISION_ROOT/requirement-decisions.private.json" \
  --finalDecisions "$FINAL_DECISIONS" \
  --output "$BINARY_RESULT"

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/materializeADrivenReferenceProductResult.cjs" \
  --manifest "$A_FINAL_ROOT/dynamic-semantic-manifest.private.json" \
  --decisionPlan "$B_DECISION_ROOT/decision-plan.private.json" \
  --preliminaryDecisions "$B_DECISION_ROOT/requirement-decisions.private.json" \
  --absencePlan "$B_ABSENCE_ROOT/absence-plan.private.json" \
  --absenceDecisions "$B_ABSENCE_ROOT/absence-decisions.private.json" \
  --rescuePlan "$B_RESCUE_PLAN" \
  --rescueDecisions "$B_RESCUE_DECISION_ROOT/requirement-decisions.private.json" \
  --finalDecisions "$FINAL_DECISIONS" \
  --binaryResult "$BINARY_RESULT" \
  --completeBCorpus "$B_COMPLETE_CORPUS" \
  --sourceInputManifest "$RUN_ROOT/input-manifest.private.json" \
  --outputDirectory "$PRODUCT_SHADOW_ROOT" \
  --artifactOutputDirectory "$RESULT_ROOT" \
  --generatedAt "$GENERATED_AT" \
  --sessionUuid "$SESSION_UUID" \
  --runSignature "$RUN_SIGNATURE"

printf '%s\n' "[lf-a-driven-product-v2] Produktartefakte vollständig: $RESULT_ROOT"
printf '%s\n' "[lf-a-driven-product-v2] Kein Deployment und keine Goldzeile als Produktionseingang."
