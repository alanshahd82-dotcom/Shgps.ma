# ATHAR GPS — Remediation Status

**Branch:** `remediation/security-hardening`
**Main (untouched):** `5c52effd86ad7e2b8d7b57c797afb90bfb697ae2`
**Stable tag (untouched):** `STABLE-2026-09-01`
**Status:** NOT merged to main. NOT deployed. Runtime evidence received 2026-09-01 12:36 (CASA). Host gate partially run; remaining gates need host/browser (see below).

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

| `2bc6e81b` | security: fix brute-force rate-limit bypass via X-Forwarded-For spoofing | Both rate limiters (index.js `/api/auth` + routes/auth.js login) keyed on the FIRST X-Forwarded-For entry — client-supplied and SPOOFABLE — letting an attacker rotate the header to bypass brute-force protection. Extracted a shared pure `getClientIp(headers)` helper that prefers X-Real-IP (nginx overwrites it, unspoofable) then the LAST XFF entry (nginx appends the real IP at the end). Added 8 regression tests (`test/clientIp.test.js`) covering the spoofing scenario. No auth-logic or state-machine change. |
| `259509da` | perf: move devices.phone column ensure to startup migration, drop per-request ALTER TABLE | Two route handlers ran `ALTER TABLE devices ADD COLUMN IF NOT EXISTS phone` on every request (the PATCH handler on every call; the POST handler inside a BEGIN/COMMIT transaction — DDL under an AccessExclusive lock on the hot device path). The column was not in the base schema or runMigrations. Moved the ensure into the existing devices ALTER block in runMigrations (idempotent, startup) and removed both per-request ALTERs. No-op for deployed DBs (column exists); created at startup for fresh DBs. No device create/update behaviour change. |

Already present (no change needed): in-memory rate limiting on `/api/auth`
sensitive routes (index.js:473-499 + routes/auth.js), `app.disable('x-powered-by')`.

---

## ✅ Runtime evidence received (2026-09-01 12:36 CASA)

Supplied by the host operator from the deployed verification environment on
branch `f9e58e8d`:

- **Containers:** backend healthy · postgres healthy · traccar healthy · nginx running · certbot running · db-backup running.
- **Health endpoint:** `status=ok`, `db=connected`, `traccar=reachable`, HTTP 200.
- **Traccar WS:** initial connection attempt FAILED (`fetch failed`); automatic retry occurred; subsequent session succeeded (`"Session OK"`, `"Connected to ws://traccar:8082"`). → RUNTIME VERIFIED eventual recovery, NOT clean-first-attempt. Recorded as reliability observation R-WS-1 (see below).
- **Power:** `"Silence observed without electrical confirmation; battery alert suppressed: 70"` — expected safe behavior (telemetry-signature gating working as designed).

## ✅ Code-verified this session (no host needed)

### Migration 006 — `backend/src/db/migrations/006_revoked_tokens.sql`
- File EXISTS and is correct.
- Schema: `revoked_tokens(id SERIAL PK, token_hash CHAR(64) NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`.
- Index: `idx_revoked_tokens_expires ON revoked_tokens(expires_at)`.
- Prune: `DELETE FROM revoked_tokens WHERE expires_at < NOW() - INTERVAL '7 days'`.
- Matches the runtime `CREATE TABLE IF NOT EXISTS revoked_tokens` in `index.js:423-434` (runMigrations) — the startup source of truth. Both are idempotent (`IF NOT EXISTS`).
- `tokenBlacklist.js` confirmed to read/write `revoked_tokens` + expose `initRevocationStore/isRevoked/revokeToken`.
- → CODE-VERIFIED. Runtime "applied" status needs a DB query (`\dt revoked_tokens` / `\d revoked_tokens`) — host gate G2.

### Regression scope of the 2 new commits (2bc6e81b, 259509da)
Files touched: `index.js` (rate-limit + migration), `routes/auth.js` (rate-limit), `routes/devices.js` (per-request DDL removal), `utils/clientIp.js` (new), `test/clientIp.test.js` (new).
Files NOT touched: `powerAlerts.js`, engine-command code, voltage contracts, event policy, `tokenBlacklist.js`.
→ CODE-VERIFIED: zero overlap with engine/power/voltage/event systems. No regression risk to those flows from these commits. (Earlier branch commits 468a5fe8/af7f2a8d did touch power/revocation and were verified separately.)

