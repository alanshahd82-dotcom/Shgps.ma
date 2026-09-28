# Audit — client-reported issues (Phase A, no code changed)

- Base commit: `1cb568d` (`main`). Engine cut baseline: `docs/ENGINE_CUT_BASELINE.md` (must stay untouched).
- Method: source audit + local reproduction (Vite dev server + a mock API + headless Chromium). Production data, logs and physical devices were NOT available, so anything that depends on them is marked `[UNCONFIRMED]`.
- Rule used: client-suggested causes are hypotheses; only what was proven from code or reproduced is called a root cause.

## Proven (reproduced or unambiguous in code)

| # | Client issue | Client's suspected cause | Proven cause | Files |
|---|---|---|---|---|
| 10 | `removeChild` crash on `/admin/setup` | Leaflet cleanup / re-render / Google Translate | NOT Leaflet. `/admin/setup` has no map. The stack frame lives in `leaflet-*.js` only because `vite.config.js` `manualChunks` puts `react-dom` into the "leaflet" chunk (that chunk starts with `scheduler`/React DOM and contains 15 `removeChild`). Cause = an external DOM mutation (translation) detaches React-managed text nodes. Reproduced: with a Google-Translate-style mutation the flow crashes at step 3 → Submit with `NotFoundError ... removeChild` "in the `<Text>` component at button"; without it the whole flow passes. The trigger is the Next/Save button that swaps text nodes inside one `<button>` (`DeviceSetup.jsx` ~L540-551). No `translate="no"` / notranslate exists anywhere (`index.html`). Real Google Translate itself was not run. | `src/pages/admin/DeviceSetup.jsx`, `index.html`, `src/main.jsx` (only a root ErrorBoundary) |
| 10b | (found while auditing) | — | `DeviceSetup` destructures `loadDevices` from `useApp()`, but the context only exports `refreshDevices`. After a successful save `loadDevices()` throws `TypeError`, is swallowed by `catch`, and the device list is not refreshed. | `DeviceSetup.jsx` L88, L185; `AppContext.jsx` L869 |
| 11 | Info overlaps the map on the add-device screen (mobile) | layout/z-index | Confirmed. Leaflet panes/controls (z-index 400-1000) are not isolated, so on any page that has a map (`Dashboard`, `ClientDetail`) they paint above the `z-50` "Ajouter un appareil" modal. Screenshot at 390px shows the map hiding the IMEI/phone fields; 6/340 probe points hit Leaflet above the modal. `GlobalMap` already has `isolate z-0` (the fix exists there only). `/admin/setup` itself has no map. | `Dashboard.jsx` L230, `ClientDetail.jsx` L554, `AdminLayout.jsx` (modal z-50), `AddDeviceModal.jsx` |
| 1 | `0.000, 0.000` and "Position indisponible" | — | Reproduced. Backend `GET /devices` returns Traccar's coordinates unvalidated (`lat: p.latitude`), so a tracker that never had a fix (Traccar stores `0,0`) is sent as `0,0`. `VehicleCard.jsx` L331 prints `0.000, 0.000` when `lat != null`; `MapScreen` filters `0,0` out and shows "Position indisponible" when nothing is left. Client screens reproduced: `/client/home`, `/client/vehicles` show `0.000, 0.000`, `/client/map` shows the unavailable message. | `backend/src/routes/devices.js` L161-256, `src/components/VehicleCard.jsx`, `src/design-system/screens/MapScreen.jsx`, `useReverseGeocode` |
| 1b | Offline vehicle loses last position | — | Two server paths drop it: (a) `GET /devices` uses the DB snapshot (`last_lat/last_lng`) only when Traccar says `online`; (b) `GET /map/positions` returns `lat/lng = null` unless the position is fresh (5 min) — used by the fallback poll. The client-side merge keeps in-memory coordinates only until the next page load. Also: tracking-disabled devices (expired subscription) get `lat/lng = null`. | `devices.js` L176; `map.js` L156; `AppContext.jsx` `mergeDeviceSnapshots` |
| 1c | "My Location" | — | `MapScreen` already has a locate button but it only flies the map; it draws NO blue dot, and on error it silently flies to Casablanca. | `MapScreen.jsx` L13-27 |
| 9 | Admin map: vehicles cannot be separated | — | Reproduced. `MapView` clusters using the static `zoom` prop (6 or 5), not the real map zoom. 5 vehicles 50 m apart stay as ONE cluster marker at real zoom 17 (0 individual markers). Affects Global map and Dashboard map (>3 devices). | `src/components/MapView.jsx` L96-135, L321 |
| 6 | Admin navigation is hard | — | Reproduced. `SidebarContent` is declared as a component inside `AdminLayout`'s render, so React re-creates the whole sidebar (DOM nodes replaced) on every `AdminLayout` render — which happens on every context update (position flush every 500 ms, alerts, etc.). Clicks and scroll position can be lost. Each page also mounts its own `<AdminLayout>`, so the layout remounts on every route change. | `src/pages/admin/AdminLayout.jsx` L379-467 |
| 7 | Device limit | "hard-coded" | Not hard-coded. The limit is per client `users.max_devices` (default 5), enforced in `POST /devices`, `/quick-add`, `POST /clients/:id/devices`; the client edit form has no upper cap. Real defect: both quick-add UIs send `maxDevices` (default `'1'`) whenever a client is selected, and the server (a) rejects with 409 if the client already has ≥1 device and (b) OVERWRITES `users.max_devices` on success. There is no plan→device-count mapping (plans are per-device duration/price). | `AdminLayout.jsx` L27/L58, `AddDeviceModal.jsx` L57/L77, `devices.js` L291-358 |
| 5 | Offline section | — | Missing. Admin only shows an offline counter. `GET /clients` is paginated (default 50) and the UI never pages, so client name/phone lookups fail for clients beyond the first 50; the devices payload has `clientName` but no client phone. | `GlobalMap.jsx`, `Dashboard.jsx`, `clients.js` L12-13, `api/index.js` |
| — | SECURITY (not reported) | — | `GET /api/diag/offline` has NO authentication. It runs `execSync` (ss, netstat, iptables, docker ps, ufw, tail Traccar log), awaits 15 s, returns public IP, Docker network layout and raw position/attributes of devices 37 and 70. `execSync` blocks the Node event loop (up to 8 × 5 s per call), which stalls the WebSocket bridge for every user. `REMEDIATION_STATUS.md` claims no `child_process` use; that is outdated. | `backend/src/routes/diag.js`, `backend/src/index.js` L521 |

