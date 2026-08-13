#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-"$ROOT_DIR/backend/.env"}"
BACKUP_DIR="${BACKUP_DIR:-"$ROOT_DIR/backups"}"
KEEP="${KEEP:-7}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing database environment file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${DATABASE_URL:?DATABASE_URL is required in backend/.env}"
mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%d_%H%M%S)"
output="$BACKUP_DIR/shgps_${timestamp}.sql.gz"
temporary="${output}.tmp"

cleanup() { rm -f "$temporary"; }
trap cleanup EXIT

echo "[backup] Dumping database to $output"
pg_dump "$DATABASE_URL" | gzip -9 > "$temporary"
mv "$temporary" "$output"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'shgps_*.sql.gz' -printf '%T@ %p\n' |
  sort -rn |
  awk -v keep="$KEEP" 'NR > keep { sub(/^[^ ]+ /, ""); print }' |
  xargs -r rm -f

echo "[backup] Complete; retained latest $KEEP backups"