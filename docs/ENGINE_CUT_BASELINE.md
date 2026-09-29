# Engine Cut / Resume — Verified Baseline

> ملخص بالعربية: هذا سجل دقيق لكيفية عمل قطع/تشغيل المحرك **كما هو الآن** (يعمل بنجاح في الإنتاج بحسب المالك).
> الغرض: إذا كُسر شيء مستقبلاً نعرف بالضبط كيف كان يعمل، ونقارن به. لا تغيّر ملفات هذا المسار دون طلب صريح ومراجعة.

- **Recorded at commit:** `1cb568d3e45a694300334ab1612a6e7afc84d4a6` (`main`, 2026-09-28)
- **Owner statement:** the engine cut/resume feature works correctly in production today and must not be lost.
- **Method:** static source audit of the real code plus running the backend test suite. No live Traccar, no physical relay, no production access was used. Production behaviour is therefore `[UNCONFIRMED]` by this audit; the owner's statement is the only production evidence.

## 1. End-to-end flow

```
UI button ──► useEngineControl.send()
          ──► POST /api/devices/:id/command   { type: "engineStop" | "engineResume" }
                header: Idempotency-Key: <crypto.randomUUID()>
          ──► requireAuth ► requireDeviceOwner (device must be inside the caller's scope)
          ──► engineCommands.createRequest()   (row persisted as 'pending' BEFORE any send)
          ──► engineCommands.deliverOnce()     (only if pending && traccar_command_id is null)
          ──► traccar.getDevice(traccar_id)    (reads real Traccar `protocol`, 3 s timeout)
          ──► traccar.resolveEngineCommand()   (payload profile, see §4)
          ──► traccar.sendCommand()            POST {TRACCAR_URL}/api/commands/send
          ──► Traccar ──► GT06 tracker relay
```

Backend answers `{ ok, type, command, gateHeld, commandId, queueState }` (`commandId`/`queueState` are legacy-compatible fields).
Every request is written to the audit log (`engine_engineStop` / `engine_engineResume` / `engine_cancel`).

## 2. Files that make up the feature (do not touch casually)

| Layer | File | Role |
|---|---|---|
| Backend state machine + delivery + worker | `backend/src/services/engineCommands.js` | Single execution path. Persist, dedupe, supersede, cancel, deliver, expire |
| Traccar client + payload choice | `backend/src/services/traccar.js` | `resolveEngineCommand`, `sendCommand`, `cancelQueuedCommand`, `getCommandDeliveryMeta`, session/cookie auth |
| Routes | `backend/src/routes/devices.js` (~L534-646) | `GET /:id/active-command`, `POST /:id/command`, `POST /:id/command/:commandId/cancel` |
| Authorization | `backend/src/middleware/deviceAccess.js` | `requireDeviceOwner` → `getAccessibleDevice` (admin all; sub-admin assigned clients; client own; sub-user parent + optional per-device rows) |
| Power-alert side effect | `backend/src/services/vehicleTelemetry.js` | `registerEngineCommandCooldown` / `isPowerAlertSuppressed` |
| Boot wiring | `backend/src/index.js` | `startCommandWorker()` at boot; `onDeviceActivity()` on every live position from the Traccar WS bridge |
| DB | `backend/src/db/migrations/004_engine_commands.sql`, `005_engine_command_supersession.sql` and the identical inline block in `runMigrations()` (index.js) | `engine_commands` table |
| Frontend logic | `src/hooks/useEngineControl.js` | Single source of truth for button state/feedback |
| Frontend UI | `src/components/VehicleCard.jsx`, `src/pages/client/VehicleControl.jsx`, `src/pages/admin/ClientDetail.jsx` | The three places that expose the button |
| API client | `src/api/index.js` (`devices.sendCommand/getActiveCommand/cancelCommand`) | |
| Tracker/Traccar config | `traccar/traccar.xml` | GT06 listener `5023`, WanWay `5029`; H2 database |

`AppContext.toggleEngine` exists but is **not used** by any UI (dead path); it must never mutate vehicle state.

## 3. Database: `engine_commands`

- Columns: `id, device_id, user_id, command_type (engineStop|engineResume), requested_state (stopped|running), status, idempotency_key (UNIQUE), legacy_id, traccar_command_id, traccar_device_id, protocol, command_profile, error, ip_address, created_at, updated_at, sent_at, delivered_at, resolved_at, superseded_by_command_id, cancellation_state, cancellation_confirmed_at`.
- CHECK constraint on `status`: `requested, pending, sent, delivered, unconfirmed, failed, expired, cancelled, historical_unverified`.
- The legacy `device_commands` table (508 historical rows) is a **frozen archive**: never read or written by the current code.
- All schema changes are idempotent (`IF NOT EXISTS`); there is no `schema_migrations` tracking table.

