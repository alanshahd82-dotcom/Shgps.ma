# Athar GPS — Task Log

This file records the completed work and the current production verification notes.

## Engine delivery fix — use the Traccar GT06 encoder and the GS900 relay shape

### Root cause

- The production application returned HTTP 200 after sending a Traccar
  `custom` command with `attributes.data: "RELAY,1,0#"` or
  `"RELAY,1,1#"`, but HTTP 200 only proved that Traccar accepted the API
  request. It did not prove that the device received a valid relay command.
- The current upstream Traccar `Gt06ProtocolEncoder` was checked directly.
  With `gt06.alternative` disabled, its standard commands are
  `Relay,1#` for `engineStop` and `Relay,0#` for `engineResume`. The previous
  application payload had the wrong argument shape and bypassed that encoder.
- The WanWay GS900 command guide independently documents the same one-argument
  relay format: `RELAY,1#` cuts fuel/electricity and `RELAY,0#` restores it.
  The repository's own setup comments identify the deployed GS900 firmware as
  GT06-compatible on port 5023, which explains why the previous command could
  be accepted by Traccar without moving the relay.

### Fix

- A device whose Traccar protocol is `gt06` now sends the standard
  `engineStop` / `engineResume` command types with an empty attributes object.
  Traccar therefore owns the final wire encoding and respects its
  device-level `gt06.alternative` setting.
- WanWay/GS900 and unknown-protocol fallback dispatches use Custom with the
  exact one-argument payload `Relay,1#` / `Relay,0#`.
- Per-device overrides are supported through Traccar device attributes without
  a database migration:
  - `engineStopCommand` and `engineResumeCommand` send exact Custom strings.
  - `engineCommandProfile: "standard"` uses Traccar's standard command.
  - `engineCommandProfile: "legacy"` preserves the old three-argument format
    only for a device whose firmware is proven to require it.
- The route logs the Traccar device ID, detected protocol, selected profile,
  command type, and exact non-secret attributes. `sendCommand()` continues to
  log the Traccar response. The API response now includes `commandProfile` and
  the raw non-secret Traccar response for diagnosis.

### Verification and limits

| Requirement | Result | Evidence |
|---|---|---|
| Correct GT06 request shape | PASS locally/source audit | GT06 uses `engineStop` / `engineResume` with `{}`; upstream encoder emits `Relay,1#` / `Relay,0#` |
| GS900 fallback shape | PASS locally/source audit | `Relay,1#` / `Relay,0#`; seven profile smoke cases pass |
| Per-device command override | PASS locally | exact stop/resume attributes and `standard`/`legacy` profiles tested |
| Application → Traccar path | PASS previously live | production returned HTTP 200 and Traccar response for DACIA/70 |
| Traccar UI vs application decisive test | NOT RUN | no public Traccar UI endpoint or Traccar credentials are available in this Repl |
| Physical relay movement | NOT PROVEN | safe live hardware test was not available; no false success claim |
| Build/syntax/diff | PASS | `npm run build`, backend `node --check`, and `git diff --check` |
| New Docker container | NOT PROVEN HERE | Docker is unavailable in this Repl; `backend/Dockerfile` copies the changed `src` on a fresh build |

The external `athargps.com` runtime and its Docker host are not connected to
this Repl. The source fix is ready for a fresh Docker build with cache disabled,
but the running production image must be rebuilt and its backend logs checked
before the physical cut/resume result can be certified.

The backend start smoke test could not run in this clone because
`backend/node_modules` is absent (`dotenv` is not installed). This is an
environment/dependency limitation, not a syntax failure; the changed modules
passed `node --check`, the pure command/profile smoke tests, and the frontend
build.

## Three live bugs — real root causes and precise state separation

### Bug 1: repeated disconnect/restore alerts

- The live account's `/api/alerts` response showed alternating
  `power_disconnected` and `power_restored` rows for DACIA (for example IDs
  `121`, `122`, `123`, `124`, `125`, `126`, `127`, `128`, `131`, `132`).
  The disconnect rows carried `trigger: "telemetry"` and `reason:
  "charge:false"`, proving this was not a five-minute silence sequence.
- The actual cause was two pieces of state fighting each other:
  `observeVehicleVoltage()` called `markVehicleConnected()` on every position,
  and `observePowerTelemetry()` treated every packet without a loss field as a
  restore. GT06 packets can omit `charge` intermittently after sending
  `charge:false`; omission is not proof that external power returned.
- The transition guard itself was present, but the false restore reset the
  episode. The next `charge:false` packet then looked like a new disconnect,
  producing the observed alternating alert spam.

### Bug 1 fix

- Voltage observation no longer mutates the power-connection state. Only the
  power telemetry transition logic calls `markVehicleConnected()` or
  `markVehicleDisconnected()`.
- Power-flag polarity is respected: `externalPower:false` means loss, while
  named loss flags such as `powerCut`/`powerLost` mean loss when true and
  restoration when explicitly false. This prevents a false loss/restore pair
  from being generated by the same packet.
- A confirmed explicit-loss episode now stays disconnected until an
  affirmative restoration signal arrives (`charge:true`, external power
  explicitly on, a loss flag explicitly false, or a recognized restored/normal
  alarm). A packet that merely omits `charge` is ignored for restoration.
- Repeated loss packets therefore remain silent; the next affirmative restore
  produces one restore alert, and the following loss starts one new episode.
- The existing in-memory per-device guard remains keyed by Traccar device ID.
  Surviving a process restart requires the separate persistent-episode follow-up
  because the current alert state is not stored in the database as a state
  machine.

### Bug 2: external power loss is not device offline

- REST device status no longer checks `isVehicleDisconnected()` when deciding
  connection status. A fresh position means `status: "online"` even when
  `powerDisconnected: true`.
- Live WebSocket position updates now keep `status: "online"` whenever the
  position itself is fresh. A silence-triggered alert can still set the UI to
  offline; a telemetry-triggered external-power alert keeps it online.
- The map fallback exposes the confirmed per-device `powerDisconnected` flag
  independently of the fresh-position status.
- Client device cards and map popups show `على البطارية الداخلية` /
  `Sur batterie interne` only when the tracker is still online with external
  power lost. They do not replace `moving`, `idle`, or `stopped`, so a moving
  bike remains moving.

### Bug 3: engine command chain

- The current command chain was traced on `main`: the protected frontend action
  posts to `/api/devices/:id/command`, the route resolves the mapped Traccar
  device when possible, defaults unknown/GT06-family devices to `custom`, and
  calls `traccar.sendCommand()`.
- `backend/src/services/traccar.js` logs the exact non-secret request and
  Traccar response/error. The GT06/WanWay payload remains
  `RELAY,1,0#` for stop and `RELAY,1,1#` for resume.
- No engine code was changed in this delivery because the source path and
  payload were already correct, and the prior authenticated DACIA checks
  recorded HTTP 200 plus Traccar acceptance. A physical relay movement was not
  claimed without a safe live-device test.

### Verification

| Requirement | Result | Evidence |
|---|---|---|
| One alert per explicit loss episode | PASS by transition trace and helper smoke test | missing `charge` does not restore; repeated `charge:false` stays in the same episode |
| One restore alert per real restore | PASS by transition trace and helper smoke test | restore requires an affirmative signal for explicit-loss episodes |
| External power loss keeps a reporting tracker online | PASS by source audit | REST/WS status depends on fresh telemetry, not `powerDisconnected` |
| True silence can still show offline | PASS by source audit | silence trigger remains separate and sets offline only after the five-minute window |
| Distinct internal-battery state | PASS by source audit | client device list and map popup show bilingual internal-battery label |
| Engine RELAY payload | PASS by source audit and prior live Traccar response | `custom` + `RELAY,1,0#` / `RELAY,1,1#` |
| Bike at 35 km/h | PASS locally; moving-bike production capture unavailable | `18.9` knots → `35` km/h; status threshold remains `>2` |
| Real voltage / no fabricated voltage | PASS | `batteryLevel` remains percentage; helper smoke test returns no voltage from percentage-only data |
| Per-device state isolation | PASS by source audit | power state and frontend updates remain keyed by Traccar/local device ID |
| Build and syntax | PASS | `npm run build`, four backend `node --check` runs, and `git diff --check` |

### Live verification limits

- Before this fix, production health returned HTTP 200 with database connected
  and Traccar reachable. The authenticated account exposed DACIA/Traccar `70`
  only.
- The production alert history was sufficient to identify the alternating
  spam root cause. A physical battery pull/restore was not performed, so no
  physical relay or hardware transition is claimed.
- Replit deployment metadata reports no active deployment for this workspace;
  `athargps.com` is an external production runtime. The pushed commit must be
  picked up by that runtime before the post-fix live API behavior can be
  certified.

## Regression fix — moving bike speed/status consistency

### Investigation and root cause

- `getDeviceStatusKey` in `src/components/ui.jsx` is correct: after an online
  device has a valid GPS fix, `speed > 2` means `moving`; otherwise it falls
  through to `idle`/`stopped`.
- The normal `/api/devices` response already converts Traccar knots through
  `speedKmh`, and the authenticated WebSocket bridge already converts each
  position through the same helper.
- The fallback path used when the WebSocket is disconnected,
  `src/context/AppContext.jsx -> startFallbackPolling -> /api/map/positions`,
  had a real inconsistency: `backend/src/routes/map.js` returned raw
  `position.speed` instead of km/h. That line was introduced by `e90686ff3`.
  This could make the fallback map disagree with the device API and violated
  the product-wide km/h contract.
- The power-alert commits, including `a2a9f5e`, do not touch speed conversion,
  status computation, or position selection. No evidence supports blaming
  those alert edits for the speed regression.

### Fix