## Best supported hypotheses (need production evidence to be proven)

- **2 Live updates stop.** Verified gaps: (1) the backend has no liveness check on the Traccar→backend WebSocket, so a half-open socket freezes all live data while browser sockets still answer `ping` (no fallback polling starts; a page refresh "fixes" it via REST); (2) the browser has no `visibilitychange`/`online` handler, so after backgrounding the app waits up to ~30 s; (3) live positions are silently dropped if the device list is not loaded or the device has no `traccarId`; (4) per Traccar message the backend runs one DB query per non-admin client (`refreshAccess`); (5) the unauthenticated diag endpoint can block the event loop. Which one hits the client needs `docker compose logs backend | grep "Traccar WS"` and timing. `[UNCONFIRMED]`
- **3 Relay works but location does not update.** Command path and telemetry path are independent. `positionIsFresh` uses `serverTime` (last contact), while coordinates can be old (Traccar reuses the last fix with `valid=false` on heartbeats). `GET /devices` does not return `fixTime`/`valid`, so the UI cannot say "connected, but no new GPS fix". Command ACK is not ingested (state ends `unconfirmed`). Whether GT06 ACK text arrives as a position `result` attribute must be checked live. `[UNCONFIRMED]`
- **4 Battery / 0 V.** Code truth: `toFinitePositiveNumber` and `formatVoltage` reject `0`, so a real `0` reading would show `—`. Confirmed power loss shows "مفصول" (not a number); unknown shows `—`; stale shows the last value with a label. The five states requested are only partly distinguishable (missing: real 0 V). Whether the fleet's GT06 trackers send an electrical signal on a physical disconnect is unknown: `alarm:powerCut` and `charge:false` are deliberately ignored (documented false-alert history). The history endpoint drops attributes, so a controlled physical test needs a raw-telemetry capture. `[UNCONFIRMED]`
- **9 Slow map.** Proven contributors: the context value is re-created on every provider render (all consumers re-render on every 500 ms position flush), sidebar remount, `MapView` rebuilds/cluster O(n²) each render with new device objects, and `react-dom` is bundled in the 290 KB "leaflet" chunk loaded on every page. Not measured on production. `[UNCONFIRMED]`

