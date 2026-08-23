#!/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
source "$POLICY_SCRIPT_DIR/lib/runtime.sh"
source "$POLICY_SCRIPT_DIR/lib/build.sh"
source "$POLICY_SCRIPT_DIR/lib/services.sh"

command_name="${1:-status}"
case "$command_name" in
  status)
    if /bin/launchctl print "gui/$UID/$POLICY_LABEL_PREFIX.server" >/dev/null 2>&1; then policy_ok "Server läuft"; else policy_warn "Server läuft nicht"; fi
    if /bin/launchctl print "gui/$UID/$POLICY_LABEL_PREFIX.collector" >/dev/null 2>&1; then policy_ok "Collector läuft"; else policy_warn "Collector läuft nicht"; fi
    if /bin/launchctl print "gui/$UID/$POLICY_LABEL_PREFIX.models" >/dev/null 2>&1; then policy_ok "Modell-Startjob vorhanden"; else policy_warn "Modell-Startjob fehlt"; fi
    ;;
  start)
    policy_acquire_install_lock
    trap 'policy_release_install_lock || true' EXIT
    policy_install_services
    ;;
  stop)
    policy_acquire_install_lock
    trap 'policy_release_install_lock || true' EXIT
    policy_stop_services
    policy_ok "Dienste gestoppt; Kundendaten bleiben erhalten."
    ;;
  restart)
    policy_acquire_install_lock
    trap 'policy_release_install_lock || true' EXIT
    policy_stop_services
    policy_install_services
    ;;
  doctor)
    exec /bin/bash "$POLICY_SCRIPT_DIR/doctor.sh"
    ;;
  open)
    /usr/bin/open "$POLICY_APP_URL"
    ;;
  logs)
    /usr/bin/open "$POLICY_LOG_DIR"
    ;;
  *)
    policy_die "Verwendung: polizzenvergleich {status|start|stop|restart|doctor|open|logs}. Updates werden nur als geprüfter Release installiert."
    ;;
esac