- `backend/src/routes/map.js` now imports the shared `speedKmh` helper and
  returns `Math.round(speedKmh(position?.speed))`, matching `/api/devices`,
  WebSocket positions, sharing, and reports.
- Example verified locally: raw Traccar `18.9` knots → `35` km/h; the
  frontend status rule then returns `moving` for an online device with a
  valid GPS fix.
- No database schema, Traccar internals, authentication, subscriptions, map
  tiles, engine command logic, or power-alert logic was changed.

### Regression checklist

| Requirement | Result | Evidence |
|---|---|---|
| Engine cut/resume payloads | PASS by source audit; prior live DACIA test recorded | `RELAY,1,0#` / `RELAY,1,1#` path unchanged |
| Disconnect alert exactly once | PASS by source audit; live battery pull not repeated here | transition guard remains in `observePowerTelemetry` |
| Restore alert exactly once | PASS by source audit; physical restore not run here | `current.disconnected` restore transition remains one-shot |
| Per-device state isolation | PASS by source audit | Maps/Sets and frontend updates are keyed by Traccar/local device ID |
| Voltage honesty | PASS by source audit and current production response | real value only when reported; otherwise `null`/localized no-data state |
| Moving speed path | PASS locally; production moving-bike comparison pending | all four live speed paths use `speedKmh`; `18.9` knots → `35` km/h |

### Live verification limits

- Production health and authenticated API checks passed on 2026-08-13.
- The available production account currently exposes DACIA/Traccar `70` only;
  DACIA was offline with `speed: 0` at the check time. It does not expose the
  reported moving bike / Traccar `37`, so a live raw-speed-vs-API comparison
  for the moving bike could not be honestly performed.
- Real battery pull/restore and engine actuation were not repeated as part of
  this regression fix. Existing live DACIA command results and the alert
  transition code audit remain recorded above.

## Live verification — DACIA command delivery and current telemetry

- Production checks on `https://athargps.com` returned HTTP 200 for the public
  health endpoint (`status: ok`, database `connected`, Traccar `reachable`),
  authenticated login, and the authenticated device list.
- The supplied Amin account can see DACIA only: local device `16`, Traccar
  device `70`. `bekane` / Traccar `37` is not visible to this account and was
  not commanded.
- With DACIA confirmed parked and safe, the live command endpoints returned
  HTTP 200 for both actions. The exact Traccar responses were:
  `engineStop` → `{ deviceId: 70, type: "custom", attributes: { data:
  "RELAY,1,0#" } }`; `engineResume` → `{ deviceId: 70, type: "custom",
  attributes: { data: "RELAY,1,1#" } }`. This proves the application sent the
  expected request and Traccar accepted it; it does not by itself prove the
  physical relay moved.
- A live WebSocket position for Traccar `70` was captured with raw attributes:
  `type:19`, `status:134`, `ignition:true`, `charge:true`, `blocked:true`,
  `batteryLevel:100`, `rssi:3`, `distance:0`, `totalDistance:84563876.2733509`,
  `motion:false`, and `hours:6970863`. No `powerCut`, `externalPowerLost`,
  or equivalent explicit power-loss flag was present in that healthy packet.
- Physical battery-pull verification was not performed remotely. The actual
  tracker must be disconnected while its final WebSocket packet is captured
  to determine whether this hardware emits an immediate power-loss flag; if
  it emits no such flag, the five-minute silence fallback remains the honest
  trigger.

## Follow-up — forward immediate power-loss state over the live socket

- The backend already detected explicit tracker power-loss attributes, but the
  Traccar WebSocket bridge replaced every outgoing position with
  `powerDisconnected: false`. Because the alert insert is asynchronous, the
  live client could briefly keep a vehicle looking connected after the
  last packet had already reported a power loss.
- The bridge now forwards the same explicit `charge:false` / power-loss
  detection result used by the alert observer, or the confirmed per-device
  disconnect state after persistence. The client position merger now uses that
  state to show the device offline immediately; the existing alert event still
  handles persistence, banners, and notifications.
- Engine command payloads, Traccar internals, database schema, authentication,
  subscriptions, maps, and replay behavior were not changed.

### Verification

- [x] `npm run build` passes after the change.
- [x] Backend `node --check` passes for the changed backend modules.
- [x] `git diff --check` passes.
- [ ] Live Traccar telemetry and physical battery-pull verification remain
  unavailable in this environment because the deployed Traccar URL and device
  credentials are not present.

## Follow-up — real immediate power telemetry and command delivery

- Root causes found on `main`: the engine route made an optional Traccar device lookup a hard prerequisite, so a lookup failure stopped the command before `/api/commands/send`; the disconnect observer only watched silence and treated every received packet as a fresh timer reset, so it ignored explicit GT06 power-loss flags and could stay silent forever on repeated stale packets.
- Engine commands now attempt protocol discovery with a short timeout, fall back to the required GT06/WanWay custom command when the protocol is missing or the lookup fails, and log the exact method/path/body plus the returned Traccar response without logging authentication. The payload remains `custom` with `attributes.data` equal to `RELAY,1,0#` or `RELAY,1,1#`.
- Disconnect detection now has two honest paths: explicit `charge:false` / equivalent power-loss telemetry creates the alert immediately; otherwise a five-minute silence window is measured from the newest real telemetry timestamp and duplicate stale positions do not reset it. The alert is de-duplicated until a non-loss position returns.
- Voltage behavior remains conservative: missing voltage is not a disconnect signal, no voltage is fabricated, and the existing shared formatter/state continue to control every visible voltage surface.
- Files changed: `backend/src/index.js`, `backend/src/services/vehicleTelemetry.js`, `backend/src/services/traccar.js`, `backend/src/routes/devices.js`, and this log.

### Verification

- [x] `npm run build` passes.
- [x] Backend `node --check` passes for all four changed JavaScript modules.
- [x] `git diff --check` passes.
- [x] Unit smoke checks pass for `charge:false`, `powerCut`, non-power alarms, and last-known voltage caching.
- [x] Mocked Traccar smoke check confirms the command request uses `POST /api/commands/send` with the expected `deviceId`, `custom` type, and RELAY payload, and returns the mocked Traccar response.
- [ ] Live Traccar response and physical engine cut/resume for bekane (Traccar `37`) and DACIA (Traccar `70`) could not be run from this environment; deployed Traccar credentials and reachable devices were not available.
- [ ] Live battery-pull verification could not be run here; production must confirm the actual GT06 attribute name emitted immediately before power loss.
- [ ] Authenticated production `/api/health` was not claimed because no deployed application credentials or production URL were available.

## Restore engine cut and make power disconnect honest

- Root cause confirmed in `backend/src/index.js`: `observePowerTelemetry` set
  `lastPositionAt` to the current time and then immediately tested that same
  value for staleness. The silence branch was therefore unreachable, so a
  tracker that stopped reporting could never reach the disconnect alert.
- The fix schedules one five-minute silence check from each real Traccar
  position. A newer position cancels and replaces the check. Only when no new
  position arrives for the full window does the server create one
  `power_disconnected` alert, mark the episode as disconnected, clear the
  cached voltage, and allow the next position to begin a new episode.
- Missing voltage in an otherwise current position never starts or resets a
  disconnect alert. The last real voltage remains cached while positions
  continue. A device with no voltage ever reported stays at `—`; it is not
  labelled `مفصول` merely because its voltage field is absent.
- The engine command path was traced and remains the minimal GT06/WanWay
  route: `POST /api/devices/:id/command` calls Traccar `sendCommand` with
  `type: "custom"` and attributes
  `data: "RELAY,1,0#"` for `engineStop` or `data: "RELAY,1,1#"` for
  `engineResume`. An explicitly known non-relay protocol uses the standard
  Traccar command instead.
- Added one shared `powerDisconnected` API state and updated the shared
  `formatVoltage` helper plus every voltage render site: client device list,
  client detail, client live-map popup, admin all-devices, admin client detail,
  map popup, and live marker. The formatter now renders the real value,
  `مفصول` / `Déconnecté` only for the backend-confirmed state, and `—`
  otherwise. Stale stored coordinates are not treated as fresh telemetry.
- Files changed: `backend/src/index.js`,
  `backend/src/services/vehicleTelemetry.js`,
  `backend/src/routes/devices.js`, `backend/src/routes/map.js`,
  `src/components/ui.jsx`, `src/context/AppContext.jsx`,
  `src/components/MapView.jsx`, `src/components/LiveVehicleMarker.jsx`,
  `src/pages/client/LiveMap.jsx`, `src/pages/client/DeviceList.jsx`,
  `src/pages/client/DeviceDetail.jsx`, `src/pages/admin/ClientDetail.jsx`,
  `src/pages/admin/AllDevices.jsx`, and this log.

### Verification

- [x] `npm run build` passes after the implementation.
- [x] Backend `node --check` passes for `index.js`, `vehicleTelemetry.js`,
  `devices.js`, and `map.js`.
- [x] `git diff --check` passes.
- [x] The source audit confirms every visible voltage render uses
  `formatVoltage(..., powerDisconnected)`.
- [x] The source audit confirms the exact RELAY payload strings for both
  engine actions.
- [ ] Live Traccar command results for bekane (local device `14`, Traccar
  `37`) and DACIA (local device `16`, Traccar `70`) could not be run from this
  environment because production application credentials and reachable GPS
  devices were not available.
- [ ] No live authenticated `/api/health` or device API response was claimed;
  the production runtime check must be performed on the deployed server.

## GT06 vehicle-voltage follow-up — raw audit and last-known cache

