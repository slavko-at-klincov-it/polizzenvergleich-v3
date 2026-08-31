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

V3_REPO_DIR="$temp_dir/repo" \
V3_SERVER_PORT=3004 \
V3_COLLECTOR_PORT=8890 \
  "${NODE_BIN:-node}" "$SCRIPT_DIR/write-config.cjs" >/dev/null

/usr/bin/grep -q '^SERVER_PORT="3004"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^SERVER_HOST="127.0.0.1"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^COLLECTOR_PORT="8890"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^COLLECTOR_API_HOST="127.0.0.1"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^JWT_SECRET="preserved-secret"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^LLM_PROVIDER="lmstudio"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^LMSTUDIO_MODEL_PREF="qwen/qwen3.6-35b-a3b"$' "$temp_dir/repo/server/.env"
/usr/bin/grep -q '^LMSTUDIO_MODEL_TOKEN_LIMIT="42496"$' "$temp_dir/repo/server/.env"
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
[ "$V3_SERVER_PORT" = "3004" ]
[ "$V3_COLLECTOR_PORT" = "8890" ]

if /usr/bin/grep -RniE --exclude='run.sh' --exclude='start-server.sh' \
  --exclude='lmstudio.sh' --exclude='prepare-qwen36-model.cjs' \
  --exclude='load-qwen36.cjs' --exclude='run-all-categories-quality.command' \
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

printf '%s\n' "V3 macOS installer tests: PASS"
