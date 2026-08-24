#!/bin/bash
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
NODE_BIN="$(command -v node)"

printf '%s\n' '[installer-test] shell syntax'
while IFS= read -r file; do /bin/bash -n "$file"; done < <(find "$REPO/scripts/macos" -name '*.sh' -type f -print)
/bin/bash -n "$REPO/install.command"
/bin/bash -n "$REPO/doctor.command"
/bin/bash -n "$REPO/uninstall.command"

printf '%s\n' '[installer-test] node syntax'
while IFS= read -r file; do "$NODE_BIN" --check "$file"; done < <(find "$REPO/scripts/macos" -name '*.cjs' -type f -print)

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/polizzen-installer-test.XXXXXX")"
cleanup() {
  [ -n "${mock_pid:-}" ] && kill "$mock_pid" >/dev/null 2>&1 || true
  rm -rf "$temp_dir"
}
trap cleanup EXIT
mkdir -p "$temp_dir/config-repo/server" "$temp_dir/config-repo/collector" "$temp_dir/config-repo/frontend"
printf '%s\n' 'JWT_SECRET="keep-this-secret"' 'AUTH_TOKEN="old-password"' 'UNRELATED_SETTING="keep-me"' >"$temp_dir/config-repo/server/.env"

printf '%s\n' '[installer-test] pinned local Yarn bootstrap'
runtime_test_dir="$temp_dir/yarn-runtime"
mkdir -p "$runtime_test_dir/node-v20.19.5/bin"
ln -s "$NODE_BIN" "$runtime_test_dir/node-v20.19.5/bin/node"
cp "$REPO/scripts/macos/fixtures/mock-corepack.sh" "$runtime_test_dir/node-v20.19.5/bin/corepack"
chmod 700 "$runtime_test_dir/node-v20.19.5/bin/corepack"
HOME="$temp_dir/home" \
POLICY_REPO_DIR="$REPO" \
POLICY_RUNTIME_DIR="$runtime_test_dir" \
POLICY_COMMON_PATH="$REPO/scripts/macos/lib/common.sh" \
POLICY_RUNTIME_PATH="$REPO/scripts/macos/lib/runtime.sh" \
  /bin/bash -c 'source "$POLICY_COMMON_PATH"; source "$POLICY_RUNTIME_PATH"; policy_prepare_yarn; [ "$("$POLICY_NODE_DIR/bin/yarn" --version)" = "1.22.22" ]'

no_shim_runtime="$temp_dir/no-shim-runtime"
mkdir -p "$no_shim_runtime/node-v20.19.5/bin"
ln -s "$NODE_BIN" "$no_shim_runtime/node-v20.19.5/bin/node"
cp "$REPO/scripts/macos/fixtures/mock-corepack.sh" "$no_shim_runtime/node-v20.19.5/bin/corepack"
chmod 700 "$no_shim_runtime/node-v20.19.5/bin/corepack"
if HOME="$temp_dir/home" \
  POLICY_REPO_DIR="$REPO" \
  POLICY_RUNTIME_DIR="$no_shim_runtime" \
  POLICY_MOCK_COREPACK_MODE=no-shim \
  POLICY_COMMON_PATH="$REPO/scripts/macos/lib/common.sh" \
  POLICY_RUNTIME_PATH="$REPO/scripts/macos/lib/runtime.sh" \
    /bin/bash -c 'source "$POLICY_COMMON_PATH"; source "$POLICY_RUNTIME_PATH"; policy_prepare_yarn' >/dev/null 2>&1; then
  printf '%s\n' '[installer-test] missing Yarn shim was not rejected' >&2
  exit 1
fi

