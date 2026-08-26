#!/bin/bash
set -euo pipefail

v3_write_service_plist() {
  local label="$1" workdir="$2" program="$3"
  shift 3
  local plist="$V3_LAUNCH_AGENTS_DIR/$label.plist"
  local args_xml="" arg
  for arg in "$@"; do
    args_xml="$args_xml    <string>$(v3_escape_xml "$arg")</string>\n"
  done

  mkdir -p "$V3_LAUNCH_AGENTS_DIR" "$V3_LOG_DIR"
  chmod 700 "$V3_LOG_DIR"
  {
    printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>'
    printf '%s\n' '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
    printf '%s\n' '<plist version="1.0"><dict>'
    printf '  <key>Label</key><string>%s</string>\n' "$(v3_escape_xml "$label")"
    printf '  <key>ProgramArguments</key><array>\n    <string>%s</string>\n%b  </array>\n' "$(v3_escape_xml "$program")" "$args_xml"
    printf '  <key>WorkingDirectory</key><string>%s</string>\n' "$(v3_escape_xml "$workdir")"
    printf '  <key>EnvironmentVariables</key><dict><key>NODE_ENV</key><string>production</string><key>PATH</key><string>%s</string></dict>\n' "$(v3_escape_xml "$V3_NODE_DIR/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin")"
    printf '%s\n' '  <key>RunAtLoad</key><true/>'
    printf '%s\n' '  <key>KeepAlive</key><true/>'
    printf '%s\n' '  <key>ThrottleInterval</key><integer>10</integer>'
    printf '%s\n' '  <key>Umask</key><integer>63</integer>'
    printf '  <key>StandardOutPath</key><string>%s/%s.log</string>\n' "$(v3_escape_xml "$V3_LOG_DIR")" "${label##*.}"
    printf '  <key>StandardErrorPath</key><string>%s/%s-error.log</string>\n' "$(v3_escape_xml "$V3_LOG_DIR")" "${label##*.}"
    printf '%s\n' '</dict></plist>'
  } >"$plist"
  chmod 600 "$plist"
  /usr/bin/plutil -lint "$plist" >/dev/null
}

v3_install_services() {
  v3_export_runtime_path
  v3_write_service_plist \
    "$V3_LABEL_PREFIX.collector" \
    "$V3_REPO_DIR/collector" \
    "$V3_NODE_BIN" \
    "$V3_REPO_DIR/collector/index.js"
  v3_write_service_plist \
    "$V3_LABEL_PREFIX.server" \
    "$V3_REPO_DIR/server" \
    "/bin/bash" \
    "$V3_SCRIPT_DIR/start-server.sh"

  local name plist
  for name in collector server; do
    plist="$V3_LAUNCH_AGENTS_DIR/$V3_LABEL_PREFIX.$name.plist"
    /bin/launchctl bootout "gui/$UID" "$plist" >/dev/null 2>&1 || true
    /bin/launchctl bootstrap "gui/$UID" "$plist"
  done
  v3_ok "V3-Dienste gestartet."
}

v3_stop_services() {
  local name plist
  for name in server collector; do
    plist="$V3_LAUNCH_AGENTS_DIR/$V3_LABEL_PREFIX.$name.plist"
    /bin/launchctl bootout "gui/$UID" "$plist" >/dev/null 2>&1 || true
  done
}

v3_remove_service_definitions() {
  v3_stop_services
  local name plist
  for name in server collector; do
    plist="$V3_LAUNCH_AGENTS_DIR/$V3_LABEL_PREFIX.$name.plist"
    [ ! -f "$plist" ] || /bin/rm "$plist"
  done
}
