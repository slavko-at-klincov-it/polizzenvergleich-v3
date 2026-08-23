#!/bin/bash

# Reproducible production build and migration. Customer data is backed up
# before Prisma runs; the frontend is swapped only after a successful build.

policy_build_application() {
  policy_export_runtime_path
  export PUPPETEER_SKIP_DOWNLOAD="true"
  policy_log "Sichere die gestoppte Datenbank ..."
  mkdir -p "$POLICY_REPO_DIR/server/storage/backups"
  chmod 700 "$POLICY_REPO_DIR/server/storage/backups"
  if [ -s "$POLICY_REPO_DIR/server/storage/anythingllm.db" ]; then
    local backup_path
    backup_path="$POLICY_REPO_DIR/server/storage/backups/anythingllm-before-install-$(date +%Y%m%d-%H%M%S).db"
    if command -v sqlite3 >/dev/null 2>&1; then
      sqlite3 "$POLICY_REPO_DIR/server/storage/anythingllm.db" ".timeout 5000" ".backup '$backup_path'"
    else
      /bin/cp -p "$POLICY_REPO_DIR/server/storage/anythingllm.db" "$backup_path"
    fi
    chmod 600 "$backup_path"
    POLICY_LAST_DB_BACKUP="$backup_path"
    /bin/ls -1t "$POLICY_REPO_DIR"/server/storage/backups/anythingllm-before-install-*.db 2>/dev/null | \
      /usr/bin/tail -n +6 | while IFS= read -r old_backup; do
        case "$old_backup" in
          "$POLICY_REPO_DIR/server/storage/backups/"anythingllm-before-install-*.db) /bin/rm "$old_backup" ;;
        esac
      done
  fi
  policy_log "Installiere geprüfte Abhängigkeiten ..."
  (cd "$POLICY_REPO_DIR/server" && yarn install --frozen-lockfile --network-timeout 600000)
  (cd "$POLICY_REPO_DIR/collector" && yarn install --frozen-lockfile --network-timeout 600000)
  (cd "$POLICY_REPO_DIR/frontend" && yarn install --frozen-lockfile --network-timeout 600000)

  policy_log "Erzeuge Datenbankclient und führe Migrationen aus ..."
  (cd "$POLICY_REPO_DIR/server" && ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma)
  (cd "$POLICY_REPO_DIR/server" && ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma)

  policy_log "Baue die lokale Oberfläche ..."
  (cd "$POLICY_REPO_DIR/frontend" && yarn build)
  local public_new="$POLICY_REPO_DIR/server/public.new"
  local public_old="$POLICY_REPO_DIR/server/public.previous"
  [ "$public_new" = "$POLICY_REPO_DIR/server/public.new" ] || policy_die "Unsicherer Buildpfad."
  /bin/rm -rf "$public_new"
  mkdir -p "$public_new"
  /usr/bin/ditto "$POLICY_REPO_DIR/frontend/dist" "$public_new"
  /bin/rm -rf "$public_old"
  if [ -d "$POLICY_REPO_DIR/server/public" ]; then
    /bin/mv "$POLICY_REPO_DIR/server/public" "$public_old"
  fi
  /bin/mv "$public_new" "$POLICY_REPO_DIR/server/public"
  policy_ok "Produktions-Build ist bereit."
}

policy_restore_database_backup() {
  [ -n "${POLICY_LAST_DB_BACKUP:-}" ] || return 0
  [ -s "$POLICY_LAST_DB_BACKUP" ] || return 0
  local database="$POLICY_REPO_DIR/server/storage/anythingllm.db"
  [ "$database" = "$POLICY_REPO_DIR/server/storage/anythingllm.db" ] || return 1
  /bin/cp -p "$POLICY_LAST_DB_BACKUP" "$database"
  chmod 600 "$database"
  policy_warn "Die Datenbank wurde aus der Installationssicherung wiederhergestellt."
}
