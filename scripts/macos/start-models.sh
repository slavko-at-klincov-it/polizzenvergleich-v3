#!/bin/bash

# Verify immutable model bytes once, then retry only transient daemon/load/API
# failures with bounded backoff. Hashing the 18-GB model set is not repeated.
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
source "$POLICY_SCRIPT_DIR/lib/runtime.sh"
policy_export_runtime_path
model_manager="${POLICY_MODEL_MANAGER_SCRIPT:-$POLICY_SCRIPT_DIR/lmstudio-models.cjs}"
retry_delay="${POLICY_MODEL_RETRY_DELAY_SECONDS:-10}"

attempt=1
while [ "$attempt" -le 6 ]; do
  if "$POLICY_NODE_BIN" "$model_manager" ensure-server; then break; fi
  if [ "$attempt" -eq 6 ]; then
    policy_die "LM Studio war nach sechs Versuchen nicht erreichbar."
  fi
  sleep $((attempt * retry_delay))
  attempt=$((attempt + 1))
done

"$POLICY_NODE_BIN" "$model_manager" verify-artifacts

attempt=1
while [ "$attempt" -le 6 ]; do
  if "$POLICY_NODE_BIN" "$model_manager" prepare --skip-artifact-verification; then
    exit 0
  fi
  if [ "$attempt" -lt 6 ]; then sleep $((attempt * retry_delay)); fi
  attempt=$((attempt + 1))
done
policy_die "LM Studio konnte nach sechs Versuchen nicht vorbereitet werden."