wrong_yarn_runtime="$temp_dir/wrong-yarn-runtime"
mkdir -p "$wrong_yarn_runtime/node-v20.19.5/bin"
ln -s "$NODE_BIN" "$wrong_yarn_runtime/node-v20.19.5/bin/node"
cp "$REPO/scripts/macos/fixtures/mock-corepack.sh" "$wrong_yarn_runtime/node-v20.19.5/bin/corepack"
chmod 700 "$wrong_yarn_runtime/node-v20.19.5/bin/corepack"
if HOME="$temp_dir/home" \
  POLICY_REPO_DIR="$REPO" \
  POLICY_RUNTIME_DIR="$wrong_yarn_runtime" \
  POLICY_MOCK_COREPACK_MODE=wrong-version \
  POLICY_COMMON_PATH="$REPO/scripts/macos/lib/common.sh" \
  POLICY_RUNTIME_PATH="$REPO/scripts/macos/lib/runtime.sh" \
    /bin/bash -c 'source "$POLICY_COMMON_PATH"; source "$POLICY_RUNTIME_PATH"; policy_prepare_yarn' >/dev/null 2>&1; then
  printf '%s\n' '[installer-test] wrong Yarn version was not rejected' >&2
  exit 1
fi

printf '%s\n' '[installer-test] CommonJS embedding helper path'
grep -Fq 'path.join(runtimeDir, "bin/lms-embed.cjs")' "$REPO/scripts/macos/lmstudio-models.cjs"
mkdir -p "$temp_dir/esm-wrapper/.runtime/bin"
printf '%s\n' '{"type":"module"}' >"$temp_dir/esm-wrapper/package.json"
printf '%s\n' 'const fs = require("fs"); if (!fs.existsSync(__filename)) process.exit(1);' >"$temp_dir/esm-wrapper/.runtime/bin/lms-embed.cjs"
"$NODE_BIN" "$temp_dir/esm-wrapper/.runtime/bin/lms-embed.cjs"

printf '%s\n' '[installer-test] idempotent secure config'
POLICY_REPO_DIR="$temp_dir/config-repo" POLICY_EMBED_MODEL_ID='unsafe-override' "$NODE_BIN" "$REPO/scripts/macos/write-config.cjs" >/dev/null
POLICY_REPO_DIR="$temp_dir/config-repo" POLICY_EMBED_MODEL_ID='unsafe-override' "$NODE_BIN" "$REPO/scripts/macos/write-config.cjs" >/dev/null
grep -q 'JWT_SECRET="keep-this-secret"' "$temp_dir/config-repo/server/.env"
grep -q 'UNRELATED_SETTING="keep-me"' "$temp_dir/config-repo/server/.env"
grep -q 'SERVER_HOST="127.0.0.1"' "$temp_dir/config-repo/server/.env"
grep -q 'POLICY_MANAGED_EMBEDDING="true"' "$temp_dir/config-repo/server/.env"
grep -q 'POLICY_SINGLE_USER_NO_AUTH="true"' "$temp_dir/config-repo/server/.env"
grep -q '^AUTH_TOKEN=""$' "$temp_dir/config-repo/server/.env"
grep -q 'EMBEDDING_ENGINE="lmstudio"' "$temp_dir/config-repo/server/.env"
grep -q 'EMBEDDING_BASE_PATH="http://127.0.0.1:1234/v1"' "$temp_dir/config-repo/server/.env"
grep -q 'EMBEDDING_MODEL_PREF="dinghy-embed"' "$temp_dir/config-repo/server/.env"
grep -q 'EMBEDDING_MODEL_MAX_CHUNK_LENGTH="8192"' "$temp_dir/config-repo/server/.env"
grep -q 'LMSTUDIO_MODEL_PREF="qwen/qwen3.8-27b"' "$temp_dir/config-repo/server/.env"
grep -q 'LMSTUDIO_MODEL_TOKEN_LIMIT="32768"' "$temp_dir/config-repo/server/.env"
! grep -q 'unsafe-override' "$temp_dir/config-repo/server/.env"
grep -q 'COLLECTOR_HOTDIR_PATH=' "$temp_dir/config-repo/collector/.env"
[ "$(grep -c 'BEGIN POLIZZENVERGLEICH MANAGED CONFIG' "$temp_dir/config-repo/server/.env")" -eq 1 ]
[ "$(grep -c '^SERVER_HOST=' "$temp_dir/config-repo/server/.env")" -eq 1 ]
[ "$(stat -f '%OLp' "$temp_dir/config-repo/server/.env")" = "600" ]