## Could not reproduce from code

- **8 Renewal e-mail.** In the renewal paths e-mail is not required: admin `SubscriptionRenewalModal` → `PATCH /devices/:id/subscription` (plan only), client `Subscriptions.jsx` (WhatsApp or mailto; both optional). E-mail is mandatory only when CREATING a client account (`POST /clients`, `users.email` NOT NULL UNIQUE, login identity, password reset, Traccar user). Need the exact screen from the client before changing anything.

## Proposed order (each item = small commit, tested, easy to revert)

1. Location integrity (backend sanitize + last-known fallback + `fixTime/valid` fields; UI guards, "last known + Offline + time"; blue-dot My Location).
2. `/admin/setup` crash: `translate="no"` + stable button label + `loadDevices` fix + route-level ErrorBoundary.
3. Map layering (isolate) + cluster by real zoom.
4. Admin sidebar stable + layout; Offline view (additive `clientPhone`).
5. Live-update resilience (visibility/online resync, Traccar bridge watchdog, cached access scope) and securing/removing `/api/diag`.
6. Device limit (stop quick-add overriding `max_devices`; replace-device endpoint).
7. Voltage states + raw telemetry capture for the physical test (needs owner decision).
8. Performance measurements then targeted fixes.

## Decisions needed from the owner

1. `/api/diag/offline`: require admin auth and drop `execSync`, or remove it? (recommended: remove the shell commands, keep it admin-only)
2. Voltage on confirmed power loss: keep "مفصول", or also show "0 V"? (recommended: a real numeric 0 only when the tracker reports it; confirmed loss stays a distinct state)
3. Which screen requires the e-mail on renewal?
4. Device plan: keep the per-client `max_devices` as the source of truth (recommended), or introduce plan-level limits (schema change)?
5. Can a physical battery-disconnect test be run on bekane/DACIA with raw capture enabled?

## Risks

- Engine cut/resume, power-alert logic, auth, DB schema and Traccar are not touched by items 1-4; item 5 and 7 touch telemetry paths and must keep `docs/ENGINE_CUT_BASELINE.md` fingerprints for the engine files unchanged.
- Backend changes are additive (new fields only) so the existing frontend keeps working during rollout.
- Backend test suite already has 12 pre-existing failures (see baseline doc); new work must not increase them.

---

# Production evidence (read-only server report, 2026-09-28 ~21:25 UTC)

Collected by the owner running read-only commands on the production host; secrets, emails, IMEIs and coordinates were masked or never printed. `docker exec` was broken at the time, so the database could not be queried.

## Confirmed on production
- Server checkout = `main` @ `1cb568d`; the only local differences are rebuilt `dist` files. The served frontend is the server's own build (`index-gfBuYHu7.js`), not the committed one.
- Public health: `status ok`, `db connected`, `traccar reachable`. Only 80/443 and the GPS ports are exposed; 3001, 8082 and 5432 are not.
- Traccar holds only 3 devices: Traccar ids 37 (`gt06`), 70 (`gt06`), 136 (`gt06`). Local device ids seen in engine logs: 14 (→37) and 31 (→136).
- Engine cut/resume works: commands 529-533 were sent directly (`queuedLive:false`, `pending → sent → unconfirmed`) and the 60 s power-alert cooldown was set. Traccar device attributes are empty (no engine profile override).
- No requests to `/api/diag` in the retained nginx log (~2.5 days); access lines do reach `docker logs`. Traffic is low (~2k requests/day).
- Backups ran daily at 03:00 UTC up to 2026-09-28 (7 files, ~2 MB each), stored on the same host only.
- Edge TLS certificate (Google Trust Services, served through the CDN) is valid until 2026-11-13. The origin certificate is not yet checked.