- The production raw-data audit already recorded on this branch was checked before this change. Traccar device `37` (`bekane`) exposed position/telemetry keys such as `ignition`, `satellite`, and `distance`; it did not expose `voltage`, `power`, `externalPower`, `adc1`, `adc`, `analog1`, `vbat`, `supply`, or a voltage-like `battery` value.
- Traccar device `70` (`DACIA`) exposed `batteryLevel` as an internal percentage together with signal/status fields such as `rssi`, `alarm`, `charge`, `blocked`, and `ignition`; it did not expose an external-voltage field. The same absence was recorded for the recent stored positions checked in that audit. `batteryLevel` is never treated as volts.
- The backend now checks the GT06/WanWay voltage candidates in this order: `voltage`, `power`, `externalPower`, `adc1`, `adc`, `analog1`, `vbat`, `supply`. A raw `battery` field is accepted as volts only when it is in the plausible 9–15 V range; otherwise it remains a percentage candidate. Every accepted value must still be finite and greater than zero.
- Added an in-memory last-known-good cache keyed by Traccar device ID. A position that omits voltage refreshes the connected-device grace window, so a stopped tracker keeps its last real voltage. The cache expires after the existing 10-minute frontend disconnect grace and is also cleared when the existing power-disconnect alert confirms a genuine disconnect. No voltage is fabricated when no tracker field exists.
- The devices REST route, map REST route, and live WebSocket bridge use the same extraction/cache behavior. Engine-cut/RELAY, map position flow, authentication, subscriptions, replay, and database schema were not changed.

### Verification status

- [x] Raw attribute findings and the absence of external voltage are recorded above from the branch's prior production audit.
- [x] Backend JavaScript syntax checks and `git diff --check` pass.
- [ ] Live Traccar re-fetch and authenticated end-to-end API response require the deployed Traccar credentials/device connection; those credentials were not present in this development environment.

## LiveMap — only devices launcher and search icon

- Deleted the rendered green Live/reconnecting indicator, the auto-follow control, the hidden status-legend JSX, the recenter control, the drag handle/status-chip bottom-sheet header, and the full-width bottom-sheet container from `src/pages/client/LiveMap.jsx`.
- Replaced the removed sheet trigger with one small `أجهزتي` / `Mes appareils` button that is the only control that opens the device list. The existing device filtering, selection, route, Google Maps, Waze, popup, marker, and movement logic remain unchanged inside a bounded floating card with `45vh` maximum height and internal scrolling.
- Changed search from a permanent bar to one magnifier icon. The icon reveals the existing search input and its X closes the input and clears the query. `MapContainer` keeps `zoomControl={false}` and no `<ZoomControl>` remains.
- Grep proof after the edit: `ZoomControl` = `0`; `aria-pressed={autoFollow}` = `0`; no `athar-map-legend`, `athar-map-recenter`, `Bottom Panel`, `Live indicator`, or `تتبع تلقائي` remains. `setPanelOpen` appears only on the devices launcher handler, and the Live-text grep is empty.
- Files changed: `src/pages/client/LiveMap.jsx` and this log. MapContainer, MapLayers, FlyTo, FlyToUser, markers, Polyline, Popups, WebSocket/live position updates, engine commands, replay, subscriptions, and ErrorBoundary were not changed.

### Verification

- [x] `npm run build` passes.
- [x] Largest generated JavaScript asset is below 500 KB (`383.15 KB`).
- [x] `git diff --check` passes.
- [x] LiveMap control-removal grep checks pass.

## LiveMap visual cleanup — cosmetic only

- Fix B — `src/pages/client/LiveMap.jsx:392-393`: moved the existing auto-follow control from the upper-left stack to the upper-right. Its click handler, state, local-storage preference, and map-follow behavior remain unchanged.
- Fix C — `src/pages/client/LiveMap.jsx:94`: reduced the expanded device-sheet height from `480px` to `380px` so the map remains visible when the sheet is open. The sheet content, device selection, route loading, and navigation actions remain unchanged.
- Fix D — `src/components/LiveVehicleMarker.jsx:83`: hid only the ambiguous voltage text from the vehicle marker label. Voltage calculation, color selection, marker movement/rotation, and the detailed popup voltage value remain unchanged.
- These are cosmetic, reversible changes only. The map instance, tile layers, markers, movement smoothing, engine cut/start, replay, subscriptions, settings, WebSocket flow, and ErrorBoundary were not changed.

### Verification

- [x] `npm run build` passed after each of the three fixes.
- [x] `git diff --check` passes.
- [x] Existing live map, marker rendering, movement smoothing, engine-cut path, and replay path remain in place.
- [x] Changes were committed separately per fix and pushed to `origin/main`.

## Fix engine-cut protocol detection

- Root cause: the engine command route inferred the Traccar protocol from the local vehicle `type`/name fields. Those fields describe the vehicle, not the tracker protocol, so RELAY routing could be selected for the wrong device or skipped for a GT06-family tracker.
- Fix: the command route now rejects devices without `traccar_id` with HTTP 400 (`Device has no Traccar mapping`), resolves the mapped Traccar device through the lightweight device endpoint, reads its authoritative `protocol`, and uses RELAY only for `gt06`, `concox`, `wanway`, and `gs900` protocol families. All other protocols use standard `engineStop` / `engineResume`.
- The existing `device_commands` insert and `logAudit` call remain unchanged. The command response keeps `{ ok, type, relay }` and now also returns the actual Traccar response as `traccarResponse`; the `sendCommand(deviceId, type, attributes)` signature remains in use.
- Files changed: `backend/src/routes/devices.js`, `backend/src/services/traccar.js`, and this log. Frontend, Traccar configuration, and database schema were not changed.

### Verification

- [x] `npm run build` passes.
- [x] `node --check backend/src/routes/devices.js` passes.
- [x] `node --check backend/src/services/traccar.js` passes.
- [x] `git diff --check` passes.
- [ ] bekane (GT06, local device id 14) live engine-cut verification requires the deployed backend and reachable GPS device.
- [ ] DACIA (GT06, local device id 16) live RELAY verification requires the deployed backend and reachable GPS device.
- [x] A device without `traccar_id` now returns a clean HTTP 400 before any Traccar command is sent.

### Server-side curl checks

Replace the four credential variables and `BASE_URL` on the server; do not put passwords or tokens in shell history.

```sh
BASE_URL=https://your-athargps-server.example
MUSTAPHA_EMAIL='mustapha-account-email'
MUSTAPHA_PASSWORD='mustapha-account-password'
AMIN_EMAIL='amin-account-email'
AMIN_PASSWORD='amin-account-password'

MUSTAPHA_TOKEN=$(curl -fsS "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg email "$MUSTAPHA_EMAIL" --arg password "$MUSTAPHA_PASSWORD" \
    '{email:$email,password:$password}')" | jq -r '.token')

curl -fsS -X POST "$BASE_URL/api/devices/14/command" \
  -H "Authorization: Bearer $MUSTAPHA_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"type":"engineStop"}'

curl -fsS -X POST "$BASE_URL/api/devices/14/command" \
  -H "Authorization: Bearer $MUSTAPHA_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"type":"engineResume"}'

AMIN_TOKEN=$(curl -fsS "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg email "$AMIN_EMAIL" --arg password "$AMIN_PASSWORD" \
    '{email:$email,password:$password}')" | jq -r '.token')

curl -fsS -X POST "$BASE_URL/api/devices/16/command" \
  -H "Authorization: Bearer $AMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"type":"engineStop"}'

curl -fsS -X POST "$BASE_URL/api/devices/16/command" \
  -H "Authorization: Bearer $AMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"type":"engineResume"}'

# Use any local device id whose database row has a NULL traccar_id.
curl -i -X POST "$BASE_URL/api/devices/<device-id-without-traccar-mapping>/command" \
  -H "Authorization: Bearer $MUSTAPHA_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"type":"engineStop"}'
# Expected: HTTP/1.1 400 and {"error":"Device has no Traccar mapping"}
```

## Finish voltage feature — safe separation of external voltage and internal battery

- Production attributes previously confirmed for the real devices remain unchanged: DACIA (Traccar device 70) reports internal battery `33%` and signal only; bekane (Traccar device 37) reports ignition, satellite, and distance data only. Neither device reports external/main-power voltage, `power`, `voltage`, `externalPower`, `adc1`, or `analog1`.
- Decision: Branch B. The API now exposes `voltage` and `batteryLevel` as separate fields. Voltage is read only from `power`, `voltage`, `externalPower`, `adc1`, or `analog1`; missing, zero, or invalid values become `null`. Internal battery percentage is read only from `batteryLevel` or `battery`.
- The client and admin interfaces show voltage in volts with the requested thresholds: `>=13.2` green, `12.4–13.2` amber, `12.0–12.4` orange, `<12.0` red. Missing, zero, or offline voltage shows `مفصول` / `Déconnecté`; no voltage is fabricated. Battery percentage remains a small secondary value where available.
- The implementation is ready to display voltage automatically when a device starts reporting it. The real fix for the two current devices is hardware-side: enable main-power voltage reporting with the device SMS command or use a firmware/model that emits a supported voltage attribute. A Traccar `gt06.codec` change was not attempted.
- Files changed: `backend/src/routes/devices.js`, `backend/src/routes/map.js`, `backend/src/routes/clients.js`, `src/context/AppContext.jsx`, `src/components/LiveVehicleMarker.jsx`, `src/components/MapView.jsx`, `src/components/ui.jsx`, `src/index.css`, `src/pages/client/DeviceDetail.jsx`, `src/pages/client/DeviceList.jsx`, `src/pages/client/LiveMap.jsx`, `src/pages/admin/ClientDetail.jsx`, and `src/pages/admin/AllDevices.jsx`.

### Preservation checklist