## 4. Command payload (what actually goes to Traccar)

Protocol is read from Traccar (`getDevice(traccar_id).protocol`), NOT from the local vehicle `type`.

| Situation | Sent to `/api/commands/send` | Profile |
|---|---|---|
| Protocol `gt06` (bekane, DACIA) and no override | `{ type: "engineStop" \| "engineResume", attributes: {} }` — Traccar's own GT06 encoder emits `Relay,1#` / `Relay,0#` | `traccar-standard` |
| Protocol empty / lookup failed / other relay-family (WanWay, GS900, unknown) | `{ type: "custom", attributes: { data: "Relay,1#" } }` (stop) / `"Relay,0#"` (resume) | `gs900-relay-1` |
| Known non-relay protocol (`teltonika,t55,h02,tk103,meiligao,suntech,wondex`) | standard `engineStop`/`engineResume`, `{}` | `traccar-standard` |
| Traccar device attribute `engineStopCommand` / `engineResumeCommand` | `custom` with that exact string | `traccar-attribute` |
| Attribute `engineCommandProfile` = `standard`/`traccar`/`gt06-standard` | standard command | `traccar-standard` |
| Attribute `engineCommandProfile` = `legacy`/`relay-3`/`gt06-relay-3` | `custom` `RELAY,1,0#` (stop) / `RELAY,1,1#` (resume) | `legacy-relay-3` |

Missing `traccar_id` → HTTP 400 `Device has no Traccar mapping`. Invalid type → 400.

## 5. State machine (truthful states)

- New command inserts as `pending` (offline-safe), guarded by `pg_advisory_xact_lock(hashtext('athar_engine_commands'), deviceId)`.
- **Idempotency:** same `Idempotency-Key` → returns the existing row, no second send. Missing header → server generates `gen_<uuid>`.
- **Dedup:** same requested state while an actionable command exists → returns the existing one.
- **Supersession (opposite command):** the old row gets `superseded_by_command_id`; if the old one is still queued in Traccar (`pending` + `traccar_command_id > 0`) its `cancellation_state='pending'` and a post-commit `DELETE /api/commands/{id}` is attempted. While a cancellation is pending, NO new command for that device may be delivered (`gateHeld`). 204 or 404 confirms the cancellation; 5xx keeps the gate and the worker retries.
- **Traccar reply meaning:** response `id > 0` = queued (device offline) → stays `pending`, `traccar_command_id` recorded, no re-send. `id == 0` = pushed to a connected device. `null` = accepted, no body.
- **GT06 never reaches `delivered`.** Sent/accepted → `sent` → `unconfirmed` (physical relay state cannot be proven). `EXECUTED` is never produced.
- Transient Traccar error (no status, 5xx, auth) → stays `pending`; permanent 4xx → `failed`.
- **No automatic restore, ever.** Only explicitly requested commands are delivered.
- Cancel is allowed only for `requested`/`pending`; anything already sent/unconfirmed cannot be recalled.
- Allowed transitions are enforced in `transition()` (`ALLOWED_TRANSITIONS`).

Worker (`startCommandWorker`, every `ENGINE_WORKER_INTERVAL_MS`, default 30 000 ms) runs three stages: (1) retry pending cancellations, (2) deliver eligible pending commands / confirm queued ones when a fresh position exists (`positionIsFresh`, 5 min window), (3) expire `pending` non-superseded commands older than `ENGINE_COMMAND_TTL_MS` (default 24 h) → `expired`, never sent. Every live Traccar WS position also calls `onDeviceActivity()`, which delivers pending commands for that device or, for already-queued ones, moves them `sent → unconfirmed`. An in-memory `_inflight` set prevents double send (single backend process only).

## 6. Power-alert interaction

After a successful `sendCommand`, `registerEngineCommandCooldown()` suppresses power-loss detection for that device for **60 s** (`ENGINE_COMMAND_POWER_SUPPRESSION_MS`) so the relay echo (`externalPower:false` / `powerCut`) does not create a false "power disconnected" alert. In-memory only. Older TASK_LOG entries say 45 s — the current code value is 60 s.

