#!/bin/bash
set -euo pipefail

V3_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
V3_REPO_DIR="${V3_REPO_DIR:-$(cd "$V3_SCRIPT_DIR/../.." && pwd)}"
V3_RUNTIME_DIR="${V3_RUNTIME_DIR:-$V3_REPO_DIR/.runtime}"
V3_NODE_VERSION="22.23.2"
V3_RELEASE_VERSION="3.6.0"
V3_NODE_SHA256="61130f394c1630d211dd50aecc4353d379480f36d3ac913cd85dbba1aed585c6"
V3_NODE_DIR="$V3_RUNTIME_DIR/node-v$V3_NODE_VERSION"
V3_NODE_BIN="$V3_NODE_DIR/bin/node"
V3_SERVER_PORT="${V3_SERVER_PORT:-3004}"
V3_COLLECTOR_PORT="${V3_COLLECTOR_PORT:-8890}"
V3_APP_URL="http://127.0.0.1:$V3_SERVER_PORT"
V3_LABEL_PREFIX="at.klincov.polizzenvergleich-v3"
V3_LAUNCH_AGENTS_DIR="${V3_LAUNCH_AGENTS_DIR:-$HOME/Library/LaunchAgents}"
V3_LOG_DIR="$V3_REPO_DIR/server/storage/logs"
V3_EXPECTED_REPO="slavko-at-klincov-it/polizzenvergleich-v3"
V3_UPDATE_BRANCH="main"
V3_INSTALL_LOCK="$V3_RUNTIME_DIR/install.lock"

v3_log() { printf '\033[1;34m[V3]\033[0m %s\n' "$*"; }
v3_ok() { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
v3_warn() { printf '\033[1;33m[Hinweis]\033[0m %s\n' "$*" >&2; }
v3_die() { printf '\033[1;31m[Fehler]\033[0m %s\n' "$*" >&2; exit 1; }

v3_require_command() {
  command -v "$1" >/dev/null 2>&1 || v3_die "Befehl '$1' fehlt. ${2:-}"
}

v3_require_macos_arm64() {
  [ "$(uname -s)" = "Darwin" ] || v3_die "Dieser Installer unterstützt nur macOS."
  [ "$(uname -m)" = "arm64" ] || v3_die "Apple Silicon (arm64) ist erforderlich."
}

v3_require_gui_session() {
  /bin/launchctl print "gui/$UID" >/dev/null 2>&1 || v3_die "Bitte in einer angemeldeten macOS-Sitzung starten."
}

v3_export_runtime_path() {
  [ -x "$V3_NODE_BIN" ] || v3_die "Lokale Node-Laufzeit fehlt. install.command erneut starten."
  export PATH="$V3_NODE_DIR/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
}

v3_safe_repo_path() {
  [ -f "$V3_REPO_DIR/server/index.js" ] || v3_die "Ungültiger Projektpfad: $V3_REPO_DIR"
  [ -f "$V3_REPO_DIR/collector/index.js" ] || v3_die "Collector fehlt im Projektpfad."
  local origin
  origin="$(git -C "$V3_REPO_DIR" remote get-url origin 2>/dev/null || true)"
  case "$origin" in
    "https://github.com/$V3_EXPECTED_REPO.git"|"git@github.com:$V3_EXPECTED_REPO.git") ;;
    *) v3_die "Unerwartetes origin '$origin'. Erwartet: https://github.com/$V3_EXPECTED_REPO.git" ;;
  esac
}

v3_require_clean_checkout() {
  [ -z "$(git -C "$V3_REPO_DIR" status --porcelain --untracked-files=normal)" ] ||
    v3_die "Lokale Codeänderungen erkannt. Bitte zuerst sichern oder entfernen."
}

v3_release_checkout_matches() {
  local expected_tag="v$V3_RELEASE_VERSION" tag_sha current_sha
  [ -z "$(git -C "$V3_REPO_DIR" status --porcelain --untracked-files=normal 2>/dev/null)" ] ||
    return 1
  git -C "$V3_REPO_DIR" rev-parse -q --verify "$expected_tag^{tag}" >/dev/null 2>&1 ||
    return 1
  tag_sha="$(git -C "$V3_REPO_DIR" rev-parse "$expected_tag^{commit}" 2>/dev/null)" ||
    return 1
  current_sha="$(git -C "$V3_REPO_DIR" rev-parse HEAD 2>/dev/null)" || return 1
  [ "$tag_sha" = "$current_sha" ] || return 1
  git -C "$V3_REPO_DIR" rev-parse -q --verify "origin/$V3_UPDATE_BRANCH^{commit}" >/dev/null 2>&1 ||
    return 1
  git -C "$V3_REPO_DIR" merge-base --is-ancestor \
    "$tag_sha" "origin/$V3_UPDATE_BRANCH" >/dev/null 2>&1
}

