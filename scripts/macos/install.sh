#!/bin/bash

# One-command native customer installation. Safe to re-run: configuration is
# merged, passwords are requested only for missing users, and data is backed up.
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
source "$POLICY_SCRIPT_DIR/lib/runtime.sh"
source "$POLICY_SCRIPT_DIR/lib/build.sh"
source "$POLICY_SCRIPT_DIR/lib/services.sh"

download_models=true
unload_other=true
dry_run=false
non_interactive=false
for argument in "$@"; do
  case "$argument" in
    --skip-model-download) download_models=false ;;
    --keep-loaded-models) unload_other=false ;;
    --dry-run) dry_run=true ;;
    --non-interactive) non_interactive=true ;;
    --help|-h)
      printf '%s\n' "Verwendung: ./install.command [--skip-model-download] [--keep-loaded-models] [--non-interactive] [--dry-run]"
      exit 0
      ;;
    *) policy_die "Unbekannte Option: $argument" ;;
  esac
done

policy_log "Prüfe den Mac und das Projekt ..."
[ "${POLICY_SERVER_PORT:-3002}" = "3002" ] || policy_die "Kundeninstaller verwendet fest Port 3002."
[ "${POLICY_COLLECTOR_PORT:-8888}" = "8888" ] || policy_die "Kundeninstaller verwendet fest Port 8888."
[ "${POLICY_ADMIN_USERNAME:-admin}" = "admin" ] || policy_die "Kundeninstaller verwendet fest den Admin-Namen 'admin'."
[ "${POLICY_BROKER_USERNAME:-makler}" = "makler" ] || policy_die "Kundeninstaller verwendet fest den Makler-Namen 'makler'."
policy_safe_repo_path
policy_require_macos_arm64
policy_require_memory
policy_require_gui_session
policy_require_command curl "curl gehört zur macOS-Standardinstallation."
policy_require_command openssl "OpenSSL gehört zur macOS-Standardinstallation."
policy_require_port_available "${POLICY_SERVER_PORT:-3002}"
policy_require_port_available "${POLICY_COLLECTOR_PORT:-8888}"
if [ "$download_models" = true ]; then policy_require_disk_space 26214400; else policy_require_disk_space 5242880; fi

if [ "$dry_run" = true ]; then
  policy_ok "Vorprüfung bestanden. Der echte Lauf würde Runtime, Modelle, Build, Datenbank, Benutzer und Autostart einrichten."
  exit 0
fi

umask 077
policy_require_clean_checkout
policy_require_release_checkout
policy_acquire_install_lock
services_were_running=false
if policy_services_running; then services_were_running=true; fi
installer_cleanup() {
  local status="$?"
  if [ "$status" -ne 0 ]; then
    policy_stop_services || true
    policy_restore_database_backup || true
    if [ "$services_were_running" = false ]; then
      policy_remove_service_definitions || true
    fi
  fi
  if [ "$status" -ne 0 ] && [ "$services_were_running" = true ] && [ -x "$POLICY_NODE_BIN" ]; then
    policy_warn "Installation fehlgeschlagen; die zuvor vorhandenen Dienste werden wieder gestartet."
    policy_install_services || true
  fi
  policy_release_install_lock || true
  return "$status"
}
trap installer_cleanup EXIT
policy_stop_services
policy_ensure_node_runtime
policy_prepare_yarn
policy_require_command lms "LM Studio einmal öffnen und unter Developer die lms CLI aktivieren."

model_args=(prepare)
if [ "$download_models" = true ]; then model_args+=(--download); fi
if [ "$unload_other" = true ]; then model_args+=(--unload-other); fi
policy_log "Bereite Gemma 4 und Dinghy Law in LM Studio vor ..."
"$POLICY_NODE_BIN" "$POLICY_SCRIPT_DIR/lmstudio-models.cjs" "${model_args[@]}"

tokenizer_path=""
if [ -f "$POLICY_RUNTIME_DIR/models.json" ]; then
  tokenizer_path="$($POLICY_NODE_BIN -e 'const p=require(process.argv[1]); process.stdout.write(p.tokenizerPath || "")' "$POLICY_RUNTIME_DIR/models.json")"
fi
POLICY_TOKENIZER_PATH="$tokenizer_path" "$POLICY_NODE_BIN" "$POLICY_SCRIPT_DIR/write-config.cjs" >/dev/null
chmod 600 "$POLICY_REPO_DIR/server/.env" "$POLICY_REPO_DIR/collector/.env" "$POLICY_REPO_DIR/frontend/.env"
chmod -R go-rwx "$POLICY_REPO_DIR/server/storage" "$POLICY_REPO_DIR/collector/hotdir"

