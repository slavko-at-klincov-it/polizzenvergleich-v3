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
OUTPUT_DIR="${3:-$PRIVATE_QA_ROOT/VS-PILOT-27B-$(date +%Y%m%d-%H%M%S)}"

[ -x "$NODE_BIN" ] || {
  printf '%s\n' "Lokale Node-22-Laufzeit fehlt. Bitte zuerst install.command ausführen." >&2
  exit 1
}
[ -f "$LF_PDF" ] || { printf '%s\n' "LF-PDF fehlt: $LF_PDF" >&2; exit 1; }
[ -f "$WEVIG_PDF" ] || { printf '%s\n' "WEVIG-PDF fehlt: $WEVIG_PDF" >&2; exit 1; }

umask 077
EMBEDDING_MODEL_PREF="${EMBEDDING_MODEL_PREF:-dinghy-embed}" \
LMSTUDIO_MODEL_PREF="${LMSTUDIO_MODEL_PREF:-qwen/qwen3.8-27b}" \
exec "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runVsPilotAb.cjs" \
  --lfPdf "$LF_PDF" \
  --wevigPdf "$WEVIG_PDF" \
  --output "$OUTPUT_DIR" \
  --model "${LMSTUDIO_MODEL_PREF:-qwen/qwen3.8-27b}" \
  --embeddingModel "${EMBEDDING_MODEL_PREF:-dinghy-embed}" \
  --modelTokenLimit 42496 \
  --topN 55 \
  --repetitions 2