printf '%s\n' '[installer-test] launchd plist generation'
HOME="$temp_dir/home" \
POLICY_REPO_DIR="$temp_dir/config-repo" \
POLICY_RUNTIME_DIR="$temp_dir/runtime" \
POLICY_COMMON_PATH="$REPO/scripts/macos/lib/common.sh" \
POLICY_SERVICES_PATH="$REPO/scripts/macos/lib/services.sh" \
  /bin/bash -c 'source "$POLICY_COMMON_PATH"; source "$POLICY_SERVICES_PATH"; policy_write_service_plist "$POLICY_LABEL_PREFIX.server" "$POLICY_REPO_DIR/server" "/path with spaces/node" "/path with spaces/server.js"'
/usr/bin/plutil -lint "$temp_dir/home/Library/LaunchAgents/at.klincov.polizzenvergleich.server.plist" >/dev/null
grep -q '<key>Umask</key><integer>63</integer>' "$temp_dir/home/Library/LaunchAgents/at.klincov.polizzenvergleich.server.plist"

printf '%s\n' '[installer-test] bounded model-start retry'
mkdir -p "$temp_dir/runtime/node-v20.19.5/bin"
ln -s "$NODE_BIN" "$temp_dir/runtime/node-v20.19.5/bin/node"
model_state="$temp_dir/model-manager-state.json"
POLICY_REPO_DIR="$REPO" \
POLICY_RUNTIME_DIR="$temp_dir/runtime" \
POLICY_MODEL_MANAGER_SCRIPT="$REPO/scripts/macos/fixtures/mock-model-manager.cjs" \
POLICY_MODEL_MANAGER_STATE="$model_state" \
POLICY_MODEL_RETRY_DELAY_SECONDS=0 \
  /bin/bash "$REPO/scripts/macos/start-models.sh"
"$NODE_BIN" -e '
  const state = require(process.argv[1]);
  if (state.ensureServer !== 3 || state.verifyArtifacts !== 1 || state.prepare !== 1)
    throw new Error(`unexpected retry state: ${JSON.stringify(state)}`);
' "$model_state"

printf '%s\n' '[installer-test] generated runtime paths remain git-ignored'
git -C "$REPO" check-ignore -q server/public.new/example.js
git -C "$REPO" check-ignore -q server/public.previous/example.js
git -C "$REPO" check-ignore -q server/storage/logs/server.log

printf '%s\n' '[installer-test] post-migration rollback keeps compatible schema'
mkdir -p "$temp_dir/rollback-repo/server/storage"
printf '%s' 'migrated-schema' >"$temp_dir/rollback-repo/server/storage/anythingllm.db"
printf '%s' 'old-schema' >"$temp_dir/old.db"
POLICY_REPO_DIR="$temp_dir/rollback-repo" \
POLICY_LAST_DB_BACKUP="$temp_dir/old.db" \
POLICY_DB_SCHEMA_MIGRATED=true \
POLICY_COMMON_PATH="$REPO/scripts/macos/lib/common.sh" \
POLICY_BUILD_PATH="$REPO/scripts/macos/lib/build.sh" \
  /bin/bash -c 'source "$POLICY_COMMON_PATH"; source "$POLICY_BUILD_PATH"; policy_restore_database_backup'
grep -q 'migrated-schema' "$temp_dir/rollback-repo/server/storage/anythingllm.db"

printf '%s\n' '[installer-test] additive inventory migration preserves legacy rows'
inventory_db="$temp_dir/inventory-migration.db"
sqlite3 "$inventory_db" 'CREATE TABLE comparison_documents (id INTEGER PRIMARY KEY, status TEXT NOT NULL, originalFilename TEXT); INSERT INTO comparison_documents VALUES (7, "ready", "Altbestand.pdf");'
sqlite3 "$inventory_db" <"$REPO/server/prisma/migrations/20260823160000_add_comparison_document_inventory/migration.sql"
[ "$(sqlite3 "$inventory_db" 'SELECT status || ":" || originalFilename FROM comparison_documents WHERE id=7;')" = 'ready:Altbestand.pdf' ]
[ "$(sqlite3 "$inventory_db" 'SELECT COUNT(*) FROM pragma_table_info("comparison_documents") WHERE name IN ("sourceSha256","inventoryStatus","inventorySourceSha256");')" = '3' ]
[ "$(sqlite3 "$inventory_db" 'SELECT COUNT(*) FROM comparison_document_inventory_items;')" = '0' ]

