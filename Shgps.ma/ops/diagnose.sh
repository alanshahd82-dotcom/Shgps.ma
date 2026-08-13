#!/usr/bin/env bash
# ATHAR GPS — full production diagnosis
#
# Run on the server:
#   cd /opt/shgps && bash ops/diagnose.sh
#
# Optional:
#   BASE_URL=https://athargps.com bash ops/diagnose.sh

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR" || exit 1

BASE_URL="${BASE_URL:-https://athargps.com}"
BASE_URL="${BASE_URL%/}"
HOST="$(printf '%s' "$BASE_URL" | sed -E 's#^[a-zA-Z]+://##; s#/.*$##')"
TMP_DIR="$(mktemp -d /tmp/athargps-diagnose.XXXXXX)"
FAILURES=0
WARNINGS=0
CHECKS=0

if [ -t 1 ]; then
  GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
  BLUE='\033[0;34m'; RESET='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; BLUE=''; RESET=''
fi

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

ok() {
  CHECKS=$((CHECKS + 1))
  printf "%b[OK]%b   %s\n" "$GREEN" "$RESET" "$*"
}

warn() {
  CHECKS=$((CHECKS + 1))
  WARNINGS=$((WARNINGS + 1))
  printf "%b[WARN]%b %s\n" "$YELLOW" "$RESET" "$*"
}

fail() {
  CHECKS=$((CHECKS + 1))
  FAILURES=$((FAILURES + 1))
  printf "%b[FAIL]%b %s\n" "$RED" "$RESET" "$*"
}

section() {
  printf "\n%b== %s ==%b\n" "$BLUE" "$*" "$RESET"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

container_running() {
  local name="$1"
  docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null | grep -qx running
}

container_health() {
  local name="$1"
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$name" 2>/dev/null
}

http_check() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"
  local body="${4:-$TMP_DIR/body}"
  local headers="$TMP_DIR/headers"
  local code

  if ! code="$(curl -kLsS --connect-timeout 8 --max-time 20 \
    -D "$headers" -o "$body" -w '%{http_code}' "$url" 2>/dev/null)"; then
    code="000"
  fi
  if [ "$code" = "$expected" ]; then
    ok "$label — HTTP $code"
    return 0
  fi
  fail "$label — expected HTTP $expected, received $code ($url)"
  if [ -s "$body" ]; then
    printf "       Response: %s\n" "$(head -c 240 "$body" | tr '\n' ' ')"
  fi
  return 1
}

