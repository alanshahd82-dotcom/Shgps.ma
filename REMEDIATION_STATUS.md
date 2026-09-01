# ATHAR GPS — Remediation Status

**Branch:** `remediation/security-hardening`
**Main (untouched):** `5c52effd86ad7e2b8d7b57c797afb90bfb697ae2`
**Stable tag (untouched):** `STABLE-2026-09-01`
**Status:** NOT merged to main. NOT deployed. Awaiting host runtime gate.

This file tracks the security/infrastructure remediation mission. Every item
below is either CODE-VERIFIED (committed, statically proven) or explicitly
BLOCKED (needs host/Capacitor/hardware runtime) or DEFERRED (needs design
review before touching a verified state-machine contract).

---

## ✅ Completed phases (CODE-VERIFIED, committed on this branch)

| Commit | Phase | Evidence |
|---|---|---|
| `af7f2a8d` | Durable JWT revocation (P1) | `tokenBlacklist.js` persists to `revoked_tokens` table; migration `006_revoked_tokens.sql` (idempotent); `initRevocationStore()` re-hydrates in-memory map from DB on startup → revoked tokens survive restart |
| `7ca72639` | Infra: jittered Traccar WS reconnect + wait for healthy postgres | `scheduleTraccarReconnect()` delay = `15000 + rand(30000)` (15–45 s); backend waits for `pg_isready` before connecting Traccar |
| `468a5fe8` | Power alert restore fix | `powerAlerts.js` admits explicit `powerCut:false` restore signal; 65/65 pure tests pass (host: 69/69) |
| `a0b88a90` | Infra: CPU limits on all compose services | postgres/backend 1.0, traccar 1.0, nginx/db-backup 0.25 (`deploy.resources.limits.cpus`); memory caps already existed |
| `b0dbd082` | nginx: enforce security headers on ALL locations + correct CSP + dedup | Fixed the `add_header` inheritance gotcha (CSP/HSTS were silently dropped on index.html, /assets/, /); extracted `nginx/security-headers.conf` snippet, included in server + every location; corrected CSP to allow cdnjs (xlsx/jspdf), jsdelivr/unpkg (Leaflet/@fontsource styles), gstatic/jsdelivr fonts; tightened `img-src` from `*` to `https:`; added `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`; `proxy_hide_header` dedups Express's redundant headers |

Already present (no change needed): in-memory rate limiting on `/api/auth`
sensitive routes (index.js:473-499 + routes/auth.js), `app.disable('x-powered-by')`.

---

## 🔶 BLOCKED — require host / Capacitor / hardware runtime

These cannot be verified without access I do not have. No runtime result is
fabricated. Each has the exact host command required.

### B1. Durable JWT revocation — runtime confirmation
```bash
# 1) log in, capture token T; revoke it (logout) -> row in revoked_tokens
# 2) curl -H "Authorization: Bearer T" /api/me   # expect 401
# 3) docker compose restart backend (verification env)
# 4) curl -H "Authorization: Bearer T" /api/me   # expect 401 (still revoked after restart)
psql "$DATABASE_URL" -c "SELECT count(*) FROM revoked_tokens;"
```

### B2. Backend startup health
```bash
docker compose up -d   # verification env
docker compose logs backend --since 2m | grep -iE "error|exception|unhandled"  # expect empty
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/health      # expect 200
```

### B3. Traccar WS jittered reconnect (do NOT disrupt production tracking)
```bash
# Only on the verification env. If a controlled reconnect is unsafe on prod, skip.
docker compose logs backend --since 5m | grep -i "traccar ws"   # look for "reconnecting in <15-45>s"
```

### B4. nginx config + CSP enforcement (after b0dbd082)
```bash
docker compose config        # validate compose
docker compose run --rm nginx nginx -t   # validate nginx syntax (CRITICAL before reload)
docker compose up -d nginx
# In a browser: open the app, check DevTools Console for CSP violations;
# exercise: xlsx/jspdf export, Cairo/@fontsource fonts, Leaflet map, WebSocket.
curl -sI https://athargps.com/index.html | grep -iE "content-security-policy|strict-transport"  # expect present
curl -sI https://athargps.com/assets/ | grep -i "content-security-policy"   # expect present (was missing before)
```