## Evidence for the reported issues
- **Issue 1 (0,0 / unavailable):** Traccar's latest position for device 136 (online) and 70 (offline ≈13.4 days) has `valid=false` and zero coordinates, while device 37 is fine. `GET /devices` prefers that live 0,0 position over the validated `devices.last_lat/last_lng`, so a valid last-known location is never used. Matches the client's screenshots.
- **Issue 3 (relay vs location):** the tracker does acknowledge commands in a position attribute `result`: "Cut off the fuel supply: Success!", "Restore fuel supply: Success!", "Already in the state of fuel supply to resume, The command is not running!" and, for device 136, **"GPS not fixed, Cut off the fuel supply operation delay execution!" (6 times in 24 h)**. The device postpones a cut while GPS is not fixed, but the app only shows the generic "unconfirmed" and never reads `result`.
- **Issue 4 (0 V):** the fleet reports supply voltage in `adc1` (device 37: 13.1-14.8 V). Device 136 reported `adc1 = 0.0` five times and `0.3` once in 24 h together with one `alarm: powerCut`; it also reported `adc1 = 12.8` with `charge:false` 33 times (so `charge:false` is not a disconnect). Current code: a value `0.0` is discarded (`toFinitePositiveNumber`), and `readVehicleVoltage` then serves the cached last-known good voltage as if it were current; `0.3` is rejected by `isBatteryVoltage` and shown as unknown. So a real 0 V reading is displayed as the previous normal voltage. This is the "validate against real payloads" evidence the power-alert memory notes asked for.
- **Issue 2 (live updates):** no `Traccar WS` reconnect or error lines in the last-24h log window, so a silently stalled bridge is still possible; host memory pressure (below) is a plausible contributor. `[UNCONFIRMED]`
- Nginx status codes in 24 h include 10 × `409` (conflict: e.g. device limit, duplicate IMEI, free-trial) — consistent with issue 7 but not proven.

## New server-side risks found
1. `docker exec` fails with `SetSSB requires libseccomp >= 2.5.0 and API level >= 4 (current version: 2.5.5, API level: 1)`. All three Docker health checks fail (`failingStreak` 3276 / 3276 / 2080), so backend, traccar and postgres show "unhealthy". No docker/runc/libseccomp package change appears in dpkg since 2026-07-29 (Docker 29.6.2, runc 1.3.6, libseccomp2 2.5.5); the failure started hours ago, not at the 2026-09-26 reboot. Cause unknown; low-confidence hypothesis: memory pressure.
2. Consequence for deployment: `deploy.yml` runs `docker compose up -d --build` (backend waits for healthy postgres/traccar) and `docker exec ... nginx -s reload`. A merge to `main` may fail or deploy only the frontend. Do not merge until this is understood.
3. `shgps-certbot-1` exited (255) about two weeks ago and `shgps-backup-1` exited (137) at ~04:20 UTC today; neither service in `docker-compose.yml` for certbot has a restart policy. The backup loop needs the container alive: the next 03:00 backup will not run while it is stopped.
4. Memory: 961 MB total, ~180 MB available, swap 713 MB / 2 GB in use with active swapping; `kswapd0` has used ~38 min of CPU; load ≈1.9 on 1 vCPU. Listed process RSS explains only ~250 MB of the ~780 MB "used" (rest unexplained). The Traccar JVM shows ~49 MB RSS (mostly swapped out).
5. Kernel `6.8.0-142` is installed but the running kernel is `6.8.0-139`; 59 updates pending (12 security).
6. `RESEND_API_KEY` / `MAIL_FROM` are neither in `.env` nor passed by `docker-compose.yml`: e-mail sending (password reset) is not configured in production.
7. Device 70 (DACIA) has been offline ≈13 days; its last packet contained only `adc1 = 0.0`, no ignition/charge/battery fields.