json_health_check() {
  local label="$1"
  local body="$2"
  if command_exists node; then
    node - "$body" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
try {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const good = data.status === "ok" && data.db === "connected" && data.traccar === "reachable";
  if (!good) {
    console.error(JSON.stringify(data));
    process.exit(1);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
NODE
    if [ "$?" -eq 0 ]; then
      ok "$label — db connected, Traccar reachable"
      return 0
    fi
  fi
  fail "$label — health response is degraded or invalid"
  printf "       Response: %s\n" "$(head -c 300 "$body" | tr '\n' ' ')"
  return 1
}

printf "%bATHAR GPS full system diagnosis%b\n" "$BLUE" "$RESET"
printf "Time: %s\nRoot: %s\nPublic URL: %s\nHost: %s\n" \
  "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$ROOT_DIR" "$BASE_URL" "$HOST"

section "Basic prerequisites"
for command in docker curl sed grep awk timeout; do
  if command_exists "$command"; then
    ok "Command available: $command"
  else
    fail "Required command missing: $command"
  fi
done

if [ -f "$ROOT_DIR/.env" ]; then
  ok ".env exists"
else
  fail ".env is missing — Docker Compose may not have required secrets"
fi

if [ -f "$ROOT_DIR/docker-compose.yml" ]; then
  ok "docker-compose.yml exists"
else
  fail "docker-compose.yml is missing"
fi

section "Docker Compose configuration"
if command_exists docker; then
  if docker info >/dev/null 2>&1; then
    ok "Docker daemon is reachable"
  else
    fail "Docker daemon is not reachable"
  fi

  compose_config="$TMP_DIR/compose-config"
  if docker compose config --quiet >/dev/null 2>"$compose_config"; then
    ok "Docker Compose configuration is valid"
  else
    fail "Docker Compose configuration is invalid"
    sed -n '1,12p' "$compose_config" | sed 's/[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd][^ ]*/PASSWORD_REDACTED/g'
  fi
else
  fail "Cannot inspect Docker because docker is unavailable"
fi

section "Containers"
docker compose ps 2>/dev/null || true
for service in postgres traccar backend nginx certbot db-backup; do
  case "$service" in
    postgres) name="shgps-postgres-1" ;;
    traccar) name="shgps-traccar-1" ;;
    backend) name="shgps-backend-1" ;;
    nginx) name="shgps-nginx-1" ;;
    certbot) name="shgps-certbot-1" ;;
    db-backup) name="shgps-backup-1" ;;
  esac

  if ! docker inspect "$name" >/dev/null 2>&1; then
    fail "$service container does not exist ($name)"
    continue
  fi
  if ! container_running "$name"; then
    fail "$service container is not running ($name)"
    continue
  fi

  health="$(container_health "$name")"
  case "$health" in
    healthy) ok "$service is running and healthy" ;;
    starting) warn "$service is running but health is still starting" ;;
    unhealthy) fail "$service is running but unhealthy" ;;
    no-healthcheck) ok "$service is running (no Docker healthcheck configured)" ;;
    *) warn "$service is running with health state: ${health:-unknown}" ;;
  esac
done

section "Internal service checks"
if container_running shgps-postgres-1; then
  if docker compose exec -T postgres pg_isready -U shgps -d shgps >/dev/null 2>&1; then
    ok "PostgreSQL accepts connections"
  else
    fail "PostgreSQL does not accept connections"
  fi
fi

if container_running shgps-backend-1; then
  backend_health="$TMP_DIR/backend-health"
  if docker compose exec -T backend node -e '
    fetch("http://127.0.0.1:3001/api/health")
      .then(async r => { process.stdout.write(await r.text()); process.exit(r.ok ? 0 : 1) })
      .catch(() => process.exit(1))
  ' >"$backend_health" 2>/dev/null; then
    json_health_check "Backend internal health" "$backend_health"
  else
    fail "Backend internal health endpoint is unavailable"
  fi
fi

if container_running shgps-nginx-1; then
  if docker compose exec -T nginx nginx -t >/dev/null 2>"$TMP_DIR/nginx-test"; then
    ok "Nginx configuration is valid"
  else
    fail "Nginx configuration test failed"
    sed -n '1,16p' "$TMP_DIR/nginx-test"
  fi
fi

section "Network ports"
if command_exists ss; then
  for port in 80 443 5023 5027 5029 5055; do
    if ss -ltn "( sport = :$port )" 2>/dev/null | grep -q ":$port"; then
      ok "TCP port $port is listening"
    else
      warn "TCP port $port is not listening (check firewall/device protocol needs)"
    fi
  done
else
  warn "ss is unavailable — skipped host port checks"
fi

section "Public HTTPS and application checks"
http_check "HTTPS home page" "$BASE_URL/" 200
public_health_body="$TMP_DIR/public-health"
if http_check "API health endpoint" "$BASE_URL/api/health" 200 "$public_health_body"; then
  json_health_check "Public API health contents" "$public_health_body"
fi
http_check "Manifest" "$BASE_URL/manifest.json" 200
http_check "Service worker" "$BASE_URL/sw.js" 200
http_check "Root favicon" "$BASE_URL/favicon.ico" 200
http_check "Current ATHAR favicon" "$BASE_URL/athar-gps-favicon.png" 200
http_check "Main PNG icon" "$BASE_URL/icon-192.png" 200