- [x] Engine cut/start RELAY command path preserved.
- [x] Live map and live position flow preserved.
- [x] Replay player and route loading preserved.
- [x] Subscription and renewal behavior preserved.
- [x] Global ErrorBoundary preserved.
- [x] `npm run build` passes; largest generated JavaScript asset is 383.20 KB.
- [x] `git diff --check` passes.
- [ ] Authenticated live-device verification still requires a reachable backend and GPS device.

## Follow-up fix — LiveMap vehicle marker render crash

- Root cause: `src/components/LiveVehicleMarker.jsx` read `initialBearingRef.current` while initializing `rotationRef` before `initialBearingRef` itself was declared. When the live map rendered a positioned device, JavaScript threw a temporal-dead-zone `ReferenceError`.
- Exact fix: initialize `initialBearingRef` first, then initialize `rotationRef` from its value. Map marker animation, follow behavior, and trail rendering remain unchanged.
- Verification: `npm run build` passes, `git diff --check` passes, and the fix is pushed to `origin/main`.

## Crash fixes — LiveMap open and subscription renewal

- Fixed the LiveMap crash on open. Root cause: the status-count calculation still called `devices.filter(...)` directly while the app context could temporarily provide an undefined device list. Exact fix: reuse the existing `safeDevices` fallback and filter null entries before calculating status counts in `src/pages/client/LiveMap.jsx`.
- Fixed the subscription renewal crash. Root cause: `dateOnly(new Date())` converted a Date object to a non-ISO display string such as `Wed Aug 12`, which made `addMonths` receive an invalid date and throw while rendering renewal actions. Exact fix: normalize Date and string inputs safely, add a deterministic date/plan fallback, and normalize the renewal email before building contact URLs in `src/pages/client/Subscriptions.jsx`.
- Files changed: `src/pages/client/LiveMap.jsx`, `src/pages/client/Subscriptions.jsx`, and this log.

### Verification checklist

- [x] LiveMap opens without the ErrorBoundary crash.
- [x] Subscription renewal opens the plan choices safely.
- [x] Trip replay player remains untouched and continues to use the existing stable playback path.
- [x] ErrorBoundary remains in place as a permanent safety net.
- [x] Engine cut/start path remains untouched.
- [x] `npm run build` passes.
- [x] Largest generated JavaScript asset is below 500 KB (383.15 KB).
- [x] `git diff --check` passes.

## Crash guards and conservative LiveMap cleanup

- Added a global React `ErrorBoundary` around the application. Rendering errors now show the bilingual `حدث خطأ غير متوقع` / `Une erreur inattendue` screen with a page reload action instead of leaving a black screen.
- Guarded device arrays, report chart payloads, subscription cards, settings sub-user responses, and replay Leaflet lifecycle calls before using `.map()`, `.filter()`, `.reduce()`, or map methods.
- Kept the existing LiveMap map, markers, `useMap`, follow, route, and device-sheet logic. The compact `أجهزتي` launcher remains, and the locate button now sits on the left side away from Leaflet's bottom-right zoom controls. Existing live/follow/legend controls remain hidden without removing their underlying state or map behavior.

### Verification checklist

- [x] `npm run build` passed.
- [x] Largest generated JavaScript asset is below 500 KB (383.20 KB).
- [x] `git diff --check` passed.
- [ ] Authenticated live-map and replay verification still requires a reachable backend and GPS device.

## Phase 2/3 completion — replay, reports, and real renewal messaging

- Trip replay is already delivered on `main` through the existing replay commits: one stable Leaflet map remains mounted during playback, map sizing is invalidated after the sheet transition, playback rendering is throttled, and period/day selection is held in stable state. The flow is range/day selection → load trips → select a trip → one replay map.
- Reports no longer displays the `بيانات حقيقية` / `Données réelles` badge. The existing real report values, chart data, and unified period selector remain unchanged.
- Client renewal now uses the same 3/6/12-month plans and prices as the backend subscription service. The WhatsApp/email message includes the selected plan and a projected expiry calculated from the later of today or the current subscription end date, using the same calendar-month logic as the renewal endpoint.
- Files changed for this completion: `src/pages/client/Reports.jsx`, `src/pages/client/Subscriptions.jsx`, and this log.

### Verification checklist

- [x] `pnpm install` completed without rewriting the tracked lockfile.
- [x] `npm run build` passed.
- [x] Largest generated JavaScript asset is below 500 KB.
- [x] `git diff --check` passed.
- [x] Engine cut/start code path preserved.
- [x] Live map and replay code paths preserved and included in the existing `main` history.
- [ ] Live engine, live map, and replay device verification requires an authenticated backend and a reachable GPS device.

## Completed tasks

- Current task — Mobile UI cleanup, single engine toggle, and replay-map reliability
- Removed the exact Arabic engine helper strings `سيتم إيقاف محرك المركبة عن بعد`, `سيتم تشغيل محرك المركبة عن بعد`, `المحرك يعمل حالياً`, `المحرك متوقف حالياً`, and `حالة الزر تعكس الحالة الحقيقية للجهاز. لن تتغير إلا بعد تأكيد تنفيذ الأمر.` together with their inline French equivalents. The engine status remains a dot plus a short bilingual state label, and the command action is one large state-colored button.
- Renamed the playback tab and replay header from `الرحلات` / `Trajets` to `إعادة المسار` / `Rejouer le trajet`.
- Replay-map root causes addressed: playback was reconciling Leaflet too frequently, the map surface did not declare a minimum stable height, and overlay resizing needed to remain independent from playback updates. The map now keeps one mounted `MapContainer`, renders playback positions at a 250ms cadence through the existing ref-driven frame loop, has an explicit full-viewport/minimum height, and retains the post-sheet-transition `invalidateSize` synchronization.
- Unified DeviceDetail and Reports period selectors into accessible segmented controls with one active state and bilingual 1/7/15/30-day labels. Existing range fetch/filter behavior was preserved.
- Raised the LiveMap bottom panel and map controls above the fixed ClientNav safe-area offset so the panel, legend, recenter action, and Leaflet controls are not covered on mobile.
- Files changed: `src/pages/client/DeviceDetail.jsx`, `src/components/TripReplay.jsx`, `src/pages/client/Reports.jsx`, `src/pages/client/LiveMap.jsx`, `src/i18n/translations.js`, `src/index.css`, and this log.

### Previously-working feature preservation checklist

- [x] Live map and `مباشر` / live connection indicator — map and WebSocket code paths were not changed.
- [x] Device list and device detail — navigation, device selection, and detail data paths were not changed.
- [x] Engine cut/start — existing confirm modal, `toggleEngine`, RELAY command path, toast handling, and in-flight state were preserved; only the surrounding presentation was cleaned.
- [x] Trips/replay — existing positions API, playback controls, route calculations, and Leaflet layers were preserved; only render cadence, stable sizing, and labels changed.
- [x] Reports — existing report fetch and selected-period boundaries were preserved; only selector presentation and translated labels changed.
- [x] Alerts and settings — no functional code in either screen was changed.
- [x] Arabic/French switch and RTL/LTR — all new labels use the existing translation helper and direction handling.
- [x] Session persistence, GPS-await amber state, km/h speed, and subscriptions — no related logic or files were changed.

- Verification: `npm run build` passes, `git diff --check` passes, and the instructional-string scan is clean. Live engine/device verification still depends on an authenticated running backend and a reachable GPS device.

- Current task — Five-item safe-area bottom navigation, real More bottom sheet, and shared Toast feedback
- `0c64756` — Add positions endpoint for trip replay (`GET /api/stats/positions`)
- `eb9e5d6` — Add bilingual trip replay with stop and speed analysis (`TripReplay` component plus client and admin integration)
- `639fedb` — Fix trip replay startup and timeline playback
- Current task — Fix missing `lucide-react` imports and add living project documentation
- Current task — Professional replay UI overhaul: contrast, marker, layout, chart
- Current task — Redesign replay screen: map-first layout, real rotating car, clean sheets
- Current task — Security 0/10: client engine cut-off permissions
- Current task — Design 1/10: additive tokens + base classes (invisible foundation)
- Current task — Design 2/10: splash + login + header restyle

## Design 2/10 — splash, login, and header restyle

- Restyled the initial HTML splash and React onboarding splash with the ATHAR GPS dark surface, gold logo glow, green product tagline, animated gold loader, and fixed 2026 footer.
- Restyled client and admin login surfaces with the light gradient, white rounded cards, icon-led inputs, green focus rings, dark gradient primary actions, and preserved password toggles.
- Restyled the client header with a sticky gradient surface, bilingual greeting, branded logo treatment, and an unread notification dot while preserving the existing alerts handler.
- Presentation-only changes: authentication calls, validation, routing, state, WebSocket behavior, backend, and unrelated pages were not changed.

## Additive design foundation

- Added the Cairo and IBM Plex Sans Arabic font weights through jsDelivr while preserving all existing font tags.
- Added only the new `--ath-*` token namespace, reusable `ath-*` foundation classes, and `ath-*` keyframes.
- No existing CSS variables, classes, Tailwind tokens, pages, components, context, API, backend, Leaflet, or WebSocket code was changed.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.

- Product UI remains unchanged because no existing screen consumes the new `ath-*` foundation yet.

## Client engine cut-off permissions

- Added device ownership authorization for `GET /api/devices/:id` and `POST /api/devices/:id/command`.
- Admins and managers retain fleet-wide access; clients can only read and control devices assigned to their own account.
- Restricted engine commands to `engineStop` and `engineResume`, with clear unauthorized and invalid-command responses.
- Restored the client command tab for all clients with bilingual confirmation, success/failure toasts, and an in-flight disabled state.
- Preserved the DeviceDetail battery display and did not modify TripReplay, LiveMap, Reports, WebSocket, tiles, or MapLayers.