printf '%s\n' '[installer-test] page-less evidence and durable generation migrations'
sqlite3 "$inventory_db" 'INSERT INTO comparison_document_inventory_items (comparisonDocumentId,factKey,label,aliasesJson,pageNumber,evidenceText,evidenceHash,sourceMethod,createdAt) VALUES (7,"legacy","Legacy","[]",1,"Beleg","hash","native",CURRENT_TIMESTAMP);'
sqlite3 "$inventory_db" <"$REPO/server/prisma/migrations/20260823210000_allow_pageless_inventory_evidence/migration.sql"
sqlite3 "$inventory_db" 'INSERT INTO comparison_document_inventory_items (comparisonDocumentId,factKey,label,aliasesJson,pageNumber,evidenceText,evidenceHash,sourceMethod,createdAt) VALUES (7,"pageless","DOCX","[]",NULL,"Beleg ohne Seite","hash2","llm-map",CURRENT_TIMESTAMP);'
[ "$(sqlite3 "$inventory_db" 'SELECT COUNT(*) FROM comparison_document_inventory_items WHERE pageNumber IS NULL;')" = '1' ]
generation_db="$temp_dir/generation-migration.db"
sqlite3 "$generation_db" 'CREATE TABLE workspace_chats (id INTEGER PRIMARY KEY, prompt TEXT NOT NULL); INSERT INTO workspace_chats VALUES (1,"Altchat");'
sqlite3 "$generation_db" <"$REPO/server/prisma/migrations/20260823213000_add_chat_generation_id/migration.sql"
[ "$(sqlite3 "$generation_db" 'SELECT prompt FROM workspace_chats WHERE id=1;')" = 'Altchat' ]
[ "$(sqlite3 "$generation_db" 'SELECT COUNT(*) FROM pragma_table_info("workspace_chats") WHERE name="generationId";')" = '1' ]

printf '%s\n' '[installer-test] mocked LM Studio contract'
chmod 700 "$REPO/scripts/macos/fixtures/mock-lms.sh"
model_check_runtime="$temp_dir/model-check-runtime"
mkdir -p "$model_check_runtime"
port_file="$temp_dir/lmstudio-port"
chat_request_log="$temp_dir/lmstudio-chat-requests.jsonl"
"$NODE_BIN" "$REPO/scripts/macos/fixtures/mock-lmstudio.cjs" "$port_file" "$chat_request_log" &
mock_pid=$!
for _ in $(seq 1 50); do [ -s "$port_file" ] && break; sleep 0.1; done
[ -s "$port_file" ]
port="$(cat "$port_file")"
POLICY_LMS_COMMAND="$REPO/scripts/macos/fixtures/mock-lms.sh" \
POLICY_RUNTIME_DIR="$model_check_runtime" \
POLICY_LMSTUDIO_BASE_URL="http://127.0.0.1:$port" \
POLICY_SKIP_LMSTUDIO_BINDING_CHECK=1 \
  "$NODE_BIN" "$REPO/scripts/macos/lmstudio-models.cjs" check >/dev/null
if POLICY_LMS_COMMAND="$REPO/scripts/macos/fixtures/mock-lms.sh" \
  POLICY_RUNTIME_DIR="$model_check_runtime" \
  POLICY_MOCK_LMS_CONTEXT=16384 \
  POLICY_LMSTUDIO_BASE_URL="http://127.0.0.1:$port" \
  POLICY_SKIP_LMSTUDIO_BINDING_CHECK=1 \
    "$NODE_BIN" "$REPO/scripts/macos/lmstudio-models.cjs" check >/dev/null 2>&1; then
  printf '%s\n' '[installer-test] wrong runtime context was not rejected' >&2
  exit 1
