#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$SCRIPT_DIR/.runtime/node-v22.23.2/bin/node"
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

if [ "$#" -ne 3 ]; then
  printf '%s\n' "Verwendung: $0 '/ABSOLUTER/LF-1+N-LAUF' '/ABSOLUTER/EMBEDDING-VERTRAG.json' '/ABSOLUTER/NEUER/AUSGABEORDNER'" >&2
  exit 1
fi

RUN_ROOT="$1"
CONTRACT_FILE="$2"
OUTPUT_DIR="$3"
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

case "$RUN_ROOT:$CONTRACT_FILE:$OUTPUT_DIR" in
  /*:/*:/*) ;;
  *)
    printf '%s\n' "Lauf, Vertrag und Ausgabeordner müssen absolute Pfade sein." >&2
    exit 1
    ;;
esac
[ -x "$NODE_BIN" ] || {
  printf '%s\n' "Lokale Node-22-Laufzeit fehlt." >&2
  exit 1
}
[ -x "$LMS_BIN" ] || {
  printf '%s\n' "LM-Studio-CLI fehlt: $LMS_BIN" >&2
  exit 1
}
[ -f "$LMSTUDIO_SDK" ] || {
  printf '%s\n' "LM-Studio-SDK fehlt: $LMSTUDIO_SDK" >&2
  exit 1
}
[ -d "$RUN_ROOT" ] || {
  printf '%s\n' "LF-Lauf fehlt: $RUN_ROOT" >&2
  exit 1
}
[ -f "$CONTRACT_FILE" ] || {
  printf '%s\n' "Embeddingvertrag fehlt: $CONTRACT_FILE" >&2
  exit 1
}
[ ! -e "$OUTPUT_DIR" ] || {
  printf '%s\n' "Ausgabeordner existiert bereits: $OUTPUT_DIR" >&2
  exit 1
}

umask 077
mkdir -p "$PRIVATE_QA_ROOT"
if ! mkdir "$GLOBAL_LOCK_DIR" 2>/dev/null; then
  printf '%s\n' "Ein anderer Qualitätslauf hält die globale Modellsperre: $GLOBAL_LOCK_DIR" >&2
  exit 1
fi
LOCK_ACQUIRED=1
printf 'pid=%s kind=lf-reference-discovery-benchmark output=%s\n' \
  "$$" "$OUTPUT_DIR" > "$GLOBAL_LOCK_DIR/owner.private.txt"

"$LMS_BIN" daemon up >/dev/null
"$LMS_BIN" server start >/dev/null 2>&1 || true
verify_model_state "$QWEN_MODEL" llm loaded "$QWEN_CONTEXT"

DINGHY_IDENTIFIER="$($NODE_BIN -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (contract?.enabled !== true || !contract?.provider?.model) process.exit(2);
  process.stdout.write(contract.provider.model);
' "$CONTRACT_FILE")"
RUNTIME_REVISION="$($NODE_BIN -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!contract?.provider?.runtimeRevision) process.exit(2);
  process.stdout.write(contract.provider.runtimeRevision);
' "$CONTRACT_FILE")"
if [ "$RUNTIME_REVISION" != "$EXPECTED_DINGHY_RUNTIME" ]; then
  printf '%s\n' "Embeddingvertrag fordert unerwartete Runtime: $RUNTIME_REVISION" >&2
  exit 1
fi
if ! "$LMS_BIN" runtime ls | grep -F "$RUNTIME_REVISION" | grep -F '✓' >/dev/null; then
  printf '%s\n' "Dinghy-Runtime ist nicht ausgewählt: $RUNTIME_REVISION" >&2
  exit 1
fi

RESTORE_QWEN=1
"$NODE_BIN" "$SCRIPT_DIR/scripts/macos/unload-lmstudio-model.cjs" \
  "$LMSTUDIO_SDK" \
  "$QWEN_MODEL"
verify_model_state "$QWEN_MODEL" llm not-loaded ""

DINGHY_LOADED=1
"$LMS_BIN" load "$DINGHY_MODEL_KEY" \
  --identifier "$DINGHY_IDENTIFIER" \
  --context-length "$DINGHY_CONTEXT" \
  --yes
verify_model_state "$DINGHY_IDENTIFIER" embeddings loaded "$DINGHY_CONTEXT"

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/buildLfReferenceDiscoveryBenchmark.cjs" \
  --runRoot "$RUN_ROOT" \
  --contractFile "$CONTRACT_FILE" \
  --output "$OUTPUT_DIR" \
  --expectedPublicNotFoundRows 135 \
  --expectedPureNullRows 132 \
  --expectedComponents 631 \
  --expectedCells 5679

"$NODE_BIN" "$SCRIPT_DIR/scripts/macos/unload-lmstudio-model.cjs" \
  "$LMSTUDIO_SDK" \
  "$DINGHY_IDENTIFIER"
DINGHY_LOADED=0
verify_model_state "$DINGHY_IDENTIFIER" embeddings not-loaded ""

load_qwen
RESTORE_QWEN=0
verify_model_state "$QWEN_MODEL" llm loaded "$QWEN_CONTEXT"

printf '%s\n' "[lf-discovery-benchmark] FERTIG: $OUTPUT_DIR"
printf '%s\n' "[lf-discovery-benchmark] Kundenergebnis und Produktpfad wurden nicht verändert."
