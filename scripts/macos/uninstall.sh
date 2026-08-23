#!/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
source "$POLICY_SCRIPT_DIR/lib/services.sh"

policy_acquire_install_lock
trap 'policy_release_install_lock || true' EXIT
policy_remove_service_definitions
control_path="$HOME/.local/bin/polizzenvergleich"
if [ -f "$control_path" ] && /usr/bin/grep -q '^# POLIZZENVERGLEICH-INSTALLER-OWNED$' "$control_path"; then
  /bin/rm "$control_path"
fi
policy_ok "Dienste und Starter wurden entfernt."
printf '%s\n' "Kundendaten und Programmdateien wurden bewusst NICHT gelöscht:"
printf '%s\n' "$POLICY_REPO_DIR/server/storage"