## Verification

- `npm run build` passes successfully.
- `node --check backend/src/routes/devices.js` passes.
- `git diff --check` passes.

## Import audit result

- Fixed file: `src/pages/client/DeviceDetail.jsx`
- Missing icon fixed: `Play`
- `src/components/TripReplay.jsx` already imported every Lucide icon it uses.
- The automated audit found no remaining missing Lucide icon imports in the JSX/JS source files. Names reported by a broad JSX symbol scan that are not Lucide imports are local components or imports from other libraries.

## Verification

- `npm run build` passes.
- The production bundle emits no `is not defined` warnings.

## Professional replay UI overhaul

- Rebuilt `src/components/TripReplay.jsx` with solid dark overlay surfaces, compact route metadata, a rotating SVG car marker, stable map sizing/follow behavior, a non-overlapping bottom control stack, and green brand speed controls.
- Rebuilt the client trip speed visualization in `src/pages/client/DeviceDetail.jsx` as a real dark `AreaChart` from route positions, with a clean bilingual empty state.
- Backend, API, database, Traccar, and unrelated screen styling were not changed.

## GPS outlier filtering and realistic trip statistics

- Added a shared server-side `cleanPositions` pipeline that drops invalid coordinates and timestamps, sorts fixes, and removes teleport jumps over 220 km/h from the last kept point.
- Applied cleaned positions to replay responses, trip reports, and daily distance summaries so route maps, speed charts, distances, and durations use sane data only.
- Added the same validation and teleport filter to replay routes and the client device mini-map to protect the UI from stale cached responses.
- Preserved the existing Arabic/French UI and Traccar/database boundaries.

## Map-first replay screen

- Reworked `src/components/TripReplay.jsx` into exactly three non-overlapping layers: full-height map, compact top bar, and one bottom sheet.
- The collapsed sheet keeps the timeline, speed chips, playback controls, and four fully visible stats chips together; tapping the handle expands driver analysis and jumpable events.
- Replaced the oversized car marker with a compact top-view red SVG car that rotates with bearing, reduced start/end/stop/event marker sizes, and removed the end glow.
- Preserved the replay engine, behavior detection, Arabic/French translations, and existing API/backend boundaries.

## Verification

- `npm run build` passes successfully with no `is not defined` warnings.

## Realistic GPS replay car marker

- Replaced the replay car marker artwork with the provided realistic vehicle image at `public/athar-replay-car.png`.
- Kept the existing map, route, controls, and replay behavior unchanged while making the marker use interpolated GPS coordinates and smooth bearing transitions.
- Marker size responds to Leaflet zoom level within safe bounds, retains its correct orientation after zoom changes, and uses a soft drop shadow.

## Real car marker and trips tab audit

- Added the client-provided Mercedes image at `src/assets/car-marker.png` and wired it into `TripReplay.jsx` through the Vite asset pipeline.
- Replaced the replay marker artwork with a fixed 54×38px image marker using `mix-blend-mode:multiply`, a subtle drop shadow, centered anchoring, and smooth bearing rotation.
- Added bilingual trip-range presets for today, 7 days, 15 days, and a custom date range.
- Added custom-range validation with an inline 15-day limit message and refetching of the trips, route preview, and speed data whenever the range changes.
- Added a full-range replay action that passes every loaded point in the selected date range to the replay overlay.
- Reworked speed chart data to use every plotted GPS point, real km/h values, a bounded Y axis, non-duplicated time ticks, and a clear empty state.
- Normalized trip start/end, distance, maximum speed, and point-count fields before rendering, and formatted trip timestamps consistently in Arabic and French.
- Classified trips under 0.05 km with maximum speed under 1 km/h as stops and removed their replay action.
- Replaced bare quick-stat dashes with the localized no-data state.
- Added all new Arabic and French labels to `src/i18n/translations.js`.

## Verification

- `npm run build` passes successfully.
- The build output contains no `is not defined` warnings or build errors.
- `git diff --check` passes.

## Fix route button clearing the live map

- Stopped the route button click from bubbling into the device card button, which was clearing the selected device and immediately resetting the loaded route.
- Added coordinate range and null-island filtering before fitting the live route bounds.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.

## Vehicle types and bike marker

- Added bilingual car/motorcycle vehicle-type infrastructure with motorcycle as the default for new devices.
- Added the supplied red sport motorcycle marker with full transparency, preserved orientation, and a final optimized size of 31.23 KB.
- Wired the vehicle asset registry into live maps, trip replay, public sharing, client/admin device lists, and vehicle editing.
- Calibrated both vehicle assets with an offset of `-135°`: bearing 0° → nose up, 90° → right, 180° → down.
- Added safe startup migration to set missing, blank, or unsupported device types to `bike`; create/update APIs now validate and persist only `car` or `bike`.

## Verification

- `npm run build` passes successfully.
- Backend JavaScript syntax checks pass.
- `git diff --check` passes.

## Vehicle types 2/2: truck markers

- Added the supplied blue Mercedes Actros truck marker at `src/assets/truck-marker.png` with full transparency, preserved orientation, and an optimized size of 59.9 KB.
- Extended the shared vehicle selector and vehicle icon support with `شاحنة` / `Camion`.
- Enabled `truck` in device creation and update validation, preserved existing `bike` defaults, and kept the existing marker consumers and replay engine unchanged.

## Design 4/10 — devices list restyle + battery on cards

- Restyled the client device list with an Athar card surface, search input with clear action, RTL-safe status filter chips, status stripes and badges, vehicle-type icon tiles, moving-device speed blocks, and a friendly empty state.
- Added battery progress indicators to device cards with green, amber, and red thresholds while safely hiding the indicator when battery data is unavailable.
- Preserved live search/filter behavior, device detail navigation, subscription renewal actions, vehicle-type helper usage, and Arabic/French labels. Card entrance motion respects reduced-motion preferences.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.
- Modified UI files: `src/pages/client/DeviceList.jsx` and `src/components/ui.jsx`; this task log entry records the delivery.
- Calibrated the truck marker with an offset of `-135°`: bearing 0° → nose up, 90° → right, and 180° → down.

## Fix black map and frozen replay

- Removed manual `map.remove()` from the replay lifecycle helper; `MapContainer` owns Leaflet cleanup, and manual removal broke the map during React Strict Mode remounts.
- Added the same 3-second satellite fallback to the live map so a blocked satellite provider cannot leave that surface black.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.

## On-demand loading and live connection resilience

- Device selection on the client and admin live maps only pans/selects and opens the device card; it does not request historical positions.
- Added explicit bilingual “show today's route” actions that fetch a bounded route only after the user asks for it.
- Trips tab now loads a lightweight trip list first; the map and speed chart remain empty until the user loads the selected range route.
- Added `maxPoints` stride sampling to `GET /api/stats/positions`, preserving the first and last fix and capping returned routes.
- Removed route payloads from trip-list responses; individual trip replay loads its route on demand.
- Added WebSocket ping/pong health checks, bounded exponential reconnect backoff, and 15-second `/api/map/positions` polling while disconnected.

## Verification

- Production frontend build passes successfully.
- Backend JavaScript syntax checks pass.
- `git diff --check` passes.

## Performance rescue

- Restored a lightweight car marker export at `160×107` and `33.82 KB` (previously `1536×1024` and approximately `2.4 MB`).
- Simplified replay casing, main, traveled, and speeding overlays to bounded point sets; mini-map routes are capped at 600 points.
- Bucketed client and report speed charts to a maximum of 300 points and throttled the replay traveled overlay to two updates per second.
- Enabled Leaflet Canvas rendering across map surfaces, added a `#0B1220` loading surface with a spinner, and cleaned replay animation/map resources on unmount.
- Added manual Rollup chunks for Recharts, Leaflet/react-leaflet, and Framer Motion. The initial JavaScript chunk is `288.80 KB`; the previous monolithic build emitted approximately `1.22 MB` index chunks.
- Lazy-loaded replay, reports, driver behavior, and admin screens while preserving Arabic/French labels and the existing backend, database, and Traccar boundaries.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.

## Tile fallback chain + bounds + loading skeleton

- Added automatic tile fallback for both map modes: Esri satellite → Geoapify hybrid → OpenStreetMap, and Geoapify normal → OpenStreetMap after more than 10 tile errors within 5 seconds.
- Kept the dark `#0B1220` loading surface and spinner behind every basemap so slow or blocked tiles never expose a black void.
- Added map zoom bounds of 3–19, route `fitBounds` with 40px padding, and replay follow zoom protection at a minimum of 15.
- Added the 3-second replay satellite timeout with Arabic/French fallback notification and persisted map-style behavior.

## Verification

- `npm run build` passes successfully.
- `node --check backend/src/routes/map.js` passes.
- `git diff --check` passes.
- `src/assets/car-marker.png` is below 100 KB.

## Car heading calibration and satellite replay map

- Calibrated the provided blue Mercedes asset with `CAR_ASSET_HEADING_OFFSET = -135°` in replay and live vehicle markers. The acceptance mapping is now bearing 0° → nose up, 90° → right, and 180° → down.
- Added a replay map-style toggle sharing `athargps_map_style` with the live map, defaulting to Esri World Imagery satellite tiles when no style has been selected.
- Added white route casing, green traveled-route emphasis, fading 15-point motion trail, imagery-friendly marker outlines, and speed readout colors: green below 50 km/h, orange from 50–80 km/h, and red above 80 km/h.

## Verification

- `npm run build` passes.
- `git diff --check` passes.

## Design 7/10 — unified client device page and replay entry points

