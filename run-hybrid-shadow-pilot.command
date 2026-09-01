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
DINGHY_CONTEXT="${HYBRID_SHADOW_DINGHY_CONTEXT:-8192}"
EXPECTED_DINGHY_RUNTIME="${HYBRID_SHADOW_DINGHY_RUNTIME:-llama.cpp-mac-arm64-apple-metal-advsimd@2.28.2}"
PRIVATE_QA_ROOT="$HOME/Library/Application Support/at.klincov.polizzenvergleich-v3/QA"
GLOBAL_LOCK_DIR="$PRIVATE_QA_ROOT/.all-categories-quality.lock"

if [ "$#" -ne 3 ]; then
  printf '%s\n' "Verwendung: $0 '/ABSOLUTER/PILOT.json' '/ABSOLUTER/EMBEDDING-VERTRAG.json' '/ABSOLUTER/AUSGABEORDNER'" >&2
  exit 1
fi

PILOT_FILE="$1"
CONTRACT_FILE="$2"
OUTPUT_DIR="$3"
MANIFEST="$OUTPUT_DIR/manifest.private.json"
SEARCH_DIR="$OUTPUT_DIR/search"
SEARCH_COMPLETE="$SEARCH_DIR/complete.private.json"
SEARCH_GATE="$OUTPUT_DIR/search-gate.private.json"
QWEN_DIR="$OUTPUT_DIR/qwen"
LIFECYCLE_FILE="$OUTPUT_DIR/lifecycle.private.json"
LOCK_ACQUIRED=0
RESTORE_QWEN=0
QWEN_RESTORED=true
RUN_COMPLETE=0
FAILURE_DETAIL=""
STARTED_AT_MS=0
QWEN_UNLOAD_MS=""
DINGHY_LOAD_MS=""
DINGHY_UNLOAD_MS=""
QWEN_LOAD_MS=""

now_ms() {
  "$NODE_BIN" -e 'process.stdout.write(String(Date.now()))'
}

elapsed_ms() {
  "$NODE_BIN" -e 'process.stdout.write(String(Number(process.argv[2])-Number(process.argv[1])))' "$1" "$2"
}

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
  if [ "$RESTORE_QWEN" -eq 1 ]; then
    if load_qwen; then
      QWEN_RESTORED=true
      RESTORE_QWEN=0
    else
      QWEN_RESTORED=false
      exit_code=1
    fi
  fi
  if [ "$RUN_COMPLETE" -ne 1 ]; then
    FAILURE_DETAIL="${FAILURE_DETAIL:-Pilot vor vollständigem Abschluss abgebrochen (Exit $exit_code).}"
  fi
  if [ "$STARTED_AT_MS" -gt 0 ] && [ -d "$OUTPUT_DIR" ]; then
    local finished_at_ms
    finished_at_ms="$(now_ms)"
    "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/writeHybridShadowPilotLifecycle.cjs" \
      --output "$LIFECYCLE_FILE" \
      --status "$([ "$RUN_COMPLETE" -eq 1 ] && printf COMPLETE || printf FAILED)" \
      --startedAtMs "$STARTED_AT_MS" \
      --finishedAtMs "$finished_at_ms" \
      --qwenRestored "$QWEN_RESTORED" \
      --qwenUnloadMs "$QWEN_UNLOAD_MS" \
      --dinghyLoadMs "$DINGHY_LOAD_MS" \
      --dinghyUnloadMs "$DINGHY_UNLOAD_MS" \
      --qwenLoadMs "$QWEN_LOAD_MS" \
      --detail "$FAILURE_DETAIL" || exit_code=1
  fi
  if [ "$LOCK_ACQUIRED" -eq 1 ]; then
    rm -f "$GLOBAL_LOCK_DIR/owner.private.txt"
    rmdir "$GLOBAL_LOCK_DIR" 2>/dev/null || true
  fi
  exit "$exit_code"
}

trap cleanup EXIT
trap 'FAILURE_DETAIL="Pilot durch Signal abgebrochen."; exit 130' HUP INT TERM

