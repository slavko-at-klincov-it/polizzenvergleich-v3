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
printf '%s\n' 'JWT_SECRET="keep-this-secret"' 'UNRELATED_SETTING="keep-me"' >"$temp_dir/config-repo/server/.env"

printf '%s\n' '[installer-test] idempotent secure config'
POLICY_REPO_DIR="$temp_dir/config-repo" POLICY_EMBED_MODEL_ID='unsafe-override' "$NODE_BIN" "$REPO/scripts/macos/write-config.cjs" >/dev/null
POLICY_REPO_DIR="$temp_dir/config-repo" POLICY_EMBED_MODEL_ID='unsafe-override' "$NODE_BIN" "$REPO/scripts/macos/write-config.cjs" >/dev/null
grep -q 'JWT_SECRET="keep-this-secret"' "$temp_dir/config-repo/server/.env"
grep -q 'UNRELATED_SETTING="keep-me"' "$temp_dir/config-repo/server/.env"
grep -q 'SERVER_HOST="127.0.0.1"' "$temp_dir/config-repo/server/.env"
grep -q 'POLICY_MANAGED_EMBEDDING="true"' "$temp_dir/config-repo/server/.env"
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
port_file="$temp_dir/lmstudio-port"
"$NODE_BIN" "$REPO/scripts/macos/fixtures/mock-lmstudio.cjs" "$port_file" &
mock_pid=$!
for _ in $(seq 1 50); do [ -s "$port_file" ] && break; sleep 0.1; done
[ -s "$port_file" ]
port="$(cat "$port_file")"
POLICY_LMS_COMMAND="$REPO/scripts/macos/fixtures/mock-lms.sh" \
POLICY_LMSTUDIO_BASE_URL="http://127.0.0.1:$port" \
POLICY_SKIP_LMSTUDIO_BINDING_CHECK=1 \
  "$NODE_BIN" "$REPO/scripts/macos/lmstudio-models.cjs" check >/dev/null

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
  server/__tests__/utils/boot/localBinding.test.js \
  server/__tests__/utils/helpers/updateENV.policyInstaller.test.js \
  collector/__tests__/processSingleFile/convert/asPDF/PDFLoader.test.js \
  collector/__tests__/processSingleFile/convert/asPDF/PDFPageRenderer.test.js \
  collector/__tests__/processSingleFile/convert/asPDF/PageTextQuality.test.js \
  collector/__tests__/processSingleFile/convert/asPDF/PdfExtractionAssembler.test.js \
  collector/__tests__/processSingleFile/convert/asPDF/asPDF.test.js \
  collector/__tests__/utils/OCRLoader.test.js \
  collector/__tests__/utils/http/localBinding.test.js)

printf '%s\n' '[installer-test] PASS'
