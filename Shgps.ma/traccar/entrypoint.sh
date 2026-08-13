#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Traccar custom entrypoint
#
# Purpose: clear any stale H2 lock file left by an unclean JVM shutdown before
# starting Traccar. Without this, a crash/OOM-kill leaves a .lock.db file and
# the next container start fails with:
#   "org.h2.jdbc.JdbcSQLNonTransientConnectionException: database.mv.db is locked"
# ─────────────────────────────────────────────────────────────────────────────
set -e

DATA_DIR="/opt/traccar/data"
LOCK_FILE="$DATA_DIR/database.lock.db"

if [ -f "$LOCK_FILE" ]; then
  echo "[entrypoint] WARNING: stale H2 lock file found — removing before startup"
  rm -f "$LOCK_FILE"
  echo "[entrypoint] Lock file removed successfully"
fi

echo "[entrypoint] Starting Traccar..."
exec /opt/traccar/jre/bin/java \
  -jar /opt/traccar/tracker-server.jar \
  /opt/traccar/conf/traccar.xml
