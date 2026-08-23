#!/bin/bash

# User-scoped launchd services. Secrets stay in chmod-600 dotenv files and are
# never copied into the plist. Umask 077 protects all newly created runtime data.

policy_write_service_plist() {
  local label="$1"
  local workdir="$2"
  local program="$3"
  shift 3
  local plist="$POLICY_LAUNCH_AGENTS_DIR/$label.plist"
  local args_xml=""
  local arg
  for arg in "$@"; do
    args_xml="$args_xml    <string>$(policy_escape_xml "$arg")</string>\n"
  done
  mkdir -p "$POLICY_LAUNCH_AGENTS_DIR" "$POLICY_LOG_DIR"
  chmod 700 "$POLICY_LOG_DIR"
  {
    printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>'
    printf '%s\n' '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
    printf '%s\n' '<plist version="1.0"><dict>'
    printf '  <key>Label</key><string>%s</string>\n' "$(policy_escape_xml "$label")"
    printf '  <key>ProgramArguments</key><array>\n    <string>%s</string>\n%b  </array>\n' "$(policy_escape_xml "$program")" "$args_xml"
    printf '  <key>WorkingDirectory</key><string>%s</string>\n' "$(policy_escape_xml "$workdir")"
    printf '%s\n' '  <key>EnvironmentVariables</key><dict>'
    printf '    <key>NODE_ENV</key><string>production</string>\n'
    printf '    <key>PATH</key><string>%s</string>\n' "$(policy_escape_xml "$POLICY_NODE_DIR/bin:$HOME/.lmstudio/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin")"
    printf '%s\n' '  </dict>'
    printf '%s\n' '  <key>RunAtLoad</key><true/>'
    if [ "$label" = "$POLICY_LABEL_PREFIX.models" ]; then
      printf '%s\n' '  <key>KeepAlive</key><false/>'
    else
      printf '%s\n' '  <key>KeepAlive</key><true/>'
    fi
    printf '%s\n' '  <key>ThrottleInterval</key><integer>10</integer>'
    printf '%s\n' '  <key>Umask</key><integer>63</integer>'
    printf '  <key>StandardOutPath</key><string>%s/%s.log</string>\n' "$(policy_escape_xml "$POLICY_LOG_DIR")" "$(policy_escape_xml "${label##*.}")"
    printf '  <key>StandardErrorPath</key><string>%s/%s-error.log</string>\n' "$(policy_escape_xml "$POLICY_LOG_DIR")" "$(policy_escape_xml "${label##*.}")"
    printf '%s\n' '</dict></plist>'
  } >"$plist"
  chmod 600 "$plist"
  /usr/bin/plutil -lint "$plist" >/dev/null
}

policy_install_services() {
  policy_export_runtime_path
  policy_write_service_plist "$POLICY_LABEL_PREFIX.models" "$POLICY_REPO_DIR" \
    "/bin/bash" "$POLICY_SCRIPT_DIR/start-models.sh"
  policy_write_service_plist "$POLICY_LABEL_PREFIX.collector" "$POLICY_REPO_DIR/collector" \
    "$POLICY_NODE_BIN" "$POLICY_REPO_DIR/collector/index.js"
  policy_write_service_plist "$POLICY_LABEL_PREFIX.server" "$POLICY_REPO_DIR/server" \
    "/bin/bash" "$POLICY_SCRIPT_DIR/start-server.sh"

  local label plist
  for label in models collector server; do
    plist="$POLICY_LAUNCH_AGENTS_DIR/$POLICY_LABEL_PREFIX.$label.plist"
    /bin/launchctl bootout "gui/$UID" "$plist" >/dev/null 2>&1 || true
    /bin/launchctl bootstrap "gui/$UID" "$plist"
  done
  policy_ok "Autostart-Dienste wurden eingerichtet."
}

policy_services_running() {
  /bin/launchctl print "gui/$UID/$POLICY_LABEL_PREFIX.server" >/dev/null 2>&1 || \
    /bin/launchctl print "gui/$UID/$POLICY_LABEL_PREFIX.collector" >/dev/null 2>&1 || \
    /bin/launchctl print "gui/$UID/$POLICY_LABEL_PREFIX.models" >/dev/null 2>&1
}

policy_stop_services() {
  local label plist
  for label in server collector models; do
    plist="$POLICY_LAUNCH_AGENTS_DIR/$POLICY_LABEL_PREFIX.$label.plist"
    /bin/launchctl bootout "gui/$UID" "$plist" >/dev/null 2>&1 || true
  done
}

policy_remove_service_definitions() {
  policy_stop_services
  local label plist
  for label in models collector server; do
    plist="$POLICY_LAUNCH_AGENTS_DIR/$POLICY_LABEL_PREFIX.$label.plist"
    [ -f "$plist" ] && /bin/rm "$plist"
  done
}