fi
if POLICY_LMS_COMMAND="$REPO/scripts/macos/fixtures/mock-lms.sh" \
  POLICY_RUNTIME_DIR="$model_check_runtime" \
  POLICY_MOCK_LMS_CONTEXT='"unknown"' \
  POLICY_LMSTUDIO_BASE_URL="http://127.0.0.1:$port" \
  POLICY_SKIP_LMSTUDIO_BINDING_CHECK=1 \
    "$NODE_BIN" "$REPO/scripts/macos/lmstudio-models.cjs" check >/dev/null 2>&1; then
  printf '%s\n' '[installer-test] unknown runtime context was not rejected' >&2
  exit 1
fi
if POLICY_LMS_COMMAND="$REPO/scripts/macos/fixtures/mock-lms.sh" \
  POLICY_RUNTIME_DIR="$model_check_runtime" \
  POLICY_MOCK_LMS_PARALLEL=4 \
  POLICY_LMSTUDIO_BASE_URL="http://127.0.0.1:$port" \
  POLICY_SKIP_LMSTUDIO_BINDING_CHECK=1 \
    "$NODE_BIN" "$REPO/scripts/macos/lmstudio-models.cjs" check >/dev/null 2>&1; then
  printf '%s\n' '[installer-test] wrong runtime parallelism was not rejected' >&2
  exit 1
fi

printf '%s\n' '[installer-test] configurable reasoning-heavy Gemma chat model'
LMSTUDIO_MODEL_PREF="gemma" \
LMSTUDIO_MODEL_TOKEN_LIMIT=32768 \
POLICY_MOCK_LMS_CHAT_IDENTIFIER="gemma" \
POLICY_MOCK_LMS_CHAT_MODEL_KEY="google/gemma-4-26b-a4b" \
POLICY_MOCK_LMS_CONTEXT=80128 \
POLICY_RUNTIME_DIR="$model_check_runtime" \
POLICY_LMS_COMMAND="$REPO/scripts/macos/fixtures/mock-lms.sh" \
POLICY_LMSTUDIO_BASE_URL="http://127.0.0.1:$port" \
POLICY_SKIP_LMSTUDIO_BINDING_CHECK=1 \
  "$NODE_BIN" "$REPO/scripts/macos/lmstudio-models.cjs" check >/dev/null
"$NODE_BIN" -e '
  const fs = require("fs");
  const requests = fs.readFileSync(process.argv[1], "utf8").trim().split("\n").map(JSON.parse);
  const request = requests.at(-1);
  if (request.model !== "gemma" || !Number.isFinite(Number(request.max_tokens)) || Number(request.max_tokens) < 256)
    throw new Error(`Gemma health request drifted: ${JSON.stringify(request)}`);
' "$chat_request_log"
"$NODE_BIN" -e '
  const state = require(process.argv[1]);
  if (state.chatIdentifier !== "gemma" || state.chatModelKey !== "google/gemma-4-26b-a4b")
    throw new Error(`alternative chat mapping was not persisted: ${JSON.stringify(state)}`);
  if (state.embeddingIdentifier !== "dinghy-embed")
    throw new Error(`embedding identity drifted: ${JSON.stringify(state)}`);
' "$model_check_runtime/models.json"
if LMSTUDIO_MODEL_PREF="gemma-reasoning-only" \
  LMSTUDIO_MODEL_TOKEN_LIMIT=32768 \
  POLICY_MOCK_LMS_CHAT_IDENTIFIER="gemma-reasoning-only" \
  POLICY_MOCK_LMS_CHAT_MODEL_KEY="google/gemma-4-26b-a4b" \
  POLICY_MOCK_LMS_CONTEXT=80128 \
  POLICY_RUNTIME_DIR="$model_check_runtime" \
  POLICY_LMS_COMMAND="$REPO/scripts/macos/fixtures/mock-lms.sh" \
  POLICY_LMSTUDIO_BASE_URL="http://127.0.0.1:$port" \
  POLICY_SKIP_LMSTUDIO_BINDING_CHECK=1 \
    "$NODE_BIN" "$REPO/scripts/macos/lmstudio-models.cjs" check >/dev/null 2>&1; then
  printf '%s\n' '[installer-test] reasoning-only chat output was accepted' >&2
  exit 1
