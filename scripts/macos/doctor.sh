#!/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

failures=0
ok() { v3_ok "$1"; }
bad() {
  printf '\033[1;31m[FEHLER]\033[0m %s\n' "$1" >&2
  failures=$((failures + 1))
}

v3_safe_repo_path
[ "$(uname -s)/$(uname -m)" = "Darwin/arm64" ] && ok "macOS Apple Silicon" || bad "macOS arm64 erforderlich"
[ -x "$V3_NODE_BIN" ] && ok "Lokale Node-Runtime" || bad "Node-Runtime fehlt"
[ "$($V3_NODE_BIN --version 2>/dev/null || true)" = "v$V3_NODE_VERSION" ] && ok "Node v$V3_NODE_VERSION" || bad "Falsche Node-Version"
[ "$V3_RELEASE_VERSION" = "3.6.0" ] && ok "Produktversion v$V3_RELEASE_VERSION" || bad "Unerwartete Produktversion"
v3_release_checkout_matches &&
  ok "Annotierter Release-Tag v$V3_RELEASE_VERSION stimmt mit HEAD überein" ||
  bad "HEAD entspricht nicht dem annotierten Release-Tag v$V3_RELEASE_VERSION"

for name in collector server; do
  plist="$V3_LAUNCH_AGENTS_DIR/$V3_LABEL_PREFIX.$name.plist"
  if [ -f "$plist" ] && /usr/bin/plutil -lint "$plist" >/dev/null 2>&1 &&
    /bin/launchctl print "gui/$UID/$V3_LABEL_PREFIX.$name" >/dev/null 2>&1; then
    ok "Dienst $name geladen"
  else
    bad "Dienst $name fehlt oder ist nicht geladen"
  fi
done

for file in "$V3_REPO_DIR/server/.env" "$V3_REPO_DIR/collector/.env"; do
  if [ -f "$file" ] && [ "$(stat -f '%OLp' "$file" 2>/dev/null || true)" = "600" ]; then
    ok "Geschützte ${file#"$V3_REPO_DIR/"}"
  else
    bad "Konfiguration fehlt oder ist ungeschützt: $file"
  fi
done

[ -f "$V3_REPO_DIR/server/public/_index.html" ] && ok "Produktions-Oberfläche" || bad "Produktions-Oberfläche fehlt"
if [ -s "$V3_REPO_DIR/server/storage/anythingllm.db" ] &&
  (cd "$V3_REPO_DIR/server" && "$V3_NODE_BIN" "$V3_REPO_DIR/server/node_modules/.bin/prisma" migrate status --schema=./prisma/schema.prisma >/dev/null 2>&1); then
  ok "Datenbankmigrationen aktuell"
else
  bad "Datenbank fehlt oder Migrationen sind nicht aktuell"
fi

v3_wait_http "$V3_APP_URL/api/ping" 90 && ok "Server $V3_APP_URL" || bad "Server nicht erreichbar"
v3_wait_http "http://127.0.0.1:$V3_COLLECTOR_PORT/accepts" 30 && ok "Collector" || bad "Collector nicht erreichbar"
v3_listener_is_loopback_only "$V3_SERVER_PORT" && ok "Port $V3_SERVER_PORT nur Loopback" || bad "Port $V3_SERVER_PORT fehlt oder ist nicht lokal begrenzt"
v3_listener_is_loopback_only "$V3_COLLECTOR_PORT" && ok "Port $V3_COLLECTOR_PORT nur Loopback" || bad "Port $V3_COLLECTOR_PORT fehlt oder ist nicht lokal begrenzt"

LMS_BIN="$HOME/.lmstudio/bin/lms"
if [ -x "$LMS_BIN" ]; then
  LMS_STATUS="$($LMS_BIN ps 2>/dev/null || true)"
  LMS_MODEL_COUNT="$(printf '%s\n' "$LMS_STATUS" | /usr/bin/awk 'NF && $1 != "IDENTIFIER" { count += 1 } END { print count + 0 }')"
  printf '%s\n' "$LMS_STATUS" | /usr/bin/grep -Fq 'qwen/qwen3.6-35b-a3b' &&
    printf '%s\n' "$LMS_STATUS" | /usr/bin/grep -Fq '42496' &&
    printf '%s\n' "$LMS_STATUS" | /usr/bin/grep -Eq '42496[[:space:]]+1[[:space:]]' &&
    [ "$LMS_MODEL_COUNT" = "1" ] &&
    ok "Qwen 3.6: Kontext 42.496, Parallelität 1" ||
    bad "Erwartet wird ausschließlich Qwen 3.6 mit Kontext 42.496 und Parallelität 1"
  [ "$LMS_MODEL_COUNT" = "1" ] &&
    ok "Kein weiteres Chat- oder Embeddingmodell geladen" ||
    bad "Zusätzliches Chat- oder Embeddingmodell ist geladen"
else
  bad "LM Studio CLI fehlt"
fi

[ "$failures" -eq 0 ] || {
  printf '%s\n' "Doctor: REVISE ($failures Fehler)" >&2
  exit 1
}
v3_ok "Doctor: PASS"
