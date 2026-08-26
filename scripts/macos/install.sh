#!/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
source "$V3_SCRIPT_DIR/lib/runtime.sh"
source "$V3_SCRIPT_DIR/lib/build.sh"
source "$V3_SCRIPT_DIR/lib/services.sh"

for argument in "$@"; do
  case "$argument" in
    --help|-h)
      printf '%s\n' 'Verwendung: ./install.command'
      exit 0
      ;;
    *) v3_die "Unbekannte Option: $argument" ;;
  esac
done

v3_log "Prüfe Mac und V3-Repository ..."
[ "$V3_SERVER_PORT" = "3004" ] || v3_die "V3 verwendet fest Port 3004."
[ "$V3_COLLECTOR_PORT" = "8890" ] || v3_die "V3 verwendet fest Port 8890."
v3_safe_repo_path
v3_require_clean_checkout
v3_require_macos_arm64
v3_require_gui_session
v3_require_command git
v3_require_command curl
v3_require_command openssl
v3_acquire_install_lock
services_were_running=false
v3_service_is_running server && services_were_running=true
activation_attempted=false
trap 'status=$?; if [ "$status" -ne 0 ]; then v3_stop_services || true; if [ "$activation_attempted" = true ]; then v3_restore_activation || true; fi; if [ "$services_were_running" = true ]; then v3_install_services || true; fi; fi; v3_release_install_lock || true; exit "$status"' EXIT

if [ "$services_were_running" = false ]; then
  v3_require_port_available "$V3_SERVER_PORT" server
  v3_require_port_available "$V3_COLLECTOR_PORT" collector
fi
v3_ensure_node_runtime
v3_prepare_yarn
V3_REPO_DIR="$V3_REPO_DIR" \
  V3_SERVER_PORT="$V3_SERVER_PORT" \
  V3_COLLECTOR_PORT="$V3_COLLECTOR_PORT" \
  "$V3_NODE_BIN" "$V3_SCRIPT_DIR/write-config.cjs" >/dev/null
chmod 600 "$V3_REPO_DIR/server/.env" "$V3_REPO_DIR/collector/.env" "$V3_REPO_DIR/frontend/.env"
v3_prepare_application
v3_stop_services
v3_require_port_available "$V3_SERVER_PORT" server
v3_require_port_available "$V3_COLLECTOR_PORT" collector
activation_attempted=true
v3_activate_application
v3_install_services

mkdir -p "$HOME/.local/bin"
control="$HOME/.local/bin/polizzenvergleich-v3"
if [ -e "$control" ] && ! /usr/bin/grep -q '^# POLIZZENVERGLEICH-V3-INSTALLER-OWNED$' "$control"; then
  v3_die "$control gehört nicht dem V3-Installer."
fi
{
  printf '%s\n' '#!/bin/bash' '# POLIZZENVERGLEICH-V3-INSTALLER-OWNED'
  printf 'exec /bin/bash %q "$@"\n' "$V3_SCRIPT_DIR/control.sh"
} >"$control"
chmod 700 "$control"

/bin/bash "$V3_SCRIPT_DIR/doctor.sh"
/usr/bin/open "$V3_APP_URL" >/dev/null 2>&1 || true
v3_ok "Installiert: $V3_APP_URL"
