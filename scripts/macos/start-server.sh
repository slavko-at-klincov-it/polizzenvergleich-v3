#!/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
source "$V3_SCRIPT_DIR/lib/runtime.sh"
source "$V3_SCRIPT_DIR/lib/lmstudio.sh"
v3_export_runtime_path

attempt=0
while [ "$attempt" -lt 60 ]; do
  if /usr/bin/curl -fsS --max-time 2 "http://127.0.0.1:$V3_COLLECTOR_PORT/accepts" >/dev/null 2>&1; then
    v3_load_qwen36_model
    exec "$V3_NODE_BIN" "$V3_REPO_DIR/server/index.js"
  fi
  attempt=$((attempt + 1))
  sleep 1
done
v3_die "Collector war nach einer Minute noch nicht bereit."
