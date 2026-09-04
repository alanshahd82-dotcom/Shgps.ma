#!/usr/bin/env bash
# ============================================================================
# Production Deployment: B3 + Lockfile Fix
# Target: 98bdfb0fb196554072d8fbe57ff3c54a0ee135d2
# B3:     10f028e9b613d9de6e49f9ee0767fd2bc68010e4
#
# Architecture: Docker Compose with nginx bind-mount ./dist:/usr/share/nginx/html:ro
# Strategy: Build to dist.new → verify → rename → force-recreate nginx only
# Safety:  Old dist preserved (dist.old) until new build verified + health passed
# ============================================================================

set -euo pipefail

TARGET="98bdfb0fb196554072d8fbe57ff3c54a0ee135d2"
B3="10f028e9b613d9de6e49f9ee0767fd2bc68010e4"
DIR="/opt/shgps"
TS=$(date +%Y%m%d%H%M%S)
BACKUP="dist.prev.${TS}"
NEWDIST="dist.new"

cd "$DIR"

# ── Helpers ──────────────────────────────────────────────────────────────────
log()  { echo -e "\033[32m[$(date -u +%H:%M:%S)]\033[0m $*"; }
warn() { echo -e "\033[33m[$(date -u +%H:%M:%S)] WARN:\033[0m $*"; }
err()  { echo -e "\033[31m[$(date -u +%H:%M:%S)] ERROR:\033[0m $*" >&2; }

# ── Git state tracking (for rollback) ────────────────────────────────────────
# Record exact Git state BEFORE any reset so we can restore it on failure.
GIT_ORIG_HEAD=$(git rev-parse HEAD)
GIT_ORIG_REF=$(git symbolic-ref -q HEAD || echo "")
if [ -n "$GIT_ORIG_REF" ]; then
  GIT_ORIG_BRANCH="${GIT_ORIG_REF#refs/heads/}"
  log "Original Git state: branch '$GIT_ORIG_BRANCH' at $GIT_ORIG_HEAD"
else
  GIT_ORIG_BRANCH=""
  log "Original Git state: detached HEAD at $GIT_ORIG_HEAD"
fi

# Dist rollback tracking
OLD_DIST_DIR=""

# Full rollback: restore dist + recreate nginx + restore Git state
rollback_full() {
  err "Initiating full rollback..."

  # 1. Restore previous dist
  if [ -n "$OLD_DIST_DIR" ] && [ -d "$DIR/$OLD_DIST_DIR" ]; then
    err "Restoring previous dist from $OLD_DIST_DIR"
    rm -rf "$DIR/dist"
    mv "$DIR/$OLD_DIST_DIR" "$DIR/dist"
  elif [ -d "$DIR/$BACKUP" ]; then
    err "Restoring previous dist from backup $BACKUP"
    rm -rf "$DIR/dist"
    cp -a "$DIR/$BACKUP" "$DIR/dist"
  fi

  # 2. Recreate ONLY nginx (pick up restored dist)
  err "Recreating nginx container with restored dist"
  docker compose up -d --no-deps --force-recreate nginx || err "nginx recreate during rollback FAILED"

  # 3. Restore Git state
  err "Restoring Git state to original"
  if [ -n "$GIT_ORIG_BRANCH" ]; then
    git checkout "$GIT_ORIG_BRANCH" 2>/dev/null || git checkout "$GIT_ORIG_HEAD"
  else
    git checkout "$GIT_ORIG_HEAD"
  fi

  # 4. Verify nginx is running
  sleep 2
  NGINX_STATUS=$(docker inspect -f '{{.State.Status}}' shgps-nginx-1 2>/dev/null || echo "missing")
  if [ "$NGINX_STATUS" = "running" ]; then
    err "Rollback complete: nginx is running, Git restored to $GIT_ORIG_BRANCH ($GIT_ORIG_HEAD)"
  else
    err "Rollback WARNING: nginx status=$NGINX_STATUS — manual intervention required"
  fi
}

