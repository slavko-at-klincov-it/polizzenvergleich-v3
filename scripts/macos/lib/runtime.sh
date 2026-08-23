#!/bin/bash

# Installs a pinned, checksum-verified Node runtime inside the application.
# No Homebrew, sudo, shell-profile mutation, or global package is required.

policy_ensure_node_runtime() {
  if [ -x "$POLICY_NODE_BIN" ] && [ "$($POLICY_NODE_BIN --version 2>/dev/null || true)" = "v$POLICY_NODE_VERSION" ]; then
    policy_ok "Node $($POLICY_NODE_BIN --version) ist vorhanden."
    policy_export_runtime_path
    return
  fi

  policy_log "Lade die lokale Node-Laufzeit v$POLICY_NODE_VERSION ..."
  mkdir -p "$POLICY_RUNTIME_DIR"
  chmod 700 "$POLICY_RUNTIME_DIR"
  local temp_dir archive actual_sha stage_dir
  temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/polizzen-node.XXXXXX")"
  archive="$temp_dir/node.tar.gz"
  stage_dir="$POLICY_RUNTIME_DIR/node-v$POLICY_NODE_VERSION.staging.$$"

  /usr/bin/curl -fL --retry 3 --connect-timeout 20 \
    "https://nodejs.org/dist/v$POLICY_NODE_VERSION/node-v$POLICY_NODE_VERSION-darwin-arm64.tar.gz" \
    -o "$archive"
  actual_sha="$(/usr/bin/shasum -a 256 "$archive" | awk '{print $1}')"
  [ "$actual_sha" = "$POLICY_NODE_SHA256" ] || {
    rm -rf "$temp_dir"
    policy_die "Node-Prüfsumme stimmt nicht; Download wurde verworfen."
  }

  [ "$stage_dir" = "$POLICY_RUNTIME_DIR/node-v$POLICY_NODE_VERSION.staging.$$" ] || policy_die "Unsicherer Runtime-Stagingpfad."
  /bin/rm -rf "$stage_dir"
  mkdir -p "$stage_dir"
  /usr/bin/tar -xzf "$archive" --strip-components=1 -C "$stage_dir"
  rm -rf "$temp_dir"
  chmod -R go-rwx "$stage_dir"
  [ "$("$stage_dir/bin/node" --version 2>/dev/null || true)" = "v$POLICY_NODE_VERSION" ] || {
    /bin/rm -rf "$stage_dir"
    policy_die "Die geladene Node-Laufzeit ist unvollständig."
  }
  [ "$POLICY_NODE_DIR" = "$POLICY_RUNTIME_DIR/node-v$POLICY_NODE_VERSION" ] || policy_die "Unsicherer Runtime-Zielpfad."
  /bin/rm -rf "$POLICY_NODE_DIR"
  /bin/mv "$stage_dir" "$POLICY_NODE_DIR"
  policy_export_runtime_path
  policy_ok "Node $($POLICY_NODE_BIN --version) wurde lokal installiert."
}

policy_prepare_yarn() {
  policy_export_runtime_path
  local corepack_bin="$POLICY_NODE_DIR/bin/corepack"
  local yarn_bin="$POLICY_NODE_DIR/bin/yarn"
  local yarn_version

  [ -x "$corepack_bin" ] || policy_die "Corepack fehlt in der lokalen Node-Laufzeit."
  "$corepack_bin" enable --install-directory "$POLICY_NODE_DIR/bin" >/dev/null || \
    policy_die "Der lokale Yarn-Starter konnte nicht eingerichtet werden."
  "$corepack_bin" prepare yarn@1.22.22 --activate >/dev/null || \
    policy_die "Yarn 1.22.22 konnte nicht lokal vorbereitet werden."
  [ -x "$yarn_bin" ] || policy_die "Der lokale Yarn-Starter fehlt nach der Einrichtung."
  yarn_version="$("$yarn_bin" --version 2>/dev/null)" || \
    policy_die "Die lokale Yarn-Laufzeit konnte nicht gestartet werden."
  [ "$yarn_version" = "1.22.22" ] || \
    policy_die "Unerwartete Yarn-Version '$yarn_version'; erwartet wird 1.22.22."
  policy_ok "Yarn $yarn_version ist bereit."
}
