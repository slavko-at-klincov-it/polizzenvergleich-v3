#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

for file in \
  "$REPO_DIR"/*.command \
  "$SCRIPT_DIR"/*.sh \
  "$SCRIPT_DIR"/lib/*.sh; do
  /bin/bash -n "$file"
done
"${NODE_BIN:-node}" --check "$SCRIPT_DIR/write-config.cjs"
"${NODE_BIN:-node}" --check "$SCRIPT_DIR/prepare-qwen36-model.cjs"
"${NODE_BIN:-node}" --check "$SCRIPT_DIR/load-qwen36.cjs"
/usr/bin/grep -A3 '^  update)' "$SCRIPT_DIR/control.sh" | /usr/bin/grep -q 'shift'
/usr/bin/grep -A4 '^  update)' "$SCRIPT_DIR/control.sh" | /usr/bin/grep -Fq '"$@"'

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/polizzenvergleich-v3-installer-test.XXXXXX")"
trap '/bin/rm -rf "$temp_dir"' EXIT
mkdir -p "$temp_dir/repo/server" "$temp_dir/repo/collector" "$temp_dir/repo/frontend"
printf '%s\n' 'JWT_SECRET="preserved-secret"' 'LLM_PROVIDER="lmstudio"' >"$temp_dir/repo/server/.env"
printf '%s\n' 'model-fixture' >"$temp_dir/model.gguf"
printf '%s\n' 'runtime-fixture' >"$temp_dir/llama-server"
model_sha="$(shasum -a 256 "$temp_dir/model.gguf" | /usr/bin/awk '{print $1}')"
runtime_sha="$(shasum -a 256 "$temp_dir/llama-server" | /usr/bin/awk '{print $1}')"
printf '%s\n' \
  '{' \
  '  "schemaVersion": 1,' \
  '  "contractId": "lf-a-driven-installer-test-v1",' \
  '  "enabled": true,' \
  '  "mode": "SHADOW_ONLY",' \
  '  "failurePolicy": "FAIL_SHADOW_RUN",' \
  '  "provider": {' \
  '    "kind": "OPENAI_COMPATIBLE_EMBEDDINGS",' \
  '    "baseUrl": "http://127.0.0.1:1234/v1",' \
  '    "model": "text-embedding-dinghy-law-4b-v1",' \
  '    "dimensions": 2560,' \
  '    "apiKeyEnv": null,' \
  '    "requestTimeoutMs": 30000,' \
  "    \"modelArtifactPath\": \"$temp_dir/model.gguf\"," \
  "    \"modelArtifactSha256\": \"$model_sha\"," \
  '    "runtimeRevision": "llama.cpp-mac-arm64-apple-metal-advsimd@2.28.2",' \
  "    \"runtimeArtifactPath\": \"$temp_dir/llama-server\"," \
  "    \"runtimeArtifactSha256\": \"$runtime_sha\"," \
  '    "inputNormalization": "NFKC_WHITESPACE_V1"' \
  '  },' \
  '  "retrieval": {' \
  '    "chunkSize": 3000,' \
  '    "chunkOverlap": 250,' \
  '    "topK": 3,' \
  '    "batchSize": 32,' \
  '    "minimumScore": 0' \
  '  }' \
  '}' >"$temp_dir/embedding-contract.json"
chmod 600 "$temp_dir/embedding-contract.json"
"${NODE_BIN:-node}" "$REPO_DIR/server/scripts/verifyADrivenEmbeddingContract.cjs" \
  "$temp_dir/embedding-contract.json" >/dev/null

V3_REPO_DIR="$temp_dir/repo" \
V3_SERVER_PORT=3004 \
V3_COLLECTOR_PORT=8890 \
V3_A_DRIVEN_EMBEDDING_CONTRACT_FILE="$temp_dir/embedding-contract.json" \
  "${NODE_BIN:-node}" "$SCRIPT_DIR/write-config.cjs" >/dev/null

/usr/bin/grep -q '^SERVER_PORT="3004"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^SERVER_HOST="127.0.0.1"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^COLLECTOR_PORT="8890"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^COLLECTOR_API_HOST="127.0.0.1"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^JWT_SECRET="preserved-secret"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^LLM_PROVIDER="lmstudio"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^LMSTUDIO_MODEL_PREF="qwen/qwen3.6-35b-a3b"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^LMSTUDIO_MODEL_TOKEN_LIMIT="42496"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -Fq "POLICY_A_DRIVEN_EMBEDDING_CONTRACT_FILE=\"$temp_dir/embedding-contract.json\"" "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^COLLECTOR_HOST="127.0.0.1"$' "$temp_dir/repo/collector/.env"
/usr/bin/grep -q '^VITE_API_BASE="/api"$' "$temp_dir/repo/frontend/.env"
[ "$(stat -f '%OLp' "$temp_dir/repo/server/.env")" = "600" ]
[ "$(stat -f '%OLp' "$temp_dir/repo/collector/.env")" = "600" ]

# Idempotenz: Geheimnisse und nicht verwaltete Providerwerte bleiben erhalten.
V3_REPO_DIR="$temp_dir/repo" \
V3_SERVER_PORT=3004 \
V3_COLLECTOR_PORT=8890 \
  "${NODE_BIN:-node}" "$SCRIPT_DIR/write-config.cjs" >/dev/null
[ "$(/usr/bin/grep -c '^# BEGIN POLIZZENVERGLEICH V3 MANAGED CONFIG$' "$temp_dir/repo/server/.env")" = "1" ]
[ "$(/usr/bin/grep -c '^JWT_SECRET="preserved-secret"$' "$temp_dir/repo/server/.env")" = "1" ]

# Ein frischer Installer darf die AnythingLLM-Ersteinrichtung nicht durch ein
# vorab erzeugtes JWT_SECRET als vermeintliche Legacy-Installation überspringen.
mkdir -p "$temp_dir/fresh/server" "$temp_dir/fresh/collector" "$temp_dir/fresh/frontend"
V3_REPO_DIR="$temp_dir/fresh" \
V3_SERVER_PORT=3004 \
V3_COLLECTOR_PORT=8890 \
V3_A_DRIVEN_EMBEDDING_CONTRACT_FILE="$temp_dir/embedding-contract.json" \
  "${NODE_BIN:-node}" "$SCRIPT_DIR/write-config.cjs" >/dev/null
! /usr/bin/grep -q '^JWT_SECRET=' "$temp_dir/fresh/server/.env"

export V3_REPO_DIR="$temp_dir/repo"
export V3_RUNTIME_DIR="$temp_dir/runtime"
export V3_LAUNCH_AGENTS_DIR="$temp_dir/LaunchAgents"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/services.sh"
mkdir -p "$V3_NODE_DIR/bin"
touch "$V3_NODE_BIN"
chmod 700 "$V3_NODE_BIN"
v3_write_service_plist \
  "$V3_LABEL_PREFIX.collector" \
  "$V3_REPO_DIR/collector" \
  "$V3_NODE_BIN" \
  "$V3_REPO_DIR/collector/index.js"
v3_write_service_plist \
  "$V3_LABEL_PREFIX.server" \
  "$V3_REPO_DIR/server" \
  "/bin/bash" \
  "$SCRIPT_DIR/start-server.sh"
for plist in "$V3_LAUNCH_AGENTS_DIR"/*.plist; do
  /usr/bin/plutil -lint "$plist" >/dev/null
  /usr/bin/grep -q '<key>NODE_ENV</key><string>production</string>' "$plist"
  /usr/bin/grep -q '<key>KeepAlive</key><true/>' "$plist"
done
[ "$(find "$V3_LAUNCH_AGENTS_DIR" -name '*.plist' | wc -l | tr -d ' ')" = "2" ]
[ "$V3_NODE_VERSION" = "22.23.2" ]
[ "$V3_RELEASE_VERSION" = "3.9.0" ]
[ "$V3_SERVER_PORT" = "3004" ]
[ "$V3_COLLECTOR_PORT" = "8890" ]

# Installation und Update dürfen nie Code oder Datenbank wechseln, solange ein
# Vergleich in der Datenbank oder als abgekoppelter Worker aktiv ist.
comparison_db="$V3_REPO_DIR/server/storage/anythingllm.db"
mkdir -p "$(dirname "$comparison_db")" "$V3_REPO_DIR/server/scripts"
/usr/bin/sqlite3 "$comparison_db" \
  "CREATE TABLE policy_comparison_sessions (status TEXT NOT NULL); INSERT INTO policy_comparison_sessions VALUES ('COMPLETED');"
v3_require_comparison_quiescent
/usr/bin/sqlite3 "$comparison_db" \
  "INSERT INTO policy_comparison_sessions VALUES ('RUNNING');"
if (v3_require_comparison_quiescent); then
  printf '%s\n' "Aktive Vergleichssitzung wurde fälschlich freigegeben." >&2
  exit 1
fi
/usr/bin/sqlite3 "$comparison_db" \
  "DELETE FROM policy_comparison_sessions WHERE status = 'RUNNING';"
worker_fixture="$V3_REPO_DIR/server/scripts/policyComparisonWorker.cjs"
{
  printf '%s\n' '#!/bin/bash' '/bin/sleep 30'
} >"$worker_fixture"
chmod 700 "$worker_fixture"
/bin/bash "$worker_fixture" &
worker_fixture_pid=$!
if (v3_require_comparison_quiescent); then
  kill "$worker_fixture_pid" >/dev/null 2>&1 || true
  wait "$worker_fixture_pid" >/dev/null 2>&1 || true
  printf '%s\n' "Aktiver Vergleichs-Worker wurde fälschlich freigegeben." >&2
  exit 1
fi
kill "$worker_fixture_pid" >/dev/null 2>&1 || true
wait "$worker_fixture_pid" >/dev/null 2>&1 || true

release_repo="$temp_dir/release-repo"
release_remote="$temp_dir/release-origin.git"
mkdir -p "$release_repo"
git init --bare -q "$release_remote"
git -C "$release_repo" init -q
git -C "$release_repo" -c user.name='Release Contract' \
  -c user.email='release-contract@example.invalid' commit --allow-empty -qm initial
git -C "$release_repo" remote add origin "$release_remote"
git -C "$release_repo" push -q origin HEAD:refs/heads/main
git -C "$release_repo" fetch -q origin main
if (
  export V3_REPO_DIR="$release_repo"
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/lib/common.sh"
  v3_release_checkout_matches
); then
  printf '%s\n' "Fehlender Release-Tag wurde fälschlich akzeptiert." >&2
  exit 1
fi
git -C "$release_repo" -c user.name='Release Contract' \
  -c user.email='release-contract@example.invalid' tag -a "v$V3_RELEASE_VERSION" \
  -m "Release v$V3_RELEASE_VERSION"
if (
  export V3_REPO_DIR="$release_repo"
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/lib/common.sh"
  v3_remote_release_tag_matches
); then
  printf '%s\n' "Nicht veröffentlichter Release-Tag wurde remote akzeptiert." >&2
  exit 1
fi
git -C "$release_repo" push -q origin "refs/tags/v$V3_RELEASE_VERSION"
(
  export V3_REPO_DIR="$release_repo"
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/lib/common.sh"
  v3_release_checkout_matches
  v3_remote_release_tag_matches
)
git -C "$release_repo" tag -d "v$V3_RELEASE_VERSION" >/dev/null
git -C "$release_repo" -c user.name='Release Contract' \
  -c user.email='release-contract@example.invalid' tag -a "v$V3_RELEASE_VERSION" \
  -m "Abweichender lokaler Release v$V3_RELEASE_VERSION"
if (
  export V3_REPO_DIR="$release_repo"
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/lib/common.sh"
  v3_remote_release_tag_matches
); then
  printf '%s\n' "Abweichendes lokales Tag-Objekt wurde remote akzeptiert." >&2
  exit 1
fi
git -C "$release_repo" tag -d "v$V3_RELEASE_VERSION" >/dev/null
git -C "$release_repo" fetch -q origin \
  "refs/tags/v$V3_RELEASE_VERSION:refs/tags/v$V3_RELEASE_VERSION"
touch "$release_repo/untracked"
if (
  export V3_REPO_DIR="$release_repo"
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/lib/common.sh"
  v3_release_checkout_matches
); then
  printf '%s\n' "Veränderter Checkout wurde fälschlich als Release akzeptiert." >&2
  exit 1
fi
/bin/rm "$release_repo/untracked"
git -C "$release_repo" tag -d "v$V3_RELEASE_VERSION" >/dev/null
git -C "$release_repo" tag "v$V3_RELEASE_VERSION"
if (
  export V3_REPO_DIR="$release_repo"
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/lib/common.sh"
  v3_release_checkout_matches
); then
  printf '%s\n' "Lightweight-Tag wurde fälschlich als Release akzeptiert." >&2
  exit 1
fi
git -C "$release_repo" tag -d "v$V3_RELEASE_VERSION" >/dev/null
git -C "$release_repo" -c user.name='Release Contract' \
  -c user.email='release-contract@example.invalid' tag -a "v$V3_RELEASE_VERSION" \
  -m "Release v$V3_RELEASE_VERSION"
git -C "$release_repo" -c user.name='Release Contract' \
  -c user.email='release-contract@example.invalid' commit --allow-empty -qm next
if (
  export V3_REPO_DIR="$release_repo"
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/lib/common.sh"
  v3_release_checkout_matches
); then
  printf '%s\n' "Fremder HEAD wurde fälschlich als Release akzeptiert." >&2
  exit 1
fi
git -C "$release_repo" tag -d "v$V3_RELEASE_VERSION" >/dev/null
git -C "$release_repo" -c user.name='Release Contract' \
  -c user.email='release-contract@example.invalid' tag -a "v$V3_RELEASE_VERSION" \
  -m "Release v$V3_RELEASE_VERSION"
if (
  export V3_REPO_DIR="$release_repo"
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/lib/common.sh"
  v3_release_checkout_matches
); then
  printf '%s\n' "Nicht auf origin/main veröffentlichter Tag wurde fälschlich akzeptiert." >&2
  exit 1
fi

if /usr/bin/grep -RniE --exclude='run.sh' --exclude='start-server.sh' \
  --exclude='lmstudio.sh' --exclude='prepare-qwen36-model.cjs' \
  --exclude='load-qwen36.cjs' --exclude='run-all-categories-quality.command' \
  --exclude='run-hybrid-shadow-pilot.command' \
  --exclude='run-hybrid-shadow-quality.command' \
  --exclude='run-a-driven-controlled-b-pilot.command' \
  --exclude='run-a-driven-reference-product-v2.command' \
  --exclude='run-a-driven-reference-shadow-v2.command' \
  --exclude='run-lf-reference-discovery-benchmark.command' \
  'feuer|policyComparison|dinghy|qwen3\.8|comparison_documents' \
  "$SCRIPT_DIR" "$REPO_DIR"/*.command; then
  printf '%s\n' "Spezialisierte Vergleichslogik im V3-Installer gefunden." >&2
  exit 1
fi

# Der explizite Diagnose-RC darf den VS-Pilot starten, aber keine
# Vergleichslogik in Installer, Servicekonfiguration oder Updatepfad tragen.
/usr/bin/grep -Fq 'server/scripts/qa/runVsPilotAb.cjs' \
  "$REPO_DIR/run-vs-pilot-ab.command"
/usr/bin/grep -Fq 'qwen/qwen3.6-35b-a3b' "$REPO_DIR/run-vs-pilot-ab.command"

# Der vollständige VS-Qualitätsrunner ist ebenfalls ein explizites QA-Werkzeug
# außerhalb des Installers. Sein Modell bleibt lokal und sein Einstiegspunkt
# muss den 36-Kategorien-Materialisierer verwenden.
/usr/bin/grep -Fq 'server/scripts/qa/materializeVsFullResult.cjs' \
  "$REPO_DIR/run-vs-full-quality-ab.command"
/usr/bin/grep -Fq 'qwen/qwen3.6-35b-a3b' \
  "$REPO_DIR/run-vs-full-quality-ab.command"

# Der All-Kategorien-Runner ist ebenfalls ein explizites QA-Werkzeug und kein
# Bestandteil von Installer, LaunchAgents oder Updatepfad.
/usr/bin/grep -Fq 'server/utils/policyComparison/productContract.js' \
  "$REPO_DIR/run-all-categories-quality.command"
/usr/bin/grep -Fq 'qwen/qwen3.6-35b-a3b' \
  "$REPO_DIR/run-all-categories-quality.command"

# Der dynamische LF-V2-Produktrunner ist der ausdrückliche Worker-Unterprozess
# für den LF-Modus. Er bleibt außerhalb von Installer, LaunchAgents und
# Updatepfad; die Installation stellt nur seinen hashgebundenen lokalen
# Embeddingvertrag bereit.
/usr/bin/grep -Fq 'materializeADrivenReferenceProductResult.cjs' \
  "$REPO_DIR/run-a-driven-reference-product-v2.command"
/usr/bin/grep -Fq 'text-embedding-dinghy-law-4b-v1' \
  "$REPO_DIR/run-a-driven-reference-product-v2.command"
/usr/bin/grep -Fq 'POLICY_A_DRIVEN_EMBEDDING_CONTRACT_FILE' \
  "$REPO_DIR/server/scripts/policyComparisonWorker.cjs"

# Die Hybrid-Shadow-Runner bleiben explizite QA-Werkzeuge. Sie dürfen Modelle
# kontrolliert wechseln, sind aber kein Bestandteil von Installation, Start,
# Doctor oder Update.
/usr/bin/grep -Fq 'server/scripts/qa/runHybridShadowPilotSearch.cjs' \
  "$REPO_DIR/run-hybrid-shadow-pilot.command"
/usr/bin/grep -Fq 'server/utils/policyComparison/productContract.js' \
  "$REPO_DIR/run-hybrid-shadow-quality.command"

printf '%s\n' "V3 macOS installer tests: PASS"
