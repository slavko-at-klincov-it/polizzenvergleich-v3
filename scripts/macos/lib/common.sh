#!/bin/bash

# Shared installer contract: resolve immutable paths, emit consistent status,
# and guard every customer-visible filesystem/service operation.
set -euo pipefail

POLICY_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLICY_REPO_DIR="${POLICY_REPO_DIR:-$(cd "$POLICY_SCRIPT_DIR/../.." && pwd)}"
POLICY_RUNTIME_DIR="${POLICY_RUNTIME_DIR:-$POLICY_REPO_DIR/.runtime}"
POLICY_NODE_VERSION="20.19.5"
POLICY_NODE_SHA256="cfed7503d8d99fbcf2f52e408ec52f616058eb0867b34dbc3437259993ef5cba"
POLICY_NODE_DIR="$POLICY_RUNTIME_DIR/node-v$POLICY_NODE_VERSION"
POLICY_NODE_BIN="$POLICY_NODE_DIR/bin/node"
POLICY_APP_URL="http://127.0.0.1:${POLICY_SERVER_PORT:-3002}"
POLICY_LABEL_PREFIX="at.klincov.polizzenvergleich"
POLICY_LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
POLICY_LOG_DIR="$POLICY_REPO_DIR/server/storage/logs"
POLICY_EXPECTED_REPO="slavko-at-klincov-it/anythingllm-polizzenvergleich"
POLICY_RELEASE_TAG="policy-v0.1.1"
POLICY_INSTALL_LOCK="$POLICY_RUNTIME_DIR/install.lock"

policy_log() { printf '\033[1;34m[Polizzenvergleich]\033[0m %s\n' "$*"; }
policy_ok() { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
policy_warn() { printf '\033[1;33m[Hinweis]\033[0m %s\n' "$*" >&2; }
policy_die() { printf '\033[1;31m[Fehler]\033[0m %s\n' "$*" >&2; exit 1; }

policy_require_command() {
  command -v "$1" >/dev/null 2>&1 || policy_die "Befehl '$1' fehlt. $2"
}

policy_require_macos_arm64() {
  [ "$(uname -s)" = "Darwin" ] || policy_die "Dieser Installer unterstützt nur macOS."
  [ "$(uname -m)" = "arm64" ] || policy_die "Apple Silicon (arm64) ist erforderlich."
}

policy_require_disk_space() {
  local min_kb="${1:-20971520}"
  local available_kb
  available_kb="$(df -Pk "$POLICY_REPO_DIR" | awk 'NR==2 {print $4}')"
  [ "${available_kb:-0}" -ge "$min_kb" ] || policy_die "Mindestens $((min_kb / 1024 / 1024)) GB freier Speicher sind erforderlich."
}

policy_require_memory() {
  if [ "${POLICY_SKIP_HARDWARE_CHECKS:-0}" = "1" ]; then
    policy_warn "Hardwareprüfung wurde nur für den Entwicklungs-/Testlauf übersprungen."
    return
  fi
  local memory_bytes
  memory_bytes="$(/usr/sbin/sysctl -n hw.memsize 2>/dev/null || printf '0')"
  [ "$memory_bytes" -ge 30000000000 ] || policy_die "Dieses Modell-Setup benötigt einen Mac mit mindestens 32 GB gemeinsamem Speicher."
}

policy_require_gui_session() {
  /bin/launchctl print "gui/$UID" >/dev/null 2>&1 || policy_die "Bitte den Installer in einer angemeldeten macOS-Desktop-Sitzung starten."
}

policy_require_port_available() {
  local port="$1"
  [ "${POLICY_SKIP_HARDWARE_CHECKS:-0}" = "1" ] && return 0
  command -v lsof >/dev/null 2>&1 || return 0
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
    local expected_label=""
    [ "$port" = "${POLICY_SERVER_PORT:-3002}" ] && expected_label="server"
    [ "$port" = "${POLICY_COLLECTOR_PORT:-8888}" ] && expected_label="collector"
    if [ -z "$expected_label" ] || ! /bin/launchctl print "gui/$UID/$POLICY_LABEL_PREFIX.$expected_label" >/dev/null 2>&1; then
      policy_die "Port $port wird bereits von einem anderen Programm verwendet."
    fi
  fi
}

policy_random_secret() {
  /usr/bin/openssl rand -hex "${1:-32}"
}

policy_wait_http() {
  local url="$1"
  local attempts="${2:-60}"
  local index=0
  while [ "$index" -lt "$attempts" ]; do
    if /usr/bin/curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then return 0; fi
    index=$((index + 1))
    sleep 1
  done
  return 1
}

policy_escape_xml() {
  printf '%s' "$1" | /usr/bin/sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g' -e "s/'/\&apos;/g"
}

policy_export_runtime_path() {
  [ -x "$POLICY_NODE_BIN" ] || policy_die "Lokale Node-Laufzeit fehlt. Installation erneut starten."
  export PATH="$POLICY_NODE_DIR/bin:$HOME/.lmstudio/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
}

policy_safe_repo_path() {
  [ -f "$POLICY_REPO_DIR/server/index.js" ] || policy_die "Ungültiger Projektpfad: $POLICY_REPO_DIR"
  [ -f "$POLICY_REPO_DIR/collector/index.js" ] || policy_die "Collector fehlt im Projektpfad."
  local origin
  origin="$(git -C "$POLICY_REPO_DIR" remote get-url origin 2>/dev/null || true)"
  if [ "${POLICY_ALLOW_UNVERIFIED_REPO:-0}" != "1" ]; then
    case "$origin" in
      "https://github.com/$POLICY_EXPECTED_REPO.git"|"git@github.com:$POLICY_EXPECTED_REPO.git") ;;
      *) policy_die "Unerwartetes Git-Repository '$origin'. Erwartet: $POLICY_EXPECTED_REPO" ;;
    esac
  fi
}