if command_exists curl; then
  if ! redirect_code="$(curl -ksS -o /dev/null -w '%{http_code}' --connect-timeout 8 --max-time 15 "http://$HOST/" 2>/dev/null)"; then
    redirect_code="000"
  fi
  redirect_url="$(curl -ksS -o /dev/null -w '%{redirect_url}' --connect-timeout 8 --max-time 15 "http://$HOST/" 2>/dev/null || true)"
  if [ "$redirect_code" = "301" ] && printf '%s' "$redirect_url" | grep -q '^https://'; then
    ok "HTTP redirects to HTTPS"
  else
    warn "HTTP redirect check returned $redirect_code -> ${redirect_url:-no redirect}"
  fi
fi

section "TLS certificate"
if command_exists openssl; then
  cert_file="$TMP_DIR/public-cert.pem"
  if timeout 15 openssl s_client -connect "$HOST:443" -servername "$HOST" </dev/null 2>/dev/null |
      openssl x509 -out "$cert_file" 2>/dev/null; then
    cert_end="$(openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | sed 's/^notAfter=//')"
  else
    cert_end=""
  fi
  if [ -n "$cert_end" ] && [ -s "$cert_file" ]; then
    if openssl x509 -in "$cert_file" -checkend $((30 * 86400)) -noout >/dev/null 2>&1; then
      ok "TLS certificate is valid for at least 30 days (expires: $cert_end)"
    else
      warn "TLS certificate expires within 30 days ($cert_end)"
    fi
  else
    fail "Could not read the public TLS certificate"
  fi
else
  warn "openssl is unavailable — skipped TLS certificate check"
fi

section "Backups and disk"
if container_running shgps-backup-1; then
  backup_count="$(docker compose exec -T db-backup sh -c 'ls -1 /backups/*.sql.gz 2>/dev/null | wc -l' 2>/dev/null | tr -d '[:space:]')"
  backup_count="${backup_count:-0}"
  if [ "$backup_count" -gt 0 ] 2>/dev/null; then
    ok "Database backups available: $backup_count"
  else
    warn "No database backup files found yet"
  fi
fi

if command_exists df; then
  disk_line="$(df -P "$ROOT_DIR" | tail -n 1)"
  disk_use="$(printf '%s\n' "$disk_line" | awk '{print $5}' | tr -d '%')"
  if [ "${disk_use:-0}" -ge 90 ] 2>/dev/null; then
    fail "Disk usage is ${disk_use}% — immediate cleanup recommended"
  elif [ "${disk_use:-0}" -ge 80 ] 2>/dev/null; then
    warn "Disk usage is ${disk_use}%"
  else
    ok "Disk usage is ${disk_use}%"
  fi
fi

section "Recent errors"
if command_exists docker; then
  errors="$(
    docker compose logs --since=30m --no-color backend nginx traccar postgres 2>/dev/null |
      grep -Ei 'error|fatal| panic|uncaught|exception|failed|unhealthy|502|503' |
      tail -n 20 || true
  )"
  if [ -n "$errors" ]; then
    warn "Recent suspicious log lines found (last 20):"
    printf '%s\n' "$errors" | sed 's/[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd][=:][^ ]*/PASSWORD_REDACTED/g'
  else
    ok "No matching error lines in the last 30 minutes"
  fi
fi

section "Summary"
printf "Checks: %d | %bFailures: %d%b | %bWarnings: %d%b\n" \
  "$CHECKS" "$RED" "$FAILURES" "$RESET" "$YELLOW" "$WARNINGS" "$RESET"

if [ "$FAILURES" -gt 0 ]; then
  printf "%bDiagnosis: system has failures that need attention.%b\n" "$RED" "$RESET"
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  printf "%bDiagnosis: critical services passed, but review the warnings above.%b\n" "$YELLOW" "$RESET"
  exit 2
else
  printf "%bDiagnosis: all checks passed.%b\n" "$GREEN" "$RESET"
  exit 0
fi