## 7. Frontend behaviour (`useEngineControl`)

- Button state comes ONLY from `GET /devices/:id/active-command`, never from ignition/`engineOn` telemetry.
- `engineRunning = false` when: active `stopped` command in `unconfirmed`/`delivered`, or active `running` command in `requested`/`pending`/`sent`; otherwise `true`.
- Fetch happens on mount, on vehicle change and after WebSocket reconnect. A failed fetch keeps the last known command (never reverts to "normal").
- `canControl = commandReady && reachable` (last update within 15 min or `status==='online'`).
- Each send uses a fresh `crypto.randomUUID()` as `Idempotency-Key`; success text is derived from the returned status; `gateHeld` shows the "cancelling previous command" message. Messages are Arabic / French / English.
- Where the button appears today:
  - `VehicleCard` (client Home + client Vehicles list): shown when `canControl`; **two-click confirm** (armed for 3 s).
  - `VehicleControl` (`/client/vehicle/:id` and `/admin/vehicle/:id`): the big engine button renders only when `isAdminView && capability === 'available'` — i.e. **not in the client route**; uses a confirm dialog.
  - Admin `ClientDetail`: header button, **single click, no confirm**, disabled unless `canControl`.

## 8. Test baseline at this commit (`cd backend && node --test "test/*.test.js"`)

- Without `npm install`: 213 tests, 199 pass, 14 fail (missing `express`/`dotenv` packages).
- With backend deps installed: `activeCommand` 21/21 and `tokenBlacklist` 4/4 pass. The remaining **12 failures pre-exist and are unrelated to the engine command flow**:
  - 11 stale power-alert tests (`gt06Power` 5, `powerLifecycle` 4, `standaloneGt06Power` 2) that still expect `charge:false` to count as a power loss; the code deliberately stopped treating it as one (see `.agents/memory/silence-alert-verification.md`).
  - `vehiclesPageLayout.test.js` uses `require` inside an ES-module package and cannot start.
- `engineSupersession.test.js` and `engineTtl.test.js` test an **in-memory mirror** of the logic, not the real module. No test imports the real `engineCommands.js`, `resolveEngineCommand` or `getCommandDeliveryMeta`. A regression there would not be caught by the suite.
- `activeCommand.test.js` covers the read route (real Express + real middleware) and passes.

## 9. Fingerprints (sha256) at the recorded commit

```
e663f4a6069c9b17404dadc06210aa25bb93a4582e479ca83be237e328268db3  backend/src/services/engineCommands.js
bb5cf92729a245babe2273fb5acf794b398ae5d8097c8f14d152f49c4758b4df  backend/src/services/traccar.js
a9f8ee3a013d92abb46839313af598b4abcf3c935f3b6a8b6aa6894772e7ef4a  backend/src/services/vehicleTelemetry.js
a79e36f7e1525e7ee4de83217bcf40016c8f5d1994fb39df059ae8244ab553dc  backend/src/routes/devices.js
7fc928c17c15dae1beb93581cf8e52d14a669c22db4feae55de9bc03e1190bfd  backend/src/middleware/deviceAccess.js
830f2ac3db8bba4c23c774a040b5240478db69a449282a219135d96d4084ff82  backend/src/db/migrations/004_engine_commands.sql
3542ac5159e78f1b43733cd9127bd3df6820337a9f1dfdf28830b796c7435e93  backend/src/db/migrations/005_engine_command_supersession.sql
81bd50cf4c4ac9c682a61b97c360571ea2a93098eeedb65ace3ee22c4bb70d58  src/hooks/useEngineControl.js
90abe655c9007bc258186e083b5a85ff06164100bc23f2d78d312707424e22c0  src/components/VehicleCard.jsx
57a2ee5acc58acd7c6408d21a4b1b2229045daa5dcce617597a11a72a6f425f0  src/pages/client/VehicleControl.jsx
0cb30b7001a37bc979b4dd80241370ea9d60f2e9621489a9bf84bd9269487dd4  src/pages/admin/ClientDetail.jsx
6bc80f29a207cf1d9ae47cffd79a8fdcff4b7d91d4c655a6999b7192f9233aa1  traccar/traccar.xml
```

To check for drift: `sha256sum <files above>` and compare; to see what changed: `git diff 1cb568d -- <file>`.

## 10. Observations to confirm with the owner (not changed)