### Reliability observation R-WS-1 (Traccar WS initial fetch failure)
- Symptom: first WS connection attempt to `ws://traccar:8082` failed with `fetch failed` at startup.
- Recovery: the jittered retry (commit 7ca72639) fired automatically; the second attempt succeeded.
- Assessment: NOT a clean-first-attempt startup, but the self-healing retry worked as designed. Acceptable for a verification environment where Traccar may still be initializing when the backend first connects. If this recurs consistently in production with Traccar already healthy, investigate startup ordering / a readiness probe for Traccar. Not a release blocker; tracked as a reliability observation.

## 🔍 Audit findings (CODE-VERIFIED solid — no fix needed)

A full backend security audit was performed this session. The following areas
were inspected and found correct; no change was made (listed so they are not
re-audited unnecessarily):

- **CORS** (`index.js:444`): `origin: FRONTEND_URL || false`, `credentials: true` — allowlisted, no wildcard.
- **Security headers** (Express `index.js:450` + nginx snippet): X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, CSP. nginx is the authoritative edge (proxy_hide_header dedups Express).
- **JWT secret** (`config.js`): throws at startup if `JWT_SECRET` unset — no weak default.
- **Refresh cookie** (`routes/auth.js:67`): `HttpOnly; Secure; SameSite=Lax; Path=/api/auth`; token stored hashed (sha256); rotated on `/refresh`; revoked + cookie cleared on `/logout`.
- **Password reset** (`routes/auth.js:332/426`): single-use (`used` flag), 1h expiry, prior tokens invalidated, generic response (no email enumeration), bcrypt cost 12.
- **Device access RBAC** (`middleware/deviceAccess.js`): parameterized scope fragments; admins/sub-admins/clients/sub-users each scoped; `requireDeviceOwner` for mutations — no IDOR.
- **WebSocket auth** (`index.js:642`): `jwt.verify` + `isRevoked` check + per-connection `deviceAccessScope` — revoked tokens rejected, access scoped.
- **change-password** (`routes/auth.js:246`): verifies current password, strength policy, audit-logged.
- **profile** (`routes/auth.js:272`): updates only name/phone/email/notification_prefs — no mass-assignment of `is_admin`/`role`/`is_active`.
- **SQL injection**: all dynamic UPDATE builders (devices/clients/subUsers/subAdmins) use hardcoded column names + parameterized `$N` values; no user input in SQL text.
- **Logout** (`routes/auth.js:454`): revokes JWT (tokenBlacklist) + refresh token (`revoked_at`) + clears cookie.
- **No dangerous patterns**: no `eval`, `child_process`, `new Function`; no TODO/FIXME/HACK markers across backend.

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

### D5. change-password does not invalidate other sessions
**Problem:** after a password change, other devices' refresh tokens + the 7d JWT
remain valid, so a stolen-password attacker keeps access.
**Proposed (needs approval + DB-mocked test):** on password change, `UPDATE
refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL AND
token_hash <> <current>` (revoke other sessions, keep current). For full JWT
invalidation, add a `password_changed_at` claim + check in `requireAuth`
(bigger change, per-request DB read or token version). Touches the auth session
lifecycle — deferred until a DB-mocked regression test exists.

### D6. profile email change is not verified
**Problem:** `PUT /api/auth/profile` changes email immediately without
verifying the new address (a session hijacker could change email then
forgot-password to take over). Feature-level fix (send confirmation to the new
email, require click) — deferred as it is a feature, not a 1-line fix.

### D7. password reset token stored plaintext
**Problem:** `password_reset_tokens` stores the token in plaintext (unlike the
hashed refresh token). Low severity (1h expiry, single-use, requires DB
compromise to exploit). Fix needs a migration (rename/add `token_hash`
column) + changes to forgot/reset handlers — deferred as low-value/risk.

## Out of scope (not security remediation)
- Tailwind colors don't match branding (P2) — UI/branding, not security.

---

## Host runtime gate (must ALL pass before merge to main)

**Partially run 2026-09-01 12:36 CASA** — containers healthy, /api/health 200 (B8 ✅), WS eventual recovery (R-WS-1). Remaining:

**Re-run after commits 2bc6e81b (rate-limit) + 259509da (per-request DDL):** the
new `test/clientIp.test.js` adds 8 tests (expect 69 → 77), and the migration
change must not break startup.
1. `git fetch && git checkout remediation/security-hardening && git reset --hard origin/remediation/security-hardening`
2. `docker compose config` → valid
3. `docker compose run --rm nginx nginx -t` → syntax OK (after b0dbd082)
4. `docker compose up -d` (verification env) → all containers healthy
5. `npm test` (backend) → 69/69
6. B1 (revoked token survives restart), B2 (health 200, no startup errors)
7. B4 (browser: no CSP violations; export/fonts/map/WS work)
8. Only then: reviewed PR merge to main. `STABLE-2026-09-01` and `main` stay untouched until then.