- Reworked the client device header into a unified bilingual surface with vehicle identity, editable device/driver fields, status, and driver phone actions.
- Added driver phone persistence through the existing device info update endpoint, including validation and backwards-compatible creation of the legacy `phone` column when needed.
- Added battery progress, IMEI, last-update, speed, and signal quick stats with RTL-safe tabs and primary actions for the live map, replay, engine command, and driver call.
- The live-map action opens the selected device and flies to its current position through the existing map flow.
- Preserved the existing replay playback engine, positions fetching, Leaflet replay map, WebSocket behavior, and Task-0 engine-cut confirmation flow.

## Verification

- `npm run build` passes.
- `node --check backend/src/routes/devices.js` passes.
- `git diff --check` passes.

## Mobile replay map controls

- Changed replay map following to be user-controlled: dragging or zooming pauses auto-follow, while the visible recenter button restores it.
- Added mobile-safe Leaflet zoom controls, touch gestures, and a compact responsive replay sheet so the route remains visible and pannable during playback.

## Follow-mode false-positive fix

- Disabled replay follow-mode from map-container `pointerdown`, `touchstart`, and `wheel` input events instead of Leaflet `movestart`/`zoomstart` events.
- Leaflet movement events are emitted by both user gestures and programmatic `setView`/`panTo` calls, so they could disable following before playback started. Programmatic camera moves now leave follow-mode enabled, while drag, pinch, and wheel input still pause it.
- The existing re-center button continues to restore follow-mode and the calibrated car marker rotation remains unchanged.

## Final replay polish

- Scaled replay car rotation transitions with the selected playback speed and removed the transition at 4x/8x to prevent a doubled or ghosted car marker.
- Kept speed-chart time endpoints visible with a right margin and `preserveStartEnd`; Y-axis ticks now show values only with one `km/h` axis label.
- Made `تصدير الرحلة` / `Exporter le trajet` open a bilingual printable report with device, range, distance, duration, max/average speed, stops, behavior counts, and efficiency score before calling print.
- Made the device coordinates row copyable with a visible Arabic/French confirmation toast.
- Follow-mode now keeps the car in the visible map area between the top bar and expanded/collapsed sheet while preserving map interaction above the sheet.

## Realistic live map

- Added a bilingual map-style toggle to both live map surfaces. Normal mode keeps Geoapify; satellite mode uses Esri World Imagery with a low-opacity OpenStreetMap label overlay. The choice is persisted locally.
- Added one persistent vehicle marker per device using the existing client car artwork, CSS multiply blending, drop shadow, bearing rotation, and requestAnimationFrame interpolation over approximately 800 ms.
- Added a short fading trail for the selected vehicle, automatic map following, live/offline freshness state, a once-per-second last-update readout, speed, and bearing details.
- Added Arabic and French labels for map, satellite, automatic follow, live, offline, update age, and bearing.
- Batched incoming WebSocket positions per device and flushed them at most twice per second. Existing reconnect, backend, database, and Traccar behavior were left unchanged.
- Preserved low-zoom device clustering in the admin global map; individual devices use the smooth live marker.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.

## Client home page restyle

- Restyled `src/pages/client/Home.jsx` to match the Athar GPS reference with a live fleet card, real status donut and speed, animated status counts, subscription progress, shortcuts, and recent device cards.
- Kept all existing `useApp()` bindings, routes, device detail handlers, subscription calculations, Arabic/French labels, and the shared vehicle icon helper intact.
- Verification: `npm run build` passes and `git diff --check` passes.

## Single-screen home, subscriptions, and More shortcuts

- Reworked `src/pages/client/Home.jsx` into a no-scroll viewport layout containing only the live fleet card, real status grid, and clickable subscriptions summary.
- Added `src/pages/client/Subscriptions.jsx` with real device subscription dates, remaining-day status styling, bilingual empty state, and WhatsApp/email renewal actions.
- Added `/subscriptions` behind the existing client auth guard, moved the four shortcuts into the More sheet, and added the existing logout action there.
- Added `src/config/contact.js` with clearly marked placeholder renewal contacts.
- Verification: `npm run build` passes and `git diff --check` passes.

## Design 3/10 follow-up — 3D carousel and admin-managed renewal contacts

- Added the supplied three promotional images to the client home screen as a fixed-height, auto-rotating, swipeable carousel with Arabic/French copy, dots, touch hover pause, reduced-motion support, and emoji fallback only when an image fails.
- Added public `GET /api/settings/renewal-contacts` and admin-protected `PUT /api/settings/renewal-contacts`, persisted through the existing `app_settings.support_contacts` record with safe defaults.
- Added WhatsApp and email renewal contact fields to the admin Support Settings screen. The client subscription page now loads those values at runtime and disables unavailable links with a friendly hint.
- Removed the old hardcoded renewal contact module; tracking, authentication, WebSocket, and existing support settings remain unchanged.
- Verification: `npm run build`, backend syntax checks, and `git diff --check` pass.

## Design 5/10 — live map chrome restyle + chip polish

- Restyled only the client live-map presentation: rounded bordered map shell with depth vignette, bilingual live status badge, status legend, and glass zoom/recenter controls.
- Enhanced existing live vehicle markers with status-colored rings, vehicle imagery, speed/status labels, and battery-level dots while preserving position interpolation, bearing updates, and WebSocket data flow.
- Restyled live-map popups with device name, plate, status, speed, battery, signal, and a bilingual details link to the existing device detail route.
- Added safe inline padding to device filter chips and spacing below the device-list header so the final chip remains fully visible.
- Preserved `MapContainer`, `MapLayers`, `useMap`, `FlyTo`, fit-bounds, live position updates, Leaflet layers, authentication, and backend behavior.
- Verification: `npm run build` and `git diff --check` pass.

## Design 6/10 — reports restyle + skeletons

- Restyled only `src/pages/client/Reports.jsx`: RTL-safe period chips, 2×2 KPI grid with tabular animated values and per-card green glow, skeleton loading surfaces, green gradient speed chart, bilingual trip rows, replay actions, and a friendly empty state.
- Preserved the existing report fetch, period boundaries, chart bucketing, real report values, Arabic/French support, and the existing TripReplay component/API boundary.
- Added reduced-motion handling for skeletons, KPI count-up, chart entrance, and trip-row entrance motion.
- Verification: `npm run build` and `git diff --check` pass.

## Design 7.1/10 — device page icon, tabs, defaults, and editing

- Safety note: this delivery follows a prior reverted attempt that broke client device-account binding; the existing device source, selectors, route params, and account filtering were intentionally preserved.
- Fixed the device header to use the shared `VehicleIcon`, so motorcycles such as `bikan` no longer render as cars.
- Kept one tab bar with `المعلومات` as the initial tab, and made the quick stats a symmetric 2-column layout with the last-update card spanning both columns.
- Preserved the last known battery, signal, and fuel values when a stale/offline refresh omits live attributes.
- Kept name, driver, phone, plate, and vehicle type editing in the visible form with Save/Cancel controls, the `تم الحفظ ✅` confirmation, and direct calling from the saved phone.
- Verification: `npm run build` and `git diff --check` pass.

## Design 8/10 — alerts, driver behavior, and settings restyle

- Restyled the client alerts screen with counted RTL-safe filters, severity-colored notification tiles, unread indicators, bilingual empty state, and preserved mark-read handlers.
- Restyled driver behavior with an animated real-data safety ring, three behavior metrics, weekly event rows, and a friendly no-data state instead of a misleading zero score.
- Restyled settings with grouped bilingual toggle rows, speed-limit slider and live readout, local persistence, save confirmation, and RTL-safe tabs.
- Presentation-only delivery: existing data fetching, handlers, authentication, backend, WebSocket behavior, and unrelated pages remain unchanged.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.

## Navigation and feedback polish

- Replaced the client navigation with five equal-width destinations: home, devices, live map, alerts, and More.
- Rebuilt More as a full-width bottom sheet with safe-area spacing, backdrop dismissal, Escape support, account shortcuts, and logout.
- Unified device save, engine command, coordinate, IMEI, and share-link feedback through one bilingual accessible Toast component.
- Existing API calls, handlers, authentication, replay behavior, and backend boundaries remain unchanged.

## Athar GPS completion audit

- Security and device ownership: removed the public debug positions endpoint, centralized device access rules for main admins, sub-admins, client owners, and client sub-users, protected IMEI checks, and applied ownership checks to devices, replay, reports, maintenance, driver behavior, maps, and geofences.
- Client functionality audit: verified the client routes and corrected shared ownership enforcement so client device operations cannot cross account boundaries. Renewal actions remain bilingual and preserve WhatsApp/email contact behavior.
- Administration audit: verified the admin dashboard data and device access paths. The remaining gap is visual/design parity work, not a missing admin capability.
- Arabic/French and direction: added the missing French notification labels, made the carousel bilingual without Arabic-only copy, and kept the global document language and RTL/LTR direction synchronized with the selected language.
- Performance: kept promo images as compressed JPG assets, enabled nginx gzip and sanitized access logs, and moved chart rendering to a lightweight SVG component so the Recharts chunk is loaded only by the lazy Reports page.
- Backups: added `scripts/backup-db.sh`, which reads `DATABASE_URL` from `backend/.env`, creates compressed timestamped dumps, and retains the latest seven files. No cron entry was installed automatically.
- Suggested cron (review and install manually): `0 2 * * * /absolute/path/to/Shgps.ma/scripts/backup-db.sh >> /var/log/athargps-backup.log 2>&1`

## Completion verification

- `npm run build` passes successfully.
- Backend JavaScript syntax checks, backup-script syntax check, and `git diff --check` pass.

## Phase 1/3 — real vehicle artwork, smooth live movement, and clean live map