1. `VehicleControl` hides the engine button in the client route (`/client/vehicle/:id`); clients can only cut from the vehicle cards. Confirm this is intended.
2. Authorization is device-scope only (`requireDeviceOwner`): any user whose scope includes the device, including a sub-user, may send the command. No role/permission flag is checked.
3. Admin `ClientDetail` sends on a single click with no confirmation.
4. The in-flight guard is single-process; running two backend instances could double-send (already listed as deferred D2 in `REMEDIATION_STATUS.md`).
5. `REMEDIATION_STATUS.md` and older TASK_LOG entries describe earlier states (e.g. `RELAY,1,0#` default, 45 s cooldown); the code above is authoritative.

## 11. Rules when touching this area

1. Do not modify the files in §2 without an explicit request; keep changes additive and minimal.
2. Never add automatic restore, never auto-send a queued opposite command, never send from a stale command object (re-validate under the advisory lock as `deliverOnce` does).
3. Never map silence / generic alarm / missing voltage to a battery-disconnect alert.
4. Never derive the button state from telemetry; keep `active-command` as the source.
5. Do not change the Traccar container, `traccar.xml`, or the `engine_commands` schema without an explicit request.
6. After any change in this area: re-run the backend tests, compare with §8, and re-check the fingerprints in §9.

## 11. Changes made after the baseline (2026-09-28, branch `ccr-a2c52512-p85t46`)

The engine command path itself is **unchanged**: `backend/src/services/engineCommands.js` still has sha256
`e663f4a6…268db3`, the `POST /devices/:id/command` route is untouched, no migration was added.
Additive, read-only changes near it:

| File | Change | Effect on the command |
|---|---|---|
| `backend/src/routes/devices.js` `GET /:id/active-command` | new extra field `deviceReply` (the tracker's `result` text, one bounded Traccar lookup, wrapped in try/catch) | none: `command` object identical; a lookup failure returns `deviceReply: null` |
| `backend/src/services/deviceReply.js` (new) | classifies the tracker answer (success / postponed no GPS / already / failed) | read-only |
| `src/hooks/useEngineControl.js` | exposes `deviceReply`/`deviceReplyInfo`; up to 3 extra refetches after a send; `mounted` flag re-armed on mount (StrictMode dev only) | button state still comes only from `activeCommand` |
| `src/components/VehicleCard.jsx`, `src/pages/client/VehicleControl.jsx` | message line under the engine button | display only |
| `backend/src/services/vehicleTelemetry.js` | measured supply ~0 V (needs a working sensor + 2 packets) counts as power loss; unknown is never 0 | power alerts are still suppressed for 60 s after an engine command (cooldown check runs first) |

Tests: `activeCommandReply`, `deviceReply`, `deviceReplyText`, `supplyVoltage`. Full backend suite: same 12 pre-existing failures, nothing new.

### 11b. Follow-up change to the worker (2026-09-29)

`backend/src/services/engineCommands.js` changed in ONE place (worker stage 3, expiry): a pending command that was already queued inside Traccar (`traccar_command_id > 0`, i.e. the vehicle was offline when the cut was requested) is now marked `cancellation_state='pending'` when it expires and is cancelled in Traccar (same `attemptCancellation` path, retried by stage 1 until Traccar confirms). Before, it became `expired` in the database but stayed queued in Traccar and could still run when the tracker reconnected. Nothing else in the file changed (delivery, supersession, cancel, TTL value are the same). New sha256: `5a8928e3e41250b856bae6262c9e88015d30c210ecf2a3b3d452e6532555d2cd`. Test: `backend/test/engineExpiryCancel.test.js` (runs the real worker stage with faked db/Traccar; fails on the previous code).

The client UI now cancels a waiting cut with `POST /devices/:id/command/:commandId/cancel` (never by sending the opposite command).

### 11c. Second worker change: cancel() (2026-09-29)

`cancel()` now marks `cancellation_state='pending'` BEFORE trying to remove a queued command from Traccar (previously a failed removal was silently ignored and the command was still marked cancelled while it stayed queued in Traccar). The stage-1 worker retries until Traccar confirms, and the device gate holds new commands meanwhile. New sha256 of `engineCommands.js`: `a9f53e45753becca5e0cfacc177611ac27b075a5c9cf28ac1f65e772904efa18`. Tests in `backend/test/engineExpiryCancel.test.js` (fail on the previous code). The UI offers cancellation only for `requested`/`pending` cuts; a cut already `sent` is shown as waiting for confirmation and cannot be cancelled.
