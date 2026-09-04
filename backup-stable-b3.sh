#!/usr/bin/env bash
# ============================================================================
# PostgreSQL Stable-B3 Backup Script
# Tag: athargps-stable-2026-09-04-b3
# Commit: 98bdfb0fb196554072d8fbe57ff3c54a0ee135d2
#
# Purpose:  Create and verify a PostgreSQL backup of the production shgps
#           database. READ-ONLY — does not modify database data, does not
#           restart or recreate any Docker container, does not deploy.
#
# Container: shgps-postgres-1
# Database:  shgps
# User:      shgps
# Method:    pg_dump | gzip  (same as existing db-backup service)
#
# Safety:
#   - Does NOT delete any existing backups.
#   - Does NOT restart or recreate any Docker container.
#   - Does NOT modify database data.
#   - Does NOT deploy anything.
# ============================================================================

set -euo pipefail

BACKUP_DIR="/opt/shgps/backups"
BACKUP_FILE="shgps_stable_b3_$(date +%Y%m%d_%H%M%S).sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# ── Helpers ──────────────────────────────────────────────────────────────────
log()  { echo -e "\033[32m[$(date -u +%H:%M:%S)]\033[0m $*"; }
err()  { echo -e "\033[31m[$(date -u +%H:%M:%S)] ERROR:\033[0m $*" >&2; }

# ── Step 1: Verify postgres container is running ─────────────────────────────
log "=== Step 1: Verify postgres container ==="
PG_STATUS=$(docker inspect -f '{{.State.Status}}' shgps-postgres-1 2>/dev/null || echo "missing")
if [ "$PG_STATUS" != "running" ]; then
  err "shgps-postgres-1 is not running (status=$PG_STATUS) — cannot backup"
  exit 1
fi
log "  shgps-postgres-1: running"

# Record container created timestamp (verify we don't restart it)
PG_CTR=$(docker compose ps -q postgres 2>/dev/null || docker inspect -f '{{.Id}}' shgps-postgres-1)
PG_CREATED_BEFORE=$(docker inspect -f '{{.Created}}' shgps-postgres-1 2>/dev/null || echo "unknown")
log "  container: $PG_CTR"
log "  created:   $PG_CREATED_BEFORE"

# ── Step 2: Create backup directory (idempotent, does not touch existing) ────
log "=== Step 2: Prepare backup directory ==="
mkdir -p "$BACKUP_DIR"
log "  Backup directory: $BACKUP_DIR"
log "  Existing backups preserved: $(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l | tr -d ' ') files"

# ── Step 3: Create PostgreSQL backup (READ-ONLY pg_dump) ─────────────────────
log "=== Step 3: Create PostgreSQL backup ==="
log "  Database: shgps"
log "  User:     shgps"
log "  File:     $BACKUP_FILE"

# pg_dump is read-only — does not modify database data.
# docker exec does NOT restart or recreate the container.
# gzip runs on the host; the pipe streams the dump directly to disk.
docker exec shgps-postgres-1 pg_dump -U shgps -d shgps | gzip > "$BACKUP_PATH"

# Verify the backup file was created and is non-empty
if [ ! -f "$BACKUP_PATH" ]; then
  err "Backup file was not created: $BACKUP_PATH"
  exit 1
fi

BACKUP_BYTES=$(stat -c%s "$BACKUP_PATH")
if [ "$BACKUP_BYTES" -lt 100 ]; then
  err "Backup file is suspiciously small ($BACKUP_BYTES bytes) — possible failure"
  exit 1
fi
log "  Backup created: $BACKUP_BYTES bytes"

# ── Step 4: Verify gzip integrity ─────────────────────────────────────────────
log "=== Step 4: Verify gzip integrity ==="
if gzip -t "$BACKUP_PATH" 2>/dev/null; then
  INTEGRITY="PASS"
  log "  gzip -t: PASS"
else
  INTEGRITY="FAIL"
  err "gzip -t: FAIL — backup is corrupt"
  exit 1
fi

# ── Step 5: Spot-check backup content ─────────────────────────────────────────
log "=== Step 5: Spot-check backup content ==="

FILE_TYPE=$(file "$BACKUP_PATH")
log "  File type: $FILE_TYPE"

CREATE_TABLE_COUNT=$(gunzip -c "$BACKUP_PATH" | grep -c "CREATE TABLE" || true)
log "  CREATE TABLE statements: $CREATE_TABLE_COUNT"

COPY_PRESENT=$(gunzip -c "$BACKUP_PATH" | grep -q "COPY " && echo "yes" || echo "no")
log "  COPY statements: $COPY_PRESENT"

if [ "$CREATE_TABLE_COUNT" -lt 5 ] || [ "$COPY_PRESENT" != "yes" ]; then
  err "Backup content spot-check FAILED (CREATE TABLE=$CREATE_TABLE_COUNT, COPY=$COPY_PRESENT)"
  exit 1
fi
log "  Content spot-check: PASS"

# ── Step 6: Verify postgres container was NOT restarted ──────────────────────
log "=== Step 6: Verify postgres container untouched ==="
PG_CREATED_AFTER=$(docker inspect -f '{{.Created}}' shgps-postgres-1 2>/dev/null || echo "unknown")
PG_CTR_AFTER=$(docker compose ps -q postgres 2>/dev/null || docker inspect -f '{{.Id}}' shgps-postgres-1)

if [ "$PG_CREATED_BEFORE" = "$PG_CREATED_AFTER" ] && [ "$PG_CTR" = "$PG_CTR_AFTER" ]; then
  log "  postgres container: SAME (not restarted/recreated) ✓"
else
  err "  postgres container CHANGED — UNEXPECTED!"
  err "  before: $PG_CTR created=$PG_CREATED_BEFORE"
  err "  after:  $PG_CTR_AFTER created=$PG_CREATED_AFTER"
  exit 1
fi

# ── Summary ──────────────────────────────────────────────────────────────────
BACKUP_HUMAN=$(du -h "$BACKUP_PATH" | cut -f1)

log ""
log "==================== BACKUP COMPLETE ===================="
log "Tag:           athargps-stable-2026-09-04-b3"
log "Commit:        98bdfb0fb196554072d8fbe57ff3c54a0ee135d2"
log ""
log "Backup file:   $BACKUP_FILE"
log "Backup path:   $BACKUP_PATH"
log "Backup size:   $BACKUP_HUMAN"
log "Backup bytes:  $BACKUP_BYTES"
log "Integrity:     $INTEGRITY (gzip -t)"
log "CREATE TABLE:  $CREATE_TABLE_COUNT"
log "COPY:          $COPY_PRESENT"
log ""
log "Postgres:       NOT MODIFIED (same container, not restarted)"
log "Existing backups: preserved (not deleted)"
log "========================================================="
