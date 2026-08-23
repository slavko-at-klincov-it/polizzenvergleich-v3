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
POLICY_REPO_DIR="$temp_dir/config-repo" "$NODE_BIN" "$REPO/scripts/macos/write-config.cjs" >/dev/null
POLICY_REPO_DIR="$temp_dir/config-repo" "$NODE_BIN" "$REPO/scripts/macos/write-config.cjs" >/dev/null
grep -q 'JWT_SECRET="keep-this-secret"' "$temp_dir/config-repo/server/.env"
grep -q 'UNRELATED_SETTING="keep-me"' "$temp_dir/config-repo/server/.env"
grep -q 'SERVER_HOST="127.0.0.1"' "$temp_dir/config-repo/server/.env"
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
(cd "$REPO" && npx jest --runInBand \
  scripts/macos/__tests__/comparisonDocumentMerge.test.js \
  scripts/macos/__tests__/chatGenerationState.test.js \
  scripts/macos/__tests__/provision.test.js \
  server/__tests__/utils/chats/ChatGenerationManager.test.js \
  server/__tests__/utils/chats/pendingHistory.test.js \
  server/__tests__/utils/chats/threadNavigationStream.test.js \
  server/__tests__/utils/boot/localBinding.test.js \
  server/__tests__/utils/helpers/updateENV.policyInstaller.test.js \
  collector/__tests__/utils/http/localBinding.test.js)

printf '%s\n' '[installer-test] PASS'