policy_require_clean_checkout() {
  [ "${POLICY_ALLOW_DIRTY_CHECKOUT:-0}" = "1" ] && return 0
  [ -z "$(git -C "$POLICY_REPO_DIR" status --porcelain --untracked-files=normal)" ] || \
    policy_die "Der Programmcode enthält lokale Änderungen. Bitte einen unveränderten Release-Stand verwenden."
}

policy_require_release_checkout() {
  [ "${POLICY_ALLOW_UNTAGGED_CHECKOUT:-0}" = "1" ] && return 0
  local exact_tag
  exact_tag="$(git -C "$POLICY_REPO_DIR" describe --exact-match --tags HEAD 2>/dev/null || true)"
  [ "$exact_tag" = "$POLICY_RELEASE_TAG" ] || \
    policy_die "Bitte den geprüften Release '$POLICY_RELEASE_TAG' statt eines veränderlichen Branches installieren."
}

policy_acquire_install_lock() {
  mkdir -p "$POLICY_RUNTIME_DIR"
  chmod 700 "$POLICY_RUNTIME_DIR"
  if ! mkdir "$POLICY_INSTALL_LOCK" 2>/dev/null; then
    local old_pid=""
    [ -f "$POLICY_INSTALL_LOCK/pid" ] && old_pid="$(cat "$POLICY_INSTALL_LOCK/pid" 2>/dev/null || true)"
    if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
      policy_die "Eine andere Installation läuft bereits (PID $old_pid)."
    fi
    [ "$POLICY_INSTALL_LOCK" = "$POLICY_RUNTIME_DIR/install.lock" ] || policy_die "Unsicherer Sperrpfad."
    /bin/rm -rf "$POLICY_INSTALL_LOCK"
    mkdir "$POLICY_INSTALL_LOCK" || policy_die "Installationssperre konnte nicht angelegt werden."
  fi
  printf '%s\n' "$$" >"$POLICY_INSTALL_LOCK/pid"
  chmod 700 "$POLICY_INSTALL_LOCK"
}

policy_release_install_lock() {
  [ "$POLICY_INSTALL_LOCK" = "$POLICY_RUNTIME_DIR/install.lock" ] || return 1
  /bin/rm -rf "$POLICY_INSTALL_LOCK"
}

policy_listener_is_loopback_only() {
  local port="$1" listener
  command -v lsof >/dev/null 2>&1 || return 1
  listener="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [ -n "$listener" ] || return 1
  ! printf '%s\n' "$listener" | awk 'NR > 1 {print $9}' | grep -qEv '^(127\.0\.0\.1|\[::1\]):'
}
