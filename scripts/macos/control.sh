#!/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
source "$V3_SCRIPT_DIR/lib/runtime.sh"
source "$V3_SCRIPT_DIR/lib/services.sh"

case "${1:-status}" in
  status)
    for name in collector server; do
      if /bin/launchctl print "gui/$UID/$V3_LABEL_PREFIX.$name" >/dev/null 2>&1; then
        v3_ok "$name läuft"
      else
        v3_warn "$name läuft nicht"
      fi
    done
    ;;
  start)
    v3_acquire_install_lock
    trap 'v3_release_install_lock || true' EXIT
    v3_require_port_available "$V3_SERVER_PORT" server
    v3_require_port_available "$V3_COLLECTOR_PORT" collector
    v3_install_services
    v3_wait_http "$V3_APP_URL/api/ping" 90 || v3_die "Server wurde nicht rechtzeitig erreichbar."
    /usr/bin/open "$V3_APP_URL" >/dev/null 2>&1 || true
    ;;
  stop)
    v3_acquire_install_lock
    trap 'v3_release_install_lock || true' EXIT
    v3_stop_services
    v3_ok "V3-Dienste gestoppt."
    ;;
  restart)
    v3_acquire_install_lock
    trap 'v3_release_install_lock || true' EXIT
    v3_stop_services
    v3_install_services
    v3_wait_http "$V3_APP_URL/api/ping" 90 || v3_die "Server wurde nicht rechtzeitig erreichbar."
    ;;
  doctor) exec /bin/bash "$V3_SCRIPT_DIR/doctor.sh" ;;
  update)
    shift
    exec /bin/bash "$V3_SCRIPT_DIR/update.sh" "$@"
    ;;
  open) /usr/bin/open "$V3_APP_URL" ;;
  logs) /usr/bin/open "$V3_LOG_DIR" ;;
  *) v3_die "Verwendung: polizzenvergleich-v3 {status|start|stop|restart|doctor|update|open|logs}" ;;
esac
