#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# disk-monitor.sh  (#35 — Prevent GPS data loss when disk is full)
#
# Checks disk usage and takes protective action before Traccar loses data:
#   ≥ 80%: warning log
#   ≥ 90%: prune old Postgres backups + Docker unused images/containers
#   ≥ 95%: emergency — stop GPS data ingestion gracefully until space freed
#
# Add to crontab (root):
#   */5 * * * * /opt/shgps/scripts/disk-monitor.sh >> /var/log/shgps-disk.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_DIR="/opt/shgps"
BACKUP_DIR="/var/lib/docker/volumes/shgps_backups_data/_data"
LOG_TAG="[disk-monitor]"
WARN_PCT=80
PRUNE_PCT=90
EMERGENCY_PCT=95

# ── Get disk usage for the filesystem hosting /opt ───────────────────────────
DISK_PCT=$(df --output=pcent /opt | tail -1 | tr -d ' %')

TS=$(date '+%Y-%m-%d %H:%M:%S')
echo "$TS $LOG_TAG Disk usage: ${DISK_PCT}%"

# ── Warning ───────────────────────────────────────────────────────────────────
if [[ "$DISK_PCT" -lt "$WARN_PCT" ]]; then
  echo "$TS $LOG_TAG OK — no action needed."
  exit 0
fi

echo "$TS $LOG_TAG WARNING: disk at ${DISK_PCT}%"

# ── Prune backups and Docker artifacts at ≥ 90% ──────────────────────────────
if [[ "$DISK_PCT" -ge "$PRUNE_PCT" ]]; then
  echo "$TS $LOG_TAG Pruning old database backups (keeping last 3)..."
  if [[ -d "$BACKUP_DIR" ]]; then
    ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +4 | xargs -r rm -f
    echo "$TS $LOG_TAG Backup pruning done."
  fi

  echo "$TS $LOG_TAG Pruning unused Docker resources..."
  docker system prune -f --volumes=false 2>&1 | grep -v "^$" | while read -r line; do
    echo "$TS $LOG_TAG   docker: $line"
  done
fi

# ── Emergency: stop GPS ingestion at ≥ 95% ───────────────────────────────────
if [[ "$DISK_PCT" -ge "$EMERGENCY_PCT" ]]; then
  echo "$TS $LOG_TAG EMERGENCY: disk at ${DISK_PCT}% — stopping Traccar to protect H2 DB integrity."
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" stop traccar 2>&1 | while read -r line; do
    echo "$TS $LOG_TAG   $line"
  done
  echo "$TS $LOG_TAG Traccar stopped. Free disk space and run:"
  echo "$TS $LOG_TAG   docker compose -f $COMPOSE_DIR/docker-compose.yml start traccar"
  # Optional: send alert via webhook
  # WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
  # [[ -n "$WEBHOOK_URL" ]] && curl -sf -X POST "$WEBHOOK_URL" \
  #   -H 'Content-Type: application/json' \
  #   -d "{\"text\":\"⚠ DISK FULL on $(hostname): ${DISK_PCT}% — Traccar stopped\"}" || true
fi
