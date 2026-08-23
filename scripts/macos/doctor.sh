#!/bin/bash

# Technical readiness gate for hardware, model APIs, local-only listeners,
# services, persistence topology, and first-run provisioning.
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

failures=0
check_ok() { policy_ok "$1"; }
check_fail() { printf '\033[1;31m[FEHLER]\033[0m %s\n' "$1" >&2; failures=$((failures + 1)); }

policy_safe_repo_path
if [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then check_ok "macOS auf Apple Silicon"; else check_fail "macOS arm64 erforderlich"; fi

if [ -x "$POLICY_NODE_BIN" ]; then
  policy_export_runtime_path
  check_ok "Lokale Node-Laufzeit $($POLICY_NODE_BIN --version)"
else
  check_fail "Lokale Node-Laufzeit fehlt"
fi

for file in "$POLICY_REPO_DIR/server/.env" "$POLICY_REPO_DIR/collector/.env"; do
  if [ -f "$file" ]; then
    mode="$(stat -f '%OLp' "$file" 2>/dev/null || printf '000')"
    if [ "$mode" = "600" ]; then check_ok "Geschützte Konfiguration: ${file#"$POLICY_REPO_DIR"/}"; else check_fail "Unsichere Rechte $mode: $file"; fi
  else
    check_fail "Konfiguration fehlt: $file"
  fi
done

if [ -x "$POLICY_NODE_BIN" ] && command -v lms >/dev/null 2>&1; then
  if "$POLICY_NODE_BIN" "$POLICY_SCRIPT_DIR/managed-embedding-check.cjs" >/dev/null; then check_ok "Dinghy-Konfiguration und 2560-Dimensionsvertrag"; else check_fail "Dinghy-Konfiguration ist nicht updatesicher"; fi
  if "$POLICY_NODE_BIN" "$POLICY_SCRIPT_DIR/lmstudio-models.cjs" check; then check_ok "Konfiguriertes LM-Studio-Chatmodell und Dinghy-Embeddings"; else check_fail "LM-Studio-Modellprüfung fehlgeschlagen"; fi
else
  check_fail "LM Studio CLI ist nicht verfügbar"
fi

if policy_wait_http "$POLICY_APP_URL/api/ping" 90; then check_ok "AnythingLLM-Server erreichbar"; else check_fail "AnythingLLM-Server nicht erreichbar"; fi
if policy_wait_http "http://127.0.0.1:${POLICY_COLLECTOR_PORT:-8888}/accepts" 30; then check_ok "PDF-Collector erreichbar"; else check_fail "PDF-Collector nicht erreichbar"; fi

if command -v lsof >/dev/null 2>&1; then
  for port in "1234" "${POLICY_SERVER_PORT:-3002}" "${POLICY_COLLECTOR_PORT:-8888}"; do
    if policy_listener_is_loopback_only "$port"; then
      check_ok "Port $port ist auf Loopback begrenzt"
    else
      check_fail "Port $port fehlt oder lauscht nicht ausschließlich lokal"
    fi
  done
fi

if [ -x "$POLICY_NODE_BIN" ] && [ -d "$POLICY_REPO_DIR/server/node_modules" ]; then
  status_json="$($POLICY_NODE_BIN "$POLICY_SCRIPT_DIR/provision.cjs" status | tail -n 1 2>/dev/null || true)"
  provision_ready="$($POLICY_NODE_BIN -e 'try { const s=JSON.parse(process.argv[1]); process.stdout.write(String(s.ready === true)); } catch { process.stdout.write("false"); }' "$status_json")"
  if [ "$provision_ready" = "true" ]; then
    check_ok "Single-User-Modus ohne Login, Workspace, Prompt und Provider-Konfiguration"
  else
    check_fail "Provisionierung ist unvollständig"
    "$POLICY_NODE_BIN" -e 'try { for (const p of JSON.parse(process.argv[1]).problems || []) console.error(`  - ${p}`); } catch {}' "$status_json"
  fi
  if "$POLICY_NODE_BIN" "$POLICY_SCRIPT_DIR/inventory-schema-check.cjs" >/dev/null; then
    check_ok "Persistentes Klauselinventar und additive Datenbankmigration"
  else
    check_fail "Inventar-Datenbankschema fehlt oder ist inkonsistent"
  fi
  if "$POLICY_NODE_BIN" "$POLICY_SCRIPT_DIR/pipeline-smoke.cjs" >/dev/null; then
    check_ok "Synthetischer Zwei-Dokument-Test: Selbstbehalt, Seite, A/B-Isolation und Cleanup"
  else
    check_fail "Synthetischer Vergleichspipeline-Test fehlgeschlagen"
  fi
fi

if /usr/bin/fdesetup status 2>/dev/null | grep -qi 'FileVault is On'; then
  check_ok "FileVault ist aktiv"
else
  policy_warn "FileVault ist nicht aktiv oder konnte nicht geprüft werden. Kundendaten sind im Ruhezustand schwächer geschützt."
fi

if [ "$failures" -gt 0 ]; then
  printf '%s\n' "Doctor-Ergebnis: REVISE ($failures Fehler)" >&2
  exit 1
fi
policy_ok "Doctor-Ergebnis: PASS – technische Bereitschaft bestätigt."
policy_warn "Die fachliche Endabnahme mit zwei Kunden-Test-PDFs bleibt vor Produktivnutzung verpflichtend."