### B5. SameSite / Capacitor session persistence (P1)
Backend auth is **JWT-in-Authorization-header** (no auth cookies — see
`middleware/auth.js`), so the SameSite issue is frontend/Capacitor-side and
requires a Capacitor build on a device/simulator. Cannot be done from here.
```bash
# On a Capacitor build: test session persistence across app restart + cold start
# on iOS and Android; inspect any Set-Cookie the frontend receives and whether
# the webview persists it. (Backend sets no auth cookies; check WS/3rd-party.)
```

### B6. Offsite DB backup
A local daily `pg_dump` + 7-day rotation already exists (`db-backup` service,
`backups_data` volume). **Offsite** upload needs a target + credentials
(S3/B2/rclone) which are not configured. Cannot implement without the target.
```bash
# Provide OFFSITE target + credentials, then an rclone/curl upload hook can be
# added to the db-backup entrypoint. Currently BLOCKED on missing target.
```

### B7. DACIA device-side telemetry regression (P1-2)
Requires physical device inspection / ID check. Not actionable in software.

### B8. /api/health = 200 on the branch
Would require deploying the branch over public production — explicitly
disallowed. Run on the verification env (see B2).

---

## ⏸ DEFERRED — require design review before implementation

These touch **verified state-machine contracts** (`engineCommands.js` is kept
byte-identical to main as a stable contract; power logic was just carefully
gated). Implementing them blind risks violating invariants the mission worked
hard to establish. Proposed designs below for review.

### D1. Pending commands never expire (P2)
**Problem:** engine commands can remain in `pending`/`sent` indefinitely.
**Proposed (needs approval):** a separate, additive periodic cleanup
(`services/commandExpiry.js`, scheduled from index.js) that runs:
```sql
UPDATE engine_commands SET status='expired', updated_at=NOW()
WHERE status IN ('pending','sent')
  AND created_at < NOW() - INTERVAL '10 minutes'
  AND superseded_by_command_id IS NULL
  AND cancellation_state IS NULL;
```
**Risk:** races with the delivery worker and the supersession state machine;
must NOT expire a command the worker is about to send or that is the current
intent. Needs review of the worker's polling + the state machine's status
transitions before enabling. Do NOT add an external mutator to
`engine_commands` without that review.

### D2. In-flight guard is single-process only (P2)
**Problem:** the in-flight guard is in-memory, so multiple backend instances
could both deliver a command.
**Proposed (needs approval):** DB-backed lease — a `processing_by`/`processing_lease_until` columns + `SELECT ... FOR UPDATE SKIP LOCKED`, or a
`pg_advisory_lock`. This modifies `engineCommands.js` (the stable contract).
**Risk:** changes the core delivery path; needs the state-machine owner's
review + runtime concurrency test.

### D3. Stale device_power_states cleanup
**Problem:** requires adding `everSeenBatteryVoltage` as a column AND updating
the power logic to read/write it (currently in-memory/derived).
**Risk:** touches the just-verified power-alert logic. Needs review to ensure
the column migration + code change don't regress the power-restore gating.

### D4. Formal migration tracking (P2)
**Problem:** no `schema_migrations` table; relies on `IF NOT EXISTS` idempotency.
**Deferred because:** `runMigrations()` is a large inline-schema runner (entire
base schema + file migrations), all already idempotent. Adding a tracking table
restructures a critical startup function for marginal future benefit; not
worth the risk without a runtime test. Current idempotent approach is sound as
long as every new migration stays `IF NOT EXISTS`.

---

## Out of scope (not security remediation)
- Tailwind colors don't match branding (P2) — UI/branding, not security.

---

## Host runtime gate (must ALL pass before merge to main)
1. `git fetch && git checkout remediation/security-hardening && git reset --hard origin/remediation/security-hardening`
2. `docker compose config` → valid
3. `docker compose run --rm nginx nginx -t` → syntax OK (after b0dbd082)
4. `docker compose up -d` (verification env) → all containers healthy
5. `npm test` (backend) → 69/69
6. B1 (revoked token survives restart), B2 (health 200, no startup errors)
7. B4 (browser: no CSP violations; export/fonts/map/WS work)
8. Only then: reviewed PR merge to main. `STABLE-2026-09-01` and `main` stay untouched until then.
