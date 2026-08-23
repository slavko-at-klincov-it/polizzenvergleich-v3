#!/bin/bash

# launchd dependency gate: the chat UI only starts after both exact LM Studio
# models answer their contract checks. This prevents login/reboot races.
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
source "$POLICY_SCRIPT_DIR/lib/runtime.sh"
policy_export_runtime_path

"$POLICY_NODE_BIN" "$POLICY_SCRIPT_DIR/managed-embedding-check.cjs" >/dev/null

attempt=0
while [ "$attempt" -lt 120 ]; do
  if "$POLICY_NODE_BIN" "$POLICY_SCRIPT_DIR/lmstudio-models.cjs" check >/dev/null 2>&1; then
    exec "$POLICY_NODE_BIN" "$POLICY_REPO_DIR/server/index.js"
  fi
  attempt=$((attempt + 1))
  sleep 2
done
policy_die "LM Studio war nach vier Minuten noch nicht bereit; siehe models-error.log."