fi

printf '%s\n' '[installer-test] reboot loads the persisted alternative model key'
stateful_runtime="$temp_dir/stateful-model-runtime"
stateful_lms_state="$temp_dir/stateful-lms.json"
mkdir -p "$stateful_runtime"
printf '%s\n' '{"chatIdentifier":"gemma","chatModelKey":"google/gemma-4-26b-a4b","chatIndexedModelIdentifier":null,"previousChatIdentifier":"qwen/qwen3.8-27b","embeddingIdentifier":"dinghy-embed","tokenizerPath":null}' >"$stateful_runtime/models.json"
chmod 600 "$stateful_runtime/models.json"
chmod 700 "$REPO/scripts/macos/fixtures/mock-lms-stateful.cjs"
LMSTUDIO_MODEL_PREF="gemma" \
LMSTUDIO_MODEL_TOKEN_LIMIT=32768 \
POLICY_RUNTIME_DIR="$stateful_runtime" \
POLICY_MOCK_LMS_STATE="$stateful_lms_state" \
POLICY_LMS_COMMAND="$REPO/scripts/macos/fixtures/mock-lms-stateful.cjs" \
POLICY_LMSTUDIO_BASE_URL="http://127.0.0.1:$port" \
POLICY_SKIP_LMSTUDIO_BINDING_CHECK=1 \
  "$NODE_BIN" "$REPO/scripts/macos/lmstudio-models.cjs" prepare --skip-artifact-verification >/dev/null
"$NODE_BIN" -e '
  const lms = require(process.argv[1]);
  const runtime = require(process.argv[2]);
  const ids = lms.loaded.map(({identifier}) => identifier).sort();
  if (JSON.stringify(ids) !== JSON.stringify(["dinghy-embed", "gemma"]))
    throw new Error(`unexpected loaded models after reboot: ${JSON.stringify(ids)}`);
  const load = lms.calls.find((call) => call[0] === "load");
  if (!load || load[1] !== "google/gemma-4-26b-a4b" || !load.includes("gemma"))
    throw new Error(`persisted Gemma was not loaded: ${JSON.stringify(lms.calls)}`);
  const unload = lms.calls.find((call) => call[0] === "unload");
  if (!unload || unload[1] !== "qwen/qwen3.8-27b")
    throw new Error(`previous Qwen was not unloaded: ${JSON.stringify(lms.calls)}`);
  if (runtime.previousChatIdentifier !== null)
    throw new Error(`model switch hand-off was not completed: ${JSON.stringify(runtime)}`);
  if (!Array.isArray(runtime.previousChatIdentifiers) || runtime.previousChatIdentifiers.length !== 0)
    throw new Error(`pending model cleanup was not drained: ${JSON.stringify(runtime)}`);
' "$stateful_lms_state" "$stateful_runtime/models.json"

printf '%s\n' '[installer-test] failed previous-model unload is fail-closed and retryable'
failed_unload_runtime="$temp_dir/failed-unload-runtime"
failed_unload_lms_state="$temp_dir/failed-unload-lms.json"
mkdir -p "$failed_unload_runtime"
printf '%s\n' '{"chatIdentifier":"gemma","chatModelKey":"google/gemma-4-26b-a4b","chatIndexedModelIdentifier":null,"previousChatIdentifiers":["qwen/qwen3.8-27b"],"previousChatIdentifier":"qwen/qwen3.8-27b","embeddingIdentifier":"dinghy-embed","tokenizerPath":null}' >"$failed_unload_runtime/models.json"
chmod 600 "$failed_unload_runtime/models.json"
if LMSTUDIO_MODEL_PREF="gemma" \
  LMSTUDIO_MODEL_TOKEN_LIMIT=32768 \
  POLICY_RUNTIME_DIR="$failed_unload_runtime" \
  POLICY_MOCK_LMS_STATE="$failed_unload_lms_state" \
  POLICY_MOCK_LMS_UNLOAD_FAIL="qwen/qwen3.8-27b" \
  POLICY_LMS_COMMAND="$REPO/scripts/macos/fixtures/mock-lms-stateful.cjs" \
  POLICY_LMSTUDIO_BASE_URL="http://127.0.0.1:$port" \
  POLICY_SKIP_LMSTUDIO_BINDING_CHECK=1 \
    "$NODE_BIN" "$REPO/scripts/macos/lmstudio-models.cjs" prepare --skip-artifact-verification >/dev/null 2>&1; then
  printf '%s\n' '[installer-test] failed previous-model unload did not stop prepare' >&2
  exit 1