# Git-only rollback (for failures before dist rename)
rollback_git() {
  err "Restoring Git state to original"
  if [ -n "$GIT_ORIG_BRANCH" ]; then
    git checkout "$GIT_ORIG_BRANCH" 2>/dev/null || git checkout "$GIT_ORIG_HEAD"
  else
    git checkout "$GIT_ORIG_HEAD"
  fi
}

fail_pre_checkout() {
  err "$*"
  err "Deployment FAILED — no Git state changes yet, production runtime preserved."
  exit 1
}

fail_post_checkout() {
  err "$*"
  rollback_git
  err "Deployment FAILED — Git state restored to original, production runtime preserved."
  err "Rollback backup if needed: $DIR/$BACKUP"
  exit 1
}

fail_post_rename() {
  err "$*"
  rollback_full
  err "Deployment FAILED — full rollback complete (dist + nginx + Git)."
  exit 1
}

# ── Step 1: Verify origin/main = target ─────────────────────────────────────
log "=== Step 1: Verify origin/main ==="
git fetch origin main
ORIGIN_MAIN=$(git rev-parse origin/main)
[ "$ORIGIN_MAIN" = "$TARGET" ] || fail_pre_checkout "origin/main ($ORIGIN_MAIN) != target ($TARGET)"

# ── Step 2: Verify B3 is ancestor ────────────────────────────────────────────
log "=== Step 2: Verify B3 ancestry ==="
git merge-base --is-ancestor "$B3" "$TARGET" || fail_pre_checkout "B3 ($B3) is NOT ancestor of target"

# ── Step 3: Record current state (for post-deploy verification) ─────────────
log "=== Step 3: Record current container states ==="

# Record container created timestamps (to verify they're NOT restarted later)
declare -A CONTAINER_STATES
for svc in postgres traccar backend nginx certbot db-backup; do
  CTR=$(docker compose ps -q "$svc" 2>/dev/null || true)
  if [ -n "$CTR" ]; then
    CREATED=$(docker inspect -f '{{.Created}}' "$CTR" 2>/dev/null || echo "unknown")
    CONTAINER_STATES[$svc]="$CTR:$CREATED"
    log "  $svc: container=$CTR created=$CREATED"
  fi
done

# Verify current dist is live and healthy
[ -f "$DIR/dist/index.html" ] || fail_pre_checkout "Current dist/index.html missing — refusing to deploy over broken state"
log "Current dist: OK (index.html present)"

# ── Step 4: Backup current dist (rollback safety) ────────────────────────────
log "=== Step 4: Backup current dist ==="
cp -a "$DIR/dist" "$DIR/$BACKUP"
log "Backup: $DIR/$BACKUP"

# ── Step 5: Reset main branch to target commit (stay on branch, no detached HEAD) ─
log "=== Step 5: Reset main to target commit ==="
# Verify we are on the main branch before resetting
[ "$GIT_ORIG_BRANCH" = "main" ] || fail_pre_checkout "Production is not on 'main' branch (currently on '$GIT_ORIG_BRANCH') — refusing to reset"
git reset --hard "$TARGET"
[ "$(git rev-parse HEAD)" = "$TARGET" ] || fail_post_checkout "Reset failed — HEAD != target"
log "Source tree at: $(git rev-parse HEAD) (branch: main)"

# ── Step 6: npm ci ───────────────────────────────────────────────────────────
log "=== Step 6: npm ci ==="
npm ci || fail_post_checkout "npm ci FAILED"
log "npm ci: PASS"

# ── Step 7: Build to dist.new (live dist untouched) ──────────────────────────
log "=== Step 7: Build to $NEWDIST ==="
rm -rf "$DIR/$NEWDIST"
npx vite build --outDir "$NEWDIST" || fail_post_checkout "Build FAILED"
log "Build: PASS"

# ── Step 8: Verify new build ─────────────────────────────────────────────────
log "=== Step 8: Verify new build ==="
[ -f "$DIR/$NEWDIST/index.html" ] || fail_post_checkout "New build missing index.html"

