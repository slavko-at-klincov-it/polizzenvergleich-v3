#!/bin/bash

# launchd dependency gate: the chat UI starts only after the user-selected LM
# Studio chat model and the exact managed Dinghy embedder pass their checks.
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
source "$POLICY_SCRIPT_DIR/lib/runtime.sh"
policy_export_runtime_path

embedding_check="${POLICY_EMBEDDING_CHECK_SCRIPT:-$POLICY_SCRIPT_DIR/managed-embedding-check.cjs}"
model_manager="${POLICY_MODEL_MANAGER_SCRIPT:-$POLICY_SCRIPT_DIR/lmstudio-models.cjs}"
config_writer="${POLICY_CONFIG_WRITER_SCRIPT:-$POLICY_SCRIPT_DIR/write-config.cjs}"
server_entrypoint="${POLICY_SERVER_ENTRYPOINT:-$POLICY_REPO_DIR/server/index.js}"
"$POLICY_NODE_BIN" "$embedding_check" >/dev/null

attempt=0
max_attempts="${POLICY_SERVER_MODEL_RETRY_ATTEMPTS:-120}"
retry_delay="${POLICY_SERVER_MODEL_RETRY_DELAY_SECONDS:-2}"
while [ "$attempt" -lt "$max_attempts" ]; do
  if "$POLICY_NODE_BIN" "$model_manager" check >/dev/null 2>&1; then
    # The model manager has now resolved the selected alias to its installed
    # model and tokenizer. Refresh only managed environment values before the
    # server reads dotenv; databases and LanceDB are never touched here.
    "$POLICY_NODE_BIN" "$config_writer" >/dev/null
    exec "$POLICY_NODE_BIN" "$server_entrypoint"
  fi
  attempt=$((attempt + 1))
  sleep "$retry_delay"
done
policy_die "LM Studio war nach vier Minuten noch nicht bereit; siehe models-error.log."