fi
"$NODE_BIN" -e '
  const runtime = require(process.argv[1]);
  if (!runtime.previousChatIdentifiers?.includes("qwen/qwen3.8-27b"))
    throw new Error(`failed cleanup was not retained for retry: ${JSON.stringify(runtime)}`);
' "$failed_unload_runtime/models.json"

printf '%s\n' '[installer-test] server check rejects a still-loaded pending chat model'
pending_gate_runtime="$temp_dir/pending-gate-runtime"
pending_gate_lms_state="$temp_dir/pending-gate-lms.json"
mkdir -p "$pending_gate_runtime"
cp "$failed_unload_runtime/models.json" "$pending_gate_runtime/models.json"
POLICY_MOCK_LMS_STATE="$pending_gate_lms_state" \
  "$REPO/scripts/macos/fixtures/mock-lms-stateful.cjs" load google/gemma-4-26b-a4b --identifier gemma --context-length 32768 --parallel 1 -y >/dev/null
if LMSTUDIO_MODEL_PREF="gemma" \
  LMSTUDIO_MODEL_TOKEN_LIMIT=32768 \
  POLICY_RUNTIME_DIR="$pending_gate_runtime" \
  POLICY_MOCK_LMS_STATE="$pending_gate_lms_state" \
  POLICY_LMS_COMMAND="$REPO/scripts/macos/fixtures/mock-lms-stateful.cjs" \
  POLICY_LMSTUDIO_BASE_URL="http://127.0.0.1:$port" \
  POLICY_SKIP_LMSTUDIO_BINDING_CHECK=1 \
    "$NODE_BIN" "$REPO/scripts/macos/lmstudio-models.cjs" check >/dev/null 2>&1; then
  printf '%s\n' '[installer-test] pending old chat model did not block server check' >&2
  exit 1
fi

printf '%s\n' '[installer-test] server autostart gates models and refreshes config before exec'
start_gate_dir="$temp_dir/start-server-gate"
start_gate_state="$start_gate_dir/state.log"
mkdir -p "$start_gate_dir"
for step in embedding-check model-check write-config server-entry; do
  cp "$REPO/scripts/macos/fixtures/mock-start-server-step.cjs" "$start_gate_dir/$step.cjs"
done
POLICY_REPO_DIR="$REPO" \
POLICY_RUNTIME_DIR="$temp_dir/runtime" \
POLICY_EMBEDDING_CHECK_SCRIPT="$start_gate_dir/embedding-check.cjs" \
POLICY_MODEL_MANAGER_SCRIPT="$start_gate_dir/model-check.cjs" \
POLICY_CONFIG_WRITER_SCRIPT="$start_gate_dir/write-config.cjs" \
POLICY_SERVER_ENTRYPOINT="$start_gate_dir/server-entry.cjs" \
POLICY_START_GATE_STATE="$start_gate_state" \
  /bin/bash "$REPO/scripts/macos/start-server.sh"
[ "$(tr '\n' ' ' <"$start_gate_state")" = "embedding-check.cjs model-check.cjs write-config.cjs server-entry.cjs " ]

blocked_gate_state="$start_gate_dir/blocked-state.log"
if POLICY_REPO_DIR="$REPO" \
  POLICY_RUNTIME_DIR="$temp_dir/runtime" \
  POLICY_EMBEDDING_CHECK_SCRIPT="$start_gate_dir/embedding-check.cjs" \
  POLICY_MODEL_MANAGER_SCRIPT="$start_gate_dir/model-check.cjs" \
  POLICY_CONFIG_WRITER_SCRIPT="$start_gate_dir/write-config.cjs" \
  POLICY_SERVER_ENTRYPOINT="$start_gate_dir/server-entry.cjs" \
  POLICY_START_GATE_STATE="$blocked_gate_state" \
  POLICY_START_GATE_FAIL_STEP="model-check.cjs" \
  POLICY_SERVER_MODEL_RETRY_ATTEMPTS=1 \
  POLICY_SERVER_MODEL_RETRY_DELAY_SECONDS=0 \
    /bin/bash "$REPO/scripts/macos/start-server.sh" >/dev/null 2>&1; then
  printf '%s\n' '[installer-test] failed model check did not block server start' >&2
  exit 1
