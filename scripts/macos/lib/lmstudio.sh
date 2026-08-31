#!/bin/bash
set -euo pipefail

V3_LMS_BIN="${V3_LMS_BIN:-$HOME/.lmstudio/bin/lms}"
V3_QWEN36_SOURCE_DIR="${V3_QWEN36_SOURCE_DIR:-$HOME/.lmstudio/models/lmstudio-community/Qwen3.6-35B-A3B-MLX-4bit}"
V3_QWEN36_TEXT_DIR="${V3_QWEN36_TEXT_DIR:-$HOME/.lmstudio/models/lmstudio-community/Qwen3.6-35B-A3B-MLX-4bit-text}"
V3_QWEN36_MODEL_KEY="qwen3.6-35b-a3b-mlx-text"
V3_QWEN36_IDENTIFIER="qwen/qwen3.6-35b-a3b"
V3_LMSTUDIO_SDK="${V3_LMSTUDIO_SDK:-$HOME/.lmstudio/extensions/plugins/lmstudio/js-code-sandbox/node_modules/@lmstudio/sdk/dist/index.cjs}"

v3_prepare_qwen36_model() {
  [ -x "$V3_LMS_BIN" ] ||
    v3_die "LM Studio CLI fehlt: $V3_LMS_BIN"
  [ -d "$V3_QWEN36_SOURCE_DIR" ] ||
    v3_die "Qwen 3.6 MLX fehlt. Einmalig laden mit: $V3_LMS_BIN get https://huggingface.co/lmstudio-community/Qwen3.6-35B-A3B-MLX-4bit"
  [ -f "$V3_LMSTUDIO_SDK" ] ||
    v3_die "LM-Studio-SDK fehlt: $V3_LMSTUDIO_SDK"
  "$V3_NODE_BIN" "$V3_SCRIPT_DIR/prepare-qwen36-model.cjs" \
    "$V3_QWEN36_SOURCE_DIR" \
    "$V3_QWEN36_TEXT_DIR"
}

v3_load_qwen36_model() {
  v3_prepare_qwen36_model
  v3_log "Starte LM Studio mit Qwen 3.6 und 42.496 Token Kontext ..."
  "$V3_LMS_BIN" daemon up >/dev/null
  "$V3_LMS_BIN" server start >/dev/null 2>&1 || true
  "$V3_NODE_BIN" "$V3_SCRIPT_DIR/load-qwen36.cjs" \
    "$V3_LMSTUDIO_SDK" \
    "$V3_QWEN36_MODEL_KEY" \
    "$V3_QWEN36_IDENTIFIER"
  v3_wait_http "http://127.0.0.1:1234/v1/models" 30 ||
    v3_die "LM-Studio-API wurde nach dem Modellstart nicht erreichbar."
}
