#!/usr/bin/env bash
# ATHAR GPS Health Monitor — runs every 5 minutes via cron
# Setup: crontab -e
#   */5 * * * * /opt/shgps/ops/monitor.sh >> /var/log/athargps-monitor.log 2>&1

set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://localhost:3001/api/health}"
LOG_FILE="/var/log/athargps-monitor.log"
ALERT_EMAIL="${ALERT_EMAIL:-}"
MAX_LOG_LINES=5000
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Rotate log if too large
if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt "$MAX_LOG_LINES" ]; then
  tail -n 2000 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

# Perform health check
HTTP_CODE=$(curl -s -o /tmp/athargps_health_response.json -w "%{http_code}" --connect-timeout 5 --max-time 10 "$HEALTH_URL" || echo "000")
RESPONSE=$(cat /tmp/athargps_health_response.json 2>/dev/null || echo '{}')

if [ "$HTTP_CODE" = "200" ]; then
  STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "unknown")
  DB=$(echo "$RESPONSE" | grep -o '"db":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "unknown")
  TRACCAR=$(echo "$RESPONSE" | grep -o '"traccar":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "unknown")
  echo "[$TIMESTAMP] OK — status=$STATUS db=$DB traccar=$TRACCAR"
else
  echo "[$TIMESTAMP] ERROR — HTTP $HTTP_CODE — Service may be down!"
  # Send email alert if configured
  if [ -n "$ALERT_EMAIL" ]; then
    echo "ATHAR GPS health check failed at $TIMESTAMP (HTTP $HTTP_CODE)" | \
      mail -s "[ATHAR GPS] Service DOWN — $(hostname)" "$ALERT_EMAIL" 2>/dev/null || true
  fi
fi

rm -f /tmp/athargps_health_response.json
