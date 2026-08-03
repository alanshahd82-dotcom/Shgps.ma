#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ensure-traccar-admin.sh
#
# Idempotent bootstrap script for the Traccar admin account.
# Run this after a fresh deploy or whenever the traccar_data volume is wiped.
#
# Usage (from /opt/shgps):
#   bash scripts/ensure-traccar-admin.sh
#
# Requirements: docker, docker compose, python3
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$(dirname "$SCRIPT_DIR")"

# Load credentials from .env
if [[ -f "$COMPOSE_DIR/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$COMPOSE_DIR/.env"; set +a
fi

EMAIL="${TRACCAR_ADMIN_EMAIL:-admin@athargps.com}"
PASSWORD="${TRACCAR_ADMIN_PASSWORD:?TRACCAR_ADMIN_PASSWORD must be set in .env}"
TRACCAR_CONTAINER="shgps-traccar-1"
BACKEND_CONTAINER="shgps-backend-1"

# ── Helper: run H2 SQL via docker compose run ─────────────────────────────────
run_h2_sql() {
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" run --rm --entrypoint "" traccar \
    /opt/traccar/jre/bin/java -cp /opt/traccar/tracker-server.jar \
    org.h2.tools.Shell \
    -url "jdbc:h2:/opt/traccar/data/database" \
    -user sa -password "" \
    -sql "$1"
}

echo "=== Traccar Admin Bootstrap ==="
echo "  Email   : $EMAIL"
echo "  Compose : $COMPOSE_DIR"
echo ""

# ── 1. Stop Traccar so we can safely modify the H2 DB ─────────────────────────
echo "[1/6] Stopping Traccar..."
docker compose -f "$COMPOSE_DIR/docker-compose.yml" stop traccar

# ── 2. Check whether admin already exists ─────────────────────────────────────
echo "[2/6] Checking for existing admin user..."
EXISTING=$(run_h2_sql \
  "SELECT COUNT(*) FROM tc_users WHERE email='$EMAIL';" \
  2>/dev/null | grep -E '^[0-9]' | tr -d ' ' || echo "0")

if [[ "$EXISTING" -gt 0 ]]; then
  echo "  ✔ Admin user $EMAIL already exists — skipping creation."
  echo "[3/6] Ensuring administrator flag is set..."
  run_h2_sql "UPDATE tc_users SET administrator=TRUE, devicelimit=-1, userlimit=-1 WHERE email='$EMAIL';" > /dev/null
else
  # ── 3. Enable registration so the API accepts POST /api/users without auth ──
  echo "[3/6] Enabling registration in tc_servers..."
  run_h2_sql "UPDATE tc_servers SET registration=TRUE;" > /dev/null

  # ── 4. Start Traccar and wait for it to be ready ──────────────────────────
  echo "[4/6] Starting Traccar (waiting up to 60s)..."
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" start traccar
  for i in $(seq 1 12); do
    sleep 5
    if docker exec "$TRACCAR_CONTAINER" bash -c 'echo > /dev/tcp/localhost/8082' 2>/dev/null; then
      echo "  ✔ Traccar is ready (${i}x5s)"
      break
    fi
    echo "  ... waiting (${i}/12)"
  done

  # ── 5. Create user via API (Traccar hashes the password correctly) ─────────
  echo "[5/6] Creating admin user via Traccar API..."
  RESPONSE=$(docker exec "$BACKEND_CONTAINER" node -e "
    (async () => {
      const r = await fetch('http://traccar:8082/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Admin', email: '$EMAIL', password: '$PASSWORD' })
      });
      const t = await r.text();
      process.stdout.write('STATUS:' + r.status + ' ' + t.slice(0, 200));
    })();
  " 2>/dev/null)
  echo "  Response: $RESPONSE"

  if ! echo "$RESPONSE" | grep -q 'STATUS:200'; then
    echo "  ✗ User creation failed — see response above."
    exit 1
  fi

  # ── 6. Stop Traccar, promote user to admin, disable registration ─────────
  echo "[6/6] Promoting to admin and disabling registration..."
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" stop traccar
  run_h2_sql "
    UPDATE tc_users SET administrator=TRUE, devicelimit=-1, userlimit=-1 WHERE email='$EMAIL';
    UPDATE tc_servers SET registration=FALSE;
  " > /dev/null
  echo "  ✔ Done."
fi

# ── Final: start Traccar and restart backend ──────────────────────────────────
echo ""
echo "Starting Traccar..."
docker compose -f "$COMPOSE_DIR/docker-compose.yml" start traccar
sleep 30

echo "Testing session..."
docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec backend node -e "
  (async () => {
    const r = await fetch('http://traccar:8082/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=' + encodeURIComponent('$EMAIL') + '&password=' + encodeURIComponent('$PASSWORD')
    });
    console.log('Session:', r.status, r.status === 200 ? '✔ SUCCESS' : '✗ FAIL');
  })();
"

echo ""
echo "=== Bootstrap complete. Run 'docker compose restart backend' to reconnect. ==="
