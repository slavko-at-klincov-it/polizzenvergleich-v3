#!/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
source "$V3_SCRIPT_DIR/lib/services.sh"

v3_acquire_install_lock
trap 'v3_release_install_lock || true' EXIT
v3_remove_service_definitions
control="$HOME/.local/bin/polizzenvergleich-v3"
if [ -f "$control" ] && /usr/bin/grep -q '^# POLIZZENVERGLEICH-V3-INSTALLER-OWNED$' "$control"; then
  /bin/rm "$control"
fi
v3_ok "V3-Dienste und CLI wurden entfernt."
