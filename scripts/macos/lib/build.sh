#!/bin/bash
set -euo pipefail

V3_DB_BACKUP_PATH=""
V3_DB_WAS_ABSENT="false"
V3_PUBLIC_WAS_ABSENT="false"

v3_prepare_application() {
  v3_export_runtime_path
  export PUPPETEER_SKIP_DOWNLOAD=true
  export NODE_ENV=development

  v3_log "Installiere Abhängigkeiten ..."
  (cd "$V3_REPO_DIR/server" && yarn install --frozen-lockfile --production=false --network-timeout 600000)
  (cd "$V3_REPO_DIR/collector" && yarn install --frozen-lockfile --production=false --network-timeout 600000)
  (cd "$V3_REPO_DIR/frontend" && yarn install --frozen-lockfile --production=false --network-timeout 600000)

  v3_log "Prisma-Client und Oberfläche vorbereiten ..."
  (cd "$V3_REPO_DIR/server" && ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma)
  (cd "$V3_REPO_DIR/frontend" && yarn build)
  local public_new="$V3_REPO_DIR/server/public.new"
  /bin/rm -rf "$public_new"
  mkdir -p "$public_new"
  /usr/bin/ditto "$V3_REPO_DIR/frontend/dist" "$public_new"
  [ -f "$public_new/_index.html" ] || v3_die "Frontend-Build enthält keine _index.html."
  v3_ok "Build ist vorbereitet."
}

v3_backup_database() {
  local database="$V3_REPO_DIR/server/storage/anythingllm.db"
  mkdir -p "$V3_REPO_DIR/server/storage/backups"
  chmod 700 "$V3_REPO_DIR/server/storage" "$V3_REPO_DIR/server/storage/backups"
  if [ ! -s "$database" ]; then
    V3_DB_WAS_ABSENT="true"
    return
  fi

  V3_DB_BACKUP_PATH="$V3_REPO_DIR/server/storage/backups/anythingllm-before-activation-$(date +%Y%m%d-%H%M%S).db"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$database" ".timeout 5000" ".backup '$V3_DB_BACKUP_PATH'"
  else
    /bin/cp -p "$database" "$V3_DB_BACKUP_PATH"
  fi
  chmod 600 "$V3_DB_BACKUP_PATH"
}

v3_activate_application() {
  v3_export_runtime_path
  export NODE_ENV=production
  v3_backup_database
  v3_log "Aktiviere Datenbankmigration ..."
  (cd "$V3_REPO_DIR/server" && ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma)
  (cd "$V3_REPO_DIR/server" && ./node_modules/.bin/prisma db seed)

  local public_new="$V3_REPO_DIR/server/public.new"
  local public_old="$V3_REPO_DIR/server/public.previous"
  [ -f "$public_new/_index.html" ] || v3_die "Vorbereiteter Frontend-Build fehlt."
  /bin/rm -rf "$public_old"
  if [ -d "$V3_REPO_DIR/server/public" ]; then
    /bin/mv "$V3_REPO_DIR/server/public" "$public_old"
  else
    V3_PUBLIC_WAS_ABSENT="true"
  fi
  /bin/mv "$public_new" "$V3_REPO_DIR/server/public"
  v3_ok "Produktions-Build ist aktiv."
}

v3_restore_activation() {
  local database="$V3_REPO_DIR/server/storage/anythingllm.db"
  local public_old="$V3_REPO_DIR/server/public.previous"

  if [ -n "$V3_DB_BACKUP_PATH" ] && [ -f "$V3_DB_BACKUP_PATH" ]; then
    /bin/cp -p "$V3_DB_BACKUP_PATH" "$database"
    chmod 600 "$database"
  elif [ "$V3_DB_WAS_ABSENT" = "true" ] && [ -f "$database" ]; then
    /bin/rm "$database"
  fi

  if [ -d "$public_old" ]; then
    /bin/rm -rf "$V3_REPO_DIR/server/public"
    /bin/mv "$public_old" "$V3_REPO_DIR/server/public"
  elif [ "$V3_PUBLIC_WAS_ABSENT" = "true" ]; then
    /bin/rm -rf "$V3_REPO_DIR/server/public"
  fi
}
