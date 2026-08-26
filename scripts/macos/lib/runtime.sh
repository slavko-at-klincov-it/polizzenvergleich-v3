#!/bin/bash
set -euo pipefail

v3_ensure_node_runtime() {
  if [ -x "$V3_NODE_BIN" ] && [ "$("$V3_NODE_BIN" --version 2>/dev/null || true)" = "v$V3_NODE_VERSION" ]; then
    v3_export_runtime_path
    v3_ok "Node $("$V3_NODE_BIN" --version) ist vorhanden."
    return
  fi

  v3_log "Lade lokale Node-Laufzeit v$V3_NODE_VERSION ..."
  mkdir -p "$V3_RUNTIME_DIR"
  chmod 700 "$V3_RUNTIME_DIR"
  local temp_dir archive actual_sha stage_dir
  temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/polizzenvergleich-v3-node.XXXXXX")"
  archive="$temp_dir/node.tar.gz"
  stage_dir="$V3_RUNTIME_DIR/node-v$V3_NODE_VERSION.staging.$$"
  /usr/bin/curl -fL --retry 3 --connect-timeout 20 \
    "https://nodejs.org/dist/v$V3_NODE_VERSION/node-v$V3_NODE_VERSION-darwin-arm64.tar.gz" \
    -o "$archive"
  actual_sha="$(/usr/bin/shasum -a 256 "$archive" | awk '{print $1}')"
  [ "$actual_sha" = "$V3_NODE_SHA256" ] || {
    /bin/rm -rf "$temp_dir"
    v3_die "Node-Prüfsumme stimmt nicht."
  }
  /bin/rm -rf "$stage_dir"
  mkdir -p "$stage_dir"
  /usr/bin/tar -xzf "$archive" --strip-components=1 -C "$stage_dir"
  /bin/rm -rf "$temp_dir"
  chmod -R go-rwx "$stage_dir"
  [ "$("$stage_dir/bin/node" --version)" = "v$V3_NODE_VERSION" ] || v3_die "Node-Laufzeit ist unvollständig."
  /bin/rm -rf "$V3_NODE_DIR"
  /bin/mv "$stage_dir" "$V3_NODE_DIR"
  v3_export_runtime_path
  v3_ok "Node ist bereit."
}

v3_prepare_yarn() {
  v3_export_runtime_path
  "$V3_NODE_DIR/bin/corepack" enable --install-directory "$V3_NODE_DIR/bin" >/dev/null
  "$V3_NODE_DIR/bin/corepack" prepare yarn@1.22.22 --activate >/dev/null
  [ "$("$V3_NODE_DIR/bin/yarn" --version)" = "1.22.22" ] || v3_die "Yarn 1.22.22 fehlt."
  v3_ok "Yarn 1.22.22 ist bereit."
}