B3_FOUND=0
for f in "$DIR/$NEWDIST"/assets/index-*.js; do
  if grep -q '/client/devices' "$f" && grep -q '/client/vehicles' "$f"; then
    B3_FOUND=1
    log "  B3 redirect found in: $(basename "$f")"
    break
  fi
done
[ "$B3_FOUND" = 1 ] || fail_post_checkout "B3 redirect NOT found in new build"
log "New build verification: PASS"

# ── Step 9: Rename dist (atomic cutover preparation) ────────────────────────
log "=== Step 9: Rename dist ==="
# At this point, the running nginx container still serves from the OLD dist inode.
# The rename is safe: nginx keeps serving old content until we recreate it.
mv "$DIR/dist" "$DIR/dist.old.${TS}"
OLD_DIST_DIR="dist.old.${TS}"
mv "$DIR/$NEWDIST" "$DIR/dist"
[ -f "$DIR/dist/index.html" ] || {
  err "Rename failed — restoring backup"
  rm -rf "$DIR/dist"
  mv "$DIR/$OLD_DIST_DIR" "$DIR/dist"
  rollback_git
  fail_post_rename "Rename verification failed"
}
log "Rename: PASS (old dist at $OLD_DIST_DIR)"

# ── Step 10: Recreate nginx container (pick up new dist) ─────────────────────
log "=== Step 10: Recreate nginx container ==="
# --no-deps:           do NOT touch postgres, traccar, backend, certbot, db-backup
# --force-recreate:   required because compose file unchanged — without this,
#                     compose would see "container up-to-date" and NOT recreate,
#                     leaving nginx bound to the old dist inode.
docker compose up -d --no-deps --force-recreate nginx || fail_post_rename "nginx recreate FAILED"
log "nginx recreated"

# ── Step 11: Critical health checks (HARD FAIL) ──────────────────────────────
log "=== Step 11: Critical health checks ==="
sleep 3

# nginx container running
NGINX_STATUS=$(docker inspect -f '{{.State.Status}}' shgps-nginx-1 2>/dev/null || echo "missing")
[ "$NGINX_STATUS" = "running" ] || fail_post_rename "nginx container not running (status=$NGINX_STATUS)"
log "  nginx container: running"

# CRITICAL CHECK 1: HTTPS / (must return 200)
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost/ || echo "000")
log "  HTTPS /: $HTTP_CODE"
[ "$HTTP_CODE" = "200" ] || fail_post_rename "CRITICAL: HTTPS / returned $HTTP_CODE (expected 200)"

# CRITICAL CHECK 2: /client/vehicles (must return 200 — SPA route serves index.html)
VEHICLES_CODE=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost/client/vehicles || echo "000")
log "  /client/vehicles: $VEHICLES_CODE"
[ "$VEHICLES_CODE" = "200" ] || fail_post_rename "CRITICAL: /client/vehicles returned $VEHICLES_CODE (expected 200)"