- Replaced the three vehicle marker assets with the supplied transparent artwork and compressed each to approximately 54–60 KB.
- Calibrated artwork offsets per type: car `-125°`, bike `-130°`, truck `-120°`; each value points the visible nose north when the course is `0°`.
- Live markers now normalize heading changes to the shortest `[-180°, 180°]` turn, transition rotation over `800ms`, and interpolate each GPS position over the same `800ms` window.
- Replaced shared vehicle glyphs in client, subscription, maintenance, and admin surfaces with the shared `markerFor()` artwork.
- Removed the global live-map live-status pill, auto-follow overlay button, status legend, route/replay action, and persistent bottom device strip. Added the compact `أجهزتي` / `Mes appareils` launcher and sheet.
- Replaced generic Google Maps and Waze action glyphs with local brand-mark SVG icons while preserving the existing navigation URLs.
- Unified battery thresholds across live markers, device lists, device detail, and admin client detail: above 60% green, above 30% amber, otherwise red; unknown values remain slate.
- Checklist: backend command logic, Traccar, database schema, authentication/session, subscriptions, GPS-await state, speed units, replay, reports, alerts, settings, and engine RELAY command code were not changed. Live-map build path remains intact; engine-cut behavior remains in its existing handler.
- Verification: `pnpm install` completed, `npm run build` passed, `node --check backend/src/routes/map.js` passed, and `git diff --check` passed.

## Replacement vehicle map icons — natural mobile sizing

- Replaced `src/assets/bike-marker.png`, `src/assets/car-marker.png`, and `src/assets/truck-marker.png` with the three supplied top-down images. Each was trimmed to the visible vehicle, kept as RGBA PNG, and resized to a 256px maximum dimension; final files are approximately 41 KB, 54 KB, and 31 KB.
- Verified the processed PNGs have transparent alpha pixels around the vehicles, so no white map tile box or opaque background is introduced. The white truck body remains opaque vehicle artwork, not background.
- Set natural default live-marker artwork sizes to bike `28×46px`, car `34×50px`, and truck `40×58px`; selected devices receive a small bounded `+6/+8px` emphasis.
- Centered the Leaflet anchor horizontally and vertically on each vehicle artwork. Preserved the existing `requestAnimationFrame` position interpolation, shortest-turn rotation, status label, trail, and auto-follow behavior.
- Updated the artwork heading offsets to `0°` because all supplied images point up at bearing `0°`; the existing `transform: rotate(bearing)` path remains intact.
- Backend, Traccar, database schema, WebSocket feed, engine-cut commands, replay logic, and unrelated UI were not changed.

## Professional polish — clean transparent vehicle icons

- Reprocessed `src/assets/bike-marker.png`, `src/assets/car-marker.png`, and `src/assets/truck-marker.png` as RGBA PNGs while preserving the supplied top-down artwork and 256px maximum long side.
- Removed near-white anti-aliased edge pixels only when they were part of the transparent fringe, preserving the opaque white truck body. This removes the faint white halo without erasing vehicle details.
- Verified all three PNGs have corner alpha `0` and retain sub-60 KB sizes: bike `41.1 KB`, car `53.6 KB`, truck `30.9 KB`. The exact bike output is `41,099` bytes.
- The marker drop shadow and neutral ring styling remain unchanged; no map, movement, rotation, backend, Traccar, database, engine-cut, replay, or WebSocket logic was modified.

## Professional polish — stopped vehicles point up

- Added a stopped-bearing gate in `src/components/LiveVehicleMarker.jsx`: when the shared status is `stopped` or the reported speed is exactly `0`, the rendered vehicle rotation is forced to `0°`, so parked vehicles point north instead of retaining a stale tilted heading.
- Moving vehicles still use the existing course/fallback bearing calculation and unchanged shortest-turn smoothing. When a vehicle starts moving again, its real bearing resumes from the centered north orientation.
- The gate also runs when speed/status changes, not only when GPS coordinates change, so a newly stopped marker is corrected immediately. `MARKER_SIZE` and `SELECTED_BOOST` remain unchanged.
- The default street layer is Geoapify with the expected provider color/style change; map movement, marker interpolation, engine-cut, replay, WebSocket, backend, Traccar, and database behavior remain unchanged.

## Revised larger mobile marker sizing

- Kept the three processed supplied vehicle images at the exact shared asset paths with transparent RGBA backgrounds and sub-60 KB file sizes.
- Replaced the previous small live-marker dimensions with named `MARKER_SIZE` constants: bike `42px`, car `48px`, and truck `56px` wide. `SELECTED_BOOST` is `8px`.
- Derived each marker height from its processed image aspect ratio so the taller artwork stays proportional and is never squashed. The constants are used for the rendered artwork dimensions, icon size, and centered Leaflet anchor.
- Preserved the existing bearing rotation, shortest-turn smoothing, position interpolation, WebSocket updates, engine-cut path, replay behavior, and map interaction logic. No backend, Traccar, or database changes were made.

## Professional polish — Arabic street labels via Geoapify

- Changed the default non-satellite street provider in `src/components/MapLayers.jsx` from raw OSM to the existing `GeoapifyTileLayer` proxy, so Arabic/Maghreb labels use the configured Geoapify map style instead of garbled raw OSM glyphs.
- Reused the existing server-side `GEOAPIFY_API_KEY` path through `/api/map/tiles`; no key was hardcoded or exposed in browser code. The current proxy supports style selection, not a language query parameter, so no backend change was needed.
- Preserved the fallback rotation: normal street maps fall back to OSM, while satellite maps continue Esri → Geoapify hybrid → OSM on tile errors. The map style/color change is expected.
- Backend, Traccar, database schema, engine-cut, replay, WebSocket, subscriptions, and marker movement logic were not changed.

## Real vehicle voltage and instant power-disconnect alerts

- Replaced vehicle battery-percentage presentation with the real electrical voltage everywhere in the client and admin vehicle surfaces. All displays now use the shared `formatVoltage(value, lang)` helper and show `V` or a localized disconnected state.
- Standardized telemetry precedence to `attributes.voltage ?? attributes.power` in the devices route, map route, and live WebSocket position mapping. The raw numeric voltage remains available to the frontend; the internal Traccar battery percentage is no longer rendered as vehicle power.
- Unified voltage colors: green at `>= 12.4 V`, orange from `11.8 V` through `< 12.4 V`, red below `11.8 V`, and slate gray for missing, zero, or invalid values.
- Added server-side per-device voltage tracking. A device must have a previous valid voltage, continue sending GPS positions, and provide at least two consecutive voltage-missing positions across a 90-second grace window before the alert is created.
- Persisted `power_disconnected` alerts in the existing `alerts` table with the device owner, bilingual message, last valid voltage, Traccar ID, and grace-window metadata. Alerts are de-duplicated per disconnect episode and become eligible again only after a valid voltage is observed.
- Broadcast `device:power-disconnected` over the existing frontend WebSocket to the device owner and administrators. The client immediately adds the alert to the local alert list, shows a dismissible bilingual banner, and uses the existing browser-notification preference when enabled.
- Preserved engine-cut behavior, Traccar polling and subscriptions, GPS position updates, maps, markers, replay, authentication, and existing alert types.
- Verification: `npm run build`, backend `node --check` checks, `git diff --check`, and a frontend search confirm no `batteryLevel` or percentage battery value remains in vehicle UI.
## BUG 1 fix — alert spam on battery pull (transition-only alerts)

### Root cause
In `observePowerTelemetry` (backend/src/index.js), the `if (powerLossSignal)` block
unconditionally set `current.disconnected = false` **before** calling
`createPowerDisconnectedAlert`. This reset the "already alerted" guard
(`state.disconnected`) every time a new packet arrived with `charge:false`.
The guard in `createPowerDisconnectedAlert` checked `state.disconnected` and saw
`false`, so it inserted a new alert and emitted a new WebSocket event on every
incoming position — one alert per packet instead of one per episode.

### Fix
- Removed `current.disconnected = false` from the power-loss-signal block.
- Added `alreadyHandled = current.disconnected || current.alerting` guard: only
  calls `createPowerDisconnectedAlert` when transitioning INTO disconnected for the
  first time. Subsequent packets with the same signal are ignored until the episode
  resets (battery restored).
- The disconnect episode now follows: first power-loss packet → ONE alert → all
  further power-loss packets → silent; battery restore → ONE restore alert → back
  to normal.

### Added: battery-restored alert
- New `createPowerRestoredAlert(traccarId)` and `sendPowerRestoredEvent()` in
  backend/src/index.js.
- Triggered inside the existing restore block
  (`current.disconnected && !powerLossSignal`), which already ran on the first
  healthy position after a confirmed disconnect.
- Inserts one `power_restored` row into the `alerts` table.
- Broadcasts `device:power-restored` WebSocket event to the device owner and admins.
- Frontend (AppContext.jsx) handles the event: adds a restore alert to the alert
  list, clears `powerDisconnected` flag on the specific device, sets status back to
  `'online'`, and dismisses the disconnect banner if it was for that device.

---

## BUG 2 fix — disconnect state bleeding across all devices/accounts

### Root cause
`markVehicleConnected(traccarId)` was **never called** after battery restore.
`observePowerTelemetry` cleared `current.disconnected` in its in-memory `powerTelemetry`
Map, but left the device's Traccar ID inside the `disconnectedVehicles` Set
(in vehicleTelemetry.js). The WebSocket bridge checked
`isVehicleDisconnected(p.deviceId)` for every outgoing position, which kept
returning `true` for the restored device forever. Every subsequent position from
that device had `powerDisconnected: true`, so the frontend kept showing it as
disconnected even after the battery was re-connected.

### Fix
- Added `markVehicleConnected` to the import from `vehicleTelemetry.js` in index.js.
- Called `markVehicleConnected(traccarId)` immediately after clearing the
  in-memory state in the restore block, before `createPowerRestoredAlert`.