v3_remote_release_tag_matches() {
  local expected_tag="${1:-v$V3_RELEASE_VERSION}"
  local tag_ref="refs/tags/$expected_tag" local_tag_sha local_commit_sha
  local remote_refs remote_tag_sha remote_commit_sha
  local_tag_sha="$(git -C "$V3_REPO_DIR" rev-parse "$tag_ref" 2>/dev/null)" ||
    return 1
  local_commit_sha="$(git -C "$V3_REPO_DIR" rev-parse "$tag_ref^{commit}" 2>/dev/null)" ||
    return 1
  remote_refs="$(git -C "$V3_REPO_DIR" ls-remote --exit-code origin \
    "$tag_ref" "$tag_ref^{}" 2>/dev/null)" || return 1
  remote_tag_sha="$(printf '%s\n' "$remote_refs" | /usr/bin/awk -v ref="$tag_ref" '$2 == ref { print $1 }')"
  remote_commit_sha="$(printf '%s\n' "$remote_refs" | /usr/bin/awk -v ref="$tag_ref^{}" '$2 == ref { print $1 }')"
  [ -n "$remote_tag_sha" ] && [ -n "$remote_commit_sha" ] &&
    [ "$remote_tag_sha" = "$local_tag_sha" ] &&
    [ "$remote_commit_sha" = "$local_commit_sha" ]
}

v3_require_port_available() {
  local port="$1" service="$2"
  command -v lsof >/dev/null 2>&1 || return 0
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | /usr/bin/grep -q LISTEN; then
    /bin/launchctl print "gui/$UID/$V3_LABEL_PREFIX.$service" >/dev/null 2>&1 ||
      v3_die "Port $port wird bereits von einem anderen Programm verwendet."
  fi
}

v3_service_is_running() {
  /bin/launchctl print "gui/$UID/$V3_LABEL_PREFIX.$1" >/dev/null 2>&1
}

v3_wait_http() {
  local url="$1" attempts="${2:-60}" index=0
  while [ "$index" -lt "$attempts" ]; do
    /usr/bin/curl -fsS --max-time 3 "$url" >/dev/null 2>&1 && return 0
    index=$((index + 1))
    sleep 1
  done
  return 1
}

v3_escape_xml() {
  printf '%s' "$1" | /usr/bin/sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g' -e "s/'/\&apos;/g"
}

v3_acquire_install_lock() {
  mkdir -p "$V3_RUNTIME_DIR"
  chmod 700 "$V3_RUNTIME_DIR"
  if ! mkdir "$V3_INSTALL_LOCK" 2>/dev/null; then
    local old_pid=""
    [ -f "$V3_INSTALL_LOCK/pid" ] && old_pid="$(/bin/cat "$V3_INSTALL_LOCK/pid" 2>/dev/null || true)"
    if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
      v3_die "Installation oder Update läuft bereits (PID $old_pid)."
    fi
    [ "$V3_INSTALL_LOCK" = "$V3_RUNTIME_DIR/install.lock" ] || v3_die "Unsicherer Sperrpfad."
    /bin/rm -rf "$V3_INSTALL_LOCK"
    mkdir "$V3_INSTALL_LOCK"
  fi
  printf '%s\n' "$$" >"$V3_INSTALL_LOCK/pid"
  chmod 700 "$V3_INSTALL_LOCK"
}

v3_release_install_lock() {
  [ "$V3_INSTALL_LOCK" = "$V3_RUNTIME_DIR/install.lock" ] && /bin/rm -rf "$V3_INSTALL_LOCK"
}

v3_listener_is_loopback_only() {
  local names
  names="$(/usr/sbin/lsof -nP -a -iTCP:"$1" -sTCP:LISTEN -F n 2>/dev/null | /usr/bin/grep '^n' || true)"
  [ -n "$names" ] || return 1
  ! printf '%s\n' "$names" | /usr/bin/grep -qEv '^n(127\.0\.0\.1|\[::1\]):[0-9]+$'
}
