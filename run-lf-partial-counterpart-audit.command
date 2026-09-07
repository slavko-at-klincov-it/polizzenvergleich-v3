#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$SCRIPT_DIR/.runtime/node-v22.23.2/bin/node"

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  printf '%s\n' "Verwendung: $0 '/ABSOLUTER/PFAD/ZUM/LF-RUN' '/ABSOLUTER/PFAD/ZUM/AUDIT' [LIMIT]" >&2
  exit 1
fi

RUN_ROOT="$1"
AUDIT_ROOT="$2"
LIMIT="${3:-0}"
MODEL="${POLICY_FULL_MODEL:-qwen/qwen3.6-35b-a3b}"
MODEL_TOKEN_LIMIT="${POLICY_FULL_MODEL_TOKEN_LIMIT:-42496}"
ENDPOINT="${LMSTUDIO_BASE_PATH:-http://127.0.0.1:1234/v1}"
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

[ -x "$NODE_BIN" ] || {
  printf '%s\n' "Lokale Node-22-Laufzeit fehlt: $NODE_BIN" >&2
  exit 1
}
[ -d "$RUN_ROOT" ] || {
  printf '%s\n' "LF-Run fehlt: $RUN_ROOT" >&2
  exit 1
}
case "$LIMIT" in
  ''|*[!0-9]*)
    printf '%s\n' "LIMIT muss eine nichtnegative ganze Zahl sein." >&2
    exit 1
    ;;
esac

SOURCE_COMMIT="$(git -C "$SCRIPT_DIR" rev-parse HEAD)"
umask 077
mkdir -p "$AUDIT_ROOT"

if [ ! -f "$AUDIT_ROOT/index.private.json" ]; then
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/buildLfReferencePartialAuditCases.cjs" \
    --runRoot "$RUN_ROOT" \
    --output "$AUDIT_ROOT" \
    --sourceCommit "$SOURCE_COMMIT" \
    --expectedCount 79
fi

mkdir -p "$PRIVATE_QA_ROOT"
if ! mkdir "$GLOBAL_LOCK_DIR" 2>/dev/null; then
  printf '%s\n' "Ein anderer Qualitätslauf hält bereits die globale Modellsperre: $GLOBAL_LOCK_DIR" >&2
  if [ -f "$GLOBAL_LOCK_DIR/owner.private.txt" ]; then
    sed 's/^/[lf-partial-audit] Sperrinhaber: /' "$GLOBAL_LOCK_DIR/owner.private.txt" >&2
  fi
  exit 1
fi
LOCK_ACQUIRED=1
printf 'pid=%s audit=%s\n' "$$" "$AUDIT_ROOT" > "$GLOBAL_LOCK_DIR/owner.private.txt"

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runLfReferencePartialAudit.cjs" \
  --auditRoot "$AUDIT_ROOT" \
  --endpoint "$ENDPOINT" \
  --model "$MODEL" \
  --modelTokenLimit "$MODEL_TOKEN_LIMIT" \
  --maxAttempts 3 \
  --limit "$LIMIT"

if [ "$LIMIT" -eq 0 ]; then
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/validateLfReferencePartialAudit.cjs" \
    --auditRoot "$AUDIT_ROOT" \
    --model "$MODEL"
fi