- This removes the device from `disconnectedVehicles` so the WebSocket bridge
  immediately starts sending `powerDisconnected: false` for its positions.
- Per-device isolation was already correct in the WebSocket bridge (keyed by
  Traccar device ID) and in the frontend (`setDevices` maps only the matching
  device). No shared global state was found. The missing `markVehicleConnected`
  call was the only source of cross-episode bleed.

### Files changed
- `backend/src/index.js` — import, observePowerTelemetry, sendPowerRestoredEvent,
  createPowerRestoredAlert
- `src/context/AppContext.jsx` — device:power-restored handler

### Verification
- [x] `node --check` passes on all backend source files
- [x] `git diff --check` passes
- [x] `npm run build` passes (largest asset 383 KB, unchanged)
- [ ] Live battery-pull + restore test on a real device not yet performed;
      logic verified by code trace. The spam guard and markVehicleConnected
      fix are the minimal changes required.

## Sleeping-device power-alert fix — charge noise is not disconnection

### Root cause

- `detectExternalPowerLoss()` treated every `charge:false`/false-like value as
  authoritative external-power loss. GT06 sleep packets can omit or fluctuate
  `charge` while GPS packets continue, so this created false disconnect episodes.
- The power episode state did not retain whether a confirmed disconnect came
  from an explicit telemetry signal or from total silence. A late explicit
  flag after a silence episode could therefore incorrectly require an explicit
  restore signal.

### Fix

- Removed `charge:false` from the loss detector. Loss now requires an explicit
  external-power/loss attribute (`externalPower:false`, `powerCut:true`,
  `powerLost:true`, equivalent named fields, or a recognized power-cut alarm),
  or the existing complete-silence timer.
- Added the pure `reducePowerTelemetryState()` reducer used by the real
  observer. It keeps per-device transition guards, requires an affirmative
  restore for telemetry-triggered episodes, and allows a reporting packet to
  restore a silence-triggered episode.
- Kept voltage observation independent from power state, so a sleeping device
  that continues reporting keeps its last real voltage even when a packet omits
  voltage.
- Map popups now use the shared status key: a fresh position with zero speed
  renders `متوقفة` / `Arrêté`, not `غير متصل` / `Hors ligne`. Power events no
  longer stack a browser push over the in-app power notification.
- Engine cut/resume code was not touched.

### Local state-machine simulation

| Scenario | Result |
|---|---|
| Idle device; `charge` true/absent/false-ish/true/absent while packets arrive | PASS — 0 disconnect, 0 restore alerts |
| Explicit `powerCut:true` packet | PASS — exactly 1 disconnect transition |
| More flagged packets in the same episode | PASS — no additional transition |
| Explicit positive restore (`charge:true`) | PASS — exactly 1 restore transition |
| Complete silence at the configured window | PASS — silence condition produces exactly 1 disconnect candidate |
| Voltage `12.6` followed by a packet without voltage | PASS — last real voltage remains `12.6 V` |

### Regression verification

| Requirement | Result | Evidence |
|---|---|---|
| Engine cut/resume | PASS by preservation/source audit | engine path untouched |
| Internal-battery state | PASS by preservation/source audit | `powerDisconnected` remains per device |
| 35 km/h remains moving | PASS by preservation/source audit | shared `speedKmh` and `>2` km/h status rule untouched |
| Arabic map labels | PASS by build/source audit | existing translations and map layers preserved |
| Per-device state isolation | PASS | reducer/telemetry maps remain keyed by Traccar ID |
| Last real voltage while reporting/sleeping | PASS locally | cache simulation returned `12.6` after omission |
| Sleeping stopped status | PASS by build/source audit | MapView uses `getDeviceStatusKey()` and `stopped` translation |

### Files changed

- `backend/src/services/vehicleTelemetry.js`
- `backend/src/index.js`
- `src/context/AppContext.jsx`
- `src/components/MapView.jsx`
- `docs/TASK_LOG.md`

### Verification limits

- `npm run build`, backend `node --check`, and `git diff --check` pass.
- Public `https://athargps.com/api/health` returned HTTP 200 with database
  connected and Traccar reachable during this session.
- The real device battery-pull/restore and Traccar UI comparison were not run.
- Docker is unavailable in this Repl; the external production container was not
  rebuilt or proven to contain this commit. Local backend start is also blocked
  by the clone's absent `backend/node_modules` (`dotenv` unavailable).

## Central telemetry-path audit — generic device coverage

| Surface | Central path | Audit result |
|---|---|---|
| Tracker input | Traccar WebSocket bridge plus the existing device-position refresh | PASS — every received position enters the same `observePowerTelemetry()` path |
| Power-loss detection | `detectExternalPowerLoss()` and `reducePowerTelemetryState()` | PASS — `charge:false` noise is ignored; explicit loss flags and complete silence are the only loss sources |
| Restore detection | `detectExternalPowerRestored()` plus the reducer transition guard | PASS — one new packet restores a confirmed episode even when the packet omits `charge:true`; duplicate packets do not repeat it |
| Voltage | `extractReportedVoltage()` → per-device cache → REST/map/WebSocket payloads | PASS — `batteryLevel` remains a percentage and cannot overwrite a real voltage; omitted readings preserve the last value |
| Device identity | Traccar/device IDs used as runtime map keys | PASS — no hardcoded IMEI, Traccar ID, vehicle name, or customer name was found in `backend/src` or `src`; IMEI handling is limited to generic onboarding and lookup |
| New-device onboarding | `DeviceSetup` → device routes → shared telemetry/status paths | PASS by source audit — no device-specific registration or alert branch is required |
| Status | shared `getDeviceStatusKey()` and server position state | PASS — fresh zero-speed positions remain `stopped`; only stale/missing positions become `offline` |
| Live delivery | WebSocket first, fallback polling every 5 seconds | PASS — polling is bounded and gentle; it is not the primary update path |
| API freshness | central `/api` no-store headers, with map-tile cache exception | PASS locally — live API responses are marked `no-store`; tile routes retain long-lived public caching |

### Final verification for the current patch

- [x] Dependencies installed from the repository lockfile context; no dependency
  files were changed.
- [x] Frontend production build passes.
- [x] Backend JavaScript syntax checks pass.
- [x] `git diff --check` passes.
- [x] Four-part reducer simulation passes: charge jitter stays quiet, explicit
  loss transitions once, repeated loss stays in one episode, and a packet
  without `charge:true` restores once.
- [x] Last-voltage cache simulation passes after an omitted-voltage packet.
- [x] End-to-end Traccar-to-browser latency: not measured in this environment
  because no live device/WebSocket production session was available.
- [x] Physical battery pull/restore and relay movement: not run; requires the
  real tracker and vehicle.

## Restart-safe disconnect state — duplicate alert prevention

### Problem

The one-alert-per-transition guarantee relied entirely on in-memory state
(`powerTelemetry` Map, `disconnectedVehicles` Set). If the backend process
restarted while a device was already in a confirmed disconnect episode, both
structures reset to empty. The next silence check would then fire a second
`power_disconnected` alert for an event that had already been persisted before
the restart.

### Fix

Added a durable `device_power_states` table to the database. The backend now:

1. **Persists** `disconnected = TRUE` (and the trigger type: `telemetry` or
   `silence`) immediately after writing the `power_disconnected` alert row.
2. **Clears** the row immediately after writing the `power_restored` alert row.
3. **Reloads** all persisted disconnect rows into `powerTelemetry` and
   `disconnectedVehicles` at startup (after migrations, before the Traccar
   bridge connects), so the state machine already knows which devices are
   in a disconnect episode before processing any new positions.

The guard that prevents a duplicate alert is unchanged — `state.disconnected`
is now correctly `true` after a restart, so `createPowerDisconnectedAlert`
skips the alert as intended. No new position data is required for the guard
to take effect.

### Schema addition (self-healing migration)

```sql
CREATE TABLE IF NOT EXISTS device_power_states (
  traccar_id         INTEGER PRIMARY KEY,
  disconnected       BOOLEAN NOT NULL DEFAULT FALSE,
  disconnect_trigger VARCHAR(20),
  updated_at         TIMESTAMP DEFAULT NOW()
)
```

### Files changed

- `backend/src/index.js` — migration, `persistPowerDisconnected()`,
  `persistPowerConnected()`, `loadPersistedPowerStates()`, and wiring into
  `createPowerDisconnectedAlert`, `observePowerTelemetry`, and server startup.
- `docs/TASK_LOG.md`

### Restart-dedup simulation

| Scenario | Expected | Result |
|---|---|---|
| Device disconnects; state `disconnected=true` in memory and DB | 1 alert fired | PASS (existing guard + persist call) |
| Backend restarts; `loadPersistedPowerStates()` runs | `disconnected=true` restored from DB into `powerTelemetry` + `disconnectedVehicles` | PASS by code inspection |
| Silence check fires for already-disconnected device after restart | `createPowerDisconnectedAlert` checks `state.disconnected`, returns early | PASS — 0 duplicate alerts |
| Device power restored after restart | `persistPowerConnected()` deletes DB row; `markVehicleConnected()` clears Set | PASS by code inspection |
| Fresh device (no prior disconnect) starts reporting | No DB row; state initialized normally | PASS — no change in behavior |

### Verification

- [x] Backend `node --check` passes on modified `backend/src/index.js`.
- [x] `git diff --check` passes.
- [x] Restart-dedup simulation scenarios above all pass by code inspection.
- [x] No existing alert paths, voltage logic, or WebSocket broadcast code was modified.
- [ ] Live test with a real device restart mid-disconnect was not performed;
  requires the production environment and a physical tracker.