fi
grep -Fxq 'embedding-check.cjs' "$blocked_gate_state"
grep -Fxq 'model-check.cjs' "$blocked_gate_state"
! grep -Fq 'write-config.cjs' "$blocked_gate_state"
! grep -Fq 'server-entry.cjs' "$blocked_gate_state"

printf '%s\n' '[installer-test] focused application contracts'
"$NODE_BIN" "$REPO/scripts/macos/pipeline-smoke.cjs" >/dev/null
(cd "$REPO" && STORAGE_DIR="$temp_dir/application-test-storage" npx jest --runInBand \
  scripts/macos/__tests__/comparisonDocumentMerge.test.js \
  scripts/macos/__tests__/comparisonSupportedFormats.test.js \
  scripts/macos/__tests__/managedEmbeddingContract.test.js \
  scripts/macos/__tests__/chatGenerationState.test.js \
  scripts/macos/__tests__/provision.test.js \
  server/__tests__/utils/chats/ChatGenerationManager.test.js \
  server/__tests__/utils/chats/pendingHistory.test.js \
  server/__tests__/utils/chats/threadNavigationStream.test.js \
  server/__tests__/workspaceChats.generationId.test.js \
  server/__tests__/workspacesParsedFiles.endpoint.test.js \
  server/__tests__/comparisonDocuments.endpoint.test.js \
  server/__tests__/comparisonDocuments.threadCleanup.test.js \
  server/__tests__/utils/comparisonDocuments/index.test.js \
  server/__tests__/utils/LocalModelTokenizer/index.test.js \
  server/__tests__/utils/AiProviders/lmStudio/managedModelSelection.test.js \
  server/__tests__/utils/PageAwareTextSplitter/index.test.js \
  server/__tests__/utils/vectorDbProviders/lance/scopedSearch.test.js \
  server/__tests__/comparisonDocumentInventory.model.test.js \
  server/__tests__/utils/PolicyComparison/ComparisonInventoryExtractor.test.js \
  server/__tests__/utils/PolicyComparison/ComparisonInventoryService.test.js \
  server/__tests__/utils/PolicyComparison/PolicyInferenceQueue.test.js \
  server/__tests__/utils/PolicyComparison/ComparisonChunkIndex.test.js \
  server/__tests__/utils/PolicyComparison/ComparisonHybridRetriever.test.js \
  server/__tests__/utils/PolicyComparison/ComparisonBatchSynthesizer.test.js \
  server/__tests__/utils/PolicyComparison/registerLifecycleHooks.test.js \
  server/__tests__/utils/AiProviders/lmStudio/policyInventoryCompletion.test.js \
  server/__tests__/utils/boot/localBinding.test.js \
  server/__tests__/utils/boot/localProductCors.test.js \
  server/__tests__/utils/middleware/simpleSSOEnabled.test.js \
  server/__tests__/utils/helpers/updateENV.policyInstaller.test.js \
  collector/__tests__/processSingleFile/convert/asPDF/PDFLoader.test.js \
  collector/__tests__/processSingleFile/convert/asPDF/PDFPageRenderer.test.js \
  collector/__tests__/processSingleFile/convert/asPDF/PageTextQuality.test.js \
  collector/__tests__/processSingleFile/convert/asPDF/PdfExtractionAssembler.test.js \
  collector/__tests__/processSingleFile/convert/asPDF/asPDF.test.js \
  collector/__tests__/utils/OCRLoader.test.js \
  collector/__tests__/utils/http/localBinding.test.js)

printf '%s\n' '[installer-test] PASS'
