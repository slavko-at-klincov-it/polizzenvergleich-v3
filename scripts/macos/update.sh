#!/bin/bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
source "$V3_SCRIPT_DIR/lib/runtime.sh"
source "$V3_SCRIPT_DIR/lib/build.sh"
source "$V3_SCRIPT_DIR/lib/services.sh"

v3_log "Prüfe sicheren V3-Updatepfad ..."
v3_safe_repo_path
v3_require_clean_checkout
v3_require_macos_arm64
v3_require_gui_session
v3_acquire_install_lock
old_sha="$(git -C "$V3_REPO_DIR" rev-parse HEAD)"
services_were_running=false
v3_service_is_running server && services_were_running=true
activation_attempted=false
trap 'status=$?; if [ "$status" -ne 0 ]; then v3_stop_services || true; if [ "$activation_attempted" = true ]; then v3_restore_activation || true; fi; git -C "$V3_REPO_DIR" checkout --detach "$old_sha" >/dev/null 2>&1 || true; if [ "$services_were_running" = true ]; then v3_install_services || true; fi; fi; v3_release_install_lock || true; exit "$status"' EXIT

git -C "$V3_REPO_DIR" fetch --prune origin "$V3_UPDATE_BRANCH" --tags
target_tag="${1:-$(git -C "$V3_REPO_DIR" tag --list 'v3.*' --sort=-v:refname | head -n 1)}"
[ -n "$target_tag" ] || v3_die "Kein veröffentlichter V3-Release-Tag gefunden."
git -C "$V3_REPO_DIR" rev-parse -q --verify "$target_tag^{tag}" >/dev/null ||
  v3_die "$target_tag ist kein annotierter Release-Tag."
v3_remote_release_tag_matches "$target_tag" ||
  v3_die "$target_tag stimmt nicht exakt mit dem veröffentlichten origin-Tag überein."
target_sha="$(git -C "$V3_REPO_DIR" rev-parse "$target_tag^{commit}")"
git -C "$V3_REPO_DIR" merge-base --is-ancestor "$target_sha" "origin/$V3_UPDATE_BRANCH" ||
  v3_die "$target_tag gehört nicht zum veröffentlichten main-Stand."
git -C "$V3_REPO_DIR" merge-base --is-ancestor "$old_sha" "$target_sha" ||
  v3_die "Release $target_tag ist kein vorwärts gerichtetes Update."

if [ "$old_sha" = "$target_sha" ]; then
  /bin/bash "$V3_SCRIPT_DIR/doctor.sh"
  v3_ok "V3 ist bereits auf $target_tag."
  exit 0
fi

v3_stop_services
git -C "$V3_REPO_DIR" checkout --detach "$target_tag"

# Das Update kann auch diese Installerfunktionen geändert haben.
source "$V3_SCRIPT_DIR/lib/common.sh"
source "$V3_SCRIPT_DIR/lib/runtime.sh"
source "$V3_SCRIPT_DIR/lib/build.sh"
source "$V3_SCRIPT_DIR/lib/services.sh"
v3_require_clean_checkout
v3_ensure_node_runtime
v3_prepare_yarn
V3_REPO_DIR="$V3_REPO_DIR" \
  V3_SERVER_PORT="$V3_SERVER_PORT" \
  V3_COLLECTOR_PORT="$V3_COLLECTOR_PORT" \
  "$V3_NODE_BIN" "$V3_SCRIPT_DIR/write-config.cjs" >/dev/null
chmod 600 "$V3_REPO_DIR/server/.env" "$V3_REPO_DIR/collector/.env" "$V3_REPO_DIR/frontend/.env"
v3_prepare_application
activation_attempted=true
v3_activate_application
v3_install_services
/bin/bash "$V3_SCRIPT_DIR/doctor.sh"
v3_ok "Update auf $target_tag abgeschlossen."