policy_build_application
policy_log "Bereite deutsche und englische OCR-Sprachdaten vor ..."
"$POLICY_NODE_BIN" "$POLICY_SCRIPT_DIR/prewarm-ocr.cjs"

status_json="$($POLICY_NODE_BIN "$POLICY_SCRIPT_DIR/provision.cjs" status | tail -n 1)"
needs_admin="$($POLICY_NODE_BIN -e 'const s=JSON.parse(process.argv[1]); process.stdout.write(String(s.needsAdminPassword))' "$status_json")"
needs_broker="$($POLICY_NODE_BIN -e 'const s=JSON.parse(process.argv[1]); process.stdout.write(String(s.needsBrokerPassword))' "$status_json")"
admin_password="${POLICY_ADMIN_PASSWORD:-}"
broker_password="${POLICY_BROKER_PASSWORD:-}"

read_new_password() {
  local label="$1"
  local first second
  while true; do
    read -r -s -p "$label (mindestens 8 Zeichen): " first </dev/tty
    printf '\n' >/dev/tty
    read -r -s -p "Passwort wiederholen: " second </dev/tty
    printf '\n' >/dev/tty
    if [ "${#first}" -lt 8 ]; then policy_warn "Das Passwort ist zu kurz."; continue; fi
    if [ "$first" != "$second" ]; then policy_warn "Die Passwörter stimmen nicht überein."; continue; fi
    POLICY_CAPTURED_PASSWORD="$first"
    return
  done
}

if [ "$needs_admin" = true ] && [ -z "$admin_password" ]; then
  [ "$non_interactive" = false ] || policy_die "POLICY_ADMIN_PASSWORD fehlt für den nicht-interaktiven Lauf."
  read_new_password "Neues Admin-Passwort"
  admin_password="$POLICY_CAPTURED_PASSWORD"
fi
if [ "$needs_broker" = true ] && [ -z "$broker_password" ]; then
  [ "$non_interactive" = false ] || policy_die "POLICY_BROKER_PASSWORD fehlt für den nicht-interaktiven Lauf."
  read_new_password "Neues Makler-Passwort"
  broker_password="$POLICY_CAPTURED_PASSWORD"
fi

policy_log "Richte Benutzer und Vergleichs-Workspace ein ..."
POLICY_ADMIN_PASSWORD="$admin_password" \
POLICY_BROKER_PASSWORD="$broker_password" \
POLICY_ADMIN_USERNAME="${POLICY_ADMIN_USERNAME:-admin}" \
POLICY_BROKER_USERNAME="${POLICY_BROKER_USERNAME:-makler}" \
POLICY_CHAT_MODEL_ID="policy-chat" \
  "$POLICY_NODE_BIN" "$POLICY_SCRIPT_DIR/provision.cjs" apply
unset admin_password broker_password POLICY_CAPTURED_PASSWORD POLICY_ADMIN_PASSWORD POLICY_BROKER_PASSWORD

policy_install_services
mkdir -p "$HOME/.local/bin"
control_path="$HOME/.local/bin/polizzenvergleich"
if [ -e "$control_path" ] && ! /usr/bin/grep -q '^# POLIZZENVERGLEICH-INSTALLER-OWNED$' "$control_path" 2>/dev/null; then
  policy_die "$control_path existiert bereits und gehört nicht diesem Produkt."
fi
{
  printf '%s\n' '#!/bin/bash'
  printf '%s\n' '# POLIZZENVERGLEICH-INSTALLER-OWNED'
  printf 'exec /bin/bash %q "$@"\n' "$POLICY_SCRIPT_DIR/control.sh"
} >"$control_path"
chmod 700 "$control_path"

policy_log "Führe die abschließende Systemprüfung aus ..."
if ! /bin/bash "$POLICY_SCRIPT_DIR/doctor.sh"; then
  policy_warn "Die Installation ist gebaut, aber der Doctor-Test ist fehlgeschlagen. Details: $POLICY_LOG_DIR"
  exit 1
fi

/usr/bin/open "$POLICY_APP_URL" >/dev/null 2>&1 || true
policy_ok "Fertig. Oberfläche: $POLICY_APP_URL"
printf '%s\n' "Makler-Benutzer: ${POLICY_BROKER_USERNAME:-makler}"
printf '%s\n' "Admin-Benutzer: ${POLICY_ADMIN_USERNAME:-admin}"
printf '%s\n' "Steuerung: $control_path {status|start|stop|restart|doctor|open|logs}"