case "$PILOT_FILE:$CONTRACT_FILE:$OUTPUT_DIR" in
  /*:/*:/*) ;;
  *)
    printf '%s\n' "Pilot, Vertrag und Ausgabe müssen absolute Pfade sein." >&2
    exit 1
    ;;
esac
[ -x "$NODE_BIN" ] || { printf '%s\n' "Lokale Node-22-Laufzeit fehlt." >&2; exit 1; }
[ -x "$LMS_BIN" ] || { printf '%s\n' "LM-Studio-CLI fehlt: $LMS_BIN" >&2; exit 1; }
[ -f "$LMSTUDIO_SDK" ] || { printf '%s\n' "LM-Studio-SDK fehlt: $LMSTUDIO_SDK" >&2; exit 1; }

umask 077
mkdir -p "$PRIVATE_QA_ROOT"
if ! mkdir "$GLOBAL_LOCK_DIR" 2>/dev/null; then
  printf '%s\n' "Ein anderer Qualitätslauf hält die globale Modellsperre: $GLOBAL_LOCK_DIR" >&2
  exit 1
fi
LOCK_ACQUIRED=1
printf 'pid=%s kind=hybrid-shadow-two-phase output=%s\n' "$$" "$OUTPUT_DIR" > "$GLOBAL_LOCK_DIR/owner.private.txt"
STARTED_AT_MS="$(now_ms)"

"$LMS_BIN" daemon up >/dev/null
"$LMS_BIN" server start >/dev/null 2>&1 || true
verify_model_state "$QWEN_MODEL" llm loaded "$QWEN_CONTEXT"

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/ensureHybridShadowPilotManifest.cjs" \
  --pilotFile "$PILOT_FILE" \
  --contractFile "$CONTRACT_FILE" \
  --output "$OUTPUT_DIR" \
  --model "$QWEN_MODEL" \
  --modelTokenLimit "$QWEN_CONTEXT"

DINGHY_IDENTIFIER="$($NODE_BIN -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(contract.provider.model);
' "$CONTRACT_FILE")"
RUNTIME_REVISION="$($NODE_BIN -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
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
phase_started="$(now_ms)"
"$NODE_BIN" "$SCRIPT_DIR/scripts/macos/unload-lmstudio-model.cjs" \
  "$LMSTUDIO_SDK" "$QWEN_MODEL"
verify_model_state "$QWEN_MODEL" llm not-loaded ""
phase_finished="$(now_ms)"
QWEN_UNLOAD_MS="$(elapsed_ms "$phase_started" "$phase_finished")"

phase_started="$(now_ms)"
"$LMS_BIN" load "$DINGHY_MODEL_KEY" \
  --identifier "$DINGHY_IDENTIFIER" \
  --context-length "$DINGHY_CONTEXT" \
  --yes
verify_model_state "$DINGHY_IDENTIFIER" embeddings loaded "$DINGHY_CONTEXT"
phase_finished="$(now_ms)"
DINGHY_LOAD_MS="$(elapsed_ms "$phase_started" "$phase_finished")"

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runHybridShadowPilotSearch.cjs" \
  --manifest "$MANIFEST" \
  --pilotFile "$PILOT_FILE" \
  --contractFile "$CONTRACT_FILE" \
  --output "$SEARCH_DIR"

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/verifyHybridShadowPilotSearchGate.cjs" \
  --manifest "$MANIFEST" \
  --pilotFile "$PILOT_FILE" \
  --contractFile "$CONTRACT_FILE" \
  --searchComplete "$SEARCH_COMPLETE" \
  --output "$SEARCH_GATE"

phase_started="$(now_ms)"
"$NODE_BIN" "$SCRIPT_DIR/scripts/macos/unload-lmstudio-model.cjs" \
  "$LMSTUDIO_SDK" "$DINGHY_IDENTIFIER"
verify_model_state "$DINGHY_IDENTIFIER" embeddings not-loaded ""
phase_finished="$(now_ms)"
DINGHY_UNLOAD_MS="$(elapsed_ms "$phase_started" "$phase_finished")"

phase_started="$(now_ms)"
load_qwen
phase_finished="$(now_ms)"
QWEN_LOAD_MS="$(elapsed_ms "$phase_started" "$phase_finished")"
RESTORE_QWEN=0

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runHybridShadowPilotQwenPhase.cjs" \
  --manifest "$MANIFEST" \
  --pilotFile "$PILOT_FILE" \
  --searchGate "$SEARCH_GATE" \
  --output "$QWEN_DIR"

verify_model_state "$QWEN_MODEL" llm loaded "$QWEN_CONTEXT"
RUN_COMPLETE=1
QWEN_RESTORED=true
printf '%s\n' "[hybrid-shadow-pilot] FERTIG: $OUTPUT_DIR"
printf '%s\n' "[hybrid-shadow-pilot] Kundenergebnisse und Kundeninstallation wurden nicht verändert."