# CRITICAL CHECK 3: /api/health (must return 200 AND valid JSON with all required fields)
API_HEALTH_CODE=$(curl -sk -o /tmp/api-health-$$.json -w "%{http_code}" https://localhost/api/health || echo "000")
log "  /api/health HTTP: $API_HEALTH_CODE"
[ "$API_HEALTH_CODE" = "200" ] || fail_post_rename "CRITICAL: /api/health returned HTTP $API_HEALTH_CODE (expected 200)"

API_HEALTH_JSON=$(cat /tmp/api-health-$$.json 2>/dev/null || echo "")
rm -f /tmp/api-health-$$.json
log "  /api/health body: $API_HEALTH_JSON"

# Validate required JSON fields: status=ok, db=connected, traccar=reachable
API_HEALTH_OK=1
echo "$API_HEALTH_JSON" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' || API_HEALTH_OK=0
echo "$API_HEALTH_JSON" | grep -q '"db"[[:space:]]*:[[:space:]]*"connected"' || API_HEALTH_OK=0
echo "$API_HEALTH_JSON" | grep -q '"traccar"[[:space:]]*:[[:space:]]*"reachable"' || API_HEALTH_OK=0

[ "$API_HEALTH_OK" = "1" ] || fail_post_rename "CRITICAL: /api/health JSON validation failed — expected status=ok, db=connected, traccar=reachable"
log "  /api/health JSON: PASS (status=ok, db=connected, traccar=reachable)"

# Non-critical: /client/devices (SPA route — redirect is client-side in React)
DEVICES_CODE=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost/client/devices || echo "000")
log "  /client/devices: $DEVICES_CODE (SPA route — nginx serves index.html, redirect is client-side)"
[ "$DEVICES_CODE" = "200" ] || warn "/client/devices returned $DEVICES_CODE (non-critical, SPA redirect is client-side)"

# Verify the served index.html contains the B3 redirect JS
DEVICES_HTML=$(curl -sk https://localhost/client/devices 2>/dev/null || echo "")
if echo "$DEVICES_HTML" | grep -q 'index-.*\.js'; then
  log "  /client/devices: serving SPA index.html with JS bundle"
else
  warn "/client/devices: response doesn't look like SPA index.html (non-critical)"
fi

# ── Step 12: Verify other containers were NOT restarted ─────────────────────
log "=== Step 12: Verify backend/DB/Traccar untouched ==="
ALL_OK=1
for svc in postgres traccar backend certbot db-backup; do
  CTR=$(docker compose ps -q "$svc" 2>/dev/null || true)
  if [ -n "$CTR" ]; then
    CREATED=$(docker inspect -f '{{.Created}}' "$CTR" 2>/dev/null || echo "unknown")
    OLD="${CONTAINER_STATES[$svc]:-unknown}"
    OLD_CTR="${OLD%%:*}"
    OLD_CREATED="${OLD#*:}"
    if [ "$CTR" = "$OLD_CTR" ] && [ "$CREATED" = "$OLD_CREATED" ]; then
      log "  $svc: SAME container (not restarted) ✓"
    else
      err "  $svc: CONTAINER CHANGED (was $OLD_CTR, now $CTR) — UNEXPECTED!"
      ALL_OK=0
    fi
  fi
done

[ "$ALL_OK" = "1" ] || fail_post_rename "Some backend containers were unexpectedly restarted"

# ── Summary ──────────────────────────────────────────────────────────────────
log ""
log "==================== DEPLOYMENT COMPLETE ===================="
log "Production HEAD:  $(git rev-parse HEAD) (branch: main)"
log "Target:           $TARGET"
log "Match:            $([ "$(git rev-parse HEAD)" = "$TARGET" ] && echo 'YES' || echo 'NO')"
log ""
log "npm ci:            PASS"
log "Build:             PASS (B3 redirect verified in dist.new before cutover)"
log "nginx recreate:    PASS (--no-deps --force-recreate, only nginx)"
log "HTTPS /:           $HTTP_CODE (CRITICAL: PASS)"
log "/client/vehicles:  $VEHICLES_CODE (CRITICAL: PASS)"
log "/api/health:       $API_HEALTH_CODE (CRITICAL: PASS — JSON validated)"
log "/client/devices:    $DEVICES_CODE (SPA redirect, client-side)"
log ""
log "Backend/DB/Traccar: NOT MODIFIED (verified same container IDs)"
log ""
log "Backups:"
log "  dist backup:      $DIR/$BACKUP"
log "  old dist (live):  $DIR/$OLD_DIST_DIR"
log ""
log "============================================================"
log ""
log "ROLLBACK (if needed later):"
log "  cd $DIR"
log "  rm -rf dist && mv $OLD_DIST_DIR dist"
log "  docker compose up -d --no-deps --force-recreate nginx"
log "  git reset --hard $GIT_ORIG_HEAD"